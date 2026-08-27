"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { createProposalSchema, parseId } from "@/lib/validation/schemas";
import { createNotification } from "@/lib/notifications/actions";
import type { ActionResult } from "@/lib/auth/actions";

// ─── Create Proposal ───────────────────────────────────────────────

/**
 * Submit a proposal on an open task.
 *
 * Guard: student role only.
 * Validates that:
 *   - The task exists and is "open"
 *   - The student hasn't already submitted a proposal for this task
 *
 * ★ Security: We check task.status server-side, not client-side.
 *   A student could craft a request to a closed task — the DB check
 *   blocks it.  We also prevent duplicate proposals per student/task.
 */
export async function createProposal(
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRole("student");

  // ── Parse FormData ──────────────────────────────────────────────
  const raw = {
    task_id: formData.get("task_id") as string,
    cover_message: formData.get("cover_message") as string,
    proposed_price: formData.get("proposed_price")
      ? Number(formData.get("proposed_price"))
      : undefined,
    timeline_estimate:
      (formData.get("timeline_estimate") as string) || undefined,
  };

  // ── Validate ────────────────────────────────────────────────────
  const parsed = createProposalSchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Invalid input" };
  }

  const supabase = await createClient();

  // ── Verify task exists and is open ─────────────────────────────
  const { data: task, error: taskError } = await supabase
    .from("micro_tasks")
    .select("id, status, client_id, title")
    .eq("id", parsed.data.task_id)
    .single();

  if (taskError || !task) {
    return { error: "Task not found" };
  }

  if (task.status !== "open") {
    return { error: "This task is no longer accepting proposals" };
  }

  // ── Check for duplicate proposal ───────────────────────────────
  const { data: existing } = await supabase
    .from("task_proposals")
    .select("id")
    .eq("task_id", parsed.data.task_id)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existing) {
    return { error: "You have already submitted a proposal for this task" };
  }

  // ── Insert ─────────────────────────────────────────────────────
  const { error: insertError } = await supabase
    .from("task_proposals")
    .insert({
      task_id: parsed.data.task_id,
      student_id: user.id,
      cover_message: parsed.data.cover_message,
      proposed_price: parsed.data.proposed_price ?? null,
      timeline_estimate: parsed.data.timeline_estimate ?? null,
      status: "pending",
    });

  if (insertError) {
    return { error: "Failed to submit proposal. Please try again." };
  }

  // ── Notify the business owner (fire-and-forget) ───────────────
  await createNotification({
    userId: task.client_id,
    type: "proposal_received",
    title: "New proposal received",
    message: `A student submitted a proposal on "${task.title}"`,
    link: `/dashboard/tasks/${task.id}`,
  });

  revalidatePath(`/ticker/${parsed.data.task_id}`);
  revalidatePath(`/dashboard/tasks/${parsed.data.task_id}`);
  return { success: true, message: "Proposal submitted!" };
}

// ─── Withdraw Proposal ─────────────────────────────────────────────

/**
 * Withdraw a pending proposal.
 *
 * Guard: student role only, must own the proposal.
 * Only pending proposals can be withdrawn — accepted/rejected are final.
 */
export async function withdrawProposal(
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRole("student");

  const proposalId = parseId(formData.get("proposalId"));
  if (!proposalId) return { error: "Proposal not found" };

  const supabase = await createClient();

  // ── Fetch & verify ownership ───────────────────────────────────
  const { data: proposal, error: fetchError } = await supabase
    .from("task_proposals")
    .select("id, student_id, task_id, status")
    .eq("id", proposalId)
    .single();

  if (fetchError || !proposal) return { error: "Proposal not found" };
  if (proposal.student_id !== user.id) return { error: "Proposal not found" };
  if (proposal.status !== "pending") {
    return { error: "Only pending proposals can be withdrawn" };
  }

  // ── Update status ──────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("task_proposals")
    .update({ status: "withdrawn" })
    .eq("id", proposalId);

  if (updateError) {
    return { error: "Failed to withdraw proposal. Please try again." };
  }

  revalidatePath(`/ticker/${proposal.task_id}`);
  revalidatePath(`/dashboard/tasks/${proposal.task_id}`);
  return { success: true, message: "Proposal withdrawn" };
}

// ─── Accept Proposal ───────────────────────────────────────────────

/**
 * Accept a pending proposal.
 *
 * Guard: business role, must own the task.
 *
 * ★ Why an RPC instead of sequential writes?
 *   The Supabase JS client has no transaction API — every .from().update()
 *   is its own auto-committed statement.  The previous implementation ran
 *   four sequential writes with best-effort compensating rollbacks, and
 *   any transient network / DB blip between them could leave the proposal
 *   `accepted` but the task still `open` (silent deadlock: audit #1).
 *   Migration 005 defines `accept_proposal(p_proposal_id)` — one server-
 *   side function, one transaction, `SELECT … FOR UPDATE` on the task row
 *   to serialise concurrent accepts.  Any failure aborts the whole thing.
 *
 * ★ The RPC also folds in the audit-#4 fix by re-checking `client_id =
 *   auth.uid()` inside the DB, using the same generic "not found" error
 *   for every non-owner path.  We keep a cheap pre-check here to short-
 *   circuit before the RPC round-trip, but the RPC is the authoritative
 *   gate.
 */
export async function acceptProposal(
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRole("business");

  const proposalId = parseId(formData.get("proposalId"));
  if (!proposalId) return { error: "Proposal not found" };

  const supabase = await createClient();

  // ── Cheap pre-check: fetch task title for notifications and confirm
  //    the caller has any business reading this task at all.  If the
  //    ownership check fails here we bail with the generic message —
  //    same as the RPC would return — so nothing about task existence
  //    leaks to non-owners (audit finding #4).
  const { data: proposal } = await supabase
    .from("task_proposals")
    .select("id, task_id, student_id, micro_tasks!inner(title, client_id)")
    .eq("id", proposalId)
    .single();

  if (!proposal || proposal.micro_tasks.client_id !== user.id) {
    return { error: "Proposal not found" };
  }

  // ── The atomic acceptance ─────────────────────────────────────
  const { data: rejected, error: rpcError } = await supabase.rpc(
    "accept_proposal",
    { p_proposal_id: proposalId },
  );

  if (rpcError) {
    // The RPC raises with meaningful messages; forward the ones a
    // business user can act on, hide the rest behind a generic string.
    const msg = rpcError.message ?? "";
    if (msg.includes("proposal not found")) {
      return { error: "Proposal not found" };
    }
    if (msg.includes("proposal is not pending")) {
      return { error: "Only pending proposals can be accepted" };
    }
    if (msg.includes("task is no longer open")) {
      return { error: "Task is no longer open for proposals" };
    }
    return { error: "Failed to accept proposal. Please try again." };
  }

  // ── Notifications (fire-and-forget, outside the transaction) ───
  await createNotification({
    userId: proposal.student_id,
    type: "proposal_accepted",
    title: "Proposal accepted! 🎉",
    message: `Your proposal on "${proposal.micro_tasks.title}" was accepted. Time to get started!`,
    link: `/dashboard/proposals`,
  });

  if (rejected?.length) {
    await Promise.all(
      rejected.map((r) =>
        createNotification({
          userId: r.rejected_student_id,
          type: "proposal_rejected",
          title: "Proposal not selected",
          message: `Another proposal was chosen for "${proposal.micro_tasks.title}". Keep applying!`,
          link: `/dashboard/proposals`,
        }),
      ),
    );
  }

  revalidatePath(`/dashboard/tasks/${proposal.task_id}`);
  revalidatePath("/dashboard/tasks");
  revalidatePath("/ticker");
  return { success: true, message: "Proposal accepted! Task is now in progress." };
}

// ─── Reject Proposal ───────────────────────────────────────────────

/**
 * Reject a single pending proposal.
 *
 * Guard: business role, must own the task.
 */
export async function rejectProposal(
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRole("business");

  const proposalId = parseId(formData.get("proposalId"));
  if (!proposalId) return { error: "Proposal not found" };

  const supabase = await createClient();

  // ── Fetch proposal + verify task ownership ─────────────────────
  const { data: proposal, error: fetchError } = await supabase
    .from("task_proposals")
    .select("id, task_id, student_id, status")
    .eq("id", proposalId)
    .single();

  if (fetchError || !proposal) return { error: "Proposal not found" };
  if (proposal.status !== "pending") {
    return { error: "Only pending proposals can be rejected" };
  }

  // Verify the business user owns the task
  const { data: task, error: taskError } = await supabase
    .from("micro_tasks")
    .select("id, client_id, title")
    .eq("id", proposal.task_id)
    .single();

  if (taskError || !task) return { error: "Task not found" };
  if (task.client_id !== user.id) return { error: "Task not found" };

  // ── Reject ─────────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("task_proposals")
    .update({ status: "rejected" })
    .eq("id", proposalId);

  if (updateError) {
    return { error: "Failed to reject proposal. Please try again." };
  }

  // ── Notify the student (fire-and-forget) ──────────────────────
  await createNotification({
    userId: proposal.student_id,
    type: "proposal_rejected",
    title: "Proposal not selected",
    message: `Your proposal on "${task.title}" was not selected. Keep applying!`,
    link: `/dashboard/proposals`,
  });

  revalidatePath(`/dashboard/tasks/${proposal.task_id}`);
  return { success: true, message: "Proposal rejected" };
}

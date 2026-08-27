"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { createProposalSchema } from "@/lib/validation/schemas";
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

  const proposalId = formData.get("proposalId") as string;
  if (!proposalId) return { error: "Proposal ID is required" };

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
 * Accept a pending proposal — multi-step operation:
 *   1. Mark the proposal as "accepted"
 *   2. Create a task_assignment row
 *   3. Transition the task from "open" → "in_progress"
 *   4. Reject all other pending proposals for the same task
 *
 * Guard: business role, must own the task.
 *
 * ★ Why not a Postgres function? For this campus MVP, sequential
 *   server-side calls are acceptable. If two businesses could race
 *   to accept proposals on shared tasks, we'd need a DB-level lock.
 *   Since tasks have a single owner (client_id), this is safe.
 */
export async function acceptProposal(
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRole("business");

  const proposalId = formData.get("proposalId") as string;
  if (!proposalId) return { error: "Proposal ID is required" };

  const supabase = await createClient();

  // ── Fetch proposal with task ownership check ───────────────────
  const { data: proposal, error: fetchError } = await supabase
    .from("task_proposals")
    .select("id, task_id, student_id, status")
    .eq("id", proposalId)
    .single();

  if (fetchError || !proposal) return { error: "Proposal not found" };
  if (proposal.status !== "pending") {
    return { error: "Only pending proposals can be accepted" };
  }

  // Verify the business user owns the task
  const { data: task, error: taskError } = await supabase
    .from("micro_tasks")
    .select("id, client_id, status, title")
    .eq("id", proposal.task_id)
    .single();

  if (taskError || !task) return { error: "Task not found" };
  if (task.client_id !== user.id) return { error: "Task not found" };
  if (task.status !== "open") {
    return { error: "Task is no longer open for proposals" };
  }

  // ── Step 1: Accept the proposal ────────────────────────────────
  const { error: acceptError } = await supabase
    .from("task_proposals")
    .update({ status: "accepted" })
    .eq("id", proposalId);

  if (acceptError) {
    return { error: "Failed to accept proposal. Please try again." };
  }

  // ── Step 2: Create task assignment ─────────────────────────────
  const { error: assignError } = await supabase
    .from("task_assignments")
    .insert({
      task_id: proposal.task_id,
      student_id: proposal.student_id,
      proposal_id: proposalId,
    });

  if (assignError) {
    // Rollback step 1
    await supabase
      .from("task_proposals")
      .update({ status: "pending" })
      .eq("id", proposalId);
    return { error: "Failed to assign task. Please try again." };
  }

  // ── Step 3: Transition task → in_progress ──────────────────────
  const { error: statusError } = await supabase
    .from("micro_tasks")
    .update({ status: "in_progress" })
    .eq("id", proposal.task_id);

  if (statusError) {
    // Rollback steps 1 & 2
    await supabase
      .from("task_assignments")
      .delete()
      .eq("proposal_id", proposalId);
    await supabase
      .from("task_proposals")
      .update({ status: "pending" })
      .eq("id", proposalId);
    return { error: "Failed to update task status. Please try again." };
  }

  // ── Step 4: Reject other pending proposals ─────────────────────
  // Fetch the other pending proposals BEFORE rejecting so we have
  // their student_ids for notifications.
  const { data: otherProposals } = await supabase
    .from("task_proposals")
    .select("id, student_id")
    .eq("task_id", proposal.task_id)
    .eq("status", "pending")
    .neq("id", proposalId);

  await supabase
    .from("task_proposals")
    .update({ status: "rejected" })
    .eq("task_id", proposal.task_id)
    .eq("status", "pending")
    .neq("id", proposalId);

  // ── Notifications (fire-and-forget) ───────────────────────────
  // Notify the accepted student
  await createNotification({
    userId: proposal.student_id,
    type: "proposal_accepted",
    title: "Proposal accepted! 🎉",
    message: `Your proposal on "${task.title}" was accepted. Time to get started!`,
    link: `/dashboard/proposals`,
  });

  // Notify each auto-rejected student
  if (otherProposals?.length) {
    await Promise.all(
      otherProposals.map((p) =>
        createNotification({
          userId: p.student_id,
          type: "proposal_rejected",
          title: "Proposal not selected",
          message: `Another proposal was chosen for "${task.title}". Keep applying!`,
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

  const proposalId = formData.get("proposalId") as string;
  if (!proposalId) return { error: "Proposal ID is required" };

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

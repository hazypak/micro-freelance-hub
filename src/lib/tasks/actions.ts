"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import {
  createTaskSchema,
  updateTaskSchema,
  parseId,
} from "@/lib/validation/schemas";
import { createNotification } from "@/lib/notifications/actions";
import { checkTermsLock } from "@/lib/tasks/terms-lock";
import type { ActionResult } from "@/lib/auth/actions";

// ─── State Machine ──────────────────────────────────────────────────
//
// Encodes every legal task-status transition and who may trigger it.
//   "client"  = the business that owns the task (micro_tasks.client_id)
//   "student" = the student assigned to the task (task_assignments)
//
// Terminal statuses (completed, cancelled, disputed) have no outgoing
// edges — once a task lands there, its status is frozen.
//
// Student-side transitions (in_progress → submitted) are enforced by
// specialised actions in later phases (submissions), not by the
// generic updateTaskStatus action below.  The map is exported so
// those actions can reuse it for validation.
// ─────────────────────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<
  string,
  { to: string; by: "client" | "student" | "system" }[]
> = {
  draft: [
    { to: "open", by: "client" },
    { to: "cancelled", by: "client" },
  ],
  open: [
    // "system" — this transition happens inside the accept_proposal RPC.
    // It is illegal to invoke via updateTaskStatus (audit finding #3);
    // the guard below rejects it explicitly, and the DB-level trigger
    // added in migration 005 refuses to insert an assignment against a
    // non-accepted proposal, closing the same hole at two layers.
    { to: "in_progress", by: "system" },
    { to: "cancelled", by: "client" },
  ],
  in_progress: [
    { to: "submitted", by: "student" }, // handled by submission action
  ],
  submitted: [
    { to: "client_review", by: "client" },
  ],
  client_review: [
    { to: "completed", by: "client" },
    { to: "disputed", by: "client" },
  ],
};

// ─── Create Task ────────────────────────────────────────────────────

/**
 * Create a new micro-task in draft status.
 *
 * Guard: business role only.
 * On success: redirects to the new task's detail page.
 */
export async function createTask(
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRole("business");

  // ── Parse FormData ──────────────────────────────────────────────
  const raw = {
    title: formData.get("title"),
    description: formData.get("description"),
    brief: formData.get("brief") || undefined,
    category: formData.get("category"),
    budget: Number(formData.get("budget")),
    deadline: formData.get("deadline") || undefined,
    required_skills: parseJsonArray(formData.get("required_skills")),
    permitted_deliverable_types: parseJsonArray(
      formData.get("permitted_deliverable_types"),
    ),
  };

  // ── Validate ────────────────────────────────────────────────────
  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Invalid input" };
  }

  // ── Insert ──────────────────────────────────────────────────────
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("micro_tasks")
    .insert({
      client_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      brief: parsed.data.brief ?? null,
      category: parsed.data.category,
      budget: parsed.data.budget,
      deadline: parsed.data.deadline ?? null,
      required_skills: parsed.data.required_skills ?? [],
      permitted_deliverable_types:
        parsed.data.permitted_deliverable_types ?? [],
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Failed to create task. Please try again." };
  }

  revalidatePath("/dashboard/tasks");
  redirect(`/dashboard/tasks/${data.id}`);
}

// ─── Update Task ────────────────────────────────────────────────────

/**
 * Update an existing task's fields.
 *
 * Guard: business role, task owner, draft or open status only.
 * Returns ActionResult (does not redirect — stays on the same page).
 */
export async function updateTask(
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRole("business");

  const taskId = parseId(formData.get("taskId"));
  if (!taskId) return { error: "Task not found" };

  const supabase = await createClient();

  // ── Verify ownership & editable status ──────────────────────────
  const { data: task, error: fetchError } = await supabase
    .from("micro_tasks")
    .select("id, client_id, status, budget, deadline")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) return { error: "Task not found" };

  // ★ Audit finding #4 — generic message for every non-owner path so
  //   we never disclose the task exists or its status to anyone else.
  if (task.client_id !== user.id) {
    return { error: "Task not found" };
  }

  if (task.status !== "draft" && task.status !== "open") {
    return { error: "Only draft or open tasks can be edited" };
  }

  // ── Terms lock (audit finding #6) ───────────────────────────────
  //
  // Students bid against the budget and deadline they can see. If the
  // owner can silently rewrite those after proposals land, every
  // outstanding bid is answering a question that no longer exists —
  // a student who quoted RM150 for a 2-week job is still on record
  // at RM150 when it becomes a 3-day job for RM40.
  //
  // We only care about proposals that are still live; rejected and
  // withdrawn ones have no stake in the terms.
  const { count: pendingProposalCount } = await supabase
    .from("task_proposals")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId)
    .eq("status", "pending");

  const hasLiveProposals = (pendingProposalCount ?? 0) > 0;

  // ── Build partial update from submitted fields ──────────────────
  const raw: Record<string, unknown> = {};

  for (const key of [
    "title",
    "description",
    "category",
  ] as const) {
    const val = formData.get(key);
    if (val) raw[key] = val;
  }

  // ── Optional fields — an empty submission means "clear it" ──────
  //
  // ★ These must map empty → null, NOT undefined. supabase-js builds
  //   its PATCH body with JSON.stringify, and JSON.stringify drops
  //   undefined-valued keys — so the previous `|| undefined` produced
  //   a payload with the field missing entirely, and the column kept
  //   its old value. Clearing a brief or a deadline silently no-opped.
  for (const key of ["brief"] as const) {
    const val = formData.get(key);
    if (val !== null) raw[key] = val || null;
  }

  const budget = formData.get("budget");
  if (budget) raw.budget = Number(budget);

  const deadline = formData.get("deadline");
  if (deadline !== null) raw.deadline = deadline || null;

  const requiredSkills = formData.get("required_skills");
  if (requiredSkills !== null) {
    raw.required_skills = parseJsonArray(requiredSkills);
  }

  const deliverableTypes = formData.get("permitted_deliverable_types");
  if (deliverableTypes !== null) {
    raw.permitted_deliverable_types = parseJsonArray(deliverableTypes);
  }

  if (Object.keys(raw).length === 0) {
    return { error: "No fields to update" };
  }

  // ── Validate with partial schema ────────────────────────────────
  const parsed = updateTaskSchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Invalid input" };
  }

  // ── Apply the terms-lock policy (audit finding #6) ──────────────
  if (hasLiveProposals) {
    const violation = checkTermsLock(
      { budget: task.budget, deadline: task.deadline },
      parsed.data,
    );
    if (violation) return { error: violation };
  }

  // ── Persist ─────────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("micro_tasks")
    .update(parsed.data)
    .eq("id", taskId);

  if (updateError) {
    return { error: "Failed to update task. Please try again." };
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  revalidatePath("/dashboard/tasks");
  return { success: true, message: "Task updated" };
}

// ─── Update Task Status ─────────────────────────────────────────────

/**
 * Transition a task to a new status, enforcing the state machine.
 *
 * Guard: business role, task owner.
 *
 * This action handles *client-side* transitions only (publish, cancel,
 * start review, complete, dispute).  Student-side transitions
 * (submit work) are handled by the submission action, which calls
 * the transition map directly for validation.
 */
export async function updateTaskStatus(
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRole("business");

  const taskId = parseId(formData.get("taskId"));
  const newStatus = formData.get("status");
  if (!taskId || typeof newStatus !== "string" || !newStatus) {
    return { error: "Task not found" };
  }

  const supabase = await createClient();

  // ── Fetch current task ──────────────────────────────────────────
  const { data: task, error: fetchError } = await supabase
    .from("micro_tasks")
    .select("id, client_id, status, title")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) return { error: "Task not found" };

  // ★ Audit finding #4 — ownership check FIRST, so non-owners cannot
  //   distinguish a status-transition error from a wrong-role error
  //   and thereby learn the task's current status.  Every failure past
  //   this point produces the same generic "Task not found" string.
  if (task.client_id !== user.id) {
    return { error: "Task not found" };
  }

  // ── Validate transition ─────────────────────────────────────────
  const transitions = VALID_TRANSITIONS[task.status];
  if (!transitions) {
    return { error: `No transitions available from "${task.status}"` };
  }

  const allowed = transitions.find((t) => t.to === newStatus);
  if (!allowed) {
    return {
      error: `Cannot move from "${task.status}" to "${newStatus}"`,
    };
  }

  // Student transitions are handled by specialised actions
  if (allowed.by === "student") {
    return { error: "This transition is handled by a different action" };
  }

  // ★ Audit finding #3 — the open → in_progress edge is marked "system"
  //   because it is only legal inside accept_proposal.  If a client
  //   POSTed status="in_progress" directly, they could freeze a task
  //   with no assigned student.  Refuse it here (belt) — the migration-005
  //   trigger on task_assignments backs this up at the DB (braces).
  if (allowed.by === "system") {
    return {
      error:
        "This transition happens automatically via proposal acceptance",
    };
  }

  // ── Persist ─────────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("micro_tasks")
    .update({ status: newStatus as import("@/lib/supabase/types").TaskStatus })
    .eq("id", taskId);

  if (updateError) {
    return { error: "Failed to update task status. Please try again." };
  }

  // ── Auto-reject pending proposals on cancel ────────────────────
  if (newStatus === "cancelled") {
    const { data: pendingProposals } = await supabase
      .from("task_proposals")
      .select("id, student_id")
      .eq("task_id", taskId)
      .eq("status", "pending");

    if (pendingProposals?.length) {
      const { error: rejectError } = await supabase
        .from("task_proposals")
        .update({ status: "rejected" })
        .eq("task_id", taskId)
        .eq("status", "pending");

      // ★ Audit finding #2 — previously rejectError was swallowed and
      //   we returned success even when the purge failed, leaving the
      //   cancelled task with pending proposals that could still be
      //   accepted.  Now we surface it: the task IS cancelled (that
      //   write already committed above), but proposals are still
      //   pending — the client must retry.  A single-transaction fix
      //   would be an RPC like accept_proposal; leaving that as a
      //   later refactor since the failure is transient in practice.
      if (rejectError) {
        revalidatePath(`/dashboard/tasks/${taskId}`);
        return {
          error:
            "Task was cancelled but pending proposals could not be closed — please retry the cancel action.",
        };
      }

      await Promise.all(
        pendingProposals.map((p) =>
          createNotification({
            userId: p.student_id,
            type: "proposal_rejected",
            title: "Task cancelled",
            message: `The task "${task.title}" was cancelled by the client. Keep applying to other tasks!`,
            link: `/dashboard/proposals`,
          }),
        ),
      );
    }
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  revalidatePath("/dashboard/tasks");
  revalidatePath("/ticker");

  return {
    success: true,
    message: `Task ${newStatus === "open" ? "published" : newStatus}`,
  };
}

// ─── Delete Task ────────────────────────────────────────────────────

/**
 * Permanently delete a draft task.
 *
 * Guard: business role, task owner, draft status only.
 * On success: redirects to the task list.
 */
export async function deleteTask(
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRole("business");

  const taskId = parseId(formData.get("taskId"));
  if (!taskId) return { error: "Task not found" };

  const supabase = await createClient();

  // ── Verify ownership & draft status ─────────────────────────────
  const { data: task, error: fetchError } = await supabase
    .from("micro_tasks")
    .select("id, client_id, status")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) return { error: "Task not found" };
  if (task.client_id !== user.id) return { error: "You don't own this task" };
  if (task.status !== "draft") {
    return { error: "Only draft tasks can be deleted" };
  }

  // ── Delete ──────────────────────────────────────────────────────
  const { error: deleteError } = await supabase
    .from("micro_tasks")
    .delete()
    .eq("id", taskId);

  if (deleteError) {
    return { error: "Failed to delete task. Please try again." };
  }

  revalidatePath("/dashboard/tasks");
  redirect("/dashboard/tasks");
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Safely parse a JSON-encoded string array from FormData.
 *
 * Tag-input components serialise their value as `'["react","node"]'`
 * before appending to FormData.  This helper deserialises that back
 * to a string[] (or undefined if empty / malformed).
 */
function parseJsonArray(
  value: FormDataEntryValue | null,
): string[] | undefined {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  try {
    const result: unknown = JSON.parse(value);
    return Array.isArray(result) ? result : undefined;
  } catch {
    return undefined;
  }
}

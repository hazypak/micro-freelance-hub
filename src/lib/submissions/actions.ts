"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { createSubmissionSchema, parseId } from "@/lib/validation/schemas";
import { createNotification } from "@/lib/notifications/actions";
import { VALID_TRANSITIONS } from "@/lib/tasks/state-machine";
import type { ActionResult } from "@/lib/auth/actions";

// ─── Storage path safety ──────────────────────────────────────────

/**
 * Verify a client-supplied storage path is one this student could
 * legitimately have written for THIS task.
 *
 * ★ Why this matters: the browser uploads to Storage directly and
 *   then hands us the resulting path as a plain string. Without this
 *   check a student could submit a path belonging to a different
 *   task — and because getSignedDownloadUrl authorises by looking up
 *   the submission row that carries the path (and the attacker owns
 *   that row), they'd be able to mint a signed URL for someone
 *   else's private file. Constraining the path to `<taskId>/<file>`
 *   closes that, since assignment to the task is already verified.
 *
 * The shape must match what submission-form.tsx writes:
 *   `${taskId}/${Date.now()}_${safeName}`
 * where safeName is sanitised to [A-Za-z0-9._-].
 */
function isValidStoragePath(path: string, taskId: string): boolean {
  const segments = path.split("/");
  if (segments.length !== 2) return false;
  if (segments[0] !== taskId) return false;

  const filename = segments[1];
  // Reject empty and relative segments before the charset test —
  // "." and ".." would otherwise pass it.
  if (!filename || filename === "." || filename === "..") return false;

  return /^[A-Za-z0-9._-]+$/.test(filename);
}

// ─── Submit Deliverable ───────────────────────────────────────────

/**
 * Student submits work for an assigned task.
 *
 * Multi-step operation:
 *   1. Validate the student is assigned to this task
 *   2. Verify task is in "in_progress" status
 *   3. INSERT a submission row (storage_path is set by the client
 *      after uploading to Supabase Storage)
 *   4. Transition task status: in_progress → submitted
 *   5. Notify the business owner
 *
 * ★ Why is the file uploaded separately? Next.js server actions
 *   can receive FormData with files, but Supabase Storage's RLS
 *   requires the authenticated user's JWT — which only the
 *   browser client has. So the client uploads directly to Storage,
 *   gets back the path, and passes it here.
 */
export async function submitDeliverable(
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRole("student");

  // ── Parse FormData ──────────────────────────────────────────────
  const raw = {
    task_id: formData.get("task_id") as string,
    notes: (formData.get("notes") as string) || undefined,
    deliverable_url: (formData.get("deliverable_url") as string) || undefined,
  };

  const storagePath = (formData.get("storage_path") as string) || null;

  // At least one deliverable method required
  if (!storagePath && !raw.deliverable_url) {
    return { error: "Please upload a file or provide a deliverable URL" };
  }

  // ── Validate ────────────────────────────────────────────────────
  const parsed = createSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Invalid input" };
  }

  // ── Constrain the client-supplied storage path ──────────────────
  // Must live under this task's prefix — see isValidStoragePath.
  if (storagePath && !isValidStoragePath(storagePath, parsed.data.task_id)) {
    return { error: "Invalid file path" };
  }

  const supabase = await createClient();

  // ── Verify assignment ───────────────────────────────────────────
  const { data: assignment, error: assignError } = await supabase
    .from("task_assignments")
    .select("id, task_id")
    .eq("task_id", parsed.data.task_id)
    .eq("student_id", user.id)
    .maybeSingle();

  if (assignError || !assignment) {
    return { error: "You are not assigned to this task" };
  }

  // ── Verify task status ──────────────────────────────────────────
  const { data: task, error: taskError } = await supabase
    .from("micro_tasks")
    .select("id, status, client_id, title")
    .eq("id", parsed.data.task_id)
    .single();

  if (taskError || !task) {
    return { error: "Task not found" };
  }

  // Check state machine allows this transition
  const allowed = VALID_TRANSITIONS[task.status]?.some(
    (t) => t.to === "submitted" && t.by === "student",
  );
  if (!allowed) {
    return { error: "This task is not ready for submission" };
  }

  // ── Check for existing submission ───────────────────────────────
  const { data: existing } = await supabase
    .from("submissions")
    .select("id")
    .eq("task_id", parsed.data.task_id)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existing) {
    return { error: "You have already submitted work for this task" };
  }

  // ── Insert submission ───────────────────────────────────────────
  const { error: insertError } = await supabase.from("submissions").insert({
    task_id: parsed.data.task_id,
    student_id: user.id,
    deliverable_url: parsed.data.deliverable_url ?? null,
    storage_path: storagePath,
    notes: parsed.data.notes ?? null,
    ai_verification_status: "pending",
  });

  if (insertError) {
    return { error: "Failed to submit work. Please try again." };
  }

  // ── Transition task → submitted ─────────────────────────────────
  const { error: statusError } = await supabase
    .from("micro_tasks")
    .update({ status: "submitted" })
    .eq("id", parsed.data.task_id);

  if (statusError) {
    // ★ Audit finding #8: this compensating delete was previously
    //   unchecked. If it ALSO failed, the submission row survived while
    //   the task stayed `in_progress` — and the duplicate guard above
    //   would then refuse every retry with "already submitted", locking
    //   the student out of the task permanently.
    //
    //   The Supabase JS client has no transaction API, so a true fix is
    //   an RPC like accept_proposal (migration 005). Until then, at
    //   minimum distinguish the two failure modes so the student is told
    //   whether retrying can help.
    const { error: rollbackError } = await supabase
      .from("submissions")
      .delete()
      .eq("task_id", parsed.data.task_id)
      .eq("student_id", user.id);

    if (rollbackError) {
      return {
        error:
          "Your work was recorded but the task status could not be updated, and cleanup failed. Please contact support before resubmitting.",
      };
    }

    return { error: "Failed to update task status. Please try again." };
  }

  // ── Notify business owner (fire-and-forget) ─────────────────────
  await createNotification({
    userId: task.client_id,
    type: "submission_received",
    title: "Work submitted! 📦",
    message: `The freelancer submitted their deliverable for "${task.title}"`,
    link: `/dashboard/tasks/${task.id}`,
  });

  revalidatePath(`/dashboard/tasks/${parsed.data.task_id}`);
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
  return { success: true, message: "Work submitted successfully!" };
}

// ─── Get Signed Download URL ──────────────────────────────────────

/**
 * Generate a temporary signed URL for downloading a deliverable file.
 *
 * ★ Why signed URLs? The 'deliverables' bucket is private — files
 *   can't be accessed via public URLs. Instead, we generate a
 *   time-limited signed URL (60 seconds) that the browser can use
 *   to download the file. Only the task owner and the student who
 *   submitted can request a download URL.
 */
export async function getSignedDownloadUrl(
  formData: FormData,
): Promise<ActionResult & { url?: string }> {
  const { user } = await requireRole("student", "business");

  const storagePath = formData.get("storage_path") as string;
  if (!storagePath) return { error: "No file path provided" };

  const supabase = await createClient();

  // ── Verify the caller owns this submission ─────────────────────
  //
  // Defence-in-depth: storage paths are predictable strings, so we
  // MUST NOT trust that possession of a path implies authorisation.
  // Look up the submission row matching this storage_path, join to
  // micro_tasks, and confirm the authenticated user is either the
  // student who submitted OR the client who owns the task.
  //
  // Generic "not found" message for both missing and unauthorised
  // cases — never reveal whether a path exists to a third party.
  // ────────────────────────────────────────────────────────────────
  const { data: submission } = await supabase
    .from("submissions")
    .select("student_id, task_id, micro_tasks!submissions_task_id_fkey(client_id)")
    .eq("storage_path", storagePath)
    .maybeSingle();

  if (!submission) {
    return { error: "File not found" };
  }

  const clientId = (
    submission.micro_tasks as { client_id: string } | null
  )?.client_id;

  if (submission.student_id !== user.id && clientId !== user.id) {
    // Intentionally vague — same message as "not found"
    return { error: "File not found" };
  }

  // Re-derive the path constraint at read time. submitDeliverable now
  // rejects malformed paths, but a row written before that check
  // existed could still point outside its own task's prefix — and the
  // row's owner would sail through the check above. Refuse those.
  if (!isValidStoragePath(storagePath, submission.task_id)) {
    return { error: "File not found" };
  }

  // ── Mint time-limited signed URL ───────────────────────────────
  const { data, error } = await supabase.storage
    .from("deliverables")
    .createSignedUrl(storagePath, 60); // 60 seconds

  if (error || !data?.signedUrl) {
    return { error: "Failed to generate download link" };
  }

  return { success: true, url: data.signedUrl };
}

// ─── Review Submission (business) ─────────────────────────────────

/**
 * Business owner reviews a submission — approve or dispute.
 *
 * This handles TWO transitions:
 *   submitted → client_review  (Start Review)
 *   client_review → completed  (Approve)
 *   client_review → disputed   (Dispute)
 *
 * The task-actions.tsx component already handles these via
 * updateTaskStatus, but we add notification logic here.
 */
export async function reviewSubmission(
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRole("business");

  const taskId = parseId(formData.get("taskId"));
  const newStatus = formData.get("status");

  if (!taskId || typeof newStatus !== "string" || !newStatus) {
    return { error: "Task not found" };
  }

  const supabase = await createClient();

  // ── Verify task ownership ───────────────────────────────────────
  const { data: task, error: taskError } = await supabase
    .from("micro_tasks")
    .select("id, client_id, status, title")
    .eq("id", taskId)
    .single();

  if (taskError || !task) return { error: "Task not found" };
  if (task.client_id !== user.id) return { error: "Task not found" };

  // ── Validate transition ─────────────────────────────────────────
  const allowed = VALID_TRANSITIONS[task.status]?.some(
    (t) => t.to === newStatus && t.by === "client",
  );
  if (!allowed) {
    return { error: "This status transition is not allowed" };
  }

  // ── Update task status ──────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("micro_tasks")
    .update({ status: newStatus as import("@/lib/supabase/types").TaskStatus })
    .eq("id", taskId);

  if (updateError) {
    return { error: "Failed to update task status. Please try again." };
  }

  // ── Get the assigned student for notifications ──────────────────
  const { data: assignment } = await supabase
    .from("task_assignments")
    .select("student_id")
    .eq("task_id", taskId)
    .maybeSingle();

  // ── Send notification based on new status ───────────────────────
  if (assignment?.student_id) {
    if (newStatus === "completed") {
      await createNotification({
        userId: assignment.student_id,
        type: "task_completed",
        title: "Task approved! 🎉",
        message: `Your work on "${task.title}" has been approved. Well done!`,
        link: `/dashboard/proposals`,
      });
    } else if (newStatus === "disputed") {
      await createNotification({
        userId: assignment.student_id,
        type: "task_disputed",
        title: "Submission under review",
        message: `The client raised a concern about "${task.title}". Please check for details.`,
        link: `/dashboard/proposals`,
      });
    }
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");

  const statusLabels: Record<string, string> = {
    client_review: "Review started",
    completed: "Task marked as complete!",
    disputed: "Dispute has been raised",
  };

  return {
    success: true,
    message: statusLabels[newStatus] ?? "Status updated",
  };
}

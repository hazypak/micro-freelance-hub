import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { TaskForm, type TaskFormValues } from "../../task-form";

// ─── Metadata ──────────────────────────────────────────────────────

export const metadata = {
  title: "Edit Task",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /dashboard/tasks/[id]/edit — business-only task edit page.
 *
 * ★ The guards here are a copy of the detail page's, not a convenience.
 *   `updateTask` re-checks role, ownership, and status server-side on
 *   submit; these checks stop a non-owner (or a stale-status task) from
 *   ever seeing the form at all. Same rule, two layers — the page keeps
 *   the wrong person out, the action keeps the wrong write out.
 */
export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireRole("business");
  const { id } = await params;

  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("micro_tasks")
    .select(
      "id, client_id, status, title, description, brief, category, budget, deadline, required_skills, permitted_deliverable_types",
    )
    .eq("id", id)
    .single();

  if (error || !task) notFound();

  // ── Ownership & editable-status gate (mirrors [id]/page.tsx) ──────
  if (task.client_id !== user.id) notFound();
  if (task.status !== "draft" && task.status !== "open") notFound();

  // Narrow the row to just the fields the form reads back.
  const values: TaskFormValues = {
    id: task.id,
    title: task.title,
    description: task.description,
    brief: task.brief,
    category: task.category,
    budget: task.budget,
    deadline: task.deadline,
    required_skills: task.required_skills,
    permitted_deliverable_types: task.permitted_deliverable_types,
  };

  return (
    <>
      <PageHeader
        title="Edit Task"
        description="Update the details of your task"
      />
      <TaskForm task={values} />
    </>
  );
}

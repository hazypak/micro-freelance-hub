import { requireRole } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/page-header";
import { TaskForm } from "../task-form";

// ─── Metadata ──────────────────────────────────────────────────────

export const metadata = {
  title: "Post a Task",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /dashboard/tasks/new — business-only task creation page.
 *
 * Server component verifies the user has the "business" role before
 * rendering.  Students hitting this URL are redirected to /dashboard.
 */
export default async function NewTaskPage() {
  await requireRole("business");

  return (
    <>
      <PageHeader
        title="Post a Task"
        description="Create a new micro-task for student freelancers"
      />
      <TaskForm />
    </>
  );
}

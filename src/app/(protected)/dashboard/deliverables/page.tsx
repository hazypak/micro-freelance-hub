import Link from "next/link";
import {
  ArrowRight,
  Upload,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { formatDate, formatBudget } from "@/lib/format";

import type { Metadata } from "next";
import type { TaskStatus } from "@/components/ui/status-indicator";

// ─── Metadata ──────────────────────────────────────────────────────

export const metadata: Metadata = {
  // Bare title — the root layout appends " · GigBridge" via title.template.
  title: "Deliverables",
};

// ─── Types ─────────────────────────────────────────────────────────

/** Shape returned by the task_assignments → micro_tasks FK join. */
interface AssignmentRow {
  id: string;
  task_id: string;
  micro_tasks: {
    id: string;
    title: string;
    budget: number;
    status: string;
    category: string;
    deadline: string | null;
  } | null;
}

interface SubmissionRow {
  task_id: string;
  submitted_at: string;
  ai_verification_status: string;
}

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /dashboard/deliverables — student deliverables list.
 *
 * Shows all tasks assigned to the student (via task_assignments),
 * grouped into actionable states: needs submission, under review,
 * and completed/disputed.
 *
 * ★ Pattern: Same server-driven filter-tab pattern as the proposals
 *   and task list pages — URL-driven via searchParams, no client JS
 *   for filtering. Each card links to the individual submission page.
 */
export default async function DeliverablesPage() {
  const { user } = await requireRole("student");
  const supabase = await createClient();

  // ── Fetch assignments with task details ────────────────────────
  //
  // task_assignments links the student to their accepted tasks.
  // We join micro_tasks for the task details and left-join
  // submissions to know if work was already submitted.
  //
  // The explicit type assertion is needed because Supabase's
  // generated types don't cover FK-qualified joins like
  // `micro_tasks!task_assignments_task_id_fkey(...)`.
  // ★ Order by `assigned_at`, not `created_at`: task_assignments has no
  //   created_at column (see 001_initial_schema.sql). PostgREST rejects an
  //   order-by on an unknown column with a 400, so getting this wrong
  //   returns null data — which renders as "no assigned tasks" and quietly
  //   strands every student who actually has work to submit.
  const { data: assignments, error: assignmentsError } = await supabase
    .from("task_assignments")
    .select(
      "id, task_id, micro_tasks!task_assignments_task_id_fkey(id, title, budget, status, category, deadline)",
    )
    .eq("student_id", user.id)
    .order("assigned_at", { ascending: false });

  // Surface the failure. An empty list and a failed query look identical to
  // the reader otherwise, and only one of them is safe to act on.
  if (assignmentsError) {
    return (
      <>
        <PageHeader
          title="Deliverables"
          description="Manage your assigned work and submissions"
        />
        <div
          role="alert"
          className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700"
        >
          Failed to load your deliverables. Please try again later.
        </div>
      </>
    );
  }

  const items = (assignments ?? []) as unknown as AssignmentRow[];

  // ── Fetch submissions for all assigned tasks ──────────────────
  const taskIds = items
    .map((a) => a.micro_tasks?.id)
    .filter(Boolean) as string[];

  let submissionMap: Record<string, SubmissionRow> = {};

  if (taskIds.length > 0) {
    const { data: submissions } = await supabase
      .from("submissions")
      .select("task_id, submitted_at, ai_verification_status")
      .eq("student_id", user.id)
      .in("task_id", taskIds);

    if (submissions) {
      submissionMap = Object.fromEntries(
        (submissions as unknown as SubmissionRow[]).map((s) => [s.task_id, s]),
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Deliverables"
        description="Manage your assigned work and submissions"
        action={
          <Link href="/dashboard/proposals">
            <Button variant="secondary">
              <FileText className="mr-2 h-4 w-4" />
              My Proposals
            </Button>
          </Link>
        }
      />

      {/* ── Deliverables list ─────────────────────────────────────── */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Upload}
              title="No assigned tasks yet"
              description="Once a business owner accepts your proposal, the task will appear here for you to submit your work."
              action={
                <Link href="/ticker">
                  <Button size="sm">Browse Tasks</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((assignment) => {
            const task = assignment.micro_tasks as {
              id: string;
              title: string;
              budget: number;
              status: string;
              category: string;
              deadline: string | null;
            } | null;

            if (!task) return null;

            const submission = submissionMap[task.id];
            const status = task.status as TaskStatus;

            return (
              <Link
                key={assignment.id}
                href={`/dashboard/deliverables/${task.id}`}
                className="block"
              >
                <Card className="transition-colors hover:border-brand-300">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: task info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {task.title}
                          </p>
                          <StatusIndicator status={status} />
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                          <span className="capitalize">{task.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatBudget(task.budget)}</span>
                          {task.deadline && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Due {formatDate(task.deadline)}</span>
                            </>
                          )}
                        </div>

                        {/* Submission status line */}
                        {submission && (
                          <p className="mt-2 text-xs text-text-tertiary">
                            Submitted {formatDate(submission.submitted_at)}
                            {" · "}
                            Verification:{" "}
                            <span className="capitalize">
                              {submission.ai_verification_status.replace(
                                /_/g,
                                " ",
                              )}
                            </span>
                          </p>
                        )}
                      </div>

                      {/* Right: action pill */}
                      <div className="flex shrink-0 items-center gap-2">
                        <DeliverablePill
                          status={status}
                          hasSubmission={!!submission}
                        />
                        <ArrowRight className="h-4 w-4 text-text-tertiary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

/**
 * DeliverablePill — contextual status pill for each deliverable card.
 *
 * Shows "Submit Work" for in_progress tasks, "Under Review" for
 * submitted/client_review, and terminal states for completed/disputed.
 */
function DeliverablePill({
  status,
  hasSubmission,
}: {
  status: string;
  hasSubmission: boolean;
}) {
  if (status === "in_progress" && !hasSubmission) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
        <Upload className="h-3 w-3" />
        Submit Work
      </span>
    );
  }

  if (status === "submitted" || status === "client_review") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-warning-50 px-3 py-1 text-xs font-medium text-warning-700">
        <Clock className="h-3 w-3" />
        Under Review
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-700">
        <CheckCircle className="h-3 w-3" />
        Completed
      </span>
    );
  }

  if (status === "disputed") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-error-50 px-3 py-1 text-xs font-medium text-error-700">
        <AlertTriangle className="h-3 w-3" />
        Disputed
      </span>
    );
  }

  return (
    <Badge variant="default" className="capitalize">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

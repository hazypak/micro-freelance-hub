import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TaskActions } from "./task-actions";
import { ProposalList, type ProposalItem } from "./proposal-list";
import { SubmissionDetail, type SubmissionData } from "./submission-detail";
import { formatDate, formatBudget } from "@/lib/format";

import type { TaskStatus } from "@/components/ui/status-indicator";

// ─── Metadata ──────────────────────────────────────────────────────

export const metadata = {
  title: "Task Details",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /dashboard/tasks/[id] — business-only task detail page.
 *
 * Server component that fetches a single task by ID, verifies the
 * authenticated user owns it, and renders the full task detail view
 * with status-aware action buttons.
 *
 * This is the redirect target after task creation (createTask action
 * redirects here on success).
 */
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireRole("business");
  const { id } = await params;

  // ── Fetch task ──────────────────────────────────────────────────
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("micro_tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !task) notFound();

  // ── Verify ownership ───────────────────────────────────────────
  if (task.client_id !== user.id) notFound();

  const status = task.status as TaskStatus;
  const isEditable = status === "draft" || status === "open";

  // ── Fetch proposals (with student display name) ────────────────
  const { data: rawProposals } = await supabase
    .from("task_proposals")
    .select(
      "id, status, cover_message, proposed_price, timeline_estimate, created_at, student_id, profiles!task_proposals_student_id_fkey(full_name)",
    )
    .eq("task_id", id)
    .order("created_at", { ascending: false });

  const proposals: ProposalItem[] = (rawProposals ?? []).map((p) => ({
    id: p.id,
    status: p.status,
    cover_message: p.cover_message,
    proposed_price: p.proposed_price,
    timeline_estimate: p.timeline_estimate,
    created_at: p.created_at,
    student_name: (p.profiles as { full_name: string } | null)?.full_name ?? null,
  }));

  // ── Fetch submission (when the task has progressed past in_progress) ──
  const SUBMISSION_VISIBLE_STATUSES = [
    "submitted",
    "client_review",
    "completed",
    "disputed",
  ];

  let submission: SubmissionData | null = null;

  if (SUBMISSION_VISIBLE_STATUSES.includes(status)) {
    const { data: rawSubmission } = await supabase
      .from("submissions")
      .select(
        "id, deliverable_url, storage_path, notes, submitted_at, ai_verification_status, student_id, profiles!submissions_student_id_fkey(full_name)",
      )
      .eq("task_id", id)
      .maybeSingle();

    if (rawSubmission) {
      submission = {
        id: rawSubmission.id,
        deliverable_url: rawSubmission.deliverable_url,
        storage_path: rawSubmission.storage_path,
        notes: rawSubmission.notes,
        submitted_at: rawSubmission.submitted_at,
        ai_verification_status: rawSubmission.ai_verification_status,
        student_name:
          (rawSubmission.profiles as { full_name: string } | null)
            ?.full_name ?? null,
      };
    }
  }

  return (
    <>
      {/* ── Header with status + edit action ───────────────────────── */}
      <PageHeader
        title={task.title}
        description={`Created ${formatDate(task.created_at, "long-time")}`}
        action={
          isEditable ? (
            <Link href={`/dashboard/tasks/${task.id}/edit`}>
              <Button variant="secondary" size="sm">
                Edit Task
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* ── Status + Budget row ────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusIndicator status={status} />
        <Badge variant="brand">{formatBudget(task.budget)}</Badge>
        <Badge variant="outline" className="capitalize">
          {task.category}
        </Badge>
      </div>

      {/* ── Main content grid ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: task details (2/3 width) ────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                {task.description}
              </p>
            </CardContent>
          </Card>

          {/* Brief (optional) */}
          {task.brief && (
            <Card>
              <CardHeader>
                <CardTitle>Brief</CardTitle>
                <CardDescription>
                  Extended context and reference material
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                  {task.brief}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Submission detail (visible after freelancer submits) */}
          {submission && <SubmissionDetail submission={submission} />}

          {/* Proposals (visible for open / in_progress / completed tasks) */}
          {status !== "draft" && (
            <ProposalList
              taskId={task.id}
              proposals={proposals}
              taskIsOpen={status === "open"}
            />
          )}
        </div>

        {/* ── Right column: sidebar (1/3 width) ────────────────────── */}
        <div className="space-y-6">
          {/* Task info card */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Deadline */}
              <DetailRow
                label="Deadline"
                value={
                  task.deadline
                    ? formatDate(task.deadline, "long-time")
                    : "No deadline set"
                }
              />

              {/* Skills */}
              <DetailRow label="Required Skills">
                {task.required_skills && task.required_skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {task.required_skills.map((skill) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-text-tertiary">
                    No specific skills required
                  </span>
                )}
              </DetailRow>

              {/* Deliverable types */}
              <DetailRow label="Deliverable Types">
                {task.permitted_deliverable_types &&
                task.permitted_deliverable_types.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {task.permitted_deliverable_types.map((type) => (
                      <Badge key={type} variant="outline">
                        {type}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-text-tertiary">
                    Any format accepted
                  </span>
                )}
              </DetailRow>

              {/* Updated at */}
              <DetailRow
                label="Last Updated"
                value={formatDate(task.updated_at, "long-time")}
              />
            </CardContent>
          </Card>

          {/* Status actions card */}
          <TaskActions taskId={task.id} status={status} />
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

/**
 * DetailRow — labeled key-value row for the sidebar info card.
 *
 * Accepts either a `value` string or `children` for custom content
 * (e.g. a list of Badge tags).
 */
function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className="mt-1">
        {children ?? (
          <span className="text-sm text-text-secondary">{value}</span>
        )}
      </dd>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubmissionForm } from "./submission-form";
import { formatDate, formatBudget } from "@/lib/format";
import { isHttpUrl } from "@/lib/validation/schemas";

import type { Metadata } from "next";

// ─── Metadata ──────────────────────────────────────────────────────

export const metadata: Metadata = {
  // Bare title — the root layout appends " · GigBridge" via title.template.
  title: "Submit Work",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /dashboard/deliverables/[taskId] — student submission page.
 *
 * This page lets a student submit their work for an assigned task.
 * The server component:
 *   1. Guards with requireRole("student")
 *   2. Verifies the student is assigned to the task
 *   3. Checks the task is in a submittable state (in_progress)
 *   4. Fetches any existing submission
 *   5. Renders the SubmissionForm client component
 *
 * ★ Security: notFound() instead of 403 — don't reveal whether
 *   a task exists to users who aren't assigned to it.
 */
export default async function DeliverableSubmissionPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { user } = await requireRole("student");
  const { taskId } = await params;

  const supabase = await createClient();

  // ── Verify assignment ──────────────────────────────────────────
  const { data: assignment } = await supabase
    .from("task_assignments")
    .select("id, task_id")
    .eq("task_id", taskId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (!assignment) notFound();

  // ── Fetch task details ─────────────────────────────────────────
  const { data: task } = await supabase
    .from("micro_tasks")
    .select("id, title, description, brief, budget, deadline, status, category")
    .eq("id", taskId)
    .single();

  if (!task) notFound();

  // ── Check if already submitted ─────────────────────────────────
  const { data: existingSubmission } = await supabase
    .from("submissions")
    .select("id, deliverable_url, storage_path, notes, submitted_at, ai_verification_status")
    .eq("task_id", taskId)
    .eq("student_id", user.id)
    .maybeSingle();

  // ── Determine if submission is allowed ─────────────────────────
  const canSubmit = task.status === "in_progress" && !existingSubmission;

  return (
    <>
      <PageHeader
        title="Submit Work"
        description={`Deliver your work for "${task.title}"`}
        action={
          <Link href="/dashboard/proposals">
            <Button variant="secondary">
              <ArrowLeft className="mr-2 h-4 w-4" />
              My Proposals
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: form ─────────────────────────────────── */}
        <div className="lg:col-span-2">
          {existingSubmission ? (
            <Card>
              <CardHeader>
                <CardTitle>Submission Received</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  role="status"
                  className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700"
                >
                  You submitted your work on{" "}
                  {formatDate(existingSubmission.submitted_at)}
                </div>

                {existingSubmission.notes && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                      Your Notes
                    </span>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">
                      {existingSubmission.notes}
                    </p>
                  </div>
                )}

                {existingSubmission.deliverable_url && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                      External Link
                    </span>
                    <p className="mt-1 text-sm">
                      {isHttpUrl(existingSubmission.deliverable_url) ? (
                        <a
                          href={existingSubmission.deliverable_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 underline hover:text-brand-700"
                        >
                          {existingSubmission.deliverable_url}
                        </a>
                      ) : (
                        /* Non-web scheme (javascript:, data:, …) — show the
                           value so it stays auditable, but never linkify it. */
                        <span className="break-all text-text-secondary">
                          {existingSubmission.deliverable_url}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {existingSubmission.storage_path && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                      Uploaded File
                    </span>
                    <p className="mt-1 text-sm text-text-secondary">
                      {existingSubmission.storage_path.split("/").pop()}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Verification Status
                  </span>
                  <div className="mt-1">
                    <Badge variant="info" className="capitalize">
                      {existingSubmission.ai_verification_status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : canSubmit ? (
            <SubmissionForm taskId={task.id} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-text-secondary">
                  {task.status === "submitted"
                    ? "Your work has been submitted and is awaiting review."
                    : task.status === "completed"
                      ? "This task has been completed. 🎉"
                      : "This task is not currently accepting submissions."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column: task info sidebar ───────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label="Title" value={task.title} />
              <DetailRow label="Category" value={task.category} capitalize />
              <DetailRow label="Budget" value={formatBudget(task.budget)} />
              {task.deadline && (
                <DetailRow label="Deadline" value={formatDate(task.deadline)} />
              )}
              <DetailRow label="Status" value={task.status.replace(/_/g, " ")} capitalize />
            </CardContent>
          </Card>

          {task.brief && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Brief</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-text-secondary">
                  {task.brief}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

// ─── DetailRow helper ──────────────────────────────────────────────

function DetailRow({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
        {label}
      </span>
      <p className={`mt-0.5 text-sm text-text-secondary ${capitalize ? "capitalize" : ""}`}>
        {value}
      </p>
    </div>
  );
}

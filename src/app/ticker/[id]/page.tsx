import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOptionalAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ProposalForm } from "./proposal-form";
import { formatDate, formatBudget } from "@/lib/format";

import type { Metadata } from "next";

// ─── Metadata ──────────────────────────────────────────────────────

export const metadata: Metadata = {
  // Bare title — the root layout appends " · GigBridge" via title.template.
  title: "Task Details",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /ticker/[id] — public task detail page.
 *
 * Server component that shows the full detail view for an open task.
 * Anyone can view it (no auth required), but only authenticated
 * students see the proposal submission form.
 *
 * ★ Architecture: This is a hybrid page —
 *   - Unauthenticated visitors: see task details + "Sign in" CTA
 *   - Authenticated students: see task details + proposal form
 *   - Authenticated business users: see task details only (no form)
 *   - If the student already submitted: see proposal status instead
 *
 * We use getOptionalAuth() (not requireAuth) so the page renders
 * for everyone without redirecting to login.
 *
 * We only show tasks with status "open" — if the task has moved to
 * another status, it's no longer relevant on the public ticker.
 */
export default async function TickerTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // ── Fetch task (public — no auth required) ─────────────────────
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("micro_tasks")
    .select(
      "id, title, description, brief, category, budget, deadline, required_skills, permitted_deliverable_types, status, created_at",
    )
    .eq("id", id)
    .eq("status", "open")
    .single();

  // Task not found or not open → 404
  if (error || !task) notFound();

  // ── Check auth (optional — page works without it) ──────────────
  const auth = await getOptionalAuth();
  const isStudent = auth?.role === "student";

  // ── If student, check for existing proposal ────────────────────
  let existingProposal: {
    id: string;
    status: string;
    cover_message: string;
    proposed_price: number | null;
    timeline_estimate: string | null;
  } | null = null;

  if (isStudent && auth) {
    const { data: proposal } = await supabase
      .from("task_proposals")
      .select("id, status, cover_message, proposed_price, timeline_estimate")
      .eq("task_id", id)
      .eq("student_id", auth.user.id)
      .maybeSingle();

    existingProposal = proposal ?? null;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Back link ─────────────────────────────────────────────── */}
      <Link
        href="/ticker"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Ticker
      </Link>

      {/* ── Header ────────────────────────────────────────────────── */}
      <PageHeader
        title={task.title}
        description={`Posted ${formatDate(task.created_at, "long")}`}
      />

      {/* ── Status row ────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge variant="success">Open</Badge>
        <Badge variant="brand">{formatBudget(task.budget)}</Badge>
        <Badge variant="outline" className="capitalize">
          {task.category}
        </Badge>
      </div>

      {/* ── Main content grid ─────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: task details (2/3 width) ─────────────── */}
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
        </div>

        {/* ── Right column: sidebar (1/3 width) ─────────────────── */}
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
                    ? formatDate(task.deadline, "long")
                    : "No deadline set"
                }
              />

              {/* Budget */}
              <DetailRow
                label="Budget"
                value={formatBudget(task.budget)}
              />

              {/* Skills */}
              <DetailRow label="Required Skills">
                {task.required_skills && task.required_skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {task.required_skills.map((skill: string) => (
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
                    {task.permitted_deliverable_types.map((type: string) => (
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
            </CardContent>
          </Card>

          {/* ── Proposal section ────────────────────────────────── */}
          {isStudent ? (
            <ProposalForm
              taskId={task.id}
              taskBudget={task.budget}
              existingProposal={existingProposal}
            />
          ) : !auth ? (
            /* Not authenticated — show sign-in CTA */
            <Card>
              <CardHeader>
                <CardTitle>Interested?</CardTitle>
                <CardDescription>
                  Sign in as a student to submit a proposal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/login">
                  <Button className="w-full" variant="secondary">
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign in to Apply
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : null /* Business users don't see a proposal form */}
        </div>
      </div>
    </main>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

/** DetailRow — labeled key-value row for the sidebar info card. */
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

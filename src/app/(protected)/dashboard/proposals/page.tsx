import Link from "next/link";
import { ArrowRight, FileText, Send, Upload } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { formatDate, formatBudget } from "@/lib/format";

import type { Metadata } from "next";
import type { TaskStatus } from "@/components/ui/status-indicator";

// ─── Metadata ──────────────────────────────────────────────────────

export const metadata: Metadata = {
  // Bare title — the root layout appends " · GigBridge" via title.template.
  title: "My Proposals",
};

// ─── Helpers ───────────────────────────────────────────────────────

/** Map proposal status → Badge variant. */
const proposalBadgeVariant: Record<
  string,
  "warning" | "success" | "error" | "default"
> = {
  pending: "warning",
  accepted: "success",
  rejected: "error",
  withdrawn: "default",
};

// ─── Filter tabs ───────────────────────────────────────────────────

const FILTER_TABS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
  { label: "Withdrawn", value: "withdrawn" },
] as const;

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /dashboard/proposals — student proposals list.
 *
 * Shows every proposal this student has submitted, with optional
 * status filter tabs (URL-driven via searchParams — same pattern
 * as the business task list at /dashboard/tasks).
 *
 * ★ Pattern: Filter tabs are plain <Link> elements that set
 *   ?status=<value>. No client JS — the server re-renders with
 *   the filtered query. This keeps the URL shareable/bookmarkable
 *   and avoids shipping a client component just for filtering.
 */
export default async function ProposalListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { user } = await requireRole("student");
  const { status: statusFilter } = await searchParams;

  const supabase = await createClient();

  // ── Query proposals with task join ────────────────────────────
  let query = supabase
    .from("task_proposals")
    .select(
      "id, status, cover_message, proposed_price, timeline_estimate, created_at, micro_tasks!task_proposals_task_id_fkey(id, title, budget, status, category, deadline)",
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  // Apply optional status filter
  const validStatuses = ["pending", "accepted", "rejected", "withdrawn"];
  if (statusFilter && validStatuses.includes(statusFilter)) {
    query = query.eq("status", statusFilter as import("@/lib/supabase/types").ProposalStatus);
  }

  const { data: proposals } = await query;
  const items = proposals ?? [];

  return (
    <>
      <PageHeader
        title="My Proposals"
        description="Track all your submitted proposals"
        action={
          <Link href="/ticker">
            <Button variant="secondary">
              <Send className="mr-2 h-4 w-4" />
              Browse Tasks
            </Button>
          </Link>
        }
      />

      {/* ── Filter tabs ─────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const isActive =
            (tab.value === "" && !statusFilter) ||
            tab.value === statusFilter;

          return (
            <Link
              key={tab.value}
              href={
                tab.value
                  ? `/dashboard/proposals?status=${tab.value}`
                  : "/dashboard/proposals"
              }
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-600 text-white"
                  : "bg-surface-sunken text-text-secondary hover:bg-surface-tertiary"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* ── Proposal list ───────────────────────────────────────── */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={FileText}
              title={
                statusFilter
                  ? `No ${statusFilter} proposals`
                  : "No proposals yet"
              }
              description={
                statusFilter
                  ? "Try a different filter or browse open tasks."
                  : "Browse the ticker and submit proposals to get started."
              }
              action={
                !statusFilter ? (
                  <Link href="/ticker">
                    <Button size="sm">Browse Tasks</Button>
                  </Link>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((proposal) => {
            const task = proposal.micro_tasks as {
              id: string;
              title: string;
              budget: number;
              status: string;
              category: string;
              deadline: string | null;
            } | null;

            // ── Determine where the card links to ──────────────
            // Accepted proposals with in_progress tasks → submission page
            // Accepted proposals with submitted/client_review → submission page (view-only)
            // Everything else → ticker detail page
            const submittableStatuses = ["in_progress", "submitted", "client_review", "completed", "disputed"];
            const showSubmissionLink =
              proposal.status === "accepted" &&
              task &&
              submittableStatuses.includes(task.status);

            const cardHref = showSubmissionLink
              ? `/dashboard/deliverables/${task!.id}`
              : task
                ? `/ticker/${task.id}`
                : "#";

            return (
              <Link
                key={proposal.id}
                href={cardHref}
                className="block"
              >
                <Card className="transition-colors hover:border-brand-300">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: task info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {task?.title ?? "Unknown task"}
                          </p>
                          {task && (
                            <StatusIndicator
                              status={task.status as TaskStatus}
                            />
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                          {task && (
                            <>
                              <span className="capitalize">
                                {task.category}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{formatBudget(task.budget)}</span>
                            </>
                          )}
                          {task?.deadline && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Due {formatDate(task.deadline)}</span>
                            </>
                          )}
                        </div>

                        {/* Cover message preview */}
                        <p className="mt-2 line-clamp-2 text-sm text-text-secondary">
                          {proposal.cover_message}
                        </p>

                        {/* Proposal meta */}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
                          <span>Submitted {formatDate(proposal.created_at)}</span>
                          {proposal.proposed_price != null && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                Proposed {formatBudget(proposal.proposed_price)}
                              </span>
                            </>
                          )}
                          {proposal.timeline_estimate && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{proposal.timeline_estimate}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: proposal status + action */}
                      <div className="flex shrink-0 items-center gap-2">
                        {showSubmissionLink && task!.status === "in_progress" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                            <Upload className="h-3 w-3" />
                            Submit Work
                          </span>
                        ) : (
                          <Badge
                            variant={
                              proposalBadgeVariant[proposal.status] ?? "default"
                            }
                            className="capitalize"
                          >
                            {proposal.status}
                          </Badge>
                        )}
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

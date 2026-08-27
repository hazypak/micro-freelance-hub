import Link from "next/link";
import {
  ClipboardList,
  FileText,
  Clock,
  CheckCircle2,
  ArrowRight,
  Briefcase,
  Send,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatDate, formatBudget } from "@/lib/format";

import type { Metadata } from "next";
import type { TaskStatus } from "@/components/ui/status-indicator";

// ─── Metadata ──────────────────────────────────────────────────────

export const metadata: Metadata = {
  // Bare title — the root layout appends " · GigBridge" via title.template.
  title: "Dashboard",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /dashboard — role-aware dashboard landing page.
 *
 * Server component that shows tailored content based on the user's role:
 *   - Students: proposal stats, active assignments, recent proposals
 *   - Business: task stats, recent proposals received
 *
 * ★ Architecture: Single page with role branching instead of separate
 *   routes. requireAuth() gives us the role, and we fetch + render
 *   the appropriate data — no client JS needed for this decision.
 *
 * ★ Query pattern: We run targeted queries for just the data each
 *   role needs. Students never see business data and vice versa.
 */
export default async function DashboardPage() {
  const { user, role } = await requireAuth();

  if (role === "student") {
    return <StudentDashboard userId={user.id} />;
  }

  return <BusinessDashboard userId={user.id} />;
}

// ─── Student Dashboard ────────────────────────────────────────────

async function StudentDashboard({ userId }: { userId: string }) {
  const supabase = await createClient();

  // ── Parallel queries for student data ───────────────────────────
  //
  // ★ The stats query is deliberately separate from the list query.
  //   Counting a `.limit()`-ed array silently caps every number at the
  //   page size — a student with 40 proposals would read "Total: 5".
  //   One extra round trip for a single unbounded column is the cost
  //   of numbers that stay true as the account grows.
  const [proposalsResult, assignmentsResult, proposalStatsResult] =
    await Promise.all([
      // Recent proposals — feeds the list below, which shows 5
      supabase
        .from("task_proposals")
        .select(
          "id, status, cover_message, proposed_price, created_at, micro_tasks!task_proposals_task_id_fkey(title, budget, status)",
        )
        .eq("student_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),

      // Active assignments (accepted proposals → in-progress tasks)
      supabase
        .from("task_assignments")
        .select(
          "id, assigned_at, micro_tasks!task_assignments_task_id_fkey(id, title, budget, status, deadline)",
        )
        .eq("student_id", userId)
        .order("assigned_at", { ascending: false }),

      // Every proposal status — one column, no limit, stats only
      supabase
        .from("task_proposals")
        .select("status")
        .eq("student_id", userId),
    ]);

  const proposals = proposalsResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const proposalStats = proposalStatsResult.data ?? [];

  // ── Compute stats ──────────────────────────────────────────────
  const stats = {
    total: proposalStats.length,
    pending: proposalStats.filter((p) => p.status === "pending").length,
    accepted: proposalStats.filter((p) => p.status === "accepted").length,
    rejected: proposalStats.filter((p) => p.status === "rejected").length,
    activeAssignments: assignments.filter((a) => {
      const task = a.micro_tasks as { status: string } | null;
      return task && task.status === "in_progress";
    }).length,
  };

  return (
    <>
      <PageHeader
        title="Student Dashboard"
        description="Your proposals and active assignments"
        action={
          <Link href="/ticker">
            <Button variant="secondary">
              <Briefcase className="mr-2 h-4 w-4" />
              Browse Tasks
            </Button>
          </Link>
        }
      />

      {/* ── Stats cards ─────────────────────────────────────────── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Proposals"
          value={stats.total}
          icon={FileText}
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          label="Accepted"
          value={stats.accepted}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Active Assignments"
          value={stats.activeAssignments}
          icon={Briefcase}
          variant="brand"
        />
      </div>

      {/* ── Main content grid ───────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active assignments (2/3 width) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Active Assignments</CardTitle>
              <CardDescription>
                Tasks you&apos;re currently working on
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="No active assignments"
                  description="Submit proposals on open tasks to get started."
                />
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => {
                    const task = assignment.micro_tasks as {
                      id: string;
                      title: string;
                      budget: number;
                      status: string;
                      deadline: string | null;
                    } | null;
                    if (!task) return null;

                    return (
                      <Link
                        key={assignment.id}
                        href={`/ticker/${task.id}`}
                        className="block"
                      >
                        <div className="rounded-lg border border-border-default p-4 transition-colors hover:border-brand-300">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-text-primary">
                                {task.title}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                                <span>{formatBudget(task.budget)}</span>
                                {task.deadline && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                      Due {formatDate(task.deadline)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <StatusIndicator
                              status={task.status as TaskStatus}
                            />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent proposals (1/3 width) */}
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Proposals</CardTitle>
                <CardDescription>Latest submissions</CardDescription>
              </div>
              {proposals.length > 0 && (
                <Link
                  href="/dashboard/proposals"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  View all
                  <ArrowRight className="ml-1 inline h-3 w-3" />
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {proposals.length === 0 ? (
                <EmptyState
                  icon={Send}
                  title="No proposals yet"
                  description="Browse open tasks and submit your first proposal."
                />
              ) : (
                <div className="space-y-3">
                  {proposals.slice(0, 5).map((proposal) => {
                    const task = proposal.micro_tasks as {
                      title: string;
                      budget: number;
                      status: string;
                    } | null;

                    return (
                      <div
                        key={proposal.id}
                        className="rounded-lg border border-border-default p-3"
                      >
                        <p className="truncate text-sm font-medium text-text-primary">
                          {task?.title ?? "Unknown task"}
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs text-text-tertiary">
                            {formatDate(proposal.created_at)}
                          </span>
                          <ProposalStatusBadge status={proposal.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

// ─── Business Dashboard ───────────────────────────────────────────

async function BusinessDashboard({ userId }: { userId: string }) {
  const supabase = await createClient();

  // ── Parallel queries for business data ──────────────────────────
  //
  // ★ Same split as the student dashboard: the list queries are
  //   paginated, the stats queries are not. Counting a `.limit()`-ed
  //   array caps every card at the page size — a client with 30 tasks
  //   would read "Total Tasks: 5".
  const [
    tasksResult,
    recentProposalsResult,
    taskStatsResult,
    pendingProposalsResult,
  ] = await Promise.all([
    // Recent tasks — feeds the list below, which shows 5
    supabase
      .from("micro_tasks")
      .select("id, title, status, category, budget, deadline, created_at")
      .eq("client_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),

    // Recent proposals — over-fetched, because the ownership filter
    // below can shrink the set before the list slices it to 5
    supabase
      .from("task_proposals")
      .select(
        "id, status, created_at, profiles!task_proposals_student_id_fkey(full_name), micro_tasks!task_proposals_task_id_fkey(id, title, client_id)",
      )
      .order("created_at", { ascending: false })
      .limit(20),

    // Every task status — one column, no limit, stats only
    supabase.from("micro_tasks").select("status").eq("client_id", userId),

    // Pending proposals across *all* of this client's tasks, not just
    // the recent page. RLS already scopes these to tasks we own; the
    // client_id check below states that intent in the code as well.
    supabase
      .from("task_proposals")
      .select("status, micro_tasks!task_proposals_task_id_fkey(client_id)")
      .eq("status", "pending"),
  ]);

  const tasks = tasksResult.data ?? [];
  const taskStats = taskStatsResult.data ?? [];

  /** Keeps only rows whose parent task belongs to this client. */
  function ownedByClient(row: { micro_tasks: unknown }): boolean {
    const task = row.micro_tasks as { client_id: string } | null;
    return task?.client_id === userId;
  }

  const proposals = (recentProposalsResult.data ?? []).filter(ownedByClient);

  // ── Compute stats ──────────────────────────────────────────────
  const stats = {
    totalTasks: taskStats.length,
    openTasks: taskStats.filter((t) => t.status === "open").length,
    inProgress: taskStats.filter((t) => t.status === "in_progress").length,
    pendingProposals: (pendingProposalsResult.data ?? []).filter(ownedByClient)
      .length,
  };

  return (
    <>
      <PageHeader
        title="Business Dashboard"
        description="Manage your tasks and review proposals"
        action={
          <Link href="/dashboard/tasks/new">
            <Button>Post a Task</Button>
          </Link>
        }
      />

      {/* ── Stats cards ─────────────────────────────────────────── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Tasks"
          value={stats.totalTasks}
          icon={ClipboardList}
        />
        <StatCard
          label="Open Tasks"
          value={stats.openTasks}
          icon={Clock}
          variant="success"
        />
        <StatCard
          label="In Progress"
          value={stats.inProgress}
          icon={Briefcase}
          variant="brand"
        />
        <StatCard
          label="Pending Proposals"
          value={stats.pendingProposals}
          icon={FileText}
          variant="warning"
        />
      </div>

      {/* ── Main content grid ───────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent tasks (2/3 width) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Tasks</CardTitle>
                <CardDescription>Your latest posted tasks</CardDescription>
              </div>
              {tasks.length > 0 && (
                <Link
                  href="/dashboard/tasks"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  View all
                  <ArrowRight className="ml-1 inline h-3 w-3" />
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No tasks yet"
                  description="Post your first micro-task to start receiving proposals from students."
                  action={
                    <Link href="/dashboard/tasks/new">
                      <Button size="sm">Post a Task</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {tasks.slice(0, 5).map((task) => (
                    <Link
                      key={task.id}
                      href={`/dashboard/tasks/${task.id}`}
                      className="block"
                    >
                      <div className="rounded-lg border border-border-default p-4 transition-colors hover:border-brand-300">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text-primary">
                              {task.title}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                              <span className="capitalize">
                                {task.category}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{formatBudget(task.budget)}</span>
                              {task.deadline && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    Due {formatDate(task.deadline)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <StatusIndicator
                            status={task.status as TaskStatus}
                          />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending proposals (1/3 width) */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Recent Proposals</CardTitle>
              <CardDescription>
                {stats.pendingProposals > 0
                  ? `${stats.pendingProposals} awaiting review`
                  : "Proposals from students"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {proposals.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No proposals yet"
                  description="Proposals will appear here when students apply to your tasks."
                />
              ) : (
                <div className="space-y-3">
                  {proposals.slice(0, 5).map((proposal) => {
                    const student = proposal.profiles as {
                      full_name: string;
                    } | null;
                    const task = proposal.micro_tasks as {
                      id: string;
                      title: string;
                    } | null;

                    return (
                      <Link
                        key={proposal.id}
                        href={
                          task ? `/dashboard/tasks/${task.id}` : "#"
                        }
                        className="block"
                      >
                        <div className="rounded-lg border border-border-default p-3 transition-colors hover:border-brand-300">
                          <p className="text-sm font-medium text-text-primary">
                            {student?.full_name ?? "Anonymous Student"}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-text-tertiary">
                            on {task?.title ?? "Unknown task"}
                          </p>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-xs text-text-tertiary">
                              {formatDate(proposal.created_at)}
                            </span>
                            <ProposalStatusBadge status={proposal.status} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

// ─── Shared sub-components ────────────────────────────────────────

/** StatCard — summary metric card for the stats row. */
function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "brand" | "success" | "warning" | "error";
}) {
  const variantStyles = {
    default: "text-text-tertiary",
    brand: "text-brand-600",
    success: "text-success-600",
    warning: "text-warning-600",
    error: "text-error-600",
  };

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="rounded-lg bg-surface-sunken p-2.5">
          <Icon className={`h-5 w-5 ${variantStyles[variant]}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          <p className="text-xs text-text-tertiary">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** ProposalStatusBadge — small badge for proposal status in lists. */
function ProposalStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "warning" | "success" | "error" | "default"> =
    {
      pending: "warning",
      accepted: "success",
      rejected: "error",
      withdrawn: "default",
    };

  return (
    <Badge variant={variants[status] ?? "default"} className="capitalize">
      {status}
    </Badge>
  );
}

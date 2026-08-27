import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate, formatBudget } from "@/lib/format";

import type { TaskStatus } from "@/components/ui/status-indicator";

// ─── Metadata ──────────────────────────────────────────────────────

export const metadata = {
  title: "My Tasks",
};

// ─── Constants ─────────────────────────────────────────────────────

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "client_review", label: "In Review" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "disputed", label: "Disputed" },
];

// ─── Helpers ───────────────────────────────────────────────────────

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /dashboard/tasks — business-only task list.
 *
 * Server component that lists all tasks owned by the authenticated
 * business user. Supports status filtering via URL search params,
 * keeping the filter state shareable and back-button friendly.
 *
 * ★ Architecture choice: filter tabs use plain <a> links with
 *   search params rather than client-side state. This means:
 *   - No client JS needed for filtering
 *   - Filters are preserved in the URL (shareable, bookmarkable)
 *   - Browser back/forward navigates between filter states
 */
export default async function TaskListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { user } = await requireRole("business");
  const { status: statusFilter } = await searchParams;

  // ── Fetch tasks ─────────────────────────────────────────────────
  const supabase = await createClient();

  let query = supabase
    .from("micro_tasks")
    .select("id, title, status, category, budget, deadline, created_at")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  // Apply status filter (if not "all")
  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter as import("@/lib/supabase/types").TaskStatus);
  }

  const { data: tasks, error } = await query;

  if (error) {
    return (
      <>
        <PageHeader title="My Tasks" />
        <div
          role="alert"
          className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700"
        >
          Failed to load tasks. Please try again later.
        </div>
      </>
    );
  }

  const activeFilter = statusFilter || "all";

  return (
    <>
      {/* ── Header with CTA ──────────────────────────────────────── */}
      <PageHeader
        title="My Tasks"
        description="Manage your posted micro-tasks"
        action={
          <Link href="/dashboard/tasks/new">
            <Button>Post a Task</Button>
          </Link>
        }
      />

      {/* ── Status filter tabs ───────────────────────────────────── */}
      <nav
        className="mb-6 flex flex-wrap gap-2"
        aria-label="Filter tasks by status"
      >
        {STATUS_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.value;
          const href =
            filter.value === "all"
              ? "/dashboard/tasks"
              : `/dashboard/tasks?status=${filter.value}`;

          return (
            <Link
              key={filter.value}
              href={href}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-fast",
                isActive
                  ? "bg-brand-600 text-white"
                  : "bg-surface-sunken text-text-secondary hover:bg-surface-raised hover:text-text-primary",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Task list or empty state ─────────────────────────────── */}
      {tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            activeFilter === "all"
              ? "No tasks yet"
              : `No ${activeFilter.replace("_", " ")} tasks`
          }
          description={
            activeFilter === "all"
              ? "Post your first micro-task to get started with student freelancers."
              : "Try a different filter or post a new task."
          }
          action={
            activeFilter === "all" ? (
              <Link href="/dashboard/tasks/new">
                <Button>Post a Task</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/dashboard/tasks/${task.id}`}
              className="block"
            >
              <Card className="transition-colors duration-fast hover:border-brand-300">
                <CardContent className="flex items-center gap-4 py-4">
                  {/* Left: title + meta */}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-text-primary">
                      {task.title}
                    </h3>
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
                  </div>

                  {/* Right: status + date */}
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusIndicator
                      status={task.status as TaskStatus}
                    />
                    <span className="text-xs text-text-tertiary">
                      {formatDate(task.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}


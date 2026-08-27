"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatBudget } from "@/lib/format";
import { Search } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────

export interface TickerTask {
  id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  deadline: string | null;
  required_skills: string[] | null;
  created_at: string;
}

// ─── Constants ─────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "design", label: "Design" },
  { value: "development", label: "Development" },
  { value: "writing", label: "Writing" },
  { value: "marketing", label: "Marketing" },
  { value: "video", label: "Video" },
  { value: "data", label: "Data" },
  { value: "research", label: "Research" },
  { value: "other", label: "Other" },
];

const BUDGET_RANGES = [
  { value: "all", label: "Any Budget" },
  { value: "0-50", label: "Under RM 50" },
  { value: "50-150", label: "RM 50 – RM 150" },
  { value: "150-500", label: "RM 150 – RM 500" },
  { value: "500+", label: "RM 500+" },
];

// ─── Helpers ───────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function matchesBudgetRange(budget: number, range: string): boolean {
  if (range === "all") return true;
  if (range === "500+") return budget >= 500;
  const parts = range.split("-").map(Number);
  const min = parts[0] ?? 0;
  const max = parts[1] ?? Infinity;
  return budget >= min && budget < max;
}

// ─── Props ─────────────────────────────────────────────────────────

interface TaskTickerProps {
  /** Initial tasks fetched server-side for SSR. */
  initialTasks: TickerTask[];
}

// ─── Component ─────────────────────────────────────────────────────

/**
 * TaskTicker — real-time public task feed.
 *
 * Receives SSR-fetched tasks as initial data, then subscribes to
 * Supabase Realtime postgres_changes for live updates.
 *
 * ★ Pattern: The Realtime subscription listens for INSERTs and
 *   UPDATEs on micro_tasks where status = 'open'. When a task is
 *   published (draft → open), Postgres broadcasts the change and
 *   we prepend it to the list. When a task leaves "open" status
 *   (e.g. someone accepts it), we remove it from the feed.
 *
 * ★ Accessibility: New tasks are announced via an aria-live region.
 *   Screen readers will hear "New task: [title]" when a task appears.
 */
export function TaskTicker({ initialTasks }: TaskTickerProps) {
  const [tasks, setTasks] = useState<TickerTask[]>(initialTasks);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [budgetRange, setBudgetRange] = useState("all");
  const [announcement, setAnnouncement] = useState("");

  // ★ No ref needed to see the latest tasks in the Realtime callback: every
  //   update below goes through the functional form, `setTasks(prev => …)`,
  //   which React always hands the current state. A mirror ref would only
  //   duplicate that — and writing one during render is a genuine bug, since
  //   render must stay pure for concurrent rendering to be safe.

  // ── Supabase Realtime subscription ──────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("ticker-open-tasks")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "micro_tasks",
        },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === "INSERT" || eventType === "UPDATE") {
            const task = newRow as TickerTask & { status: string };

            if (task.status === "open") {
              // Add or update the task in our list
              setTasks((prev) => {
                const existing = prev.findIndex((t) => t.id === task.id);
                const tickerTask: TickerTask = {
                  id: task.id,
                  title: task.title,
                  description: task.description,
                  category: task.category,
                  budget: task.budget,
                  deadline: task.deadline,
                  required_skills: task.required_skills,
                  created_at: task.created_at,
                };

                if (existing >= 0) {
                  // Update existing
                  const updated = [...prev];
                  updated[existing] = tickerTask;
                  return updated;
                }

                // New task — prepend and announce
                setAnnouncement(`New task: ${task.title}`);
                return [tickerTask, ...prev];
              });
            } else {
              // Task left "open" status — remove from feed
              setTasks((prev) => prev.filter((t) => t.id !== task.id));
            }
          }

          if (eventType === "DELETE") {
            const id = (oldRow as { id: string }).id;
            setTasks((prev) => prev.filter((t) => t.id !== id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Client-side filtering ───────────────────────────────────────
  const filtered = tasks.filter((task) => {
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const matchesTitle = task.title.toLowerCase().includes(q);
      const matchesDesc = task.description.toLowerCase().includes(q);
      const matchesSkills = task.required_skills?.some((s) =>
        s.toLowerCase().includes(q),
      );
      if (!matchesTitle && !matchesDesc && !matchesSkills) return false;
    }

    // Category filter
    if (category !== "all" && task.category !== category) return false;

    // Budget filter
    if (!matchesBudgetRange(task.budget, budgetRange)) return false;

    return true;
  });

  return (
    <div>
      {/* ── aria-live region for screen readers ──────────────────── */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {announcement}
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Input
          label="Search"
          srOnlyLabel
          placeholder="Search tasks, skills…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          label="Category"
          srOnlyLabel
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </Select>
        <Select
          label="Budget range"
          srOnlyLabel
          value={budgetRange}
          onChange={(e) => setBudgetRange(e.target.value)}
        >
          {BUDGET_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </Select>
      </div>

      {/* ── Task count ───────────────────────────────────────────── */}
      <p className="mb-4 text-sm text-text-tertiary">
        {filtered.length === 0
          ? "No tasks match your filters"
          : `${filtered.length} open task${filtered.length === 1 ? "" : "s"}`}
      </p>

      {/* ── Task feed ────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No tasks found"
          description={
            search || category !== "all" || budgetRange !== "all"
              ? "Try adjusting your filters to see more tasks."
              : "No open tasks at the moment. Check back soon!"
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((task, index) => (
            <Card
              key={task.id}
              className={cn(
                "transition-all duration-300",
                index === 0 && "animate-in fade-in slide-in-from-top-2",
              )}
            >
              <CardContent className="py-5">
                {/* Top row: title + budget */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-text-primary">
                      {task.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                      {task.description}
                    </p>
                  </div>
                  <Badge
                    variant="brand"
                    className="shrink-0 text-sm"
                  >
                    {formatBudget(task.budget)}
                  </Badge>
                </div>

                {/* Meta row */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {task.category}
                  </Badge>
                  {task.required_skills?.slice(0, 3).map((skill) => (
                    <Badge key={skill} variant="default">
                      {skill}
                    </Badge>
                  ))}
                  {task.required_skills &&
                    task.required_skills.length > 3 && (
                      <span className="text-xs text-text-tertiary">
                        +{task.required_skills.length - 3} more
                      </span>
                    )}
                </div>

                {/* Bottom row: time + CTA */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">
                    Posted {formatRelativeTime(task.created_at)}
                    {task.deadline && (
                      <>
                        {" · "}
                        Due{" "}
                        {new Date(task.deadline).toLocaleDateString("en-MY", {
                          month: "short",
                          day: "numeric",
                        })}
                      </>
                    )}
                  </span>
                  <Link href={`/ticker/${task.id}`}>
                    <Button variant="secondary" size="sm">
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

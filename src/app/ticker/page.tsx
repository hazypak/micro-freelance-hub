import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { TaskTicker } from "./task-ticker";

import type { TickerTask } from "./task-ticker";
import type { Metadata } from "next";

// ─── Metadata ──────────────────────────────────────────────────────

export const metadata: Metadata = {
  // Bare title — the root layout appends " · GigBridge" via title.template.
  title: "Task Ticker",
  description:
    "Browse open micro-tasks from businesses looking for student freelancers. Real-time feed with category, skill, and budget filters.",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /ticker — public real-time task marketplace.
 *
 * Server component that fetches the initial set of open tasks for
 * SSR (SEO + fast first paint), then hands them to the TaskTicker
 * client component which subscribes to Supabase Realtime for live
 * updates.
 *
 * ★ Architecture: This page lives at the top-level `/ticker` route,
 *   outside any route group — no auth required. The server-side
 *   Supabase client uses the anon key (no user session), so the
 *   query respects RLS policies for public reads on open tasks.
 */
export default async function TickerPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("micro_tasks")
    .select(
      "id, title, description, category, budget, deadline, required_skills, created_at",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);

  // Gracefully degrade — show empty ticker on error
  const initialTasks: TickerTask[] = error ? [] : (data ?? []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Task Ticker"
        description="Open micro-tasks from businesses looking for student freelancers — updated in real time."
      />

      <TaskTicker initialTasks={initialTasks} />
    </main>
  );
}

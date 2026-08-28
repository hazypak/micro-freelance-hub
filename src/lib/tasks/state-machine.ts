/**
 * Task lifecycle state machine.
 *
 * Dependency-free on purpose: no Next, no Supabase, no "use server".
 * Two audit findings (#3 and #4) turned on exactly who may drive which
 * edge, so the rules live apart from the I/O that enforces them and can
 * be exercised directly by tests.
 */

/** Who is permitted to drive a given transition. */
export type TransitionActor = "client" | "student" | "system";

export interface Transition {
  to: string;
  by: TransitionActor;
}

// ─── The map ────────────────────────────────────────────────────────
//
// Encodes every legal task-status transition and who may trigger it.
//   "client"  = the business that owns the task (micro_tasks.client_id)
//   "student" = the student assigned to the task (task_assignments)
//   "system"  = no HTTP caller may drive this; it happens inside a
//               database function
//
// Terminal statuses (completed, cancelled, disputed) have no outgoing
// edges — once a task lands there, its status is frozen.
// ─────────────────────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<string, Transition[]> = {
  draft: [
    { to: "open", by: "client" },
    { to: "cancelled", by: "client" },
  ],
  open: [
    // ★ "system" — this transition happens inside the accept_proposal
    //   RPC (migration 005). It is illegal to invoke via
    //   updateTaskStatus (audit finding #3): a client who could POST
    //   status="in_progress" directly would freeze a task with no
    //   student assigned to it. The action layer rejects this edge,
    //   and the DB trigger refuses to insert an assignment against a
    //   non-accepted proposal — the same hole closed at two layers.
    { to: "in_progress", by: "system" },
    { to: "cancelled", by: "client" },
  ],
  in_progress: [
    { to: "submitted", by: "student" }, // handled by submission action
  ],
  submitted: [{ to: "client_review", by: "client" }],
  client_review: [
    { to: "completed", by: "client" },
    { to: "disputed", by: "client" },
  ],
};

/** Statuses with no outgoing edges. */
export const TERMINAL_STATUSES = [
  "completed",
  "cancelled",
  "disputed",
] as const;

// ─── Queries ────────────────────────────────────────────────────────

/**
 * Look up a transition without deciding whether the caller may drive
 * it. Returns null when the edge does not exist at all.
 */
export function findTransition(
  from: string,
  to: string,
): Transition | null {
  return VALID_TRANSITIONS[from]?.find((t) => t.to === to) ?? null;
}

/**
 * Whether `actor` may move a task from `from` to `to`.
 *
 * ★ Note the deliberate asymmetry with findTransition: an edge that
 *   exists but belongs to a different actor is NOT permitted. The
 *   "system" edges exist in the map so the lifecycle is documented in
 *   one place, but no HTTP caller can ever satisfy them.
 */
export function canTransition(
  from: string,
  to: string,
  actor: TransitionActor,
): boolean {
  return findTransition(from, to)?.by === actor;
}

/** Whether a status has any outgoing edges. */
export function isTerminal(status: string): boolean {
  return (VALID_TRANSITIONS[status]?.length ?? 0) === 0;
}

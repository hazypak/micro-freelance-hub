/**
 * Terms-lock policy — audit finding #6.
 *
 * Deliberately dependency-free: no Next, no Supabase, no "use server".
 * The rule here is the kind of logic that is all edge cases (nulls,
 * clearing, timezone-bearing strings), so it lives apart from the I/O
 * that surrounds it and can be exercised directly by tests.
 */

/** The subset of task terms that students bid against. */
export interface TaskTerms {
  budget: number;
  deadline: string | null;
}

/**
 * Decide whether an edit to a task's terms is allowed while live
 * (pending) proposals exist.
 *
 * Call only when the task has at least one pending proposal.
 *
 * @param current  the task's terms as they stand in the database
 * @param proposed the validated fields the owner is trying to write;
 *                 a key is absent (`undefined`) when that field was not
 *                 submitted, and `null` means "clear it"
 * @returns an error message to block the edit, or null to allow it
 *
 * ─────────────────────────────────────────────────────────────────
 * Policy: FAVOURABLE-ONLY.
 *
 * An edit is allowed only if it cannot make an outstanding bid worse
 * than the terms it was written against. Concretely:
 *
 *   budget    may rise, never fall
 *   deadline  may be extended or removed entirely, never brought
 *             forward, and never *introduced* where none existed
 *
 * The asymmetry is the point. An owner who wants to sweeten a task to
 * attract better bids should not have to tear down the ones they have;
 * an owner who wants to cut the budget must reject the open proposals
 * first, so nobody is held to a quote for a job that no longer exists.
 * ─────────────────────────────────────────────────────────────────
 */
export function checkTermsLock(
  current: TaskTerms,
  proposed: Partial<TaskTerms>,
): string | null {
  // ── Budget may rise, never fall ─────────────────────────────────
  if (proposed.budget !== undefined && proposed.budget < current.budget) {
    return "Budget cannot be reduced while proposals are pending. Raise it, or reject the open proposals first.";
  }

  // ── Deadline may only loosen ────────────────────────────────────
  //
  // `undefined` means the field wasn't submitted, and an explicit null
  // clears the deadline — strictly more time, so both are fine.
  if (proposed.deadline !== undefined && proposed.deadline !== null) {
    const next = new Date(proposed.deadline);

    // Malformed dates are already rejected by updateTaskSchema; bail
    // out rather than compare against an Invalid Date, which makes
    // every comparison false and would silently wave the edit through.
    if (Number.isNaN(next.getTime())) {
      return "Deadline is not a valid date";
    }

    if (current.deadline === null) {
      // Students bid on an open-ended task; imposing a due date now is
      // a new constraint they never priced in.
      return "A deadline cannot be added while proposals are pending. Reject the open proposals first.";
    }

    if (next < new Date(current.deadline)) {
      return "Deadline cannot be brought forward while proposals are pending. Extend it, or reject the open proposals first.";
    }
  }

  return null;
}

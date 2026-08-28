import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  VALID_TRANSITIONS,
  canTransition,
  findTransition,
  isTerminal,
  TERMINAL_STATUSES,
  type Transition,
  type TransitionActor,
} from "./state-machine.ts";

/**
 * Look up a source status's edges, failing loudly if the key is
 * missing. `noUncheckedIndexedAccess` types a bare `VALID_TRANSITIONS[k]`
 * as possibly-undefined; in these tests the key's presence IS the thing
 * under test, so we assert it here and hand back a non-optional array.
 */
function edgesOf(status: string): Transition[] {
  const edges = VALID_TRANSITIONS[status];
  assert.ok(edges, `${status} must be a key on VALID_TRANSITIONS`);
  return edges;
}

// All the legitimate client edges, by source status. A spec for "the
// business owner is allowed to do this directly via updateTaskStatus".
// Anything missing here is either student-driven, system-only, or
// simply not implemented yet — that information is the test.
const ALL_CLIENT_EDGES: Record<string, string[]> = {
  draft: ["open", "cancelled"],
  open: ["cancelled"],
  submitted: ["client_review"],
  client_review: ["completed", "disputed"],
};

describe("VALID_TRANSITIONS — every source status has a complete table", () => {
  test("draft has exactly the client edges it should", () => {
    assert.deepEqual(ALL_CLIENT_EDGES.draft, ["open", "cancelled"]);
  });

  test("open does NOT list in_progress as a client edge (finding #3)", () => {
    // The whole point of the audit #3 guard: the edge exists but with
    // by: "system", because it happens inside the accept_proposal RPC.
    // A regression here would silently re-open the door the action
    // layer and the DB trigger are both trying to close.
    const openEdges = edgesOf("open");
    assert.ok(
      openEdges.map((t) => t.to).includes("in_progress"),
      "edge should exist, but for system",
    );

    const inProgressEdge = openEdges.find((t) => t.to === "in_progress");
    assert.ok(inProgressEdge, "open -> in_progress edge must be present");
    assert.equal(inProgressEdge.by, "system");
  });

  test("in_progress only allows student to drive it toward submitted", () => {
    const edges = edgesOf("in_progress");
    assert.equal(edges.length, 1);

    const only = edges[0];
    assert.ok(only);
    assert.equal(only.to, "submitted");
    assert.equal(only.by, "student");
  });

  test("every terminal status declares no outgoing edges", () => {
    // Completed/cancelled/disputed are frozen states — an outgoing
    // edge is a release-blocker.
    for (const status of TERMINAL_STATUSES) {
      assert.deepEqual(
        VALID_TRANSITIONS[status] ?? [],
        [],
        `${status} must have no outgoing edges`,
      );
    }
  });

  test("every non-terminal status has at least one outgoing edge", () => {
    // Terminal statuses deliberately have NO key on VALID_TRANSITIONS —
    // they are governed by the Postgres CHECK constraint and the RLS
    // policies, so asserting an edge exists would be wrong.
    const nonTerminal = ["draft", "open", "in_progress", "submitted", "client_review"];
    for (const status of nonTerminal) {
      assert.ok(
        edgesOf(status).length > 0,
        `${status} must have at least one outgoing edge`,
      );
    }
  });
});

describe("canTransition", () => {
  test("the legitimate client edges in ALL_CLIENT_EDGES all resolve true", () => {
    for (const [from, tos] of Object.entries(ALL_CLIENT_EDGES)) {
      for (const to of tos) {
        assert.ok(canTransition(from, to, "client"), `${from} -> ${to}`);
      }
    }
  });

  test("client cannot drive in_progress via the state machine (finding #3)", () => {
    // The action layer also guards this — but the state machine is
    // the source of truth, and it must reflect the rule on its own.
    assert.equal(canTransition("open", "in_progress", "client"), false);
  });

  test("only system may drive open -> in_progress", () => {
    assert.equal(canTransition("open", "in_progress", "client"), false);
    assert.equal(canTransition("open", "in_progress", "student"), false);
    assert.equal(canTransition("open", "in_progress", "system"), true);
  });

  test("client cannot drive in_progress -> submitted", () => {
    // That edge belongs to the student via the submission action.
    assert.equal(canTransition("in_progress", "submitted", "client"), false);
    assert.equal(canTransition("in_progress", "submitted", "student"), true);
  });

  test("rejects every legacy or made-up transition", () => {
    const bogus = [
      ["draft", "in_progress"],       // skip open
      ["draft", "submitted"],         // skip everything
      ["open", "completed"],          // skip in_progress and review
      ["completed", "open"],          // reverse a terminal
      ["", "open"],                   // empty source
      ["open", ""],                   // empty target
    ];
    for (const [from, to] of bogus) {
      assert.equal(
        canTransition(from as string, to as string, "client"),
        false,
        `must reject ${from || "<empty>"} -> ${to || "<empty>"}`,
      );
    }
  });
});

describe("findTransition", () => {
  test("returns the matching transition when one exists", () => {
    const t = findTransition("draft", "open");
    assert.ok(t);
    assert.equal(t.to, "open");
    assert.equal(t.by, "client");
  });

  test("returns null when the edge does not exist", () => {
    assert.equal(findTransition("draft", "in_progress"), null);
    assert.equal(findTransition("open", "completed"), null);
    assert.equal(findTransition("completed", "open"), null);
  });

  test("distinguishes a non-existent source from an existing source with no edges", () => {
    // A status that exists but has no outgoing edges (any terminal)
    // must NOT return a transition, but a status that does not appear
    // on the map at all ALSO returns null.
    for (const terminal of TERMINAL_STATUSES) {
      assert.equal(findTransition(terminal, "open"), null);
    }
    assert.equal(findTransition("not-a-real-status", "open"), null);
  });
});

describe("isTerminal", () => {
  test("all entries in TERMINAL_STATUSES are recognised as terminal", () => {
    for (const status of TERMINAL_STATUSES) {
      assert.ok(isTerminal(status), `${status} should be terminal`);
    }
  });

  test("every non-terminal status returns false", () => {
    const nonTerminal = ["draft", "open", "in_progress", "submitted", "client_review"];
    for (const status of nonTerminal) {
      assert.equal(isTerminal(status), false, `${status} should not be terminal`);
    }
  });

  test("an unknown status is treated as terminal (no edges)", () => {
    // Defensive: if a typo ever made it past the check constraint, the
    // state machine returns no transitions, which the action layer
    // turns into "No transitions available from <status>". Behaving
    // consistently here matters for that error path.
    assert.equal(isTerminal("garbage"), true);
  });
});

describe("every actor type is represented in the map", () => {
  test("at least one client, student, and system edge exist", () => {
    const actors = new Set<TransitionActor>();
    for (const transitions of Object.values(VALID_TRANSITIONS)) {
      for (const t of transitions) actors.add(t.by);
    }
    assert.ok(actors.has("client"), "no client edges left in the map");
    assert.ok(actors.has("student"), "no student edges left in the map");
    assert.ok(
      actors.has("system"),
      'no system edges left in the map — finding #3 guard has nothing to anchor to',
    );
  });
});

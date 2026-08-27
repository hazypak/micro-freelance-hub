import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checkTermsLock, type TaskTerms } from "./terms-lock.ts";

// A task with a concrete budget and a deadline a year out.
const WITH_DEADLINE: TaskTerms = {
  budget: 150,
  deadline: "2027-06-01T10:00:00.000Z",
};

// A task the owner left open-ended.
const NO_DEADLINE: TaskTerms = { budget: 150, deadline: null };

/** checkTermsLock returns null to allow, or a message to block. */
const allowed = (r: string | null) => r === null;

describe("checkTermsLock — budget", () => {
  test("allows raising the budget", () => {
    assert.ok(allowed(checkTermsLock(WITH_DEADLINE, { budget: 200 })));
  });

  test("blocks lowering the budget", () => {
    const r = checkTermsLock(WITH_DEADLINE, { budget: 100 });
    assert.match(String(r), /Budget cannot be reduced/);
  });

  test("allows an unchanged budget", () => {
    // Re-submitting the same value is not a reduction. The form posts
    // every field on every save, so this is the common case — treating
    // equality as a violation would make ordinary edits impossible.
    assert.ok(allowed(checkTermsLock(WITH_DEADLINE, { budget: 150 })));
  });

  test("ignores an absent budget", () => {
    assert.ok(allowed(checkTermsLock(WITH_DEADLINE, {})));
  });

  test("blocks a reduction even by a fractional amount", () => {
    const r = checkTermsLock(WITH_DEADLINE, { budget: 149.99 });
    assert.match(String(r), /Budget cannot be reduced/);
  });
});

describe("checkTermsLock — deadline", () => {
  test("allows extending the deadline", () => {
    const r = checkTermsLock(WITH_DEADLINE, {
      deadline: "2027-09-01T10:00:00.000Z",
    });
    assert.ok(allowed(r));
  });

  test("blocks bringing the deadline forward", () => {
    const r = checkTermsLock(WITH_DEADLINE, {
      deadline: "2027-03-01T10:00:00.000Z",
    });
    assert.match(String(r), /cannot be brought forward/);
  });

  test("allows clearing the deadline entirely", () => {
    // null means "no due date" — strictly more time for the student.
    assert.ok(allowed(checkTermsLock(WITH_DEADLINE, { deadline: null })));
  });

  test("blocks ADDING a deadline where none existed", () => {
    // The subtle one: students bid on an open-ended task, so imposing
    // a due date is a new constraint they never priced in. A naive
    // `next < current` comparison would wave this through, because
    // there is no current value to compare against.
    const r = checkTermsLock(NO_DEADLINE, {
      deadline: "2027-06-01T10:00:00.000Z",
    });
    assert.match(String(r), /cannot be added/);
  });

  test("allows clearing when there was no deadline to begin with", () => {
    assert.ok(allowed(checkTermsLock(NO_DEADLINE, { deadline: null })));
  });

  test("allows an unchanged deadline", () => {
    const r = checkTermsLock(WITH_DEADLINE, {
      deadline: WITH_DEADLINE.deadline,
    });
    assert.ok(allowed(r));
  });

  test("rejects a malformed date rather than silently allowing it", () => {
    // An Invalid Date makes every comparison false, so an unguarded
    // implementation would treat garbage as an acceptable edit.
    const r = checkTermsLock(WITH_DEADLINE, { deadline: "not-a-date" });
    assert.match(String(r), /not a valid date/);
  });

  test("compares instants, not strings", () => {
    // Same moment, different textual representation. A string compare
    // would call this a change; it is not one.
    const r = checkTermsLock(
      { budget: 150, deadline: "2027-06-01T10:00:00.000Z" },
      { deadline: "2027-06-01T18:00:00.000+08:00" },
    );
    assert.ok(allowed(r));
  });
});

describe("checkTermsLock — combined", () => {
  test("blocks when budget is fine but deadline is not", () => {
    const r = checkTermsLock(WITH_DEADLINE, {
      budget: 300,
      deadline: "2027-01-01T10:00:00.000Z",
    });
    assert.match(String(r), /cannot be brought forward/);
  });

  test("reports the budget violation first when both are bad", () => {
    const r = checkTermsLock(WITH_DEADLINE, {
      budget: 10,
      deadline: "2027-01-01T10:00:00.000Z",
    });
    assert.match(String(r), /Budget cannot be reduced/);
  });

  test("allows an edit that improves both", () => {
    const r = checkTermsLock(WITH_DEADLINE, {
      budget: 500,
      deadline: "2028-01-01T10:00:00.000Z",
    });
    assert.ok(allowed(r));
  });

  test("allows edits that touch neither term", () => {
    // Title/description edits reach here with no budget or deadline key.
    assert.ok(allowed(checkTermsLock(WITH_DEADLINE, {})));
  });
});

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isHttpUrl, parseId, updateTaskSchema } from "./schemas.ts";

describe("isHttpUrl", () => {
  test("accepts http and https", () => {
    assert.equal(isHttpUrl("http://example.com/a.pdf"), true);
    assert.equal(isHttpUrl("https://example.com/a.pdf"), true);
  });

  test("rejects executable schemes", () => {
    // These are the reason the function exists: a deliverable_url is
    // rendered as an anchor href for the reviewing client to click.
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
    ]) {
      assert.equal(isHttpUrl(url), false, `should reject ${url}`);
    }
  });

  test("rejects scheme-casing tricks", () => {
    // The URL parser lowercases the protocol, so this must still be
    // caught — a naive startsWith("javascript:") check would miss it.
    assert.equal(isHttpUrl("JavaScript:alert(1)"), false);
  });

  test("rejects non-web schemes", () => {
    assert.equal(isHttpUrl("file:///etc/passwd"), false);
    assert.equal(isHttpUrl("ftp://example.com/x"), false);
  });

  test("rejects unparseable input", () => {
    assert.equal(isHttpUrl("not a url"), false);
    assert.equal(isHttpUrl(""), false);
  });
});

describe("parseId", () => {
  const VALID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

  test("accepts a well-formed uuid", () => {
    assert.equal(parseId(VALID), VALID);
  });

  test("returns null for absent input", () => {
    assert.equal(parseId(null), null);
  });

  test("returns null for a non-uuid string", () => {
    assert.equal(parseId("1; DROP TABLE tasks"), null);
    assert.equal(parseId("42"), null);
    assert.equal(parseId(""), null);
  });

  test("returns null for a non-string FormData entry", () => {
    // formData.get() returns File | string | null. The old code cast
    // the result to string unconditionally, which was simply untrue —
    // a multipart POST can put a file part under any field name.
    const notAString = new File(["x"], "id.txt") as unknown as FormDataEntryValue;
    assert.equal(parseId(notAString), null);
  });
});

describe("updateTaskSchema — clearing optional fields", () => {
  // Regression cover for the three-way deadline bug. `null` must be
  // accepted so an owner can clear a field: supabase-js serialises the
  // payload with JSON.stringify, which drops undefined keys, so
  // undefined silently means "leave unchanged".
  test("accepts null to clear the deadline", () => {
    assert.equal(updateTaskSchema.safeParse({ deadline: null }).success, true);
  });

  test("accepts null to clear the brief", () => {
    assert.equal(updateTaskSchema.safeParse({ brief: null }).success, true);
  });

  test("null survives JSON serialisation but undefined does not", () => {
    // The actual mechanism behind the bug, pinned so it cannot regress.
    assert.equal(JSON.stringify({ deadline: null }), '{"deadline":null}');
    assert.equal(JSON.stringify({ deadline: undefined }), "{}");
  });

  test("rejects a raw datetime-local string", () => {
    // What <input type="datetime-local"> submits. The client converts
    // to an instant before posting; if that conversion is ever removed
    // or bypassed, the server must still refuse rather than guess a
    // timezone.
    const r = updateTaskSchema.safeParse({ deadline: "2027-03-01T18:30" });
    assert.equal(r.success, false);
  });

  test("accepts a full ISO instant", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    assert.equal(updateTaskSchema.safeParse({ deadline: future }).success, true);
  });

  test("rejects a deadline in the past", () => {
    const r = updateTaskSchema.safeParse({
      deadline: "2020-01-01T00:00:00.000Z",
    });
    assert.equal(r.success, false);
  });
});

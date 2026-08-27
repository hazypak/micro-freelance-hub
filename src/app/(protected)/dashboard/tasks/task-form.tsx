"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTask, updateTask } from "@/lib/tasks/actions";
import type { ActionResult } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

// ─── Constants ─────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "design", label: "Design" },
  { value: "development", label: "Development" },
  { value: "writing", label: "Writing" },
  { value: "marketing", label: "Marketing" },
  { value: "video", label: "Video" },
  { value: "data", label: "Data" },
  { value: "research", label: "Research" },
  { value: "other", label: "Other" },
] as const;

const SKILL_SUGGESTIONS = [
  "React",
  "Next.js",
  "TypeScript",
  "Figma",
  "Tailwind CSS",
  "Python",
  "Node.js",
  "Copywriting",
  "Video Editing",
  "Data Analysis",
  "UI/UX Design",
  "SEO",
];

const DELIVERABLE_SUGGESTIONS = [
  "PDF",
  "Figma file",
  "Source code",
  "Video",
  "Image",
  "Document",
  "Spreadsheet",
  "Presentation",
];

// ─── Types ─────────────────────────────────────────────────────────

/** The subset of a task this form reads back when editing. */
export interface TaskFormValues {
  id: string;
  title: string;
  description: string;
  brief: string | null;
  category: string;
  budget: number;
  deadline: string | null;
  required_skills: string[] | null;
  permitted_deliverable_types: string[] | null;
}

interface TaskFormProps {
  /** Omit to create a new draft; pass a task to edit it in place. */
  task?: TaskFormValues;
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Convert a Postgres timestamptz into the `YYYY-MM-DDTHH:mm` string
 * that `<input type="datetime-local">` requires.
 *
 * ★ The input has no timezone concept — it renders whatever wall-clock
 *   string you hand it. Postgres gives us an absolute instant, so we
 *   shift by the viewer's UTC offset first, otherwise a Malaysian
 *   client editing an 18:30 deadline would be shown 10:30.
 */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";

  const shifted = new Date(
    parsed.getTime() - parsed.getTimezoneOffset() * 60_000,
  );
  return shifted.toISOString().slice(0, 16);
}

// ─── Component ─────────────────────────────────────────────────────

/**
 * TaskForm — task creation *and* editing.
 *
 * Pattern: useState + useTransition + manual FormData construction,
 * matching the onboarding form. TagInput arrays are serialised as
 * JSON strings so the server action can parse them with parseJsonArray().
 *
 * Two modes, one set of fields:
 *   - create → `createTask`, which redirects on success
 *   - edit   → `updateTask`, which stays put and returns a message
 *
 * ★ Why one component instead of two: the field list, its validation
 *   bounds, and the tag suggestions are the contract with
 *   `taskSchema`. Forking the form would let the two copies drift out
 *   of step with each other and with the schema.
 */
export function TaskForm({ task }: TaskFormProps) {
  const isEdit = task !== undefined;

  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Controlled state for tag inputs (TagInput is not forwardRef-based)
  const [skills, setSkills] = useState<string[]>(task?.required_skills ?? []);
  const [deliverableTypes, setDeliverableTypes] = useState<string[]>(
    task?.permitted_deliverable_types ?? [],
  );

  // ── Deadline: controlled, and seeded only after mount ────────────
  //
  // ★ This is the one field that can't use `defaultValue`. Its display
  //   value depends on the *viewer's* timezone, and the server prerender
  //   runs in UTC — so a server-rendered default would disagree with the
  //   client's first render and trip a hydration mismatch. Starting empty
  //   makes both passes agree; the effect fills it in a tick later.
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    setDeadline(toDatetimeLocalValue(task?.deadline ?? null));
  }, [task?.deadline]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Serialise tag arrays as JSON for parseJsonArray() on the server
    formData.set("required_skills", JSON.stringify(skills));
    formData.set(
      "permitted_deliverable_types",
      JSON.stringify(deliverableTypes),
    );

    // ── Deadline: wall-clock → absolute instant ────────────────────
    //
    // ★ `<input type="datetime-local">` submits a bare wall-clock
    //   string ("2027-03-01T18:30") with no timezone, but the server
    //   schema requires a full ISO-8601 instant — so an unconverted
    //   value is rejected outright as invalid input.
    //
    //   The conversion has to happen HERE rather than server-side:
    //   only the browser knows the viewer's UTC offset. The server
    //   runs in UTC, so it would read a Malaysian client's 18:30 as
    //   18:30Z — eight hours adrift from what they picked.
    //
    //   `new Date("…T18:30")` (no offset) is parsed as local time per
    //   spec, so toISOString() yields the correct instant. An empty
    //   value is left as "" — the server reads that as "clear it".
    if (deadline) {
      const asInstant = new Date(deadline);
      if (!Number.isNaN(asInstant.getTime())) {
        formData.set("deadline", asInstant.toISOString());
      }
    }

    startTransition(async () => {
      if (isEdit) {
        formData.set("taskId", task.id);
        const actionResult = await updateTask(formData);
        setResult(actionResult);
        // updateTask revalidates the detail page but we stay here, so
        // refresh to pull the saved values back through this route too.
        if (actionResult.success) router.refresh();
        return;
      }

      // createTask redirects on success — we only land here on error
      setResult(await createTask(formData));
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
          <CardDescription>
            {isEdit
              ? "Changes are saved immediately. Published tasks stay visible to students while you edit."
              : "Fill in the details below. Tasks are created as drafts — you can review and publish them later."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ── Error banner ───────────────────────────────────────── */}
          {result?.error && (
            <div
              role="alert"
              className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700"
            >
              {result.error}
            </div>
          )}

          {/* ── Success banner (edit only — create redirects) ───────── */}
          {result?.success && result.message && (
            <div
              role="status"
              className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700"
            >
              {result.message}
            </div>
          )}

          {/* ── Title ──────────────────────────────────────────────── */}
          <Input
            label="Title"
            name="title"
            placeholder="e.g. Design a landing page hero section"
            required
            minLength={5}
            maxLength={120}
            disabled={isPending}
            defaultValue={task?.title}
            description="A clear, concise title (5–120 characters)"
          />

          {/* ── Description ────────────────────────────────────────── */}
          <Textarea
            label="Description"
            name="description"
            placeholder="Describe what you need done, key requirements, and expected outcome…"
            required
            minLength={20}
            maxLength={5000}
            disabled={isPending}
            defaultValue={task?.description}
            description="Detailed task requirements (20–5,000 characters)"
          />

          {/* ── Brief (optional) ───────────────────────────────────── */}
          <Textarea
            label="Brief"
            name="brief"
            placeholder="Paste a creative brief, style guide, or additional context…"
            maxLength={10000}
            disabled={isPending}
            defaultValue={task?.brief ?? undefined}
            description="Optional extended brief — paste reference material or detailed specs"
          />

          {/* ── Category & Budget row ──────────────────────────────── */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Select
              label="Category"
              name="category"
              required
              disabled={isPending}
              defaultValue={task?.category ?? ""}
            >
              <option value="" disabled>
                Select a category
              </option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </Select>

            <Input
              label="Budget (MYR)"
              name="budget"
              type="number"
              placeholder="e.g. 150"
              required
              min={1}
              max={50000}
              step="0.01"
              disabled={isPending}
              defaultValue={task?.budget}
              description="Amount you're willing to pay"
            />
          </div>

          {/* ── Deadline (optional) ────────────────────────────────── */}
          <Input
            label="Deadline"
            name="deadline"
            type="datetime-local"
            disabled={isPending}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            description="Optional — when do you need this completed?"
          />

          {/* ── Required Skills ─────────────────────────────────────── */}
          <TagInput
            label="Required Skills"
            tags={skills}
            onChange={setSkills}
            suggestions={SKILL_SUGGESTIONS}
            maxTags={10}
            disabled={isPending}
            placeholder="e.g. React, Figma…"
            description="Skills a freelancer should have (optional, max 10)"
          />

          {/* ── Permitted Deliverable Types ─────────────────────────── */}
          <TagInput
            label="Permitted Deliverable Types"
            tags={deliverableTypes}
            onChange={setDeliverableTypes}
            suggestions={DELIVERABLE_SUGGESTIONS}
            maxTags={5}
            disabled={isPending}
            placeholder="e.g. PDF, Source code…"
            description="Accepted file formats for submissions (optional, max 5)"
          />
        </CardContent>

        {/* ── Footer with submit ─────────────────────────────────────── */}
        <CardFooter className="justify-end">
          <Button type="submit" loading={isPending}>
            {isEdit ? "Save Changes" : "Create Draft"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

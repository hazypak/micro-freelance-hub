"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Link as LinkIcon, Loader2 } from "lucide-react";
import { submitDeliverable } from "@/lib/submissions/actions";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/validation/schemas";
import type { ActionResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────

interface SubmissionFormProps {
  taskId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Human-readable file size */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human-readable list of allowed extensions */
const ALLOWED_EXTENSIONS = [
  ".pdf", ".png", ".jpg", ".webp",
  ".zip", ".txt", ".md", ".docx",
];

/**
 * Client-side pre-flight check, run before the file is handed to
 * Supabase Storage — catching a bad file here saves an upload round-trip
 * and gives the student instant feedback instead of a late failure.
 *
 * ★ This is a convenience, NOT a security boundary. It runs in the
 *   browser and is trivially bypassed. The real enforcement is the
 *   "Deliverables: upload" storage policy (migration 004), which ties
 *   every write to an existing task_assignment for the calling student.
 *
 * @returns an error message to display, or null when the file is fine.
 */
function validateFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return `File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(", ")}`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File is too large (${formatFileSize(file.size)}). Maximum: ${formatFileSize(MAX_FILE_SIZE)}`;
  }
  if (file.size === 0) {
    return "File is empty";
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * SubmissionForm — client component for deliverable submission.
 *
 * Two-phase upload flow:
 *   Phase 1: Upload file directly to Supabase Storage (browser → Storage)
 *   Phase 2: Pass storage_path + metadata to submitDeliverable server action
 *
 * Uses the same useState + useTransition + ActionResult pattern as
 * ProposalForm and TaskActions throughout the project.
 */
export function SubmissionForm({ taskId }: SubmissionFormProps) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const router = useRouter();

  // ── File selection handler ─────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFileError(null);
    setResult(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setSelectedFile(null);
      // Reset the input so the same file can be re-selected
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  }

  // ── Clear file ─────────────────────────────────────────────────
  function handleClearFile() {
    setSelectedFile(null);
    setFileError(null);
    // Reset the file input element
    const input = document.getElementById("file-input") as HTMLInputElement;
    if (input) input.value = "";
  }

  // ── Form submission ────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const deliverableUrl = (new FormData(form).get("deliverable_url") as string) || "";

    // Must provide at least one deliverable method
    if (!selectedFile && !deliverableUrl) {
      setResult({ error: "Please upload a file or provide a deliverable URL" });
      return;
    }

    startTransition(async () => {
      let storagePath: string | null = null;

      // ── Phase 1: Upload file to Supabase Storage ──────────────
      if (selectedFile) {
        setUploadProgress("Uploading file…");

        const supabase = createClient();

        // Generate a unique path: taskId/timestamp_filename
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${taskId}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("deliverables")
          .upload(path, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setUploadProgress(null);
          setResult({ error: "File upload failed. Please try again." });
          return;
        }

        storagePath = path;
        setUploadProgress("File uploaded! Submitting…");
      }

      // ── Phase 2: Call server action ───────────────────────────
      const formData = new FormData(form);
      formData.set("task_id", taskId);
      if (storagePath) {
        formData.set("storage_path", storagePath);
      }

      const actionResult = await submitDeliverable(formData);
      setUploadProgress(null);
      setResult(actionResult);

      if (actionResult.success) {
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Your Work</CardTitle>
        <CardDescription>
          Upload a file and/or provide a link to your deliverable
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Hidden task ID */}
          <input type="hidden" name="task_id" value={taskId} />

          {/* ── File upload area ───────────────────────────────── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              File Upload
            </label>
            <p className="mb-3 text-xs text-text-tertiary">
              Accepted: {ALLOWED_EXTENSIONS.join(", ")} — Max{" "}
              {formatFileSize(MAX_FILE_SIZE)}
            </p>

            {selectedFile ? (
              /* Selected file preview */
              <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/50 px-4 py-3">
                <FileText className="h-5 w-5 shrink-0 text-brand-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearFile}
                  disabled={isPending}
                  className="shrink-0 rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              /* Drop zone / file picker */
              <label
                htmlFor="file-input"
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8",
                  "transition-colors duration-fast",
                  fileError
                    ? "border-error-300 bg-error-50/50"
                    : "border-border-default bg-surface-sunken hover:border-brand-300 hover:bg-brand-50/30",
                  isPending && "pointer-events-none opacity-50",
                )}
              >
                <Upload className="h-8 w-8 text-text-tertiary" />
                <span className="text-sm font-medium text-text-secondary">
                  Click to select a file
                </span>
                <span className="text-xs text-text-tertiary">
                  or drag and drop
                </span>
              </label>
            )}

            <input
              id="file-input"
              type="file"
              className="sr-only"
              accept={ALLOWED_EXTENSIONS.join(",")}
              onChange={handleFileChange}
              disabled={isPending}
            />

            {/* File validation error */}
            {fileError && (
              <p className="mt-2 text-sm text-error-600">{fileError}</p>
            )}
          </div>

          {/* ── OR divider ─────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border-subtle" />
            <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              or
            </span>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>

          {/* ── Deliverable URL ─────────────────────────────────── */}
          <Input
            name="deliverable_url"
            label="Deliverable URL"
            description="Link to your work — GitHub repo, Figma file, Google Drive, etc."
            type="url"
            placeholder="https://"
            disabled={isPending}
          >
            <LinkIcon className="h-4 w-4" />
          </Input>

          {/* ── Notes ──────────────────────────────────────────── */}
          <Textarea
            name="notes"
            label="Notes for the client"
            description="Explain what you delivered, any setup instructions, or context (optional)"
            rows={4}
            maxLength={2000}
            disabled={isPending}
          />

          {/* ── Upload progress ─────────────────────────────────── */}
          {uploadProgress && (
            <div className="flex items-center gap-2 rounded-lg border border-info-200 bg-info-50 px-4 py-3 text-sm text-info-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploadProgress}
            </div>
          )}

          {/* ── Error banner ────────────────────────────────────── */}
          {result?.error && (
            <div
              role="alert"
              className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700"
            >
              {result.error}
            </div>
          )}

          {/* ── Success banner ──────────────────────────────────── */}
          {result?.success && result.message && (
            <div
              role="status"
              className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700"
            >
              {result.message}
            </div>
          )}

          {/* ── Submit button ──────────────────────────────────── */}
          <Button type="submit" className="w-full" loading={isPending}>
            Submit Deliverable
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

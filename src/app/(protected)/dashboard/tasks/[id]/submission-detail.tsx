"use client";

import { useState, useTransition } from "react";
import {
  FileText,
  Download,
  ExternalLink,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { getSignedDownloadUrl } from "@/lib/submissions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { isHttpUrl } from "@/lib/validation/schemas";

// ─── Types ───────────────────────────────────────────────────────

export interface SubmissionData {
  id: string;
  deliverable_url: string | null;
  storage_path: string | null;
  notes: string | null;
  submitted_at: string;
  ai_verification_status: string;
  student_name: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Map verification status → Badge variant. */
const verificationBadgeVariant: Record<
  string,
  "info" | "success" | "warning" | "error" | "default"
> = {
  pending: "default",
  queued: "info",
  scanning: "info",
  passed: "success",
  failed: "error",
  needs_manual_review: "warning",
  retryable_error: "warning",
};

// ─── Component ───────────────────────────────────────────────────

/**
 * SubmissionDetail — shows the freelancer's submitted deliverable.
 *
 * ★ Pattern: The download button calls getSignedDownloadUrl (a server
 *   action) which generates a 60-second signed URL for the private
 *   Storage bucket. We then open it in a new tab. This avoids
 *   exposing raw storage paths to the client.
 */
export function SubmissionDetail({
  submission,
}: {
  submission: SubmissionData;
}) {
  const [isPending, startTransition] = useTransition();
  const [downloadError, setDownloadError] = useState<string | null>(null);

  function handleDownload() {
    if (!submission.storage_path) return;

    setDownloadError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("storage_path", submission.storage_path!);

      const result = await getSignedDownloadUrl(formData);
      if (result.error) {
        setDownloadError(result.error);
        return;
      }
      if (result.url) {
        window.open(result.url, "_blank");
      }
    });
  }

  // Extract filename from storage path (e.g. "taskId/1234_file.pdf" → "file.pdf")
  const fileName = submission.storage_path
    ? submission.storage_path.split("/").pop()?.replace(/^\d+_/, "") ?? "file"
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-brand-600" />
          Submission
        </CardTitle>
        <CardDescription>
          {submission.student_name
            ? `Submitted by ${submission.student_name}`
            : "Submitted"}{" "}
          on {formatDate(submission.submitted_at, "short-time")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Uploaded file ────────────────────────────────────── */}
        {submission.storage_path && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Uploaded File
            </span>
            <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-border-default bg-surface-sunken px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-text-tertiary" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                {fileName}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                loading={isPending}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download
              </Button>
            </div>
            {downloadError && (
              <p className="mt-1.5 text-sm text-error-600">{downloadError}</p>
            )}
          </div>
        )}

        {/* ── External URL ─────────────────────────────────────── */}
        {submission.deliverable_url && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              External Link
            </span>
            <div className="mt-1.5">
              {isHttpUrl(submission.deliverable_url) ? (
                <a
                  href={submission.deliverable_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-brand-600 underline decoration-brand-200 hover:text-brand-700 hover:decoration-brand-400"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {submission.deliverable_url}
                </a>
              ) : (
                /* The student controls this value and the client clicks it.
                   Non-web schemes (javascript:, data:) would execute in the
                   client's session — render inert, flagged text instead. */
                <div className="flex items-start gap-1.5 text-sm text-warning-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="break-all">
                    {submission.deliverable_url}
                    <span className="ml-1.5 text-xs text-text-tertiary">
                      (unsupported link type — not clickable)
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Notes ────────────────────────────────────────────── */}
        {submission.notes && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Freelancer Notes
            </span>
            <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-surface-sunken px-4 py-3 text-sm leading-relaxed text-text-secondary">
              {submission.notes}
            </p>
          </div>
        )}

        {/* ── Verification status ──────────────────────────────── */}
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            AI Verification
          </span>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge
              variant={
                verificationBadgeVariant[submission.ai_verification_status] ??
                "default"
              }
              className="capitalize"
            >
              {submission.ai_verification_status.replace(/_/g, " ")}
            </Badge>
            {submission.ai_verification_status === "pending" && (
              <span className="flex items-center gap-1 text-xs text-text-tertiary">
                <Clock className="h-3 w-3" />
                Awaiting scan
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

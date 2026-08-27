"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProposal, withdrawProposal } from "@/lib/proposals/actions";
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
import { formatBudget } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ─── Props ────────────────────────────────────────────────────────

interface ProposalFormProps {
  taskId: string;
  /** Budget set by the business — shown as reference. */
  taskBudget: number;
  /** If the student already has a proposal, show its status instead. */
  existingProposal?: {
    id: string;
    status: string;
    cover_message: string;
    proposed_price: number | null;
    timeline_estimate: string | null;
  } | null;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * ProposalForm — student-facing proposal submission.
 *
 * Handles three states:
 *   1. No existing proposal → show the submission form
 *   2. Pending proposal → show proposal details + withdraw button
 *   3. Accepted/rejected/withdrawn → show status (read-only)
 *
 * Uses the same useState + useTransition + ActionResult pattern as
 * TaskForm and TaskActions throughout the project.
 */
export function ProposalForm({
  taskId,
  taskBudget,
  existingProposal,
}: ProposalFormProps) {
  const [result, setResult] = useState<ActionResult | null>(null);
  // Declared here, not in the branch below — hooks can't be conditional.
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // ── Existing proposal: show status ─────────────────────────────
  if (existingProposal) {
    const statusLabels: Record<string, { text: string; style: string }> = {
      pending: {
        text: "Your proposal is pending review",
        style: "border-warning-200 bg-warning-50 text-warning-700",
      },
      accepted: {
        text: "Your proposal was accepted! 🎉",
        style: "border-success-200 bg-success-50 text-success-700",
      },
      rejected: {
        text: "Your proposal was not selected",
        style: "border-error-200 bg-error-50 text-error-700",
      },
      withdrawn: {
        text: "You withdrew this proposal",
        style: "border-border-default bg-surface-sunken text-text-tertiary",
      },
    };

    const statusInfo = statusLabels[existingProposal.status] ?? {
      text: existingProposal.status,
      style: "border-border-default bg-surface text-text-secondary",
    };

    function runWithdraw() {
      const formData = new FormData();
      formData.set("proposalId", existingProposal!.id);

      startTransition(async () => {
        const actionResult = await withdrawProposal(formData);
        setResult(actionResult);
        setConfirmingWithdraw(false);
        if (actionResult.success) router.refresh();
      });
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Proposal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status banner */}
          <div
            role="status"
            className={`rounded-lg border px-4 py-3 text-sm ${statusInfo.style}`}
          >
            {statusInfo.text}
          </div>

          {/* Proposal details */}
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                Cover Message
              </span>
              <p className="mt-1 whitespace-pre-wrap text-text-secondary">
                {existingProposal.cover_message}
              </p>
            </div>

            {existingProposal.proposed_price != null && (
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Proposed Price
                </span>
                <p className="mt-1 text-text-secondary">
                  {formatBudget(existingProposal.proposed_price)}
                </p>
              </div>
            )}

            {existingProposal.timeline_estimate && (
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Timeline
                </span>
                <p className="mt-1 text-text-secondary">
                  {existingProposal.timeline_estimate}
                </p>
              </div>
            )}
          </div>

          {/* Action feedback */}
          {result?.error && (
            <div
              role="alert"
              className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700"
            >
              {result.error}
            </div>
          )}

          {result?.success && result.message && (
            <div
              role="status"
              className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700"
            >
              {result.message}
            </div>
          )}

          {/* Withdraw button (pending only) */}
          {existingProposal.status === "pending" && (
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              loading={isPending}
              onClick={() => setConfirmingWithdraw(true)}
            >
              Withdraw Proposal
            </Button>
          )}
        </CardContent>

        <ConfirmDialog
          open={confirmingWithdraw}
          onClose={() => setConfirmingWithdraw(false)}
          onConfirm={runWithdraw}
          loading={isPending}
          title="Withdraw your proposal?"
          description="Your proposal is removed from the client's list and you can't re-apply to this task. You can't undo this."
          confirmLabel="Withdraw proposal"
          variant="destructive"
        />
      </Card>
    );
  }

  // ── New proposal form ──────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const actionResult = await createProposal(formData);
      setResult(actionResult);
      if (actionResult.success) router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a Proposal</CardTitle>
        <CardDescription>
          Task budget: {formatBudget(taskBudget)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hidden task ID */}
          <input type="hidden" name="task_id" value={taskId} />

          {/* Cover message */}
          <Textarea
            name="cover_message"
            label="Cover Message"
            description="Introduce yourself and explain why you're a great fit (min. 20 characters)"
            rows={5}
            required
            minLength={20}
            maxLength={2000}
            disabled={isPending}
          />

          {/* Proposed price */}
          <Input
            name="proposed_price"
            label="Proposed Price (MYR)"
            description="Optional — leave blank to accept the posted budget"
            type="number"
            step="0.01"
            min="1"
            max="50000"
            disabled={isPending}
          />

          {/* Timeline estimate */}
          <Input
            name="timeline_estimate"
            label="Timeline Estimate"
            description='Optional — e.g. "3 days", "1 week"'
            maxLength={100}
            disabled={isPending}
          />

          {/* Error banner */}
          {result?.error && (
            <div
              role="alert"
              className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700"
            >
              {result.error}
            </div>
          )}

          {/* Success banner */}
          {result?.success && result.message && (
            <div
              role="status"
              className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700"
            >
              {result.message}
            </div>
          )}

          {/* Submit button */}
          <Button type="submit" className="w-full" loading={isPending}>
            Submit Proposal
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

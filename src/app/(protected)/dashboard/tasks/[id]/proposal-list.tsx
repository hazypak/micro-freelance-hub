"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptProposal, rejectProposal } from "@/lib/proposals/actions";
import type { ActionResult } from "@/lib/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox, CheckCircle2 } from "lucide-react";
import { formatDate, formatBudget } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ─── Types ────────────────────────────────────────────────────────

export interface ProposalItem {
  id: string;
  status: string;
  cover_message: string;
  proposed_price: number | null;
  timeline_estimate: string | null;
  created_at: string;
  /** Student profile display name (joined from profiles table). */
  student_name: string | null;
}

interface ProposalListProps {
  taskId: string;
  proposals: ProposalItem[];
  /** Whether the task is still open (accept/reject enabled). */
  taskIsOpen: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────

const statusBadgeVariant: Record<string, "warning" | "success" | "error" | "default"> = {
  pending: "warning",
  accepted: "success",
  rejected: "error",
  withdrawn: "default",
};

// ─── Component ────────────────────────────────────────────────────

/**
 * ProposalList — business-side proposal review panel.
 *
 * Displays all proposals for a task, grouped with pending first.
 * For open tasks, each pending proposal has Accept / Reject buttons.
 *
 * ★ Pattern: Same useState + useTransition + ActionResult as TaskActions
 *   and ProposalForm. The `actionTarget` state tracks which proposal is
 *   currently being acted on, so we can show loading on the right card
 *   and disable all buttons during the transition.
 */
/** The accept/reject awaiting confirmation, if any. */
type PendingConfirm = {
  kind: "accept" | "reject";
  proposalId: string;
};

export function ProposalList({
  proposals,
  taskIsOpen,
}: ProposalListProps) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Sort: pending first, then by created_at descending
  const sorted = [...proposals].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingCount = proposals.filter((p) => p.status === "pending").length;

  // ── Handlers ──────────────────────────────────────────────────

  // ── Request confirmation ──────────────────────────────────────
  //
  // ConfirmDialog is async, so the intent is parked in `pending`
  // until the user answers — see runConfirmed below.

  function handleAccept(proposalId: string) {
    setPending({ kind: "accept", proposalId });
  }

  function handleReject(proposalId: string) {
    setPending({ kind: "reject", proposalId });
  }

  // ── Execute ───────────────────────────────────────────────────

  function runConfirmed() {
    if (!pending) return;
    const { kind, proposalId } = pending;

    setActionTarget(proposalId);
    const formData = new FormData();
    formData.set("proposalId", proposalId);

    startTransition(async () => {
      const actionResult = await (kind === "accept"
        ? acceptProposal(formData)
        : rejectProposal(formData));
      setResult(actionResult);
      setActionTarget(null);
      setPending(null);
      if (actionResult.success) router.refresh();
    });
  }

  // ── Empty state ────────────────────────────────────────────────

  if (proposals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proposals</CardTitle>
          <CardDescription>No proposals received yet</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Inbox}
            title="Waiting for proposals"
            description="Students will see this task on the ticker and can submit proposals."
          />
        </CardContent>
      </Card>
    );
  }

  // ── Proposal list ──────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Proposals{" "}
          <span className="text-text-tertiary font-normal">
            ({proposals.length})
          </span>
        </CardTitle>
        <CardDescription>
          {pendingCount > 0
            ? `${pendingCount} pending review`
            : "All proposals have been reviewed"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Global feedback banner */}
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
            <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
            {result.message}
          </div>
        )}

        {/* Proposal cards */}
        {sorted.map((proposal) => {
          const isTargeted = actionTarget === proposal.id;
          const badgeVariant = statusBadgeVariant[proposal.status] ?? "default";

          return (
            <div
              key={proposal.id}
              className="rounded-lg border border-border-default p-4 space-y-3"
            >
              {/* Header row: student name + status badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {proposal.student_name ?? "Anonymous Student"}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    Submitted {formatDate(proposal.created_at, "short-time")}
                  </p>
                </div>
                <Badge variant={badgeVariant} className="shrink-0 capitalize">
                  {proposal.status}
                </Badge>
              </div>

              {/* Cover message */}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                {proposal.cover_message}
              </p>

              {/* Meta row: price + timeline */}
              <div className="flex flex-wrap gap-4 text-sm">
                {proposal.proposed_price != null && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                      Proposed Price
                    </span>
                    <p className="mt-0.5 text-text-secondary">
                      {formatBudget(proposal.proposed_price)}
                    </p>
                  </div>
                )}
                {proposal.timeline_estimate && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                      Timeline
                    </span>
                    <p className="mt-0.5 text-text-secondary">
                      {proposal.timeline_estimate}
                    </p>
                  </div>
                )}
              </div>

              {/* Action buttons (pending + open task only) */}
              {proposal.status === "pending" && taskIsOpen && (
                <div className="flex gap-2 border-t border-border-default pt-3">
                  <Button
                    size="sm"
                    variant="primary"
                    loading={isTargeted && isPending}
                    disabled={isPending}
                    onClick={() => handleAccept(proposal.id)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={isTargeted && isPending}
                    disabled={isPending}
                    onClick={() => handleReject(proposal.id)}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={runConfirmed}
        loading={isPending}
        title={
          pending?.kind === "accept"
            ? "Accept this proposal?"
            : "Reject this proposal?"
        }
        description={
          pending?.kind === "accept"
            ? "The task moves to In Progress and every other pending proposal is rejected — those students are notified."
            : "The student is notified that their proposal wasn't selected. You can't undo this."
        }
        confirmLabel={
          pending?.kind === "accept" ? "Accept proposal" : "Reject proposal"
        }
        variant={pending?.kind === "accept" ? "primary" : "destructive"}
      />
    </Card>
  );
}

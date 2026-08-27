"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus, deleteTask } from "@/lib/tasks/actions";
import { reviewSubmission } from "@/lib/submissions/actions";
import type { ActionResult } from "@/lib/auth/actions";
import type { TaskStatus } from "@/components/ui/status-indicator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ─── Action config ─────────────────────────────────────────────────
//
// Maps each task status to the client-side actions available to the
// business owner. This mirrors VALID_TRANSITIONS from the server but
// is focused on presentation: label, variant, confirmation prompt.
//
// Student-side transitions (e.g. submit work) don't appear here —
// they're handled by separate components in later phases.
// ────────────────────────────────────────────────────────────────────

/** Copy for a confirmation step. Omit to run the action immediately. */
interface ConfirmCopy {
  title: string;
  /** State the consequence plainly, including anything irreversible. */
  description: string;
  /** Names the action — never "OK". */
  confirmLabel: string;
  variant?: "primary" | "destructive";
}

interface StatusAction {
  /** New status to transition to. */
  toStatus: string;
  /** Button label. */
  label: string;
  /** Button variant. */
  variant: "primary" | "secondary" | "destructive" | "ghost";
  /** Optional confirmation step — shown before executing. */
  confirm?: ConfirmCopy;
}

const STATUS_ACTIONS: Partial<Record<TaskStatus, StatusAction[]>> = {
  draft: [
    {
      toStatus: "open",
      label: "Publish Task",
      variant: "primary",
      confirm: {
        title: "Publish this task?",
        description:
          "The task becomes visible on the marketplace and students can start sending proposals.",
        confirmLabel: "Publish task",
      },
    },
    {
      toStatus: "cancelled",
      label: "Cancel",
      variant: "ghost",
      confirm: {
        title: "Cancel this draft?",
        description:
          "The draft is closed and can no longer be published. You can't undo this.",
        confirmLabel: "Cancel draft",
        variant: "destructive",
      },
    },
  ],
  open: [
    {
      toStatus: "cancelled",
      label: "Cancel Task",
      variant: "destructive",
      confirm: {
        title: "Cancel this task?",
        description:
          "The task is removed from the marketplace and every pending proposal is rejected — the students who applied are notified. You can't undo this.",
        confirmLabel: "Cancel task",
        variant: "destructive",
      },
    },
  ],
  submitted: [
    {
      toStatus: "client_review",
      label: "Start Review",
      variant: "primary",
    },
  ],
  client_review: [
    {
      toStatus: "completed",
      label: "Approve & Complete",
      variant: "primary",
      confirm: {
        title: "Approve this work?",
        description:
          "The task is marked complete and payment is released to the freelancer. You can't undo this.",
        confirmLabel: "Approve & complete",
      },
    },
    {
      toStatus: "disputed",
      label: "Raise Dispute",
      variant: "destructive",
      confirm: {
        title: "Raise a dispute?",
        description:
          "The submission is flagged for dispute resolution and the freelancer is notified.",
        confirmLabel: "Raise dispute",
        variant: "destructive",
      },
    },
  ],
};

/** Confirmation copy for deleting a draft (not a status transition). */
const DELETE_CONFIRM: ConfirmCopy = {
  title: "Delete this draft?",
  description:
    "The draft is permanently deleted. You can't undo this.",
  confirmLabel: "Delete draft",
  variant: "destructive",
};

// ─── Props ─────────────────────────────────────────────────────────

interface TaskActionsProps {
  taskId: string;
  status: TaskStatus;
}

// ─── Component ─────────────────────────────────────────────────────

/**
 * TaskActions — status-aware action panel for task owners.
 *
 * Pattern: useState + useTransition, same as TaskForm. Each button
 * submits a hidden FormData with taskId + target status to the
 * updateTaskStatus server action. Draft tasks also get a Delete
 * button that calls deleteTask (which redirects to the task list).
 *
 * Destructive and irreversible transitions route through ConfirmDialog
 * first. Because that dialog is async (unlike window.confirm), the
 * requested action is parked in `pending` until the user answers.
 */
/** The action awaiting confirmation, if any. */
type PendingAction =
  | { kind: "status"; action: StatusAction }
  | { kind: "delete" };

export function TaskActions({ taskId, status }: TaskActionsProps) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const actions = STATUS_ACTIONS[status];
  const canDelete = status === "draft";
  const isTerminal = ["completed", "cancelled", "disputed"].includes(status);

  // No actions available for this status
  if (!actions && !canDelete) {
    if (isTerminal) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-tertiary">
              This task is{" "}
              <span className="font-medium text-text-secondary">
                {status.replace("_", " ")}
              </span>
              . No further actions are available.
            </p>
          </CardContent>
        </Card>
      );
    }

    // in_progress — waiting for student
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-tertiary">
            Waiting for the freelancer to submit their work.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Submission-related statuses use reviewSubmission (sends notifications
  // to the student); everything else uses the generic updateTaskStatus.
  const REVIEW_STATUSES = new Set(["client_review", "completed", "disputed"]);

  // ── Execute ────────────────────────────────────────────────────
  //
  // These run only after confirmation (or immediately, for actions
  // that don't declare any confirm copy).

  function runStatusTransition(action: StatusAction) {
    const formData = new FormData();
    formData.set("taskId", taskId);
    formData.set("status", action.toStatus);

    const serverAction = REVIEW_STATUSES.has(action.toStatus)
      ? reviewSubmission
      : updateTaskStatus;

    startTransition(async () => {
      const actionResult = await serverAction(formData);
      setResult(actionResult);
      setPending(null);
      if (actionResult.success) {
        router.refresh();
      }
    });
  }

  function runDelete() {
    const formData = new FormData();
    formData.set("taskId", taskId);

    startTransition(async () => {
      const actionResult = await deleteTask(formData);
      // deleteTask redirects on success — we only land here on error
      setResult(actionResult);
      setPending(null);
    });
  }

  // ── Request ────────────────────────────────────────────────────
  //
  // Unlike window.confirm, the dialog is async: park the intent in
  // state and let the dialog's onConfirm call the runner above.

  function handleStatusTransition(action: StatusAction) {
    if (!action.confirm) {
      runStatusTransition(action);
      return;
    }
    setPending({ kind: "status", action });
  }

  function handleDelete() {
    setPending({ kind: "delete" });
  }

  function handleConfirm() {
    if (!pending) return;
    if (pending.kind === "delete") {
      runDelete();
    } else {
      runStatusTransition(pending.action);
    }
  }

  const confirmCopy =
    pending?.kind === "delete" ? DELETE_CONFIRM : pending?.action.confirm;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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

        {/* Status transition buttons */}
        {actions?.map((action) => (
          <Button
            key={action.toStatus}
            variant={action.variant}
            className="w-full"
            loading={isPending}
            onClick={() => handleStatusTransition(action)}
          >
            {action.label}
          </Button>
        ))}

        {/* Delete button (draft only) */}
        {canDelete && (
          <>
            <div className="border-t border-border-default pt-3">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                loading={isPending}
                onClick={handleDelete}
              >
                Delete Draft
              </Button>
            </div>
          </>
        )}
      </CardContent>

      {confirmCopy && (
        <ConfirmDialog
          open={pending !== null}
          onClose={() => setPending(null)}
          onConfirm={handleConfirm}
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          variant={confirmCopy.variant}
          loading={isPending}
        />
      )}
    </Card>
  );
}

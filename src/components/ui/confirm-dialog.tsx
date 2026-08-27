"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Props ────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  open: boolean;
  /** Requested close — Escape, backdrop, Cancel. Ignored while `loading`. */
  onClose: () => void;
  /** Runs when the user confirms. Parent keeps the dialog open until done. */
  onConfirm: () => void;
  title: string;
  /** What will happen, in plain terms. Spell out irreversible side effects. */
  description: string;
  /** Confirm button label. Name the action ("Cancel task"), never "OK". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** `destructive` for anything that deletes or cannot be undone. */
  variant?: "primary" | "destructive";
  /** Disables both buttons and shows a spinner on confirm. */
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * ConfirmDialog — accessible replacement for window.confirm().
 *
 * Built on the native <dialog> primitive, so focus trapping, backdrop,
 * and Escape handling come from the browser.
 *
 * ★ Focus starts on Cancel. The confirm button is the dangerous one,
 *   and a user holding Enter from the previous screen should not be
 *   able to delete a task by accident.
 *
 * ★ While `loading`, close requests are ignored — dismissing the
 *   dialog mid-flight would leave the user unsure whether the action
 *   actually ran.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  loading = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Move focus to the safe choice once the dialog is actually open.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button
          ref={cancelRef}
          variant="secondary"
          onClick={onClose}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
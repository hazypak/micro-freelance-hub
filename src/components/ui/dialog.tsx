"use client";

import {
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Dialog root ──────────────────────────────────────────────────

export interface DialogProps {
  /** Controls visibility. Parent owns this state. */
  open: boolean;
  /** Called when the user requests closing (Escape, backdrop click, X button). */
  onClose: () => void;
  /** Dialog content — typically DialogHeader + children + DialogFooter. */
  children: ReactNode;
  className?: string;
}

/**
 * Dialog — modal overlay using the native <dialog> element.
 *
 * Uses `.showModal()` for full accessibility: focus trap, backdrop,
 * Escape-to-close, and inert siblings — all free from the browser.
 *
 * The component is controlled: `open` + `onClose` live in the parent.
 * Closing is always requested (never forced), so the parent can run
 * exit animations or confirm before actually setting `open = false`.
 */
function Dialog({ open, onClose, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync the native dialog state with the React `open` prop
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // Handle the native `close` event (Escape key) → propagate to parent
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    const handleClose = () => onClose();
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [onClose]);

  // Backdrop click detection: click on <dialog> itself, not its content
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        // Reset native dialog styles
        "m-0 max-h-[85vh] w-[90vw] max-w-lg p-0",
        "rounded-xl border border-border-default bg-surface-elevated shadow-xl",
        // Backdrop
        "backdrop:bg-black/50 backdrop:backdrop-blur-sm",
        // Center
        "fixed inset-0",
        // Animation (respects prefers-reduced-motion via globals.css)
        "animate-in fade-in-0 zoom-in-95",
        className,
      )}
      onClick={handleBackdropClick}
    >
      <div className="relative flex flex-col overflow-y-auto p-6">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "absolute right-4 top-4 rounded-md p-1",
            "text-text-tertiary hover:text-text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            "transition-colors duration-fast",
          )}
          aria-label="Close dialog"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {children}
      </div>
    </dialog>
  );
}

// ─── Dialog header ────────────────────────────────────────────────

function DialogHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-4 flex flex-col gap-1.5 pr-8", className)}
      {...props}
    />
  );
}

// ─── Dialog title ─────────────────────────────────────────────────

function DialogTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold text-text-primary leading-tight",
        className,
      )}
      {...props}
    />
  );
}

// ─── Dialog description ───────────────────────────────────────────

function DialogDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-text-secondary", className)} {...props} />
  );
}

// ─── Dialog footer ────────────────────────────────────────────────

function DialogFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-6 flex items-center justify-end gap-3",
        className,
      )}
      {...props}
    />
  );
}

export { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter };

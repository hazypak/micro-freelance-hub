import { forwardRef, type TextareaHTMLAttributes, useId } from "react";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  description?: string;
  srOnlyLabel?: boolean;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * Textarea — multi-line text input with label + error wiring.
 *
 * Same accessibility pattern as Input: auto-generated IDs link
 * the label, error, and description for screen readers.
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, label, error, description, srOnlyLabel, id, ...props },
    ref,
  ) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const descId = `${inputId}-desc`;

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          className={cn(
            "block text-sm font-medium text-text-primary",
            srOnlyLabel && "sr-only",
          )}
        >
          {label}
        </label>

        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "block w-full rounded-lg border bg-surface px-3 py-2",
            "text-sm text-text-primary placeholder:text-text-tertiary",
            "transition-colors duration-fast",
            "focus:outline-none focus:ring-2 focus:ring-offset-1",
            "min-h-[5rem] resize-y",
            error
              ? "border-error-500 focus:ring-error-500"
              : "border-border-default focus:border-brand-500 focus:ring-brand-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [error && errorId, description && descId]
              .filter(Boolean)
              .join(" ") || undefined
          }
          {...props}
        />

        {error && (
          <p id={errorId} className="text-sm text-error-600" role="alert">
            {error}
          </p>
        )}

        {!error && description && (
          <p id={descId} className="text-sm text-text-tertiary">
            {description}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };

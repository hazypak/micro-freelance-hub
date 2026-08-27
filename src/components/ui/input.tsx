import { forwardRef, type InputHTMLAttributes, useId } from "react";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Visible label text. Always required for accessibility. */
  label: string;
  /** Validation error message — triggers error styling. */
  error?: string;
  /** Helper text shown below the input when there's no error. */
  description?: string;
  /** Visually hides the label (still announced by screen readers). */
  srOnlyLabel?: boolean;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * Input — accessible text input with integrated label + error.
 *
 * The label, input, error, and description are wired together via
 * auto-generated IDs so screen readers announce them as a group.
 * Setting `error` switches styling and adds aria-invalid.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
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

        <input
          ref={ref}
          id={inputId}
          className={cn(
            "block w-full rounded-lg border bg-surface px-3 py-2",
            "text-sm text-text-primary placeholder:text-text-tertiary",
            "transition-colors duration-fast",
            "focus:outline-none focus:ring-2 focus:ring-offset-1",
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

Input.displayName = "Input";

export { Input };

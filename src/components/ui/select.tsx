import { forwardRef, type SelectHTMLAttributes, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  description?: string;
  srOnlyLabel?: boolean;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * Select — native <select> with consistent styling and label wiring.
 *
 * Uses the native element (not a custom listbox) so keyboard, touch,
 * and assistive-tech behaviour is free. The chevron icon is layered
 * on top via a wrapper div — pointer-events-none lets clicks pass
 * through to the <select>.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, error, description, srOnlyLabel, id, children, ...props },
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

        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={cn(
              "block w-full appearance-none rounded-lg border bg-surface px-3 py-2 pr-10",
              "text-sm text-text-primary",
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
          >
            {children}
          </select>

          {/* Chevron indicator — purely decorative */}
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            size={16}
            aria-hidden="true"
          />
        </div>

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

Select.displayName = "Select";

export { Select };

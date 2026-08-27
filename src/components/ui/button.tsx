import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Variant maps ─────────────────────────────────────────────────

const variants = {
  primary:
    "bg-brand-600 text-text-inverse hover:bg-brand-700 active:bg-brand-800 focus-visible:ring-brand-500",
  secondary:
    "bg-surface border border-border-default text-text-primary hover:bg-surface-secondary active:bg-surface-tertiary",
  ghost:
    "text-text-secondary hover:bg-surface-secondary hover:text-text-primary active:bg-surface-tertiary",
  destructive:
    "bg-error-600 text-text-inverse hover:bg-error-700 active:bg-error-700",
  link: "text-brand-600 underline-offset-4 hover:underline p-0 h-auto",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-6 text-base gap-2.5 rounded-lg",
  icon: "h-10 w-10 rounded-lg justify-center",
} as const;

// ─── Props ────────────────────────────────────────────────────────

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * Button — the primary interactive element.
 *
 * Supports loading state (disables + shows spinner), variant + size
 * system, and full className override via cn().
 *
 * Uses forwardRef so it works with form libraries, tooltips, and
 * any component that needs a DOM ref.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles shared across all variants
          "inline-flex items-center justify-center font-medium",
          "transition-colors duration-base",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <Loader2
            className="animate-spin shrink-0"
            size={size === "sm" ? 14 : 16}
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button };

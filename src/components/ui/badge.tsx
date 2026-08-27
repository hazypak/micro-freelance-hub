import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ─── Variant maps ─────────────────────────────────────────────────

const variants = {
  // Semantic status
  default: "bg-surface-tertiary text-text-primary",
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  error: "bg-error-100 text-error-700",
  info: "bg-info-100 text-brand-700",

  // Contextual
  brand: "bg-brand-100 text-brand-700",
  outline: "border border-border-default text-text-secondary bg-transparent",
} as const;

// ─── Props ────────────────────────────────────────────────────────

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * Badge — small label for status, category, skill, or tag display.
 *
 * Renders as an inline <span> so it flows naturally in text, card
 * headers, and lists. No interactive behaviour — if you need a
 * removable badge, wrap it and add a button.
 */
function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5",
        "text-xs font-medium whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };

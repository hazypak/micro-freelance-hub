import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────

export interface EmptyStateProps {
  /** Lucide icon component to render. */
  icon: LucideIcon;
  /** Primary message — brief, descriptive. */
  title: string;
  /** Optional secondary text — explains what the user can do. */
  description?: string;
  /** Optional action slot — typically a <Button>. */
  action?: ReactNode;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * EmptyState — centered placeholder for empty lists and search results.
 *
 * Composed of three optional tiers: icon → title → description → action.
 * The icon uses `text-text-tertiary` so it feels subtle, not alarming.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-center",
        className,
      )}
    >
      <Icon className="text-text-tertiary" size={48} strokeWidth={1.5} aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-base font-medium text-text-primary">{title}</p>
        {description && (
          <p className="text-sm text-text-secondary max-w-sm">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export { EmptyState };

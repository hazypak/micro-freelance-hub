import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────

export interface PageHeaderProps {
  /** Page title — rendered as <h1>. */
  title: string;
  /** Optional subtitle below the title. */
  description?: string;
  /** Optional action slot (right side) — typically a Button. */
  action?: ReactNode;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * PageHeader — consistent page-level heading with optional action.
 *
 * Renders an <h1> so every protected page automatically satisfies
 * the "one h1 per page" WCAG best-practice. The action slot sits
 * on the right for desktop and wraps below on mobile.
 */
function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
        "mb-8",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        )}
      </div>

      {action && <div className="mt-3 shrink-0 sm:mt-0">{action}</div>}
    </div>
  );
}

export { PageHeader };

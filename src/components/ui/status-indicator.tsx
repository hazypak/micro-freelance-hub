import { Badge } from "./badge";

// ─── Task lifecycle status config ─────────────────────────────────

/**
 * Maps each task status to a human-readable label and a Badge variant.
 *
 * This is the single source of truth for how statuses are displayed
 * across the entire UI — task cards, detail pages, admin views.
 */
const statusConfig = {
  draft: { label: "Draft", variant: "outline" },
  open: { label: "Open", variant: "info" },
  in_progress: { label: "In Progress", variant: "brand" },
  submitted: { label: "Submitted", variant: "warning" },
  ai_review: { label: "AI Review", variant: "warning" },
  client_review: { label: "Client Review", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "default" },
  disputed: { label: "Disputed", variant: "error" },
} as const;

export type TaskStatus = keyof typeof statusConfig;

// ─── Props ────────────────────────────────────────────────────────

export interface StatusIndicatorProps {
  status: TaskStatus;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * StatusIndicator — renders the appropriate Badge for a task status.
 *
 * Wraps <Badge> and maps TaskStatus → variant + label, so consumers
 * never have to think about status display logic.
 */
function StatusIndicator({ status, className }: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant as Parameters<typeof Badge>[0]["variant"]}
      className={className}
    >
      {config.label}
    </Badge>
  );
}

export { StatusIndicator, statusConfig };

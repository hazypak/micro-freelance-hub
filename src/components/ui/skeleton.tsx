import { cn } from "@/lib/utils";

// ─── Component ────────────────────────────────────────────────────

/**
 * Skeleton — a pulsing placeholder that signals "content is loading."
 *
 * Apply dimensions via className: `<Skeleton className="h-4 w-48" />`
 *
 * The pulse animation respects `prefers-reduced-motion` via the
 * global CSS rule that zeroes animation durations.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-tertiary", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };

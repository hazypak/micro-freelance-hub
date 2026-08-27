import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ─── Card root ────────────────────────────────────────────────────

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-border-default bg-surface-elevated",
        "shadow-sm transition-shadow duration-base",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

// ─── Card header ──────────────────────────────────────────────────

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5 p-5 pb-0", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

// ─── Card title ───────────────────────────────────────────────────

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold text-text-primary leading-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

// ─── Card description ─────────────────────────────────────────────

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-text-secondary", className)}
      {...props}
    />
  ),
);
CardDescription.displayName = "CardDescription";

// ─── Card content ─────────────────────────────────────────────────

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

// ─── Card footer ──────────────────────────────────────────────────

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 border-t border-border-default p-5",
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };

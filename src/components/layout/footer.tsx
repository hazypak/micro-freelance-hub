import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────

export interface FooterProps {
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────

/**
 * Footer — site-wide footer with links and legal line.
 *
 * Renders inside the authenticated layout. Uses semantic <footer>
 * landmark so screen-reader users can jump directly to it.
 */
function Footer({ className }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "border-t border-border-default bg-surface-sunken",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        {/* Links */}
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Footer">
          <FooterLink href="/privacy">Privacy</FooterLink>
          <FooterLink href="/terms">Terms</FooterLink>
          <FooterLink href="/ticker">Browse Tasks</FooterLink>
        </nav>

        {/* Copyright */}
        <p className="text-xs text-text-tertiary">
          &copy; {year} GigBridge. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/** Internal helper — consistent footer link styling. */
function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-sm text-text-secondary",
        "hover:text-text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        "rounded transition-colors duration-fast",
      )}
    >
      {children}
    </Link>
  );
}

export { Footer };

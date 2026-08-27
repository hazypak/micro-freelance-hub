import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";

// ─── Layout ──────────────────────────────────────────────────────

/**
 * Protected layout — wraps all authenticated pages.
 *
 * Calls requireAuth() which validates the JWT server-side and
 * redirects to /login if the user isn't authenticated.
 *
 * Shows role-aware navigation with design-token–based styling.
 * The proxy.ts handles the initial session check for routing UX,
 * but this layout does the real security verification via getUser().
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role } = await requireAuth();

  // ── Fetch recent notifications (server-side) ──────────────────
  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, message, link, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const notifItems = notifications ?? [];
  const unreadCount = notifItems.filter((n) => !n.read).length;

  /** Map role to a Badge variant for visual distinction. */
  const roleBadgeVariant = {
    student: "brand",
    business: "info",
    admin: "warning",
  } as const;

  return (
    <div className="flex min-h-full flex-col">
      {/* ── Top nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border-default bg-surface/95 backdrop-blur-sm supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/dashboard"
            className={cn(
              "text-lg font-bold tracking-tight text-text-primary",
              "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
            )}
          >
            Gig
            <span className="text-brand-600">Bridge</span>
          </Link>

          {/* Desktop navigation */}
          <nav
            className="hidden items-center gap-1 sm:flex"
            aria-label="Main"
          >
            <NavLink href="/dashboard">Dashboard</NavLink>

            {/* Student-specific links */}
            {role === "student" && (
              <>
                <NavLink href="/ticker">Browse Tasks</NavLink>
                <NavLink href="/dashboard/proposals">My Proposals</NavLink>
                <NavLink href="/dashboard/deliverables">Deliverables</NavLink>
              </>
            )}

            {/* Business-specific links */}
            {role === "business" && (
              <>
                <NavLink href="/dashboard/tasks">My Tasks</NavLink>
                <NavLink href="/dashboard/tasks/new">Post Task</NavLink>
              </>
            )}

            {/* Admin-specific links */}
            {role === "admin" && (
              <NavLink href="/dashboard/admin">Admin</NavLink>
            )}
          </nav>

          {/* User menu */}
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-text-tertiary sm:inline">
              {user.email}
            </span>

            <Badge variant={roleBadgeVariant[role] ?? "default"}>
              {role}
            </Badge>

            <NotificationBell
              notifications={notifItems}
              unreadCount={unreadCount}
            />

            <form action={signOut}>
              <button
                type="submit"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                  "transition-colors duration-fast",
                )}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Mobile nav — horizontal scroll bar */}
        <nav
          className="flex items-center gap-1 overflow-x-auto border-t border-border-subtle px-4 sm:hidden"
          aria-label="Mobile"
        >
          <MobileNavLink href="/dashboard">Dashboard</MobileNavLink>

          {role === "student" && (
            <>
              <MobileNavLink href="/ticker">Tasks</MobileNavLink>
              <MobileNavLink href="/dashboard/proposals">
                Proposals
              </MobileNavLink>
              <MobileNavLink href="/dashboard/deliverables">
                Deliverables
              </MobileNavLink>
            </>
          )}

          {role === "business" && (
            <>
              <MobileNavLink href="/dashboard/tasks">Tasks</MobileNavLink>
              <MobileNavLink href="/dashboard/tasks/new">Post</MobileNavLink>
            </>
          )}
        </nav>
      </header>

      {/* ── Page content ────────────────────────────────────── */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}

// ─── NavLink helpers ─────────────────────────────────────────────

/** Desktop nav link — rounded pill-style hover. */
function NavLink({
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
        "rounded-lg px-3 py-2 text-sm font-medium",
        "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        "transition-colors duration-fast",
      )}
    >
      {children}
    </Link>
  );
}

/** Mobile nav link — bottom-border style in horizontal scroll bar. */
function MobileNavLink({
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
        "whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium",
        "text-text-secondary hover:border-brand-300 hover:text-text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        "transition-colors duration-fast",
      )}
    >
      {children}
    </Link>
  );
}

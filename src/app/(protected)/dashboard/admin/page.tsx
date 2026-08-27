import { ShieldAlert } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

// ─── Metadata ──────────────────────────────────────────────────────

// Plain "Admin" — root layout appends " · GigBridge" via title.template.
export const metadata = {
  title: "Admin",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /dashboard/admin — admin-only landing page.
 *
 * ★ Two layers of access control, same pattern as /dashboard/tasks/[id]/edit:
 *   the page guard keeps a non-admin from ever seeing the route, and any
 *   future admin actions re-check the role server-side on submit. Until
 *   the second layer exists (real admin actions), this page is just a
 *   landing — it doesn't claim capabilities the prototype doesn't have.
 *
 * The role can be granted only by SQL update — signup intentionally does
 * not offer it. So this page is reached by someone who was promoted out
 * of band; the placeholder is honest about that.
 */
export default async function AdminPage() {
  await requireRole("admin");

  return (
    <>
      <PageHeader
        title="Admin"
        description="Operator tools for the GigBridge prototype."
      />

      <EmptyState
        icon={ShieldAlert}
        title="Admin tools aren't built yet"
        description="This area is reserved for operator actions — listing all users, moderating reports, inspecting stuck tasks. It will be filled in once those features are scoped."
      />
    </>
  );
}
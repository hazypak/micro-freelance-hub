import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

/**
 * Auth guard result — the verified user and their profile role.
 *
 * Use destructuring: `const { user, role } = await requireAuth()`
 */
export interface AuthContext {
  user: { id: string; email: string };
  role: UserRole;
  onboardingCompleted: boolean;
}

/**
 * Require an authenticated user. Redirects to /login if not authenticated.
 *
 * ⚠️ SECURITY: This calls getUser() which validates the JWT server-side.
 * Do NOT replace with getSession() — that only reads the local token
 * without verification and is NOT a security boundary.
 *
 * Call this at the top of every server action and protected server component.
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Fetch role from database — never trust JWT claims for authorization
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // User exists in auth but has no profile — likely a race condition
    // during signup. The trigger should have created it, but handle
    // gracefully by redirecting to a safe state.
    redirect("/login");
  }

  return {
    user: { id: user.id, email: user.email ?? "" },
    role: profile.role,
    onboardingCompleted: profile.onboarding_completed,
  };
}

/**
 * Require a specific role. Redirects to /dashboard if role doesn't match.
 *
 * Usage:
 *   const { user } = await requireRole("business");
 *   // user is guaranteed to be authenticated AND have the business role
 */
export async function requireRole(
  ...allowedRoles: UserRole[]
): Promise<AuthContext> {
  const auth = await requireAuth();

  if (!allowedRoles.includes(auth.role)) {
    // User is authenticated but wrong role — send to their dashboard
    // instead of showing a 403 (friendlier UX)
    redirect("/dashboard");
  }

  return auth;
}

/**
 * Require that onboarding is completed. Redirects to /onboarding if not.
 *
 * Usage in dashboard pages:
 *   const { user, role } = await requireOnboarded();
 */
export async function requireOnboarded(): Promise<AuthContext> {
  const auth = await requireAuth();

  if (!auth.onboardingCompleted) {
    redirect("/onboarding");
  }

  return auth;
}

/**
 * Get the current user without redirecting.
 * Returns null if not authenticated.
 *
 * Useful for pages that work both authenticated and unauthenticated
 * (e.g., the landing page showing different CTAs).
 */
export async function getOptionalAuth(): Promise<AuthContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    user: { id: user.id, email: user.email ?? "" },
    role: profile.role,
    onboardingCompleted: profile.onboarding_completed,
  };
}

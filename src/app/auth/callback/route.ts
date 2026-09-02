import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientEnv } from "@/lib/validation/env";

/**
 * Auth callback handler — processes email confirmations, OAuth logins,
 * and password resets.
 *
 * Supabase Auth sends users here after they click a link in their email
 * OR after they authorize via Google OAuth. The URL contains a `code`
 * parameter that we exchange for a session.
 *
 * This is a Route Handler (not a server action) because Supabase redirects
 * here via GET from the user's email client or OAuth provider.
 *
 * ★ Security (audit finding #7): redirect targets are built against the
 *   configured NEXT_PUBLIC_SITE_URL, never `request.nextUrl.origin`.
 *   `origin` is derived from the incoming Host header, which a caller
 *   controls — so an attacker could send a victim a callback link with a
 *   spoofed Host and have us bounce them to a look-alike domain carrying
 *   a freshly-minted session. Pinning to the configured site URL means
 *   the destination is fixed at deploy time and cannot be influenced by
 *   the request.
 */
/**
 * Validate that a redirect target is a safe same-origin relative path.
 *
 * An attacker could set the "redirect" parameter to "//evil.com"
 * (protocol-relative) or "/\/evil.com" (backslash-prefixed) which
 * browsers resolve off-origin. We only allow paths that start with "/"
 * but NOT "//" or "/\" (which browsers resolve off-origin).
 */
function isSafeRedirect(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const { NEXT_PUBLIC_SITE_URL: siteUrl } = getClientEnv();

  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const redirectParam = searchParams.get("redirect");

  // Validate the redirect param once — reject unsafe values early
  const safeRedirect = redirectParam && isSafeRedirect(redirectParam)
    ? redirectParam
    : null;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password reset — send to a password update page
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/settings", siteUrl));
      }

      // For OAuth and email confirmations: ensure the user has a profile.
      // OAuth users (Google) may not have one yet since the signup trigger
      // only fires for email+password auth. We create a minimal profile
      // from the OAuth metadata.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const admin = createAdminClient();
        const { data: profile } = await admin
          .from("profiles")
          .select("role, onboarding_completed")
          .eq("id", user.id)
          .single();

        if (!profile) {
          // Create a minimal profile for OAuth users
          const fullName =
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            user.email?.split("@")[0] ??
            "User";

          await admin.from("profiles").insert({
            id: user.id,
            full_name: fullName,
            role: "student",
            onboarding_completed: false,
          });

          // Redirect to onboarding — only carry the redirect param if it's safe
          const onboardingUrl = new URL("/onboarding", siteUrl);
          if (safeRedirect) {
            onboardingUrl.searchParams.set("redirect", safeRedirect);
          }
          return NextResponse.redirect(onboardingUrl);
        }

        if (!profile.onboarding_completed) {
          const onboardingUrl = new URL("/onboarding", siteUrl);
          if (safeRedirect) {
            onboardingUrl.searchParams.set("redirect", safeRedirect);
          }
          return NextResponse.redirect(onboardingUrl);
        }
      }

      // Redirect to the intended page, or dashboard
      if (safeRedirect) {
        return NextResponse.redirect(new URL(safeRedirect, siteUrl));
      }
      return NextResponse.redirect(new URL("/dashboard", siteUrl));
    }
  }

  // If code exchange failed or no code present, redirect to login with error
  const loginUrl = new URL("/login", siteUrl);
  loginUrl.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(loginUrl);
}
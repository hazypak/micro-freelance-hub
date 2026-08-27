import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientEnv } from "@/lib/validation/env";

/**
 * Auth callback handler — processes email confirmations and password resets.
 *
 * Supabase Auth sends users here after they click a link in their email.
 * The URL contains a `code` parameter that we exchange for a session.
 *
 * This is a Route Handler (not a server action) because Supabase redirects
 * here via GET from the user's email client.
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
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const { NEXT_PUBLIC_SITE_URL: siteUrl } = getClientEnv();

  const code = searchParams.get("code");
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Route based on the callback type
      if (type === "recovery") {
        // Password reset — send to a password update page
        // For MVP, redirect to settings where they can update their password
        return NextResponse.redirect(new URL("/settings", siteUrl));
      }

      // Email confirmation — send to onboarding or dashboard
      return NextResponse.redirect(new URL("/dashboard", siteUrl));
    }
  }

  // If code exchange failed or no code present, redirect to login with error
  const loginUrl = new URL("/login", siteUrl);
  loginUrl.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(loginUrl);
}

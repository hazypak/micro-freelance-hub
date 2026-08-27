import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback handler — processes email confirmations and password resets.
 *
 * Supabase Auth sends users here after they click a link in their email.
 * The URL contains a `code` parameter that we exchange for a session.
 *
 * This is a Route Handler (not a server action) because Supabase redirects
 * here via GET from the user's email client.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

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
        return NextResponse.redirect(new URL("/settings", origin));
      }

      // Email confirmation — send to onboarding or dashboard
      return NextResponse.redirect(new URL("/dashboard", origin));
    }
  }

  // If code exchange failed or no code present, redirect to login with error
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(loginUrl);
}

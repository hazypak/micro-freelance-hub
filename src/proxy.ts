import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 Proxy — route-level gate for UX convenience.
 *
 * ⚠️ SECURITY: This is NOT a security boundary.
 * Every server action / route handler MUST independently verify auth
 * and role via guards.ts. The proxy only redirects for better UX.
 *
 * What it does:
 * 1. Refreshes Supabase auth tokens on every navigation
 * 2. Redirects unauthenticated users away from /dashboard, /onboarding
 * 3. Redirects authenticated users away from /login, /signup
 * 4. Redirects users who haven't completed onboarding to /onboarding
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create a response that we can modify (add refreshed cookies)
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create a Supabase client that reads/writes cookies on the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          // Also set cookies on the response (for the browser)
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the session — this updates cookies if the token was refreshed.
  // We deliberately do NOT await getUser() here because getSession() is
  // cheaper and sufficient for routing decisions. Actual auth verification
  // happens in guards.ts via getUser().
  const sessionPromise = supabase.auth.getSession();

  return sessionPromise.then(({ data: { session } }) => {
    const isAuthenticated = !!session;

    // ── Auth pages: redirect authenticated users to dashboard ──
    const isAuthRoute =
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/forgot-password");

    if (isAuthRoute && isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // ── Protected pages: redirect unauthenticated users to login ──
    const isProtectedRoute =
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/settings");

    if (isProtectedRoute && !isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // ── Onboarding gate: check profile completion ──
    // Skip this check for the onboarding page itself and API routes
    if (
      isAuthenticated &&
      pathname.startsWith("/dashboard") &&
      session?.user
    ) {
      // We check onboarding status via a lightweight profile query.
      // This adds one DB call per navigation to /dashboard/* routes.
      // In production, consider caching this in a cookie or session metadata.
      return supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", session.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile && !profile.onboarding_completed) {
            return NextResponse.redirect(
              new URL("/onboarding", request.url)
            );
          }
          return response;
        });
    }

    return response;
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

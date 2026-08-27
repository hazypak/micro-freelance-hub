import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

// ─── Metadata ──────────────────────────────────────────────────────

// ★ No `metadata` export: the home page is the ONE place where the root
//   layout's `title.default` ("GigBridge — Student Micro-Freelance Hub")
//   is meant to fire. Every other page overrides via `title.template`.

// ─── Page ──────────────────────────────────────────────────────────

/**
 * / — public landing page.
 *
 * ★ Two audiences, one file. An anon visitor needs enough context to
 *   decide whether to sign up; a signed-in user hitting `/` (bookmark,
 *   logo click, etc.) just wants back to work. Rather than making the
 *   authed user read the pitch every time, we redirect them straight to
 *   /dashboard. The check uses `getUser()` (validates the JWT) — not
 *   `getSession()` which would trust the cookie blindly.
 *
 * ★ Copy tone deliberately matches the LegalSection prose on /privacy
 *   and /terms: short, calm, no marketing verbs. The prototype notice
 *   is the same claim as PrototypeNotice, compressed into one line — a
 *   visitor deciding whether to sign up should learn immediately that
 *   no money moves through the site.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already signed in → back to work.
  if (user) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-lg text-center">
        {/* Wordmark — small, subordinate to the tagline. */}
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          GigBridge
        </p>

        {/* Tagline — the one line a visitor is most likely to remember. */}
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
          Small tasks. Student hands.
        </h1>

        <p className="mt-5 text-base leading-relaxed text-text-secondary">
          A marketplace where businesses post short freelance work and
          students propose to do it. Post, propose, award, submit,
          review — end to end.
        </p>

        {/*
          ★ Honest disclaimer, not marketing fluff. The PrototypeNotice
          on /privacy and /terms makes the same point in more detail;
          this compressed version is here so a first-time visitor knows
          before they click "Create an account".
        */}
        <p className="mt-6 text-sm text-text-tertiary">
          This is a student prototype. It does not process payments.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/signup">
            <Button size="lg" className="w-full sm:w-auto">
              Create an account
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="ghost" className="w-full sm:w-auto">
              Sign in
            </Button>
          </Link>
        </div>

        {/* Foot links — small, muted, easy to reach but not competing with CTAs. */}
        <div className="mt-14 flex justify-center gap-6 text-sm text-text-tertiary">
          <Link
            href="/privacy"
            className="underline-offset-2 hover:text-text-secondary hover:underline"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="underline-offset-2 hover:text-text-secondary hover:underline"
          >
            Terms
          </Link>
        </div>
      </div>
    </main>
  );
}

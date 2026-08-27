import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

// ─── Metadata ──────────────────────────────────────────────────────

// Bare title — root layout appends " · GigBridge" via title.template.
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your GigBridge account.",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /login — server shell around the interactive form.
 *
 * The form itself is a client component (needs `useTransition` to keep
 * a pending state while the server action runs). This shell exists so
 * `searchParams` can be forwarded as a Promise and the sign-up link
 * can be plain server-rendered markup.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  return (
    <>
      <h2 className="text-lg font-semibold text-text-primary">
        Sign in to your account
      </h2>

      <LoginForm searchParamsPromise={searchParams} />

      <p className="mt-6 text-center text-sm text-text-secondary">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="rounded font-medium text-brand-600 hover:text-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          Sign up
        </Link>
      </p>
    </>
  );
}

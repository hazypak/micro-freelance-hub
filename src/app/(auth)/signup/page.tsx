import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./signup-form";

// ─── Metadata ──────────────────────────────────────────────────────

// Bare title — root layout appends " · GigBridge".
export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your GigBridge account.",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /signup — server shell around the role + credentials form.
 *
 * Role selection (student / business) happens in the client form
 * because it's stateful; there's no need for `useSearchParams` here,
 * so the shell stays props-free.
 */
export default function SignUpPage() {
  return (
    <>
      <h2 className="text-lg font-semibold text-text-primary">
        Create your account
      </h2>

      <SignUpForm />

      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link
          href="/login"
          className="rounded font-medium text-brand-600 hover:text-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}

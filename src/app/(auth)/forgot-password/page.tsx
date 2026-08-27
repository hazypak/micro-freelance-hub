import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

// ─── Metadata ──────────────────────────────────────────────────────

// Bare title — root appends " · GigBridge".
export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset your GigBridge password.",
};

// ─── Page ──────────────────────────────────────────────────────────

/**
 * /forgot-password — server shell around the recovery-email form.
 *
 * The form sends a Supabase Auth recovery email and always renders a
 * success state, regardless of whether the address matches an
 * existing user — see the form for why (enumeration).
 */
export default function ForgotPasswordPage() {
  return (
    <>
      <h2 className="text-lg font-semibold text-text-primary">
        Reset your password
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Enter your email and we&apos;ll send you a link to reset your
        password.
      </p>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-sm text-text-secondary">
        Remember your password?{" "}
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

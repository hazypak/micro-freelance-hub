import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Mail, ArrowRight } from "lucide-react";

/**
 * /check-email — post-signup confirmation page.
 *
 * Shown after a successful signup to tell the user they need to verify
 * their email before they can sign in. If the user is already signed in
 * (session exists), redirect to dashboard instead.
 */
export const metadata: Metadata = {
  title: "Check your email",
  description: "Verify your email address to activate your GigBridge account.",
};

export default async function CheckEmailPage() {
  // If somehow already authenticated, skip the roadblock
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <>
      {/* ── Illustration ── */}
      <div className="flex justify-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-100">
          <Mail className="h-10 w-10 text-brand-600" aria-hidden="true" />
          {/* Little bounce dot */}
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-success-500 text-[10px] font-bold text-white shadow-sm">
            ✉
          </span>
        </div>
      </div>

      {/* ── Heading ── */}
      <div className="mt-6 text-center">
        <h2 className="text-xl font-bold text-text-primary">
          Almost there!
        </h2>
        <p className="mt-2 text-sm text-text-secondary leading-relaxed">
          We sent an activation link to your inbox.{" "}
          <span className="font-medium text-text-primary">
            Check your Gmail
          </span>{" "}
          (or spam folder) and click the link to activate your account.
        </p>
      </div>

      {/* ── Tips card ── */}
      <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
        <p className="font-medium">💡 Can&apos;t find the email?</p>
        <ul className="mt-2 space-y-1.5 text-brand-700">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">🔍</span>
            <span>
              Search for <strong>GigBridge</strong> or{" "}
              <strong>activation</strong> in your inbox
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">📁</span>
            <span>Check your <strong>Spam</strong> or <strong>Promotions</strong> folder</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">⏳</span>
            <span>
              It may take a <strong>minute or two</strong> to arrive
            </span>
          </li>
        </ul>
      </div>

      {/* ── Resend hint ── */}
      <p className="mt-6 text-center text-xs text-text-tertiary">
        Didn&apos;t receive anything?{" "}
        <Link
          href="/login"
          className="font-medium text-brand-600 hover:text-brand-500"
        >
          Try signing in anyway
        </Link>{" "}
        — most providers let you resend the confirmation.
      </p>

      {/* ── CTA ── */}
      <div className="mt-6">
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          Go to sign in
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
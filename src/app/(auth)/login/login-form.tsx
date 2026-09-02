"use client";

import { use, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TurnstileWidget } from "@/components/ui/turnstile";
import { signIn, signInWithGoogle, type ActionResult } from "@/lib/auth/actions";

/**
 * Login form — client component; needs interactive pending state.
 *
 * ★ Uses `useTransition` around the direct `signIn(formData)` call
 *   instead of `<form action>`. The action redirects on success, so we
 *   only get a return value on failure — and we need it, to render the
 *   error banner. `useFormStatus` would give us the pending flag but
 *   throw the returned error on the floor.
 *
 * ★ Two error surfaces, one banner. `signIn` returns an ActionResult
 *   for submit-time failures ("Invalid credentials"); the callback
 *   route sets `?error=auth_callback_failed` for stale magic links.
 *   Both are folded into one `role="alert"` box so a screen reader
 *   hears the reason exactly once, whichever path produced it.
 */
export function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ redirect?: string; error?: string }>;
}) {
  const searchParams = use(searchParamsPromise);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, startGoogleTransition] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const callbackError = searchParams.error;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Carry the ?redirect param through so the action can honor it.
    if (searchParams.redirect) {
      formData.set("redirect", searchParams.redirect);
    }

    // Attach the Turnstile token — the server action verifies it.
    if (turnstileToken) {
      formData.set("cf-turnstile-response", turnstileToken);
    }

    startTransition(async () => {
      const actionResult = await signIn(formData);
      // signIn redirects on success — we only land here on failure.
      setResult(actionResult);
    });
  }

  function handleTurnstileExpire() {
    setTurnstileToken(null);
  }

  function handleGoogleSignIn() {
    startGoogleTransition(async () => {
      const result = await signInWithGoogle(searchParams.redirect);
      if ("url" in result) {
        window.location.href = result.url;
      } else {
        setResult(result);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      {(result?.error || callbackError) && (
        <div
          role="alert"
          className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700"
        >
          {result?.error ||
            (callbackError === "auth_callback_failed"
              ? "The sign-in link has expired or is invalid. Please try again."
              : "An error occurred. Please try again.")}
        </div>
      )}

      <Input
        id="email"
        name="email"
        type="email"
        label="Email address"
        autoComplete="email"
        required
        placeholder="you@example.com"
        disabled={isPending}
      />

      {/*
        Password label needs a "Forgot password?" link next to it, so
        the label row is a manual header instead of the Input's built-in
        label. `srOnlyLabel` keeps the accessible label wired through
        the Input's own htmlFor plumbing.
      */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-text-primary"
          >
            Password
          </label>
          <Link
            href="/forgot-password"
            className="rounded text-xs font-medium text-brand-600 hover:text-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          srOnlyLabel
          autoComplete="current-password"
          required
          placeholder="••••••••"
          disabled={isPending}
        />
      </div>

      {/* ── Turnstile CAPTCHA ── */}
      <TurnstileWidget
        onToken={(token) => setTurnstileToken(token)}
        onExpire={handleTurnstileExpire}
      />

      <Button
        type="submit"
        loading={isPending}
        disabled={!turnstileToken}
        className="w-full"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      {/* ── Divider ── */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-default" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-surface px-2 text-text-tertiary">
            or continue with
          </span>
        </div>
      </div>

      {/* ── Google OAuth ── */}
      <Button
        type="button"
        variant="secondary"
        onClick={handleGoogleSignIn}
        loading={isGooglePending}
        className="w-full"
      >
        <GoogleLogo />
        {isGooglePending ? "Redirecting…" : "Continue with Google"}
      </Button>
    </form>
  );
}

// ─── Google Logo SVG ─────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

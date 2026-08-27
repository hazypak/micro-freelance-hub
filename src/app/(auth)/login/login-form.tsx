"use client";

import { use, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, type ActionResult } from "@/lib/auth/actions";

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

  const callbackError = searchParams.error;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Carry the ?redirect param through so the action can honor it.
    if (searchParams.redirect) {
      formData.set("redirect", searchParams.redirect);
    }

    startTransition(async () => {
      const actionResult = await signIn(formData);
      // signIn redirects on success — we only land here on failure.
      setResult(actionResult);
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

      <Button type="submit" loading={isPending} className="w-full">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

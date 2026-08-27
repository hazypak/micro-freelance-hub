"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPassword, type ActionResult } from "@/lib/auth/actions";

/**
 * Forgot-password form — asks Supabase to send a recovery email.
 *
 * ★ Always renders the same success state, whether or not the address
 *   matched a real account. Returning "no such user" would let an
 *   attacker enumerate emails — the whole point of the recovery flow
 *   is that the honest signal only reaches the account holder's inbox.
 *   `forgotPassword` on the server side already answers uniformly; we
 *   just have to render uniformly too.
 */
export function ForgotPasswordForm() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const actionResult = await forgotPassword(formData);
      setResult(actionResult);
    });
  }

  if (result?.success) {
    return (
      <div className="mt-6 rounded-lg border border-success-200 bg-success-50 px-4 py-5 text-center">
        <Mail
          className="mx-auto h-8 w-8 text-success-600"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm font-medium text-success-800">
          {result.message}
        </p>
        <p className="mt-1 text-xs text-success-700">
          Didn&apos;t receive the email? Check your spam folder.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      {result?.error && (
        <div
          role="alert"
          className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700"
        >
          {result.error}
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

      <Button type="submit" loading={isPending} className="w-full">
        {isPending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

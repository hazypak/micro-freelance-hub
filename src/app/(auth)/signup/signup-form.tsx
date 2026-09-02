"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TurnstileWidget } from "@/components/ui/turnstile";
import { signUp, signInWithGoogle, type ActionResult } from "@/lib/auth/actions";

// ─── Roles ────────────────────────────────────────────────────────

// Two roles at signup — "admin" is intentionally not selectable here
// (only granted via SQL update out of band). The auth actions
// validator enforces the same restriction, so a hand-crafted POST
// can't sneak it in either.
const ROLES = [
  {
    value: "student" as const,
    label: "Student",
    description: "Find tasks and build your portfolio.",
  },
  {
    value: "business" as const,
    label: "Business",
    description: "Post tasks and discover student talent.",
  },
];

// ─── Form ─────────────────────────────────────────────────────────

/**
 * Sign-up form — role, name, email, password.
 *
 * ★ Role is a segmented picker (two big cards) rather than a hidden
 *   dropdown, because it's the choice that shapes the entire rest of
 *   the experience — students see the ticker, businesses see the
 *   task-management dashboard. Making it visible and pre-selected
 *   removes a step and prevents "I picked the wrong one" regret.
 *
 * ★ Radio inputs are `sr-only` inside each card `<label>` so the
 *   whole card is the click target, but keyboard focus and screen
 *   readers still work — the `focus-within:ring` on the label
 *   surfaces the hidden radio's focus visually.
 */
export function SignUpForm() {
  const [selectedRole, setSelectedRole] =
    useState<"student" | "business">("student");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, startGoogleTransition] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // The visible cards drive React state, not the form's own field,
    // so we set the value explicitly before sending.
    formData.set("role", selectedRole);

    // Attach the Turnstile token — the server action verifies it.
    if (turnstileToken) {
      formData.set("cf-turnstile-response", turnstileToken);
    }

    startTransition(async () => {
      const actionResult = await signUp(formData);
      // signUp redirects on success; we only reach here on failure.
      setResult(actionResult);
    });
  }

  function handleTurnstileExpire() {
    setTurnstileToken(null);
  }

  function handleGoogleSignIn() {
    startGoogleTransition(async () => {
      const result = await signInWithGoogle();
      if ("url" in result) {
        window.location.href = result.url;
      } else {
        setResult(result);
      }
    });
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

      {/* Role picker */}
      <fieldset>
        <legend className="block text-sm font-medium text-text-primary">
          I am a…
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {ROLES.map((role) => {
            const selected = selectedRole === role.value;
            return (
              <label
                key={role.value}
                className={cn(
                  "relative flex cursor-pointer flex-col rounded-lg border-2 p-4",
                  "transition-colors duration-fast",
                  "focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2",
                  selected
                    ? "border-brand-600 bg-brand-50"
                    : "border-border-default bg-surface hover:border-border-strong",
                  isPending && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="radio"
                  name="role-radio"
                  value={role.value}
                  checked={selected}
                  onChange={() => setSelectedRole(role.value)}
                  disabled={isPending}
                  className="sr-only"
                  aria-describedby={`role-desc-${role.value}`}
                />
                <span className="text-sm font-semibold text-text-primary">
                  {role.label}
                </span>
                <span
                  id={`role-desc-${role.value}`}
                  className="mt-0.5 text-xs text-text-secondary"
                >
                  {role.description}
                </span>

                {selected && (
                  <CheckCircle2
                    className="absolute right-3 top-3 h-5 w-5 text-brand-600"
                    aria-hidden="true"
                  />
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/*
        Field name is `fullName` (not `full_name`) because that's the
        key `signUpSchema` uses on the server — a mismatch here would
        silently drop the value and every signup would fail with
        "Name must be at least 2 characters". Matching the schema key
        keeps the mapping explicit.
      */}
      <Input
        id="fullName"
        name="fullName"
        type="text"
        label="Full name"
        autoComplete="name"
        required
        placeholder="Jane Doe"
        disabled={isPending}
      />

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

      <Input
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        required
        minLength={8}
        placeholder="Minimum 8 characters"
        description="Must be at least 8 characters."
        disabled={isPending}
      />

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
        {isPending ? "Creating account…" : "Create account"}
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

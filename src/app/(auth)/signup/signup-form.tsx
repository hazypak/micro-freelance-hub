"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { signUp, type ActionResult } from "@/lib/auth/actions";

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // The visible cards drive React state, not the form's own field,
    // so we set the value explicitly before sending.
    formData.set("role", selectedRole);

    startTransition(async () => {
      const actionResult = await signUp(formData);
      // signUp redirects on success; we only reach here on failure.
      setResult(actionResult);
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

      <Button type="submit" loading={isPending} className="w-full">
        {isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

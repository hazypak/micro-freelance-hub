"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientEnv } from "@/lib/validation/env";
import {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
} from "@/lib/validation/schemas";
import { verifyTurnstileToken } from "./turnstile";

// ─── Result types ──────────────────────────────────────────────────

/**
 * Standardized action result. Server actions can't throw to the client,
 * so we return { error } on failure and let the form display it.
 */
export type ActionResult = {
  error?: string;
  success?: boolean;
  message?: string;
};

// ─── Sign Up ───────────────────────────────────────────────────────

export async function signUp(formData: FormData): Promise<ActionResult> {
  // 1. Parse & validate — treat formData as untrusted input
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message ?? "Invalid input" };
  }

  const { email, password, fullName, role } = parsed.data;

  // 2. Verify Turnstile CAPTCHA
  const captchaResult = await verifyTurnstileToken(
    formData.get("cf-turnstile-response"),
  );
  if (!captchaResult.success) {
    return { error: captchaResult.error };
  }

  // 3. Create the auth user
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        // Stored in auth.users.raw_user_meta_data.
        // The database trigger copies these to profiles on insert.
        full_name: fullName,
        role,
      },
    },
  });

  if (error) {
    // Map common Supabase auth errors to user-friendly messages
    if (error.message.includes("already registered")) {
      return { error: "An account with this email already exists" };
    }
    return { error: error.message };
  }

  // 4. Redirect based on email confirmation status
  // If Supabase has email confirmation enabled, the user needs to verify
  // before they can sign in — send them to the check-email page.
  // If confirmation is disabled (dev mode), proceed to onboarding.
  revalidatePath("/", "layout");
  redirect("/check-email");
}

// ─── Sign In ───────────────────────────────────────────────────────

export async function signIn(formData: FormData): Promise<ActionResult> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message ?? "Invalid input" };
  }

  const { email, password } = parsed.data;

  // Verify Turnstile CAPTCHA
  const captchaResult = await verifyTurnstileToken(
    formData.get("cf-turnstile-response"),
  );
  if (!captchaResult.success) {
    return { error: captchaResult.error };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Don't reveal whether the email exists — generic message
    return { error: "Invalid email or password" };
  }

  // Redirect to the page they were trying to reach, or dashboard.
  // ★ Security: validate that the redirect target is a safe same-origin
  //   relative path. An attacker could set the hidden "redirect" field
  //   to "//evil.com" (protocol-relative) or "https://evil.com" to
  //   hijack the post-login redirect. We only allow paths that start
  //   with "/" but NOT "//" or "/\" (which browsers resolve off-origin).
  const rawRedirect = (formData.get("redirect") as string | null) ?? "";
  const isSafeRelative =
    rawRedirect.startsWith("/") &&
    !rawRedirect.startsWith("//") &&
    !rawRedirect.startsWith("/\\");
  const redirectTo = isSafeRelative ? rawRedirect : "/dashboard";

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

// ─── Sign Out ──────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}

// ─── Forgot Password ──────────────────────────────────────────────

export async function forgotPassword(
  formData: FormData
): Promise<ActionResult> {
  const raw = { email: formData.get("email") };

  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message ?? "Invalid input" };
  }

  const { email } = parsed.data;

  const supabase = await createClient();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?type=recovery`,
  });

  if (error) {
    // Don't reveal whether the email exists
    console.error("Password reset error:", error.message);
  }

  // Always show success — prevents email enumeration
  return {
    success: true,
    message:
      "If an account with that email exists, you will receive a password reset link.",
  };
}

// ─── Google OAuth ─────────────────────────────────────────────────

export async function signInWithGoogle(
  redirectTo?: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const { NEXT_PUBLIC_SITE_URL: siteUrl } = getClientEnv();

  const callbackUrl = new URL("/auth/callback", siteUrl);
  if (redirectTo) {
    callbackUrl.searchParams.set("redirect", redirectTo);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error) return { error: error.message };
  return { url: data.url };
}

// ─── Resend Confirmation Email ───────────────────────────────────

export async function resendConfirmationEmail(
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get("email") as string | null;
  if (!email || typeof email !== "string") {
    return { error: "Email is required" };
  }

  const supabase = await createClient();
  const { NEXT_PUBLIC_SITE_URL: siteUrl } = getClientEnv();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return {
    success: true,
    message: "Confirmation email sent! Check your inbox.",
  };
}

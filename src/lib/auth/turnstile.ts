import { getServerEnv } from "@/lib/validation/env";

/**
 * Verify a Turnstile token server-side.
 *
 * Call this from server actions before processing auth forms. If the
 * token is invalid, return an error to the client — don't proceed.
 *
 * Usage:
 * ```ts
 * const captchaResult = await verifyTurnstileToken(formData.get("cf-turnstile-response"));
 * if (!captchaResult.success) return { error: "Captcha verification failed. Please try again." };
 * ```
 */
export async function verifyTurnstileToken(
  token: FormDataEntryValue | string | null,
): Promise<{ success: boolean; error?: string }> {
  if (!token || typeof token !== "string" || token.length === 0) {
    return { success: false, error: "Captcha challenge is required." };
  }

  const { TURNSTILE_SECRET_KEY } = getServerEnv();

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: TURNSTILE_SECRET_KEY,
          response: token,
        }),
      },
    );

    const data = (await response.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (!data.success) {
      console.warn("Turnstile verification failed:", data["error-codes"]);
      return {
        success: false,
        error: "Captcha verification failed. Please try again.",
      };
    }

    return { success: true };
  } catch (err) {
    console.error("Turnstile verification error:", err);
    return {
      success: false,
      error: "Captcha verification failed. Please try again.",
    };
  }
}
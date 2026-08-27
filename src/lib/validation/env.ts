import { z } from "zod";

/**
 * Client-side environment variables (NEXT_PUBLIC_ prefix).
 * These are embedded in the browser bundle — never put secrets here.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url("NEXT_PUBLIC_SITE_URL must be a valid URL")
    .optional()
    .default("http://localhost:3000"),
});

/**
 * Server-only environment variables.
 * These MUST NOT be prefixed with NEXT_PUBLIC_.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validated client environment. Safe to use anywhere.
 * Fails fast at import time if variables are missing.
 */
export function getClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    throw new Error(
      `❌ Missing or invalid client environment variables:\n${JSON.stringify(errors, null, 2)}\n\nCopy .env.example to .env.local and fill in values.`
    );
  }

  return parsed.data;
}

/**
 * Validated server environment. Only call from server-side code.
 * Fails fast if called from client or if variables are missing.
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "getServerEnv() was called from client-side code. This is a security violation — server-only variables must never reach the browser."
    );
  }

  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    throw new Error(
      `❌ Missing or invalid server environment variables:\n${JSON.stringify(errors, null, 2)}\n\nCopy .env.example to .env.local and fill in values.`
    );
  }

  return parsed.data;
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role Supabase client — BYPASSES RLS.
 *
 * ⚠️ SECURITY: This client has full database access.
 * - NEVER import this file from client-side code
 * - NEVER expose in API responses
 * - Use ONLY for server-side operations that need elevated privileges:
 *   trust score updates, audit logging, admin operations
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL. " +
        "Admin client can only be used server-side with proper env configuration."
    );
  }

  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() was called from client-side code. " +
        "The service-role key must NEVER reach the browser."
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

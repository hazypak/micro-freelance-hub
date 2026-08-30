-- ═══════════════════════════════════════════════════════════════════
-- 006. Lock down EXECUTE grants on SECURITY DEFINER functions
-- ═══════════════════════════════════════════════════════════════════
--
-- Audit finding (surfaced by the Supabase database linter, lints 0028 /
-- 0029) that the original security pass missed:
--
--   `revoke all on function … from public` does NOT remove the explicit
--   EXECUTE grant that Supabase's default privileges hand to the `anon`
--   and `authenticated` roles at function-creation time. `public` is a
--   pseudo-role; revoking from it leaves the concrete per-role grants
--   untouched. Migration 005's `revoke … from public` was therefore a
--   no-op against `anon`, and every SECURITY DEFINER function in this
--   schema remained callable straight from the REST surface at
--   `/rest/v1/rpc/<name>`.
--
-- ★ CRITICAL — public.update_trust_score:
--     Unlike accept_proposal, this function performs NO auth.uid() check
--     of its own. It flips on the `app.bypass_profile_protection` guard
--     and writes trust_score directly. Exposed to `authenticated`, any
--     signed-in user could POST
--       /rest/v1/rpc/update_trust_score
--       { "p_user_id": "<any uuid>", "p_delta": 1000, "p_event_type": "x" }
--     and pin any profile's trust score to 100 (it clamps to 0–100). It
--     is designed to be called ONLY by the service-role client, which
--     bypasses these grants entirely. So we revoke it from anon AND
--     authenticated, leaving service_role as the sole caller.
--
-- ★ public.accept_proposal:
--     Intended to be called by signed-in task owners, and it re-checks
--     auth.uid() + ownership internally, so an anon call already fails
--     closed with "not authenticated". We still revoke `anon` so the
--     REST surface matches the intent and the linter is clean; the
--     `authenticated` grant is kept and reasserted.
--
-- ★ The four trigger functions (handle_updated_at, handle_new_user,
--     protect_profile_fields, enforce_assignment_requires_accepted_proposal):
--     these return `trigger` and are fired by the engine, never called
--     directly. PostgREST does not expose trigger-return functions, so
--     the exposure is theoretical — but we revoke anyway so the grant
--     state reflects reality and the advisors stop flagging them.
--
-- Idempotent: `revoke` of an absent privilege is a no-op, and re-granting
-- an existing one is harmless, so this migration is safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ─── CRITICAL: service-role-only ───────────────────────────────────
revoke execute on function public.update_trust_score(uuid, numeric, text, jsonb)
  from anon, authenticated;

-- ─── Trigger functions — not callable directly by anyone ───────────
revoke execute on function public.handle_updated_at()
  from anon, authenticated;
revoke execute on function public.handle_new_user()
  from anon, authenticated;
revoke execute on function public.protect_profile_fields()
  from anon, authenticated;
revoke execute on function public.enforce_assignment_requires_accepted_proposal()
  from anon, authenticated;

-- ─── accept_proposal — signed-in callers only, never anon ──────────
revoke execute on function public.accept_proposal(uuid)
  from anon;
grant  execute on function public.accept_proposal(uuid)
  to authenticated;

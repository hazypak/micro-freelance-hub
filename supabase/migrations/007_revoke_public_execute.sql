-- ═══════════════════════════════════════════════════════════════════
-- 007. Revoke the PUBLIC EXECUTE grant left behind by 006
-- ═══════════════════════════════════════════════════════════════════
--
-- Migration 006 revoked EXECUTE from `anon` and `authenticated` by name.
-- Verifying the result showed that only `accept_proposal` actually
-- changed — every other function still reported
-- `has_function_privilege('anon', …) = true`.
--
-- Reading pg_proc.proacl explained why:
--
--     accept_proposal   → postgres=X/postgres
--                         authenticated=X/postgres
--                         service_role=X/postgres
--
--     the other five    → =X/postgres          ← grantee before '=' is
--                         postgres=X/postgres     EMPTY, and an empty
--                         service_role=X/postgres grantee means PUBLIC
--
-- Postgres grants EXECUTE on every new function to PUBLIC by default.
-- `anon` and `authenticated` were not holding named grants at all — they
-- reached these functions by virtue of being members of PUBLIC, like
-- every other role. Revoking from a role by name cannot take away a
-- privilege it only holds through PUBLIC, so 006's revokes were no-ops
-- for the five functions that had never had their PUBLIC grant stripped.
--
-- `accept_proposal` was the exception precisely because migration 005
-- HAD already run `revoke all … from public` on it; the named revoke in
-- 006 then removed the one remaining explicit `anon` grant.
--
-- ★ The general rule, learned the hard way across 005 → 006 → 007:
--     locking down a function needs BOTH revokes. Neither implies the
--     other.
--         revoke execute on function f() from public;              -- the default grant
--         revoke execute on function f() from anon, authenticated; -- any named grants
--     And `has_function_privilege` is the check that actually settles
--     it — the ACL is the evidence, the grant statement is only the
--     intent.
--
-- ★ CRITICAL, restated: public.update_trust_score performs no auth.uid()
--     check, flips on `app.bypass_profile_protection`, and writes
--     trust_score directly. While PUBLIC held EXECUTE it was reachable at
--     /rest/v1/rpc/update_trust_score by anonymous callers, who could pin
--     any profile's trust score to 100 or drop a rival's to 0. This
--     migration is what actually closes that hole; 006 did not.
--
-- Idempotent, and safe to run on a fresh database that has already run
-- 006 (the revokes simply find nothing to remove).
-- ═══════════════════════════════════════════════════════════════════

revoke execute on function public.update_trust_score(uuid, numeric, text, jsonb)
  from public;

revoke execute on function public.handle_updated_at()
  from public;
revoke execute on function public.handle_new_user()
  from public;
revoke execute on function public.protect_profile_fields()
  from public;
revoke execute on function public.enforce_assignment_requires_accepted_proposal()
  from public;

-- accept_proposal is deliberately left callable by signed-in users; 005
-- already stripped its PUBLIC grant and 006 removed the stray anon one.
-- Reasserted here so a fresh database converges to the same ACL.
grant execute on function public.accept_proposal(uuid) to authenticated;

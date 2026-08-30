-- ═══════════════════════════════════════════════════════════════════
-- 008. Pin search_path on the two SECURITY DEFINER functions missing it
-- ═══════════════════════════════════════════════════════════════════
--
-- Supabase linter 0011 (function_search_path_mutable) flagged
-- `handle_updated_at` and `protect_profile_fields`. Migration 001
-- already set `search_path = ''` on `handle_new_user` and
-- `update_trust_score` — these two were simply missed.
--
-- Why it matters for a SECURITY DEFINER function specifically: the body
-- runs with the DEFINER's privileges but resolves unqualified names
-- using the CALLER's search_path. Anyone able to create an object in a
-- schema that sorts ahead of the intended one can shadow a name the
-- function relies on and have their version run as the definer. Pinning
-- search_path removes the caller's influence entirely.
--
-- ★ `search_path = ''` is safe for both bodies: the only functions they
--   call — now() and current_setting() — live in pg_catalog, which
--   Postgres searches implicitly and always, regardless of search_path.
--   Everything else they touch (new.*, old.*) is a record field, not a
--   schema-resolved name. Nothing here needs qualifying, so the empty
--   path costs nothing and closes the shadowing vector.
--
-- ★ `create or replace function` preserves the function's OID, so the
--   triggers bound to these functions keep working without being
--   recreated. It also preserves the ACL, so the revokes applied in
--   006/007 survive this migration — verified after applying.
--
-- Bodies are otherwise byte-for-byte identical to migration 001.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Allow bypass from trusted server-side functions via session variable.
  -- Only SECURITY DEFINER functions can set this, so clients can't forge it.
  if current_setting('app.bypass_profile_protection', true) = 'on' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Cannot change role directly';
  end if;

  if new.trust_score is distinct from old.trust_score then
    raise exception 'Cannot change trust_score directly';
  end if;

  return new;
end;
$$;

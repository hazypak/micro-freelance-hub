-- ═══════════════════════════════════════════════════════════════════
-- 004 — Scope deliverables Storage access to task participants
-- ═══════════════════════════════════════════════════════════════════
--
-- The policies created in 001 carried this comment:
--
--     "Storage RLS: Assigned students upload, task participants download"
--
-- ...but the predicates only tested `auth.uid() is not null`. Any
-- authenticated account could read every object in the bucket and write
-- into any task's folder, straight from the browser client — the
-- ownership checks in `getSignedDownloadUrl` never ran, because nothing
-- obliged a caller to go through the server action at all.
--
-- These policies make the database enforce what that comment claimed.
--
-- ★ Path contract: objects are stored as `<taskId>/<filename>`, so
--   `(storage.foldername(name))[1]` is the task id. This is the same
--   contract `isValidStoragePath()` enforces in the application layer;
--   the two are deliberately redundant.
--
-- ★ Compared as text, not cast to uuid. A malformed folder segment
--   would make `::uuid` raise, turning a policy denial into a 500. As
--   text it simply fails to match and the row is denied cleanly. An
--   object with no folder at all yields NULL here, which is likewise
--   never equal to anything — also denied.
-- ═══════════════════════════════════════════════════════════════════

drop policy if exists "Deliverables: upload" on storage.objects;
drop policy if exists "Deliverables: download" on storage.objects;

-- ─── Upload: the assigned student, into their own task's folder ────
create policy "Deliverables: upload"
  on storage.objects for insert
  with check (
    bucket_id = 'deliverables'
    and exists (
      select 1
      from public.task_assignments ta
      where ta.task_id::text = (storage.foldername(name))[1]
        and ta.student_id = auth.uid()
    )
  );

-- ─── Download: the assigned student, or the task's owner ───────────
--
-- `getSignedDownloadUrl` runs on the user-scoped client, so signing a
-- URL is itself a `select` against this policy. The action's own
-- ownership check now sits on top of an equivalent database rule
-- rather than standing alone.
create policy "Deliverables: download"
  on storage.objects for select
  using (
    bucket_id = 'deliverables'
    and (
      exists (
        select 1
        from public.task_assignments ta
        where ta.task_id::text = (storage.foldername(name))[1]
          and ta.student_id = auth.uid()
      )
      or exists (
        select 1
        from public.micro_tasks mt
        where mt.id::text = (storage.foldername(name))[1]
          and mt.client_id = auth.uid()
      )
    )
  );

-- Update and delete stay denied — 001's policies for those were already
-- correct (`... and false`) and are left in place.

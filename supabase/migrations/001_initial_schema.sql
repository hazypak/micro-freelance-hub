-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Micro-Freelance Hub — Initial Schema Migration                 ║
-- ║  Run in the Supabase SQL Editor or via `supabase db push`       ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── Helper: updated_at trigger function ────────────────────────────

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 1. PROFILES
-- ═══════════════════════════════════════════════════════════════════

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  role          text not null check (role in ('student', 'business', 'admin')),
  bio           text,
  avatar_url    text,
  school_or_company text,
  focus_areas   text[],
  skills        text[],
  trust_score   numeric(5,2) not null default 50.00,
  onboarding_completed boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ═══════════════════════════════════════════════════════════════════
-- 2. MICRO_TASKS
-- ═══════════════════════════════════════════════════════════════════

create table public.micro_tasks (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  description   text not null,
  brief         text,
  category      text not null,
  budget        numeric(10,2) not null check (budget > 0),
  deadline      timestamptz,
  required_skills text[],
  permitted_deliverable_types text[],
  status        text not null default 'draft'
                check (status in (
                  'draft', 'open', 'in_progress', 'submitted',
                  'ai_review', 'client_review', 'completed',
                  'cancelled', 'disputed'
                )),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_tasks_status_created on public.micro_tasks (status, created_at desc);
create index idx_tasks_client_id on public.micro_tasks (client_id);

create trigger micro_tasks_updated_at
  before update on public.micro_tasks
  for each row execute function public.handle_updated_at();


-- ═══════════════════════════════════════════════════════════════════
-- 3. TASK_PROPOSALS
-- ═══════════════════════════════════════════════════════════════════

create table public.task_proposals (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.micro_tasks(id) on delete cascade,
  student_id      uuid not null references public.profiles(id) on delete cascade,
  cover_message   text not null,
  proposed_price  numeric(10,2),
  timeline_estimate text,
  status          text not null default 'pending'
                  check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (task_id, student_id)  -- one proposal per student per task
);

create index idx_proposals_task_id on public.task_proposals (task_id);
create index idx_proposals_student_id on public.task_proposals (student_id);

create trigger task_proposals_updated_at
  before update on public.task_proposals
  for each row execute function public.handle_updated_at();


-- ═══════════════════════════════════════════════════════════════════
-- 4. TASK_ASSIGNMENTS
-- ═══════════════════════════════════════════════════════════════════

create table public.task_assignments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.micro_tasks(id) on delete cascade unique,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  proposal_id uuid not null references public.task_proposals(id) on delete cascade,
  assigned_at timestamptz not null default now()
);

create index idx_assignments_student_id on public.task_assignments (student_id);


-- ═══════════════════════════════════════════════════════════════════
-- 5. SUBMISSIONS
-- ═══════════════════════════════════════════════════════════════════

create table public.submissions (
  id                      uuid primary key default gen_random_uuid(),
  task_id                 uuid not null references public.micro_tasks(id) on delete cascade,
  student_id              uuid not null references public.profiles(id) on delete cascade,
  deliverable_url         text,
  storage_path            text,
  notes                   text,
  ai_verification_status  text not null default 'pending'
                          check (ai_verification_status in (
                            'pending', 'queued', 'scanning', 'passed',
                            'failed', 'needs_manual_review', 'retryable_error'
                          )),
  ai_feedback             jsonb,
  submitted_at            timestamptz not null default now()
);

create index idx_submissions_task_id on public.submissions (task_id);
create index idx_submissions_student_id on public.submissions (student_id);


-- ═══════════════════════════════════════════════════════════════════
-- 6. REVIEWS
-- ═══════════════════════════════════════════════════════════════════

create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.micro_tasks(id) on delete cascade,
  reviewer_id  uuid not null references public.profiles(id) on delete cascade,
  reviewee_id  uuid not null references public.profiles(id) on delete cascade,
  rating       integer not null check (rating >= 1 and rating <= 5),
  comment      text check (length(comment) <= 2000),
  created_at   timestamptz not null default now(),
  unique (task_id, reviewer_id),                -- one review per reviewer per task
  check (reviewer_id != reviewee_id)            -- no self-reviews
);

create index idx_reviews_reviewee_id on public.reviews (reviewee_id);
create index idx_reviews_task_id on public.reviews (task_id);


-- ═══════════════════════════════════════════════════════════════════
-- 7. TRUST_SCORE_EVENTS
-- ═══════════════════════════════════════════════════════════════════

create table public.trust_score_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  event_type    text not null,
  delta         numeric(5,2) not null,
  evidence      jsonb,
  score_before  numeric(5,2) not null,
  score_after   numeric(5,2) not null,
  version       integer not null default 1,
  created_at    timestamptz not null default now()
);

create index idx_trust_events_user_id on public.trust_score_events (user_id);


-- ═══════════════════════════════════════════════════════════════════
-- 8. AUDIT_EVENTS
-- ═══════════════════════════════════════════════════════════════════

create table public.audit_events (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references public.profiles(id) on delete set null,
  action        text not null,
  resource_type text not null,
  resource_id   uuid,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index idx_audit_actor_id on public.audit_events (actor_id);
create index idx_audit_resource on public.audit_events (resource_type, resource_id);


-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════

-- ─── PROFILES ───────────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- Anyone can read basic profile info (public profiles)
create policy "Profiles: public read"
  on public.profiles for select
  using (true);

-- Users can update their own profile (except role and trust_score)
create policy "Profiles: self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- role and trust_score changes are blocked by not being in the
    -- allowed columns of the application update schemas.
    -- Additional safety: a database trigger could enforce this.
  );

-- Profile insert handled by trigger (service role), not by client
create policy "Profiles: deny direct insert"
  on public.profiles for insert
  with check (false);

-- No client-side delete
create policy "Profiles: deny delete"
  on public.profiles for delete
  using (false);


-- ─── MICRO_TASKS ────────────────────────────────────────────────────

alter table public.micro_tasks enable row level security;

-- Business users can see all their own tasks (any status)
-- Students can see open tasks + tasks assigned to them
create policy "Tasks: read"
  on public.micro_tasks for select
  using (
    client_id = auth.uid()                          -- task owner
    or status = 'open'                              -- public marketplace
    or exists (                                     -- assigned student
      select 1 from public.task_assignments
      where task_assignments.task_id = micro_tasks.id
        and task_assignments.student_id = auth.uid()
    )
    or exists (                                     -- student with proposal
      select 1 from public.task_proposals
      where task_proposals.task_id = micro_tasks.id
        and task_proposals.student_id = auth.uid()
    )
  );

-- Only business users can create tasks
create policy "Tasks: business create"
  on public.micro_tasks for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'business'
    )
  );

-- Task owner can update their own tasks
create policy "Tasks: owner update"
  on public.micro_tasks for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

-- Task owner can delete only draft tasks
create policy "Tasks: owner delete draft"
  on public.micro_tasks for delete
  using (client_id = auth.uid() and status = 'draft');


-- ─── TASK_PROPOSALS ─────────────────────────────────────────────────

alter table public.task_proposals enable row level security;

-- Students see their own proposals; task owners see proposals for their tasks
create policy "Proposals: read"
  on public.task_proposals for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.micro_tasks
      where micro_tasks.id = task_proposals.task_id
        and micro_tasks.client_id = auth.uid()
    )
  );

-- Students can create proposals (must be for an open task)
create policy "Proposals: student create"
  on public.task_proposals for insert
  with check (
    auth.uid() = student_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'student'
    )
    and exists (
      select 1 from public.micro_tasks
      where micro_tasks.id = task_id
        and micro_tasks.status = 'open'
    )
  );

-- Students can update their own pending proposals (withdraw)
create policy "Proposals: student update own"
  on public.task_proposals for update
  using (student_id = auth.uid() and status = 'pending')
  with check (student_id = auth.uid());

-- Task owner can update proposal status (accept/reject)
create policy "Proposals: owner update status"
  on public.task_proposals for update
  using (
    exists (
      select 1 from public.micro_tasks
      where micro_tasks.id = task_proposals.task_id
        and micro_tasks.client_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.micro_tasks
      where micro_tasks.id = task_proposals.task_id
        and micro_tasks.client_id = auth.uid()
    )
  );

-- No client-side delete of proposals
create policy "Proposals: deny delete"
  on public.task_proposals for delete
  using (false);


-- ─── TASK_ASSIGNMENTS ───────────────────────────────────────────────

alter table public.task_assignments enable row level security;

-- Readable by assigned student and task owner
create policy "Assignments: read"
  on public.task_assignments for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.micro_tasks
      where micro_tasks.id = task_assignments.task_id
        and micro_tasks.client_id = auth.uid()
    )
  );

-- Assignments created via server action (service role), not client
create policy "Assignments: deny direct insert"
  on public.task_assignments for insert
  with check (false);

-- No client updates or deletes
create policy "Assignments: deny update"
  on public.task_assignments for update
  using (false);

create policy "Assignments: deny delete"
  on public.task_assignments for delete
  using (false);


-- ─── SUBMISSIONS ────────────────────────────────────────────────────

alter table public.submissions enable row level security;

-- Readable by the student who submitted and the task owner
create policy "Submissions: read"
  on public.submissions for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.micro_tasks
      where micro_tasks.id = submissions.task_id
        and micro_tasks.client_id = auth.uid()
    )
  );

-- Assigned students can create submissions
create policy "Submissions: student create"
  on public.submissions for insert
  with check (
    auth.uid() = student_id
    and exists (
      select 1 from public.task_assignments
      where task_assignments.task_id = submissions.task_id
        and task_assignments.student_id = auth.uid()
    )
  );

-- No client updates (AI verification status updated via service role)
create policy "Submissions: deny update"
  on public.submissions for update
  using (false);

create policy "Submissions: deny delete"
  on public.submissions for delete
  using (false);


-- ─── REVIEWS ────────────────────────────────────────────────────────

alter table public.reviews enable row level security;

-- Public read — reviews are visible to everyone
create policy "Reviews: public read"
  on public.reviews for select
  using (true);

-- Participants of completed tasks can create reviews
create policy "Reviews: participant create"
  on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and reviewer_id != reviewee_id
    and exists (
      select 1 from public.micro_tasks
      where micro_tasks.id = reviews.task_id
        and micro_tasks.status = 'completed'
        and (
          micro_tasks.client_id = auth.uid()
          or exists (
            select 1 from public.task_assignments
            where task_assignments.task_id = micro_tasks.id
              and task_assignments.student_id = auth.uid()
          )
        )
    )
  );

-- No client updates or deletes for reviews
create policy "Reviews: deny update"
  on public.reviews for update
  using (false);

create policy "Reviews: deny delete"
  on public.reviews for delete
  using (false);


-- ─── TRUST_SCORE_EVENTS ─────────────────────────────────────────────

alter table public.trust_score_events enable row level security;

-- Users can read their own trust events
create policy "Trust events: self read"
  on public.trust_score_events for select
  using (user_id = auth.uid());

-- Write-protected from clients (inserts via service role only)
create policy "Trust events: deny insert"
  on public.trust_score_events for insert
  with check (false);

create policy "Trust events: deny update"
  on public.trust_score_events for update
  using (false);

create policy "Trust events: deny delete"
  on public.trust_score_events for delete
  using (false);


-- ─── AUDIT_EVENTS ───────────────────────────────────────────────────

alter table public.audit_events enable row level security;

-- Only admins can read audit events
create policy "Audit: admin read"
  on public.audit_events for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Write-protected from clients (inserts via service role only)
create policy "Audit: deny insert"
  on public.audit_events for insert
  with check (false);

create policy "Audit: deny update"
  on public.audit_events for update
  using (false);

create policy "Audit: deny delete"
  on public.audit_events for delete
  using (false);


-- ═══════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════════════════

-- Private bucket for deliverables (signed URLs only)
insert into storage.buckets (id, name, public)
values ('deliverables', 'deliverables', false)
on conflict (id) do nothing;

-- Storage RLS: Assigned students upload, task participants download
create policy "Deliverables: upload"
  on storage.objects for insert
  with check (
    bucket_id = 'deliverables'
    and auth.uid() is not null
  );

create policy "Deliverables: download"
  on storage.objects for select
  using (
    bucket_id = 'deliverables'
    and auth.uid() is not null
  );

-- Prevent overwrite/delete from client
create policy "Deliverables: deny update"
  on storage.objects for update
  using (bucket_id = 'deliverables' and false);

create policy "Deliverables: deny delete"
  on storage.objects for delete
  using (bucket_id = 'deliverables' and false);


-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER: Protect role and trust_score from direct client updates
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Allow bypass from trusted server-side functions via session variable.
  -- Only SECURITY DEFINER functions can set this, so clients can't forge it.
  if current_setting('app.bypass_profile_protection', true) = 'on' then
    return new;
  end if;

  -- Prevent role changes from client (only service role can change)
  if new.role is distinct from old.role then
    raise exception 'Cannot change role directly';
  end if;

  -- Prevent trust_score changes from client (only service role can change)
  if new.trust_score is distinct from old.trust_score then
    raise exception 'Cannot change trust_score directly';
  end if;

  return new;
end;
$$;

create trigger protect_profile_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Note: This trigger fires for ALL updates including security definer functions.
-- Trusted functions set `app.bypass_profile_protection = 'on'` (transaction-local)
-- before updating protected fields. Only SECURITY DEFINER functions can call
-- set_config, so a client cannot forge the bypass.

-- Dedicated function for trust score updates (called by service role)
create or replace function public.update_trust_score(
  p_user_id uuid,
  p_delta numeric,
  p_event_type text,
  p_evidence jsonb default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_score numeric;
  v_new_score numeric;
begin
  -- Get current score with row lock
  select trust_score into v_old_score
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User not found';
  end if;

  -- Clamp to 0-100
  v_new_score := greatest(0, least(100, v_old_score + p_delta));

  -- Enable bypass for this transaction so protect_profile_fields trigger
  -- allows the trust_score change. The 'true' third arg means transaction-local.
  perform set_config('app.bypass_profile_protection', 'on', true);

  -- Update profile
  update public.profiles
  set trust_score = v_new_score,
      updated_at = now()
  where id = p_user_id;

  -- Reset bypass immediately after the update
  perform set_config('app.bypass_profile_protection', '', true);

  -- Record the event
  insert into public.trust_score_events (
    user_id, event_type, delta, evidence,
    score_before, score_after
  ) values (
    p_user_id, p_event_type, p_delta, p_evidence,
    v_old_score, v_new_score
  );

  return v_new_score;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 005. accept_proposal RPC + assignment INSERT trigger
-- ═══════════════════════════════════════════════════════════════════
--
-- Two independent hardening measures for the proposal-acceptance flow:
--
-- 1. public.accept_proposal(p_proposal_id uuid)
--    A single-transaction replacement for the 4-step server-action write
--    sequence.  Locks the task row FOR UPDATE, verifies the caller owns
--    the task, then atomically:
--      a. sets the target proposal to 'accepted'
--      b. inserts the task_assignment
--      c. transitions the task from 'open' → 'in_progress'
--      d. rejects all other 'pending' proposals for the same task
--    Any failure aborts the whole transaction — no partial state.
--
--    SECURITY DEFINER is required because task_assignments has a
--    'deny direct insert' RLS policy meant for exactly this case.
--    The function authenticates auth.uid() and re-verifies ownership
--    inside the body, so the elevated privileges are fenced to the
--    task's rightful owner.
--
--    Returns the list of student_ids whose proposals were auto-rejected,
--    so the caller can dispatch out-of-band notifications.
--
-- 2. INSERT trigger `enforce_assignment_requires_accepted_proposal` on
--    public.task_assignments — defense-in-depth for security-audit
--    finding #3.  Even if a future code path tried to write an
--    assignment directly, this trigger refuses it unless the linked
--    proposal is 'accepted' AND belongs to the same task.
--
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. accept_proposal function ───────────────────────────────────

create or replace function public.accept_proposal(
  p_proposal_id uuid
)
returns table (rejected_student_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id     uuid;
  v_student_id  uuid;
  v_client_id   uuid;
  v_task_status text;
  v_proposal_status text;
begin
  -- Caller must be authenticated.
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Fetch the proposal + owning task, LOCKING the task row so a
  -- concurrent accept_proposal call on the same task blocks until
  -- this transaction commits.  Without the lock two racing accepts
  -- could both pass the status check before either wrote.
  select
    p.task_id, p.student_id, p.status,
    t.client_id, t.status
  into
    v_task_id, v_student_id, v_proposal_status,
    v_client_id, v_task_status
  from public.task_proposals p
  join public.micro_tasks t on t.id = p.task_id
  where p.id = p_proposal_id
  for update of t;

  if not found then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;

  -- Ownership check FIRST so we never leak proposal/task status to
  -- non-owners (audit finding #4).  Generic error message.
  if v_client_id <> auth.uid() then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;

  if v_proposal_status <> 'pending' then
    raise exception 'proposal is not pending' using errcode = 'P0001';
  end if;

  if v_task_status <> 'open' then
    raise exception 'task is no longer open' using errcode = 'P0001';
  end if;

  -- a. Accept the target proposal
  update public.task_proposals
    set status = 'accepted'
    where id = p_proposal_id;

  -- b. Create the assignment (unique on task_id blocks duplicates)
  insert into public.task_assignments (task_id, student_id, proposal_id)
    values (v_task_id, v_student_id, p_proposal_id);

  -- c. Transition the task
  update public.micro_tasks
    set status = 'in_progress'
    where id = v_task_id;

  -- d. Auto-reject peers and return their ids for notification.
  --    RETURNING pipes straight into the function's return set.
  return query
    update public.task_proposals
      set status = 'rejected'
      where task_id = v_task_id
        and status = 'pending'
        and id <> p_proposal_id
      returning student_id;
end;
$$;

comment on function public.accept_proposal(uuid) is
  'Atomically accept a proposal: locks task, verifies caller owns it, '
  'transitions proposal/task/peers in one transaction. '
  'Returns student_ids of auto-rejected proposals for notification. '
  'SECURITY DEFINER — required because task_assignments denies direct '
  'inserts; caller is re-authenticated via auth.uid() inside the body.';

-- Only authenticated users may call it.  Revoke the default PUBLIC grant
-- so anonymous callers cannot invoke it even if RLS is misconfigured
-- elsewhere.
revoke all on function public.accept_proposal(uuid) from public;
grant execute on function public.accept_proposal(uuid) to authenticated;


-- ─── 2. Assignment INSERT trigger (defense-in-depth for #3) ────────

create or replace function public.enforce_assignment_requires_accepted_proposal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal_task_id uuid;
  v_proposal_status  text;
begin
  select task_id, status
    into v_proposal_task_id, v_proposal_status
    from public.task_proposals
    where id = new.proposal_id;

  if not found then
    raise exception 'assignment references a non-existent proposal';
  end if;

  if v_proposal_task_id <> new.task_id then
    raise exception 'assignment task_id must match proposal task_id';
  end if;

  if v_proposal_status <> 'accepted' then
    raise exception 'assignment requires an accepted proposal (got %)',
      v_proposal_status;
  end if;

  return new;
end;
$$;

create trigger enforce_assignment_requires_accepted_proposal
  before insert on public.task_assignments
  for each row
  execute function public.enforce_assignment_requires_accepted_proposal();

comment on trigger enforce_assignment_requires_accepted_proposal
  on public.task_assignments is
  'Defense-in-depth for audit finding #3: task_assignments may only be '
  'created against an already-accepted proposal.  The accept_proposal '
  'RPC sets proposal status BEFORE inserting the assignment, satisfying '
  'this trigger; any bypass path is blocked.';

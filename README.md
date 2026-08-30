# GigBridge

A micro-freelance marketplace connecting student creators with businesses
posting short, well-scoped paid tasks.

A business posts a task; students submit proposals; the business accepts
one, which assigns the task and auto-rejects the rest; the student uploads
a deliverable; the business reviews it. Trust scores accumulate from
completed work.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions) |
| Language | TypeScript (strict, `noUncheckedIndexedAccess`) |
| Styling | Tailwind CSS v4, semantic design tokens in `src/app/globals.css` |
| Backend | Supabase — Postgres, Auth, Storage |
| Validation | Zod, at every trust boundary |
| Tests | `node --test` with native TS type-stripping — **zero test dependencies** |

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in the values from **Supabase Dashboard → Project Settings → API**.
`src/lib/validation/env.ts` validates all of them at runtime and fails
fast with a descriptive error, so a missing value surfaces immediately
rather than as a confusing 500 later.

`SUPABASE_SERVICE_ROLE_KEY` is a secret that bypasses Row Level Security.
It has no `NEXT_PUBLIC_` prefix, which is what keeps it out of the browser
bundle; `getServerEnv()` additionally throws if it is ever read from
client-side code.

### 3. Database migrations — do not skip this

**The app will not work against an empty database.** Apply every migration
in `supabase/migrations/`, in numerical order:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or paste each file into the Dashboard SQL Editor in order.

> **Verify it worked.** A partially-migrated database fails in ways that
> point at the wrong culprit — calling `accept_proposal` against a
> database that never ran `001` reports
> `42P01: relation "public.task_assignments" does not exist`, which reads
> like a bug in the newest migration rather than a database that was
> never initialised. Confirm all nine tables exist before debugging
> anything else.

| Migration | What it does |
|---|---|
| `001_initial_schema` | 9 tables, RLS policies, storage bucket, trust-score fn |
| `002_notifications` | Notifications table + `notification_type` enum |
| `003_submission_notifications` | Extends the enum for the deliverables flow |
| `004_deliverables_storage_rls` | Scopes storage access to task participants |
| `005_accept_proposal_rpc` | Atomic proposal acceptance + assignment trigger |
| `006`–`007` | Revoke `EXECUTE` on `SECURITY DEFINER` functions |
| `008_function_search_path` | Pins `search_path` on the remaining two |

### 4. Run

```bash
npm run dev
```

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
npm test        # node --test over src/**/*.test.ts
```

## Testing

Tests use Node's built-in runner and native TypeScript type-stripping —
no vitest, no jest, no ts-node, no config file.

Two constraints follow from that, and both will bite you if you miss them:

- **Import siblings with an explicit `.ts` extension.** Node resolves real
  paths, not bundler aliases, so `@/` does not work in tests.
  `allowImportingTsExtensions` is enabled to let `tsc` accept this, which
  is safe because `noEmit` is set.
- **Pure logic that needs testing must live outside `"use server"`
  modules**, or importing it drags in `next/cache` and Supabase. This is
  why `checkTermsLock` lives in `lib/tasks/terms-lock.ts` and
  `VALID_TRANSITIONS` in `lib/tasks/state-machine.ts` rather than beside
  the actions that use them.

## Security posture

Authorization is enforced at the database boundary, not just in the
application — RLS is enabled on all nine tables, and the app's checks sit
on top of equivalent database rules rather than standing alone.

- **Proposal acceptance is one transaction.** `accept_proposal()` locks
  the task row `FOR UPDATE`, so two concurrent accepts cannot both pass
  the status check. It returns the auto-rejected students' ids for
  notification.
- **Assignments require an accepted proposal**, enforced by a `BEFORE
  INSERT` trigger, so no future code path can write one directly.
- **Not-found and not-authorised return identical messages**, so errors
  cannot be used as an existence oracle.
- **Deliverables live in a private bucket** reachable only by signed URL,
  with storage policies tying every read and write to the task's
  participants.
- **Auth-callback redirects are built from `NEXT_PUBLIC_SITE_URL`**, never
  `request.nextUrl.origin` — `origin` derives from the caller-controlled
  Host header, so trusting it would let an attacker bounce a victim to a
  look-alike domain carrying a valid session.

## Deploying

Set the same environment variables in your host's dashboard.

**`NEXT_PUBLIC_SITE_URL` has a chicken-and-egg problem worth planning
for:** it must be your real deployed origin, but you do not know that
origin until after the first deploy. If you leave it unset it silently
falls back to `http://localhost:3000`, and every email-confirmation and
password-reset link will dead-end on the user's own machine. Deploy once,
take the assigned URL, set the variable, then redeploy.

Add that URL to **Supabase → Authentication → URL Configuration** as well,
or the auth callbacks will be rejected.

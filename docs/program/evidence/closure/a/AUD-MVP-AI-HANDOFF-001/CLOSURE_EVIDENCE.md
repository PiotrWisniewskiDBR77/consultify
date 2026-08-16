# AUD-MVP-AI-HANDOFF-001 — closure evidence

Lane: Claude A (`codex/closure-claude-a-method-evidence`,
`/Users/piotrwisniewski/Developer/consultify-closure-claude-a`).
Date: 2026-08-16/17. Requirement: AI proposal-only, human approval, EXACTLY
ONE downstream receipt.

## Scope actually touched

- `server/migrations/20260910_claude_a_audit_initiative_proposal_exactly_once.sql`
  (new, additive migration — the only file this lane is permitted to add
  under `server/migrations/`).
- `server/src/services/auditProgramHandoff/__tests__/*.test.ts` (new test
  directory, sibling of the leased-out `server/src/services/audits/`, so the
  root `vitest.config.ts` include glob for
  `server/src/services/<x>/__tests__/*.test.ts` collects it without editing
  the shared root config).
- Everything under `server/src/services/audits/**` and
  `server/src/routes/audits/**` was READ ONLY. No edits.

## 1. The real gap, confirmed in code

`registerAsInitiative` (`server/src/services/audits/proposalService.ts:467-529`,
read-only for this lane) is check-then-act:

1. `getProposal` → read `status`
2. `createInitiative()` (canonical funnel, `server/src/services/initiative/createInitiativeService.ts`)
3. `UPDATE audit_initiative_proposals SET status='registered', registered_initiative_id=...`

No transaction wraps 1–3, no idempotency key, no unique constraint existed on
`registered_initiative_id`. Two concurrent calls can both pass step 1 before
either reaches step 3 — two `createInitiative()` calls, two `initiatives`
rows referencing the same proposal. Confirmed empirically before any fix (see
migration file's own commit history is not available here, but the race was
reproduced and closed by the same test — see §3).

## 2. Real live schema (checked BEFORE designing the fix)

```
postgresql://consultinity:consultinity@127.0.0.1:34916/consultinity
docker container: consultify-closure-a-34916
```

`\d audit_initiative_proposals` (relevant columns only):
```
 id                       | text | not null
 organization_id          | text | not null
 status                   | text | not null | default 'draft'
 registered_initiative_id | text |
 registered_at            | timestamp with time zone |
Indexes:
  audit_initiative_proposals_pkey PRIMARY KEY (id)
  idx_audit_initiative_proposals_program (organization_id, program_id, status)
```
No FK, no unique index on `registered_initiative_id` — inventory claim
confirmed correct.

`\d audit_domain_events` (relevant columns only):
```
 idempotency_key | text |
Indexes:
  uq_audit_domain_events_idempotency UNIQUE (organization_id, program_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
```

`\d initiatives` (the columns the fix actually uses):
```
 source_type | text |
 source_id   | text |
Foreign-key constraints:
  initiatives_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
```
No FK/unique constraint existed on `(organization_id, source_type, source_id)`.
`initiatives.organization_id` DOES have a real FK to `organizations(id)` —
every fixture in the new tests inserts a real `organizations` row first (this
was learned the hard way by reading `proposalService.test.ts`'s own comment
about the same requirement).

## 3. The fix — enforced at the database layer, not in `proposalService.ts`

`server/migrations/20260910_claude_a_audit_initiative_proposal_exactly_once.sql`
adds, additively and idempotently (`IF NOT EXISTS`):

1. **Primary guarantee**: `uq_initiatives_audit_source_once` — a partial
   UNIQUE INDEX on `initiatives (organization_id, source_id) WHERE
   source_type = 'audit' AND source_id IS NOT NULL`. `source_id` is the
   proposal id (`createInitiativeService.ts` writes `source_type:'audit',
   source_id: proposal.id`). The SECOND concurrent `createInitiative()`
   INSERT for the same proposal now fails with Postgres error `23505`
   (unique-violation). `registerAsInitiative`'s existing try/catch
   (proposalService.ts:498-506) already converts ANY error from
   `createInitiative()` into `AuditDomainError('...', 422,
   'AUDIT_PROPOSAL_REGISTER_FAILED')` — so the fix requires **zero**
   application-code change to produce a defined, never-unhandled outcome.
2. **Defense in depth**: `uq_audit_initiative_proposals_registered_initiative_id`
   — a partial UNIQUE INDEX on `audit_initiative_proposals
   (registered_initiative_id) WHERE registered_initiative_id IS NOT NULL`.
   Does not by itself stop the race (each concurrent call mints a distinct
   initiative id), but closes a second, unrelated integrity gap for free:
   two different proposals can never claim the same initiative as their
   receipt.

### Pre-existing-duplicate safety

Both indexes are preceded by a guarded pre-clean (window-function `ROW_NUMBER()
... PARTITION BY ... ORDER BY created_at ASC, id ASC`) that keeps the
EARLIEST row as the sole claimant and detaches only the identifying pointer
(`source_id` / `registered_initiative_id`, set to `NULL`) on later
duplicates — no row is deleted, no other column is touched, no data outside
the exact duplicate set is affected. On the live target database (this
worktree's leased Postgres) there were zero pre-existing duplicates of
either kind (verified by direct query before designing the migration), so
both pre-clean blocks are no-ops there; they exist for the safety of every
OTHER consumer of this shared migration runner, per the task's explicit
requirement.

**Proven, not just argued** (test 4 below): a scratch database was seeded
with real duplicate rows (two `initiatives` sharing one `(org, source_id)`,
two `audit_initiative_proposals` sharing one `registered_initiative_id`)
BEFORE the migration ran, and the migration applied cleanly, deduplicated
correctly (earliest kept, later detached), and the constraint was then live
against a fresh duplicate insert attempt.

### Why this is stronger than an application-level fix

A `SELECT ... FOR UPDATE` / transaction wrap in `proposalService.ts` would
also work, but that file is outside this lane's lease. The database
constraint is furthermore strictly stronger: it protects the invariant
against ANY caller (a future new admin script, a raw SQL migration, a
different service) that writes to `initiatives`, not just against
`registerAsInitiative`'s own code path.

## 4. Migration application record

```
$ CI=true DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts \
    --only 20260910_claude_a_audit_initiative_proposal_exactly_once.sql
Applying migrations: 1
→ 20260910_claude_a_audit_initiative_proposal_exactly_once.sql
✅ Postgres migrations complete
```
Re-run immediately after (idempotency check):
```
Applying migrations: 0
✅ Postgres migrations complete
```
(`schema_migrations` already recorded it — and the SQL itself is
`IF NOT EXISTS` throughout, so a forced re-apply is also a no-op.)

## 5. Tests written and run (real Postgres, `CI=true RUN_DB_TESTS=1
MOCK_DB=false`, never `NODE_ENV=test` alone)

File: `server/src/services/auditProgramHandoff/__tests__/exactlyOnceRegistration.test.ts`

```
$ DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:34916/consultinity \
  DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
  npx vitest run server/src/services/auditProgramHandoff/__tests__/exactlyOnceRegistration.test.ts \
  --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

- **1. CONCURRENT** (`Promise.allSettled` of two simultaneous
  `registerAsInitiative` calls for the same proposal): exactly 1 fulfilled, 1
  rejected, `SELECT count(*) FROM initiatives WHERE source_type='audit' AND
  source_id=$proposalId` = 1. PASS.
- **2. SEQUENTIAL replay**: first call registers, second call rejects with
  `code: 'AUDIT_INVALID_STATE'` (the service's own state guard fires before
  ever reaching the DB constraint) — a defined outcome, never an unhandled
  exception. Receipt count still 1. PASS.
- **3. POSITIVE control**: a single call still succeeds end-to-end, produces
  exactly one `initiatives` row with `source_type='audit'`,
  `source_id=proposalId`. PASS — proves the fix does not break registration.
- **4. Pre-existing-duplicate control**: a scratch database
  (`scratch_dupes_<timestamp>`, schema-only clone of the live DB via
  `docker exec consultify-closure-a-34916 pg_dump --schema-only | psql`, with
  the two new indexes and the migration's tracking row reset first) was
  seeded with real duplicates, then the migration file was applied directly
  — it succeeded, deduplicated exactly as designed
  (`dup-init-1`→`source_id` kept, `dup-init-2`→`source_id` NULL;
  `dup-prop-1`→`registered_initiative_id` kept, `dup-prop-2`→ NULL), and a
  fresh duplicate insert afterward failed with
  `duplicate key value violates unique constraint`. Re-applying the migration
  a second time is a no-op. PASS.

## 6. AI-proposal-only / human-approval guards — verified, NOT modified

Read `server/src/services/audits/permissions.ts` and
`server/src/services/audits/aiProposalService.ts` directly (line numbers
re-checked against this HEAD, not assumed from the inventory):

- `assertAiMayCommit` (permissions.ts:455-461) hard-blocks
  `AI_NEVER_COMMITS` — confirmed to include `proposal.register` (line 452)
  alongside `criterion.conclude`, `finding.confirm`, `finding.close`,
  `finding.accept_residual_risk`, `verification.perform`,
  `output.finalize`, `report.approve`, `report.publish`. Called from
  `aiProposalService.ts:1252` inside `commit()`.
- `createIntent` (aiProposalService.ts:868-936) calls `assertHasSources`
  (aiProposalService.ts:287-295) at line 895 — an AI proposal without at
  least one source (evidence/criterion/finding) is rejected with
  `AUDIT_AI_NO_SOURCES` (422) before it is ever persisted.
- New independent test:
  `server/src/services/auditProgramHandoff/__tests__/aiBoundaryNegatives.test.ts`
  (4/4 PASS) — asserts the EXACT denial message for `proposal.register` (the
  capability this task's fix protects the downstream effect of) and for
  `verification.perform`, plus a sanity check that both are actually present
  in `AI_NEVER_COMMITS` (guards against a silently-emptied list), plus a
  positive control that `finding.draft` (a capability Teresa legitimately
  commits) is NOT blocked.

**Confirmation**: all "GOOD NEWS" claims about AI proposal-only / human
approval in the inventory are correct as read in this HEAD. Nothing here was
found weaker than described.

## 7. INTEGRATOR_CHANGE_REQUEST — application-level hardening (out of lane)

**Task**: harden `registerAsInitiative` at the application layer to match
the new DB constraint (defense in depth; the DB constraint alone is
sufficient today, this is a UX/observability improvement, not a
correctness gap).

- **File:line**: `server/src/services/audits/proposalService.ts:467-529`
  (`registerAsInitiative`).
- **Minimal hunk** (illustrative, not applied by this lane):
  ```ts
  // After createInitiative() succeeds, catch the specific unique-violation
  // from uq_initiatives_audit_source_once and surface a clearer message than
  // the generic "Kanoniczny kreator inicjatyw odrzucił rejestrację..." —
  // today a legitimate loss (e.g. a stale UI double-click) and a genuine
  // race both produce the same 422 text, which is correct but not
  // maximally informative for the auditor reading it.
  } catch (error) {
    const pgCode = (error as { code?: string })?.code;
    if (pgCode === '23505') {
      throw new AuditStateError(
        'Ta propozycja jest już rejestrowana przez inne, równoległe żądanie — odśwież i sprawdź status.',
      );
    }
    // ... existing fallback ...
  }
  ```
- **Reason**: today's generic 422 is CORRECT (never a false success, never
  an unhandled exception — proven by the tests above) but conflates "the
  canonical initiative creator rejected the input" (fixable by editing the
  proposal) with "someone else already registered this proposal
  concurrently" (not fixable by editing anything — the UI should just
  refresh). Splitting the two error paths would make the 409/422 easier to
  act on for whoever built the UI's error toast.
- **Consumer test**: extend
  `server/src/services/audits/__tests__/proposalService.test.ts` (kernel,
  not this lane) with a case asserting the SPECIFIC error code/message for
  the concurrent-conflict path, distinct from the generic creator-rejection
  path.

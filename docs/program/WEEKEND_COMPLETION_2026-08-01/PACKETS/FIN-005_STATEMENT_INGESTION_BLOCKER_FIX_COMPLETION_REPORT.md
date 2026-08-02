---
doc_id: FIN-005-statement-ingestion-blocker-fix
truth_type: operations
status: AWAITING_CODEX_REVIEW
owner: claude
process_owner: codex
product_owner: piotr
packet: FIN-005
branch: feat/fin-005-statement-ingestion-golden-flow
base_commit: 03f01021ac883e267c94485982a47abc7d7f98b0
head_commit: c741b0c0a9683413ff2dd4e5dc782fb9ff05fd57
last_reviewed: 2026-08-02
---

# FIN-005 — statement ingestion: round-3 blocker fix completion report

**Note on filename collision:** this is a DIFFERENT packet from the
pre-existing `FIN-005_DEMO_GOLDEN_FLOW_COHERENCE.md` in this same directory —
that file documents an unrelated Atelier/demo-coherence packet on a
different branch (`fix/fin-005-atelier-coherence`). Both happen to carry the
numeric id "FIN-005" (a known, previously-documented naming collision). This
report covers ONLY the statement upload -> extract -> map -> approve golden
flow on branch `feat/fin-005-statement-ingestion-golden-flow`.

No push, merge, deploy, Railway, or demo mutation was performed at any point
in this round. Everything below is local-worktree / local-Postgres only.

## 1. What round 3 found

Round 2 (already committed, HEAD `03f01021ac` at dispatch) had fixed three
real Codex-found blockers: fresh-schema bootstrap, concurrent idempotency via
`pg_advisory_xact_lock`, and content-hash key binding (409 on same-key,
different-file reuse). Codex's round-3 review found one more real gap round 2
missed.

`recordIdempotentUpload()` in `server/src/routes/finance-statements.routes.ts`
was explicitly documented as "best-effort": it caught **every**
non-schema-compat error from the marker INSERT and never re-threw. So if that
one INSERT failed for any reason, the surrounding
`withStatementUploadIdempotencyLock` transaction still committed — the
business writes (Statement + Pack) had already succeeded, a 201 was already
returned to the client — but **no durable marker existed**. A subsequent
retry with the same `Idempotency-Key` found nothing and redid the whole
upload, creating a duplicate Statement/Pack.

**Root cause** (confirmed by reading the code, not assumed): `dbRun()`
(`server/src/utils/DbPromise.ts`) routes every call through the GLOBAL
connection pool (`server/src/database/Database.js`'s `dbProxy`), which is a
**different connection** than the one `withStatementUploadIdempotencyLock`
holds its `pg_advisory_xact_lock` on via `getPoolClientForPinnedTransaction()`.
The marker write was therefore never actually inside the same Postgres
transaction as the lock to begin with — the "atomicity" of that specific
write was cosmetic. (This is structurally identical to every business write
in `performUpload()` too — `createStatement`, `syncStatementToPack`, etc. all
go through the same global pool and auto-commit per-statement — which is WHY
the chosen fix below does not try to force everything into one transaction;
see §2.)

## 2. Chosen design: reservation/result state machine

Per the dispatching session's decision (implemented as specified, not
redesigned): keep `pg_advisory_xact_lock` as the outer per-`(organizationId,
idempotencyKey)` serialization layer — unchanged, already correct, already
proven by the pre-existing `Promise.all` concurrency test and the
fail-then-retry reproduction. Underneath it, add a **durable
reservation/result state machine on the idempotency row itself**, because
forcing `performUpload()`'s entire multi-step pipeline (which spans several
service functions, all using the global pool) onto one pinned Postgres client
would be a much larger, riskier refactor than this problem needs — and it
would not actually fix anything, since the business writes already commit
independently of any transaction wrapper today.

### 2.1 Schema (additive)

`server/migrations/20260805_fin005_statement_upload_idempotency_state_machine.sql`
adds to `financial_statement_upload_idempotency`:

- `status TEXT NOT NULL DEFAULT 'completed'` — `'in_progress' | 'completed' |
  'failed'`, enforced by `CHECK` constraint `chk_fsui_status_values`. The
  `DEFAULT 'completed'` is safe with no backfill: every row that could exist
  before this migration ran was, by construction of the pre-existing code,
  written ONLY on a genuinely successful upload (the old
  `recordIdempotentUpload` was only ever called with `statusCode < 400`).
- `completed_at TIMESTAMP` — set only by the finalize step.
- `idx_fsui_org_key_status` index for the reclaim lookup.

Verified live against `consultinity_test` via the sanctioned migration path
(`npx tsx server/scripts/migrate.postgres.ts --safe --from
20260805_fin005_statement_upload_idempotency_state_machine.sql`) and,
independently, via the full fresh-schema bootstrap (§5).

### 2.2 Route logic (`server/src/routes/finance-statements.routes.ts`)

Replaces the old `findIdempotentUpload` / `recordIdempotentUpload` pair with:

- **`reserveIdempotentUpload(organizationId, idempotencyKey, requestHash,
  createdBy)`** — called from inside the lock. Attempts
  `INSERT ... status='in_progress' ... ON CONFLICT (organization_id,
  idempotency_key) DO NOTHING RETURNING *`.
  - Row returned -> caller is the durable **owner** of the reservation.
  - Conflict -> reads the existing row and branches:
    - `status='completed'` and hash matches (or predates the hash column) ->
      **replay** (same status/body, `Idempotency-Replayed: true`). Hash
      mismatch -> **conflict** (409 `IDEMPOTENCY_KEY_REUSED`, unchanged from
      round 2).
    - `status='failed'`, or `status='in_progress'` with
      `created_at < CURRENT_TIMESTAMP - INTERVAL '60 seconds'` (staleness
      cutoff, using the **database's** clock, not the app server's, to avoid
      any clock-skew risk) -> atomic reclaim via `UPDATE ... WHERE id=$1 AND
      (status='failed' OR (status='in_progress' AND created_at < cutoff))
      RETURNING *`. A returned row means this caller won the reclaim race and
      is now the owner of the SAME row (never a second row for the same
      key). `request_hash` is rebound to the reclaiming request — a
      failed/abandoned attempt never reached `'completed'`, so it never
      actually established a content binding for the key.
    - Otherwise (genuinely fresh `in_progress`, or the reclaim lost a race)
      -> **in_progress** (409 `UPLOAD_IN_PROGRESS`, retryable, `Retry-After:
      5`, zero business writes).
  - A schema-compat error on the reservation INSERT itself (missing table OR
    missing column — the INSERT references `status` directly, so either
    triggers it) -> **schema_missing**.
- **`finalizeIdempotentUpload({reservationId, statementId, statusCode,
  responseJson})`** — `UPDATE ... SET status='completed', statement_id=...,
  completed_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='in_progress'`. Never
  throws (a genuine DB error during this UPDATE is caught and logged, then
  treated as an unconfirmed write) and returns `false` unless the UPDATE is
  confirmed to have affected exactly one row. The route ONLY returns 201 when
  this returns `true`; otherwise it returns 500
  `STATEMENT_UPLOAD_FINALIZE_FAILED` and best-effort marks the row `'failed'`
  so the very next retry can reclaim it immediately rather than waiting out
  the staleness window.
- **`failIdempotentUpload(reservationId)`** — best-effort by design (must
  never mask the real error being returned to the client) but a REAL
  attempt: `UPDATE ... SET status='failed' WHERE id=$1 AND
  status='in_progress'`, with a loud `logger.warn`/`logger.error` on its own
  failure (unlike the old code, which silently swallowed everything). Called
  both when `performUpload()` throws and when it returns a controlled
  non-2xx outcome (e.g. signature-mismatch 422) without throwing — both are
  "failure" for idempotency purposes.
- **`cleanupUnpersistedUpload(filePath, reason)`** — best-effort
  `fs.promises.unlink` wrapped in try/catch, called on every exit path that
  does NOT result in a newly-persisted Statement: replay, 409 key-reuse, 409
  in-progress-retryable, 503 schema-missing. The success path never calls
  this — `file.path` becomes the Statement's permanent
  `sourceFilePath`/evidentiary source there.

The unkeyed path (`if (!idempotencyKey) { ... performUpload() directly ... }`)
is completely untouched — it never calls `reserveIdempotentUpload` and is
therefore unaffected by the schema-missing guard, exactly as required.

### 2.3 Why this is correct despite not using one big transaction

Because `pg_advisory_xact_lock` is held (via the pinned client's uncommitted
`BEGIN`) for the ENTIRE duration of `reserveIdempotentUpload` +
`performUpload()` + `finalizeIdempentUpload`/`failIdempotentUpload`, only ONE
request for a given `(organizationId, idempotencyKey)` can ever be inside
that sequence at a time. That serialization is what makes the
SELECT-then-branch-then-UPDATE reservation logic race-free without needing
its own database transaction — the reservation/finalize/fail statements each
commit durably and immediately (via the global pool, same as every other
write in this codebase), independent of whatever happens later in the same
request. If the process crashes between reservation and finalize/fail, the
pinned connection drops, the advisory lock releases immediately, and the
orphaned `'in_progress'` row ages into the 60-second staleness window for the
next retry to reclaim.

**Known, accepted tradeoff:** a finalize-UPDATE failure (rare, defensive
case) can leave an orphaned `financial_statements`/`financial_statement_packs`
row pair behind (created by `performUpload()`, which already committed by the
time finalize runs) with no completed marker referencing it. This is
inherent to NOT wrapping the whole pipeline in one transaction — the
dispatching session explicitly chose this tradeoff over the larger refactor.
It does not affect correctness of the idempotency contract itself: the next
retry for that key still reaches exactly one final `'completed'` marker
(proof 1, §4).

## 3. Files changed

- `server/migrations/20260805_fin005_statement_upload_idempotency_state_machine.sql`
  (new, additive)
- `server/src/routes/finance-statements.routes.ts` (idempotency helper block
  rewritten; `/upload` handler's post-lock logic rewritten)
- `tests/acceptance/odbior--fin005--statement-ingestion-golden-flow.e2e.test.ts`
  (7 new tests added; all pre-existing tests unchanged and still pass)

Confirmed via `git diff --stat 03f01021ac..HEAD` — no other file touched, no
FIN-01..04 file touched (in particular
`server/src/services/financialModelingService.ts` is untouched).

## 4. Fault-injection proofs (real Postgres, `consultinity_test`)

All four in
`tests/acceptance/odbior--fin005--statement-ingestion-golden-flow.e2e.test.ts`,
new "Round-3" section:

1. **Finalize failure** (`round-3 Proof 1`): a key-scoped `CHECK` constraint
   (`idempotency_key <> '<key>' OR status <> 'completed'`, `NOT VALID` so it
   only affects future writes for that literal key — zero effect on any
   other row/test) forces the finalize UPDATE for that key to fail.
   - Before/after evidence: the upload request returns `500
     STATEMENT_UPLOAD_FINALIZE_FAILED` (never 201); a direct DB query shows
     exactly one marker row with `status='failed'`, `statement_id IS NULL`
     (never silently `'completed'`). The constraint is then dropped ("fault
     no longer forced") and a retry with the same key succeeds (`201`); a
     final DB query shows the **same row id**, now `status='completed'`,
     `statement_id` matching the retry's response.
2. **Concurrent/sequential fault recovery** (`round-3 Proof 2`): a first
   attempt is made to fail mid-flight — after the reservation, before
   finalize — via the pre-existing "passes signature sniff, fails SheetJS
   parse" fixture (`422`, no throw caught by the route's own error path but
   still not a completed marker). A DB query confirms the row is
   `status='failed'` immediately after (no staleness wait needed to
   reclaim). A second, valid attempt with the same key then succeeds
   (`201`); direct DB queries confirm the end state is exactly ONE
   `financial_statements` row, ONE `financial_statement_packs` row, and ONE
   `'completed'` marker row for that key (same marker row id throughout —
   never two, never zero).
3. **Missing-schema fail-closed** (`round-3 Proof 3`): the `status` column is
   dropped from `financial_statement_upload_idempotency` for the duration of
   a single keyed request (restored in a `finally` regardless of outcome). A
   keyed upload returns `503 IDEMPOTENCY_SCHEMA_UNAVAILABLE`; a direct DB
   query for `financial_statements WHERE source_file_name = ...` returns
   ZERO rows (not inferred from the HTTP status — queried directly, per the
   requirement). A companion test confirms the SAME missing column has zero
   effect on the UNKEYED path (still `201`).
4. **Round-2 proofs re-confirmed unchanged**: `Promise.all` same-key
   concurrency (exactly one Statement/Pack/marker), reuse-with-different-file
   (409), over-length key (400, not truncated, including the two-different-
   keys-sharing-a-truncated-prefix negative control), fresh-schema bootstrap
   via the sanctioned migration path only. All still pass unmodified.

Additional coverage beyond the four required proofs (same file, same
"Round-3" section):
- A genuinely fresh (non-stale) `in_progress` reservation, inserted directly
  to simulate a real concurrent in-flight owner, is correctly REJECTED
  (`409 UPLOAD_IN_PROGRESS`, `Retry-After` header present) rather than
  reclaimed — and creates no Statement.
- A STALE `in_progress` reservation (`created_at` 10 minutes in the past,
  far past the 60s cutoff) IS reclaimed by a new request and completes
  normally, reusing the same row id.
- Requirement 8 (temp-file cleanup): a real filesystem before/after directory
  diff (not just "no crash") proves the multer temp file is deleted on
  every one of the four non-persisting exit paths (replay, 409 reuse, 409
  in-progress, 503 schema-missing) while the genuinely new upload's file is
  kept (it becomes the Statement's `source_file_path`).

## 5. Test results (exact commands, real output)

All commands run from the worktree root
(`/private/tmp/consultify-fin-005-ingestion`) against the pre-existing local
Postgres 16 instance at `localhost:5432` (native Homebrew install, NOT any
Docker container — `postgresql@16` via `brew`), database `consultinity_test`,
role `consultinity`. `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres` forces
the real driver (per this repo's own documented "silent mock DB" trap).

### 5.1 Fresh-schema bootstrap (unmodified sanctioned script)

```
JWT_SECRET=development_secret_key_change_in_production_abc123xyz \
  node scripts/testing/run-fin005-fresh-schema-check.mjs
```

```
 Test Files  1 passed (1)
      Tests  2 passed (2)

[FIN-005 fresh-schema] PASSED — sanctioned migration path alone is sufficient.
```

Recreates a disposable `consultinity_test_fin005_fresh` database, runs ONLY
`npx tsx server/scripts/migrate.postgres.ts --safe` (no manual
`never-ran/668`/`669`), and passes both the XLSX and CSV golden flows. This
independently re-proves my new `20260805` migration is picked up correctly
by the sanctioned migration path alongside everything else.

### 5.2 FIN-005 + FIN-003A acceptance suites together

```
DATABASE_URL="postgresql://consultinity:consultinity@localhost:5432/consultinity_test" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
POSTGRES_SKIP_INIT_IN_TEST=true DISABLE_SCHEDULER=true \
JWT_SECRET=development_secret_key_change_in_production_abc123xyz \
  npx vitest run --config vitest.acceptance.config.ts \
  tests/acceptance/odbior--fin005--statement-ingestion-golden-flow.e2e.test.ts \
  tests/acceptance/odbior--fin003a--statement-import.e2e.test.ts \
  --retry=0
```

```
 Test Files  2 passed (2)
      Tests  23 passed (23)
```

FIN-005 file: 21/21 (14 pre-existing + 7 new round-3 tests, listed in §4).
FIN-003A file: 2/2 unchanged. Re-ran the FIN-005 file alone a second time
independently to check for flakiness in the timing-sensitive staleness/
reclaim tests — stable, 21/21 both times.

### 5.3 Frontend CSV-reachability component test (unchanged)

```
npx vitest run tests/components/Finance/FinancialStatementImportWizard.fin005-csv-reachability.test.tsx
```

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

Not touched by this round's changes; re-run only to confirm no regression.

### 5.4 XLSX and CSV golden flow

Both covered by the "XLSX golden flow" and "CSV golden flow" tests in §5.2 —
both pass.

### 5.5 FIN-03/04 regression scope check

Not applicable as a suite run (different branch), per the dispatching
session's instruction. Instead, confirmed via `git diff --stat
03f01021ac..HEAD` (§3) that no file outside this branch's FIN-005 scope was
touched — in particular `server/src/services/financialModelingService.ts`
(FIN-03/04's file) is untouched.

### 5.6 Scoped typecheck (touched files only)

```
npx tsc --noEmit -p server/tsconfig.json --skipLibCheck 2>&1 | grep -i "finance-statements.routes"
```
-> no output (zero errors in the touched route file). A full-repo `tsc` run
has pre-existing, unrelated errors across dozens of files outside this
branch's scope (per this repo's own documented `tsc` full-run caveat) — not
something this round introduced or is responsible for gating on.

Also ran `npx esbuild` per-file (this repo's documented fast robotnik gate)
on both the route file and the modified test file — both build clean with
zero errors, both before and after the final edits.

### 5.7 Build

```
cd server && npm run build   # tsc --noCheck — passes silently
cd .. && npm run build       # build:shared + vite build
```

Both complete successfully; the frontend `vite build` (run in background,
confirmed via its own completion log) finishes with exit code 0 and produces
the full `dist/` bundle. This branch does not touch any frontend file, so
this is a regression check only.

### 5.8 `git diff --check`

```
git diff --check HEAD~3 HEAD
```
-> exit 0, no whitespace errors.

### 5.9 Secret scan

```
git diff HEAD~3 HEAD | grep -nE "AKIA|sk-[A-Za-z0-9]{10,}|-----BEGIN|password\s*=\s*['\"][^'\"]+['\"]"
```
-> no matches (grep exit 1 = nothing found) across the full 3-commit diff.

### 5.10 Clean tree

```
git status --short
```
-> empty output after each commit. `junit.xml` (written to repo root by one
of the `vitest` invocations above) is gitignored and does not appear in
`git status`.

## 6. Explicit scope confirmation

- **No push.** `git remote -v` shows `origin` configured but no push was
  executed; the branch has no upstream tracking ref established this
  session.
- **No merge.** `origin/demo`/`Londyn` untouched.
- **No deploy, no Railway, no demo mutation.** Every command above targets
  ONLY the local Postgres instance at `localhost:5432` — the connection
  guards in both the pre-existing test files (`guardedDatabaseUrl()`) and
  the fresh-schema script (`assertNoPrivateRailwayDbHostOutsideRailway`,
  hostname allowlist) independently enforce this; none were bypassed or
  modified.
- **No new branch, no new worktree.** Everything happened on the
  pre-existing worktree at `/private/tmp/consultify-fin-005-ingestion`, on
  the pre-existing branch `feat/fin-005-statement-ingestion-golden-flow`.
- **No FIN-01..04 file touched, no RBAC/other Finance follow-ups attempted.**

## 7. Commits (this round)

```
f287f6c877  feat(FIN-005): add reservation/result state machine columns for upload idempotency
49b60c43a6  fix(FIN-005): replace best-effort idempotency marker write with a durable reservation/result state machine
c741b0c0a9  test(FIN-005): fault-inject the round-3 reservation/result state machine
```

Final HEAD: `c741b0c0a9683413ff2dd4e5dc782fb9ff05fd57`. Branch/HEAD
re-confirmed via `git branch --show-current` / `git rev-parse HEAD` before
each commit in this round.

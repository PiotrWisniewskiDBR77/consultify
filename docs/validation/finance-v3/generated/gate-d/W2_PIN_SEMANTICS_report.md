# W2-PINSEMANTICS — resolving the `NO_CONTENT_HASH` vs W10-D01 semantic conflict

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`.
**Conflict origin:** `docs/validation/finance-v3/generated/gate-d/W10_D01_SEMANTIC_HASH_FIX_report.md`
(W10-D01, `artifactVersionService.createArtifact()` stamping `content_semantic_hash` at birth) vs
`computePinning.ts`'s pre-existing `NO_CONTENT_HASH` gate
(`server/src/services/finance/collaboration/__tests__/collaboration.pg.test.ts`,
`computePinning.enqueueComputeForCurrentRevision > pins to the CURRENT content_semantic_hash...`).
**Date:** 2026-08-10.
**Worktree:** `/Users/piotrwisniewski/consultify-wt/w2-pinsemantics`, branch `codex/finance-v3-w2-pinsemantics`.
**Base:** `403d430520`.
**Final commit:** `ee1c9f69f4` (report commit follows this one).
**Frozen baseline respected:** `codex/finance-v3-closeout-fanin` @ `19b4b06934` was neither touched nor
merged. No staging/demo/production database was touched — all work and all evidence in this report is
against a private ephemeral Postgres 15 cluster (`PGDATA=/private/tmp/fv3-pin-pgdata`, port `57721`).

Files touched: `server/src/services/finance/canonical/contentHash.ts` (new exported constant),
`server/src/services/finance/canonical/artifactVersionService.ts` (`createArtifact()` — uses the new
constant instead of an inline expression, comment rewrite only, same byte value),
`server/src/services/finance/collaboration/computePinning.ts` (the gate itself — logic change).
No UI/frontend code touched (CLAUDE.md rule #7). `computeJobService.ts`, the four compute-engine
services' `completeJobSuccess()` handling, and RLS migrations (the four reserved areas) were not touched.

---

## 1. What `createArtifact()` actually stamps — read from the live DB, not from code

`createArtifact()`'s `revision_seq=1` INSERT sets `content_semantic_hash` to
`canonicalPayloadHash({ unsavedOperationStack: [] })` — a fixed SHA-256 of the literal JSON string
`{"unsavedOperationStack":[]}`. This is **not derived from the artifact's identity** (no artifact_id,
org_id, or timestamp enters the hash) — it is the same 64-hex-char value for every brand-new artifact
of every type, in every organization. Confirmed empirically (independent `psql`/`pg` reads against the
worktree's own ephemeral cluster, not the value returned by any service call):

```
independent DB read of a freshly created BASELINE_MODEL's revision_seq=1 row:
  revision_seq: '1'
  content_semantic_hash: '2c9caaa325ad76029788f009064f717f69ee44655a27e9a0b5e608ecb6ff8a6c'
  compute_run_id: null
```

The same 64-char value (`2c9caaa3...`) was independently observed on ten separate `APPROVED`
`HISTORICAL_ANALYSIS`/`STATEMENT_PACK` business versions already sitting in the same database from an
unrelated test file's runs (`canonicalServices.pg.test.ts`), confirming it is a constant, not
per-artifact — see §6 for why that specific set is a pre-existing, unrelated fact, not something this
fix introduced or needs to close.

`autosaveService.checkpointOperationStack()` produces this **exact same value** whenever it is called
with an empty `unsavedOperationStack` (e.g. a genuine `EXPLICIT_SAVE` after the user has undone every
pending change back to a no-op) — the hash function only ever sees the operation-stack payload, never
who wrote the row or why.

---

## 2. Resolution: (a), (b), or a third option — and why

**Rejected: (a) — `createArtifact()` does NOT stamp; bramka stays `IS NOT NULL`.**
Disproved directly by a real production code path, not a hypothetical: `canonicalServices.pg.test.ts`'s
"the full T2->T4 transition chain then approveVersion succeeds and freezes a compute snapshot" test
takes a `HISTORICAL_ANALYSIS` artifact through `submit_for_review -> start_review -> approve` and
reaches `APPROVED` **without ever calling `checkpointOperationStack()` or any compute engine** — only a
raw `freshness = 'CURRENT'` UPDATE stands in for "compute happened", which is exactly what a real
Statement-Pack/compute completion does in production too (freshness is a `finance_business_versions`
column set from the same place). If `createArtifact()` did not stamp a hash, `approveVersion()` would
copy the still-NULL working-revision hash onto `finance_business_versions`/`finance_compute_snapshots`
on this path — **reintroducing the exact D01 defect** the prior fix closed. Option (a) is not just a
worse choice, it is provably wrong: it un-fixes a real, already-diagnosed production gap.

**Chosen: (b) — `createArtifact()` keeps stamping; the gate stops using hash-nullness as a proxy for
"has real content" and checks a structural fact instead.**

First attempt at (b) (comparing the hash to the known "empty content" sentinel value by identity) was
**also wrong** and caught by re-running the full test suite before declaring success (see §3 — this is
exactly the kind of thing the negative-control protocol exists to catch): §1 above shows the "empty
content" hash and "an intentional EXPLICIT_SAVE checkpoint of a no-op edit" are byte-identical, and
`concurrencyMatrix.pg.test.ts`'s A4 test (`pins the job to ONE snapshot hash; the edit never bleeds into
the pinned job`) explicitly checkpoints with `unsavedOperationStack: []` via `EXPLICIT_SAVE` and expects
the pin to succeed. Content-hash equality **cannot** distinguish "this working revision was never
touched" from "this working revision was touched and happened to end up at the empty-content hash" —
the hash function has no visibility into which writer produced the row.

**Final gate (`computePinning.ts`):** `finance_working_revisions` has exactly one writer that produces
`revision_seq = 1` AND leaves `compute_run_id` NULL — `createArtifact()`. Every other writer fails at
least one half of that pair:
- `checkpointOperationStack()` (`autosaveService.ts`) always INSERTs a **new** row at
  `revision_seq = previous + 1` (copy-on-write per checkpoint, regardless of stack content).
- `stampWorkingRevisionComputeIdentity()` (`artifactVersionService.ts`, called by all four compute
  engines and `statementReconciliationService.ts`) always sets `compute_run_id` on the row it touches.
- `reopenVersion()`'s copy-on-write INSERT always lands at `revision_seq > 1` and copies its source
  revision's `compute_run_id` forward.

The gate now checks: `content_semantic_hash IS NOT NULL` (defensive legacy-row check, always true for
any row born after this program) **AND** (`revision_seq > 1` **OR** `compute_run_id IS NOT NULL`). This
is an exact structural test for "not the `createArtifact()` birth row", immune to hash-value collision
by construction — it never inspects the hash's value, only who wrote it and when.

---

## 3. Three proofs — each an independent DB read, never a service return value

All three ran against the worktree's own ephemeral cluster (`postgresql://postgres@127.0.0.1:57721/fv3_pin`),
committed state `ee1c9f69f4`.

### (i) The gate still lives — empty artifact rejected, checkpointed artifact accepted

Standalone script (`npx tsx`, not vitest — deliberately outside the test harness so nothing but raw
`pg.Client` reads are trusted):

```
independent DB read of birth row:
  revision_seq: '1', content_semantic_hash: '2c9caaa3...', compute_run_id: null
enqueue on empty artifact -> { ok: false, code: 'NO_CONTENT_HASH', message: '...' }
independent DB read after checkpoint:
  revision_seq: '2', content_semantic_hash: '458d1441...', compute_run_id: null
enqueue after checkpoint -> true 458d1441...
independent DB read of compute_jobs.input_revision_hash: { input_revision_hash: '458d1441...' }
PROOF (a) PASSED.
```

The pinned hash read back from `compute_jobs.input_revision_hash` (an independent `SELECT`, not the
value `enqueueComputeForCurrentRevision()` returned) matches the working revision's own
`content_semantic_hash` at the time — confirms the gate rejects the birth row and accepts a real
checkpoint, and that the pin actually lands in the DB with the right value.

Additionally: `collaboration.pg.test.ts`'s own target test (`pins to the CURRENT content_semantic_hash,
and a later edit gets a DIFFERENT pinned hash`) — the exact test this whole task exists to fix —
**passes**, and `concurrencyMatrix.pg.test.ts`'s A4 test (the one the first, wrong, identity-comparison
attempt broke) also **passes**, both confirmed via `--no-file-parallelism` runs against real Postgres.

### (ii) The D01 invariant holds — approved GOLDCO artifacts have non-empty hash + run id

`coldReopen.pg.test.ts` (FC-05.8, FC-07.9, FC-12.4, FC-NEG) is exactly D01's own invariant proof suite:
it builds a real Statement -> Analysis -> Baseline -> Prediction -> Valuation chain through the actual
production services (real compute engines, real `approveVersion()`), closes the writer's connection
pool, waits for the backend PIDs to physically disappear (`pg_stat_activity` polling from an independent
`pg.Client`), then re-reads everything from a **separate OS process** (`npx tsx
coldReopenReader.ts`), and asserts non-null/non-empty `content_semantic_hash` and `compute_run_id` on
every `finance_business_versions`, `finance_working_revisions`, and `finance_compute_snapshots` row in
the chain (`assertHashAndRunId()`, lines 127-148 of that file).

Ran in isolation against this worktree's changes: **4/4 tests passed** (37.71s). This is the strongest
available proof because it predates this fix (it is D01's own acceptance suite) and this session did not
touch it — a pass here means my gate-logic change did not regress D01's guarantee.

Independent `psql` read on the top 5 most-recently-approved business versions (real-compute-chain
artifacts, i.e. the ones `coldReopen.pg.test.ts` produces) confirms both columns non-null/non-empty:

```
 status   | bv_hash_present | bv_hash_nonempty | bv_run_present | bv_run_nonempty
----------+-----------------+------------------+-----------------+-----------------
 APPROVED | t               | t                | t               | t
 APPROVED | t               | t                | t               | t
 APPROVED | t               | t                | t               | t
 APPROVED | t               | t                | t               | t
 APPROVED | t               | t                | t               | t
```

### (iii) Snapshot uniqueness still works — literal duplicate rejected by the DB

Independent DB reads/writes via raw `pg.Client` (not through any service):

```
first snapshot insert OK: 88da75e3-7d10-4aed-9bf9-7ddf9329f9a5
duplicate (working_revision_id, compute_run_id) insert -> REJECTED
raw DB error: 23505 duplicate key value violates unique constraint "uq_finance_compute_snapshots_revision_run" (constraint: uq_finance_compute_snapshots_revision_run)
PROOF (c) PASSED.
```

`content_semantic_hash`/`compute_run_id` are non-null on every row this fix's code path writes (§1, §3.i,
§3.ii above), so the `UNIQUE (working_revision_id, compute_run_id)` constraint
(`20260809_finance_v3_b06_reproducibility_retention_export.sql:45`) has real, non-NULL values to compare
on both sides — Postgres never treats `NULL = NULL` as a match for `UNIQUE`, so a NULL `compute_run_id`
would have silently let duplicates through (D01's original finding). This confirms the fix did not
reopen that hole.

---

## 4. Negative control — mandatory, run before declaring success

```
$ git checkout 403d430520 -- server/src/services/finance/canonical/artifactVersionService.ts \
    server/src/services/finance/canonical/contentHash.ts \
    server/src/services/finance/collaboration/computePinning.ts
$ npx vitest run --config vitest.config.ts \
    src/services/finance/collaboration/__tests__/collaboration.pg.test.ts \
    src/services/finance/canonical/__tests__/concurrencyMatrix.pg.test.ts --no-file-parallelism
```

Result: **RED**, reproducing the exact original symptom —

```
FAIL  src/services/finance/collaboration/__tests__/collaboration.pg.test.ts
  > pins to the CURRENT content_semantic_hash, and a later edit gets a DIFFERENT pinned hash
AssertionError: expected { ok: true, job: {...}, ... } to deeply equal { ok: false, ... }
- Expected  "code": "NO_CONTENT_HASH", ... "ok": false
+ Received  "ok": true, "pinnedContentSemanticHash": "2c9caaa3...", ...
Test Files  1 failed | 1 passed (2)
     Tests  1 failed | 16 passed (17)
```

Then restored (`git checkout ee1c9f69f4 -- <the 3 files>`) and re-ran the same two files: **GREEN, 2
passed (2), 17 passed (17)**. `git status --short` after restore showed zero diff against
`ee1c9f69f4` (clean).

This also incidentally re-validates the "first attempt at (b) was wrong" finding from §2: the first
sentinel-identity version of the fix was caught by re-running the FULL `src/services/finance` suite (not
just the target test) before committing, which turned up the A4 regression — the negative-control
protocol here is against the *final* fix only, since the intermediate wrong attempt was never committed
in isolation (it was corrected before the first commit landed).

**DB gate sanity** (required by the session brief): running the same test file with none of
`RUN_DB_TESTS`/`MOCK_DB`/`DATABASE_URL` set gives `1 skipped (1)`, `13 skipped (13)` — never `passed`.

---

## 5. Full-suite numbers (this worktree, `ee1c9f69f4`, ephemeral cluster port 57721)

| Command | Result |
| --- | --- |
| Migrations STRICT (`migrate.postgres.ts`, no `--safe`), fresh cluster | exit 0, 633 migrations applied |
| Migrations STRICT, idempotent re-run (sanity) | exit 0, "Applying migrations: 0" |
| `cd server && ... vitest run --config vitest.config.ts src/services/finance --no-file-parallelism` | **41/41 files, 689/689 tests, exit 0** (190.23s) |
| `cd server && ... vitest run --config vitest.config.ts src/services/finance/canonical --no-file-parallelism` | **31/31 files, 421/421 tests, exit 0** (159.88s) — no regression vs the session's own baseline |
| `npx tsc --noEmit -p server/tsconfig.json` | exit 0 |
| Target test alone + A4 alone | 2 files, 17/17 passed |

All commands run synchronously in this session (not backgrounded), per the coordinator's explicit
instruction after an earlier background-task collision (two concurrent `vitest` runs against the same
ephemeral DB produced a corrupted/interleaved log and were killed and re-run cleanly — see §7).

---

## 6. Honest caveat — a pre-existing, unrelated fact this fix did not create or need to fix

An independent `psql` query against the same database also found **five** `APPROVED`
`HISTORICAL_ANALYSIS`/`STATEMENT_PACK` business versions with `content_semantic_hash` = the empty
sentinel (non-null, satisfies D01's literal "not NULL" guarantee) **and `compute_run_id` = NULL**. These
come from `canonicalServices.pg.test.ts`'s test-only `freshness = 'CURRENT'` bypass path described in
§2 (option (a) rejection) — a test convenience that never calls `checkpointOperationStack()` or any real
compute engine, so `compute_run_id` genuinely has nothing to be set to.

This is **not a regression from this fix**: `git diff 403d430520 -- artifactVersionService.ts` shows
`approveVersion()` is byte-for-byte unchanged, and `createArtifact()`'s stamped value is unchanged
(same expression, only refactored to a named constant) — this exact behavior exists identically at the
parent commit. It is also outside D01's own scope, which is specifically about the five **real,
compute-engine-driven** GOLDCO artifacts `coldReopen.pg.test.ts` verifies (§3.ii), not test-only
shortcut paths that no real UI action can reach (a real approval requires `freshness = 'CURRENT'`,
which in production is only ever set by real compute/reconciliation completion, which always calls
`stampWorkingRevisionComputeIdentity()`). Flagging this explicitly rather than silently rounding it
into "invariant holds everywhere" — `EVIDENCE_MISSING` for "does this test-only bypass path reflect a
gap in a REAL production trigger/service", not investigated further as it is out of this task's scope
(no such gap is visible in the reachable production call graph, but this was not exhaustively proven).

---

## 7. Collision points / environment notes

- Two concurrent `vitest run src/services/finance` invocations were briefly running against the same
  ephemeral DB and the same log file mid-session (one backgrounded-then-orphaned, one freshly started).
  Both were killed (`kill -9`) before either produced a trusted result, and the suite was re-run clean,
  synchronously, once. No result in this report comes from the collided run.
- No files outside this session's stated territory (`artifactVersionService.ts`'s `createArtifact()`,
  `computePinning.ts`, `autosaveService.ts` — untouched — and tests) were modified.
  `computeJobService.ts`, the four compute engines' `completeJobSuccess()` handling, and RLS migrations
  were not touched, per the reservation for parallel agents.
- `EMPTY_WORKING_REVISION_CONTENT_HASH` is exported from `contentHash.ts` for documentation/tests only,
  with an explicit doc-comment warning against using it for identity comparison (the exact mistake this
  report's §2 describes making and catching before commit).

---

## Reproduction

```bash
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3-pin-pgdata ; PGSOCK=/tmp/fv3pinsock ; PORT=57721
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3pin_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_pin;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/fv3_pin"
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts

cd server
DATABASE_URL="$DBURL" RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
  npx vitest run --config vitest.config.ts src/services/finance --no-file-parallelism
DATABASE_URL="$DBURL" RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
  npx vitest run --config vitest.config.ts src/services/finance/canonical --no-file-parallelism
npx tsc --noEmit -p tsconfig.json   # run from repo root as: npx tsc --noEmit -p server/tsconfig.json
```

## EVIDENCE_MISSING

- Whether any REAL (non-test-only) production trigger could ever set `finance_business_versions.freshness
  = 'CURRENT'` without a prior `stampWorkingRevisionComputeIdentity()`/`checkpointOperationStack()` call
  was not exhaustively proven — only the reachable call graph was checked (§6). No such path was found,
  but "not found" is not "proven absent".

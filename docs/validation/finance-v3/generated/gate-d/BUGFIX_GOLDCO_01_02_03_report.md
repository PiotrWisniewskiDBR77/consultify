# Fix report — BUG-GOLDCO-01/02/03 (GoldCo gold vertical slice findings)

**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Date:** 2026-08-09
**Source of the three findings:** `docs/validation/finance-v3/generated/gate-d/GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md`
section 6 (all three bugs found live, reproduced against a real ephemeral Postgres, documented but
NOT fixed in that WP — this report closes them out).
**Status:** all three fixed and verified live. No escalation needed — the BUG-GOLDCO-03 "deeper
transaction-model rework" trigger condition in the task brief was NOT hit; a step-reordering fix
inside the existing single transaction was sufficient (see section 1 for why).

---

## 1. BUG-GOLDCO-03 (P0, blocking) — no reopened/restated version could ever reach APPROVED

**File:** `server/src/services/finance/canonical/artifactVersionService.ts`, `approveVersion()`.

### What was wrong

`approveVersion()`'s single transaction flipped the **child** row to `APPROVED` (step (c)) before
demoting the **parent** to `SUPERSEDED` (T9), in that order. `uq_finance_bv_one_approved`
(`server/migrations/20260809_finance_v3_b01_core_artifacts.sql:143`) is a partial `UNIQUE INDEX`
(`ON finance_business_versions (artifact_id) WHERE status = 'APPROVED'`), not a table `CONSTRAINT` —
Postgres does not allow `DEFERRABLE` on an index with a `WHERE` predicate, so its uniqueness check
fires at the end of **each** `UPDATE` statement, not at `COMMIT`. Since `reopenVersion()` only ever
reopens an `APPROVED` row, the parent is *always* still `APPROVED` the instant the child's own
`UPDATE ... SET status='APPROVED'` runs — the unique index rejected it immediately with a raw
`23505` error, before T9 ever got a chance to execute. This blocked **every** reopen-then-approve
in the whole schema, not just restatements.

The WP-B02 ADR's own §5 sequence diagram had the **same** latent bug: it showed T9 running
*after* `COMMIT`, as a "poza tą transakcją, best-effort" step — but that doesn't help either, since
the child's own `UPDATE` (step (c), still inside the transaction, still before that commit) already
collides with the still-`APPROVED` parent the moment it runs, regardless of whether T9 later runs
inside or outside the same transaction. So this was a bug in **both** the ADR's documented design
and the shipped implementation, not just an implementation slip against a correct ADR.

### Why a step-reorder was sufficient (no deeper transaction-model rework needed)

`uq_finance_bv_one_approved` is scoped `ON (artifact_id) WHERE status = 'APPROVED'` — per-artifact,
and a reopened child always shares its parent's `artifact_id`. Moving the parent-supersede `UPDATE`
to run **before** the child's `UPDATE ... SET status='APPROVED'`, within the same transaction,
means the parent is already `SUPERSEDED` (removed from the partial index) by the time the child
tries to claim the "one APPROVED per artifact_id" slot — at no point in the transaction do two rows
for the same `artifact_id` both show `status='APPROVED'`. A plain, non-deferred unique index is
therefore sufficient; no `DEFERRABLE INITIALLY DEFERRED` conversion (table constraint or constraint
trigger) was needed, and none was added.

### Fix

- `artifactVersionService.ts`, `approveVersion()`: moved the `if (current.parent_version_id) { UPDATE ... SET status='SUPERSEDED' ... }` block to run immediately after step (b) (freeze compute
  snapshot) and **before** step (c) (child status transition), still in the same transaction.
  Updated the function's doc comment to describe the corrected 5-step order.
- `docs/validation/finance-v3/generated/gate-b/WP-B02_lifecycle_concurrency_ADR.md`: corrected —
  §5 sequence diagram now shows T9 running before step (c), inside the transaction, not as a
  post-commit best-effort step; §5.1 gained a new numbered point (3) explaining the ordering
  requirement and citing this fix; §5.2's failure table replaced the "T9 may fail post-commit as a
  separate small transaction" row (a wrong assumption) with a row explaining T9 is now part of the
  atomic transaction; §6.4 updated to match.

### Regression test

`server/src/services/finance/canonical/__tests__/canonicalServices.pg.test.ts`, new test
`'approving a reopened vN+1 reaches APPROVED and supersedes vN (BUG-GOLDCO-03)'`
(`describe('artifactVersionService.reopenVersion — WP-B02 §6, non-mutating')`): creates an
`APPROVED` version, reopens it, drives the child DRAFT → READY_FOR_REVIEW → IN_REVIEW, then calls
`approveVersion()` — asserts `approved.ok === true`, `businessVersion.status === 'APPROVED'`, and
that the parent, re-read via `getBusinessVersion()`, is now `status='SUPERSEDED'` with
`superseded_by_version_id` pointing at the child and `superseded_at` set.

**Confirmed failing pre-fix, passing post-fix**: ran with the fix stashed out
(`git stash push -- server/src/services/finance/canonical/artifactVersionService.ts`) against the
same migrated cluster — the new test threw the exact `uq_finance_bv_one_approved` unique-violation
and failed; `git stash pop` restored the fix and the test passed (see section 4 for the run logs).

---

## 2. BUG-GOLDCO-02 (P0) — balance/roll-forward triggers never checked STANDALONE-scope rows

**File:** `server/migrations/20260809_finance_v3_d01_statements_02_integrity.sql`,
`finance_stmt_check_balance()`, `finance_stmt_check_cash_rollforward()`,
`finance_stmt_check_retained_earnings_rollforward()`.

### What was wrong

All three constraint-trigger functions hardcoded their cross-row lookups to
`consolidation_scope = 'CONSOLIDATED'`. `finance_stmt_lines.consolidation_scope` has three legal
values (`STANDALONE`/`CONSOLIDATED`/`ELIMINATION`, WP-D01 ADR §4.5) — a Statement Pack mapped at
`STANDALONE` (the schema's own documented scope for a genuine single-entity, non-consolidated pack
— i.e. most real-world statement packs) never triggered the Assets=Liabilities+Equity check, the
cash roll-forward check, or the retained-earnings roll-forward check at all. Confirmed live in the
original GoldCo slice: a PLN 50,000,000 imbalance was silently accepted at `STANDALONE` scope and
correctly rejected at `CONSOLIDATED` scope for an otherwise identical row set.

### Fix

New **additive** migration
`server/migrations/20260809_finance_v3_d01b_statements_02b_integrity_scope_fix.sql` (the
already-applied `..._02_integrity.sql` was NOT edited, per this program's migration discipline —
fresh-install vs upgrade-replay parity). It `CREATE OR REPLACE FUNCTION`s the three trigger
functions, replacing the hardcoded `consolidation_scope = 'CONSOLIDATED'` literal with
`consolidation_scope = NEW.consolidation_scope` in every lookup, and adds an explicit
`IF NEW.consolidation_scope = 'ELIMINATION' THEN RETURN NULL` early-out (elimination buckets carry
one-sided per-`canonical_line_id` adjustment legs, not a full balance sheet or roll-forward chain —
they already have their own dedicated debits=credits check, §8.5
`finance_stmt_check_elimination_balance`, which was already scoped correctly and is untouched).
This is a strict widening of coverage: `CONSOLIDATED`-scope rows get exactly the same checks as
before (`NEW.consolidation_scope = 'CONSOLIDATED'` behaves identically to the old literal for a
`CONSOLIDATED` row); `STANDALONE`-scope rows now get checked for the first time.

The existing triggers (`trg_finance_stmt_check_balance`,
`trg_finance_stmt_check_cash_rollforward`, `trg_finance_stmt_check_re_rollforward`) already point at
these function names — no `DROP`/`CREATE TRIGGER` was needed, only the function bodies changed.
File-sort-verified to run after `..._03_readiness.sql` in the migration runner's same-day
filename tiebreak (confirmed live — see section 4).

### Regression test

`server/src/services/finance/canonical/__tests__/statementServices.pg.test.ts`, new describe block
`'BUG-GOLDCO-02 fix — balance check now fires for STANDALONE scope, not just CONSOLIDATED'`, three
tests:
1. A PLN 50,000,000 imbalance at `consolidationScope: 'STANDALONE'` is now rejected
   (`rejects.toThrow(/balance check failed/)`).
2. The same imbalance at `consolidationScope: 'CONSOLIDATED'` is still rejected (no regression on
   the already-checked scope).
3. A balanced pack at `consolidationScope: 'STANDALONE'` still commits cleanly (the fix does not
   over-reject).

**Confirmed failing pre-fix, passing post-fix**: ran test 1 against a second, separate ephemeral
cluster migrated WITHOUT the new fix-forward migration file present (temporarily moved out of
`server/migrations/`) — it failed because the STANDALONE imbalance was silently accepted (no
throw). Restored the migration file, re-ran against the fix cluster — passed (see section 4).

---

## 3. BUG-GOLDCO-01 (P1) — `reopenVersion()` could not set `version_kind='RESTATED'`

**File:** `server/src/services/finance/canonical/artifactVersionService.ts`, `reopenVersion()`.

### What was wrong

WP-B06's ADR (§4.2) documents the restatement mechanism as "reopen (B02 T12) z dodatkowymi
metadanymi... `versionKind: 'RESTATED'`" and WP-B06's migration
(`20260809_finance_v3_b06_reproducibility_retention_export.sql:74-86`) shipped the
`version_kind`/`restatement_reason`/`restatement_class` columns (plus the
`chk_finance_bv_restatement_reason` CHECK requiring reason+class together when `RESTATED`) for
exactly that purpose. But `ReopenVersionParams` and the `INSERT INTO finance_business_versions`
statement inside `reopenVersion()` had no such fields at all — every reopened version, restatement
or not, silently defaulted to `version_kind='ORIGINAL'` (the column's own DB default), with no way
for a caller to mark a restatement as a restatement through the service layer.

### Fix

- `ReopenVersionParams` gained three new optional fields: `versionKind?: 'ORIGINAL' | 'RESTATED'`,
  `restatementReason?: string`, `restatementClass?: RestatementClass`. `'MANAGEMENT_ADJUSTED'` is
  intentionally excluded from the reachable type — WP-B06 §4.4 models it as a separate
  `artifact_id`, not a `version_kind` reachable via reopen.
- Added application-level validation mirroring the DB's own
  `chk_finance_bv_restatement_reason` CHECK: `versionKind: 'RESTATED'` without both
  `restatementReason` and `restatementClass` now returns a structured
  `{ ok: false, code: 'RESTATEMENT_METADATA_REQUIRED' }` instead of surfacing a raw Postgres
  check-violation from inside the transaction.
- The `INSERT INTO finance_business_versions` statement for the new `vN+1` row now includes
  `version_kind, restatement_reason, restatement_class` — `versionKind` defaults to `'ORIGINAL'`
  when omitted (matching WP-B06 §4.2's own default rule: "version_kind nie jest dziedziczone
  automatycznie... domyślnie nowy vN+1 też jest ORIGINAL"), and `restatement_reason`/
  `restatement_class` are only populated when `versionKind === 'RESTATED'`.
- `BusinessVersionRow` (and the new `VersionKind`/`RestatementClass` exported type aliases) now
  include these three fields — they existed in the DB since WP-B06 but were missing from the
  TypeScript row shape, which is part of why this gap was invisible at the type level.

**Scope note:** the fix is in `artifactVersionService.ts` only, exactly as scoped by this task. The
one HTTP route that calls `reopenVersion()`
(`server/src/routes/v8/finance-v2/models.routes.ts`, `POST /models/:modelId/reopen`) does not yet
read `versionKind`/`restatementReason`/`restatementClass` from the request body — it was already
not reading them before this fix, is unchanged by this fix, and is a reasonable, low-risk follow-up
(wiring the documented WP-B06 §4.2 body contract: `{ versionKind, restatementClass, reason }`)
outside this task's file scope.

### Regression test

`server/src/services/finance/canonical/__tests__/canonicalServices.pg.test.ts`, new test
`'reopen with versionKind=RESTATED persists version_kind/restatement_reason/restatement_class
(BUG-GOLDCO-01)'`: asserts (a) `reopenVersion({ ..., versionKind: 'RESTATED', restatementReason,
restatementClass })` returns those three values on `businessVersion`, confirmed independently via
`getBusinessVersion()` read back from the DB; (b) a plain reopen (no `versionKind`) still defaults
to `version_kind='ORIGINAL'` with null reason/class; (c) `versionKind: 'RESTATED'` without
`restatementReason`/`restatementClass` is rejected with `code: 'RESTATEMENT_METADATA_REQUIRED'`.

**Confirmed failing pre-fix, passing post-fix**: same stash-out run as BUG-GOLDCO-03 (both tests
live in the same file/transaction-model change) — pre-fix the test failed because
`businessVersion.version_kind` came back `undefined`/`'ORIGINAL'` regardless of the requested
`'RESTATED'`; post-fix it passed.

---

## 4. Verification runs (all against dedicated ephemeral PostgreSQL 15 clusters, never the shared
   Homebrew instance PID 911, never demo/dev/prod — `initdb --locale=C`, `LC_ALL=C`, ports in the
   55000-59999 range verified free with `lsof` first, `pg_ctl stop` + `rm -rf` after each run)

### 4.1 Regression tests fail pre-fix / pass post-fix

- BUG-GOLDCO-03 + BUG-GOLDCO-01 (`canonicalServices.pg.test.ts`): fix stashed out via
  `git stash push -- server/src/services/finance/canonical/artifactVersionService.ts` →
  `2 failed | 17 passed (19)` (the two new tests failed; everything else in that file still
  passed) → `git stash pop` restores the fix → re-ran → `19/19 passed`.
- BUG-GOLDCO-02 (`statementServices.pg.test.ts`): migrated a second, separate ephemeral cluster
  with the new fix-forward migration file temporarily moved OUT of `server/migrations/` →
  `1 failed | 6 passed (7)` (the STANDALONE-imbalance test failed, CONSOLIDATED and balanced-pack
  tests still passed) → migration file restored → re-ran against the fix cluster → `7/7 passed`.

### 4.2 Full existing regression pack — no regressions

Ran the full Gate C/D canonical + collaboration + finance-v2 route suite (9 files, superset of the
"81/81" WP-D02 baseline — WP-D02's 81 excluded the newer AP-04 collaboration tests and the
finance-v2 route test, both included here) against the fix cluster:

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/finance_v3_gate_a \
  npx vitest run --config server/vitest.config.ts \
    server/src/services/finance/canonical/__tests__/ \
    server/src/services/finance/collaboration/__tests__/ \
    server/src/routes/v8/finance-v2/__tests__/models.routes.pg.test.ts \
    --no-file-parallelism
```

**Result: 9 test files, 118/118 tests passed.** No existing test needed a change; the only test
files touched were the two files carrying the new regression tests themselves.

### 4.3 GoldCo restatement flow — re-run end to end on a fresh ephemeral cluster

Fresh cluster (`initdb` → migrate all 605 files including the new BUG-GOLDCO-02 fix migration) →
`goldco_oracle.ts` (unchanged, deterministic, wrote the same `goldco_oracle.json`) →
`goldco_pipeline.ts` (updated to call the real fixed `reopenVersion()`/`approveVersion()` directly
instead of the documented pre-fix workarounds — see the diff in
`docs/validation/finance-v3/generated/gate-d/goldco/goldco_pipeline.ts`) → `goldco_compare.ts`.

Restatement flow, live output:

```
=== PARENT FY2024 RESTATEMENT (reopen with versionKind=RESTATED -> remap -> approve) — BUG-GOLDCO-01 + BUG-GOLDCO-03 FIX RE-TEST ===
  [PARENT FY2024 RESTATED] reopened vN+1=fe2c4b85-... (parent=cecaf1ee-...), status=DRAFT, version_kind=RESTATED
  [PARENT FY2024 RESTATED] BUG-GOLDCO-01 FIX CONFIRMED: reopenVersion() itself persisted version_kind=RESTATED + restatement_reason + restatement_class, no workaround UPDATE used.
  [PARENT FY2024 RESTATED] version_kind read back from DB: {"version_kind":"RESTATED","restatement_reason":"Inventory valuation error discovered during FY2025 Q1 close...","restatement_class":"ERROR_CORRECTION"}
  [PARENT FY2024 RESTATED] reconciliation status=CLEAN residual=0 ready=true transitionOk=true
  [PARENT FY2024 RESTATED] approve ok=true
  [PARENT FY2024 RESTATED] BUG-GOLDCO-03 FIX CONFIRMED: approveVersion() succeeded, status=APPROVED
  [PARENT FY2024 ORIGINAL] post-restatement status: {"status":"SUPERSEDED","superseded_by_version_id":"fe2c4b85-..."}
  [PARENT FY2024 ORIGINAL] BUG-GOLDCO-03 FIX CONFIRMED: original correctly SUPERSEDED, superseded_by_version_id points at the restated child.
  [PARENT FY2024 ORIGINAL] finance_stmt_lines row count (must be unchanged, 28 expected): 28
```

Negative probe (BUG-GOLDCO-02), live output:

```
=== NEGATIVE-TEST PROBE: unbalanced pack, STANDALONE vs CONSOLIDATED scope — BUG-GOLDCO-02 FIX RE-TEST ===
  [PROBE STANDALONE, 50000000 PLN off-balance] result: {"scope":"STANDALONE","rejected":true,"error":"finance_stmt_lines: balance check failed for ... scope=STANDALONE: assets=100000000 liab+equity=50000000 diff=50000000 tolerance=1"}
  [PROBE CONSOLIDATED, 50000000 PLN off-balance] result: {"scope":"CONSOLIDATED","rejected":true,"error":"...scope=CONSOLIDATED: assets=100000000 liab+equity=50000000 diff=50000000 tolerance=1"}
  BUG-GOLDCO-02 FIX CONFIRMED: the PLN 50000000 imbalance is now rejected at BOTH STANDALONE and CONSOLIDATED scope (previously STANDALONE was silently accepted).
```

Pipeline summary line: `[goldco_pipeline] bugs found: 0 (none)` (previously 3 — all documented, none
fixed, in the original slice run).

Oracle-vs-pipeline comparison, re-run after the fix:

```
[goldco_compare] 347/347 comparable rows PASS (tolerance = LEAST(1 unit, 5% of period total assets)), 2 N/A rows
```

Identical to the pre-fix comparison result (347/347, same 2 N/A rows) — confirming the fixes changed
lifecycle/integrity *behavior* (what gets accepted/rejected, what metadata gets persisted) without
changing any of the actual computed financial figures.

### 4.4 Teardown

All three ephemeral clusters used in this WP (`finv3-gate-a-pgdata` port 57331,
a temporary "no-fix" cluster for the BUG-GOLDCO-02 negative check, `goldco-refix-pgdata` port
56102) were `pg_ctl stop` + `rm -rf`'d after use. Final `ps aux` after all runs shows only the
shared Homebrew instance (PID 911) remaining.

---

## 5. Files changed

- `server/src/services/finance/canonical/artifactVersionService.ts` — BUG-GOLDCO-03 (step reorder
  in `approveVersion()`) + BUG-GOLDCO-01 (`reopenVersion()` accepts/persists
  `versionKind`/`restatementReason`/`restatementClass`) + `BusinessVersionRow` type completed with
  the three WP-B06 columns.
- `server/migrations/20260809_finance_v3_d01b_statements_02b_integrity_scope_fix.sql` (new,
  additive) — BUG-GOLDCO-02 fix.
- `docs/validation/finance-v3/generated/gate-b/WP-B02_lifecycle_concurrency_ADR.md` — corrected T9
  ordering (§5 diagram, §5.1, §5.2, §6.4).
- `server/src/services/finance/canonical/__tests__/canonicalServices.pg.test.ts` — 2 new regression
  tests (BUG-GOLDCO-03, BUG-GOLDCO-01).
- `server/src/services/finance/canonical/__tests__/statementServices.pg.test.ts` — 3 new regression
  tests (BUG-GOLDCO-02: STANDALONE rejected, CONSOLIDATED still rejected, balanced STANDALONE still
  commits).
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_pipeline.ts` — updated to exercise the
  real fixes (removed the three documented pre-fix workarounds; added fix-confirmation
  assertions/throws so a future regression on this script fails loudly, not silently).
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_pipeline_results.json` — regenerated
  from the post-fix re-run (bugs found: 0).
- This report.

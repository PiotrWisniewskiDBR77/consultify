# BUGFIX IF-19 — Advisor pre-approval sequencing deadlock

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Date:** 2026-08-10
**Source finding:** `docs/validation/finance-v3/generated/gate-d/GOLDCO_FULL_DAG_END_TO_END_REPORT.md` section 4,
finding IF-19 (table in section 8), found by the GoldCo full-DAG end-to-end integration run
(`goldco_full_dag.ts`).
**Nature of this work:** a real, minimal, additive service-layer fix — not a new engine, not a schema
migration, not a rebuild of the compute-snapshot model.

---

## 1. The bug, precisely

`finance_valuation_advisor_outputs.compute_snapshot_id` is `NOT NULL REFERENCES
finance_compute_snapshots(compute_snapshot_id)` (`server/migrations/20260809_finance_v3_d09_valuation_01_tables.sql`
line 389). `finance_valuation_advisor_outputs_no_new_after_approval()` (WP-D09b,
`server/migrations/20260809_finance_v3_d09_valuation_02_integrity.sql`) rejects any NEW Advisor row once the
SAME `business_version_id` has reached `APPROVED` — "Advisor is pre-approval by definition" (per DEC-FIN-006:
the Advisor writes findings against a fresh **computed candidate**, before approval, not after).

Before this fix, the **only** code path in the entire canonical service layer that ever INSERTed a
`finance_compute_snapshots` row was `artifactVersionService.approveVersion()` step (b)
(`server/src/services/finance/canonical/artifactVersionService.ts`) — which runs strictly **during**
approval, i.e. after the point at which `finance_valuation_advisor_outputs_no_new_after_approval()` already
forbids new Advisor writes for that business_version. As shipped, no real caller could ever satisfy both
constraints simultaneously: by the time a `compute_snapshot_id` existed, new Advisor writes referencing it
were already forbidden. This was invisible to `WP-D09b`'s own tests (schema-only, no Advisor rows exercised)
and to `WP-D10` (report section 8: "Valuation Advisor... entirely schema-only... not touched by this WP") —
no Advisor-generation service existed yet to have hit it. It was only found by the GoldCo full-DAG
integration run wiring the real chain together end to end.

The D09 migration's own comment on `finance_valuation_advisor_outputs`
(`20260809_finance_v3_d09_valuation_01_tables.sql` line ~380) already states the *intended* design: "Freshness
anchor is `compute_snapshot_id` (append-only, WP-B06), **NOT** `business_version_id` directly — Advisor FK-s
to a concrete, immutable snapshot so 'fresh computed candidate' is structural, not conventional." The
production code simply never grew the pre-approval snapshot-creation path that design already presupposed.

## 2. What this WP read before touching anything

1. `GOLDCO_FULL_DAG_END_TO_END_REPORT.md` section 4 (the finding) and section 8 (the findings table) — the
   report's own recommendation: "a small `createComputeSnapshot()` helper in `artifactVersionService.ts`,
   callable pre-approval... mirroring `approveVersion()` step (b)'s own INSERT verbatim rather than
   duplicating the INSERT a second time in application code."
2. `goldco_full_dag.ts`'s own inline workaround (lines ~1103-1144 pre-fix) — the exact INSERT shape it used
   to unblock itself without touching any committed service file, confirming empirically (via the report's
   own "Live-tested, both directions" table) that a pre-approval snapshot + the existing freeze/no-new-after-
   approval triggers already work correctly together, once a snapshot exists early enough.
3. `artifactVersionService.ts`, `approveVersion()` — confirmed the snapshot INSERT lives entirely inside step
   (b), using the artifact's current `is_current=true` working revision, with `compute_run_id` sourced from
   `finance_working_revisions.compute_run_id` (a column that, per a repo-wide grep, is **never written** by any
   canonical service — always `NULL` in practice today).
4. `computeJobService.ts` (Gate C) — considered as an alternative "more architecturally correct" location
   (snapshot = "what was computed", not "what was approved"), since `completeJobSuccess()` is the one function
   `baselineComputeService.ts`, `kpiComputeService.ts`, `predictionComputeService.ts` and
   `valuationComputeService.ts` all funnel through uniformly. **Rejected** — see section 4 below.
5. `WP-B04_jobs_runs_outputs_ADR.md` and `WP-B01_artifact_schema_ADR.md` — neither ADR specifies *when*
   `compute_snapshot_id` must be created; `WP-B01` only establishes that `finance_business_versions.
   compute_snapshot_id` is required at `APPROVED` and that `STATEMENT_PACK` also requires a snapshot ("też
   przechodzi przez reconciliation, więc też wymaga snapshotu"). Neither ADR is a source of the bug — this is
   an implementation gap, not a design defect in either ADR.
6. Every other canonical service under `server/src/services/finance/canonical/*.ts` for
   `compute_snapshot_id`/`computeSnapshotId` usage — confirmed it is used **only** in
   `artifactVersionService.ts` (creates it) and in the D09 Valuation schema (`finance_valuation_advisor_outputs`
   FK's to it). No other domain service (statement, analysis/KPI, baseline, prediction) reads or writes it.
7. `statementReconciliationService.ts` — confirmed it has **no** `computeJobService` integration at all (no
   `compute_jobs`/`compute_job_outputs` involvement whatsoever). This one fact is why option (4) above was
   rejected — see next section.

## 3. Diagnosis: where should `compute_snapshot_id` actually be created?

The task's own hypothesis was that `computeJobService.completeJob()` (Gate C, shared by 4 of 5 domains) is
architecturally the more correct place — "snapshot = what was computed", not "what was approved" — and that
`approveVersion()` should only *pin* an existing snapshot, never create one.

That hypothesis is directionally right for Baseline/Analysis/Prediction/Valuation (all four route through
`computeJobService.completeJobSuccess()` uniformly), but **wrong as the sole creation path**, because:

- **`STATEMENT_PACK` never goes through `computeJobService` at all.** `statementReconciliationService.ts` has
  zero references to `compute_jobs`/`compute_job_outputs`. If `approveVersion()` were changed to *only* read
  an existing snapshot and never create one, every Statement Pack approval — which today always works — would
  break with `WORKING_REVISION_NOT_FOUND`-style failures, because no snapshot would ever exist for it.
- Making `computeJobService.completeJobSuccess()` unconditionally create a `finance_compute_snapshots` row
  would touch a function shared by four independent domains (baseline, KPI/analysis, prediction, valuation)
  that this WP has not independently re-verified beyond running their existing test suites — a materially
  larger blast radius than the bug requires, for a change the task's own instructions flag as needing a STOP
  if it turns out to require "a deeper compute_snapshot model rebuild."

This is exactly that fork: **relocating** snapshot creation into `computeJobService` is not a simple move, it
is a widening of scope onto a domain (`STATEMENT_PACK`) that structurally cannot use it as-is. The safe,
minimal fix instead follows the GoldCo report's own recommendation verbatim: add a small, additive helper next
to `approveVersion()`, and make `approveVersion()` itself defensively reuse an existing pre-approval snapshot
when one is present, without ever requiring one.

## 4. The fix

**File:** `server/src/services/finance/canonical/artifactVersionService.ts`

### 4.1 New: `createComputeSnapshot()`

A new exported function, placed immediately before `approveVersion()`. Same INSERT shape as
`approveVersion()` step (b) (same columns, same source: the artifact's current, `is_current=true` working
revision) but callable **before** approval, while the business_version is still
`DRAFT`/`READY_FOR_REVIEW`/`IN_REVIEW`/`NEEDS_CHANGES`:

- Rejects (`INVALID_STATUS`) if the version has already reached `APPROVED`/`SUPERSEDED`/`ARCHIVED`/
  `INVALIDATED` — a snapshot pinned at approval already covers those states; creating a second one is
  meaningless (`APPROVED`) or actively wrong (terminal states).
- Rejects (`WORKING_REVISION_NOT_FOUND`) if no current working revision exists (should not happen in
  practice — every artifact gets one at `createArtifact()`).
- **Reuses** an existing snapshot for the exact same `(artifact_id, organization_id, working_revision_id)`
  if one already exists (idempotent — a caller invoking this twice, or a caller invoking it after
  `approveVersion()` already created one for an *unrelated* reason, gets the same row back rather than a
  needless duplicate).
- Otherwise INSERTs a fresh `finance_compute_snapshots` row, verbatim same shape as `approveVersion()`'s own
  step (b).

This is the missing production code path a future `AdvisorGenerationService` needs, and what
`goldco_full_dag.ts` now calls directly (see section 6).

### 4.2 Changed: `approveVersion()` step (b)

Previously: unconditional `INSERT INTO finance_compute_snapshots (...)`.

Now: first `SELECT compute_snapshot_id FROM finance_compute_snapshots WHERE artifact_id = ? AND
organization_id = ? AND working_revision_id = ? ORDER BY created_at DESC LIMIT 1`. If a row is found (i.e. a
caller already called `createComputeSnapshot()` for this exact working revision), reuse its id — **no second
INSERT**. If not found, fall back to the exact same INSERT as before (byte-for-byte identical SQL/params).

**Why reuse is safe, not just convenient:** a `finance_working_revisions` row's content is immutable once
created. A repo-wide grep confirms the **only** place any `finance_working_revisions` row is ever INSERTed or
UPDATEd is `artifactVersionService.ts` itself (`createArtifact()` and the copy-on-write `reopenVersion()`) —
no domain compute service (baseline/KPI/prediction/valuation) ever mutates a working revision's content; they
only read `source_working_revision_id`/`is_current` when recording their own outputs. So a snapshot taken
earlier for the SAME `working_revision_id` can never be stale relative to an approval of that same working
revision — there is no window in which the content changed between the pre-approval snapshot and the
approval.

**Why this doesn't break `STATEMENT_PACK` (or any other caller that never calls `createComputeSnapshot()`
first):** the `SELECT` simply finds no row, and the function falls through to the exact same INSERT it always
ran. Zero behavior change for any artifact type/caller that doesn't opt in to the new pre-approval path.
Confirmed by a dedicated regression test (section 5) using `STATEMENT_PACK` specifically.

**Why two distinct snapshot ids (one for Advisor pre-approval, one — if ever needed — created fresh at
approval time) don't conflict with the freeze-on-approval trigger:** `trg_finance_bv_freeze_advisor_on_approval`
(fires on `AFTER UPDATE OF status`) and `trg_finance_bv_mark_advisor_stale_on_recompute` (fires on `AFTER
UPDATE OF compute_snapshot_id`) both attach to `finance_business_versions` and both fire on the SAME UPDATE
statement in `approveVersion()` step (c) (status and compute_snapshot_id are set together). Postgres fires
same-event AFTER ROW triggers in trigger-name alphabetical order: `..._freeze_advisor_on_approval` sorts
before `..._mark_advisor_stale_on_recompute` ('f' < 'm'), so the freeze always runs first, setting
`is_frozen=true` on the Advisor rows for that business_version; the stale-marking trigger's `WHERE
is_frozen = false` clause then matches zero rows. This orders correctly regardless of which snapshot id ends
up on the business_version — already empirically confirmed by the pre-fix GoldCo report itself (its own inline
workaround produced two distinct snapshot ids and still measured "4/4 `is_frozen=true`"), and reconfirmed
live post-fix (section 6).

No migration was needed — `finance_compute_snapshots` (WP-B06) and the D09b triggers already exist exactly as
designed; this is purely an application-layer sequencing fix.

## 5. Regression tests added

**File:** `server/src/services/finance/canonical/__tests__/canonicalServices.pg.test.ts`, new
`describe('artifactVersionService.createComputeSnapshot — IF-19 fix ...')` block, 5 new tests:

1. **`creates a pre-approval snapshot while DRAFT, and a real Advisor row can be written against it before
   approval`** — the direct IF-19 proof: calls `createComputeSnapshot()` on a fresh `DRAFT` `VALUATION_CASE`,
   then INSERTs a real `finance_valuation_advisor_outputs` row against the returned snapshot id, and confirms
   it lands with `is_frozen=false`. This exact sequence was **impossible** before the fix (no snapshot could
   ever exist this early).
2. **`a second call for the SAME current working revision reuses the existing snapshot (no duplicate row)`**
   — proves the reuse/idempotency behavior.
3. **`is rejected once the business_version is APPROVED`** — proves `createComputeSnapshot()` mirrors the DB
   trigger's own precondition instead of racing it.
4. **`approveVersion() reuses a pre-approval snapshot for the SAME working revision instead of creating a
   second one`** — the load-bearing assertion: `approved.computeSnapshotId === preSnap.computeSnapshotId`,
   and a direct `COUNT(*)` against `finance_compute_snapshots` for that `working_revision_id` is exactly `1`.
5. **`approveVersion() still creates its OWN fresh snapshot when no pre-approval snapshot exists
   (STATEMENT_PACK-style callers, unchanged fallback)`** — regression guard for the "don't break the other
   domains" requirement, run against `STATEMENT_PACK` specifically (the one artifact type with zero
   `computeJobService`/pre-approval-snapshot involvement).

**Proof the tests are meaningful, not vacuous:** the fix was temporarily reverted
(`git stash` on `artifactVersionService.ts` only) and the same test file re-run against the pre-fix code.
Result: **4 of the 5 new tests failed** (`TypeError: artifactVersionService.createComputeSnapshot is not a
function`), and the 5th (`STATEMENT_PACK` fallback, which doesn't call the new function at all) correctly
still passed. The fix was then restored and the full suite re-run green. This is the same "prove-then-fix"
discipline `BUGFIX_GOLDCO_01_02_03_report.md` used for BUG-GOLDCO-01/02/03.

**File:** `docs/validation/finance-v3/generated/gate-d/goldco/goldco_full_dag.ts` — the inline raw-SQL
workaround (lines ~1103-1144 pre-fix) was replaced with a direct call to
`artifactVersionService.createComputeSnapshot()`, and the unconditional `flag('IF-19', ...)` call was removed
(replaced with a conditional `IF-19a` flag only if the real service call unexpectedly fails). This is not a
new test file — it re-runs the exact same integration scenario the bug was originally found in, now exercising
the real fix instead of a script-local workaround.

## 6. Verification results

### 6.1 Full regression pack (Gate C/D, ephemeral PostgreSQL 15)

Own ephemeral cluster, `initdb --locale=C`, `LC_ALL=C`, data directory `/private/tmp/if19-regression-pgdata`
(outside the repo), port `58733` (55000-59999 range, confirmed free via `lsof` before use),
`listen_addresses=127.0.0.1`. Full migration set applied via `server/scripts/migrate.postgres.ts`, 0 errors.
Teardown via `pg_ctl -m fast stop` + `rm -rf` at the end of this session; final `ps aux` confirmed only the
shared Homebrew instance (PID 911) remained.

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:58733/finance_v3_if19_regression \
  npx vitest run --config vitest.config.ts src/services/finance --no-file-parallelism
  (run from server/, per this repo's own .pg.test.ts convention)
```

**Result: 13 test files, 177 tests, all passed. Zero regressions.** Covers: `canonicalServices.pg.test.ts`
(canonical — artifactVersionService/lineageService/computeJobService/exceptionLedgerService, includes the 5
new IF-19 tests), `kpiComputeService.pg.test.ts` (analysis), `statementServices.pg.test.ts` +
`statementReconciliationService.test.ts` (statements), `baselineCircularitySolver.test.ts` +
`baselineScheduleEngine.test.ts` (baseline, unit), `collaboration.pg.test.ts` + `autosaveScheduler.test.ts` +
`operationStack.test.ts` (collaboration), `lifecycleService.test.ts` + `lineageService.test.ts` +
`formulaAstEvaluator.test.ts` + `periodConventionResolver.test.ts` (unit). No dedicated `.test.ts` files exist
yet for `predictionComputeService.ts`/`valuationComputeService.ts`/`valuationFcffService.ts`/etc. or for
`server/src/services/finance/grid/` (confirmed by repo-wide grep before running — those domains' correctness
is instead covered by the WP-D06/D08/D10 known-answer scripts and this WP's own re-run of
`goldco_full_dag.ts`, section 6.2 below).

### 6.2 GoldCo full-DAG end-to-end re-run

Same ephemeral cluster, same migrated schema, script re-run unmodified in logic (only the IF-19 workaround
code was replaced with the real service call):

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:58733/finance_v3_if19_regression \
  npx tsx docs/validation/finance-v3/generated/gate-d/goldco/goldco_full_dag.ts
```

**Result: exit 0.** Key confirmation lines:

```
[Advisor] pre-approval finance_compute_snapshots row created via artifactVersionService.createComputeSnapshot() (IF-19 fix): 147bcd7e-2285-4a74-8596-21a910f9b7f6 (reused=false)
[Advisor] 4 outputs written pre-approval (FACT/RISK/HYPOTHESIS/QUESTION), compute_snapshot_id=147bcd7e-2285-4a74-8596-21a910f9b7f6
[Advisor] pre-approval frozen state: 0/4 frozen (expected 0/4 — not yet approved)
...
[Advisor] freeze check AFTER APPROVED business version: 4/4 rows have is_frozen=true
[Advisor] freeze-on-approval trigger CONFIRMED working with real data: all 4 rows frozen, frozen_at set.
[Advisor] post-approval new-write rejected as expected: true
...
[goldco_full_dag] integration findings: 1 (IF-04)
```

**IF-19 no longer appears in the findings list at all** — only IF-04 (the pre-existing, documented,
non-bug scope observation about Analysis vs. Baseline entity population) remains. All 5 phases (Statement →
Analysis → Baseline → Prediction → Valuation), maker-checker, export manifest, and both lineage-ancestor
queries (baseline variant: 4 edges; downside variant: 5 edges, reaching Prediction too) reproduced identically
to the original report — the fix touches nothing else in the chain.

## 7. Files changed

- `server/src/services/finance/canonical/artifactVersionService.ts` — added `createComputeSnapshot()`;
  changed `approveVersion()` step (b) to reuse-or-create instead of unconditionally creating.
- `server/src/services/finance/canonical/__tests__/canonicalServices.pg.test.ts` — 5 new regression tests.
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_full_dag.ts` — replaced the IF-19 raw-SQL
  workaround with a call to the real `createComputeSnapshot()` service function; removed the now-resolved
  `flag('IF-19', ...)` (kept a conditional `IF-19a` guard for an unexpected future failure of the same call).
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_full_dag_results.json` — regenerated by the
  post-fix re-run (git-tracked generated artifact, same convention as the original report).
- This report (new).

## 8. What was deliberately NOT done

- **No change to `computeJobService.ts`.** Considered and rejected as the sole creation path — see section 3.
  It remains exactly as it was; the four domains that use it (baseline/KPI/prediction/valuation) are
  unaffected by this fix.
- **No migration.** The schema (`finance_compute_snapshots`, the D09b freeze/no-new-after-approval triggers)
  already supports this; only the missing application-layer call site was added.
- **No `AdvisorGenerationService`.** Still not built (per `WP-D10` report section 8) — out of scope for a
  bugfix. This fix supplies the production code path that service will need; building the service itself is
  separate, later work.
- **No change to `finance_working_revisions`, `finance_compute_snapshots`, or any D09 table/trigger.** The fix
  is entirely in `artifactVersionService.ts` (plus the test/script updates above).

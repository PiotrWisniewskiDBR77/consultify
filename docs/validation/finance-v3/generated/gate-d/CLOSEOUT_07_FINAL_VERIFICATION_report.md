# ROI-E007 CLOSEOUT — point 7, independent final verification

**Branch:** `codex/finance-v3-closeout-fanin`
**Verified commit:** `72cc5e233d9187bc72bf31e0c24145db8b6c3dee`
**Baseline compared against:** `eb0259a0e6` (tip of the previous ROI-E007 fan-in)
**Date:** 2026-08-10
**Nature of this document:** pure verification. No production code, migration or test was
changed while producing it. The only file this work package commits is this report.

---

## Verification environment

Everything below ran against a throwaway PostgreSQL cluster created for this run and destroyed
after it. Demo, staging and production were never contacted.

| Item | Value |
| --- | --- |
| Server | PostgreSQL **15.15** (Homebrew), `postgresql@15` (pgvector present) |
| `initdb` / `pg_ctl` | both under `LC_ALL=C` (avoids "postmaster became multithreaded") |
| Listen | `127.0.0.1:55731`, socket `/private/tmp/pgsock-co7` (port probed free with `lsof -i:55731`) |
| Databases | `co7_fresh` (strict fresh install), `co7_upgrade` (upgrade path), `co7_tests` (suite target) |
| Suite gate | `RUN_DB_TESTS=1` **and** `MOCK_DB=false` on every run, plus `NODE_ENV=test`, `DB_TYPE=postgres`, `DATABASE_URL=...` |
| Working directory rule | `server/src/**` suites run from `server/`; `tests/**` suites run from the worktree root |

**Gate proven live, not assumed.** The same two CO-3/CO-4 suites were run once WITHOUT the env
gate: `Test Files 2 skipped (2) / Tests 24 skipped (24)`. With the gate they report
`24 passed`. The green numbers in measurement 3 therefore came from a real database, not from a
silently skipped suite.

---

## Table A — the seven required measurements

| # | Measurement | Result | Numbers |
| --- | --- | --- | --- |
| 1 | Strict fresh migrations (no `--safe`) | **PASS** | exit **0**; applied **628**; failed **0**; skipped **0**; **1570** tables (public 1449 + v8 121); all 5 named migrations `success` |
| 2 | Upgrade migrations (pre-wave → delta) | **PASS on the stated criteria, with finding F-1** | base **625** applied exit 0; delta **3** applied exit 0, 0 failed, 0 skipped; data checksum **identical** before/after; new DEFAULT + new CO-4 triggers active. F-1: `benefit_tracking` lands **unprotected** on this path |
| 3 | Full Finance suite (`server/src/services/finance/`) | **PASS** | **29 files / 476 tests passed**, 0 failed, **0 skipped**, exit 0 (452 baseline + 24 new: CO-3 10, CO-4 14) |
| 4 | Full Results ROI suite (`tests/resultsVnext/roi/`) | **PASS** | **37 files / 120 tests passed**, 0 failed, **0 skipped**, exit 0 — independently reproduces CO-5's figure |
| 5 | Adapter B + C together | **PASS** | 2 files / **20 tests passed**, single run, same database, exit 0 |
| 6 | `PUT /api/economics/analyses/:id/benefits` | **PASS** | 16 tests in the Stream-C suite; REGRESSION A → 200 + `reconciliationId`, stored actual 900 unchanged; REGRESSION B → **409**, explicitly not 500, stored actual 400 unchanged. Independent SQL probe also passed |
| 7 | Backend typecheck | **PASS** | `npx tsc --noEmit -p server/tsconfig.json` → exit **0**, **0** errors, 5326 files in program (2523 under `server/src`) |

### 1. Strict fresh migrations — PASS

```
DB_TYPE=postgres NODE_ENV=test DATABASE_URL=postgresql://postgres@127.0.0.1:55731/co7_fresh \
  npx tsx server/scripts/migrate.postgres.ts        # no --safe
```

| Metric | Value |
| --- | --- |
| Exit code | **0** |
| `Applying migrations:` | **628** |
| `✗` lines in the log | **0** |
| `schema_migrations` by status | `success = 628` — no `failed`, no `skipped` row exists |
| BASE TABLEs | **1570** (`public` 1449, `v8` 121) |

The five migrations the owner named, read back out of `schema_migrations`:

```
20260810_finance_v3_d01c_real_company_integrity_fix.sql              :: success
20260810_finance_v3_d02_reconciliation_coverage.sql                  :: success
20260810_finance_v3_e007_04_actual_protection_schema_qualified.sql   :: success
20260821_initiatives_status_default_draft.sql                        :: success
946_benefit_tracking_fresh_install.sql                               :: success
```

Physical consequences on the fresh database (read from `information_schema`, not from the SQL):

* `initiatives.status` DEFAULT = `'DRAFT'::text` (was `'step3'::text`, which the
  `initiatives_status_check` CHECK rejects).
* `public.benefit_tracking` exists, carrying `trg_benefit_tracking_deny_actual_overwrite`
  (UPDATE) and `trg_benefit_tracking_deny_delete` (DELETE).
* CO-4 attached the ROI-Actual protection to **three** physical instances —
  `public.v8_roi_realization_entries`, **`v8.v8_roi_realization_entries`** (the twin, the point of
  the work package) and `public.roi_realized_values`; `v8.roi_realized_values` does not exist and
  was skipped individually, exactly as the migration's header documents.

### 2. Upgrade migrations — PASS on the stated criteria, with finding F-1

Method: a second empty database was migrated with the migrations directory **as it stood at
`eb0259a0e6`** (`git archive eb0259a0e6 server/migrations`, 842 files — vs 845 at HEAD, i.e. the
3 added files and nothing else), populated with data, and then the wave's delta applied from the
HEAD directory.

Pre-delta state confirmed to be the genuine "before": `initiatives.status` DEFAULT `'step3'`,
no `benefit_tracking` table, no triggers on `v8.v8_roi_realization_entries`, 1569 tables.

Two defects were reproduced physically on that pre-delta database, which is what makes the
after-state meaningful:

* an `INSERT INTO initiatives (id, organization_id, name)` — no explicit status — is **rejected**:
  `new row ... violates check constraint "initiatives_status_check"`, `DETAIL: ... step3 ...`;
* `UPDATE v8.v8_roi_realization_entries SET realized_value = 999999` returns **`UPDATE 1`** and the
  stored value really becomes 999999 — the latent hole CO-4 exists to close.

Delta run: `Applying migrations: 3` → the three new files, exit **0**, zero `✗`, and
`schema_migrations` afterwards is `success = 628` with no `skipped` and no `failed`.

Data preservation, measured (not asserted):

| Fixture | Before delta | After delta |
| --- | --- | --- |
| `organizations` | 3 | 3 |
| `initiatives` | 3 | 3 |
| `roi_realized_values` | 1 | 1 |
| `public.v8_roi_realization_entries` | 1 | 1 |
| `v8.v8_roi_realization_entries` | 1 | 1 |
| md5 over ids + statuses + names + all realized/actual values | `f3768e88745e73d4d7181e807cfbce6b` | `f3768e88745e73d4d7181e807cfbce6b` |

Table count 1569 → **1570**; the single added table is `public.benefit_tracking`.

New behaviour active after the delta:

| Probe | Result |
| --- | --- |
| `INSERT INTO initiatives (id, organization_id, name)` without status | **succeeds**, row carries `status = DRAFT` |
| `UPDATE v8.v8_roi_realization_entries` (the twin) | **rejected** by trigger; stored value still 888 |
| `UPDATE public.v8_roi_realization_entries` | **rejected**; stored value still 777 |
| `UPDATE roi_realized_values` | **rejected**; stored value still 1000 |

#### Finding F-1 — `benefit_tracking` is created UNPROTECTED on the upgrade path (P2, new in this wave)

`946_benefit_tracking_fresh_install.sql` only does `CREATE TABLE IF NOT EXISTS`. The protection
triggers are created by `20260809_finance_v3_e007_03_legacy_actual_protection.sql`, inside an
`IF to_regclass('public.benefit_tracking') IS NOT NULL` guard. On a **fresh** install 946 sorts
before 20260809, the guard sees the table and the triggers are attached — measurement 1 confirms
both are present. On an **upgrade** of a database where 20260809 already ran to `success` while
the table was absent, 20260809 never re-runs, so 946 creates the table and nothing attaches the
guard.

Measured on `co7_upgrade` after the delta, with the row confirmed present by `SELECT` first:

```
triggers on benefit_tracking (fresh   DB): trg_benefit_tracking_deny_actual_overwrite, trg_benefit_tracking_deny_delete
triggers on benefit_tracking (upgrade DB): (none)

INSERT ... actual_cost_savings = 4200                       -> INSERT 0 1
SELECT  ... -> rows=1, actual_cost_savings=4200             (row physically confirmed)
UPDATE  ... SET actual_cost_savings = 9999999               -> UPDATE 1        (NOT rejected)
SELECT  ... -> actual_cost_savings = 9.999999e+06           (SILENTLY OVERWRITTEN)
DELETE  ...                                                 -> DELETE 1        (NOT rejected)
```

This is the exact failure mode ROI-E007 exists to prevent, and it is **new in this wave** on that
path: before 946 the table did not exist at all on such a database, so there was nothing to
overwrite; after 946 it exists, accepts writes, and is unguarded.

Affected population (stated precisely, not guessed): any database whose `schema_migrations` has
`20260809_finance_v3_e007_03_legacy_actual_protection.sql = success` **and** did not have
`benefit_tracking` at that moment — i.e. strict/fresh installs built between 20260809 landing and
946 landing, which includes CI/ephemeral databases and the previous fan-in's verification
database. Databases that already carried `benefit_tracking` (per the CO-3/CO-4 headers: demo, dev,
prod, via `initDb()`/067) got the triggers from 20260809 and are unaffected. **This was not
verified against demo or prod — no live environment was contacted from this session.** It must be
checked there before promotion.

Suggested fix (one file, no code change): move the trigger attachment into 946 itself, or add a
small re-attach migration with a version number after 946 that runs the same
`DROP TRIGGER IF EXISTS` / `CREATE TRIGGER` pair, schema-qualified, in the CO-4 style. Deliberately
NOT done here — this work package is verification only.

### 3. Full Finance suite — PASS

```
cd server && RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres \
  DATABASE_URL=postgresql://postgres@127.0.0.1:55731/co7_tests \
  npx vitest run src/services/finance --no-file-parallelism
```

```
Test Files  29 passed (29)
     Tests  476 passed (476)
  Duration  42.78s
```

Exit 0. **0 failed, 0 skipped.** The delta over the 452 baseline is exactly the two new suites:
`roiActualProtectionSchemaQualified.pg.test.ts` (14 tests) and
`benefitTrackingActualProtection.pg.test.ts` (10 tests) — 452 + 24 = 476. Both appear in the log as
`✓`, not as skips.

### 4. Full Results ROI suite — PASS

```
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres \
  DATABASE_URL=postgresql://postgres@127.0.0.1:55731/co7_tests \
  npx vitest run tests/resultsVnext/roi --no-file-parallelism      # from the worktree ROOT
```

```
Test Files  37 passed (37)
     Tests  120 passed (120)
  Duration  87.23s
```

Exit 0. **0 failed, 0 skipped** — independently reproduces CO-5's reported figure. Every one of the
37 files reported at least one executed test (per-file listing captured); no file collected zero
tests, which would have been the quiet way for this number to be hollow.

### 5. Adapter B + C — PASS

Both adapter suites in one invocation, one database, so a compile-level clash between them would
surface:

```
Test Files  2 passed (2)
     Tests  20 passed (20)
```

Exit 0.

### 6. `PUT /api/economics/analyses/:id/benefits` — PASS

Verbose run of `roiFinanceReconciliationAdapter.pg.test.ts`: `16 passed (16)`, exit 0. The two
scenarios the owner asked for, by name:

| Scenario | Assertion | Result |
| --- | --- | --- |
| REGRESSION A — divergent actual **with** a Case + link | `status === 200` (explicitly not 500), `reconciliationId` truthy, `reconciliationOpened === true`, `storedActualBenefits === 900`, and the table still holds 900 | ✓ passed |
| REGRESSION B — divergent actual **without** a Case | `status === 409`, `expect(res.status).not.toBe(500)`, `error === 'ROI_RECONCILIATION_TARGET_MISSING'`, stored actual still 400, `planned_cost_savings` also untouched | ✓ passed |

In both scenarios `actual_cost_savings` is re-read from the table after the call and is unchanged.
The suite additionally carries its own negative control ("the raw pre-migration UPDATE really is
rejected by the trigger"), which also passed — so the two regressions above are not vacuous.

**Independent SQL probe** (my own, on `co7_fresh`, not via the test suite), each step confirmed by
`SELECT` before the mutation:

```
INSERT benefit_tracking (actual_cost_savings 4200, actual_revenue_increase 3100, actual_productivity_gains 900)  -> INSERT 0 1
SELECT  -> row_exists = 1, actual_cost_savings = 4200                       (row confirmed BEFORE any trigger probe)
UPDATE  SET actual_cost_savings = 9999   -> ERROR: benefit_tracking.actual_* is append-only ... (rejected)
SELECT  -> actual_cost_savings = 4200                                        (unchanged)
DELETE                                   -> ERROR: benefit_tracking is append-only for actual_* ... (rejected)
UPDATE  SET verification_status='verified', variance_notes='probe'  -> UPDATE 1   (non-protected columns still writable)
SELECT  -> verification_status = verified, actual_cost_savings = 4200
```

### 7. Backend typecheck — PASS

```
npx tsc --noEmit -p server/tsconfig.json      ->  exit 0, 0 lines of output
```

Proof the run is not vacuous, in two ways:

* `--listFiles` reports **5326** files in the program, **2523** of them under
  `server/src`, including `server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts`
  (the file CO-1 touched).
* **Negative control.** The same command was run in a throwaway detached worktree at `eb0259a0e6`
  (removed afterwards): exit **2**, **18** errors, every one of them in `roiCalculationEngine.ts`
  (`TS2709: Cannot use namespace 'Decimal' as a type`, `TS2351: This expression is not
  constructable`, …). CO-1's claim of 18 errors is exact, and the harness demonstrably detects
  them.

Scope note: `server/tsconfig.json` excludes `**/*.test.ts`, so the two new `.pg.test.ts` files are
not part of this program (0 `.test.ts` files in the 5326). They are compiled only by vitest's
esbuild, which does not typecheck. Pre-existing project property, not introduced here; recorded so
nobody reads "exit 0" as "the new tests are type-clean".

---

## Table B — the six terminal criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Zero failed in the required suites | **PASS ✔** | 476 + 120 + 20 + 16 + 4 tests, exit 0 everywhere; no `×`, no `FAIL` line in any required log |
| 2 | Zero skipped in the required realDB suites | **PASS ✔** | every required run reported `0 skipped`. Gate proven live: dropping `RUN_DB_TESTS`/`MOCK_DB` turns the CO-3+CO-4 pair into `24 skipped`, so the passes are real DB passes |
| 3 | Zero TypeScript errors | **PASS ✔** | exit 0, 0 errors; negative control at `eb0259a0e6` produces 18, so the check is live |
| 4 | Zero `EVIDENCE_MISSING` | **PASS ✔** (fresh install) | the only one in `ROI_E007_FANIN_VERIFICATION_report.md` was point 6c, `benefit_tracking`. On a strict fresh install the table now exists, both triggers exist, and both the CO-3 suite and my independent SQL probe reject the write. **Caveat: closed on the fresh-install path only — see F-1 for the upgrade path** |
| 5 | Fixture rows confirmed before every trigger attempt | **PASS ✔** | verified in the test *code*, not only in its result — see below |
| 6 | Clean worktree and allowlist | **PASS ✔** | `git status --porcelain` empty at start and at end; 32 changed files vs `eb0259a0e6`, all inside the seven points |

### Criterion 5 — read out of the test source, not inferred from a green tick

* `benefitTrackingActualProtection.pg.test.ts` defines `readRowOrFail()`, which `SELECT`s the probe
  row and asserts `res.rowCount` `.toBe(1)` with the message *"the probe row must be physically
  present — without it the FOR EACH ROW trigger never fires and a rejected-looking 'UPDATE 0' would
  be a false proof"*. It is called **before and after** every protection assertion (lines 167/173,
  179, 185, 189/200, 207, 225, 244). The suite creates no schema of its own — it asserts the table
  and both triggers already exist, and reads `schema_migrations` to confirm which migration
  produced them.
* `roiActualProtectionSchemaQualified.pg.test.ts` asserts `kpiInsert.rowCount === 1` (the FK
  prerequisite), then `entryInsert.rowCount === 1`, then re-`SELECT`s out of band and asserts
  `toHaveLength(1)` with the message *"no fixture row … every trigger probe below would be
  vacuous"*, and each subsequent probe re-reads with *"fixture row missing before the UPDATE
  probe"*. It enumerates the physical instances from `information_schema.tables` rather than
  assuming which ones exist.

Both go the extra step of using the schema-qualified `v8_kpi_definitions` copy for the FK — the
precise mistake that produced the misleading `UPDATE 0` in the earlier fan-in probe.

### Criterion 6 — allowlist

`git status --porcelain` is empty (checked at session start and again at the end; the temporary
negative-control worktree was removed and `git worktree list` no longer shows it).
`git diff --name-only eb0259a0e6..HEAD` = **32 files**, mapping onto the seven points with nothing
extra:

| Bucket | Count | Files |
| --- | --- | --- |
| CO-1 | 1 | `server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts` (default → named `decimal.js` import) |
| CO-2 | 2 | `server/migrations/20260821_initiatives_status_default_draft.sql`, `tests/integration/closeout-co2-initiatives-status-default.realdb.test.ts` |
| CO-3 | 2 | `server/migrations/946_benefit_tracking_fresh_install.sql`, `server/src/services/finance/canonical/__tests__/benefitTrackingActualProtection.pg.test.ts` |
| CO-4 | 2 | `server/migrations/20260810_finance_v3_e007_04_actual_protection_schema_qualified.sql`, `server/src/services/finance/canonical/__tests__/roiActualProtectionSchemaQualified.pg.test.ts` |
| CO-5 | 20 | 18 `tests/resultsVnext/roi/*.realdb.test.ts` (+8 lines each), `roiRealdbOrgFixture.ts` (new helper), `roiPirRealdbFixtures.ts` |
| Docs | 5 | `CLOSEOUT_01..05` reports |

Exactly **one** production source file is touched, and it is the CO-1 fix. No route, service,
adapter or UI file was modified under cover of this wave. No scope creep.

The CO-2 test was run separately as well (it is a required realDB suite that sits outside the two
directories in measurements 3 and 4): `1 file / 4 tests passed`, exit 0, covering INSERT-without-
status, the legal default, the fresh-install schema and the upgrade replay.

---

## Finding F-2 (context, outside the required scope) — the CO-5 defect class survives in `tests/resultsVnext/kpi/`

Not one of the seven measurements; run because the previous fan-in's point 4 recorded "12
pre-existing reds" in the wider directory and the owner is being asked to accept a round.

```
npx vitest run tests/resultsVnext --no-file-parallelism
Test Files  3 failed | 52 passed (55)
     Tests  273 passed | 5 skipped (278)
```

The three red files are all in `tests/resultsVnext/kpi/`
(`kpiIdentityAcrossSurfaces.realdb.test.ts`, `kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts`,
`initiativeKpiImpactBaselineFreeze.realdb.test.ts`) and they fail on **exactly** the gap CO-5
closed for ROI:

```
insert or update on table "initiatives" violates foreign key constraint "initiatives_organization_id_fkey"
```

The 5 "skipped" tests are the tests inside those three files, skipped because their `beforeAll`
threw — they are not a separate skip problem. These suites are **pre-existing reds**, not a
regression from this wave (none of the three is in the changed-file list, and the ROI count of
reds went 12 → 0 while these stayed), and they are outside the owner's stated scope
(`tests/resultsVnext/roi/`). They would be closed by the same one-line
`ensureRoiFixtureOrganization`-style precondition. Recorded here so the acceptance decision is
made with the full picture, not to move the gate.

---

## Verdict

**`ROI_E007_ROUND_1_ACCEPTANCE_CANDIDATE` — ACHIEVED, conditional on F-1 being scheduled.**

All seven required measurements pass with the numbers above, and all six terminal criteria are
met: zero failed, zero skipped in the required realDB suites (with the gate proven to be live),
zero TypeScript errors (with a negative control proving the check is live), the last
`EVIDENCE_MISSING` closed on the strict-fresh-install path, fixture rows confirmed in the test
source before every trigger probe, and a clean worktree whose 32-file diff stays inside the seven
points with a single production source file touched.

Two things the owner must see before this is promoted anywhere:

1. **F-1 is a real, physically demonstrated hole that this wave introduces on the upgrade path.**
   `benefit_tracking` gets created without its protection triggers on any database where
   `20260809_finance_v3_e007_03` had already run while the table was absent; `actual_cost_savings`
   was overwritten 4200 → 9999999 and the row deleted, both silently. It does not fail any of the
   seven measurements as the owner worded them, and the fresh-install path — the one the gate
   measures — is clean. But shipping ROI-E007 with a path on which its central guarantee does not
   hold would reproduce the very class of defect the epic exists to eliminate. It needs one
   additive migration (no code change) plus a check of whether demo/prod are in the affected
   population. **That check was not performed from this session — no live environment was
   contacted.**
2. **F-2 is not a blocker** and not a regression, but three KPI realdb suites still carry the same
   missing-`organizations` precondition CO-5 fixed for the eighteen ROI suites.

Neither finding was repaired here: this work package is verification only, and the report is the
single file it commits.

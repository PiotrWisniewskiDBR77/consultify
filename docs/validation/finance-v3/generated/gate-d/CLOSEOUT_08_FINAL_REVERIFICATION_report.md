# ROI-E007 CLOSEOUT — final RE-verification after F-1 (and CO-7 … CO-10)

**Branch:** `codex/finance-v3-closeout-fanin`
**Verified commit:** `dc44ab77e89711dbcc0bf09bb0f194713ad355ef`
**Baseline compared against:** `eb0259a0e6` (tip of the previous ROI-E007 fan-in)
**Supersedes:** `CLOSEOUT_07_FINAL_VERIFICATION_report.md`, which measured `72cc5e233d` —
i.e. **before** the F-1 repair. That report cannot support a submission and this one replaces it.
**Date:** 2026-08-10
**Nature of this document:** pure verification. No production code, migration or test was changed
while producing it. The only file this work package commits is this report.

> ### Read this first — the branch moved three times during this verification
> The fan-in branch was being extended while these measurements ran. The commissioned scope was
> "re-verify after F-1" at `b41b0534ef`; by the time the work finished, `CO-7`, `CO-8`, `CO-9` and
> `CO-10` had also landed. **Every number below was re-taken from scratch at `dc44ab77e8`** —
> nothing was carried forward from the earlier passes.
>
> Two measurement sets were taken at `6eab364895` (migrations 1–3, suites 4–6). The only change
> between `6eab364895` and `dc44ab77e8` is CO-10: five demo-seed `.js` scripts, one new test and one
> report — **no migration, no `server/src` source, no file under `server/src/services/finance/` or
> `tests/resultsVnext/`**. Those measurements are therefore valid at the verified commit; the
> typecheck and the new CO-10 suite were re-run at `dc44ab77e8` explicitly. If the branch moves
> again, this report is stale and the gate must be re-measured — that is a property of verifying a
> moving branch, not a caveat on the numbers.

---

## What landed after CLOSEOUT-07, and why it forced a full re-run

CLOSEOUT-07 measured `72cc5e233d` and closed **conditionally** because of finding **F-1**: on the
UPGRADE path `benefit_tracking` was created by `946_…` with no protection triggers, so a recorded
`actual_cost_savings` could be silently overwritten.

| Commit | Package | What it changes |
| --- | --- | --- |
| `b41b0534ef` | **CO-6 / F-1** | migration `20260822_…_e007_05_benefit_tracking_protection_reattach.sql` + 15 tests `benefitTrackingUpgradeProtection.pg.test.ts` |
| `fb38a78bce` | **CO-7** | `organizations` precondition for the 3 red `tests/resultsVnext/kpi/` suites (was finding F-2) |
| `c01ca9b3ff` | **CO-8** | `DEFAULT 'step3'` → `'DRAFT'` in the runtime bootstrap DDL (`PostgresDatabase.ts`) + 2 migration SQL twins + a new suite |
| `eda325ad1a` | **CO-9** | statement money stored as `numeric` instead of `real`: new migration + a coercion in `finance.routes.ts` + 23 tests |
| `dc44ab77e8` | **CO-10** | demo seed scripts guarded against non-canonical initiative statuses + 9 tests |

CO-8 edits two **phase-0 baseline** migrations and CO-9 adds a migration, so every migration
database from the earlier passes was destroyed and rebuilt rather than reused.

---

## Verification environment

A throwaway PostgreSQL cluster, created for this run and destroyed after it. Demo, staging and
production were never contacted.

| Item | Value |
| --- | --- |
| Server | PostgreSQL **15.15** (Homebrew), `postgresql@15` |
| `initdb` / `pg_ctl start` | both under `LC_ALL=C` |
| Listen | `127.0.0.1:55200`, socket `/private/tmp/co8sk` (port probed free with `lsof`; never 5432/28711/52824) |
| Databases | `co8_fresh` (strict fresh), `co8_upgrade` (upgrade + data), `co8_f1` (staged F-1), `co8_tests` (suite target, cloned from `co8_fresh`) |
| Suite gate | `RUN_DB_TESTS=1` **and** `MOCK_DB=false`, plus `NODE_ENV=test`, `DB_TYPE=postgres`, `DATABASE_URL=…` |
| Working-directory rule | `server/src/**` suites run from `server/`; `tests/**` suites run from the worktree root |

**Gate proven live, not assumed.** The three new ROI-E007 protection suites were run once *without*
the env gate: `Test Files 3 skipped (3)`, `Tests 39 skipped (39)`. With the gate they report
`39 passed`. The green numbers below therefore came from a real database.

---

## Table A — the seven required measurements

| # | Measurement | Result | Numbers |
| --- | --- | --- | --- |
| 1 | Strict fresh migrations (no `--safe`) | **PASS ✔** | exit **0**; applied **630**; failed **0**; skipped **0**; **1570** tables (public 1449 + v8 121); all named migrations `success`, incl. `20260822_…_e007_05_…` |
| 2 | Upgrade migrations (pre-wave → delta) | **PASS ✔** | base **625** applied exit 0; delta **5** applied exit 0, **0** failed, **0** skipped; data checksum **identical** before/after; new DEFAULT + all 8 triggers active. **F-1 no longer reproduces** |
| 3 | F-1 specifically (staged 946 → rest of delta) | **PASS ✔** | defect reproduced pre-fix (4200 → 9999999, `DELETE 1`), then closed: UPDATE rejected, DELETE rejected, row intact, unprotected column still writable |
| 4 | Full Finance suite (`server/src/services/finance/`) | **PASS ✔** | **31 files / 514 tests passed**, 0 failed, **0 skipped**, exit 0 |
| 5 | Full Results ROI suite (`tests/resultsVnext/roi/`) | **PASS ✔** | **37 files / 120 tests passed**, 0 failed, **0 skipped**, exit 0 |
| 6 | Adapter B + C, and `PUT …/benefits` | **PASS ✔** | adapters: 2 files / **20 passed**, one run, one DB. Endpoint: **16 passed**; REGRESSION A → 200 + `reconciliationId`, REGRESSION B → **409** (asserted not-500), value unchanged in both |
| 7 | Backend typecheck | **PASS ✔** | `npx tsc --noEmit -p server/tsconfig.json` → exit **0**, **0** lines of output (re-run at `dc44ab77e8`) |

### 1. Strict fresh migrations — PASS

```
DB_TYPE=postgres NODE_ENV=test DATABASE_URL=postgresql://postgres@127.0.0.1:55200/co8_fresh \
  npx tsx server/scripts/migrate.postgres.ts        # no --safe
```

| Metric | Value |
| --- | --- |
| Exit code | **0** |
| `Applying migrations:` | **630** |
| `✗` lines in the log | **0** |
| `schema_migrations` by status | `success = 630` — no `failed`, no `skipped` row exists |
| BASE TABLEs | **1570** (`public` 1449, `v8` 121) |

Named migrations read back out of `schema_migrations` — every one `success`, none `skipped`:

```
20260809_finance_v3_e007_03_legacy_actual_protection.sql              :: success
20260810_finance_v3_co9_statement_money_numeric.sql                   :: success
20260810_finance_v3_d01c_real_company_integrity_fix.sql               :: success
20260810_finance_v3_d02_reconciliation_coverage.sql                   :: success
20260810_finance_v3_e007_04_actual_protection_schema_qualified.sql    :: success
20260821_initiatives_status_default_draft.sql                         :: success
20260822_finance_v3_e007_05_benefit_tracking_protection_reattach.sql  :: success   <-- the F-1 fix
946_benefit_tracking_fresh_install.sql                                :: success
```

Physical consequences, read from the catalog rather than from the SQL:

* `initiatives.status` DEFAULT = `'DRAFT'::text`;
* `financial_statement_values.value` = `numeric` (CO-9);
* eight protection triggers across **four** physical instances — `public.benefit_tracking`
  (deny_actual_overwrite + deny_delete), `public.roi_realized_values`,
  `public.v8_roi_realization_entries`, and the twin `v8.v8_roi_realization_entries`.

**One measured caveat on CO-8.** `000_initdb_core_tables.sql` has **0 rows** in
`schema_migrations` — the runner excludes it explicitly (`if (f.startsWith('000_initdb_')) return
true;` in `isSqliteOnlyMigration`). CO-8's edit to that file is consistency-only and has no effect
on any Postgres database. The live producer on the thin-bootstrap path is `PostgresDatabase.ts`
`initDb()`, which CO-8 also fixed and which *is* verified physically (see the note after Table A).

### 2. Upgrade migrations — PASS

Method: a second empty database was migrated with the migrations directory **as it stood at
`eb0259a0e6`** (`git archive eb0259a0e6 server/migrations` → 830 files, vs 835 at HEAD), populated
with data, then the wave's delta applied from the HEAD directory. The five delta files are exactly
the wave's five migrations and nothing else.

Pre-delta state confirmed to be the genuine "before":

```
e007_03 status             = success
benefit_tracking           = NULL      (table absent)
initiatives.status DEFAULT = 'step3'::text
financial_statement_values.value = real
tables                     = 1569
```

All three pre-existing defects were reproduced physically on that database, which is what makes the
after-state meaningful:

* `INSERT INTO initiatives (id, organization_id, name)` → **rejected**,
  `violates check constraint "initiatives_status_check"`;
* `UPDATE v8.v8_roi_realization_entries SET realized_value = 999999` → **`UPDATE 1`**, value really
  became 999999 (restored to 888 afterwards);
* `financial_statement_values.value` really is `real`, the CO-9 precision defect.

Delta run: `Applying migrations: 5` → `946`, `co9_statement_money_numeric`, `e007_04`, `20260821`,
`e007_05`; exit **0**, zero `✗`, `schema_migrations` afterwards `success = 630`, **no `skipped`, no
`failed`**.

Data preservation, measured rather than asserted:

| Fixture | Before delta | After delta |
| --- | --- | --- |
| `organizations` | 4 | 4 |
| `initiatives` | 3 | 3 |
| `roi_realized_values` | 1 | 1 |
| `public.v8_roi_realization_entries` | 1 | 1 |
| `v8.v8_roi_realization_entries` | 1 | 1 |
| md5 over ids + names + statuses + all realized/actual values | `1a8064d0d58a54bfe06dfbd294723124` | `1a8064d0d58a54bfe06dfbd294723124` |

Table count 1569 → **1570**; the single added table is `public.benefit_tracking`.
Trigger count on the three protected stores: **8**.

New behaviour active after the delta:

| Probe | Result |
| --- | --- |
| `INSERT INTO initiatives (…)` without status | **succeeds**, row carries `status = DRAFT` |
| `UPDATE v8.v8_roi_realization_entries` (the twin) | **rejected**; stored value still 888 |
| `UPDATE public.v8_roi_realization_entries` | **rejected**; stored value still 777 |
| `UPDATE roi_realized_values` | **rejected**; stored value still 1000 |
| `UPDATE benefit_tracking.actual_cost_savings` | **rejected**; stored value still 3300 |
| `financial_statement_values.value` | `real` → **`numeric`** |

The `benefit_tracking` row is the one CLOSEOUT-07 could not produce.

**Second measured caveat on CO-8.** The runner records a checksum per migration but never
*verifies* it — there is no drift detection in `migrate.postgres.ts`. Because CO-8 edited
`000_z_core_baseline.sql`, which is already recorded `success` on any pre-existing database, that
file will **not** re-run there and its recorded checksum silently diverges from the file on disk
(measured: `48fcc5700598…` on the upgrade DB vs `9e0e18cb8e7c…` on the fresh DB). Functional impact
here is **zero** — on the upgrade path the DEFAULT is repaired by `20260821_…` (measured above:
`'DRAFT'::text`). Recorded because nothing in the toolchain would have told us.

### 3. F-1 specifically — PASS, defect closed

Reproduced on exactly the path that exposed it, staged so the fix has something to fix. A clone of
the pre-delta upgrade database (`e007_03 = success`, `benefit_tracking` absent) got **946 alone**
first, then the rest of the delta.

**Stage 1 — 946 only. The F-1 precondition is real:**

```
Applying migrations: 1  →  946_benefit_tracking_fresh_install.sql        exit 0
benefit_tracking = benefit_tracking      (table now exists)
triggers         = 0
function         = 0
```

**Negative control — the hole is live before `e007_05`** (without this, the green below proves
nothing):

```
INSERT … actual_cost_savings = 4200          -> INSERT 0 1
SELECT  …                                    -> rowcount=1, actual=4200      (row confirmed)
UPDATE  … SET actual_cost_savings = 9999999  -> UPDATE 1        (NOT rejected)
SELECT  …                                    -> 9.999999e+06    (SILENTLY OVERWRITTEN)
DELETE  …                                    -> DELETE 1        (NOT rejected)
```

**Stage 2 — rest of the delta:**

```
Applying migrations: 4  →  co9_numeric, e007_04, 20260821, e007_05      exit 0, zero ✗
schema_migrations: success = 630
triggers on benefit_tracking: trg_benefit_tracking_deny_actual_overwrite, trg_benefit_tracking_deny_delete
protection function: 1
```

**Physical closure probe, every step confirmed by `SELECT`:**

```
[1] INSERT (planned 500, actual 4200)                 -> INSERT 0 1
[2] SELECT                                            -> rowCount=1  actual=4200  planned=500
[3] UPDATE actual_cost_savings = 9999999              -> ERROR: benefit_tracking.actual_* is append-only
                                                         under ROI-E007 governance … (REJECTED)
[4] SELECT                                            -> rowCount=1  actual=4200   (UNCHANGED)
[5] DELETE                                            -> ERROR: benefit_tracking is append-only for
                                                         actual_* … DELETE not permitted (REJECTED)
[6] SELECT                                            -> rowCount=1  actual=4200   (ROW SURVIVED)
[7] UPDATE planned_cost_savings = 777, verification   -> UPDATE 1                  (NOT over-blocked)
[8] SELECT                                            -> planned=777  verification=verified  actual=4200
```

All four required sub-assertions hold: triggers present, UPDATE rejected with the value unchanged,
DELETE rejected, and the unprotected column still writable.

### 4. Full Finance suite — PASS

```
cd server && RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres \
  DATABASE_URL=postgresql://postgres@127.0.0.1:55200/co8_tests \
  npx vitest run src/services/finance --no-file-parallelism
```

```
Test Files  31 passed (31)
     Tests  514 passed (514)
```

Exit 0. **0 failed, 0 skipped** (zero skip markers in the log). Progression is fully accounted for:
476 (CLOSEOUT-07) + 15 CO-6 + 23 CO-9 = **514**.

The 15 CO-6 tests, by name, all `✓`:

| Group | Tests |
| --- | --- |
| A. preconditions | table built by the runner (not by the suite); `946` and `20260809` both recorded `success` |
| B/C. the F-1 state is real | recreates the skipped-ELSE catalog state; **RED**: actual silently overwritten; **RED**: row deleted outright |
| D. after the CO-6 migration | applies cleanly + recreates the missing function; attaches both triggers to **every** physical instance; rejects UPDATE of `actual_cost_savings`; rejects `actual_revenue_increase`/`actual_productivity_gains` too; rejects DELETE; still allows `planned_*`/`overall_variance_percent`; a no-op UPDATE is not blocked (no false positive) |
| E. idempotence | a second application leaves exactly two triggers per instance; protection still enforced after repeats |
| F. sibling stores | every physical instance of `roi_realized_values` / `v8_roi_realization_entries` carries both deny triggers |

The two **RED** tests are the suite's own negative controls: it drops the triggers, proves the
overwrite really happens, and only then applies the migration. The greens in group D are therefore
not vacuous.

### 5. Full Results ROI suite — PASS

```
RUN_DB_TESTS=1 MOCK_DB=false … npx vitest run tests/resultsVnext/roi --no-file-parallelism   # from ROOT
```

```
Test Files  37 passed (37)
     Tests  120 passed (120)
```

Exit 0. **0 failed, 0 skipped** (zero skip markers).

### 6. Adapter B + C, and the `/benefits` endpoint — PASS

Both adapter suites in one invocation against one database, so a clash between them would surface:

```
Test Files  2 passed (2)
     Tests  20 passed (20)          exit 0
```

`PUT /api/economics/analyses/:id/benefits` — verbose run of
`roiFinanceReconciliationAdapter.pg.test.ts`, `16 passed (16)`, exit 0:

| Scenario | Assertion | Result |
| --- | --- | --- |
| REGRESSION A — divergent actual **with** a ROI case + link | `200` + `reconciliationId`, stored actual UNCHANGED | ✓ passed |
| REGRESSION B — divergent actual **without** a ROI case | `409`, explicitly `not.toBe(500)`, value unchanged | ✓ passed |
| negative control | *"the raw pre-migration UPDATE really is rejected by the trigger (proves the tests above are not vacuous)"* | ✓ passed |

No 500 in either path; `actual_cost_savings` is re-read after the call in both and is unchanged.

### 7. Backend typecheck — PASS

```
npx tsc --noEmit -p server/tsconfig.json      ->  exit 0, 0 lines of output
```

Run at `dc44ab77e8`, i.e. after CO-8 modified `PostgresDatabase.ts` and CO-9 modified
`finance.routes.ts`. Scope note carried forward from CLOSEOUT-07 and still true:
`server/tsconfig.json` excludes `**/*.test.ts`, so the new `.pg.test.ts` files are not in this
program — vitest compiles them with esbuild, which does not typecheck. Pre-existing project
property, not introduced here.

### Side packages outside the seven, measured anyway

| Package | Suite | Result |
| --- | --- | --- |
| CO-2 | `tests/integration/closeout-co2-initiatives-status-default.realdb.test.ts` | 1 file / **4 passed** |
| CO-7 | whole `tests/resultsVnext` | **55 files / 278 passed**, 0 failed, **0 skipped** — finding **F-2 from CLOSEOUT-07 is closed** |
| CO-8 | `closeoutCo8RuntimeDdlInitiativesStatusDefault.pg.test.ts` | 1 file / **5 passed** (see caveat below) |
| CO-9 | `statementMoneyNumericPrecision.pg.test.ts` | 1 file / **23 passed** |
| CO-10 | `closeout-co10-demo-seed-statuses.realdb.test.ts` | 1 file / **9 passed** |

### Note — the CO-8 suite self-sets the gate, so it was audited separately

`closeoutCo8RuntimeDdlInitiativesStatusDefault.pg.test.ts` sets `MOCK_DB=false` and `RUN_DB_TESTS=1`
inside its own `beforeAll`, and every `it()` short-circuits on a `ready` flag — by design, "an
unreachable environment produces a vacuous pass rather than a wall of misleading red". That is a
green-when-nothing-ran path, so `5 passed` on its own proves nothing. Two checks were run:

* **The vacuous path exists.** Pointed at an unreachable `127.0.0.1:59987/nope`, the suite still
  reports `1 passed / 5 passed`, exit 0.
* **The real run is NOT vacuous — proven from the server side, not the test's own output.** With
  `log_statement='ddl'` enabled on the throwaway cluster, the gated run emitted
  `CREATE DATABASE "co8_runtime_ddl_msn5qk4z6953"`, then ~1200 lines of real bootstrap DDL including
  `CREATE TABLE IF NOT EXISTS initiatives(` carrying the CO-8 comment and `DEFAULT 'DRAFT'`, then
  `DROP DATABASE IF EXISTS …`. The scratch database is gone afterwards (self-cleaning). `initDb()`
  genuinely ran and the assertions were about a real table.

Standing caveat: **in CI, this suite will go green on a machine with no database.** It is not one of
the seven required measurements and does not affect the verdict.

---

## Table B — the six terminal criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Zero failed in the required suites | **PASS ✔** | 514 + 120 + 20 + 16, plus side packages 4 + 278 + 5 + 23 + 9; exit 0 on every run; no `×`, no `FAIL` line in any log |
| 2 | Zero skipped in the required realDB suites | **PASS ✔** | every required run reported 0 skip markers. Gate proven live: dropping `RUN_DB_TESTS`/`MOCK_DB` turns the three protection suites into `39 skipped` |
| 3 | Zero TypeScript errors | **PASS ✔** | `tsc -p server/tsconfig.json` → exit 0, 0 output, run after the CO-8 and CO-9 source changes |
| 4 | Zero `EVIDENCE_MISSING` | **PASS ✔ — on BOTH paths** | `benefit_tracking` protected on the **fresh** path (measurement 1) **and** on the **upgrade** path (measurements 2 and 3), with the mutation physically rejected on both. This is the criterion CLOSEOUT-07 could only close on one path |
| 5 | Fixture rows confirmed before every trigger attempt | **PASS ✔** | verified in the CO-6 test **source**, not only in its result — see below |
| 6 | Clean worktree and allowlist | **PASS ✔** | `git status --porcelain` empty at start and at end; 59 changed files vs `eb0259a0e6`, all inside scope |

### Criterion 5 — read out of the CO-6 test source, not inferred from a green tick

`benefitTrackingUpgradeProtection.pg.test.ts` routes every fixture through `insertConfirmedRow()`,
which does both halves of what the criterion asks:

```ts
const inserted = await raw.query(`INSERT INTO public.benefit_tracking … `, [...]);
// A FOR EACH ROW trigger needs a row. A silently rejected fixture would make every
// protection assertion below vacuous, so this is an assertion, not setup.
expect(inserted.rowCount).toBe(1);

const stored = await readActuals(id);
expect(stored).not.toBeNull();
expect(stored?.actual_cost_savings).toBe(actualCostSavings);
```

So the row is asserted present **by `rowCount === 1` and by an out-of-band re-read** before any
trigger probe. Every mutation probe then re-reads through `readActuals()` afterwards and asserts the
stored value, so "rejected" is proven by the data, never by the absence of an exception. The suite
header states the rule explicitly: *"INSERT and assert `rowCount === 1`, re-read the row"*. The
other `rowCount` assertions (lines 292, 302, 374, 390) are the RED negative controls and the
allowed-column probes, each checking that the *unprotected* operation really did affect one row.

The two older suites still satisfy this (`readRowOrFail()` in
`benefitTrackingActualProtection.pg.test.ts`; `toHaveLength(1)` fixture guards in
`roiActualProtectionSchemaQualified.pg.test.ts`), as recorded in CLOSEOUT-07.

### Criterion 6 — clean worktree and allowlist

`git status --porcelain` was empty at session start and again at the end.
`git diff --name-only eb0259a0e6..HEAD` = **59 files**:

| Bucket | Count | Contents |
| --- | --- | --- |
| CO-1 | 1 | `server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts` (default → named `decimal.js` import) |
| CO-2 | 2 | `20260821_initiatives_status_default_draft.sql`, `closeout-co2-…realdb.test.ts` |
| CO-3 | 2 | `946_benefit_tracking_fresh_install.sql`, `benefitTrackingActualProtection.pg.test.ts` |
| CO-4 | 2 | `20260810_…_e007_04_actual_protection_schema_qualified.sql`, `roiActualProtectionSchemaQualified.pg.test.ts` |
| CO-5 | 20 | 18 `tests/resultsVnext/roi/*.realdb.test.ts`, `roiRealdbOrgFixture.ts`, `roiPirRealdbFixtures.ts` |
| **CO-6 / F-1** | 2 | `20260822_…_e007_05_benefit_tracking_protection_reattach.sql`, `benefitTrackingUpgradeProtection.pg.test.ts` |
| **CO-7** | 4 | 3 `tests/resultsVnext/kpi/*.realdb.test.ts`, `kpiRealdbOrgFixture.ts` |
| **CO-8** | 4 | `PostgresDatabase.ts`, `000_initdb_core_tables.sql`, `000_z_core_baseline.sql`, `closeoutCo8RuntimeDdl…pg.test.ts` |
| **CO-9** | 4 | `20260810_finance_v3_co9_statement_money_numeric.sql`, `server/src/routes/v8/finance.routes.ts`, `statementMoneyNumericPrecision.pg.test.ts`, `numberNotation.persistence.pg.test.ts` |
| **CO-10** | 6 | 5 demo-seed `.js` scripts (`server/scripts/` ×2, `server/seed/` ×3), `closeout-co10-demo-seed-statuses.realdb.test.ts` |
| Docs | 12 | `CLOSEOUT_01…10` reports, including this one |

**Assessment: in scope, no creep — with one honest qualification.** Exactly **three** production
source files are touched in the whole wave: CO-1's `decimal.js` import fix, CO-8's one-line DDL
default, and CO-9's `Number()` coercion at one query boundary in `finance.routes.ts`. No UI file,
no new route, no new service. Every added package maps onto a defect that verification itself
raised — F-1 and F-2 from CLOSEOUT-07, the `step3` runtime-DDL twin from CO-2's scope, the `real`
→ `numeric` precision defect, and non-canonical statuses in the demo seeds — rather than onto new
feature work.

The qualification: **CO-9 and CO-10 were not part of the seven points as commissioned.** They are
legitimate closeout work and they measure green, but a reviewer should know the wave grew by two
packages after the acceptance criteria were written. The two widest-reaching changes are the two
`000_*` SQL edits (analysed above: one inert for Postgres, one a checksum divergence with no
functional effect) and CO-9's `real` → `numeric` type change on a money column, which is covered by
its own 23-test suite and reproduces cleanly on both the fresh and upgrade paths here.

---

## F-1 zamknięty: **TAK**

**Dowód fizyczny, na dokładnie tej ścieżce, która ujawniła defekt** (baza `co8_f1`:
`20260809_…e007_03` zapisane jako `success` przy nieistniejącej tabeli → 946 tworzy tabelę → reszta
delty):

**Przed poprawką** (po samym 946, przed `e007_05`) — dziura JEST żywa:

```
triggery na benefit_tracking            : 0
funkcja ochronna                        : 0
INSERT actual_cost_savings = 4200       -> INSERT 0 1
SELECT                                  -> rowcount=1, actual=4200
UPDATE  SET actual_cost_savings=9999999 -> UPDATE 1          <-- CICHE NADPISANIE
SELECT                                  -> 9.999999e+06
DELETE                                  -> DELETE 1          <-- WIERSZ SKASOWANY
```

**Po `20260822_…_e007_05_benefit_tracking_protection_reattach.sql`** (status `success`):

```
triggery na benefit_tracking            : trg_benefit_tracking_deny_actual_overwrite,
                                          trg_benefit_tracking_deny_delete
funkcja ochronna                        : 1
INSERT (planned 500, actual 4200)       -> INSERT 0 1
SELECT                                  -> rowCount=1, actual=4200, planned=500   (wiersz POTWIERDZONY)
UPDATE  SET actual_cost_savings=9999999 -> ERROR … actual_* is append-only … (ODRZUCONE)
SELECT                                  -> rowCount=1, actual=4200                (NIEZMIENIONE)
DELETE                                  -> ERROR … DELETE not permitted …    (ODRZUCONE)
SELECT                                  -> rowCount=1, actual=4200                (WIERSZ PRZEŻYŁ)
UPDATE  SET planned_cost_savings=777    -> UPDATE 1                               (kolumna niechroniona DZIAŁA)
SELECT                                  -> planned=777, verification=verified, actual=4200
```

To samo potwierdzone niezależnie na drugiej bazie (`co8_upgrade`, z danymi) oraz na ścieżce fresh
(`co8_fresh`). **`benefit_tracking` jest chroniony na OBU ścieżkach.** Migracja jest idempotentna
(grupa E testów CO-6) i nie dubluje triggerów tam, gdzie 20260809 już je założyło.

**F-2 z CLOSEOUT-07 też zamknięte:** cały `tests/resultsVnext` =
`Test Files 55 passed (55) / Tests 278 passed (278)`, 0 failed, 0 skipped, exit 0.

---

## Werdykt

### `ROI_E007_ROUND_1_ACCEPTANCE_CANDIDATE` — **OSIĄGNIĘTY BEZWARUNKOWO** (na commicie `dc44ab77e8`)

Wszystkie siedem pomiarów przechodzi z liczbami powyżej i wszystkie sześć kryteriów terminalnych
jest spełnionych — tym razem bez zastrzeżenia, które blokowało CLOSEOUT-07:

* zero failed w wymaganych zestawach (514 + 120 + 20 + 16, exit 0 wszędzie);
* zero skipped w wymaganych zestawach realDB, przy bramce udowodnionej na żywo (bez niej 39 skipped);
* zero błędów TypeScript, po zmianach CO-8 i CO-9 w źródłach produkcyjnych;
* zero `EVIDENCE_MISSING` — ostatni, `benefit_tracking`, zamknięty na **obu** ścieżkach, fizycznie,
  z kontrolą negatywną pokazującą, że przed poprawką dziura była żywa;
* wiersze fixture potwierdzone `rowCount === 1` **i** ponownym odczytem, zweryfikowane w KODZIE
  testów CO-6, nie tylko w ich wyniku;
* czyste drzewo robocze, 59 plików w diffie, trzy pliki źródeł produkcyjnych, bez rozszerzenia
  zakresu na funkcjonalność.

Warunkowanie z poprzedniego raportu — „conditional on F-1 being scheduled" — odpada: F-1 nie został
zaplanowany, tylko **naprawiony i zweryfikowany fizycznie**.

**Cztery rzeczy do świadomej wiadomości przed promocją** (żadna nie blokuje kandydatury):

1. **Gałąź żyła w trakcie tej weryfikacji** (`b41b0534ef` → `dc44ab77e8`, cztery pakiety doszły).
   Werdykt dotyczy `dc44ab77e8`. Jeśli dojdzie kolejny pakiet, pomiar trzeba powtórzyć — to nie jest
   zastrzeżenie do liczb, tylko własność weryfikowania ruchomej gałęzi.
2. **CO-8 edytuje dwie już-zaaplikowane migracje phase-0.** Runner zapisuje sumy kontrolne, ale ich
   nie weryfikuje — na istniejących bazach `000_z_core_baseline.sql` nie uruchomi się ponownie i jego
   suma kontrolna cicho się rozjedzie. Funkcjonalnie bez skutku (DEFAULT naprawia `20260821`), ale
   nic w narzędziach by o tym nie powiedziało.
3. **`000_initdb_core_tables.sql` w ogóle nie jest aplikowany przez runner Postgresa** (0 wierszy w
   `schema_migrations`, jawne wykluczenie `000_initdb_`). Poprawka CO-8 w tym pliku jest wyłącznie
   porządkowa; realnym producentem jest `PostgresDatabase.ts` — i to zostało naprawione i sprawdzone.
4. **Suita CO-8 przechodzi na zielono także bez bazy** (świadomy „vacuous pass"). Na maszynie CI bez
   Postgresa da fałszywe zielone. Tutaj udowodniono z logu serwera, że pomiar był realny.

Żadna z tych czterech nie została naprawiona w tym pakiecie: to praca wyłącznie weryfikacyjna,
a raport jest jedynym plikiem, który commituje.

---

## Sprzątanie

Klaster `postgresql@15` na porcie 55200 zatrzymany (`pg_ctl stop -m fast`), katalog danych
`/private/tmp/co8pg`, gniazdo `/private/tmp/co8sk` oraz katalogi robocze `/private/tmp/co8_base`
i `/private/tmp/co8_stage1` usunięte. Żadne środowisko live (demo/staging/prod) nie było dotykane.

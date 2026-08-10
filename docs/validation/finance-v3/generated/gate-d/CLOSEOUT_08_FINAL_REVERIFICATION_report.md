# ROI-E007 CLOSEOUT — final RE-verification after F-1 (and CO-7 / CO-8)

**Branch:** `codex/finance-v3-closeout-fanin`
**Verified commit:** `c01ca9b3ffc601c6b46e7227f56ea74109c3c194`
**Baseline compared against:** `eb0259a0e6` (tip of the previous ROI-E007 fan-in)
**Supersedes:** `CLOSEOUT_07_FINAL_VERIFICATION_report.md`, which measured `72cc5e233d` —
i.e. **before** the F-1 repair. That report cannot support a submission and this one replaces it.
**Date:** 2026-08-10
**Nature of this document:** pure verification. No production code, migration or test was changed
while producing it. The only file this work package commits is this report.

---

## Why this re-run exists, and what moved under it

CLOSEOUT-07 was measured at `72cc5e233d` and closed with a **conditional** verdict because of
finding **F-1**: on the UPGRADE path `benefit_tracking` was created by `946_...` with no protection
triggers, so a recorded `actual_cost_savings` could be silently overwritten. Three commits landed
after that measurement:

| Commit | Package | What it changes |
| --- | --- | --- |
| `b41b0534ef` | **CO-6 / F-1** | new migration `20260822_..._e007_05_benefit_tracking_protection_reattach.sql` + 15 tests `benefitTrackingUpgradeProtection.pg.test.ts` |
| `fb38a78bce` | **CO-7** | `organizations` precondition added to the 3 red `tests/resultsVnext/kpi/` suites (was finding F-2) |
| `c01ca9b3ff` | **CO-8** | `DEFAULT 'step3'` → `'DRAFT'` in the runtime bootstrap DDL (`PostgresDatabase.ts`) + 2 migration SQL twins, plus a new suite in `server/src/database/__tests__/` |

Every measurement below was taken **from scratch on `c01ca9b3ff`**. Nothing was carried over from
the CLOSEOUT-07 numbers — in particular, because CO-8 edits two phase-0 baseline migrations, all
migration databases from the earlier run were destroyed and rebuilt.

---

## Verification environment

A throwaway PostgreSQL cluster, created for this run and destroyed after it. Demo, staging and
production were never contacted.

| Item | Value |
| --- | --- |
| Server | PostgreSQL **15.15** (Homebrew), `postgresql@15` |
| `initdb` / `pg_ctl start` | both under `LC_ALL=C` |
| Listen | `127.0.0.1:55130`, socket `/private/tmp/co8sk` (port probed free with `lsof -i:55130`; never 5432/28711/52824) |
| Databases | `co8_fresh` (strict fresh), `co8_upgrade` (upgrade + data), `co8_f1` (staged F-1), `co8_tests` (suite target, cloned from `co8_fresh`) |
| Suite gate | `RUN_DB_TESTS=1` **and** `MOCK_DB=false`, plus `NODE_ENV=test`, `DB_TYPE=postgres`, `DATABASE_URL=…` |
| Working-directory rule | `server/src/**` suites run from `server/`; `tests/**` suites run from the worktree root |

**Gate proven live, not assumed.** The four new realDB suites were run once *without* the env gate:
`Test Files 1 passed | 3 skipped (4)`, `Tests 5 passed | 39 skipped (44)`. With the gate they report
`44 passed`. (The one file that runs either way is the CO-8 suite, which sets the gate internally —
audited separately in the note after Table A.)

---

## Table A — the seven required measurements

| # | Measurement | Result | Numbers |
| --- | --- | --- | --- |
| 1 | Strict fresh migrations (no `--safe`) | **PASS ✔** | exit **0**; applied **629**; failed **0**; skipped **0**; **1570** tables (public 1449 + v8 121); all named migrations `success`, incl. `20260822_..._e007_05_...` |
| 2 | Upgrade migrations (pre-wave → delta) | **PASS ✔** | base **625** applied, exit 0; delta **4** applied, exit 0, **0** failed, **0** skipped; data checksum **identical** before/after; new DEFAULT + all 8 triggers active. **F-1 no longer reproduces** |
| 3 | F-1 specifically (staged 946 → rest of delta) | **PASS ✔** | defect reproduced pre-fix (4200 → 9999999, DELETE 1), then closed: UPDATE rejected, DELETE rejected, row intact, unprotected column still writable |
| 4 | Full Finance suite (`server/src/services/finance/`) | **PASS ✔** | **30 files / 491 tests passed**, 0 failed, **0 skipped**, exit 0 (476 + the 15 new CO-6 tests) |
| 5 | Full Results ROI suite (`tests/resultsVnext/roi/`) | **PASS ✔** | **37 files / 120 tests passed**, 0 failed, **0 skipped**, exit 0 |
| 6 | Adapter B + C, and `PUT …/benefits` | **PASS ✔** | adapters: 2 files / **20 passed** in one run on one DB. Endpoint: 16 passed; REGRESSION A → 200 + `reconciliationId`, REGRESSION B → **409** (asserted not-500), value unchanged in both |
| 7 | Backend typecheck | **PASS ✔** | `npx tsc --noEmit -p server/tsconfig.json` → exit **0**, **0** lines of output |

### 1. Strict fresh migrations — PASS

```
DB_TYPE=postgres NODE_ENV=test DATABASE_URL=postgresql://postgres@127.0.0.1:55130/co8_fresh \
  npx tsx server/scripts/migrate.postgres.ts        # no --safe
```

| Metric | Value |
| --- | --- |
| Exit code | **0** |
| `Applying migrations:` | **629** |
| `✗` lines in the log | **0** |
| `schema_migrations` by status | `success = 629` — no `failed`, no `skipped` row exists |
| BASE TABLEs | **1570** (`public` 1449, `v8` 121) |

Named migrations read back out of `schema_migrations` — every one `success`, none `skipped`:

```
000_z_core_baseline.sql                                               :: success
20260809_finance_v3_e007_03_legacy_actual_protection.sql              :: success
20260810_finance_v3_d01c_real_company_integrity_fix.sql               :: success
20260810_finance_v3_d02_reconciliation_coverage.sql                   :: success
20260810_finance_v3_e007_04_actual_protection_schema_qualified.sql    :: success
20260821_initiatives_status_default_draft.sql                         :: success
20260822_finance_v3_e007_05_benefit_tracking_protection_reattach.sql  :: success   <-- the F-1 fix
946_benefit_tracking_fresh_install.sql                                :: success
```

Physical consequences, read from the catalog rather than from the SQL:

* `initiatives.status` DEFAULT = `'DRAFT'::text`.
* Eight protection triggers across **four** physical instances:
  `public.benefit_tracking` (deny_actual_overwrite + deny_delete), `public.roi_realized_values`,
  `public.v8_roi_realization_entries`, and the twin `v8.v8_roi_realization_entries`.

**One measured caveat on CO-8, recorded so nobody over-reads it.** `000_initdb_core_tables.sql`
has **0 rows** in `schema_migrations` — the runner excludes it explicitly
(`if (f.startsWith('000_initdb_')) return true;` in `isSqliteOnlyMigration`). CO-8's edit to that
file is therefore documentation/consistency only and has no effect on any Postgres database. The
live producer on the thin-bootstrap path is `PostgresDatabase.ts` `initDb()`, which CO-8 also fixed
and which *is* verified physically (see the CO-8 note below).

### 2. Upgrade migrations — PASS

Method: a second empty database was migrated with the migrations directory **as it stood at
`eb0259a0e6`** (`git archive eb0259a0e6 server/migrations` → 830 files, vs 834 at HEAD), populated
with data, then the wave's delta applied from the HEAD directory.

Pre-delta state confirmed to be the genuine "before":

```
e007_03 status            = success
benefit_tracking          = NULL      (table absent)
initiatives.status DEFAULT= 'step3'::text
protection function       = 0
tables                    = 1569
triggers                  = only public.roi_realized_values ×2 and public.v8_roi_realization_entries ×2
                            (v8 twin BARE)
```

Both pre-existing defects were reproduced physically on that database, which is what makes the
after-state meaningful:

* `INSERT INTO initiatives (id, organization_id, name)` → **rejected**,
  `violates check constraint "initiatives_status_check"`, `DETAIL: … step3 …`;
* `UPDATE v8.v8_roi_realization_entries SET realized_value = 999999` → **`UPDATE 1`**, value really
  became 999999 (restored to 888 afterwards).

Delta run: `Applying migrations: 4` → `946`, `e007_04`, `20260821`, `e007_05`; exit **0**, zero `✗`,
`schema_migrations` afterwards `success = 629`, **no `skipped`, no `failed`**.

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

New behaviour active after the delta:

| Probe | Result |
| --- | --- |
| `INSERT INTO initiatives (…)` without status | **succeeds**, row carries `status = DRAFT` |
| `UPDATE v8.v8_roi_realization_entries` (the twin) | **rejected**; stored value still 888 |
| `UPDATE public.v8_roi_realization_entries` | **rejected**; stored value still 777 |
| `UPDATE roi_realized_values` | **rejected**; stored value still 1000 |
| `UPDATE benefit_tracking.actual_cost_savings` | **rejected**; stored value still 3300 |

The last row is the one CLOSEOUT-07 could not produce. `benefit_tracking` now carries both triggers
on the upgrade path.

**Second measured caveat on CO-8.** The runner records a checksum per migration but never
*verifies* it — there is no drift detection in `migrate.postgres.ts`. Because CO-8 edited
`000_z_core_baseline.sql`, which is already recorded `success` on any pre-existing database, that
file will **not** re-run there, and the recorded checksum silently diverges from the file on disk:

```
000_z_core_baseline.sql  checksum on co8_upgrade : 48fcc5700598125b0623af9a544dca78…
000_z_core_baseline.sql  checksum on co8_fresh   : 9e0e18cb8e7cd74f1a9f97b935aea441…
```

Functional impact here is **zero** — on the upgrade path the DEFAULT is repaired by
`20260821_initiatives_status_default_draft.sql` (measured above: `'DRAFT'::text`), and CO-8's SQL
edits only matter for future fresh installs. Recorded because "we edited an already-applied
migration" is normally a smell, and because nothing in the toolchain would have told us.

### 3. F-1 specifically — PASS, defect closed

Reproduced on the exact path that exposed it, staged so the fix has something to fix. A clone of
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
Applying migrations: 3  →  e007_04, 20260821, e007_05             exit 0, zero ✗
schema_migrations: success = 629
triggers on benefit_tracking: trg_benefit_tracking_deny_actual_overwrite, trg_benefit_tracking_deny_delete
protection function: 1
e007_05 status: success
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
  DATABASE_URL=postgresql://postgres@127.0.0.1:55130/co8_tests \
  npx vitest run src/services/finance --no-file-parallelism
```

```
Test Files  30 passed (30)
     Tests  491 passed (491)
```

Exit 0. **0 failed, 0 skipped** (zero skip markers in the log). 476 → 491 is exactly the 15 new CO-6
tests; `benefitTrackingUpgradeProtection.pg.test.ts (15 tests)` appears as `✓`, not as a skip.

The 15 CO-6 tests, by name, all `✓`:

| Group | Tests |
| --- | --- |
| A. preconditions | table built by the runner (not by the suite); `946` and `20260809` both recorded `success` |
| B/C. the F-1 state is real | recreates the skipped-ELSE catalog state; **RED**: actual silently overwritten; **RED**: row deleted outright |
| D. after the CO-6 migration | applies cleanly + recreates the missing function; attaches both triggers to **every** physical instance; rejects UPDATE of `actual_cost_savings`; rejects `actual_revenue_increase`/`actual_productivity_gains` too; rejects DELETE; still allows `planned_*`/`overall_variance_percent`; a no-op UPDATE is not blocked (no false positive) |
| E. idempotence | a second application leaves exactly two triggers per instance; protection still enforced after repeats |
| F. sibling stores | every physical instance of `roi_realized_values` / `v8_roi_realization_entries` carries both deny triggers |

The two **RED** tests are the suite's own negative controls: the suite drops the triggers, proves the
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
`roiFinanceReconciliationAdapter.pg.test.ts`, `16 passed (16)`, exit 0. The two named scenarios:

| Scenario | Assertion | Result |
| --- | --- | --- |
| REGRESSION A — divergent actual **with** a ROI case + link | `200` + `reconciliationId`, stored actual UNCHANGED | ✓ passed |
| REGRESSION B — divergent actual **without** a ROI case | `409`, explicitly `not.toBe(500)`, value unchanged | ✓ passed |

The suite also carries its own negative control — *"the raw pre-migration UPDATE really is rejected
by the trigger (proves the tests above are not vacuous)"* — which also passed. No 500 in either path;
`actual_cost_savings` is re-read after the call in both and is unchanged.

### 7. Backend typecheck — PASS

```
npx tsc --noEmit -p server/tsconfig.json      ->  exit 0, 0 lines of output
```

Run *after* CO-8 modified `server/src/database/PostgresDatabase.ts`, so it covers the new code.
Scope note carried forward from CLOSEOUT-07 and still true: `server/tsconfig.json` excludes
`**/*.test.ts`, so the new `.pg.test.ts` files are not in this program — vitest compiles them with
esbuild, which does not typecheck. Pre-existing project property, not introduced here.

### Note — the CO-8 suite self-sets the gate, so it was audited separately

`closeoutCo8RuntimeDdlInitiativesStatusDefault.pg.test.ts` sets `MOCK_DB=false` and `RUN_DB_TESTS=1`
inside its own `beforeAll`, and every `it()` short-circuits on a `ready` flag — by design, "an
unreachable environment produces a vacuous pass rather than a wall of misleading red". That is a
green-when-nothing-ran path, so `5 passed` on its own proves nothing. Two checks were run:

* **Vacuous path confirmed to exist.** Pointed at an unreachable `127.0.0.1:59987/nope`, the suite
  still reports `1 passed / 5 passed`, exit 0.
* **The real run is NOT vacuous — proven from the server side, not the test's own output.** With
  `log_statement='ddl'` enabled on the throwaway cluster, the gated run emitted
  `CREATE DATABASE "co8_runtime_ddl_msn5qk4z6953"`, then ~1200 lines of real bootstrap DDL including
  `CREATE TABLE IF NOT EXISTS initiatives(` carrying the CO-8 comment and `DEFAULT 'DRAFT'`, then
  `DROP DATABASE IF EXISTS "co8_runtime_ddl_msn5qk4z6953"`. The scratch database is gone afterwards
  (self-cleaning). So `initDb()` genuinely ran and the assertions were about a real table.

Recorded as a standing caveat: **in CI, this suite will go green on a machine with no database.**
It is not in the seven required measurements, and it does not affect the verdict.

---

## Table B — the six terminal criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Zero failed in the required suites | **PASS ✔** | 491 + 120 + 20 + 16 + 4 + 5, exit 0 on every run; no `×`, no `FAIL` line in any required log |
| 2 | Zero skipped in the required realDB suites | **PASS ✔** | every required run reported 0 skip markers. Gate proven live: dropping `RUN_DB_TESTS`/`MOCK_DB` turns the four new suites into `39 skipped` |
| 3 | Zero TypeScript errors | **PASS ✔** | `tsc -p server/tsconfig.json` → exit 0, 0 output, run after the CO-8 source change |
| 4 | Zero `EVIDENCE_MISSING` | **PASS ✔ — on BOTH paths** | `benefit_tracking` protected on the **fresh** path (measurement 1: both triggers present) **and** on the **upgrade** path (measurements 2 and 3: both triggers present, mutation physically rejected). This is the criterion CLOSEOUT-07 could only close on one path |
| 5 | Fixture rows confirmed before every trigger attempt | **PASS ✔** | verified in the CO-6 test **source**, not only in its result — see below |
| 6 | Clean worktree and allowlist | **PASS ✔** | `git status --porcelain` empty at start and at end; 46 changed files vs `eb0259a0e6`, all inside scope |

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
header states the rule explicitly: *"INSERT and assert `rowCount === 1`, re-read the row"*. The other
`rowCount` assertions (lines 292, 302, 374, 390) are the RED negative controls and the
allowed-column probes, each checking that the *unprotected* operation really did affect one row.

The two older suites were re-checked and still satisfy this (`readRowOrFail()` in
`benefitTrackingActualProtection.pg.test.ts`; `toHaveLength(1)` fixture guards in
`roiActualProtectionSchemaQualified.pg.test.ts`), as recorded in CLOSEOUT-07.

### Criterion 6 — clean worktree and allowlist

`git status --porcelain` was empty at session start and again at the end. HEAD `c01ca9b3ff`.
`git diff --name-only eb0259a0e6..HEAD` = **46 files**:

| Bucket | Count | Contents |
| --- | --- | --- |
| CO-1 | 1 | `server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts` (default → named `decimal.js` import) |
| CO-2 | 2 | `20260821_initiatives_status_default_draft.sql`, `tests/integration/closeout-co2-initiatives-status-default.realdb.test.ts` |
| CO-3 | 2 | `946_benefit_tracking_fresh_install.sql`, `benefitTrackingActualProtection.pg.test.ts` |
| CO-4 | 2 | `20260810_..._e007_04_actual_protection_schema_qualified.sql`, `roiActualProtectionSchemaQualified.pg.test.ts` |
| CO-5 | 20 | 18 `tests/resultsVnext/roi/*.realdb.test.ts` (+8 lines each), `roiRealdbOrgFixture.ts`, `roiPirRealdbFixtures.ts` |
| **CO-6 / F-1** | 2 | `20260822_..._e007_05_benefit_tracking_protection_reattach.sql`, `benefitTrackingUpgradeProtection.pg.test.ts` |
| **CO-7** | 4 | 3 `tests/resultsVnext/kpi/*.realdb.test.ts`, `kpiRealdbOrgFixture.ts` |
| **CO-8** | 4 | `server/src/database/PostgresDatabase.ts`, `000_initdb_core_tables.sql`, `000_z_core_baseline.sql`, `closeoutCo8RuntimeDdlInitiativesStatusDefault.pg.test.ts` |
| Docs | 9 | `CLOSEOUT_01…08` reports (this file makes 10) |

**Assessment: in scope, no creep.** Exactly **two** production source files are touched in the whole
wave — CO-1's `decimal.js` import fix and CO-8's one-line DDL default. No route, service, adapter or
UI file was modified under cover of this wave. The three migration/test buckets added since
CLOSEOUT-07 (CO-6, CO-7, CO-8) each map onto a finding that verification raised — F-1 and F-2 from
CLOSEOUT-07, and the `step3` runtime-DDL twin from CO-2's own scope — rather than onto new feature
work. The two `000_*` SQL edits are the widest-reaching change in the list and are analysed above
(one is inert for Postgres, the other is a checksum divergence with no functional effect on upgrade).

---

## F-1 zamknięty: **TAK**

**Dowód fizyczny, na dokładnie tej ścieżce, która ujawniła defekt** (baza `co8_f1`: `20260809_…e007_03`
zapisane jako `success` przy nieistniejącej tabeli → 946 tworzy tabelę → reszta delty):

**Przed poprawką** (po samym 946, przed `e007_05`) — dziura JEST żywa:

```
triggery na benefit_tracking            : 0
funkcja ochronna                        : 0
INSERT actual_cost_savings = 4200       -> INSERT 0 1
SELECT                                  -> rowcount=1, actual=4200
UPDATE  SET actual_cost_savings=9999999 -> UPDATE 1          <-- CICHE NADPISANIE
SELECT                                  -> 9.999999e+06
DELETE                                  -> DELETE 1          <-- ROW SKASOWANY
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

To samo potwierdzone niezależnie na drugiej bazie (`co8_upgrade`, z danymi produkcyjnopodobnymi) oraz
na ścieżce fresh (`co8_fresh`). **`benefit_tracking` jest chroniony na OBU ścieżkach.** Migracja jest
idempotentna (grupa E testów CO-6) i nie dubluje triggerów tam, gdzie 20260809 już je założyło.

**F-2 z CLOSEOUT-07 też zamknięte** (poza wymaganym zakresem, ale zgłoszone tam jako kontekst):
cały `tests/resultsVnext` = `Test Files 55 passed (55) / Tests 278 passed (278)`, 0 failed,
0 skipped, exit 0. Trzy czerwone suity KPI już nie istnieją.

---

## Werdykt

### `ROI_E007_ROUND_1_ACCEPTANCE_CANDIDATE` — **OSIĄGNIĘTY BEZWARUNKOWO**

Wszystkie siedem pomiarów przechodzi z liczbami powyżej i wszystkie sześć kryteriów terminalnych
jest spełnionych — tym razem bez zastrzeżenia, które blokowało CLOSEOUT-07:

* zero failed w wymaganych zestawach (491 + 120 + 20 + 16 + 4 + 5, exit 0 wszędzie);
* zero skipped w wymaganych zestawach realDB, przy bramce udowodnionej na żywo (bez niej 39 skipped);
* zero błędów TypeScript, po zmianie CO-8 w `PostgresDatabase.ts`;
* zero `EVIDENCE_MISSING` — ostatni, `benefit_tracking`, jest teraz zamknięty na **obu** ścieżkach,
  fizycznie, z kontrolą negatywną pokazującą, że przed poprawką dziura była żywa;
* wiersze fixture potwierdzone `rowCount === 1` **i** ponownym odczytem, zweryfikowane w KODZIE
  testów CO-6, nie tylko w ich wyniku;
* czyste drzewo robocze, 46 plików w diffie, dwa pliki źródeł produkcyjnych, bez rozszerzenia zakresu.

Jedyne warunkowanie z poprzedniego raportu — „conditional on F-1 being scheduled" — odpada: F-1 nie
został zaplanowany, tylko **naprawiony i zweryfikowany fizycznie**.

**Trzy rzeczy do świadomej wiadomości przed promocją** (żadna nie blokuje kandydatury):

1. **CO-8 edytuje dwie już-zaaplikowane migracje phase-0.** Runner zapisuje sumy kontrolne, ale ich
   nie weryfikuje — na istniejących bazach `000_z_core_baseline.sql` nie uruchomi się ponownie i jego
   suma kontrolna cicho się rozjedzie. Funkcjonalnie bez skutku (DEFAULT naprawia `20260821`),
   ale nic w narzędziach by o tym nie powiedziało.
2. **`000_initdb_core_tables.sql` w ogóle nie jest aplikowany przez runner Postgresa** (0 wierszy w
   `schema_migrations`, jawne wykluczenie `000_initdb_`). Poprawka CO-8 w tym pliku jest wyłącznie
   porządkowa; realnym producentem jest `PostgresDatabase.ts`, i to zostało naprawione i sprawdzone.
3. **Suita CO-8 przechodzi na zielono także bez bazy** (świadomy „vacuous pass"). Na maszynie CI bez
   Postgresa da fałszywe zielone. Tutaj udowodniono z logu serwera, że pomiar był realny.

Żadna z tych trzech nie została naprawiona w tym pakiecie: to praca wyłącznie weryfikacyjna, a
raport jest jedynym plikiem, który commituje.

---

## Sprzątanie

Klaster `postgresql@15` na porcie 55130 zatrzymany (`pg_ctl stop`), katalogi danych `/private/tmp/co8pg`
i gniazdo `/private/tmp/co8sk` usunięte, wraz z katalogami roboczymi `/private/tmp/co8_base` i
`/private/tmp/co8_stage1`. Żadne środowisko live (demo/staging/prod) nie było dotykane w trakcie
tej weryfikacji.

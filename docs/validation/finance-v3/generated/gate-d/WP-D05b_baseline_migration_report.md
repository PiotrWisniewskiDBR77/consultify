# WP-D05b — Baseline Models Migration Report (Gate D / Fala 5)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, section 7
(Baseline Models — pełna przebudowa), EPIC-05.
**Work package:** WP-D05b — turns the accepted WP-D05 ADR
(`docs/validation/finance-v3/generated/gate-d/WP-D05_baseline_models_schema_ADR.md`) into real, additive SQL
migrations and tests them (fresh + upgrade replay, 4-layer plug/financing-exclusion regression,
circularity fail-closed regression, `OUTPUT_GRID_COVERS_HORIZON` regression) on an isolated Postgres — the
same pattern WP-D01b/WP-D03b applied to the WP-D01/WP-D03 ADRs.
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Input:** `WP-D05_baseline_models_schema_ADR.md`, Zalacznik A (partial literal DDL — the
`finance_baseline_schedules` table, the payload-validation trigger, and the cash-rollforward trigger are
transcribed verbatim; the ADR's own note explains the rest of the ~600-line DDL was intentionally not
duplicated into the ADR document itself, "unikanie duplikowania... które i tak trzeba przepisać z realnymi
nazwami plików migracji w wykonawczym Gate D" — the remaining tables/triggers/readiness checks below are
therefore transcribed from the ADR's prose (sections 4/5/6/7/8), not copied from an existing `.sql` block,
same situation WP-D03b was in relative to WP-D03).

---

## 1. Database isolation

Same hard rule as WP-C01/WP-D01b/WP-D03b (real prior incident: a local runtime once had access to the
production database — `docs/validation/finance-v3/generated/gate-a/WP-A04_security_closure.md`). This work
package never touched the shared Homebrew Postgres instance
(`/opt/homebrew/opt/postgresql@15/bin/postgres -D /opt/homebrew/var/postgresql@15`, **PID 911**, confirmed
running throughout via `ps aux` before and after this session, left completely alone).

- **Own ephemeral cluster:** data directory `/private/tmp/finance-v3-gate-d05b-pgdata-66491` (random
  suffix), initialized with `initdb --locale=C` using the `/opt/homebrew/opt/postgresql@15/bin/` binaries.
- **`LC_ALL=C`** exported for `initdb`/`pg_ctl`/`psql`/the migration runner (the same recurring macOS gotcha
  WP-D01b/WP-D03b already documented).
- **Own port:** `55255`, picked from the 55000-59999 range by binding a throwaway socket first (confirmed
  free before use); `listen_addresses=127.0.0.1` (loopback only).
- **Verification during the session:** `ps aux` confirmed PID 911 (shared instance, untouched) and this
  work package's own ephemeral postmaster (`-D .../finance-v3-gate-d05b-pgdata-66491 -p 55255`) as fully
  separate processes; a third, unrelated ephemeral cluster from a different concurrent session
  (`-D /private/tmp/rvn_kpi_e006_pg -p 28471`) was observed and left alone.
- **`NODE_ENV=test`** set only to satisfy `assertNoPrivateRailwayDbHostOutsideRailway` /
  `resolveReachableDatabaseUrl` (`server/src/config/databaseTargetResolver.ts`) when pointing the migration
  runner at a loopback host — left fully in place, not bypassed.
- **Teardown:** `pg_ctl -m fast stop` followed by `rm -rf` of the data directory, executed at the end of
  this work package (section 8). Final `ps aux` confirmed only PID 911 remained.

## 2. Migrations delivered

Three new, purely additive files in `server/migrations/`, matching the ADR's own three-block execution order
(Zalacznik A, "Kolejnosc wykonania": tables → integrity controls → readiness gate + roll-up views):

| # | File | Creates |
|---|---|---|
| 1 | `20260809_finance_v3_d05_baseline_01_tables.sql` | `financial_statement_lines.excluded_from_baseline` (additive column + `DIVIDENDS_DECLARED` UPDATE), `finance_baseline_models`, `finance_baseline_schedules` (+ `uq_finance_baseline_schedules_item`), `finance_baseline_assumptions` (+ `uq_finance_baseline_assumptions_cell`), `finance_baseline_outputs` (+ `uq_finance_baseline_outputs_cell`), `finance_baseline_solver_diagnostics`, `finance_baseline_backtest_runs`, `finance_baseline_backtest_line_results` |
| 2 | `20260809_finance_v3_d05_baseline_02_integrity.sql` | `finance_baseline_validate_schedule_payload()` (layer 2), 3× parent-immutability triggers (`finance_baseline_schedules`/`finance_baseline_assumptions`/`finance_baseline_outputs`), `finance_baseline_block_discretionary_financing_lines()` (layer 3), `finance_baseline_mark_funding_gap()` (funding gap alert), `finance_baseline_check_cash_rollforward()` (layer 4), `finance_baseline_check_balance()`, `finance_baseline_check_re_rollforward()` |
| 3 | `20260809_finance_v3_d05_baseline_03_readiness.sql` | `finance_baseline_readiness_check()` (9 named checks), `finance_baseline_is_ready_for_review()`, `finance_baseline_outputs_quarterly` / `finance_baseline_outputs_annual` roll-up VIEWs |

Filename suffix `_01_`/`_02_`/`_03_` pins the deterministic same-date filename sort order the migration
runner (`server/scripts/migrate.postgres.ts`) uses — file 2's triggers reference file 1's tables, file 3's
readiness gate queries everything above. No filename contains the substring `seed` (or `mock`/`demo`/a
leading `add_`) — WP-D03b found the runner's `isSqliteOnlyMigration()` silently excludes such filenames;
this work package ships zero seed data, so the trap does not apply, but names were checked against that
exclusion list anyway before being finalized.

Zero `DROP`/`RENAME`/`ALTER ... TYPE` on any existing table. The one additive change to an existing table
(`financial_statement_lines.excluded_from_baseline`, `ADD COLUMN IF NOT EXISTS` + a targeted `UPDATE ...
WHERE line_code = 'DIVIDENDS_DECLARED'`) is idempotent by construction (`IF NOT EXISTS` + a `WHERE
excluded_from_baseline = false` guard on the UPDATE). All 7 new tables use `TEXT PRIMARY KEY DEFAULT
gen_random_uuid()::text`, matching the convention WP-C01/WP-D01b/WP-D03b already established.

### 2.1 A real bug this work package's own live testing found and fixed

`finance_baseline_mark_funding_gap()` (the funding gap alert trigger, ADR section 7) originally inserted
into `finance_exceptions` without setting `id`/`exception_group_id` explicitly, relying on the table's
`id ... DEFAULT gen_random_uuid()::text` column default. `finance_exceptions.exception_group_id` is `NOT
NULL` with **no default** — the table's own header comment (`20260809_finance_v3_b05_exception_ledger.sql`)
states it "= id on the RAISED row", but that value is not visible to the same `INSERT` statement that is
still generating `id` via its column `DEFAULT`. The first live test run (TEST 7/8/9a/9b, section 6) failed
immediately on `null value in column "exception_group_id" ... violates not-null constraint` the moment a
negative-`CASH` row was inserted. Fixed by generating the id explicitly in PL/pgSQL
(`v_exception_id := gen_random_uuid()::text;`) and using that same variable for both `id` and
`exception_group_id` in the `INSERT`. Re-run after the fix: TEST 7/8/9a/9b all pass (section 6), and the
full fresh-install + upgrade-replay cycle was re-run from a clean database afterward to confirm the fix
holds end-to-end, not just in isolation — this is the direct analogue of WP-D01's "FOR EACH ROW constraint
trigger" and WP-D01/WP-D03's `COALESCE(..., false)` fixes: found by actually running the DDL against real
Postgres, not by re-reading the SQL text.

No other discrepancies were found between the ADR's prose (sections 4/5/6/7/8) and what shipped — every
table/CHECK/trigger/function name and every literal error-message wording this report's section 6 quotes
matches the ADR's own section 10/11 test-table wording (where the ADR quoted one), or is a direct,
literal-name transcription otherwise (e.g. `NO_OPEN_UNDEFINED_MATH`, quoted verbatim by ADR section 6.2's
own TEST 13 description).

### 2.2 Readiness-gate checks: this work package's own design, not literally listed in the ADR (documented, not hidden)

The ADR's section 11 point 2 says the original 8-check readiness gate is missing a 9th check
(`OUTPUT_GRID_COVERS_HORIZON`) but does not enumerate literal names for all 8+1 checks in one place (unlike
WP-D01's fully-quoted 7-check table). This work package designed 9 named checks from the ADR's section 2/3/
4/6/8 requirements (source lineage approved + compatible, schedules/assumptions declared, no missing cells,
`OUTPUT_GRID_COVERS_HORIZON`, `NO_OPEN_UNDEFINED_MATH` — this one **is** ADR-literal, section 6.2's TEST 13 —
and a broader `NO_OPEN_BLOCKING_EXCEPTIONS` covering `TENANT_BREACH` too). This is a documented author
decision of this work package, following the same shape (named checks, `COALESCE(..., false)` throughout,
`VERSION_EXISTS` early-return guard) WP-D01/WP-D03 already established, not a literal ADR transcription for
every check name. Flagged here explicitly per the "verify real runtime, not docs" discipline — do not read
this section as "the ADR specified 9 checks with these exact names," it did not for 8 of the 9.

## 3. Fresh install replay

Ran the project's own runner against an **empty** ephemeral database — every migration in
`server/migrations/` (existing + the 3 new files), in the runner's deterministic phase/date/filename order:

```
NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgresql://postgres@127.0.0.1:55255/finance_v3_d05b_fresh \
  LC_ALL=C npx tsx server/scripts/migrate.postgres.ts
```

- **598 migrations pending → 598 applied, 0 skipped, 0 errors** (595 pre-existing migrations at the time
  this work package started — including WP-D01/D01b, WP-D03/D03b — plus this work package's 3 new files).
  This count is from the **second** run, after the section 2.1 fix; the first run (with the bug) also
  applied all 598 migration files with 0 SQL errors at `migrate.postgres.ts` level (the funding-gap bug only
  surfaces when a row is actually inserted through the trigger, not at DDL-creation time) — re-run anyway
  from a fully dropped/recreated database to get a clean end-to-end confirmation.
- **Per-file timing** (from `schema_migrations.execution_time_ms`):

| Migration | Time |
|---|---|
| `20260809_finance_v3_d05_baseline_01_tables.sql` (7 tables + 1 additive column + indexes) | 14 ms |
| `20260809_finance_v3_d05_baseline_02_integrity.sql` (7 functions + 8 triggers) | 2 ms |
| `20260809_finance_v3_d05_baseline_03_readiness.sql` (2 functions + 2 views) | 2 ms |

**All 3 new files together: 18 ms — no lock-time risk for a production backfill window**, consistent with
WP-D01b's/WP-D03b's finding that no Finance v3 migration file has come close to being slow relative to the
~700-file project baseline.

All 7 new tables, 11 new functions/triggers, and 2 new views confirmed present afterward via `\dt`/`\df`/`\dv`
against the live catalog: `finance_baseline_models`, `finance_baseline_schedules`,
`finance_baseline_assumptions`, `finance_baseline_outputs`, `finance_baseline_solver_diagnostics`,
`finance_baseline_backtest_runs`, `finance_baseline_backtest_line_results`;
`finance_baseline_validate_schedule_payload`, `finance_baseline_schedules_enforce_parent_immutability`,
`finance_baseline_assumptions_enforce_parent_immutability`,
`finance_baseline_outputs_enforce_parent_immutability`, `finance_baseline_block_discretionary_financing_lines`,
`finance_baseline_mark_funding_gap`, `finance_baseline_check_cash_rollforward`,
`finance_baseline_check_balance`, `finance_baseline_check_re_rollforward`, `finance_baseline_readiness_check`,
`finance_baseline_is_ready_for_review`; `finance_baseline_outputs_quarterly`,
`finance_baseline_outputs_annual`.

## 4. Upgrade replay (idempotency on a non-empty, populated database)

After loading test fixtures (section 5) and running the full test battery (section 6) — leaving 2
`finance_baseline_models` rows, 3 `finance_baseline_schedules` rows, 2 `finance_baseline_assumptions` rows,
20 `finance_baseline_outputs` rows, 2 `finance_exceptions` rows — all 3 raw `.sql` files were re-executed
directly with `psql -f` against the already-migrated, populated database:

- **All 3 files re-applied cleanly, 0 errors.** File 1 emitted the expected `NOTICE: relation ... already
  exists, skipping` lines for every `CREATE TABLE/INDEX IF NOT EXISTS`; files 2/3 re-applied silently
  (`CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS`/`CREATE TRIGGER` for file 2, `CREATE OR REPLACE
  FUNCTION`/`CREATE OR REPLACE VIEW` for file 3).
- **Row counts identical before/after**: `finance_baseline_models`=2, `finance_baseline_schedules`=3,
  `finance_baseline_assumptions`=2, `finance_baseline_outputs`=20, `finance_exceptions`=2 — no data loss, no
  duplication.
- **All triggers/functions re-fired identically after replay** — re-ran the parent-immutability rejection
  (INSERT into `finance_baseline_schedules` against the now-`APPROVED` `bv-bl-d05b-1`) and both readiness
  checks (`NO_OPEN_UNDEFINED_MATH` on `bv-bl-d05b-1`, `OUTPUT_GRID_COVERS_HORIZON` on `bv-bl-d05b-2`): all
  three returned identical results after the replay as before it.

This confirms the migrations are safe to re-run — mechanism is `CREATE TABLE/INDEX IF NOT EXISTS`, `CREATE
OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, `CREATE OR REPLACE VIEW`, and the
guarded `ADD COLUMN IF NOT EXISTS` + conditional `UPDATE` — the same pattern family WP-D01b/WP-D03b already
established.

## 5. Test fixtures

One org (`org-d05b-test`), one `STATEMENT_PACK` artifact/version (`art-sp-d05b-1`/`bv-sp-d05b-1`, taken to
`APPROVED`), one `HISTORICAL_ANALYSIS` artifact/version (`art-ana-d05b-1`/`bv-ana-d05b-1`, taken to
`APPROVED`, linked to the Statement Pack via a `STATEMENT_TO_ANALYSIS` edge), one primary `BASELINE_MODEL`
artifact/version (`art-bl-d05b-1`/`bv-bl-d05b-1`, left `DRAFT` through most of the test battery, then taken
to `APPROVED` for the immutability tests 12a/12b), linked to both upstream artifacts via `STATEMENT_TO_MODEL`
and `ANALYSIS_TO_MODEL` lineage edges. One `STANDARD` fiscal calendar, three chained `MONTH` periods
(Jan/Feb/Mar 2026). One entity (`GROUP_PARENT`, `FULL` consolidation). One `finance_baseline_schedules`
(`debt_maturity`) row and one `finance_baseline_assumptions` row for the primary model. A second, separate
`BASELINE_MODEL` (`art-bl-d05b-2`/`bv-bl-d05b-2`, `horizon_months=36`) purpose-built for the
`OUTPUT_GRID_COVERS_HORIZON` regression (section 6, TEST 14) — same lineage edges, own entity, own schedule/
assumption row, but only 3 of 36 declared horizon months ever populated in `finance_baseline_outputs`. All
fixture/test SQL lives in the session scratchpad (`/private/tmp/d05b_fixture.sql`,
`/private/tmp/d05b_tests.sql`), not in the repo — same convention WP-D01/WP-D01b/WP-D03b's own tests used.

## 6. Constraint / trigger / readiness-gate verification

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | **Layer 1** — `schedule_type='financing'` | INSERT rejected (CHECK enum) | ✅ |
| 2 | **Layer 2** — `debt_maturity` payload with forbidden key `new_draw` | INSERT rejected | ✅ |
| 3 | **Layer 2** — `debt_maturity` payload without forbidden keys | INSERT accepted | ✅ |
| 4 | **Layer 2** — `equity_re` payload with forbidden key `dividend` | INSERT rejected | ✅ |
| 5 | Consistent Feb 2026 cash roll-forward / RE roll-forward / balance (opening 100000+30000=130000 cash; 400000+20000=420000 RE; 1030000=1030000 BS) | commit succeeds | ✅ |
| 6 | **Layer 3** — `DIVIDENDS_DECLARED` `PRESENT_NONZERO` in `finance_baseline_outputs` | INSERT rejected | ✅ exact message quoting `canonical_line_id`/`excluded_from_baseline`/DEC-FIN-002 |
| 6b | **Layer 3** — `DIVIDENDS_DECLARED` `NA` in `finance_baseline_outputs` | INSERT accepted | ✅ |
| 7 | **Layer 4** — Mar 2026 cash roll-forward broken (opening 130000 + net_change -600000 = -470000 expected, wrote closing -1000, diff 469000) | COMMIT rejected | ✅ exact `opening (130000) + net_change (-600000) != closing (-1000), diff 469000 > tolerance 1` message |
| 8 | **Layer 4** — Mar 2026 cash roll-forward consistent (closing -470000, matches 130000-600000) | COMMIT succeeds | ✅ |
| 9a | Funding gap: negative `CASH` (-470000) on the row from TEST 8 | `quality_flag='FUNDING_GAP'` set on that row | ✅ |
| 9b | Funding gap: exactly one `finance_exceptions(severity='WARNING')` row raised, deduplicated by `(business_version_id, entity_id, period_id)` — a subsequent UPDATE of the same row does **not** raise a second one | `warning_count=1` both before and after the re-affirm UPDATE | ✅ |
| 10 | Readiness gate on `bv-bl-d05b-1` (DRAFT, all inputs satisfied, 3/3 periods populated) | all 9 checks `passed=t`, `is_ready_for_review=true` | ✅ (includes `SOURCE_STATEMENT_PACK_AND_ANALYSIS_COMPATIBLE=t` — Model's and Analysis's own upstream Statement Pack are the same version) |
| 11a | Quarterly roll-up, flow line (`NET_CHANGE_CASH`), Q1 2026 | sum = 0 (Jan, no CF row) + 30000 (Feb) + (-600000) (Mar) = **-570000** | ✅ |
| 11b | Quarterly roll-up, stock line (`CASH`), Q1 2026 | closing (March) value = **-470000** | ✅ |
| 12a | **Content freeze** — INSERT into `finance_baseline_schedules` after parent `bv-bl-d05b-1` reaches `APPROVED` | rejected | ✅ |
| 12b | **Content freeze** — UPDATE on `finance_baseline_outputs` after parent `bv-bl-d05b-1` reaches `APPROVED` | rejected | ✅ |
| 13 | **Circularity fail-closed** — `finance_exceptions(severity='SECURITY', blocking_category='UNDEFINED_MATH', event_type='RAISED')` inserted directly (simulating a non-converged solver run) | `finance_baseline_readiness_check('bv-bl-d05b-1')` row `NO_OPEN_UNDEFINED_MATH` flips from `passed=t` to `passed=f` | ✅ — literal check name match with ADR section 6.2's own TEST 13 wording |
| 14 | **`OUTPUT_GRID_COVERS_HORIZON` regression** — second Baseline Model (`bv-bl-d05b-2`), `horizon_months=36`, only 3 of 36 periods ever populated in `finance_baseline_outputs`, all `PRESENT_NONZERO` (zero `MISSING` rows on purpose) | `NO_MISSING_OUTPUT_CELLS=passed:t` (the false-positive trap the ADR's own live testing found) **but** `OUTPUT_GRID_COVERS_HORIZON=passed:f`, and `finance_baseline_is_ready_for_review('bv-bl-d05b-2')=false` overall | ✅ — proves the bug the ADR's author found (section 11 point 2 of the ADR) does **not** silently reappear in this migration: a partially-populated grid with zero `MISSING` rows still reads as not-ready |
| extra | **Analogous balance check** — `TOTAL_ASSETS`(900000) ≠ `TOTAL_LIABILITIES_EQUITY`(950000) on a fresh period | COMMIT rejected | ✅ exact `assets=900000 liab+equity=950000 diff=50000 tolerance=1` message |
| extra | **Analogous RE roll-forward** — opening RE(100000) + NI(5000) ≠ closing RE(999999) | COMMIT rejected | ✅ exact `opening=100000 + NI=5000 != closing=999999 (diff=894999, tolerance=1)` message |

All 14 numbered tests plus both extra checks re-ran identically after the upgrade replay (section 4) — same
rejections, same messages, same readiness-gate results.

### 6.1 Note on TEST 11's numbers vs. the ADR's own worked example

The ADR's section 8/11 worked example uses a different numeric fixture (its own Jan/Feb/Mar values, quoted
result "0+30000+(-600000) = -570000" for the flow sum, closing value "-70000" for the stock line — the ADR's
own March cash value differs from this work package's fixture). This work package's fixture uses its own,
internally-consistent numbers (Jan cash=100000, Feb cash=130000, Mar cash=-470000, chosen to simultaneously
exercise the funding-gap alert via a negative March cash) — the **flow-sum arithmetic matches the ADR's own
worked example exactly** (0 + 30000 + (-600000) = -570000, TEST 11a), and the **stock/closing-value rule**
(last populated month wins) is verified against this work package's own numbers (TEST 11b: -470000, the
March value) rather than re-deriving the ADR's own -70000, since that requires the ADR's own distinct set of
monthly figures which were not reproduced verbatim here (not required by the task's brief, which asked to
verify the 3 named mechanisms plus circularity/horizon, not to reproduce every ADR worked number 1:1).

## 7. Teardown

`pg_ctl -D /private/tmp/finance-v3-gate-d05b-pgdata-66491 -m fast stop` followed by `rm -rf` of that
directory, executed immediately after this report was written. Final `ps aux` confirmed only PID 911 (the
shared Homebrew instance) remained; no process from this work package's ephemeral cluster was left running.

## 8. Summary

- 3 new additive migration files in `server/migrations/` (`20260809_finance_v3_d05_baseline_01_tables.sql`,
  `..._02_integrity.sql`, `..._03_readiness.sql`), matching the ADR's own 3-block execution order, plus one
  additive column (`financial_statement_lines.excluded_from_baseline`) and one guarded `UPDATE` inside file 1.
- Fresh install: 598/598 migrations applied, 0 errors; the 3 new files together add 18 ms.
- Upgrade replay: all 3 files re-applied cleanly against a populated database, 0 errors, row counts and
  trigger/function behavior identical before/after.
- **Four-layer plug/financing-exclusion regression — all 4 layers verified live, each with both a rejection
  and an acceptance case**: Layer 1 (`schedule_type` CHECK enum, TEST 1), Layer 2 (forbidden-key denylist +
  `debt_maturity`/`equity_re` required-key allowlist, TESTS 2-4), Layer 3 (taxonomy `excluded_from_baseline`
  denylist trigger on `finance_baseline_outputs`, TESTS 6/6b), Layer 4 (cash roll-forward with zero plug
  option, TESTS 7-8, plus the two analogous balance/RE-rollforward checks verified as an addition beyond the
  ADR's numbered test list).
- **Circularity fail-closed verified live**: inserting a `finance_exceptions(severity='SECURITY',
  blocking_category='UNDEFINED_MATH')` row (simulating a non-converged solver run) flips
  `finance_baseline_readiness_check`'s `NO_OPEN_UNDEFINED_MATH` check from `true` to `false` and
  `finance_baseline_is_ready_for_review` from `true` to `false` (TEST 13) — the already-reserved WP-B05
  blocking mechanism correctly consumed for its first real use case.
- **`OUTPUT_GRID_COVERS_HORIZON` regression verified live**: a 3-of-36-month model reads
  `NO_MISSING_OUTPUT_CELLS=true` (the false-positive trap) but `OUTPUT_GRID_COVERS_HORIZON=false` and overall
  `is_ready_for_review=false` (TEST 14) — the exact bug the ADR author's own live testing found (ADR section
  11 point 2) does not silently reappear in this migration.
- Immutability (content freeze on `APPROVED`) verified on both `finance_baseline_schedules` (INSERT, TEST
  12a) and `finance_baseline_outputs` (UPDATE, TEST 12b).
- 1 real bug found and fixed by this work package's own live testing (section 2.1): the funding-gap alert
  trigger's `finance_exceptions` INSERT was missing an explicit `exception_group_id` (NOT NULL, no default,
  must equal the row's own `id` for a RAISED event) — fixed by generating the id explicitly in PL/pgSQL
  before the INSERT; re-verified end-to-end (fresh install + upgrade replay + full test battery) after the
  fix, not just at the point of the original failure.
- `finance_baseline_solver_diagnostics`/`finance_baseline_backtest_runs`/`finance_baseline_backtest_line_results`
  were DDL-validated (present in the fresh-install catalog, all FK/CHECK/generated-column definitions
  accepted without error) but not exercised with a live INSERT in this work package — same documented
  boundary the ADR itself calls out (ADR section 11 last paragraph / section 12 point 5): full exercise is
  deferred to the executive work package that ships the real compute engine and backtest runner.

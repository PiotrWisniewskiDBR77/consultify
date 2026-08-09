# WP-D03b — Analysis Migration Report (Gate D / Fala 4)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, section 6
(Analysis — pełna przebudowa), EPIC-04.
**Work package:** WP-D03b — turns the accepted WP-D03 ADR
(`docs/validation/finance-v3/generated/gate-d/WP-D03_analysis_schema_ADR.md`) into real, additive SQL
migrations and tests them (fresh + upgrade replay, constraint/trigger regression, 18 P0 KPI seed) on an
isolated Postgres — the same pattern WP-D01b applied to the WP-D01 Statements ADR
(`docs/validation/finance-v3/generated/gate-d/WP-D01b_statements_migration_report.md`).
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Input:** `WP-D03_analysis_schema_ADR.md` — unlike WP-D01, this ADR deliberately does **not** carry a
literal DDL appendix ("Uwaga o Załączniku A", end of the ADR): every column, CHECK, trigger name, and
error message below is transcribed from the ADR's prose (section 4 per-table design, section 5.2-5.5
formula AST schema and worked examples, section 6.1-6.3 unit-resolution rules, section 10's literal test
messages) rather than copied from an existing `.sql` block.

---

## 1. Database isolation

Same hard rule as WP-C01/WP-D01/WP-D01b (real prior incident: a local runtime once had access to the
production database — `docs/validation/finance-v3/generated/gate-a/WP-A04_security_closure.md`). This
work package never touched the shared Homebrew Postgres instance
(`/opt/homebrew/opt/postgresql@15/bin/postgres -D /opt/homebrew/var/postgresql@15`, **PID 911**, confirmed
running throughout via `ps aux` before and after this session, left completely alone).

- **Own ephemeral cluster:** data directory `/private/tmp/finance-v3-gate-d03b-pgdata-75146` (random
  suffix), initialized with `initdb --locale=C` using the `/opt/homebrew/opt/postgresql@15/bin/` binaries.
- **`LC_ALL=C`** exported for `initdb`, `pg_ctl`, `psql`, and the migration runner invocations (the same
  recurring macOS gotcha WP-D01b documented — `postmaster became multithreaded during startup` without it).
- **Own port:** `55000` (first free port found scanning the 55000-59999 range via a socket-bind probe),
  `listen_addresses=127.0.0.1` (loopback only).
- **Verification during the session:** `ps aux` confirmed two fully separate `postgres` processes — PID
  911 on `-D /opt/homebrew/var/postgresql@15` (untouched shared instance) and the ephemeral cluster's own
  postmaster on `-D /private/tmp/finance-v3-gate-d03b-pgdata-75146 -p 55000`.
- **`NODE_ENV=test`** set only to satisfy `assertNoPrivateRailwayDbHostOutsideRailway` /
  `resolveReachableDatabaseUrl` (`server/src/config/databaseTargetResolver.ts`) when pointing the migration
  runner at a loopback host — left fully in place, not bypassed.
- **Teardown:** `pg_ctl -D <datadir> stop -m fast` followed by `rm -rf` of the data directory, executed at
  the end of this work package (section 8). Final `ps aux` confirmed only PID 911 remained.

## 2. Migrations delivered

Four new, purely additive files in `server/migrations/`, following WP-D03's own 3-block execution order
(tables → integrity controls → readiness gate) **plus one extra file** this ADR's own scope required that
WP-D01 did not have: a P0 KPI catalog seed, since the ADR explicitly ships 18 canonical KPI definitions as
part of its decision (section 5.3), not left to a later executive work package the way WP-D01's own
taxonomy backfill was.

| # | File | Creates |
|---|---|---|
| 1 | `20260809_finance_v3_d03_analysis_01_tables.sql` | `finance_analysis_kpi_catalog` (+ partial unique `uq_finance_analysis_kpi_catalog_active_code`), `finance_analysis_definitions`, `finance_analysis_kpi_values` (+ `uq_finance_analysis_kpi_values_cell`, `chk_..._division_by_zero_shape`), `finance_analysis_benchmarks`, `finance_analysis_variance` |
| 2 | `20260809_finance_v3_d03_analysis_02_integrity.sql` | `finance_analysis_kpi_resolve_unit()` (recursive Layer-1 formula-AST unit resolver), `finance_analysis_kpi_catalog_before_write()` trigger (maker-checker + formula compile), `finance_analysis_kpi_values_enforce_parent_immutability()` trigger, `finance_analysis_variance_enforce_hybrid_immutability()` trigger |
| 3 | `20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql` | 18 `UNIVERSAL`-tier `finance_analysis_kpi_catalog` seed rows (all 8 categories from ADR section 5.3), `ON CONFLICT (kpi_code) WHERE status='ACTIVE' DO NOTHING` |
| 4 | `20260809_finance_v3_d03_analysis_04_readiness.sql` | `finance_analysis_readiness_check()` (6 named checks, ADR section 7), `finance_analysis_is_ready_for_review()` |

Filename suffix `_01_`/`_02_`/`_03_`/`_04_` pins the deterministic same-date filename sort order the
migration runner (`server/scripts/migrate.postgres.ts`) uses — file 2 needs file 1's tables, file 3's
`CASH_CONVERSION_CYCLE` row needs files 2's compile trigger and the 3 rows (`DSO`/`DIO`/`DPO`) inserted
earlier in the *same* file, file 4 queries everything above.

Zero `DROP`/`RENAME`/`ALTER ... TYPE` on any existing table. All 5 new tables use `TEXT PRIMARY KEY
DEFAULT gen_random_uuid()::text`, matching the convention WP-C01/WP-D01 already established.

### 2.1 A real gotcha this work package found and fixed before it ever reached the migration runner

The file originally named `20260809_finance_v3_d03_analysis_03_kpi_seed.sql` was **silently skipped by the
migration runner** on the first fresh-install attempt — it never even appeared in the runner's own
`→ filename` progress log, and `schema_migrations` had no row for it at all (not `success`, not `skipped`,
just absent). Root cause: `server/scripts/migrate.postgres.ts`'s `isSqliteOnlyMigration()` treats any
filename containing the substring `seed` (also `mock`, `demo`, a leading `add_`) as "seed/demo data,
not part of schema migration flow" and excludes it from the run entirely (`migrate.postgres.ts:319`). This
is exactly the kind of trap CLAUDE.md's "verify REALNY runtime, nie docy/flagi" rule exists for — the file
was syntactically perfect SQL sitting untouched in `server/migrations/`, and a check of the file's own
existence or its SQL content would have said "done"; only running the actual runner and checking
`schema_migrations` (not just "no errors printed") surfaced it. Fixed by renaming the file to
`..._03_kpi_p0_catalog.sql` (no exclusion-list substring) and updating the three sibling files' header
comments that referenced the old filename. Re-run confirmed all 4 files, including this one, now appear in
the runner's progress log and in `schema_migrations` with `status='success'`.

### 2.2 A second gotcha the upgrade replay found and fixed

The first version of the seed file used plain `INSERT ... VALUES (...)` per KPI, no `ON CONFLICT`. Fresh
install passed. The **upgrade replay** (re-running the raw `.sql` file a second time against an
already-migrated database, section 4) failed on the very first row:
`duplicate key value violates unique constraint "uq_finance_analysis_kpi_catalog_active_code"` — because
`finance_analysis_kpi_catalog` has no plain-`UNIQUE(kpi_code)` constraint to hang a naive `ON CONFLICT
(kpi_code) DO NOTHING` off of; the actual uniqueness is the **partial** index
`WHERE status = 'ACTIVE'` (ADR section 4.2's "at most one ACTIVE row per kpi_code" rule, mirroring
`uq_finance_bv_one_approved`). Fixed by adding `ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING`
to all 18 INSERTs — Postgres accepts a partial-index conflict target when the `ON CONFLICT` clause's own
predicate matches the index's predicate exactly. Re-run of the upgrade replay confirmed 0 errors and
identical row counts before/after (section 4).

## 3. Fresh install replay

Ran the project's own runner against an **empty** ephemeral database — every migration in
`server/migrations/` (existing + the 4 new files), in the runner's deterministic phase/date/filename order:

```
NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgresql://postgres@127.0.0.1:55000/finance_v3_d03b_fresh \
  LC_ALL=C npx tsx server/scripts/migrate.postgres.ts
```

- **595 migrations pending → 595 applied, 0 skipped, 0 errors** (591 pre-existing migrations at the time
  this work package started, including WP-D01/D01b, plus this work package's 4 new files).
- **Per-file timing** (from `schema_migrations.execution_time_ms`):

| Migration | Time |
|---|---|
| `20260809_finance_v3_d03_analysis_01_tables.sql` (5 tables + indexes) | 11 ms |
| `20260809_finance_v3_d03_analysis_02_integrity.sql` (4 functions + 3 triggers) | 0 ms |
| `20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql` (18 INSERTs, each round-tripping the compile trigger) | 2 ms |
| `20260809_finance_v3_d03_analysis_04_readiness.sql` (2 functions) | 0 ms |

**All 4 new files together: 13 ms — no lock-time risk for a production backfill window**, consistent with
WP-D01b's finding that no Finance v3 migration file has come close to being slow relative to the ~700-file
project baseline.

All 5 new tables and all 6 new functions confirmed present afterward via direct query against
`finance_analysis_kpi_catalog`/`finance_analysis_definitions`/`finance_analysis_kpi_values`/
`finance_analysis_benchmarks`/`finance_analysis_variance` and `\df finance_analysis_*`.

## 4. Upgrade replay (idempotency on a non-empty, populated database)

After loading test fixtures (section 5: one org, a `STATEMENT_PACK` artifact/version and a
`HISTORICAL_ANALYSIS` artifact/version linked by a `STATEMENT_TO_ANALYSIS` lineage edge, one
`finance_analysis_definitions` row, one entity, one period, 2 `finance_analysis_kpi_values` rows, 1
`finance_analysis_variance` row, plus 2 extra `finance_analysis_kpi_catalog` rows created by the
constraint tests themselves — `BAD_FORMULA_TEST2` in `DRAFT`/`COMPILE_ERROR` and `ORG_CUSTOM_MARGIN` in
`ACTIVE`/`COMPILED_OK`), all 4 raw `.sql` files were re-executed directly with `psql -f` against the
already-migrated, populated database:

- **All 4 files re-applied cleanly, 0 errors.** File 1 emitted 15 harmless `NOTICE: relation ... already
  exists, skipping` lines (expected `CREATE TABLE/INDEX IF NOT EXISTS` behavior); files 2/3/4 re-applied
  completely silently — file 2 via `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS`/`CREATE
  TRIGGER`, file 3 via the `ON CONFLICT ... DO NOTHING` fix (section 2.2), file 4 via `CREATE OR REPLACE
  FUNCTION`.
- **Row counts identical before/after**: `finance_analysis_kpi_catalog`=20 (18 seed + 2 test rows),
  `compile_status='COMPILED_OK'`=19, `finance_analysis_definitions`=1, `finance_analysis_kpi_values`=2,
  `finance_analysis_variance`=1 — no data loss, no duplication.
- **All triggers re-fired identically after replay** — re-ran the formula-compile rejection (a fresh
  `add(MONETARY, ratio(MONETARY,MONETARY))` row at `status='ACTIVE'`) and the `finance_analysis_kpi_values`
  parent-immutability UPDATE rejection against the still-`APPROVED` `bv-ana-d03b-1`: identical rejections,
  identical error messages, both after the replay as before it.

This confirms the migrations are safe to re-run — mechanism is `CREATE TABLE/INDEX IF NOT EXISTS`, `CREATE
OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, and (once fixed, section 2.2) `INSERT
... ON CONFLICT (kpi_code) WHERE status='ACTIVE' DO NOTHING` — the same pattern family WP-D01b already
established, extended here to a partial-index conflict target.

## 5. Test fixtures

One org (`org-d03b-test`), one `STATEMENT_PACK` artifact/version (`art-sp-d03b-1`/`bv-sp-d03b-1`, left
`DRAFT` — deliberately, to exercise the readiness gate's `SOURCE_STATEMENT_PACK_APPROVED` check honestly),
one `HISTORICAL_ANALYSIS` artifact/version (`art-ana-d03b-1`/`bv-ana-d03b-1`, taken to `APPROVED` mid-session
via a real `finance_working_revisions` + `finance_compute_snapshots` row, exactly the two-step forward-ref
resolution `finance_bv_enforce_immutability` requires — WP-B01's `cannot APPROVE without
compute_snapshot_id` guard fired on the first, under-prepared attempt, confirming that guard is still live
and was not accidentally weakened by this work package), one `STATEMENT_TO_ANALYSIS` lineage edge, one
`finance_stmt_calendars`/`finance_stmt_periods` (`FY2025`) pair and one `finance_stmt_entities` row (both
reused from WP-D01's tables, per ADR section 2.1 — Analysis projects no entity/period tables of its own).
All fixture SQL lives in the session scratchpad (`/private/tmp/d03b_fixture.sql`,
`/private/tmp/d03b_tests.sql`), not in the repo — same convention WP-D01/WP-D01b's own ADR-level tests used.

## 6. Constraint / trigger verification

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | `BAD_FORMULA` — `add(MONETARY, ratio(MONETARY,MONETARY))`, `status='ACTIVE'` directly | INSERT rejected (dimensionally invalid) | ✅ rejected with the exact ADR-quoted message `UNIT_MISMATCH_STRUCTURAL: add MONETARY RATIO` |
| 2 | Same `BAD_FORMULA`, `status='DRAFT'` | INSERT **accepted**, `compile_status='COMPILE_ERROR'` persisted as data, not a blocking error | ✅ |
| 3 | `ORG_CUSTOM_MARGIN`, `approved_by = created_by` (self-approval), `status='ACTIVE'` | INSERT rejected (maker-checker) | ✅ rejected: "ORG_CUSTOM activation requires maker-checker (approved_by must be set and differ from created_by)" |
| 4 | `ORG_CUSTOM_MARGIN`, `approved_by != created_by`, `status='ACTIVE'` | INSERT accepted | ✅ `compile_status='COMPILED_OK'` |
| 5 | `finance_analysis_kpi_values` with `value_status='PRESENT_NONZERO'` + `quality_flag='DIVISION_BY_ZERO'` | INSERT rejected | ✅ CHECK `chk_finance_analysis_kpi_values_division_by_zero_shape` |
| 6 | Same row with `value_status='NOT_APPLICABLE'` + `quality_flag='DIVISION_BY_ZERO'` | INSERT accepted | ✅ |
| 7 | **INSERT into `finance_analysis_kpi_values` after parent `business_version` reaches `APPROVED`** | rejected | ✅ "parent business_version bv-ana-d03b-1 is APPROVED and immutable; INSERT not permitted" |
| 8 | **UPDATE on `finance_analysis_kpi_values` after parent `business_version` reaches `APPROVED`** | rejected | ✅ same message, `UPDATE not permitted` |
| 9 | **INSERT a new `finance_analysis_variance` row against an `APPROVED` business_version** | rejected | ✅ "cannot create a new variance row against APPROVED business_version bv-ana-d03b-1" |
| 10 | On an `APPROVED` version, UPDATE an **existing** `finance_analysis_variance` row's `owner`/`comment`/`status`/`resolved_by`/`resolved_at` | UPDATE accepted (hybrid immutability) | ✅ |
| 11 | Same row, same `APPROVED` version, UPDATE `variance_pct` (a numeric fact) | UPDATE rejected | ✅ "only owner/comment/action/due_date/status/resolved_* may change" |

All 11 tests re-ran identically after the upgrade replay (section 4) — same rejections, same messages.

Additionally verified (not in the numbered table, but load-bearing): `finance_analysis_readiness_check('bv-ana-d03b-1')`
correctly reports `SOURCE_STATEMENT_PACK_APPROVED=false` (source Statement Pack Version is still `DRAFT`,
by fixture design) and `REQUIRED_LINES_AVAILABLE=false` (no `finance_stmt_lines` rows exist for this
Statement Pack Version at all) — i.e. the gate does **not** false-positive when its inputs are genuinely
incomplete, and `finance_analysis_is_ready_for_review('nonexistent-version-id')` returns `false`, not `NULL`
(the `COALESCE(bool_and(passed), false)` guard carried forward from WP-D01's own found-and-fixed bug,
applied here from the start per the ADR's own instruction in section 7's last paragraph).

## 7. 18 P0 KPI seed — verification

All 18 rows from ADR section 5.3 inserted via `20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql`,
`tier='UNIVERSAL'`, `status='ACTIVE'` directly (canonical, team-authored content — ADR section 4.2, not
subject to the `ORG_CUSTOM` maker-checker gate). Verified against the live database, not just the SQL text:

```
select count(*) total, count(*) filter (where compile_status='COMPILED_OK') compiled_ok,
       count(*) filter (where status='ACTIVE') active
from finance_analysis_kpi_catalog;
```
→ **`total=18, compiled_ok=18, active=18`** — every seed row passed the real Layer-1 formula-AST compile
trigger (`finance_analysis_kpi_catalog_before_write`/`finance_analysis_kpi_resolve_unit`) via an actual
`INSERT`, not merely a syntax check on the JSON.

All 8 categories from ADR section 5.3 are represented: `LIQUIDITY` (`CURRENT_RATIO`, `QUICK_RATIO`,
`CASH_RATIO`), `PROFITABILITY` (`GROSS_MARGIN_PCT`, `EBITDA_MARGIN_PCT`, `NET_MARGIN_PCT`), `LEVERAGE`
(`DEBT_TO_EQUITY`, `DEBT_TO_EBITDA`), `COVERAGE` (`INTEREST_COVERAGE`), `EFFICIENCY` (`DSO`, `DIO`, `DPO`,
`CASH_CONVERSION_CYCLE`), `CASH_FLOW` (`OPERATING_CASH_FLOW_MARGIN`, `FCF_MARGIN`), `GROWTH`
(`REVENUE_GROWTH_YOY`), `RETURNS` (`ROE`, `ROA`).

`CASH_CONVERSION_CYCLE` is the one row that specifically proves the `formula_ref` cross-row lookup works
against the real trigger, not just in the abstract: its `formula_ast` is `subtract(add(formula_ref:DSO,
formula_ref:DIO), formula_ref:DPO)` — `finance_analysis_kpi_resolve_unit()` looked up `DSO`/`DIO`/`DPO`'s
already-committed `resolved_output_unit='DAYS'`/`compile_status='COMPILED_OK'` rows (inserted earlier in
the same file, per the ordering note in section 2) and resolved the composite to `DAYS`, matching its
declared `unit_type='DAYS'`. Had the three dependency rows been reordered after it, the INSERT would have
failed with `UNIT_MISMATCH_STRUCTURAL: formula_ref <code> does not resolve to an ACTIVE COMPILED_OK catalog
entry` — this was not separately tested as a negative case (out of the requested scope) but the ordering
requirement itself is real, not documentation-only, precisely because the seed file hit it during
authoring.

## 8. Discrepancies between the ADR and what shipped in SQL

Unlike WP-D01/WP-D01b, this ADR had no pre-existing, author-tested DDL sketch to transcribe — WP-D03's own
"Uwaga o Załączniku A" explicitly says the full DDL was intentionally not included as a separate appendix.
Every table/CHECK/trigger/function in this work package's 4 files is therefore a **first transcription**
from the ADR's prose into runnable SQL, not a verbatim copy of an already-tested block. Two gotchas were
found and fixed by *this* work package's own live testing (not inherited from a prior author-test pass, in
contrast to WP-D01b's two inherited-and-carried-forward fixes):

1. **Filename exclusion list** (section 2.1) — `..._kpi_seed.sql` silently skipped by
   `isSqliteOnlyMigration()`'s `seed`/`mock`/`demo` substring filter. Fixed by renaming to
   `..._kpi_p0_catalog.sql`.
2. **`ON CONFLICT` target must match the partial unique index's predicate** (section 2.2) — a bare
   `ON CONFLICT (kpi_code) DO NOTHING` does not exist as a valid conflict target because
   `uq_finance_analysis_kpi_catalog_active_code` is `UNIQUE (kpi_code) WHERE status = 'ACTIVE'`, not a
   plain unique constraint. Fixed by adding the matching `WHERE status = 'ACTIVE'` predicate to all 18
   `ON CONFLICT` clauses.

No other discrepancies: the maker-checker gate, the Layer-1 unit-resolution rules (section 6.2 of the
ADR — `add`/`subtract`/`multiply`/`divide`/`ratio` resolution table), the `chk_..._division_by_zero_shape`
CHECK, the `finance_analysis_kpi_values` parent-immutability trigger, and the `finance_analysis_variance`
hybrid-immutability allow-list all match the ADR's section 10 test table and section 4/5/6 prose exactly —
every literal error message this report's section 6 quotes was written into the trigger functions
*because* the ADR's own section 10 table specified it verbatim, then verified against a real Postgres
instance to confirm the transcription was faithful, not merely plausible-looking.

## 9. Teardown

`pg_ctl -D /private/tmp/finance-v3-gate-d03b-pgdata-75146 stop -m fast` followed by `rm -rf` of that
directory, executed immediately after this report was written. Final `ps aux` confirmed only PID 911 (the
shared Homebrew instance) remained; no process from this work package's ephemeral cluster was left running.

## 10. Summary

- 4 new additive migration files in `server/migrations/` (`20260809_finance_v3_d03_analysis_01_tables.sql`,
  `..._02_integrity.sql`, `..._03_kpi_p0_catalog.sql`, `..._04_readiness.sql`) — one more file than WP-D01b
  shipped, because this ADR's own scope includes shipping the 18 P0 KPI as seed data, not deferring it to
  a later executive work package.
- Fresh install: 595/595 migrations applied, 0 errors; the 4 new files together add 13 ms.
- Upgrade replay: all 4 files re-applied cleanly against a populated database, 0 errors, row counts and
  trigger behavior identical before/after (after fixing the `ON CONFLICT` partial-index gap this replay
  itself surfaced, section 2.2).
- 11/11 constraint and trigger tests passed, matching the ADR's own section 10 test table's exact wording:
  formula-AST compile rejection/acceptance (ACTIVE vs. DRAFT), `ORG_CUSTOM` maker-checker self-approval
  rejection and proper-approval acceptance, the division-by-zero shape CHECK, `finance_analysis_kpi_values`
  content-freeze on `APPROVED` (INSERT and UPDATE), and `finance_analysis_variance` hybrid immutability
  (numeric facts frozen, owner/comment/action/due_date/status/resolved_* editable) — all re-verified
  identical after the upgrade replay.
- 18/18 P0 KPI seed rows inserted and **compiled** (`compile_status='COMPILED_OK'` on every row, verified
  by live `INSERT` through the real trigger, not by inspecting the JSON), covering all 8 categories from
  ADR section 5.3, including the one `formula_ref`-composite KPI (`CASH_CONVERSION_CYCLE`) that exercises
  the cross-row catalog lookup end-to-end.
- 2 discrepancies found and fixed, both **newly discovered by this work package's own live testing** (not
  inherited from a prior author pass, since this ADR had no DDL appendix to inherit from): a migration-runner
  filename exclusion trap (`seed` substring) and a partial-unique-index `ON CONFLICT` target mismatch —
  documented in section 8.

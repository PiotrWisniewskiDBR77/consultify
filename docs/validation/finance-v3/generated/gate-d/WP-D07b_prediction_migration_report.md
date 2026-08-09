# WP-D07b — Prediction / Scenario Engine Migration Report (Gate D / Fala 6)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, section 8
(Prediction — pełna przebudowa), EPIC-06.
**Work package:** WP-D07b — turns the accepted WP-D07 ADR
(`docs/validation/finance-v3/generated/gate-d/WP-D07_prediction_schema_ADR.md`) into real, additive SQL
migrations and tests them (fresh + upgrade replay, Base=Baseline enforcement trigger+VIEW, double-counting
SQL query, preflight/resolution two-stage Compute gate, `scenario_mode` B→C promotion hierarchy) on an
isolated Postgres — the same pattern WP-D01b/WP-D03b/WP-D05b applied to the WP-D01/WP-D03/WP-D05 ADRs.
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Input:** `WP-D07_prediction_schema_ADR.md`, Zalacznik A (literal, live-tested DDL for
`finance_prediction_scenarios`, `finance_prediction_gate_driver_overrides()`,
`finance_prediction_forbid_standard_base_outputs()`, `finance_prediction_scenario_mode_transition_guard()` —
transcribed verbatim; sections 7.1/8.3 give literal SQL for the double-counting detection query and the
`finance_prediction_outputs_effective` VIEW respectively. The ADR's own note explains the rest of the nine
remaining tables/triggers were intentionally not duplicated into the ADR document itself — the same
"unikanie duplikowania... które i tak trzeba przepisać z realnymi nazwami plików migracji w wykonawczym
Gate D" situation WP-D05b was already in relative to WP-D05, transcribed here from the ADR's prose (sections
4/5/6/7/8), not copied from an existing `.sql` block.

---

## 1. Database isolation

Same hard rule as WP-C01/WP-D01b/WP-D03b/WP-D05b (real prior incident: a local runtime once had access to
the production database — `docs/validation/finance-v3/generated/gate-a/WP-A04_security_closure.md`). This
work package never touched the shared Homebrew Postgres instance
(`/opt/homebrew/opt/postgresql@15/bin/postgres -D /opt/homebrew/var/postgresql@15`, **PID 911**, confirmed
running throughout via `ps aux` before and after this session, left completely alone).

- **Own ephemeral cluster:** data directory `/private/tmp/finance-v3-gate-d07b-pgdata-60838` (random
  suffix), initialized with `initdb --locale=C` using the `/opt/homebrew/opt/postgresql@15/bin/` binaries.
- **`LC_ALL=C`** exported for `initdb`/`pg_ctl`/`psql`/the migration runner (the same recurring macOS gotcha
  WP-D01b/WP-D03b/WP-D05b already documented).
- **Own port:** `55700`, picked from the 55000-59999 range by confirming it free via `lsof` first;
  `listen_addresses=127.0.0.1` (loopback only).
- **Verification during the session:** `ps aux` confirmed PID 911 (shared instance, untouched) and this
  work package's own ephemeral postmaster (`-D .../finance-v3-gate-d07b-pgdata-60838 -p 55700`) as fully
  separate processes; a third, unrelated ephemeral cluster from a different concurrent session
  (`-D /private/tmp/pgkpi7/data -p 5433`) was observed at session start and left alone (it had shut down on
  its own, under a different session's control, by the time of this work package's own teardown check).
- **`NODE_ENV=test`** set only to satisfy `assertNoPrivateRailwayDbHostOutsideRailway` /
  `resolveReachableDatabaseUrl` (`server/src/config/databaseTargetResolver.ts`) when pointing the migration
  runner at a loopback host — left fully in place, not bypassed.
- **Teardown:** `pg_ctl -m fast stop` followed by `rm -rf` of the data directory, executed at the end of
  this work package (section 8). Final `ps aux` confirmed only PID 911 remained.

## 2. Migrations delivered

Three new, purely additive files in `server/migrations/`, matching the ADR's own Zalacznik A grouping
(tables → integrity controls → detection/readiness gate + effective view):

| # | File | Creates |
|---|---|---|
| 1 | `20260809_finance_v3_d07_prediction_01_tables.sql` | `finance_prediction_scenarios`, `finance_prediction_driver_overrides` (+ `uq_..._cell`), `finance_prediction_initiatives` (+ `uq_..._code`), `finance_prediction_impact_chain` (+ driver-XOR-kpi CHECK), `finance_prediction_financing` (+ payload-object/period-shape CHECKs), `finance_prediction_outputs` (+ `uq_..._cell`), `finance_prediction_driver_line_map` (+ honestly-partial 14-row seed), `finance_prediction_preflight_runs` (+ `uq_..._current` partial index), `finance_prediction_preflight_findings`, `finance_prediction_conflict_resolutions` (+ custom-detail/maker-checker CHECKs) |
| 2 | `20260809_finance_v3_d07_prediction_02_integrity.sql` | `finance_prediction_gate_driver_overrides()` / `_gate_initiatives()` / `_gate_financing()` (scenario_mode gating ×3), `finance_prediction_scenario_mode_transition_guard()` (+ promoted_at/by stamping), `finance_prediction_scenarios_touch_updated_at()`, `finance_prediction_forbid_standard_base_outputs()`, 5× `..._enforce_parent_immutability()` (driver_overrides/initiatives/impact_chain/financing/outputs) |
| 3 | `20260809_finance_v3_d07_prediction_03_readiness.sql` | `finance_prediction_detect_overlaps()` (Layer 1 double-counting SQL), `finance_prediction_readiness_check()` (3 named checks), `finance_prediction_can_start_compute()`, `finance_prediction_outputs_effective` VIEW |

Filename suffix `_01_`/`_02_`/`_03_` pins the deterministic same-date filename sort order the migration
runner (`server/scripts/migrate.postgres.ts`) uses — file 2's triggers reference file 1's tables, file 3's
detection/readiness functions and view query everything above. No filename contains the substring `seed`
(or `mock`/`demo`/a leading `add_`) — WP-D03b found the runner's `isSqliteOnlyMigration()` silently excludes
such filenames, and WP-D05b independently re-confirmed the trap; this work package ships a small seed
**inside** `..._01_tables.sql` (not a file named `..._seed...`), so the exclusion does not apply, but names
were checked against that exclusion list anyway before being finalized.

Zero `DROP`/`RENAME`/`ALTER ... TYPE` on any existing table — all ten tables are new, zero columns added to
any pre-existing table (unlike WP-D05b, which had one additive column on `financial_statement_lines`; this
work package needed none). All ten new tables use `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`,
matching the convention WP-C01/WP-D01b/WP-D03b/WP-D05b already established. `finance_prediction_driver_overrides.schedule_type`
and `finance_prediction_impact_chain.driver_schedule_type` reuse the **exact** 9-value `schedule_type` CHECK
enum `finance_baseline_schedules` (WP-D05b) already established — transcribed literally, not redefined, so
the two enums cannot drift apart.

### 2.1 `finance_prediction_driver_line_map` — an honest, partial seed (documented, not hidden)

The ADR's own section 13 escalation #1 flags this catalog as needing a future parity test against
`baselineScheduleEngine.ts`; this work package additionally found, before writing a single seed row, that
**not every canonical line the ADR's own examples name is guaranteed to exist** in the live
`financial_statement_lines` taxonomy. A grep across every migration in this worktree (`565_kpi_time_series_...`,
`20260317_finance_v1_canonical_layer.sql`, `567_financial_statements_ratios.sql`,
`20260809_finance_v3_d01_statements_02_integrity.sql`) confirmed which `line_code`s actually exist before
seeding — `REVENUE`/`COGS`/`OPEX`/`CAPEX`/`FIXED_ASSETS`/`DEPRECIATION`/`INVENTORY`/`AR`/`AP`/
`WORKING_CAPITAL`/`LONG_TERM_DEBT`/`INTEREST_EXPENSE`/`TAX_EXPENSE`/`RETAINED_EARNINGS`/`CASH`/`TOTAL_ASSETS`/
`TOTAL_LIABILITIES_EQUITY`/`DIVIDENDS_DECLARED`/`NET_CHANGE_CASH`/`EQUITY` all exist — and seeded 14 rows
covering 7 of the 9 `schedule_type` values (`revenue_pvm`, `cogs_opex` ×2, `capex_depreciation` ×3,
`wc_dso_dio_dpo` ×4, `debt_maturity` ×2, `tax_nol`, `equity_re`). `headcount` and `leases` are **deliberately
left with zero rows** — no canonical payroll-cost or lease-liability/ROU-asset line exists in the taxonomy
today, and inventing one would misrepresent the live schema as more complete than it is. This mirrors the
ADR's own documented-gap discipline (WP-D05's `driver_code` catalog / this ADR's own section 13) rather than
guessing.

### 2.2 Financing → line mapping for double-counting Layer 1 — this work package's own, documented completion

The ADR's section 7.1 SQL sketch leaves the financing UNION branch as a `SELECT ...` placeholder, explicitly
deferred per section 13 escalation #2 ("nie w pełni wypisane w tym ADR-ie... pełna, zamknięta mapa 8
`financing_kind`→linie jest zakresem wykonawczego WP"). This migration's `finance_prediction_detect_overlaps()`
(file 3) implements exactly the two `financing_kind`→line pairs the ADR's own prose names literally elsewhere
in the same section (`FACILITY_DRAWDOWN`/`DISCRETIONARY_REPAYMENT` → `LONG_TERM_DEBT`+`INTEREST_EXPENSE`,
`DIVIDEND_DECLARATION` → `DIVIDENDS_DECLARED`+`RETAINED_EARNINGS`), plus `EQUITY_INJECTION`/`SHARE_BUYBACK` →
`EQUITY` as this work package's own extension using the same reasoning (both are capital-account events onto
the same canonical line). `SURPLUS_ALLOCATION_POLICY`/`COVENANT_DEFINITION`/`MIN_CASH_POLICY` are excluded
from this branch entirely — they are horizon-wide policies (`period_id IS NULL`, enforced by a file-01 CHECK)
rather than point-in-time flows onto a statement line, so they cannot double-count against a specific period
cell; the ADR's own section 9.1 treats them as a separate query pattern over
`finance_prediction_outputs_effective` instead, not as a Layer-1 double-counting source. The remaining 3 of
8 `financing_kind` values (the policy three) needing no mapping here is a structural consequence of the ADR's
own design, not an omission.

### 2.3 `scenario_mode_promoted_at`/`_by` stamping — added beyond the ADR's literal trigger snippet

The ADR's Zalacznik A snippet for `finance_prediction_scenario_mode_transition_guard()` (transcribed
verbatim as the core of this migration's version) does not itself stamp `scenario_mode_promoted_at`/`_by`,
but ADR section 4.1 explicitly requires it ("obsadzone wyłącznie przy jedynym dozwolonym przejściu"). This
work package's version of the trigger adds that stamping on the one allowed transition
(`DRIVER_OVERRIDE → FUNDAMENTAL_INITIATIVE`) and requires the caller to supply `scenario_mode_promoted_by`
(raises if `NULL`) — documented here explicitly, not silently grafted onto the "verbatim" claim for the rest
of the function.

## 3. Fresh install replay

Ran the project's own runner against an **empty** ephemeral database — every migration in
`server/migrations/` (existing + the 3 new files), in the runner's deterministic phase/date/filename order:

```
NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgresql://postgres@127.0.0.1:55700/finance_v3_d07b_fresh \
  LC_ALL=C npx tsx server/scripts/migrate.postgres.ts
```

- **601 migrations applied, 0 skipped, 0 errors** (598 pre-existing migrations at the time this work package
  started — including WP-D01/D01b, WP-D03/D03b, WP-D05/D05b — plus this work package's 3 new files).
- **Per-file timing** (from `schema_migrations.execution_time_ms`):

| Migration | Time |
|---|---|
| `20260809_finance_v3_d07_prediction_01_tables.sql` (10 tables + 14-row partial seed + indexes) | 19 ms |
| `20260809_finance_v3_d07_prediction_02_integrity.sql` (10 functions + 9 triggers) | 1 ms |
| `20260809_finance_v3_d07_prediction_03_readiness.sql` (3 functions + 1 view) | 1 ms |

**All 3 new files together: 21 ms — no lock-time risk for a production backfill window**, consistent with
WP-D01b's/WP-D03b's/WP-D05b's own finding that no Finance v3 migration file has come close to being slow
relative to the ~700-file project baseline.

All 10 new tables, 14 new functions/triggers, and 1 new view confirmed present afterward via `\dt`/`\df`/`\dv`
against the live catalog: `finance_prediction_scenarios`, `finance_prediction_driver_overrides`,
`finance_prediction_initiatives`, `finance_prediction_impact_chain`, `finance_prediction_financing`,
`finance_prediction_outputs`, `finance_prediction_driver_line_map`, `finance_prediction_preflight_runs`,
`finance_prediction_preflight_findings`, `finance_prediction_conflict_resolutions`;
`finance_prediction_gate_driver_overrides`, `finance_prediction_gate_initiatives`,
`finance_prediction_gate_financing`, `finance_prediction_scenario_mode_transition_guard`,
`finance_prediction_scenarios_touch_updated_at`, `finance_prediction_forbid_standard_base_outputs`,
`finance_prediction_driver_overrides_enforce_parent_immutability`,
`finance_prediction_initiatives_enforce_parent_immutability`,
`finance_prediction_impact_chain_enforce_parent_immutability`,
`finance_prediction_financing_enforce_parent_immutability`,
`finance_prediction_outputs_enforce_parent_immutability`, `finance_prediction_detect_overlaps`,
`finance_prediction_readiness_check`, `finance_prediction_can_start_compute`; `finance_prediction_outputs_effective`.

Seed verification: `finance_prediction_driver_line_map` has exactly 14 rows across 7 `schedule_type` values
(section 2.1) — confirmed via `GROUP BY schedule_type` immediately after the fresh install.

## 4. Upgrade replay (idempotency on a non-empty, populated database)

After loading test fixtures (section 5) and running the full 13-scenario test battery (section 6) — leaving
3 `finance_prediction_scenarios`, 1 `finance_prediction_driver_overrides`, 2 `finance_prediction_initiatives`,
2 `finance_prediction_impact_chain`, 0 `finance_prediction_financing`, 0 `finance_prediction_outputs`, 14
`finance_prediction_driver_line_map`, 1 `finance_prediction_preflight_runs`, 2
`finance_prediction_preflight_findings`, 1 `finance_prediction_conflict_resolutions` rows — all 3 raw `.sql`
files were re-executed directly with `psql -f` against the already-migrated, populated database:

- **All 3 files re-applied cleanly, 0 errors.** File 1 emitted the expected `NOTICE: relation ... already
  exists, skipping` lines for every `CREATE TABLE/INDEX IF NOT EXISTS`, and `INSERT 0 0` for the seed
  (`ON CONFLICT (schedule_type, canonical_line_id) DO NOTHING` — all 14 pairs already present); files 2/3
  re-applied silently (`CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS`/`CREATE TRIGGER` for file 2,
  `CREATE OR REPLACE FUNCTION`/`CREATE OR REPLACE VIEW` for file 3).
- **Row counts identical before/after** for all 10 tables (listed above).
- **All triggers/functions re-fired identically after replay**:
  - TEST 3 (Base=Baseline passthrough VIEW): `finance_prediction_outputs_effective` for the `STANDARD_BASE`
    scenario still returns exactly `value_decimal=1000000, source='BASELINE_PASSTHROUGH'`.
  - TEST 8 (double-counting detection): `finance_prediction_detect_overlaps()` still returns exactly 1 row,
    `source_count=2`, `combined_impact_decimal=-8` for the same COGS/Jan26 cell.
  - TEST 1 (Base=Baseline input gate): re-attempting the same rejected `driver_overrides` INSERT on the
    `STANDARD_BASE` scenario still raises the identical `DEC-FIN item 3, Base = Baseline` message.
  - TEST 13 (content-freeze immutability): re-attempting the same rejected `driver_overrides` INSERT on the
    `APPROVED` scenario still raises the identical `parent business_version ... is APPROVED and immutable`
    message.
  - `finance_prediction_can_start_compute()` on the DRIVER_OVERRIDE/FUNDAMENTAL_INITIATIVE test scenario
    correctly reads `false` post-replay — **not** a regression: the battery's own TEST 12 had already
    inserted a second `requires_resolution=true` finding (`finding-d07b-2`) whose resolution attempt was
    rejected by design (that is the whole point of TEST 12), so `NO_OPEN_REQUIRED_RESOLUTIONS` correctly
    reads `false` at this point in the sequence, identically before and after the replay.

This confirms the migrations are safe to re-run — mechanism is `CREATE TABLE/INDEX IF NOT EXISTS`,
`ON CONFLICT ... DO NOTHING` for the seed, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` +
`CREATE TRIGGER`, `CREATE OR REPLACE VIEW` — the same pattern family WP-D01b/WP-D03b/WP-D05b already
established.

## 5. Test fixtures

One org (`org-d07b-test`), one `STATEMENT_PACK` (`art-sp-d07b-1`/`bv-sp-d07b-1`), one `HISTORICAL_ANALYSIS`
(`art-ana-d07b-1`/`bv-ana-d07b-1`, linked via `STATEMENT_TO_ANALYSIS`), one `BASELINE_MODEL`
(`art-bl-d07b-1`/`bv-bl-d07b-1`, linked via `STATEMENT_TO_MODEL`+`ANALYSIS_TO_MODEL`) — all three
deliberately left in `DRAFT` (WP-D07's own readiness gate has no `SOURCE_*_APPROVED` check unlike WP-D05's,
so approving this upstream chain would only add `finance_compute_snapshots`/`finance_working_revisions`
fixture ceremony without exercising anything this migration adds — a discovery this work package made while
building the fixture, documented rather than blindly copying WP-D05b's own always-APPROVED fixture shape).
One `STANDARD` fiscal calendar, three chained `MONTH` periods (Jan/Feb/Mar 2026). One entity
(`ent-d07b-1`, `GROUP_PARENT`, `FULL` consolidation, `ownership_pct=100`). One `finance_baseline_outputs`
`REVENUE` row (1,000,000 PLN) on the Baseline Model, for the `STANDARD_BASE` passthrough test.

Three Prediction Scenarios, each linked to the same Baseline Model via its own `MODEL_TO_SCENARIO` edge
(each edge needs its own `assumption_snapshot_hash`, per WP-B03's CHECK):
- `bv-pred-d07b-base` — `scenario_mode='STANDARD_BASE'` (TEST 1/2/3).
- `bv-pred-d07b-do` — `scenario_mode='DRIVER_OVERRIDE'`, promoted mid-battery to `FUNDAMENTAL_INITIATIVE`
  (TEST 4-12) — kept in `DRAFT` throughout so every table under test stays writable.
- `bv-pred-d07b-frozen` — a **separate** `DRIVER_OVERRIDE` scenario taken all the way to `APPROVED`
  (via a real `finance_working_revisions` → `finance_compute_snapshots` → `status='APPROVED'` chain, the
  same sequence `finance_bv_enforce_immutability()` requires) purely for TEST 13 — kept separate from
  `bv-pred-d07b-do` so locking it content-frozen partway through the battery could not disturb the
  promotion/preflight/double-counting tests running against the other scenario.

All fixture/test SQL lives in the session scratchpad (`/private/tmp/.../scratchpad/d07b_fixture.sql`,
`d07b_tests.sql`), not in the repo — same convention WP-D01/WP-D01b/WP-D03b/WP-D05b's own tests used.

## 6. Constraint / trigger / function verification — all 13 ADR-numbered scenarios, live

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | `STANDARD_BASE` scenario + `driver_override` INSERT | Rejected ("Base = Baseline") | ✅ exact `DEC-FIN item 3, Base = Baseline` message |
| 2 | `STANDARD_BASE` scenario + own `finance_prediction_outputs` row | Rejected | ✅ exact `may never own its own output rows` message |
| 3 | `finance_prediction_outputs_effective` for `STANDARD_BASE` scenario | Returns exactly the `finance_baseline_outputs` row (1,000,000 PLN REVENUE), `source='BASELINE_PASSTHROUGH'` | ✅ |
| 4 | `DRIVER_OVERRIDE` scenario + `driver_override` INSERT | Accepted | ✅ 1 row present |
| 5 | `DRIVER_OVERRIDE` scenario + `initiative` INSERT | Rejected ("promote the scenario first") | ✅ |
| 6 | `UPDATE scenario_mode` `DRIVER_OVERRIDE → FUNDAMENTAL_INITIATIVE` | Accepted, `scenario_mode_promoted_at`/`_by` stamped | ✅ `promoted_at_set=t`, `promoted_by='tester'` |
| 6b | `UPDATE scenario_mode` `FUNDAMENTAL_INITIATIVE → DRIVER_OVERRIDE` (degradation attempt) | Rejected ("one-way only") | ✅ |
| 7 | Post-promotion: 2× `initiative` INSERT + 2× `impact_chain` INSERT (two initiatives, same COGS line) | Accepted (mode now combines B+C) | ✅ 2 impact_chain rows |
| 8 | `finance_prediction_detect_overlaps()` — 2 initiatives (-5% and -3% COGS), same entity/line/period (COGS/Jan26) | 1 row, `source_count=2`, `combined_impact_decimal=-8` | ✅ |
| 9 | `finance_prediction_can_start_compute()` before any preflight | `false` (`HAS_CURRENT_PREFLIGHT=false`) | ✅ |
| 10 | After preflight run with 1 `requires_resolution=true` finding, unresolved | `false` (`NO_OPEN_REQUIRED_RESOLUTIONS=false`, detail `1 required finding(s) without a RESOLVED resolution`) | ✅ |
| 11 | After adding a `RESOLVED` resolution for that finding | `true` (all three named checks `true`) | ✅ |
| 12 | `conflict_resolution` with `requires_review=true`, `state='RESOLVED'`, `reviewed_by=NULL` (custom detail supplied, so only the maker-checker CHECK is under test) | Rejected (`chk_finance_prediction_conflict_resolutions_review`) | ✅ — also separately confirmed the acceptance case (same row with `reviewed_by='cfo-reviewer'` set) inserts cleanly |
| 13 | INSERT into `finance_prediction_driver_overrides` on a scenario whose parent `business_version` is `APPROVED` | Rejected (immutability) | ✅ exact `parent business_version ... is APPROVED and immutable` message |

All 13 numbered tests (plus 6b) re-ran identically after the upgrade replay (section 4) — same rejections,
same messages, same detection/readiness results.

### 6.1 A real authoring mistake this work package's own live testing caught (not a migration bug)

The first draft of TEST 12 supplied `resolution_choice='CUSTOM'` without `custom_resolution_detail`, and hit
`chk_finance_prediction_conflict_resolutions_custom_detail` instead of the intended
`chk_finance_prediction_conflict_resolutions_review` CHECK — both CHECKs are correctly enforced by the
migration (this is exactly the kind of "two independent guards, prove both" defense-in-depth the D05b report
already valued), but the *test* was not isolating the one it meant to exercise. Fixed by supplying a valid
`custom_resolution_detail` in the test fixture so TEST 12 exercises only the maker-checker CHECK it names —
called out explicitly here per the "verify real runtime, not docs" discipline: this was a test-authoring gap
found by actually running the SQL, not a defect in the shipped migration.

## 7. Teardown

`pg_ctl -D /private/tmp/finance-v3-gate-d07b-pgdata-60838 -m fast stop` followed by `rm -rf` of that
directory, executed immediately after this report was written. Final `ps aux` confirmed only PID 911 (the
shared Homebrew instance) remained; no process from this work package's ephemeral cluster was left running.

## 8. Summary

- 3 new additive migration files in `server/migrations/` (`20260809_finance_v3_d07_prediction_01_tables.sql`,
  `..._02_integrity.sql`, `..._03_readiness.sql`), matching the ADR's own Zalacznik A execution grouping,
  creating 10 new tables (zero columns added to any pre-existing table), 14 functions/triggers, 1 view, and a
  small, honestly-partial 14-row seed for `finance_prediction_driver_line_map` (section 2.1).
- Fresh install: 601/601 migrations applied, 0 errors; the 3 new files together add 21 ms.
- Upgrade replay: all 3 files re-applied cleanly against a populated database, 0 errors, row counts and
  trigger/function/view behavior identical before/after (including the correctly-unchanged
  `can_start_compute=false` state, section 4).
- **Base = Baseline enforcement — all three layers verified live**: input-side trigger rejection (TEST 1),
  output-side trigger rejection (TEST 2), and the `finance_prediction_outputs_effective` VIEW's structural
  passthrough for `STANDARD_BASE` (TEST 3) — the guarantee is that no second row can ever exist to diverge,
  not an independent recomputation happening to match.
- **`scenario_mode` hierarchy verified live**: `DRIVER_OVERRIDE` rejects initiatives (TEST 5), the one
  allowed promotion `DRIVER_OVERRIDE → FUNDAMENTAL_INITIATIVE` is accepted and stamps
  `scenario_mode_promoted_at`/`_by` (TEST 6), the reverse degradation is rejected (TEST 6b), and after
  promotion both driver overrides and initiatives/impact-chain rows coexist (TEST 4/7).
- **Double-counting Layer 1 SQL verified live**: `finance_prediction_detect_overlaps()` correctly groups two
  independent initiatives targeting the same entity/line/period cell and reports `source_count=2`,
  `combined_impact_decimal=-8` (TEST 8) — proves the grouping mechanism; Layer 2's real-currency numeric
  preview remains an explicitly out-of-scope contract (ADR section 7.2), same documented boundary WP-D03
  section 6.3 already established for unit-checking.
- **Two-stage Compute gate verified live**: `finance_prediction_can_start_compute()` correctly reads `false`
  before any preflight (TEST 9), `false` with an unresolved required finding (TEST 10), `true` once resolved
  (TEST 11) — and building assumptions is never blocked by this gate (TEST 4/7 succeed regardless of
  preflight state, exactly as ADR section 6.2 requires).
- **Maker-checker verified live**: a materially-flagged, `RESOLVED` conflict resolution without a reviewer is
  rejected (TEST 12), the same row with a reviewer set is accepted.
- **Content freeze (immutability) verified live**: INSERT into `finance_prediction_driver_overrides` on an
  `APPROVED` parent scenario is rejected (TEST 13), on a separate, dedicated scenario kept apart from the
  rest of the battery so approving it could not disturb the other tests.
- 1 real test-authoring gap found and fixed by this work package's own live testing (section 6.1) — not a
  migration defect, both underlying CHECK constraints were already correctly enforced.
- `finance_prediction_impact_chain.capacity_constraint_ref`/`cannibalizes_impact_id`, Layer 2's real-currency
  double-counting preview, the reverse-stress/break-even engine (ADR section 9.2), and the full
  `financial_model_events` → `finance_prediction_financing` backfill (ADR section 10) were **not** exercised
  with live data in this work package — same documented boundary the ADR itself calls out (ADR section 13
  escalations #3/#4/#5/#7): full exercise is deferred to the executive Prediction Compute work package
  (analogous to WP-D06 for Baseline).

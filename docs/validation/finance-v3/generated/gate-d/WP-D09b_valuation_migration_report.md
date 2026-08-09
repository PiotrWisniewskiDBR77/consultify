# WP-D09b — Enterprise Valuation Migration Report (Gate D / Fala 7)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, section 9
(Enterprise Valuation — pełna przebudowa), EPIC-07.
**Work package:** WP-D09b — turns the accepted WP-D09 ADR
(`docs/validation/finance-v3/generated/gate-d/WP-D09_valuation_schema_ADR.md`) into real, additive SQL
migrations and tests them (fresh + upgrade replay, N/A!=zero two-layer guarantee, DEFERRABLE basket
weight-sum constraint trigger, Advisor freeze/staleness, EV-bridge as_of alignment, 5x5 sensitivity gate,
comps readiness gate, lineage exclusivity) on an isolated Postgres — the same pattern WP-D01b/WP-D03b/
WP-D05b/WP-D07b applied to the WP-D01/WP-D03/WP-D05/WP-D07 ADRs.
**Date:** 2026-08-10
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Input:** `WP-D09_valuation_schema_ADR.md` (full text read first, per the ADR's own claim of 30 live-tested
scenarios on an ephemeral cluster) — Zalacznik A gives literal, live-tested DDL for the lineage exclusivity
index, `finance_valuation_methods` (with both N/A!=zero CHECKs), the DEFERRABLE weight-sum constraint
trigger, and the two Advisor `finance_business_versions` triggers, transcribed verbatim below; the ADR's own
prose in sections 6/8/9/10/11/12 gives the remaining eight tables and seven triggers, transcribed from that
prose rather than copied from an existing `.sql` block (the same "unikanie duplikowania" situation WP-D05b/
WP-D07b were already in relative to their own ADRs).

---

## 1. Database isolation

Same hard rule as WP-C01/WP-D01b/WP-D03b/WP-D05b/WP-D07b (real prior incident: a local runtime once had
access to the production database — `docs/validation/finance-v3/generated/gate-a/WP-A04_security_closure.md`).
This work package never touched the shared Homebrew Postgres instance
(`/opt/homebrew/opt/postgresql@15/bin/postgres -D /opt/homebrew/var/postgresql@15`, **PID 911**, confirmed
running throughout via `ps aux` before and after this session, left completely alone).

- **Own ephemeral cluster:** data directory `/private/tmp/wp_d09b_pgdata`, initialized with
  `initdb --locale=C` using the `/opt/homebrew/opt/postgresql@15/bin/` (Homebrew PostgreSQL 15.15) binaries.
- **`LC_ALL=C`** exported for `initdb`/`pg_ctl`/`psql`/the migration runner (the same recurring macOS gotcha
  WP-D01b/WP-D03b/WP-D05b/WP-D07b already documented — without it, postmaster fails to start with "became
  multithreaded during startup").
- **Own port:** `57411`, confirmed free via `lsof` before starting; `listen_addresses=127.0.0.1` (loopback
  only), Unix socket directory `/private/tmp`.
- **Verification during the session:** `ps aux` before and after confirmed PID 911 (shared instance,
  untouched) and this work package's own ephemeral postmaster (`-D .../wp_d09b_pgdata -p 57411`) as fully
  separate processes; an unrelated, independent concurrent session's own ephemeral cluster (visible in `ps
  aux` under a different data directory/port, running a `pnpm seed`/`smoke` script) was observed and left
  completely alone.
- **`NODE_ENV=test`** set only to satisfy `assertNoPrivateRailwayDbHostOutsideRailway` /
  `resolveReachableDatabaseUrl` (`server/src/config/databaseTargetResolver.ts`) when pointing the migration
  runner at a loopback host — left fully in place, not bypassed.
- **Teardown:** `pg_ctl -m fast stop` followed by `rm -rf` of the data directory, executed at the end of this
  work package (section 7). Final `ps aux` confirmed only PID 911 (plus the unrelated, independent concurrent
  session's own processes, never touched) remained.

## 2. Migrations delivered

Two new, purely additive files in `server/migrations/` — not the usual three (tables → integrity →
readiness) WP-D01/D03/D05/D07 shipped, because this ADR's own section 13 explicitly scopes
`finance_valuation_can_start_compute()` as "kontrakt, nie implementacja... zakres przyszlego WP" (the same
documented boundary WP-D07's ADR section 6.2 drew before WP-D07b implemented ITS OWN gate — that ADR asked
for an implementation; this one explicitly asks for the opposite). No third readiness file is missing by
omission; it is out of scope by the ADR's own words, called out here rather than silently skipped.

| # | File | Creates |
|---|---|---|
| 1 | `20260809_finance_v3_d09_valuation_01_tables.sql` | Partial unique index `uq_finance_lineage_edges_one_valuation_source` on the pre-existing `finance_lineage_edges` (zero column/CHECK touched); `finance_valuation_cases`, `finance_valuation_variants`, `finance_valuation_wacc_inputs`, `finance_valuation_methods` (+ both N/A!=zero CHECKs + basket-only CHECK + `OTHER_WITH_POLICY` CHECK), `finance_valuation_terminal` (+ XOR CHECK), `finance_valuation_ev_equity_bridge` + `finance_valuation_ev_equity_bridge_components`, `finance_valuation_sensitivity_grids` + `finance_valuation_sensitivity_cells`, `finance_valuation_comps` (+ value bundle + exclusion-rationale CHECKs), `finance_valuation_advisor_outputs` (+ required AI policy columns), `finance_valuation_advisor_output_variants` (many-to-many compare bridge) |
| 2 | `20260809_finance_v3_d09_valuation_02_integrity.sql` | `finance_valuation_check_basket_weight_sum()` (DEFERRABLE constraint trigger), `finance_valuation_methods_check_comps_readiness()`, `finance_valuation_terminal_check_g_below_wacc()`, `finance_bridge_check_as_of_alignment()`, `finance_sensitivity_check_grid_complete()` + `..._on_status()` (both DEFERRABLE constraint triggers), `finance_valuation_mark_advisor_stale_on_recompute()` / `finance_valuation_freeze_advisor_on_approval()` (both on `finance_business_versions`), `finance_advisor_outputs_enforce_freeze()`, `finance_valuation_advisor_outputs_no_new_after_approval()`, `finance_valuation_advisor_output_variants_require_comparison()`, and nine per-table parent-content immutability guards (see section 2.1) |

Filename suffix `_01_`/`_02_` pins the deterministic same-date filename sort order the migration runner
(`server/scripts/migrate.postgres.ts`) uses; confirmed live (section 3) that both files sort correctly
between the pre-existing `..._d07_prediction_03_readiness.sql` and `..._d_ap04_autosave_checkpoints.sql`. No
filename contains the substring `seed`/`mock`/`demo`/a leading `add_` — WP-D03b found the runner's
`isSqliteOnlyMigration()` silently excludes such filenames, WP-D05b/D07b independently re-confirmed the
trap; this work package ships zero seed data, so the exclusion does not apply, but names were checked
against that list anyway before being finalized.

Zero `DROP`/`RENAME`/`ALTER ... TYPE` on any existing table. The **only** touch to a pre-existing table is
one new partial unique index on `finance_lineage_edges` (no column, no CHECK, no existing row touched — and
that table's own append-only deny-update/delete triggers from WP-B03 are unaffected, since `CREATE INDEX` is
DDL, not a row mutation those triggers fire on). All twelve new tables use
`TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`, matching the live-schema convention
WP-C01/WP-D01b/WP-D03b/WP-D05b/WP-D07b already established.

### 2.1 Parent-content-table immutability — nine explicit functions, not the ADR's one generic one

The ADR's own prose (section 12.3) describes Advisor freeze as reusing "the same generic
`finance_valuation_enforce_parent_immutability()` that every other Valuation content table uses." This work
package documents a divergence: it ships **nine** small, explicit, per-table immutability functions (the same
convention WP-D01/WP-D03/WP-D05/WP-D07 already established —
`finance_stmt_lines_enforce_parent_immutability` / `finance_analysis_kpi_values_..._` /
`finance_baseline_{schedules,assumptions,outputs}_..._` / `finance_prediction_{...}_..._`), not one shared
function. Reason: Valuation's content tables reach their parent `business_version_id` through three
different join depths — direct column on `finance_valuation_variants`/`wacc_inputs`/`methods`/
`ev_equity_bridge`; one hop via `method_id` on `terminal`/`sensitivity_grids`/`comps`; one hop via `bridge_id`
on bridge components; two hops via `grid_id`→`method_id` on sensitivity cells. A single generic function
would need either dynamic SQL keyed by table name or a lookup table mapping table→join-path — more moving
parts and a less obviously-correct guarantee than nine independently readable, independently testable
functions matching the codebase's own established pattern. The two Advisor triggers on
`finance_business_versions` itself (staleness-on-recompute, freeze-on-approval) genuinely ARE the ADR's
"generic, table-agnostic, fires for every artifact type, no-ops for non-Valuation rows" shape — those two are
transcribed verbatim, unchanged, exactly as the ADR describes (section 6).

## 3. Fresh install replay

Ran the project's own runner against an **empty** ephemeral database — every migration in
`server/migrations/` (existing + the 2 new files), in the runner's deterministic phase/date/filename order:

```
NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgresql://postgres@127.0.0.1:57411/finance_v3_d09b_fresh \
  LC_ALL=C npx tsx server/scripts/migrate.postgres.ts
```

- **603 migrations applied, 0 skipped, 0 errors** (601 pre-existing migrations at the time this work package
  started — including WP-D01/D01b, WP-D03/D03b, WP-D05/D05b, WP-D07/D07b — plus this work package's 2 new
  files). Confirmed both new files sort correctly between `..._d07_prediction_03_readiness.sql` and
  `..._d_ap04_autosave_checkpoints.sql`.
- **Per-file timing** (from `schema_migrations.execution_time_ms`):

| Migration | Time |
|---|---|
| `20260809_finance_v3_d09_valuation_01_tables.sql` (1 index + 12 tables + ~20 CHECKs + indexes) | 16 ms |
| `20260809_finance_v3_d09_valuation_02_integrity.sql` (13 functions + 20 triggers) | 2 ms |

**Both new files together: 18 ms — no lock-time risk for a production backfill window**, consistent with
WP-D01b's/WP-D03b's/WP-D05b's/WP-D07b's own finding that no Finance v3 migration file has come close to
being slow relative to the ~700-file project baseline.

All 12 new tables confirmed present afterward via `\dt`: `finance_valuation_cases`,
`finance_valuation_variants`, `finance_valuation_wacc_inputs`, `finance_valuation_methods`,
`finance_valuation_terminal`, `finance_valuation_ev_equity_bridge`,
`finance_valuation_ev_equity_bridge_components`, `finance_valuation_sensitivity_grids`,
`finance_valuation_sensitivity_cells`, `finance_valuation_comps`, `finance_valuation_advisor_outputs`,
`finance_valuation_advisor_output_variants`. All 13 new functions and 20 new triggers confirmed present via
`pg_proc`/`pg_trigger` (listed in section 2's table). The lineage exclusivity partial unique index
(`uq_finance_lineage_edges_one_valuation_source`) confirmed present on `finance_lineage_edges` via `\d`.

## 4. Upgrade replay (idempotency on a non-empty, populated database)

After loading test fixtures (section 5) and running the full 30-scenario test battery (section 6) — leaving
1 `finance_valuation_cases`, 3 `finance_valuation_variants`, 1 `finance_valuation_wacc_inputs`, 4
`finance_valuation_methods`, 2 `finance_valuation_terminal`, 1 `finance_valuation_ev_equity_bridge`, 2
`finance_valuation_ev_equity_bridge_components`, 1 `finance_valuation_sensitivity_grids`, 25
`finance_valuation_sensitivity_cells`, 1 `finance_valuation_comps`, 4 `finance_valuation_advisor_outputs`, 2
`finance_valuation_advisor_output_variants` rows — both raw `.sql` files were re-executed directly with
`psql -f` against the already-migrated, populated database:

- **Both files re-applied cleanly, 0 errors.** File 1 emitted `NOTICE: relation ... already exists, skipping`
  for every `CREATE TABLE/INDEX IF NOT EXISTS`; file 2 re-applied silently (`CREATE OR REPLACE FUNCTION` +
  `DROP TRIGGER IF EXISTS`/`CREATE TRIGGER` for every regular trigger, `DROP TRIGGER IF EXISTS`/
  `CREATE CONSTRAINT TRIGGER` for the three DEFERRABLE ones — `CREATE OR REPLACE TRIGGER` does not support
  the `CONSTRAINT` keyword combination, so those three explicitly `DROP ... IF EXISTS` first, same idiom as
  every other idempotent trigger in this file).
- **Row counts identical before/after** for all 12 tables (listed above).
- **Triggers/functions re-fired identically after replay** (re-tested live, not just inferred from the file
  re-applying without error):
  - Weight-sum DEFERRABLE constraint trigger: inserting an `OTHER_WITH_POLICY` basket row with `weight_pct=10`
    onto variant A (already at 60+40=100 from TEST 7) still raises the identical `basket weights for
    business_version bv-val-d09b-a sum to 110 (must be 100, or 0 basket rows for DRAFT)` at COMMIT, and the
    row does not persist after rollback (confirmed `count(*) = 0` for that method_type afterward).
  - Advisor freeze immutability: re-attempting to `UPDATE ... SET title = ...` on the already-frozen finding
    from TEST 25/26 still raises the identical `is frozen (approved), no mutation permitted` message.
  - Parent-content immutability: re-attempting `INSERT INTO finance_valuation_methods` on the APPROVED
    `bv-val-d09b-frozen` variant still raises the identical `parent business_version ... is APPROVED and
    immutable; INSERT not permitted` message.

This confirms the migrations are safe to re-run — mechanism is `CREATE TABLE/INDEX IF NOT EXISTS`,
`CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE [CONSTRAINT] TRIGGER` — the same pattern
family WP-D01b/WP-D03b/WP-D05b/WP-D07b already established.

## 5. Test fixtures

One org (`org-d09b-test`). One `BASELINE_MODEL` (`art-bl-d09b-1`/`bv-bl-d09b-1`, DRAFT) and one
`PREDICTION_SCENARIO` (`art-pred-d09b-1`/`bv-pred-d09b-1`, DRAFT, linked via `MODEL_TO_SCENARIO`) as lineage
sources — both deliberately left DRAFT, the same reasoning WP-D07b documented: nothing in this migration's
own surface checks upstream Approval. One `finance_valuation_cases` row with three `VALUATION_CASE` variants:
**A** (`bv-val-d09b-a`, `MODEL_TO_VALUATION`-sourced, the main variant under test for the large majority of
the battery), **B** (`bv-val-d09b-b`, `SCENARIO_TO_VALUATION`-sourced, exists only to prove multi-variant
Case + lineage-exclusivity + compare), and a dedicated **frozen** variant (`bv-val-d09b-frozen`,
`MODEL_TO_VALUATION`-sourced, taken all the way to `APPROVED` via a real `finance_working_revisions` →
`finance_compute_snapshots` → `status='APPROVED'` chain) kept separate from A/B so the Advisor
freeze/immutability battery could not disturb the tests running against them — the same "separate frozen
fixture" pattern WP-D07b's own TEST 13 scenario used.

Materially smaller fixture than WP-D05b's/WP-D07b's own: **no `finance_stmt_entities`/periods/calendars/
`finance_baseline_outputs`/`finance_prediction_outputs` rows were needed** — nothing in the WP-D09 schema
references entity/period/canonical-line directly (FCFF/WACC/DCF actual numeric computation is a future
Valuation Compute WP, ADR sections 5/13), confirmed by the fact the full 30-scenario battery ran to
completion without ever needing one.

All fixture/test SQL lives in the session scratchpad
(`/private/tmp/finance-v3-gate-a-20260809-scratch/d09b_fixture.sql`, `d09b_tests.sql`), not in the repo —
same convention WP-D01/WP-D01b/WP-D03b/WP-D05b/WP-D07b's own tests used.

### 5.1 A real authoring bug this work package's own live testing caught (not a migration defect)

psql's client-side `:'var'` variable interpolation (populated via `\gset`) **does not substitute inside a
dollar-quoted (`$$ ... $$`) `DO` block body** — confirmed by direct reproduction (`SELECT :'x'` works, `DO $$
BEGIN RAISE NOTICE '%', :'x'; END $$;` fails with `syntax error at or near ":"`, even though `\echo :x`
proves the variable is set correctly). This is not documented anywhere obvious in `psql --help`; it was
found live while building the first draft of the terminal/bridge/comps/Advisor DO-block tests (TESTs
13-30), which all initially referenced `:'dcf_fcff_method_id'`/`:'bridge_id'`/`:'precedent_method_id'`/
`:'compare_finding_id'` etc. inside `DO $$ ... $$` bodies and all failed with the identical `syntax error at
or near ":"`. Fixed by resolving every such id via an **inline scalar subquery** inside the DO block's own
PL/pgSQL body instead (e.g. `(SELECT id FROM finance_valuation_methods WHERE business_version_id = ... AND
method_type = ...)`) rather than a psql-level variable — the plain top-level SQL statements in TESTs 18/19/20
(the `BEGIN;`/`COMMIT;` blocks, never wrapped in `DO $$`) continued to use `:'dcf_fcff_method_id'`
successfully throughout, confirming the failure is specific to dollar-quoted `DO` bodies, not `:'var'`
substitution in general. Documented here per the "verify real runtime, not docs" discipline: this was a
test-authoring/tooling discovery, not a defect in the shipped migration SQL, which never uses psql variables
at all.

A second, smaller authoring bug of the same class: the first draft of the snap-2 setup (TEST 24) inserted a
second `is_current=true` `finance_working_revisions` row for the same `artifact_id` without first retiring the
first one, tripping WP-B01's own `uq_finance_wr_one_current` partial unique index ("exactly one live Draft
checkpoint per artifact"). Fixed by adding an explicit `UPDATE ... SET is_current = false` for the prior
checkpoint before inserting the new one — again, a fixture-authoring gap this work package's own live testing
caught, not a defect in the shipped migration (the constraint the fixture tripped is WP-B01's, working
exactly as designed).

## 6. Constraint / trigger / function verification — all 30 ADR-numbered scenarios, live

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | Case + variant A + `MODEL_TO_VALUATION` edge | Accepted | ✅ |
| 2 | Second edge (`SCENARIO_TO_VALUATION`) to the SAME target as #1 | Rejected (`uq_finance_lineage_edges_one_valuation_source`, `duplicate key value violates unique constraint`) | ✅ |
| 3 | Second, independent variant B, `SCENARIO_TO_VALUATION` source | Accepted | ✅ |
| 4 | Method: default `NOT_CONFIGURED`/`MISSING`/`NULL` | Accepted | ✅ |
| 5 | Method: `NOT_CONFIGURED` + `PRESENT_ZERO`/0 | Rejected (`chk_finance_methods_result_matches_readiness`) | ✅ |
| 6 | Method: `READY` + `MISSING` | Rejected (`chk_finance_methods_result_matches_readiness`) | ✅ |
| 7 | Basket: 60 (DCF_FCFF) + 40 (DCF_FCFE) = 100, one transaction, COMMIT | Accepted | ✅ |
| 8 | Basket: + 10 (DIVIDEND_DISCOUNT) = 110, one transaction, COMMIT | Rejected at COMMIT (`basket weights ... sum to 110`) | ✅ |
| 9 | Cross-check: `weight_pct=0` | Rejected (`chk_finance_methods_weight_basket_only`) | ✅ |
| 10 | Cross-check: `weight_pct=NULL` | Accepted | ✅ |
| 11 | WACC: capital structure 30+70, then 25+75 | Both accepted | ✅ |
| 12 | WACC: capital structure 30+65=95 | Rejected (`chk_finance_wacc_target_structure_sum`) | ✅ |
| 13 | Terminal: `g=9.5 >= WACC=9.5` | Rejected (`g_pct must be strictly less than computed WACC`) | ✅ |
| 14 | Terminal: `g=2.5 < WACC=9.5` | Accepted | ✅ |
| 15 | Terminal: `EXIT_MULTIPLE` cross-check alongside `GORDON_GROWTH`, same method | Accepted (2 rows, 1 method) | ✅ |
| 16 | Bridge: 2 components, matching `as_of_date` | Accepted | ✅ |
| 17 | Bridge: component with mismatched `as_of_date` | Rejected (`component as_of_date ... does not match bridge header`) | ✅ |
| 18 | Sensitivity: 20 cells + `COMPLETE`, one transaction, COMMIT | Rejected at COMMIT (`has 20 cells (must be 25)`) | ✅ |
| 19 | Sensitivity: 25 cells, 1 base cell, `COMPLETE`, one transaction, COMMIT | Accepted | ✅ |
| 20 | Sensitivity: 25 cells, 2 base cells, `COMPLETE`, one transaction, COMMIT | Rejected at COMMIT (`has 2 base cells (must be exactly 1)`) | ✅ |
| 21 | Comps: `PRECEDENT_TRANSACTIONS` → `READY` with 0 comps | Rejected (`cannot be READY with zero usable comps rows`) | ✅ |
| 22 | Comps: same method, 1 usable comp added, then `READY` | Accepted | ✅ |
| 23 | Advisor: finding pinned to the fresh (current) snapshot | Accepted | ✅ |
| 24 | Advisor: recompute (new snapshot) → old finding `is_stale=true`, `stale_since` set, row not deleted | ✅ (confirmed via live `SELECT`) | ✅ |
| 25 | Advisor: approval of the (separate) frozen variant → finding `is_frozen=true`, `frozen_at` set | ✅ (confirmed via live `SELECT`) | ✅ |
| 26 | Advisor: mutate the now-frozen finding | Rejected (`is frozen (approved), no mutation permitted`) | ✅ |
| 27 | Methods: `INSERT` on the now-APPROVED frozen variant | Rejected (parent immutability) | ✅ |
| 28 | Advisor: new `INSERT` on the now-APPROVED frozen variant | Rejected (`APPROVED; new Advisor findings not permitted`) | ✅ |
| 29 | Advisor: comparison finding + 2-row bridge (`PRIMARY`/`COMPARED_AGAINST`, variant A vs. B) | Accepted | ✅ |
| 30 | Advisor: bridge row for a finding with `is_comparison=false` | Rejected (`parent finding ... has is_comparison=false`) | ✅ |

All 30 numbered tests (plus 11a/11b as the ADR's own two-part framing of TEST 11) re-verified identically
after the upgrade replay for the three highest-risk mechanisms (weight-sum DEFERRABLE trigger, Advisor
freeze immutability, parent-content immutability — section 4).

These tests are **not** Gate C — no resume/checksums/shadow-parity/canary, and no test against a real
legacy-data backfill from `valuations`/`valuation_snapshots`/`financial_valuation_snapshots` (ADR section 12
pt.6/15 pt.6 explicitly scopes that to a future WP). No actual FCFF/WACC/DCF numeric computation is tested
(that is the future Valuation Compute WP, ADR sections 5/13) — this is a proof that the DDL is syntactically
correct AND that its physical guarantees (exactly-one-source, N/A!=zero two-layer, basket-sum=100 atomically
at COMMIT, cross-check weight always NULL, `g<WACC`, EV-bridge `as_of` alignment, 25-cell/1-base-cell gate,
comps readiness, Advisor freeze/staleness/many-to-many-compare) behave exactly as designed on real,
multi-table, multi-transaction Postgres behavior — not merely that the SQL parses.

## 7. Teardown

`pg_ctl -D /private/tmp/wp_d09b_pgdata -m fast stop` followed by `rm -rf` of that directory, executed
immediately after this report was written. Final `ps aux` confirmed only PID 911 (the shared Homebrew
instance) and an unrelated, independent concurrent session's own processes (never touched) remained; no
process from this work package's ephemeral cluster was left running.

## 8. Summary

- 2 new additive migration files in `server/migrations/` (`20260809_finance_v3_d09_valuation_01_tables.sql`,
  `..._02_integrity.sql`) — not 3, because the ADR's own section 13 explicitly scopes the Valuation Compute
  readiness gate out of this work package (documented, not an omission) — creating 12 new tables (zero
  columns added to any pre-existing table), 1 new partial unique index on the pre-existing
  `finance_lineage_edges`, 13 functions, and 20 triggers.
- Fresh install: 603/603 migrations applied, 0 errors; the 2 new files together add 18 ms.
- Upgrade replay: both files re-applied cleanly against a populated database, 0 errors, row counts identical
  before/after, and the three highest-risk trigger mechanisms (weight-sum, Advisor freeze, parent
  immutability) re-verified to raise the identical error live post-replay, not merely inferred from a clean
  `psql -f` exit code.
- **N/A!=zero — both layers verified live**: Layer 1 (reused WP-B01 value-status bundle) and Layer 2 (new
  `readiness`↔`result_value_status` cross-check) both independently reject a silent-zero attempt (TEST 5) and
  a "READY with no result" attempt (TEST 6) — the guarantee is that neither can happen, not that one
  redundant check happens to catch what the other misses.
- **Basket weight-sum=100 DEFERRABLE constraint trigger verified live, exactly as the ADR's own flagship
  claim requires**: a multi-row 60+40=100 basket committed atomically within one transaction without
  tripping on the intermediate 60-only state (TEST 7); a subsequent +10=110 addition was rejected precisely
  at `COMMIT`, not at the intermediate `INSERT` (TEST 8), and the rejected row does not persist (confirmed
  post-replay re-test, section 4) — proving the transaction-final semantics the whole mechanism exists for,
  not merely that the trigger fires at all.
- **Cross-check weight_pct always NULL, never 0, verified live**: TEST 9/10.
- **Terminal `g<WACC` verified live, cross-table**: rejects `g=WACC` exactly (strict inequality, TEST 13),
  accepts `g<WACC` (TEST 14), and coexists with an `EXIT_MULTIPLE` cross-check on the same method (TEST 15).
- **EV→Equity bridge `as_of` alignment verified live**: aligned components accepted (TEST 16), misaligned
  rejected with the exact header/component dates named in the error (TEST 17).
- **Sensitivity 5×5 gate verified live, transaction-final**: 20-cell `COMPLETE` rejected at COMMIT (TEST 18),
  25-cell/1-base-cell `COMPLETE` accepted (TEST 19), 25-cell/2-base-cell `COMPLETE` rejected at COMMIT
  (TEST 20) — same atomic-at-COMMIT discipline as the weight-sum trigger, and monotonicity remains explicitly
  out of scope per the ADR's own instruction (section 10).
- **Comps readiness gate verified live**: 0 usable comps blocks `READY` (TEST 21), 1 usable comp unblocks it
  (TEST 22) — closes the "0 configured" vs. "READY with an empty peer set" ambiguity the ADR names.
- **Lineage exclusivity verified live**: a second source edge type to an already-sourced target is rejected
  by the new partial unique index (TEST 2), while a second, independent variant of the same Case with a
  different source type is accepted (TEST 3) — proving the index is scoped per-target, not per-Case.
- **Advisor lifecycle verified live, end to end**: fresh-snapshot pinning (TEST 23), staleness on recompute
  without deletion (TEST 24), freeze on approval (TEST 25), post-freeze immutability (TEST 26), parent
  immutability blocking new content on the approved variant (TEST 27), no new Advisor findings post-approval
  (TEST 28), many-to-many compare bridge accepted for a comparison finding (TEST 29) and rejected for a
  non-comparison one (TEST 30) — zero new code in `approveVersion()`
  (`server/src/services/finance/canonical/artifactVersionService.ts:389`), exactly as the ADR requires.
- 2 real test-authoring/tooling gaps found and fixed by this work package's own live testing (section 5.1) —
  neither is a migration defect: the psql `DO $$ ... $$` variable-interpolation discovery, and a
  fixture-only `finance_working_revisions.is_current` conflict (WP-B01's own constraint working correctly).
- Actual FCFF/WACC/DCF numeric computation, the legacy `valuations`/`valuation_snapshots`/
  `financial_valuation_snapshots` backfill, `finance_valuation_can_start_compute()`, and
  correlation/contribution/disagreement analytics across methods (ADR sections 5/7.4/12/13/15) were **not**
  exercised with live data in this work package — same documented boundary the ADR itself calls out
  (ADR section 15 escalations, section 13): full exercise is deferred to the future Valuation Compute work
  package (analogous to WP-D06 for Baseline, WP-D08 for Prediction).

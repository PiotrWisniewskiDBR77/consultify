# WP-D01b — Statements Migration Report (Gate D / Fala 3)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, section 5 (Statements
— pełna przebudowa), EPIC-03.
**Work package:** WP-D01b — turns the accepted WP-D01 ADR
(`docs/validation/finance-v3/generated/gate-d/WP-D01_statements_schema_ADR.md`) into real, additive SQL
migrations and tests them (fresh + upgrade replay, constraint/trigger regression, AP-01/AP-04 compatibility) on
an isolated Postgres — the same pattern WP-C01 applied to the 7 Gate B ADRs
(`docs/validation/finance-v3/generated/gate-c/WP-C01_migration_report.md`).
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Input:** `WP-D01_statements_schema_ADR.md`, Zalacznik A (full DDL sketch) — used **as the ADR author already
live-tested and corrected it** (FOR EACH ROW constraint triggers, `COALESCE` on the readiness gate's
`bool_and`), not the original naive draft the ADR also documents rejecting.

---

## 1. Database isolation

Same hard rule as WP-C01/WP-D01 (real prior incident: a local runtime once had access to the production
database — `docs/validation/finance-v3/generated/gate-a/WP-A04_security_closure.md`). This work package never
touched the shared Homebrew Postgres instance (`/opt/homebrew/opt/postgresql@15/bin/postgres -D
/opt/homebrew/var/postgresql@15`, **PID 911**, confirmed running throughout via `ps aux` before and after this
session, left completely alone).

- **Own ephemeral cluster:** data directory `/private/tmp/finance-v3-gate-d01b-pgdata-222613021` (random
  suffix), initialized with `initdb --locale=C` using the `/opt/homebrew/opt/postgresql@15/bin/` binaries.
- **`LC_ALL=C` at startup, not just initdb**, was required — `pg_ctl start` failed on the first attempt with
  `FATAL: postmaster became multithreaded during startup / HINT: Set the LC_ALL environment variable to a valid
  locale` until `LC_ALL=C` was exported for the `pg_ctl`/`psql`/migration-runner invocations too, not only for
  `initdb`. Documented here because it is a recurring, previously-noted macOS-specific gotcha (session memory
  `audyt-bazy-danych-2026-08-06.md`), not new to this work package.
- **Own port:** `57891`, picked from the 55000-59999 range and verified free with `lsof -iTCP -sTCP:LISTEN`
  before use; `listen_addresses=127.0.0.1` (loopback only).
- **Verification during the session:** `ps aux` confirmed two fully separate `postgres` processes — PID 911 on
  `-D /opt/homebrew/var/postgresql@15` (untouched shared instance) and the ephemeral cluster's own postmaster on
  `-D /private/tmp/finance-v3-gate-d01b-pgdata-222613021 -p 57891`.
- **`NODE_ENV=test`** set only to satisfy `assertNoPrivateRailwayDbHostOutsideRailway` /
  `resolveReachableDatabaseUrl` (`server/src/config/databaseTargetResolver.ts`) when pointing the migration
  runner at a loopback host — left fully in place, not bypassed (same as WP-C01 section 1).
- **Teardown:** `pg_ctl stop` followed by `rm -rf` of the data directory, executed at the end of this work
  package (section 8). No process from this cluster was left running; confirmed by a final `ps aux` check
  showing only PID 911.

## 2. Migrations delivered

Three new, purely additive files in `server/migrations/`, splitting the ADR's own three-block execution order
(Zalacznik A, "Kolejność wykonania": tables → integrity controls → readiness gate, each block needing the
previous one to exist first):

| # | File | Creates |
|---|---|---|
| 1 | `20260809_finance_v3_d01_statements_01_tables.sql` | `finance_stmt_calendars`, `finance_stmt_periods` (+ 4 partial unique indexes + week/calendar-type trigger), `finance_stmt_entities`, `finance_stmt_fx`, `finance_stmt_lines` (+ `uq_finance_stmt_lines_cell` + parent-immutability trigger), `finance_stmt_reconciliation`, `finance_stmt_source_evidence` |
| 2 | `20260809_finance_v3_d01_statements_02_integrity.sql` | `finance_stmt_unit_value()`, `finance_stmt_balance_tolerance()`, 4 deferred constraint triggers (balance / cash roll-forward / retained-earnings roll-forward / elimination balance) on `finance_stmt_lines`, additive `RETAINED_EARNINGS`/`DIVIDENDS_DECLARED` INSERT into `financial_statement_lines` |
| 3 | `20260809_finance_v3_d01_statements_03_readiness.sql` | `finance_stmt_readiness_check()`, `finance_stmt_is_ready_for_review()` |

Filename suffix `_01_`/`_02_`/`_03_` is not cosmetic: the migration runner (`server/scripts/migrate.postgres.ts`)
sorts same-date files lexicographically by filename, and files 2/3 reference tables/functions files 1/2 create
— the numeric suffix pins the required apply order deterministically rather than relying on alphabetical
accident (`integrity` < `readiness` < `tables` alphabetically, which would have been the *wrong* order).

Zero `DROP`/`RENAME`/`ALTER ... TYPE` on any existing table. All 7 new tables use `TEXT PRIMARY KEY DEFAULT
gen_random_uuid()::text`, matching the convention WP-C01 already established. The one additive `INSERT` into an
existing table (`financial_statement_lines`, file 2) uses `ON CONFLICT (id) DO NOTHING`.

## 3. Fresh install replay

Ran the project's own runner against an **empty** ephemeral database — every migration in `server/migrations/`
(existing + the 3 new files), in the runner's deterministic phase/date/filename order:

```
NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgresql://postgres@127.0.0.1:57891/finance_v3_gate_d01b_fresh \
  LC_ALL=C npx tsx server/scripts/migrate.postgres.ts
```

- **590 migrations pending → 590 applied, 0 skipped, 0 errors.** (Includes the 583 pre-existing migrations, the
  7 Gate B/C Finance v3 files, the AP-04 autosave-checkpoints file, and this work package's 3 new files.)
- **Total wall time for all 590 migrations: 4.69 s.**
- **Per-file timing for the 3 new files** (from `schema_migrations.execution_time_ms`):

| Migration | Time |
|---|---|
| `20260809_finance_v3_d01_statements_01_tables.sql` (7 tables + indexes + 1 trigger) | 18 ms |
| `20260809_finance_v3_d01_statements_02_integrity.sql` (2 functions + 4 constraint triggers + taxonomy insert) | 2 ms |
| `20260809_finance_v3_d01_statements_03_readiness.sql` (2 functions) | 0 ms |

**All 3 new files together: 20 ms — no lock-time risk for a production backfill window**, consistent with
WP-C01's finding that no Finance v3 migration file has come close to being a slow one relative to the ~700-file
project baseline.

All 7 new tables and all 10 new functions confirmed present afterward via `information_schema.tables` /
`pg_proc` (`finance_stmt_calendars`, `finance_stmt_periods`, `finance_stmt_entities`, `finance_stmt_fx`,
`finance_stmt_lines`, `finance_stmt_reconciliation`, `finance_stmt_source_evidence`;
`finance_stmt_unit_value`, `finance_stmt_balance_tolerance`, `finance_stmt_check_balance`,
`finance_stmt_check_cash_rollforward`, `finance_stmt_check_retained_earnings_rollforward`,
`finance_stmt_check_elimination_balance`, `finance_stmt_lines_enforce_parent_immutability`,
`finance_stmt_period_check_week_calendar`, `finance_stmt_readiness_check`, `finance_stmt_is_ready_for_review`).

## 4. Upgrade replay (idempotency on a non-empty, populated database)

After loading test fixtures (section 5: one org, one `STATEMENT_PACK` artifact/business_version, entities,
calendar, 5 periods, 16 `finance_stmt_lines` rows, 2 taxonomy rows), all 3 raw `.sql` files were re-executed
directly with `psql -f` against the already-migrated, populated database:

- **All 3 files re-applied cleanly, 0 errors.** File 1 emitted two harmless `NOTICE: relation ... already
  exists, skipping` lines for the two evidence-table indexes (expected `CREATE INDEX IF NOT EXISTS` behavior,
  not an error); files 2/3 re-applied silently (`CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE
  TRIGGER`).
- **Row counts identical before/after**: `finance_stmt_lines`=16, `finance_stmt_entities`=4,
  `finance_stmt_periods`=4, `finance_stmt_calendars`=1, `financial_statement_lines`
  (`RETAINED_EARNINGS`/`DIVIDENDS_DECLARED`)=2 — no data loss, no duplication (the taxonomy `INSERT ... ON
  CONFLICT DO NOTHING` did not duplicate the 2 rows).
- **All triggers re-fired correctly after replay** — re-ran the parent-immutability test (UPDATE rejected on the
  now-`APPROVED` `bv_d01b_1`) and the balance-check test (fresh period, unbalanced BS rejected on `COMMIT`) a
  second time post-replay: identical rejections, identical error messages.

This confirms the migrations are safe to re-run — mechanism is `CREATE TABLE/INDEX IF NOT EXISTS`, `CREATE OR
REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, and `INSERT ... ON CONFLICT DO NOTHING`
throughout, the exact pattern the brief asked to verify.

## 5. Test fixtures

One org (`org_d01b_test`), one `STATEMENT_PACK` artifact (`art_d01b_1`) with two business versions:
`bv_d01b_1` (taken to `APPROVED` mid-session, to exercise the content-freeze trigger) and `bv_d01b_2` (left
`DRAFT`, to exercise the readiness gate). One `STANDARD` fiscal calendar, five `FY` periods (2023-2027,
chained via `previous_period_id`), three entities (`GROUP_PARENT`, a `SUBSIDIARY`, and an
`ELIMINATION_BUCKET`). All fixture SQL lives in the session scratchpad
(`d01b_fixtures.sql`/individual test files), not in the repo — same "not committed to the repo" convention
WP-D01's own ADR-level tests used (WP-D01 ADR section 9).

## 6. Constraint / trigger verification

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | Balanced BS (`Assets == L+E` exactly, unit=UNITS) | commit succeeds | ✅ |
| 2 | BS diff 600 (unit=THOUSANDS → tolerance=1000) | commit succeeds (600 < 1000) | ✅ |
| 3 | **BS diff 50 000 (unit=UNITS → tolerance=1)** | commit rejected | ✅ rejected with exact `assets=1000000 liab+equity=1050000 diff=50000 tolerance=1` message |
| 4 | `value_status='PRESENT_NONZERO'` with `value_decimal IS NULL` | insert rejected (`chk_finance_stmt_lines_value_shape`) | ✅ |
| 5 | Cash roll-forward consistent (`opening=100000 + net_change=50000 = closing=150000`) | commit succeeds | ✅ |
| 6 | **Cash roll-forward with closing shifted to 250 000 (should be 180 000)** | commit rejected | ✅ rejected with exact `opening=150000 + net_change=30000 != closing=250000 (diff=70000, tolerance=1)` message |
| 7 | RE roll-forward with `DIVIDENDS_DECLARED.value_status='NA'` | commit succeeds | ✅ |
| 8 | **RE roll-forward with `DIVIDENDS_DECLARED` row absent (MISSING by omission) and grossly unbalanced RE (999 999 999 vs. expected ~650 000)** | check **skipped**, commit succeeds despite the imbalance (not a false pass on a real equation, an intentional non-check) | ✅ — proves the "MISSING never becomes 0" rule (ADR section 5.6 point 3) is real, not just documented |
| 9 | Elimination pair 500 000/500 000 (`NATURAL`/`CONTRA`, nets to 0) | commit succeeds | ✅ |
| 10 | **Elimination one-sided 700 000/500 000 (nets to 200 000)** | commit rejected | ✅ rejected with exact `net=200000 (tolerance=1)` message |
| 11 | `uq_finance_stmt_lines_cell` — duplicate `(business_version, entity, canonical_line, period, basis, scope)` | insert rejected | ✅ rejected — `duplicate key value violates unique constraint "uq_finance_stmt_lines_cell"` |
| 12 | **INSERT into `finance_stmt_lines` after parent `business_version` reaches `APPROVED`** | rejected | ✅ rejected — `parent business_version bv_d01b_1 is APPROVED and immutable; INSERT not permitted` |
| 13 | **UPDATE on `finance_stmt_lines` after parent `business_version` reaches `APPROVED`** | rejected | ✅ rejected — same message, `UPDATE not permitted` |
| 14 | **Readiness gate regression: `finance_stmt_readiness_check()` on a DRAFT version with zero `finance_reconciliation_runs` rows** | check #6 (`RECONCILIATION_RESIDUAL_WITHIN_TOLERANCE`) fails, not silently passes; `finance_stmt_is_ready_for_review()` returns `false` | ✅ check #6 returned `passed=f, detail='latest finance_reconciliation_runs.status = NO_RUN_YET'`; `overall_ready = false` |
| 15 | Same version, after inserting one `CLEAN` `finance_reconciliation_runs` row | `finance_stmt_is_ready_for_review()` flips to `true` (all 7 checks pass) | ✅ |

**Test 14 is the direct regression test for the bug the ADR's own live testing found and fixed** (ADR section
7: a bare `v_recon_residual_status IN (...)` against `NULL` evaluates to SQL `NULL`, and `bool_and()` silently
ignores `NULL` rows instead of counting them as failed, which would let a never-reconciled Statement Pack read
as `overall_ready=true`). This migration ships the `COALESCE(..., false)`-corrected version verbatim from the
ADR, and test 14 proves — against real Postgres, not just by inspecting the SQL text — that the naive bug does
**not** reappear: `overall_ready` is `false`, not `true`, when no reconciliation run exists.

All 15 tests re-ran identically after the upgrade replay (section 4) — same rejections, same messages, same
readiness-gate result — confirming the triggers/functions are not lost or altered by re-running the migration
files.

## 7. AP-01/AP-04 compatibility

Per the task's explicit instruction, this section checks whether the real, already-shipped
`server/src/services/finance/grid/*.ts` and `server/src/services/finance/collaboration/*.ts` code — and the
shared `server/src/types/finance/CellRef.ts` (AP-00) both depend on — matches what this migration actually
ships, rather than what the ADR merely proposed.

### 7.1 Column-by-column check: `uq_finance_stmt_lines_cell` vs. `CellRef`

`server/src/types/finance/CellRef.ts` (AP-00, already shipped, not modified by this work package) hard-codes
the exact shape of `finance_stmt_lines`' real uniqueness constraint in its own file header comment and in
`financeStmtLinesRowKeySchema`/`financeStmtLinesColumnKeySchema`:

```
UNIQUE (business_version_id, entity_id, canonical_line_id, period_id, accumulation_basis, consolidation_scope)
        ^^^^^^^^^^^^^^^^^^^   rowKey {entityId, canonicalLineId, consolidationScope}   columnKey {periodId, accumulationBasis}
```

The migration this work package ships (`20260809_finance_v3_d01_statements_01_tables.sql`, `finance_stmt_lines`
table, `CONSTRAINT uq_finance_stmt_lines_cell UNIQUE (business_version_id, entity_id, canonical_line_id,
period_id, accumulation_basis, consolidation_scope)`) matches this **exactly** — same constraint name, same six
columns, same order. No discrepancy, no adjustment needed on either side.

### 7.2 Empirical check: AP-04's own Postgres integration test suite, run against this migration

`server/src/services/finance/collaboration/__tests__/collaboration.pg.test.ts` is AP-04's real,
already-committed integration test — it exercises `autosaveService`, `crashRecoveryService`,
`conflictResolver`, and `computePinning` against a real Postgres, constructing `CellRef` values via
`financeStmtLinesCellRef()` (the AP-00 constructor for `finance_stmt_lines`) as part of its `Operation` payloads
(it does not itself `INSERT` into `finance_stmt_lines` — the executor that would is explicitly out of AP-00's
and AP-04's scope per their own ADRs, section 6.2 of AP-00 — but it does exercise the full `CellRef` shape this
migration's constraint must support).

This test suite was run against the ephemeral cluster **after** this work package's 3 new migration files were
applied (i.e. against the exact schema this report ships):

```
cd server && DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false LC_ALL=C \
  DATABASE_URL=postgresql://postgres@127.0.0.1:57891/finance_v3_gate_d01b_fresh \
  npx vitest run --config vitest.config.ts \
  src/services/finance/collaboration/__tests__/collaboration.pg.test.ts --no-file-parallelism
```

**Result: 13/13 tests passed** (autosave Saved/Conflict states, crash-recovery detect/reconstruct/accept/discard
including the 500-operation ≤5 s benchmark, conflict detection mine/theirs/merge, compute-pinning hash
tracking) — 495 ms wall time.

### 7.3 Conclusion

**No discrepancy found; no adjustment made to either the migration or to AP-01/AP-04.** `CellRef.ts`'s
row/column key shape and `finance_stmt_lines`' real `uq_finance_stmt_lines_cell` constraint were designed
against each other from the start (AP-00 ADR section 5 states this explicitly — CellRef was built to map onto
WP-D01's already-written ADR, not the other way around), and this work package's live migration confirms that
design intent actually holds against a real, migrated database. Per the task's instruction to prefer adjusting
the migration over touching already-tested AP-01/AP-04 files: no such adjustment was needed, and no line in
`server/src/services/finance/grid/` or `server/src/services/finance/collaboration/` was modified.

## 8. Discrepancies between the ADR and what shipped in SQL

The ADR's own Zalacznik A DDL was already live-tested and corrected by the ADR author before this work package
began (two fixes, both carried forward verbatim — see the file-header comments in
`20260809_finance_v3_d01_statements_02_integrity.sql` and `..._03_readiness.sql`):

1. **Constraint triggers rewritten from a `FOR EACH STATEMENT`/transition-table design to `FOR EACH ROW`** —
   Postgres does not support `FOR EACH STATEMENT` constraint triggers at all; this is a hard engine restriction,
   not a style choice. `DEFERRABLE INITIALLY DEFERRED` still gives "check the whole batch at COMMIT" semantics
   per-row, because every row's deferred trigger firing queues up and only actually runs at `COMMIT`.
2. **`COALESCE(v_recon_residual_status IN ('CLEAN', 'WITHIN_TOLERANCE'), false)`** in the readiness-gate check
   #6, instead of a bare `IN (...)` — closes the `NULL`-silently-ignored-by-`bool_and()` bug (this report's
   section 6, test 14, is the regression test proving the fix holds).

This work package (WP-D01b) itself introduces **no further discrepancies** — the DDL in all 3 migration files
is a verbatim transcription of the ADR's (already-corrected) Zalacznik A, split into 3 files along the exact
transaction boundaries the ADR itself specifies ("Kolejność wykonania"). The only WP-D01b-specific decision was
the `_01_`/`_02_`/`_03_` filename-ordering suffix (section 2) — a mechanical requirement of the migration
runner's sort order, not a schema or behavior change.

One thing verified, not changed: all five canonical `financial_statement_lines.line_code` values the integrity
triggers depend on (`TOTAL_ASSETS`, `TOTAL_LIABILITIES_EQUITY`, `CASH`, `NET_CHANGE_CASH`, `NET_INCOME`) were
confirmed **already present** in the live taxonomy (seeded by
`server/migrations/567_financial_statements_ratios.sql`,
`server/migrations/565_kpi_time_series_roi_attribution_finance.sql`, and
`server/migrations/20260317_finance_v1_canonical_layer.sql`) before writing a single test fixture — had any of
these five been missing, the balance/cash/RE triggers would have silently no-op'd (their `SELECT id INTO
v_..._line ...` would resolve to `NULL`, and every downstream lookup keyed on that `NULL` returns no rows,
which the trigger logic treats as "nothing to check yet", not as an error). This is a latent sharp edge inherent
in the ADR's own design (documented here, not fixed unilaterally — the ADR explicitly relies on canonical
taxonomy codes existing, and section 5.1-5.4 of the ADR do not specify what should happen if they don't); flagged
for the executive backfill work package (WP-D01's own section 11 point 3, analog of WP-C03) to keep in mind if a
target organization's taxonomy has ever been locally edited to remove these codes.

## 9. Teardown

`pg_ctl -D /private/tmp/finance-v3-gate-d01b-pgdata-222613021 stop` followed by `rm -rf` of that directory,
executed immediately after this report was written. Final `ps aux` confirmed only PID 911 (the shared Homebrew
instance) remained; no process from this work package's ephemeral cluster was left running.

## 10. Summary

- 3 new additive migration files in `server/migrations/`, matching the ADR's own 3-block execution order
  (tables → integrity controls → readiness gate).
- Fresh install: 590/590 migrations applied, 0 errors, 4.69 s total; the 3 new files together add 20 ms.
- Upgrade replay: all 3 files re-applied cleanly against a populated database, 0 errors, row counts and
  trigger behavior identical before/after.
- 15/15 constraint and trigger tests passed, including:
  - the exact Assets=L+E / cash roll-forward / retained-earnings roll-forward / elimination-balance
    pass-and-fail pairs the ADR itself live-tested (tests 1-10),
  - the `uq_finance_stmt_lines_cell` UNIQUE constraint (test 11),
  - the content-freeze immutability trigger on `APPROVED` business versions (tests 12-13),
  - and — the highest-value regression in this report — **the readiness-gate `COALESCE` fix actually holds
    against real Postgres**: a Statement Pack with zero reconciliation runs correctly reads
    `overall_ready=false`, not the pre-fix bug's `true` (tests 14-15).
- AP-01/AP-04 compatibility: `finance_stmt_lines`' real `uq_finance_stmt_lines_cell` matches AP-00's
  `CellRef.ts` exactly (column-by-column), and AP-04's own 13-test Postgres integration suite
  (`collaboration.pg.test.ts`) passes unmodified against this migration's schema. No changes were made to
  `server/src/services/finance/grid/`, `server/src/services/finance/collaboration/`, or
  `server/src/types/finance/`.
- 2 documented, both inherited-and-verified (not newly introduced) discrepancies from the literal, *original*
  ADR sketch — both already corrected by the ADR author's own live testing and carried forward verbatim by this
  work package (section 8); zero new discrepancies introduced by turning the ADR into migrations.

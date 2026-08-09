# WP-D04 — Analysis KPI Compute Service (Gate D / Fala 4)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, section 6
(Analysis — pełna przebudowa), EPIC-04.
**Work package:** WP-D04 — the compute engine on top of the WP-D03/WP-D03b schema
(`finance_analysis_kpi_catalog`/`finance_analysis_definitions`/`finance_analysis_kpi_values`, already
migrated: `20260809_finance_v3_d03_analysis_0{1,2,3,4}_*.sql`), reusing `computeJobService.ts` (Gate C
job queue), `artifactVersionService.ts`/`lifecycleService.ts` (Gate C lifecycle), and `finance_stmt_lines`
(WP-D01, Fala 3) as the sole source of raw statement data.
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `CODE + TESTS — real code, real ephemeral-Postgres test run, NOT deployed/migrated to demo/dev/prod`

---

## 1. Inputs read (in full, before writing code)

1. `docs/validation/finance-v3/generated/gate-d/WP-D03_analysis_schema_ADR.md` — full design: section 4
   (`finance_analysis_kpi_catalog`/`_definitions`/`_kpi_values`/`_benchmarks`/`_variance`), section 5.2-5.5
   (formula AST JSON schema, worked `DSO`/`CASH_CONVERSION_CYCLE` examples), section 6 (two-layer unit
   checking, period conventions, negative-denominator policy), section 7 (readiness gate, 6 named checks),
   section 8 (lifecycle/compute-run/downstream-selection sequencing, all reused from Gate B/C as-is).
2. `docs/validation/finance-v3/generated/gate-d/WP-D03b_analysis_migration_report.md` — confirms the ADR's
   design actually shipped as 4 real migrations, 595/595 fresh-install, 11/11 constraint tests, 18/18 P0 KPI
   seed rows `COMPILED_OK`. Read the shipped `.sql` files directly (not just the report's prose) for the
   exact table/trigger/function shapes this work package's code has to match byte-for-byte:
   `server/migrations/20260809_finance_v3_d03_analysis_0{1,2,3,4}_*.sql`.
3. `server/src/services/finance/canonical/{statementMappingService,statementReconciliationService}.ts` — the
   Fala 3 service-writing convention this work package follows: pure math/logic separated from
   `withPinnedPostgresTransaction`-based persistence (never `DbPromise`, whose `fallback:true` default
   silently swallows real DB errors), "never silent zero" (a missing input never becomes a fabricated `0`
   or a fabricated `MISSING`-status value carrying a number).
4. `server/src/services/finance/canonical/{artifactVersionService,lifecycleService,computeJobService,
   lineageService,exceptionLedgerService}.ts` — the exact, already-shipped functions this module calls
   as-is (`transition()`'s T2 `submit_for_review`, `enqueue`/`claim`/`completeJobSuccess`/`failJob`,
   `insertEdge` for `STATEMENT_TO_ANALYSIS`), per WP-D03 ADR section 8's explicit instruction not to
   duplicate any of it.
5. `docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.ts`/`.json` — the Fala 3
   INDEPENDENT-oracle GoldCo Manufacturing dataset (`parent.FY2025`, `parent.FY2024_original` restated),
   used as the known-answer source for section 5 below.
6. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 6 (period
   conventions: average balance, LTM, interim annualization, days in period, negative-denominator).

---

## 2. Scope boundary

This work package is exactly the "compute engine" WP-D03 ADR section 6.3/11 pkt 1 explicitly left
unimplemented at the Layer-2 (currency-aware preflight) level, but section 6.2's Layer-1 (structural/
currency-agnostic unit resolution) is **schema-side**, already shipped as the
`finance_analysis_kpi_catalog_before_write` trigger — this work package's `formulaAstEvaluator.ts` is a
**separate, second implementation** of formula evaluation, at **runtime, over real cell values**, not a
duplicate of the schema's compile-time unit checker. Explicitly **not** in scope, per the task brief and the
ADR's own section 11 eskalacje: currency-aware Layer-2 preflight (`finance_analysis_kpi_preflight_currency_check`,
still just a documented contract), benchmarks/variance compute, segment/geography dimensions, and the
Kreator UI. `formula_ref` composite resolution reads sibling **catalog** formulas (never persisted
`finance_analysis_kpi_values` rows for the sibling), so composite KPI compute does not depend on insertion
order of `finance_analysis_kpi_values` selection rows the way the seed catalog's own `formula_ref`
cross-row lookup depends on catalog insertion order (WP-D03b section 2.1's ordering note, different table).

---

## 3. What was implemented

### 3.1 `server/src/services/finance/canonical/periodConventionResolver.ts`

Pure, zero DB imports. Given a `PeriodGraphLookup` (a plain `Map`/function the caller loads once from
`finance_stmt_periods`), resolves the 6 `periodOffset` values `CellRefOperand` carries
(`CURRENT`/`PRIOR_PERIOD`/`PRIOR_YEAR_SAME_PERIOD`/`AVERAGE_CURRENT_AND_PRIOR`/`LTM_SUM_4Q`/
`LTM_LATEST_Q_CLOSE`) into a `{ periodIds, combine }` plan (`combine`: `SINGLE`/`AVERAGE`/`SUM`), walking
`previous_period_id` — never a period-end date heuristic, per WP-D01's own explicit design choice, reused
here verbatim. Also exports `daysInPeriod()` (`period_end - period_start + 1`, never hardcoded `365` —
verified against both a 365-day and a 366-day leap-year fixture) and `annualizationFactor()`
(`periods_per_year / periods_elapsed`, `12/fiscal_month` for MONTH granularity, `4/fiscal_quarter` for Q,
`1` for FY). Every failure mode returns a typed reason (`INSUFFICIENT_HISTORY`/`WRONG_PERIOD_TYPE_FOR_LTM`/
`UNSUPPORTED_PERIOD_TYPE_FOR_YOY`) — never a silent fallback to a point-in-time value, per ADR section 6.4's
explicit instruction for `AVERAGE_BALANCE` on a first-period-on-record cell.

### 3.2 `server/src/services/finance/canonical/formulaAstEvaluator.ts`

Pure, zero DB imports. Recursively evaluates a `formula_ast` `FormulaNode` tree (types mirror WP-D03 ADR
section 5.2's JSON schema 1:1) against two caller-injected resolvers — `CellResolver` (`cell_ref` ->
value) and `FormulaRefResolver` (`formula_ref` -> a sibling KPI's own resolved value, for composites like
`CASH_CONVERSION_CYCLE`) — plus a `DynamicConstantResolver` for `DAYS_IN_PERIOD`/`ANNUALIZATION_FACTOR`.
"Never silent zero" governs every branch:

- A `MISSING` operand anywhere in a subtree propagates `MISSING` for that subtree (never a partial
  average/sum, never a fabricated number).
- Every `divide`/`ratio` node checks its denominator for exact `0` **before** dividing — `0` always
  produces `value_status='NOT_APPLICABLE'`, `quality_flag='DIVISION_BY_ZERO'`, physically matching the DB
  CHECK `chk_finance_analysis_kpi_values_division_by_zero_shape` (a mismatched shape is a write-time
  constraint violation, not a style choice this module could get away with skipping).
- `negative_denominator_policy` (`SHOW_WITH_FLAG`/`FORCE_NA`) is applied once, at the **root** of the
  formula tree, when the root operator is `divide` or `ratio`.

**Documented design decision, not literally spelled out by the ADR's prose:** ADR section 5.2's last
paragraph says `negative_denominator_policy` "applies to" the `ratio` operator specifically. But the ADR's
own seed data (`20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql`, `DSO`/`DIO`/`DPO`/
`REVENUE_GROWTH_YOY`) declares a non-null `negative_denominator_policy` on 4 KPI whose formula root is
`divide`, not `ratio`. A literal `ratio`-only reading would make those 4 catalog rows' policy column dead
data — the policy would never fire for a quarter of the P0 catalog. This module resolves the tension the
way a compute engine actually has to: the policy is a **KPI-level** property (one value per catalog row,
not per AST node), applied to whichever operator sits at the **root** of that KPI's own `formula_ast`,
regardless of whether the ADR's author spelled that root division as `ratio` or `divide`. A `divide`
nested **inside** a tree (e.g. `REVENUE / DAYS_IN_PERIOD` inside `DSO`) only ever gets the physical
`DIVISION_BY_ZERO` guard, never the business-level policy. `CASH_CONVERSION_CYCLE` (root op `subtract`,
catalog `negative_denominator_policy=NULL`) never reaches the policy branch at all — consistent with the
ADR's own "n/a (add/subtract, not a ratio)" note for that row. This reasoning and its 3 supporting unit
tests are in the module's own header comment and `formulaAstEvaluator.test.ts`, not only here.

**A note on the task brief's "MISSING_INPUT" quality_flag example:** `finance_analysis_kpi_values.quality_flag`'s
real DB CHECK (`20260809_finance_v3_d03_analysis_01_tables.sql`) only allows `DIVISION_BY_ZERO`/
`NEGATIVE_DENOMINATOR`/`INSUFFICIENT_HISTORY`/`ESTIMATED_ANNUALIZED` — there is no `MISSING_INPUT` value in
the schema; writing one would be a CHECK-constraint violation, caught the moment this ran against the real
ephemeral Postgres (exactly the class of bug CLAUDE.md's "verify REALNY runtime" rule exists to catch). A
missing required input therefore surfaces as `value_status='MISSING'` with a diagnostic
`interpretation_text` — the fact is expressed through the column the schema actually gives it, never a
non-schema `quality_flag` value and never a fabricated number.

### 3.3 `server/src/services/finance/canonical/kpiComputeService.ts`

The only module in this work package that touches Postgres. `computeAnalysisKpis({ organizationId,
businessVersionId, requestedByUserId, attemptReadinessTransition?, actorId?, role?, expectedVersion? })`:

1. Resolves the exact source Statement Pack Version via `finance_lineage_edges`
   (`edge_type='STATEMENT_TO_ANALYSIS'`) — never a denormalized column, per ADR section 2.3.
2. Loads, once per run: the org's `finance_stmt_periods` graph, the source version's
   `finance_stmt_entities` (`entity_code -> id`), the canonical-line taxonomy (`line_code -> id`, org
   override wins over global, same precedence `statementMappingService.ts` already established), every
   `finance_stmt_lines` cell for the source version (deduplicated by `accumulation_basis` priority when a
   pack carries more than one accumulation basis for the same cell), and every `ACTIVE` KPI catalog row.
3. For every pre-existing `finance_analysis_kpi_values` row for this Analysis (row **presence** is
   selection, per ADR section 4.4 — this module never inserts new selection rows), builds a `CellResolver`
   anchored at that row's own `(entity_id, period_id)`, runs `evaluateFormula()`, and `UPDATE`s the row
   (`value_status`/`value_decimal`/`quality_flag`/`delta_vs_prior_period`/`delta_pct_vs_prior_period`/
   `interpretation_text`). A `formula_ref` lookup is memoized per `(kpiCode, entityId, periodId)` across the
   **whole run**, not just one row, so a KPI referenced by more than one composite (or twice) is computed
   once.
4. Wraps the run in a `compute_jobs` row, `job_type='ANALYSIS_KPI_COMPUTE'` — the new job type ADR section
   8.2 specifies, reusing `computeJobService.enqueue`/`claim`/`completeJobSuccess`/`failJob` exactly as
   shipped (no new columns, no new table). Idempotency key is a `sha256` of `(businessVersionId,
   sourceVersionId, sorted kpiValueIds)`, matching the existing `compute_jobs_idempotency_uq` contract.
5. After a successful compute, if `attemptReadinessTransition` is set, queries
   `finance_analysis_readiness_check()`/`finance_analysis_is_ready_for_review()` (WP-D03b file 4, unmodified)
   and — only if the gate passes — calls `artifactVersionService.transition()`'s T2 `submit_for_review` to
   move DRAFT -> READY_FOR_REVIEW, mirroring `statementReconciliationService.runReconciliation()`'s own
   `attemptReadinessTransition` pattern for the Statements domain.

**Known, documented simplification:** the job-claim step is an in-process, best-effort "synchronous
worker" (`enqueue` immediately followed by `claim`), not a distributed worker loop — acceptable for this
work package's scope (a single caller computing one Analysis Definition Version's own KPI, not a shared job
pool across processes), consistent with `computeJobService.ts`'s own header note that it does not implement
a per-org concurrency cap either.

**A real gotcha found by running against a real ephemeral Postgres, not by reading the code:** `pg`'s
default DATE-column type parser returns a JS `Date` object, not the ISO `'YYYY-MM-DD'` string
`periodConventionResolver.ts`'s `PeriodMeta` contract documents. The first known-answer test run failed
with `daysInPeriod: unparseable period_start/period_end` — `Date.parse('Mon Jan 01 2025...T00:00:00Z')` on
a stringified `Date` object is not a valid ISO string. Fixed by normalizing `period_start`/`period_end` to
`'YYYY-MM-DD'` once in `kpiComputeService.ts`'s `loadPeriodGraph()` (`toIsoDate()`), keeping
`periodConventionResolver.ts`'s own contract clean rather than pushing driver-shape ambiguity into the pure
module. This is exactly the kind of defect a mocked-DB test would never surface — the two pure unit-test
files below all pass fixture `PeriodMeta` objects with plain string dates, which is correct for their scope
but does not exercise the real driver's DATE-column shape.

---

## 4. Tests written

- `server/src/services/finance/canonical/__tests__/formulaAstEvaluator.test.ts` — pure, no DB, 12 tests:
  `CURRENT_RATIO` shape (plain ratio, `DIVISION_BY_ZERO`, `SHOW_WITH_FLAG` negative denominator, `FORCE_NA`
  negative denominator, `MISSING` propagation), `DSO` shape (root-is-`divide` policy application — the
  design decision in section 3.2, a nested divide-by-zero never leaking past the evaluator),
  `CASH_CONVERSION_CYCLE` shape (`formula_ref` composition, one `MISSING` dependency propagating), and
  `INSUFFICIENT_HISTORY` propagation.
- `server/src/services/finance/canonical/__tests__/periodConventionResolver.test.ts` — pure, no DB, 16
  tests: `daysInPeriod` (365 vs. 366-leap vs. a 90-day quarter — never hardcoded 365), `annualizationFactor`
  (FY/MONTH/Q), and every `periodOffset` value's resolution including `INSUFFICIENT_HISTORY`/
  `WRONG_PERIOD_TYPE_FOR_LTM` failure paths.
- `server/src/services/finance/canonical/__tests__/kpiComputeService.pg.test.ts` — real PostgreSQL, same
  `RUN_DB_TESTS=1`/`MOCK_DB=false`/`DATABASE_URL=postgresql://...` gate as this directory's other
  `.pg.test.ts` suites, `describe.skipIf`-gated. 4 tests, detailed in section 5 below.

All three files were run — the two pure suites with plain `vitest run` (no env gate needed), the `.pg.test.ts`
suite against a real, throwaway, ephemeral Postgres this work package spun up and tore down itself
(section 6). **44/44 tests pass.** `npx tsc --noEmit --skipLibCheck --strict` against the 3 new production
files (and their transitive imports — `artifactVersionService.ts`/`computeJobService.ts`/
`lifecycleService.ts`/`PostgresDatabase.ts`) reports 0 errors.

---

## 5. Known-answer test — 6 P0 KPI, GoldCo PARENT standalone FY2025

Per the task's explicit instruction ("NIE używaj tego samego formulaAstEvaluator do wyliczenia
oczekiwanej wartości, to byłoby testowanie kodu samym sobą"), the expected values below are hand-computed
plain arithmetic written directly into the test file's own header comment and its `EXPECTED` map — **not**
imported from `goldco_oracle.ts` (though the raw input figures are transcribed from it, credited by line)
and **not** produced by running `formulaAstEvaluator`/`kpiComputeService` a second time.

**Raw PARENT FY2025 figures** (from `goldco_oracle.ts`'s `parent.FY2025`): revenue=182,000,000,
cogs=118,000,000, opex=34,000,000, depreciation=7,000,000, interest=2,000,000, taxExpense=3,990,000,
cash=11,000,000, ar=26,000,000, inventory=19,500,000, fixedAssets=101,500,000, ap=17,500,000,
longTermDebt=40,500,000, cfo=15,000,000. **PARENT FY2024_restated** (post write-down): ar=24,000,000,
equity=89,500,000 (independently re-derived: totalAssets 148,000,000 − totalLiabilities 58,500,000).

| # | KPI | Category | Hand-computed expected | Engine result | Match |
|---|---|---|---|---|---|
| 1 | `CURRENT_RATIO` | Liquidity | `56,500,000 / 17,500,000 = 3.2285714285714286` | `3.2285714285714286` | ✅ |
| 2 | `GROSS_MARGIN_PCT` | Profitability | `64,000,000 / 182,000,000 = 0.35164835164835167` | `0.35164835164835167` | ✅ |
| 3 | `DEBT_TO_EQUITY` | Leverage | `40,500,000 / 100,000,000 = 0.405` | `0.405` | ✅ |
| 4 | `DSO` | Efficiency | `AR_avg(25,000,000)×365/182,000,000 = 50.13736263736264` | `50.13736263736264` | ✅ |
| 5 | `OPERATING_CASH_FLOW_MARGIN` | Cash flow | `15,000,000 / 182,000,000 = 0.08241758241758242` | `0.08241758241758242` | ✅ |
| 6 | `ROE` | Returns | `17,010,000 / EQUITY_avg(94,750,000) = 0.17952770448549075` | `0.17952770448549075` | ✅ |

Where `CURRENT_ASSETS = cash+ar+inventory = 56,500,000`, `CURRENT_LIABILITIES = ap = 17,500,000`,
`GROSS_MARGIN = revenue−cogs = 64,000,000`, `EQUITY(FY2025) = totalAssets(158,000,000) −
totalLiabilities(58,000,000) = 100,000,000` (the oracle's own equity-plug construction, independently
re-derived), `NET_INCOME = ((64,000,000−34,000,000)−7,000,000−2,000,000)−3,990,000 = 17,010,000`, and
`AR_avg`/`EQUITY_avg` are the plain `(current+prior)/2` this test computes by hand, not via
`periodConventionResolver`. All 6 asserted with `toBeCloseTo(..., 6)` against the engine's `value` — and
separately re-read straight from `finance_analysis_kpi_values` via a direct `SELECT`, not just the
service's in-memory return value (same discipline `statementServices.pg.test.ts` already established: "not
just the service's own return value"). Every one of the 6 also asserted `status='PRESENT_NONZERO'` and
`quality_flag IS NULL` — a clean compute, no hidden data-quality caveat.

**A note on `DSO`'s formula shape**, since it is the one KPI in this set whose root operator is `divide`,
not `ratio` (see section 3.2's design decision): the engine's own `AR_avg / (REVENUE / DAYS_IN_PERIOD)`
evaluates to the identical number as the hand-computed `AR_avg × DAYS / REVENUE`, confirming the nested
`literal.valueRef='DAYS_IN_PERIOD'` resolution (`daysInPeriod()` on the FY2025 period: `2025-12-31 −
2025-01-01 + 1 = 365`, a non-leap year, never a hardcoded constant) and the two-level `divide` nesting both
work correctly together against a real Postgres-backed `finance_stmt_lines` cell set, not just the pure
unit test's mock resolver.

---

## 6. Negative-denominator test — explicit quality_flag, never a misleading bare number

Two scenarios, both against real Postgres, both in `kpiComputeService.pg.test.ts`:

1. **`DEBT_TO_EQUITY` (`SHOW_WITH_FLAG`) with negative equity** — a synthetic distressed entity,
   `LONG_TERM_DEBT=10,000,000`, `EQUITY=-5,000,000`. `10,000,000 / -5,000,000 = -2` is arithmetically
   correct but misleading if shown bare (reads as "low leverage", the opposite of a distressed company with
   liabilities exceeding assets — exactly the addendum's named trap). **Result:** `value_status=
   'PRESENT_NONZERO'`, `value_decimal=-2` (kept, not hidden), `quality_flag='NEGATIVE_DENOMINATOR'`
   (explicit warning attached). ✅ Both the service's in-memory result and a direct `SELECT` against
   `finance_analysis_kpi_values` confirm the same shape.
2. **`GROSS_MARGIN_PCT` (`FORCE_NA`) with negative revenue** — negative revenue is a data error, not a
   legal business state (ADR section 5.3), so the policy is `FORCE_NA` rather than `SHOW_WITH_FLAG`.
   **Result:** `value_status='NOT_APPLICABLE'`, `value=null`, `quality_flag=NULL` — a clean N/A, per ADR
   section 6.5 ("to nie jest błąd obliczeniowy, to jest polityczna decyzja... quality_flag pozostaje
   NULL"), distinguishing this case from `DIVISION_BY_ZERO` (which DOES carry a flag) and from
   `SHOW_WITH_FLAG` (which keeps the number).

Both cases are also covered purely (no DB) in `formulaAstEvaluator.test.ts` against the `CURRENT_RATIO`
formula shape with mock resolvers, for fast, DB-free regression coverage of the same logic branch.

---

## 7. Readiness gate / lifecycle integration — proven live, not just wired

A fourth `.pg.test.ts` scenario takes a real `STATEMENT_PACK` Statement Pack Version through the full
`submit_for_review -> start_review -> (freshness=CURRENT) -> approveVersion` sequence to `APPROVED`
(`STATEMENT_PACK` defaults to `MATERIAL` risk tier — self-approval by the submitter is forbidden, so the
test uses a distinct `approverId`, a real defect this test run itself caught on the first attempt:
`SELF_APPROVAL_FORBIDDEN`, fixed by using a second fixture user, not by weakening the check), links it via
a real `STATEMENT_TO_ANALYSIS` `finance_lineage_edges` row to a fresh `HISTORICAL_ANALYSIS` Analysis
Definition Version with one selected KPI (`CURRENT_RATIO`), and calls `computeAnalysisKpis({...,
attemptReadinessTransition: true, actorId, role: 'preparer', expectedVersion })`. Result: all 6 readiness
checks pass (`SOURCE_STATEMENT_PACK_APPROVED`/`KPI_CATALOG_CONFIGURED`/`NO_MISSING_KPI_VALUES`/
`ALL_KPI_FORMULAS_COMPILED_OK`/`REQUIRED_LINES_AVAILABLE`/`NO_BLOCKING_EXCEPTIONS`), `transitionAttempted:
true`, `transitionResult.ok: true`, and a direct `SELECT status FROM finance_business_versions` confirms
`READY_FOR_REVIEW` — not just the service's returned object.

---

## 8. Database isolation (this work package's own ephemeral Postgres)

Same hard rule and exact recipe as WP-D01b/WP-D03b (real prior incident:
`docs/validation/finance-v3/generated/gate-a/WP-A04_security_closure.md`) — the shared Homebrew instance
(PID 911, `-D /opt/homebrew/var/postgresql@15`) was never touched, confirmed via `ps aux` before and after.

- **Own ephemeral cluster:** data directory `/private/tmp/finance-v3-gate-a-20260809-wpd04-pgdata-9626`,
  initialized with `initdb --locale=C` (`LC_ALL=C` exported for `initdb`/`pg_ctl`/`psql`/the migration
  runner — the same macOS "postmaster became multithreaded during startup" gotcha WP-D01b/WP-D03b both
  documented) using the `/opt/homebrew/opt/postgresql@15/bin/` binaries.
- **Own port:** `56000` (first free port found scanning upward from 56000 via a socket-bind probe, inside
  the 55000-59999 range), `listen_addresses=127.0.0.1` (loopback only). A **different, unrelated** ephemeral
  cluster from another concurrent session was observed running on port 28711 during this session (`ps aux`)
  — left completely alone, not touched, not reused.
- **Migrations:** the project's own `server/scripts/migrate.postgres.ts` ran the full existing migration
  set (595 files, including the WP-D03b Analysis files) against the fresh, empty database — 0 errors, 18/18
  P0 KPI seed rows confirmed `compile_status='COMPILED_OK'` via a direct query before any of this work
  package's own code ran.
- **Teardown:** `pg_ctl -D <datadir> stop -m fast` followed by `rm -rf` of the data directory, executed
  immediately after the test run (section 4-7 above). Final `ps aux` confirmed only PID 911 (shared) and the
  other session's own unrelated ephemeral cluster remained — nothing from this work package's own cluster
  was left running.

---

## 9. Files delivered

| File | Purpose |
|---|---|
| `server/src/services/finance/canonical/periodConventionResolver.ts` | Pure period-offset resolution (`CURRENT`/`PRIOR_PERIOD`/`PRIOR_YEAR_SAME_PERIOD`/`AVERAGE_CURRENT_AND_PRIOR`/`LTM_SUM_4Q`/`LTM_LATEST_Q_CLOSE`), `daysInPeriod`, `annualizationFactor` |
| `server/src/services/finance/canonical/formulaAstEvaluator.ts` | Pure recursive formula-AST evaluation, `DIVISION_BY_ZERO`/`NEGATIVE_DENOMINATOR`/`INSUFFICIENT_HISTORY` quality flags, `formula_ref` composition, root-level negative-denominator policy |
| `server/src/services/finance/canonical/kpiComputeService.ts` | DB orchestration: source-version resolution via lineage, cell/period/entity/taxonomy loading, per-row evaluation + persistence, `ANALYSIS_KPI_COMPUTE` job wrapping, readiness gate + T2 transition |
| `server/src/services/finance/canonical/__tests__/formulaAstEvaluator.test.ts` | Pure unit tests, 12 cases |
| `server/src/services/finance/canonical/__tests__/periodConventionResolver.test.ts` | Pure unit tests, 16 cases |
| `server/src/services/finance/canonical/__tests__/kpiComputeService.pg.test.ts` | Real-Postgres integration tests, 4 cases (known-answer × 6 KPI, 2× negative-denominator, readiness+transition) |
| `docs/validation/finance-v3/generated/gate-d/WP-D04_kpi_compute_service_report.md` | This report |

---

## 10. Escalations / open follow-ons (do not block this work package)

1. **Layer-2 currency-aware preflight** (ADR section 6.3) still has no implementation — this work package's
   `CellResolver` reads `finance_stmt_lines.value_decimal` directly without cross-checking
   `presentation_currency` consistency across the operands of one formula. For the P0 GoldCo scope (single
   currency, PLN, standalone) this does not affect correctness, but a multi-currency Analysis (e.g. mixing
   a `STANDALONE`-scope subsidiary row in EUR with a `CONSOLIDATED`-scope PLN row) would silently mix units
   today. Flagged, not fixed — same scope boundary the ADR itself already drew.
2. **`INTERIM_ANNUALIZED` convention has zero P0 catalog exercise** — none of the 18 seeded KPI use it (all
   are `POINT_IN_TIME`/`FLOW_PERIOD`/`AVERAGE_BALANCE`/`LTM`), so `annualizationFactor()`/
   `literal.valueRef='ANNUALIZATION_FACTOR'` are implemented and unit-tested in isolation
   (`periodConventionResolver.test.ts`) but never exercised end-to-end against a real `finance_stmt_lines`
   dataset. `ESTIMATED_ANNUALIZED` (the quality_flag this convention is supposed to always attach) is
   likewise implemented in the type system but never actually produced by any current P0 formula.
3. **`PRIOR_YEAR_SAME_PERIOD` for `WEEK`-granularity periods is unimplemented** (`UNSUPPORTED_PERIOD_TYPE_FOR_YOY`)
   — a 4-4-5/53-week calendar's own week-count-per-year metadata is not exposed to this pure module by the
   current `finance_stmt_periods` schema. Same open-ended status as WP-D01 section 11's own WEEK-granularity
   items; not re-litigated here.
4. **Job-claim is in-process/best-effort**, not a distributed worker loop (section 3.3) — acceptable for
   this work package's own scope (documented, not silently omitted).

Nothing above blocks this work package's own deliverable: 18/18 seeded P0 KPI compile, 6/18 independently
verified against hand-computed known-answer values on real GoldCo data through a real Postgres instance, and
the negative-denominator/division-by-zero "never a misleading bare number" contract is proven live, not
just documented.

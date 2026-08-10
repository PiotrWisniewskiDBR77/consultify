# AP-05 — Compare Service (Gate D, Finance v3 continuation)

**Program:** `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`, section 3 point 5
("Compare jako rdzeń: period, actual/forecast, version, entity, scenario i valuation method; absolute/Δ/%,
materiality filters, synchronized scroll i export diff").
**Date:** 2026-08-10
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `CODE + TESTS — real code, real ephemeral-Postgres test run, NOT deployed/migrated to demo/dev/prod`

---

## 1. Inputs read

1. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 3 point 5 (Compare
   scope) and section 8 `DEC-FIN-009` (tolerance/exception levels, source-rounding vs materiality).
2. `server/src/types/finance/CellRef.ts` / `ArtifactRef.ts` (AP-00) — the shared addressing contracts this
   work package extends.
3. Migration reports for the five candidate sources: `WP-D01b_statements_migration_report.md`,
   `WP-D03b_analysis_migration_report.md`, `WP-D05b_baseline_migration_report.md`,
   `WP-D07b_prediction_migration_report.md`, `WP-D09b_valuation_migration_report.md`, cross-checked against
   the REAL migration SQL (`server/migrations/20260809_finance_v3_d0{1,3,5,7,9}_*.sql`) rather than trusting
   the reports' prose alone.
4. `GATE_B_INTEGRATION_RECONCILIATION.md` section 7 and `statementReconciliationService.ts` — the materiality
   placeholder this module reuses verbatim (`PROVISIONAL_MATERIALITY_THRESHOLD_PCT`).
5. `financeValueSemantics.ts` — already anticipates this module by name ("AP-05's Compare deltas") in its
   `toArithmeticOperand` doc comment.
6. GoldCo Fala 3 fixtures — `docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.json` (restatement
   figures) and `WP-D08_prediction_compute_engine_report.md` section 6 (Base vs Downside REVENUE figures) — used
   as the real numbers for both the unit tests and the live Postgres integration test, not invented data.

---

## 2. What was implemented

`server/src/services/finance/canonical/financeCompareService.ts` — one generic primitive,
`compareValues(params)`, plus six named wrappers that just fix which axis varies between `sourceA`/`sourceB`:

| Wrapper | Varying axis | `ignoreDimensions` |
|---|---|---|
| `comparePeriods` | two periods, same artifact/business_version | `['periodId']` |
| `compareVersions` | two `business_version_id` of the same `artifact_id` | `[]` (full-key match) |
| `compareEntities` | two entities, same period, within a Statement Pack | `['entityId']` |
| `compareScenarios` | Base vs Upside/Downside Prediction (two business_version_id) | `[]` |
| `compareValuationMethods` | DCF vs comps within one Valuation Case variant | `['methodType']` |
| `compareActualVsForecast` | Statement Pack vs Baseline/Prediction (cross-table) | `['accumulationBasis']` |

`compareActualVsForecast` is not in the task's own ZAKRES list, but the addendum names "actual/forecast" as
one of Compare's core axes (section 3 point 5) and the generic primitive already supports it for free
(`sourceA`/`sourceB` may point at two different tables) — exposing it under its own name costs ~30 lines and
closes that gap rather than leaving it as an undocumented side effect.

### 2.1 `CellRef.ts` extension (AP-00)

Before this work package, `CellRef.ts` addressed exactly one table (`finance_stmt_lines`). Extended
additively, per the file's own documented extension pattern (one new literal + one row/column key branch per
table, envelope untouched):

- `finance_analysis_kpi_values` — rowKey `{entityId, kpiCatalogId}`, columnKey `{periodId}`.
- `finance_baseline_outputs` — rowKey `{entityId, canonicalLineId, consolidationScope}`, columnKey `{periodId}`.
- `finance_prediction_outputs_effective` — same shape as baseline (it's a VIEW unioning
  `finance_prediction_outputs` with a baseline passthrough for `STANDARD_BASE`, WP-D07 ADR section 8.3).
- `finance_valuation_methods` — rowKey `{methodType}`, columnKey `{}` (no period column at all — the first
  real user of `CellRef.period === null`, a case the original file's own doc comment already reserved for a
  future non-periodic table).

`CellPeriodRef.accumulationBasis` was widened from required to nullable — `finance_stmt_lines` is still the
only table with a real `accumulation_basis` column; the other three periodic tables get `accumulationBasis:
null` rather than a fabricated value. Checked for backward compatibility: the only other consumers of
`CellRef.ts` (`Operation.ts`, `WorkspaceState.ts`, `financeExportService.ts`) reference the schemas generically
and type-check clean unchanged.

### 2.2 Judgment call — `finance_valuation_variants` vs `finance_valuation_methods`

The task brief names `finance_valuation_variants` (WP-D09b) as one of the five sources. Read against the real
DDL (`20260809_finance_v3_d09_valuation_01_tables.sql`), `finance_valuation_variants` is the one-row-per-variant
header (`case_id`/`name`/`description`, `UNIQUE(business_version_id)`) — it has no comparable value column at
all. The actual per-method headline result (`result_ev_decimal`) that `compareValuationMethods` (DCF vs comps)
needs to diff lives on `finance_valuation_methods` (`UNIQUE(business_version_id, method_type)`). `CellRef.ts`
and this service both address `finance_valuation_methods`, not `finance_valuation_variants` — the same
"read-the-real-DDL-not-the-shorthand" discipline `ArtifactRef.ts`'s own header documents for its `artifactType`
literals (that file explicitly rejected a task brief's shorthand five-value enum in favor of the real six-value
DB CHECK constraint).

### 2.3 Real bug found and fixed while building this: `entity_id` is copy-on-write per `business_version_id`

`finance_stmt_entities` has `entity_code TEXT NOT NULL — "stable natural key across versions/periods for the
same legal entity"` and `UNIQUE(business_version_id, entity_code)`. The per-row `id` (the FK every content
table's `entity_id` column points at) is a **fresh UUID minted per `business_version_id`**, not a stable
identity. A first draft of this service matched cells across `sourceA`/`sourceB` using the raw `entity_id`
UUID — which is correct within one `business_version_id` (comparePeriods/compareEntities) but **silently
produces zero pairs** the moment `sourceA`/`sourceB` point at two different `business_version_id`
(`compareVersions`/`compareScenarios`/`compareActualVsForecast` — i.e. most of this module's named wrappers),
since "PARENT" in v1 and "PARENT" in v2 are two different UUIDs.

Fix: every loader (`loadStmtLines`/`loadKpiValues`/`loadBaselineOutputs`/`loadPredictionOutputsEffective`) now
`JOIN finance_stmt_entities e ON e.id = t.entity_id` and uses `e.entity_code` (not `t.entity_id`) as the
`dimensions.entityId` **matching** value. The real per-version `entity_id` UUID stays available for addressing
via each side's own `CompareCellPoint.cellRef`. `compareVersions`/`compareScenarios`/`compareActualVsForecast`
also had to switch their own optional entity filter param from a shared raw `entityId` (which would have had
the identical bug — one literal UUID cannot filter two different `business_version_id`'s entity tables
correctly) to `entityCode`, resolved to each side's real per-version `entity_id` via a new
`resolveEntityIdByCode()` helper before building the cell selectors. This was caught by writing the real
Postgres integration test with the ACTUAL GoldCo `entity_code`-stable-but-`entity_id`-churning data shape,
not by unit tests alone — consistent with this program's own "audits/unit-tests-only age in hours, verify
against the real runtime" discipline.

**Known follow-up, not fixed in this pass:** `compareScenarios`'s `entityCode` resolution looks up
`finance_stmt_entities` under the SCENARIO's own `business_version_id`. For a `scenario_mode='STANDARD_BASE'`
row, the row's real `entity_id` (and the `finance_stmt_entities` row it points at) belongs to the BASELINE
MODEL's `business_version_id` instead (the passthrough view surfaces `bo.entity_id` unchanged). The live
integration test below avoids this by filtering on `canonicalLineIds` instead of passing `entityCode` — which
is the realistic call shape when a UI already has a single resolved row — but a caller who explicitly passes
`entityCode` against a `STANDARD_BASE` scenario today gets `ENTITY_CODE_NOT_FOUND` even though the row would
otherwise load correctly. Worth a small follow-up (resolve through the `MODEL_TO_SCENARIO` edge when the
scenario-local lookup misses and `scenario_mode='STANDARD_BASE'`) before this ships to a UI that lets an
analyst type an entity filter directly against a Base scenario.

### 2.4 MISSING/NA and currency discipline

- `absoluteDiff`/`pctDiff` are computed only when BOTH sides are `PRESENT_ZERO`/`PRESENT_NONZERO` (via
  `financeValueSemantics.ts`'s `toArithmeticOperand`). Any other combination — `MISSING`, `NA`,
  `NOT_APPLICABLE`, or no row at all — yields `diffKind: 'MISSING_IN_A' | 'MISSING_IN_B' | 'MISSING_IN_BOTH'`,
  `absoluteDiff: null`, `pctDiff: null`, plus a human-readable `note`. Never a numeric 0.
- Different `presentationCurrency` between the two matched cells yields `diffKind: 'CURRENCY_MISMATCH'` and a
  withheld diff — this generic primitive has no FX rate to convert with; silently subtracting two currencies
  as if they were the same number would be exactly the class of bug the addendum's section 2 point 4
  ("Waluty") warns against.
- Every present value is converted to full presentation-currency units
  (`value_decimal * FINANCE_UNIT_MULTIPLIER[unit] * multiplier`) before diffing — the same scale discipline
  `valuationFcffService.ts`'s `toFullUnitValue` documents as a direct regression guard for the real "Apator
  ~1000x too small" production incident (memory note `p4-apator-realny-upload-2026-08-06`).
- A zero base (side A = 0) with a nonzero side B yields `pctDiff: null` (percentage undefined) but is still
  flagged `materialityFlag: true` by absolute-change-from-zero — never silently "immaterial" just because the
  percentage is mathematically undefined.

### 2.5 Materiality filter

Reuses `statementReconciliationService.ts`'s `PROVISIONAL_MATERIALITY_THRESHOLD_PCT` (5%,
`PROVISIONAL_PENDING_OWNER_DECISION`, `GATE_B_INTEGRATION_RECONCILIATION.md` section 7) as the default, with
the identical caller-override contract (`materialityThresholdPct` param — no second, independently-invented
number). `compareValues({ onlyMaterial: true })` filters `result.rows` to `materialityFlag=true` rows **plus**
every non-`BOTH_PRESENT` row — a MISSING-side mismatch is never silently dropped as "immaterial noise" by the
materiality filter. `result.summary` always reports the full, unfiltered counts regardless of `onlyMaterial`.

### 2.6 Export

`toCompareExportPayload(result)` wraps the already-plain-JSON `CompareResult` in a small versioned envelope
(`{exportPayloadVersion: 1, generatedAt, comparison}`). Deliberately NOT a file writer — `financeExportService.ts`
(AP-02) already owns `.xlsx` generation for Statement Pack values; this module does not duplicate that logic,
per the task's own instruction. A future AP-02 "Compare" sheet (or any other export target) has a stable
envelope to build from.

---

## 3. Files

- `server/src/types/finance/CellRef.ts` — extended (4 new tables, `accumulationBasis` widened to nullable).
- `server/src/services/finance/canonical/financeCompareService.ts` — new, ~1,100 lines.
- `server/src/services/finance/canonical/__tests__/financeCompareService.test.ts` — new, pure unit tests
  (19 tests, no DB).
- `server/src/services/finance/canonical/__tests__/financeCompareService.pg.test.ts` — new, real Postgres
  integration tests (2 tests).

---

## 4. Test results

### 4.1 Pure unit tests (`financeCompareService.test.ts`) — 19/19 passed

Covers `toFullUnitValue` (MISSING/NA/NOT_APPLICABLE → null, PRESENT_ZERO → real 0, MILLIONS×multiplier scaling,
unit=null passthrough), `presenceForStatus`, `buildMatchKey` (order-independence, `ignoreDimensions`), and
`diffPair` against the real GoldCo restatement figures (REVENUE unchanged → 0 diff; COGS +3,000,000, ~2.83%,
not material on its own; INVENTORY -3,000,000, ~-14.3%, material; NET_INCOME -3,000,000 matching the oracle's
own `restatementDeltaNetIncome` exactly; OPEX unchanged → 0) and the real WP-D08 Base-vs-Downside REVENUE
figures (-341,250.00, direction and magnitude both match the published delta), plus the full MISSING/NA/
currency-mismatch matrix.

### 4.2 Real PostgreSQL integration tests (`financeCompareService.pg.test.ts`) — 2/2 passed

Run against a throwaway ephemeral cluster (`initdb --locale=C`, port 57432, `/private/tmp/fin-ap05-pg`, never
port 5432/PID 911, `pg_ctl stop` + `rm -rf` on completion — per this task's own safety recipe), full
`server/migrations/*.sql` applied (`--safe`, 0 skipped).

1. **`compareVersions` — GoldCo FY2024 Statement Pack, ORIGINAL vs RESTATED.** Real oracle figures for both
   sides. Result: `summary.totalRows=11, bothPresent=9, missingInA=0, missingInB=2, currencyMismatch=0`.
   `REVENUE`/`OPEX` diff exactly 0 (not material); `COGS` +3,000,000 (~2.83%, not material alone); `INVENTORY`
   -3,000,000 (~-14.3%, material); `NET_INCOME` -3,000,000 (material, matches oracle's own restatement delta);
   `TOTAL_ASSETS` -3,000,000 but only ~-1.99% of a large base → **not** flagged material (proves the filter
   isn't just "any nonzero absolute change"). `WORKING_CAPITAL` (present in v1, explicit
   `value_status='MISSING'` row in v2) and `CASH` (present in v1, no row at all in v2) both surfaced as
   `diffKind='MISSING_IN_B'`, `absoluteDiff=null` — the two different MISSING flavors (explicit-status vs
   structurally-absent) are distinguished (`presence: 'MISSING'` vs `'NO_ROW'`) but both correctly withhold a
   numeric diff. `relationship: 'B_IS_DIRECT_CHILD_OF_A'` (via `parent_version_id`, task's "reużyj lineage/
   parent_version_id"). Verified live that v1/v2 entity rows have DIFFERENT UUIDs (copy-on-write) yet still
   paired correctly via `entity_code`.
2. **`compareScenarios` — Base vs Downside Prediction, real WP-D08 Jan-2026 REVENUE.** The "Base" side is a
   real `scenario_mode='STANDARD_BASE'` `finance_prediction_scenarios` row wired to a Baseline Model via a real
   `MODEL_TO_SCENARIO` `finance_lineage_edges` row — `compareScenarios` reads it through the actual
   `finance_prediction_outputs_effective` passthrough VIEW (WP-D07 ADR section 8.3), not a hand-substituted
   value. Result: `a.fullUnitValue≈11,943,750.00`, `b.fullUnitValue≈11,602,500.00`,
   `absoluteDiff≈-341,250.00` (exact match to WP-D08's own published "Downside Δ"), direction negative
   (downside is a decrease), `pctDiff≈-2.857%`. `dimensions.entityId='PARENT'` resolved correctly even though
   the effective row's real `entity_id` belongs to the BASELINE's `business_version_id`, not the scenario's
   own — proving the `entity_code` JOIN fix (section 2.3) works through the passthrough view too.

---

## 5. Escalations / open items

1. **`compareScenarios`/`compareVersions` `entityCode` resolution vs `STANDARD_BASE` passthrough** — see
   section 2.3's "Known follow-up". Not a correctness bug in the diff itself (the loader's own JOIN is
   correct, proven live in test 4.2.2); it's a gap in the wrapper's optional `entityCode` convenience filter
   specifically for the `STANDARD_BASE` case. Low severity (workaround: filter by `canonicalLineIds` instead,
   or omit `entityCode` and post-filter client-side), flagged for a future small patch rather than blocking
   this delivery.
2. **Not a strategic/owner-decision item** — no `DEC-FIN-0xx`-class question was raised by this work package;
   the materiality number itself remains the pre-existing `PROVISIONAL_PENDING_OWNER_DECISION` placeholder,
   unchanged.
3. **Synchronized scroll** (addendum section 3 point 5) is explicitly AP-01 grid UI, out of scope for this
   service layer — noted in the module's own file header so it isn't mistaken for a missed requirement.

---

## 6. Not done in this pass (explicitly out of scope per the task brief)

- No UI/grid wiring (AP-01 owns the Finance Data Grid; this is the data-layer primitive it would call).
- No `.xlsx`/export file generation — `toCompareExportPayload()` produces a structured, export-ready object;
  wiring it into `financeExportService.ts` (AP-02) as an additional sheet/format is a separate, later change
  so as not to duplicate that module's existing export logic.

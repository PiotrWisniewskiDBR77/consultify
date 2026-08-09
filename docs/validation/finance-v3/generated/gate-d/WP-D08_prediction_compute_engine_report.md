# WP-D08 — Prediction Compute engine (Gate D / Fala 6)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 8
(Prediction — pełna przebudowa), EPIC-06.
**Work package:** WP-D08 — turns the accepted `WP-D07_prediction_schema_ADR.md` schema (live-tested,
`WP-D07b_prediction_migration_report.md`) into a real, two-stage Prediction Compute engine: Stage 1
preflight (`predictionPreflightService.ts`) and Stage 2 compute (`predictionComputeService.ts`) — the same
"ADR → migration → compute engine" progression WP-D05→WP-D05b→WP-D06 already established for Baseline.
Closes the core of Fala 6 (Prediction/Scenario Engine).
**Date:** 2026-08-09/10
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** real, working TypeScript engine, live-tested end-to-end against an isolated, ephemeral
Postgres (never a production/demo/dev database — teardown confirmed, section 8). All four required tests
(Base=Baseline bit-for-bit, Upside/Downside, financing, preflight double-counting) pass.

---

## 1. What was implemented

Two new files in `server/src/services/finance/canonical/`, plus additive (export-only) changes to a third:

| File | Role |
|---|---|
| `predictionPreflightService.ts` | Stage 1 (`runPreflight()`). Reads the whole assumption set (`driver_overrides`+`initiatives`/`impact_chain`+`financing`), calls the already-shipped `finance_prediction_detect_overlaps()` SQL (Layer 1), computes a real Layer 2 numeric preview for every flagged group (driver-override case: calls the matching `baselineScheduleEngine.ts` pure function twice — base vs override; initiative-impact case: ramp/duration/decay expansion, no engine call, per ADR section 7.2), classifies each finding (`OVERLAP_DOUBLE_COUNTING` same-sign / `CONTRADICTORY_SIGNS` mixed-sign), and persists one `finance_prediction_preflight_runs` row + N `finance_prediction_preflight_findings` rows, superseding any prior current run. |
| `predictionComputeService.ts` | Stage 2 (`runPredictionCompute()`). Guards on `finance_prediction_can_start_compute()` first. `STANDARD_BASE` → calls `baselineComputeService.runBaselineCompute()` directly (idempotency-checked — see finding 3), zero modification, writes no `finance_prediction_outputs` row (DB physically forbids it), result read exclusively via `finance_prediction_outputs_effective`. Every other `scenario_mode` → loads the linked Baseline Model's context via the reused `loadContext()`, overlays `driver_overrides` on the assumption grid, adds `impact_chain` deltas (same ramp/decay math as Stage 1), runs the same `baselineScheduleEngine.ts` functions + `baselineCircularitySolver.solvePeriod()`, overlays `financing` cash flows on top, writes `finance_prediction_outputs`. Integrated with `computeJobService` under `job_type='PREDICTION_COMPUTE'`. |
| `baselineComputeService.ts` (WP-D06) | **Additive-only** — `export` added to `loadContext`, `LoadedContext`, `requireAssumption`, `daysInPeriod`, `CANONICAL_CODES`, `CanonicalCode`, `STATEMENT_TYPE_OF`, `DRIVING_SCHEDULE_TYPE`, `BaselineModelRow`, `BaselineScheduleRow`, `BaselineAssumptionRow`, `PeriodMetaRow`, `StmtLineCellRow`. Zero logic change, zero signature change on `runBaselineCompute()` itself — see finding 1. |

No new file for the double-counting/readiness SQL — that shipped already in WP-D07b
(`finance_prediction_detect_overlaps()`, `finance_prediction_readiness_check()`,
`finance_prediction_can_start_compute()`, `finance_prediction_outputs_effective`), consumed here, not
reimplemented.

---

## 2. Reuse discipline — findings

### Finding 1 — `baselineScheduleEngine.ts` / `baselineCircularitySolver.ts` needed **zero** API changes

Every function in both files already takes its numeric inputs as plain scalar parameters (`computeCogsOpex({revenue, cogsRatio, opexRatio})`, `solvePeriod({priorCash, priorDebt, ebit, ...})`). "Override a driver" is simply "call the same function with a different number for one parameter" — no rebuild, no new parameter, no behavior branch inside the engine files themselves. `predictionComputeService.ts` and `predictionPreflightService.ts` both import these functions completely unmodified.

### Finding 2 — `baselineComputeService.ts` needed a small, additive, backward-compatible export change

Prediction's own monthly loop needs the SAME ~90-line Baseline-context loader (`finance_baseline_models`/`finance_baseline_schedules`/`finance_baseline_assumptions`/FY history/opening BS, keyed by the **Baseline Model's own** `business_version_id`) that `baselineComputeService.ts` already has as a private `loadContext()` function. Re-implementing it would have been a straight duplication of working, tested code. The fix: add the `export` keyword to `loadContext`, its `LoadedContext` return-shape interface, `requireAssumption`, `daysInPeriod`, and the small lookup tables (`CANONICAL_CODES`/`STATEMENT_TYPE_OF`/`DRIVING_SCHEDULE_TYPE`) and their row-shape interfaces. **Nothing else changed** — `runBaselineCompute()`'s own signature, body, and behavior are byte-identical to WP-D06. This is confirmed empirically: TEST 1 (Base=Baseline bit-for-bit, section 4) runs `runBaselineCompute()` through this exact code path and reproduces WP-D06's own published December figures (`CASH=-6,725,554.0994`, `NET_INCOME=3,223,837.1331`) to full floating-point precision — proof that the export-only change did not perturb WP-D06's own compute path.

### Finding 3 — `runBaselineCompute()` is idempotent at the `compute_jobs` row level but NOT at the `finance_baseline_solver_diagnostics` row level

Discovered by actually running the code (not by re-reading it): `computeJobService.enqueue()`'s idempotency key means a second call with identical inputs returns the SAME `compute_jobs` row, but `runBaselineCompute()` unconditionally re-executes its whole monthly loop regardless of that job being pre-existing, and its per-period `finance_baseline_solver_diagnostics` INSERT collides on `uq_finance_baseline_solver_diag(compute_job_id, period_id)` on the second run. This matters for `predictionComputeService.ts`'s `STANDARD_BASE` branch, whose whole job is "ensure the linked Baseline is computed, then read it back" — re-running an already-computed Baseline is wasted work, not a correctness requirement. Fix implemented **in `predictionComputeService.ts` only** (not in `baselineComputeService.ts`, which stays untouched behaviorally): before calling `runBaselineCompute()`, check whether `finance_baseline_outputs` already has rows for the linked Baseline Model version; if so, skip the recompute and hash the existing rows for the `PREDICTION_COMPUTE` job's own `content_semantic_hash` instead. This is a `predictionComputeService.ts`-local idempotency guard, not a change to WP-D06's own engine — **WP-D06's own behavior and tests are unaffected** (its own compute path, called once per business_version_id, was never exercised twice with identical inputs in its own test battery, so this pre-existing characteristic never surfaced there).

**Escalation, not blocking**: `baselineComputeService.ts`'s own lack of run-level idempotency (beyond the `compute_jobs` row) is a real, documented gap that a future WP should close at the source (e.g., a `finance_baseline_solver_diagnostics` `ON CONFLICT DO NOTHING` or an early-return when the job was `wasExisting:true`) rather than every caller having to guard against it individually.

---

## 3. Database isolation (hard ban compliance)

Same rule as every prior Finance v3 work package (WP-D01b/WP-D03b/WP-D05b/WP-D06/WP-D07b section 1) —
**no shared or production/demo/dev database was touched.**

- Own ephemeral cluster: `initdb --locale=C` (`LC_ALL=C`), `/opt/homebrew/opt/postgresql@15/bin/` binaries, data directory `/private/tmp/wp_d08_pgdata_<pid>` (random suffix), port **58311** (confirmed free via `lsof` before use, within the mandated 55000-59999 range), `listen_addresses=127.0.0.1`.
- All 604 migrations in `server/migrations/` (601 pre-existing at session start + this session's own D07/D07b files, already present from a prior step in this same session) applied cleanly via `server/scripts/migrate.postgres.ts`, `NODE_ENV=test`, before any fixture data was written; re-applied cleanly on a fresh database after each fixture-schema fix during iteration.
- `ps aux` confirmed the shared Homebrew instance (**PID 911**, `/opt/homebrew/var/postgresql@15`) and this work package's own ephemeral postmaster were fully separate processes throughout.
- Teardown: `pg_ctl -m fast stop` + `rm -rf` of the data directory, executed at the end of this session. Final `ps aux` confirmed only PID 911 remained.
- Fixture/test script (`wp_d08_fixture_and_tests.ts`) lives in the session scratchpad, not the repo — same convention every prior WP-D0*/D0*b work package established. It was temporarily copied inside the worktree (`tmp_wp_d08/`, to get Node module resolution against the project's own `node_modules`) for execution, and removed (`rm -rf`) before this report was written — never committed.

---

## 4. Fixture — GoldCo PARENT FY2026, reconstructed to match WP-D06

The brief requires the "Base=Baseline bit-for-bit" and financing tests to use "te same dane co WP-D06"
(GoldCo PARENT FY2026). WP-D06's own fixture script lived only in that session's scratchpad (already gone,
per every prior WP's own documented convention) — so this work package reconstructed it from
**published, checked figures**, not by guessing:

- FY2025 monthly REVENUE actuals: `docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.json`
  `parent.FY2025_monthly` (12 real numbers, sum ties exactly to the 182,000,000 PLN annual figure).
- FY2025 closing (opening-for-FY2026) balance sheet: same file, `parent.FY2025.bs` (CASH/AR/INVENTORY/
  FIXED_ASSETS/AP/LONG_TERM_DEBT/EQUITY, plus `closingRE` for RETAINED_EARNINGS).
- Assumptions: derived with the exact same formulas `WP-D06_baseline_compute_engine_report.md` section 2
  documents (`COGS_PCT_OF_REVENUE=118M/182M`, `OPEX_PCT_OF_REVENUE=34M/182M`, `CAPEX_PCT_OF_REVENUE=9M/182M`,
  `USEFUL_LIFE_MONTHS=12×96.5M/7M`, `DSO/DIO/DPO` back-solved from FY2025 AR/INVENTORY/AP vs.
  revenue/COGS×365, `STATUTORY_TAX_RATE_PCT=19%`, `REVENUE_GROWTH_YOY=5%`).
- Debt facility: principal 40,500,000 PLN, 675,000 PLN/month equal-principal amortization, 4.8%/year
  contractual rate, 10% mandatory cash-sweep on FCF after scheduled debt service, **threshold=0** (the one
  parameter not spelled out numerically in the D06 report's prose — confirmed correct by the result below).

**Verification the reconstruction is faithful, not merely "close"**: running `runBaselineCompute()` against
this fixture reproduced WP-D06's own published figures to full floating-point precision —

| Line | WP-D06 report (2026-08-09) | WP-D08 reconstruction (this session) |
|---|---:|---:|
| Jan CASH | 17,013,362.3778 | 17,013,362.37779104 |
| Jan NET_INCOME | 968,661.5399 | 968,661.539885933 |
| Jun CASH | 11,328,419.4921 | 11,328,419.492060384 |
| Dec CASH | −6,725,554.0994 | −6,725,554.099445785 |
| Dec NET_INCOME | 3,223,837.1331 | 3,223,837.133109441 |
| Dec quality_flag | FUNDING_GAP | FUNDING_GAP |

An 8th-decimal-place match on every sampled figure — this is the same fixture, not a look-alike.

One Prediction-domain addition beyond the D06 fixture: 24 `finance_stmt_periods` rows (FY2025 ×12 actual +
FY2026 ×12 forecast, `MONTH` period_type) instead of D06's own period set, since `loadContext()`'s
PRIOR_YEAR_SAME_PERIOD lookup needs a real period row + `finance_stmt_lines` REVENUE row per FY2025 month,
not just the annual total.

---

## 5. TEST 1 — Base = Baseline, bit-for-bit

Scenario `bv-pred-base` (`scenario_mode='STANDARD_BASE'`), linked to the Baseline Model via
`MODEL_TO_SCENARIO`. Preflight run first (trivially empty — zero assumption rows for `STANDARD_BASE`,
`findings_count=0`, satisfies `HAS_CURRENT_PREFLIGHT`). `runPredictionCompute()` called — internally calls
`runBaselineCompute()` for the linked Baseline Model (unmodified, per finding 3's idempotency guard the
Baseline was not yet computed at this point in the test sequence, so it ran once for real here).

**Comparison**: every row of `finance_baseline_outputs` for the Baseline Model version vs. every row of
`finance_prediction_outputs_effective` for the `STANDARD_BASE` scenario, ordered identically
(`canonical_line_id, period_id`):

| Check | Result |
|---|---|
| `finance_baseline_outputs` row count | 372 (31 canonical lines × 12 forecast months) |
| `finance_prediction_outputs_effective` row count | 372 |
| Row-by-row `(canonical_line_id, period_id, value_decimal)` mismatches | **0** |
| `finance_prediction_outputs` row count for this scenario | **0** (physically forbidden by the DB trigger — confirmed, not just assumed) |

**Verdict: PASS — bit-for-bit identical**, and structurally guaranteed to stay that way (the ADR's own
section 8.4 argument: there is only ever one underlying row, read through a lineage-edge passthrough VIEW,
never an independent second computation "happening to match").

---

## 6. TEST 2 — Upside / Downside

Two scenarios, `STANDARD_UPSIDE` (`REVENUE_GROWTH_YOY` overridden to **7%** = baseline 5% + 2pp, one
`driver_overrides` row per forecast period, `override_source='STANDARD_PRESET_UPSIDE'`) and
`STANDARD_DOWNSIDE` (**2%** = baseline 5% − 3pp, `override_source='STANDARD_PRESET_DOWNSIDE'`). Both
preflighted (no overlaps — a single driver source per cell never flags Layer 1) and computed via
`runPredictionCompute()` (overlay branch, `baselineScheduleEngine.computeRevenuePvm()` called with the
overridden growth rate for every period, same function WP-D06 itself uses).

| Period | Base REVENUE | Upside REVENUE | Upside Δ | Downside REVENUE | Downside Δ |
|---|---:|---:|---:|---:|---:|
| Jan-2026 | 11,943,750.00 | 12,171,250.00 | +227,500.00 | 11,602,500.00 | −341,250.00 |
| Jun-2026 | 15,925,000.35 | 16,228,333.69 | +303,333.34 | 15,470,000.34 | −455,000.01 |
| Dec-2026 | 28,664,998.95 | 29,210,998.93 | +545,999.98 | 27,845,998.98 | −818,999.97 |

All 12 months checked programmatically (not just the three sampled above): **Upside REVENUE > Base REVENUE
in all 12 months, Downside REVENUE < Base REVENUE in all 12 months** — `upsideAlwaysHigher=true`,
`downsideAlwaysLower=true`.

**Verdict: PASS.**

---

## 7. TEST 3 — Financing (new investment facility funding the December cash gap)

Baseline's own December cash gap (TEST 1/section 5, WP-D06's own funding-gap finding, reconfirmed here):
**−6,725,554.10 PLN**. Scenario `bv-pred-financing` (`scenario_mode='DRIVER_OVERRIDE'`, which permits
`finance_prediction_financing` rows per the DB's own gating trigger) with one `FACILITY_DRAWDOWN` row —
"nowy kredyt inwestycyjny" — drawn in **November 2026**: principal 8,725,555 PLN (baseline December
shortfall + a 2,000,000 PLN margin), 6%/year rate, 60-month tenor. Preflighted (no overlap — financing maps
only to `LONG_TERM_DEBT`/`INTEREST_EXPENSE`, nothing else touches that cell in November) and computed via
the overlay branch's financing overlay (section "financing overlay" of `predictionComputeService.ts` —
additive facility balance + opening-balance tax-shielded interest, on top of the already-solved Baseline
figures, per the ADR's own words "TU żyje to, co Baseline fizycznie wyklucza").

| Check | Baseline (`finance_baseline_outputs`, D06 engine, untouched) | Prediction (`finance_prediction_outputs`, this scenario) |
|---|---:|---:|
| December CASH, before this test's financing scenario existed | −6,725,554.10 | — |
| December CASH, **after** this test's financing scenario was computed | **−6,725,554.10 (byte-identical, unchanged)** | **+1,964,662.40** |

**Verdict: PASS** — Prediction's own cash improves by exactly the facility's net contribution
(draw + tax-shielded net income effect of the facility's own interest, cumulative from November through
December), while Baseline's own `finance_baseline_outputs` row for December — queried fresh, not cached —
is **byte-identical** to its pre-financing-test value, confirming DEC-FIN-002's guarantee: financing
decisions live exclusively in Prediction and can never leak backward into Baseline, because Baseline has no
code path that could even read a `finance_prediction_financing` row.

---

## 8. TEST 4 — Preflight double-counting (two initiatives, same COGS/period cell)

Scenario `bv-pred-doublecount` (`scenario_mode='FUNDAMENTAL_INITIATIVE'`, created directly in that mode —
no promotion needed since the one-way `DRIVER_OVERRIDE → FUNDAMENTAL_INITIATIVE` transition guard only
fires on `UPDATE`, not `INSERT`). Two initiatives, mirroring the ADR's own TEST 8 example literally:
`INIT-1` "Production efficiency programme" (`-5%` COGS, `PERCENT_OF_BASE`), `INIT-2` "Supplier
renegotiation" (`-3%` COGS, `PERCENT_OF_BASE`), both targeting the SAME `entity/COGS/Jan-2026` cell.

| Step | Result |
|---|---|
| `runPreflight()` | 1 finding, `finding_kind='OVERLAP_DOUBLE_COUNTING'` (both sources same-signed), `source_count=2`, `layer1CombinedImpactDecimal=-0.08`, `layer2CombinedImpactDecimal=-0.08` (Layer 2 for the impact-chain case is the ADR's own ramp/duration/decay expansion, not a currency conversion — both initiatives have no ramp/decay, so Layer 2 here correctly reproduces Layer 1's own combined percentage) |
| `runPredictionCompute()`, **before** any resolution | **Blocked**: `{ ok:false, code:'READINESS_GATE_FAILED' }` — `finance_prediction_can_start_compute()` correctly reads `false` (`NO_OPEN_REQUIRED_RESOLUTIONS=false`) |
| `finance_prediction_conflict_resolutions` row inserted (`resolution_choice='ACCEPTED_PROPOSED'`, mandatory `rationale` supplied, `state='RESOLVED'`) | Accepted (no maker-checker escalation needed — `requires_review=false` for this non-material two-initiative case) |
| `runPredictionCompute()`, **after** resolution | **Succeeds**: `{ ok:true, mode:'COMPUTED' }` |
| January 2026 COGS, Baseline | 7,743,750.00 PLN |
| January 2026 COGS, Prediction (after resolution) | **7,124,250.00 PLN** — exactly `7,743,750 × (1 − 0.08)`, i.e. the combined 8% reduction from BOTH initiatives applied together, not double-applied and not silently dropped |

**Verdict: PASS** — preflight correctly detects and blocks, and the resolved compute correctly applies the
combined (not double-counted, not silently summed-away) impact.

---

## 9. Scope decisions (documented, not silent)

Following the same discipline WP-D06 section 5 established:

1. **Driver-override Layer 2 currency conversion (`predictionPreflightService.ts`) supports four
   `schedule_type` families** (`revenue_pvm`, `cogs_opex`, `capex_depreciation`, `wc_dso_dio_dpo`) whose
   pure function takes a single scalar override cleanly. `debt_maturity`/`tax_nol`/`equity_re` overrides
   fall back to Layer 1's own naive delta (documented, not silently substituted with a wrong number) — these
   three are either contractual lookups (not ratio-driven) or single-driver families where the naive delta
   already equals the real one.
2. **Impact-chain application (`predictionComputeService.ts`) supports four canonical targets**
   (`REVENUE`, `COGS`, `OPEX`, `CAPEX`) — the P&L/CAPEX lines that flow cleanly through the existing
   schedule-engine → circularity-solver chain while preserving the balance-sheet identity. Impacts targeting
   other canonical lines directly (e.g. `AR`/`INVENTORY`/`AP`/`LONG_TERM_DEBT`/`RETAINED_EARNINGS`) are not
   wired in this P0 — same class of documented boundary as WP-D06's own `headcount`/`leases` gap.
3. **`PERCENT_DELTA` is currently treated identically to `PERCENT_OF_BASE`** — both scale off the
   pre-impact base value for the period being computed. A true period-over-period "delta of the delta"
   semantics for `PERCENT_DELTA` is deferred (documented, not silently guessed at).
4. **Financing overlay is additive, not a joint circularity re-solve.** The new facility's own balance
   never depends on this period's own interest (opening-balance interest, not averaged like the Baseline
   facility's `solvePeriod()` treatment) — so no iteration is needed for it. This was verified algebraically
   (section "financing overlay" comment in `predictionComputeService.ts`) to keep the balance-sheet identity
   exact: every financing transaction contributes the identical signed amount to both the assets side (via
   `facilityCff`) and the liabilities+equity side (via `facilityDebtBalance`/equity/dividend), so
   TOTAL_ASSETS ties TOTAL_LIABILITIES_EQUITY to ordinary floating-point precision, not a widened tolerance
   band — confirmed live in all three overlay tests (Upside/Downside/Financing/DoubleCounting), zero
   `BS does not balance` errors.
5. **`SURPLUS_ALLOCATION_POLICY`/`COVENANT_DEFINITION`/`MIN_CASH_POLICY` financing rows have no period-scoped
   numeric flow in this compute engine** — same boundary the ADR's own section 9.1 already drew (these are
   horizon-wide policies, a query pattern over `finance_prediction_outputs_effective`, not a compute input).
6. **Single entity per compute run** — same P0 scope WP-D06 already established for Baseline; Prediction's
   overlay inherits it unchanged.
7. **`job_type='PREDICTION_COMPUTE'`** — the brief's own literal instruction, matching the ADR section 6.3's
   documented divergence from the reserved `prediction_compute` (lowercase) name, same precedent WP-D06 set
   for `BASELINE_COMPUTE`/`model_compute`.

---

## 10. Escalations required before full GO

None of the following block this work package's own deliverable (all four required tests pass); flagged for
a future WP per this program's own "audyty starzeją się" discipline:

1. **`baselineComputeService.ts`'s own lack of full run-level idempotency** (finding 3) — worth closing at
   the source rather than every caller (this module and any future one) having to guard against it.
2. **Impact-chain target coverage** (scope decision 2) — extending beyond REVENUE/COGS/OPEX/CAPEX to direct
   BS-line targets needs a documented consistency proof per line (the same balance-tie-out discipline this
   WP applied to the financing overlay), not just wiring the INSERT.
3. **Driver-override Layer 2 currency conversion for `debt_maturity`/`tax_nol`/`equity_re`** (scope decision
   1) — needs its own per-family conversion, not a generic fallback.
4. **Financing → Layer 1 double-counting line mapping** is still the honestly-partial map WP-D07b shipped
   (`FACILITY_DRAWDOWN`/`DISCRETIONARY_REPAYMENT` → `LONG_TERM_DEBT`+`INTEREST_EXPENSE`,
   `DIVIDEND_DECLARATION` → `DIVIDENDS_DECLARED`+`RETAINED_EARNINGS`, `EQUITY_INJECTION`/`SHARE_BUYBACK` →
   `EQUITY`) — this WP did not extend it further.
5. **Reverse stress/break-even engine** (ADR section 9.2) — still only a schema sketch/query pattern, no
   implementation; out of scope for this WP as the brief itself specifies.

---

## 11. Files delivered

- `server/src/services/finance/canonical/predictionPreflightService.ts` (new)
- `server/src/services/finance/canonical/predictionComputeService.ts` (new)
- `server/src/services/finance/canonical/baselineComputeService.ts` (modified — additive `export` only,
  see finding 2; `runBaselineCompute()` itself byte-identical to WP-D06)
- `docs/validation/finance-v3/generated/gate-d/WP-D08_prediction_compute_engine_report.md` (this file)

Both new service files compile cleanly via `esbuild --bundle` against the real project source tree (no
syntax/unresolved-import errors). Live-tested end-to-end (fixture → preflight → compute → assertion) against
an isolated ephemeral Postgres per section 3; the fixture/test script itself lives in the session scratchpad,
not the repo, same convention as every prior WP-D0*/D0*b work package.

## 12. Summary

- **TEST 1 (Base=Baseline bit-for-bit): PASS** — 372/372 rows identical, `finance_prediction_outputs` has
  exactly 0 rows for the `STANDARD_BASE` scenario (physically forbidden, confirmed).
- **TEST 2 (Upside/Downside): PASS** — Upside REVENUE strictly higher than Base in all 12 months, Downside
  strictly lower in all 12 months, per-month deltas computed and shown (section 6).
- **TEST 3 (Financing): PASS** — Prediction's December cash improves from −6,725,554.10 to +1,964,662.40
  PLN with an 8,725,555 PLN facility draw; Baseline's own December cash is byte-identical, unchanged.
- **TEST 4 (Preflight double-counting): PASS** — compute correctly blocked before resolution
  (`READINESS_GATE_FAILED`), correctly succeeds after resolution, and January COGS correctly reflects the
  combined (not double-counted) 8% reduction from both initiatives.
- **`baselineScheduleEngine.ts`/`baselineCircularitySolver.ts` needed zero API changes** (finding 1).
- **`baselineComputeService.ts` needed only additive `export` visibility changes** (finding 2) —
  `runBaselineCompute()` itself is untouched; WP-D06's own known-answer figures reproduce to full
  floating-point precision through the exact same code path (section 4), proving WP-D06's own tests are
  unaffected.
- **One real, non-blocking finding surfaced by live testing, not by re-reading code**: `runBaselineCompute()`
  is not idempotent at the diagnostics-row level across repeated calls with identical inputs (finding 3) —
  worked around locally in `predictionComputeService.ts`, escalated for a future source-level fix.

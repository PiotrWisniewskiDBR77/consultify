# WP-D10 — Enterprise Valuation compute engine (Gate D / Fala 7)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 9
(Enterprise Valuation — Obliczenia), EPIC-07.
**Work package:** WP-D10 — turns the accepted `WP-D09_valuation_schema_ADR.md` (schema, live-tested
`WP-D09b_valuation_migration_report.md`) into a real, working FCFF/WACC/terminal/discount/EV→Equity
bridge/sensitivity compute engine, wired to `compute_jobs(job_type='VALUATION_COMPUTE')` — the last domain
of the main Finance v3 DAG (`Statements → Analysis → Baseline → Prediction → Valuation`). Same discipline
WP-D06 applied to Baseline and WP-D08 to Prediction.
**Date:** 2026-08-09/10
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** real, working TypeScript engine, live-tested end-to-end against an isolated, ephemeral
PostgreSQL cluster (never a production/demo/dev database — teardown confirmed, section 6).

---

## 1. What was implemented

Seven new files in `server/src/services/finance/canonical/`, zero changes to any existing file, zero new
migrations (this WP is compute-only; the schema `WP-D09b_valuation_migration_report.md` shipped is used
as-is):

| File | Role |
|---|---|
| `valuationFcffService.ts` | Resolves the variant's exact lineage source (`MODEL_TO_VALUATION`/`SCENARIO_TO_VALUATION`), reads `EBIT`/`DEPRECIATION`/`CAPEX`/`WORKING_CAPITAL` per projection year from `finance_baseline_outputs` or `finance_prediction_outputs_effective` (never duplicated, never recomputed), converts every cell to full presentation-currency units via `value_decimal * FINANCE_UNIT_MULTIPLIER[unit] * multiplier` **at the point of read**, computes `FCFF = EBIT(1-cash_tax) + D&A - ΔWC - CAPEX` per year. `MISSING` (never a silent zero) propagates forward once a year's closing `WORKING_CAPITAL` is unknown. |
| `valuationWaccService.ts` | CAPM + Hamada unlever/relever (`beta_relevered = beta_unlevered * (1 + (1-t)*(D/E))`, target capital structure, DEC-FIN-012 standard, no escalation needed), full WACC breakdown. `assertWaccConsistency()` is the service-layer currency/nominal-real/pre-post-tax consistency gate `WP-D09_valuation_schema_ADR.md` section 15 pt.2 explicitly deferred to this WP — hard rejection, never a silently-wrong number. |
| `valuationTerminalService.ts` | Gordon Growth (`TV = FCFF_t*(1+g)/(WACC-g)`) and Exit Multiple as an explicit cross-check convention, `terminal_share_pct`, `g = reinvestment×ROIC` as a documented (non-blocking) reasonableness check. `assertGBelowWacc()` mirrors the DB trigger (`finance_valuation_terminal_check_g_below_wacc`) for a friendly pre-write error. |
| `valuationDiscountService.ts` | Pure discounting: PV of each year's FCFF + PV of terminal value at the SAME final-year discount factor, summed to Enterprise Value; `terminal_share_pct = PV(TV)/EV`. |
| `valuationBridgeService.ts` | EV→Equity bridge: explicit `sign` per component (never inferred from amount), `assertAsOfAlignment()` mirroring the DB's hard-block trigger, `computeEquityValue()`. |
| `valuationSensitivityService.ts` | 5×5 grid builder (rows = terminal `g`, columns = WACC, configurable), `findMonotonicityViolation()` — the property the schema ADR explicitly scoped OUT of the DB (`WP-D09_valuation_schema_ADR.md` section 10: "property do przetestowania... w pakiecie kompute") — and DB persistence (25 cells + exactly 1 base cell, `grid_status='COMPLETE'`, matching the DEFERRABLE constraint trigger's atomic-at-COMMIT semantics). |
| `valuationComputeService.ts` | Orchestrator: `findOrCreateMethod()`/`setMethodResult()`/`setMethodBasket()` (with `assertResultReadinessConsistency()`, the service-layer mirror of `chk_finance_methods_result_matches_readiness`), `assessCompsReadiness()`, `computeWeightedRecommendation()` (basket-only, never silently drops a not-READY member), `runDcfFcffValuation()` — the full FCFF→WACC→terminal→discount→EV pipeline wrapped in `compute_jobs(job_type='VALUATION_COMPUTE')` (documented divergence from the reserved `valuation_compute`, same precedent WP-D06/`BASELINE_COMPUTE` and WP-D07/D08/`PREDICTION_COMPUTE` already established, ADR section 13). |

All seven files pass `esbuild` syntax checks and a full-project `tsc -p server/tsconfig.json --noEmit` run
(the one error that run reports is pre-existing, in `lineageService.ts`, unrelated to and untouched by this
WP — confirmed by `git status` showing zero modifications to any file outside the seven new ones).

### 1.1 Reuse discipline

No P&L/CF/BS computation is duplicated. `valuationFcffService.ts` reads the four FCFF inputs from whichever
table `finance_lineage_edges` says is the exact source (`MODEL_TO_VALUATION` → `finance_baseline_outputs`,
`SCENARIO_TO_VALUATION` → `finance_prediction_outputs_effective`, which itself already collapses
`STANDARD_BASE` to a Baseline passthrough — WP-D07 section 8.3 — so this module needs no special case for
it). The known-answer test below feeds this module REAL output from `baselineComputeService.runBaselineCompute()`
(WP-D06's own, unmodified engine), not a hand-rolled substitute.

---

## 2. Test environment

Own ephemeral PostgreSQL 15.15 cluster, `initdb --locale=C`, `LC_ALL=C`, data dir `/private/tmp/wp_d10_pgdata`,
port 58347 (55000–59999 range, confirmed free via `lsof` before starting), Unix socket dir `/private/tmp`.
Migrated with the project's own runner (`server/scripts/migrate.postgres.ts`) against an **empty** database —
all 603 pre-existing migrations (including `..._d09_valuation_01/02_...sql`) applied cleanly, 0 errors, 0
skipped, confirming this WP required zero new schema. PID 911 (shared Homebrew instance) and one unrelated,
independent concurrent session's own Docker-based Postgres (`consultify-ie-e2e-pg`, port 55433) were both
confirmed running throughout via `ps aux` and left completely untouched. Teardown: `pg_ctl -m fast stop` +
`rm -rf` the data directory, executed immediately after the test run; final `ps aux` confirmed only PID 911
and the unrelated session's own processes remained. Fixture/test scripts (`tmp_wp_d10/fixture_and_tests.ts`,
`tmp_wp_d10/pure_checks.ts`) lived temporarily inside the worktree (to resolve against the project's own
`node_modules`/`tsx`), were never committed, and were `rm -rf`'d before this report was written — same
scratchpad convention `WP-D06`'s/`WP-D08`'s own fixture scripts already established.

---

## 3. Known-answer DCF test — GoldCo-scale PARENT, FY2026–2030

**FY2025 actuals (given history)**: same PARENT standalone figures as
`docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.ts`'s own FY2025 block — revenue
182,000,000 PLN (monthly-seasonality-allocated, same weights `[0.75,0.78,0.85,0.88,0.95,1.0,0.92,0.7,1.02,1.15,1.2,1.8]`),
COGS 118,000,000, OPEX 34,000,000, Dec-2025 closing BS: CASH 11,000,000 / AR 26,000,000 / INVENTORY 19,500,000
/ FIXED_ASSETS 101,500,000 / AP 17,500,000 / LONG_TERM_DEBT 40,500,000 (equity as the balancing plug, same
convention `goldco_oracle.ts`'s own `withEquityPlug()` uses). Closing working capital (AR+INV−AP) = 39,000,000 PLN.

**FY2026 forecast — real, unmodified `baselineComputeService.runBaselineCompute()`** (WP-D06's own engine,
called with zero modification), same assumption family WP-D06's own known-answer fixture used: 5%/yr revenue
growth, COGS/OPEX/CAPEX ratios off the FY2025 actuals above, 19% statutory tax, one 40,500,000 PLN debt
facility at 4.8%/yr with 675,000 PLN/month scheduled amortization, **circularity flags OFF**
(`interest_income_on_cash_modeled=false`, `mandatory_contractual_cash_sweep_modeled=false` — WP-D06 already
independently proved the solver against this exact class of fixture; this WP tests VALUATION math on top of
an already-validated Baseline output, not the solver itself). **12/12 months converged.** Real engine output,
read via `finance_baseline_outputs_annual` (WP-D05's own roll-up VIEW, not re-derived):

| Line | FY2026 (real baseline compute) |
|---|---:|
| EBIT | 24,462,251.68 |
| DEPRECIATION | 7,037,748.32 |
| CAPEX | 9,450,000.00 |
| WORKING_CAPITAL (closing) | 46,884,996.18 |

**FY2027–2030 — simple continuation** (task's own "prosta kontynuacja" instruction): every driver grows at a
flat 3%/yr off the FY2026 real output, inserted directly as annual `finance_baseline_outputs` rows (not
re-run through the monthly engine):

| Fiscal year | EBIT | D&A | CAPEX | WORKING_CAPITAL (closing) |
|---|---:|---:|---:|---:|
| 2027 | 25,196,119.23 | 7,248,880.77 | 9,733,500.00 | 48,291,546.07 |
| 2028 | 25,952,002.81 | 7,466,347.19 | 10,025,505.00 | 49,740,292.45 |
| 2029 | 26,730,562.89 | 7,690,337.61 | 10,326,270.15 | 51,232,501.22 |
| 2030 | 27,532,479.78 | 7,921,047.73 | 10,636,058.25 | 52,769,476.26 |

**WACC inputs** (explicit, documented): risk-free 4.0%, ERP 5.5%, beta unlevered 0.9, target capital
structure 30% debt / 70% equity, cost of debt (pre-tax) 6.0%, cash tax rate 19%, currency PLN,
`NOMINAL`/`POST_TAX`. **Terminal**: Gordon Growth, `g = 2.5%`.

### 3.1 Engine result

Ran through the real, unmodified pipeline: `finance_valuation_variants` (`MODEL_TO_VALUATION` lineage edge to
the FY2026 Baseline Model above) → `valuationComputeService.runDcfFcffValuation()` → `compute_jobs(job_type=
'VALUATION_COMPUTE')` → `succeeded`.

| Metric | Engine |
|---|---:|
| beta (relevered, Hamada) | 1.212429 |
| Cost of equity | 10.668357% |
| Cost of debt (after-tax) | 4.86% |
| **WACC** | **8.925850%** |
| Terminal value (Gordon) | 287,908,310.06 |
| **Enterprise Value** | **247,800,240.91** |

### 3.2 Independent oracle

A separate script — plain arithmetic, does **not** import `valuationWaccService.ts`/`valuationTerminalService.ts`/
`valuationDiscountService.ts` — re-derives WACC (CAPM + Hamada, same formula, independently typed out), FCFF
per year from the SAME given EBIT/D&A/CAPEX/WC figures above, Gordon terminal value, and discounts to EV.

| Metric | Independent oracle |
|---|---:|
| WACC | 8.925850% |
| Terminal value | 287,908,310.06 |
| **Enterprise Value** | **247,800,240.91** |

**Relative difference: 0.000000%** — exact match to floating-point precision (both computations are
closed-form, non-iterative; there is no numerical-method noise to account for, unlike the Baseline
circularity solver's own known-answer comparison in WP-D06). **Verdict: known-answer test PASSES**, well
inside the required ≤0.1% tolerance.

---

## 4. Monotonicity — 25-cell WACC × terminal-g sensitivity grid

Axes chosen so `g < WACC` in **all 25 combinations** (task's own instruction): WACC ∈ {6.93, 7.93, 8.93,
9.93, 10.93}% (base WACC ± 2pp), terminal g ∈ {1.5, 2.0, 2.5, 3.0, 3.5}% (base g ± 1pp). All 25 cells
computed via `valuationSensitivityService.buildWaccByTerminalGGrid()` (which internally calls the SAME
`computeGordonTerminalValue()`/`discountCashFlows()` this WP's other tests exercise, holding the FY2026–2030
FCFF series fixed and varying only WACC/g per cell) — all 25 cells resolved to a defined (non-null) EV, none
hit the `g >= WACC` guard.

`findMonotonicityViolation()` — pure, DB-free — checked, for every adjacent pair of cells in each of the 5
rows and 5 columns: **EV strictly non-increasing as WACC increases** (fixed g), and **EV strictly
non-decreasing as terminal g increases** (fixed WACC). **Result: zero violations found across all 25 cells.**

Persisted via `valuationSensitivityService.writeSensitivityGrid()` (header + 25 cells + flip to `COMPLETE` in
one transaction, matching the DEFERRABLE constraint trigger's atomic-at-COMMIT design) — confirmed live via
`SELECT`: 25 rows in `finance_valuation_sensitivity_cells`, exactly 1 `is_base_cell=true`, header
`grid_status='COMPLETE'`. **Verdict: monotonicity test PASSES.**

---

## 5. Apator-scale regression — unit/multiplier discipline

Memory note `p4-apator-realny-upload-2026-08-06` documents a real, prior production finding: an analysis
engine elsewhere in this program lost a company's `unit`/scale factor and reported an enterprise value
roughly 1000× too small (should have been ~PLN 466 million, was computed as ~466 thousand). This WP's own
`valuationFcffService.ts` is the direct regression guard for that class of bug — every cell read is converted
via `value_decimal * FINANCE_UNIT_MULTIPLIER[unit] * multiplier` at the point of read (`toFullUnitValue()`),
never after aggregation, never assumed uniform.

**Test**: two independent, synthetic fixtures encode the SAME real-world FCFF inputs (EBIT 50,000,000 / D&A
8,000,000 / CAPEX 12,000,000 PLN, closing WC 15,000,000 PLN, opening WC 14,000,000 PLN) at **different**
`unit`/`multiplier` scales:

- Fixture A: `unit='THOUSANDS'`, `multiplier=1`, raw `value_decimal` = 50,000 / 8,000 / 12,000 / 15,000 (i.e.
  literally "in thousands of PLN", the exact shape the real Apator finding involved).
- Fixture B: `unit='UNITS'`, `multiplier=1`, raw `value_decimal` already pre-multiplied to full PLN —
  50,000,000 / 8,000,000 / 12,000,000 / 15,000,000.

| | Fixture A (THOUSANDS) | Fixture B (UNITS, pre-multiplied) | Expected |
|---|---:|---:|---:|
| Computed FCFF (full PLN) | 35,500,000 | 35,500,000 | 35,500,000 |

**Both fixtures produce bit-for-bit identical, correctly-scaled FCFF** — no 1000× drift in either direction.
A third check confirms the counterfactual: a NAIVE read of Fixture A's raw `value_decimal` (ignoring
`unit`/`multiplier` entirely, i.e. the exact bug class from the audit finding) would have produced 35,500 —
**exactly 1000× smaller** than the engine's real, correct result — proving this test would have caught that
specific regression had it been present. **Verdict: Apator-scale regression test PASSES** (3/3 sub-checks).

---

## 6. N/A test — Trading Comps with an empty peer set

`valuationComputeService.findOrCreateMethod({ methodType: 'TRADING_COMPS', ... })` on a variant with **zero**
`finance_valuation_comps` rows: default state is `readiness='NOT_CONFIGURED'`, `result_value_status='MISSING'`,
`result_ev_decimal=NULL` — never `0`. An explicit attempt to `UPDATE ... SET readiness='READY',
result_value_status='PRESENT_NONZERO', result_ev_decimal=123` on that row is **rejected live** by
`finance_valuation_methods_check_comps_readiness()` (`"cannot be READY with zero usable comps rows"`) — the
same DB trigger WP-D09b's own TEST 21 already proved, re-confirmed here from the compute-engine side.
`valuationComputeService.assessCompsReadiness(0)` independently returns `'NOT_CONFIGURED'`, the service-layer
mirror of that same rule.

**Weighted recommendation basket** (`computeWeightedRecommendation()`): with the Comps method left OUT of the
basket (`is_in_recommendation_basket=false`, the default) alongside a `READY` `DCF_FCFF` method at 100%
weight, the weighted result is `{status:'READY', weightedEnterpriseValue: 247,800,240.91}` — matching the
DCF/FCFF result exactly, proving the unconfigured Comps method contributes **nothing**, silently or
otherwise. Explicitly placing the (still not-`READY`) Comps method INTO the basket flips the result to
`{status:'INCOMPLETE', notReadyMethodTypes:['TRADING_COMPS']}` — the recommendation refuses to produce a
number at all rather than silently re-normalizing weights around the missing member. **Verdict: N/A test
PASSES** (5/5 sub-checks).

---

## 7. Additional pure-function coverage

Ten further DB-free checks (`assertWaccConsistency`/`computeWacc`/`assertGBelowWacc`/
`computeGordonTerminalValue`/`assertAsOfAlignment`/`computeEquityValue`), all passing: WACC correctly rejects
`REAL` (nominal/real mismatch), `PRE_TAX` (pre/post-tax mismatch), a currency mismatch (EUR WACC vs. PLN
FCFF), and incomplete inputs (missing `risk_free_rate_pct`), while accepting a fully-consistent
`NOMINAL`/`POST_TAX`/matching-currency bundle; Terminal correctly rejects `g == WACC` (strict inequality) and
computes Gordon TV correctly when `g < WACC`; the EV→Equity bridge correctly rejects a misaligned `as_of`
date and computes `EquityValue = EV − debt + cash` correctly when aligned.

**Total: 27/27 checks passed** (17 DB-backed via the ephemeral Postgres run, 10 pure-function).

---

## 8. Escalations

None required. Per DEC-FIN-012 ("dla zagadnień objętych jednoznacznym profesjonalnym standardem... zespół
przyjmuje najwyższy uzasadniony standard bez eskalowania rutynowych pytań"), the one genuinely open modeling
choice this WP had to make — beta unlever/relever — used the Hamada equation against the TARGET capital
structure, the unambiguous textbook standard, applied without escalation (documented in
`valuationWaccService.ts`'s own header). End-of-year discounting convention (`valuationDiscountService.ts`)
is the same class of unambiguous standard, likewise applied without escalation.

Carried-forward, already-documented boundaries from `WP-D09_valuation_schema_ADR.md` section 15 that this WP
does **not** close (out of this WP's scope, not a silent gap):

1. **Correlation/contribution/disagreement across methods** (ADR section 7.4) and **reverse
   stress/breakeven for Valuation** (analog to WP-D07's own scenario breakeven) — not implemented here; the
   task's ZAKRES did not list either.
2. **Valuation Advisor** (facts/hypotheses/risks/questions/actions, freeze/staleness/many-to-many compare) —
   entirely schema-only as of WP-D09b, not touched by this WP (the task's ZAKRES does not mention it either;
   it is a separate, future WP analogous to how Advisor generation for Baseline/Prediction was never in scope
   for WP-D06/WP-D08).
3. **`finance_valuation_can_start_compute()` two-stage readiness gate** (ADR section 13, explicitly deferred
   by WP-D09b to "a future WP") — this WP's `runDcfFcffValuation()` performs its own inline readiness checks
   (FCFF fully present, WACC inputs complete and consistent, `g < WACC`) sufficient to run end-to-end and
   fail closed, but does not implement the SQL-level aggregate gate function WP-D07's own
   `finance_prediction_can_start_compute()` established a precedent for. Documented boundary, not a silent
   omission — a natural next increment if/when a UI needs a single boolean readiness check ahead of a compute
   button.
4. **EV→Equity bridge / sensitivity grid are wired as standalone, callable functions**
   (`valuationBridgeService.writeBridge()`, `valuationSensitivityService.writeSensitivityGrid()`) but
   `runDcfFcffValuation()` itself does not automatically invoke them (bridge components and sensitivity axis
   choices are per-Case decisions the task did not specify defaults for) — the known-answer test script calls
   them directly to prove they work end-to-end (section 4 above; bridge math is exercised by the pure-function
   suite, section 7), but a future UI/orchestration layer decides WHEN to call them, same "compute vs.
   orchestrate" boundary WP-D06/WP-D08 drew for their own optional sub-computations.

---

## 9. Summary

- 7 new files in `server/src/services/finance/canonical/` (`valuationFcffService.ts`,
  `valuationWaccService.ts`, `valuationTerminalService.ts`, `valuationDiscountService.ts`,
  `valuationBridgeService.ts`, `valuationSensitivityService.ts`, `valuationComputeService.ts`), zero
  modifications to any existing file, zero new migrations.
- **Known-answer DCF (GoldCo-scale, FY2026 real Baseline compute + FY2027-2030 simple continuation)**:
  engine EV = independent-oracle EV = PLN 247,800,240.91, relative difference **0.000000%** (≤0.1% required).
- **25-cell sensitivity monotonicity**: zero violations — EV non-increasing in WACC, non-decreasing in
  terminal g, across all 25 WACC×g combinations where g<WACC.
- **Apator-scale regression**: THOUSANDS-encoded and UNITS-pre-multiplied fixtures of the same real-world
  inputs produce bit-for-bit identical, correctly-scaled FCFF (PLN 35,500,000); a naive unit-ignoring read is
  demonstrated to be exactly 1000× off, confirming this test would catch the real audit-finding bug class.
- **N/A comps test**: empty-peer-set Trading Comps stays `MISSING`/`NOT_CONFIGURED` (DB trigger + service
  layer both reject a forced `READY`), and is correctly excluded from the weighted recommendation whenever it
  is out of the basket, and correctly turns the recommendation `INCOMPLETE` (never silently renormalized)
  when placed in the basket while still not `READY`.
- 27/27 total checks passed (17 live DB-backed, 10 pure-function). No escalation required — Hamada
  unlever/relever and end-of-year discounting applied as the unambiguous professional standard, per
  DEC-FIN-012.
- Ephemeral Postgres cluster fully torn down (`pg_ctl -m fast stop` + `rm -rf`), shared instance (PID 911)
  and an unrelated concurrent session's own Postgres confirmed untouched throughout.

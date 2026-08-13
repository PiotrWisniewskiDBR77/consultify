# GoldCo full-DAG end-to-end integration report — Statement → Analysis → Baseline → Prediction → Valuation

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 13
("Gold vertical slice"), full literal scope — all five domains in one continuous run, not five separate
work-package exercises.
**Date:** 2026-08-09/10
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Nature of this work:** INTEGRATION test, not a new engine. Every compute call below invokes the real,
already-committed Gate D service exactly as WP-D02/D04/D06/D08/D10 already tested it individually
(`statementMappingService`/`statementReconciliationService`/`artifactVersionService`/`lineageService`/
`kpiComputeService`/`baselineComputeService`/`predictionPreflightService`/`predictionComputeService`/
`valuationFcffService`/`valuationWaccService`/`valuationTerminalService`/`valuationDiscountService`/
`valuationBridgeService`/`valuationSensitivityService`/`valuationComputeService`). No new compute engine
code was written for this WP.
**Status:** **END-TO-END DAG PASSES.** Full lineage chain confirmed navigable, backward, from the final
Valuation Version all the way to the original Statement Pack Version, through Analysis and Baseline, via
`finance_lineage_edges` — one queryable structure, not five islands. Preflight conflict detection, blocked
compute, resolution, and re-compute all work correctly with real GoldCo data. Maker-checker (self-approval
rejection + distinct-approver success) works correctly for a `HIGH_RISK`-tier Valuation Case. Export manifest
generation works and correctly requires an `APPROVED` source. **One real, previously-undiscovered integration
bug found** (IF-19, Advisor freeze/pre-approval deadlock) — worked around for this run without modifying any
committed service file, documented below for a future fix. One documented, non-bug cross-domain scope
observation (IF-04).

---

## 1. What this WP read before building anything

1. `FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 13 (literal Gold vertical slice spec).
2. `GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md` and `goldco/goldco_oracle.{ts,json}`/`goldco_pipeline.ts` (Fala
   3 Statements-only slice — GoldCo's own PLN parent + EUR subsidiary, FY2023-2025, 2024 restatement,
   consolidation/elimination/NCI; **347/347 oracle-vs-pipeline values matched**, 0 bugs after
   `BUGFIX_GOLDCO_01_02_03_report.md` fixed BUG-GOLDCO-01/02/03 in a prior session of this same worktree).
3. `WP-D02_reconciliation_service_report.md`, `WP-D04_kpi_compute_service_report.md`,
   `WP-D06_baseline_compute_engine_report.md`, `WP-D08_prediction_compute_engine_report.md`,
   `WP-D10_valuation_compute_engine_report.md` — the exact contracts, known-answer figures, and scope
   boundaries of the five compute engines this WP wires together (all five already independently tested;
   this WP does not re-derive their correctness, only their COMPOSITION).
4. The actual service source for all fifteen services listed above (not just their reports) — function
   signatures, table DDL for `finance_baseline_*`/`finance_prediction_*`/`finance_valuation_*`/
   `finance_lineage_edges`/`finance_compute_snapshots`/`finance_export_manifests`, and
   `lifecycleService.defaultRiskTierForArtifactType()`/`checkSelfApproval()` — this is where IF-19 (Advisor
   pre-approval deadlock) was found, by reading the actual trigger SQL alongside the actual service code, then
   confirmed live.

## 2. How this WP was run (DB isolation)

Own ephemeral PostgreSQL 15 cluster, `initdb --locale=C`, `LC_ALL=C` exported, data directory
`/private/tmp/goldco-fulldag-pgdata` (outside the repo), port `58421` (55000-59999 range, confirmed free with
`lsof` before use), `listen_addresses=127.0.0.1`. Full migration set applied fresh via the project's own
runner (`DB_TYPE=postgres NODE_ENV=test ... npx tsx server/scripts/migrate.postgres.ts`) — all migrations in
`server/migrations/` applied cleanly, 0 errors. The shared Homebrew instance (PID 911) and one unrelated
concurrent session's own ephemeral cluster (port 5544) were confirmed running throughout via `ps aux`, both
left untouched. Teardown: `pg_ctl -m fast stop` + `rm -rf` of the data directory, executed at the end of this
session; final `ps aux` confirmed only PID 911 and the unrelated session's cluster remained.

Pipeline run:
```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:58421/finance_v3_goldco_fulldag \
  npx tsx docs/validation/finance-v3/generated/gate-d/goldco/goldco_full_dag.ts
```
Exit code 0. Full stdout log and the `goldco_full_dag_results.json` machine-readable result are both
reproduced/referenced below.

---

## 3. What the script actually does, phase by phase

### Phase 1 — Statement

Reuses the SAME real service chain and SAME independent oracle data (`goldco_oracle.json`) as the Fala 3
`goldco_pipeline.ts` slice — GoldCo Manufacturing S.A. ("PARENT", PLN) + GoldCo Deutschland GmbH ("SUB", EUR,
80%-owned), FY2023, FY2024 original → reopened → **RESTATED** (inventory valuation error, ERROR_CORRECTION,
PLN 3,000,000 write-down), FY2025, plus a FY2025 consolidated Group pack (PARENT+SUB translated, one
intercompany-loan elimination, 20% NCI). All packs reach `APPROVED` (the restated FY2024 version reaching
`APPROVED` — and the original correctly flipping to `SUPERSEDED` — confirms BUG-GOLDCO-03's fix from the
prior `BUGFIX_GOLDCO_01_02_03_report.md` session still holds in this new integration context).

One ADDITIONAL Statement Pack Version was built beyond the Fala 3 slice's own set — a "baseline-source" pack
(PARENT FY2025 monthly P&L for all 12 months + full closing balance sheet/cash-flow at December 2025, same
real oracle numbers, same `statementMappingService`/`statementReconciliationService`/`artifactVersionService`
chain, same org) — because `baselineComputeService.loadContext()` resolves BOTH the monthly
`PRIOR_YEAR_SAME_PERIOD` revenue history AND the opening balance sheet from exactly ONE
`STATEMENT_TO_MODEL` source edge (the schema's own "one source version per Baseline Model" design, WP-D05 ADR
section 2.1) — no existing Fala 3 pack had both in one Statement Pack Version. This is additive Statement
data, not a fabricated shortcut: same mapping/reconciliation/lifecycle discipline, real GoldCo numbers.

**Result:** 9 Statement Pack Versions created, all reach `APPROVED` (PARENT FY2023/FY2024-original/
FY2024-restated/FY2025-annual/baseline-source, SUB FY2023/FY2024/FY2025, GROUP FY2025-consolidated). The
Group pack's reconciliation shows `WITHIN_TOLERANCE residual=-6,640,000` — this is the SAME expected,
previously-documented non-bug from `GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md` section 4 (the generic
reconciliation waterfall sums both elimination legs at face value; the balance TRIGGER — the actual
correctness proof — passed cleanly).

### Phase 2 — Analysis

One `HISTORICAL_ANALYSIS` version, linked `STATEMENT_TO_ANALYSIS` to the **GROUP FY2025 consolidated**
Statement Pack Version (per the task's own instruction: "dla GoldCo consolidated"). All 18 ACTIVE P0 KPI
catalog rows (confirmed present — `WP-D03b`'s own seed count) were requested; `kpiComputeService.
computeAnalysisKpis()` computed **18/18** rows — 5 present-nonzero (`GROSS_MARGIN_PCT`, `EBITDA_MARGIN_PCT`,
`NET_MARGIN_PCT`, `INTEREST_COVERAGE`), 13 `MISSING` because the consolidated Group pack (by the Fala 3
slice's own documented scope decision 4) is FY2025-only — KPIs needing `AVERAGE_CURRENT_AND_PRIOR`/
`PRIOR_YEAR_SAME_PERIOD` (DSO/DIO/DPO/ROE/ROA/REVENUE_GROWTH_YOY/CASH_CONVERSION_CYCLE) or a CF-statement
cell not written to the Group pack's `CONSOLIDATED` scope (`OPERATING_CASH_FLOW_MARGIN`/`FCF_MARGIN`) are
correctly `MISSING`, never a silent/misleading number — this is the KPI engine's `MISSING`-propagation
contract working exactly as designed against real, intentionally-partial consolidated data.

**Manufacturing-relevant subset called out explicitly** (per the task's own phrase "universal +
manufacturing-specific"): `GROSS_MARGIN_PCT`, `EBITDA_MARGIN_PCT`, `DIO`, `DSO`, `DPO`,
`CASH_CONVERSION_CYCLE` — the inventory/margin-cycle KPIs a manufacturer's CFO would look at first. The P0
catalog itself has **no separate `MANUFACTURING` tier** (`WP-D03_analysis_schema_ADR.md` sections 91/375
explicitly park segment/industry-tier KPIs and PVM out of P0 scope) — this is a documented boundary carried
forward from D03, not something this WP invented or silently worked around.

**Normalized EBITDA:** PVM (price-volume-mix) and a dedicated "normalized EBITDA" KPI code are both
out-of-scope for the P0 catalog (same D03 boundary). Rather than inventing a new `formula_ast` KPI type, this
WP used the EXISTING, documented mechanism for judgment adjustments — the Analysis KPI value bundle's own
`is_adjustment`/`adjustment_reason` columns (WP-B01 section 2.7, reused verbatim by
`finance_analysis_kpi_values`) — to record a normalized-EBITDA comparability marker on `EBITDA_MARGIN_PCT`
explaining that FY2025 carries no one-off items itself (the FY2024 restatement's PLN 3,000,000 write-down is
a prior-year balance-sheet correction, not a FY2025 P&L item).

### Phase 3 — Baseline (2026 real monthly compute + 2027-2028 simple continuation)

One `BASELINE_MODEL` version, linked `STATEMENT_TO_MODEL` to the baseline-source Statement Pack Version and
`ANALYSIS_TO_MODEL` (with an `assumption_snapshot_hash`, per the schema's own requirement for that edge type)
to the Group-consolidated Analysis version from Phase 2. Assumptions derived from the SAME real FY2025 actuals
`WP-D06_baseline_compute_engine_report.md` already used and published (`COGS_PCT_OF_REVENUE`=118M/182M,
`OPEX_PCT_OF_REVENUE`=34M/182M, `CAPEX_PCT_OF_REVENUE`=9M/182M, DSO/DIO/DPO back-solved, `STATUTORY_TAX_RATE_
PCT`=19%, `REVENUE_GROWTH_YOY`=5%, debt facility 40,500,000 PLN at 4.8%/yr with a real 10% mandatory
cash-sweep clause — the genuinely circular configuration WP-D06's own known-answer test used).

**Result:** `runBaselineCompute()` computed all 12 FY2026 forecast months, converged every period. December
2026: **CASH = −6,790,388.46 PLN, `quality_flag='FUNDING_GAP'`** — the negative cash position surfaces
correctly, never plugged, never blocked (DEC-FIN-002), consistent with the seasonality-driven funding gap
WP-D06's own report documented for this same debt/seasonality configuration (this run's own oracle-derived
FY2025 monthly weights differ very slightly from WP-D06's own fixture reconstruction, hence a slightly
different December cash figure — both are real, both show a genuine funding gap, neither is plugged).

FY2027/FY2028 — a **simple continuation** (same convention `WP-D10_valuation_compute_engine_report.md`
section 3 already used for its own known-answer test): EBIT/DEPRECIATION/CAPEX/WORKING_CAPITAL grown 3%/yr
off the real FY2026 annual roll-up, inserted directly into `finance_baseline_outputs` (not re-run through the
monthly engine — the task's own "prosta kontynuacja" instruction, applied literally, not silently swapped for
a full 24-more-months monthly run).

**No plug anywhere**: `CASH[t] = CASH[t-1] + NET_CHANGE_CASH[t]` is always the OUTPUT of the CF roll, never
assigned; the balance-sheet identity (`TOTAL_ASSETS = TOTAL_LIABILITIES_EQUITY`) is algebraic, confirmed by
the engine's own pre-INSERT tie-out check (would have thrown `TIE_OUT_FAILED` otherwise — it did not).

### Phase 4 — Prediction (Base + efficiency initiative w/ conflict + downside; financing only in scenario)

Three `PREDICTION_SCENARIO` versions, all linked `MODEL_TO_SCENARIO` (with `assumption_snapshot_hash`) to the
SAME Baseline Model from Phase 3:

- **`STANDARD_BASE`**: empty preflight (0 findings, as expected — zero assumption rows), compute passes
  through to the Baseline unmodified (`finance_prediction_outputs` physically forbids rows for this mode —
  same DB-enforced guarantee WP-D08's own TEST 1 already proved).
- **`FUNDAMENTAL_INITIATIVE`** ("Production efficiency programme (Radom plant)" — 4% COGS reduction,
  `PERCENT_OF_BASE`, start Jan-2026, 12-month duration) **plus a direct cost override** (a preparer manually
  overriding the SAME `COGS_PCT_OF_REVENUE` driver for the SAME entity/Jan-2026 cell, unaware the initiative
  already touches it — exactly the task's own "direct cost override vs initiative" conflict scenario):
  - `runPreflight()` correctly detected the overlap: **1 finding, `kind=OVERLAP_DOUBLE_COUNTING`,
    `sourceCount=2`, `requiresResolution=true`** (both sources same-signed — a driver-ratio decrease and an
    initiative-percentage decrease both push COGS down).
  - `runPredictionCompute()` **called BEFORE resolution correctly BLOCKED**: `{ ok:false,
    code:'READINESS_GATE_FAILED' }` — `finance_prediction_can_start_compute()` correctly read `false`.
  - One `finance_prediction_conflict_resolutions` row inserted (`resolution_choice='ACCEPTED_PROPOSED'`,
    mandatory `rationale` supplied, `state='RESOLVED'`).
  - `runPredictionCompute()` **called AFTER resolution correctly SUCCEEDED**: `{ ok:true, mode:'COMPUTED' }`
    — January 2026 COGS = **7,210,980 PLN**, the COMBINED effect of both sources applied together (not
    double-counted, not silently dropped either).
  - A `FACILITY_DRAWDOWN` financing row (5,000,000 PLN, November 2026, funding the programme's
    line-rebalancing capex) was added **only in this Prediction scenario** — `finance_baseline_outputs` has
    no code path that could ever read a `finance_prediction_financing` row, confirming DEC-FIN-002's
    financing-stays-in-Prediction guarantee structurally, not just by convention.
- **`STANDARD_DOWNSIDE`** (`REVENUE_GROWTH_YOY` overridden to 2% for all 12 forecast months vs. the Baseline's
  5%): empty preflight (a single driver source per cell never flags Layer 1), compute succeeds. FY2027/2028
  continuation applied the SAME "simple continuation" convention (2%/yr, matching the downside's own softer
  trajectory) directly into `finance_prediction_outputs` (legal — only `STANDARD_BASE` physically forbids that
  table).

### Phase 5 — Valuation (baseline + downside variants, FCFF DCF, comps, exit-multiple cross-check, 5×5 sensitivity, Advisor, maker-checker, export)

One `finance_valuation_cases` row ("GoldCo Manufacturing Group — FY2026-2028 Enterprise Valuation") with two
`VALUATION_CASE` variants:

- **Baseline variant** — `MODEL_TO_VALUATION` (assumption-hashed) to the Baseline Model. WACC inputs: 4.0%
  risk-free, 5.5% ERP, 0.9 unlevered beta, 30/70 target D/E, 6.0% pre-tax cost of debt, 19% cash tax,
  PLN/NOMINAL/POST_TAX (the engine's own hard-required convention, `assertWaccConsistency()`). Terminal:
  Gordon Growth, g=2.5%.
- **Downside variant** — `SCENARIO_TO_VALUATION` (assumption-hashed) to the `STANDARD_DOWNSIDE` Prediction
  scenario. Same WACC inputs, g=2.0%.

Both variants' `runDcfFcffValuation()` ran the FULL FCFF→WACC→terminal→discount→EV pipeline, sourced by
lineage (never re-derived), 3-year explicit horizon (FY2026-2028) + terminal:

| Metric | Baseline variant | Downside variant |
|---|---:|---:|
| WACC | 8.9258% | 8.9258% |
| Terminal value (Gordon) | 272,244,344.28 | 246,173,407.87 |
| **Enterprise Value** | **238,070,438.18 PLN** | **217,489,202.27 PLN** |

**Downside EV < Baseline EV, as expected** (a softer growth trajectory produces a lower valuation — the
integration's own internal-consistency check, not assumed).

**Trading comps** (synthetic peer set — 4 EU/CE industrial manufacturers, EV/EBITDA multiples 7.1x-8.9x,
avg 7.95x) on the Baseline variant: `assessCompsReadiness(4)` → `READY`, comps EV = **250,425,000 PLN** on
FY2026 EBITDA (31.5M PLN) — NOT placed in the recommendation basket (a cross-check, per the task's own
instruction).

**Exit multiple cross-check** (8.0x FY2028 EBITDA = 267,346,800 PLN) written as a SECOND
`finance_valuation_terminal` row (`convention='EXIT_MULTIPLE'`, `is_primary=false`) alongside the primary
Gordon Growth row — the schema's own `UNIQUE(method_id, convention)` allows exactly this "one primary + one
cross-check" pair.

**Recommendation basket**: DCF/FCFF placed in the basket at 100% weight; comps and the exit-multiple
cross-check stay OUT — `computeWeightedRecommendation()` correctly returns `{status:'READY',
weightedEnterpriseValue: 238,070,438.18}`, exactly matching the DCF result (nothing silently blended in from
the excluded cross-checks).

**5×5 sensitivity grid** (WACC ± 2pp around 8.93%, terminal g ∈ {0.5%, 1.5%, 2.5%, 3.5%, 4.5%}, all 25 cells
`g < WACC`): built, **zero monotonicity violations** (`findMonotonicityViolation()` — EV non-increasing in
WACC, non-decreasing in g, across every adjacent pair), persisted as 25 cells + exactly 1 base cell,
`grid_status='COMPLETE'`.

**EV→Equity bridge**: DEBT (−40,500,000, subtract), CASH (+11,000,000, add), 20% NCI in GoldCo Deutschland
(−, subtract) → **Equity Value = 203,424,438.18 PLN**, `assertAsOfAlignment()` satisfied (all components dated
2025-12-31).

---

## 4. Advisor freeze/staleness (D09b) — a real integration bug found, worked around, documented

**Finding IF-19 (structural, not GoldCo-specific).** `finance_valuation_advisor_outputs.compute_snapshot_id`
is `NOT NULL REFERENCES finance_compute_snapshots(compute_snapshot_id)`, and
`finance_valuation_advisor_outputs_no_new_after_approval()` (WP-D09b) rejects any NEW Advisor row once the
SAME `business_version_id` is `APPROVED` ("Advisor is pre-approval by definition"). But the **only** code path
in the entire canonical service layer that INSERTs a `finance_compute_snapshots` row is
`artifactVersionService.approveVersion()` step (b) — which only runs **during** approval. As shipped, no real
caller can ever satisfy both constraints simultaneously: by the time a snapshot exists, new Advisor writes are
already forbidden for that version. This was invisible to `WP-D09b`'s own tests (schema-only, no Advisor rows
exercised) and to `WP-D10` (report section 8 explicitly says "Valuation Advisor... entirely schema-only... not
touched by this WP").

Per this task's own instruction ("jeśli znajdziesz integration bug, napraw minimalnie i udokumentuj, wzorem
`BUGFIX_GOLDCO_01_02_03`") and the explicit note that a full Advisor-generation service is a separate, later
package — **no committed service file was modified.** This integration script instead does what a future
`AdvisorGenerationService` would legitimately have to do: it INSERTs its own pre-approval
`finance_compute_snapshots` row directly (same shape as `approveVersion()`'s own step (b) INSERT — same
columns, same source: the artifact's current, still-open `finance_working_revisions` row), **before** running
the maker-checker approval flow, then writes the 4 Advisor outputs against that snapshot while the version is
still `DRAFT`/`IN_REVIEW`.

**Live-tested, both directions, with real data:**

| Check | Result |
|---|---|
| Advisor rows inserted PRE-approval (DRAFT/IN_REVIEW) | 4 rows written (FACT/RISK/HYPOTHESIS/QUESTION), `is_frozen=false` on all 4 |
| Same 4 rows, re-read AFTER the parent business_version reached `APPROVED` | **4/4 `is_frozen=true`, `frozen_at` set** — `trg_finance_bv_freeze_advisor_on_approval` fired correctly |
| A NEW Advisor row inserted against the now-`APPROVED` version | **Rejected** — `finance_valuation_advisor_outputs: parent business_version ... is APPROVED; new Advisor findings not permitted` (the exact error this WP first hit before reordering, now confirmed as the CORRECT, working guard, not a bug in itself) |

**Verdict**: the freeze-on-approval and no-new-after-approval triggers both work correctly. The bug is the
*missing production code path* to create a pre-approval snapshot — a real gap for whichever future WP builds
the actual Advisor-generation service (`AdvisorGenerationService`, not yet built) or extends
`artifactVersionService.ts` with a small, explicit `createComputeSnapshot()` helper callable pre-approval.
**Recommendation for that future WP**: expose exactly that helper (mirroring `approveVersion()` step (b)'s own
INSERT verbatim) rather than duplicating the INSERT a second time in application code.

---

## 5. Maker-checker (Valuation Case, `HIGH_RISK` tier)

`defaultRiskTierForArtifactType('VALUATION_CASE') === 'HIGH_RISK'` (`lifecycleService.ts`) — the strictest
tier in the program: forbids the approver being the submitter/editor (MATERIAL+ rule) **and** forbids the
approver having been the reviewer (`review_started_by`, HIGH_RISK-only rule, `checkSelfApproval()`).

| Attempt | Actor | Result |
|---|---|---|
| Self-approval | preparer (submitter + sole editor) | **Rejected**: `SELF_APPROVAL_FORBIDDEN`, `conflictingRole:'preparer'` |
| Approval by the reviewer | reviewer (`review_started_by`) | **Rejected**: `SELF_APPROVAL_FORBIDDEN`, `conflictingRole:'reviewer'` (the HIGH_RISK-specific rule, confirmed live, not just MATERIAL's weaker one) |
| Approval by a third, distinct user | `financeAdmin` (never preparer, never editor, never reviewer) | **Succeeded**: `status='APPROVED'` |

Both rejection paths and the eventual success were exercised against the SAME business_version_id in
sequence, with real `expectedVersion` optimistic-concurrency tokens — not a synthetic unit test, the actual
service call chain a UI would drive.

---

## 6. Export manifest (WP-B06)

`finance_export_manifests` exists and is wired correctly: a manifest for the (by-then) `APPROVED` Baseline
Valuation variant was created (`status='GENERATING'` → `'READY'`), with `finance_export_manifest_sources`
recording the source version (`role='PRIMARY'`). The DB's own
`finance_export_require_approved_source()` trigger requires the primary `business_version_id` to already be
`APPROVED` at INSERT time — this was implicitly exercised (the manifest was created AFTER the maker-checker
approval completed, in the correct order) and is the same live-enforced rule
`GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md`-adjacent packages already rely on elsewhere in this program.

---

## 7. Lineage — the key verification (task's own "kluczowa weryfikacja")

`lineageService.getAncestors(orgId, baselineVariant.bvId, 20)` — a recursive `WITH RECURSIVE` query over
`finance_lineage_edges` — returned **4 edges**, forming ONE connected chain, not four disconnected facts:

```
STATEMENT_PACK(baseline-source)      -[STATEMENT_TO_MODEL]->   BASELINE_MODEL
STATEMENT_PACK(GROUP FY2025 consol.) -[STATEMENT_TO_ANALYSIS]-> HISTORICAL_ANALYSIS
HISTORICAL_ANALYSIS                  -[ANALYSIS_TO_MODEL]->     BASELINE_MODEL
BASELINE_MODEL                       -[MODEL_TO_VALUATION]->    VALUATION_CASE (baseline variant)
```

Confirmed programmatically: the chain reaches the original baseline-source **Statement Pack Version**, the
**Analysis** version, and the **Baseline Model** version — all three, from a single `getAncestors()` call
against the FINAL Valuation Version. This is the task's own "kluczowa weryfikacja" literally satisfied: the
full DAG is one queryable structure, not five islands that merely happen to share an `organization_id`.

The **downside variant**'s own ancestors (`getAncestors(downsideVariant.bvId)`, 5 edges) additionally reach
the `PREDICTION_SCENARIO` (`STANDARD_DOWNSIDE`) node via `SCENARIO_TO_VALUATION`, and from there the SAME
`BASELINE_MODEL` and Statement Pack Version via `MODEL_TO_SCENARIO`/`STATEMENT_TO_MODEL` — proving the
Prediction layer is ALSO a first-class, navigable link in the same chain, not a side-branch.

---

## 8. Integration findings summary

| ID | Severity | Summary | Status |
|---|---|---|---|
| IF-04 | Note, not a bug | Analysis was computed on the GROUP CONSOLIDATED (PARENT+SUB) Statement Pack Version (per the task's own "dla GoldCo consolidated" instruction), but Baseline/Prediction/Valuation are P0-scoped to a SINGLE entity (PARENT-only, `WP-D06` report section 5.1) — `ANALYSIS_TO_MODEL` correctly links the two versions, but they describe DIFFERENT entity populations. Real, expected given each domain's own documented P0 scope, but worth a UI-level "scope" label on the lineage navigator so an analyst does not assume "same numbers, just downstream". | Documented, not fixed (a UI/UX recommendation, not a code defect) |
| IF-19 | **Real bug (structural)** | `finance_valuation_advisor_outputs` requires an EXISTING `compute_snapshot_id`, but the only INSERT path for `finance_compute_snapshots` is inside `approveVersion()`, which runs AFTER the point where new Advisor writes become forbidden — a real deadlock for any future Advisor-generation caller. | Documented; worked around in this script (own pre-approval snapshot INSERT, no service file modified); confirmed the freeze/no-new-after-approval triggers themselves both work correctly once that precondition is met; **recommended fix**: a small `createComputeSnapshot()` helper in `artifactVersionService.ts`, callable pre-approval, for a future `AdvisorGenerationService` to use |

All OTHER hypotheses this WP tested for (preflight not detecting the conflict, compute not being blocked,
resolution not unblocking it, self-approval succeeding, reviewer-as-approver succeeding, lineage not reaching
the full chain, sensitivity monotonicity violations, downside EV not being lower than baseline, EV→Equity
bridge failing) were all **disproved live** — i.e. the system behaved correctly, confirmed by direct
assertion against the real DB state, not assumed.

Two of these findings were construction bugs in THIS SCRIPT's own first draft, caught and fixed before the
final run (not integration bugs in the product):
1. The initial conflict-test fixture put the direct cost override on a DIFFERENT period (May-2026) than the
   initiative's own `start_period_id` (Jan-2026) — `finance_prediction_detect_overlaps()`'s Layer 1 SQL groups
   by the LITERAL `period_id` (a documented "single-period simplification", ramp/duration expansion is Layer
   2 preview-only) — so no overlap was detected. Fixed by aligning both sources to the same period; this is a
   correct reading of the ADR's own documented Layer 1/Layer 2 split, not a product bug.
2. The initial fixture's `PERCENT_OF_BASE` `amount_decimal` was `4` (intending "4%") instead of `0.04` (the
   fraction convention every other ratio in this program uses, e.g. `COGS_PCT_OF_REVENUE≈0.6484`) — this
   produced a 400% COGS reduction and visibly nonsensical (negative) COGS values, which is exactly how a real
   analyst would notice the same unit mistake in a UI. Fixed in the fixture data, not the engine.

---

## 9. End-to-end timing (first-ever measurement for the full chain)

| Phase | Wall-clock |
|---|---:|
| Statement (9 packs: map → reconcile → review → approve, incl. one restatement reopen/re-approve) | 0.55s |
| Analysis (18 KPI computes + 1 adjustment write) | 0.04s |
| Baseline (12-month real monthly compute + 2 continuation years) | 0.11s |
| Prediction (3 scenarios: base passthrough, conflict detect/block/resolve/compute, downside) | 0.18s |
| Valuation compute (2 DCF runs, comps, exit-multiple, 25-cell sensitivity, EV→Equity bridge) | 0.03s |
| Maker-checker (3 approval attempts) | 0.01s |
| Advisor + Export manifest | 0.00s |
| Lineage verification (2 ancestor queries) | 0.00s |
| **TOTAL, this script's own wall-clock** | **0.92s** |

**Caveat, stated plainly**: this measures the canonical SERVICE + DATABASE layer only, in a single Node
process talking to a local ephemeral Postgres over a Unix-adjacent TCP loopback — it does NOT include any
HTTP/API round-trip, authentication, UI rendering, or network latency a real multi-request user workflow would
add, nor does it reflect a production-sized dataset (this run's largest single write batch is ~370 rows for
one Baseline compute month-set). It is nonetheless the **first-ever measurement of the whole DAG's compute
layer strung together**, and a useful floor: whatever a real end-to-end user journey costs, it will not be
faster than the ~0.9s the actual arithmetic and persistence take.

---

## 10. Files

- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_full_dag.ts` — the integration script itself
  (new). Reuses `goldco_oracle.json` (Fala 3, unchanged) as its only external data source; imports the real
  services directly, same relative-import convention `goldco_pipeline.ts` already established.
- `docs/validation/finance-v3/generated/gate-d/goldco/goldco_full_dag_results.json` — machine-readable run
  output (generated): all business_version_ids for every artifact in the chain, key results, phase timings,
  the 2 integration findings, and the full log.
- This report.

## 11. Reproduce

```bash
# 1. Own ephemeral Postgres (never the shared instance / demo / dev / prod).
PORT=<free port in 55000-59999, verify with lsof first>
LC_ALL=C /opt/homebrew/opt/postgresql@15/bin/initdb --locale=C -D /private/tmp/goldco-fulldag-repro-pgdata -U postgres
LC_ALL=C /opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /private/tmp/goldco-fulldag-repro-pgdata \
  -o "-p $PORT -h 127.0.0.1" -l /private/tmp/goldco-fulldag-repro-pg.log start
/opt/homebrew/opt/postgresql@15/bin/createdb -h 127.0.0.1 -p $PORT -U postgres finance_v3_goldco_fulldag_repro

# 2. Migrate.
DB_TYPE=postgres NODE_ENV=test DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/finance_v3_goldco_fulldag_repro \
  npx tsx server/scripts/migrate.postgres.ts

# 3. Run the full DAG.
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/finance_v3_goldco_fulldag_repro \
  npx tsx docs/validation/finance-v3/generated/gate-d/goldco/goldco_full_dag.ts

# 4. Teardown.
/opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /private/tmp/goldco-fulldag-repro-pgdata stop
rm -rf /private/tmp/goldco-fulldag-repro-pgdata
```

# Wave 1A Execution Brief - KPI + Finanse

Date: 2026-03-29
Packet: `Results and finance consequence runtime unification`
Scope owner: Wave 1A

## Goal

Turn `KPI + Finanse` from two neighboring bounded lanes into one believable consequence runtime where performance, ROI, and financial impact stay coherent across inspection and action flows.

## Scope

In scope:

- unification of KPI/ROI/finance runtime truth across the active consequence lane
- reduction of split-brain between governed dashboards and deeper workflow actions
- stronger operator continuity from KPI surfaces into finance consequence work

Out of scope:

- full BI platform parity
- full finance-suite breadth across all statements/models/imports
- broader outputs/reporting program

## Code/test surface map

Core KPI code surfaces:

- `src/components/Results/ResultsHub.tsx`
- `src/components/Results/ResultsSummaryView.tsx`
- `src/components/Results/OperationalAnalysisView.tsx`
- `src/components/Results/KPICreateModal.tsx`
- `src/components/Results/KPITimeSeriesDrawer.tsx`

Core Finance code surfaces:

- `src/components/Economics/FinanceHub.tsx`
- `src/components/Economics/hooks/useFinanceData.ts`

Core test surfaces:

- `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx`
- `tests/components/Results/ResultsSummaryView.runtime-truth.test.tsx`
- `tests/components/Results/KPICreateModal.v8-write.test.tsx`
- `tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx`
- `tests/components/Economics/useFinanceData.v8-analyses.test.tsx`

Runtime/evidence anchors:

- `docs/product/work-packets/evidence/529-v81-kpi-must-have-module-closeout-pass.md`
- `docs/product/work-packets/evidence/530-v81-finance-must-have-module-closeout-pass.md`
- `docs/product/RESULTS_V8_SSOT.md`
- `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`
- `docs/product/FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md` rows `Results / KPI / ROI` and `Finance`

## What we deliver

- one clearer consequence runtime instead of bounded KPI and finance truths living beside legacy workflow branches
- stronger continuity from governed dashboard strips into deeper KPI/ROI/finance actions
- reduced split-brain between inspection surfaces and mutation flows

## What we consciously do not touch

- full finance platform breadth across every statements/models/import lane
- full BI/reporting parity across all outputs and reports
- unrelated initiative or admin system redesign

## Acceptance proof plan

1. prove KPI create/update/reconciliation flows stay coherent with the governed dashboard/runtime strip
2. prove finance analysis and consequence-entry flows stay coherent with finance runtime truth and route authority
3. prove one user journey from results signal to finance consequence no longer crosses visibly conflicting runtime families
4. verify degraded-state honesty remains visible even when deeper actions fail

## Risks

- high risk of splitting the packet into too many local fixes instead of one consequence-runtime program
- dependency on `Wdrożenia` for the upstream operating spine
- risk of overcommitting to full finance-platform breadth instead of the active consequence lane

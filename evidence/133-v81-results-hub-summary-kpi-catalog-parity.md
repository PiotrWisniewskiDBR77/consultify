# V8.1 Results Hub And Summary KPI Catalog Parity

Date: 2026-03-26
Lane: `Results / KPI / ROI`
Taxonomy: `T2`
Status: `done`

## Goal

Remove the remaining active legacy KPI monitoring read island by moving `ResultsHub` and
`ResultsSummaryView` onto the same governed V8-first KPI catalog seam already used by the other live
Results KPI surfaces.

## What changed

1. Frontend V8-first seam adoption
   - updated `src/components/Results/ResultsHub.tsx`
   - updated `src/components/Results/ResultsSummaryView.tsx`
   - both active entry surfaces now try `V8ResultsApi.getKpiCatalog()` first
   - legacy `/benefits/kpis` and `/benefits/kpi-mappings` reads are now fallback-only for bounded compatibility statuses

2. Regression coverage
   - extended `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx`
   - extended `tests/components/Results/ResultsSummaryView.runtime-truth.test.tsx`

## Why this matters

This closes the last obvious active KPI read split inside the bounded Results lane:

- the routed Results hub, summary view, KPI reports view, operational view, and KPI drawer now share the same governed KPI catalog source
- the active Results happy path no longer depends on separate legacy KPI catalog reads during normal operation
- what remains in the lane is broader write/operator breadth rather than another obvious live read split-brain

## Verification

`npx vitest run tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx tests/components/Results/ResultsSummaryView.runtime-truth.test.tsx tests/components/Results/KPITimeSeriesDrawer.v8-catalog.test.tsx tests/unit/services/v8-results-api.test.ts server/src/routes/v8/__tests__/results.routes.test.ts server/src/services/v8/__tests__/resultsRuntime.test.ts`

# V8.1 Results KPI Read Seam V8 Parity

Date: 2026-03-26
Lane: `Results / KPI / ROI`
Taxonomy: `T2`
Status: `done`

## Goal

Move the active Results KPI read surfaces onto a shared governed V8-first seam for KPI catalog and
initiative mappings, instead of keeping each surface on separate legacy `/benefits/kpis` and
`/benefits/kpi-mappings` reads.

## What changed

1. Backend V8 parity
   - added `getResultsKpiCatalog()` in `server/src/services/v8/resultsROIService.ts`
   - added `GET /api/v8/results/kpis/catalog` in `server/src/routes/v8/results.routes.ts`
   - kept the packet bounded to catalog + mappings continuity only

2. Frontend V8-first client seam
   - added `V8ResultsApi.getKpiCatalog()` in `src/services/api/v8/results.ts`
   - updated `src/components/Results/OperationalAnalysisView.tsx`
   - updated `src/components/Results/ResultsKpiReportsView.tsx`
   - updated `src/components/Results/KPITimeSeriesDrawer.tsx`
   - all three surfaces now try the shared V8 catalog route first and only fall back for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/services/v8/__tests__/resultsRuntime.test.ts`
   - extended `server/src/routes/v8/__tests__/results.routes.test.ts`
   - extended `tests/unit/services/v8-results-api.test.ts`
   - added `tests/components/Results/ResultsKpiReadSurfaces.v8-catalog.test.tsx`
   - added `tests/components/Results/KPITimeSeriesDrawer.v8-catalog.test.tsx`

## Why this matters

This removes another shared legacy read island from the active Results lane:

- operational KPI analysis, KPI report creation, and KPI drawer identity/mapping hydration now share one V8-first contract
- active Results KPI surfaces no longer each duplicate their own legacy KPI catalog reads
- the next packet can focus specifically on KPI drawer time-series and deviation continuity

## Verification

`npx vitest run server/src/services/v8/__tests__/resultsRuntime.test.ts server/src/routes/v8/__tests__/results.routes.test.ts tests/unit/services/v8-results-api.test.ts tests/components/Results/ResultsKpiReadSurfaces.v8-catalog.test.tsx tests/components/Results/KPITimeSeriesDrawer.v8-catalog.test.tsx tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx tests/components/Results/ResultsSummaryView.runtime-truth.test.tsx`

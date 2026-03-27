# V8.1 Results KPI Drawer Detail V8 Parity

Date: 2026-03-26
Lane: `Results / KPI / ROI`
Taxonomy: `T2`
Status: `done`

## Goal

Remove the remaining mixed-truth read path inside the active KPI drawer by moving measurement history
and open deviation-case continuity onto one governed V8-first seam instead of separate legacy
`/benefits/kpis/:kpiId/time-series` and `/benefits/kpis/:kpiId/deviation-cases` reads.

## What changed

1. Backend V8 parity
   - added `ResultsKpiDrawerDetail` types in `server/src/types/resultsROIContinuity.ts`
   - added `getResultsKpiDrawerDetail()` in `server/src/services/v8/resultsROIService.ts`
   - added `GET /api/v8/results/kpis/:kpiId/drawer-detail` in `server/src/routes/v8/results.routes.ts`
   - kept the packet bounded to measurement history + open deviation-case continuity only

2. Frontend V8-first client seam
   - added `V8ResultsApi.getKpiDrawerDetail()` in `src/services/api/v8/results.ts`
   - updated `src/components/Results/KPITimeSeriesDrawer.tsx`
   - the active KPI drawer now reads catalog identity/mappings and drawer detail from governed V8 routes first
   - legacy fallback remains allowed only for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/services/v8/__tests__/resultsRuntime.test.ts`
   - extended `server/src/routes/v8/__tests__/results.routes.test.ts`
   - extended `tests/unit/services/v8-results-api.test.ts`
   - extended `tests/components/Results/KPITimeSeriesDrawer.v8-catalog.test.tsx`

## Why this matters

This removes the last obvious live legacy read island inside the active Results KPI drawer:

- measurement history and open deviation context now come from one governed V8 detail contract
- `KPITimeSeriesDrawer` no longer mixes V8 identity with legacy trend/deviation fetches during normal reads
- the next decision can focus on bounded lane acceptance instead of another obvious drawer-read cleanup

## Verification

`npx vitest run server/src/services/v8/__tests__/resultsRuntime.test.ts server/src/routes/v8/__tests__/results.routes.test.ts tests/unit/services/v8-results-api.test.ts tests/components/Results/KPITimeSeriesDrawer.v8-catalog.test.tsx`

# V8.1 Results ROI Detail Drawer V8 Parity

Date: 2026-03-26
Lane: `Results / KPI / ROI`
Taxonomy: `T2`
Status: `done`

## Goal

Remove the remaining active ROI drawer mixed truth by moving `ROIDetailDrawer` onto a bounded
governed V8 read seam for variance, assumptions, and realized history continuity.

## What changed

1. Backend V8 parity
   - added `getROIInitiativeDetail()` in `server/src/services/v8/resultsROIService.ts`
   - added `GET /api/v8/results/roi/initiative/:initiativeId/detail` in `server/src/routes/v8/results.routes.ts`
   - kept the packet bounded to the active drawer read surface only

2. Frontend V8-first drawer seam
   - added `V8ResultsApi.getRoiInitiativeDetail()` in `src/services/api/v8/results.ts`
   - updated `src/components/Results/ROIDetailDrawer.tsx`
   - drawer now reads one governed V8 detail payload first and only falls back to legacy reads for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/services/v8/__tests__/resultsRuntime.test.ts`
   - extended `server/src/routes/v8/__tests__/results.routes.test.ts`
   - extended `tests/unit/services/v8-results-api.test.ts`
   - added `tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx`

## Why this matters

This removes the last obvious ROI read residual inside the active drawer flow:

- both ROI portfolio views and the shared drawer now follow governed V8-first reads
- active ROI continuity no longer depends on three separate legacy reads for drawer hydration
- the next packet can focus on KPI read-path convergence across operational/reporting surfaces

## Verification

`npx vitest run server/src/services/v8/__tests__/resultsRuntime.test.ts server/src/routes/v8/__tests__/results.routes.test.ts tests/unit/services/v8-results-api.test.ts tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx tests/components/Results/ResultsSummaryView.runtime-truth.test.tsx`

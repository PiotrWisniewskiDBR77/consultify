# V8.1 Results ROI Portfolio V8 Parity

Date: 2026-03-26
Lane: `Results / KPI / ROI`
Taxonomy: `T2`
Status: `done`

## Goal

Move the active ROI portfolio surfaces onto a governed V8-first runtime/client seam instead of
reading only from the legacy `/benefits/roi/portfolio/summary` route.

## What changed

1. Backend V8 parity
   - added `getROIPortfolioSummary()` in `server/src/services/v8/resultsROIService.ts`
   - added `GET /api/v8/results/roi/portfolio-summary` in `server/src/routes/v8/results.routes.ts`
   - kept the packet bounded to the active portfolio rollup used by live ROI views

2. Frontend V8-first client seam
   - added `V8ResultsApi.getRoiPortfolioSummary()` and `shouldFallbackToLegacyResults()` in `src/services/api/v8/results.ts`
   - updated `src/components/Results/ROITrackingView.tsx`
   - updated `src/components/Results/ROIAnalysisView.tsx`
   - both views now try the V8 route first and only fall back to legacy for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/services/v8/__tests__/resultsRuntime.test.ts`
   - extended `server/src/routes/v8/__tests__/results.routes.test.ts`
   - extended `tests/unit/services/v8-results-api.test.ts`
   - added `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx`

## Why this matters

This removes another obvious active-lane legacy read from `Results / KPI / ROI`:

- both live ROI portfolio views now share one governed V8-first entry point
- transient V8 failures still do not silently downgrade, because fallback is bounded
- the next residual can focus on the ROI detail drawer instead of the portfolio shell

## Verification

`npx vitest run server/src/services/v8/__tests__/resultsRuntime.test.ts server/src/routes/v8/__tests__/results.routes.test.ts tests/unit/services/v8-results-api.test.ts tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx tests/components/Results/ResultsSummaryView.runtime-truth.test.tsx`

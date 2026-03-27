# V8.1 Finance Analysis Ratios Preview Seam

Date: 2026-03-26
Lane: `Finance`
Taxonomy: `T2`
Status: `done`

## Goal

Move the active finance analysis preview ratios flow onto a governed V8-first seam so the
table-preview experience no longer depends only on the legacy
`/api/economics/financial-analyses/:id/ratios` read path.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/finance.routes.ts`
   - added `GET /api/v8/finance/analyses/:analysisId/ratios`
   - kept org scope by verifying the analysis belongs to the active V8 org before loading ratios

2. Frontend V8-first preview seam
   - extended `src/services/api/v8/finance.ts`
   - updated `src/components/Economics/hooks/useFinanceSelection.ts`
   - finance analysis preview now prefers the governed V8 ratios route before bounded legacy fallback

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - extended `tests/unit/services/v8-finance-api.test.ts`
   - added `tests/components/Economics/useFinanceSelection.v8-analysis-ratios.test.tsx`

## Why this matters

This keeps the finance lane moving within one bounded analysis subflow:

- active list continuity is already on V8-first through `useFinanceData`
- active preview continuity is now also on V8-first through `useFinanceSelection`
- the remaining next cut can focus on the dedicated analysis workspace rather than reopening list/preview mixed truth

## Verification

`npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Economics/useFinanceData.v8-analyses.test.tsx tests/components/Economics/useFinanceSelection.v8-analysis-ratios.test.tsx`

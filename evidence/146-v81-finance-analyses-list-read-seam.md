# V8.1 Finance Analyses List Read Seam

Date: 2026-03-26
Lane: `Finance`
Taxonomy: `T2`
Status: `done`

## Goal

Add a governed V8-first read seam for finance analyses so the active finance hub no longer relies
only on the legacy `/api/economics/financial-analyses` list endpoint for analysis and investment tabs.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/finance.routes.ts`
   - added `GET /api/v8/finance/analyses`
   - delegated the list read to the existing `financialAnalysisService.listAnalyses()`

2. Frontend V8-first read seam
   - extended `src/services/api/v8/finance.ts`
   - updated `src/components/Economics/hooks/useFinanceData.ts`
   - finance analysis/investment tabs now try the governed V8 analyses seam first
   - legacy `/api/economics/financial-analyses` remains fallback-only for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - extended `tests/unit/services/v8-finance-api.test.ts`
   - added `tests/components/Economics/useFinanceData.v8-analyses.test.tsx`

## Why this matters

This closes the next smallest mixed-truth cut inside the active finance lane:

- the active analysis/investment list path now has a governed V8-first read seam
- Finance lane work moves off route/shell parity and into real runtime continuity
- the next packet can stay in the same bounded analysis subflow instead of broadening to statements, models, or budgets

## Verification

`npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Economics/useFinanceData.v8-analyses.test.tsx`

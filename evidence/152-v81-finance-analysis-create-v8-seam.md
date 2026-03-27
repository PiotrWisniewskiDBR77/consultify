# V8.1 Finance Analysis Create V8 Seam

Date: 2026-03-26
Lane: `Finance`
Taxonomy: `T2`
Status: `done`

## Goal

Move the active finance analysis creation entry points onto a governed V8-first seam so operators no
longer rely only on the legacy `POST /api/economics/financial-analyses` route.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/finance.routes.ts`
   - added `POST /api/v8/finance/analyses`
   - delegated creation to `createAnalysis()` so org scoping and statement-pack seeding semantics stay aligned

2. Frontend V8-first create continuity
   - extended `src/services/api/v8/finance.ts`
   - updated `src/components/Economics/modals/CreateAnalysisModal.tsx`
   - updated `src/components/Benefits/FinancialAnalysisWorkspace.tsx`
   - updated `src/components/Economics/hooks/useFinanceRowActions.ts`
   - modal create, workspace create, and duplicate-analysis actions now prefer the governed V8 seam before bounded legacy fallback

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - extended `tests/unit/services/v8-finance-api.test.ts`
   - added `tests/components/Economics/CreateAnalysisModal.v8-create.test.tsx`
   - extended `tests/components/Benefits/FinancialAnalysisWorkspace.v8-read-seam.test.tsx`
   - added `tests/components/Economics/useFinanceRowActions.v8-analysis-create.test.tsx`

## Why this matters

This removes the next obvious legacy-only write dependency from the active finance analysis cluster:

- the primary create surfaces now follow the same V8-first discipline as reads and nearby mutations
- duplicate actions no longer reopen a parallel legacy-only path for the same object type
- the next finance review can focus on lane acceptance or one final residual instead of basic create continuity

## Verification

`npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Economics/CreateAnalysisModal.v8-create.test.tsx tests/components/Benefits/FinancialAnalysisWorkspace.v8-read-seam.test.tsx tests/components/Economics/useFinanceRowActions.v8-analysis-create.test.tsx`

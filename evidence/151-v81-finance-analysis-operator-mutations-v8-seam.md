# V8.1 Finance Analysis Operator Mutations V8 Seam

Date: 2026-03-26
Lane: `Finance`
Taxonomy: `T2`
Status: `done`

## Goal

Move the active finance analysis operator mutations onto governed V8-first seams so the primary
`reanalyze` and `approve` actions no longer rely only on the legacy
`/api/economics/financial-analyses/:id/run` and `/approve` routes.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/finance.routes.ts`
   - added `POST /api/v8/finance/analyses/:analysisId/run`
   - added `POST /api/v8/finance/analyses/:analysisId/approve`

2. Frontend V8-first operator continuity
   - extended `src/services/api/v8/finance.ts`
   - updated `src/components/Economics/hooks/useFinanceRowActions.ts`
   - updated `src/components/Economics/FinancePreviewPanel.tsx`
   - both table-row actions and preview footer actions now prefer governed V8 mutations before bounded legacy fallback

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - extended `tests/unit/services/v8-finance-api.test.ts`
   - added `tests/components/Economics/useFinanceRowActions.v8-analysis-mutations.test.tsx`
   - added `tests/components/Economics/FinancePreviewPanel.v8-analysis-mutations.test.tsx`

## Why this matters

This removes the next obvious operator-side legacy write dependency from the active finance analysis lane:

- finance analysis reads and nearby operator actions now follow one V8-first discipline
- both table and preview action entry points are aligned
- the next packet can focus on the neighboring create-analysis write seam instead of reopening run/approve continuity

## Verification

`npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Economics/useFinanceRowActions.v8-analysis-mutations.test.tsx tests/components/Economics/FinancePreviewPanel.v8-analysis-mutations.test.tsx`

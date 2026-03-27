# V8.1 Finance Analysis Delete V8 Seam

Date: 2026-03-26
Lane: `Finance`
Taxonomy: `T2`
Status: `done`

## Goal

Move the active finance analysis delete action onto a governed V8-first seam so operators no longer
rely only on the legacy `DELETE /api/economics/financial-analyses/:id` route.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/finance.routes.ts`
   - added `DELETE /api/v8/finance/analyses/:analysisId`
   - preserved the same bounded deletion rules as the legacy flow, including the approved-analysis guard

2. Frontend V8-first delete continuity
   - extended `src/services/api/v8/finance.ts`
   - updated `src/components/Economics/hooks/useFinanceRowActions.ts`
   - analysis delete now prefers the governed V8 seam before bounded legacy fallback

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - extended `tests/unit/services/v8-finance-api.test.ts`
   - added `tests/components/Economics/useFinanceRowActions.v8-analysis-delete.test.tsx`

## Why this matters

This closes the active CRUD shell around the finance analysis lane:

- list, preview, workspace reads, create, delete, accept, run, and approve now all share one V8-first discipline
- table-row removal no longer bypasses the governed finance namespace
- the next bounded step can be an acceptance review instead of another obvious analysis CRUD gap

## Verification

`npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Economics/useFinanceRowActions.v8-analysis-delete.test.tsx`

# V8.1 Finance Initiative Create Accept V8 Seam

Date: 2026-03-26
Lane: `Finance`
Taxonomy: `T2`
Status: `done`

## Goal

Complete the bounded finance analysis-to-initiative flow by moving the initiative creation accept step
onto a governed V8-first seam instead of relying only on the legacy
`/api/economics/financial-analyses/:id/initiatives` route.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/finance.routes.ts`
   - added `POST /api/v8/finance/analyses/:analysisId/initiatives`
   - preserved organization scoping and the same initiative creation semantics as the legacy flow

2. Frontend V8-first accept continuity
   - extended `src/services/api/v8/finance.ts`
   - updated `src/components/Finance/ExportToOutputDialog.tsx`
   - `Create Initiatives` now prefers the governed V8 accept seam before bounded legacy fallback

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - extended `tests/unit/services/v8-finance-api.test.ts`
   - extended `tests/components/Finance/ExportToOutputDialog.v8-proposals.test.tsx`

## Why this matters

This closes the bounded analysis-to-initiative continuity slice end to end:

- proposal discovery is already on a governed V8-first seam
- proposal acceptance and initiative creation now also follow governed V8-first continuity
- the next packet can move to adjacent analysis operator mutations instead of reopening this flow

## Verification

`npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Finance/ExportToOutputDialog.v8-proposals.test.tsx`

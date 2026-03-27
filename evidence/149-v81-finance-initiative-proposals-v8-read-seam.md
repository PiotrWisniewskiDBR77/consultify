# V8.1 Finance Initiative Proposals V8 Read Seam

Date: 2026-03-26
Lane: `Finance`
Taxonomy: `T2`
Status: `done`

## Goal

Move the finance analysis export-to-initiatives proposal read onto a governed V8-first seam so the
operator dialog no longer depends only on the legacy initiative-proposals endpoint.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/finance.routes.ts`
   - added `GET /api/v8/finance/analyses/:analysisId/initiative-proposals`
   - preserved org scoping and filtered proposal-eligible insights into the same proposal shape used by the legacy route

2. Frontend V8-first dialog continuity
   - extended `src/services/api/v8/finance.ts`
   - updated `src/components/Finance/ExportToOutputDialog.tsx`
   - initiative proposals now prefer governed V8 reads before bounded legacy fallback

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - extended `tests/unit/services/v8-finance-api.test.ts`
   - added `tests/components/Finance/ExportToOutputDialog.v8-proposals.test.tsx`

## Why this matters

This closes the next operator-facing read seam in the finance analysis-to-initiative flow:

- proposal discovery now follows the same V8-first discipline as the rest of the active finance analysis lane
- the remaining next cut can focus on the actual initiative creation accept/write seam
- finance status docs now reflect real progress beyond route authority into adjacent operator flows

## Verification

`npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Economics/useFinanceData.v8-analyses.test.tsx tests/components/Economics/useFinanceSelection.v8-analysis-ratios.test.tsx tests/components/Benefits/FinancialAnalysisWorkspace.v8-read-seam.test.tsx tests/components/Finance/ExportToOutputDialog.v8-proposals.test.tsx`

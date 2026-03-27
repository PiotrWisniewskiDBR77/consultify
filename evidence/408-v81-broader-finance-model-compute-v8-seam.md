## V8.1 Evidence - broader `Finance` parity - model compute V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`model compute V8 seam`

### Why this packet

After active finance model outputs continuity landed, the next smallest honest broader finance residual was the compute mutation still defaulting to the legacy financial-modeling endpoint across the active model surfaces.

This compute mutation is used by:
- `src/components/Finance/FinancialModelWorkspace.tsx` for the active workspace `Compute` action
- `src/components/Economics/FinancePreviewPanel.tsx` for the active prediction preview `Przelicz` action
- `src/components/Economics/hooks/useFinanceRowActions.ts` for the active prediction row action menu

This packet stays bounded because it closes one mutation seam only. It does not broaden into model approve/create/delete flows, events mutations, statements, budgets, or valuations.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed mutation support for:
   - `POST /api/v8/finance/models/:modelId/compute`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.computeModel()`
   - `V8FinanceModelComputeResult`
3. updated `src/components/Finance/FinancialModelWorkspace.tsx` so the active workspace `Compute` action now uses the governed V8 seam first, with fallback to legacy `/api/financial-modeling/models/:id/compute` only for bounded compatibility statuses
4. updated `src/components/Economics/FinancePreviewPanel.tsx` so the active prediction preview `Przelicz` action now uses the governed V8 seam first, with bounded legacy fallback
5. updated `src/components/Economics/hooks/useFinanceRowActions.ts` so the active prediction row action menu now uses the governed V8 seam first, with bounded legacy fallback
6. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Economics/FinancePreviewPanel.v8-analysis-mutations.test.tsx`
   - `tests/components/Economics/useFinanceRowActions.v8-analysis-mutations.test.tsx`
   - `tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx`

### Verification

- `npx vitest run tests/unit/services/v8-finance-api.test.ts tests/components/Economics/FinancePreviewPanel.v8-analysis-mutations.test.tsx tests/components/Economics/useFinanceRowActions.v8-analysis-mutations.test.tsx tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx server/src/routes/v8/__tests__/finance.routes.test.ts`
- `ReadLints` clean for:
  - `server/src/routes/v8/finance.routes.ts`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Finance/FinancialModelWorkspace.tsx`
  - `src/components/Economics/FinancePreviewPanel.tsx`
  - `src/components/Economics/hooks/useFinanceRowActions.ts`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Economics/FinancePreviewPanel.v8-analysis-mutations.test.tsx`
  - `tests/components/Economics/useFinanceRowActions.v8-analysis-mutations.test.tsx`
  - `tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx`

### Result

The active broader finance lane now has its twenty-second real bounded packet after the split-brain map. Active finance model compute actions no longer default to legacy financial-modeling compute routes during normal operation, while broader model approval and create/delete mutations remain explicitly queued.

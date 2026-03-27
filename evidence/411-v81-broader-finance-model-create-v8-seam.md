## V8.1 Evidence - broader `Finance` parity - model create V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`model create V8 seam`

### Why this packet

After active finance model delete continuity landed, the next smallest honest broader finance residual was the create mutation still defaulting to the legacy financial-modeling endpoint across the active finance model creation surfaces.

This create mutation is used by:
- `src/components/Economics/modals/CreateModelModal.tsx` for the active guided model-create modal
- `src/components/Finance/FinancialModelWorkspace.tsx` for the active workspace create flow
- `src/components/Economics/hooks/useFinanceRowActions.ts` for active model duplicate actions

This packet stays bounded because it closes one mutation seam only. It does not broaden into model event writes, assumptions save continuity, statements, budgets, or valuations.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed mutation support for:
   - `POST /api/v8/finance/models`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.createModel()`
   - `V8FinanceModelCreatePayload`
3. updated `src/components/Economics/modals/CreateModelModal.tsx` so the active model-create modal now uses the governed V8 seam first, with bounded legacy fallback and governed detail readback after creation
4. updated `src/components/Finance/FinancialModelWorkspace.tsx` so the workspace create flow now uses the governed V8 seam first, with bounded legacy fallback
5. updated `src/components/Economics/hooks/useFinanceRowActions.ts` so active model duplicate actions now use governed V8 detail readback plus the governed V8 create seam first, with bounded legacy fallback
6. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Economics/CreateModelModal.v8-create.test.tsx`
   - `tests/components/Economics/useFinanceRowActions.v8-analysis-create.test.tsx`
   - `tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx`

### Verification

- `npx vitest run tests/unit/services/v8-finance-api.test.ts tests/components/Economics/CreateModelModal.v8-create.test.tsx tests/components/Economics/useFinanceRowActions.v8-analysis-create.test.tsx tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx server/src/routes/v8/__tests__/finance.routes.test.ts`
- `ReadLints` clean for:
  - `server/src/routes/v8/finance.routes.ts`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Economics/modals/CreateModelModal.tsx`
  - `src/components/Economics/hooks/useFinanceRowActions.ts`
  - `src/components/Finance/FinancialModelWorkspace.tsx`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Economics/CreateModelModal.v8-create.test.tsx`
  - `tests/components/Economics/useFinanceRowActions.v8-analysis-create.test.tsx`
  - `tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx`

### Result

The active broader finance lane now has its twenty-fifth real bounded packet after the split-brain map. Active finance model create actions no longer default to legacy financial-modeling create routes during normal operation, while broader model event continuity remains explicitly queued.

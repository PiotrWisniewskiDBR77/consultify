## V8.1 Evidence - broader `Finance` parity - model delete V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`model delete V8 seam`

### Why this packet

After active finance model approve continuity landed, the next smallest honest broader finance residual was the delete mutation still defaulting to the legacy financial-modeling endpoint in the active model row action surface.

This delete mutation is used by:
- `src/components/Economics/hooks/useFinanceRowActions.ts` for the active finance model row action menu

This packet stays bounded because it closes one mutation seam only. It does not broaden into model create flows, event mutations, workspace edits, statements, budgets, or valuations.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed mutation support for:
   - `DELETE /api/v8/finance/models/:modelId`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.deleteModel()`
3. updated `src/components/Economics/hooks/useFinanceRowActions.ts` so the active model delete action now uses the governed V8 seam first, with fallback to legacy `/api/financial-modeling/models/:id` only for bounded compatibility statuses
4. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Economics/useFinanceRowActions.v8-analysis-delete.test.tsx`

### Verification

- `npx vitest run tests/unit/services/v8-finance-api.test.ts tests/components/Economics/useFinanceRowActions.v8-analysis-delete.test.tsx server/src/routes/v8/__tests__/finance.routes.test.ts`
- `ReadLints` clean for:
  - `server/src/routes/v8/finance.routes.ts`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Economics/hooks/useFinanceRowActions.ts`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Economics/useFinanceRowActions.v8-analysis-delete.test.tsx`

### Result

The active broader finance lane now has its twenty-fourth real bounded packet after the split-brain map. Active finance model delete actions no longer default to legacy financial-modeling delete routes during normal operation, while broader model create continuity remains explicitly queued.

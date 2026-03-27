## V8.1 Evidence - broader `Finance` parity - model outputs V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`model outputs V8 seam`

### Why this packet

After active finance model validations continuity landed, the next smallest honest broader finance residual was the outputs read still defaulting to the legacy financial-modeling endpoint on the active model workspace.

This outputs read is used by:
- `src/components/Finance/FinancialModelWorkspace.tsx` for initial model load and post-compute outputs refresh on the active Finance model surface

This packet stays bounded because it closes one read seam only. It does not broaden into model create/update/delete/approve/compute mutations, events mutations, statements, budgets, or valuations.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed read support for:
   - `GET /api/v8/finance/models/:modelId/outputs`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.getModelOutputs()`
   - `V8FinanceModelOutputLine`
   - `V8FinanceModelOutputsResult`
3. updated `src/components/Finance/FinancialModelWorkspace.tsx` so model outputs reads during initial model load and post-compute refresh now use the governed V8 seam first, with fallback to legacy `/api/financial-modeling/models/:id/outputs` only for bounded compatibility statuses
4. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx`

### Verification

- `npx vitest run tests/unit/services/v8-finance-api.test.ts tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx server/src/routes/v8/__tests__/finance.routes.test.ts`
- `ReadLints` clean for:
  - `server/src/routes/v8/finance.routes.ts`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Finance/FinancialModelWorkspace.tsx`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx`

### Result

The active broader finance lane now has its twenty-first real bounded packet after the split-brain map. Active finance model workspace outputs reads no longer default to legacy financial-modeling outputs routes during normal operation, while broader model mutations remain explicitly queued.

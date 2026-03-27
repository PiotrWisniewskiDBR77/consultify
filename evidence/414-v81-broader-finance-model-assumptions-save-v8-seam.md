## V8.1 Evidence - broader `Finance` parity - model assumptions save V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`model assumptions save V8 seam`

### Why this packet

After active finance model event-delete continuity landed, the next smallest honest broader finance residual was the assumptions-save mutation still defaulting to the legacy financial-modeling endpoint in the active finance model workspace.

This mutation is used by:
- `src/components/Finance/FinancialModelWorkspace.tsx` for the active model assumptions save action

This packet stays bounded because it closes one mutation seam only. It does not broaden into wider model-edit flows or immediate lane acceptance work.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed mutation support for:
   - `PUT /api/v8/finance/models/:modelId`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.updateModel()`
3. updated `src/components/Finance/FinancialModelWorkspace.tsx` so the active assumptions save action now uses the governed V8 seam first, with bounded legacy fallback to `/api/financial-modeling/models/:modelId`
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

The active broader finance lane now has its twenty-eighth real bounded packet after the split-brain map. Active finance model assumptions-save actions no longer default to legacy financial-modeling model-update routes during normal operation, while bounded lane-acceptance review remains explicitly queued.

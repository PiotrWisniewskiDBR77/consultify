## V8.1 Evidence - broader `Finance` parity - model validations V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`model validations V8 seam`

### Why this packet

After active finance model detail continuity landed, the next smallest honest broader finance residual was the validations read still defaulting to the legacy financial-modeling endpoint on active model surfaces.

This validations read is used by:
- `src/components/Economics/hooks/useFinanceSelection.ts` for prediction preview hydration on the active Finance hub
- `src/components/Finance/FinancialModelWorkspace.tsx` for initial workspace load and validations refresh after compute

This packet stays bounded because it closes one read seam only. It does not broaden into model outputs continuity, model create/update/approve/compute mutations, statements, budgets, or valuations.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed read support for:
   - `GET /api/v8/finance/models/:modelId/validations`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.getModelValidations()`
   - `V8FinanceModelValidation`
   - `V8FinanceModelValidationResult`
3. updated `src/components/Economics/hooks/useFinanceSelection.ts` so prediction preview validations now use the governed V8 seam first, with fallback to legacy `/api/financial-modeling/models/:id/validations` only for bounded compatibility statuses
4. updated `src/components/Finance/FinancialModelWorkspace.tsx` so validations reads during initial model load and post-compute refresh now use the governed V8 seam first, with bounded legacy fallback
5. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Economics/useFinanceSelection.v8-statement-pack-detail.test.tsx`

### Verification

- `npx vitest run tests/unit/services/v8-finance-api.test.ts tests/components/Economics/useFinanceSelection.v8-statement-pack-detail.test.tsx server/src/routes/v8/__tests__/finance.routes.test.ts`
- `ReadLints` clean for:
  - `server/src/routes/v8/finance.routes.ts`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Economics/hooks/useFinanceSelection.ts`
  - `src/components/Finance/FinancialModelWorkspace.tsx`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Economics/useFinanceSelection.v8-statement-pack-detail.test.tsx`

### Result

The active broader finance lane now has its twentieth real bounded packet after the split-brain map. Active finance prediction preview and workspace validations reads no longer default to legacy financial-modeling validations routes during normal operation.

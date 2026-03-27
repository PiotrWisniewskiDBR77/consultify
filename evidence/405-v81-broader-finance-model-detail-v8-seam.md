## V8.1 Evidence - broader `Finance` parity - model detail V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`model detail V8 seam`

### Why this packet

After `FinancialStatementImportWizard` confirm continuity landed, the broader finance lane was not yet ready for bounded acceptance because active model surfaces still mixed truth.

The next smallest honest residual was the active finance model detail read used by:
- `src/components/Economics/hooks/useFinanceSelection.ts` for Finance hub preview hydration
- `src/components/Finance/FinancialModelWorkspace.tsx` for initial model selection and workspace detail load

This packet stays bounded because it closes one model detail read seam only. It does not broaden into model validations, outputs, create/update/approve/compute mutations, statements, budgets, or valuations.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed read support for:
   - `GET /api/v8/finance/models/:modelId`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.getModel()`
   - `V8FinanceModelDetail`
3. updated `src/components/Economics/hooks/useFinanceSelection.ts` so model preview hydration now uses the governed V8 model-detail seam first, with fallback to legacy `/api/financial-modeling/models/:id` only for bounded compatibility statuses
4. updated `src/components/Finance/FinancialModelWorkspace.tsx` so initial model selection/detail load now uses the governed V8 model-detail seam first, with bounded legacy fallback
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

The active broader finance lane now has its nineteenth real bounded packet after the split-brain map. Active finance model preview hydration and initial workspace model detail load no longer default to legacy financial-modeling detail reads during normal operation.

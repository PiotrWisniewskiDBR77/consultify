## V8.1 Evidence - broader `Finance` parity - workspace model list V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`workspace model list V8 seam`

### Why this packet

After active finance import upload continuity landed, the next smallest honest broader finance residual was the model list bootstrap inside `FinancialModelWorkspace` still defaulting to the legacy financial-modeling list route.

This read is used by:
- `src/components/Finance/FinancialModelWorkspace.tsx` for sidebar model list hydration and refresh after create or mutation flows

This packet stays bounded because it closes one workspace list-read seam only. It does not broaden into new model mutations, statement workflows, or lane acceptance work.

### What changed

1. updated `src/components/Finance/FinancialModelWorkspace.tsx` so `loadModels()` now uses the governed V8 seam first via `V8FinanceApi.getModels()`, with bounded legacy fallback to `/api/financial-modeling/models`
2. added focused regression coverage in:
   - `tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx`

### Verification

- `npx vitest run tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx tests/unit/services/v8-finance-api.test.ts`
- `ReadLints` clean for:
  - `src/components/Finance/FinancialModelWorkspace.tsx`
  - `tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx`

### Result

The active broader finance lane now has its thirty-first real bounded packet after the split-brain map. Active finance model workspace list hydration no longer defaults to the legacy financial-modeling models route during normal operation.

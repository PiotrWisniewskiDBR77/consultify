## V8.1 Evidence - broader `Finance` parity - models list/read V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`models list/read V8 seam`

### Why this packet

After the broader finance split-brain map landed, the next smallest honest broader finance packet was the visible models list/read workflow used by the default `models` tab and shared `prediction` surface in `useFinanceData`.

This packet stays bounded because it closes one read seam only. It does not broaden into model detail reads, create/update/approve/compute mutations, statements, budgets, or valuations.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed read support for:
   - `GET /api/v8/finance/models`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.getModels()`
3. updated `src/components/Economics/hooks/useFinanceData.ts` so `loadModels()` now uses the governed V8 seam first, with fallback to legacy `/api/financial-modeling/models` only for bounded compatibility statuses
4. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Economics/useFinanceData.v8-analyses.test.tsx`

### Verification

- `npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Economics/useFinanceData.v8-analyses.test.tsx`
- `ReadLints` clean for:
  - `server/src/routes/v8/finance.routes.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Economics/hooks/useFinanceData.ts`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Economics/useFinanceData.v8-analyses.test.tsx`

### Result

The active broader finance lane now has its first real bounded packet after the split-brain map. Visible finance model list/read continuity no longer defaults to legacy financial-modeling reads during normal operation on the active hub surface.

## V8.1 Evidence - broader `Finance` parity - valuations list/read V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`valuations list/read V8 seam`

### Why this packet

After models list/read continuity landed, the next smallest honest broader finance packet was the visible valuations list/read workflow used by the dedicated `valuation` tab in `useFinanceData`.

This packet stays bounded because it closes one read seam only. It does not broaden into valuation detail, create/approve/export mutations, statements, budgets, or model workflows.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed read support for:
   - `GET /api/v8/finance/valuations`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.getValuations()`
3. updated `src/components/Economics/hooks/useFinanceData.ts` so `loadValuations()` now uses the governed V8 seam first, with fallback to legacy `/api/economics/valuations` only for bounded compatibility statuses
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

The active broader finance lane now has its second real bounded packet after the split-brain map. Visible finance valuation list/read continuity no longer defaults to legacy economics reads during normal operation on the active hub surface.

## V8.1 Evidence - broader `Finance` parity - statement packs list/read V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`statement packs list/read V8 seam`

### Why this packet

After budgets list/read continuity landed, the next smallest honest broader finance packet was the visible statement-pack list/read workflow still used by the `statements` tab in `useFinanceData` and by the import-complete path in `FinanceHub`.

This packet stays bounded because it closes one list/read seam only. It does not broaden into statement-pack detail reads, preview/workspace hydration, confirm/delete/import writes, or wider finance mutations.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed read support for:
   - `GET /api/v8/finance/statement-packs`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.getStatementPacks()`
3. updated `src/components/Economics/hooks/useFinanceData.ts` so `loadStatements()` now uses the governed V8 seam first, with fallback to legacy `/api/finance-statements/packs` only for bounded compatibility statuses
4. updated `src/components/Economics/FinanceHub.tsx` so the import-complete pack lookup also uses the governed V8 seam first, with the same bounded fallback discipline
5. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Economics/useFinanceData.v8-analyses.test.tsx`
   - `tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx`

### Verification

- `npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Economics/useFinanceData.v8-analyses.test.tsx tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx`
- `ReadLints` clean for:
  - `server/src/routes/v8/finance.routes.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Economics/hooks/useFinanceData.ts`
  - `src/components/Economics/FinanceHub.tsx`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Economics/useFinanceData.v8-analyses.test.tsx`
  - `tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx`

### Result

The active broader finance lane now has its fourth real bounded packet after the split-brain map. Visible statement-pack list/read continuity no longer defaults to legacy finance-statements routes during normal operation on the active hub surfaces.

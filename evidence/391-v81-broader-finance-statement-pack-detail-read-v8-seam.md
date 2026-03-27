## V8.1 Evidence - broader `Finance` parity - statement-pack detail read V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`statement-pack detail read V8 seam`

### Why this packet

After statement-pack list/read continuity landed, the next smallest honest broader finance packet was the shared statement-pack detail read still used by active preview and workspace surfaces.

This packet stays bounded because it closes one detail-read seam only. It does not broaden into child statement detail reads, analytics, confirm/delete/import writes, or wider statement-pack workflow mutations.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed read support for:
   - `GET /api/v8/finance/statement-packs/:packId`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.getStatementPack()`
3. updated `src/components/Economics/hooks/useFinanceSelection.ts` so statement-pack preview/model-pack hydration now uses the governed V8 seam first, with fallback to legacy `/api/finance-statements/packs/:id` only for bounded compatibility statuses
4. updated `src/components/Finance/FinancialStatementPackWorkspace.tsx` so the full statement-pack workspace loader also uses the governed V8 seam first, with the same bounded fallback discipline
5. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Economics/useFinanceSelection.v8-statement-pack-detail.test.tsx`
   - `tests/components/Finance/FinancialStatementPackWorkspace.v8-read-seam.test.tsx`

### Verification

- `npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Economics/useFinanceSelection.v8-statement-pack-detail.test.tsx tests/components/Finance/FinancialStatementPackWorkspace.v8-read-seam.test.tsx`
- `ReadLints` clean for:
  - `server/src/routes/v8/finance.routes.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Economics/hooks/useFinanceSelection.ts`
  - `src/components/Finance/FinancialStatementPackWorkspace.tsx`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Economics/useFinanceSelection.v8-statement-pack-detail.test.tsx`
  - `tests/components/Finance/FinancialStatementPackWorkspace.v8-read-seam.test.tsx`

### Result

The active broader finance lane now has its fifth real bounded packet after the split-brain map. Active statement-pack preview and workspace read continuity no longer default to legacy finance-statements pack-detail routes during normal operation.

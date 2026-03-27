## V8.1 Evidence - broader `Finance` parity - child statement detail read V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`child statement detail read V8 seam`

### Why this packet

After statement-pack detail continuity landed, the next smallest honest broader finance packet was the shared child-statement detail read still used by active preview, pack workspace, and import-continuation flows.

This packet stays bounded because it closes the single `GET /api/finance-statements/:id` read seam for the lightweight active consumers only. It does not broaden into statement analytics, ratios, confirm/detect/map writes, or the heavier `FinancialStatementWorkspace` surface that still couples the same read with additional legacy list and ratio continuity.

### What changed

1. added governed server read support in:
   - `server/src/services/financialStatementReadService.ts`
   - `server/src/routes/v8/finance.routes.ts`
   - new route: `GET /api/v8/finance/statements/:statementId`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.getStatement()`
   - `V8FinanceStatementDetail`
3. updated `src/components/Economics/hooks/useFinanceSelection.ts` so model-preview child statement hydration now uses the governed V8 seam first, with fallback to legacy `/api/finance-statements/:id` only for bounded compatibility statuses
4. updated `src/components/Finance/FinancialStatementPackWorkspace.tsx` so child statement detail loading now uses the governed V8 seam first, with the same bounded fallback discipline
5. updated `src/components/Economics/FinanceHub.tsx` so import-complete statement-to-pack lookup now reads the child statement through the governed V8 seam first before pack refresh
6. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Economics/useFinanceSelection.v8-statement-pack-detail.test.tsx`
   - `tests/components/Finance/FinancialStatementPackWorkspace.v8-read-seam.test.tsx`
   - `tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx`

### Verification

- `npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Economics/useFinanceSelection.v8-statement-pack-detail.test.tsx tests/components/Finance/FinancialStatementPackWorkspace.v8-read-seam.test.tsx tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx`
- `ReadLints` clean for:
  - `server/src/services/financialStatementReadService.ts`
  - `server/src/routes/v8/finance.routes.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Economics/hooks/useFinanceSelection.ts`
  - `src/components/Finance/FinancialStatementPackWorkspace.tsx`
  - `src/components/Economics/FinanceHub.tsx`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Economics/useFinanceSelection.v8-statement-pack-detail.test.tsx`
  - `tests/components/Finance/FinancialStatementPackWorkspace.v8-read-seam.test.tsx`
  - `tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx`

### Result

The active broader finance lane now has its sixth real bounded packet after the split-brain map. Active child-statement preview, pack drill-down, and import-complete continuity no longer default to legacy finance-statements detail reads during normal operation.

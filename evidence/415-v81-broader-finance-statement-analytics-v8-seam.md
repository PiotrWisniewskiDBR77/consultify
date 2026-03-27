## V8.1 Evidence - broader `Finance` parity - statement analytics V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`statement analytics V8 seam`

### Why this packet

After active finance model assumptions-save continuity landed, the next smallest honest broader finance residual was the statement analytics read in `FinancialStatementPackWorkspace` still defaulting to the legacy finance-statements endpoint.

This read is used by:
- `src/components/Finance/FinancialStatementPackWorkspace.tsx` for the active statement table analytics load

This packet stays bounded because it closes one workspace support-read seam only. It does not broaden into upload-and-analyze continuity, explain endpoint redesign, or wider statement-pack workflow breadth.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed read support for:
   - `GET /api/v8/finance/statements/:statementId/analytics`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.getStatementAnalytics()`
3. updated `src/components/Finance/FinancialStatementPackWorkspace.tsx` so the active statement analytics load now uses the governed V8 seam first, with bounded legacy fallback to `/api/finance-statements/:statementId/analytics`
4. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Finance/FinancialStatementPackWorkspace.v8-read-seam.test.tsx`

### Verification

- `npx vitest run tests/unit/services/v8-finance-api.test.ts tests/components/Finance/FinancialStatementPackWorkspace.v8-read-seam.test.tsx server/src/routes/v8/__tests__/finance.routes.test.ts`
- `ReadLints` clean for:
  - `server/src/routes/v8/finance.routes.ts`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Finance/FinancialStatementPackWorkspace.tsx`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Finance/FinancialStatementPackWorkspace.v8-read-seam.test.tsx`

### Result

The active broader finance lane now has its twenty-ninth real bounded packet after the split-brain map. Active statement-pack workspace analytics reads no longer default to legacy finance-statements analytics routes during normal operation, while import upload continuity remains explicitly queued.

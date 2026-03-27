## V8.1 Evidence - broader `Finance` parity - statement values save V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`statement values save V8 seam`

### Why this packet

After statement confirm continuity landed, the next smallest honest broader finance packet was the values-save write still posting directly to the legacy finance-statements surface inside `FinancialStatementWorkspace`.

This packet stays bounded because it closes one statement-scoped write endpoint only. It does not broaden into detect/extract/map recovery continuity, wider statement mutation redesign, or analytics/indexing changes.

### What changed

1. extracted the shared values-save workflow into `server/src/services/financialStatementValueWriteService.ts` so legacy and V8 routes now delegate to the same normalization, validation, readiness, artifact, and pack-sync orchestration
2. updated `server/src/routes/finance-statements.routes.ts` so the legacy `PUT /api/finance-statements/:id/values` path uses the shared workflow
3. extended `server/src/routes/v8/finance.routes.ts` with governed write support for:
   - `PUT /api/v8/finance/statements/:statementId/values`
4. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.putStatementValues()`
   - `V8FinanceStatementValuesSaveResult`
5. updated `src/components/Finance/FinancialStatementWorkspace.tsx` so values-save writes now use the governed V8 seam first, with fallback to legacy `/api/finance-statements/:statementId/values` only for bounded compatibility statuses
6. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx`

### Verification

- `npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx`
- `ReadLints` clean for:
  - `server/src/services/financialStatementValueWriteService.ts`
  - `server/src/routes/finance-statements.routes.ts`
  - `server/src/routes/v8/finance.routes.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Finance/FinancialStatementWorkspace.tsx`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx`

### Result

The active broader finance lane now has its thirteenth real bounded packet after the split-brain map. The advanced statement workspace no longer defaults to the legacy finance-statements values-save write during normal operation.

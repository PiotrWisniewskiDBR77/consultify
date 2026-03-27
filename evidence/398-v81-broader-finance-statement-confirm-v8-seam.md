## V8.1 Evidence - broader `Finance` parity - statement confirm V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`statement confirm V8 seam`

### Why this packet

After the advanced statement workspace read cluster was closed, the next smallest honest broader finance packet was the visible confirm action still posting directly to the legacy finance-statements surface inside `FinancialStatementWorkspace`.

This packet stays bounded because it closes one statement-scoped write only. It does not broaden into manual values save continuity, detect/extract/map recovery flow continuity, wider statement mutation redesign, or document-intelligence/indexing behavior.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed write support for:
   - `POST /api/v8/finance/statements/:statementId/confirm`
2. reused existing finance statement services through the governed route by delegating to:
   - `evaluateStatementReadiness(...)`
   - `confirmStatement(...)`
   - `snapshotCanonicalStatementVersion(...)`
   - `syncStatementToPack(...)`
   - `recordStatementSourceArtifact(...)`
   - `updateStatementIngestRun(...)`
   - `recordStatementQualityRun(...)`
3. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.confirmStatement()`
   - `V8FinanceStatementConfirmResult`
4. updated `src/components/Finance/FinancialStatementWorkspace.tsx` so the visible confirm action now uses the governed V8 seam first, with fallback to legacy `/api/finance-statements/:statementId/confirm` only for bounded compatibility statuses
5. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx`

### Verification

- `npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx`
- `ReadLints` clean for:
  - `server/src/routes/v8/finance.routes.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Finance/FinancialStatementWorkspace.tsx`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx`

### Result

The active broader finance lane now has its twelfth real bounded packet after the split-brain map. The advanced statement workspace no longer defaults to the legacy finance-statements confirm write during normal operation.

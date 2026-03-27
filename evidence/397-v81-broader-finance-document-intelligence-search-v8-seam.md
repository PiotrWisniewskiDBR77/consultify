## V8.1 Evidence - broader `Finance` parity - document-intelligence search V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`document-intelligence search V8 seam`

### Why this packet

After related-list continuity landed, the next smallest honest broader finance packet was the document-intelligence search read still loaded directly from the legacy finance-statements surface inside `FinancialStatementWorkspace`.

This packet stays bounded because it closes one statement-scoped support read only. It does not broaden into document-intelligence indexing/upsert behavior, ranking changes, wider RAG policy, statement writes, analytics, or advanced statement workspace workflow redesign.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed read support for:
   - `GET /api/v8/finance/statements/:statementId/document-intelligence/search`
2. reused `server/src/services/documentIntelligenceService.ts` through the governed route by delegating to:
   - `searchStatementDocumentIntelligence(...)`
3. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.searchStatementDocumentIntelligence()`
   - `V8FinanceStatementDocumentIntelMatch`
   - `V8FinanceStatementDocumentIntelResult`
4. updated `src/components/Finance/FinancialStatementWorkspace.tsx` so document-intelligence search now uses the governed V8 seam first, with fallback to legacy `/api/finance-statements/:statementId/document-intelligence/search` only for bounded compatibility statuses
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

The active broader finance lane now has its eleventh real bounded packet after the split-brain map. The advanced statement workspace no longer defaults to the legacy finance-statements document-intelligence search read during normal operation.

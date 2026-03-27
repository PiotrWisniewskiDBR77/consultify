## V8.1 Evidence - broader `Finance` parity - related list V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`related list V8 seam`

### Why this packet

After statement-ratios continuity landed, the next smallest honest broader finance packet was the source-documents related list still loaded from the legacy finance-statements list surface inside `FinancialStatementWorkspace`.

This packet stays bounded because it closes one workspace support read only. It does not broaden into source-documents ranking changes, pack-scoped list semantics, document-intelligence search, statement writes, analytics, or wider statement-index redesign.

### What changed

1. extended `server/src/services/financialStatementReadService.ts` with governed read support for:
   - `listStatements(organizationId, readinessFilter)`
2. extended `server/src/routes/v8/finance.routes.ts` with governed read support for:
   - `GET /api/v8/finance/statements`
3. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.getStatements()`
   - `V8FinanceStatementSummary`
4. updated `src/components/Finance/FinancialStatementWorkspace.tsx` so related/source-document list loading now uses the governed V8 seam first, with fallback to legacy `/api/finance-statements` only for bounded compatibility statuses
5. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx`

### Verification

- `npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts tests/unit/services/v8-finance-api.test.ts tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx`
- `ReadLints` clean for:
  - `server/src/services/financialStatementReadService.ts`
  - `server/src/routes/v8/finance.routes.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Finance/FinancialStatementWorkspace.tsx`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx`

### Result

The active broader finance lane now has its tenth real bounded packet after the split-brain map. The advanced statement workspace no longer defaults to the legacy finance-statements list read for its source-documents related-list strip during normal operation.

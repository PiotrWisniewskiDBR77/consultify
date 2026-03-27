## V8.1 Evidence - broader `Finance` parity - statement ratios V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`statement ratios V8 seam`

### Why this packet

After canonical-line continuity landed, the next smallest honest broader finance packet was the statement-ratios read still loaded from the legacy finance-statements surface inside `FinancialStatementWorkspace`.

This packet stays bounded because it closes one statement-scoped support read only. It does not broaden into related-statement list continuity, statement index semantics, ratio growth reads, ratio catalog/benchmarks, analytics, import wizard continuity, or advanced statement workspace write flows.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed read support for:
   - `GET /api/v8/finance/statements/:statementId/ratios`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.getStatementRatios()`
   - `V8FinanceStatementRatio`
   - `V8FinanceStatementRatioResult`
3. updated `src/components/Finance/FinancialStatementWorkspace.tsx` so statement-ratio loading and manual recompute now use the governed V8 seam first, with fallback to legacy `/api/finance-statements/:statementId/ratios` only for bounded compatibility statuses
4. added focused regression coverage in:
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

The active broader finance lane now has its ninth real bounded packet after the split-brain map. The advanced statement workspace no longer defaults to the legacy finance-statements ratio read during normal operation or manual ratio recompute.

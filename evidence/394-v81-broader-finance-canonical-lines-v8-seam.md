## V8.1 Evidence - broader `Finance` parity - canonical lines V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`canonical lines V8 seam`

### Why this packet

After advanced statement detail continuity landed, the next smallest honest broader finance packet was the canonical-line catalog still loaded from the legacy finance-statements surface inside `FinancialStatementWorkspace`.

This packet stays bounded because it closes one org-scoped support read only. It does not broaden into statement ratios, related-statement list continuity, analytics, import wizard continuity, or any advanced statement workspace write flows.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed read support for:
   - `GET /api/v8/finance/canonical-lines`
2. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.getCanonicalLines()`
   - `V8FinanceCanonicalLineOption`
3. updated `src/components/Finance/FinancialStatementWorkspace.tsx` so canonical-line catalog loading now uses the governed V8 seam first, with fallback to legacy `/api/finance-statements/canonical-lines` only for bounded compatibility statuses
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

The active broader finance lane now has its eighth real bounded packet after the split-brain map. The advanced statement workspace no longer defaults to the legacy finance-statements canonical-line catalog during normal operation.

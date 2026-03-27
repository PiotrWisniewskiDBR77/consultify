## V8.1 Evidence - broader `Finance` parity - statement detect V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`statement detect V8 seam`

### Why this packet

After values-save continuity landed, the remaining recovery chain in `FinancialStatementWorkspace` was still split across legacy-only detect, extract, and map writes.

The smallest honest next packet was `detect` alone. It persists statement metadata and ingest/quality artifacts as a self-contained step, while `extract` and `map` still operate as one tighter retry pipeline and remain for the next bounded assessment.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed write support for:
   - `POST /api/v8/finance/statements/:statementId/detect`
2. reused the existing detect behavior on the V8 route by mirroring the bounded legacy detect flow:
   - statement text load
   - statement-type and period/currency/scaling detection
   - metadata persistence with legacy-compatible soft failure handling
   - pack sync, ingest-run updates, source-artifact recording, and quality-run recording
3. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.detectStatement()`
   - `V8FinanceStatementDetectResult`
4. updated `src/components/Finance/FinancialStatementWorkspace.tsx` so the first step of `handleRetryRecovery()` now uses the governed V8 detect seam first, with fallback to legacy `/api/finance-statements/:statementId/detect` only for bounded compatibility statuses
5. kept `extract` and `map` on their existing legacy calls for now, preserving the current retry-recovery pipeline without broadening this packet into the full heavier chain
6. added focused regression coverage in:
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

The active broader finance lane now has its fourteenth real bounded packet after the split-brain map. The advanced statement workspace no longer defaults to the legacy finance-statements detect write during normal retry-recovery operation, while the remaining `extract/map` pair stays explicitly queued as the next honest bounded recovery packet.

## V8.1 Evidence - broader `Finance` parity - import upload V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`import upload V8 seam`

### Why this packet

After active statement-pack workspace analytics continuity landed, the next smallest honest broader finance residual was the `Upload & Analyze` entrypoint in `FinancialStatementImportWizard` still defaulting to the legacy finance-statements upload route.

This write is used by:
- `src/components/Finance/FinancialStatementImportWizard.tsx` for the active upload-and-analyze entry into the wizard flow

This packet stays bounded because it closes one upload entry seam only. It does not broaden into a wider import redesign or immediate lane acceptance work.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed upload support for:
   - `POST /api/v8/finance/statements/upload-and-analyze`
2. extended the V8 finance client with multipart upload support in:
   - `src/services/api/v8/client.ts`
   - `src/services/api/v8/finance.ts` via `V8FinanceApi.uploadAndAnalyzeStatement()`
3. updated `src/components/Finance/FinancialStatementImportWizard.tsx` so the active `Upload & Analyze` action now uses the governed V8 seam first, with bounded legacy fallback to `/api/finance-statements/upload-and-analyze`
4. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/finance.routes.test.ts`
   - `tests/unit/services/v8-finance-api.test.ts`
   - `tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx`

### Verification

- `npx vitest run tests/unit/services/v8-finance-api.test.ts tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx server/src/routes/v8/__tests__/finance.routes.test.ts`
- `ReadLints` clean for:
  - `server/src/routes/v8/finance.routes.ts`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
  - `src/services/api/v8/client.ts`
  - `src/services/api/v8/finance.ts`
  - `src/components/Finance/FinancialStatementImportWizard.tsx`
  - `tests/unit/services/v8-finance-api.test.ts`
  - `tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx`

### Result

The active broader finance lane now has its thirtieth real bounded packet after the split-brain map. Active finance import upload continuity no longer defaults to the legacy finance-statements upload route during normal operation, while bounded lane acceptance remains the next honest decision.

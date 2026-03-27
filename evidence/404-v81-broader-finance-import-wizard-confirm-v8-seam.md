## V8.1 Evidence - broader `Finance` parity - import wizard confirm V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`import wizard confirm V8 seam`

### Why this packet

After the manual `Detect & Extract` and `Save & Validate` stages in `FinancialStatementImportWizard` landed on governed V8-first seams, the next smallest honest residual was the final wizard `Confirm & Save` action still posting directly to the legacy `finance-statements` confirm endpoint.

This packet stays bounded because it closes one visible wizard write action only. It does not broaden into smart upload continuity, earlier manual wizard stages, or wider finance ingest redesign.

### What changed

1. updated `src/components/Finance/FinancialStatementImportWizard.tsx` so `handleConfirm()` now uses the governed V8 confirm seam first through:
   - `V8FinanceApi.confirmStatement()`
2. kept bounded fallback discipline so the wizard only returns to legacy `POST /api/finance-statements/:statementId/confirm` for compatibility statuses handled by `shouldFallbackToLegacyFinance`
3. preserved the existing wizard completion contract:
   - `onComplete` still fires with the same `statementId`
   - confirm still happens only after the readiness-driven `Save & Validate` stage
   - upstream upload and mapping behavior remain unchanged
4. extended focused regression coverage in:
   - `tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx`

### Verification

- `npx vitest run tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx`
- `ReadLints` clean for:
  - `src/components/Finance/FinancialStatementImportWizard.tsx`
  - `tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx`

### Result

The active broader finance lane now has its eighteenth real bounded packet after the split-brain map. `FinancialStatementImportWizard` no longer defaults to legacy `finance-statements` confirm writes during the manual import path.

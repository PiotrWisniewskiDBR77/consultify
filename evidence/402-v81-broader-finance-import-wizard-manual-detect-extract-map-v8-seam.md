## V8.1 Evidence - broader `Finance` parity - import wizard manual detect/extract/map V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`import wizard manual detect/extract/map V8 seam`

### Why this packet

After the active `FinancialStatementWorkspace` recovery chain landed on governed V8-first seams, the next smallest honest broader finance residual was the manual `Detect & Extract` stage in `FinancialStatementImportWizard`.

This packet stays bounded because it only closes the manual wizard stage that still defaulted to legacy `finance-statements` detect, extract, map, and canonical-line reads. It does not broaden into smart upload continuity, wizard values-save continuity, wizard confirm continuity, or wider finance ingest redesign.

### What changed

1. updated `src/components/Finance/FinancialStatementImportWizard.tsx` so the manual detect stage now uses governed V8-first helpers for:
   - `POST /api/v8/finance/statements/:statementId/detect`
   - `POST /api/v8/finance/statements/:statementId/extract`
   - `POST /api/v8/finance/statements/:statementId/map`
   - `GET /api/v8/finance/canonical-lines`
2. kept bounded fallback discipline so the wizard only returns to legacy `finance-statements` endpoints for compatibility statuses handled by `shouldFallbackToLegacyFinance`
3. preserved the existing wizard stage boundaries and behavior:
   - upload remains unchanged
   - `Save & Validate` remains on its current seam
   - final confirm remains on its current seam
4. added focused regression coverage in:
   - `tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx`

### Verification

- `npx vitest run tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx`
- `ReadLints` clean for:
  - `src/components/Finance/FinancialStatementImportWizard.tsx`
  - `tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx`

### Result

The active broader finance lane now has its sixteenth real bounded packet after the split-brain map. `FinancialStatementImportWizard` no longer defaults to legacy `finance-statements` detect/extract/map/canonical-lines calls during the manual import path.

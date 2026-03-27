## V8.1 Evidence - broader `Finance` parity - import wizard values save V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`import wizard values save V8 seam`

### Why this packet

After the manual `Detect & Extract` stage in `FinancialStatementImportWizard` landed on governed V8-first seams, the next smallest honest residual was the wizard `Save & Validate` action still posting directly to the legacy `finance-statements` values-save endpoint.

This packet stays bounded because it closes one visible wizard write action only. It does not broaden into smart upload continuity, manual detect/extract/map continuity, final confirm continuity, or wider finance ingest redesign.

### What changed

1. updated `src/components/Finance/FinancialStatementImportWizard.tsx` so `handleSaveMapping()` now uses the governed V8 values-save seam first through:
   - `V8FinanceApi.putStatementValues()`
2. kept bounded fallback discipline so the wizard only returns to legacy `PUT /api/finance-statements/:statementId/values` for compatibility statuses handled by `shouldFallbackToLegacyFinance`
3. preserved the existing wizard stage contract:
   - mapped values payload shape is unchanged
   - readiness and validation state still drive the confirm step exactly as before
   - final confirm remains on its current seam
4. extended focused regression coverage in:
   - `tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx`

### Verification

- `npx vitest run tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx`
- `ReadLints` clean for:
  - `src/components/Finance/FinancialStatementImportWizard.tsx`
  - `tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx`

### Result

The active broader finance lane now has its seventeenth real bounded packet after the split-brain map. `FinancialStatementImportWizard` no longer defaults to legacy `finance-statements` values-save writes during the manual import path.

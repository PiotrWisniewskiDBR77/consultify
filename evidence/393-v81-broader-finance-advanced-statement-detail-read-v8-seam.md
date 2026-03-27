## V8.1 Evidence - broader `Finance` parity - advanced statement detail read V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`advanced statement detail read V8 seam`

### Why this packet

After lightweight child-statement detail continuity landed, the next smallest honest broader finance packet was the initial statement detail read still used by `FinancialStatementWorkspace`.

This packet stays bounded because it moves only the initial `GET /api/finance-statements/:id` read in the advanced statement workspace onto the governed V8 seam. It does not broaden into statement ratios, canonical-line catalog reads, related-statement list continuity, analytics, or any confirm/recovery/save flows on the same surface.

### What changed

1. updated `src/components/Finance/FinancialStatementWorkspace.tsx` so the initial statement detail load now uses the governed `V8FinanceApi.getStatement()` seam first, with fallback to legacy `/api/finance-statements/:id` only for bounded compatibility statuses
2. added focused regression coverage in:
   - `tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx`
3. verification re-ran the surrounding finance seam suite to confirm the new advanced workspace consumer still composes correctly with the previously landed child-statement, pack-detail, and import-continuation continuity work

### Verification

- `npx vitest run tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx tests/components/Finance/FinancialStatementPackWorkspace.v8-read-seam.test.tsx tests/components/Economics/useFinanceSelection.v8-statement-pack-detail.test.tsx tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx tests/unit/services/v8-finance-api.test.ts server/src/routes/v8/__tests__/finance.routes.test.ts`
- `ReadLints` clean for:
  - `src/components/Finance/FinancialStatementWorkspace.tsx`
  - `tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx`

### Result

The active broader finance lane now has its seventh real bounded packet after the split-brain map. The advanced statement workspace no longer defaults to the legacy finance-statements detail read during normal initial-load operation.

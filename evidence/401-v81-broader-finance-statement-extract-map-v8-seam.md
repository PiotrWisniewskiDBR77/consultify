## V8.1 Evidence - broader `Finance` parity - statement extract/map V8 seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

### Packet

`statement extract/map V8 seam`

### Why this packet

After statement detect continuity landed, the remaining active recovery-chain residue in `FinancialStatementWorkspace` was the paired `extract -> map` pipeline still posting directly to the legacy finance-statements surface.

This packet stays bounded because it closes the remaining two coupled retry-recovery endpoints on the active statement workspace. It does not broaden into import-wizard continuity, statement analytics, pack workspace breadth, or wider finance redesign work.

### What changed

1. extended `server/src/routes/v8/finance.routes.ts` with governed write support for:
   - `POST /api/v8/finance/statements/:statementId/extract`
   - `POST /api/v8/finance/statements/:statementId/map`
2. mirrored the bounded legacy extract flow on the V8 route, including:
   - source text load
   - statement-type scoped extraction
   - candidate-row and section persistence
   - ingest/artifact/quality-run updates
3. mirrored the bounded legacy map flow on the V8 route, including:
   - candidate-row reuse
   - heuristic mapping plus LLM follow-up passes
   - mapping-candidate persistence
   - ingest/artifact/quality-run updates
   - policy-tier and coverage assessment
4. extended `src/services/api/v8/finance.ts` with:
   - `V8FinanceApi.extractStatement()`
   - `V8FinanceApi.mapStatement()`
   - `V8FinanceStatementExtractResult`
   - `V8FinanceStatementMapResult`
5. updated `src/components/Finance/FinancialStatementWorkspace.tsx` so `handleRetryRecovery()` now uses governed V8 detect, extract, map, and values-save seams first, with bounded legacy fallback only for compatibility statuses
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

The active broader finance lane now has its fifteenth real bounded packet after the split-brain map. The advanced statement workspace no longer defaults to legacy finance-statements extract/map writes during normal retry-recovery operation, so the active workspace recovery chain is now fully governed on V8-first seams.

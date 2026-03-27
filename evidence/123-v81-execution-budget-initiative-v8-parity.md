# V8.1 Execution Budget Initiative V8 Parity

Date: 2026-03-26
Lane: `Execution / delivery control`
Taxonomy: `T2`
Tranche: `Tranche 2`

## What changed

Initiative-level budget summary now has a V8 route and client seam:

- backend: `GET /api/v8/execution-control/budget/initiative/:initiativeId`
- client: `V8ExecutionControlApi.getBudgetInitiativeSummary()`
- surface: `BudgetControlPanel` now reads initiative budget summary through V8-first
  logic with guarded legacy fallback

## Why this matters

Before this packet, the active initiative budget view still depended on a legacy-only
execution-control read path even though adjacent budget reads and writes had already moved
into the V8 namespace.

This packet removes that remaining active budget-summary split and narrows the execution
lane toward write-only residuals such as RAID mitigation parity.

## Verification

Passed:

- `tests/unit/services/v8-execution-control-api.test.ts`
- `server/src/routes/v8/__tests__/execution-control.routes.test.ts`

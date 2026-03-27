# V8.1 Execution RAID Mitigation V8 Parity

Date: 2026-03-26
Lane: `Execution / delivery control`
Taxonomy: `T2`
Tranche: `Tranche 2`

## What changed

RAID mitigation updates now have a V8 route and client seam:

- backend: `PATCH /api/v8/execution-control/raid/:id/mitigation`
- client: `V8ExecutionControlApi.updateRaidMitigation()`
- surface: `MitigationPanel` now writes through V8-first logic with guarded legacy fallback

## Why this matters

Before this packet, `MitigationPanel` remained a legacy-only write surface inside the active
execution lane. That left a visible operator workflow outside the V8 execution-control
contract even after route guard hardening, fallback discipline, and budget-summary parity.

This packet removes the most obvious remaining active execution-control write split and
further narrows the lane toward acceptance.

## Verification

Passed:

- `tests/unit/services/v8-execution-control-api.test.ts`
- `server/src/routes/v8/__tests__/execution-control.routes.test.ts`
- `tests/components/Execution/MitigationPanel.test.tsx`

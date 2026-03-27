# V8.1 Execution Control Fallback Discipline

Date: 2026-03-26
Lane: `Execution / delivery control`
Taxonomy: `T2`
Tranche: `Tranche 2`

## What changed

Execution-control fallback behavior is now bounded so active execution surfaces no longer
silently downgrade from V8 to legacy execution-control routes on transient failures.

Applied to:

- `ExecutionHub`
- `RiskSignalsPanel`
- `DelayDetectionPanel`
- `BudgetControlPanel` budget-entry write path

## Policy

Legacy fallback is allowed only for bounded non-supported statuses:

- `400`
- `404`
- `405`
- `501`

Transient failures such as `429`, `500`, and `503` now remain V8 failures instead of
quietly mixing runtime truth through legacy routes.

## Why this matters

Before this packet, the live execution lane could silently consume legacy execution-control
paths whenever V8 returned any error. That preserved split-brain behavior in the happy path.

This packet keeps compatibility fallback for genuinely unsupported routes while removing
silent downgrade on transient runtime errors.

## Verification

Passed:

- `tests/unit/services/v8-execution-control-api.test.ts`

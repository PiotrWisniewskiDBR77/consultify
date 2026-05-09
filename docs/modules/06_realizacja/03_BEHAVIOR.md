---
module_id: MODULE_EXECUTION
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Realizacja / Implementation & PMO

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST answer what is on track, blocked, late, over capacity and requiring decision.
- MUST connect every intervention to task/decision/baseline evidence.
- MUST distinguish forecast, actual and assumption.

## Must Not

- MUST NOT silently mutate high-impact objects.
- MUST NOT show fake success, hide blocking errors or leave users in infinite loading states.
- MUST NOT bypass source, role, approval or tenant constraints for convenience.

## Should

- SHOULD expose recovery paths for failed or degraded states.
- SHOULD make AI-generated proposals reviewable before they become durable state.

## Acceptance Criteria

- [ ] Main happy path can be executed end-to-end with visible state transitions.
- [ ] Error/degraded/empty states are explicit and recoverable.
- [ ] Any AI or automation action is auditable and approval-aware.

## Related Sources

- `DRD/consultify/docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`
- `DRD/consultify/docs/product/EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`
- `DRD/consultify/docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
- `DRD/consultify/docs/product/DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`
- `DRD/consultify/docs/product/EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md`
- `DRD/consultify/docs/product/EXECUTION_RESOURCE_BALANCING_AND_CAPACITY_OPERATIONS_V8.md`
- `DRD/consultify/docs/UI_UX/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md`

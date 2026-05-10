---
module_id: MODULE_EXECUTION
function_id: RL_EXECUTION_MANAGER
function_name: Execution — Manager Lane
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Manager Lane

## 1. Function Identity
- Function ID: `RL_EXECUTION_MANAGER`
- Runtime anchor: `ExecutionHub` tab `people_change` (`Manager`)
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: manager-focused execution signals and action suggestions.
- Inputs: manager lane metrics, blockers, due-soon tasks, KPI alerts.
- Outputs: explicit management actions and escalation paths.
- Boundaries: manager lane suggests/coordinates, not hidden direct writes.
- Security: role and tenant constraints.
- Evidence: `ExecutionHub.tsx` manager metrics and suggestions.
- Risk: management recommendations without review can create false certainty.

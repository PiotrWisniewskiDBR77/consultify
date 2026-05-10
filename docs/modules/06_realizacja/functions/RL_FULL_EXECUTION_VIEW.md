---
module_id: MODULE_EXECUTION
function_id: RL_FULL_EXECUTION_VIEW
function_name: Execution — Full Execution Route
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Full Execution Route

## 1. Function Identity
- Function ID: `RL_FULL_EXECUTION_VIEW`
- Route: `/execution`
- Runtime anchor: `FullExecutionView`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: execution lane surface outside hub route identity.
- Inputs: execution portfolio data and view-specific context.
- Outputs: explicit route transitions and action visibility.
- Boundaries: route wrapper does not bypass hub governance.
- Evidence: `AppRoutes.tsx`, `FullExecutionView.tsx`.
- Risk: overlapping execution routes can confuse canonical entry expectations.

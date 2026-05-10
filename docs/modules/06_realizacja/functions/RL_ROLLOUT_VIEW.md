---
module_id: MODULE_EXECUTION
function_id: RL_ROLLOUT_VIEW
function_name: Execution — Rollout View
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Rollout View

## 1. Function Identity
- Function ID: `RL_ROLLOUT_VIEW`
- Route: `/rollout`
- Runtime anchor: `FullRolloutView`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: rollout-focused execution lane surface.
- Inputs: rollout plans, dependencies, rollout status signals.
- Outputs: explicit rollout action/navigation paths.
- Boundaries: rollout view does not silently mutate canonical objects.
- Security/provenance: tenant/ACL and source evidence expectations apply.
- Evidence: `AppRoutes.tsx`, `FullRolloutView.tsx`.
- Risk: rollout state drift if not aligned with execution hub updates.

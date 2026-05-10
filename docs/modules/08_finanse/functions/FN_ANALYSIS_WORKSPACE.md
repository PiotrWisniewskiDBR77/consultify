---
module_id: MODULE_FINANCE
function_id: FN_ANALYSIS_WORKSPACE
function_name: Finance — Analysis Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Analysis Workspace

## 1. Function Identity
- Function ID: `FN_ANALYSIS_WORKSPACE`
- Runtime anchor: `FinanceHub` tab `analysis`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: run financial analyses and produce governed insight artifacts.
- Inputs: analysis records, ratios, source financial context.
- Outputs: explicit run/approve/handoff actions.
- UI: analysis lane and preview controls in `FinanceHub`.
- Governance: no hidden finalization path.
- Evidence: `FinanceHub.tsx` analysis tab; finance API contracts.
- Risk: analysis quality confidence may be overestimated in degraded mode.

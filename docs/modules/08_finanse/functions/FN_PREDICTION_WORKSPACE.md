---
module_id: MODULE_FINANCE
function_id: FN_PREDICTION_WORKSPACE
function_name: Finance — Prediction Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Prediction Workspace

## 1. Function Identity
- Function ID: `FN_PREDICTION_WORKSPACE`
- Runtime anchor: `FinanceHub` tab `prediction`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: work with forecast/prediction scenarios from models and budgets.
- Inputs: model/budget prediction sources and scenario metadata.
- Outputs: explicit scenario analysis and follow-up actions.
- UI: prediction tab views and row actions in `FinanceHub`.
- Evidence: `FinanceHub.tsx` prediction tab logic.
- Risk: scenario misuse without explicit assumption context.

---
module_id: MODULE_RESULTS
function_id: RZ_REPORTS_WORKSPACE
function_name: Results — Reports Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Reports Workspace

## 1. Function Identity
- Function ID: `RZ_REPORTS_WORKSPACE`
- Runtime anchor: `ResultsHub` tab `results_reports`
- Route scope: `/benefits`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: review value-realization reporting outputs with source-backed context.
- UI: report workspace and tracked report modes in `ResultsHub`.
- Inputs: results/KPI/ROI reporting datasets.
- Outputs: explicit report refresh, navigation and export-related actions.
- Governance: high-impact reporting outcomes need review before approval.
- Evidence: `ResultsHub.tsx` reports tab paths.
- Risk: report trust loss when evidence links are incomplete.

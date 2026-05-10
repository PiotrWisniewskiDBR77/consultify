---
module_id: MODULE_RESULTS
function_id: RZ_ROI_TRACKING
function_name: Results — ROI Tracking
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — ROI Tracking

## 1. Function Identity
- Function ID: `RZ_ROI_TRACKING`
- Runtime anchor: `ResultsHub` tab `roi`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: track ROI assumptions vs realized value over time.
- Inputs: ROI assumptions, realized updates, variance data.
- Outputs: explicit ROI edits and value-reconciliation actions.
- UI: ROI tracking workspace and ROI detail drawers.
- Security/provenance: assumption lineage and update audit must be visible.
- Evidence: ROI components used by `ResultsHub`.
- Risk: stale assumptions can distort strategic decisions.

---
module_id: MODULE_RESULTS
function_id: RZ_ROI_ANALYSIS
function_name: Results — ROI Analysis
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — ROI Analysis

## 1. Function Identity
- Function ID: `RZ_ROI_ANALYSIS`
- Runtime anchor: `ResultsHub` tab `roi_analysis`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: analyze portfolio-level ROI and variance patterns.
- UI: ROI analysis workspace in results runtime.
- Inputs: portfolio ROI summary and analytic signals.
- Outputs: explicit insight actions and guided follow-up decisions.
- Governance: no hidden mutation in analysis-only workflows.
- Evidence: `ResultsHub.tsx` roi analysis tab; `ROIAnalysisView.tsx`.
- Risk: interpretation errors if degraded data not clearly exposed.

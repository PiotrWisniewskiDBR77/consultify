---
module_id: MODULE_RESULTS
function_id: RZ_KPI_WORKSPACE
function_name: Results — KPI Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — KPI Workspace

## 1. Function Identity
- Function ID: `RZ_KPI_WORKSPACE`
- Runtime anchor: `ResultsHub` tab `results_kpi`
- Route scope: `/benefits`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: operate KPI catalog/overview/queue/scorecards in value-realization lane.
- UI: KPI workspace modes inside `ResultsHub`.
- Inputs: KPI definitions, mappings, time series, deviation cases.
- Outputs: explicit KPI updates and monitoring actions.
- Security/provenance: KPI claims require source/evidence visibility.
- Evidence: `ResultsHub.tsx`, KPI-related components in `src/components/Results`.
- Risk: KPI integrity can drift without regression coverage.

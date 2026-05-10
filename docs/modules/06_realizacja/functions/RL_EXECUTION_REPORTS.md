---
module_id: MODULE_EXECUTION
function_id: RL_EXECUTION_REPORTS
function_name: Execution — Reports
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Execution Reports

## 1. Function Identity
- Function ID: `RL_EXECUTION_REPORTS`
- Runtime anchor: `ExecutionHub` tab `reports`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: generate/inspect execution reporting catalog and outputs.
- Inputs: report definitions, execution metrics, degraded flags, data quality context.
- Outputs: report generation actions, Wordy handoff, export actions.
- Boundaries: reporting is explicit and governed; no silent finalization.
- Security/provenance: report source task/signal lineage required.
- Evidence: `ExecutionHub.tsx` report catalog and generation actions.
- Risk: output trust can degrade if data quality warnings are ignored.

---
module_id: MODULE_PRESENTATIONS
function_id: PR_GEN_RUNTIME_TARGET
function_name: Presentations Generator — Runtime Target
doc_kind: FUNCTION_CONTRACT
status: draft
owner: user
last_updated: 2026-05-10
---

# Function Contract — Runtime Target

## 1. Function Identity
- Function ID: `PR_GEN_RUNTIME_TARGET`
- Intended runtime anchor: `PrezentacjeView` generator workspace
- Current mounted status: `partial` (imported but not mounted on `/prezentacje`)

## 2-12. Contract Summary
- Purpose: preserve standalone generator target contract without overstating As-Is state.
- Inputs: deck/story/source models (target-state).
- Outputs: governed generation, review and export actions (target-state).
- Boundaries: current production presentation runtime remains outside this lane.
- Evidence: codemap note on unmounted `PrezentacjeView`.
- Risk: scope drift into outputs ownership if boundaries are not explicit.

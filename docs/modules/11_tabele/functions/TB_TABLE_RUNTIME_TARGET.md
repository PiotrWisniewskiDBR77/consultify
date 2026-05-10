---
module_id: MODULE_TABLES
function_id: TB_TABLE_RUNTIME_TARGET
function_name: Tables — Table Runtime Target
doc_kind: FUNCTION_CONTRACT
status: draft
owner: user
last_updated: 2026-05-10
---

# Function Contract — Table Runtime Target

## 1. Function Identity
- Function ID: `TB_TABLE_RUNTIME_TARGET`
- Intended runtime anchor: `ExceleView`/Table Studio workspace
- Current mounted status: `partial` (imported but not mounted on launch route)

## 2-12. Contract Summary
- Purpose: preserve target table runtime contract while staying honest about As-Is gap.
- Inputs: table schemas, rows/cells, formulas, source datasets (target-state).
- Outputs: governed table editing/review/export actions (target-state).
- Boundaries: no claim of active mounted workspace today.
- Evidence: codemap note for unmounted `ExceleView`.
- Risk: target-state expectations confused with current runtime.

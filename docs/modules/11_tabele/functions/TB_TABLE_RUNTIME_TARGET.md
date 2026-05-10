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

## 2. User Job and Business Outcome
- Purpose: preserve target table runtime contract while staying honest about As-Is gap.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: table schemas, rows/cells, formulas, source datasets (target-state).

## 6. Outputs and Side Effects
- Outputs: governed table editing/review/export actions (target-state).

## 7. Ownership and Handoff Boundaries
- Boundaries: no claim of active mounted workspace today.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence
- Evidence: codemap note for unmounted `ExceleView`.

## 12. Open Risks and Change Log
- Risk: target-state expectations confused with current runtime.

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

## 2. User Job and Business Outcome
- Purpose: run financial analyses and produce governed insight artifacts.
- Governance: no hidden finalization path.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI: analysis lane and preview controls in `FinanceHub`.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: analysis records, ratios, source financial context.

## 6. Outputs and Side Effects
- Outputs: explicit run/approve/handoff actions.

## 7. Ownership and Handoff Boundaries
- Ownership and handoff boundaries remain explicit and do not bypass canonical owner modules.

## 8. Runtime States and UX Behavior
- Risk: analysis quality confidence may be overestimated in degraded mode.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence
- Evidence: `FinanceHub.tsx` analysis tab; finance API contracts.

## 12. Open Risks and Change Log
- Risk: analysis quality confidence may be overestimated in degraded mode.

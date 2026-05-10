---
module_id: MODULE_FINANCE
function_id: FN_STATEMENTS_WORKSPACE
function_name: Finance — Statements Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Statements Workspace

## 1. Function Identity
- Function ID: `FN_STATEMENTS_WORKSPACE`
- Runtime anchor: `FinanceHub` tab `statements`
- Route scope: `/economics`, `/finance`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: manage statement packs, ingestion readiness and statement-derived actions.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI: `FinanceHub` statements table/grid/preview + import flows.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: statement packs, extracted statement data, filters/search.

## 6. Outputs and Side Effects
- Outputs: explicit import/create/analyze actions.

## 7. Ownership and Handoff Boundaries
- Ownership and handoff boundaries remain explicit and do not bypass canonical owner modules.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence
- Evidence: `FinanceHub.tsx` statements tab.

## 12. Open Risks and Change Log
- Risk: wrong statement readiness interpretation can pollute downstream models.

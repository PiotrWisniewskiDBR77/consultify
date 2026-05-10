---
module_id: MODULE_FINANCE
function_id: FN_ANALYSIS_WORKSPACE
function_name: Finance — Analysis Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
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

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `08_finanse` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `08_finanse` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `08_finanse` user flows.

## 12. Open Risks and Change Log
- Risk: analysis quality confidence may be overestimated in degraded mode.

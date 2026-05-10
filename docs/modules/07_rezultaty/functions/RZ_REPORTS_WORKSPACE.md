---
module_id: MODULE_RESULTS
function_id: RZ_REPORTS_WORKSPACE
function_name: Results — Reports Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Reports Workspace

## 1. Function Identity
- Function ID: `RZ_REPORTS_WORKSPACE`
- Runtime anchor: `ResultsHub` tab `results_reports`
- Route scope: `/benefits`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: review value-realization reporting outputs with source-backed context.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI: report workspace and tracked report modes in `ResultsHub`.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: results/KPI/ROI reporting datasets.

## 6. Outputs and Side Effects
- Outputs: explicit report refresh, navigation and export-related actions.

## 7. Ownership and Handoff Boundaries
- Ownership and handoff boundaries remain explicit and do not bypass canonical owner modules.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- Governance: high-impact reporting outcomes need review before approval.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `07_rezultaty` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `07_rezultaty` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `07_rezultaty` user flows.

## 12. Open Risks and Change Log
- Risk: report trust loss when evidence links are incomplete.

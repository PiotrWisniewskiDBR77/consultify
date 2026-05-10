---
module_id: MODULE_RESULTS
function_id: RZ_ROI_ANALYSIS
function_name: Results — ROI Analysis
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — ROI Analysis

## 1. Function Identity
- Function ID: `RZ_ROI_ANALYSIS`
- Runtime anchor: `ResultsHub` tab `roi_analysis`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: analyze portfolio-level ROI and variance patterns.
- Governance: no hidden mutation in analysis-only workflows.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI: ROI analysis workspace in results runtime.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: portfolio ROI summary and analytic signals.
- Risk: interpretation errors if degraded data not clearly exposed.

## 6. Outputs and Side Effects
- Outputs: explicit insight actions and guided follow-up decisions.

## 7. Ownership and Handoff Boundaries
- Ownership and handoff boundaries remain explicit and do not bypass canonical owner modules.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `07_rezultaty` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `07_rezultaty` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `07_rezultaty` user flows.

## 12. Open Risks and Change Log
- Risk: interpretation errors if degraded data not clearly exposed.

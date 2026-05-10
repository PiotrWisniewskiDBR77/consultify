---
module_id: MODULE_INITIATIVES
function_id: IN_PORTFOLIO_VIEW
function_name: Initiatives — Portfolio Route View
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Portfolio Route View

## 1. Function Identity
- Function ID: `IN_PORTFOLIO_VIEW`
- Route: `/portfolio`
- Runtime anchor: `PortfolioView`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: portfolio-level strategic prioritization surface.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: initiative portfolio datasets and value/status metadata.

## 6. Outputs and Side Effects
- Outputs: explicit move to initiative/action lanes.

## 7. Ownership and Handoff Boundaries
- Boundaries: view surface, not hidden write owner for other modules.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- Security/provenance: ACL/tenant-scoped portfolio context.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `05_inicjatywy` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `05_inicjatywy` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `05_inicjatywy` user flows.

## 12. Open Risks and Change Log
- Risk: overlap confusion with `/initiatives` entry if labels drift.

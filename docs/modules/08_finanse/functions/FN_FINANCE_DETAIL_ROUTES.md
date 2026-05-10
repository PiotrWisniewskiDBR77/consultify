---
module_id: MODULE_FINANCE
function_id: FN_FINANCE_DETAIL_ROUTES
function_name: Finance — Detail Route Surfaces
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Detail Route Surfaces

## 1. Function Identity
- Function ID: `FN_FINANCE_DETAIL_ROUTES`
- Routes: `/finance/statements/:id`, `/finance/models/:id`, `/finance/analyses/:id`
- Runtime anchor: `EconomicsView` -> `FinanceHub`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: deep-link into statement/model/analysis detail contexts.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: route id params and resolved finance entities.

## 6. Outputs and Side Effects
- Outputs: explicit open/edit/review actions within governed finance runtime.

## 7. Ownership and Handoff Boundaries
- Boundaries: detail routes are entry surfaces, not hidden mutation channels.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

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
- Risk: deep-link state mismatch if tab/selection sync regresses.

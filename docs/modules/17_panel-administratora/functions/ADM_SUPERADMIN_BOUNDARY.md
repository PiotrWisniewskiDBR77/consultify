---
module_id: MODULE_ADMIN_PANEL
function_id: ADM_SUPERADMIN_BOUNDARY
function_name: Admin Panel — SuperAdmin Boundary
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — SuperAdmin Boundary

## 1. Function Identity
- Function ID: `ADM_SUPERADMIN_BOUNDARY`
- Boundary routes: `/admin/*` vs `/superadmin/*`
- Feature state: `partial` (separate planes, ongoing boundary verification)

## 2. User Job and Business Outcome
- Purpose: enforce separation between tenant admin and platform superadmin planes.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: navigation and permission context.

## 6. Outputs and Side Effects
- Outputs: explicit route/role boundary, no privilege leakage.

## 7. Ownership and Handoff Boundaries
- Evidence: codemap and route ownership notes.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Risk: accidental role leakage across admin/superadmin paths.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `17_panel-administratora` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `17_panel-administratora` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `17_panel-administratora` user flows.

## 12. Open Risks and Change Log
- Risk: accidental role leakage across admin/superadmin paths.

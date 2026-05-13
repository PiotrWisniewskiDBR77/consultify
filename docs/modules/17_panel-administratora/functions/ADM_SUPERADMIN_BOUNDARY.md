---
module_id: MODULE_ADMIN_PANEL
function_id: ADM_SUPERADMIN_BOUNDARY
function_name: Admin Panel — SuperAdmin Boundary
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — SuperAdmin Boundary

## 1. Function Identity
- Function ID: `ADM_SUPERADMIN_BOUNDARY`
- Boundary routes: `/admin/*` vs `/superadmin/*`
- Feature state: `partial` (separate planes mounted, P0 permission drift unresolved)

## 2. User Job and Business Outcome
- Purpose: enforce separation between tenant admin and platform superadmin planes.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: navigation and permission context.
- Dependencies: `ProtectedRoute` role hierarchy, `AppRoutes` route mounts, cross-SOT ownership doctrine.

## 6. Outputs and Side Effects
- Outputs: explicit route/role boundary, no privilege leakage.
- Current output quality: route separation is explicit; privilege leakage risk remains open (`ADM-RAW-P0-001`).

## 7. Ownership and Handoff Boundaries
- Admin module (17): tenant admin ownership.
- Settings module (18): user preferences ownership.
- Superadmin plane: platform ownership and cross-tenant operations.
- Evidence: codemap, route mounts, cross-SOT ownership docs.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Risk: accidental role leakage across admin/superadmin paths due hierarchical guard semantics.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `17_panel-administratora` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `17_panel-administratora` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `17_panel-administratora` user flows.

Critical claims:

| Claim | Source | Decision | Evidence / Status |
| --- | --- | --- | --- |
| Admin and superadmin routes are mounted as separate roots | route tree | `KEEP` | `AppRoutes.tsx`, `routeConfig.ts` |
| Role boundary is fully enforced by runtime guards | security doctrine | `DEFER_TO_OWNER` | `NOT_DONE` because `ProtectedRoute` hierarchy allows `SUPERADMIN >= ADMIN` |
| Ownership split is explicit and non-overlapping | superadmin SSOT + P32 contracts | `ENHANCE` | normalized in module docs and packet |

## 12. Open Risks and Change Log
- Risk: accidental role leakage across admin/superadmin paths.
- Change: P0 drift now tracked explicitly as `ADM-RAW-P0-001`.

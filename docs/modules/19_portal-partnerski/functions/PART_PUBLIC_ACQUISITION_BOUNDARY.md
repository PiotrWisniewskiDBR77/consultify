---
module_id: MODULE_PARTNER_PORTAL
function_id: PART_PUBLIC_ACQUISITION_BOUNDARY
function_name: Partner Portal — Public Acquisition Boundary
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Public Acquisition Boundary

## 1. Function Identity
- Function ID: `PART_PUBLIC_ACQUISITION_BOUNDARY`
- Boundary routes: protected `/partner/*` vs public `/become-partner*` and `/partner/pricing`
- Feature state: `partial` (boundary active, ongoing consistency checks)

## 2. User Job and Business Outcome
- Purpose: prevent leakage between public acquisition journey and protected portal runtime.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: route and auth context.
- Outputs: explicit separation of public vs protected states and data.
- Risk: accidental data leakage from protected portal into public surfaces.

## 6. Outputs and Side Effects
- Outputs and side effects are explicit user-driven actions; no hidden mutations are implied.

## 7. Ownership and Handoff Boundaries
- Evidence: codemap route ownership notes.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `19_portal-partnerski` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `19_portal-partnerski` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `19_portal-partnerski` user flows.

## 12. Open Risks and Change Log
- Risk: accidental data leakage from protected portal into public surfaces.

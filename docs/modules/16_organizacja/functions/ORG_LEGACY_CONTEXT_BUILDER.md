---
module_id: MODULE_ORGANIZATION
function_id: ORG_LEGACY_CONTEXT_BUILDER
function_name: Organization — Legacy Context Builder Surface
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Legacy Context Builder Surface

## 1. Function Identity
- Function ID: `ORG_LEGACY_CONTEXT_BUILDER`
- Route family: `/context/*`
- Runtime anchor: `ContextBuilderView`
- Feature state: `partial` (transitional/compatibility surface)

## 2. User Job and Business Outcome
- Purpose: maintain compatibility surface while canonical ownership is `/organization/*`.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: legacy context-builder navigation and context data.

## 6. Outputs and Side Effects
- Outputs: explicit transitions aligned to organization ownership.

## 7. Ownership and Handoff Boundaries
- Boundaries: no separate canonical ownership domain.
- Risk: ownership ambiguity if legacy copy/flows diverge.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `16_organizacja` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `16_organizacja` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `16_organizacja` user flows.

## 12. Open Risks and Change Log
- Risk: ownership ambiguity if legacy copy/flows diverge.

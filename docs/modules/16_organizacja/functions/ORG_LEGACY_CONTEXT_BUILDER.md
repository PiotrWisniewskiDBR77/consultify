---
module_id: MODULE_ORGANIZATION
function_id: ORG_LEGACY_CONTEXT_BUILDER
function_name: Organization — Legacy Context Builder Surface
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
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
- Evidence: `AppRoutes.tsx` context builder route mapping.

## 12. Open Risks and Change Log
- Risk: ownership ambiguity if legacy copy/flows diverge.

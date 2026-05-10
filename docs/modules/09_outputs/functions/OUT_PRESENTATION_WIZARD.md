---
module_id: MODULE_OUTPUTS
function_id: OUT_PRESENTATION_WIZARD
function_name: Outputs — Presentation Wizard
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Presentation Wizard

## 1. Function Identity
- Function ID: `OUT_PRESENTATION_WIZARD`
- Route: `/presentations/wizard`
- Runtime anchor: `PresentationWizard`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: guided presentation creation entry surface.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: wizard setup context and artifact source options.
- Risk: wizard outcomes can diverge from library metadata if sync breaks.

## 6. Outputs and Side Effects
- Outputs: explicit create flow leading to editable deck/runtime.

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

- Route evidence: module route/view scope for `09_outputs` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `09_outputs` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `09_outputs` user flows.

## 12. Open Risks and Change Log
- Risk: wizard outcomes can diverge from library metadata if sync breaks.

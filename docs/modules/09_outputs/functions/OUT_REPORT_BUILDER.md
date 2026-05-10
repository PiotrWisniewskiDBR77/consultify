---
module_id: MODULE_OUTPUTS
function_id: OUT_REPORT_BUILDER
function_name: Outputs — Report Builder Route
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Report Builder Route

## 1. Function Identity
- Function ID: `OUT_REPORT_BUILDER`
- Routes: `/reports/builder`, `/reports/builder/:reportId`
- Runtime anchor: `ReportBuilderView`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: create/edit report artifacts from outputs lane.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: report builder payloads and artifact context.

## 6. Outputs and Side Effects
- Outputs: explicit save/review/export actions with return to outputs library.
- Risk: builder/library handoff parity drift.

## 7. Ownership and Handoff Boundaries
- Boundaries: builder is specialized editor route under outputs ownership.

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
- Risk: builder/library handoff parity drift.

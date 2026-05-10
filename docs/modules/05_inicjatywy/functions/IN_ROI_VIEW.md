---
module_id: MODULE_INITIATIVES
function_id: IN_ROI_VIEW
function_name: Initiatives — ROI View
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — ROI View

## 1. Function Identity
- Function ID: `IN_ROI_VIEW`
- Route: `/roi`
- Runtime anchor: `FullROIView`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: inspect initiative value and ROI context in dedicated route.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: ROI/value datasets linked to initiatives.

## 6. Outputs and Side Effects
- Outputs: explicit handoff to decisions/portfolio/execution actions.

## 7. Ownership and Handoff Boundaries
- Boundaries: no silent financial canon ownership transfer.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- Security/provenance: source assumptions and ROI lineage must stay visible.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence
- Evidence: `AppRoutes.tsx`, `FullROIView.tsx`.

## 12. Open Risks and Change Log
- Risk: ROI interpretation without explicit assumption visibility.

---
module_id: MODULE_INITIATIVES
function_id: IN_PORTFOLIO_VIEW
function_name: Initiatives — Portfolio Route View
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
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
- Evidence: `AppRoutes.tsx`, `PortfolioView.tsx`.

## 12. Open Risks and Change Log
- Risk: overlap confusion with `/initiatives` entry if labels drift.

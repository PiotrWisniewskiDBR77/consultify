---
module_id: MODULE_INITIATIVES
function_id: IN_ROADMAP_VIEW
function_name: Initiatives — Roadmap View
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Roadmap View

## 1. Function Identity
- Function ID: `IN_ROADMAP_VIEW`
- Route: `/roadmap`
- Runtime anchor: `FullRoadmapView`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: view initiative sequencing and timeline dependencies.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI: route-level roadmap surface.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: initiative timelines and status data.

## 6. Outputs and Side Effects
- Outputs: explicit navigation/handoffs back to initiative execution lanes.

## 7. Ownership and Handoff Boundaries
- Boundaries: roadmap is a planning view, not silent mutation path.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- Security/provenance: tenant-scoped, source-linked timeline context.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence
- Evidence: `AppRoutes.tsx`, `FullRoadmapView.tsx`.

## 12. Open Risks and Change Log
- Risk: route-family consistency across `/initiatives` and `/roadmap`.

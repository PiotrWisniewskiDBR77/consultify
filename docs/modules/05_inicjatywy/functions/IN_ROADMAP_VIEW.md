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

## 2-12. Contract Summary
- Purpose: view initiative sequencing and timeline dependencies.
- UI: route-level roadmap surface.
- Inputs: initiative timelines and status data.
- Outputs: explicit navigation/handoffs back to initiative execution lanes.
- Boundaries: roadmap is a planning view, not silent mutation path.
- Security/provenance: tenant-scoped, source-linked timeline context.
- Evidence: `AppRoutes.tsx`, `FullRoadmapView.tsx`.
- Risk: route-family consistency across `/initiatives` and `/roadmap`.

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

## 2-12. Contract Summary
- Purpose: inspect initiative value and ROI context in dedicated route.
- Inputs: ROI/value datasets linked to initiatives.
- Outputs: explicit handoff to decisions/portfolio/execution actions.
- Boundaries: no silent financial canon ownership transfer.
- Security/provenance: source assumptions and ROI lineage must stay visible.
- Evidence: `AppRoutes.tsx`, `FullROIView.tsx`.
- Risk: ROI interpretation without explicit assumption visibility.

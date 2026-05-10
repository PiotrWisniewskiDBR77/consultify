---
module_id: MODULE_PARTNER_PORTAL
function_id: PART_PORTAL_WORKSPACE
function_name: Partner Portal — Protected Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Protected Portal Workspace

## 1. Function Identity
- Function ID: `PART_PORTAL_WORKSPACE`
- Route family: `/partner/*`
- Runtime anchor: `PartnerPortalViewNew`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: protected partner workflow, deliverables and status runtime.
- Inputs: partner account/workflow/deliverable states.
- Outputs: explicit partner submissions, status updates and approval-gated transitions.
- Evidence: partner protected route mapping in `AppRoutes.tsx`.
- Risk: protected-flow regressions can expose inconsistent access behavior.

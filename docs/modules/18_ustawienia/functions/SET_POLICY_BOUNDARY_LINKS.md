---
module_id: MODULE_SETTINGS
function_id: SET_POLICY_BOUNDARY_LINKS
function_name: Settings — Policy Boundary and Admin Links
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Policy Boundary and Admin Links

## 1. Function Identity
- Function ID: `SET_POLICY_BOUNDARY_LINKS`
- Boundary: user-editable settings vs admin/tenant-owned policy settings
- Feature state: `partial` (boundary active, needs per-section evidence)

## 2-12. Contract Summary
- Purpose: keep settings ownership clear and route users to admin-owned controls when needed.
- Inputs: policy lock and authorization state.
- Outputs: explicit lock/redirect/deeplink behavior instead of silent denial.
- Evidence: behavior/codemap ownership notes for settings vs admin.
- Risk: policy ambiguity leading to incorrect ownership assumptions.

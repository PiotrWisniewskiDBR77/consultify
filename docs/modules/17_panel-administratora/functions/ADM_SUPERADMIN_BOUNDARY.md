---
module_id: MODULE_ADMIN_PANEL
function_id: ADM_SUPERADMIN_BOUNDARY
function_name: Admin Panel — SuperAdmin Boundary
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — SuperAdmin Boundary

## 1. Function Identity
- Function ID: `ADM_SUPERADMIN_BOUNDARY`
- Boundary routes: `/admin/*` vs `/superadmin/*`
- Feature state: `partial` (separate planes, ongoing boundary verification)

## 2-12. Contract Summary
- Purpose: enforce separation between tenant admin and platform superadmin planes.
- Inputs: navigation and permission context.
- Outputs: explicit route/role boundary, no privilege leakage.
- Evidence: codemap and route ownership notes.
- Risk: accidental role leakage across admin/superadmin paths.

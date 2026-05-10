---
module_id: MODULE_ADMIN_PANEL
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Status — Panel Administratora

## Shipping Status (As-Is)

- Runtime class: `real + security_critical`
- Launch path is wired in sidebar + route config, then rendered through `AppRoutes`.
- Current ownership decision: Admin ownership is `/admin/*` tenant control plane; `/superadmin/*` is separate plane and not this module.

## Current Risks

- Route exists, but behavior can diverge if imports are present and not mounted.
- Documentation must track mounted runtime, not planned/RAW target-state behavior.

## Next Contract Work (without changing scope)

- Keep CODEMAP/BEHAVIOR/UI_UX/TESTS aligned with mounted route/component truth.
- Reclassify status only when `AppRoutes` mounts real runtime behavior on launch route.

## Function Coverage Status

- Required functions documented: `2/2`.
- Covered: `ADM_ADMIN_WORKSPACE`, `ADM_SUPERADMIN_BOUNDARY`.

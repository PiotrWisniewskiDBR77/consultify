---
module_id: MODULE_PARTNER_PORTAL
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Status — Portal Partnerski

## Shipping Status (As-Is)

- Runtime class: `real + partial`
- Launch path is wired in sidebar + route config, then rendered through `AppRoutes`.
- Current ownership decision: Canonical portal ownership is protected `/partner/*`; public partner acquisition routes remain related but not portal-internal ownership.

## Current Risks

- Route exists, but behavior can diverge if imports are present and not mounted.
- Documentation must track mounted runtime, not planned/RAW target-state behavior.

## Next Contract Work (without changing scope)

- Keep CODEMAP/BEHAVIOR/UI_UX/TESTS aligned with mounted route/component truth.
- Reclassify status only when `AppRoutes` mounts real runtime behavior on launch route.

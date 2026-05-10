---
module_id: MODULE_INTERVIEW
doc_kind: META
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# META — Wywiad / Interview

## Identity

- Module id: `MODULE_INTERVIEW`
- Sidebar label: `Wywiad`
- Folder: `03_wywiad`
- Route: `/discovery`
- AppView: `AppView.DISCOVERY_CONSULTANT`
- Owner: user

## Canonical Routes (As-Is)

- `/interview`
- `/discovery` (legacy alias still active)
- `/project-intelligence` (additional alias path to interview runtime)

## Function Inventory (Canonical For This Module)

- `WY_MY_ASSIGNMENTS`
- `WY_MANAGED_ASSIGNMENTS`
- `WY_SESSIONS`
- `WY_TEMPLATES`
- `WY_INSIGHTS`
- `WY_PENDING_REVIEW`

## Canonicality

This folder is the author-level module contract. Other product, engineering and implementation docs can provide detail, but they must not contradict this contract without an explicit contract update.

## Source Package

- `DRD/consultify/docs/modules/DISCOVERY_CONSULTANT_MODULE.md`
- `DRD/consultify/docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- `DRD/consultify/docs/product/INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md`
- `DRD/consultify/docs/product/INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`

## Open Questions

1. Does the active code route still match the contract route above?
2. Are there tenant-specific variants that require a separate permission matrix?
3. Which acceptance evidence should be attached first when this module is next tested?

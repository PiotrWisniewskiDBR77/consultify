---
module_id: MODULE_ORGANIZATION
doc_kind: META
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# META — Organizacja / Organization Context

## Identity

- Module id: `MODULE_ORGANIZATION`
- Sidebar label: `Organizacja`
- Folder: `16_organizacja`
- Route: `/organization/*`
- AppView: `AppView.ORGANIZATION_PROFILE`
- Owner: user

## Canonicality

This folder is the author-level module contract. Other product, engineering and implementation docs can provide detail, but they must not contradict this contract without an explicit contract update.

## Source Package

- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_30_ORGANIZATION_2026-03-29.md`
- `DRD/consultify/docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_ORGANIZATION.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ORGANIZATION_2026-03-29.md`
- `DRD/consultify/docs/product/modules/admin/ADMIN_ORGANIZATION_MODULE_ANALYSIS.md`
- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`

## Function Coverage

- Required functions documented: `2/2`.
- Function contracts are stored in `functions/`.

## Open Questions

1. Does the active code route still match the contract route above?
2. Are there tenant-specific variants that require a separate permission matrix?
3. Which acceptance evidence should be attached first when this module is next tested?

---
module_id: MODULE_ADMIN_PANEL
doc_kind: META
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# META — Panel Administratora

## Identity

- Module id: `MODULE_ADMIN_PANEL`
- Sidebar label: `Panel Administratora`
- Folder: `17_panel-administratora`
- Route: `/admin/*`
- AppView: `AppView.ADMIN_DASHBOARD`
- Owner: user

## Canonicality

This folder is the author-level module contract. Other product, engineering and implementation docs can provide detail, but they must not contradict this contract without an explicit contract update.

## Source Package

- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_2026-03-29.md`
- `DRD/consultify/docs/product/SUPERADMIN_V8_SSOT.md`
- `DRD/consultify/docs/product/VIRTUAL_WORKERS_SUPERADMIN_IMPLEMENTATION_PLAN_V8.md`

## Function Coverage

- Required functions documented: `2/2`.
- Function contracts are stored in `functions/`.

## Open Questions

1. Does the active code route still match the contract route above?
2. Are there tenant-specific variants that require a separate permission matrix?
3. Which acceptance evidence should be attached first when this module is next tested?

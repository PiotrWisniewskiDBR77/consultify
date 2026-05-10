---
module_id: MODULE_MEETING
doc_kind: META
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# META — Meeting

## Identity

- Module id: `MODULE_MEETING`
- Sidebar label: `Meeting`
- Folder: `13_meeting`
- Route: `/meeting`
- AppView: `AppView.MEETING`
- Owner: user

## Canonicality

This folder is the author-level module contract. Other product, engineering and implementation docs can provide detail, but they must not contradict this contract without an explicit contract update.

## Source Package

- `DRD/consultify/docs/product/MEETING_TOOL_V3.md`
- `DRD/consultify/docs/product/REQUIREMENTS_V3_SSOT.md`
- `DRD/consultify/docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
- `DRD/consultify/docs/product/V3_MODULE_VERIFICATION_MATRIX.md`

## Function Coverage

- Required functions documented: `2/2`.
- Function contracts are stored in `functions/`.

## Open Questions

1. Does the active code route still match the contract route above?
2. Are there tenant-specific variants that require a separate permission matrix?
3. Which acceptance evidence should be attached first when this module is next tested?

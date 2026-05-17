---
module_id: MODULE_MY_WORK
doc_kind: META
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# META — Moja Praca / My Work

## Identity

- Module id: `MODULE_MY_WORK`
- Sidebar label: `Moja Praca`
- Folder: `02_moja-praca`
- Route: `/my-work`
- AppView: `AppView.MY_WORK`
- Owner: user

## Canonical Routes (As-Is)

- `/my-work/*` (module shell route)
- tab-level paths include `home`, `ideas`, `notebook`, `inbox`, `calendar`, `tasks`, `decisions`, `manager`

## Function Inventory (Canonical For This Module)

- Core: `MW_HOME_RADAR`, `MW_IDEAS`, `MW_NOTEBOOK`, `MW_INBOX`, `MW_CALENDAR`, `MW_TASKS`, `MW_DECISIONS`, `MW_MANAGER`
- Ideas subfunctions: `MW_IDEAS_MINDMAP`, `MW_IDEAS_TABLE`, `MW_IDEAS_PROCESS_FLOW`, `MW_IDEAS_WHITEBOARD`

## Canonicality

This folder is the author-level module contract. Other product, engineering and implementation docs can provide detail, but they must not contradict this contract without an explicit contract update.

## Active Work Package (current cycle)

- Active packet: `RAW_TARGET_STATE_2_0_PACKET.md`
- Scope in active packet: `MW_HOME_RADAR` documentation hardening + roadmap prioritization
- Cycle state: `REVIEW` (rerun gate passed; owner acceptance pending)

## Source Package

- `DRD/consultify/docs/product/MYWORK_HOME_V1_SSOT.md`
- `DRD/consultify/docs/product/MYWORK_RADAR_V8_SSOT.md`
- `DRD/consultify/docs/product/MYWORK_RADAR_SIGNAL_PIPELINE_AND_RUNTIME_V8.md`
- `DRD/consultify/docs/product/MYWORK_RADAR_SOURCE_TRUST_AND_GOVERNANCE_V8.md`
- `DRD/consultify/docs/product/MY_WORK_INBOX_AND_SLA.md`
- `DRD/consultify/docs/product/NOTATKA_V8_SSOT.md`
- `DRD/consultify/docs/product/MYWORK_CALENDAR_V8_SSOT.md`
- `DRD/consultify/docs/UI_UX/108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md`

## Open Questions

1. Does the active code route still match the contract route above?
2. Are there tenant-specific variants that require a separate permission matrix?
3. Which acceptance evidence should be attached first when this module is next tested?

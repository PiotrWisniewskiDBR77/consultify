---
module_id: MODULE_MY_WORK
doc_kind: SSOT_MAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-18
---

# SSOT — Moja Praca / My Work

## Priority Order

1. This module contract: `00_META.md` through `07_ACCEPTANCE_AND_TESTS.md`.
2. Author raw input in `RAW_INPUT.md` and linked raw author files in `DRD/consultify/docs/UI_UX/` or `DRD/consultify/docs/RAW/`.
3. Real source documents listed below.
4. Routing and global governance: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`, `DRD/consultify/docs/product/DOCUMENTATION_REGISTRY.md`, `DRD/UI_UX_SOURCE_OF_TRUTH.md`, `DRD/consultify/docs/ui-standards/`.

## Locked Canon For Radar v1 (Nadrzedne Zrodlo Prawdy)

For `MW_HOME_RADAR`, the canonical source of truth is:

1. `functions/MW_HOME_RADAR.md` (locked functional contract for Radar v1 rebuild),
2. `04_UI_UX.md` (module-level UX consistency and placement rules),
3. `.cursor/rules/21-ai-actions-menu3-placement.mdc` and `.cursor/rules/ai-actions-menu3.mdc` (AI action placement governance),
4. `DRD/consultify/docs/product/UNIFIED_CONVERSATION_SURFACE_TERESA_SSOT.md` (Teresa chat surface doctrine).

Any legacy radar text that conflicts with the above is superseded for module delivery decisions.

## Primary Sources Migrated Into This Contract

- `DRD/consultify/docs/product/MYWORK_HOME_V1_SSOT.md`
- `DRD/consultify/docs/product/MYWORK_RADAR_V8_SSOT.md`
- `DRD/consultify/docs/product/MYWORK_RADAR_SIGNAL_PIPELINE_AND_RUNTIME_V8.md`
- `DRD/consultify/docs/product/MYWORK_RADAR_SOURCE_TRUST_AND_GOVERNANCE_V8.md`
- `DRD/consultify/docs/product/MY_WORK_INBOX_AND_SLA.md`
- `DRD/consultify/docs/product/NOTATKA_V8_SSOT.md`
- `DRD/consultify/docs/product/MYWORK_CALENDAR_V8_SSOT.md`
- `DRD/consultify/docs/UI_UX/108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md`

## Superseded Or Removed References

- This SSOT intentionally removes references to filenames that are not present in the repo at audit time.
- If an older plan references a missing file, use the nearest existing source above and record the gap in `CHANGELOG.md` before changing behavior.
- For Radar v1, any "triage-first dashboard hero" framing is superseded by the locked visual-radar + right-preview model in `functions/MW_HOME_RADAR.md`.

## Coverage Status

- Status: `canonical baseline`.
- Meaning: the module has a coherent author-level contract and a locked Radar v1 rebuild direction.
- Remaining work: implementation and evidence closure against Radar v1 acceptance gate and roadmap (`R0-R3`) defined in `functions/MW_HOME_RADAR.md`.

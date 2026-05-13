---
module_id: MODULE_DOCUMENTS
doc_kind: SSOT_MAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# SSOT — Dokumenty / Document Studio

## Priority Order

1. This module contract: `00_META.md` through `07_ACCEPTANCE_AND_TESTS.md`.
2. Author raw input in `RAW_INPUT.md` and linked raw author files in `DRD/consultify/docs/UI_UX/` or `DRD/consultify/docs/RAW/`.
3. Real source documents listed below.
4. Routing and global governance: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`, `DRD/consultify/docs/product/DOCUMENTATION_REGISTRY.md`, `DRD/UI_UX_SOURCE_OF_TRUTH.md`, `DRD/consultify/docs/ui-standards/`.

## Primary Sources Migrated Into This Contract

- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `DRD/consultify/docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_DOCUMENTS.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md`
- `DRD/consultify/docs/UI_UX/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md`
- `DRD/consultify/docs/UI_UX/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`

## Active Audit Packets

- `DRD/consultify/docs/modules/10_dokumenty/DEEP_GAP_AUDIT_CODE_VS_DOCS_2026-05-11.md`
- `DRD/consultify/docs/modules/10_dokumenty/DEEP_RAW_GAP_AUDIT_2026-05-11.md`
- `DRD/consultify/docs/modules/10_dokumenty/STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`

## Superseded Or Removed References

- This SSOT intentionally removes references to filenames that are not present in the repo at audit time.
- If an older plan references a missing file, use the nearest existing source above and record the gap in `CHANGELOG.md` before changing behavior.

## Coverage Status

- Status: `canonical baseline`.
- Meaning: the module now has a coherent author-level contract based on verified repo sources and raw author inputs.
- Stage 1.5 result: docs are `APPROVED_FOR_DOCS`; runtime remains `BLOCKED_P1`; module integration requires `NEEDS_OWNER_DECISION` for `/wordy` mount/copy/handoff strategy.
- Remaining work: deepen each requirement by reading every linked source line-by-line during implementation sprints and by closing mounted-runtime evidence after owner decision.

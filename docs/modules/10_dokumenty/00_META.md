---
module_id: MODULE_DOCUMENTS
doc_kind: META
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# META — Dokumenty / Document Studio

## Identity

- Module id: `MODULE_DOCUMENTS`
- Sidebar label: `Dokumenty`
- Folder: `10_dokumenty`
- Route: `/wordy`
- AppView: `AppView.WORDY`
- Owner: user

## Canonicality

This folder is the author-level module contract. Other product, engineering and implementation docs can provide detail, but they must not contradict this contract without an explicit contract update.

## Source Package

- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `DRD/consultify/docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_DOCUMENTS.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md`
- `DRD/consultify/docs/UI_UX/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md`
- `DRD/consultify/docs/UI_UX/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`
- `DRD/consultify/docs/modules/10_dokumenty/DEEP_GAP_AUDIT_CODE_VS_DOCS_2026-05-11.md`
- `DRD/consultify/docs/modules/10_dokumenty/DEEP_RAW_GAP_AUDIT_2026-05-11.md`
- `DRD/consultify/docs/modules/10_dokumenty/STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`

## Function Coverage

- Required functions documented: `2/2`.
- Function contracts are stored in `functions/`.

## Open Questions

1. Does the active code route still match the contract route above?
2. Are there tenant-specific variants that require a separate permission matrix?
3. Owner decision: should `/wordy` keep placeholder mount or switch to `WordyView` while chat/template handoffs already target `/wordy`?
4. Owner decision: should upstream Teresa/template copy be softened if placeholder remains mounted?

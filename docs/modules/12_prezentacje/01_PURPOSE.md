---
module_id: MODULE_PRESENTATIONS
doc_kind: PURPOSE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Purpose — Prezentacje / Presentation Studio

## Purpose

Presentation Studio tworzy Gamma-class enterprise decks jako żywe artefakty: story, slides, sources, versions, approvals and PPTX/PDF export.

## Must

- MUST solve the job described above for the user-visible module, not only expose implementation internals.
- MUST keep its ownership boundary clear against adjacent modules.
- MUST preserve traceability from source input to output, decision, task or report when work leaves the module.

## Must Not

- Simple PowerPoint clone.
- One-shot slide generator without governance.

## Should

- SHOULD expose the next useful action rather than forcing users to infer workflow state.
- SHOULD reuse global UI, security and evidence standards instead of inventing module-local variants.

## Acceptance Criteria

- [ ] A new contributor can explain why this module exists from this file alone.
- [ ] The purpose does not conflict with any out-of-scope boundary in `02_SCOPE.md`.
- [ ] Primary source docs listed in `SSOT.md` are linked and readable.

## Related Sources

- `DRD/consultify/docs/product/PREZENTACJE_V8_SSOT.md`
- `DRD/consultify/docs/product/PREZENTACJE_V8_CANONICAL_DECK_MODEL.md`
- `DRD/consultify/docs/product/PREZENTACJE_V8_AI_GOVERNANCE.md`
- `DRD/consultify/docs/product/PRESENTATION_GENERATOR_V3.md`
- `DRD/consultify/docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- `DRD/consultify/docs/product/REPORTS_AND_PRESENTATIONS_V8_MASTER_SUMMARY.md`
- `DRD/consultify/docs/UI_UX/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`

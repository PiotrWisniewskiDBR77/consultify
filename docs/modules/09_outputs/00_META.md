---
module_id: MODULE_OUTPUTS
doc_kind: META
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# META — Outputs Library

## Identity

- Module id: `MODULE_OUTPUTS`
- Sidebar label: `Outputs`
- Folder: `09_outputs`
- Route: `/presentations`
- Canonical shell AppView: `AppView.PRESENTATIONS`
- Builder AppView: `AppView.FULL_STEP6_REPORTS` -> `/reports/builder`
- Owner: user

## Canonicality

This folder is the author-level module contract. Other product, engineering and implementation docs can provide detail, but they must not contradict this contract without an explicit contract update.

## Source Package

- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `DRD/consultify/docs/product/REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md`
- `DRD/consultify/docs/product/REPORTING_CANONICAL_TEMPLATES.md`
- `DRD/consultify/docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`

## Function Coverage

- Required functions documented: `6/6`.
- Function contracts are stored in `functions/`.

## Open Questions

1. Should `AppView.FULL_STEP6_REPORTS` remain a direct builder entry, or should future navigation force users through the canonical `/presentations` shell first?
2. Are there tenant-specific variants that require a separate permission matrix?
3. Which acceptance evidence should be attached first when this module is next tested?

## Stage 1.5 Note

- `STAGE_1_5_ULTRA_DEEP_INTEGRATION_AUDIT_2026-05-11.md` confirms the canonical module shell is `/presentations` / `AppView.PRESENTATIONS`.
- `AppView.FULL_STEP6_REPORTS` is retained as builder entry evidence, not as the canonical library shell.

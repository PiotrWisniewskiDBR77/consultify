---
module_id: MODULE_OUTPUTS
doc_kind: PURPOSE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Purpose — Outputs Library

## Purpose

Kanoniczna biblioteka artefaktów wyjściowych: reports, presentations, documents, sheets/templates and review-ready packages. Chat creates; Outputs stores and governs.

## Must

- MUST solve the job described above for the user-visible module, not only expose implementation internals.
- MUST keep its ownership boundary clear against adjacent modules.
- MUST preserve traceability from source input to output, decision, task or report when work leaves the module.

## Must Not

- Replacing format-specific editors/runtimes.
- Storing private work copies without governance state.

## Should

- SHOULD expose the next useful action rather than forcing users to infer workflow state.
- SHOULD reuse global UI, security and evidence standards instead of inventing module-local variants.

## Acceptance Criteria

- [ ] A new contributor can explain why this module exists from this file alone.
- [ ] The purpose does not conflict with any out-of-scope boundary in `02_SCOPE.md`.
- [ ] Primary source docs listed in `SSOT.md` are linked and readable.

## Related Sources

- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `DRD/consultify/docs/product/REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md`
- `DRD/consultify/docs/product/REPORTING_CANONICAL_TEMPLATES.md`
- `DRD/consultify/docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`

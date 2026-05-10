---
module_id: MODULE_OUTPUTS
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — Outputs Library

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Artifact, artifact version, source pack, review state, export, template and visibility scope.

## Function Data Responsibility Map

- `OUT_LIBRARY_HUB`: artifact registry views, filter state, governance metadata.
- `OUT_REPORT_BUILDER`: report build/edit data and handoff back to library.
- `OUT_PRESENTATION_WIZARD` and `OUT_DECK_BUILDER`: presentation creation/edit payloads and lifecycle.
- `OUT_SHARED_PRESENTATION`: share/embed-safe output payloads.
- `OUT_LEGACY_REPORT_REDIRECT`: migration route mapping into canonical outputs tabs.

## Must

- MUST keep stable identifiers for durable objects.
- MUST preserve source/provenance when objects are generated, imported, exported or converted.
- MUST record integration calls and important transformations with enough metadata for audit.

## Must Not

- MUST NOT duplicate another module's canonical object as an independent source of truth.
- MUST NOT expose raw sensitive payloads where summaries/source links are sufficient.

## Should

- SHOULD prefer links and ownership references over copied data.
- SHOULD make stale or partial data visible to the UI layer.

## Acceptance Criteria

- [ ] Every durable object has owner module, source/provenance and lifecycle state where applicable.
- [ ] Cross-module handoff preserves lineage.
- [ ] Integration failures do not corrupt local canonical state.

## Related Sources

- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `DRD/consultify/docs/product/REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md`
- `DRD/consultify/docs/product/REPORTING_CANONICAL_TEMPLATES.md`
- `DRD/consultify/docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`

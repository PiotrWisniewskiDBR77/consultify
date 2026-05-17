---
module_id: MODULE_DOCUMENTS
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — Dokumenty / Document Studio

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Document artifact, document schema, section, paragraph/table, citation, template, version, QA verdict and export record.

## Function Data Responsibility Map

- `DOC_WORDY_PLACEHOLDER`: route-level placeholder state only; no document artifact mutation runtime.
- `DOC_STUDIO_RUNTIME_TARGET`: target-state document artifacts, sections, citations, QA and exports (contract intent).

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
- `DRD/consultify/docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_DOCUMENTS.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md`
- `DRD/consultify/docs/UI_UX/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md`
- `DRD/consultify/docs/UI_UX/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`

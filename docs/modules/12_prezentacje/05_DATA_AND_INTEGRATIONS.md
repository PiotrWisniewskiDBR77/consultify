---
module_id: MODULE_PRESENTATIONS
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — Prezentacje / Presentation Studio

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Deck artifact, slide, layout, asset, source link, theme/template, version, QA verdict and export.

## Function Data Responsibility Map

- `PR_GEN_PLACEHOLDER`: route-level placeholder state only, no active deck mutation runtime.
- `PR_GEN_RUNTIME_TARGET`: target-state generator deck/story/source operations.
- `PR_OUTPUTS_OWNERSHIP_BOUNDARY`: cross-module ownership mapping between standalone lane and outputs runtime.

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

- `DRD/consultify/docs/product/PREZENTACJE_V8_SSOT.md`
- `DRD/consultify/docs/product/PREZENTACJE_V8_CANONICAL_DECK_MODEL.md`
- `DRD/consultify/docs/product/PREZENTACJE_V8_AI_GOVERNANCE.md`
- `DRD/consultify/docs/product/PRESENTATION_GENERATOR_V3.md`
- `DRD/consultify/docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- `DRD/consultify/docs/product/REPORTS_AND_PRESENTATIONS_V8_MASTER_SUMMARY.md`
- `DRD/consultify/docs/UI_UX/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`

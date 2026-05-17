---
module_id: MODULE_MEETING
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — Meeting

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Meeting, participant, agenda item, note, decision, task, follow-up and source/evidence link.

## Function Data Responsibility Map

- `ME_MEETING_PLACEHOLDER`: route-level placeholder state; no active meeting artifact mutation runtime.
- `ME_MEETING_RUNTIME_TARGET`: target-state meeting agenda/notes/decisions/follow-up workflows.

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

- `DRD/consultify/docs/product/MEETING_TOOL_V3.md`
- `DRD/consultify/docs/product/REQUIREMENTS_V3_SSOT.md`
- `DRD/consultify/docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
- `DRD/consultify/docs/product/V3_MODULE_VERIFICATION_MATRIX.md`

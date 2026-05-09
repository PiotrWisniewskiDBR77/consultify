---
module_id: MODULE_INITIATIVES
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — Inicjatywy

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Initiative, source links, decisions, gates, roles, capabilities, risks, tasks and benefit links.

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

- `DRD/consultify/docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
- `DRD/consultify/docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
- `DRD/consultify/docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`
- `DRD/consultify/docs/product/GATE_DEFINITION_OF_DONE.md`
- `DRD/consultify/docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `DRD/consultify/docs/product/ROLES_MODEL.md`
- `DRD/consultify/docs/product/PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md`
- `DRD/consultify/docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`

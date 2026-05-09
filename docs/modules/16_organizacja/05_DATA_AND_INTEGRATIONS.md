---
module_id: MODULE_ORGANIZATION
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — Organizacja / Organization Context

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Organization source, package, chunk, embedding/retrieval index, citation and lineage record.

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

- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_30_ORGANIZATION_2026-03-29.md`
- `DRD/consultify/docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_ORGANIZATION.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ORGANIZATION_2026-03-29.md`
- `DRD/consultify/docs/product/modules/admin/ADMIN_ORGANIZATION_MODULE_ANALYSIS.md`
- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`

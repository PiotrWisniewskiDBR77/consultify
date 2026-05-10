---
module_id: MODULE_TOOLS
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — Narzędzia / Tools

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- ToolDefinition, ToolSession, ToolOutput, source links, assessment report links and handoff proposals.

## Function Data Responsibilities

| Function group | Primary data responsibility | Integration responsibility |
| --- | --- | --- |
| Discovery hub (`NZ_DISCOVERY_LIBRARY`, `NZ_DISCOVERY_SESSIONS`, `NZ_DISCOVERY_OUTPUTS`, `NZ_DISCOVERY_INITIATIVES`) | tool catalog, session projections, output projections, initiative handoff list | discovery APIs, initiatives/report/deck references, lifecycle helpers |
| Assessment lane (`NZ_ASSESSMENT_HUB`) | assessment records, assessment reports, assessment-derived initiatives | assessment APIs, session editor routing, report builder handoff |
| Strategic lane (`NZ_MEGATRENDS_WORKSPACE`) | megatrend analysis workspace state and derived insight references | strategic workspace integrations and downstream handoff paths |

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

- `DRD/consultify/docs/modules/DISCOVERY_TOOLS_MODULE.md`
- `DRD/consultify/docs/product/TOOLS_CATALOG_V3.md`
- `DRD/consultify/docs/product/TOOLS_V8_SSOT.md`
- `DRD/consultify/docs/product/OPERATING_MODEL_V3.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/ui-standards/03-modules/tools-library-detail-standard.md`
- `DRD/consultify/docs/product/INITIATIVE_GOVERNANCE_MODEL.md`

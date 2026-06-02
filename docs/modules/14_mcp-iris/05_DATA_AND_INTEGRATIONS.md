---
module_id: MODULE_MCP_IRIS
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — MCP IRIS

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Provider config, tool definition, tool call log, health status, mapped external objects.

## Function Data Responsibility Map

- `IRIS_PLACEHOLDER_SURFACE`: route-level placeholder state only; no active tool execution runtime.
- `IRIS_RUNTIME_TARGET`: target-state provider configuration, allowlisted calls and audit evidence.

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

- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`
- `DRD/consultify/docs/product/INTEGRATIONS_CONNECTOR_RUNBOOKS_ENTERPRISE_V3.md`

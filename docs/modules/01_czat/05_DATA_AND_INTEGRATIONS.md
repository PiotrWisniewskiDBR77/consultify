---
module_id: MODULE_CHAT
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — Czat / Teresa Chat Engine

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Conversation, message, attachment, source link, memory candidate, tool call, proposal, approval and artifact handoff are first-class records.
- Raw sensitive payloads MUST NOT be exposed in UI/logs; use citations, summaries and governed source links.
- Created artifacts MUST carry provenance back to conversation and source pack.

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

- `DRD/consultify/docs/product/CHAT_V8_SSOT.md`
- `DRD/consultify/docs/product/CHAT_V8_CONTROL_SURFACE_SPEC.md`
- `DRD/consultify/docs/product/CHAT_V8_AI_GOVERNANCE.md`
- `DRD/consultify/docs/product/CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `DRD/consultify/docs/product/CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`
- `DRD/consultify/docs/product/CHAT_AND_AGENT_FUNCTIONAL_COMPLETENESS_AUDIT_V8.md`
- `DRD/consultify/docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`

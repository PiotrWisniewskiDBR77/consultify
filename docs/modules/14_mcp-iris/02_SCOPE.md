---
module_id: MODULE_MCP_IRIS
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — MCP IRIS

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Org-level provider configuration.
- MCP transport, tool allowlist, health/test and audited calls.
- Read-first KPI/evidence/execution integration paths.
- Function set: `IRIS_PLACEHOLDER_SURFACE`, `IRIS_RUNTIME_TARGET`.

## Out Of Scope (Must Not)

- Raw database tunnel.
- Unbounded tool execution or hidden mutations.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.

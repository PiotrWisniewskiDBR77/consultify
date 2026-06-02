---
module_id: MODULE_MCP_MARKETPLACE
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — MCP Marketplace / DBR77

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Provider config, catalog search, asset fetch, recommendations and governed import.
- Tools and Presentations import paths.
- Function set: `MCPM_PLACEHOLDER_SURFACE`, `MCPM_RUNTIME_TARGET`.

## Out Of Scope (Must Not)

- Canonical storage for local Consultify objects.
- Hidden publish/order/license mutations.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.

---
module_id: MODULE_MCP_IRIS
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — MCP IRIS

## Route / AppView / Sidebar

- Sidebar label: `MCP IRIS`
- Route: `/mcp/iris`
- AppView: `AppView.MCP_IRIS`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Org-level provider configuration.
- MCP transport, tool allowlist, health/test and audited calls.
- Read-first KPI/evidence/execution integration paths.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.

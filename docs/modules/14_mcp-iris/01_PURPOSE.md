---
module_id: MODULE_MCP_IRIS
doc_kind: PURPOSE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Purpose — MCP IRIS

## Purpose

Zdefiniować po co istnieje MCP IRIS: zapewnić wewnętrzny, tenant-safe provider MCP jako “bridge” do systemów enterprise/ops, z kontrolą narzędzi i audytem.

## Must

- MUST: działać org-level (provider registry), z health check i testem połączenia.
- MUST: mieć allowlist narzędzi + polityki (read-only vs write) i deny-by-default.
- MUST: audytować wywołania MCP (kto/kiedy/jakie narzędzie) z redakcją wrażliwych payloadów.

## Must Not

- MUST NOT: obchodzić tenant/ACL boundaries.
- MUST NOT: pozwolić na “ukryte writes” przez MCP bez jawnej akcji/approval tam gdzie wymagane.

## Should

- TBD

## Acceptance Criteria

- [ ] Purpose jest spójny z `INTEGRATIONS_SYNC_MCP_PLAN_V3.md`.

## Related Sources

- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`


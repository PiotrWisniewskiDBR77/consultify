---
module_id: MODULE_MCP_MARKETPLACE
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — MCP Marketplace (DBR77)

## Purpose

Ustalić granice odpowiedzialności MCP Marketplace jako providera i katalogu assetów.

## In scope (Must)

- MUST: provider konfiguracja + health + allowlist tools (org-level).
- MUST: katalog/search + fetch asset + recommendations (read-only minimal P0).
- MUST: import assetów do Tools/Presentations z traceability.

## Out of scope (Must Not)

- MUST NOT: wykonywać mutacji bez jawnych uprawnień (publish/order/license).
- MUST NOT: udawać, że marketplace jest kanonicznym storage artefaktów Consultify (to tylko zewnętrzny provider).

## Should

- TBD

## Acceptance Criteria

- [ ] Zakres jest spójny z `INTEGRATIONS_SYNC_MCP_PLAN_V3.md`.

## Related Sources

- `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`


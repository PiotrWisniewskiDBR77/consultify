---
module_id: MODULE_MCP_IRIS
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — MCP IRIS

## Purpose

Ustalić granice odpowiedzialności MCP IRIS jako providera MCP: konfiguracja, governance i bezpieczne wywołania narzędzi.

## In scope (Must)

- MUST: org-level “MCP providers” i konfiguracja (URL, auth, namespace, tool allowlist).
- MUST: health / test connection / status.
- MUST: audyt wywołań i idempotencja tam gdzie outbound actions istnieją.

## Out of scope (Must Not)

- MUST NOT: przejąć roli klasycznych integracji sync engine (to osobna warstwa integracji).
- MUST NOT: expose raw tool payloads w UI/logach.

## Should

- TBD

## Acceptance Criteria

- [ ] Zakres jest spójny z `INTEGRATIONS_SYNC_MCP_PLAN_V3.md`.

## Related Sources

- `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`


---
module_id: MODULE_MCP_IRIS
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — MCP IRIS

## Purpose

Obiekty danych MCP providers: konfiguracja, mapping narzędzi, audit logs, health.

## Must

- MUST: provider ma `name/type/status/config` (URL, auth, namespace, allowlist tools).
- MUST: każdy tool call ma audit log (korelacja do user/tenant).

## Must Not

- MUST NOT: przechowywać tokenów w plain text ani eksponować ich w UI/logach.

## Should

- TBD

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`


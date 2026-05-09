---
module_id: MODULE_MCP_MARKETPLACE
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — MCP Marketplace (DBR77)

## Purpose

Obiekty danych: marketplace assets/collections, provider config, audit logs, mapping importów do artefaktów aplikacji.

## Must

- MUST: asset ma stabilne `id` i metadane (type, version, license, owner/publisher).
- MUST: import tworzy jawne mapowanie “asset → local object” (traceability).
- MUST: MCP audit logs istnieją dla wywołań narzędzi.

## Must Not

- MUST NOT: trzymać sekretów providera w plain text ani pokazywać ich w UI.

## Should

- TBD

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`


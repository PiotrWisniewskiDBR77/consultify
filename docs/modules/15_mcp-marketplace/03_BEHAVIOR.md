---
module_id: MODULE_MCP_MARKETPLACE
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — MCP Marketplace (DBR77)

## Purpose

Kontrakt zachowania MCP Marketplace: wyszukiwanie katalogu, pobieranie assetów, rekomendacje, import do produktu i (opcjonalnie) publish.

## Must

- MUST: implementować READ tools: search/get/recommendations z jawnością błędów i rate limits.
- MUST: import do Tools/Presentations zachowuje provenance (źródło/licencja) i nie tworzy “ghost assets”.
- MUST: jeśli narzędzia MUTATION są dostępne (publish/order/license), wymagają uprawnień + audytu + approval gdzie potrzebne.

## Must Not

- MUST NOT: wywoływać narzędzi spoza allowlist.
- MUST NOT: wykonywać ukrytych writes (publish) bez jawnej akcji i logu audytu.

## Should

- SHOULD: mieć “recommendations” zależne od kontekstu (np. initiative type) bez ujawniania prywatnych danych do providera ponad potrzebę.

## Acceptance Criteria

- [ ] Zawiera jawne reguły `proposal -> approval -> execution -> audit` tam, gdzie czat inicjuje działania.
- [ ] Definiuje “uczciwe” stany błędów i degradacji (bez fake success / infinite spinner).

## Related Sources

- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`


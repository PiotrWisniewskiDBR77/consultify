---
module_id: MODULE_MCP_MARKETPLACE
doc_kind: PURPOSE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Purpose — MCP Marketplace (DBR77)

## Purpose

Zdefiniować po co istnieje MCP Marketplace: dostarczać katalog gotowych zasobów (templates, playbooki, prompty, komponenty PMO) do użycia w aplikacji oraz kontrolowany publish zasobów przez DBR77.

## Must

- MUST: wspierać narzędzia READ: `marketplace.catalog.search`, `marketplace.asset.get`, `marketplace.recommendations.get`.
- MUST: wspierać ścieżki użycia: Tools (“Get template from Marketplace”), Presentations (“Assets/Visuals”), My Work (“Publish as template”).
- MUST: provenance/licensing jest jawne (źródło assetu, zakres użycia).

## Must Not

- MUST NOT: wprowadzać ukrytych mutacji przez marketplace (publish/licensing) bez audytu i uprawnień.

## Should

- TBD

## Acceptance Criteria

- [ ] Purpose jest spójny z `INTEGRATIONS_SYNC_MCP_PLAN_V3.md` (sekcja MCP‑Marketplace).

## Related Sources

- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`


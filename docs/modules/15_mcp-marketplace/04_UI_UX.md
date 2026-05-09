---
module_id: MODULE_MCP_MARKETPLACE
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — MCP Marketplace (DBR77)

## Purpose

UI/UX dla marketplace assetów: discovery/search, preview, import, i jawność licencji/proweniencji. MCP konfiguracja w Settings→MCP.

## Must

- MUST: user widzi provenance/licensing (źródło, zakres użycia, owner).
- MUST: UI jasno komunikuje “import” vs “use as-is” (brak silent execution).
- MUST: konfiguracja MCP providerów pokazuje status/health i allowlist narzędzi.
- MUST: AI actions (jeśli istnieją) w Menu 3.

## Must Not

- MUST NOT: ukrywać błędów providerów (degraded/down) ani maskować “not authorized”.

## Should

- TBD

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`


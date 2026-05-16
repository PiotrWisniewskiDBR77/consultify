---
module_id: MODULE_MCP_IRIS
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — MCP IRIS

## Purpose

UI/UX dla MCP IRIS: konfiguracja providerów, health status, allowlist narzędzi, oraz uczciwe stany błędów.

## Must

- MUST: jawnie pokazywać status providerów (healthy/degraded/down) i przyczynę.
- MUST: UI nie pokazuje wrażliwych tokenów ani raw payloadów z tool calls.
- MUST: kontekstowe akcje AI związane z MCP (jeśli są) są w Menu 3.

## Must Not

- MUST NOT: sugerować, że provider jest “aktywny”, jeśli health check failuje.

## Should

- TBD

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`


---
module_id: MODULE_EXECUTION
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Realizacja (Execution)

## Purpose

Zdefiniować UI/UX modułu `Realizacja` dla 3 powierzchni: `Portfolio`, `Raporty`, `Manager` zgodnie z globalnym standardem modułów (Menu 2 + jeden command row).

## Must

- MUST: topbar kolejność i zasady command row jak w `EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`.
- MUST: `Portfolio` używa kanonicznej tabeli + preview (single click preview).
- MUST: `Manager` używa command row do akcji AI i paneli pracy (nie tworzy dodatkowego toolbara).
- MUST: przy brakach danych (baseline/estimate/stale) UI pokazuje uczciwe degraded state.

## Must Not

- MUST NOT: wprowadzać drugiego command row / dodatkowych pasków pod Menu 3.
- MUST NOT: ukrywać braków danych za “ładnymi” wykresami (no fake precision).

## Should

- SHOULD: zachować spójne view modes: table/kanban/timeline w kolejności i stylu standardowym.

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`


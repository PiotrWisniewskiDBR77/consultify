---
module_id: MODULE_TABLES
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Tabele (Table Studio)

## Purpose

UI/UX kontrakt Table Studio lane: grid + right-rail narzędziowy, forms intake, share slot dla conversions i jawne stany QA/source/AI.

## Must

- MUST: narzędzia AI/QA/source pack/conversions są w prawym railu / Menu 3 (bez duplikacji toolbarów w canvase).
- MUST: UI pokazuje audyt/proweniencję (drawer) i stany cross-tenant denial w sposób “honest”.
- MUST: konwersje mają jawny progress + błędy (bez silent catch).

## Must Not

- MUST NOT: ukrywać, że surface jest za kill switchami (jeśli wyłączone, komunikat “disabled by policy”).

## Should

- SHOULD: “share” slot hostuje controls konwersji (zgodnie z closeout).

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md`


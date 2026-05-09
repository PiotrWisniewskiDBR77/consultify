---
module_id: MODULE_FINANCE
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Finanse

## Purpose

UI/UX kontrakt Finance: profesjonalny UI do statements+modeling+valuation, z jawnością statusów jakości (ready/invalid), i z AI control surface w Menu 3.

## Must

- MUST: AI actions są po prawej w Menu 3 (brak osobnego toolbaru).
- MUST: ingestion pipeline ma jawne kroki (Upload→Detect→Extract→Map→Validate→Confirm) i blokuje downstream dopóki `Statements` nie są `ready`.
- MUST: invalid model jest jawny i blokuje “export”/“decision-ready” artefakty.
- MUST: długie formy są sekcjonowane + autosave (ryzyko utraty).

## Must Not

- MUST NOT: pozwolić AI wygenerować liczby “z głowy” w UI.
- MUST NOT: ukrywać błędów bilansu/konwergencji.

## Should

- SHOULD: wspierać porównanie scenariuszy i rekomendację scenariusza (Economics).

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/product/FINANCIAL_ANALYSIS_V3.md`


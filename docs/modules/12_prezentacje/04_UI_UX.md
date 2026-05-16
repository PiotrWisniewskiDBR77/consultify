---
module_id: MODULE_PRESENTATIONS
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Prezentacje (Presentation Studio)

## Purpose

UI/UX kontrakt Presentation Studio: Gamma-like szybkość + piękno, ale z enterprise jawnością (source + QA + approvals). AI actions w Menu 3.

## Must

- MUST: brak “fake progress” (0/8 bez error) — błędy mają toast + console evidence (dla QA).
- MUST: “Open in builder” nie jest dead-click; pokazuje toast i nawigację same-tab do buildera.
- MUST: Outputs hub jest kanonicznym “domem” decków; lista ma szybkie filtry i view modes (table + grid cards).
- MUST: AI actions po prawej w Menu 3, bez duplikacji w canvase.

## Must Not

- MUST NOT: traktować “Gamma UI” jako kanoniczny layout; benchmark ≠ kopia.

## Should

- SHOULD: cover-cards i szybkie preview (Gamma-like) w bibliotece.
- SHOULD: jawne stany source coverage / missing inputs przed generacją (sprint 2+).

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md`


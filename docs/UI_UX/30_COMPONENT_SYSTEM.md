---
uiux_doc_id: UIUX_COMPONENT_SYSTEM
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Component system (law)

## Purpose

Zamknąć “component law”: każdy element UI musi należeć do nazwanej rodziny komponentu/patternu, a nie być jednorazowym wynalazkiem w ekranie.

## Applies To

Wszystkie ekrany i moduły.

## Must

- **MUST**: Przed implementacją UI:
  1) znaleźć zatwierdzony komponent/pattern,
  2) użyć go,
  3) jeśli “prawie pasuje” — rozszerzyć centralnie i opisać,
  4) jeśli nie pasuje — zdefiniować nowy standard zanim powstanie nowy UI.
- **MUST**: Sekcje współdzielone (np. N-mode) są importowane z katalogów shared; zakaz kopiowania inline.

## Must Not

- **MUST NOT**: One-off buttons/cards/badges/table controls/help strips per moduł.
- **MUST NOT**: Dokładać lokalnych toolbarów (szczególnie między Menu 3 a treścią).

## Related Sources

- `DRD/consultify/docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` (Component Law)
- `DRD/consultify/docs/ui-standards/shared-nmode-sections-standard.md`


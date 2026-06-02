---
uiux_doc_id: UIUX_MOBILE_RESPONSIVE
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Mobile & responsive layouts

## Purpose

Zamknąć zasady responsywności: jak UI degraduje się na mniejszych viewportach bez łamania kontraktu (bez dodatkowych toolbarów i bez utraty kluczowych akcji).

## Applies To

Wszystkie moduły; szczególnie hub/list (Menu 2/3) i executive modules (MELS).

## Must

- **MUST**: Na mniejszych viewportach kontrolki przechodzą do overflow (`…`) zamiast tworzyć drugi rząd toolbaru.
- **MUST**: Drawer’y/edge panels są preferowane dla raili (left/right) poniżej desktop breakpoint.
- **MUST**: Zachować dostęp do primary CTA i krytycznych akcji (nie giną w nieczytelnym menu).

## Must Not

- **MUST NOT**: Dodawać dodatkowych pasków “bo nie mieści się”.

## Related Sources

- `DRD/consultify/docs/product/MODULE_EXECUTIVE_LAYOUT_STANDARD.md` (responsive behavior MELS)
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`


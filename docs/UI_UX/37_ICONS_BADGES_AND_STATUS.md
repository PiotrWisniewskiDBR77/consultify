---
uiux_doc_id: UIUX_ICONS_BADGES_STATUS
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Icons / badges / status semantics

## Purpose

Ujednolicić semantykę ikon, badge’y (np. “soon”) oraz statusów, żeby kolor nie był dekoracją tylko sygnałem.

## Applies To

Sidebar, Menu 2/3, tabele, karty, N-mode, admin.

## Must

- **MUST**: Chrome jest monochromatyczne; kolor pojawia się głównie jako sygnał statusu (badge/dot/chip).
- **MUST**: `soon` jest jawne i nie udaje funkcji (badge + coming soon surface).
- **MUST**: Ikony są spójne (stroke-width, family); bez lokalnych wariantów per moduł.

## Must Not

- **MUST NOT**: Używać `primary` jako stałego koloru chrome lub danych (primary to CTA/active/focus).

## Related Sources

- `DRD/consultify/docs/ui-standards/00-foundation/color-system.md`
- `DRD/consultify/docs/ui-standards/00-foundation/visual-language.md`
- `DRD/consultify/docs/ui-standards/FROZEN_LAYOUTS.md` (badges/ordering)


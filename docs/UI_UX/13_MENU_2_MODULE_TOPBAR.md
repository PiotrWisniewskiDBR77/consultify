---
uiux_doc_id: UIUX_MENU_2_MODULE_TOPBAR
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Menu 2 — Module Topbar

## Purpose

Zamknąć kanon Module Topbar (Menu 2): struktura, kolejność kontrolek i zakazy, tak aby wszystkie moduły wyglądały i działały spójnie.

## Applies To

Wszystkie moduły “hub/list” i większość ekranów kolekcyjnych w aplikacji.

## Must

- **MUST**: Lewa strona Menu 2: search toggle → główne taby (bez liczników w tabach).
- **MUST**: Prawy klaster ma stałą kolejność wizualną (od prawej):
  1) **Area** (toggle panelu / split),
  2) **Primary CTA (Add)** (bez leading `+`),
  3) **Tool** (jeśli dotyczy),
  4) **View modes** (segmented icons),
  5) **Filters** (maks 1 główny dropdown; reszta w Menu 3 lub w tabeli).
- **MUST**: Kontrolki mają spójną wysokość (`h-9`), spójny family i spokojny styl (bez gradientów).

## Must Not

- **MUST NOT**: Umieszczać `Help` w prawym klastrze Menu 2.
- **MUST NOT**: Używać dropdownu `Table v` do przełączania Table/Grid — view modes są widoczne jako segmented controls.
- **MUST NOT**: Dublować filtrów i “mini-toolbarów” pod Menu 2.

## Acceptance Criteria

- [ ] Kolejność i zachowanie jest spójne z `FROZEN_LAYOUTS.md` i `module-hub-standard.md`.

## Related Sources

- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/ui-standards/FROZEN_LAYOUTS.md`
- `DRD/consultify/docs/ui-standards/03-modules/view-modes-standard.md`


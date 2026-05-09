---
uiux_doc_id: UIUX_FILTERS_SEARCH_SORT
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Filters / search / sort

## Purpose

Zamknąć zasady filtrowania, wyszukiwania i sortowania w hub/list screens tak, by UI było spójne i nie miało dublujących się kontrolek.

## Applies To

Menu 2/3, App Table, view modes.

## Must

- **MUST**: W Menu 2 utrzymujemy maksymalnie jeden główny dropdown filtrów; pozostałe presety/liczniki są w Menu 3 (chipy).
- **MUST**: Filtry mają domenowe etykiety (`Status: aktywne`, `Obszar: wszystkie`), nie generyczne `Wszystkie ...` bez kontekstu.
- **MUST**: Search w topbarze jest “toggle → expandable” (nie stale zajmuje miejsce, jeśli wzorzec tego wymaga).

## Must Not

- **MUST NOT**: Dokładać dodatkowych “mini toolbarów” pod Menu 2/3 dla sort/columns/views.

## Related Sources

- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md` (Menu 2/3)
- `DRD/consultify/docs/ui-standards/03-modules/app-table-standard.md` (filtry w headerze, brak duplikacji)


---
uiux_doc_id: UIUX_TABLES_LISTS
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

> ⚠️ **SUPERSEDED (2026-06-06) — SSOT to [`TABLE_AND_PREVIEW_CANON.md`](../ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md).** W razie konfliktu obowiązuje kanon.

# Tables & lists (App Table canon)

## Purpose

Zamknąć standard tabel/list operacyjnych w aplikacji (App Table) oraz ich integrację z Menu 2/3.

## Applies To

Każdy ekran z listą rekordów do skanowania/sortowania/filtrowania/otwierania.

## Must

- **MUST**: App Table jest kanonicznym widokiem dla rekordów operacyjnych (karty/grid to view mode wtórny).
- **MUST**: Brak duplikacji kontrolek:
  - view/filters w Menu 2,
  - presety/liczniki i akcje kontekstowe w Menu 3,
  - filtry w headerze tabeli (gdy dotyczy).
- **MUST**: Row actions: spójny kebab (⋮) i bounded liczba szybkich ikonek.
- **MUST**: Honest UI: brak fake success, jawne error/degraded.

## Related Sources

- `DRD/consultify/docs/ui-standards/03-modules/app-table-standard.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`


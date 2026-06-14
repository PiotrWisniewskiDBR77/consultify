---
uiux_doc_id: UIUX_GLOSSARY
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Glossary — UI/UX terms

## Purpose

Ujednolicić pojęcia używane w UI/UX, żeby dokumenty i implementacja mówiły jednym językiem.

## Applies To

Cała aplikacja + dokumentacja SSOT.

## Must

- **MUST**: `App Shell`: globalne chrome aplikacji (Sidebar + App Topbar + layout).
- **MUST**: `Module` / `Moduł`: pozycja w sidebarze i jej routowany obszar (np. Chat, My Work, Tools…).
- **MUST**: `Surface`: konkretny ekran/obszar w module (np. Tools Library, My Work > Inbox).
- **MUST**: `Menu 2` / `Module Topbar`: kontekstowy pasek modułu (taby, view modes, filtry, CTA).
- **MUST**: `Menu 3` / `Command Row`: jeden dynamiczny rząd pod Menu 2 (dynamic tabs / presety / bulk mode / AI actions).
- **MUST**: `N-mode`: detail/work canvas z lewą nawigacją sekcji i canvasem (standard 242px left nav).
- **MUST**: `Canvas`: główna powierzchnia pracy (dokument‑idiom, N-mode, lub executive authoring canvas).
- **MUST**: `Rail`: panel boczny (left rail / right rail) — nawigacyjny lub narzędziowy.
- **MUST**: `View mode`: sposób prezentacji tej samej kolekcji danych (table/grid/kanban/timeline/calendar/matrix).
- **MUST**: `Preview pane`: prawy panel podglądu rekordu dla tabel (Outlook style).
- **MUST**: `Executive modules / MELS`: Wordy/Tabele/Prezentacje — autorstwo artefaktów w układzie MELS (top bar + left rail + canvas + right rail).
- **MUST**: `Degraded`: UI jawnie sygnalizuje ograniczoną sprawność (provider/down, partial data), zamiast udawać “OK”.

## Should

- **SHOULD**: Używać spójnych nazw: `Menu 2`, `Menu 3`, `Command Row`, `N-mode` — bez lokalnych synonimów per moduł.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/ui-standards/01-shell-layout/app-topbar-standard-v3.md`
- `DRD/consultify/docs/ui-standards/01-shell-layout/shared-nmode-sections-standard.md`
- `DRD/consultify/docs/product/MODULE_EXECUTIVE_LAYOUT_STANDARD.md`


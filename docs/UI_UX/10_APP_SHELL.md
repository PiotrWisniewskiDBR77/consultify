---
uiux_doc_id: UIUX_APP_SHELL
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# App shell — global layout

## Purpose

Zdefiniować kanoniczny “shell” aplikacji: co jest globalne i stałe, a co jest kontekstowe per moduł.

## Applies To

Wszystkie moduły w głównej aplikacji (z wyłączeniem powierzchni, które mają własny shell: np. SuperAdmin, executive MELS).

## Must

- **MUST**: Istnieją dwa topbary i nie wolno ich mieszać:
  - **App Topbar (global)** — stały chrome (system/data/model/inbox/tasks/user).
  - **Module Topbar / Menu 2 (kontekstowy)** — tabs, view modes, filters, CTA, AI context.
- **MUST**: Pod Menu 2 jest **dokładnie jeden** `Menu 3 / Command Row`. Nie ma kolejnych pasków toolbarów między topbarem a treścią.
- **MUST**: Breadcrumbs są w globalnym headerze; nie dublujemy ich nad tabelą/canvasem.
- **MUST**: “Help” nie jest w prawym klastrze Menu 2 (należy do globalnego shellu).

## Must Not

- **MUST NOT**: Dodawać lokalnych toolbarów pod Menu 3 (drugi/trzeci rząd).
- **MUST NOT**: Tworzyć per-modułowych “wariantów shella” bez aktualizacji standardu.

## Acceptance Criteria

- [ ] Shell jest zgodny z `FROZEN_LAYOUTS.md` i standardami `app-topbar` + `module-hub`.

## Related Sources

- `DRD/consultify/docs/ui-standards/01-shell-layout/app-topbar-standard-v3.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/ui-standards/FROZEN_LAYOUTS.md`


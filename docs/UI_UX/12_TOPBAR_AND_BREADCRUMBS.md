---
uiux_doc_id: UIUX_TOPBAR_BREADCRUMBS
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Topbar & breadcrumbs

## Purpose

Ujednolicić zasady globalnego topbara i breadcrumbs, żeby nie duplikować nagłówków i nie robić “drugiego topbara” w treści.

## Applies To

Główny shell aplikacji oraz wszystkie moduły, które korzystają z `MainLayout`.

## Must

- **MUST**: Breadcrumbs są w App Topbar (global), format: `Module > Surface/Tool`.
- **MUST**: App Topbar ma stałą kolejność elementów (Data/Model/Inbox/Tasks/User) i nie zawiera lokalnych akcji modułu.
- **MUST**: Module actions (CTA/filters/view) są w Module Topbar (Menu 2), nie w App Topbar.

## Must Not

- **MUST NOT**: Dublować breadcrumbs/dużych tytułów w content area nad tabelą.
- **MUST NOT**: Dodawać “Help” do prawego klastra Menu 2.

## Related Sources

- `DRD/consultify/docs/ui-standards/01-shell-layout/app-topbar-standard-v3.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/ui-standards/03-modules/app-table-standard.md`


---
module_id: MODULE_ADMIN_PANEL
doc_kind: META
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# META — Panel Administratora (Admin + SuperAdmin)

## Purpose

Ten plik definiuje metadane kontraktu modułu `Panel Administratora` i jego miejsce w systemie.

## Identity

- **Sidebar label**: Panel administratora
- **Folder**: `17_panel-administratora`
- **Module id**: `MODULE_ADMIN_PANEL`

## Canonicality

- **Contract status**: draft (w trakcie migracji z istniejących SoT)
- **Primary SSOT map**: `SSOT.md`

## Open questions (max 3)

1. Czy `NAVIGATION_STRUCTURE.md` (Admin/SuperAdmin) ma zostać odtworzone jako SoT, czy usuwamy referencję z `MODULE_ROUTING_ARCHITECTURE.md`?
2. Czy “Panel Administratora” w sidebar ma eksponować oba entrypointy (`/admin`, `/superadmin`) czy tylko Admin, a SuperAdmin jest “hidden route”?
3. Jakie są kanoniczne wymagania audytu dla zmian adminowych: event schema + retention + export (doc vs implementacja)?


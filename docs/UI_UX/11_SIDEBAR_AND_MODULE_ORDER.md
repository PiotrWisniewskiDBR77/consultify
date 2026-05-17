---
uiux_doc_id: UIUX_SIDEBAR_MODULE_ORDER
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Sidebar & module order (frozen)

## Purpose

Zamknąć kolejność modułów w sidebarze i reguły widoczności (role/env gates) jako “frozen layout”.

## Applies To

Sidebar główny aplikacji.

## Must

- **MUST**: Kolejność sidebar jest “frozen” i nie zmienia się bez świadomej decyzji (PO/CTO) oraz aktualizacji źródeł prawdy.
- **MUST**: Sidebar order jest zgodny z `src/components/navigation/Sidebar/menuConfig.ts` oraz katalogiem `DRD/consultify/docs/modules/` (numery 01–19).
- **MUST**: `Tabele Studio` nie jest osobnym modułem produktowym, jeśli dubluje `Tabele` (jeden kontrakt).
- **MUST**: Internal tools (AI OS) są narzędziami wewnętrznymi, gate’owane env + allowlist; nie są “customer module”.

## Must Not

- **MUST NOT**: Wstawiać nowych pozycji “pomiędzy” istniejącymi bez aktualizacji frozen canon.
- **MUST NOT**: Reklamować internal tools w produkcji (nawigacja ukryta + API 404, zgodnie z planem).

## Acceptance Criteria

- [ ] Sidebar order jest spójny z `FROZEN_LAYOUTS.md`.
- [ ] Zmiany sidebar są odnotowane w decyzjach UI/UX (decision log) i w docs/modules.

## Related Sources

- `DRD/consultify/src/components/navigation/Sidebar/menuConfig.ts` (as-is)
- `DRD/consultify/docs/ui-standards/FROZEN_LAYOUTS.md`
- `DRD/consultify/docs/modules/README.md` (lista 01–19)
- `DRD/INTERNAL_TOOLS_ACCESS_AND_NAV_PLAN.md`


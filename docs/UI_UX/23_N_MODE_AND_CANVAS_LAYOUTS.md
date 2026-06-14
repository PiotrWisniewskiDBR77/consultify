---
uiux_doc_id: UIUX_NMODE_AND_CANVAS
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# N-mode & canvas layouts

## Purpose

Zamknąć zasady layoutu detail/work canvasa (N-mode) oraz kiedy dozwolony jest “Canvas Mode” jako design extension.

## Applies To

Detail views artefaktów (task/decision/initiative/notification/…), N-mode sekcje, oraz wybrane “experience surfaces”.

## Must

- **MUST**: Lewa nawigacja N-mode ma stałą szerokość ok. **242px** i nie zawija tytułów w 2 linie (ellipsis + tooltip).
- **MUST**: Sekcje powtarzalne w N-mode korzystają ze współdzielonych komponentów (zakaz kopiowania inline).
- **MUST**: Canvas Mode jest używany tylko na ekranach “experience‑oriented” (landing/home/onboarding), nie na tabelach/formach/settings.

## Must Not

- **MUST NOT**: Zmieniać szerokości left nav per artefakt.
- **MUST NOT**: Używać Canvas Mode na operacyjnych ekranach danych.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (N-type left navigation width)
- `DRD/consultify/docs/ui-standards/01-shell-layout/shared-nmode-sections-standard.md`
- `DRD/consultify/docs/ui-standards/00-foundation/canvas-mode.md`
- `DRD/consultify/docs/ui-standards/01-shell-layout/artifact-shell-future-standard.md`


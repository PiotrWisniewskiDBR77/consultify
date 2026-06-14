---
uiux_doc_id: UIUX_SCREEN_TAXONOMY
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Screen taxonomy (types)

## Purpose

Ustalić typy ekranów w aplikacji i ich domyślne standardy UI/UX, żeby nowe ekrany nie tworzyły własnych “wynalazków”.

## Applies To

Cała aplikacja.

## Must

- **MUST**: Każdy nowy ekran jest sklasyfikowany do jednego z typów:
  - `MODULE_HUB_LIST` (hub/list: taby + Menu 2/3 + table/cards + preview)
  - `WORKSPACE_DETAIL` (N-mode: left nav + canvas; detail view)
  - `EXECUTIVE_AUTHORING` (MELS: top bar + left rail + canvas + right rail)
  - `CHAT` (conversation-driven work surface)
  - `DASHBOARD` (metryki/overview)
  - `ADMIN_SETTINGS` (governance/config, role gating, audit posture)
  - `PUBLIC` (landing, marketing, recruitment; może używać Canvas Mode)

## Should

- **SHOULD**: Dla typu ekranu istnieje link do kanonicznego standardu (shell/components/states).
- **SHOULD**: Przykłady (docelowo):
  - `MODULE_HUB_LIST`: My Work / Interview / Initiatives (hub + table/cards + preview).
  - `WORKSPACE_DETAIL`: N-mode detail views (sekcje shared).
  - `EXECUTIVE_AUTHORING`: Prezentacje/Tabele/Wordy (MELS) oraz **Document Studio** jako authoring “living artifact” (Word/PDF outputs, schema-first).

## Related Sources

- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/ui-standards/01-shell-layout/shared-nmode-sections-standard.md`
- `DRD/consultify/docs/product/MODULE_EXECUTIVE_LAYOUT_STANDARD.md`
- `DRD/consultify/docs/ui-standards/00-foundation/canvas-mode.md`


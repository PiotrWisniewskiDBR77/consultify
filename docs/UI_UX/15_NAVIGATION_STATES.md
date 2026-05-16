---
uiux_doc_id: UIUX_NAVIGATION_STATES
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Navigation states

## Purpose

Ujednolicić stany nawigacji i ich semantykę: active/hover/disabled/locked/soon/permission denied/degraded.

## Applies To

Sidebar, taby, Menu 2/3, listy, preview pane, N-mode left nav.

## Must

- **MUST**: `active` jest czytelny (tint + subtle accent), bez agresywnego “kolorowego chrome”.
- **MUST**: `disabled` ≠ `hidden`:
  - `hidden` gdy nie wolno reklamować funkcji (ACL / internal tools / brak roli),
  - `disabled/locked` gdy warto zachować discoverability i dać guidance “co dalej”.
- **MUST**: `soon` (badge) nie udaje funkcji — wejście pokazuje “coming soon” lub read-only bez fake success.
- **MUST**: `permission denied` ma jasny komunikat (kto może, gdzie to jest zarządzane, link do właściwego obszaru).
- **MUST**: `degraded` jest jawny (banner/status chip), bez ukrywania problemu.

## Must Not

- **MUST NOT**: Maskować denial jako “brak danych”.
- **MUST NOT**: Pokazywać internal tools w nawigacji, jeśli gate nie pozwala.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/UI_UX/51_PERMISSIONS_AND_LOCKED_UI.md`
- `DRD/consultify/docs/UI_UX/52_TENANT_AND_ACL_SAFETY.md`


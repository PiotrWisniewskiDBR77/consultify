---
module_id: MODULE_SETTINGS
doc_kind: CHANGELOG
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Changelog — Ustawienia

## 2026-09-01

- **Obalone**: `docs/FUNCTIONAL_DOCUMENTATION.md:57` niesie `CLOSED_FINAL
  2026-08-25`; karta modułu ma bramki `G08`/`G09` `NOT_STARTED` — pierwszy
  przegląd wizualny nigdy się nie zaczął. Sprzeczność nazwana, nie
  rozstrzygnięta.
- **Obalone**: poprzedni pomiar liczył 47 sekcji; zmierzone bezpośrednio na
  `SettingsSidebar.tsx` — **37 sekcji w 10 grupach** (47 liczyło nagłówki
  grup razem z pozycjami).
- Dopisano zmierzony mechanizm widoczności sekcji dla pilota (4/37 dozwolone,
  33/37 usuwane z listy) i ciche przekierowanie bez wpisu do dziennika.
  Pełny pomiar: `docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md`.

## 2026-05-10

- Added function-first contract layer for module 18 (`2/2` functions).
- Added function annex in `04_UI_UX.md` and linked function contracts in `functions/`.
- Updated codemap, behavior, acceptance and status with function coverage evidence.
- Corrected META identity to As-Is route/appview mapping (`/settings/*`, `AppView.SETTINGS_PROFILE_MODULE`).

## 2026-05-09

- Rebuilt module contract as author-level canonical baseline.
- Replaced empty/template placeholders with structured requirements from verified repo sources and raw author canon where available.
- Normalized source map in `SSOT.md` to avoid missing-file references.

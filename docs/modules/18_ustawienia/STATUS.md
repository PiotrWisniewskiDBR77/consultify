---
module_id: MODULE_SETTINGS
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Status — Ustawienia

## Shipping Status (As-Is)

- Runtime class: `real`
- Launch path is wired in sidebar + route config, then rendered through `AppRoutes`.
- Current ownership decision: Canonical user/workspace preference surface is `/settings/*`.

## Current Risks

- Route exists, but behavior can diverge if imports are present and not mounted.
- Documentation must track mounted runtime, not planned/RAW target-state behavior.
- **Zmierzone 2026-09-01 (dyżur 238):** `docs/FUNCTIONAL_DOCUMENTATION.md:57`
  twierdzi `CLOSED_FINAL 2026-08-25`, ale karta modułu ma `G08`/`G09`
  `NOT_STARTED` — pierwszy przegląd wizualny nigdy się nie zaczął. 33 z 37
  (89%) sekcji jest niedostępnych dla zwykłego użytkownika (mechanizm
  usuwa je z listy), a przekierowanie z zablokowanej trasy jest ciche (brak
  wpisu do dziennika). Pełny pomiar:
  `docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md`.

## Next Contract Work (without changing scope)

- Keep CODEMAP/BEHAVIOR/UI_UX/TESTS aligned with mounted route/component truth.
- Reclassify status only when `AppRoutes` mounts real runtime behavior on launch route.

## Function Coverage Status

- Required functions documented: `2/2`.
- Covered: `SET_SETTINGS_WORKSPACE`, `SET_POLICY_BOUNDARY_LINKS`.

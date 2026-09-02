---
module_id: MODULE_FINANCE
doc_kind: CHANGELOG
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Changelog — Finanse / Finance & Intelligence

## 2026-09-01

- Pomiar runtime (dyżur Codex 233, marker `e99e81301ac8c9cc9b945eb44b7365fa7ff055d6`):
  18 z 21 paneli warsztatu wyceny woła realny endpoint backendu; obalono
  wcześniejsze twierdzenie „5 z 21" (powoływało się na nieistniejący plik).
  Trzy panele bez backendu (`DriverPlannerPanel`, `EvBasketFootballField`,
  `ValuationVisualsPanel`) są celowo lokalne.
- Potwierdzono jako zamierzone: 25 z 26 ekranów modułu domyślnie zamkniętych
  za flagami (kontrolowany rollout wizualny).
- Potwierdzono: „Management report" wyceny nie istnieje w kodzie;
  `ExportStep.tsx` jest uczciwym placeholderem. Decyzja MVP/poza MVP otwarta.
- Szczegóły i cytaty: `docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md`.
- Zaktualizowano `STATUS.md` i `CURRENT_CONTRACT.md` o powyższe fakty.

## 2026-05-10

- Added function-first contract layer for module 08 (`7/7` functions).
- Added function annex in `04_UI_UX.md` and linked function contracts in `functions/`.
- Updated codemap, behavior, acceptance and status with function coverage evidence.

## 2026-05-09

- Rebuilt module contract as author-level canonical baseline.
- Replaced empty/template placeholders with structured requirements from verified repo sources and raw author canon where available.
- Normalized source map in `SSOT.md` to avoid missing-file references.

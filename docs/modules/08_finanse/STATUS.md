---
module_id: MODULE_FINANCE
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Status — Finanse / Finance & Intelligence

## Status Tags (As-Is)

- `real`: `/economics` and `/finance` routes are active and map to `EconomicsView`.
- `real`: sidebar mapping to `AppView.ECONOMICS` is active.
- `partial`: finance runtime includes V8 mode with legacy fallback toggles.
- `real`: finance detail routes (`/finance/statements/:id`, `/finance/models/:id`, `/finance/analyses/:id`) are wired.
- `code_gap`: no dedicated automated tests for `FinanceHub`/`EconomicsView`.
- `doc_gap`: prior baseline did not include alias/detail route evidence.

## Function Coverage Status

- Required functions documented: `7/7`.
- Covered: `FN_STATEMENTS_WORKSPACE`, `FN_MODELS_WORKSPACE`, `FN_ANALYSIS_WORKSPACE`, `FN_PREDICTION_WORKSPACE`, `FN_VALUATION_WORKSPACE`, `FN_INVESTMENT_WORKSPACE`, `FN_FINANCE_DETAIL_ROUTES`.

## Pomiar 2026-09-01 — panele wyceny, flagi, management report

Pełne cytaty i metoda: `docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md`
(sekcja 1), źródło: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY233_FINANSE_REPORT.md`.

- `real`: **18 z 21 paneli wyceny woła realny endpoint backendu** (pełny
  `ApiGateway` + JWT + realny Postgres, `2xx` z niepustym `body.data`).
  Trzy panele są celowo lokalne/prop-driven: `DriverPlannerPanel`,
  `EvBasketFootballField`, `ValuationVisualsPanel` — to nie jest luka.
  Wcześniejsze twierdzenie „5 z 21" **obalone 1.09** — powoływało się na
  nieistniejący plik.
- `by_design`: na domyślnych ustawieniach **25 z 26 ekranów modułu jest
  zamkniętych za flagami** (`VITE_FINANCE_VALUE_PANELS` domyślnie OFF,
  `src/utils/financeValuePanelsFlag.ts:1-30`; `ENABLE_V8_GLOBAL` bramkuje
  backend, `server/src/middleware/v8FeatureGate.middleware.ts:10-20`). To
  jest **stan zamierzony** (kontrolowany rollout wizualny), nie usterka.
- `gap`: „Management report" wyceny **nie istnieje w kodzie** —
  `ExportStep.tsx` jest uczciwym placeholderem. Decyzja „w MVP czy poza"
  pozostaje otwarta.

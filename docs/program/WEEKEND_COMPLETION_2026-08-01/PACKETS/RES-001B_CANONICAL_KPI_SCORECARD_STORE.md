---
doc_id: RES-001B
truth_type: operations
status: BLOCKED
owner: codex
product_owner: piotr
priority: P0
depends_on: RES-001A
last_reviewed: 2026-07-31
---

# RES-001B — jeden owner store kart KPI

## Werdykt

**NO-GO dla prostego przepięcia UI.** Obecny `ResultsKpiScorecardsView` jest edytorem
hierarchii Goal/Objective/Key Result z generic Goals API. Kanoniczne V8
`kpi_scorecards` opisuje kartę jako department × period i członkostwo wielu KPI.
Te modele nie są równoważne, a automatyczne mapowanie initiative links/goal roll-up
na KPI membership fałszowałoby dane.

## Brakujący kontrakt V8

V8 ma dziś tylko listę kart i odczyt KPI. Przed cutover potrzebne są tenant-scoped,
typed endpoints create/update/delete oraz link/unlink/reorder KPI, jawna polityka
uprawnień i poprawienie tenant condition w listowym joinie/count.

Frontend ma używać jednego adaptera V8, prawdziwych empty/error states i tabeli:
Name, Department, Period, KPIs, On target, Status. Po migracji nie może zostać żadne
`Api.goals*` ani Goal terminology w tym widoku.

## Blokująca decyzja danych

Przed implementacją należy policzyć istniejące `goals.goal_type='scorecard'` i ustalić:

- dane disposable/demo — V8 cutover bez backfillu; albo
- dane istotne — osobny, idempotentny backfill z mappingiem
  `legacy_goal_id → scorecard_id`, raportem wyjątków i reconciliation counts.

Inicjatyw nie wolno automatycznie mapować na KPI. Tymczasowa legacy sekcja może być
wyłącznie read-only i nie spełnia finalnego `no duplicate store`.

## Acceptance

- create/update/membership na jednym V8 store;
- 401/403/404/cross-org, duplicate link, unlink i delete conflict;
- ten sam KPI może należeć do wielu kart, ale tylko raz do jednej;
- stabilny sort i tenant-safe counts;
- component loading/empty/error/list/detail/create/edit/link/unlink/permission;
- feature flag pozwala wycofać UI bez dual-write i bez usuwania legacy Goals.

## Warunek odblokowania

Read-only inventory na realnej bazie testowej/staging oraz decyzja `disposable` albo
`backfill`. Bez tego zmiana mogłaby ukryć istniejące dane użytkowników.

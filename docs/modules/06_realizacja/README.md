---
module_id: MODULE_EXECUTION
doc_kind: ENTRYPOINT
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Realizacja / Implementation & PMO

## Purpose

Operacyjne dowodzenie realizacją: portfolio, PMO reports, manager/control tower, task-decision runtime, ryzyka, baseline i interwencje.

## Contract Layers

- `../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md` — nadrzędny kanon Menu 2, table-first shell, funkcji `Realizacje / Praca / Zasoby / Sterowanie / Raporty` oraz ciągłości z Initiatives. W tym zakresie ma pierwszeństwo przed starszym inventory funkcji.
- `../initiatives-execution-canon/00_INDEX_AND_AUTHORITY.md` — kompletny pakiet wdrożeniowy: proces, governance, UI/UX, descriptors, data/API/events, migracja, kolejność implementacji, testy i owner decisions.

- `SSOT.md` — priority and source map.
- `00_META.md` — identity, route, owner and canonicality.
- `01_PURPOSE.md` — why this module exists.
- `02_SCOPE.md` — in-scope and out-of-scope boundaries.
- `03_BEHAVIOR.md` — required runtime behavior.
- `04_UI_UX.md` — required user experience and visual/interaction rules.
- `05_DATA_AND_INTEGRATIONS.md` — objects, integrations and lineage.
- `06_PERMISSIONS_AND_SECURITY.md` — roles, tenant boundaries and security.
- `07_ACCEPTANCE_AND_TESTS.md` — verification canon.
- `RAW_INPUT.md` — raw author notes before normalization.
- `CHANGELOG.md` — contract changes.
- `RAW_TARGET_STATE_2_0_PACKET.md` — RAW -> Target State 2.0 module packet.
- `INTEGRATION_REPORT.md` — module-level integration decision and gate report.
- `IMPLEMENTATION_TASK_BOARD.md` — module task register (`P0/P1/P2`) by immutable scope anchor.
- `function-cards/*_EXECUTION_CARD.md` — function-level execution governance cards.

## Function Inventory (Function-First)

> Target canon: `Realizacje -> Praca -> Zasoby -> Sterowanie -> Raporty`. Poniższe identyfikatory są historycznym/runtime inventory do mapowania i nie ustanawiają docelowego Menu 2.

- `RL_EXECUTION_PORTFOLIO`
- `RL_EXECUTION_REPORTS`
- `RL_EXECUTION_MANAGER`
- `RL_FULL_EXECUTION_VIEW`
- `RL_ROLLOUT_VIEW`

## Primary Sources

- `DRD/consultify/docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`
- `DRD/consultify/docs/product/EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`
- `DRD/consultify/docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
- `DRD/consultify/docs/product/DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`
- `DRD/consultify/docs/product/EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md`
- `DRD/consultify/docs/product/EXECUTION_RESOURCE_BALANCING_AND_CAPACITY_OPERATIONS_V8.md`
- `DRD/consultify/docs/UI_UX/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md`

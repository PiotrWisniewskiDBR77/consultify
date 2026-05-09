---
module_id: MODULE_EXECUTION
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Realizacja (Execution)

## Purpose

Ustalić granice odpowiedzialności modułu `Realizacja` i jego relacje z `Inicjatywy`, `Rezultaty` (Benefits/Results), `Outputs` oraz globalnym `Reports`.

## In scope (Must)

- MUST: obsługiwać inicjatywy w statusach: `SCHEDULED`, `EXECUTING`, `BLOCKED`, `DONE` (wg routing SoT).
- MUST: wspierać work graph: tasks, decisions, dependencies, milestones jako initiative-native execution objects.
- MUST: zapewnić 3 powierzchnie (`Portfolio/Raporty/Manager`) na tej samej prawdzie.

## Out of scope (Must Not)

- MUST NOT: przejmować planning i gate’ów inicjatywy (należy do `Inicjatywy`).
- MUST NOT: zastępować Benefits/Tracking (należy do `Rezultaty`).

## Should

- SHOULD: konsumować sygnały KPI/Finance/Calendar bez tworzenia shadow runtime (tylko konsumować).

## Acceptance Criteria

- [ ] Zgodność z “relationship to adjacent modules” z `EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`.
- [ ] Nie ma dublowania list portfolio ani reportów w złym miejscu (Raporty ≠ drugi portfolio table).

## Related Sources

- `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- `DRD/consultify/docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`
- `DRD/consultify/docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`


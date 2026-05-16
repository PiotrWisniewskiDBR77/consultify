---
module_id: MODULE_EXECUTION
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Realizacja (Execution)

## Purpose

Kontrakt zachowania runtime’u realizacji: sygnały, widoki, interwencje operatora i uczciwa degradacja przy brakach danych.

## Must

- MUST: utrzymywać “one runtime truth” dla initiatives/tasks/decisions/dependencies/baseline/forecast/workload.
- MUST: jawnie pokazywać brak baseliny/estymat i obniżoną pewność (honest degraded posture).
- MUST: wspierać operator loop: detect → drill-down → recommend → intervene → verify.
- MUST: Raporty są katalogiem raportów i report runów, nie drugim portfolio list view.

## Must Not

- MUST NOT: wprowadzać równoległych status families / dependency models w poszczególnych tabach.
- MUST NOT: “silent AI mutations” (np. ciche reassign/replan).

## Should

- SHOULD: sugerować bounded interwencje (`reassign`, `smooth`, `replan`, `escalate`) z jawym “why/expected change/what verify”.

## Acceptance Criteria

- [ ] Portfolio: table+preview (single click preview, double click full) + kanban + timeline, bez zmiany prawdy obiektu.
- [ ] Manager: nie kończy na “insight” — prowadzi do działań i weryfikacji po write.

## Related Sources

- `DRD/consultify/docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`
- `DRD/consultify/docs/product/EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`


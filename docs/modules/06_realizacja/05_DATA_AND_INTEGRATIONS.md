---
module_id: MODULE_EXECUTION
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Realizacja (Execution)

## Purpose

Opisać: kanoniczne obiekty delivery wykorzystywane w Execution (inicjatywy, zadania, decyzje, zależności, sygnały), oraz zasady “summary up, traceability down”.

## Must

- MUST: Execution konsumuje kanoniczne obiekty delivery (nie tworzy shadow workflow).
- MUST: sygnały execution (overdue, blocked, missing baseline, decision aging itd.) istnieją i są raportowane.
- MUST: emitować minimalne eventy handoff do Results (np. `handover_completed`, `realization_tracking_started`) wg `EXECUTION_CONTROL_TOWER...`.

## Must Not

- MUST NOT: gubić traceability (z report/manager insight do obiektu źródłowego).

## Should

- SHOULD: utrzymywać lineage między intervention actions a zmianą sygnałów (audit).

## Acceptance Criteria

- [ ] Z każdego wyjątku/alertu user może zejść do root object i zobaczyć dlaczego.

## Related Sources

- `DRD/consultify/docs/product/EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`
- `DRD/consultify/docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`


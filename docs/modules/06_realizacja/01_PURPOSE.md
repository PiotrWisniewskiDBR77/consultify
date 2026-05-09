---
module_id: MODULE_EXECUTION
doc_kind: PURPOSE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Purpose — Realizacja (Execution)

## Purpose

Zdefiniować po co istnieje moduł `Realizacja`: kontrola dostarczania w czasie wykonywania, z warstwą operatora (PMO/manager) nad kanonicznymi obiektami delivery.

## Must

- MUST: odpowiadać na pytania operatora: co jest on-track/late/overloaded/blocked, jaka decyzja brakuje, gdzie potrzebna interwencja.
- MUST: działać jako jeden runtime w 3 powierzchniach (`Portfolio/Raporty/Manager`), bez równoległych prawd.
- MUST: pozostać uczciwy przy brakach danych (missing baseline/estimate/stale data) — żadnego “fake confidence”.

## Must Not

- MUST NOT: tworzyć osobnej “planning” prawdy konkurującej z `Inicjatywy`.
- MUST NOT: wprowadzać ukrytych AI mutacji (np. ciche replan/reassign).

## Should

- SHOULD: wspierać interwencje bounded i weryfikowalne (detect → intervene → verify).

## Acceptance Criteria

- [ ] Purpose jest spójny z `EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md` i nie dubluje Inicjatyw/Outputs.

## Related Sources

- `DRD/consultify/docs/product/EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`
- `DRD/consultify/docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`


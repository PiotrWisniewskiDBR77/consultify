---
module_id: MODULE_EXECUTION
doc_kind: STATUS
version: 0.1
owner: user
status: canonical
last_updated: 2026-05-15
---

# Status — Realizacja (Execution)

## Shipping status

- **Status**: shipped (core)

## Current truth (SoT)

- Kontrakt dzieli moduł na `Portfolio/Raporty/Manager` i zakazuje równoległych prawd (one runtime).
- Moduł musi pozostać uczciwy, gdy planowanie ma braki (missing baseline/estimate) — “honest degraded posture”.

## Risks

- Ryzyko “drugi runtime”: taby/surfaces zaczną tworzyć shadow modele statusów, zależności lub raportów.
- Ryzyko: Manager stanie się dashboardem bez realnych interwencji (kontrakt wymaga detect→intervene→verify).


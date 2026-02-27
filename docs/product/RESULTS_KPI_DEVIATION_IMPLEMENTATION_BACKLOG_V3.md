# KPI Deviation Management — Implementation Backlog v3 (SSOT)

Owner: PO/CTO  
Status: draft backlog (ready to turn into tasks)  
Scope: thresholds + deviation cases + notifications + action plans for Results/KPI

SSOT references:

- `docs/product/RESULTS_V3.md`
- `docs/product/RESULTS_KPI_DEVIATION_MANAGEMENT_V3.md`
- `docs/product/GATE_DEFINITION_OF_DONE.md`

---

## EPIC KPI-DEV-0 — Data model + evaluation engine

### Task KPI-DEV-001 — Extend KPI definition model (formula + thresholds + target-by-period)

**Acceptance criteria**

- KPI supports:
  - formula text / calculation method
  - direction (higher/lower better)
  - target mode: single vs by-period
  - threshold bands: green/amber/red (absolute or % from target)
- Evaluation function is deterministic and unit-tested:
  - produces status: `GREEN|AMBER|RED|NO_DATA`
  - works for both directions

---

### Task KPI-DEV-002 — Deviation Case table + lifecycle

**Acceptance criteria**

- New table(s) exist for deviation cases with fields from SSOT:
  - kpi_id, period, severity, status, owner, timestamps, rca_text, action_plan payload (or relations)
- API endpoints exist to:
  - list cases (by org, by kpi, open-only)
  - acknowledge case
  - update RCA
  - add/update action plan items
  - resolve/close case

---

### Task KPI-DEV-003 — Auto-create case on threshold breach

**Acceptance criteria**

- When a time-series point is recorded and evaluates to AMBER/RED:
  - system creates/open a case (idempotent rule described in SSOT)
  - stores computed deviation summary
- For GREEN/NO_DATA it does not create a case

---

## EPIC KPI-DEV-1 — UX: KPI card + KPI detail action loop

### Task KPI-DEV-101 — KPI table columns (scorecard-like)

**Acceptance criteria**

- KPI table shows columns from SSOT (name, formula, unit, owner, baseline, target, thresholds, current, status, period).
- Sorting/filtering by status and owner exists.

---

### Task KPI-DEV-102 — KPI detail: show open Deviation Case + action plan

**Acceptance criteria**

- KPI detail view/drawer shows:
  - current status vs thresholds
  - open case with required CTA (acknowledge/explain/action plan)
  - history of cases (read-only)

---

## EPIC KPI-DEV-2 — Notifications + escalation

### Task KPI-DEV-201 — Notify KPI owner on case creation

**Acceptance criteria**

- On AMBER/RED case creation:
  - owner gets notification in-app (and optionally email, if system supports)
- For RED, escalation happens after configurable timeout if no acknowledgement.


---
module_id: MODULE_RESULTS
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Rezultaty / Results & Value Realization

## Route / AppView / Sidebar

- Sidebar label: `Rezultaty`
- Route: `/benefits`
- AppView: `AppView.BENEFITS_REALIZATION`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- KPI and scorecard truth.
- Baseline/target/actual/deviation tracking.
- ROI realization, reconciliation and evidence.
- Corrective action loop linked to initiatives/execution/finance.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.

---
module_id: MODULE_FINANCE
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Finanse / Finance & Intelligence

## Route / AppView / Sidebar

- Sidebar label: `Finanse`
- Route: `/economics`
- AppView: `AppView.ECONOMICS`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Financial statements, normalized financial models and analysis.
- Forecasting, valuation, investment decision support and management reporting.
- Optional KPI/Results reconciliation bridge.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.

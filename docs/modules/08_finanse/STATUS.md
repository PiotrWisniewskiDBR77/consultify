---
module_id: MODULE_FINANCE
doc_kind: STATUS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Status — Finanse

## Shipping status

- **Status**: mixed (as-is economics shipped; Financial Analysis v3 in progress)

## Known gaps (from existing SoT)

- W kodzie jest `EconomicsView` pod `/economics` (supporting capability).
- Pełny “Financial Analysis v3” (6 zakładek + AI orchestration) wymaga mapowania do realnych routes/views.

## Risks

- Ryzyko split-brain: Results vs Finance (duplikaty definicji liczb). Linkage musi pozostać opcjonalny i jawny.
- Ryzyko “AI halucynuje liczby” – Finanse mają twardy kontrakt “numerical anchor”.


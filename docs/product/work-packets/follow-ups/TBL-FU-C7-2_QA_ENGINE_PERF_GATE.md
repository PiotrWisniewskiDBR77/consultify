# TBL-FU-C7-2 — QA Engine 1 000-Record Perf Gate (Staging)

**Source sprint:** Block C / C-S7
**Filed:** 2026-05-08
**Priority:** P2
**Status:** `OPEN`
**Owner:** Agent A (backend) + perf eng

## Why this exists

L8.2 in the validation matrix calls for `< 8 s` on a 1 000-record table. The C-S4 unit tests cover correctness on small mocked datasets; a live perf measurement on staging is needed to confirm the budget.

## Scope

1. Seed staging with a 1 000-record `tp_records` corpus on a Block-A template (Risk Register).
2. Call `tableQaService.computeReport({tableId, organizationId, computedBy: 'perf-test'})` cold.
3. Capture `computation_ms` from the persisted report.
4. Confirm `computation_ms <= 8 000` and `p95 <= 8 000` over 5 cold runs.
5. If we breach: profile and either lift `MAX_RECORDS_FOR_FORMULA_SCAN` cap, add an index, or pre-aggregate validation_status/confidence_score.

## Out of scope

- 10 000-record corpus — that's a future stretch goal.
- Concurrent recompute fairness (the in-process scheduler debounces 5 min by design).

## Definition of done

- Perf log in `block-C-ai-operator/evidence/sprint-7/perf-qa-engine.md`.
- p95 within budget OR a fix shipped.

# C-S4 Validation Matrix — Executed

**Date:** 2026-05-08 (Friday)
**Sprint:** C-S4 — QA Engine Backend
**Status:** PASS (19 / 19 unit tests)
**Block C aggregate:** 94 / 94 tests passing

## Test inventory

| # | Description                                                | Result |
|---|------------------------------------------------------------|--------|
| 1 | `computeReport` rejects missing inputs                     | PASS   |
| 2 | Returns 404 when table does not exist                      | PASS   |
| 3 | Cross-tenant defense — refuses table not in actor org      | PASS   |
| 4 | Perfect table → all 5 axes 1.0, overall 1.0, no suggestions| PASS   |
| 5 | Completeness drops when required field is empty            | PASS   |
| 6 | Freshness scores 0 on 60-day-old records                   | PASS   |
| 7 | Source coverage scores 0.5 when half records lack sources  | PASS   |
| 8 | Methodology violations from `governance_rules` are flagged | PASS   |
| 9 | Formula consistency tracks evaluation errors per field     | PASS   |
| 10| Persists report row by default + returns RETURNING id      | PASS   |
| 11| `persist=false` skips the INSERT                           | PASS   |
| 12| Durable dismissals filter matching suggestions             | PASS   |
| 13| `getLatestReport` returns null when no reports exist       | PASS   |
| 14| `getLatestReport` maps row → typed report                  | PASS   |
| 15| `getLatestReport` cross-tenant defense                     | PASS   |
| 16| `markSuggestionInapplicable` upserts dismissal row         | PASS   |
| 17| `markSuggestionInapplicable` cross-tenant defense          | PASS   |
| 18| `scheduleRecompute` debounces multiple calls               | PASS   |
| 19| `scheduleRecompute` ignores empty tableId/orgId            | PASS   |

## Coverage notes

- **5-axis algorithms:** all five axes covered with synthetic state
  fixtures hitting both the 1.0 (green) and degraded (amber/red) branches.
- **Cross-tenant safety:** explicit at three entrypoints (compute,
  getLatest, markInapplicable). Service rejects with `TENANT_VIOLATION`
  status 403 even when the route layer is bypassed.
- **Persistence contract:** column order asserted on the INSERT call
  arguments (table_id, org, ws, ts, by, trigger, score, axes, suggestions,
  ms). Schema compatibility with `20260509_block_c_qa_engine.sql`
  verified by parameter-positional checks.
- **Dismissal lifecycle:** test #12 walks the full loop — compute →
  observe fingerprint → dismiss → recompute → verify suggestion absent.
- **Scheduler determinism:** test #18 swaps in a synchronous scheduler
  and asserts only the trailing call survives. The default Node-timer
  scheduler is exercised manually in dev and gated behind
  `__setSchedulerFnForTesting`.

## Performance baseline (synthetic)

- Single-table compute path on the canonical 1-record / 1-field fixture
  completes in <1 ms in vitest (no DB round-trip due to mocks).
- Production-grade benchmark with 50_000 records deferred to **C-S7**
  closeout per the program plan; freshness/sourceCoverage/methodology
  are O(records) and formulaConsistency caps at 1_000 records by design.

## Out of scope (explicitly NOT validated here)

- BullMQ-backed scheduling — owned by C-S6.
- Frontend integration — owned by C-S5.
- E2E HTTP path through the route layer — owned by C-S7 closeout
  Anygravity P0 trial #2.

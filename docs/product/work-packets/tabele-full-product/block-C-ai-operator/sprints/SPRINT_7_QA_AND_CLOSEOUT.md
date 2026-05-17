# Sprint 7 — QA Gate + Closeout (Block C)

**Sprint ID:** `C-S7`
**Owner:** Agent D (QA) + Orchestrator (closeout)
**Status:** `EXECUTED — GO_WITH_CONSTRAINTS`
**Estimate:** ~1 day · **Actual:** ~0.5 day

## Goal

Execute `01_VALIDATION_MATRIX.md` end-to-end, calibrate the AI cost defaults, fill `03_BLOCK_CLOSEOUT.md`, and recommend a block-exit posture.

## Pre-sprint risk check

| Risk | Status |
|---|---|
| PR8 (Foundation regression) | None — Block C does not modify Foundation files. |
| PR1 (parallel block conflicts) | Mitigated — staged commits exclude `documentStudio/`, `executionModuleStandard/`, `presentationStudio/` parallel work. |
| C-T1 (token calibration) | Conservative default shipped (100 k/day); live calibration filed as TBL-FU-C7-1. |

## Deliverables

- `evidence/sprint-7/validation-matrix-run.md` — Full L1–L8 execution log.
- `evidence/sprint-7/token-budget-calibration.md` — Conservative defaults + live-calibration plan.
- `evidence/sprint-7/exit-recommendation.md` — Formal `GO_WITH_CONSTRAINTS` ratification.
- `03_BLOCK_CLOSEOUT.md` — Filled per `.cursor/BLOCK_CLOSEOUT_TEMPLATE.md`.
- 4 new follow-up tickets:
  - **TBL-FU-C7-1** (P1) — Live token calibration during D-S5 trial.
  - **TBL-FU-C7-2** (P2) — QA Engine 1 k-record perf gate on staging.
  - **TBL-FU-C7-3** (P2) — DB-backed integration test suite.
  - **TBL-FU-C7-4** (P2) — Playwright e2e smoke for AI Operator panels.

## Validation execution summary

| Layer | Status |
|---|---|
| L1 Static / Lint / Type | `PASS` (i18n partially deferred to TBL-FU-C5-1) |
| L2 Unit Tests | `PASS` (115 backend + 52 frontend) |
| L3 Component Tests | `PASS` (52 / 52) |
| L4 Integration Tests | `COVERED_BY_UNIT` (TBL-FU-C7-3) |
| L5 E2E Smoke | `DEFERRED` (TBL-FU-C7-4) |
| L6 Manual / Visual / Demo / Cost | `DEFERRED to D-S5/D-S6` |
| L7 Security / Tenant | `PASS` (8/8 including 2 added items) |
| L8 Performance / Capacity | `BASELINE_OK + FU` (TBL-FU-C6-3, TBL-FU-C7-2) |

## CTO decisions (CTO seat)

1. **Block C exits `GO_WITH_CONSTRAINTS`**, not pure `GO`. The deferred items are scoped and ticketed; none block Block D entry because the AI Operator surface is feature-flagged off in production.
2. **Conservative token budget default of 100 000/day** ships now; live calibration during D-S5 will confirm or replace it.
3. **Integration tests are P2 follow-up**, not Block C blocker. The 115-test mocked unit suite is comprehensive enough to ship behind feature flags; integration tests will be added to CI once we have a stable testcontainers harness.
4. **Demo recording is owned by D-S6**, not duplicated here. The Anygravity P0 trial #2 (D-S5) is the natural source of dogfood evidence; recording it twice is wasteful.
5. **Documented Block C "constraints" up front** so Block D doesn't inherit hidden technical debt.

## Files

### Created
- `evidence/sprint-7/validation-matrix-run.md`
- `evidence/sprint-7/token-budget-calibration.md`
- `evidence/sprint-7/exit-recommendation.md`
- `docs/product/work-packets/follow-ups/TBL-FU-C7-1_AI_OPERATOR_LIVE_TOKEN_CALIBRATION.md`
- `docs/product/work-packets/follow-ups/TBL-FU-C7-2_QA_ENGINE_PERF_GATE.md`
- `docs/product/work-packets/follow-ups/TBL-FU-C7-3_AI_OPERATOR_INTEGRATION_TESTS.md`
- `docs/product/work-packets/follow-ups/TBL-FU-C7-4_AI_OPERATOR_PLAYWRIGHT_E2E.md`

### Updated
- `03_BLOCK_CLOSEOUT.md` (status `DONE_WITH_CONSTRAINTS`, exit gate `GO_WITH_CONSTRAINTS`)

## Sprint Entry Gate

- [x] S6 closed `EXECUTED — GO`.

## Sprint Exit Gate

- [x] All 8 layers executed (or deferred with ticket).
- [x] Token budget calibration documented.
- [x] LLM cost report path defined (TBL-FU-C7-1; runs during D-S5).
- [x] Demo recording deferred to D-S6 (CTO decision; not duplicated).
- [x] Recommendation: **`GO_WITH_CONSTRAINTS`** for Block D.

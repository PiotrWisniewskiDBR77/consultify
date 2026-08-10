# Codex quality backlog — Ideas transformation

Control checkpoint: 2026-08-10, independent inspection of candidate HEAD `5d80167c5b` while Claude had an active uncommitted implementation wave. This backlog does not declare acceptance and must be reconciled against the next committed SHA.

## QG-01 — Split the Action Registry monolith

- Priority: P1
- Evidence: `src/actions/ideaActionRegistry.ts` reached 7,593 lines and 177 registered actions at committed HEAD `5d80167c5b`.
- Required outcome: split definitions by tool/domain while retaining one public registry API and stable action IDs.
- DoD: identical before/after action inventory; unchanged behavior, labels, scopes, permissions, undo, Teresa and analytics contracts; no circular imports; all action checks and focused routing tests pass.

## QG-02 — Replace the coverage ratchet with an accounted inventory

- Priority: P1
- Evidence: `check-action-coverage.sh` passes with a baseline of 288 existing action-like constructs; it proves no increase, not complete registration.
- DoD: every baseline hit is classified as registered action, intentional gesture/internal callback, duplicate surface awaiting reuse, or defect; unexplained debt is zero; exclusions have stable reasons; the guard fails on new unexplained constructs.

## QG-03 — Exact-SHA runtime, backend and persistence acceptance

- Priority: P1 / release gate
- Current state: NOT VERIFIED.
- Required chain: committed SHA -> mounted runtime badge -> authenticated real backend/DB -> mutation -> save -> refresh -> cold reopen -> readback.
- DoD: all four tools pass that chain on one environment and SHA; evidence is indexed; mocks remain labelled component-only; two clean acceptance rounds produce no new P0/P1.

## QG-04 — Remove duplicate React keys in Whiteboard drawing UI

- Priority: P2
- Evidence: independent 76/76 focused test run passed, but `IdeaDrawingLayer.keyboardDrawing.test.tsx` repeatedly emitted duplicate-key warnings for `#3b82f6`.
- DoD: unique stable keys; warning-free tests and mounted UI; no lost/duplicated options; keyboard and screen-reader behavior preserved.

## QG-05 — Obtain a conclusive full type-check

- Priority: P1 / merge gate
- Current state: NOT VERIFIED; observed `tsc --noEmit` remained CPU-active for more than seven minutes and returned no terminal result during inspection.
- DoD: run on a clean committed SHA without concurrent mutation; record command, time, exit code and output; PASS requires exit 0; timeout/termination remains NOT VERIFIED; profile pathological runtime if reproduced.

## QG-06 — Synchronize status and ledger after every milestone

- Priority: P1
- Evidence: status described only initial E00; ledger preceded HEAD and contained stale `pending commit` values.
- DoD: exact introducing/verifying SHA in every closed row; documentation, implementation, tests, runtime, persistence and acceptance remain separate states; CSV validation enforces exactly 20 columns in every record.

## Required execution order

1. Finish or safely checkpoint the active implementation wave.
2. Run QG-05 on the resulting clean committed SHA.
3. Complete QG-06 and reconcile every ledger row with that SHA.
4. Execute QG-01 and QG-02 before another large registry expansion.
5. Fix QG-04 and prove warning-free mounted behavior.
6. Execute QG-03; do not declare `READY_FOR_CODEX_REVIEW` before it passes.

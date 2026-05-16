# Manual Test Readiness Pack Blocks 1-15 - 2026-05-16

## Goal

Operational run order and readiness checklist to execute Business Owner manual tests for Blocks 1-15 and close the final gate to `GLOBAL_ALL_MODULES_GO`.

## Current Readiness Verdict

- Developer/runtime side: `GLOBAL_DEVELOPER_RUNTIME_GO_WITH_BUSINESS_MANUAL_FOLLOWUPS`
- Block statuses: `READY_FOR_MANUAL` (1-15)
- Active developer-side `BLOCKED_P1`: none in strict-dev evidence
- Remaining work: Business Owner manual evidence and residual closure

## Preflight (must pass before manual run)

1. Start from active workspace:
   - `DRD/consultify`
2. Confirm branch and local changes:
   - `git status --short`
3. Confirm docs consistency:
   - `npm run -s docs:check`
   - `npm run -s docs:parity`
4. Confirm latest strict-dev references:
   - `docs/testing/reports/FINAL_GLOBAL_MODULE_GATE_2026-05-15.md`
   - `docs/testing/reports/BO_EXECUTION_TRACKER_BLOCKS_1_15_2026-05-16.md`

## Manual Run Order (execution priority)

Recommended order to minimize cross-module noise and speed up acceptance:

1. Block 1 `Czat`
2. Block 2 `Canvas`
3. Block 3 `Teresa` (cross-tool approval paths)
4. Block 10 `Zarządzanie Taskami`
5. Block 9 `Calendar`
6. Block 4 `Radar`
7. Blocks 5-8 `Idea Workspace` (Mind Map -> Process Flow -> Whiteboard -> Tabela)
8. Block 11 `PMO Funkcje`
9. Block 12 `Excel`
10. Block 13 `Word`
11. Block 14 `Prezentacje`
12. Block 15 `Setting/Admin`

## Block Exit Contract (apply to each block)

For each block:

1. Set tracker status:
   - `READY_FOR_MANUAL` -> `IN_RETEST`
2. Execute all open checklist items from:
   - `docs/testing/reports/BO_EXECUTION_TRACKER_BLOCKS_1_15_2026-05-16.md`
3. Attach evidence:
   - screenshots/video,
   - save/read-back proof,
   - denied-state proof where required,
   - export artifacts where required,
   - Teresa proposal -> approval -> execution -> audit trace where required.
4. Classify result:
   - all pass -> `BUSINESS_PASS`,
   - nonblocking accepted risk -> `PASS_WITH_NONBLOCKING_P2`,
   - blocking issue -> `BLOCKED_P1`.
5. Sync status in:
   - `docs/testing/reports/FINAL_GLOBAL_MODULE_GATE_2026-05-15.md`
   - `docs/product/GLOBAL_MODULE_CLOSEOUT_STATUS_BOARD_2026-05-15.md`

## Cross-Block Residual Closure (before global promotion)

- Classify `docs/UI_UX/99_RAW_INPUT 2.md` (merge/archive/delete decision).
- Resolve/classify draft modules listed in BO tracker.
- Capture final production build pass.
- Capture final staging smoke pass.
- Re-run and capture docs gates pass.

## Final Promotion Gate

Promote only when all are true:

- Blocks 1-15 are `BUSINESS_PASS` or accepted `PASS_WITH_NONBLOCKING_P2`.
- No active `BLOCKED_P1`.
- Cross-block residuals are closed.
- Final artifacts are attached.

Then update global verdict to:

- `GLOBAL_ALL_MODULES_GO`

## Linked Advanced Artifacts

- Advanced module scenarios:
  - `docs/testing/reports/ADVANCED_MANUAL_SCENARIOS_BLOCKS_1_15_2026-05-16.md`
- AntyGravity full-audit master prompt:
  - `docs/testing/reports/ANTYGRAVITY_MASTER_PROMPT_ALL_MODULES_AUDIT_2026-05-16.md`

---
module_id: MODULE_FINANCE
function_id: FN_INVESTMENT_WORKSPACE
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
work_type: docs-only
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — FN_INVESTMENT_WORKSPACE

## Scope Anchor

- scope_anchor: `08_finanse/FN_INVESTMENT_WORKSPACE`
- in scope: `functions/FN_INVESTMENT_WORKSPACE.md`, `IMPLEMENTATION_TASK_BOARD.md`, this card
- out of scope: runtime/API/component edits

## RAW -> Decision -> Evidence Chain

| Task ID | RAW requirement | Decision | Evidence |
| --- | --- | --- | --- |
| `FN-INV-P0-001` | recommendation must be traceable (`source -> assumptions -> recommendation`) | normalize one critical-claim traceability ledger | `functions/FN_INVESTMENT_WORKSPACE.md`, `07_ACCEPTANCE_AND_TESTS.md` |
| `FN-INV-P1-001` | go/no-go recommendation needs explicit approval and no hidden finalization | enforce explicit approval semantics in function and UI contracts | `functions/FN_INVESTMENT_WORKSPACE.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md` |
| `FN-INV-P2-001` | dedicated investment route/component/API/test matrix | defer runtime evidence depth as explicit gap | `NOT_DONE` in function and acceptance docs |

## Gap Register

| Task ID | Priority | Gap | Status |
| --- | --- | --- | --- |
| `FN-INV-P0-001` | `P0` | decision traceability must be normalized in one ledger | `READY` |
| `FN-INV-P1-001` | `P1` | explicit risk-assumptions and go/no-go approval/no-hidden-finalization boundary needs normalization | `WAITING_P0` |
| `FN-INV-P2-001` | `P2` | dedicated investment route/component/API/test evidence matrix missing | `WAITING_P0` |

## Evidence Plan

| Claim | Route | Component | API | Test | Gate |
| --- | --- | --- | --- | --- | --- |
| investment tab is mounted in finance runtime | finance routes | `FinanceHub` investment lane | finance API boundary | module smoke only | `PASS` |
| recommendation carries traceability and risk posture | finance context | investment summary/detail surfaces | decision metadata boundary | function-level suite missing | `PASS_WITH_P1` |
| go/no-go recommendation is explicitly approved | finance action flow | review/approval controls | approval state boundary | dedicated probe missing | `PASS_WITH_P1` |
| dedicated investment regression matrix exists | n/a | n/a | n/a | missing | `NOT_DONE` |

## Verdict

- docs verdict: `APPROVED_FOR_DOCS`
- runtime/test hold: `BLOCKED_P1` (`FN-INV-P2-001`)

---
module_id: MODULE_CHAT
function_id: CZ_CANVAS_WORKSPACE
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
work_type: docs-only
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — CZ_CANVAS_WORKSPACE

## Scope Anchor

- scope_anchor: `01_czat/CZ_CANVAS_WORKSPACE`
- in scope: `functions/CZ_CANVAS_WORKSPACE.md`, `07_ACCEPTANCE_AND_TESTS.md`, task board row sync
- out of scope: runtime/API/component edits

## RAW -> Decision -> Evidence Chain

| Task ID | RAW requirement | Decision | Evidence |
| --- | --- | --- | --- |
| `CZ-CANVAS-P0-001` | startup must work as `draft -> review -> accept/reject -> owner read-back` | `ENHANCE` | `RAW_TARGET_STATE_2_0_PACKET.md`, `functions/CZ_CANVAS_WORKSPACE.md`, `07_ACCEPTANCE_AND_TESTS.md` |
| `CZ-CANVAS-P1-001` | Menu 3 placement and source/approval guardrails stay explicit | `KEEP` + `ENHANCE` | `04_UI_UX.md`, `functions/CZ_CANVAS_WORKSPACE.md` |
| `CZ-CANVAS-P2-001` | dedicated canvas lifecycle evidence matrix | `DEFER` | `NOT_DONE` rows in acceptance matrix |

## Gap Register

| Task ID | Priority | Gap | Status |
| --- | --- | --- | --- |
| `CZ-CANVAS-P0-001` | `P0` | startup path evidence closure | `READY` |
| `CZ-CANVAS-P1-001` | `P1` | ownership/handoff and no-hidden-write semantics in UI evidence | `WAITING_P0` |
| `CZ-CANVAS-P2-001` | `P2` | complete route/component/API/test matrix | `WAITING_P0` |

## Verdict

- docs verdict: `APPROVED_FOR_DOCS`
- runtime/test hold: `NO_GO` until `CZ-CANVAS-P0-001` evidence becomes complete

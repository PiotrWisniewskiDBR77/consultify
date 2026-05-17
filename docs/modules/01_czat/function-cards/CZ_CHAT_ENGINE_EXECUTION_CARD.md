---
module_id: MODULE_CHAT
function_id: CZ_CHAT_ENGINE
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
work_type: docs-only
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — CZ_CHAT_ENGINE

## Scope Anchor

- scope_anchor: `01_czat/CZ_CHAT_ENGINE`
- in scope: `functions/CZ_CHAT_ENGINE.md`, `07_ACCEPTANCE_AND_TESTS.md`, task board row sync
- out of scope: runtime/API/component edits

## RAW -> Decision -> Evidence Chain

| Task ID | RAW requirement | Decision | Evidence |
| --- | --- | --- | --- |
| `CZ-CHAT-P0-001` | conversational work OS must preserve source trust and bounded claims | `ENHANCE` | `RAW_TARGET_STATE_2_0_PACKET.md`, `functions/CZ_CHAT_ENGINE.md`, `07_ACCEPTANCE_AND_TESTS.md` |
| `CZ-CHAT-P1-001` | high-impact actions require proposal->approval->execution->audit | `ENHANCE` | `functions/CZ_CHAT_ENGINE.md`, `07_ACCEPTANCE_AND_TESTS.md` |
| `CZ-CHAT-P2-001` | complete workflow evidence pack | `DEFER` | `NOT_DONE` rows in acceptance matrix |

## Gap Register

| Task ID | Priority | Gap | Status |
| --- | --- | --- | --- |
| `CZ-CHAT-P0-001` | `P0` | source/provenance evidence chain normalization | `READY` |
| `CZ-CHAT-P1-001` | `P1` | approval boundary and explicit mutation semantics | `WAITING_P0` |
| `CZ-CHAT-P2-001` | `P2` | dedicated end-to-end evidence matrix | `WAITING_P0` |

## Verdict

- docs verdict: `APPROVED_FOR_DOCS`
- runtime/test hold: `BLOCKED_P1` (`CZ-CHAT-P2-001`)

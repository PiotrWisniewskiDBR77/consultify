---
module_id: MODULE_CHAT
doc_kind: IMPLEMENTATION_TASK_BOARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
scope_anchor: 01_czat/MODULE_INTEGRATION
work_type: docs-only
---

# Implementation Task Board — 01_czat

## Purpose

Track immutable-scope documentation tasks for `CZ_CHAT_ENGINE` and `CZ_CANVAS_WORKSPACE` with explicit function-card mapping.

## Source Of Truth

- module packet: `RAW_TARGET_STATE_2_0_PACKET.md`
- contracts: `00_META.md` ... `07_ACCEPTANCE_AND_TESTS.md`
- function contracts: `functions/CZ_CHAT_ENGINE.md`, `functions/CZ_CANVAS_WORKSPACE.md`
- function cards:
  - `function-cards/CZ_CHAT_ENGINE_EXECUTION_CARD.md`
  - `function-cards/CZ_CANVAS_WORKSPACE_EXECUTION_CARD.md`

## Task Index

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `CZ-CHAT-P0-001` | `01_czat/CZ_CHAT_ENGINE` | `P0` | `READY` | `docs` | none | chat governance and source-evidence chain normalization | `function-cards/CZ_CHAT_ENGINE_EXECUTION_CARD.md` |
| `CZ-CHAT-P1-001` | `01_czat/CZ_CHAT_ENGINE` | `P1` | `WAITING_P0` | `docs` | `CZ-CHAT-P0-001` | proposal->approval->execution->audit acceptance matrix tightening | `function-cards/CZ_CHAT_ENGINE_EXECUTION_CARD.md` |
| `CZ-CHAT-P2-001` | `01_czat/CZ_CHAT_ENGINE` | `P2` | `WAITING_P0` | `docs/test` | `CZ-CHAT-P0-001`,`CZ-CHAT-P1-001` | dedicated chat workflow evidence pack | `function-cards/CZ_CHAT_ENGINE_EXECUTION_CARD.md` |
| `CZ-CANVAS-P0-001` | `01_czat/CZ_CANVAS_WORKSPACE` | `P0` | `READY` | `docs` | none | startup baseline (`draft -> review -> accept/reject -> read-back`) closure contract | `function-cards/CZ_CANVAS_WORKSPACE_EXECUTION_CARD.md` |
| `CZ-CANVAS-P1-001` | `01_czat/CZ_CANVAS_WORKSPACE` | `P1` | `WAITING_P0` | `docs` | `CZ-CANVAS-P0-001` | Menu 3, provenance and owner-lane handoff normalization | `function-cards/CZ_CANVAS_WORKSPACE_EXECUTION_CARD.md` |
| `CZ-CANVAS-P2-001` | `01_czat/CZ_CANVAS_WORKSPACE` | `P2` | `WAITING_P0` | `docs/test` | `CZ-CANVAS-P0-001`,`CZ-CANVAS-P1-001` | dedicated canvas lifecycle evidence matrix | `function-cards/CZ_CANVAS_WORKSPACE_EXECUTION_CARD.md` |

## Integrity Audit

| Check | Result | Evidence |
| --- | --- | --- |
| task ID uniqueness | `PASS` | all IDs unique in `CZ-*` namespace |
| function-card mapping | `PASS` | every row maps to existing card path |
| scope anchor integrity | `PASS` | each row maps to one immutable function anchor |
| dependency policy | `PASS` | `P1/P2` depend on `P0` per function |

## Audit Verdict

- docs gate target: `APPROVED_FOR_DOCS`
- runtime gate target: `BLOCKED_P1` until `P2` evidence rows close

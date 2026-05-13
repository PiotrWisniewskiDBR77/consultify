---
module_id: MODULE_ADMIN_PANEL
doc_kind: IMPLEMENTATION_TASK_BOARD
owner_business: user
owner_tech: user
status: NEEDS_OWNER_DECISION
last_updated: 2026-05-11
scope_anchor: 17_panel-administratora/MODULE_INTEGRATION
work_type: docs-only
---

# Implementation Task Board — 17_panel-administratora

## Purpose

Track docs-only closure tasks for module 17 and bind each task to immutable function execution cards.

## Source Of Truth

- packet: `RAW_TARGET_STATE_2_0_PACKET.md`
- deep audit: `DEEP_RAW_GAP_AUDIT_2026-05-11.md`
- function contracts:
  - `functions/ADM_ADMIN_WORKSPACE.md`
  - `functions/ADM_SUPERADMIN_BOUNDARY.md`
- function cards:
  - `function-cards/ADM_ADMIN_WORKSPACE_EXECUTION_CARD.md`
  - `function-cards/ADM_SUPERADMIN_BOUNDARY_EXECUTION_CARD.md`
- acceptance matrix: `07_ACCEPTANCE_AND_TESTS.md`

## Board Rules

- one task row maps to one immutable `scope_anchor`.
- each row references existing function execution card.
- no generic PASS; every critical claim must point to route/component/contract evidence or `NOT_DONE`.
- no runtime edits are authorized by this board.

## Task Index

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ADM-RAW-P0-001` | `17_panel-administratora/ADM_SUPERADMIN_BOUNDARY` | `P0` | `NEEDS_OWNER_DECISION` | `docs/security` | none | role hierarchy allows superadmin on admin route | `function-cards/ADM_SUPERADMIN_BOUNDARY_EXECUTION_CARD.md` |
| `ADM-RAW-P0-002` | `17_panel-administratora/MODULE_INTEGRATION` | `P0` | `DOCS_RESOLVED` | `docs` | none | ownership split normalized (17 vs 18 vs superadmin) | `function-cards/ADM_ADMIN_WORKSPACE_EXECUTION_CARD.md` |
| `ADM-RAW-P1-003` | `17_panel-administratora/ADM_ADMIN_WORKSPACE` | `P1` | `DOCS_RESOLVED` | `docs` | `ADM-RAW-P0-002` | route/appview alias mapping clarified | `function-cards/ADM_ADMIN_WORKSPACE_EXECUTION_CARD.md` |
| `ADM-RAW-P1-004` | `17_panel-administratora/ADM_ADMIN_WORKSPACE` | `P1` | `NOT_DONE` | `docs/test` | `ADM-RAW-P0-002` | audit evidence for high-risk writes incomplete | `function-cards/ADM_ADMIN_WORKSPACE_EXECUTION_CARD.md` |
| `ADM-RAW-P1-005` | `17_panel-administratora/ADM_SUPERADMIN_BOUNDARY` | `P1` | `DOCS_RESOLVED` | `docs` | `ADM-RAW-P0-002` | settings/admin/superadmin handoff matrix clarified | `function-cards/ADM_SUPERADMIN_BOUNDARY_EXECUTION_CARD.md` |
| `ADM-RAW-P2-006` | `17_panel-administratora/MODULE_INTEGRATION` | `P2` | `NOT_DONE` | `docs/test` | `ADM-RAW-P0-002`,`ADM-RAW-P1-005` | ACL regression matrix evidence missing (owner/admin/member/guest) | `function-cards/ADM_SUPERADMIN_BOUNDARY_EXECUTION_CARD.md` |

## Integrity Audit

| Check | Result | Evidence |
| --- | --- | --- |
| Task ID uniqueness | `PASS` | all `ADM-RAW-*` IDs unique |
| Scope anchor uniqueness | `PASS` | one immutable anchor per row |
| Source card existence | `PASS` | every row points to an existing card in `function-cards/` |
| Critical evidence discipline | `PASS` | unresolved claims marked `NOT_DONE` or `NEEDS_OWNER_DECISION` |
| Runtime authorization | `PASS_DOCS_ONLY` | board disallows runtime edits |

## Readiness Summary

- docs closure status: `NEEDS_OWNER_DECISION`
- blocker: `ADM-RAW-P0-001`
- unresolved evidence: `ADM-RAW-P1-004`, `ADM-RAW-P2-006`

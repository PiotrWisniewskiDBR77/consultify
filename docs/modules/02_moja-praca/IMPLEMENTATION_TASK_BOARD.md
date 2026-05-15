---
module_id: MODULE_MY_WORK
doc_kind: IMPLEMENTATION_TASK_BOARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Implementation Task Board — 02_moja-praca

## Purpose

Provide one module-level index of deployable tasks while keeping detailed scope in function execution cards.

This board is not a replacement for function contracts or function execution cards.

## Source Of Truth

- function dispatch protocol: `../_FUNCTION_AGENT_DISPATCH_PROTOCOL_2026-05-10.md`
- function card template: `../_FUNCTION_EXECUTION_CARD_TEMPLATE.md`
- module packet: `RAW_TARGET_STATE_2_0_PACKET.md`
- function cards: `function-cards/*_EXECUTION_CARD.md`
- RAW workbench baseline: `docs/RAW/workbench/102_RAW_WORKBENCH_AI_SIDE_WORKSPACE_2026-05-09.md`

## Board Rules

- Each task must point to exactly one `scope_anchor`.
- Cross-module dependencies are allowed only as dependency/impact.
- If a task changes scope during execution, status becomes `BLOCKED_SCOPE_DRIFT`.
- `P0` tasks must close before `P1/P2` runtime expansion for the same function.

## Task Index

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `MW-RADAR-P0-001` | `02_moja-praca/MW_HOME_RADAR` | `P0` | `READY` | `runtime/test` | owner acceptance | route/component/test | `function-cards/MW_HOME_RADAR_EXECUTION_CARD.md` |
| `MW-RADAR-P0-002` | `02_moja-praca/MW_HOME_RADAR` | `P0` | `READY` | `runtime/test` | handoff endpoint evidence | API/test | `function-cards/MW_HOME_RADAR_EXECUTION_CARD.md` |
| `MW-RADAR-P1-001` | `02_moja-praca/MW_HOME_RADAR` | `P1` | `WAITING_P0` | `runtime/test` | `MW-RADAR-P0-*` | component/test | `function-cards/MW_HOME_RADAR_EXECUTION_CARD.md` |
| `MW-CAL-P0-001` | `02_moja-praca/MW_CALENDAR` | `P0` | `DONE_DOCS` | `docs` | owner docs acceptance | route/component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P0-002` | `02_moja-praca/MW_CALENDAR` | `P0` | `DONE_DOCS` | `docs/runtime` | `MW-CAL-P0-001` | component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P0-003` | `02_moja-praca/MW_CALENDAR` | `P0` | `DONE_DOCS` | `docs/runtime` | `MW-CAL-P0-001` | API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P0-004` | `02_moja-praca/MW_CALENDAR` | `P0` | `DONE_DOCS` | `docs/test` | `MW-CAL-P0-003` | route/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P0-005` | `02_moja-praca/MW_CALENDAR` | `P0` | `DONE_DOCS` | `docs/runtime` | `MW-CAL-P0-001` | route/component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P0-006` | `02_moja-praca/MW_CALENDAR` | `P0` | `DONE_DOCS` | `docs/runtime` | `MW-CAL-P0-001` | component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P0-007` | `02_moja-praca/MW_CALENDAR` | `P0` | `DONE_DOCS` | `docs/runtime` | `MW-CAL-P0-001`,`MW-CAL-P0-005` | component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P0-008` | `02_moja-praca/MW_CALENDAR` | `P0` | `DONE_DOCS` | `docs/runtime` | `MW-CAL-P0-001`,`MW-CAL-P0-005` | route/component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P1-001` | `02_moja-praca/MW_CALENDAR` | `P1` | `READY` | `docs/runtime` | `MW-CAL-P0-001` | component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P1-002` | `02_moja-praca/MW_CALENDAR` | `P1` | `READY` | `test` | `MW-CAL-P0-001` | route/component/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P1-003` | `02_moja-praca/MW_CALENDAR` | `P1` | `READY` | `runtime` | `MW-CAL-P0-*` | route/component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P1-004` | `02_moja-praca/MW_CALENDAR` | `P1` | `READY` | `runtime` | `MW-CAL-P0-*` | component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P1-005` | `02_moja-praca/MW_CALENDAR` | `P1` | `READY` | `runtime` | `MW-CAL-P0-*` | component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P1-006` | `02_moja-praca/MW_CALENDAR` | `P1` | `READY` | `runtime/test` | `MW-CAL-P0-*` | route/component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P1-007` | `02_moja-praca/MW_CALENDAR` | `P1` | `READY` | `runtime` | `MW-CAL-P0-*` | API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P1-008` | `02_moja-praca/MW_CALENDAR` | `P1` | `READY` | `runtime/test` | `MW-CAL-P0-*`,`MW-CAL-P1-007` | route/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P2-001` | `02_moja-praca/MW_CALENDAR` | `P2` | `WAITING_P1` | `runtime/test` | `MW-CAL-P0-*`,`MW-CAL-P1-*` | route/component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P2-002` | `02_moja-praca/MW_CALENDAR` | `P2` | `WAITING_P1` | `runtime/test` | `MW-CAL-P0-*`,`MW-CAL-P1-*` | route/component/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P2-003` | `02_moja-praca/MW_CALENDAR` | `P2` | `WAITING_P1` | `runtime/test` | `MW-CAL-P0-*`,`MW-CAL-P1-*` | component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P2-004` | `02_moja-praca/MW_CALENDAR` | `P2` | `WAITING_P1` | `runtime/test` | `MW-CAL-P0-*`,`MW-CAL-P1-*` | API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-CAL-P2-005` | `02_moja-praca/MW_CALENDAR` | `P2` | `WAITING_P1` | `runtime` | `MW-CAL-P0-*`,`MW-CAL-P1-*` | route/component/API/test | `function-cards/MW_CALENDAR_EXECUTION_CARD.md` |
| `MW-DEC-P0-001` | `02_moja-praca/MW_DECISIONS` | `P0` | `READY` | `docs` | owner docs acceptance | route/component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-DEC-P0-002` | `02_moja-praca/MW_DECISIONS` | `P0` | `READY` | `docs/runtime` | `MW-DEC-P0-001` | route/component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-DEC-P0-003` | `02_moja-praca/MW_DECISIONS` | `P0` | `READY` | `docs/runtime` | `MW-DEC-P0-002` | route/component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-DEC-P0-004` | `02_moja-praca/MW_DECISIONS` | `P0` | `READY` | `docs/runtime` | `MW-DEC-P0-001`,`MW-DEC-P0-003` | route/component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-DEC-P0-005` | `02_moja-praca/MW_DECISIONS` | `P0` | `READY` | `test` | `MW-DEC-P0-001`,`MW-DEC-P0-003`,`MW-DEC-P0-004` | route/component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-DEC-P0-006` | `02_moja-praca/MW_DECISIONS` | `P0` | `READY` | `docs` | `MW-DEC-P0-001`,`MW-DEC-P0-004` | route/component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-DEC-P1-001` | `02_moja-praca/MW_DECISIONS` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-DEC-P0-*` | route/component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-DEC-P1-002` | `02_moja-praca/MW_DECISIONS` | `P1` | `WAITING_P0` | `runtime/test` | `MW-DEC-P0-*` | route/component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-DEC-P1-003` | `02_moja-praca/MW_DECISIONS` | `P1` | `WAITING_P0` | `docs` | `MW-DEC-P0-*` | route/component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-DEC-P1-004` | `02_moja-praca/MW_DECISIONS` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-DEC-P0-002`,`MW-DEC-P0-003` | route/component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-DEC-P2-001` | `02_moja-praca/MW_DECISIONS` | `P2` | `WAITING_P0` | `runtime` | `MW-DEC-P0-*`,`MW-DEC-P1-*` | component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-DEC-P2-002` | `02_moja-praca/MW_DECISIONS` | `P2` | `WAITING_P0` | `runtime` | `MW-DEC-P0-*`,`MW-DEC-P1-*` | route/component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-DEC-P2-003` | `02_moja-praca/MW_DECISIONS` | `P2` | `WAITING_P0` | `runtime/test` | `MW-DEC-P0-*`,`MW-DEC-P1-*` | route/component/API/test | `function-cards/MW_DECISIONS_EXECUTION_CARD.md` |
| `MW-NB-P0-001` | `02_moja-praca/MW_NOTEBOOK` | `P0` | `READY` | `docs` | owner docs acceptance | route/component/API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P0-002` | `02_moja-praca/MW_NOTEBOOK` | `P0` | `READY` | `docs/runtime` | `MW-NB-P0-001` | component/API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P0-003` | `02_moja-praca/MW_NOTEBOOK` | `P0` | `READY` | `docs/runtime` | `MW-NB-P0-001` | component/API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P0-004` | `02_moja-praca/MW_NOTEBOOK` | `P0` | `READY` | `docs/runtime` | `MW-NB-P0-001` | API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P0-005` | `02_moja-praca/MW_NOTEBOOK` | `P0` | `READY` | `docs/test` | `MW-NB-P0-001` | route/component/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P0-006` | `02_moja-praca/MW_NOTEBOOK` | `P0` | `READY` | `test` | `MW-NB-P0-002`,`MW-NB-P0-004` | API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P1-001` | `02_moja-praca/MW_NOTEBOOK` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-NB-P0-*` | component/API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P1-002` | `02_moja-praca/MW_NOTEBOOK` | `P1` | `WAITING_P0` | `docs` | `MW-NB-P0-*` | API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P1-003` | `02_moja-praca/MW_NOTEBOOK` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-NB-P0-*` | route/component/API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P1-004` | `02_moja-praca/MW_NOTEBOOK` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-NB-P0-*` | route/API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P1-005` | `02_moja-praca/MW_NOTEBOOK` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-NB-P0-*` | component/API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P1-006` | `02_moja-praca/MW_NOTEBOOK` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-NB-P0-*` | component/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P1-007` | `02_moja-praca/MW_NOTEBOOK` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-NB-P0-*` | route/component/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P2-001` | `02_moja-praca/MW_NOTEBOOK` | `P2` | `WAITING_P0` | `runtime/test` | `MW-NB-P0-*`,`MW-NB-P1-*` | component/API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P2-002` | `02_moja-praca/MW_NOTEBOOK` | `P2` | `WAITING_P0` | `runtime/test` | `MW-NB-P0-*`,`MW-NB-P1-*` | route/API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P2-003` | `02_moja-praca/MW_NOTEBOOK` | `P2` | `WAITING_P0` | `runtime` | `MW-NB-P1-001` | component/API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P2-004` | `02_moja-praca/MW_NOTEBOOK` | `P2` | `WAITING_P0` | `runtime/test` | `MW-NB-P1-002`,`MW-NB-P1-004` | API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P2-005` | `02_moja-praca/MW_NOTEBOOK` | `P2` | `WAITING_P0` | `runtime/test` | `MW-NB-P1-001`,`MW-NB-P1-005` | route/component/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-NB-P2-006` | `02_moja-praca/MW_NOTEBOOK` | `P2` | `WAITING_P0` | `runtime/test` | `MW-NB-P1-*` | route/component/API/test | `function-cards/MW_NOTEBOOK_EXECUTION_CARD.md` |
| `MW-INBOX-P0-001` | `02_moja-praca/MW_INBOX` | `P0` | `READY` | `docs` | scope anchor lock + owner docs acceptance | route/component/API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P0-002` | `02_moja-praca/MW_INBOX` | `P0` | `READY` | `docs/runtime` | `MW-INBOX-P0-001` | component/API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P0-003` | `02_moja-praca/MW_INBOX` | `P0` | `READY` | `docs/runtime` | `MW-INBOX-P0-002` | route/component/API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P0-004` | `02_moja-praca/MW_INBOX` | `P0` | `READY` | `docs/runtime` | `MW-INBOX-P0-002` | component/API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P0-005` | `02_moja-praca/MW_INBOX` | `P0` | `READY` | `test` | `MW-INBOX-P0-003`,`MW-INBOX-P0-004` | route/component/API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P1-001` | `02_moja-praca/MW_INBOX` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-INBOX-P0-*` | API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P1-002` | `02_moja-praca/MW_INBOX` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-INBOX-P0-*` | component/API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P1-003` | `02_moja-praca/MW_INBOX` | `P1` | `WAITING_P0` | `runtime/test` | `MW-INBOX-P0-*` | route/component/API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P1-004` | `02_moja-praca/MW_INBOX` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-INBOX-P0-*` (dependency handoff rules) | route/component/API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P1-005` | `02_moja-praca/MW_INBOX` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-INBOX-P0-004` | component/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P2-001` | `02_moja-praca/MW_INBOX` | `P2` | `WAITING_P0` | `runtime/test` | `MW-INBOX-P1-002`,`MW-INBOX-P1-003` | component/API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P2-002` | `02_moja-praca/MW_INBOX` | `P2` | `WAITING_P0` | `runtime/test` | `MW-INBOX-P1-002`,`MW-INBOX-P1-005` | component/API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P2-003` | `02_moja-praca/MW_INBOX` | `P2` | `WAITING_P0` | `runtime/test` | `MW-INBOX-P1-001`,`MW-INBOX-P1-005` | route/component/API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-INBOX-P2-004` | `02_moja-praca/MW_INBOX` | `P2` | `WAITING_P0` | `runtime/test` | `MW-INBOX-P1-002`,`MW-INBOX-P1-003` | component/API/test | `function-cards/MW_INBOX_EXECUTION_CARD.md` |
| `MW-TASKS-P0-001` | `02_moja-praca/MW_TASKS` | `P0` | `READY` | `docs/runtime` | owner docs acceptance | route/component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P0-002` | `02_moja-praca/MW_TASKS` | `P0` | `READY` | `docs/runtime` | `MW-TASKS-P0-001` | route/component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P0-003` | `02_moja-praca/MW_TASKS` | `P0` | `READY` | `runtime/test` | `MW-TASKS-P0-001`,`MW-TASKS-P0-002` | route/component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P0-004` | `02_moja-praca/MW_TASKS` | `P0` | `READY` | `docs/runtime/test` | `MW-TASKS-P0-001`,`MW-TASKS-P0-002` | component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P0-005` | `02_moja-praca/MW_TASKS` | `P0` | `READY` | `docs/runtime` | `MW-TASKS-P0-001`,`MW-TASKS-P0-004` | component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P0-006` | `02_moja-praca/MW_TASKS` | `P0` | `READY` | `runtime/test` | `MW-TASKS-P0-001`,`MW-TASKS-P0-004`,`MW-TASKS-P0-005` | API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P0-007` | `02_moja-praca/MW_TASKS` | `P0` | `READY` | `runtime/test` | `MW-TASKS-P0-003`,`MW-TASKS-P0-004`,`MW-TASKS-P0-006` | component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P1-001` | `02_moja-praca/MW_TASKS` | `P1` | `WAITING_P0` | `runtime/test` | `MW-TASKS-P0-*` | route/component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P1-002` | `02_moja-praca/MW_TASKS` | `P1` | `WAITING_P0` | `runtime/test` | `MW-TASKS-P0-*` | component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P1-003` | `02_moja-praca/MW_TASKS` | `P1` | `WAITING_P0` | `runtime/test` | `MW-TASKS-P0-*` | route/component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P1-004` | `02_moja-praca/MW_TASKS` | `P1` | `WAITING_P0` | `docs/runtime/test` | `MW-TASKS-P0-*` | component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P1-005` | `02_moja-praca/MW_TASKS` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-TASKS-P0-*` | route/component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P1-006` | `02_moja-praca/MW_TASKS` | `P1` | `WAITING_P0` | `test` | `MW-TASKS-P0-*` | route/component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P2-001` | `02_moja-praca/MW_TASKS` | `P2` | `WAITING_P0` | `runtime/test` | `MW-TASKS-P0-*`,`MW-TASKS-P1-*` | component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P2-002` | `02_moja-praca/MW_TASKS` | `P2` | `WAITING_P0` | `runtime/test` | `MW-TASKS-P0-*`,`MW-TASKS-P1-*` | route/component/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P2-003` | `02_moja-praca/MW_TASKS` | `P2` | `WAITING_P0` | `runtime/test` | `MW-TASKS-P0-*`,`MW-TASKS-P1-*` | route/component/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P2-004` | `02_moja-praca/MW_TASKS` | `P2` | `WAITING_P0` | `runtime/test` | `MW-TASKS-P0-*`,`MW-TASKS-P1-*` | route/component/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-TASKS-P2-005` | `02_moja-praca/MW_TASKS` | `P2` | `WAITING_P0` | `runtime` | `MW-TASKS-P0-*`,`MW-TASKS-P1-*` | route/API/test | `function-cards/MW_TASKS_EXECUTION_CARD.md` |
| `MW-MM-P0-001` | `02_moja-praca/MW_IDEAS_MINDMAP` | `P0` | `READY` | `test` | owner acceptance | route/component/API/test | `function-cards/MW_IDEAS_MINDMAP_EXECUTION_CARD.md` |
| `MW-MM-P1-001` | `02_moja-praca/MW_IDEAS_MINDMAP` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-MM-P0-001` | docs/component/test | `function-cards/MW_IDEAS_MINDMAP_EXECUTION_CARD.md` |
| `MW-MM-P1-002` | `02_moja-praca/MW_IDEAS_MINDMAP` | `P1` | `WAITING_P0` | `test` | `MW-MM-P0-001` | component/test | `function-cards/MW_IDEAS_MINDMAP_EXECUTION_CARD.md` |
| `MW-TABLE-P0-001` | `02_moja-praca/MW_IDEAS_TABLE` | `P0` | `READY` | `test` | owner acceptance | route/component/API/test | `function-cards/MW_IDEAS_TABLE_EXECUTION_CARD.md` |
| `MW-TABLE-P1-001` | `02_moja-praca/MW_IDEAS_TABLE` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-TABLE-P0-001` | docs/component/test | `function-cards/MW_IDEAS_TABLE_EXECUTION_CARD.md` |
| `MW-TABLE-P1-002` | `02_moja-praca/MW_IDEAS_TABLE` | `P1` | `WAITING_P0` | `test` | `MW-TABLE-P0-001` | component/test | `function-cards/MW_IDEAS_TABLE_EXECUTION_CARD.md` |
| `MW-FLOW-P0-001` | `02_moja-praca/MW_IDEAS_PROCESS_FLOW` | `P0` | `READY` | `runtime/test` | stabilization plan approval | route/component/API/test | `function-cards/MW_IDEAS_PROCESS_FLOW_EXECUTION_CARD.md` |
| `MW-FLOW-P0-002` | `02_moja-praca/MW_IDEAS_PROCESS_FLOW` | `P0` | `READY` | `test` | current contract | API/test | `function-cards/MW_IDEAS_PROCESS_FLOW_EXECUTION_CARD.md` |
| `MW-FLOW-P1-001` | `02_moja-praca/MW_IDEAS_PROCESS_FLOW` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-FLOW-P0-*` | docs/component/test | `function-cards/MW_IDEAS_PROCESS_FLOW_EXECUTION_CARD.md` |
| `MW-WB-P0-001` | `02_moja-praca/MW_IDEAS_WHITEBOARD` | `P0` | `READY` | `test` | owner acceptance | route/component/API/test | `function-cards/MW_IDEAS_WHITEBOARD_EXECUTION_CARD.md` |
| `MW-WB-P1-001` | `02_moja-praca/MW_IDEAS_WHITEBOARD` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-WB-P0-001` | docs/component/test | `function-cards/MW_IDEAS_WHITEBOARD_EXECUTION_CARD.md` |
| `MW-WB-P1-002` | `02_moja-praca/MW_IDEAS_WHITEBOARD` | `P1` | `WAITING_P0` | `test` | `MW-WB-P0-001` | component/test | `function-cards/MW_IDEAS_WHITEBOARD_EXECUTION_CARD.md` |
| `MW-MGR-P0-001` | `02_moja-praca/MW_MANAGER` | `P0` | `READY` | `docs/runtime` | owner docs acceptance | route/component/API/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P0-002` | `02_moja-praca/MW_MANAGER` | `P0` | `READY` | `docs/runtime` | `MW-MGR-P0-001` | component/API/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P0-003` | `02_moja-praca/MW_MANAGER` | `P0` | `READY` | `docs/runtime` | `MW-MGR-P0-001`,`MW-MGR-P0-002` | route/component/API/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P0-004` | `02_moja-praca/MW_MANAGER` | `P0` | `READY` | `docs/runtime` | `MW-MGR-P0-001` | route/API/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P0-005` | `02_moja-praca/MW_MANAGER` | `P0` | `READY` | `docs/runtime` | `MW-MGR-P0-001`,`MW-MGR-P0-003` | route/component/API/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P0-006` | `02_moja-praca/MW_MANAGER` | `P0` | `READY` | `docs/test` | `MW-MGR-P0-001`,`MW-MGR-P0-005` | route/component/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P1-001` | `02_moja-praca/MW_MANAGER` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-MGR-P0-*` | component/API/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P1-002` | `02_moja-praca/MW_MANAGER` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-MGR-P0-*` | route/component/API/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P1-003` | `02_moja-praca/MW_MANAGER` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-MGR-P0-*` | component/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P1-004` | `02_moja-praca/MW_MANAGER` | `P1` | `WAITING_P0` | `docs/runtime` | `MW-MGR-P0-*` | component/API/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P1-005` | `02_moja-praca/MW_MANAGER` | `P1` | `WAITING_P0` | `test` | `MW-MGR-P0-*` | route/component/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P2-001` | `02_moja-praca/MW_MANAGER` | `P2` | `WAITING_P0` | `runtime/test` | `MW-MGR-P0-*`,`MW-MGR-P1-*` | route/component/API/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P2-002` | `02_moja-praca/MW_MANAGER` | `P2` | `WAITING_P0` | `runtime/test` | `MW-MGR-P0-*`,`MW-MGR-P1-*` | component/API/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |
| `MW-MGR-P2-003` | `02_moja-praca/MW_MANAGER` | `P2` | `WAITING_P0` | `runtime/test` | `MW-MGR-P0-*`,`MW-MGR-P1-*` | component/API/test | `function-cards/MW_MANAGER_EXECUTION_CARD.md` |

## Daily Ops Integration Scope Flag

- `IN_SCOPE_DAILY_OPS`: `MW_INBOX-*`, `MW_TASKS-*`, `MW-DEC-*`, `MW-MGR-*`.
- `OUT_OF_SCOPE_ROW`: all other prefixes in this board (`MW-RADAR-*`, `MW-CAL-*`, `MW-NB-*`, `MW-MM-*`, `MW-TABLE-*`, `MW-FLOW-*`, `MW-WB-*`) for this integration cycle.
- Normalization rule: out-of-scope rows remain unchanged in this pass and are not mixed into Daily Ops conflict resolution.

## Integration Gate Before Runtime Work

Before runtime work starts for any row:

1. Confirm the row's `scope_anchor`.
2. Read the source function execution card.
3. Confirm dependencies are not being promoted to primary scope.
4. Confirm owner acceptance for the relevant function scope.
5. Confirm evidence path is explicit.

## Current Readiness

- documentation gate: `PASS`
- function execution cards: `CREATED`
- runtime implementation: `NOT_STARTED_BY_THIS_BOARD`
- owner acceptance: `ACCEPTED_FOR_DOCS_ON_2026-05-10`

## Taskboard + Function Card Integrity Audit — 2026-05-11

| Check | Result | Evidence |
| --- | --- | --- |
| Task ID uniqueness | `PASS` | Board rows use unique task identifiers for this module. |
| Scope anchor clarity | `PASS` | Every row maps to one `02_moja-praca/<function>` scope anchor. |
| Source card existence | `PASS` | Source card paths point to existing `function-cards/*_EXECUTION_CARD.md` files. |
| Priority dependency policy | `PASS` | `P0` rows lead; `P1/P2` rows are dependency-gated by matching P0/P1 rows or explicit integration prerequisites. |
| Runtime authorization | `PASS_DOCS_ONLY` | Board records future work; it does not authorize runtime edits in this documentation pass. |

Audit note: large mixed board; Daily Ops scope flag preserves out-of-scope rows.

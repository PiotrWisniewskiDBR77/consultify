---
module_id: MODULE_INTERVIEW
doc_kind: IMPLEMENTATION_TASK_BOARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Implementation Task Board — 03_wywiad

## Purpose

Provide one module-level index of deployable tasks while keeping detailed scope in function execution cards.

## Source Of Truth

- function dispatch protocol: `../_FUNCTION_AGENT_DISPATCH_PROTOCOL_2026-05-10.md`
- function card template: `../_FUNCTION_EXECUTION_CARD_TEMPLATE.md`
- function cards: `function-cards/*_EXECUTION_CARD.md`
- function contracts: `functions/*.md`

## Board Rules

- Each task must point to exactly one `scope_anchor`.
- Cross-function dependencies are allowed only as dependency/impact.
- If a task changes scope during execution, status becomes `BLOCKED_SCOPE_DRIFT`.
- `P0` tasks must close before `P1/P2` expansion for the same function.
- Status normalization for this board: `P0=READY`, `P1/P2=WAITING_P0`.

## Task Index

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `WY-INS-P0-001` | `03_wywiad/WY_INSIGHTS` | `P0` | `READY` | `docs` | owner docs acceptance | route/component/API/test | `function-cards/WY_INSIGHTS_EXECUTION_CARD.md` |
| `WY-INS-P1-001` | `03_wywiad/WY_INSIGHTS` | `P1` | `WAITING_P0` | `runtime/test` | `WY-INS-P0-001` | route/component/API/test | `function-cards/WY_INSIGHTS_EXECUTION_CARD.md` |
| `WY-INS-P2-001` | `03_wywiad/WY_INSIGHTS` | `P2` | `WAITING_P0` | `runtime/test` | `WY-INS-P0-001`,`WY-INS-P1-001` | route/component/API/test | `function-cards/WY_INSIGHTS_EXECUTION_CARD.md` |
| `WY-INI-P0-001` | `03_wywiad/WY_INITIATIVES` | `P0` | `READY` | `docs` | owner docs acceptance | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P0-002` | `03_wywiad/WY_INITIATIVES` | `P0` | `READY` | `docs` | `WY-INI-P0-001` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P0-003` | `03_wywiad/WY_INITIATIVES` | `P0` | `READY` | `docs` | `WY-INI-P0-002` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P0-004` | `03_wywiad/WY_INITIATIVES` | `P0` | `READY` | `docs` | `WY-INI-P0-002`,`WY-INI-P0-003` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P0-005` | `03_wywiad/WY_INITIATIVES` | `P0` | `READY` | `docs` | `WY-INI-P0-003`,`WY-INI-P0-004` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P0-006` | `03_wywiad/WY_INITIATIVES` | `P0` | `READY` | `docs` | `WY-INI-P0-005` | dedicated Interview RAW source decision linked to contract + certification trace | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P1-001` | `03_wywiad/WY_INITIATIVES` | `P1` | `WAITING_P0` | `runtime/test` | `WY-INI-P0-001` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P1-002` | `03_wywiad/WY_INITIATIVES` | `P1` | `WAITING_P0` | `runtime/test` | `WY-INI-P0-002`,`WY-INI-P0-005` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P1-003` | `03_wywiad/WY_INITIATIVES` | `P1` | `WAITING_P0` | `runtime/test` | `WY-INI-P0-003` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P1-004` | `03_wywiad/WY_INITIATIVES` | `P1` | `WAITING_P0` | `runtime/test` | `WY-INI-P0-004`,`WY-INI-P1-003` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P1-005` | `03_wywiad/WY_INITIATIVES` | `P1` | `WAITING_P0` | `test` | `WY-INI-P1-002`,`WY-INI-P1-003`,`WY-INI-P1-004` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P2-001` | `03_wywiad/WY_INITIATIVES` | `P2` | `WAITING_P0` | `runtime/test` | `WY-INI-P0-001`,`WY-INI-P1-001` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P2-002` | `03_wywiad/WY_INITIATIVES` | `P2` | `WAITING_P0` | `runtime/test` | `WY-INI-P1-004`,`WY-INI-P1-005` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P2-003` | `03_wywiad/WY_INITIATIVES` | `P2` | `WAITING_P0` | `runtime/test` | `WY-INI-P1-003`,`WY-INI-P2-002` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-INI-P2-004` | `03_wywiad/WY_INITIATIVES` | `P2` | `WAITING_P0` | `runtime/test` | `WY-INI-P2-002`,`WY-INI-P2-003` | route/component/API/test | `function-cards/WY_INITIATIVES_EXECUTION_CARD.md` |
| `WY-MYA-P0-001` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P0` | `READY` | `docs` | owner docs acceptance | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P0-002` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P0` | `READY` | `docs/runtime` | `WY-MYA-P0-001` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P0-003` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P0` | `READY` | `docs/runtime` | `WY-MYA-P0-002` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P0-004` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P0` | `READY` | `docs/runtime` | `WY-MYA-P0-002` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P0-005` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P0` | `READY` | `test` | `WY-MYA-P0-003`,`WY-MYA-P0-004` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P1-001` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P1` | `WAITING_P0` | `runtime/test` | `WY-MYA-P0-001` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P1-002` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P1` | `WAITING_P0` | `docs/runtime` | `WY-MYA-P0-*` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P1-003` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P1` | `WAITING_P0` | `runtime/test` | `WY-MYA-P0-*` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P1-004` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P1` | `WAITING_P0` | `docs/runtime` | `WY-MYA-P0-*` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P1-005` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P1` | `WAITING_P0` | `runtime/test` | `WY-MYA-P0-*` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P2-001` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P2` | `WAITING_P0` | `runtime/test` | `WY-MYA-P0-001`,`WY-MYA-P1-001` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P2-002` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P2` | `WAITING_P0` | `runtime/test` | `WY-MYA-P1-002`,`WY-MYA-P1-003` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P2-003` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P2` | `WAITING_P0` | `runtime/test` | `WY-MYA-P1-004`,`WY-MYA-P1-005` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P2-004` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P2` | `WAITING_P0` | `runtime/test` | `WY-MYA-P1-*` | route/component/API/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MYA-P2-005` | `03_wywiad/WY_MY_ASSIGNMENTS` | `P2` | `WAITING_P0` | `runtime/test` | `WY-MYA-P1-002`,`WY-MYA-P1-005` | route/component/test | `function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MGA-P0-001` | `03_wywiad/WY_MANAGED_ASSIGNMENTS` | `P0` | `READY` | `docs` | owner docs acceptance | route/component/API/test | `function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MGA-P0-002` | `03_wywiad/WY_MANAGED_ASSIGNMENTS` | `P0` | `READY` | `docs` | `WY-MGA-P0-001` | route/component/API/test | `function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MGA-P0-003` | `03_wywiad/WY_MANAGED_ASSIGNMENTS` | `P0` | `READY` | `docs` | `WY-MGA-P0-001` | route/component/API/test | `function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MGA-P1-001` | `03_wywiad/WY_MANAGED_ASSIGNMENTS` | `P1` | `WAITING_P0` | `runtime/test` | `WY-MGA-P0-001`,`WY-MGA-P0-002`,`WY-MGA-P0-003` | route/component/API/test | `function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MGA-P1-002` | `03_wywiad/WY_MANAGED_ASSIGNMENTS` | `P1` | `WAITING_P0` | `runtime/test` | `WY-MGA-P0-001`,`WY-MGA-P0-002`,`WY-MGA-P0-003` | route/component/API/test | `function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MGA-P1-003` | `03_wywiad/WY_MANAGED_ASSIGNMENTS` | `P1` | `WAITING_P0` | `runtime/test` | `WY-MGA-P0-001`,`WY-MGA-P0-002`,`WY-MGA-P0-003` | route/component/API/test | `function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MGA-P1-004` | `03_wywiad/WY_MANAGED_ASSIGNMENTS` | `P1` | `WAITING_P0` | `runtime/test` | `WY-MGA-P0-001`,`WY-MGA-P0-002`,`WY-MGA-P0-003` | route/component/API/test | `function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MGA-P2-001` | `03_wywiad/WY_MANAGED_ASSIGNMENTS` | `P2` | `WAITING_P0` | `runtime/test` | `WY-MGA-P0-001`,`WY-MGA-P1-001` | route/component/API/test | `function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MGA-P2-002` | `03_wywiad/WY_MANAGED_ASSIGNMENTS` | `P2` | `WAITING_P0` | `runtime/test` | `WY-MGA-P0-002`,`WY-MGA-P1-001`,`WY-MGA-P1-002` | route/component/API/test | `function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MGA-P2-003` | `03_wywiad/WY_MANAGED_ASSIGNMENTS` | `P2` | `WAITING_P0` | `runtime/test` | `WY-MGA-P0-003`,`WY-MGA-P1-003` | route/component/API/test | `function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-MGA-P2-004` | `03_wywiad/WY_MANAGED_ASSIGNMENTS` | `P2` | `WAITING_P0` | `runtime/test` | `WY-MGA-P0-001`,`WY-MGA-P1-001`,`WY-MGA-P1-002`,`WY-MGA-P1-003`,`WY-MGA-P1-004` | route/component/API/test | `function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md` |
| `WY-SES-P0-001` | `03_wywiad/WY_SESSIONS` | `P0` | `READY` | `docs` | owner docs acceptance | route/component/API/test | `function-cards/WY_SESSIONS_EXECUTION_CARD.md` |
| `WY-SES-P1-001` | `03_wywiad/WY_SESSIONS` | `P1` | `WAITING_P0` | `runtime/test` | `WY-SES-P0-001` | route/component/API/test | `function-cards/WY_SESSIONS_EXECUTION_CARD.md` |
| `WY-SES-P2-001` | `03_wywiad/WY_SESSIONS` | `P2` | `WAITING_P0` | `runtime/test` | `WY-SES-P0-001`,`WY-SES-P1-001` | route/component/API/test | `function-cards/WY_SESSIONS_EXECUTION_CARD.md` |
| `WY-TPL-P0-001` | `03_wywiad/WY_TEMPLATES` | `P0` | `READY` | `docs` | owner docs acceptance | route/component/API/test | `function-cards/WY_TEMPLATES_EXECUTION_CARD.md` |
| `WY-TPL-P1-001` | `03_wywiad/WY_TEMPLATES` | `P1` | `WAITING_P0` | `runtime/test` | `WY-TPL-P0-001` | route/component/API/test | `function-cards/WY_TEMPLATES_EXECUTION_CARD.md` |
| `WY-TPL-P2-001` | `03_wywiad/WY_TEMPLATES` | `P2` | `WAITING_P0` | `runtime/test` | `WY-TPL-P0-001`,`WY-TPL-P1-001` | route/component/API/test | `function-cards/WY_TEMPLATES_EXECUTION_CARD.md` |
| `WY-PRV-P0-001` | `03_wywiad/WY_PENDING_REVIEW` | `P0` | `READY` | `docs` | owner docs acceptance | route/component/API/test | `function-cards/WY_PENDING_REVIEW_EXECUTION_CARD.md` |
| `WY-PRV-P1-001` | `03_wywiad/WY_PENDING_REVIEW` | `P1` | `WAITING_P0` | `runtime/test` | `WY-PRV-P0-001` | route/component/API/test | `function-cards/WY_PENDING_REVIEW_EXECUTION_CARD.md` |
| `WY-PRV-P2-001` | `03_wywiad/WY_PENDING_REVIEW` | `P2` | `WAITING_P0` | `runtime/test` | `WY-PRV-P0-001`,`WY-PRV-P1-001` | route/component/API/test | `function-cards/WY_PENDING_REVIEW_EXECUTION_CARD.md` |

## Current Readiness

- documentation gate: `PASS`
- function execution cards: `CREATED_FOR_SCOPE_ANCHOR`
- runtime implementation: `NOT_STARTED_BY_THIS_BOARD`
- owner acceptance: `APPROVED_FOR_IMPLEMENTATION`

## Taskboard + Function Card Integrity Audit — 2026-05-11

| Check | Result | Evidence |
| --- | --- | --- |
| Task ID uniqueness | `PASS` | Board rows use unique task identifiers for this module. |
| Scope anchor clarity | `PASS` | Every row maps to one `03_wywiad/<function>` scope anchor. |
| Source card existence | `PASS` | Source card paths point to existing `function-cards/*_EXECUTION_CARD.md` files. |
| Priority dependency policy | `PASS` | `P0` rows lead; `P1/P2` rows are dependency-gated by matching P0/P1 rows or explicit integration prerequisites. |
| Runtime authorization | `PASS_DOCS_ONLY` | Board records future work; it does not authorize runtime edits in this documentation pass. |

Audit note: Interview task rows map to function cards and use P0/P1/P2 sequencing.

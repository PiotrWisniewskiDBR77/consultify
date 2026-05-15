---
doc_kind: PROGRAM_STATUS_GLOSSARY
owner: user
status: active
last_updated: 2026-05-11
scope: implementation-and-testing-statuses
work_type: governance
---

# Program Status Glossary

## 1. Why this file exists

Rollout currently mixes multiple status vocabularies across:

- module boards,
- global gates,
- testing queue/control board,
- integration reports.

This glossary is the canonical mapping layer.

## 2. Canonical Program Statuses

| Status | Meaning | Allowed in |
| --- | --- | --- |
| `READY` | Item is approved to start. | program/module/test boards |
| `IN_PROGRESS` | Work is actively executed. | program/module/test boards |
| `WAITING_DEPENDENCY` | Blocked by upstream item. | program/module boards |
| `WAITING_OWNER_DECISION` | Requires explicit owner/security decision. | program/module/gate boards |
| `BLOCKED_P1` | Functional blocker, cannot be treated as done. | program/module/test/gate boards |
| `PASS` | Requirement is fully evidenced. | gates/tests |
| `PASS_WITH_P2` | Non-critical hardening backlog remains. | gates/tests |
| `INCONCLUSIVE` | Evidence is insufficient for decision. | gates/tests |
| `NO_GO` | Hard-stop condition reached. | gates/release |
| `NOT_DONE` | Not implemented/proven yet; explicitly tracked. | contracts/acceptance/gates |

## 3. Legacy-to-Canonical Mapping

| Legacy label | Canonical label | Notes |
| --- | --- | --- |
| `PASS_WITH_LIMITATIONS` | `PASS_WITH_P2` | Use only canonical label in new updates. |
| `BLOCKED` | `BLOCKED_P1` | Keep severity explicit. |
| `DONE_PASS` | `PASS` | Testing queue normalization. |
| `DONE_PASS_WITH_LIMITATIONS` | `PASS_WITH_P2` | Testing queue normalization. |
| `RETEST_REQUIRED` | `WAITING_DEPENDENCY` or `IN_PROGRESS` | choose based on owner availability |
| `PENDING_OWNER_DECISION` | `WAITING_OWNER_DECISION` | unified governance wording |

## 4. Mandatory Status Rules

1. Any unresolved critical claim must be `NOT_DONE`, not implicit PASS.
2. Any runtime blocker in rollout path must be `BLOCKED_P1`.
3. Any unresolved security or ownership policy must be `WAITING_OWNER_DECISION`.
4. `NO_GO` can be lifted only through new evidence + gate review entry.

## 5. Authority Order

When statuses conflict, precedence is:

1. Program Gate Board (`_PROGRAM_GATE_BOARD_G1_G7_2026-05-11.md`)
2. Program Board (`_PROGRAM_BOARD_FULL_ROLLOUT_2026-05-11.md`)
3. Module task board
4. Test queue operational status

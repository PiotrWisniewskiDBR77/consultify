---
doc_kind: AGENT_DISPATCH_AND_MEMORY_PLAYBOOK
owner: user
status: active
last_updated: 2026-05-12
scope: full-program-multi-agent-execution
work_type: operations
---

# Agent Dispatch and Memory Playbook

## 1. Operating Model

- `Agent-0` (this chat): dispatcher only, no implementation tasks.
- Execution is done only by dedicated agents.
- Maximum concurrent execution agents: `2`.

## 2. Agent Types and Responsibilities

| Agent type | Responsibility | Forbidden |
| --- | --- | --- |
| `Agent-0 Dispatcher` | assign tasks, track gates, reconcile statuses, approve next dispatch | code/docs implementation |
| `Agent-A Runtime` | implement runtime changes in assigned module scope | cross-module refactor outside assigned scope |
| `Agent-B Contracts` | update module docs/contracts/boards for assigned scope | runtime edits outside assigned scope |
| `Agent-T Test` | run automation/manual prep, collect evidence packs | changing feature logic unless explicitly assigned as hotfix |
| `Agent-I Integration` | verify `G1..G7` and compile wave verdict | implementing backlog items directly |

## 2A. Model Selection by Task Difficulty

Model routing is mandatory and follows:

- `_MODEL_ROUTING_MATRIX_2026-05-12.md`

Dispatcher must assign each card:

1. difficulty class (`L1_STANDARD` / `L2_COMPLEX` / `L3_CRITICAL`),
2. model (`codex 5.3` / `gpt 5.5` / `opus 4.7`),
3. escalation reason when not `codex 5.3`.

## 3. Dispatch Unit (one assignment card)

Every new agent gets one immutable assignment card:

1. `scope_anchor`,
2. exact file list (`allowed_files`),
3. expected outputs,
4. test obligations,
5. explicit out-of-scope,
6. stop conditions.

No assignment card -> no start.

## 4. When to Launch New Agents

### Rule A — Launch by gate stage, not by urgency

- new execution agent launches only when current gate inputs are complete,
- no launch on ambiguous ownership,
- no launch when previous gate verdict is `BLOCKED_P1` or `INCONCLUSIVE`.

### Rule B — Launch sequence per wave

| Wave stage | Agent-1 | Agent-2 | Launch condition |
| --- | --- | --- | --- |
| `Wave0` decisions | Contracts/Governance | Integration | start after `GB-P0` priorities confirmed |
| `Wave1` delivery runtime | Runtime (`09/10/11/12` split by scope) | Test | start after P0 decisions closed |
| `Wave2` Teresa OS | Runtime | Test | start after Wave1 gate pass |
| `Wave3+` | Runtime | Contracts/Test | start after previous wave exit review |

### Rule D — Launch gate includes model fit

Before launching a new agent, dispatcher validates:

1. scope fit,
2. WIP availability,
3. gate readiness,
4. model fit from `_MODEL_ROUTING_MATRIX_2026-05-12.md`.

### Rule C — Replace, do not stack

- if 2 agents are active, do not launch third,
- finish or stop one stream before new launch.

## 5. Task-to-Agent Assignment Matrix

| Task class | Assign to | Example |
| --- | --- | --- |
| Runtime route/component/API change | `Agent-A Runtime` | `UnifiedChatPanel`, runtime lane behavior |
| Contract and board sync | `Agent-B Contracts` | `04_UI_UX`, `07_ACCEPTANCE_AND_TESTS`, task board |
| Gate test execution and evidence | `Agent-T Test` | Playwright + manual prompt + evidence pack |
| Gate and release decision | `Agent-I Integration` | `G1..G7` verdict and wave exit |

## 6. Memory and Focus Management

### Chat memory isolation

- one agent chat = one assignment card,
- never reuse an old chat for a different scope,
- new scope always means new execution agent chat.

### Naming convention

`W<wave>-M<module>-<scope>-<YYYYMMDD>`

Example:

`W1-M10-DOC_RUNTIME_HANDOFF-20260512`

### Context packet for each agent

Dispatcher must pass only:

1. assignment card,
2. required source docs,
3. target files,
4. test checklist for this scope,
5. required output format.

No broad historical dump unless directly needed.

## 7. Stop-the-Line Rules

Immediate stop and hand back to dispatcher when:

1. scope collision detected,
2. ownership conflict appears,
3. evidence cannot be produced,
4. security/tenant boundary is unclear,
5. required source of truth is missing.

## 8. Dispatcher Daily Protocol

At each cycle:

1. check active streams (`max=2`),
2. verify gate state and blockers,
3. assign next card or hold,
4. reconcile statuses across program/module/test boards,
5. publish one-line wave status:
   - done,
   - blocked,
   - next dispatch.

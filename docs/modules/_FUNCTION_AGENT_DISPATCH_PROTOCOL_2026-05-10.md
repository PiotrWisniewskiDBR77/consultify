---
doc_id: FUNCTION_AGENT_DISPATCH_PROTOCOL_2026_05_10
doc_kind: EXECUTION_GOVERNANCE_PROTOCOL
owner: user
status: active
last_updated: 2026-05-10
---

# Function Agent Dispatch Protocol

## Purpose

Prevent scope drift when multiple agents work on module functions in parallel or sequence.

This protocol is mandatory for every function-level documentation or implementation-planning agent.

## Core Rule

One agent receives exactly one immutable `scope_anchor`.

Example:

- `scope_anchor: 02_moja-praca/MW_IDEAS_MINDMAP`

The `scope_anchor` is the primary work boundary. Other modules or functions may be referenced only as dependency or impact context.

## Dispatch Fields Required In Every Agent Prompt

Every function agent prompt MUST include:

- `scope_anchor`: exact module/function under work,
- `primary_module`: module that owns the function,
- `primary_function`: function contract under work,
- `dependency_scope`: modules/functions allowed only for evidence, context, or impact,
- `forbidden_scope`: modules/functions the agent must not edit,
- `deliverables_exact`: exact files the agent may update,
- `done_gate`: validation and review conditions.

If any field is missing, the agent must stop with `BLOCKED_SCOPE_UNCLEAR`.

## Scope Drift Rule

The agent must stop with `BLOCKED_SCOPE_DRIFT` when:

- the current work target differs from `scope_anchor`,
- a TODO, previous summary, or recently edited file points to a different module/function,
- the agent starts updating a dependency module as if it were the primary scope,
- a module packet contains multiple addenda and the active function is ambiguous,
- a runtime implementation task appears while the prompt says documentation-only.

The agent may continue only after the owner explicitly confirms the corrected `scope_anchor`.

## Function Execution Card

Each function-level cycle SHOULD create or update a function execution card before producing implementation tasks.

Recommended path:

`docs/modules/<module>/function-cards/<function_id>_EXECUTION_CARD.md`

Minimum required sections:

1. Metadata
2. Scope Anchor
3. Dependency Scope
4. Forbidden Scope
5. Source Inputs
6. Decision Matrix (`KEEP / ENHANCE / NEW / DEFER`)
7. UI/UX Component Contract
8. Implementation Backlog (`P0 / P1 / P2`)
9. Evidence Plan (`route / component / API / test`)
10. Cross-Module Impact
11. Done Gate
12. Open Questions

## Function Execution Card Template

```md
---
module_id:
function_id:
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: DRAFT
last_updated:
---

# Function Execution Card — <function_id>

## 1. Metadata

- scope_anchor:
- primary_module:
- primary_function:
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only | implementation-planning | runtime-implementation`

## 2. Scope Anchor

- In scope:
- Out of scope:
- Immutable rule:

## 3. Dependency Scope

Dependencies are read/impact-only unless explicitly promoted by owner decision.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
|  |  |  |

## 4. Source Inputs

- RAW sources:
- module contracts:
- function contracts:
- runtime evidence sources:

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision (`KEEP/ENHANCE/NEW/DEFER`) | Rationale |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## 6. UI/UX Component Contract

- approved shell/component family:
- Menu 2 surface:
- Menu 3 actions:
- runtime states:
- source/provenance/evidence UI:
- anti-patterns:

## 7. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
|  | `P0/P1/P2` | `docs/runtime/test` |  |  | `route/component/API/test` |  |

## 8. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## 9. Cross-Module Impact

- impacted modules:
- handoff changes:
- ownership impact:
- security/tenant impact:
- E2E workflow impact:

## 10. Done Gate

- contract complete:
- UI/UX complete:
- evidence complete:
- impact complete:
- owner acceptance:

## 11. Open Questions

1.
2.
3.
```

## Prompt Instruction Snippet

Add this block to every future function-agent prompt:

```text
SCOPE DRIFT GUARD
- Your immutable scope_anchor is: <module>/<function_id>.
- Treat all other modules/functions as dependency_scope only unless explicitly listed in deliverables_exact.
- If TODOs, summaries, previous files, or module packets point to another scope, stop and report BLOCKED_SCOPE_DRIFT.
- Do not continue by guessing the intended target.
- Do not edit runtime code unless work_type explicitly allows runtime implementation.
```

## Implementation Management Rule

Module packets describe the module-level program.

Function execution cards manage deployable work.

Do not use a mixed module packet as the primary implementation backlog when multiple functions are present.

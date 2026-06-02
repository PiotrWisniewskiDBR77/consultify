---
module_id: MODULE_EXECUTION
function_id: RL_EXECUTION_PORTFOLIO
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — RL_EXECUTION_PORTFOLIO

## 1. Metadata

- scope_anchor: `06_realizacja/RL_EXECUTION_PORTFOLIO`
- primary_module: `06_realizacja`
- primary_function: `RL_EXECUTION_PORTFOLIO`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: portfolio runtime contract and evidence binding for `/implementation` list lane.
- Out of scope: reports lane, manager lane and rollout runtime implementation.
- Immutable rule: one function scope only (`06_realizacja/RL_EXECUTION_PORTFOLIO`).

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `RL_EXECUTION_REPORTS` | impact note for shared hub shell | editing reports as primary scope |
| `RL_EXECUTION_MANAGER` | impact note for shared hub shell | editing manager as primary scope |

## 4. Source Inputs

- `docs/modules/06_realizacja/functions/RL_EXECUTION_PORTFOLIO.md`
- `docs/modules/06_realizacja/03_BEHAVIOR.md`
- `docs/modules/06_realizacja/04_UI_UX.md`
- `docs/modules/06_realizacja/07_ACCEPTANCE_AND_TESTS.md`

## 5. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `RL-PORT-P0-001` | `P0` | `docs/test` | Lock Menu 3/AI placement doctrine and no-duplicate-toolbar rule. | owner docs acceptance | route/component/API/test | contract/UI/impact complete |
| `RL-PORT-P1-001` | `P1` | `test` | Add/collect protected-route and state-surface evidence for `/implementation`. | `RL-PORT-P0-001` | route/component/test | waiting for P0 close |
| `RL-PORT-P2-001` | `P2` | `docs/test` | Enrich table/kanban/timeline evidence package and close residual gaps. | `RL-PORT-P0-001`,`RL-PORT-P1-001` | route/component/API/test | waiting for P0 close |

## 6. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Portfolio entrypoint is `/implementation` list lane. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Execution/ExecutionHub.tsx` (`list`) | shared execution APIs | route smoke baseline | `PASS_WITH_P2` |
| AI controls remain Menu 3/right-side or row-scoped. | `/implementation` | `ExecutionHub` right controls + row actions | n/a | UI placement evidence pending | `BLOCKED_P1` |

## 7. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS_WITH_P2`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- owner acceptance: `ACCEPTED_FOR_DOCS_ON_2026-05-10`

---
module_id: MODULE_EXECUTION
function_id: RL_EXECUTION_MANAGER
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — RL_EXECUTION_MANAGER

## 1. Metadata

- scope_anchor: `06_realizacja/RL_EXECUTION_MANAGER`
- primary_module: `06_realizacja`
- primary_function: `RL_EXECUTION_MANAGER`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: manager/control-tower lane contract for `/implementation` tab `people_change`.
- Out of scope: report finalization and rollout timeline mutations.
- Immutable rule: one function scope only (`06_realizacja/RL_EXECUTION_MANAGER`).

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `RL_EXECUTION_PORTFOLIO` | impact-only for shared route shell | editing portfolio as primary scope |
| `02_moja-praca/MW_MANAGER` | impact-only manager pattern alignment | editing My Work contracts |

## 4. Source Inputs

- `docs/modules/06_realizacja/functions/RL_EXECUTION_MANAGER.md`
- `docs/modules/06_realizacja/03_BEHAVIOR.md`
- `docs/modules/06_realizacja/06_PERMISSIONS_AND_SECURITY.md`
- `docs/modules/06_realizacja/07_ACCEPTANCE_AND_TESTS.md`

## 5. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `RL-MGR-P0-001` | `P0` | `docs/test` | Lock explicit approval/provenance/read-back doctrine for high-impact actions. | owner docs acceptance | route/component/API/test | contract/security complete |
| `RL-MGR-P1-001` | `P1` | `docs/test` | Validate manager lane source rendering and action audit evidence. | `RL-MGR-P0-001` | route/component/API/test | waiting for P0 close |
| `RL-MGR-P2-001` | `P2` | `docs/test` | Expand six-lane UI state evidence and regressions. | `RL-MGR-P0-001`,`RL-MGR-P1-001` | route/component/API/test | waiting for P0 close |

## 6. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Manager lane lives in `/implementation` tab `people_change`. | route mappings for `/implementation` | `ExecutionManagementView`, `ManagerModuleView` | manager endpoints in V8 execution-control | manager route tests baseline | `PASS_WITH_P2` |
| High-impact manager writes are explicit and reviewable. | `/implementation` | manager action handlers and previews | manager mutation APIs + context scope | approval/provenance UI evidence pending | `BLOCKED_P1` |

## 7. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS_WITH_P2`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- owner acceptance: `ACCEPTED_FOR_DOCS_ON_2026-05-10`

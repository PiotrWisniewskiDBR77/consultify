---
module_id: MODULE_EXECUTION
function_id: RL_ROLLOUT_VIEW
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — RL_ROLLOUT_VIEW

## 1. Metadata

- scope_anchor: `06_realizacja/RL_ROLLOUT_VIEW`
- primary_module: `06_realizacja`
- primary_function: `RL_ROLLOUT_VIEW`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: rollout route contract for baseline/current/forecast and intervention flows on `/rollout`.
- Out of scope: report finalization and manager lane mutation details.
- Immutable rule: one function scope only (`06_realizacja/RL_ROLLOUT_VIEW`).

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `RL_FULL_EXECUTION_VIEW` | impact-only route family alignment | editing `/execution` as primary scope |
| `07_rezultaty` | impact-only downstream realized-value handoff note | editing results contracts |

## 4. Source Inputs

- `docs/modules/06_realizacja/functions/RL_ROLLOUT_VIEW.md`
- `docs/modules/06_realizacja/03_BEHAVIOR.md`
- `docs/modules/06_realizacja/04_UI_UX.md`
- `docs/modules/06_realizacja/05_DATA_AND_INTEGRATIONS.md`

## 5. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `RL-ROL-P0-001` | `P0` | `docs/test` | Lock proposal/review contract for auto-schedule/optimizer/conflict actions. | owner docs acceptance | route/component/API/test | contract/safety complete |
| `RL-ROL-P1-001` | `P1` | `docs/test` | Validate rollout state matrix and degraded-state signaling. | `RL-ROL-P0-001` | route/component/API/test | waiting for P0 close |
| `RL-ROL-P2-001` | `P2` | `docs/test` | Expand timeline/baseline evidence and read-back package. | `RL-ROL-P0-001`,`RL-ROL-P1-001` | route/component/API/test | waiting for P0 close |

## 6. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `/rollout` route is active and explicit. | route mappings and wrapper | `FullRolloutView`, `FullRolloutWorkspace` | execution-control timeline/capacity APIs where wired | route protection evidence exists | `PASS_WITH_P2` |
| High-impact rollout actions are explicit proposal/review flows. | `/rollout` action entrypoints | rollout action controls and dialogs | timeline update/intervention endpoints | proposal/review UI evidence pending | `BLOCKED_P1` |

## 7. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS_WITH_P2`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- owner acceptance: `ACCEPTED_FOR_DOCS_ON_2026-05-10`

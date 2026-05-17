---
module_id: MODULE_INITIATIVES
function_id: IN_PORTFOLIO_HUB
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — IN_PORTFOLIO_HUB

## 1. Metadata

- scope_anchor: `05_inicjatywy/IN_PORTFOLIO_HUB`
- primary_module: `05_inicjatywy`
- primary_function: `IN_PORTFOLIO_HUB`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: `/initiatives` portfolio hub lifecycle, card behavior and capability-driven action contract.
- Out of scope: runtime implementation in `src/**`, `server/**`, `tests/**`.
- Immutable rule: one scope anchor only.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `IN_ANALYSIS_WORKSPACE` | impact-only alignment on card/readiness signals | editing analysis as primary scope |
| `06_realizacja` | handoff/read-back impact context | editing execution contracts |

## 4. Source Inputs

- `functions/IN_PORTFOLIO_HUB.md`
- `03_BEHAVIOR.md`
- `04_UI_UX.md`
- `07_ACCEPTANCE_AND_TESTS.md`
- `IMPLEMENTATION_TASK_BOARD.md`

## 5. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `IN-HUB-P0-001` | `P0` | `test` | Add `/initiatives` card lifecycle smoke for open/preview/detail and guarded states. | owner acceptance | route/component/API/test | evidence complete |
| `IN-HUB-P0-002` | `P0` | `runtime/test` | Validate capability-driven CTAs and AI availability from backend capabilities. | `IN-HUB-P0-001` | route/component/API/test | capability evidence complete |
| `IN-HUB-P0-003` | `P0` | `runtime/test` | Validate read-back/toast/refresh behavior for create/edit/status flows. | `IN-HUB-P0-001`,`IN-HUB-P0-002` | route/component/API/test | read-back evidence complete |
| `IN-HUB-P0-004` | `P0` | `docs/runtime/test` | Prepare owner acceptance package with handoff/read-back evidence. | `IN-HUB-P0-002`,`IN-HUB-P0-003` | route/component/API/test | owner acceptance complete |
| `IN-HUB-P1-001` | `P1` | `docs/runtime/test` | Resolve source-envelope taxonomy across all accepted source families. | `IN-HUB-P0-*` | route/component/API/test | waiting for P0 close |
| `IN-HUB-P1-002` | `P1` | `docs/runtime/test` | Lock decision-to-initiative conversion contract with explicit approval/read-back. | `IN-HUB-P0-*` | route/component/API/test | waiting for P0 close |
| `IN-HUB-P2-001` | `P2` | `docs/test` | Add visual evidence baseline and status/color audit for initiative cards. | `IN-HUB-P0-*`,`IN-HUB-P1-*` | route/component/API/test | waiting for P0/P1 close |

## 6. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS_DOC`
- evidence complete: `PASS_DOC_WITH_MISSING_RUNTIME_EVIDENCE`
- implementation backlog ready: `PASS`
- owner acceptance: `PENDING_FOR_RUNTIME_ROWS`

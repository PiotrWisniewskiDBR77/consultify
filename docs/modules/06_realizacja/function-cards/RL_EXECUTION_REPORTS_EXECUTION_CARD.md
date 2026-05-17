---
module_id: MODULE_EXECUTION
function_id: RL_EXECUTION_REPORTS
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — RL_EXECUTION_REPORTS

## 1. Metadata

- scope_anchor: `06_realizacja/RL_EXECUTION_REPORTS`
- primary_module: `06_realizacja`
- primary_function: `RL_EXECUTION_REPORTS`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: report catalog/runtime evidence contract for `/implementation` reports lane.
- Out of scope: portfolio mutations, manager interventions and rollout execution logic.
- Immutable rule: one function scope only (`06_realizacja/RL_EXECUTION_REPORTS`).

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `RL_EXECUTION_PORTFOLIO` | impact note for shared route shell | editing portfolio as primary scope |
| `07_rezultaty` | impact-only for downstream report consumption | editing results module contracts |

## 4. Source Inputs

- `docs/modules/06_realizacja/functions/RL_EXECUTION_REPORTS.md`
- `docs/modules/06_realizacja/04_UI_UX.md`
- `docs/modules/06_realizacja/05_DATA_AND_INTEGRATIONS.md`
- `docs/modules/06_realizacja/07_ACCEPTANCE_AND_TESTS.md`

## 5. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `RL-REP-P0-001` | `P0` | `runtime/test` | Enforce `missing_evidence` for source-less report output. | owner docs acceptance | route/component/API/test | contract/evidence complete |
| `RL-REP-P0-002` | `P0` | `docs` | Synchronize function packet/board with RAW semantic + world-class certification verdict while preserving `NO_DONE_WITH_NOT_DONE_EVIDENCE`. | `RL-REP-P0-001` | function card + packet + certification report consistency | contract/evidence complete |
| `RL-REP-P1-001` | `P1` | `test` | Validate loading/empty/error/degraded/missing-evidence/success matrix. | `RL-REP-P0-001` | route/component/API/test | waiting for P0 close |
| `RL-REP-P2-001` | `P2` | `docs/test` | Expand screenshot/trace evidence for table, grid and document report states. | `RL-REP-P0-001`,`RL-REP-P1-001` | route/component/API/test | waiting for P0 close |

## 6. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Reports lane is a fixed catalog on `/implementation`. | `routeConfig.ts`, `AppRoutes.tsx` | `ExecutionHub` reports tab and `ReportDocumentView` | `api/v8/execution-control` sources | report catalog assertions pending | `PASS_WITH_P2` |
| Source-less reports cannot present clean success. | `/implementation` | report quality footer/state mapping | execution-control source envelopes | missing-evidence regression pending | `BLOCKED_P1` |

## 7. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS_WITH_P2`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- owner acceptance: `ACCEPTED_FOR_DOCS_ON_2026-05-10`

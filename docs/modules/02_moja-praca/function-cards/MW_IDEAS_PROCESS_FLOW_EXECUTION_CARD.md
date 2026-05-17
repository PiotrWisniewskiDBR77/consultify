---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_PROCESS_FLOW
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — MW_IDEAS_PROCESS_FLOW

## 1. Metadata

- scope_anchor: `02_moja-praca/MW_IDEAS_PROCESS_FLOW`
- primary_module: `02_moja-praca`
- primary_function: `MW_IDEAS_PROCESS_FLOW`
- parent_function: `MW_IDEAS`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: Idea Flow contract, flow-specific module rows, flow stabilization plan reference.
- Out of scope: BPM module, runtime implementation, other Idea format backlogs.
- Immutable rule: Flow is executable logic format inside `MW_IDEAS`, not owner of downstream execution lifecycle.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `MW_IDEAS_MINDMAP` | concept-to-sequence transform | editing Mind Map scope |
| `MW_IDEAS_TABLE` | row-to-flow transform | editing Table scope |
| `MW_IDEAS_WHITEBOARD` | workshop-to-flow transform | editing Whiteboard scope |
| `06_realizacja` | execution candidate impact | direct task/status mutation |
| `05_inicjatywy` | initiative candidate impact | direct initiative lifecycle mutation |

## 4. Source Inputs

- `docs/modules/02_moja-praca/functions/MW_IDEAS_PROCESS_FLOW.md`
- `docs/modules/02_moja-praca/FLOW_COMPLETION_AND_STABILIZATION_IMPLEMENTATION_PLAN.md`
- `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Flow as Idea format | documented | executable process-logic format | maintain boundary | `KEEP` | prevents BPM/runtime drift |
| Guard rails | partial evidence | validation and approval gates | needs E2E depth | `ENHANCE` | protects high-impact flow |
| Flow taxonomy catalog | not separated | node/edge/condition archetypes | missing sub-spec | `DEFER` | P1 follow-up |
| Owner read-back | partial | owner module confirmation | E2E missing | `DEFER` | P2 evidence gap |

## 6. UI/UX Component Contract

- approved shell/component family: `MyWorkHub` + `IdeaMapWorkspace` + `IdeaProcessFlowTool`.
- Menu 2 surface: `Ideas`.
- Menu 3 actions: propose steps, lanes, conditions, risks, approval points, conversion candidates.
- runtime states: loading, empty, error, degraded, success.
- source/provenance/evidence UI: critical nodes expose evidence/assumption posture.
- anti-patterns: silent BPM executor, hidden AI acceptance, owner-module status mutation.

## 7. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `MW-FLOW-P0-001` | `P0` | `runtime/test` | Stabilize generation and no-silent-fail path for Flow. | stabilization plan | route/component/API/test | G1/P0 gate passes |
| `MW-FLOW-P0-002` | `P0` | `test` | Prove guard rails block unsafe conversion. | current contract | API/test | unsafe conversion blocked |
| `MW-FLOW-P1-001` | `P1` | `docs/runtime` | Extract flow taxonomy catalog. | owner decision | docs/component/test | taxonomy accepted |

## 8. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Flow is Idea format | My Work route | `IdeaProcessFlowTool.tsx`, `IdeaMapWorkspace.tsx` | My Work idea APIs | route/component tests | `PASS` |
| Guard rails visible/enforceable | My Work route | flow tool/panels | convert/activity endpoints | partial unit tests | `PASS_WITH_P2` |
| Owner read-back complete | target route path | target owner confirmation | conversion endpoints | missing full E2E | `MISSING_P2` |

## 9. Cross-Module Impact

- impacted modules: `05_inicjatywy`, `06_realizacja`, artifact lanes.
- handoff changes: no ownership change.
- ownership impact: Flow owns local process artifact only.
- security/tenant impact: flow nodes/conditions/evidence remain tenant-scoped.
- E2E workflow impact: supports idea-to-execution candidate modeling.

## 10. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- impact complete: `PASS`
- owner acceptance: `PENDING`

## 11. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| What are canonical node/edge/condition archetypes for v1? | user | 2026-05-24 | no |
| What guard levels are mandatory before owner-module conversion? | user | 2026-05-24 | no |

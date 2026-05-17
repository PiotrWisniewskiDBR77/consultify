---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_MINDMAP
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: APPROVED_FOR_PLANNING
last_updated: 2026-05-10
---

# Function Execution Card — MW_IDEAS_MINDMAP

## 1. Metadata

- scope_anchor: `02_moja-praca/MW_IDEAS_MINDMAP`
- primary_module: `02_moja-praca`
- primary_function: `MW_IDEAS_MINDMAP`
- parent_function: `MW_IDEAS`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: Mind Map function contract, Mind Map addendum in module packet, related module behavior/UI/acceptance rows.
- Out of scope: `01_czat` implementation, Radar, Table, Flow, Whiteboard implementation.
- Immutable rule: `01_czat` is dependency/impact only; Mind Map lives in `02_moja-praca`.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `01_czat` | chat-origin input/provenance context | treating chat/canvas as primary scope |
| `MW_IDEAS_TABLE` | cross-tool transform boundary | editing Table backlog |
| `MW_IDEAS_PROCESS_FLOW` | downstream process transform | editing Flow backlog |
| `MW_IDEAS_WHITEBOARD` | facilitation transform | editing Whiteboard backlog |
| `05_inicjatywy`, `06_realizacja` | candidate handoff impact | direct owner-module mutation |

## 4. Source Inputs

- `docs/modules/02_moja-praca/functions/MW_IDEAS_MINDMAP.md`
- `docs/modules/02_moja-praca/functions/MW_IDEAS.md`
- `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`
- RAW sources for chat-to-idea and structured thinking context.

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Mind Map as Idea format | documented under `MW_IDEAS_MINDMAP` | explicit Idea family format | align agent scope | `KEEP` | prevents module drift |
| Provenance per node/cluster | evidence contract exists | mandatory before handoff | taxonomy still missing | `ENHANCE` | improves trust |
| Cross-tool transform | component/API/test evidence partial | preserve intent/evidence on transform | E2E gap | `ENHANCE` | required for family coherence |
| Full owner read-back | not fully proved | convert -> owner read-back | missing E2E | `DEFER` | tracked as P2, not blocker for doc contract |

## 6. UI/UX Component Contract

- approved shell/component family: `MyWorkHub` + `IdeaMapWorkspace`.
- Menu 2 surface: `Ideas` inside `02_moja-praca`.
- Menu 3 actions: Mind Map AI/generation/governance actions in command-row right slot.
- runtime states: loading, empty, error, degraded, success.
- source/provenance/evidence UI: node-level source, AI suggestion vs approved truth, evidence before conversion.
- anti-patterns: treating map as truth graph, hidden conversion, chat ownership takeover.

## 7. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `MW-MM-P0-001` | `P0` | `test` | Add full Mind Map proposal -> approval -> convert -> owner read-back E2E. | current contract | route/component/API/test | E2E green |
| `MW-MM-P1-001` | `P1` | `docs/runtime` | Define node/edge taxonomy and required evidence fields. | owner decision | docs/component/test | taxonomy accepted |
| `MW-MM-P1-002` | `P1` | `test` | Audit Menu 3 placement for Mind Map AI controls. | UI contract | component/test | no duplicated AI controls |

## 8. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Mind Map is Idea format | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `MyWorkView.tsx`, `MyWorkHub.tsx`, `IdeaMapWorkspace.tsx` | `my-work/my-ideas/*` | route and smoke tests | `PASS` |
| Source/provenance visible before handoff | My Work route | `AIGovernancePanel`, `CanvasLeftToolbar` | map AI/activity endpoints | unit/integration tests | `PASS_WITH_P2` |
| Full owner read-back exists | target route path | target owner confirmation | conversion endpoints | missing dedicated E2E | `MISSING_P2` |

## 9. Cross-Module Impact

- impacted modules: `01_czat`, `05_inicjatywy`, `06_realizacja`.
- handoff changes: no ownership change.
- ownership impact: Mind Map owns local map structure only.
- security/tenant impact: all map/source refs remain tenant-scoped.
- E2E workflow impact: supports `chat/context -> idea structure -> candidate handoff`.

## 10. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- impact complete: `PASS`
- owner acceptance: `ACCEPTED_FOR_PLANNING_CLOSEOUT`
- planning phase result: `CLOSED`
- runtime phase result: `NOT_STARTED`
- release note:
  - this closes the documentation/planning phase only;
  - runtime implementation remains blocked behind backlog items `MW-MM-P0-001`, `MW-MM-P1-001`, `MW-MM-P1-002`.

## 11. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| What is the minimal node/edge evidence taxonomy for conversion? | user | 2026-05-24 | no |
| Should AI suggestions require explicit confidence labels per node? | user | 2026-05-24 | no |

## 12. Closeout Decision

- closeout_date: `2026-05-10`
- closeout_scope: `MW_IDEAS_MINDMAP planning and documentation`
- decision: `APPROVED_FOR_PLANNING_CLOSEOUT`
- rationale:
  - Mind Map is correctly scoped as an Idea format inside `02_moja-praca`;
  - `01_czat` is dependency/impact only;
  - function contract, UI/UX addendum, acceptance matrix and execution backlog are aligned;
  - remaining taxonomy and e2e/read-back work is explicitly tracked and does not block planning closeout.
- next allowed phase:
  - implementation may start only from `MW-MM-P0-001` or a separately approved taxonomy sprint;
  - no P1/P2 capability expansion before the P0 governance/read-back chain is planned.

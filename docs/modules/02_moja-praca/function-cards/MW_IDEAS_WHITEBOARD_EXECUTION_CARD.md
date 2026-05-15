---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_WHITEBOARD
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — MW_IDEAS_WHITEBOARD

## 1. Metadata

- scope_anchor: `02_moja-praca/MW_IDEAS_WHITEBOARD`
- primary_module: `02_moja-praca`
- primary_function: `MW_IDEAS_WHITEBOARD`
- parent_function: `MW_IDEAS`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: Idea Whiteboard contract and Whiteboard-specific module rows.
- Out of scope: standalone whiteboard module, PMO/task board, runtime implementation, other Idea format backlogs.
- Immutable rule: Whiteboard is a facilitated Idea format inside `02_moja-praca`.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `MW_IDEAS_MINDMAP` | relation transform | editing Mind Map scope |
| `MW_IDEAS_TABLE` | outcome-to-row transform | editing Table scope |
| `MW_IDEAS_PROCESS_FLOW` | workshop-to-flow transform | editing Flow scope |
| `05_inicjatywy`, `06_realizacja` | candidate handoff impact | direct lifecycle/status mutation |

## 4. Source Inputs

- `docs/modules/02_moja-praca/functions/MW_IDEAS_WHITEBOARD.md`
- `docs/modules/02_moja-praca/functions/MW_IDEAS.md`
- `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Whiteboard as Idea format | documented | AI-governed workshop artifact format | keep boundary explicit | `KEEP` | prevents standalone module drift |
| Object grammar | evidence exists | mandatory semantics by element type | conversion fields missing | `ENHANCE` | improves handoff quality |
| Facilitation governance | documented | phase/role/timer/voting/snapshots | E2E depth missing | `ENHANCE` | supports workshop reliability |
| Owner read-back | partial | full approval -> convert -> read-back | E2E missing | `DEFER` | tracked as P2 |

## 6. UI/UX Component Contract

- approved shell/component family: `MyWorkHub` + `IdeaMapWorkspace` + whiteboard components.
- Menu 2 surface: `Ideas`.
- Menu 3 actions: brainstorm, cluster, synthesize, find gaps, summarize, suggest conversion.
- runtime states: loading, empty, error, degraded, success.
- source/provenance/evidence UI: outcome/source/workshop context visible before handoff.
- anti-patterns: PMO/task board replacement, hidden AI apply, downstream success without owner read-back.

## 7. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `MW-WB-P0-001` | `P0` | `test` | Prove whiteboard workshop -> approval -> convert path is explicit and safe. | current contract | route/component/API/test | no hidden mutation |
| `MW-WB-P1-001` | `P1` | `docs/runtime` | Define mandatory fields per whiteboard semantic outcome type. | owner decision | docs/component/test | outcome field catalog accepted |
| `MW-WB-P1-002` | `P1` | `test` | Audit Menu 3 placement for Whiteboard AI controls. | UI contract | component/test | no duplicate AI toolbar |

## 8. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Whiteboard is Idea format | My Work route | `IdeaWhiteboardTool.tsx`, `IdeaMapWorkspace.tsx` | map/sync/activity endpoints | unit/smoke tests | `PASS` |
| Facilitation state modeled | My Work route | whiteboard session components | facilitation/activity endpoints | partial tests | `PASS_WITH_P2` |
| Owner read-back complete | target route path | target owner confirmation | conversion endpoints | missing full E2E | `MISSING_P2` |

## 9. Cross-Module Impact

- impacted modules: `05_inicjatywy`, `06_realizacja`, artifact lanes.
- handoff changes: no ownership change.
- ownership impact: Whiteboard owns board/session/outcome context only.
- security/tenant impact: board/session/source data remain tenant-scoped.
- E2E workflow impact: supports workshop synthesis to candidate handoff.

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
| Which whiteboard outcome types require mandatory evidence fields? | user | 2026-05-24 | no |
| What is the minimal v1 facilitation mode set? | user | 2026-05-24 | no |

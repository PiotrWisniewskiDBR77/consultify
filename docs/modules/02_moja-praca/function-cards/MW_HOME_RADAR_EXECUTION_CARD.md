---
module_id: MODULE_MY_WORK
function_id: MW_HOME_RADAR
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — MW_HOME_RADAR

## 1. Metadata

- scope_anchor: `02_moja-praca/MW_HOME_RADAR`
- primary_module: `02_moja-praca`
- primary_function: `MW_HOME_RADAR`
- parent_function: none
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: Radar/Home function contract, Radar sections in module `03_BEHAVIOR.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`, and Radar section of `RAW_TARGET_STATE_2_0_PACKET.md`.
- Out of scope: Ideas family, Mind Map, Table, Process Flow, Whiteboard, runtime implementation.
- Immutable rule: dependencies may be referenced only for impact; they are not primary scope.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `01_czat` | input/provenance impact context | treating chat as Radar owner |
| `05_inicjatywy` | candidate handoff impact | direct initiative mutation |
| `06_realizacja` | execution handoff impact | direct execution status mutation |
| `MW_IDEAS` | optional capture/idea handoff | mixing Radar backlog with Ideas backlog |

## 4. Source Inputs

- `docs/modules/02_moja-praca/functions/MW_HOME_RADAR.md`
- `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`
- `docs/UI_UX/108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09.md`

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Radar role | Home/Radar surfaces exist | inspiration/education layer before initiative/PMO | stronger boundary language | `ENHANCE` | avoids PMO/task drift |
| Reading-first UX | mixed dashboard-like home | elegant technology portal | layout reset target | `NEW` | improves comprehension |
| Literal radar map | not fully evidenced as shipped | required target visual anchor | runtime future work | `DEFER` | target preserved without false shipped claim |
| Menu 3 AI placement | inline Radar AI exists | right-side command slot only | runtime alignment needed | `ENHANCE` | UI governance compliance |

## 6. UI/UX Component Contract

- approved shell/component family: `MyWorkHub` module shell with Radar/Home content lane.
- Menu 2 surface: `Home/Start/Radar` tab within `02_moja-praca`.
- Menu 3 actions: contextual AI Radar actions in command-row right slot.
- runtime states: loading, empty, error, degraded, success.
- source/provenance/evidence UI: evidence pointers, confidence/freshness, uncertainty boundary.
- anti-patterns: PMO cockpit, task queue, hidden mutation, top to-do hero as default target layout.

## 7. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `MW-RADAR-P0-001` | `P0` | `runtime/test` | Align Radar AI actions with Menu 3 right-slot target. | function contract approval | route/component/test | Menu 3 audit passes |
| `MW-RADAR-P0-002` | `P0` | `runtime/test` | Prove no hidden mutation in Radar handoff. | handoff endpoint evidence | API/test | owner read-back or explicit candidate-only result |
| `MW-RADAR-P1-001` | `P1` | `runtime/test` | Implement/verify reading-first Radar map layout. | target visual decision | component/test | layout v1 assertions pass |

## 8. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Radar is My Work function | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx` | `server/src/routes/my-work/home.routes.ts` | `tests/components/MyWork/HomeView.outputs.test.tsx` | `PASS` |
| Radar handoff is candidate-only | My Work route scope | `RadarTriageCard.tsx` | `server/src/routes/v8/radar-triage.routes.ts` | `tests/integration/p06-radar-triage.contract.test.ts` | `PASS_WITH_P2` |
| Full owner read-back is proven | target workflow | target components | owner endpoint path | missing full E2E | `MISSING_P2` |

## 9. Cross-Module Impact

- impacted modules: `01_czat`, `05_inicjatywy`, `06_realizacja`.
- handoff changes: no ownership change; candidate-only handoff preserved.
- ownership impact: Radar owns ranking/recommendation context only.
- security/tenant impact: deny-by-default and source confidence remain mandatory.
- E2E workflow impact: Radar remains pre-initiative intelligence layer.

## 10. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS_WITH_P2`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- impact complete: `PASS`
- owner acceptance: `PENDING`

## 11. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| Should user-facing label become `Radar` instead of `Home/Start`? | user | 2026-05-24 | no |
| What exact literal radar interaction model is v1 target? | user | 2026-05-24 | no |

---
module_id: MODULE_INTERVIEW
function_id: WY_INSIGHTS
doc_kind: FUNCTION_EXECUTION_CARD
parent_function: WY_INSIGHTS
owner_business: user
owner_tech: user
work_type: docs-only
status: APPROVED
last_updated: 2026-05-10
---

# Function Execution Card — WY_INSIGHTS

## 1. Metadata

- scope_anchor: `03_wywiad/WY_INSIGHTS`
- primary_module: `03_wywiad`
- primary_function: `WY_INSIGHTS`
- parent_function: `WY_INSIGHTS`
- owner_business: `user`
- owner_tech: `user`
- work_type: `docs-only`
- status: `APPROVED`

## 2. Scope Anchor

- in scope: `function-cards/WY_INSIGHTS_EXECUTION_CARD.md`, `IMPLEMENTATION_TASK_BOARD.md` (rows `WY-INS-*` only), `functions/WY_INSIGHTS.md`
- out of scope: runtime implementation, API/runtime mutations, task rows for other functions
- allowed global documents: `_FUNCTION_AGENT_DISPATCH_PROTOCOL_2026-05-10.md`, `_FUNCTION_EXECUTION_CARD_TEMPLATE.md`
- forbidden files: any file outside user `deliverables_exact` for this dispatch cycle

## 3. Dependency Scope

Dependency scope is read-only / impact-only unless explicitly promoted by owner decision.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `WY_SESSIONS` | source provenance and impact mapping for insight records | changing session contract or backlog |
| `WY_PENDING_REVIEW` | review-stage dependency and acceptance linkage | changing review queue scope or task priorities |
| `02_moja-praca` | downstream impact notes only | direct edits in module `02_moja-praca` |
| `05_inicjatywy` | downstream ownership/read-back impact for accepted initiative candidates | changing initiative lifecycle/status/gate contract |

## 4. Source Inputs

- RAW sources: `../../UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` (context only, no direct mutation)
- module contracts: `03_BEHAVIOR.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`
- function contracts: `functions/WY_INSIGHTS.md`
- runtime evidence sources: route/component/API/test evidence anchors declared in `functions/WY_INSIGHTS.md`
- previous decisions: dispatch prompt constraints (`docs-only`, immutable `scope_anchor`, `ROW` rule for `WY-INS-*`) and confirmed registry-sync continuation by owner

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Scope lock to `WY_INSIGHTS` | function contract exists but no dedicated execution card | dedicated card with immutable scope and dependencies | add execution control layer | `NEW` | enforce dispatch governance and prevent scope drift |
| Backlog governance in board | board contains mixed function prefixes | board entries only for `WY-INS-*` in this cycle | isolate row scope to function anchor | `ENHANCE` | align to ROW rule and reduce cross-function coupling |
| Acceptance evidence mapping | evidence anchors are high-level | explicit claim-to-evidence plan for insights flow | clarify verification expectations | `ENHANCE` | improve auditability before runtime work |
| Interview-local initiatives lane | visible as a separate Interview tab/lane | move ownership to `WY_INITIATIVES` and keep `WY_INSIGHTS` as source context only | earlier docs incorrectly attached initiative lifecycle to insights | `MOVE_OUT` | owner clarified that this is in Interview initiatives, not insights |
| Interview initiative creator | belongs to Interview initiatives lane | tracked in `WY_INITIATIVES` execution card and task rows | remove from `WY_INSIGHTS` backlog | `MOVE_OUT` | creator governs initiative candidates, not insight review itself |
| Runtime changes | not requested | no runtime edits | keep runtime untouched | `KEEP` | dispatch is docs-only |

## 6. UI/UX Component Contract

- approved shell/component family: `InterviewHub` insight lane (`insights` tab) with list/report + preview surfaces
- Menu 2 surface: module shell and tab selection in Interview
- Menu 3 actions: context actions for insight filtering, review handoff and evidence-aware next action
- AI action placement: right-side Menu 3 or row/modal scoped only; no duplicate toolbar under canvas
- runtime states: loading, empty, error, degraded, success states remain explicit per module UI contract
- source/provenance/evidence UI: each insight claim must retain session/source traceability
- approval/review/diff behavior: high-impact insight usage requires explicit review/approval before downstream adoption
- anti-patterns: insight claims without provenance, hidden review mutation, duplicate AI action placement

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/WY_INSIGHTS.md` | align function contract with dependency scope, evidence plan, and remove initiative creator ownership | tighten contract clarity for execution and handoff | `DONE` |
| `03_BEHAVIOR.md` | no change required in this cycle | current behavior mapping already includes `WY_INSIGHTS` lane | `NO_CHANGE` |
| `04_UI_UX.md` | keep initiatives UX annex under `WY_INITIATIVES`, not `WY_INSIGHTS` | align with owner clarification | `MOVED_OUT` |
| `07_ACCEPTANCE_AND_TESTS.md` | keep initiatives acceptance addendum under `WY_INITIATIVES`, not `WY_INSIGHTS` | align with owner clarification | `MOVED_OUT` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | not in deliverables scope | immutable scope guard | `OUT_OF_SCOPE` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `WY-INS-P0-001` | `P0` | `docs` | normalize extensible task-registry model for `WY_INSIGHTS` (risk/blockers/confidence/impact + evidence-required contract) in docs artifacts | owner docs acceptance | `route/component/API/test` | `READY` |
| `WY-INS-P1-001` | `P1` | `runtime/test` | define execution lane for insight operations and interview initiative candidates, including source chip, review, handoff and read-back evidence after P0 sign-off | `WY-INS-P0-001` | `route/component/API/test` | `WAITING_P0` |
| `WY-INS-P2-001` | `P2` | `runtime/test` | scale insights governance to cross-module handoff hardening and continuous inspiration experiments with provenance guardrails | `WY-INS-P0-001`,`WY-INS-P1-001` | `route/component/API/test` | `WAITING_P0` |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Insight lane routing and deep-link entry are contract-bound | `src/router/routeConfig.ts`, `src/AppRoutes.tsx` | `InterviewHub` insights tab routing hooks | interview insights list/load endpoints via `V8InterviewApi` | route-level regression and deep-link tests | `PASS_WITH_P2` |
| Insight provenance is visible and enforceable | Interview module route scope | insight detail/preview components in `InterviewHub` | insight payload links to session/source records | component + integration tests for provenance rendering | `PASS_WITH_P2` |
| Task-registry extensions remain auditable and scope-safe | scope locked to `03_wywiad/WY_INSIGHTS` in docs registry | function-card backlog and board rows stay `WY-INS-*` only | no API mutation in docs-only cycle | docs validation and duplicate-ID scan | `PASS` |

## 10. Cross-Module Impact

- impacted modules: `03_wywiad` (primary), `02_moja-praca` (impact-only downstream consumption), `WY_INITIATIVES` (impact-only consumer of source insights)
- handoff changes: documentation clarifies `WY_INSIGHTS` as source context provider; initiative candidate handoff is owned by `WY_INITIATIVES`
- ownership impact: no ownership transfer; `WY_INSIGHTS` stays within interview module contract
- security/tenant impact: no policy changes; tenant/ACL guardrails remain deny-by-default
- E2E workflow impact: stronger documentation gates before runtime rollout for insights
- global contract updates needed: none beyond files listed in this card

## 11. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS` (by reference to existing module contract docs)
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- impact complete: `PASS`
- owner acceptance: `APPROVED_FOR_IMPLEMENTATION`
- coding start readiness: `GO_FOR_P1`
- rerun gate: if scope expands beyond `WY_INSIGHTS`, stop with `BLOCKED_SCOPE_DRIFT`
- registry sync completed: `YES` (insight tasks normalized and synced to board/card within immutable scope)
- interview initiatives docs addendum: `MOVED_TO_WY_INITIATIVES`

## 12. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| Should `WY_INSIGHTS` P1 explicitly include degraded-state copy standardization across list/report modes? | user | next planning cycle | `no` |
| Is dedicated E2E coverage for `insightId` deep-link opening required at P1 or deferred to P2? | user | next planning cycle | `no` |

---
module_id: MODULE_INTERVIEW
function_id: WY_INITIATIVES
doc_kind: FUNCTION_EXECUTION_CARD
parent_function: WY_INITIATIVES
owner_business: user
owner_tech: user
work_type: docs-only
status: APPROVED
last_updated: 2026-05-10
---

# Function Execution Card — WY_INITIATIVES

## 1. Metadata

- scope_anchor: `03_wywiad/WY_INITIATIVES`
- primary_module: `03_wywiad`
- primary_function: `WY_INITIATIVES`
- parent_function: `WY_INITIATIVES`
- owner_business: `user`
- owner_tech: `user`
- work_type: `docs-only`
- status: `APPROVED`

## 2. Scope Anchor

- in scope: `function-cards/WY_INITIATIVES_EXECUTION_CARD.md`, `IMPLEMENTATION_TASK_BOARD.md` rows `WY-INI-*`, `functions/WY_INITIATIVES.md`
- out of scope: runtime implementation, API/runtime mutations, task rows for other functions
- allowed global documents: `_FUNCTION_AGENT_DISPATCH_PROTOCOL_2026-05-10.md`, `_FUNCTION_EXECUTION_CARD_TEMPLATE.md`
- forbidden files: any runtime file and any docs file outside this dispatch deliverable set unless explicitly used for consistency updates

## 3. Dependency Scope

Dependency scope is read-only / impact-only unless explicitly promoted by owner decision.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `WY_INSIGHTS` | source insight/finding provenance and evidence context | changing insight review contract or `WY-INS-*` backlog |
| `WY_SESSIONS` | session provenance for candidate source envelope | changing session contract or session task rows |
| `05_inicjatywy` | downstream ownership/read-back impact for accepted candidates | changing canonical initiative lifecycle/status/gate contract |

## 4. Source Inputs

- RAW sources: project/task management RAW benchmark findings summarized in prior initiative analysis docs
- module contracts: `03_BEHAVIOR.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`
- function contracts: `functions/WY_INITIATIVES.md`
- runtime evidence sources: route/component/API/test evidence anchors declared in `functions/WY_INITIATIVES.md`
- previous decisions: owner clarified that Interview initiatives are in `03_wywiad` and not in `WY_INSIGHTS`

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Separate Interview initiatives function | Initiative lane visible in Interview but previously attached to insights docs | dedicated `WY_INITIATIVES` contract and execution card | create owner artifact for the lane | `NEW` | prevents scope drift and reflects owner clarification |
| Source envelope | source chip appears in UI, but full provenance contract is incomplete | insight/finding/session provenance, creation mode, reviewer metadata and missing-evidence policy | define source envelope | `NEW` | initiative candidates must be auditable before handoff |
| Initiative creator | creator behavior not fully governed | 0..N candidate generator with quality gate, generated-field labels and accept/edit/reject/defer review | define creator contract | `NEW` | one source may produce no candidate or multiple strong candidates |
| Handoff/read-back | downstream ownership boundary exists but evidence is incomplete | explicit payload, downstream confirmation and no false ownership claim | define handoff contract | `ENHANCE` | Interview prepares candidates; `05_inicjatywy` owns canonical lifecycle |
| Runtime changes | not requested | no runtime edits | keep runtime untouched | `KEEP` | dispatch is docs-only |

## 6. UI/UX Component Contract

- approved shell/component family: `InterviewHub` initiatives lane (`Inicjatywy`) with candidate list, review surface and handoff/read-back state
- Menu 2 surface: module shell and Interview tab selection
- Menu 3 actions: generate candidates, review source, improve candidate, prepare handoff, retry/read-back where context allows
- AI action placement: right-side Menu 3 or row/modal scoped only; no duplicate toolbar under table/canvas
- runtime states: loading, empty, error, degraded and success states explain source/candidate/handoff state
- source/provenance/evidence UI: each candidate shows source chip/context or explicit missing-evidence warning
- approval/review/diff behavior: generated fields remain proposals until accept/edit/reject/defer; handoff requires explicit user action
- anti-patterns: hidden initiative creation, candidate without source envelope, forced low-quality candidate, duplicate AI toolbar, claiming canonical initiative before read-back

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/WY_INITIATIVES.md` | create dedicated function contract | owner clarified Interview initiatives are their own Interview function | `DONE` |
| `03_BEHAVIOR.md` | move Interview initiatives behavior from `WY_INSIGHTS` to `WY_INITIATIVES` | align ownership and handoff | `DONE` |
| `04_UI_UX.md` | add `WY_INITIATIVES` to function annex and update initiatives UX annex | align UI function map with visible tab/lane | `DONE` |
| `07_ACCEPTANCE_AND_TESTS.md` | move initiatives acceptance addendum to `WY_INITIATIVES` | bind route/component/API/test evidence to correct scope | `DONE` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | add `WY_INITIATIVES` scope anchor status | keep packet scope index accurate | `DONE` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `WY-INI-P0-001` | `P0` | `docs` | create and normalize dedicated Interview initiatives function contract, execution card and registry scope anchor | owner docs acceptance | `route/component/API/test` | `READY` |
| `WY-INI-P0-002` | `P0` | `docs` | define interview initiative source envelope for insight/finding/session provenance, accepted-by metadata, generation mode and missing-evidence warning | `WY-INI-P0-001` | `route/component/API/test` | `READY` |
| `WY-INI-P0-003` | `P0` | `docs` | define interview initiative creator contract: 0..N candidates, accept/edit/reject/defer, no silent writes, generated-field labeling and review-before-handoff | `WY-INI-P0-002` | `route/component/API/test` | `READY` |
| `WY-INI-P0-004` | `P0` | `docs` | define handoff/read-back payload contract from interview candidate to `05_inicjatywy`, including tenant/project context, source refs and downstream confirmation rules | `WY-INI-P0-002`,`WY-INI-P0-003` | `route/component/API/test` | `READY` |
| `WY-INI-P0-005` | `P0` | `docs` | define degraded/error and ownership policy for failed creator generation, unavailable source evidence, unauthorized handoff and missing read-back | `WY-INI-P0-003`,`WY-INI-P0-004` | `route/component/API/test` | `READY` |
| `WY-INI-P0-006` | `P0` | `docs` | close dedicated Interview RAW source decision (`new dedicated RAW file` vs `accepted module-local RAW baseline`) and bind decision to packet + certification report | `WY-INI-P0-005` | `route/component/API/test` + certification trace link | `READY` |
| `WY-INI-P1-001` | `P1` | `runtime/test` | verify Interview initiatives lane route/component/API binding and source-aware candidate list after P0 sign-off | `WY-INI-P0-001` | `route/component/API/test` | `WAITING_P0` |
| `WY-INI-P1-002` | `P1` | `runtime/test` | implement/verify interview initiative candidate list behavior: source chip, draft/candidate state, row actions, empty/degraded states and review entry | `WY-INI-P0-002`,`WY-INI-P0-005` | `route/component/API/test` | `WAITING_P0` |
| `WY-INI-P1-003` | `P1` | `runtime/test` | implement/verify interview initiative creator review flow for 0..N candidates with accept/edit/reject/defer and generated-field labels | `WY-INI-P0-003` | `route/component/API/test` | `WAITING_P0` |
| `WY-INI-P1-004` | `P1` | `runtime/test` | implement/verify handoff/read-back integration from accepted candidate to `05_inicjatywy` without transferring lifecycle ownership to Interview | `WY-INI-P0-004`,`WY-INI-P1-003` | `route/component/API/test` | `WAITING_P0` |
| `WY-INI-P1-005` | `P1` | `test` | add component/API regression coverage for candidate source chip, creator review actions, handoff payload, unauthorized state and failed read-back state | `WY-INI-P1-002`,`WY-INI-P1-003`,`WY-INI-P1-004` | `route/component/API/test` | `WAITING_P0` |
| `WY-INI-P2-001` | `P2` | `runtime/test` | add full Interview initiatives E2E regression for lane navigation, candidate review and source context inspection | `WY-INI-P0-001`,`WY-INI-P1-001` | `route/component/API/test` | `WAITING_P0` |
| `WY-INI-P2-002` | `P2` | `runtime/test` | add E2E regression for `insight -> creator -> candidate review -> handoff -> 05_inicjatywy read-back` including failure paths | `WY-INI-P1-004`,`WY-INI-P1-005` | `route/component/API/test` | `WAITING_P0` |
| `WY-INI-P2-003` | `P2` | `runtime/test` | add duplicate/merge/split and quality-gate checks for interview-generated initiative candidates before handoff | `WY-INI-P1-003`,`WY-INI-P2-002` | `route/component/API/test` | `WAITING_P0` |
| `WY-INI-P2-004` | `P2` | `runtime/test` | add creator audit/history and generator-run traceability for accepted, rejected, deferred and no-initiative outcomes | `WY-INI-P2-002`,`WY-INI-P2-003` | `route/component/API/test` | `WAITING_P0` |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Interview initiatives lane is a dedicated Interview function | Interview route aliases to `InterviewHub` | `InterviewHub` initiatives tab/lane | interview initiative candidate endpoints or mapped API service boundary | lane navigation regression | `PASS_WITH_P2` |
| Candidate rows are source-aware | Interview module route scope | source chip and candidate row/detail | source insight/session payload continuity | component test for source chip and missing evidence | `PASS_WITH_P2` |
| Creator supports governed 0..N candidate generation | Interview route aliases to `InterviewHub` | creator modal/panel and candidate review controls | creator/generator payload endpoint or service boundary | creator component/API/E2E tests | `MISSING` |
| Canonical initiative ownership remains downstream | handoff route/action context | handoff/read-back UX state | initiative creation/handoff response from `05_inicjatywy` boundary | E2E handoff/read-back regression | `PASS_WITH_P2` |
| Task registry is scope-safe | scope locked to `03_wywiad/WY_INITIATIVES` in docs registry | function-card backlog and board rows stay `WY-INI-*` only | no API mutation in docs-only cycle | docs validation and duplicate-ID scan | `PASS` |

## 10. Cross-Module Impact

- impacted modules: `03_wywiad` (primary), `WY_INSIGHTS` and `WY_SESSIONS` (source context impact-only), `05_inicjatywy` (downstream ownership/read-back impact-only)
- handoff changes: documentation clarifies interview initiative candidate handoff; no runtime handoff mutation in this cycle
- ownership impact: `WY_INITIATIVES` owns interview-local candidates; `05_inicjatywy` owns canonical initiatives after read-back
- security/tenant impact: no policy changes; tenant/ACL guardrails remain deny-by-default
- E2E workflow impact: P2 requires full `source -> creator -> candidate review -> handoff/read-back` regression
- global contract updates needed: no runtime-global contract update in this docs-only cycle

## 11. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- impact complete: `PASS`
- owner acceptance: `APPROVED_FOR_IMPLEMENTATION`
- rerun gate: if scope expands beyond `WY_INITIATIVES`, stop with `BLOCKED_SCOPE_DRIFT`
- registry sync completed: `YES` (tasks normalized and synced to board/card within immutable scope)

## 12. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| Should runtime route naming expose `initiatives`, `inicjatywy` or reuse an existing tab key? | user | P1 planning | `no` |
| Dedicated Interview RAW source requirement | `DECISION_CLOSED_DOCS` (`docs/RAW/110_RAW_INTERVIEW_DISCOVERY_ENGINE_2026-05-11.md` added and linked to contracts/certification) | 2026-05-11 | `closed` |
| Should duplicate/merge/split quality gate be P1 for MVP or remain P2 hardening? | user | P1 planning | `no` |
| Should creator audit history be visible to business users or only admin/diagnostic views? | user | P2 planning | `no` |

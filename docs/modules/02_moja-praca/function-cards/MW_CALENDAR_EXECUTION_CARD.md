---
module_id: MODULE_MY_WORK
function_id: MW_CALENDAR
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — MW_CALENDAR

## 1. Metadata

- scope_anchor: `02_moja-praca/MW_CALENDAR`
- primary_module: `02_moja-praca`
- primary_function: `MW_CALENDAR`
- parent_function: `MW_CALENDAR`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: calendar function contract, calendar task rows (`MW-CAL-*`), calendar-specific planning boundary, state/conflict/provenance/approval definitions.
- Out of scope: runtime implementation, other `02_moja-praca` function contracts except cross-function alignment notes, all non-calendar module docs.
- Allowed global documents: function dispatch protocol, function card template, RAW packet/playbook, calendar/workday RAW sources.
- Forbidden files: `src/**`, `server/**`, `tests/**`, all non-calendar function cards.
- Immutable rule: this run is locked to `02_moja-praca/MW_CALENDAR`.

## 3. Dependency Scope

Dependency scope is read-only / impact-only.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `01_czat` | provenance context for event-driven recommendations and chat planning intents | editing chat contracts or treating chat as calendar owner |
| `MW_TASKS` | owner-lane boundary for task lifecycle and scheduling handoff | mutating task lifecycle from calendar contract |
| `MW_DECISIONS` | owner-lane boundary for decision lifecycle and review-slot handoff | mutating decision lifecycle from calendar contract |
| `06_realizacja` | candidate handoff impact for execution rhythm in time | defining PMO lifecycle as calendar-owned |
| `13_meeting` | candidate handoff impact for preparation/outcome actions | defining meeting lifecycle as calendar-owned |

## 4. Source Inputs

- RAW sources:
  - `docs/UI_UX/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md`
  - `docs/RAW/calendar/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md`
  - `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
  - `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
- module contracts:
  - `docs/modules/02_moja-praca/03_BEHAVIOR.md`
  - `docs/modules/02_moja-praca/04_UI_UX.md`
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md`
  - `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`
- function contracts:
  - `docs/modules/02_moja-praca/functions/MW_CALENDAR.md`
- runtime evidence sources:
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/TasksCalendarView.tsx`
  - route/API/test references listed in function contract and acceptance docs.
- previous decisions:
  - calendar is planning/synchronization layer, not owner-lane lifecycle module.

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Calendar role in My Work | Contract says planning view with generic ownership guard. | Explicit planning + synchronization layer for user workday rhythm. | Role needs stronger wording and explicit anti-owner guardrails. | `ENHANCE` | Prevent drift into PMO/task owner behavior. |
| Boundary with owner lanes | Mentioned generally for task/decision/initiative. | Hard boundary vs `MW_TASKS`, `MW_DECISIONS`, `06_realizacja`, `13_meeting` with candidate-only handoff. | Missing explicit owner-lane separation and read-back rule. | `ENHANCE` | Protect canonical ownership and tenancy. |
| Runtime state grammar | Five base states present. | Add conflict/stale/ACL variants under degraded posture with next actions. | Missing explicit conflict taxonomy and stale sync handling. | `NEW` | Required for trust and operational clarity. |
| Recommendation provenance | Source visibility currently brief. | Source + confidence + explanation + uncertainty for event-driven recommendations. | Need stronger provenance and traceability posture. | `ENHANCE` | Reduce hallucination risk and improve explainability. |
| AI posture | Approval stated in broad terms. | High-impact actions must follow `propose -> approve -> execute` with audit trace. | Missing explicit high-impact trigger categories. | `NEW` | Align with governance and approval doctrine. |
| Handoff path | Event click/navigation is documented. | Explicit candidate handoff path to tasks/meeting/execution with owner read-back gate. | Current handoff too UI-centric, not governance-centric. | `ENHANCE` | Needed for cross-function contract alignment. |
| Calendar capability breadth | RAW defines broad engine (meeting prep/outcomes, external sync, workload scoring). | Keep as roadmap breadth, do not force runtime claims in docs-only cycle. | Need phased prioritization in backlog and evidence plan. | `DEFER` | Avoid over-claiming without runtime evidence. |

## 6. UI/UX Component Contract

- approved shell/component family: `MyWorkHub` calendar workspace and related calendar view components.
- Menu 2 surface: `Kalendarz` tab in `02_moja-praca`.
- Menu 3 actions: contextual calendar AI/planning actions in right-side command slot only.
- AI action placement: Menu 3 right-side slot, no duplicate AI toolbar in calendar canvas.
- runtime states:
  - `loading`: calendar and source health fetching.
  - `empty`: no events/blocks in selected horizon, show next-step CTA.
  - `error`: recoverable failure with retry/reconnect CTA.
  - `degraded`: partial sync, conflict engine partial, stale data, or ACL-limited visibility.
  - `success`: event timeline and candidate actions available.
- source/provenance/evidence UI: recommendation cards show source set, confidence, explanation, and stale/uncertainty markers.
- approval/review/diff behavior: high-impact actions (external reschedule, owner-lane candidate creation, participant-impacting changes) require explicit approval.
- anti-patterns:
  - calendar presented as owner lifecycle cockpit,
  - hidden write actions from AI suggestions,
  - conflict warnings without explainability.

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/MW_CALENDAR.md` | strengthen planning boundary, state/conflict taxonomy, provenance and approval posture, candidate handoff model | close docs gaps from RAW calendar/workday requirements | `DONE` |
| `03_BEHAVIOR.md` | no update in this cycle | calendar behavior constraints captured in function contract + execution card for this scope | `NOT_REQUIRED` |
| `04_UI_UX.md` | no update in this cycle | UI-level calendar placement/state guardrails captured at function level for docs-only scope | `NOT_REQUIRED` |
| `07_ACCEPTANCE_AND_TESTS.md` | no update in this cycle | module acceptance can stay unchanged; calendar-specific evidence mapped in card | `NOT_REQUIRED` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | no update in this cycle | impact documented in this card; packet remains module-wide and mixed-scope | `NOT_REQUIRED` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `MW-CAL-P0-001` | `P0` | `docs` | Lock calendar planning/synchronization boundary, state+conflict grammar, provenance and approval rules, and candidate handoff posture in function contract and board. | owner docs acceptance | route/component/API/test mapping in function card | contract/UI/impact complete |
| `MW-CAL-P0-002` | `P0` | `docs/runtime` | Define Approval Orchestrator contract for high-impact calendar actions (`propose -> approve -> execute`) and explicit guard categories. | `MW-CAL-P0-001` | component/API/test | contract/UI/impact complete |
| `MW-CAL-P0-003` | `P0` | `docs/runtime` | Define canonical handoff payload schema for owner lanes (`MW_TASKS`, `MW_DECISIONS`, `13_meeting`, `06_realizacja`) with source/evidence intent fields. | `MW-CAL-P0-001` | API/test | contract/evidence complete |
| `MW-CAL-P0-004` | `P0` | `docs/test` | Define owner read-back tracker contract and acceptance chain (`handoff sent -> owner accepted/rejected -> read-back visible`). | `MW-CAL-P0-003` | route/API/test | evidence/impact complete |
| `MW-CAL-P0-005` | `P0` | `docs/runtime` | Define Sync Trust Layer states per source (`fresh/stale/error/permission_limited`) with user-safe behavior. | `MW-CAL-P0-001` | route/component/API/test | contract/UI complete |
| `MW-CAL-P0-006` | `P0` | `docs/runtime` | Define Conflict Engine v1 contract and mandatory conflict taxonomy for calendar planning surface. | `MW-CAL-P0-001` | component/API/test | contract/evidence complete |
| `MW-CAL-P0-007` | `P0` | `docs/runtime` | Define recommendation provenance card contract (`source`, `confidence`, `explanation`, `uncertainty`) for event-driven recommendations. | `MW-CAL-P0-001`,`MW-CAL-P0-005` | component/API/test | contract/UI complete |
| `MW-CAL-P0-008` | `P0` | `docs/runtime` | Define ACL and privacy guard contract for calendar visibility and masking posture in degraded/limited scope. | `MW-CAL-P0-001`,`MW-CAL-P0-005` | route/component/API/test | security/contract complete |
| `MW-CAL-P1-001` | `P1` | `docs/runtime` | Finalize v1 candidate payload checklist for calendar handoff and owner-lane acceptance criteria. | `MW-CAL-P0-*` | component/API/test + owner read-back criteria | waiting for P0 close |
| `MW-CAL-P1-002` | `P1` | `test` | Add acceptance scenario set for conflict/stale/ACL degraded states and high-impact approval chain. | `MW-CAL-P0-*` | route/component/test | waiting for P0 close |
| `MW-CAL-P1-003` | `P1` | `runtime` | Deliver AI Day Planner capability contract slice (top priorities, unscheduled work, overload warning). | `MW-CAL-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-CAL-P1-004` | `P1` | `runtime` | Deliver Meeting Preparation Engine contract slice (agenda, context, prep block recommendations). | `MW-CAL-P0-*` | component/API/test | waiting for P0 close |
| `MW-CAL-P1-005` | `P1` | `runtime` | Deliver Meeting Outcome Engine contract slice (action/decision/follow-up candidates with approval). | `MW-CAL-P0-*` | component/API/test | waiting for P0 close |
| `MW-CAL-P1-006` | `P1` | `runtime/test` | Deliver Workload Snapshot and scoring contract (`day load`, `focus availability`, `scheduling risk`). | `MW-CAL-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-CAL-P1-007` | `P1` | `runtime` | Harden external sync baseline (Google/Outlook reliability, reconnect, dedup, trust posture alignment). | `MW-CAL-P0-*` | API/test | waiting for P0 close |
| `MW-CAL-P1-008` | `P1` | `runtime/test` | Harden timezone/DST/recurrence semantics as explicit acceptance criteria and regression scenarios. | `MW-CAL-P0-*`,`MW-CAL-P1-007` | route/API/test | waiting for P0 close |
| `MW-CAL-P2-001` | `P2` | `runtime/test` | Introduce two-way external writeback with explicit approval and audit safeguards. | `MW-CAL-P0-*`,`MW-CAL-P1-*` | route/component/API/test | waiting for P0 close |
| `MW-CAL-P2-002` | `P2` | `runtime/test` | Add Team Calendar and capacity view with privacy-preserving manager posture. | `MW-CAL-P0-*`,`MW-CAL-P1-*` | route/component/test | waiting for P0 close |
| `MW-CAL-P2-003` | `P2` | `runtime/test` | Add energy-aware scheduling posture (buffers, fatigue, context-switch limits). | `MW-CAL-P0-*`,`MW-CAL-P1-*` | component/API/test | waiting for P0 close |
| `MW-CAL-P2-004` | `P2` | `runtime/test` | Add advanced auto-reschedule proposals with strict no-silent-execution rule. | `MW-CAL-P0-*`,`MW-CAL-P1-*` | API/test | waiting for P0 close |
| `MW-CAL-P2-005` | `P2` | `runtime` | Add cross-module optimization hints (`results/finance`) as advisory-only planning signals. | `MW-CAL-P0-*`,`MW-CAL-P1-*` | route/component/API/test | waiting for P0 close |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Calendar is planning/synchronization layer in My Work | `/my-work/calendar` route mapping | `MyWorkHub` + calendar view surface | shared my-work API boundary | module acceptance row for `MW_CALENDAR` | `PASS` |
| Calendar does not own task/decision/execution lifecycle | route-level owner-lane navigation | explicit handoff controls in calendar UI | owner-lane APIs remain canonical | owner read-back flow tracked by `MW-CAL-P0-004` | `PASS_WITH_P2` |
| High-impact actions require explicit approval chain | route transitions through approval UI | approval cards in calendar actions | action payload with `requires_approval` posture | approval chain suite in `MW-CAL-P1-002` | `PASS_WITH_P2` |
| Handoff payload is canonical and owner-readable | route to owner modules from calendar context | handoff UI exposes target/intent/evidence summary | payload schema from `MW-CAL-P0-003` | payload validation suite pending | `PASS_WITH_P2` |
| Conflict states are explicit and actionable | route to calendar state context | conflict/degraded banners and next-action copy | sync/conflict endpoints and source health metadata | dedicated conflict chain in `MW-CAL-P1-002` | `PASS_WITH_P2` |
| Sync trust posture is visible (`fresh/stale/error/permission_limited`) | route-level source health presentation | source chips/banners and stale markers | source sync status contracts | stale/ACL regression pending | `PASS_WITH_P2` |
| Event-driven recommendations are source-aware and explainable | route context for recommendation cards | recommendation card metadata (`source`, `confidence`, `explanation`) | recommendation payload contract | provenance end-to-end assertion pending | `PASS_WITH_P2` |
| ACL/privacy guard prevents overexposure | route respects tenant and role context | masking and restricted cards in calendar surfaces | ACL-aware source filtering contract | privacy/ACL calendar tests pending | `PASS_WITH_P2` |
| P1/P2 capability waves remain gated behind P0 closure | route and board sequencing | backlog and status policy in function card + board | dependency chain contracts | gate verification during runtime planning | `PASS` |

## 10. Cross-Module Impact

- impacted modules:
  - `MW_TASKS`, `MW_DECISIONS` for planning-to-owner candidate conversion,
  - `13_meeting` for preparation/outcome candidate path,
  - `06_realizacja` for execution rhythm candidate path,
  - `01_czat` for provenance of chat-origin planning suggestions.
- handoff changes: no runtime mutation; this cycle locks explicit candidate-only path.
- ownership impact: calendar remains orchestration layer; owner lanes keep canonical lifecycle control.
- security/tenant impact: deny-by-default on ACL uncertainty, stale sync is visible, no hidden writeback.
- E2E workflow impact: chain formalized as `calendar recommendation -> user approval -> explicit handoff -> owner review -> owner read-back`.
- global contract updates needed: none for this docs-only cycle.

## 11. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- impact complete: `PASS`
- owner acceptance: `ACCEPTED_FOR_DOCS_ON_2026-05-10`
- rerun gate: `NOT_RUN (docs-only function cycle)`

## 11A. Registry Sync Note

- registry sync completed: `2026-05-10` (task registry normalized and aligned across card + board for `MW-CAL` scope).

## 11B. NO-GO Analysis (Runtime Start)

- runtime go/no-go: `GO_WITH_CTO_RISK_ACCEPTANCE`
- CTO de-block decision:
  - unresolved runtime evidence is reclassified from hard blocker to accepted delivery risk for implementation start,
  - no claims of production readiness are introduced; missing runtime proofs remain tracked as `PASS_WITH_P2`,
  - implementation may proceed with explicit sequencing `P1 -> P2` and mandatory evidence closure before production release.
- closure decision:
  - `MW-CAL-P0-*` remain closed as `DONE_DOCS`,
  - `MW-CAL-P1-*` moved to `READY` for implementation start,
  - `MW-CAL-P2-*` remain gated as `WAITING_P1` until P1 closure evidence is produced.

## 11C. CTO Acceptance Note

- owner acceptance: `ACCEPTED_CTO_DEBLOCK_2026-05-10`
- acceptance scope: start implementation despite residual `PASS_WITH_P2` evidence, with explicit no-production-release condition until runtime evidence gates are closed.

## 12. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| Which minimal payload fields are mandatory for `MW_CALENDAR -> 13_meeting` candidate handoff in v1? | user | 2026-05-24 | no |
| Should stale sync threshold for degraded badge be global or source-specific? | user | 2026-05-24 | no |
| Which calendar AI actions are considered high-impact by default in policy (`external write`, `participant impact`, `owner candidate creation`)? | user | 2026-05-24 | no |

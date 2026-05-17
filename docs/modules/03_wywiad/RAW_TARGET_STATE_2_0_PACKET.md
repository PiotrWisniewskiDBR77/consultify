---
module_id: MODULE_INTERVIEW
doc_kind: RAW_TO_TARGET_MODULE_PACKET
packet_version: 2.0
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# RAW -> Target State 2.0 Packet — 03_wywiad

## 0. Metadata

- module: `03_wywiad`
- cycle mode: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- packet composition: function-level execution managed through immutable `scope_anchor`

## 1. Scope and Sources

- `docs/modules/03_wywiad/RAW_INPUT.md`
- `docs/RAW/110_RAW_INTERVIEW_DISCOVERY_ENGINE_2026-05-11.md`
- module contracts `00-07`, `CODEMAP`, `STATUS`
- function contracts under `docs/modules/03_wywiad/functions/`
- function execution cards under `docs/modules/03_wywiad/function-cards/`
- task register (`ROW`): `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md`

## 2. Scope Anchors Covered

| Scope anchor | Function area | Status |
| --- | --- | --- |
| `03_wywiad/WY_MY_ASSIGNMENTS` | personal assignments lane | review-ready |
| `03_wywiad/WY_MANAGED_ASSIGNMENTS` | managed assignments lane | review-ready |
| `03_wywiad/WY_SESSIONS` | interview sessions lane | review-ready |
| `03_wywiad/WY_TEMPLATES` | templates lane | review-ready |
| `03_wywiad/WY_INSIGHTS` | insights lane | review-ready |
| `03_wywiad/WY_INITIATIVES` | interview-local initiatives lane | review-ready |
| `03_wywiad/WY_PENDING_REVIEW` | pending review lane | review-ready |

## 3. Execution Governance

- mixed module packet is not used as direct runtime backlog;
- deployable work is managed via function execution cards;
- every task row in `IMPLEMENTATION_TASK_BOARD.md` maps to one `scope_anchor`;
- status policy is enforced: `P0=READY`, `P1/P2=WAITING_P0`.

## 4. Cross-Module Impact

- `03_wywiad` remains owner of interview workflow objects;
- downstream handoff remains explicit and candidate-based;
- no ownership mutation is introduced by this docs cycle.

## 5. Gate Status

- docs rerun gate: `PASS` (0 errors, 0 warnings)
- function cards: `CREATED`
- ROW task register: `CREATED_AND_NORMALIZED`
- owner acceptance: `APPROVED_FOR_IMPLEMENTATION` at execution-card level

## 6. Owner Acceptance

- business_owner_acceptance: `accepted_on: 2026-05-10`
- tech_owner_acceptance: `accepted_on: 2026-05-10`
- packet_approval_scope: `APPROVED_FOR_DOCS_TARGET_DEFERRED`

## 7. Deferred Items

- runtime delivery and E2E closure remain in P1/P2 task rows in ROW.
- no production-readiness claim is made by this packet.

## 8. Normalized Gap Register

### P0 must close

| Gap | Evidence location | Required closure | Current status |
| --- | --- | --- | --- |
| Taskboard and function cards must remain one-to-one by `scope_anchor`. | `IMPLEMENTATION_TASK_BOARD.md`; `function-cards/*_EXECUTION_CARD.md` | Keep each task row mapped to one existing function card. | `DONE_DOC` |
| Route aliases must not imply separate Interview truth owners. | `STATUS.md`; `CODEMAP.md`; `functions/*.md` | Treat `/interview`, `/discovery` and `/project-intelligence` as aliases to the same hub runtime unless owner changes routing. | `DONE_DOC` |

### P1 runtime evidence

| Gap | Evidence needed | Blocking reason | Current status |
| --- | --- | --- | --- |
| No module-local frontend test suite is bound for `InterviewHub`. | route `/interview`/`/discovery`; component `InterviewHub`; V8 interview API; component/e2e journey tests. | Runtime full-go needs hub-level UI regression evidence. | `NOT_DONE` |
| Function journey coverage is not complete across assignments, sessions, templates, insights and pending review. | per-function route/component/API/test rows in `07_ACCEPTANCE_AND_TESTS.md`. | Current docs are review-ready; runtime journey proof is still shallow. | `NOT_DONE` |

### P2 premium hardening

| Gap | Evidence needed | Current status |
| --- | --- | --- |
| Route alias strategy needs long-term owner decision. | owner decision: keep aliases, consolidate, or document compatibility policy. | `OPEN_QUESTION` |
| Insight-to-initiative generation depth remains policy-sensitive. | explicit decision on finding-level create/link vs smart multi-initiative generation. | `OPEN_QUESTION` |

## 9. RAW Depth Hard Gate Annex

### 9.1 RAW Sources

| Source | Status | Mapping |
| --- | --- | --- |
| `docs/RAW/110_RAW_INTERVIEW_DISCOVERY_ENGINE_2026-05-11.md` | `USED` | dedicated interview RAW source for discovery/provenance/handoff governance and certification closure. |
| `docs/modules/03_wywiad/RAW_INPUT.md` | `USED` | module-local raw baseline retained as local source feed. |
| `docs/modules/03_wywiad/RAW_TARGET_STATE_2_0_PACKET.md` | `USED` | this packet; module integration and function scope anchors. |
| `docs/RAW/99_RAW_INPUT 2.md` | `IMPACT_ONLY` | global author RAW index; no dedicated Interview entry found. |
| `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` | `IMPACT_ONLY` | conversation-to-interview context handoff and source/provenance expectations. |
| `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md` | `IMPACT_ONLY` | downstream governance context for initiatives/execution generated from interview findings. |

### 9.2 RAW synthesis: must / should / out

| Class | RAW-derived requirement | Contract decision |
| --- | --- | --- |
| must | Teresa can conduct interview work sessions: ask questions, capture answers, normalize findings, and expose source session/finding provenance. | `ENHANCE` in `WY_SESSIONS`, `WY_INSIGHTS`, `WY_INITIATIVES`, `04_UI_UX`, `07_ACCEPTANCE_AND_TESTS`. |
| must | Interview may hand off candidates to `05_inicjatywy`, but cannot silently create canonical initiative truth. | `KEEP` ownership boundary; downstream read-back required. |
| must | Reviewer/assignment flows remain explicit and permission-aware. | `KEEP/ENHANCE` in function contracts and taskboard P0 rows. |
| should | Teresa can become smarter about generating multiple initiative candidates from findings. | `DEFER` pending owner decision on generator depth. |
| should | Route aliases should be rationalized to avoid perceived duplicate truth. | `DEFER` owner route policy. |
| out | Runtime implementation, new tests and new backend endpoints. | `OUT_OF_SCOPE` for docs-only pass. |

### 9.3 As-Is vs Target vs Delta

| Dimension | As-Is | RAW target | Delta | Evidence / plan |
| --- | --- | --- | --- | --- |
| Source provenance | Interview functions exist and require provenance. | Every finding/insight/candidate has source chain and missing-evidence state. | dedicated UI/runtime proof missing. | `NOT_DONE`: bind `InterviewHub` component tests and journey evidence. |
| Handoff | Existing `03 -> 05` handoff edge. | Candidate-based initiative handoff with downstream read-back. | full read-back proof missing. | `NOT_DONE`: P1 handoff regression. |
| AI/review | AI/review concepts documented. | AI suggests; reviewer accepts before final claim. | approval-depth evidence shallow. | `NOT_DONE`: review-state evidence matrix. |
| Route identity | `/interview`, `/discovery`, `/project-intelligence` aliases. | one clear user-facing Interview identity. | owner route alias policy needed. | `OPEN_QUESTION`. |

### 9.4 Decision table

| Requirement | Decision | Rationale | Evidence trace |
| --- | --- | --- | --- |
| Keep Interview as owner of interview records and candidates before handoff. | `KEEP` | prevents ownership drift into Initiatives before acceptance. | `MODULE_INTERACTION_GRAPH.md`; `04_UI_UX.md`; functions `WY_*`. |
| Strengthen source/provenance requirement for every insight/export/candidate. | `ENHANCE` | RAW hard gate requires source -> decision -> contract -> evidence chain. | `04_UI_UX.md`; `07_ACCEPTANCE_AND_TESTS.md`; `WY_INSIGHTS`; `WY_INITIATIVES`. |
| Treat smart multi-initiative generation as shipped. | `DEFER` | no dedicated RAW source or runtime evidence proves this as ready. | `OPEN_QUESTION` owner decision. |
| Claim runtime full-go for Interview journeys. | `DEFER` | component/e2e journey evidence is missing. | `NOT_DONE` P1 taskboard rows. |

### 9.5 Evidence trace

Critical thesis: Interview can create reviewable initiative candidates but cannot silently create canonical initiative truth.

- RAW source: `docs/modules/03_wywiad/RAW_INPUT.md`, `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` as impact context.
- contract decision: `ENHANCE`, handoff/read-back required.
- contract files: `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`, `functions/WY_INITIATIVES.md`.
- evidence: route/component/API/test chain is `NOT_DONE` for full runtime journey; taskboard keeps P1/P2 rows dependency-gated.

## 10. RAW Semantic + World-Class Certification Addendum — 2026-05-11

Certification posture for `03_wywiad`:

- `DOCS_CERTIFIED`: `YES`
- `TARGET_WORLD_CLASS_CERTIFIED`: `YES_WITH_RUNTIME_CONDITION`
- `RUNTIME_CERTIFIED`: `NO`

Blocking reasons:

1. `InterviewHub` journey evidence remains `NOT_DONE` in acceptance matrix,
2. route alias policy is still open and affects long-term identity coherence.

Required closeout for certification:

- bind Interview journey proof to route/component/API/test chain,
- keep creator/handoff governance as explicit proposal-review-read-back flow.

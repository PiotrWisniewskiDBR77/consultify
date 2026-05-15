---
module_id: MODULE_INTERVIEW
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Wywiad / Interview

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar Interview -> `/discovery` | `menuConfig.ts` + `AppRoutes.tsx` | pass |
| `/interview` direct entry | `AppRoutes.tsx` mounts same `InterviewHub` | pass |
| `/project-intelligence` alias | route points to `InterviewHub` | pass (`duplicate` alias path) |
| Interview API contract coverage | `src/services/api/v8/interview.ts` typed entities | pass |
| Frontend module-level tests for InterviewHub | no `src/components/Interview/*test*` files found | gap (`code_gap`) |

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `WY_MY_ASSIGNMENTS` | personal assignment queue and deep-link open | `InterviewHub.tsx`, interview API assignment calls | pass |
| `WY_MANAGED_ASSIGNMENTS` | managed workload review and overdue handling | `InterviewHub.tsx`, managed/overdue assignment loaders | pass |
| `WY_SESSIONS` | session create/open/complete and status filtering | `InterviewHub.tsx`, session API calls | pass |
| `WY_TEMPLATES` | template browse and question preview loading | `InterviewHub.tsx`, template question endpoint usage | pass |
| `WY_INSIGHTS` | insight list/report modes and deep-link open | `InterviewHub.tsx`, insight loading path | pass |
| `WY_INITIATIVES` | interview-derived initiative candidates show source-aware candidate state and require explicit handoff/read-back before canonical ownership | `InterviewHub.tsx`, interview initiatives lane/list, creator and handoff actions | pass_with_p2 (`evidence_gap`) |
| `WY_PENDING_REVIEW` | review queue visibility and explicit review actions | `InterviewHub.tsx` pending review tab logic | pass (permission-dependent) |

## Confirmed Automated Evidence (As-Is)

- No dedicated module-local test file found for interview hub UI.

## Known Gaps / Blockers

- `code_gap`: lack of InterviewHub automated tests for assignment/review/preview transitions.
- `doc_gap`: no embedded UI evidence links for this module in current file.
- `code_gap`: no dedicated end-to-end regression covering all six Interview functions in one suite.
- `evidence_gap`: interview-local `Inicjatywy` lane needs explicit route/component/API/test binding for `insight -> initiative candidate -> handoff/read-back`.

## Gap Closure Plan (CTO)

| Gap | Mitigation task stream | Priority | Tracking status |
| --- | --- | --- | --- |
| InterviewHub automated transitions are missing | `WY-MYA-P1-*`, `WY-MGA-P1-*`, `WY-PRV-P1-001` define runtime/test coverage packages for assignment + review transitions | `P1` | `PLANNED_IN_ROW` |
| Module lacks embedded UI evidence links | `WY-SES-P0-001` and `WY-PRV-P0-001` lock evidence mapping contract for route/component/API/test linkage | `P0` | `CLOSED_IN_DOCS` |
| No single E2E suite for all Interview functions | `WY-MYA-P2-*`, `WY-MGA-P2-*`, `WY-SES-P2-001`, `WY-TPL-P2-001`, `WY-INS-P2-001`, `WY-INI-P2-001`, `WY-PRV-P2-001` define cross-lane E2E package | `P2` | `PLANNED_IN_ROW` |
| Interview initiatives handoff evidence incomplete | `WY-INI-P1-001` and `WY-INI-P1-004` should cover component/API/test proof for interview initiative candidate review and handoff/read-back | `P1` | `PLANNED_IN_ROW` |

## Interview Initiatives Acceptance Addendum

Scope anchor: `03_wywiad/WY_INITIATIVES`.

Acceptance criteria:

- Interview-local `Inicjatywy` lane is documented as `WY_INITIATIVES`.
- Each candidate exposes source chip/context such as `Insight`.
- Candidate review and handoff are explicit user actions.
- Canonical initiative ownership is not claimed until `05_inicjatywy` read-back succeeds.
- Failed or unavailable handoff uses safe degraded state.
- AI-generated candidate fields remain proposals and require review.

Evidence baseline:

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Interview initiatives are scoped under Interview/WY_INITIATIVES | Interview route aliases to `InterviewHub` | interview initiative lane/list in `InterviewHub` family | interview initiative candidate and handoff APIs | missing dedicated regression | `PASS_WITH_P2` |
| Source-aware candidate display is required | `WY_INITIATIVES` route context with `WY_INSIGHTS` source dependency | source chip and candidate row/detail | source insight/session payload continuity | missing component test | `PASS_WITH_P2` |
| Canonical initiative ownership remains downstream | handoff route/action context | handoff/read-back UX state | initiative creation/handoff response | missing E2E handoff test | `PASS_WITH_P2` |

## Module Test Readiness Decision

- CTO decision: `APPROVED_FOR_IMPLEMENTATION_WITH_P2_GAPS`.
- Condition: runtime implementation can proceed lane-by-lane after each function closes `P0`.
- Guardrail: module cannot be marked fully test-complete until P2 E2E package is executed.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.

## RAW Evidence Trace Annex — 2026-05-11

| Critical thesis | RAW source | Contract decision | Evidence / closure |
| --- | --- | --- | --- |
| Interview candidates require source session/finding provenance before handoff. | `docs/RAW/110_RAW_INTERVIEW_DISCOVERY_ENGINE_2026-05-11.md`; `docs/modules/03_wywiad/RAW_INPUT.md`; `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` | `ENHANCE` in `WY_INITIATIVES` and UI/UX contract. | route/component/API mapped; full handoff/read-back test `NOT_DONE`. |
| Route aliases must not create multiple Interview truths. | module route baseline | `KEEP` aliases as one hub until owner decides. | owner route policy `OPEN_QUESTION`. |

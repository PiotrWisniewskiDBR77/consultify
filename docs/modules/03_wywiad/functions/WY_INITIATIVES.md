---
module_id: MODULE_INTERVIEW
function_id: WY_INITIATIVES
function_name: Interview — Initiatives
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Initiatives

## 1. Function Identity

- Function ID: `WY_INITIATIVES`
- UI labels: `Inicjatywy`, `Initiatives`
- Scope: Interview tab/lane `inicjatywy`
- Feature state: `real`
- Scope anchor: `03_wywiad/WY_INITIATIVES` (immutable in current cycle)

## 2. User Job and Business Outcome

- User job: review, refine and hand off initiative candidates that originate in the Interview module.
- Outcome: interview evidence becomes high-quality initiative candidates without bypassing user review or downstream `05_inicjatywy` ownership.

## 3. Trigger and Entry Points

- Entry: `Inicjatywy` tab/lane inside Interview.
- Source triggers: insight/finding review, manual add from Interview context, and governed initiative creator generation.

## 3a. Dependency Scope (Impact-Only)

- `WY_INSIGHTS`: source insight/finding provenance and evidence context.
- `WY_SESSIONS`: source session context when available.
- `05_inicjatywy`: canonical initiative lifecycle owner after accepted handoff/read-back.
- Forbidden in this cycle: edits outside `WY_INITIATIVES` deliverables.

## 4. UI Component Footprint

- `InterviewHub` initiatives lane/list with candidate rows, filters and source chips.
- Candidate review surface for source context, generated fields and user decisions.
- Handoff/read-back state surface for downstream confirmation.

## 5. Inputs, Data Contracts, and Dependencies

- Initiative candidate records with status, priority, source, date and provenance envelope.
- Source envelope includes insight/finding reference, session context when available, creation mode, accepted/reviewed-by metadata and missing-evidence warnings.
- Handoff payload to `05_inicjatywy` includes tenant/project context, source refs, candidate fields, review decision and generated-field labels.

## 6. Outputs and Side Effects

- User-reviewed initiative candidates: accept, edit, reject or defer.
- Explicit handoff request to `05_inicjatywy` only after user acceptance.
- No hidden writes: generation and handoff cannot silently create canonical initiatives.

## 7. Ownership and Handoff Boundaries

- Owner: interview-local initiative candidates before canonical handoff.
- `WY_INSIGHTS` remains source context provider only.
- `05_inicjatywy` owns canonical initiative lifecycle, approval, status, governance and execution handoff after read-back.
- The Interview UI must not claim canonical initiative creation unless downstream read-back succeeds.

## 8. Runtime States and UX Behavior

- Loading, empty, error and degraded states must explain candidate availability, source evidence availability and handoff state.
- Candidate rows must show source chip/context such as `Insight` when the source is interview-derived.
- The creator must support zero, one or many candidate outcomes and explain no-initiative outcomes.
- Menu 3 context actions stay in command-row/right-side slot or row context; no duplicated toolbar.

## 9. AI, Source, Evidence, Approval

- AI may propose initiative candidates, but generated fields remain proposals until user review.
- Candidate proposals must label assumptions, missing evidence and generated fields.
- User must be able to inspect source context before accepting or handing off a candidate.
- AI actions such as `Generate initiative candidates`, `Improve candidate`, `Explain source` and `Prepare handoff` must live in Menu 3/right-side command row or row-scoped actions.

## 9a. Interview Initiative Creator

Canonical flow:

`interview session -> insight/finding -> initiative candidate -> user review -> handoff/read-back -> 05_inicjatywy canonical initiative`

Required behavior:

- One source may produce zero, one or many initiative candidates.
- Candidate generation must be quality-gated; low-confidence or duplicate candidates are not forced into the list as final work.
- User must be able to accept, edit, reject or defer every candidate before downstream write.
- Duplicate/merge/split checks must run before handoff in the target state.
- Failed generation, unavailable source evidence, unauthorized handoff and missing read-back must show safe degraded states.

## 10. Security, Roles, and Tenancy

- Candidate visibility and handoff follow tenant + role ACL.
- High-impact downstream creation requires explicit user action.
- Raw internals, secrets or sensitive payloads must not appear in business-facing candidate rows or logs.

## 11. Acceptance Criteria and Test Evidence

- Interview `Inicjatywy` lane is documented as `03_wywiad/WY_INITIATIVES`.
- Each candidate exposes source/provenance context or a missing-evidence warning.
- Creator supports zero, one and many candidates and all user review decisions.
- Handoff/read-back to `05_inicjatywy` is explicit and does not transfer lifecycle ownership to Interview.
- `P0` documentation readiness is required before `P1/P2` expansion.

- Route evidence: module route/view scope for `03_wywiad` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: Interview initiatives lane/list, candidate review and creator/handoff surfaces under `src/components/**` and `src/views/**`.
- API evidence: interview initiative candidate, creator/generator and initiative handoff/read-back boundaries through `src/services/api.ts`, `src/services/api/v8/interview.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: component/API/E2E coverage for candidate list, creator decisions, handoff/read-back and degraded paths in `tests/**` and `tests/e2e/**`.

## 12. Open Risks and Change Log

- Risk: runtime evidence for the initiative creator and handoff/read-back remains incomplete until P1/P2 execution.
- Risk: duplicate/merge/split quality gate is target-state behavior and needs implementation proof.
- Change log: created separate function ownership after owner clarified that Interview initiatives are not `WY_INSIGHTS`.

## 13. Execution Card and Task Board Linkage

- Scope anchor lock: `03_wywiad/WY_INITIATIVES` (immutable for this cycle).
- Source execution card: `docs/modules/03_wywiad/function-cards/WY_INITIATIVES_EXECUTION_CARD.md`.
- Source task board row set: `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md` (`WY-INI-*` only).
- Active task IDs:
  - `WY-INI-P0-001` (`READY`)
  - `WY-INI-P0-002` (`READY`)
  - `WY-INI-P0-003` (`READY`)
  - `WY-INI-P0-004` (`READY`)
  - `WY-INI-P0-005` (`READY`)
  - `WY-INI-P0-006` (`READY`)
  - `WY-INI-P1-001` (`WAITING_P0`)
  - `WY-INI-P1-002` (`WAITING_P0`)
  - `WY-INI-P1-003` (`WAITING_P0`)
  - `WY-INI-P1-004` (`WAITING_P0`)
  - `WY-INI-P1-005` (`WAITING_P0`)
  - `WY-INI-P2-001` (`WAITING_P0`)
  - `WY-INI-P2-002` (`WAITING_P0`)
  - `WY-INI-P2-003` (`WAITING_P0`)
  - `WY-INI-P2-004` (`WAITING_P0`)
- Dependency scope (`impact-only`): `WY_INSIGHTS`, `WY_SESSIONS`, `05_inicjatywy`.
- Coding readiness: `GO_FOR_P1` after owner-approved docs gate.

## RAW Hard Gate Trace — 2026-05-11

- RAW source: `docs/RAW/110_RAW_INTERVIEW_DISCOVERY_ENGINE_2026-05-11.md`, `docs/modules/03_wywiad/RAW_INPUT.md`; impact context `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`.
- Contract decision: `ENHANCE` source-backed candidate generation and downstream read-back; `DEFER` smart multi-initiative generator until owner decision.
- Evidence: route/component/API baseline is documented; full interview candidate -> `05_inicjatywy` read-back journey remains `NOT_DONE`.

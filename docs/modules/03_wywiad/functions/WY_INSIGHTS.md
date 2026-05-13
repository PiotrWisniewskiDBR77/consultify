---
module_id: MODULE_INTERVIEW
function_id: WY_INSIGHTS
function_name: Interview — Insights
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Insights

## 1. Function Identity
- Function ID: `WY_INSIGHTS`
- UI labels: `Wnioski`, `Insights`
- Scope: Interview tab `insights`
- Feature state: `real`
- Scope anchor: `03_wywiad/WY_INSIGHTS` (immutable in current cycle)

## 2. User Job and Business Outcome
- User job: review and operationalize interview insights.
- Outcome: evidence-backed conclusions for downstream decisions.

## 3. Trigger and Entry Points
- Entry: `insights` tab, deep links with `insightId`.

## 3a. Dependency Scope (Impact-Only)
- `WY_SESSIONS`: source provenance for insight records.
- `WY_PENDING_REVIEW`: explicit review transition path.
- `02_moja-praca`: downstream consumption impact only.
- Forbidden in this cycle: edits outside `WY_INSIGHTS` deliverables.

## 4. UI Component Footprint
- `InterviewHub` insight list/report modes and preview surfaces.
- Insight viewer/detail components and row actions.

## 5. Inputs, Data Contracts, and Dependencies
- Insight records with type/status and session linkage.
- APIs: `V8InterviewApi.listInsights()` and interview endpoints.
- Dependency contracts: sessions and pending-review boundaries are read-only in this cycle.

## 6. Outputs and Side Effects
- Insight review transitions, opened details, handoff actions.
- No hidden writes: all transitions remain explicit user actions.
- Interview-sourced initiative candidates are owned by `WY_INITIATIVES`.
- Initiative creation/handoff from an insight consumes `WY_INSIGHTS` source context and must preserve the source insight, session context and explicit user action.

## 7. Ownership and Handoff Boundaries
- Owner: interview insight records.
- Handoff to reports/initiatives must remain explicit and source-aware.
- Cross-module handoff to `02_moja-praca` is impact-tracked only (no direct scope mutation).
- `WY_INITIATIVES` owns the interview-local initiatives lane and creator flow.
- `WY_INSIGHTS` may provide source insight context to `WY_INITIATIVES`, but it must not own initiative candidate lifecycle, creator UX or initiative handoff/read-back.

## 8. Runtime States and UX Behavior
- Loading and status filter changes are explicit.
- Empty/error/degraded states require clear guidance.
- Menu 3 context actions stay in command-row/right-side slot or row context; no duplicated toolbar.

## 9. AI, Source, Evidence, Approval
- Insight claims must retain session/source provenance.
- Approval/review required for high-impact insight usage.
- AI contextual actions for insights must remain Menu 3 compliant.

## 10. Security, Roles, and Tenancy
- Insight visibility and mutation follow tenant + role ACL.

## 11. Acceptance Criteria and Test Evidence

- Insight tab supports flat/report modes and deep-link open.
- Interview-sourced initiative work is delegated to `WY_INITIATIVES` and remains source-aware.
- Scope governance remains locked to `03_wywiad/WY_INSIGHTS`.
- `P0` documentation readiness is required before `P1/P2` expansion.

- Route evidence: module route/view scope for `03_wywiad` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `03_wywiad` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `03_wywiad` user flows.

## 12. Open Risks and Change Log
- Risk: evidence display inconsistency across insight subviews.
- Risk: degraded-state copy standard is not fully explicit between list/report insight submodes.
- Change log: aligned with function execution card and immutable `scope_anchor` governance.

## 13. Execution Card and Task Board Linkage

- Scope anchor lock: `03_wywiad/WY_INSIGHTS` (immutable for this cycle).
- Source execution card: `docs/modules/03_wywiad/function-cards/WY_INSIGHTS_EXECUTION_CARD.md`.
- Source task board row set: `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md` (`WY-INS-*` only).
- Active task IDs:
  - `WY-INS-P0-001` (`READY`)
  - `WY-INS-P1-001` (`WAITING_P0`)
  - `WY-INS-P2-001` (`WAITING_P0`)
- Dependency scope (`impact-only`): `WY_SESSIONS`, `WY_PENDING_REVIEW`, `WY_INITIATIVES`, `02_moja-praca`.
- Coding readiness: `GO_FOR_P1` after owner-approved docs gate.

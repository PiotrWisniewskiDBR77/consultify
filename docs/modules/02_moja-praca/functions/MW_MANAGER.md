---
module_id: MODULE_MY_WORK
function_id: MW_MANAGER
function_name: Manager / Menedzer
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-07-31
---

# Function Contract — Manager / Menedzer

> Pełny kontrakt produktowy i remanent implementacji:
> [`MY_WORK_MANAGER_REVIEW.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_MANAGER_REVIEW.md)
> oraz
> [`MANAGER_AS_IS_MVP_GAPS_AND_GOLDEN_FLOWS.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MANAGER_AS_IS_MVP_GAPS_AND_GOLDEN_FLOWS.md).

## 1. Function Identity

- Function ID: `MW_MANAGER`
- Module: `02_moja-praca`
- UI labels/aliases: `Menedzer`, `Manager`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/manager"`
- Feature state: `real` (role-restricted)

## 2. User Job and Business Outcome

- User job: detect exceptions, understand causes, decide and confirm that an
  intervention improved the expected outcome.
- Business outcome: steer portfolio, projects, people, time, budget, risks,
  decisions, KPI and benefits through one evidence-backed operating cockpit.
- Non-goals: manager view must not bypass policy/approval for underlying records.

## 3. Trigger and Entry Points

- Entry points: Manager tab and deep-link path.
- Preconditions: role authorization (`admin/manager` and related privileged roles in runtime checks).
- Blocking conditions: unauthorized users are blocked and shown access-restricted state.

## 4. UI Component Footprint

- Top-level container/view components: `MyWorkHub`.
- Function runtime components: `ExecutiveDashboard`.
- Access-state component behavior: inline restricted-access view when role check fails.
- Component ownership notes: manager dashboard is module-local, gated by hub role checks.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: portfolio health aggregates, KPI summaries, team-level signals.
- Upstream modules/services: summaries from `MW_TASKS`, `MW_DECISIONS`, and `MW_CALENDAR` with manager aggregation context.
- APIs/models: shared API and executive aggregation models.
- Data freshness assumptions: metrics can be eventually consistent across source modules.
- Dependency posture: all dependency usage is impact-only; manager view does not become canonical owner for dependency-module objects.

| Dependency | Usage in `MW_MANAGER` | Boundary |
| --- | --- | --- |
| `MW_TASKS` | execution follow-up orientation and navigate-to-action | no task lifecycle mutation from manager dashboard |
| `MW_DECISIONS` | decision steering and review follow-up orientation | no decision lifecycle mutation from manager dashboard |
| `MW_CALENDAR` | schedule and timeline context for management steering | no direct calendar canonical mutation |
| `06_realizacja` | impact visibility for execution governance read-back | no PMO ownership transfer to manager surface |

## 6. Outputs and Side Effects

- Produced objects/artifacts: management briefs, intervention proposals and
  source-module commands; no duplicate canonical object ownership.
- Downstream handoff: to source tabs `tasks`, `decisions`, `calendar` (and contextual fallback paths) via explicit `onNavigate`.
- Side effects visible to user: executive cards and jump-to-action transitions.
- Handoff success rule: navigation success is not equal to owner-module mutation success; canonical completion is confirmed only after owner-module read-back.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: source owner modules.
- Handoff contract (`from -> to`): `ExecutiveDashboard -> MyWorkHub tab switch -> source workflow`.
- Forbidden ownership: manager view cannot directly mutate canonical records outside approved owner flow.
- Governance chain for high-impact follow-up: `proposal -> approval -> explicit handoff -> owner review/read-back`.

## 8. Runtime States and UX Behavior

- Loading: executive cards wait for aggregate data.
- Empty: explicit no-data management state with guidance.
- Error: safe failure state, no raw internals.
- Degraded: partial metrics clearly flagged.
- Access denied: explicit restricted-access state for non-privileged roles.
- Success: users can trace an exception to evidence, initiate an authorized
  intervention and confirm its canonical read-back and later result.
- Next action guidance per state: route to source tab for action, or retry.

## 9. AI, Source, Evidence, Approval

- AI action placement: contextual manager AI actions must live in command-row/Menu 3 right-side slot only.
- Source/provenance visibility: executive metrics should map back to source domains.
- Approval/diff/review requirements: high-impact actions happen in owner modules with review policies.
- Audit trail/evidence: role gating and navigation handoffs are observable.

## 10. Security, Roles, and Tenancy

- Allowed roles: only users with explicit manager capability; Admin Panel owns
  assignment and revocation policy.
- Denied/restricted roles: users without manager access.
- ACL/tenant scope: visibility is a separate configured management scope over
  people, teams, projects, portfolios and organization units. Module access
  never implies organization-wide visibility. UI, deep links, APIs, exports,
  search and Teresa must enforce the same effective scope.
- Sensitive data masking/redaction: strict by role and tenant boundaries.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Unauthorized users cannot operate manager function and see explicit restriction state.
  - Authorized users can open manager dashboard and jump to source tabs (`tasks`, `decisions`, `calendar`) with preserved context.
  - Manager function does not perform hidden direct writes in foreign domains.
  - Dependency usage remains impact-only for `MW_TASKS`, `MW_DECISIONS`, `MW_CALENDAR`, and `06_realizacja`.
  - Manager AI actions are not duplicated outside Menu 3 for the same context.
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/Executive/ExecutiveDashboard.tsx`
- Known `doc_gap`: exact role matrix wording in docs should be unified globally.
- Known `code_gap`: dedicated manager navigation and owner read-back e2e chain is not yet documented as complete.
- Known `code_gap`: capacity currently compares lifetime open-task estimates
  against weekly capacity; the UI guard correctly shows a degraded state, but
  the source aggregation must become time-windowed before the metric is trusted.
- Backlog linkage: implementation tasks are tracked as `MW-MGR-*` in `IMPLEMENTATION_TASK_BOARD.md`.

- Route evidence: module route/view scope for `02_moja-praca` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `02_moja-praca` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `02_moja-praca` user flows.

## 12. Open Risks and Change Log

- Risks/assumptions: role semantics can drift between docs and backend ACL checks.
- Open decisions: finalize canonical role set and mandatory executive-card provenance fields.
- Change log: contract hardened for impact-only dependency scope, handoff/read-back semantics, and manager acceptance gate alignment.

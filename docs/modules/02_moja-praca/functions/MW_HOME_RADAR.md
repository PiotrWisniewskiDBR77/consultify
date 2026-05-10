---
module_id: MODULE_MY_WORK
function_id: MW_HOME_RADAR
function_name: Home / Start (Radar)
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Home / Start (Radar)

## 1. Function Identity

- Function ID: `MW_HOME_RADAR`
- Module: `02_moja-praca`
- UI labels/aliases: `Start`, `Home`, `Radar` (author naming)
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work"`, `"/my-work/home"`
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: get a high-signal daily overview and trigger next actions across work.
- Business outcome: faster prioritization and better cross-module orchestration.
- Non-goals: it must not become canonical owner of tasks/decisions/initiatives.

## 3. Trigger and Entry Points

- Entry points: My Work tab switch (`home`) and deep-link `"/my-work/home"`.
- Preconditions: user can access `My Work`.
- Blocking conditions: none beyond standard app/session access.

## 4. UI Component Footprint

- Top-level container/view components: `MyWorkView`, `SplitLayout`, `MyWorkHub`.
- Function runtime component: `HomeView`.
- Standard shared components used around function context: command row in `MyWorkHub`.
- Component ownership notes: `HomeView` is module-local; layout shell is shared.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: user context and home aggregates passed into `HomeView`.
- Upstream modules/services: cross-module signals via `refreshTrigger` and My Work event flow.
- APIs/models: shared API client in `src/services/api.ts`.
- Data freshness assumptions: data can be stale between refresh events.

## 6. Outputs and Side Effects

- Produced objects/artifacts: none canonical; emits navigation intents and action events.
- Downstream handoff: to tabs `tasks`, `decisions`, `inbox`, and to owner modules via navigation.
- Side effects visible to user: changed active tab, refreshed cards, opened detail context.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: owner modules, not Home.
- Handoff contract (`from -> to`): `HomeView -> MyWorkHub tab/action handlers -> owner module surface`.
- Forbidden ownership: no direct source-of-truth writes for external entities.

## 8. Runtime States and UX Behavior

- Loading: Home summary blocks wait for data and show loading placeholders.
- Empty: explicit "no signals" style state with next-step guidance.
- Error: degraded summary, no raw stack/errors in UI.
- Degraded: partial cross-module signal availability is visible.
- Success: users can jump to concrete next actions from the summary.
- Next action guidance per state: must always point to a next tab or owner module.

## 9. AI, Source, Evidence, Approval

- AI action placement: command row / Menu 3 conventions only.
- Source/provenance visibility: summary signals must preserve source module context.
- Approval/diff/review requirements: high-impact changes are routed to owner module review flows.
- Audit trail/evidence: navigation and resulting owner-module states serve as runtime evidence.

## 10. Security, Roles, and Tenancy

- Allowed roles: authenticated users with My Work access.
- Denied/restricted roles: denied by global ACL.
- ACL/tenant scope: tenant-scoped data only.
- Sensitive data masking/redaction: inherited from source modules and global access policies.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - `"/my-work/*"` renders `MyWorkHub` and `home` tab can be activated.
  - Home actions can route user to concrete execution tabs.
  - Home never writes canonical records directly.
- Code/runtime evidence:
  - `src/views/MyWorkView.tsx`
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/Home/HomeView.tsx`
- Known `doc_gap`: full card-by-card copy matrix is not yet documented.
- Known `code_gap`: no dedicated automated module-level Home flow test.

## 12. Open Risks and Change Log

- Risks/assumptions: Home can drift into "dashboard only" without clear next-action guidance.
- Open decisions: whether Radar naming should be primary in UI copy.
- Change log: initial function contract created.

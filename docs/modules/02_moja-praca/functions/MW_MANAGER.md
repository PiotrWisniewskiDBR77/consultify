---
module_id: MODULE_MY_WORK
function_id: MW_MANAGER
function_name: Manager / Menedzer
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Manager / Menedzer

## 1. Function Identity

- Function ID: `MW_MANAGER`
- Module: `02_moja-praca`
- UI labels/aliases: `Menedzer`, `Manager`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/manager"`
- Feature state: `real` (role-restricted)

## 2. User Job and Business Outcome

- User job: get executive-level portfolio and team-health overview.
- Business outcome: faster management decisions and better execution steering.
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
- Upstream modules/services: tasks/decisions/focus/inbox summaries.
- APIs/models: shared API and executive aggregation models.
- Data freshness assumptions: metrics can be eventually consistent across source modules.

## 6. Outputs and Side Effects

- Produced objects/artifacts: no canonical object ownership; emits management navigation intents.
- Downstream handoff: to tabs `tasks`, `decisions`, `home`, `inbox` via `onNavigate`.
- Side effects visible to user: executive cards and jump-to-action transitions.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: source owner modules.
- Handoff contract (`from -> to`): `ExecutiveDashboard -> MyWorkHub tab switch -> source workflow`.
- Forbidden ownership: manager view cannot directly mutate canonical records outside approved owner flow.

## 8. Runtime States and UX Behavior

- Loading: executive cards wait for aggregate data.
- Empty: explicit no-data management state with guidance.
- Error: safe failure state, no raw internals.
- Degraded: partial metrics clearly flagged.
- Success: users can jump into concrete execution or decision tabs.
- Next action guidance per state: route to source tab for action, or retry.

## 9. AI, Source, Evidence, Approval

- AI action placement: command-row/Menu 3 standards.
- Source/provenance visibility: executive metrics should map back to source domains.
- Approval/diff/review requirements: high-impact actions happen in owner modules with review policies.
- Audit trail/evidence: role gating and navigation handoffs are observable.

## 10. Security, Roles, and Tenancy

- Allowed roles: privileged manager/admin roles as enforced in hub checks.
- Denied/restricted roles: users without manager access.
- ACL/tenant scope: tenant-scoped executive data only.
- Sensitive data masking/redaction: strict by role and tenant boundaries.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Unauthorized users cannot operate manager function and see explicit restriction state.
  - Authorized users can open manager dashboard and jump to tasks/decisions/inbox/home.
  - Manager function does not perform hidden direct writes in foreign domains.
- Code/runtime evidence:
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/Executive/ExecutiveDashboard.tsx`
- Known `doc_gap`: exact role matrix wording in docs should be unified globally.
- Known `code_gap`: dedicated manager-role e2e coverage not documented here.

## 12. Open Risks and Change Log

- Risks/assumptions: role semantics can drift between docs and backend ACL checks.
- Open decisions: finalize "manager role set" wording across all contracts.
- Change log: initial function contract created.

---
module_id: MODULE_MY_WORK
function_id: MW_DECISIONS
function_name: Decisions / Decyzje
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Decisions / Decyzje

## 1. Function Identity

- Function ID: `MW_DECISIONS`
- Module: `02_moja-praca`
- UI labels/aliases: `Decyzje`, `Decisions`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/decisions"`, `"/my-work/decisions/:decisionId"`
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: review, prioritize, and resolve pending decisions.
- Business outcome: reduce decision bottlenecks and unblock execution.
- Non-goals: decisions tab must not skip governance/approval requirements.

## 3. Trigger and Entry Points

- Entry points: Decisions tab, deep-link paths, open-document intent.
- Preconditions: My Work access.
- Blocking conditions: none beyond ACL/tenant constraints.

## 4. UI Component Footprint

- Top-level container/view components: `MyWorkHub`.
- Function runtime components: `DecisionsPanelContent`, `DecisionsKanbanBoard`, `DecisionsTimelineContainer`, `DecisionDetailView`.
- Command-row controls: decision filters, priority filter, view-mode toggle (`table/kanban/timeline`), bulk bar.
- Component ownership notes: decision view controls are module-local in shared hub frame.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: decision status, priority, search/filter state, bulk state.
- Upstream modules/services: decision producers from multiple module workflows.
- APIs/models: shared API and decision domain models.
- Data freshness assumptions: counts/list/detail update cycles can diverge temporarily.

## 6. Outputs and Side Effects

- Produced objects/artifacts: decision updates, created decision records, routing to related entities.
- Downstream handoff: to execution/initiative/task flows when decision outcome requires action.
- Side effects visible to user: updated decision status, opened decision detail, changed view mode.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: decision domain.
- Handoff contract (`from -> to`): decision outcome triggers handoff to owner workflow with preserved context.
- Forbidden ownership: decisions tab must not directly mutate non-decision canonical entities.

## 8. Runtime States and UX Behavior

- Loading: list/kanban/timeline states expose loading feedback.
- Empty: no-decision state with clear creation/next-step CTA.
- Error: recoverable error presentation.
- Degraded: partial decision metadata must be visible as degraded.
- Success: create/edit/filter outcomes update context and counters.
- Next action guidance per state: create decision, escalate priority, open blocked item, or retry.

## 9. AI, Source, Evidence, Approval

- AI action placement: command row / Menu 3 only.
- Source/provenance visibility: each decision keeps origin and linked entities visible.
- Approval/diff/review requirements: high-impact decisions require visible review/approval flow.
- Audit trail/evidence: decision status transitions and linked action traces.

## 10. Security, Roles, and Tenancy

- Allowed roles: users with decision access in tenant scope.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: tenant-scoped decision data.
- Sensitive data masking/redaction: policy-driven based on role/tenant.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Decisions tab supports table/kanban/timeline modes.
  - Priority filter and decision filters are available in command row.
  - Decision detail opens and returns to list context safely.
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/DecisionsPanelContent.tsx`
  - `src/components/MyWork/DecisionsKanbanBoard.tsx`
  - `src/components/MyWork/DecisionsTimelineView.tsx`
  - `src/components/MyWork/DecisionDetailView.tsx`
- Known `doc_gap`: explicit decision lifecycle copy matrix still needs deepening.
- Known `code_gap`: no dedicated end-to-end decision governance contract test.

- Route evidence: module route/view scope for `02_moja-praca` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `02_moja-praca` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `02_moja-praca` user flows.

## 12. Open Risks and Change Log

- Risks/assumptions: multi-mode view can hide pending critical items if filters drift.
- Open decisions: default decision view policy for new users.
- Change log: initial function contract created.

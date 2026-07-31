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

> Kompletny kontrakt implementacyjny: [`DECISIONS_COMPLETE_PRODUCT_CONTRACT.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/DECISIONS_COMPLETE_PRODUCT_CONTRACT.md). Wspólny system z Tasks: [`MY_WORK_TASKS_AND_DECISIONS_OPERATING_SYSTEM.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_TASKS_AND_DECISIONS_OPERATING_SYSTEM.md).

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
- Upstream modules/services: decision producers from multiple module workflows, including intake context from `MW_INBOX`.
- APIs/models: shared API and decision domain models.
- Data freshness assumptions: counts/list/detail update cycles can diverge temporarily.

## 6. Outputs and Side Effects

- Produced objects/artifacts: decision updates, created decision records, candidate handoff payloads.
- Downstream handoff: candidate-only handoff to `MW_TASKS`, `05_inicjatywy`, and `06_realizacja` when decision outcome requires action.
- Side effects visible to user: updated decision status, opened decision detail, changed view mode, explicit handoff intent cards.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: decision domain for decision lifecycle; owner modules keep canonical ownership for downstream entities.
- Handoff contract (`from -> to`): `MW_DECISIONS -> MW_TASKS | 05_inicjatywy | 06_realizacja` must carry source/evidence/intent and remain candidate-only until owner read-back.
- Forbidden ownership: decisions tab must not directly mutate non-decision canonical entities or report downstream success before owner confirmation.

## 8. Runtime States and UX Behavior

- Loading: list/kanban/timeline states expose loading feedback with preserved filter/view context.
- Empty: no-decision state with clear creation/import/next-step CTA.
- Error: recoverable error presentation with retry or fallback navigation.
- Degraded: partial decision metadata, stale source links, or ACL-restricted context must be visible as degraded.
- Success: create/edit/filter outcomes update context and counters without implying downstream mutation success.
- Next action guidance per state: create decision, escalate priority, open blocked item, retry, or trigger explicit owner-lane handoff.

### Decision lifecycle taxonomy (contract lock)

- Canonical lifecycle statuses: `draft`, `review`, `approved`, `rejected`, `deferred`, `escalated`, `blocked`.
- Transition posture:
  - high-impact transitions require explicit approval and audit trace,
  - bulk transitions require explicit diff/review confirmation,
  - owner-lane conversion is a separate handoff step and not a lifecycle status.
- High-impact triggers (minimum):
  - ownership transfer,
  - downstream conversion (`MW_TASKS`, `05_inicjatywy`, `06_realizacja`),
  - irreversible closure of escalated/blocked decisions.

## 9. AI, Source, Evidence, Approval

- AI action placement: command row / Menu 3 only (right-side slot), no duplicate decision AI toolbar in content area.
- Source/provenance visibility: each decision keeps origin, linked entities, and evidence posture visible before high-impact conversion.
- Approval/diff/review requirements: high-impact decisions must follow `proposal -> approval -> execute -> owner read-back`.
- Audit trail/evidence: decision status transitions, approval checkpoints, and linked handoff traces must be auditable.

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
  - High-impact actions follow explicit approval and owner read-back chain before downstream success is shown.
  - Decision handoff to `MW_TASKS`, `05_inicjatywy`, `06_realizacja` remains candidate-only until owner module confirmation.
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/DecisionsPanelContent.tsx`
  - `src/components/MyWork/DecisionsKanbanBoard.tsx`
  - `src/components/MyWork/DecisionsTimelineView.tsx`
  - `src/components/MyWork/DecisionDetailView.tsx`
- Known `doc_gap`: full copy matrix for lifecycle transitions and escalation messaging still needs deepening.
- Known `code_gap`: no dedicated end-to-end decision governance contract test for `proposal -> approval -> handoff -> owner read-back`.

- Route evidence: module route/view scope for `02_moja-praca` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `02_moja-praca` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `02_moja-praca` user flows.

## 12. Open Risks and Change Log

- Risks/assumptions: multi-mode view can hide pending critical items if filters drift.
- Open decisions: default decision view policy for new users; minimum required owner read-back payload fields for each target lane.
- Change log: 2026-05-10 scope hardening for lifecycle taxonomy, approval chain, provenance gate, and dependency impact-only handoff.

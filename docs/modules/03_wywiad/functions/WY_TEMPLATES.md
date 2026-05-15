---
module_id: MODULE_INTERVIEW
function_id: WY_TEMPLATES
function_name: Interview — Templates
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Templates

## 1. Function Identity
- Function ID: `WY_TEMPLATES`
- UI labels: `Szablony`, `Templates`
- Scope: Interview tab `templates`
- Feature state: `real`

## 2. User Job and Business Outcome
- User job: manage interview templates and question sets.
- Outcome: consistent, reusable interview execution quality.

## 3. Trigger and Entry Points
- Entry: `templates` tab, open-template documents in hub.

## 4. UI Component Footprint
- Template list/cards and preview panes in `InterviewHub`.
- Question-loading detail and template actions via row/context menus.

## 5. Inputs, Data Contracts, and Dependencies
- Template metadata: scope, area tags, status, question sets.
- APIs: `/interview/templates`, `/interview/templates/:id/questions`.

## 6. Outputs and Side Effects
- Template edits/selection and question preview loads.

## 7. Ownership and Handoff Boundaries
- Owner: interview template domain.
- Must not directly mutate non-interview canonical objects.

## 8. Runtime States and UX Behavior
- Loading/empty/error/degraded states explicit for template and question fetches.
- Next actions: select template, inspect questions, assign/use in session.

## 9. AI, Source, Evidence, Approval
- AI augmentations are contextual; final template governance remains explicit.

## 10. Security, Roles, and Tenancy
- Template visibility obeys tenant/scope policies.

## 11. Acceptance Criteria and Test Evidence

- Template tab supports table/cards and question preview loading.

- Route evidence: module route/view scope for `03_wywiad` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `03_wywiad` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `03_wywiad` user flows.

## 12. Open Risks and Change Log
- Risk: template metadata completeness may vary by source.
- Change log: initial function contract created; execution-card/task-board linkage added for scoped delivery.

## 13. Execution Card and Task Board Linkage

- Scope anchor lock: `03_wywiad/WY_TEMPLATES` (immutable for this cycle).
- Source execution card: `docs/modules/03_wywiad/function-cards/WY_TEMPLATES_EXECUTION_CARD.md`.
- Source task board row set: `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md` (`WY-TPL-*` only).
- Active task IDs:
  - `WY-TPL-P0-001` (`READY`)
  - `WY-TPL-P1-001` (`WAITING_P0`)
  - `WY-TPL-P2-001` (`WAITING_P0`)
- Dependency scope (`impact-only`): `WY_SESSIONS`, `WY_INSIGHTS`.

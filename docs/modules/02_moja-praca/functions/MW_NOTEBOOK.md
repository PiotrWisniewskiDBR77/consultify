---
module_id: MODULE_MY_WORK
function_id: MW_NOTEBOOK
function_name: Notebook / Notatnik
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Notebook / Notatnik

## 1. Function Identity

- Function ID: `MW_NOTEBOOK`
- Module: `02_moja-praca`
- UI labels/aliases: `Notatnik`, `Notebook`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/notebook"`
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: write and organize structured working notes.
- Business outcome: preserve knowledge and connect notes to actionable delivery.
- Non-goals: notebook must not bypass ownership and approval boundaries in other modules.

## 3. Trigger and Entry Points

- Entry points: Notebook tab, deep-link path, context-open events.
- Preconditions: My Work access.
- Blocking conditions: none beyond standard ACL/tenant checks.

## 4. UI Component Footprint

- Top-level container/view components: `MyWorkHub`.
- Function runtime components: `NotebookContent`.
- Panel/tool controls: `WorkspacePanelStrip` (`tools/context/ai_suggestions` mapping).
- Component ownership notes: notebook editor is module-local; panel strip is shared hub pattern.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: notebook page id, search query, linked-ideas/topics/chat panel flags.
- Upstream modules/services: linked ideas context from My Work domain.
- APIs/models: shared API client and workspace types.
- Data freshness assumptions: notebook page selection and side panels can refresh asynchronously.

## 6. Outputs and Side Effects

- Produced objects/artifacts: notebook page updates, linked context updates.
- Downstream handoff: linked ideas and cross-module references through explicit navigation.
- Side effects visible to user: panel changes, page create/open, notebook counts updates.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: notebook records.
- Handoff contract (`from -> to`): notebook links to idea and other object contexts; mutation ownership remains with object owner.
- Forbidden ownership: notebook cannot directly mutate foreign module canonical records.

## 8. Runtime States and UX Behavior

- Loading: lazy-loaded notebook content with fallback.
- Empty: clear create-note guidance.
- Error: notebook failure surfaced without raw internals.
- Degraded: one panel may be unavailable while core note editing remains.
- Success: note update confirms persisted state and keeps context.
- Next action guidance per state: create note, open related idea, review linked context.

## 9. AI, Source, Evidence, Approval

- AI action placement: Menu 3 panel strip and command row only.
- Source/provenance visibility: linked ideas and references stay visible in panel context.
- Approval/diff/review requirements: high-impact actions route to owner module review.
- Audit trail/evidence: notebook actions and linked object references remain observable.

## 10. Security, Roles, and Tenancy

- Allowed roles: users with My Work scope.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: tenant-scoped notebook records.
- Sensitive data masking/redaction: inherited from global/owner-module policy.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Notebook tab renders editor and panel-strip controls.
  - Panel switches do not leak state into other tabs.
  - Notebook supports open/create with clear next actions.
- Code/runtime evidence:
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/NotebookContent.tsx`
- Known `doc_gap`: panel-by-panel behavior copy matrix not fully enumerated.
- Known `code_gap`: no dedicated notebook journey integration test.

## 12. Open Risks and Change Log

- Risks/assumptions: panel complexity can reduce clarity if next-action hints are weak.
- Open decisions: naming and UX parity of notebook side panels.
- Change log: initial function contract created.

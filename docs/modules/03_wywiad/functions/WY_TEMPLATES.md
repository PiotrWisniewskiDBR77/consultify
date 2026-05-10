---
module_id: MODULE_INTERVIEW
function_id: WY_TEMPLATES
function_name: Interview — Templates
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
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
- Evidence: `InterviewHub.tsx` template paths and API calls.

## 12. Open Risks and Change Log
- Risk: template metadata completeness may vary by source.
- Change log: initial function contract created.

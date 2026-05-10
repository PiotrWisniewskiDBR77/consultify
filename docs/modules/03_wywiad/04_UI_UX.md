---
module_id: MODULE_INTERVIEW
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Wywiad / Interview

## 1. Main Screen

As-Is: Interview routes render `InterviewHub` with ModuleHub-style tabbed surfaces. The screen job is structured interview work: session/template/insight tables, preview panes, assignment modals, template builders, insight viewers and row action menus. Interview/discovery route aliases normalize breadcrumbs to Interview context in `AppRoutes.tsx`.

## 2. Runtime States

- Loading: hub and table/preview refreshes must show visual loaders or refresh indicators.
- Empty: empty tables/previews must use explicit empty states such as `EmptyStateInline` and explain how to start or filter work.
- Error: errors must use guarded toast copy and safe error mapping, not raw API internals.
- Degraded: missing templates, partial insight data or unavailable assignment/review flows must be labeled honestly.
- Success: assignment, review, template or export-related completions must confirm what changed and what the user should inspect next.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps the module shell. Menu 3 is the Interview hub command row/table action area for the active tab, selected row or modal context. Context actions may also appear in row menus when scoped to a row.

## 4. AI Actions Placement

Contextual AI actions for interview analysis, review or summarization must live in Menu 3/right-side command slots or the active row/modal context. They must not be duplicated as a second toolbar under the canvas.

## 5. Next Action Guidance

Every interview state must tell the user whether to create a session, assign an owner, review an insight, clear filters, retry loading or export approved material.

## 6. Source / Evidence / Provenance

Insights, diagnoses and exports must expose interview session/template/source context. AI or analyst-generated conclusions must be traceable to the relevant interview record or explicitly marked as missing evidence.

## 7. Approval / Diff / Review

Assignment, review and export-related operations must be explicit user actions. High-impact interview conclusions or generated outputs require review/approval before being treated as final.

## 8. Anti-Patterns

- Interview insights without session/source provenance.
- Raw tenant/user internals in business-facing tables.
- Silent assignment or review-state mutation.
- Duplicate AI toolbar under the table/canvas.
- Empty preview that does not explain selection or next action.

## 9. As-Is Gaps

- Existing docs confirm hub loaders, empty states and guarded errors, but the exact degraded copy for missing templates/partial insights is not fully specified.
- Evidence display requirements for every insight/export path need runtime verification.

## 10. Acceptance Criteria

- Interview routes render `InterviewHub` as the documented main workspace.
- Loading, empty, error, degraded and success states are explicit across tables, previews and modals.
- Contextual AI actions stay in Menu 3/right-side or row-scoped controls without duplication.
- Insights and exports show source/provenance.
- Assignment/review/export mutations require explicit user action and visible result.

## 11. Function Annex — Interview Functions

| Function ID | Menu label | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `WY_MY_ASSIGNMENTS` | `My Assignments` | `InterviewHub` tab `my_assignments` | real | `InterviewHub`, assignment table/cards, row actions | `functions/WY_MY_ASSIGNMENTS.md` |
| `WY_MANAGED_ASSIGNMENTS` | `Managed` | `InterviewHub` tab `managed` | real (permission-dependent) | `InterviewHub` managed assignment views | `functions/WY_MANAGED_ASSIGNMENTS.md` |
| `WY_SESSIONS` | `Sessions` | `InterviewHub` tab `sessions` | real | session list + dynamic document panels in `InterviewHub` | `functions/WY_SESSIONS.md` |
| `WY_TEMPLATES` | `Templates` | `InterviewHub` tab `templates` | real | template list/cards, question preview in `InterviewHub` | `functions/WY_TEMPLATES.md` |
| `WY_INSIGHTS` | `Insights` | `InterviewHub` tab `insights` | real | insight list/report views + preview in `InterviewHub` | `functions/WY_INSIGHTS.md` |
| `WY_PENDING_REVIEW` | `Pending Review` | `InterviewHub` tab `pending_review` | real (permission-dependent) | review-filtered table/preview controls | `functions/WY_PENDING_REVIEW.md` |

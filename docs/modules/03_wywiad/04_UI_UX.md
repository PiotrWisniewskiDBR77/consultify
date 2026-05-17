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
| `WY_INITIATIVES` | `Inicjatywy` | `InterviewHub` tab/lane `inicjatywy` | real | initiative candidate list, source chips, creator/review and handoff controls | `functions/WY_INITIATIVES.md` |
| `WY_PENDING_REVIEW` | `Pending Review` | `InterviewHub` tab `pending_review` | real (permission-dependent) | review-filtered table/preview controls | `functions/WY_PENDING_REVIEW.md` |

## 12. Interview Initiatives UX Annex

The `Inicjatywy` lane visible inside Interview is governed by `WY_INITIATIVES` in this cycle.

### 12.1 User Job

The user reviews initiative candidates that originate from interview insights or findings and decides whether to inspect, refine or hand them off to the canonical Initiatives module.

### 12.2 Required UI Elements

- Interview-local initiative list with columns for initiative name, status, priority, source and date.
- Source chip such as `Insight` for every interview-derived candidate.
- Clear draft/candidate state before canonical handoff.
- Row action or Menu 3 action for reviewing source context and initiating handoff.
- Safe empty state explaining how initiatives are generated or added from insights.
- Safe degraded state when source insight/session data or handoff confirmation is unavailable.

### 12.3 Source / Provenance

Every interview initiative candidate must expose:

- source insight/finding reference,
- interview session context when available,
- generation/manual creation mode,
- accepted/reviewed-by metadata when available,
- missing evidence warning when source data is incomplete.

### 12.4 Ownership Boundary

- `03_wywiad/WY_INITIATIVES` owns interview-local initiative candidates, creator review and handoff/read-back state before canonical handoff.
- `03_wywiad/WY_INSIGHTS` owns source insight context only.
- `05_inicjatywy` owns canonical initiative lifecycle, approval, status, governance and execution handoff after read-back.
- The Interview UI must not imply that a canonical initiative was created unless the downstream owner surface confirms it.

### 12.5 AI Action Placement

AI actions such as `Generate initiative candidates`, `Improve candidate`, `Explain source` or `Prepare handoff` must live in Menu 3/right-side command row or row-scoped actions.

They must not be duplicated as a toolbar inside the table/canvas.

## 13. RAW Depth UI/UX Annex

| RAW source | UX decision | Evidence state |
| --- | --- | --- |
| `docs/RAW/110_RAW_INTERVIEW_DISCOVERY_ENGINE_2026-05-11.md` | Interview discovery UX requires explicit source lineage, review-first candidate flow and no hidden downstream mutation. | `PASS_DOC`; runtime journey evidence remains `NOT_DONE`. |
| `docs/modules/03_wywiad/RAW_INPUT.md` | Keep Interview source/provenance visible for sessions, insights, candidates and exports. | `PASS_DOC`; full `InterviewHub` journey test `NOT_DONE`. |
| `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` | Conversation-origin context may seed interview work only with visible source refs and review before durable mutation. | `IMPACT_ONLY`; handoff proof `NOT_DONE`. |
| `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md` | Interview handoff to initiatives/execution must not imply PMO ownership. | `PASS_DOC`; owner generator decision `OPEN_QUESTION`. |

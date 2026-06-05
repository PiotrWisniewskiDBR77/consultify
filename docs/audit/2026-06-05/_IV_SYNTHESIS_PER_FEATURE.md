# Interview Module — Per-Feature Audit Synthesis

**Date:** 2026-06-05
**Branch:** `feat/wave1-foundations`
**Method:** 7 parallel code-verified audits — one per feature tab + one cross-cutting visual/table audit. Individual reports: `_IV_{INBOX,SESSIONS,ASSIGNED,TEMPLATES,INSIGHTS,INITIATIVES,VISUAL_TABLE_PATTERN}.md`.

---

## Scorecard

| Feature | Score | One-line |
|---|---|---|
| **Insights** | 88 | Strongest. P10 governance end-to-end, no P0. InsightViewer coherent despite 6k lines. |
| **Initiatives** | 72 | "Real persisted only" holds; wizard canonical; but D5 handoff inflow is broken (source_type NULL → invisible). |
| **Sessions** | 68 | Real end-to-end; new ad-hoc session vanishes on reload; column-resize never persists. |
| **Templates** | 68 | Real data layer; Archive/Restore unwired; fake `Default\|Active` status badge; category hardcoded. |
| **Assigned** | 63 | Real; but **broken authz on lifecycle mutations** (any org member can approve/send-back); sent_back hidden. |
| **Inbox** | 58 | Assignee always "Unknown" (missing JOIN); ALL=4 vs Overdue=12 (caller-scoped vs org-wide juxtaposed). |
| **Visual/Table** | — | No canonical table: 5 hand-written builders, 4 status-pill systems, resize never persisted. |

**Module average ≈ 70.** No feature is mocked — everything hits real endpoints. The losses are correctness, security, and consistency, not vapor.

---

## Systemic themes (cross-cutting — fix once, fix everywhere)

### S1 — v8 routes dropped the permission gates legacy enforces ⚠️ SECURITY
The legacy `/api/interview` stack guards mutations with `requireAnyPermission(['INTERVIEW_ASSIGN_*'])`. The v8 stack — which is the **production path** — dropped them:
- **Assigned P0-1:** `POST /api/v8/interview/assignments/:id/{approve,send-back,remind,start,submit}` have **no permission middleware and no manager-scope check**. Any authenticated org member (incl. a plain assignee) can approve/send-back any submitted assignment in their org. (`routes/v8/interview.routes.ts:350-367`)
- **Sessions P1-1:** `/sessions/managed` + `/accepted` lack the `INTERVIEW_ASSIGN_VIEW/MANAGE` gate the legacy routes have.
- Org isolation still holds (SQL is org-scoped) — this is intra-org privilege escalation, not cross-tenant leak. **Highest-priority fix.**

### S2 — assignee/user name resolution is broken in three different ways
- **Inbox:** `getMyAssignments` never `LEFT JOIN users` / never projects `assignee_name` → always "Unknown" (siblings `getManaged/Overdue` do it right).
- **Assigned:** bare `(first_name || ' ' || last_name)` at 6 sites → NULL-poison on Postgres when either part is null → cell silently shows email.
- **Assigned:** residual `u.name` (column doesn't exist) at `InterviewController.ts:3434,3650,3719` → 500 (the I2 commit fixed the sibling at `:713` but missed these three).
- One fix family: a single `displayName` SQL helper (`TRIM(COALESCE(first_name,'')||' '||COALESCE(last_name,''))`, fallback email) + the missing JOIN.

### S3 — the D5 handoff I just shipped is broken at the seam
Finding→initiative handoff (commit `f45fd2d8db`) creates a real row via `InitiativeDefinitionService.createInitiative`, whose INSERT/type have **no `source_type`/`source_id`** → handoff initiatives get `source_type=NULL` → **never appear in the Initiatives tab** that filters on `source=interview_insight`. The wizard path (`POST /initiatives`) tags it correctly. Fix: route the handoff create through the same source-tracked path the wizard uses.

### S4 — no canonical table; 5 hand-written builders
- 6 tabs = 5 bespoke `<table>` builders in InterviewHub (150–450 lines each), inconsistently wrapped by the one shared piece `TableWithPreviewLayout`.
- `ResizableTable` component never used (only its types); `DataTable` 0 importers (dead); `FilterableTable` used by ~20 other hubs but not Interview.
- **4 different status-pill systems** for the same 5 statuses; Sessions/Assignments/Templates hardcode off-SSOT colors.
- **Column widths never persist** (plain useState) — module-wide; hidden-columns + row-description DO persist.
- **Initiatives is the outlier** — raw table, no preview, no J/K nav, no view toggle.
- View-settings popover + resize-clamp copy-pasted 5×.

### S5 — status modeling bugs
- Templates: fabricated `Default|Active` badge that never reads `template.status` (drafts/archived show "Active"); filters filter by `isDefault` not status.
- Assigned: `sent_back` normalized to `in_progress` in the managed list → send-back round-trips invisible to the manager.

### S6 — dead code to sweep
- `InsightPackView.tsx` (1004 lines, 0 importers), `NewSessionModal.tsx` (592 lines, 0 importers), `DataTable.tsx` (0 importers), the conflicting unmounted `initiatives.routes.ts` (defines a clashing CREATE TABLE).

---

## Proposed canonical table spec (visual agent — for owner approval)

**THE component:** keep `TableWithPreviewLayout` as the shell for all 6 tabs (including Initiatives); build ONE `InterviewDataTable` on the existing `ResizableTable` primitives to replace the 5 hand-written builders. Reject `DataTable`/`FilterableTable` as-is.

**Shared cells/controls (one each, used everywhere):**
- `StatusPill` (single SSOT palette — kills the 4 divergent systems)
- `ProgressCell`, `DueChip` (overdue logic — kills the duplicated helper), `AssigneeCell` (the S2 displayName fix lives here)
- `TableViewSettings` popover + `useColumnResize` hook **with width persistence**
- one empty/loading/error set; keep `RowActionsMenu`

**Migration (ranked):** Phase 0 extract primitives + unify palette (S, ~600 lines deleted) → Phase 1 Initiatives gets the preview shell (biggest UX gap) → Phase 2 fix Sessions-grid/Templates-cards dead-selection → Phase 3 collapse Sessions/Templates/Insights onto InterviewDataTable → Phase 4 Assignments last → Phase 5 cleanup (delete dead components, hex→tokens).

---

## Recommended remediation sequence

**Wave V-A — functional + security P0s (do first, regardless of the visual work):**
1. **S1** restore the v8 permission gates (security — privilege escalation).
2. **S2** unify assignee/name resolution (the JOIN + displayName helper; fixes Inbox "Unknown", Assigned email-fallback + 3× 500s).
3. **S3** fix the D5 handoff to set source_type/source_id (my own bug — initiatives currently invisible).
4. **Inbox count** — Overdue chip from myAssignments (stop juxtaposing caller-scoped vs org-wide).
5. **Templates status** — read real `template.status`; wire Archive/Restore; fix status filters.
6. **Assigned sent_back** — stop normalizing it to in_progress.
7. **Sessions** — ad-hoc new session must appear (assignment-less session loader, or create the assignment row).

**Wave V-B — canonical table migration** (the visual spec above), once approved.

**Wave V-C — dead-code sweep** (S6) + cross-project scope fixes.

This module is the owner's stated "~40% of the remaining work." V-A is the trust/security foundation; V-B is the consistency standard to maintain going forward; Initiatives (the hardest) lands across V-A (S3) + V-B (Phase 1 preview) + scope unification.

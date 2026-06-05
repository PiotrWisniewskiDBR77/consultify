# Interview Module — Inbox Tab Audit

**Date:** 2026-06-05
**Branch:** `feat/wave1-foundations`
**Scope:** ONE feature — the **Inbox** tab of the Interview module (`InterviewTab = 'my_assignments'`).
**Method:** Code-verified (Read / Grep / Glob only). No code modified, no commits.

**Score: 58 / 100**

The Inbox is functionally wired end-to-end (real endpoints, real Assign modal, real
start/remind/open actions, real status/progress/due rendering, proper loading/error/empty
states). It loses points for two concrete, screenshot-visible data-integrity defects — the
**assignee always renders "Unknown"** (the my-assignments query never joins `users`) and a
**confusing ALL=4 vs Overdue=12 count mismatch** (two different datasets, one caller-scoped,
one org-wide, presented as peers under the same sub-filter row). Neither is cosmetic-only:
both directly mislead the user about who owns work and how much is overdue.

---

## Key files

| Concern | File | Lines |
|---|---|---|
| Inbox UI / tab / table / chips | `src/components/Interview/InterviewHub.tsx` | 583, 879-887, 1738-1747, 2281-2356, 5607-6420, 7646-7855 |
| V8 assignment API client | `src/services/api/v8/interview.ts` | 79-120, 595-636 |
| V8 routes (my/managed/overdue) | `server/src/routes/v8/interview.routes.ts` | 303-348 |
| Legacy REST routes (fallback) | `server/src/routes/interview.routes.ts` | 83-120 |
| Service query methods | `server/src/services/InterviewAssignmentService.ts` | 734-886, 1398-1431 |
| Legacy controller getMyAssignments | `server/src/controllers/InterviewController.ts` | 2171-2281 |
| Manager-scope resolver | `server/src/services/interviewManagerScope.ts` | 21-88 |

---

## How the Inbox loads (verified path)

1. **Tab default.** `activeTab` defaults to `'my_assignments'` (InterviewHub.tsx:583). The
   Inbox renders `rows = myAssignments || []` (InterviewHub.tsx:7647) and calls
   `renderAssignmentsTable(rows, false)` — `showAssignee = false` (InterviewHub.tsx:7851).
2. **Fetch.** `loadMyAssignments()` (InterviewHub.tsx:879-887) calls
   `V8InterviewApi.getMyAssignments()` → `GET /api/v8/interview/assignments/my`
   (interview.ts:595-596), with a fallback to legacy `GET /interview/assignments/my`
   (InterviewHub.tsx:882). Both paths exist and respond.
3. **V8 server.** Route `/assignments/my` (v8/interview.routes.ts:303-309) calls
   `getMyAssignments(userId, organizationId)` →
   `InterviewAssignmentService.getMyAssignments` (service:734-778).
4. **Legacy server (fallback).** `InterviewController.getMyAssignments`
   (controller:2171-2281).
5. **Normalize.** Client maps each row through `normalizeInterviewAssignmentRecord`
   (InterviewHub.tsx:515-520) — which only normalizes `status`; it does **not** synthesize an
   assignee.

The list loads. Filters, Assign, and row actions are real (see Functionality). The two
anomalies are below.

---

## ANOMALY 1 — Assignee = "Unknown" for every Inbox row

### Root cause (CONFIRMED): the my-assignments query never selects an assignee name; the mapper only attaches `assignee` when `assignee_name` is present.

**Render site.** InterviewHub.tsx:6256-6274 — the Assignee cell:
```
{assignment.assignee?.name?.charAt(0) || '?'}                      // avatar
{assignment.assignee?.name || assignment.assignee?.email || 'Unknown'}  // label
```
So the column shows "Unknown" + "?" iff `assignment.assignee` is `undefined`.

**V8 service path.** `getMyAssignments` (service:758-775) selects:
```
a.*, t.name as template_name, t.description, t.category,
s.status as session_status, s.answered_questions, s.total_questions
FROM interview_assignments a
LEFT JOIN interview_library_templates t ...
LEFT JOIN interview_sessions s ...
```
There is **no `LEFT JOIN users`** and **no `assignee_name` / `assignee_email`** projection.
Contrast `getManagedAssignments` (service:823-828) and `getOverdueAssignments`
(service:871-879), which both DO `LEFT JOIN users u ON u.id = a.assignee_user_id` and select
`(u.first_name || ' ' || u.last_name) as assignee_name, u.email as assignee_email`.

**Mapper.** `mapRowToAssignmentWithDetails` (service:1398-1431) attaches the assignee object
**only when the column exists**:
```
if (row.assignee_name) {
  assignment.assignee = { id: row.assignee_user_id, name: row.assignee_name, email: row.assignee_email };
}
```
For my-assignments rows, `row.assignee_name` is `undefined` → `assignment.assignee` is never
set → frontend falls through to `'Unknown'`.

**Legacy REST fallback path has the SAME hole.** `InterviewController.getMyAssignments`
(controller:2187-2235) selects the same columns with no `users` join, and the explicit
`mapped` object (controller:2242-2277) builds `template` and `session` but **emits no
`assignee` / `assigneeName` field at all**. So even if the V8 route 500'd and the client fell
back to legacy REST, the assignee would still be absent.

### Relationship to commit cfce7481d2

This is a **sibling of, not the same as,** the `users.name` bug fixed in cfce7481d2. That
commit fixed two queries (`getTeamMembers` :713 and `dispatchReminder` :1207) that read a
non-existent `users.name` column and threw 500/`undefined`. The fix switched those to
`first_name`/`last_name`. The Inbox assignee bug is a **different class**: it is not a
wrong-column read that throws — it is a **missing join + missing projection**. The
my-assignments query simply never asks for the assignee identity, so nothing populates the
`assignee` object. Same family ("assignee identity resolution is brittle and inconsistent
across the three list queries"), different mechanism. The fix from cfce7481d2 already
established the correct expression (`first_name || ' ' || last_name`) used by the *other two*
list queries — my-assignments was just never given it.

### Why it matters (and why it's arguably benign in the screenshot context)

The Inbox is the caller's **own** assignments (assignee = the caller, or a team member of the
caller's assignment). For a single-assignee Inbox row, "who is this assigned to" is "me" — so
the column is low-value there. BUT: (a) it still renders a broken "Unknown / ?" for every row
(visible, unpolished, looks like a bug to any user — exactly the screenshot), and (b)
team-assignment rows (where the caller is a *member*, not the primary assignee) have a real,
non-self primary assignee that the user genuinely cannot see. The column is shown by default
(`INTERVIEW_ASSIGNMENTS_TABLE_DEFAULT_HIDDEN_COLUMNS = []`, InterviewHub.tsx:161;
`hasAssigneeColumn = !hiddenSet.has('assignee')`, InterviewHub.tsx:5614), so every user sees it.

### Fix sketch (pick ONE; A is canonical)

- **A — Backend, mirror the other two queries (recommended).** In
  `getMyAssignments` (service:758-775) add `LEFT JOIN users u ON u.id = a.assignee_user_id`
  and project `(u.first_name || ' ' || u.last_name) as assignee_name, u.email as
  assignee_email`. Mirror the exact expression already used at service:823-824 / 871-872. The
  existing mapper (service:1422-1428) then populates `assignee` for free. Also mirror in the
  legacy `InterviewController.getMyAssignments` (controller:2187-2235 query +
  controller:2242-2277 mapped object — add an `assignee: { id, name, email }` block) so the
  REST fallback matches. NOTE: prefer `TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))`
  over a bare concat so a NULL last_name doesn't poison the whole string (cfce7481d2 used the
  COALESCE form for exactly this reason — the plain `||` form at service:823/871 is itself a
  latent bug: a NULL component yields NULL in Postgres).
- **B — Frontend fallback (defense-in-depth, cheap).** In the render
  (InterviewHub.tsx:6263/6271) fall back to the caller's own display name when
  `assignee_user_id === currentUser.id`, else to a short id. This hides the "Unknown" for the
  common self-assignment case even before B ships, but does NOT solve team rows.
- **C — Hide the column in the Inbox view.** Since `showAssignee=false` for the Inbox, the
  assignee column arguably should not be shown at all in the self-inbox (it's redundant with
  "me"). Add `'assignee'` to the inbox default-hidden set. This is the lowest-effort cosmetic
  fix but discards genuine info for team rows. Not recommended as the sole fix.

---

## ANOMALY 2 — ALL = 4 but Overdue = 12 (all 4 visible rows ARE overdue)

### Root cause (CONFIRMED): the four sub-filter chips are computed from THREE different datasets — ALL/My-inbox from the caller-scoped `myAssignments`, Overdue from the ORG-WIDE `overdueAssignments`, To-approve from `managedAssignments`.

**Where the counts come from** (InterviewHub.tsx:2281-2347):
```
myInboxCount = myAssignments.filter(a => a.status !== 'approved' && a.status !== 'completed').length
ALL.count        = myInboxCount                                  // :2306   → 4
My inbox.count   = myInboxCount                                  // :2316   → 4   (identical to ALL!)
To approve.count = managedAssignmentStatusCounts.submitted       // :2326
Overdue.count    = overdueAssignments.length                     // :2338   → 12
```

So:
- **ALL and My inbox are the *same* number** (`myInboxCount`), both derived from
  `myAssignments` = the caller's own assignments (assignee = caller OR caller is a member),
  status not approved/completed. The "ALL" label is misleading — it is not "all assignments
  in the org", it is "all of MY inbox". (ALL and My inbox being identical, 4 and 4, is itself
  a redundancy smell — see P1.)
- **Overdue (12)** = `overdueAssignments.length`. That array comes from
  `loadOverdueAssignments()` → `GET /api/v8/interview/assignments/overdue`
  (interview.ts:601-602) → route (v8/interview.routes.ts:336-347) →
  `getOverdueAssignments(organizationId, { scope })` (service:840-886).

**Why Overdue is org-wide.** The overdue route resolves the manager scope
(v8/interview.routes.ts:339-345) via `resolveInterviewManagerScope`
(interviewManagerScope.ts:21-68). Piotr is **CTO / OWNER**;
`isOrgWideInterviewManagerRole` returns true for `SUPERADMIN/OWNER/ADMIN/PROJECT_MANAGER`
(interviewManagerScope.ts:4, 17-19, 26-28) → scope = `{ kind: 'organization' }`. The scope
clause for `organization` is **empty** (interviewManagerScope.ts:75-77), so
`getOverdueAssignments` filters only by `due_at < now AND status NOT IN
('completed','submitted') AND organization_id = ?` (service:848-853) — i.e. **every overdue
assignment in the whole org, regardless of who it's assigned to**. Hence 12.

**Why the 4 visible rows are all overdue but ALL says 4.** While `activeTab ===
'my_assignments'`, the table renders `myAssignments` directly (InterviewHub.tsx:7647) — the
caller has exactly 4 own assignments, and in this dataset they happen to all be past due
(the "98d overdue" chips). So the *rows* are the caller's 4 (all overdue); the *Overdue chip*
counts the org's 12. They are answering two different questions ("how many of MY assignments"
vs "how many overdue org-wide") while sitting side by side as if they were a filter
breakdown of one set. **This is a labeling / scoping bug, not a wrong COUNT() — both numbers
are individually correct for their query, but the juxtaposition is wrong.**

**Aggravating UX wrinkle:** clicking the Overdue chip does NOT filter the Inbox in place — it
**switches `activeTab` to `'managed'`** and sets `assignmentStatusFilter='overdue'`
(InterviewHub.tsx:2342-2344), after which `filteredManagedAssignments` returns
`overdueAssignments` wholesale (InterviewHub.tsx:1739-1741). Same for To-approve
(:2330-2331). So two of the four "Inbox sub-filters" actually navigate the user out of the
Inbox into the Managed tab. The chips are presented as filters of one list but two of them
are cross-tab jumps backed by different queries.

### Fix sketch

- **A — Make the Overdue chip caller-scoped to match ALL/My-inbox (recommended for the
  Inbox).** Compute overdue from `myAssignments` for the Inbox sub-filter:
  `myAssignments.filter(a => isOverdue(a.dueAt) && a.status !== 'completed' && a.status !==
  'approved').length`. That yields 4 (matching the visible rows) and makes the chip an honest
  in-place filter of the Inbox. Keep the org-wide `overdueAssignments` for the **Managed** tab
  / overdue manager view, where org scope is intended.
- **B — Relabel + regroup if org-wide overdue is intended here.** If the product wants the
  manager's org-wide overdue surfaced from the Inbox, move To-approve/Overdue out of the
  Inbox sub-filter row into a clearly-separated "Manager" cluster (they already jump to the
  `managed` tab), and label ALL as "My inbox (all)" so it isn't read as org-wide. Don't show
  a caller-scoped count (4) next to an org-scoped count (12) as peers.
- **C — De-dupe ALL vs My inbox.** They are byte-for-byte identical (both `myInboxCount`,
  both `onClick` set the same state, InterviewHub.tsx:2303-2322). Drop one, or give "ALL" a
  genuinely broader meaning. As shipped, two chips do the exact same thing.

---

## Functionality

**Works (verified):**
- **List load.** `GET /api/v8/interview/assignments/my` with legacy REST fallback
  (InterviewHub.tsx:879-887). Both server paths implemented and return mapped rows.
- **Assign button → modal → real create.** `Assign` opens `AssignInterviewModal`
  (InterviewHub.tsx:8595-8618; trigger e.g. :4840-4844, :3420-3423). The modal POSTs a real
  assignment to `POST /interview/assignments` (AssignInterviewModal.tsx:343) — backed by
  `InterviewController.createAssignment` (interview.routes.ts:120; controller:2283). On
  success it refreshes my/managed/overdue lists (InterviewHub.tsx:8601-8616). Not stubbed.
- **Row action: Open.** `openInterviewAssignmentFull` (InterviewHub.tsx:5473), wired on
  row dblclick / Enter / menu (InterviewHub.tsx:6170-6172, 6184-6189, 6353-6354). Real.
- **Row action: Start.** For `status === 'assigned'` (InterviewHub.tsx:6356), calls
  `V8InterviewApi.startAssignment` with REST fallback (InterviewHub.tsx:5797-5803), opens the
  returned session as a document, then refreshes lists (InterviewHub.tsx:5824-5832). Real.
- **Row action: Remind.** `handleSendReminder` → `V8InterviewApi.remindAssignment` with REST
  fallback (InterviewHub.tsx:5846-5848). Real. (Note: the underlying reminder *scheduler* was
  dormant until cfce7481d2 registered it; the manual remind button itself fires an immediate
  dispatch.)
- **Loading / error / empty.** `isLoading` (InterviewHub.tsx:767), `assignmentsLoading`
  (:779), `assignmentsLoadError` (:773), per-domain load errors (:769-773),
  empty message "No assignments" / "Brak przydziałów" (InterviewHub.tsx:7847). Present.
- **List/grid toggle.** `viewMode` state (InterviewHub.tsx:584) toggles between the table
  render (`renderAssignmentsTable`, InterviewHub.tsx:7851) and a grid (`gridItems`,
  InterviewHub.tsx:7655+). Both real.

**Not stubbed / no mock data found** in the Inbox path. (There is an `isUsingDemoData` flag
that relaxes `canAssign` at InterviewHub.tsx:814, but it gates permissions, not the list
data.)

**Filters:**
- **My inbox** — works, filters `myAssignments` to non-approved/non-completed (it's actually
  the same as ALL; both are `myInboxCount`).
- **To approve** — switches to Managed tab, filters to `status === 'submitted'`
  (InterviewHub.tsx:2330-2331, 1743-1744). Gated on `canViewManaged` (:2327). Works, but is a
  cross-tab jump, not an in-place Inbox filter.
- **Overdue** — switches to Managed tab, shows org-wide `overdueAssignments`
  (InterviewHub.tsx:2342-2344, 1739-1741). Works mechanically; scope is the Anomaly-2 issue.

---

## Data integrity

- **Assignee** — BROKEN for Inbox (Anomaly 1). Always "Unknown / ?".
- **Status mapping** — OK. `getAssignmentStatusColor` (InterviewHub.tsx:5316-5337) and
  `getAssignmentStatusLabel` (:5339-5357) cover assigned/in_progress/submitted/sent_back/
  approved/completed/review/rejected/accepted/drafting, EN+PL. Server normalizes via
  `normalizeAssignmentStatusForClient` (controller:2245). Consistent.
- **Progress %** — OK and real. `assignment.session?.completenessPercent` (InterviewHub.tsx:6155),
  computed server-side as `round(answered/total*100)` (service:1418; controller:2274). When
  an assignment is `assigned` but not started there is no session → progress 0 → empty bar.
  Correct, though a "—" might read better than a 0% bar for never-started rows (P2).
- **Days-to-due** — OK and real. Two parallel helpers: `getAssignmentDaysToDue`
  (InterviewHub.tsx:5359-5391, used by the table cell at :6315) and an inner `getDaysToDue`
  (InterviewHub.tsx:5739-5760, used by the grid). Both `Math.ceil` day-diff with midnight
  normalization, EN/PL labels, color coding. The "98d overdue" chips are real arithmetic, not
  hardcoded. (Duplication between the two helpers is a P2 maintenance smell.)
- **Empty/loading/error** — present (see Functionality).

---

## Visual

- **Columns** — Template | Assignee | Status | Progress | Days to Due | (actions). All real
  (InterviewHub.tsx:5970-6338). Resizable (`renderAssignmentResizer`, :5976, 5661). Column
  show/hide menu real (:6040-6070).
- **Status pills** — real, color-coded by status (InterviewHub.tsx:6276-6288, classes at
  :5316-5337).
- **Progress bars** — real fill driven by `progress%` (InterviewHub.tsx:6296-6306).
- **Overdue/due chips** — real, with AlertTriangle/Clock/Calendar icons by urgency
  (InterviewHub.tsx:6318-6334).
- **List/grid toggle** — real (`viewMode`, InterviewHub.tsx:584; grid branch :7655).
- **Placeholder / hardcoded values found:** the "?" avatar initial and "Unknown" label
  (InterviewHub.tsx:6263, 6271) are the only hardcoded placeholders — and they are firing for
  every row because of Anomaly 1, not because they're intended placeholders.

---

## Permissions

- **Inbox list is correctly caller-scoped — no cross-user leak.** `getMyAssignments`
  (service:745-749) constrains to `a.organization_id = ? AND (a.assignee_user_id = ? OR
  EXISTS(... interview_assignment_members m WHERE m.user_id = ?))` — caller's own
  assignments + assignments where caller is a team member, within the caller's org. Legacy
  controller mirrors this (controller:2176, with members-table fallback at :2209-2210). Org
  id and user id come from the authenticated context (`getV8Context` at
  v8/interview.routes.ts:306; `requireUser` at controller:2172). Good.
- **The leak-adjacent concern is the Overdue chip, not the Inbox list.** `getOverdueAssignments`
  is org-wide for OWNER/ADMIN (Anomaly 2). That is *by design* for a manager overdue view,
  and the chip is gated behind `canViewManaged` (InterviewHub.tsx:2339) and jumps to the
  Managed tab. So it is not an unauthorized leak — but a non-manager would see Overdue
  count = 0 (InterviewHub.tsx:2338 `canViewManaged ? ... : 0`), which is correct gating.
- **Assign / To-approve / Overdue** all gated on `canAssign` / `canViewManaged`
  (InterviewHub.tsx:2327, 2339, 814; `useInterviewPermissions` at :565-573). Good.

---

## Findings (ranked)

### P0
1. **Assignee always "Unknown" in the Inbox.** `getMyAssignments` omits the `users` join and
   `assignee_name`/`assignee_email` projection, so the mapper (service:1422) never attaches
   `assignment.assignee`; the frontend (InterviewHub.tsx:6263, 6271) falls through to
   "Unknown / ?". Same gap in the legacy controller (controller:2187-2235 query,
   2242-2277 mapper — no assignee emitted). **Fix:** Anomaly-1 fix A.
   - `server/src/services/InterviewAssignmentService.ts:758-775`
   - `server/src/controllers/InterviewController.ts:2187-2277`
   - render: `src/components/Interview/InterviewHub.tsx:6263,6271`

2. **Count mismatch ALL(4)/Overdue(12) — caller-scoped vs org-wide datasets shown as peers.**
   ALL/My-inbox = `myInboxCount` from caller-scoped `myAssignments`
   (InterviewHub.tsx:2306,2316,2282-2284); Overdue = org-wide `overdueAssignments.length`
   (InterviewHub.tsx:2338), org scope from `resolveInterviewManagerScope` →
   `{kind:'organization'}` → empty clause (interviewManagerScope.ts:26-28,75-77;
   service:848-853). **Fix:** Anomaly-2 fix A (compute overdue from `myAssignments` for the
   Inbox chip).
   - `src/components/Interview/InterviewHub.tsx:2282-2347`
   - `server/src/services/interviewManagerScope.ts:75-77`
   - `server/src/services/InterviewAssignmentService.ts:848-853`

### P1
3. **ALL and My-inbox chips are identical no-op duplicates.** Both = `myInboxCount`, both
   `onClick` set the same state (InterviewHub.tsx:2303-2322). Two chips, one behavior. Drop
   one or redefine "ALL". `src/components/Interview/InterviewHub.tsx:2303-2322`
4. **Overdue/To-approve chips silently switch tabs.** Presented in the Inbox sub-filter row
   but `onClick` sets `activeTab='managed'` (InterviewHub.tsx:2330,2342). A user expecting an
   in-place Inbox filter gets bounced to another tab. Either keep them in-place (filter
   `myAssignments`) or visually separate them as a manager cluster.
   `src/components/Interview/InterviewHub.tsx:2323-2346`
5. **NULL-name concatenation in the OTHER two list queries.** `(u.first_name || ' ' ||
   u.last_name)` (service:823,871) yields NULL in Postgres if either part is NULL, silently
   dropping the assignee for users with no last name. cfce7481d2 already moved
   getTeamMembers/dispatchReminder to the `TRIM(COALESCE(...))` form; managed/overdue queries
   were not updated. Use the same COALESCE form when fixing P0 #1.
   `server/src/services/InterviewAssignmentService.ts:823,871`

### P2
6. **Two duplicated days-to-due helpers** (`getAssignmentDaysToDue` :5359 and inner
   `getDaysToDue` :5739) with identical logic — drift risk. Collapse to one.
   `src/components/Interview/InterviewHub.tsx:5359-5391,5739-5760`
7. **Never-started rows render a 0% progress bar** rather than an explicit "—". Minor read
   clarity. `src/components/Interview/InterviewHub.tsx:6296-6306`
8. **Assignee column shown by default in the self-Inbox** where it's redundant with "me"
   (`INTERVIEW_ASSIGNMENTS_TABLE_DEFAULT_HIDDEN_COLUMNS = []`, InterviewHub.tsx:161). Even
   after P0 #1, consider hiding it by default in the Inbox view and keeping it in Managed.

---

## Remediation plan (ranked S / M / L)

**S (≤1h each)**
- **P0 #1 backend join** — add `LEFT JOIN users` + `TRIM(COALESCE(first_name…))` projection
  to `getMyAssignments` (service:758-775). Mapper already consumes it. ~10 lines.
- **P0 #1 legacy parity** — same join + an `assignee` block in the legacy controller mapped
  object (controller:2187-2277). ~15 lines.
- **P0 #2 Inbox overdue chip** — change `Overdue.count` to a caller-scoped count derived from
  `myAssignments` (InterviewHub.tsx:2338) so it matches the visible rows. ~3 lines.
- **P1 #3 de-dupe ALL/My-inbox** — remove one chip (InterviewHub.tsx:2313-2322). ~5 lines.
- **P1 #5 COALESCE fix** in managed/overdue queries (service:823,871). ~2 lines.

**M (≤½ day)**
- **P1 #4 chip semantics** — decide in-place-filter vs manager-cluster for Overdue/To-approve
  and restructure the sub-filter row + active-id logic (InterviewHub.tsx:2296-2356,
  1738-1747). Touches active-state mapping and possibly the Managed tab's filter memo.
- **P2 #6 collapse days-to-due helpers** to a single module-level util consumed by table +
  grid.
- **Frontend self-name fallback (P0 #1 belt-and-suspenders)** — resolve the caller's name when
  `assignee_user_id === currentUser.id` (InterviewHub.tsx:6263,6271), so the Inbox is correct
  even before/independent of the backend deploy.

**L (≥1 day)**
- **Unify the three assignment list queries** behind one parameterized builder (my / managed /
  overdue) so assignee-join, status filter, and scope clauses can't drift again — this whole
  audit is a symptom of three hand-maintained near-duplicate SQL blocks
  (service:758-886) plus a fourth in the legacy controller (controller:2187-2235). Single
  source of truth would have prevented both P0s.
- **Inbox vs Managed information architecture pass** — clarify what "ALL", "My inbox",
  "To approve", "Overdue" each mean and which dataset/scope backs each, and whether the
  manager-scoped chips belong in the Inbox at all. Product + code.

---

## What works (summary)

Real endpoints (V8 + legacy fallback), real Assign-modal create, real start/remind/open row
actions, real status/progress/days-to-due rendering, real list/grid toggle, proper
loading/error/empty states, correct caller-scoping of the Inbox list (no cross-user leak).
Nothing in the Inbox path is mocked. The module is structurally sound; the two P0s are
narrow data-shape/labeling defects, each fixable in well under an hour, plus a short list of
consistency cleanups.

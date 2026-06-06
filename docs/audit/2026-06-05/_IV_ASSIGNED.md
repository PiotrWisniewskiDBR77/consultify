# Interview › ASSIGNED (managed) tab — code-verified audit

**Scope:** the manager view of interview assignments — `InterviewTab === 'managed'` (label "Assigned" / "Przydzielone"), with the `pending_review` ("To approve") sub-state = the `submitted`-status filter. Covers: managed-list load, Assign (single + team), Approve / Send-back / Remind lifecycle, the AI-review + 50% completeness gate, manager-scope RBAC, the approve→complete→insight chain, reminders/escalation, and the Assigned table visuals.

**Branch:** `feat/wave1-foundations`. **Date:** 2026-06-05.
**Method:** Read/Grep/Glob only. No code modified.

**Files audited**
- UI: `src/components/Interview/InterviewHub.tsx` (~8900 lines), `src/components/Interview/AssignInterviewModal.tsx` (840), `src/components/Interview/InterviewAssignmentPreview.tsx` (194)
- API client: `src/services/api/v8/interview.ts` (921), `src/services/api.ts`
- Routes: `server/src/routes/v8/interview.routes.ts` (1820), `server/src/routes/interview.routes.ts` (legacy)
- Controller: `server/src/controllers/InterviewController.ts` (7519)
- Services: `server/src/services/InterviewAssignmentService.ts` (1474), `server/src/services/interviewManagerScope.ts` (111), `server/src/services/workflow/gatePolicy.ts`
- Cron: `server/src/cron/Scheduler.ts`, `server/src/jobs/interviewReminderJob.ts`
- Schema: `server/src/database/PostgresDatabase.ts`

---

## SCORE: 63 / 100

The feature is **functionally real end-to-end** — managed list loads, Assign creates real single + team assignments, Approve/Send-back/Remind all hit live handlers that mutate state, notify, and chain into session completion. The AI-review snapshot and the 50%-completeness floor genuinely run. Nothing in the core happy path is stubbed.

It loses ~37 points on: **(P0) a live RBAC hole** — the v8 approve/send-back/remind/start/submit routes (the exact endpoints the UI calls) carry **no permission middleware and no manager-scope check**, so any authenticated org member can approve or send-back *any* assignment in their org; **(P0) a status-normalization bug** that hides `sent_back` assignments from the manager's Assigned list; plus a cluster of P1s: residual `u.name` 500s on Postgres (3 sites the I2 fix missed), the bare-concat NULL-poison assignee name (degrading to email), a cross-org assignee/template IDOR in `createAssignment`'s org-role path, and the manual Remind path bypassing status checks.

---

## RBAC VERDICT: **FAIL (P0)** for lifecycle mutations; PASS for list + create

There are **two route stacks** and they disagree on authorization:

| Action | Legacy `/api/interview` | v8 `/api/v8/interview` (what UI uses) |
|---|---|---|
| `GET assignments/managed` | `INTERVIEW_ASSIGN_VIEW\|MANAGE` | org-scope only (no perm) — **OK, see below** |
| `POST assignments` (create) | `INTERVIEW_ASSIGN_MANAGE` + scope check | (UI uses legacy — guarded) |
| `POST :id/approve` | `INTERVIEW_ASSIGN_MANAGE` | **NO middleware** |
| `POST :id/send-back` | `INTERVIEW_ASSIGN_MANAGE` | **NO middleware** |
| `POST :id/remind` | `INTERVIEW_REMIND` | **NO middleware** |
| `POST :id/start` / `:id/submit` | none | **NO middleware** |

### The list endpoints are correctly scoped
`interviewManagerScope.ts` is well-written. `resolveInterviewManagerScope` (lines 21-68) returns one of three scopes:
- **organization** for `SUPERADMIN/OWNER/ADMIN/PROJECT_MANAGER` (line 26).
- **projects** for project-role holders (`PMO_LEAD/WORKSTREAM_OWNER/INITIATIVE_OWNER/SPONSOR`) via a parameterized `project_members ⋈ projects` join that is itself org-filtered (`p.organization_id = ?`, line 52). No IDOR, no SQL injection (uses `?` placeholders + schema-introspected column name).
- **creator** fallback (only `created_by = me`) when project tables/roles are unavailable.

`buildAssignmentManagerScopeClause` (line 70) returns `''` for org scope, `AND a.created_by = ?` for creator, `AND a.project_id IN (…)` for projects. **Critically, every caller pairs this with a hard `WHERE a.organization_id = ?`** — verified in:
- v8 `getManagedAssignments` service (InterviewAssignmentService.ts:801)
- v8 `getOverdueAssignments` service (:848-852)
- controller `getManagedAssignments` (InterviewController.ts:3178)
- controller `getOverdueAssignments` (:3288)

So org scope = "" clause is safe; it never degrades to a global cross-org leak. **List RBAC: PASS.** Project-scope and creator-scope correctly prevent a non-admin manager from seeing assignments outside their projects.

### The mutation endpoints are NOT scoped — **this is the P0**
The v8 routes for the four manager actions are bare `v8Wrap(...)` with no guard (interview.routes.ts:350-367). The controllers themselves (`approveAssignment` :3022, `sendBackAssignment` :2815, `sendAssignmentReminder` :3606) only verify `organization_id` match (e.g. approve :3028 `WHERE id=? AND organization_id=?`). They do **not**:
1. call `requirePermission('INTERVIEW_ASSIGN_MANAGE')`, nor
2. re-derive manager-scope to confirm the reviewer actually manages this assignment.

`evaluateGatePolicy` does **not** fill the gap — by design it is **state-only** (gatePolicy.ts:38 comment: "authorization primarily permission-based at routing layer"). For `APPROVE_INTERVIEW` it only checks `status === 'submitted'` (gatePolicy.ts:77-88); zero role/ownership logic.

**Net effect:** any authenticated user belonging to org X — including a plain assignee with no management role — can `POST /api/v8/interview/assignments/<any-submitted-id-in-org-X>/approve` (or `/send-back`, `/remind`) and it succeeds. The UI hides the buttons behind `canAssign` (InterviewHub.tsx:6418), but the API is the trust boundary and it is open. The frontend even has a `.catch(() => Api.post('/interview/...'))` fallback (InterviewHub.tsx:2078, 2118) to the *guarded* legacy route — but it only fires if v8 throws, and v8 never throws on authz, so the guarded path is effectively dead for happy-path callers.

This is a horizontal-privilege / broken-function-level-authorization finding. **Verdict: FAIL.**

### Create (`createAssignment`) — mostly PASS, one IDOR
`InterviewController.createAssignment` (:2283) is reached via the **legacy guarded** route (`Api.post('/interview/assignments')`, AssignInterviewModal.tsx:343 → `requirePermission('INTERVIEW_ASSIGN_MANAGE')`, interview.routes.ts:119). It re-validates scope in-handler (:2334-2387): org-role holders may assign org-wide; project-role holders are checked for a management role in the target project and all assignees are verified to be project members (:2372-2385). Template must exist and be `approved` (:2399). **Good.** Two gaps:
- **Cross-org assignee IDOR (P1):** the org-role branch (`SUPERADMIN/ADMIN/PROJECT_MANAGER`, :2334) skips the entire validation block and never confirms the supplied `assigneeUserIds` belong to `admin.organizationId`. A privileged user could craft a POST assigning an interview to a user in *another* org. The notification + mirror task would then fan out cross-org.
- **Cross-org template leak (P2):** template lookup (:2391) is `WHERE id = ?` with no `organization_id` filter. If templates are org-scoped, a manager could attach another org's template by id.

---

## FUNCTIONALITY — what actually works

### Managed list load ✅
`loadManagedAssignments` (InterviewHub.tsx:889) calls `V8InterviewApi.getManagedAssignments()` → `/api/v8/interview/assignments/managed`, with graceful `.catch()` fallback to legacy `Api.get('/interview/assignments/managed')` then `[]`. Backend service path (`getManagedAssignments`, service:784) is org+scope filtered, joins template/session/assignee. Overdue loaded separately (:899) into its own list. Loading + error states render (InterviewHub.tsx:6484-6510, with a Refresh button). Empty state present (:6455-6475, Inbox icon + "No assignments").

### Assign — single + team ✅
`AssignInterviewModal` validates template/users/dueDate/teamLead client-side (:320-339) then POSTs `assigneeUserIds[]`, `teamLeadId`, `dueAt`, `priority`, `notes`, `projectId` to the guarded legacy route. Backend models **multi-assign as N independent assignments** (one session + review flow per person, :2423-2444) and a genuine **team assignment** (single record + `interview_assignment_members` rows, service.create:428-440) when `assigneeUserIds.length===1` with a teamLead. Mirror MyWork task created (:443), notifications fanned to all assignees (:455). Returns `splitAssignments`/`createdCount` so the modal toasts the right message (:353-361). **Real, not stubbed.**

### Approve ✅ (logic) / ❌ (authz)
`approveAssignment` (:3022): org-match load → `evaluateGatePolicy(APPROVE)` state gate (must be `submitted`) → resolve session with org guard → compute completeness → **hard floor `if (completenessRatio < 0.5) → 409 "Cannot approve: completeness is < 50%"`** (:3073). On pass: assignment→`approved`, session→`completed` + `completed_at`, mirror task→`done`/100%, append `review_decision_memory_json` (audit trail capturing the AI snapshot + actor), notify all recipients (`interview_approved`, team-aware via members table), return `entersContext: true`. The approve→complete→insight chain is wired: approving completes the session, which is the precondition for it entering org context / insight promotion (`entersContext: true` is the signal; downstream insight promotion lives in the insights routes, out of this tab's scope but the hand-off flag is set).

### Send-back ✅ (logic) / ❌ (authz)
`sendBackAssignment` (:2815): requires non-empty `reason` (:2822, 400 otherwise) → normalizes `missingItems[]` (string|object, dedup, defaults a `quality_gaps` item if empty, :2858-2863) → state gate (must be `submitted`, gatePolicy:64-75) → session org guard → assignment→`in_progress` + `sent_back_at` + `sent_back_reason` + `missing_items_json` + decision memory; **session→`active`** (re-opened for editing, :2944); mirror task→`in_progress`; notify recipients (`interview_sent_back`, priority high, body includes reason + missing-item count). Back-compat fallback if `missing_items_json` column absent (:2929-2941). Correct state + reason + notify. The UI send-back modal only collects `reason` (InterviewHub.tsx:2078) — `missingItems` is never sent, so the backend always falls back to the single default quality-gaps item. Functional but under-uses the richer missing-items contract.

### Remind ✅
Manual path: `V8InterviewApi.remindAssignment` → `/api/v8/interview/assignments/:id/remind` → `sendAssignmentReminder` (:3606) → `interviewAssignmentService.sendReminder(id, senderId)` (service:923). Recipients = team members (if team) else primary assignee (:929-932). `dispatchReminder('manual')` sends in-app notification + records `interview_notifications` rows + sends email. **Confirmed I2 fix applied:** dispatchReminder reads `SELECT email, first_name, last_name` (service:1215) and composes `${first_name} ${last_name}`.trim() || email (:1218-1219) — the old `u.name` 500/`Hi undefined` is gone on this path.

### AI-review gate ✅ (real)
The AI review snapshot is generated at **submit** time, not approve: `submitAssignment` (:2742-2762) loads the session questions and calls `evaluateInterviewSessionAnswers({...})` (a real AI call, not stubbed — `evaluateSessionAnswers` controller at :4858 wraps the same engine), persists `ai_review_snapshot_json` + `ai_reviewed_at`. The manager sees this on the submitted assignment. At approve, the gate is `evaluateGatePolicy` (state) **plus** the `< 0.5` completeness floor; the AI snapshot is a decision aid surfaced to the reviewer, **not** a hard block. This matches the intended "evaluateGatePolicy + 50% completeness floor" design — both run.

---

## REMINDERS / ESCALATION — confirmed wired (cfce7481d2)

- **Hourly scheduler registered:** `Scheduler.ts:614-623` imports `../jobs/interviewReminderJob.js` `runJob` and runs it as hourly job #32. Previously dormant (job file header still says "Run via npx ts-node", interviewReminderJob.ts:9, but the Scheduler now drives it). The advertised 48h/24h/2h reminders + post-deadline auto-escalation (`checkAndSendReminders` service:945, `checkAndEscalateOverdue`) now actually fire.
- **`users.name` 500 fixed on the dispatch + getTeamMembers paths** (service:717 and :1215 now use `first_name`/`last_name`).
- **Manual Remind button works** end-to-end (see Functionality above).

**Caveat (P1):** the manual `sendReminder` (service:923) does **no status check** — it will happily remind on an `approved`/`completed` assignment if called directly. The UI hides the button for those states (InterviewHub.tsx:6420-6421), but the API doesn't enforce it, and the auto cron correctly filters to `('assigned','in_progress','sent_back')` (service:956) — inconsistent. Also: manual reminders do **not** increment `reminder_count` (only the cron path does, service:1004), so the manager's "reminded N times" signal undercounts manual nudges.

---

## DATA INTEGRITY + VISUAL

### P0 — `sent_back` is normalized away → invisible in Assigned list
`normalizeAssignmentStatusForClient` (InterviewController.ts:1331) maps **`sent_back` → `in_progress`** before returning. The v8 `getManagedAssignments` mapper applies it (:3216). Consequences in the Assigned tab:
- The `sent_back` **status chip** (rose, "Sent back" / "Do poprawy", InterviewHub.tsx:5327/5347) **never renders** for v8-loaded data.
- The `sent_back` **count/filter** (managedAssignmentStatusCounts.sent_back, :1731) is **always 0** — the manager cannot filter to "items I bounced back."
- The manager sees a bounced-back item indistinguishable from a normally-in-progress one.
The legacy fallback (`listAssignments` :2501, raw `...r`) does **not** normalize → the two data paths disagree on the same assignment's displayed status. Send-back round-trips are essentially invisible to the manager in the v8 path.

### P1 — Assignee name NULL-poison → silently shows email instead of name
The managed/overdue/detail queries build the assignee name as a **bare concat**: `(u.first_name || ' ' || u.last_name) as assignee_name` at InterviewController.ts:3198 (managed), :3282 (overdue), and InterviewAssignmentService.ts:489 (getByIdWithDetails), :823 (getManagedAssignments), :871/:873 (overdue + creator_name). In Postgres, `'Ann' || ' ' || NULL = NULL`, so **any assignee with a missing last_name (or first_name) yields `assignee_name = NULL`**. The frontend then falls through `name || email || 'Unknown'` (InterviewHub.tsx:6263/6268/6271, preview :61-67) → the cell shows the **email** (and avatar initial `?` at :6263). Not the hard "Unknown" the Inbox shows (Inbox never joins users at all — different bug, see `_IV_INBOX.md`), but a degraded display. The fix the I2 commit applied elsewhere (`TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))`, service:717) was **not** propagated to these five sites.

### P1 — Residual `u.name` 500 on Postgres (3 sites the I2 fix missed)
`SELECT m.*, u.name as user_name …` survives at **InterviewController.ts:3434** (`getAssignment` — team-member sub-load), **:3650** (`getAssignmentMembers`), **:3719** (`addAssignmentMember`). The Postgres `users` table has **no `name` column** (PostgresDatabase.ts:1068-1087: only `first_name`/`last_name`) — these throw `column u.name does not exist` → 500. **Not on the primary Assigned-tab happy path** (the tab's "Open" action opens the *session*, not `GET /assignments/:id` or `/members` — `openInterviewAssignmentFull` InterviewHub.tsx:5473-5500), so they're latent rather than always-firing. But `GET /interview/assignments/:id` on a **team** assignment 500s, and the two members endpoints 500 unconditionally on Postgres. Same bug class the commit fixed at service:713 — three siblings escaped.

### Table visuals — otherwise solid ✅
- Columns: template (name + category pill + optional description), assignee (avatar + name, manager-only via `hasAssigneeColumn`), status pill, progress bar, due chip, actions. Column widths/visibility persisted (InterviewHub.tsx:144-167, :279).
- **Status pills** comprehensive and color-coded (`getAssignmentStatusColor`/`Label` :5316-5357): assigned/in_progress (blue), submitted/review (amber), sent_back/rejected (rose), approved/completed/accepted (emerald). Bilingual PL/EN.
- **Overdue / due chips** (`getAssignmentDaysToDue` :5359): `Nd overdue` + AlertTriangle for past-due, Clock for ≤3d, Calendar beyond. Overdue sub-tab pulls the separate manager-scoped `overdueAssignments` list.
- **Action menu** correctly state-gated (:6418-6447): Remind shown for non-completed/approved; Approve + Send-back shown **only** when `status==='submitted'` AND `canAssign` AND manager view. "To approve" sub-state = the `submitted` filter (:1732). Consistent with how other tabs (`my_assignments`, sessions) render their RowActionsMenu.
- Loading (`LoadingState variant="spinner"`) + error (amber card + Refresh) + empty states all present.

---

## RANKED REMEDIATION

### Small (hours)
1. **[P0] Guard the v8 lifecycle routes.** Add `requirePermission('INTERVIEW_ASSIGN_MANAGE')` to `POST /assignments/:id/approve` and `/send-back` (and `INTERVIEW_REMIND` to `/remind`) in `server/src/routes/v8/interview.routes.ts:354-367`, mirroring the legacy stack. This closes the broken-function-level-authorization hole with a one-line-per-route change. *(Medium-ify if you also want per-assignment manager-scope enforcement — see #5.)*
2. **[P0] Stop hiding `sent_back`.** Either drop the `sent_back → in_progress` remap in `normalizeAssignmentStatusForClient` (InterviewController.ts:1331-1335) for the managed/list responses, or carry a separate `reviewState`/`wasSentBack` flag so the Assigned chip + filter can distinguish revision items. Reconcile v8 and legacy paths so the same assignment shows the same status.
3. **[P1] Kill the residual `u.name`.** Replace `u.name as user_name` at InterviewController.ts:3434, :3650, :3719 with `TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) as user_name` (the form already used at service:717).
4. **[P1] Fix assignee-name NULL-poison.** Apply the same `TRIM(COALESCE(...) || ' ' || COALESCE(...))` to the five assignee/creator-name expressions: InterviewController.ts:3198, :3282; InterviewAssignmentService.ts:489, :823, :871, :873.
5. **[P1] Status-check the manual reminder.** In `sendReminder` (service:923) early-return/400 if assignment status ∈ `{approved, completed}`; optionally `reminder_count + 1` on manual sends for a consistent "reminded N×" signal.

### Medium (half-day)
6. **[P1] Close the create cross-org IDOR.** In `createAssignment`'s org-role branch (InterviewController.ts:2334+), validate every `assigneeUserIds` member has `organization_id = admin.organizationId` before creating. Also add `AND organization_id = ?` to the template lookup (:2391) if templates are org-scoped (P2).
7. **[P1] Per-assignment manager-scope on mutations.** Beyond the permission middleware (#1), re-run `resolveInterviewManagerScope` in approve/send-back and reject if the assignment's `project_id`/`created_by` falls outside the reviewer's scope — so a project-role manager can't approve another project's interview even with the permission. This is the real fix that brings mutation authz to parity with the (already-correct) list authz.
8. **[M] Wire missing-items into Send-back UI.** Surface the AI snapshot's flagged gaps as selectable `missingItems` in the send-back modal (InterviewHub.tsx send-back handler :2073) so the assignee receives structured "fix these" items instead of a single generic quality-gaps default.

### Large (1–2 days)
9. **[L] Collapse the dual route stack.** The legacy `/api/interview` and v8 `/api/v8/interview` assignment routes have diverged on authorization, status normalization, and name-concat correctness. Pick v8 as canonical, port the legacy permission guards, delete the dead legacy mutation routes (or 308-redirect), and remove the now-pointless `.catch(() => Api.post('/interview/...'))` fallbacks in InterviewHub. Single trust boundary, single status contract.
10. **[L] Formalize the approve→complete→insight hand-off as a transaction.** Approve currently issues ~4 sequential `UPDATE`s (assignment, session, task, notify) without a transaction (InterviewController.ts:3088-3135). A mid-sequence failure leaves the assignment `approved` but the session not `completed`, breaking `entersContext`. Wrap in a DB transaction and emit the insight-promotion event from a single committed point.

---

## APPENDIX — file:line index

| Finding | Location |
|---|---|
| v8 lifecycle routes unguarded | `routes/v8/interview.routes.ts:350-367` |
| legacy routes guarded (parity ref) | `routes/interview.routes.ts:110-163` |
| approve handler (org-only check) | `controllers/InterviewController.ts:3022-3076` |
| 50% completeness floor | `controllers/InterviewController.ts:3073` |
| send-back handler | `controllers/InterviewController.ts:2815-3020` |
| reminder handler | `controllers/InterviewController.ts:3606-3629` |
| AI review snapshot @ submit | `controllers/InterviewController.ts:2742-2762` |
| gate policy (state-only, no authz) | `services/workflow/gatePolicy.ts:38, 77-88` |
| manager-scope resolver | `services/interviewManagerScope.ts:21-68` |
| scope clause builders | `services/interviewManagerScope.ts:70-109` |
| sent_back→in_progress normalize | `controllers/InterviewController.ts:1331-1335` |
| managed mapper applies normalize | `controllers/InterviewController.ts:3216` |
| assignee bare-concat (poison) | `controllers/InterviewController.ts:3198, 3282`; `services/InterviewAssignmentService.ts:489, 823, 871, 873` |
| residual `u.name` 500 | `controllers/InterviewController.ts:3434, 3650, 3719` |
| users table (no `name` col) | `database/PostgresDatabase.ts:1068-1087` |
| createAssignment scope check | `controllers/InterviewController.ts:2334-2402` |
| create cross-org assignee gap | `controllers/InterviewController.ts:2334` (org branch) |
| manual reminder no status check | `services/InterviewAssignmentService.ts:923-940` |
| reminder cron registration | `cron/Scheduler.ts:614-623` |
| dispatchReminder I2 fix | `services/InterviewAssignmentService.ts:1215-1219` |
| Assign modal POST (legacy) | `components/Interview/AssignInterviewModal.tsx:343` |
| managed list load + fallback | `components/Interview/InterviewHub.tsx:889-897` |
| approve/send-back UI handlers | `components/Interview/InterviewHub.tsx:2073-2150` |
| assignee cell render | `components/Interview/InterviewHub.tsx:6256-6274` |
| status pill maps | `components/Interview/InterviewHub.tsx:5316-5357` |
| action menu state gating | `components/Interview/InterviewHub.tsx:6418-6447` |
| status counts/filter (sent_back=0) | `components/Interview/InterviewHub.tsx:1725-1747` |
| empty / loading / error states | `components/Interview/InterviewHub.tsx:6455-6510` |

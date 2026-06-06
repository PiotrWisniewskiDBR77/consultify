# Interview → Sessions tab — code-verified audit

**Date:** 2026-06-05
**Branch:** `feat/wave1-foundations`
**Scope:** the **Sessions** tab of the Interview module (`InterviewTab === 'sessions'`) and its full read/create/open/answer/AI/evaluate/complete lifecycle, the two/three runtime modes, the sessions table (hide/resize columns + view-settings), data integrity, empty/loading/error states, and permission/org-scoping on session reads.

**Method:** Read/Grep/Glob only. No code modified.

**Score: 68 / 100**

Sessions is one of the more *mature* surfaces in the Interview module: the table, preview pane, status chips, bulk CSV export, AI assist (suggest/improve/explain), evaluate, and submit/complete are all real and backed by real DB-backed endpoints with org-scoping. The score is held down by two genuine correctness defects (the "New session" CTA creates a session that the list cannot show; column-width resize never persists), a permission-parity gap on the v8 primary read path, a silent demo-data fallback in the workspace, and the keyword-only "summary" (no AI) that the structured-core audit already flagged. None are catastrophic, but several are user-visible "did my data vanish?" class bugs.

---

## 1. Component / endpoint map

**Frontend**

| Concern | File / symbol |
|---|---|
| Sessions tab host | `src/components/Interview/InterviewHub.tsx` (~8900 lines) |
| Per-tab table state | `sessionsHiddenColumns` (L589), `sessionsColumnWidths` (L592), `showSessionRowDescription` (L595), `isSessionsViewSettingsOpen` (L598) |
| List loader | `loadManagedSessions` (L869–877) → `V8InterviewApi.getManagedSessions()` `.catch(() => Api.get('/interview/sessions/managed'))` `.catch(() => [])` |
| Initial load | `loadData` useEffect (L1027–1100); `Promise.allSettled` |
| Create | `handleNewSession` (L1858–1912) → `POST /interview/sessions` |
| Open into workspace | `handleViewSession` (L1320–1332) → `handleOpenDocument` (interview_session doc) |
| Workflow status | `getSessionWorkflowStatus` (L1453–1459), `getSessionProgress` (L1461–1467) |
| Filter | `filteredSessions` (L1470–1491) |
| Table render | `renderSessionsTable` (L2961–3439) |
| Grid render | `renderSessionsGrid` (L3442+) |
| Status chip config | `getSessionStatusConfig` (L2895–2958) |
| Tab content + preview | L6537–6666 (`TableWithPreviewLayout` + `InterviewSessionPreviewBody/Footer`) |
| Primary CTA | `primaryCta` (L8409–8419) |
| Bulk CSV export | `handleBulkExportSessions` (L1189–1208) |
| Record normalize | `normalizeInterviewSessionRecord` (L522–533) |
| Workspace (runtime) | `src/components/Interview/InterviewWorkspace.tsx` (~2550 lines) |
| Runtime mode UI | `src/components/Interview/RuntimeModeSelector.tsx` |
| Single-Q runtime | `src/components/Interview/InterviewSingleQuestionRuntime.tsx` |
| Task-list runtime | `src/components/Interview/QuestionsList.tsx` |
| Conversational runtime | `src/components/Interview/ConversationalPanel.tsx` |
| Orphaned modal | `src/components/Interview/NewSessionModal.tsx` (592 lines, **never imported**) |

**Backend**

| Route | Controller | Permission |
|---|---|---|
| `GET /interview/sessions` | `getSessions` (L1917) | org only (router `requireOrgAccess`) |
| `GET /interview/sessions/managed` | `getManagedSessions` (L1940) | **`requireAnyPermission(['INTERVIEW_ASSIGN_VIEW','INTERVIEW_ASSIGN_MANAGE'])`** (routes L64–68) |
| `GET /interview/sessions/accepted` | `getAcceptedSessions` (L1934) | `requireAnyPermission([...])` (routes L57–61) |
| `GET /interview/sessions/:id` | `getSession` (L1953) | org only |
| `POST /interview/sessions` | `createSession` (L1966) | org only |
| `PATCH /interview/sessions/:id` | `updateSession` (L2071) | org only |
| `PATCH /interview/questions/:id` | `updateQuestion` (L5079) | org only |
| `POST /interview/questions/:id/ai-suggest` | `aiSuggestQuestion` (L4636) | org + **owner** check |
| `POST /interview/questions/:id/ai-improve` | `aiImproveAnswer` (L4708) | org + owner |
| `POST /interview/questions/:id/ai-explain` | `aiExplainQuestion` (L4795) | org + owner |
| `POST /interview/sessions/:id/evaluate-answers` | `evaluateSessionAnswers` (L4858) | org |
| `POST /interview/sessions/:id/ai-parse` | `aiParseSessionAnswers` | org + owner |
| `POST /interview/sessions/:id/summary` | `generateSummary` (L6338) | org (gated by completion/approval) |

**v8 mirror** (`server/src/routes/v8/interview.routes.ts`, mounted at `/api/v8` behind `verifyToken` + `requireV8OrgContext` + `v8OrgGate`):
- `GET /sessions` (L183), `GET /sessions/accepted` (L196), `GET /sessions/managed` (L204), `GET /sessions/:id` (L224), `GET /sessions/:id/summary` (L251), `POST /sessions/:id/evaluate-answers` (L370).
- **None of the v8 session-list routes carry the `INTERVIEW_ASSIGN_VIEW/MANAGE` permission gate** that the legacy equivalents do — only router-level org context. See P1-1.

The frontend `loadManagedSessions` (L869) calls the **v8** route first and only falls back to the legacy `/interview/sessions/managed` (which has the permission gate) on failure — so in practice the primary path is the *less*-gated v8 one.

---

## 2. What actually works (verified)

- **List load** — `loadManagedSessions` (L869) → v8 `getManagedSessions` with legacy `.catch` fallback then `.catch(() => [])`. `loadData` (L1041) sets `sessions` on success and a real degraded-mode error string (`sessionsLoadError`, L1047) on failure; `setIsUsingDemoData(false)` (L1039). **No demo data is injected into the Sessions list** (unlike the workspace — see P1-3). The error banner renders via `renderDegradedBanner` (L6526) keyed off `sessionsLoadError` (L6514).
- **Org-scoping on reads** — `loadManagedInterviewSessionsForManager` (controller L1669) filters `WHERE a.organization_id = ?` plus `(p.organization_id = ? OR (s.project_id IS NULL AND s.organization_id = ?))` (L1748–1753) and applies a creator/organization scope clause via `resolveInterviewManagerScope` + `buildSessionManagerScopeClause`. `getSession`/`updateSession`/`generateSummary`/`getSummary` all re-check `organization_id`. **Org isolation on the read path is sound.**
- **Open into workspace** — `handleViewSession` (L1320) opens an `interview_session` document; `InterviewWorkspace.loadSession` (L529) loads via v8 `getSession` → legacy fallback, then fans out to questions/notes/evidence/context/summary/assignment/linked-items (L613–645) with a `fetchOptional` helper that re-throws only on 5xx / circuit-open (L600–610). Good resilience design.
- **Answer questions** — `handleUpdateQuestion` (L774) → `PATCH /interview/questions/:id`; updates local `answeredQuestions`/`totalQuestions` and calls `onSessionChange` so the Hub row progress stays live (`handleSessionChange`, Hub L1937). Server `updateQuestion` (L5079) recomputes session progress via `updateSessionProgress` (L5380). Persistence is real.
- **AI assist** — `aiSuggestQuestion` / `aiImproveAnswer` (5 modes: improve/fix_grammar/shorten/expand/formal) / `aiExplainQuestion` are **real structured `llmService.call`** (Zod-validated objects), each gated by org **and** session-owner (`session_owner_id !== user.id → 403`, L4651/4729/4811). This is stronger scoping than the read path.
- **Evaluate** — `evaluateSessionAnswers` (L4858) is real AI (`evaluateInterviewSessionAnswers`, Zod `EvalSchema`) and persists an AI-review snapshot. Frontend calls v8 with legacy fallback (Workspace L437).
- **Complete / submit** — `handleSubmitSession` (Workspace L1073): assignment-backed → `submitAssignment` (v8 + legacy fallback, L1099) with completeness %, triggers `runAiQualityReview`; ad-hoc → `PATCH /interview/sessions/:id { status:'completed' }` wrapped in a 15s `withTimeout` (L1131). Server `updateSession` sets `completed_at` and **blocks direct status changes on assignment-backed sessions** (409, L2148–2154) — correct workflow guard.
- **Three runtime modes render** — `RuntimeModeSelector` exposes `single_question | task_list | conversational`; Workspace renders all three (L1917 conversational → `ConversationalPanel`; L1931 single → `InterviewSingleQuestionRuntime`; else task_list → `QuestionsList`). Assignment-backed sessions are pinned to `single_question` (L500, L512). `ai-parse` (conversational transcript → answers) is real and owner-scoped.
- **Table mechanics** — hide-columns (status/progress/date) + resize (`handleSessionColumnResize`, L3008, neighbor-borrow algorithm with min/max bounds) + view-settings popover (L3126) with outside-click/Escape close (L689–707). Select-all / per-row select with indeterminate state (L2974–2976). Empty state is a polished Teresa-branded CTA (L3392–3434).
- **Status chips** — `getSessionStatusConfig` (L2895) covers in_progress/submitted/sent_back/approved/in_review/completed/paused/archived with light+dark variants. Consistent with the assignment tables' chip vocabulary.
- **Preview pane** — `InterviewSessionPreviewBody/Footer` (`InterviewSessionPreview.tsx`) wired through the shared `TableWithPreviewLayout`; footer exposes AI hint chips (Summarize/Risks/Next steps → `handleGenerateInsight`) gated on `approved|completed` (L6597). Copy-stats / copy-id work.
- **Bulk CSV export** — `handleBulkExportSessions` (L1189) emits a real CSV (id/name/status/assignee/startedAt). Counters chip row (All/In progress/Submitted/Approved) at L2441–2450 computes from live `sessions`.

---

## 3. Findings (ranked, with file:line)

### P0 — correctness, user-visible

**P0-1 — "New session" CTA creates an ad-hoc session the Sessions list can never show.**
`InterviewHub.tsx:8414` the Sessions-tab primary CTA → `handleNewSession` (L1858) → `POST /interview/sessions` with `{ projectId, name }` and **no `templateId`** → server `createSession` (L1966) creates a session with **no `interview_assignments` row**. But the Sessions list is loaded by `loadManagedSessions` → `loadManagedInterviewSessionsForManager`, whose query is `FROM interview_assignments a INNER JOIN interview_sessions s` (controller L1742). An assignment-less session is **structurally excluded**. The new row is optimistically prepended client-side (`setSessions(prev => [newSession, ...prev])`, L1878) and the doc opens, but on any refresh / tab revisit it **vanishes from the list**. Net effect: user clicks the headline CTA, does an interview, comes back, and the session is gone from the only list that tab shows. (The empty-state CTA at L3411/3420 correctly routes to *templates*/*assign* instead — the two CTAs are inconsistent.)
*Severity rationale:* this is the tab's primary action and it produces orphaned data from the list's perspective.

**P0-2 — Column-width resize is never persisted (Sessions, and all Interview tables).**
`sessionsColumnWidths` initializes from `INTERVIEW_SESSIONS_TABLE_DEFAULT_WIDTHS` only (`InterviewHub.tsx:592`) — there is **no `loadColumnWidths`/`saveColumnWidths` helper anywhere** in the file (only `loadHiddenColumns`/`saveHiddenColumns` at L287/301 and `loadBooleanSetting`/`saveBooleanSetting`). `handleSessionColumnResize` (L3008) mutates React state but never calls a persist function. So resize is **lost on reload**, while hide-columns and the row-description toggle survive. The prompt explicitly asked whether the resize feature is "fully wired or partially" — answer: **partially.** It works in-session, doesn't persist. This is module-wide (templates/insights/initiatives column widths share the defect), so a single shared helper fixes all of them.

### P1 — security/parity, integrity

**P1-1 — v8 `/sessions/managed` and `/sessions/accepted` lack the `INTERVIEW_ASSIGN_VIEW/MANAGE` permission gate the legacy routes enforce.**
Legacy: `interview.routes.ts:64-68` and `57-61` wrap these with `requireAnyPermission(['INTERVIEW_ASSIGN_VIEW','INTERVIEW_ASSIGN_MANAGE'])`. v8: `v8/interview.routes.ts:204` (`/sessions/managed`) and `:196` (`/sessions/accepted`) have **no per-route permission middleware** — only the router-level `verifyToken` + org context (`v8/index.ts:40-57`). Because `loadManagedSessions` (L869) hits the **v8 route first**, the effective production path is the under-gated one. Org isolation still holds (the SQL is org-scoped), so this is not cross-tenant leakage; it's an **intra-org RBAC bypass**: a user without assignment-view capability can read manager-scoped session rows (assignee names/emails, due dates, sent-back reasons) they shouldn't see via the assignments UI. Fix: add the same `requirePermission` guard to the v8 routes, or move the check into the shared loader.

**P1-2 — `generateSummary` is keyword/tag-only, not AI (as the structured-core audit flagged).**
`InterviewController.ts:6338-6434`: facts = `"<question>: <answer>"` concatenation; constraints/painPoints = answers tagged `constraint` / `pain_point|risk`; gaps = unanswered or `confidence_score < 3`. No LLM call. The route comment ("FACTS ONLY, no recommendations") frames this as intentional, and the preview/footer AI hints route to the *real* AI insight generator (`handleGenerateInsight`) — so the AI path exists elsewhere. But anything labeled "summary" in the session is mechanical string assembly. Document/relabel so users don't expect synthesis. (Confirmed, not new — included for completeness.)

**P1-3 — Workspace silently falls back to demo data on load failure / empty.**
`InterviewWorkspace.tsx:571` (`if (!sessionRes && applyDemoSession(initialSessionId)) return;`) and L583-586 (no active sessions → `applyDemoSession(firstDemoSession...)`). If a real session fails to load (e.g. transient 4xx, or an ad-hoc session excluded by a stale id), the workspace can **render demo interview content under the user's real session name** with no banner indicating it's demo. The Hub list itself does *not* do this (it shows an error banner, §2), so the two surfaces disagree on the demo-fallback policy. This is the demo-data concern the structured-core audit raised; it lives in the workspace, not the list. Risk: a consultant edits/answers what they believe is the client's session but is demo scaffolding.

**P1-4 — `NewSessionModal.tsx` (592 lines) is fully orphaned dead code.**
`grep` across `src` finds **zero imports** of `NewSessionModal` outside its own file. It implements a richer create flow (team-member loading at L109, project/template selection) that would actually have populated the create path properly — yet the live CTA uses the bare `handleNewSession`. Either wire it up (and have it create through templates/assignments so rows show in the list, fixing P0-1) or delete it. Carrying 592 lines of unreachable UI is a maintenance and reviewer-confusion hazard.

### P2 — polish, persistence, consistency

**P2-1 — Runtime-mode choice persists only to `localStorage`, never to the server.**
`InterviewWorkspace.tsx:519-525` writes `interview_runtime_mode:<id>` to `localStorage`; the server column `runtime_mode_default` (set to `'single_question'` at create, `InterviewController.ts:2021`) is **never PATCHed** after a mode switch. So the chosen mode doesn't follow the session across devices or to other users, and the "default" recorded server-side is meaningless after the first switch. `updateSession` (L2071) doesn't even accept a `runtimeMode` field.

**P2-2 — `primaryCta` for Sessions has no permission gating.**
`InterviewHub.tsx:8411` renders "New session" unconditionally, whereas templates/assignments CTAs check `canAssign` (L8421, L8471). Combined with P0-1 this means *every* user sees a headline action that creates list-invisible data. At minimum gate it, ideally repoint it at the assign/template flow.

**P2-3 — Grid view lacks the view-settings/empty-state parity of the table.**
`renderSessionsGrid` (L3442) has no view-settings popover, no resize, and (from the render) no dedicated empty card — the rich Teresa empty state (L3392) lives only in `renderSessionsTable`. Minor, but a consistency gap vs. the table mode the prompt asked about.

**P2-4 — Date column semantics are overloaded.**
`InterviewHub.tsx:3319-3321`: the "Date" cell shows `dueAt` (labeled "Due") **or else** `startedAt` (unlabeled) — two different meanings in one column depending on whether the session is assignment-backed, with a second "Submitted" line appended (L3323). Header is just "Date". Ambiguous for managers scanning the list.

**P2-5 — `respondentId` mirrors `owner_id`; `assigneeId` can be empty for ad-hoc.**
`loadManagedInterviewSessionsForManager` maps `respondentId: row.owner_id` (controller L1788) — respondent and owner are conflated. Preview footer shows `Assignee: <name|'—'>` and `Project/Org` raw ids (Hub L6611-6625), which is fine for debugging but exposes raw UUIDs in a user-facing footer.

**P2-6 — `normalizeInterviewSessionRecord` rewrites `sent_back` → `in_progress` for `status`.**
`InterviewHub.tsx:525-528`. Intentional (keeps the runtime open for the assignee), but it means the row's `status` field and its `assignmentStatus` field disagree, and downstream code must always read `assignmentStatus` first. Fragile coupling; worth a comment or a single source of truth.

---

## 4. Two-/three-mode runtime — verdict

The prompt frames this as "task-list vs single-question". In code there are **three** modes (`RuntimeModeSelector.tsx:29`): `single_question`, `task_list`, `conversational`. All three render and are backed:
- **single_question** → `InterviewSingleQuestionRuntime` (Workspace L1933) — real, uses `handleUpdateQuestion`, evidence upload, voice evidence, submit.
- **task_list** → `QuestionsList` (Workspace L2003) with category chips + "Next missing" — real.
- **conversational** → `ConversationalPanel` (Workspace L1917) → `ai-parse` maps transcript to answers — real, owner-scoped.

Assignment-backed sessions are **forced** to `single_question` (L500/L512) regardless of saved preference — a deliberate guard so assignees get the guided flow. The selector’s `compact` inline switcher cycles through all three (L107-110). Net: **both/all modes work**; the only mode-related defect is P2-1 (no server persistence).

---

## 5. Recommended fix order (S / M / L)

**Small (hours)**
1. **P1-1** — add `requireAnyPermission(['INTERVIEW_ASSIGN_VIEW','INTERVIEW_ASSIGN_MANAGE'])` to v8 `/sessions/managed` and `/sessions/accepted` (`v8/interview.routes.ts:196,204`). Closes the RBAC parity gap on the primary read path.
2. **P2-2** — gate the Sessions `primaryCta` (L8411) behind a capability, or hide it until P0-1 is resolved.
3. **P1-4** — delete `NewSessionModal.tsx` *or* file a ticket to wire it; don't leave it dangling.
4. **P2-4 / P2-5** — clarify the Date column header/label and stop printing raw UUIDs in the preview footer.

**Medium (1–2 days)**
5. **P0-2** — add shared `loadColumnWidths`/`saveColumnWidths` helpers (mirror `loadHiddenColumns`) keyed by the existing storage keys; persist in `handleSessionColumnResize` and seed initial state from storage. Fixes all five Interview tables at once.
6. **P0-1** — repoint "New session" to a flow that produces a *list-visible* session: either (a) route through templates/assign so an `interview_assignments` row exists, or (b) make the Sessions list a `UNION` of managed (assignment-backed) **and** the user's own ad-hoc sessions (`getSessions`), de-duped. Option (b) is the more honest fix since ad-hoc sessions are a supported concept server-side.
7. **P2-1** — accept `runtimeMode` in `PATCH /interview/sessions/:id` (`updateSession`, L2071) and PATCH on mode switch; keep localStorage as a fast cache.

**Large (3+ days)**
8. **P1-3** — replace the silent demo-data fallback in `InterviewWorkspace.loadSession` (L571, L583-586) with an explicit error/empty state, OR gate demo injection behind a demo-org flag and render a visible "Demo content" banner. This is the highest-trust-risk item: real users editing demo scaffolding under a real session name.
9. **P1-2** — if product wants a real narrative summary, replace the keyword `generateSummary` (L6338) with a structured LLM call (the insight generator already proves the pattern); otherwise rename the feature to "Facts digest" everywhere to set expectations.

---

## 6. Score breakdown

| Dimension | Score | Note |
|---|---|---|
| Functionality (load/create/open/answer/AI/evaluate/complete) | 17/25 | All real & DB-backed; −8 for P0-1 create-vs-list mismatch |
| Runtime modes | 9/10 | All three work; −1 for no server persistence |
| Data integrity / lifecycle | 12/20 | Real persistence & workflow guards; −8 for demo fallback + keyword summary + width loss |
| Visual / table / view-settings | 16/20 | Polished, consistent chips/preview; −4 for resize-not-persisted + grid parity + date ambiguity |
| Permissions / org-scoping | 9/15 | Org isolation sound; −6 for v8 RBAC parity gap + ungated CTA |
| Code hygiene | 5/10 | −5 for 592-line orphan modal + conflated status/owner fields |
| **Total** | **68/100** | |

**Bottom line:** the Sessions tab is functionally real end-to-end — it is not a stub — but it ships two list/data-integrity bugs that will read as "my session disappeared / my column widths reset" to users, an intra-org RBAC parity gap on the v8 read path that's now the primary path, and a workspace demo-data fallback that is a trust hazard. Fix P1-1 (small) and P0-1/P0-2 (medium) first; they remove the most user-visible damage with bounded effort.

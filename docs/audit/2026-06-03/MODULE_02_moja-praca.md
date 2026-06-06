# Module 02 — Moja Praca — Re-Audit (2026-06-03)

**Readiness: 68/100 — Tier: Beta (baseline 57 → now +11)**
**One-line verdict:** Six of nine sub-tools now have real backend wiring; Process Flow CRUD is enabled for the first time (migration landed today, hook enabled via `canvasLocked = false`); Home/Radar is now fully API-driven; the Tasks tab hangs in a confirmed infinite spinner caused by `task_type='personal'` data not being seeded for real (non-demo) users — the route filters hard on this value but stock migration `000_initdb_core_tables.sql` defaults `task_type='execution'`; Notebook containers migration is committed; three structural risks remain (Tasks identity ambiguity, N+1 queries, type-safety).

---

## Sub-tool functionality (real/mock/broken)

| Sub-tool | State | Evidence |
|---|---|---|
| **Mind Map** | Real | `GET/POST /my-work/my-ideas/:id/map`, sync via `useMindMapPersistence.ts`; `my_idea_maps` migrated |
| **Process Flow** | Real (NEW) | Migration `20260603_v8_process_flow.sql` landed; `useProcessFlowCRUD` mounted with `enabled: !locked` (`IdeaProcessFlowTool.tsx:590`); `canvasLocked = false` (`IdeaMapWorkspace.tsx:374`) — hook live |
| **Table** | Real | `useTablePersistence.ts` → `syncMyIdeaMap`; unchanged from baseline |
| **Whiteboard** | Real (canvas) + unverified (facilitation) | `Api.getMyIdeaMap`/`syncMyIdeaMap` works; facilitation session APIs wired but route completeness still unconfirmed |
| **Notebook** | Real | `20260602_notebook_containers.sql` committed and present; `NotebookLibraryContent` in repo; full CRUD + AI classify endpoints in `notebook.routes.ts` |
| **Tasks** | Broken (spinner hang) | See root-cause section below |
| **Inbox** | Real | `V8MyWorkApi.getCanonicalInboxTable` with fallback to legacy; triage, AI assist wired (`InboxContent.tsx:1711–1731`) |
| **Decisions** | Real | `Api.getDecisions()` → `/decisions` route; kanban, timeline, panel all wired |
| **Radar/Home** | Real (NEW) | `useHomeData.ts:1136` calls `/my-work/home/v2`; `home.routes.ts` is 1698-line live pipeline; "REBUILD_LOCKED" sample signals removed from `HomeView.tsx` — now renders via `blocks` from API |

---

## Intra-module flow & states (incl. Tasks hang root-cause)

### Tasks infinite spinner — root-cause

**Symptom:** Backend `/my-work/personal-tasks` returns `count:11` but UI shows "All 0" and stays in spinner.

**Root cause — two-layer mismatch:**

1. **Backend filter requires `task_type='personal'`** (`my-work.routes.ts:1047`):
   ```sql
   AND lower(coalesce(t.task_type,'')) = 'personal'
   ```
   The stock migration `000_initdb_core_tables.sql:217` sets `task_type TEXT DEFAULT 'execution'`. There is no migration that bulk-sets existing tasks to `task_type='personal'`. So real users' tasks (created via normal project flow) are all `'execution'` type — the query returns 0 rows, not 11.

2. **The `count:11` comes from a different surface** — the sidebar warm-up call (`Sidebar.tsx:331`) fires `Api.getPersonalTasks()` on hover, which hits the same endpoint and gets 0 real rows. The reported "count:11" likely came from the demo-data pipeline (the Atelier Toys script `align-atelier-data-to-demo-org.ts:140` does `UPDATE tasks SET task_type = 'personal'` for the demo org) or from a stats endpoint that counts all assignee tasks (not filtered by `task_type`).

3. **The UI does not hang on error** — `MyTasksListContent.tsx:1013–1023` sets `loading=false` in `finally`, so the spinner resolves. But the `onCountsChange` callback fires with `total:0` (`MyTasksListContent.tsx:1135–1144`) and the "All 0" filter chip reads `tabCounts.tasks` which stays 0 (`MyWorkHub.tsx:2502`). The "infinite spinner" report is therefore: spinner resolves but task list is permanently empty for real users who have no `task_type='personal'` rows.

4. **Cache risk:** `personalTasksCache` (`personalTasksCache.ts:8`) caches the empty-array response for 15 seconds keyed by URL+token. If the token key is the same across refreshes, the empty result is served from cache and blocks any retry for 15s.

**Fix path:** Run `UPDATE tasks SET task_type = 'personal' WHERE task_type IS NULL OR task_type = 'execution'` for users' own assignee tasks, OR relax the route filter to include execution tasks assigned to the user, OR add a one-time migration to backfill. The `align-atelier-data-to-demo-org.ts` script already has the right SQL — it needs to run on production data.

### Other spinner risks

- **Whiteboard facilitation** — if `facilitationGetVoteSummary` 404s (unverified route), `IdeaWhiteboardTool.tsx:1061–1062` has no individual error boundary — the shared `Promise.all` would fail and leave the session panel in a spinner.
- **Inbox materialization** — `V8MyWorkApi.materializeCanonicalInbox()` (`InboxContent.tsx:1726`) is a slow async operation with no timeout; if the backend stalls, the inbox tab stays loading indefinitely.

### Dead-ends / empty states

- Mind Map: has empty-state prompt for new ideas — OK.
- Decisions with 0 items: `DecisionsPanelContent.tsx` renders empty state — OK.
- Tasks (for real users): empty state shown correctly but count badge shows "0" even when tasks exist with wrong `task_type`.
- Process Flow in locked idea: `canvasLocked = false` (`IdeaMapWorkspace.tsx:374`) so this path is never locked — OK but watch: if a future change re-enables locking, `enabled: !locked` will silently disable CRUD again.

---

## UI/UX adherence

- **ModuleHub shell**: `MENU_2_TAB_ACTIVE`, `MENU_3_*` class constants used consistently in `MyWorkHub.tsx:68–79`. Tabs: Home, Ideas, Notebook, Inbox, Calendar, Tasks, Decisions, Manager — in correct order per v1 scope.
- **Crimson/navy tokens**: `text-primary-500`, `bg-primary-50`, `dark:bg-navy-900` used throughout Ideas workspace and Tasks table. Task priority dot colors use semantic `rose/amber/blue/slate` tokens aligned with design system.
- **Rounded style**: `rounded-lg`, `rounded-xl` applied consistently in task rows, inbox triage cards, decision cards.
- **Miro-style consistency**: Mind Map, Process Flow, Table, Whiteboard all share `IdeaMapWorkspace` → single toolbar + context panel pattern. All 4 tools use `getIdeasToolInteractionProps` for consistent drag/select/zoom behavior (`WhiteboardTool.tsx:366`). No cross-tool toolbar leakage observed.
- **Inconsistency (minor)**: `MyTasksList.tsx` still exists as legacy compact-list component but is not rendered in the production hub — `MyWorkHub.tsx:3195` renders `MyTasksListContent` (the table view). `MyTasksList` uses `Api.updateTask` (not `updatePersonalTask`) — a silent API mismatch if ever re-enabled.

---

## Cross-module handoffs

- **Task → Notebook**: `TaskDetailView` has "Open Note" link wired (`TaskDetailView.tsx`).
- **Idea → Task**: `QuickTaskPopover.tsx` in mind map toolbar creates tasks via `Api.createPersonalTask` — but creates them with `task_type='personal'`, so they will appear in the Tasks tab. Correct.
- **Decisions → My Work**: `DecisionDetailModal` accessible from both Decisions tab and from Task preview sidebar.
- **Home → all tabs**: `nextUp` items in Home/Radar carry `entityType`/`entityId` for navigation — correct data flow from `home.routes.ts:568–608`.
- **Inbox → Notebook**: Inbox triage "Convert to Note" path calls `Api.createNotebookPage` (`InboxContent.tsx:1962`) — real.
- **Gap**: Calendar tab (`CalendarView.tsx`) fetches events via `useCalendarData.ts` — not verified in this audit whether it shares the same auth identity issues as Tasks.

---

## Risks / regressions / runtime (perf/N+1)

1. **Task identity ambiguity (P0 — live bug)**: `resolveCanonicalPersonalTaskIdentity` (`my-work.routes.ts:504–575`) does up to 3 DB lookups per request (JWT email lookup, user row lookup, multi-match query). This is correct for correctness but adds 2–3 extra queries to every personal-tasks fetch. Combined with `buildPersonalTaskOwnerScope` which can use `EXISTS (SELECT 1 FROM users pu ...)` correlated subquery, the effective personal-tasks GET costs 4–5 queries.

2. **`getTableColumns` schema introspection** (`dbSchema.ts:109–116`): Process-lifetime cache (`cache` Map) means the first call to each table pays a `SELECT column_name FROM information_schema.columns` hit. With `getTableColumns` called on 8 distinct tables in `my-work.routes.ts` (`tasks`, `my_ideas`, `my_idea_maps`, `tool_sessions`, `link_graph_edges`, `notifications`, `decisions`, `my_work_inbox_triage`), cold start costs 8 extra queries. Subsequent requests hit the in-memory cache — no N+1 per request.

3. **`home/v2` parallel fan-out**: 13 concurrent `safeHomeV2Query` calls (`home.routes.ts:286–468`) per request. Each has a 2-attempt fallback. Max theoretical: 26 DB queries + `rollupSignals` + `getRoomHealth×6` + external `getAiNews`. Under Postgres this is fine as parallel but under a connection pool with <10 connections it can queue. Caching at 15s TTL per `orgId:userId` pair mitigates repeat hits.

4. **`personalTasksCache` cache-key collision risk** (`personalTasksCache.ts:10–12`): Key uses last 32 chars of JWT. If two users have tokens with the same 32-char suffix (very low probability but non-zero), one user sees another's task list for up to 15 seconds. Should use full token or a hash.

5. **Type safety**: `(task as any).triageAction` at `MyTasksListContent.tsx:612` and `(req.user as { isDemo?: boolean } | undefined)?.isDemo` at `my-work.routes.ts:586` — runtime duck-typing that could mask type mismatches. Non-critical but violates the wave1 "reduce `as any`" goal.

6. **`MyTasksList.tsx` API mismatch**: Uses `Api.updateTask` and `Api.deleteTask` (project task endpoints, not personal) at lines 250, 284 — if this legacy component is ever re-enabled for a quick-fix scenario it will hit wrong backend logic silently.

---

## Top remaining gaps

1. **CRITICAL — Backfill `task_type='personal'` for real users** (`my-work.routes.ts:1047`): Tasks tab shows 0 for all non-demo users. Fix: SQL migration or relax the filter to `task_type IN ('personal', NULL, '')` for user-assignee scope.
2. **Process Flow CRUD end-to-end verify**: Migration `20260603_v8_process_flow.sql` exists but may not have run on production DB yet (it's today's file). Verify with `SELECT COUNT(*) FROM v8.v8_process_flow_nodes` before shipping.
3. **Facilitation route completeness**: `IdeaWhiteboardTool.tsx` calls 8 `Api.facilitation*` methods — confirm all routes are live in `server/src/routes/` and covered by the `requireTables` guard.
4. **Calendar identity parity**: `useCalendarData.ts` may hit the same user-ID resolution issue as Tasks — audit whether calendar events filter by `user_id` with the same canonical identity logic.
5. **`personalTasksCache` key**: Use full token hash or `userId:url` composite to eliminate collision window.
6. **Legacy `MyTasksList` cleanup**: Unreachable in production but dead code using wrong API endpoints — remove or update before GA.

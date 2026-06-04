# Module 02 — My Work — Sub-Module Decomposition

**Date:** 2026-06-04
**Goal:** Split the largest module (My Work) into independently-workable sub-tasks, one per Menu-2 tab + one per Idea tool, each with its own functional + UI scope, so each can be driven to 100% (working functionality first).

**Source of truth for tabs:** `src/components/MyWork/MyWorkHub.tsx:169-177` (`ModuleTab` union) and `:1358-1431` (`tabs` array). Tab order: **Home(Radar) → Ideas(Pomysły) → Notebook(Notatnik) → Inbox → Calendar(Kalendarz) → Tasks(Zadania) → Decisions(Decyzje) → Manager**.

**Important corrections vs the original assumption:**
- **Assessment is NOT part of My Work.** It lives under the **Tools** menu (`menuConfig.ts:82-87`, `AppView.ASSESSMENT_OVERVIEW`). Excluded here.
- **Radar = the Home tab** (`MyWorkHub.tsx:1362` label `'Radar'`, internal id `home`). Not a separate tab.
- **Manager** tab is role-gated (admin/manager/superadmin only — `MyWorkHub.tsx:579-580, 1427-1430`) and renders `Executive/ExecutiveDashboard`.
- **Idea tools (4):** Mind Map, Process Flow, Table, Whiteboard — all live inside the Ideas tab's `IdeaMapWorkspace`, switched via `ideaActiveTool` (`MyWorkHub.tsx:602`, `CanvasToolType`). They share ONE persistence graph (`IdeaWorkspaceGraph`: nodes/edges/extensions.{table,whiteboard,processFlow}) saved through `Api.syncMyIdeaMap` (`IdeaMapWorkspace.tsx:1388`).

Server routes are modularized under `server/src/routes/my-work/`: `home.routes.ts`, `radar.routes.ts`, `signals.routes.ts`, `notebook.routes.ts`, `decisions.routes.ts`, `calendar.routes.ts`, `focus.routes.ts`, `stats.routes.ts`, plus the large legacy `server/src/routes/my-work.routes.ts` (tasks, ideas, inbox, session-context).

---

## Summary Table

| ID | Sub-module | Tab/Tool | Functional state | Priority | Effort | UI debt (indigo / rawSelect / overlay) |
|----|-----------|----------|------------------|----------|--------|----------------------------------------|
| 02-HOME-RADAR | Home / Radar | Menu-2 `home` | **REAL** | P1 | M | shared with hub |
| 02-IDEAS-LIST | Ideas list (My Ideas) | Menu-2 `ideas` (list mode) | **REAL** | P1 | M | top-level MyWork: 15 indigo / 12 select / 24 overlay |
| 02-IDEAS-MINDMAP | Idea tool — Mind Map | Ideas workspace tool | **REAL** | P1 | XL | 4 indigo / 4 select / 28 overlay |
| 02-IDEAS-PROCESSFLOW | Idea tool — Process Flow | Ideas workspace tool | **PARTIAL** | P2 | L | 3 indigo / 2 select / 0 overlay |
| 02-IDEAS-TABLE | Idea tool — Table | Ideas workspace tool | **PARTIAL** | P2 | XL | 13 indigo / 28 select / 33 overlay |
| 02-IDEAS-WHITEBOARD | Idea tool — Whiteboard | Ideas workspace tool | **PARTIAL** | P2 | L | 3 indigo / 0 select / 0 overlay |
| 02-NOTEBOOK | Notebook (Notatnik) | Menu-2 `notebook` | **REAL** | P1 | L | shared |
| 02-INBOX | Inbox | Menu-2 `inbox` | **REAL** (v8 + legacy fallback) | P1 | M | shared |
| 02-CALENDAR | Calendar (Kalendarz) | Menu-2 `calendar` | **PARTIAL** | P2 | M | indigo tab dot |
| 02-TASKS | Tasks (Zadania) | Menu-2 `tasks` | **REAL** | P0 | M | TaskDetailView ~11 select; overlay modals |
| 02-DECISIONS | Decisions (Decyzje) | Menu-2 `decisions` | **REAL** | P0 | M | 1 indigo / 2 select (UI = PASS) |
| 02-MANAGER | Manager / Executive | Menu-2 `manager` (role-gated) | **PARTIAL** | P2 | M | shared |

Functional-state legend: REAL = full UI→API→DB path verified; PARTIAL = persists but has stubbed/best-effort gaps; MOCK/BROKEN = none found at tab level (most gaps are PARTIAL).

---

## Detailed Cards

### 02-HOME-RADAR — Home / Radar
- **Co to jest / cel:** The landing screen of My Work. An AI "radar" that aggregates signals across ideas/decisions/execution/team/industry and surfaces "what matters now" with a triage card and command dock.
- **Stan funkcjonalny: REAL.** `Home/HomeView.tsx` itself has no fetches; data flows through hooks: `Home/useHomeData.ts` (layout persist `Api.put('/preferences', {home_layout})` :1181), `useRadarData.ts` (`Api.get('/my-work/radar')` :31 → `radar.routes.ts:59+`), `useRadarTriageData.ts` (`Api.get(url)` :48, handoff `Api.post('/v8/radar-triage/signals/:id/handoff')` :73). Blocks: AIPulseCore, MomentumBlock, DecisionTemperatureBlock, ExecutionCurrentBlock, TeamSignalBlock, IndustryLensBlock, SparkField — each backed by `home.routes.ts` GETs.
- **Braki do pełnej funkcjonalności:** Verify each Home block degrades to a real Empty/Error state (not blank) on failed fetch — `useHomeData.ts`/`useRadarData.ts` error branches. Confirm `home_layout` round-trips and the IndustryLens/WorldPulse blocks aren't placeholder copy (`WorldPulse.tsx`, `IndustryLensBlock.tsx`).
- **Dług UI:** Uses hub shell + HomeBlockShell; audit-light. Inherits hub indigo. Audit triage-card empty states.
- **Priorytet:** P1 · **Wysiłek:** M

### 02-IDEAS-LIST — Ideas list (My Ideas)
- **Co to jest / cel:** The list/grid view of all of a user's ideas with stages (spark→promoted), folders, tags, bulk convert. Entry point into the idea workspace tools.
- **Stan funkcjonalny: REAL.** `MyIdeasListContent.tsx`: `Api.getMyIdeas` (:337), stage metrics `getMyIdeaMapMetrics` (:347), folders `getMyIdeaFolders`/`createMyIdeaFolder`/`setIdeaFolder`/`deleteMyIdeaFolder` (:417-460), `updateMyIdea` (:840), bulk `deleteMyIdea` (:876). Counts wired at `MyWorkHub.tsx:1826`.
- **Braki:** Verify `convert` bulk action end-to-end (idea→task/initiative/decision). Confirm folder DnD persists. Empty-state when 0 ideas.
- **Dług UI:** Part of top-level MyWork debt (15 indigo files, 12 raw `<select>`, 24 `fixed inset-0`). Migrate raw selects → SelectField; overlays → Modal.
- **Priorytet:** P1 · **Wysiłek:** M

### 02-IDEAS-MINDMAP — Idea tool: Mind Map
- **Co to jest / cel:** The flagship idea-structuring canvas (React Flow) — nodes/edges, AI proposals, layouts, presentation mode, ~50 sub-components in `MyWork/mindmap/`.
- **Stan funkcjonalny: REAL.** Quick actions `mindmap/useMindMapQuickActions.ts` (995 lines). Persistence shared via `IdeaMapWorkspace.tsx` → `Api.getMyIdeaMap`/`Api.syncMyIdeaMap` (:1384-1388). Create idea `Api.createMyIdea` (:1348). Convert `Api.convertMyIdea` (:1915), link edges `Api.createLinkGraphEdge` (:1939).
- **Braki:** Largest surface — many AI sub-panels (AIAutoClustering, AIBlindSpotsDetector, AIWhatIfScenarios, etc.) must be verified as wired (real AI call) vs decorative. Confirm `syncMyIdeaMap` debounce saves don't drop nodes (`:1947-1963` marked "best-effort persistence"). Snapshot history / 3D view / webhook settings likely stubs — audit each.
- **Dług UI:** 4 indigo files, 4 raw select, **28 `fixed inset-0`** (modals → Modal component).
- **Priorytet:** P1 · **Wysiłek:** XL

### 02-IDEAS-PROCESSFLOW — Idea tool: Process Flow
- **Co to jest / cel:** BPMN-style process/flow editor — start/end/activity/decision nodes, validations (dangling nodes, decision needs 2 exits). `IdeaProcessFlowTool.tsx` (2687 lines) + `processflow/`.
- **Stan funkcjonalny: PARTIAL.** Data lives in shared `IdeaWorkspaceGraph.extensions.processFlow` (`IdeaProcessFlowTool.tsx:17`), persisted with the mindmap via `syncMyIdeaMap`. Quick actions `processflow/useProcessFlowQuickActions.ts` (123 lines — thin vs mindmap's 995, suggests fewer wired actions).
- **Braki:** Verify the extensions.processFlow round-trips through `syncMyIdeaMap`/`getMyIdeaMap` (the sync payload may only serialize mindmap nodes — confirm flow nodes survive reload). Confirm validations actually block/warn. Build out quick actions to parity.
- **Dług UI:** 3 indigo files, 2 raw select, 0 overlay.
- **Priorytet:** P2 · **Wysiłek:** L

### 02-IDEAS-TABLE — Idea tool: Table
- **Co to jest / cel:** In-idea spreadsheet/table tool — column config (show/hide/reorder/resize), saved views, selection contract. `IdeaTableTool.tsx` (3692 lines) + large `table/` "Table Studio" (~150 files: GovernedModelsDashboard, ExtensionMarketplace, WebhookRelayPanel).
- **Stan funkcjonalny: PARTIAL.** Data in `IdeaWorkspaceGraph.extensions.table` (`:7`). Quick actions `table/useTableQuickActions.ts` (274 lines). Note: Table Studio is also reached as a standalone studio (audit tracker row 18) — overlaps with Module-09/Table packages.
- **Braki:** Confirm table edits persist via `syncMyIdeaMap`. The Studio sub-surfaces (GovernedModels/ExtensionMarketplace/WebhookRelay) are likely admin/enterprise stubs — verify each is wired or hide behind flags. This is the heaviest tool; scope carefully against the separate Table package work.
- **Dług UI:** **13 indigo files** (indigo-as-primary accent — GovernedModelsDashboard 12, ExtensionMarketplace 8, WebhookRelayPanel 8), **28 raw `<select>`**, **33 `fixed inset-0`**. Tracker row 18 = NEEDS-WORK.
- **Priorytet:** P2 · **Wysiłek:** XL

### 02-IDEAS-WHITEBOARD — Idea tool: Whiteboard
- **Co to jest / cel:** Freeform sticky/whiteboard canvas (clusters, sticky colors). `IdeaWhiteboardTool.tsx` (2922 lines) + `whiteboard/`.
- **Stan funkcjonalny: PARTIAL.** Data in `IdeaWorkspaceGraph.extensions.whiteboard` (`:6`). Quick actions `whiteboard/useWhiteboardQuickActions.ts` (124 lines — thin).
- **Braki:** Verify whiteboard elements round-trip through `syncMyIdeaMap`. Confirm drawing layer (`IdeaDrawingLayer.tsx`) and clustering persist. Build quick actions to parity.
- **Dług UI:** 3 indigo files, 0 raw select, 0 overlay — cleanest idea tool.
- **Priorytet:** P2 · **Wysiłek:** L

### 02-NOTEBOOK — Notebook (Notatnik)
- **Co to jest / cel:** Two-layer notes: a library of notebooks (L1, personal/team) → pages inside (L2, TipTap), with AI summaries and linked ideas.
- **Stan funkcjonalny: REAL.** Library `NotebookLibraryContent.tsx`: `Api.getNotebooks` (:154), CRUD `createNotebook`/`updateNotebook`/`deleteNotebook` (:438-216), teams `getTeams` (:413). Pages `NotebookContent.tsx`: `getNotebookPages`/`getNotebookPage` (:826,636), `updateNotebookPage` (:929), `pinNotebookPage` (:897), `setNotebookPageStatus` (:906), AI summary via `Api.chatWithAIStream` (:920). Routes: `notebook.routes.ts`. Counts `MyWorkHub.tsx:1853`.
- **Braki:** Verify notebook deep-link `?notebook=<id>` reconciliation + title fetch (`MyWorkHub.tsx:1304-1329`). Confirm personal/team scope filter (`notebookScopeFilter`) drives the API query. AI summary error handling.
- **Dług UI:** Shared hub debt. Audit page-status select, create-notebook modal overlay.
- **Priorytet:** P1 · **Wysiłek:** L

### 02-INBOX — Inbox
- **Co to jest / cel:** Unified triage inbox (notifications + signals + action items), status tabs (open/done/saved/all), presets, AI-assist triage.
- **Stan funkcjonalny: REAL (v8-first with legacy fallback).** `InboxContent.tsx`: v8 `V8MyWorkApi.getCanonicalInboxTable`/`getCanonicalInboxStats` (:1714-1715), AI assist `V8MyWorkApi.aiAssistInboxItem` (:988) falling back to `Api.post('/my-work/inbox/ai-assist')`. Legacy fallback `Api.inboxGetTable`/`Api.get('/my-work/inbox')` (:1722-1723) gated by `shouldFallbackToLegacyMyWorkInbox`. Counts `MyWorkHub.tsx:1857`.
- **Braki:** The dual v8/legacy path is a maintenance risk — verify the fallback predicate and that bulk triage (`inboxBulkActionsRef.triage`) works on both paths. Confirm presets (overdue/saved/ai/critical) map to real server filters.
- **Dług UI:** Shared hub debt; inbox preset chips, bulk bar.
- **Priorytet:** P1 · **Wysiłek:** M

### 02-CALENDAR — Calendar (Kalendarz)
- **Co to jest / cel:** Personal calendar view aggregating tasks/decisions/meetings/integrations with conflict detection and event edits.
- **Stan funkcjonalny: PARTIAL.** `Calendar/CalendarView.tsx`: integrations `Api.getIntegrations` (:225), conflicts `Api.getMyWorkCalendarConflicts` (:300), event update `Api.updateMyWorkCalendarEvent` (:353). Server `calendar.routes.ts`; events endpoint `/my-work/calendar/events` (`api.ts:10889`, v8 `my-work.ts:425`).
- **Braki:** Verify the calendar actually loads events (the component fetches integrations + conflicts but the main events fetch path must be confirmed wired to `/my-work/calendar/events`). Confirm create-event CTA (`calendarCreateReqId`, `MyWorkHub.tsx:682`) opens a working creator. External integration (Google/Outlook) likely partial — verify or flag.
- **Dług UI:** `indigo-500` tab dot (`MyWorkHub.tsx:1398`); audit event modal overlay + view selects.
- **Priorytet:** P2 · **Wysiłek:** M

### 02-TASKS — Tasks (Zadania)
- **Co to jest / cel:** Personal task management — list/kanban/calendar views, filters (overdue/today/week/urgent), inline edits, bulk ops, detail view.
- **Stan funkcjonalny: REAL.** `MyTasksListContent.tsx`: `Api.getPersonalTasks` (:1019), `Api.updatePersonalTask` (:1153,1173,1194,1228,1244) for status/field/due-date. Focus state `Api.get('/my-work/focus/state')` (:1042). Views: `TasksKanbanBoard`, `TasksCalendarView`, `TaskDetailView` (lazy). Counts `MyWorkHub.tsx:1726`.
- **Braki:** Verify bulk actions (`tasksBulkActionsRef`: complete/changePriority/changeDueDate/deleteSelected — `MyWorkHub.tsx:711-718`) all hit the API. Confirm kanban drag persists status. `TaskDetailView` raw selects (audit: ~11) must keep working after SelectField migration.
- **Dług UI:** TaskDetailView ~11 raw `<select>`, task/detail modal overlays (part of hub's 130 overlay backlog, tracker row 2).
- **Priorytet:** P0 (core daily-use) · **Wysiłek:** M

### 02-DECISIONS — Decisions (Decyzje)
- **Co to jest / cel:** Decision queue — approve/reject/remind/escalate, kanban/timeline/table views, AI brief. The accepted UI reference card (tracker row 4 = PASS).
- **Stan funkcjonalny: REAL.** `DecisionsPanelContent.tsx`: `Api.getDecisions` (:987), `Api.getDecision` (:1024), brief `Api.get('/my-work/decisions/:id/brief')` (:1032), `Api.decideDecision` approve/reject (:1146,1156), `Api.remindDecision` (:1170), `Api.escalateDecision` (:1199). Views: `DecisionsKanbanBoard`, `DecisionsTimelineView`, `DecisionDetailView`. Counts `MyWorkHub.tsx:1808`. Routes `decisions.routes.ts`.
- **Braki:** Verify bulk bar (`decisionsBulkActionsRef`: approve/reject/changePriority/remind/escalate/snoozeTomorrow — `MyWorkHub.tsx:728-739`). Confirm timeline view renders real dates. Mostly functionally complete.
- **Dług UI:** PASS — only 1 indigo (DecisionCard:81) + 2 raw select (cosmetic, tracker row 4). Minimal work.
- **Priorytet:** P0 (core, and the reference card) · **Wysiłek:** M

### 02-MANAGER — Manager / Executive Dashboard
- **Co to jest / cel:** C-level portfolio/KPI/team-health dashboard, role-gated to admin/manager/superadmin.
- **Stan funkcjonalny: PARTIAL.** `Executive/ExecutiveDashboard.tsx` fetches: `/my-work/stats?period=week`, `/my-work/decisions?onlyPending`, `/my-work/team-workload`, `getTasks`, `getExecutiveAnalytics`, `/my-work/signals` (:280-286), work-patterns (:586), decide `/decisions/:id/decide` (:617-628). Gated `MyWorkHub.tsx:579-580,1427-1430`.
- **Braki:** Verify `getExecutiveAnalytics`, `team-workload`, and `work-patterns` return real data (these are prime candidates for thin/aggregate stubs). Confirm role gate also enforced server-side (not just client `canViewManager`). Confirm decide-from-dashboard refreshes the queue.
- **Dług UI:** Shared hub debt; audit dashboard charts + period select.
- **Priorytet:** P2 (limited audience) · **Wysiłek:** M

---

## Suggested Order to drive 02 → 100% (functionality-first)

1. **02-DECISIONS** (P0, near-done) — close bulk-bar gaps; it's the reference card. Quick win, sets the bar.
2. **02-TASKS** (P0) — daily core; verify bulk ops + kanban persistence; migrate TaskDetailView selects.
3. **02-INBOX** (P1) — resolve v8/legacy fallback ambiguity; lock triage + presets.
4. **02-NOTEBOOK** (P1) — verify deep-link + scope filter + AI summary errors.
5. **02-IDEAS-LIST** (P1) — verify convert + folders; gateway to the tools.
6. **02-HOME-RADAR** (P1) — verify every block's empty/error + layout persist.
7. **02-IDEAS-MINDMAP** (P1, XL) — biggest surface; verify sync-save integrity + which AI panels are real; 28 overlay → Modal.
8. **02-IDEAS-TABLE** (P2, XL) — coordinate with separate Table package; verify extensions.table round-trip; biggest UI debt (13 indigo, 28 select, 33 overlay).
9. **02-IDEAS-PROCESSFLOW** + **02-IDEAS-WHITEBOARD** (P2, L) — verify extensions round-trip via `syncMyIdeaMap`; build quick actions to parity.
10. **02-CALENDAR** (P2) — confirm events fetch + integrations + create CTA.
11. **02-MANAGER** (P2) — verify analytics aren't stubbed; enforce server-side role gate.

**Cross-cutting (do alongside the above, per-tab):**
- **Idea-tools persistence integrity:** all 4 tools serialize into one `IdeaWorkspaceGraph` saved by `Api.syncMyIdeaMap` (`IdeaMapWorkspace.tsx:1388`). A single dropped-payload bug there breaks Process Flow / Table / Whiteboard simultaneously — verify the sync payload includes `extensions.{table,whiteboard,processFlow}` before per-tool polish.
- **UI codemods:** indigo→primary; raw `<select>`→SelectField (~129 hub-wide + 28 in table); `fixed inset-0`→Modal (~130 hub + 33 table). Track against `UI_STANDARD_TRACKER.md` rows 2/4/5/18.

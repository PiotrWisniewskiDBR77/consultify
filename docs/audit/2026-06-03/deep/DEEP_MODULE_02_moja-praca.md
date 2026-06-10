# DEEP RE-VERIFICATION — Module 02: Moja Praca / My Work

**Date:** 2026-06-03 · **Method:** end-to-end (UI → route → DB), no builds · **Repo:** consultify @ `feat/wave1-foundations`

This pass goes deeper than `COMPLETION_02_moja-praca.md` and **corrects two of its central claims** (Tasks bug already fixed; Teresa quick-action bus is actually consumed). Verdicts are evidence-backed with file:line.

---

## Per-feature verification table

| Feature | UI | Route | DB | Verdict | Evidence |
|---|---|---|---|---|---|
| Personal Tasks — list | `MyTasksListContent.tsx:1019` `Api.getPersonalTasks()` | `GET /my-work/personal-tasks` (`my-work.routes.ts:1032`) | `tasks` table, org+assignee scope | **WORKS** | List returns **all owner-scoped tasks regardless of `task_type`** (`:1095–1097`), personal sorted first (`:1099`). The completion-doc P0-01 bug is **already fixed**. |
| Personal Tasks — create | `QuickTaskPopover` / inline | `POST /my-work/personal-tasks` (`:1144`) | INSERT `tasks`, `task_type='personal'` (`:1194`) | **WORKS** | Read-back still filters `task_type='personal'` (`:1241`) — correct for create echo since insert forces personal. |
| Personal Tasks — update/delete/toggle | `MyTasksListContent.tsx:1153,1289` | `PATCH/DELETE /personal-tasks/:id` (`:1296,1419`) | UPDATE/DELETE owner+`task_type='personal'` scoped (`:1389,1433`) | **WORKS** | Mutations correctly restricted to personal rows only. |
| Team / assigned Tasks | `MyProjects` / hub widgets | `GET /my-work/tasks` (`:957`) | `tasks` JOIN initiatives/projects/users, org+assignee (`:995–996`) | **WORKS** | Real aggregation across initiatives/projects. |
| Tasks cache | `api.ts:4245` | n/a (client memo) | in-memory 15s | **PARTIAL** | Key = `url::token.slice(-32)` (`personalTasksCache.ts:11`). Cleared on token change (`tokenService.ts:11`). Collision theoretical, not live. |
| Inbox | `InboxContent.tsx` | `GET /my-work/inbox`, `/inbox/materialize`, `/inbox/canonical*`, `/inbox/:id/triage`, `/bulk-triage`, `/undo-last-ai-triage` (`:1449,2235,2252,2023,2142,2105`) | canonical inbox tables | **WORKS** | Full triage + materialize + AI-assist real. |
| Inbox materialize timeout | `InboxContent.tsx:1726` → `V8MyWorkApi.materializeCanonicalInbox` | `POST /inbox/canonical/materialize` (`my-work.ts:249`, `v8Post`) | — | **WORKS (mitigated)** | Shared client applies 20s hard timeout (`api.ts:783–795`); the doc's "no timeout / can hang" risk is covered at transport. No per-call abort, but no unbounded hang. |
| Decisions | `DecisionsKanbanBoard`, `DecisionsTimelineView`, `DecisionDetailModal` | `decisions.routes.ts` (`:41,116,265,319,342`) | decisions tables | **WORKS** | Kanban + timeline + detail all wired to real routes. |
| Ideas — Mind Map | `IdeaRecommendationMap.tsx` | `/my-ideas/:id/map`, `map/sync` | idea map persistence | **WORKS** | Persistence + AI expand/cluster real; quick-action handler mounted (below). |
| Ideas — Table | `IdeaTableTool.tsx` | `syncMyIdeaMap` / table handlers | idea graph store | **WORKS** | `useTableQuickActions.ts:270` mounted. |
| Ideas — Process Flow | `IdeaProcessFlowTool.tsx` | CRUD via `20260603_v8_process_flow.sql` | process_flow tables | **WORKS (unverified-on-prod)** | `useProcessFlowQuickActions.ts:120` mounted; AIProposalPanel real. Migration presence ≠ prod-applied. |
| Ideas — Whiteboard | `IdeaWhiteboardTool.tsx` | map-sync + facilitation `/realtime-v4/facilitation/*` | canvas + facilitation tables | **PARTIAL** | `useWhiteboardQuickActions.ts:121` mounted; facilitation `Promise.all` (`IdeaWhiteboardTool.tsx:1061`) still un-guarded — a 404 on vote-summary can reject the batch. |
| Notebook | `NotebookContent`, `NotebookLibraryContent` | `notebook.routes.ts` full CRUD + AI (`:1436,1517`) | notebooks + pages | **WORKS** | extract-actions / suggest-topics / classify call real `llmService.callText`. |
| Radar / Home | `Home/HomeView` | `home.routes.ts` 1698-line pipeline | live aggregation + RSS | **PARTIAL** | API-driven, no hardcoded signals. Literal radar map / reading-first portal / role lenses / Menu-3 AI **NOT built** (deferred P2). |
| `from-chat` idea creation | chat | `POST /my-ideas/from-chat` (`:5340`) | idea tables | **WORKS** | Route real. |
| Legacy `MyTasksList.tsx` | dead | `Api.updateTask` (wrong endpoint) | — | **BROKEN (dead code)** | Landmine; not on render path but uses wrong endpoint. |

---

## Lens 1 — Functionalities verified

Tasks (personal + team), Inbox (triage/materialize/canonical), Decisions (kanban/timeline/detail), all 4 Idea tools (persist + quick-actions), Notebook (CRUD + AI), Home/Radar (live pipeline) are **all backend-wired and functional**. The single hard failure from the prior dossier — **Tasks permanently empty for real users — is resolved**: `GET /personal-tasks` (`my-work.routes.ts:1095–1097`) no longer filters `task_type='personal'`; it returns every owner-scoped row and sorts personal first (`:1099`). Owner scoping (`buildPersonalTaskOwnerScope`, `:624–652`) enforces org + assignee, with legacy email-match gated behind `ENABLE_PERSONAL_TASK_EMAIL_MATCH` / demo flag — no cross-tenant leak.

## Lens 2 — Cross-module flow (02 aggregates work from where)

- **Tasks** ← `tasks` table joined to initiatives + projects (`:992–993`) = pulls assigned execution work from module 06.
- **Inbox** ← canonical inbox materialization aggregates signals/mentions.
- **Decisions** ↔ Tasks (`DecisionDetailModal` reachable both sides).
- **Idea → Tasks** (`QuickTaskPopover`, `task_type='personal'`) — works now that Tasks list is unblocked.
- **Idea → Notebook** (`InboxContent.tsx:1962` `Api.createNotebookPage`).
- **Home/Radar → all tabs** via `nextUp` carrying `entityType/entityId`.
- **Ideas → Initiatives/Execution** candidate handoff route exists; owner read-back not E2E-proven.
All edges confirmed except the Initiatives/Execution read-back (untested, not broken).

## Lens 3 — Teresa wiring (real vs dead apply-handlers)

**CORRECTION to completion doc.** The doc claims the quick-action bus "goes into the void." That is wrong for the **in-canvas** bus: every Idea tool mounts a dedicated handler hook that listens on `idea-workspace-quick-action` and executes real canvas mutations:
- `useMindMapQuickActions.ts:992` (in `IdeaRecommendationMap.tsx`)
- `useTableQuickActions.ts:270` (in `IdeaTableTool.tsx`)
- `useProcessFlowQuickActions.ts:120` (in `IdeaProcessFlowTool.tsx`)
- `useWhiteboardQuickActions.ts:121` (in `IdeaWhiteboardTool.tsx`)
- plus `IdeaMapWorkspace.tsx:1001`.

So the **canvas-internal AI/Menu-3 action bus is live and consumed** (real apply-handlers, e.g. structure change, fit-view, share, branch-analysis at `useMindMapQuickActions.ts:944–978`).

**What IS dead:** the **chat-Teresa ↔ canvas bidirectional bridge** `useIdeasTeresaBridge.ts` — **0 importers** (`grep useIdeasTeresaBridge( → only its own def`), and its `idea-tool-status` back-channel (`emitIdeaToolStatus`, `IDEA_TOOL_STATUS_EVENT`) has **0 emitters/consumers** outside the hook. No chat/Teresa component fires `idea-workspace-quick-action` toward the canvas (only intra-canvas toolbars do). **Net: Teresa(chat)→canvas command + canvas→chat status confirmation is NOT wired; the in-canvas AI bus is.**

## Lens 4 — Contextual memory (user/org, ephemeral/long-term)

- **Org/user data context:** `MyTasksListContent.tsx:1035` `Api.getDataContext()`; hub fetches `/api/my-work/context-summary` (`MyWorkHub.tsx:875`) — ephemeral request-scoped context.
- **Chat handoff context:** `useOpenChatWithContext` (`MyWorkHub.tsx:549,1892,2055`) passes entity context into Teresa — ephemeral.
- **Long-term:** owner identity resolved canonically (`resolveCanonicalPersonalTaskIdentity`, `:551`) — durable per-user/org scoping. No long-term semantic memory write from My Work; context is read-side and ephemeral.

---

## P0 / P1 / P2 (re-prioritized after deep verification)

### P0 — Blockers
| ID | Item | File:line |
|---|---|---|
| P0-A | Guard facilitation `Promise.all` so a 404 vote-summary can't reject the batch (only confirmed live P0) | `IdeaWhiteboardTool.tsx:1061` |
| P0-B | ~~Tasks empty-list~~ **ALREADY FIXED** — verify only | `my-work.routes.ts:1095–1097` |

### P1 — Core
| ID | Item | File:line |
|---|---|---|
| P1-1 | Wire `useIdeasTeresaBridge` (chat↔canvas) OR formally retire it; if kept, emit `idea-tool-status` from the 4 tool hooks and fire `idea-workspace-quick-action` from chat | `useIdeasTeresaBridge.ts`; 4 `use*QuickActions` hooks |
| P1-2 | Remove/repoint dead `MyTasksList.tsx` (wrong `Api.updateTask`) | `MyTasksList.tsx:250,284` |
| P1-3 | Confirm `20260603_v8_process_flow.sql` applied on prod DB | migration |
| P1-4 | Harden personal-tasks cache key to `userId:url` (eliminate theoretical collision) | `personalTasksCache.ts:11` |
| P1-5 | Facilitation create→vote→summary route-level test | `realtime-platform.routes.ts:458+` |
| P1-6 | Smoke tests: Mind Map persistence, Notebook CRUD | `tests/` |

### P2 — Vision
Radar literal map + reading-first portal + role/company lenses + Menu-3 Radar AI (`HomeView`, `home.routes.ts`); Calendar AI workday engine; Ideas cross-format + Ideas→Initiatives E2E read-back; Manager-tab data audit.

---

## Net delta vs COMPLETION_02

1. **Tasks bug is fixed** (was the headline P0) — list returns all owner-scoped tasks. Score impact: meaningfully higher than 68.
2. **Teresa "bridge dead" claim is half-wrong** — in-canvas quick-action apply-handlers are real and mounted; only the chat↔canvas bridge + status back-channel are dead.
3. **Inbox materialize hang** is mitigated by the shared 20s client timeout.
4. Remaining real risks: un-guarded facilitation `Promise.all`, dead `MyTasksList.tsx`, unbuilt Radar vision, no chat→canvas Teresa path.

# Completion Dossier — Module 02: Moja Praca / My Work

**Date:** 2026-06-03  
**Readiness today: 68/100 (was 57 on 2026-06-02)**  
**Score to 100: +32 gap**  
**Tier: Beta — personal work OS partially real, but Tasks broken for real users, Radar vision unbuilt, Teresa integration thin, facilitation unverified**

---

## Purpose / Goal / Vision

From `01_PURPOSE.md` and `RAW_TARGET_STATE_2_0_PACKET.md`:

> Personal work OS: capture and operationalize ideas, maintain a personal notebook, triage inbox, track own tasks and decisions, inspect an AI-powered technology radar, and manage a daily rhythm — without owning canonical records from other modules.

**Far goal (vision from RAW_TARGET_STATE_2_0_PACKET.md §§3, 10–14):**
- **Radar:** literal technology radar map (rings/categories/drill-down), reading-first "intelligent portal" UX; pre-initiative inspiration layer with role/company/pathfinder lenses; provenance + confidence per signal; Menu 3 AI actions only (no inline radar toolbar).
- **Ideas (4 tools):** Miro-style, Teresa-assisted canvas workspace; every tool has AI cluster/expand/connect/convert nudges; AI proposals are explicit until accepted; cross-format transforms preserve provenance; handoff to `05_inicjatywy`/`06_realizacja` is candidate-only.
- **Notebook:** L1 notebooks list → L2 pages; AI extract-actions, suggest-topics, classify all real.
- **Tasks:** Personal task OS visible to real users (not demo-only).
- **Teresa bridge:** bidirectional event bridge (chat → canvas, canvas → chat) active for all 4 Idea tools.
- **Calendar:** AI workday/project engine; identity parity with Tasks.

---

## Readiness Score + Gap

| Sub-tool | Score | Gap summary |
|---|---|---|
| Mind Map | 72 | Real persistence; AI expand/cluster real; Teresa bridge struct exists but `useIdeasTeresaBridge` hook never imported into tool |
| Process Flow | 65 | Migration `20260603_v8_process_flow.sql` landed; CRUD enabled; `AIProposalPanel` + `useProcessFlowAIProposal` real; no E2E test |
| Table | 70 | Real persistence; AI table_rows/columns/views handlers real; Menu 3 AI placement unaudited |
| Whiteboard | 58 | Canvas persistence real; facilitation routes exist at `/realtime-v4/facilitation/` (`realtime-platform.routes.ts:458`); facilitation session 404 would silently crash via shared `Promise.all` (`IdeaWhiteboardTool.tsx:1061`); AI whiteboard handlers real |
| Notebook | 78 | Full CRUD + AI extract-actions/suggest-topics/classify all call real `llmService.callText` (`notebook.routes.ts:1436,1517`); `notebooks` container migration committed; NotebookLibraryContent committed; gap: no per-tool E2E |
| Tasks | 30 | **Live bug for real users:** GET `/personal-tasks` filters `lower(coalesce(t.task_type,'')) = 'personal'` (`my-work.routes.ts:1241`) but `000_initdb_core_tables.sql:217` defaults `task_type='execution'` — Tasks tab shows permanently empty for non-demo users; `personalTasksCache.ts:10` key uses last 32 chars of JWT (collision risk) |
| Radar/Home | 60 | API-driven (no hardcoded signals); `home.routes.ts` 1698-line pipeline real; but literal radar map, reading-first portal layout, role/company lenses, Menu 3 AI actions — all **not built** (deferred P2 per `RAW_TARGET_STATE_2_0_PACKET.md §9`) |
| Inbox | 72 | Real; AI triage assist wired; materialization slow (no timeout) |
| Decisions | 75 | Real; kanban, timeline, panel wired |
| Calendar | 68 | Real; standard `requireUser` identity; no Calendar-AI wiring |
| Manager | 65 | `ExecutiveDashboard` component real; role-gated; no audit of mock data inside |

**Overall composite: 68/100**

---

## Teresa Integration

### What exists (real)

| Layer | Evidence | State |
|---|---|---|
| `useIdeasTeresaBridge` hook | `src/components/MyWork/canvas/useIdeasTeresaBridge.ts` — bidirectional `idea-workspace-quick-action` / `idea-tool-status` CustomEvent bridge | Struct only — **never imported into any Idea tool** (grep: 0 callsites for `useIdeasTeresaBridge`) |
| `idea-workspace-quick-action` events | Fired from `IdeaRecommendationMap.tsx:2288,4385,4523,4737,4922,4940,4947,5420,6329`; `IdeaWhiteboardTool.tsx:1241,2359,2779,2894,2901`; `IdeaExportMenu.tsx:475,486`; `IdeaAISuggestionsPanel.tsx:615`; `IdeaContextPanel.tsx:1025`; `IdeaMapWorkspace.tsx:952` | Firing but **no listener** on the bridge side — events go into void |
| `IdeaAINudgeStrip.tsx` | Proactive nudge bar (expand/connect/fill/convert) for Mind Map (`src/components/MyWork/IdeaAINudgeStrip.tsx`) | Real component, checks node count/isolation; calls `Api.*` |
| `AIProposalPanel.tsx` + `useProcessFlowAIProposal.ts` | Process Flow AI proposal/accept UX wired | Real |
| `ideaAIGeneratorService.ts` | LLM-backed generation: `lane_generator`, `flow_generator`, `mindmap_expand`, `whiteboard_clusters`, `whiteboard_brainstorm`, `wb_find_themes`, `wb_extract_actions`, `table_rows`, `auto_cluster`, `node_expand` etc. (25 generator types) | Real — `llmService.callStructured` at line 1172 |
| Notebook AI | `extract-actions`, `suggest-topics`, `classify` all call `llmService.callText` (`notebook.routes.ts:1436,1448,1517,1554`) | Real |
| Radar AI | Radar signals come from `home.routes.ts` real pipeline; `getAiNews` fetches live RSS; no LLM per-signal generation | Partial — no Teresa-in-Radar scan/compare/explain; Menu 3 AI slots unbuilt |
| `IdeaMapWorkspace.tsx:844` | "Talk to Teresa" CTA exists | Renders but bridge side not wired (hook not connected) |

### Critical gap: bridge is one-way stub

The Teresa bridge module exists and the event names are defined but **`useIdeasTeresaBridge` is imported by 0 components** — no Idea tool actually subscribes to incoming Teresa commands. Teresa can fire `idea-workspace-quick-action` but nothing consumes it on the canvas side. The `idea-tool-status` back-channel is also unused.

---

## System Integration

| Handoff | State | Evidence |
|---|---|---|
| Idea → Tasks (Quick task from mind map) | Real — `QuickTaskPopover.tsx` creates with `task_type='personal'` | Correct but blocked by Tasks bug |
| Idea → Notebook (Inbox → Note) | Real — `Api.createNotebookPage` (`InboxContent.tsx:1962`) | Working |
| Task → Notebook (Open Note link) | Real — `TaskDetailView.tsx` | Working |
| Decisions ↔ Tasks | Real — `DecisionDetailModal` accessible from both | Working |
| Home/Radar → all tabs | Real — `nextUp` items carry `entityType`/`entityId` (`home.routes.ts:568–608`) | Working |
| Ideas → Initiatives/Execution | Candidate-only handoff endpoint exists | Route exists; E2E owner read-back not proven |
| Teresa (chat) → Ideas canvas | Bridge struct exists; no active listener | **Not wired** |
| `from-chat` idea creation | `my-work.routes.ts:5340` — endpoint exists | Route real |

---

## Functionality: Real / Mock / Broken

**Real (backend-wired):**
- Mind Map: `GET/POST .../my-ideas/:id/map` + `map/sync` + AI expand/suggestions
- Process Flow: migration `20260603_v8_process_flow.sql` present; CRUD enabled (`IdeaProcessFlowTool.tsx:590`)
- Table: `useTablePersistence.ts` via `syncMyIdeaMap`
- Whiteboard: canvas via shared map-sync; facilitation at `/api/realtime-v4/facilitation/sessions` (registered `Gateway.ts:866`)
- Notebook: full CRUD + AI (`notebook.routes.ts`); containers migration committed
- Inbox: `V8MyWorkApi.getCanonicalInboxTable` with AI assist
- Decisions: `Api.getDecisions()` → `/decisions` real
- Radar/Home: `home.routes.ts` 1698-line live pipeline

**Broken / Missing:**
- Tasks — permanently empty for real users (`my-work.routes.ts:1241` filter requires `task_type='personal'` but default is `'execution'`)
- `personalTasksCache` key collision (`personalTasksCache.ts:10`)
- `useIdeasTeresaBridge` hook never imported by any tool — Teresa bridge dead
- Radar literal map / reading-first portal / role lenses / Menu 3 AI actions — not built (documented as `P2_NOT_DONE`)
- Whiteboard: if `facilitationGetVoteSummary` 404s, shared `Promise.all` at `IdeaWhiteboardTool.tsx:1061` can hang
- Legacy `MyTasksList.tsx` uses `Api.updateTask` (wrong endpoint) — dead code but landmine
- No E2E tests for Mind Map, Whiteboard, Notebook, or Idea cross-format transforms (only Table has coverage)
- Inbox materialization (`materializeCanonicalInbox`) has no timeout

---

## Completion Plan to 100%

### P0 — Blockers (must close before GA)

| ID | Item | File:line | Effort |
|---|---|---|---|
| P0-01 | Fix Tasks empty-list: backfill `task_type='personal'` or relax filter to include assignee tasks regardless of type; add migration | `my-work.routes.ts:1241`, `000_initdb_core_tables.sql:217` | S (1–2h) |
| P0-02 | Fix `personalTasksCache` key: use `userId:url` or full-token hash | `personalTasksCache.ts:10` | XS (30min) |
| P0-03 | Wire `useIdeasTeresaBridge` into all 4 Idea tools (MindMap, Table, ProcessFlow, Whiteboard) — bridge exists, just not mounted | `useIdeasTeresaBridge.ts`; each tool tsx | M (4–6h) |
| P0-04 | Add error boundary around `Promise.all` facilitation calls in Whiteboard | `IdeaWhiteboardTool.tsx:1061` | XS (1h) |
| P0-05 | Add timeout to `materializeCanonicalInbox` | `InboxContent.tsx:1726` | XS (30min) |

### P1 — Core vision (required for 100%)

| ID | Item | File:line | Effort |
|---|---|---|---|
| P1-01 | Build Radar literal map (rings/categories/drill-down) — locked decision per `RAW_TARGET_STATE_2_0_PACKET.md §3` | `HomeView.tsx` + new `RadarMap.tsx`; `home.routes.ts` signal geometry | L (2–3d) |
| P1-02 | Remove top narrative hero strip from Radar; reading-first layout | `HomeView.tsx` | S (2–4h) |
| P1-03 | Move Radar AI actions to Menu 3 right slot (scan/compare/explain/handoff); remove inline | `HomeView.tsx`; `MyWorkHub.tsx` Menu3 slot | M (4–6h) |
| P1-04 | Verify facilitation session routes end-to-end (create→vote→summary) — wired in `realtime-platform.routes.ts` but no route-level test | `realtime-platform.routes.ts:458–680` | S (2–4h + test) |
| P1-05 | Remove dead `MyTasksList.tsx` (uses wrong `Api.updateTask` endpoint) | `MyTasksList.tsx:250,284` | XS (30min) |
| P1-06 | Add smoke/integration tests for Mind Map persistence and Notebook CRUD | `tests/` | M (4–6h) |
| P1-07 | Verify Process Flow CRUD E2E: confirm `20260603_v8_process_flow.sql` ran on production DB | `server/migrations/20260603_v8_process_flow.sql` | XS (verify only) |

### P2 — Vision completion

| ID | Item | Effort |
|---|---|---|
| P2-01 | Role/company/pathfinder lenses on Radar | L (2d) |
| P2-02 | Full Teresa → Radar contextual actions (llm-based scan/compare/explain) | L (2d) |
| P2-03 | Radar E2E regression: load→triage→handoff→owner read-back | M |
| P2-04 | Ideas cross-format E2E: transform chain + owner read-back | M |
| P2-05 | Calendar AI workday engine | L |
| P2-06 | Manager tab full AI data verification | S |
| P2-07 | Ideas→Initiatives E2E owner read-back confirmation | M |

---

## Definition of 100%

1. **Tasks tab shows real user's tasks** (not demo-only): `task_type` bug resolved.
2. **Teresa bridge active** in all 4 Idea tools: `useIdeasTeresaBridge` mounted, `idea-workspace-quick-action` events consumed, `idea-tool-status` emitted.
3. **Radar literal map rendered** with rings, categories, drill-down; top hero strip removed; Menu 3 AI actions only.
4. **Facilitation session workflow** verified E2E in Whiteboard (create→vote→summary→convert).
5. **Notebook AI** (extract-actions, suggest-topics, classify) verified with LLM live in smoke test.
6. **No broken-endpoint dead code** (`MyTasksList.tsx` removed or fixed).
7. **Cache-key collision risk** fixed.
8. **Process Flow V8 CRUD** confirmed live on production DB.
9. **Smoke tests** cover Mind Map persistence, Notebook CRUD, and Radar load.
10. **Inbox materialization** timeout safeguard in place.

---

*Evidence files: `src/components/MyWork/canvas/useIdeasTeresaBridge.ts`, `server/src/routes/my-work.routes.ts:1241`, `server/migrations/000_initdb_core_tables.sql:217`, `server/src/routes/my-work/notebook.routes.ts:1436,1517`, `server/src/services/ideaAIGeneratorService.ts:1160–1172`, `server/src/routes/realtime-platform.routes.ts:458`, `src/components/MyWork/IdeaAINudgeStrip.tsx`, `src/components/MyWork/processflow/AIProposalPanel.tsx`, `server/migrations/20260603_v8_process_flow.sql`, `server/migrations/20260602_notebook_containers.sql`*

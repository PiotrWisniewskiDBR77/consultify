# Module 02 — Moja Praca — Readiness Scorecard

**Readiness: 57/100 — Tier: Alpha**
**Route(s):** `/my-work`, `/my-work/home`, `/my-work/ideas`, `/my-work/ideas/:ideaId`, `/my-work/notebook`, `/my-work/inbox`, `/my-work/calendar`, `/my-work/tasks`, `/my-work/tasks/:taskId`, `/my-work/decisions`, `/my-work/decisions/:decisionId`, `/my-work/manager`
**One-line verdict:** The hub shell and Notebook sub-module are genuinely backend-wired and production-plausible; Mind Map and Table persistence work through a real `my_idea_maps` API; Process Flow's dedicated DB tables (`v8_process_flow_nodes/edges`) have no migration in repo and the CRUD hook is never mounted; Whiteboard persists through the shared map-sync route but facilitates extra session APIs whose completeness is unverified; the Home/Radar view is still in a `REBUILD_LOCKED` design phase with hardcoded signals in the component.

---

## Sub-tool breakdown

- **Mind Map:** Beta — real `GET/POST /my-work/my-ideas/:id/map` + `POST .../map/sync` backend (migration `20260312_my_idea_maps.sql`); conflict detection, version-based save, viewport persistence all implemented in `useMindMapPersistence.ts`. Falls back to local graph on route/table missing. Works end-to-end.
- **Process Flow:** Alpha/Broken — UI component (`IdeaProcessFlowTool.tsx`) persists via the shared `syncMyIdeaMap` (same map-sync route as Mind Map). The V8 dedicated CRUD layer (`/api/v8/process-flow/*`, `processFlowService.ts`) references `v8_process_flow_nodes` / `v8_process_flow_edges` tables that have **no migration file** in the repo — service guards against this with `TABLE_MISSING` degraded mode. `useProcessFlowCRUD` hook is defined but never imported/called anywhere in the UI.
- **Table:** Beta — `useTablePersistence.ts` hydrates/saves via `useIdeaMapSync` → `POST /map/sync`; `my_idea_maps` migration is present; table column schema, views, and format rules all persisted. Test coverage exists (`TablePlatformFrontend.test.tsx`, cell-level tests).
- **Whiteboard:** Alpha — `IdeaWhiteboardTool.tsx` persists canvas state via `Api.getMyIdeaMap` / `Api.syncMyIdeaMap` (same route, shared with Map). Facilitation session API (`facilitationCreateSession`, `facilitationAssignRole`, `facilitationCastVote`, etc.) is wired but facilitation routes completeness not verified in this audit. No whiteboard-specific migration needed beyond shared map store.
- **Notebook:** Beta+ — Full CRUD at `/api/my-work/notebook/pages*`, new L1 container layer `/api/my-work/notebooks` (migration `20260602_notebook_containers.sql`, service `notebookContainerService.ts`). AI extract-actions, suggest-topics, classify all implemented server-side. `NotebookContent.tsx` (TipTap editor) and new `NotebookLibraryContent.tsx` wired. Most complete sub-tool. Main gap: `notebooks` migration is unrunnable until it lands in the db (it's in the untracked `?? server/migrations/20260602_notebook_containers.sql`).

---

## What's REAL (verified + backend-wired)

- Mind Map persistence: `server/src/routes/my-work.routes.ts:3269` (`GET .../map`), `:3777` (`POST .../map/sync`); migrations `20260312_my_idea_maps.sql`, `20260313_my_idea_maps_graph_contract_v3.sql`
- Notebook pages CRUD: `server/src/routes/my-work/notebook.routes.ts:187–1683` (full GET/POST/PUT/DELETE + pin + status + convert + extract-actions + suggest-topics + classify)
- Notebook containers: `server/src/routes/my-work/notebook.routes.ts:187–389`; service `server/src/services/notebookContainerService.ts`; migration `server/migrations/20260602_notebook_containers.sql` (pending run)
- Table persistence: `src/components/MyWork/table/useTablePersistence.ts` (real sync via `useIdeaMapSync`)
- Process Flow backend contract: `server/src/routes/v8/processFlow.routes.ts:1–502` (18 endpoints) — routes are code-complete but DB tables missing
- Hub shell routing: `src/components/MyWork/MyWorkHub.tsx` — 8 module tabs, lazy-loaded sub-views, feature-flag gates, pilot access guards
- Home/Radar backend: `server/src/routes/my-work/home.routes.ts` (1697 lines, real radar signal pipeline)

## What's MOCK / hardcoded / stub

- `src/components/MyWork/Home/HomeView.tsx:201` — `makeSignal('sig-risk-radar', 'Risk Radar', ...)` and several other signals are hardcoded sample data used alongside real data; radar is `REBUILD_LOCKED` per STATUS.md
- `src/components/MyWork/processflow/useProcessFlowCRUD.ts:17` — `enabled = false` default; hook defined but never instantiated in any component — the V8 CRUD path is dead code in the UI
- Whiteboard facilitation session APIs — wired in component but facilitation route completeness not confirmed from this audit

## What's BROKEN / NO_GO / missing

- **`v8_process_flow_nodes` / `v8_process_flow_edges` tables have no migration** — `processFlowService.ts:28–29` references `v8.v8_process_flow_nodes` but no `.sql` migration exists anywhere in `server/migrations/`. The service uses degraded mode (`TABLE_MISSING`) silently returning empty graphs. Process Flow data is never truly persisted via V8 CRUD; it falls back to the shared `my_idea_maps` blob (same as Mind Map), losing structural semantics.
- **`20260602_notebook_containers.sql` is untracked** (`??` in git status) — the notebooks table migration has not been committed; without it, the `/api/my-work/notebooks` routes fail at runtime with `requireTables(['notebooks'])` check.
- **`NotebookLibraryContent.tsx` is untracked** (`??` in git status) — the new L1 notebooks list view is uncommitted.
- No tests for MyWorkHub tab routing, Mind Map persistence, Process Flow, Whiteboard, or Notebook (only Table has test coverage).

---

## Backend wiring

| Sub-tool | Backend | Tables |
|---|---|---|
| Mind Map | REAL — `GET/POST .../map/sync` | `my_idea_maps` (migrated) |
| Process Flow | PARTIAL — shared map-sync only; V8 CRUD routes exist but DB tables missing | `my_idea_maps` (fallback); `v8_process_flow_nodes/edges` (missing migration) |
| Table | REAL — `useIdeaMapSync` → `/map/sync` | `my_idea_maps` (migrated) |
| Whiteboard | REAL (canvas) + UNVERIFIED (facilitation) | `my_idea_maps` (migrated) |
| Notebook | REAL — full CRUD + AI endpoints | `notebook_pages` (migrated); `notebooks` (uncommitted migration) |

## UI/UX consistency

Hub uses the `ModuleMenu3` golden standard constants (`MENU_2_TAB_ACTIVE`, `MENU_3_*` classes — `MyWorkHub.tsx:68–79`). All sub-views lazy-loaded via `lazyWithRetry`. Pilot access gates and feature flags are in place. Ideas workspace (4 tools) shares a unified toolbar and context panel per spec. Inconsistency: Notebook now has a two-level UI (NotebookLibraryContent → NotebookContent) but the hub tab-switch logic for managing this new layer is in the uncommitted `MyWorkHub.tsx` diff.

## Tests

- Table: 9 test files (unit + integration at component level) — `table/__tests__/`, `table/cells/__tests__/`, `table/provenance/__tests__/`
- Process Flow (backend): `server/src/routes/v8/__tests__/p13-whiteboard-canon.test.ts` (whiteboard canon), multiplayer tests touch process_flow surface type
- Everything else (Mind Map, Whiteboard, Notebook, Hub routing): **no tests**

## Doc-vs-code drift

STATUS.md (2026-05-18) claims `MW_IDEAS_MINDMAP`, `MW_IDEAS_TABLE`, `MW_IDEAS_PROCESS_FLOW`, `MW_IDEAS_WHITEBOARD` are all "active runtime surfaces" — partially accurate. Mind Map and Table are genuinely active; Process Flow V8 CRUD is dead code in the UI (hook never enabled); Whiteboard canvas is active but facilitation unverified. CODEMAP.md is generally accurate on component paths. Key gap: STATUS.md doesn't mention the missing `v8_process_flow_nodes` migration, the uncommitted notebook container migration, or the two uncommitted source files.

---

## Top gaps to reach market-ready (prioritized)

1. **Commit and run `20260602_notebook_containers.sql`** — without this the `/api/my-work/notebooks` endpoints fail at the `requireTables` guard; `NotebookLibraryContent.tsx` and `MyWorkHub.tsx` changes are also uncommitted.
2. **Write and run `v8_process_flow_nodes/edges` migration** — the V8 process flow backend is fully coded (`processFlow.routes.ts`, `processFlowService.ts`) but the tables don't exist; additionally wire `useProcessFlowCRUD` into `IdeaProcessFlowTool.tsx` with `enabled: true`.
3. **Finish Home/Radar Radar v1 rebuild** — HomeView contains hardcoded sample signals mixed with live data; STATUS.md marks it `REBUILD_LOCKED` / `PENDING_EXPLICIT_ACCEPTANCE`; this is the primary entry surface and its quality directly impacts first impression.
4. **Add integration/smoke tests for Mind Map, Whiteboard, and Notebook** — only Table has coverage; Mind Map persistence and Notebook CRUD are production-critical paths with zero test protection.
5. **Verify facilitation session API completeness** — Whiteboard references 8+ `Api.facilitation*` calls; confirm those routes exist and are tested before shipping multiplayer whiteboard mode.

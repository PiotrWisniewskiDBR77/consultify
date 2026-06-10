# Module 05 — Inicjatywy — Readiness Scorecard

**Readiness: 58/100 — Tier: Alpha**
**Route(s):** `/initiatives`, `/portfolio`, `/roadmap`, `/roi`
**One-line verdict:** The core portfolio hub is genuinely backend-wired with real DB persistence and a substantial feature set, but `/roi` is a literal "Under Construction" stub, `/roadmap` is deprecated with a TODO AI chat, zero frontend tests exist, and the initiative-generator is a stub-only mount in production.

## What's REAL (verified + backend-wired)

- `src/components/Initiatives/InitiativesHub.tsx:367` — V8PlanningApi.getPortfolio() primary fetch with fallback to `/api/initiatives`; real DB round-trip.
- `server/src/routes/pmo/initiatives.routes.ts` — 2,195-line PMO initiatives router with 120 real endpoints (CRUD, gate-readiness-check, milestones, templates, status history, bulk ops); mounted at `/api/initiatives` and `/api/pmo/initiatives` (Gateway.ts:447, 782).
- `server/src/routes/initiative-governance.routes.ts` — Goals/OKRs, dependencies, watchers, milestones (17 endpoints); mounted at `/api/initiatives-v4` (Gateway.ts:855).
- `server/src/routes/v8/planning.routes.ts:287` — `GET /api/v8/planning/initiatives/:id/gate-readiness-check` real endpoint with test coverage.
- `src/components/Initiatives/Analysis/` — 8-file analysis workspace (Resources, Feasibility, Logic, Timeline, Completeness, Dependency Graph); data derived from live portfolio state, not hardcoded.
- `src/services/initiativeLifecycle.ts` (818 lines) and `initiativeWriteTruth.ts` (155 lines) — real lifecycle governance services making API calls.
- `src/views/PortfolioView.tsx` — thin wrapper that correctly delegates to InitiativesHub (not a stub).
- `server/src/routes/pmo/initiatives.routes.ts:2192` — gate-readiness-check wired to `InitiativeController`.

## What's MOCK / hardcoded / stub

- `src/components/Initiatives/initiativesDemoData.ts` — 1,434-line showcase dataset (10+ pre-built initiatives); used only in demo mode (`shouldAllowDemoData()`) and for deep-link showcase IDs — does NOT pollute regular user sessions.
- `server/src/Gateway.ts:755` — `mountStub('/api/initiatives', initiativeGeneratorRoutes, ...)` — initiative-generator is blocked in production (`enableStubRoutes = !isProduction`); the AI generation flow falls back to the PMO route or is unavailable in prod.
- `src/views/FullRoadmapView.tsx:1,8` — marked `@ts-nocheck` and `@deprecated`; AI roadmap summary chat has `// TODO: Implement actual AI chat` (line 84); still mounted and served at `/roadmap`.

## What's BROKEN / NO_GO / missing

- `src/views/FullROIView.tsx:19` — **Complete stub**: renders "This module is currently under construction" with `Status: Under Construction` badge. The `/roi` route returns a placeholder page with no data, no API calls, no charts.
- `src/views/FullRoadmapView.tsx:84` — `TODO: Implement actual AI chat for Roadmap context` — roadmap AI is incomplete; view is deprecated but still live.
- Zero frontend tests for InitiativesHub, PortfolioKanbanView, PortfolioGridView, PortfolioTimelineView, PortfolioMatrixView, or any Analysis subview (`src/components/Initiatives/` has no `*.test.*` files — confirmed by docs and code search).
- `server/src/routes/__tests__/initiative-controller-interview-insight.test.ts` — only one backend test file specific to initiatives (covers interview-insight linkage only); no lifecycle, gate, or CRUD coverage.

## Backend wiring

Core CRUD is real (SQLite/Postgres via `getDatabase()`). The primary chain is: InitiativesHub → V8PlanningApi.getPortfolio → `server/src/routes/v8/planning.routes.ts` → pmo/initiatives CRUD → DB. A rich second layer (governance, milestones, gate-readiness) sits at `/api/initiatives-v4`. The legacy `/api/initiatives` endpoint (initiatives.routes.ts, 319 lines) is also live and functional. **ROI backend**: economics.routes.ts has ROI fields but the `/roi` UI never calls them.

## UI/UX consistency

InitiativesHub uses the approved `ModuleHub` shell pattern (line 1672) — consistent with other modules. Analysis workspace, Kanban, Grid, Timeline, Matrix views all render inside ModuleHub. PortfolioView correctly delegates to InitiativesHub. FullRoadmapView still uses the older `SplitLayout` + `FullStep3Workspace` legacy shell (`@ts-nocheck`, deprecated). FullROIView uses `SplitLayout` with no real content.

## Tests

- Frontend: **zero** tests in `src/components/Initiatives/` or `src/components/Portfolio/`.
- Backend: one file (`server/src/routes/__tests__/initiative-controller-interview-insight.test.ts`) covers interview→initiative linkage; `server/src/routes/v8/__tests__/planning.routes.test.ts:320` covers gate-readiness-check. No CRUD, lifecycle, or governance tests.
- Docs correctly flag `NOT_DONE` across all five function gates in STATUS.md.

## Doc-vs-code drift

STATUS.md and CODEMAP.md are largely accurate as of 2026-05-09/10. Key confirmed matches: routes, component paths, API evidence, V8 planning wiring. One material omission: docs do not mention that `/roi` (FullROIView) is a pure stub — it is listed as `IN_ROI_VIEW: lane smoke not bound (NOT_DONE)` without flagging the under-construction UI. The `@deprecated` + `@ts-nocheck` status of FullRoadmapView is also undocumented. Demo data architecture (showcase-only, not shown to real users) is correctly implemented but underdocumented.

## Top gaps to reach market-ready (prioritized)

1. **ROI module** (`src/views/FullROIView.tsx`) — replace the "Under Construction" page with a real view backed by economics.routes.ts ROI fields; this is a named route in the product.
2. **Frontend test coverage** — InitiativesHub, PortfolioKanbanView, PortfolioAnalysisView need at minimum smoke + card lifecycle tests before production sign-off.
3. **Roadmap view cleanup** — either deprecate `/roadmap` fully (redirect to `/initiatives`) or implement the missing AI chat and drop `@ts-nocheck`; the deprecated view is still user-reachable.
4. **Initiative-generator in production** — `mountStub` blocks the AI generation route in prod; decide to promote or remove; currently creates a silent dead path.
5. **Backend test coverage** — add CRUD and gate-readiness tests for `pmo/initiatives.routes.ts`; only one peripheral test exists today.

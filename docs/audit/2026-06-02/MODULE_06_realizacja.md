# Module 06 — Realizacja — Readiness Scorecard

**Readiness: 52/100 — Tier: Alpha**
**Route(s):** `/execution`, `/implementation`, `/rollout`
**One-line verdict:** The ExecutionHub (routes `/execution` and `/implementation`) is a substantive, backend-wired PMO center; the legacy FullRolloutView (`/rollout`) is an orphaned SplitLayout shell whose seven tab components carry zero backend calls and write only to in-memory session state.

## What's REAL (verified + backend-wired)

- `src/components/Execution/ExecutionHub.tsx:950–996` — initiatives loaded via `Api.getInitiatives()` with exponential-backoff retry and session-data fallback.
- `src/components/Execution/ExecutionHub.tsx:998–1077` — risk/delay/overspend signals via `V8ExecutionControlApi` (with legacy fallback to `/api/execution-control/*`).
- `src/components/Execution/ExecutionHub.tsx:1190–1240` — PMO health snapshot: `GET /api/pmo/health/:projectId`.
- `src/components/Execution/ExecutionHub.tsx:1243–1278` — per-initiative health map: `GET /api/execution/:projectId/health`; action queue: `GET /api/execution/:projectId/action-queue`.
- `src/components/Execution/ExecutionHub.tsx:1280–1335` — executive aggregate snapshot: `GET /api/executive/aggregate` with local-data fallback.
- `src/components/Execution/ExecutionHub.tsx:1207–1223` — decisions: `GET /api/decisions?projectId=…`.
- `server/src/routes/executionControl.routes.ts` — full CRUD for risk signals, audit log, timeline updates, delay signals, budget entries, closed-loop workarounds, capacity (T039–T042 + V4-EXEC-05).
- `server/src/routes/v8/execution-control.routes.ts` (1761 lines) — V8 contract routes including manager problems and control-tower queues.
- `server/src/routes/executiveAggregate.routes.ts` — `/api/executive/aggregate` with PBAC project-member guard.
- `server/src/routes/pmo/execution.routes.ts:44` — `GET /api/execution/:projectId/action-queue` implemented in `ExecutionController.getActionQueue`.
- `src/views/FullExecutionView.tsx` and `src/views/ImplementationView.tsx` — thin wrappers; both delegate to `ExecutionHub`. Docs claim is correct.
- `src/components/Execution/ExecutionManagementView.tsx` — manager lane counts fetched via `V8ExecutionControlApi.getManagerProblems` across 6 lanes.
- Menu/sidebar: `src/components/layout/Sidebar.tsx:343–349` — `MODULE_EXECUTION` entry pointing to `AppView.FULL_STEP5_EXECUTION` → `/execution`. Correct.

## What's MOCK / hardcoded / stub

- `src/components/RolloutPlanTab.tsx:67` — capacity limit comment literally reads `// Mock capacity limit`; no API calls; renders from `fullSession` in-memory.
- `src/components/RolloutKPITab.tsx:105` — mini chart hardcoded to `[30, 45, 40, 60, 55, 75, kpi.current]`; KPI mutations update session state only, never persisted.
- `src/components/RolloutRisksTab.tsx`, `RolloutChangeTab.tsx`, `RolloutClosureTab.tsx`, `RolloutStrategyTab.tsx`, `RolloutTeamsTab.tsx` — zero `fetch`/`Api.`/`axios` calls; all reads from `fullSession` prop.
- `src/views/FullRolloutView.tsx:54–68` — `handleAiChat` calls bare `sendMessageToAI(history, context)` (Gemini), not the unified `useOpenChatWithContext` hook used by ExecutionHub.
- Report generation in `src/components/Execution/executionReports.ts` — `ReportDef` objects built client-side; `exportReportPDF` is a client-side render; no backend-generated report endpoint.

## What's BROKEN / NO_GO / missing

- **FullRolloutView is orphaned legacy architecture**: uses `SplitLayout` (which spawns a second `UnifiedChatPanel`), while ExecutionHub renders inside `ModuleHub`. This creates two chat panels when `/rollout` is open — precisely the P1 blocker ("Menu 3 / AI placement proof") listed in `STATUS.md`.
- **Rollout tabs have no persistence layer**: KPI add, risk register, change log, and closure actions update only the in-memory `fullSession` object. A page refresh loses all data. No corresponding server routes exist for `/rollout/*` sub-resources.
- **`/rollout` route is unreachable via standard navigation**: the sidebar entry (`MODULE_EXECUTION`) maps to `AppView.FULL_STEP5_EXECUTION` → `/execution`, not `/rollout`. Users can only reach it via direct URL. `FullRolloutView` is effectively dead nav.
- **Manager approval/provenance flow unverified**: `STATUS.md` blocker "Manager approval/read-back evidence" is unresolved; `ExecutionManagementView` fetches problem counts but no write-back confirmation flow is visible.
- **Rollout auto-schedule / optimizer / rebaseline**: listed as required in `RL_ROLLOUT_VIEW` function card; no server endpoint exists.

## Backend wiring

ExecutionHub: **real**. Fifteen distinct API calls (initiatives, tasks, decisions, health, action queue, risk/delay/overspend signals, capacity, executive aggregate, manager lane counts). V8 execution-control server routes (1761 lines) are implemented with proper RBAC. PMO health and executive aggregate routes are production-grade with PBAC guards.

FullRolloutView: **none**. All Rollout-tab data is read from/written to the `fullSession` React prop tree only.

## UI/UX consistency

ExecutionHub uses `ModuleHub` + `MENU_3_*` constants (approved shell). FullRolloutView uses the legacy `SplitLayout`, which independently mounts `UnifiedChatPanel` and `ArtifactsPanel` — out-of-spec and confirmed as the doc's P1 AI-placement blocker. The two surfaces in the same module lane have divergent chrome.

## Tests

**Server (backend):** strong. `server/src/routes/v8/__tests__/execution-control.routes.test.ts` (529 lines) covers risk signals, delay signals, capacity, budget, timeline warnings. `p03-manager-routes.test.ts` covers manager lane/action-queue. `server/src/routes/v8/__tests__/execution.routes.test.ts` exists.

**Frontend:** none. No `*.test.*` or `*.spec.*` file covers `ExecutionHub`, `FullExecutionView`, `ImplementationView`, or any `Rollout*Tab`. Confirmed by docs (`code_gap`) and code search.

## Doc-vs-code drift

Docs are largely accurate for ExecutionHub:
- Routes `/execution` → `FullExecutionView` → `ExecutionHub` ✓
- `/implementation` → `ExecutionHub` ✓ (docs say `ExecutionHub` directly; code routes through `ImplementationView` thin wrapper — negligible drift)
- V8 execution-control and `executionWriteTruth` service wiring ✓

Significant drift on `/rollout`:
- Docs claim `RL_ROLLOUT_VIEW` covers "auto-schedule, optimizer, conflict resolution, timeline update and rebaseline" — none of these exist in code.
- Docs do not flag that `/rollout` is unreachable via sidebar nav.
- `STATUS.md` calls runtime `BLOCKED_P1`; this is accurate and conservative, but undersells the scope: FullRolloutView is functionally a prototype, not a blocked production feature.

## Top gaps to reach market-ready (prioritized)

1. **Migrate FullRolloutView to ExecutionHub or new ModuleHub surface** — eliminate the SplitLayout/duplicate-AI-panel P1 blocker and connect rollout tabs to actual backend routes.
2. **Persist Rollout sub-resources** — implement server routes + DB tables for KPI tracking, risk register, change log, and closure records within the rollout context; current data is lost on refresh.
3. **Wire `/rollout` to sidebar nav** — add a sidebar entry or sub-item pointing to `/rollout`, or consolidate rollout features into a tab within ExecutionHub at `/implementation`.
4. **Implement rollout-specific backend operations** — auto-schedule, optimizer, rebaseline, conflict resolution (currently 0% implemented vs. spec).
5. **Add frontend smoke/integration tests for ExecutionHub** — no UI tests exist despite the component being 4748 lines and the primary user-facing surface for the module.
6. **Manager approval write-back flow** — close the provenance loop: confirm/reject approval must POST to server and surface a read-back state, not just fetch lane counts.

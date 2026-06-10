# Module 06 — Realizacja — Readiness Scorecard

**Readiness: 71/100 — Tier: Beta — DELTA: +19 vs baseline 52**
**Route(s):** `/execution` → `FullExecutionView` → `ExecutionHub` (direct, no SplitLayout);
`/rollout` → `RedirectWithTracking` → `/execution?tab=rollout`;
`/implementation` → `ExecutionHub` (direct, no ImplementationView wrapper)
**One-line verdict:** FullRolloutView is gone; all rollout sub-resources are now DB-backed via `/api/rollout/*`; manager approve/reject write-back is wired and tested. Remaining gaps: duplicate-chat risk on `/implementation` path is resolved, but `ImplementationView.tsx` (SplitLayout wrapper) is an orphaned dead-import; report PDF export remains client-side only; no backend-generated report endpoint.

---

## VERIFIED CHANGES vs Baseline (52)

### FullRolloutView removed — CONFIRMED
- `src/views/FullRolloutView.tsx` — **does not exist** (file absent, no `find` hit).
- Old `Rollout*Tab.tsx` files (7 in-memory tabs) — **all deleted**. Only `src/components/Execution/RolloutTab.tsx` exists.
- `/rollout` route: `AppRoutes.tsx:1831-1838` now renders `<RedirectWithTracking from={ROUTES.ROLLOUT} to={\`${ROUTES.EXECUTION}?tab=rollout\`} />`. No SplitLayout, no duplicate chat panel on this path.

### SplitLayout on execution routes — RESOLVED
- `/execution` → `FullExecutionView` (`FullExecutionView.tsx:12`) → `ExecutionHub` directly. No SplitLayout.
- `/implementation` → `AppRoutes.tsx:1820` renders `<ExecutionHub />` directly inside `MainLayout`. No SplitLayout.
- `ImplementationView.tsx` still uses `SplitLayout` (`ImplementationView.tsx:26`) but is **never rendered** — AppRoutes.tsx:101-102 lazy-imports it but no `<Route>` references it. Dead code only, not a runtime blocker.
- `SplitLayout` default is `hideSidebar = true` (`SplitLayout.tsx:50`), so even if the orphaned file were rendered, it would not spawn a second chat panel.

### Rollout tab persistence — CONFIRMED REAL
- `RolloutTab.tsx:133-148`: `loadAll()` fires 4 parallel `Api.get` calls: `/rollout/kpis`, `/rollout/risks`, `/rollout/changes`, `/rollout/closures`.
- All mutations (`addKpi`, `patchKpi`, `deleteKpi`, `addRisk`, `patchRisk`, etc.) call `Api.post/patch/delete` against `/rollout/*` (`RolloutTab.tsx:252-350`). Data is **never stored in React state as source-of-truth** — DB is authoritative.
- KPI value change appends a history point (`rollout.routes.ts:154-158`) and triggers a sparkline reload (`RolloutTab.tsx:263`). KpiSparkline renders real time-series, not hardcoded values.
- DB migration: `migrations/20260608_rollout_tables.sql` creates `rollout_kpis`, `rollout_kpi_history`, `rollout_risks`, `rollout_changes`, `rollout_closures` with org-scoped RBAC.
- Backend mounted: `Gateway.ts:787` — `app.use('/api/rollout', rolloutRoutes)`. All 4 resources have full CRUD + `GET /kpis/:id/history`.
- Auth: `rollout.routes.ts:30` — `verifyToken, isAuthenticated, requireOrgRole('user')` on every rollout route.

### Rollout tab integration in ExecutionHub — CONFIRMED
- `ExecutionHub.tsx:113` imports `RolloutTab`.
- `ExecutionHub.tsx:694-699`: deep-link handler reads `?tab=rollout` and activates the rollout tab.
- `ExecutionHub.tsx:4543-4557`: `renderContent()` checks `activeTab === 'rollout'` and returns `<RolloutTab projectId={...} initiatives={...} riskSignals={...} delaySignals={...} onOpenChat={openRolloutRiskChat} />`.
- MENU_3 chip row: `RolloutTab.tsx:211-235` calls `onRegisterCommandRowContent` with 5 sub-tab chips (plan/kpi/risks/change/closure) using `MENU_3_CHIP_ACTIVE/INACTIVE` constants.

### Manager approve/reject write-back — CONFIRMED WIRED
- `ManagerModuleView.tsx:246-265`: `handleAction` for `sourceEntityType === 'DECISION'` and `action.id === 'approve'|'reject'` calls `Api.decideDecision(row.sourceEntityId, outcome)` — PATCH `/decisions/:id/decide` (`api.ts:5757`).
- On success: `setDecisionOutcomes` (`ManagerModuleView.tsx:255`) updates local read-back state. `ProblemPreview` receives `confirmedOutcome` prop and renders `data-testid="decision-confirmed-badge"` badge (`ProblemPreview.tsx:234`).
- Smoke test: `__tests__/ManagerApproval.smoke.test.tsx:69-91` verifies approve calls `decideDecision('dec-42', 'approved')` and the badge appears.

### Frontend tests — NEW (major uplift)
- `__tests__/RolloutTab.smoke.test.tsx`: 4 tests — KPI empty state, add POST, delete DELETE, load-error retry.
- `__tests__/ManagerApproval.smoke.test.tsx`: 1 test — decision write-back + read-back badge.
- Backend tests unchanged (strong, as in baseline).

---

## What's Still MOCK / Incomplete

- **Report PDF export**: `executionReports.ts:358` `exportReportPDF` is client-side browser render; no backend endpoint. `ReportDocumentView.tsx:27` still uses `ReportDef` built client-side.
- **Rollout auto-schedule / optimizer / rebaseline**: still 0% implemented. `RolloutTab` Plan subview (`RolloutTab.tsx:862-929`) groups initiatives by quarter from `plannedStartDate` but has no drag-reorder, conflict detection, or rebaseline action.
- **`ImplementationView.tsx` dead file**: `src/views/ImplementationView.tsx` is an orphaned SplitLayout wrapper never reached by any route — tree-shake risk + confusing for future devs.
- **Execution → Results handoff**: `ExecutionHub` only navigates to `ROUTES.INITIATIVES` (`ExecutionHub.tsx:2558`) and generates a share link to `ROUTES.IMPLEMENTATION`. No direct link to Benefits/Results module from execution signals.

---

## Flow & States

- **Loading**: `RolloutTab.tsx:362` → `<HubWorkAreaLoading />` during fetch. `ExecutionHub` retains existing initiative-loading guards for all other tabs.
- **Error**: `RolloutTab.tsx:363-376` → `<HubWorkAreaLoadError>` with Retry / Dismiss. Retry calls `loadAll()` again.
- **Empty states**: All 5 subviews have `<EmptyBox>` with contextual icon + message. KPI empty state adds "Load Atelier Toys example" seed button (`RolloutTab.tsx:433-438`).
- **Optimistic UI**: mutations update local React state immediately from server response body (not optimistically before server); `busy` flag disables actions during flight.
- **Teresa callout**: `RolloutTab.tsx:378-400` — only shown on `risks` subview when `activeSignalCount > 0`; calls `onOpenChat` → `useOpenChatWithContext` in ExecutionHub.

---

## UI/UX Adherence

- ModuleHub shell: confirmed. `MENU_3_CHIP_ACTIVE/INACTIVE` constants used (`RolloutTab.tsx:36-40`).
- Crimson: `RolloutTab.tsx:464` `bg-crimson-50 text-crimson-700`, line 509 `text-crimson-500`, line 906 `bg-crimson-50 text-crimson-700`, line 719 `accent-crimson-600`. Harvard Crimson correctly applied to critical/delete actions.
- Navy surfaces: `bg-navy-900`, `border-navy-700` on every card/table (`RolloutTab.tsx:449, 813`).
- Rounded: `rounded-xl` consistently on all cards, tables, empty states.
- No SplitLayout on active paths.

---

## Cross-Module Handoffs

- **Initiatives → Execution**: `ExecutionHub.tsx:991` loads initiatives via `Api.getInitiatives()` with session-data fallback. Status lifecycle actions (advance/block) call `getStatusActions` (`ExecutionHub.tsx:65`).
- **Execution → Initiatives**: "Add Initiative" button navigates to `ROUTES.INITIATIVES?new=1` (`ExecutionHub.tsx:2558`).
- **Execution → Results/Benefits**: No direct navigation link. Share link points to `/implementation` only. Gap: delivery signals in rollout tab don't link to Results module KPIs.
- **Manager lane → Decision module**: `handleAction` → `Api.decideDecision` → PATCH `/decisions/:id/decide`. Confirmed wired.

---

## Risks / Regressions / Runtime

1. **`ImplementationView` dead import** (`AppRoutes.tsx:101-102`): unused lazy import adds ~30KB (approx) to the chunk graph if bundler does not tree-shake lazy. Low severity.
2. **Rollout migration not in fresh-DB bootstrap**: `20260608_rollout_tables.sql` follows the same `IF NOT EXISTS` pattern as other migrations but the schema-drift audit (2026-06-02) flagged the Postgres runner skipping migrations on fresh DB — 4 rollout tables may be absent on a new install. **P1 schema risk.**
3. **`NOW()` in SQLite context — P1 runtime bug**: `rollout.routes.ts:137,283,399,511,512` uses `NOW()` (PostgreSQL function) in UPDATE statements. `server/src/utils/DbPromise.ts` is explicitly a **SQLite3 wrapper** ("SQLite3 uses callbacks by default"). `NOW()` is not valid SQLite syntax — `CURRENT_TIMESTAMP` or `datetime('now')` must be used. All PATCH mutations for KPIs, risks, changes, and closures will throw a DB error in SQLite deployments (runtime blocker for dev/default config).
4. **COALESCE null overwrite bug in rollout routes**: `rollout.routes.ts:136` uses `COALESCE(?, field)` with `null` passed when field is not in body — this correctly skips the update. Verified safe: `b.name ?? null` maps missing fields to `null`, which `COALESCE(null, field)` correctly ignores.
5. **KPI history recorded_at index**: `rollout_kpi_history` has index on `kpi_id` but not `recorded_at` — could be slow for sparkline queries if a KPI accumulates thousands of history points. Low severity for now.
6. **Report export remains client-side**: `exportReportPDF` calls browser print; no backend archiving. Not a runtime crash, but reported as "real" by some module tests.

---

## Top Gaps to Reach 98/100

1. **`NOW()` → `CURRENT_TIMESTAMP` in rollout.routes.ts** — fix 5 UPDATE statements (`rollout.routes.ts:137,283,399,511,512`) to use SQLite-compatible datetime. P1 runtime bug; all rollout PATCH mutations crash in SQLite.
2. **Rollout table migration on fresh Postgres** — confirm `20260608_rollout_tables.sql` runs on the bootstrap path (schema-bootstrap runner). P1 schema risk.
3. **Remove `ImplementationView.tsx` dead file** — or redirect it to `ExecutionHub` to remove the SplitLayout wrapper and the orphaned lazy import from AppRoutes.
4. **Execution → Results handoff** — add a "View in Results" CTA from KPI / delivery signals in the rollout tab to the Benefits module.
5. **Report backend endpoint** — replace client-side `exportReportPDF` with a server-generated PDF endpoint for audit trail.
6. **Rollout auto-schedule / rebaseline** — Plan subview needs drag-reorder and conflict detection; currently shows static quarter grouping only.

# Module Closure Decisions — Operational Snapshot (2026-08-15)

> Goal tie-in: one secure canonical tree with auditable integration and deterministic handoff.

## Canonical evidence anchors (checked)

- Routing constants: `src/routes/routeConfig.ts`
- Main application routes: `src/routes/AppRoutes.tsx`
- Menu/nav: `src/components/navigation/Sidebar/menuConfig.ts`
- API gateway mounts: `server/src/Gateway.ts`

## Stan dzisiaj (2026-08-15 09:15 CEST, SHA f6a00552802d3a5d0f2bbd2c72316c05b55b8f82)

- Test gate (pełny zakres): `4052/4052` plików, `38 798 pass`, `581 fail`, `485 pending`, `19 todo`, `0 missing`, `0 unexpected`.
- Nie-zamknięte punkty blockerowe:
  - `tests/integration` — 136
  - `tests/components` — 55
  - `tests/unit` — 49
  - `server/src` — 13
  - `src/components` — 23

### Decyzja operacyjna

- W tym momencie **nie przechodzimy do większych refaktorów** bez listy fixów dla failów; priorytetem jest domknięcie blokad per-moduł:

  1) My Work + Initiatives + Execution: dopiąć demo/runtime smoke po statusie `READY_FOR_RUNTIME_CHECK`.
  2) Results + Finance + Agent/Case: usunąć niespójność właściciela i flagów, przed czyszczeniem UI.
  3) Następnie tylko wtedy wycinać dead-code (weryfikacja importów i użycia), aby nie stracić wartościowych fragmentów.

- Potwierdzone działanie naprawcze wykonane w bieżącej gałęzi:
  - `src/components/MyWork/MyWorkHub.tsx`: priorytetowość URL `?tab=` nad sesyjnym restore oraz czyszczenie `activeDocumentId` przy nietablicy listowej.
  - To ogranicza przypadki, w których `/my-work?tab=agent` był maskowany starym `activeDocumentId` i renderował stary overlay listy.

## Module decisions

### ✅ My Work — `READY_FOR_RUNTIME_CHECK`
- Owner: My Work Lead (runtime & acceptance): Integration Lead
- Action deadline: `2026-08-15T18:00:00Z`
- Route: `ROUTES.MY_WORK` => `path={`${ROUTES.MY_WORK}/*`` in AppRoutes.
- Component mount: `MyWorkView` wrapped by `MainLayout + ProductionModuleGate`.
- API mount: `app.use('/api/my-work', myWorkRoutes)` in Gateway.
- Risk: full end-to-end demo stability and data semantics still need acceptance smoke.
- Action: no code changes now; preserve as canonical.

### ✅ Initiatives — `READY_FOR_BLOCKER_CLEANSING`
- Owner: Initiatives Lead
- Action deadline: `2026-08-15T19:00:00Z`
- Route: `ROUTES.INITIATIVES` => `InitiativesHub` in AppRoutes.
- Aliases: `/roadmap`, `/portfolio` redirect to `/initiatives`.
- API: initiatives routes present under `server/src/routes` and mounted via Gateway.
- Risk: backend-less advanced actions in some flows, plus non-green tests in module surface.
- Action: keep canonical surface; cleanup blocked paths via test-backed pass next.

### ✅ Execution — `READY_FOR_BLOCKER_CLEANSING`
- Owner: Execution Lead
- Action deadline: `2026-08-15T19:00:00Z`
- Route: `ROUTES.EXECUTION` => `ExecutionHub` in AppRoutes.
- API mount: execution control APIs present under Gateway (`/api/v8/execution-control`, `.../execution`).
- Risk: changeSignals flag/default posture, plus test debt and cross-journey regressions.
- Action: keep canonical, then remove dead/legacy route behavior only after execution smoke.

### 🟨 Results (KPI/ROI/OKR) — `BLOCKED_DATA`
- Owner: Results Lead
- Route: `ROUTES.RESULTS` => `ResultsHub` in AppRoutes.
- Backward aliases: `ROUTES.KPI_OKR`, `ROUTES.BENEFITS` redirect to `/results`.
- API: `/api/v8/results` routes present (`server/src/routes/v8/results.routes.ts`).
- Risk: runtime surface depends on resultsVNext gates and seeded content states; user-visible readiness currently inconsistent.
- Action: do not mark accepted until canonical fixtures + demo smoke verify KPIs/ROI/OKR with user-facing data.

### 🟨 Finance — `BLOCKED_ARCHITECTURE`
- Owner: Finance Lead
- Route: `ROUTES.FINANCE` + detail routes `/finance/statements/:id`, `/finance/models/:id` mount `EconomicsView`.
- API: `/api/v8/finance*` and `/api/finance-v4*` via Gateway; legacy/v3/v10 interactions also present.
- Risk: mixed finance ownership (legacy/legacy-v4/v8/v10) and route/gateway complexity.
- Action: freeze until canonical owner and bridge/cleanup map is approved.

### ✅ Materials — `READY_FOR_RUNTIME_RECHECK`
- Owner: Materials Lead
- Routes: `/document-studio`, `/presentations`, `/presentation-studio`, `/presentations/wizard`, `/presentations/builder/:deckId`.
- Mounting via `MODULE_PRESENTATIONS` beta gate and canonical `ReportsAndPresentationsHub`/`DocumentStudioView`/`DeckBuilder`.
- Risk: deep-link parity and legacy aliases still need acceptance pass.
- Action: keep as canonical, do parity checks only.

### ✅ Assessment — `READY_FOR_RUNTIME_CHECK`
- Owner: Assessment Lead
- Route: `${ROUTES.ASSESSMENT.ROOT}/*` => `AssessmentHub`.
- API: `assessment-enterprise` and related assessment routes.
- Risk: full 5-surface lifecycle parity and data quality.
- Action: keep canonical, run focused acceptance path checks next.

### ✅ Audits — `READY_FOR_RUNTIME_RECHECK`
- Owner: Audits Lead
- Functional hub: `/audit-programs` with `AuditProgramsHub`.
- Public showcase route `/audits` is intentionally separated.
- Evidence package: `docs/cleanup/AUDITS_CLOSURE_EVIDENCE_20260815.md` (route canonical, tests + wizard smoke).
- Risk: remaining test harness warnings (`act(...)`) and lifecycle polish.
- Action: keep scope split explicit; finish legacy showcase-to-workflow polish and one legacy smoke after this cleanup.

## Structural mismatches to monitor (non-negotiable)

1. `ROUTES.CASE_STUDIES` is defined as `/business-cases` but public route mount currently points to `<BusinessCasesPage />` on `ROUTES.CASE_STUDIES`.
   - Evidence: routeConfig (CASE_STUDIES constant), AppRoutes business-case public route.
   - This is currently coherent in naming but check marketing expectation consistency before finalization.
2. `MODULE_AUDITS` nav badge should remain `beta` and aligned with canonical scope.
   - Evidence: `badge: 'beta'` in `menuConfig.ts`.
   - Action: keep as canonical; monitor only if scope text shifts.

## Priority closure queue for this freeze (from `f6a00552802d3a5d0f2bbd2c72316c05b55b8f82`)

1. Cross-module infra / route-menu contract (`routeConfig.ts`, `AppRoutes.tsx`, `menuConfig.ts`, `Gateway.ts`) — **must be immutable source of truth before any module acceptance**.
   - Owner: Integration Lead (P1)
   - Exit criterion: no new route/menu contract changes without test+ledger update.
2. My Work + Initiatives + Execution — **P1 blockers** by non-green profile and business dependency.
   - Owner: Module leads (see above), finish decisions + smoke proof by end of 5h window.
3. Agent/Case + Results + Finance + Materials — **P1/P2 architectural blockers** due to owner conflict and default closures.
   - Owner: Integracja Runtime (P1) + domain leads.
4. Assessment, Tools — **P2 blockers** for parity and smoke proofing.
5. Audits / Org / Meetings / Settings / Partner / Admin — **inventory closure** and explicit NOT_INVENTORIZED decision gates before merge.

## Non-green pressure snapshot (source: full test-gate run)
- `tests/integration`: 136
- `tests/components`: 55
- `tests/unit`: 49
- `server/src`: 13
- `src/components` (highly concentrated in MyWork/Initiatives/AIChat): 23

## Closure decision rule
- `MODULE_ACCEPTED` is permitted only after route + component + API + fixture + demo proof are in one canonical commit chain.
- Any area in `BLOCKED_ARCHITECTURE` or `BLOCKED_DATA` cannot move to `READY_FOR_*` without explicit evidence package.

## 48h closure posture

- No direct code feature changes unless linked to a module decision above.
- Priority: reduce `READY_FOR_BLOCKER_CLEANSING` and `BLOCKED_*` via acceptance evidence, not further refactors.
- Non-green test debt remains the only practical precondition for clean green acceptance.

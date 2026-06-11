# M03 — Moja Praca (organizer) · FAZA 2 — Testy automatyczne

**Data:** 2026-06-11 · **Branch:** feat/deliverables-light · **Commit:** 2d5769ea20
**Środowisko:** vitest (FE/integ, jsdom+sqlite) + playwright (E2E). Integracja BE = efemeryczny `postgres:15` (Docker), `db:migrate --safe`, `MOCK_DB=false`, `CI=true NODE_ENV=test` (bypass guardu localhost w `server/src/config/databaseTargetResolver.ts`). Kontener posprzątany.
**Log:** `Harvard/modules/M03-my-work-organizer/evidence/f2_tests.log`

> Uwaga zakresowa: katalog `src/components/MyWork/` miesza organizer (M03) z narzędziami Ideas (M05–M09: mind-map/process-flow/table/whiteboard/canvas). Inwentarz poniżej **wyklucza** Ideas i Notatnik (M04). Pliki typu `IdeaTableTool`, `processflow-*`, `ideaMap*`, `PlatformCellRenderer`, `table/provenance/*` pominięte jako nie-M03.

---

## 1. Inwentarz testów M03 (organizer)

### FE — component (`tests/components/`)
| Plik | Zakres | #testów |
|---|---|---|
| MyWork/InboxTriage.test.tsx | Inbox triage render/akcje | 3 |
| MyWork/TaskInbox.test.tsx | Inbox zadań | 4 |
| MyWork/DecisionsList.test.tsx | Lista decyzji | 2 |
| MyWork/DecisionsPanel.test.tsx | Panel decyzji (filtry, approve/reject UI) | 27 |
| MyWork/FocusBoard.test.tsx | Focus / board (render) | 2 |
| MyWork/TodayDashboard.test.tsx | Dashboard „dziś” | 2 |
| MyWork/WorkloadView.test.tsx | Workload | 2 |
| MyWork/ProgressView.test.tsx | Progres | 2 |
| MyWork/CalendarView.error-state.test.tsx | Kalendarz — stan błędu | 2 |
| **MyWork/CalendarCreateEventModal.test.tsx** | Kalendarz — tworzenie eventu + conflict-check | 4 |
| MyWork/CalendarSidebar.availability.test.tsx | Kalendarz — dostępność/sidebar | 4 |
| MyWork/CommandDock.primary-action.test.tsx | Command dock | 1 |
| MyWork/ExecutionCurrentBlock.test.tsx | Blok bieżący | 1 |
| MyWork/MyWorkHub.test.tsx | Hub / nawigacja modułu | 18 |
| MyWork/Dashboard/BottleneckAlerts.test.tsx | Alerty wąskich gardeł (manager) | 2 |
| MyWork/Dashboard/WorkloadHeatmap.test.tsx | Heatmapa obciążenia (manager) | 2 |
| TaskCard.test.tsx | Karta zadania | 10 |
| TaskDetailModal.test.tsx | Modal szczegółów zadania | 6 |
| Implementation/DecisionBoard.test.tsx | Tablica decyzji | 2 |
| dashboard/NotificationCenter.test.tsx | Centrum powiadomień | 14 |
| dashboard/UserTaskList.test.tsx | Lista zadań usera | 16 |

### FE — unit (`tests/unit/components/MyWork/**`, `tests/unit/services/**`)
| Plik | Zakres | #testów |
|---|---|---|
| DecisionBottleneckPanel.test.tsx | Bottleneck decyzji | 6 |
| **DecisionsList.test.tsx** | Lista decyzji (fetch/filtry) | 5 |
| **MyTasksList.test.tsx** | Moje zadania (grupowanie/toggle/pin) | 5 |
| NotificationsHub.test.tsx | Hub powiadomień | 5 |
| TaskDetailModal.test.tsx | Modal zadania | 3 |
| TaskInbox.test.tsx | Inbox | 5 |
| WorkCenter.test.tsx | Work center | 6 |
| WorkSidebar.test.tsx | Sidebar | 6 |
| shared/QuickActions.test.tsx | Quick actions (Focus/Done/Snooze) | 5 |
| shared/DueDateIndicator.test.tsx | Wskaźnik terminu | 10 |
| useKeyboardShortcuts.test.tsx | Skróty klawiszowe | 2 |
| services/api-my-work-calendar-fallback.test.ts | API kalendarz fallback | 2 |
| services/api-my-work-inbox-fallback.test.ts | API inbox fallback | 2 |
| services/v8-my-work-api.test.ts | API v8 my-work | 12 |

### BE — unit (`tests/unit/backend/**`) + server/src (`server/src/**/__tests__`)
| Plik | Zakres | #testów |
|---|---|---|
| controllers/DecisionController.test.ts | Kontroler decyzji | 19 |
| controllers/TaskController.test.ts | Kontroler zadań | 6 |
| decisions.test.ts | Decyzje (logika) | 33 |
| decisions/decisionService.test.ts | DecisionService (create/make/escalate/cancel) | 19 |
| routes/decisionsRole.security.test.ts | RBAC decyzji | 8 |
| routes/my-work.helpers.test.ts | Helpery my-work | 2 |
| routes/pmo-decisions.routes.org-guard.test.ts | Org-guard decyzje | 1 |
| routes/pmo-tasks.routes.org-guard.test.ts | Org-guard zadania | 1 |
| routes/tasks.routes.test.js | Trasy zadań | 5 |
| services/taskService.test.ts | TaskService | 5 |
| services/taskWorkflowService.test.ts | Workflow zadań | 4 |
| services/taskAssignmentService.assignTask.test.ts | Przypisanie | 5 |
| services/taskAssignmentService.overdue.test.ts | Przeterminowane | 10 |
| statusMachine/taskTransitions.test.ts | Maszyna stanów zadania | 5 |
| v4-smoke/r1-inbox-enterprise.test.ts | Inbox enterprise smoke | 11 |
| server/src/routes/v8/__tests__/my-work-calendar.routes.test.ts | v8 kalendarz | 7 |
| server/src/routes/v8/__tests__/my-work-inbox-canonical.routes.test.ts | v8 inbox kanon | 5 |
| server/src/routes/v8/__tests__/p02-calendar-interop.test.ts | Calendar interop (effective-mode, sync, etag) | 50 |
| server/src/services/v8/__tests__/myWorkRoofService.test.ts | Roof/agregat my-work | 66 |
| server/src/services/v8/__tests__/integration/t2-flows/myWorkCrossSurfaceFlow.test.ts | Cross-surface flow | 2 |

### Integracja BE (`tests/integration/**`, real Postgres)
my-work.radar.routes.contract · mywork/my-work.v2.routes · p02-calendar-interop.contract · routes/decisions.remind.routes · routes/my-work-presence.contract · routes/my-work.decisions.routes · routes/my-work.home.fail-closed.contract · routes/my-work.link-graph.fail-closed.contract · routes/v8.my-work.inbox-triage.contract · routes/v8.my-work.routes · tasks/task-endpoints · workflows/decision-management-integration · MyWorkWorkflow (gatePolicy) — **13 plików**. (Dodatkowo notifications/*, decisions.test.js, tasks.test.js — pokrewne, nie odpalone w tej fali.)

### E2E (`tests/e2e/**`)
| Plik | Gate |
|---|---|
| smoke/deploy-gate-api-tasks.spec.ts | nightly (smoke) |
| smoke/my-work-runtime-gate.spec.ts | nightly (smoke) |
| smoke/wave1-mywork-deep-acceptance.spec.ts | nightly (smoke) |
| task-management-flow.spec.ts | **weekly only** (full) |
| tasks/task-crud.spec.ts | **weekly only** |
| decision-management.spec.ts | **weekly only** |
| calendar/calendar-management.spec.ts | **weekly only** |
| notifications/notification-center.spec.ts | **weekly only** |

**Razem uruchamialnych (vitest) M03: ~619 testów / 55 plików.**

---

## 2. Wyniki uruchomienia (PASS/FAIL/SKIP)

| Batch | Komenda (skrót) | Wynik |
|---|---|---|
| B1 FE component | `vitest run tests/components/MyWork/* + TaskCard/TaskDetailModal/dashboard/*` | **123 PASS / 3 FAIL** (21 plików) |
| B2 unit + BE(sqlite) | `vitest run tests/unit/components/MyWork/* + services + backend/{controllers,decisions,routes,services,statusMachine,v4-smoke}` | **218 PASS / 10 FAIL** (29 plików) |
| B3 server route/service | `vitest run server/src/routes/v8/__tests__/* + services/v8/__tests__/*` | **156 PASS / 0 FAIL** (5 plików) |
| B4 integracja (real PG) | `CI=true NODE_ENV=test MOCK_DB=false DATABASE_URL=…@localhost:55432 vitest run tests/integration/<M03>` | **98 PASS / 6 FAIL / 5 SKIP** (13 plików) |
| **SUMA** | | **595 PASS / 19 FAIL / 5 SKIP (619)** |

### FAIL — klasyfikacja
| Plik (testy) | Przyczyna | Typ |
|---|---|---|
| `tests/components/MyWork/CalendarCreateEventModal.test.tsx` (3/4) | `onSubmit`/`onConflictCheck` nigdy nie wywołane (expected called-with, received none) | **Produkt/regresja kandydat** (S5 create event) |
| `tests/unit/components/MyWork/DecisionsList.test.tsx` (5/5) | „Objects are not valid as a React child (found: object {defaultValue})” = mock i18n zwraca obiekt zamiast stringa | Harness/i18n-mock |
| `tests/unit/components/MyWork/MyTasksList.test.tsx` (5/5) | jw. (ten sam mock i18n) | Harness/i18n-mock |
| `tests/integration/MyWorkWorkflow.test.tsx` (gatePolicy) | błąd importu/setup, linia 29 | Harness |
| `tests/integration/mywork/my-work.v2.routes.test.ts` | kontrakt v2 | Kontrakt |
| `tests/integration/routes/decisions.remind.routes.test.ts` (2) | `makeDecisionsApp` builder (l.33) | Harness app-builder |
| `tests/integration/routes/my-work-presence.contract.test.ts` (2) | failure-injection 500 contract dla idea-presence | Harness mock |
| `tests/integration/workflows/decision-management-integration.test.ts` (1) | concurrent approval race (l.444) | Kontrakt/race |

Hałas pod spodem integracji: `relation "user_sessions" does not exist` (safe-migrate pomija tabelę — dryf schematu, zgodny z notatkami M01) oraz `service.getNotifications is not a function` (stub serwisu w teście kontraktowym notifications). **Kluczowe kontrakty M03 na realnym Postgresie PRZECHODZĄ:** inbox-triage, decisions, home fail-closed, link-graph, calendar-interop (etag/effective-mode), tasks CRUD.

---

## 3. Mapa pokrycia 6 scenariuszy krytycznych

| # | Scenariusz | FE | BE | E2E | CI gate | Ocena |
|---|---|---|---|---|---|---|
| **S1** | Inbox triage → quick action (Focus/Done/Snooze) → **reload trwałość** | InboxTriage(3), TaskInbox(4,5), QuickActions(5) — render/klik | v8.my-work.inbox-triage.contract ✓, my-work-inbox-canonical(5) ✓, r1-inbox-enterprise(11) ✓ | smoke/my-work-runtime-gate, deploy-gate-api-tasks | nightly | **CZĘŚCIOWE** — brak testu **trwałości po reload** (żaden test nie re-fetchuje i nie re-asertuje stanu po akcji) |
| **S2** | Zadanie create → status/priorytet **inline (tabela) + Kanban DnD** → reload | TaskCard(10), UserTaskList(16), FocusBoard(2) — render | TaskController(6), taskService(5), taskTransitions(5), tasks/task-endpoints ✓ | task-management-flow, tasks/task-crud | **weekly only** | **LUKA** — brak testu inline-edit statusu/priorytetu w tabeli i brak Kanban DnD-persist |
| **S3** | Zadanie → **linkowanie decyzji** | **BRAK** (UI `availableDecisions` zahardkodowane: 4 mocki `dec-1..dec-4` w `TaskDetailView.tsx:318-325`) | — | — | — | **BRAK + ZEPSUTE** — potwierdzone WIDOCZNE-ALE-ZEPSUTE; zero pokrycia |
| **S4** | Decyzja approve/reject → **trwałość** | DecisionsPanel(27), DecisionBoard(2), DecisionBottleneckPanel(6) | DecisionController(19), decisionService(19: approve/reject/escalate/cancel), decisions(33), decisionsRole.security(8), my-work.decisions.routes ✓ | decision-management.spec | **weekly only** | **DOBRE** (BE) — approve/reject/persist mocno pokryte na PG; FE render OK |
| **S5** | Kalendarz unified feed (task/initiative/decision) + **drag-reschedule (PATCH etag)** | CalendarView.error(2), CalendarSidebar.availability(4) ✓; **CalendarCreateEventModal(3/4 FAIL)** | p02-calendar-interop (50, etag/If-Match/412 obecne) ✓, my-work-calendar.routes(7) ✓, p02-calendar-interop.contract ✓ | calendar/calendar-management | **weekly only** | **CZĘŚCIOWE** — etag/interop BE solidne; **create-event FE FAIL**; brak jawnego testu drag-reschedule end-to-end |
| **S6** | Manager dashboard (admin) → decision queue **inline approve** | BottleneckAlerts(2), WorkloadHeatmap(2), WorkflowDashboard.locked, ExecutiveDashboard | decisionService approve ✓, DecisionController ✓, decision-management-integration (1 FAIL: concurrent) | (brak dedykowanego manager E2E) | — | **CZĘŚCIOWE** — komponenty managerskie render-only; brak testu „inline approve z kolejki” + concurrent-approval FAIL |

---

## 4. Pułapka CI — E2E w PR-gate vs cron-only

- **PR-gate (`test-suite.yml`, „IRIS 6.0”)** — uruchamia się tylko na `push`/`pull_request` do **`main`/`develop`**. Dodatkowo joby unit/component/integration/e2e mają krok **„Deferred outside main/develop”** → na PR-ach z `feat/*` (jak `feat/deliverables-light`) **nie odpalają się wcale**. Realnie blokują PR tylko: lint+type-check, quality-check (anti-placeholder), skip-scan, security-integrity.
- **E2E w PR-gate = `test:e2e:tier0`** — tylko 6 generycznych smoków: `login`, `pages-render`, `sidebar-navigation`, `settings-and-modules-render`, `tier0-core-workflows`, `tier0-initiative-create`. **Żaden funkcjonalny E2E M03 (myWork/task/decision/calendar/notification) nie jest w tier0.**
- **`e2e-nightly.yml`** (cron `0 3 * * *`) — `playwright.smoke.config.ts` (`testDir: tests/e2e/smoke`) → łapie **tylko** smoke-M03: `deploy-gate-api-tasks`, `my-work-runtime-gate`, `wave1-mywork-deep-acceptance`.
- **`e2e-weekly.yml`** (cron `30 3 * * 0`) — pełne `playwright test` → jedyne miejsce, gdzie biegną **funkcjonalne** E2E M03: `task-management-flow`, `tasks/task-crud`, `decision-management`, `calendar/calendar-management`, `notifications/notification-center`.

**Wniosek CI:** krytyczne ścieżki M03 (S2/S4/S5) mają E2E wyłącznie w cyklu **tygodniowym** — regresja wpadnie najwcześniej po ~7 dniach, nigdy nie blokuje PR.

---

## 5. Backlog testowy (TOP braki)

| # | Brak | Typ | Plik docelowy | Scenariusz | Prio |
|---|---|---|---|---|---|
| 1 | Linkowanie decyzji do zadania (UI na mockach `dec-1..4`) — zero testów; najpierw zwire'ować do API, potem test | integ + component | `tests/integration/routes/my-work.task-decision-link.test.ts`, `tests/components/MyWork/TaskDetailView.decisionLink.test.tsx` | **S3** | **P0** |
| 2 | Naprawa + utrzymanie `CalendarCreateEventModal` (onSubmit/conflict callbacks nie wołane) | component | `tests/components/MyWork/CalendarCreateEventModal.test.tsx` (istnieje, FAIL) | **S5** | **P0** |
| 3 | Trwałość po reload dla quick-action inbox (Focus/Done/Snooze) — re-fetch + re-assert | integ/e2e | `tests/integration/routes/v8.my-work.inbox-triage.persistence.test.ts` | **S1** | P1 |
| 4 | Inline edit statusu/priorytetu w tabeli zadań + persist | component+integ | `tests/components/MyWork/TaskTable.inlineEdit.test.tsx` | **S2** | P1 |
| 5 | Kanban DnD reorder/status → persist po reload | component/e2e | `tests/components/MyWork/FocusBoard.dnd.test.tsx` | **S2** | P1 |
| 6 | Drag-reschedule eventu w kalendarzu (PATCH If-Match end-to-end z 412 na stale etag) | integ/e2e | `tests/integration/routes/my-work.calendar.reschedule.etag.test.ts` | **S5** | P1 |
| 7 | Manager: inline approve z decision-queue (rola admin) + fix concurrent-approval race | integ | `tests/integration/workflows/decision-management-integration.test.ts` (rozszerz) | **S6** | P1 |
| 8 | Naprawa mocka i18n w unit-testach (DecisionsList/MyTasksList — obiekt `{defaultValue}` jako React child) | harness | `tests/setup.ts` / mock i18n | S4/S2 | P2 |
| 9 | **Promocja co najmniej 1 E2E M03 (task-management-flow) z weekly do nightly/tier0** by skrócić okno regresji | CI | `.github/workflows/e2e-nightly.yml` lub `package.json test:e2e:tier0` | S2/S4 | P2 |

---

## Evidence
- `Harvard/modules/M03-my-work-organizer/evidence/f2_tests.log`
- `Harvard/modules/M03-my-work-organizer/evidence/f2_tests_report.md`

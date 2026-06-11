# M14 — Wdrożenie (Execution) — FAZA 1: PRAWDA KODU

Agent: KOD. Branch: feat/deliverables-light. Data: 2026-06-11.
Metoda: czytanie runtime montaż → komponent → API → handler → SQL. Dokumenty traktowane jako hipotezy.

## Montaż tras (potwierdzony)

- `ROUTES.EXECUTION = '/execution'` → `FullExecutionView` (16 l., czysty wrapper → `ExecutionHub`) — `src/routes/routeConfig.ts:104`, `AppRoutes.tsx:1826-1843`, `src/views/FullExecutionView.tsx:11-13`.
- `ROUTES.IMPLEMENTATION = '/implementation'` → `ExecutionHub` bezpośrednio — `src/routes/routeConfig.ts:105`, `AppRoutes.tsx:1845-1862`.
- `ROUTES.ROLLOUT` → `RedirectWithTracking` do `/execution?tab=rollout` — `AppRoutes.tsx:1866-1875` (zgodne z inwentarzem).
- Oba `/execution` i `/implementation` renderują TEN SAM `ExecutionHub` (5048 l.) — `src/components/Execution/ExecutionHub.tsx`.
- Serwer (Gateway.ts): `/api/execution` → pmo/execution.routes (`:821`), `/api/execution-control` (legacy, z deprecationHeader) → executionControl.routes (`:985-988`), `/api/rollout` → rollout.routes (`:822`), `/api/executive` → executiveAggregate.routes (`:867`), `/api/execution-modules` → execution-modules.routes (`:767`). v8: `/api/v8/execution-control` + `/api/v8/execution` przez `v8Router` za bramką `v8FeatureGate` (`:1006`, `routes/v8/index.ts:66-67`).

---

## WERDYKTY PER POZYCJA INWENTARZA

| # | Pozycja | Werdykt | Dowód plik:linia |
|---|---------|---------|------------------|
| 1 | Portfolio / executive dashboard (Health Score + snapshot z lokalnym fallbackiem) | **REALNE z zastrzeżeniem** (fallback liczy z realnych danych, ale Health Score liczony lokalnie zawsze) | `ExecutionHub.tsx:1321-1376` (fetch `/executive/aggregate`), `:801-952` (buildLocalExecutiveSnapshot), `:2166-2228` (portfolioMetrics) |
| 2 | Widoki tabela/kanban/timeline (dnd-kit, inline status) | **REALNE** | `ExecutionInitiativesKanbanView.tsx:268` (onStatusChange→dnd), `ExecutionHub.tsx:1796` (PATCH `/initiatives/:id/status`) |
| 3 | Timeline z sygnałami opóźnień/ryzyk | **REALNE** | `ExecutionHub.tsx:1066-1091` (delay-signals), `ExecutionTimelineView.tsx:747` (GET dependencies) |
| 4 | Action Queue (przeterm. decyzje, ryzyka P×I, przeterm. taski) | **REALNE** | `ExecutionHub.tsx:1309-1319` (GET `/execution/:projectId/action-queue`), `ExecutionController.ts:744-900` (getActionQueue SQL org-scoped) |
| 5 | RAID log + Decisions (liczniki pending/overdue) | **REALNE** | `ExecutionHub.tsx:1248-1264` (GET `/decisions`), `:3141-3180` (decisionBuckets); RAID przez `/api/v8/execution-control` raid-items (`v8/execution-control.routes.ts:266`) |
| 6 | Panel boczny + pełny dokument inicjatywy (reuse M13) | **REALNE** | `ExecutionHub.tsx:135-139` (lazy `InitiativeDocumentView`), `:4749-4758` (render z `sourceModule="execution"`) |
| 7 | Rollout (Plan/KPI/Risks/Change/Closure, dane trwałe) | **REALNE** | `RolloutTab.tsx:386-389` (GET `/rollout/*`), `rollout.routes.ts` cały (CRUD org-scoped), migracja `20260608_rollout_tables.sql` |
| 8 | Raporty (katalog RAG, generowanie z live-data, wizard) | **REALNE** | `executionReports.ts:181-288` (readout z ctx), `reportContentGenerator.ts:1-13` (no fake numbers), `ExecutionHub.tsx:3565-3920` (katalog + wizard) |
| 9 | Manager (people_change): action-queue/decisions/blockers/workload/risk/people-change + AI panel | **ZEPSUTE warunkowo** — cały Manager wisi WYŁĄCZNIE na `/api/v8/...` bez fallbacku; przy `ENABLE_V8_GLOBAL≠true` lane'y zwracają 0/puste, panel AI = error | `ExecutionHub.tsx:1120-1158` (getManagerProblems, catch→`{total:0}`), `Manager/AiRecommendationPanel.tsx:720-748`, `client.ts:11-21` (V8_BASE=/api/v8), `v8FeatureGate.middleware.ts:14-21` |
| 10 | Czat Teresy z kontekstem egzekucji | **REALNE** | `ExecutionHub.tsx:1665-1730` (openChatWithContext z p11Handoff), `:1693-1730` (rollout-risk chat) |
| 11 | V8 execution-control z fallbackiem | **REALNE (fallback pokazuje REALNE dane)** — v8 i legacy uderzają w te same tabele; fallback to inny ROUTER, nie fabrykacja | `ExecutionHub.tsx:1044-1059` + `executionControl.routes.ts:51-900` (legacy ma realny SQL), `api/v8/execution-control.ts:3-6` (fallback dla 400/404/405/501) |
| 12 | Blokada pilota | **REALNE** | `ExecutionHub.tsx:573` (isPilotParticipant), `:1787-1791`, `:2659-2666`, `:2701-2706` (dispatchPilotAccessBlocked), readOnly props w kanban/timeline |
| 13 | Dead/legacy: ExecutionDetailPanel, views/ExecutionView, ImplementationView | **MARTWE/UKRYTE** (mix) — patrz tabela 1d | `index.ts` (brak eksportu ExecutionDetailPanel), brak importerów ExecutionDetailPanel/ExecutionView |

---

## 1a — REALNE (działa na realnych danych z DB)

| Funkcja | Plik:linia | Dowód |
|---------|-----------|-------|
| Portfolio executive snapshot | `ExecutionHub.tsx:1334-1349` | fetch `/executive/aggregate` → `executiveAggregateService.getSnapshot` (org+project gated, `executiveAggregate.routes.ts:36-67`) |
| Inicjatywy w egzekucji | `ExecutionHub.tsx:998-1005` | `Api.getInitiatives` filtr EXECUTION_STATUSES |
| Inline status change | `ExecutionHub.tsx:1796` | PATCH `/initiatives/:id/status` (governance) |
| Timeline update (persist + audit) | `v8/execution-control.routes.ts:558-593` | UPDATE initiatives + INSERT execution_audit_log, org-scoped |
| Risk/Delay/Overspend signals | `executionControlReadService.ts:39-41`, `executionBudgetService.ts:326` | realny SQL z initiatives/tasks/budget_entries |
| Action Queue | `ExecutionController.ts:744-900` | SQL na decisions/raid_items/tasks/kpi_deviation, wszystko org-scoped |
| PMO health snapshot | `ExecutionHub.tsx:1271` | GET `/pmo/health/:projectId` |
| Per-initiative health/whyRed | `ExecutionHub.tsx:1288` | GET `/execution/:projectId/health` |
| Rollout KPI/Risk/Change/Closure CRUD | `rollout.routes.ts:69-544` | INSERT/UPDATE/DELETE z RETURNING, KPI history time-series, org-scoped |
| Budget entries create/delete + recalc | `executionBudgetService.ts:85-128, 173-184` | INSERT budget_entries + recalc actual_budget_total |
| Manager lanes (gdy V8 ON) | `v8/execution-control.routes.ts:1426-1444`, `managerProblemsService.ts:62-153` | realny SQL initiatives/tasks/decisions/raid_items |
| Manager AI recommend/triage/analysis | `managerAiService.ts:246-364` | llmService.call (model 'budget'), nie hardcode |
| Teresa chat handoff | `ExecutionHub.tsx:1665-1730` | openChatWithContext realny |
| Reports z live-data | `reportContentGenerator.ts`, `executionReports.ts:181-288` | metryki z ReportDataContext (initiatives/tasks/decisions/signals) |

## 1b — MOCK-STUB / FABRYKACJA / HARDCODE

| Element | Plik:linia | Charakter | Werdykt |
|---------|-----------|-----------|---------|
| Health Score (ScoreRing) | `ExecutionHub.tsx:2200-2206` | Liczony lokalnie ZAWSZE z avgProgress/decisionHealth/capacityHealth/riskHealth; nie ma serwerowego "health score" — to derywacja FE, nie fabrykacja, ale **NIE jest danymi z DB**, tylko obliczeniem z danych z DB | NIE-FABRYKACJA, ale jakość derywowana FE |
| `budgetHealth` w portfolio | `ExecutionHub.tsx:2216` | `budgetValues.length ? 100 : null` — jeśli jakakolwiek inicjatywa ma budżet → twardo 100% (nie liczy wariancji) | **HARDCODE/PLACEHOLDER** — kafelek „Budget health 100%" jest pozorny |
| `aiRecommendedActions: []` | `executionReports.ts:282` | enrichExecutionReport zawsze zwraca pustą listę AI-rekomendacji | **STUB** — sekcja AI w raportach katalogowych pusta z definicji |
| `scenarioNotes: []` | `executionReports.ts:286` | zawsze puste | STUB |
| `ai: { enabled: false, insights: null }` w local snapshot | `ExecutionHub.tsx:951` | fallback nigdy nie daje AI | oczekiwane (degradacja) |
| `dataQuality: 'partial'` w local snapshot | `ExecutionHub.tsx:943` | twardo 'partial' gdy fallback | oznaczenie degradacji (OK) |

**Werdykt fallbacku poz.1 i poz.11:** fallback NIE fabrykuje liczb — `buildLocalExecutiveSnapshot` (`:801-952`) liczy progress/blocked/overdue/pending z REALNIE pobranych `initiatives/tasks/decisions` (te same, które serwer by agregował). Fallback v8→legacy (poz.11) zmienia tylko ROUTER, obie ścieżki uderzają w te same tabele. **Jedyna realna pozorność: `budgetHealth=100` hardcode.**

## 1c — ZEPSUTE / CICHE DEGRADACJE

| Element | Plik:linia | Problem | Severity |
|---------|-----------|---------|----------|
| Manager tab bez fallbacku v8 | `ExecutionHub.tsx:1133` + `client.ts:11` | `getManagerProblems` używa `v8Get` (BASE `/api/v8`). Przy `ENABLE_V8_GLOBAL≠true` → 404 → catch zwraca `{total:0,critical:0,warning:0}` (`:1142-1143`). Legacy `/api/execution-control` NIE MA `/manager/lanes/*`. Cały Manager (action-queue/decisions/blockers/workload/risk/people-change + AI) **cicho pokazuje puste** zamiast danych. | **P1** |
| Panel AI rekomendacji | `Manager/AiRecommendationPanel.tsx:743-746` | przy 404 z v8 ustawia `error` — przycisk AI zawsze błąd gdy V8 off | P1 (część powyższego) |
| `catch{} → setRiskSignals([])` itp. | `ExecutionHub.tsx:1061-1064, 1087-1090, 1108-1110, 1215-1221, 1301-1303, 1317` | sygnały/health/action-queue połykają błędy do pustych tablic — przy realnej awarii backendu UI pokazuje „zero" zamiast błędu (ciche degradacje). Dla signals to świadome („non-blocking"), dla `loadExecutionHealth` (`:1301`) i action-queue (`:1317`) brak komunikatu. | P2 |
| `budgetHealth=100` | `ExecutionHub.tsx:2216` | patrz 1b — pozorny zielony kafelek | P2 |

## 1d — UKRYTE + MARTWE (rekomendacja wytnij/wepnij)

| Plik | Status | Dowód | Rekomendacja |
|------|--------|-------|--------------|
| `src/components/Execution/ExecutionDetailPanel.tsx` (614 l.) | **MARTWE** | brak w `index.ts`; `grep -rln ExecutionDetailPanel` = tylko sam plik | WYTNIJ |
| `src/views/ExecutionView.tsx` (236 l.) | **MARTWE/UKRYTE** | brak importera; używa `KPIDashboard projectId="default"` (`:30`) — hardcode projectId | WYTNIJ (lub świadomie zostaw jako legacy KPI lab) |
| `src/views/ImplementationView.tsx` (32 l.) | **UKRYTE — LIVE w routingu, ale martwy wariant** | importowane w `AppRoutes.tsx:101-102` przez `lazyWithRetry`, ale ŻADNA trasa go nie renderuje (route `/implementation` używa `ExecutionHub`, nie `ImplementationView`). Owija ExecutionHub w `SplitLayout` (retired wzorzec) | WYTNIJ import+plik (kod nieosiągalny) |
| `src/views/FullExecutionView.tsx` (16 l.) | UKRYTE-OK | live na `/execution`, czysty wrapper | zostaw (lub zwiń trasę bezpośrednio na ExecutionHub) |
| `BenefitsTracker`, `KPIDashboard`, `CorrectiveActions` | UKRYTE | używane tylko w `ExecutionView.tsx` (martwe) i `workspaces/FullExecutionDashboardWorkspace.tsx` | sprawdzić importerów FullExecutionDashboardWorkspace — kandydat na martwe drzewo |
| `RiskSignalsPanel`, `DelayDetectionPanel` | MARTWE | eksportowane z `index.ts` ale brak importerów w src | kandydat WYTNIJ |
| `PeopleChangeWorkspace.tsx` (881 l.) | **MARTWE?** | `grep import PeopleChangeWorkspace` = brak importerów (Manager tab używa `ExecutionManagementView`→`ManagerModuleView`) | ZWERYFIKUJ; jeśli nieosiągalny → WYTNIJ |
| `ReportCompactPanel.tsx` | MARTWE? | brak importerów w grep | ZWERYFIKUJ |

> UWAGA: `views/ExecutionView.tsx` ŻYJE w drzewie kompilacji (martwy import nie zerwie buildu), ale jest UKRYTE/nieosiągalne z routingu. Inwentarz wymienił tylko ExecutionDetailPanel/ExecutionView/ImplementationView jako martwe — potwierdzone + rozszerzone o RiskSignalsPanel/DelayDetectionPanel/PeopleChangeWorkspace/ReportCompactPanel jako kandydatów.

---

## 1e — Wiring FE↔BE↔DB

| Funkcja FE | Endpoint | Tabela DB | Migracja | Status |
|-----------|----------|-----------|----------|--------|
| Executive snapshot | GET `/api/executive/aggregate` | initiatives, tasks, decisions, kpis, risks (agregat) | (rdzeń) | OK, org+project gated |
| Inicjatywy | GET `/api/initiatives` | initiatives | (rdzeń) | OK |
| Status change | PATCH `/api/initiatives/:id/status` | initiatives | (rdzeń) | OK |
| Action queue | GET `/api/execution/:projectId/action-queue` | decisions, raid_items, tasks, kpi_deviation_* | (rdzeń) | OK, org-scoped |
| Per-init health | GET `/api/execution/:projectId/health` | initiatives, tasks | (rdzeń) | OK |
| PMO health | GET `/api/pmo/health/:projectId` | (pmo) | — | OK |
| Risk signals | GET `/api/v8/execution-control/risk-signals` → fallback `/api/execution-control/risk-signals` | risk_signal_alerts, initiatives | execution-control mig. | OK z fallbackiem |
| Delay signals | GET v8 → fallback legacy `/delay-signals` | delay_signals | j.w. | OK z fallbackiem |
| Overspend | GET v8 → fallback `/budget/overspend-signals` | budget_entries, initiatives | j.w. | OK z fallbackiem |
| Timeline warnings/capacity | GET v8 → fallback legacy `/warnings`, `/capacity/*` | initiatives, tasks, *_dependencies | j.w. | OK z fallbackiem |
| Timeline update | POST v8 `/timeline-update` → fallback `/api/execution-control/timeline-update` | initiatives + execution_audit_log | j.w. | OK z fallbackiem |
| Budget entries | POST/DELETE v8/legacy `/budget/entries` | budget_entries, initiatives | j.w. | OK |
| **Manager lanes** | GET `/api/v8/execution-control/manager/lanes/:id/problems` | initiatives, tasks, decisions, raid_items | j.w. | **BRAK fallbacku → puste przy V8 off** |
| Manager AI recommend | POST `/api/v8/execution-control/manager/lanes/:id/ai/recommend` | (llmService) | — | **BRAK fallbacku** |
| Rollout KPI | GET/POST/PATCH/DELETE `/api/rollout/kpis` (+`/:id/history`) | rollout_kpis, rollout_kpi_history | `20260608_rollout_tables.sql` | OK, trwałe |
| Rollout Risks | `/api/rollout/risks` | rollout_risks | j.w. | OK |
| Rollout Changes | `/api/rollout/changes` | rollout_changes | j.w. | OK |
| Rollout Closures | `/api/rollout/closures` | rollout_closures | j.w. | OK |
| Teresa chat | openChatWithContext (konwersacje) | conversations/messages | (rdzeń) | OK |
| Execution-modules standard | GET `/api/execution-modules/*` | (brak tabeli — manifesty in-code) | — | governance read-only |

## 1f — Flagi

| Flaga | Default BE (komentarz vs runtime) | Default FE | Kto włącza | Wpływ |
|-------|-----------------------------------|-----------|-----------|-------|
| `ENABLE_V8_GLOBAL` | **runtime: OFF** — `process.env.ENABLE_V8_GLOBAL === 'true'`; gdy brak → 404 `V8_DISABLED` (`v8FeatureGate.middleware.ts:14-21`) | n/d | ENV na serwerze | **KRYTYCZNE:** gdy OFF cały `/api/v8/*` daje 404. Sygnały/timeline/budget mają fallback do legacy `/api/execution-control` (nadal zamontowane, `Gateway.ts:985`). **Manager NIE ma fallbacku → puste.** |
| `shouldFallbackToLegacyExecutionControl` | n/d (FE) | fallback na status 400/404/405/501 (`api/v8/execution-control.ts:3-6`) | — | maskuje wyłączenie v8 dla signals/timeline/budget |
| `v8OrgGate`/`isV8Enabled` (per-org) | OFF jeśli brak wierszy flag, chyba że `allowImplicitOrgRowsFallback()` (`:42`) | n/d | superadmin/seed | per-org wariant tej samej bramki |
| beta gating Implementation | `betaAccess` (`src/utils/betaAccess.ts`) — niezweryfikowane czy Implementation zamknięte | — | admin | poza zakresem F1 (do SEC/UX) |

> ROZJAZD KOMENTARZ vs RUNTIME: deprecationHeader na `/api/execution-control` (`Gateway.ts:986`) sugeruje, że legacy jest „przestarzałe", a kanoniczne to v8. W praktyce, dopóki `ENABLE_V8_GLOBAL≠true`, **legacy jest jedyną żywą ścieżką** dla większości sygnałów. To odwrotność intencji.

## 1g — Połączenia międzymodułowe (WEJŚCIA/WYJŚCIA)

| Kierunek | Połączenie | Plik:linia | Status |
|----------|-----------|-----------|--------|
| WEJŚCIE (M13) | reuse dokumentu inicjatywy — lazy `InitiativeDocumentView` z `sourceModule="execution"` | `ExecutionHub.tsx:135-139, 4749-4758` | DZIAŁA |
| WEJŚCIE (M13) | `InitiativeCompactPanel` / `InitiativePreviewV3` w panelu bocznym | `ExecutionHub.tsx:91-96` | DZIAŁA |
| WEJŚCIE (M03) | decyzje — GET `/decisions?projectId`, bucket'y due/overdue, klik → otwiera inicjatywę | `ExecutionHub.tsx:1253, 3193-3224` | DZIAŁA |
| WEJŚCIE (M03/MyWork) | tasks — `Api.getTasks`, bucket overdue/dueSoon | `ExecutionHub.tsx:1236` | DZIAŁA |
| WYJŚCIE→M01 (Teresa) | handoff czatu z `p11Handoff.lane = execution_portfolio/execution_reports/execution_rollout_risk` | `ExecutionHub.tsx:1674-1681, 1704` | DZIAŁA |
| WYJŚCIE→Initiatives | „nowa inicjatywa" → `navigate(/initiatives?new=1)`; pilot blokowany | `ExecutionHub.tsx:2665` | DZIAŁA |
| WEJŚCIE/WYJŚCIE (M15/M16 economics/ROI) | snapshot ma `roi: { summary: null, items: [] }` w local; serwerowy aggregate może mieć ROI, ale local fallback NIE | `ExecutionHub.tsx:945` | CZĘŚCIOWE — ROI puste w degradacji; brak bezpośredniego deep-linku do Finance z huba |
| WYJŚCIE→Initiatives (deep-link) | copyExecutionLink → `/implementation?open=&initiativeId=&tab=&view=` | `ExecutionHub.tsx:1741` | DZIAŁA |
| WEJŚCIE (registry/artifact) | v8 execution-spine (proposals/runs) — `v8/execution.routes.ts` | `routes/v8/execution.routes.ts` | osobny od ExecutionHub (artifact run control), za bramką V8 |
| WEJŚCIE (RAID) | RAID items przez v8 execution-control (`raid_items`) | `v8/execution-control.routes.ts:266` | DZIAŁA gdy V8 ON; fallback? — RAID patch tylko v8 |

> UWAGA M15/M16: jedyny most ROI jest pośredni (przez serwerowy `/executive/aggregate.roi`); brak twardego deep-linku Execution→Finance w hubie. economics nie jest fabrykowane — po prostu puste w trybie degradacji.

---

## NOWE pozycje (git od 2026-06-07)

Komity dotykające modułu (`git log --since=2026-06-07` na ścieżkach modułu):
- `630f4c8aff` chore(staging) — **duża fala**: RolloutTab +639, ReportGeneratorWizard +646 (NOWY), reportContentGenerator +702 (NOWY), reportWizardTypes +349 (NOWY), GeneratedReportView +192 (NOWY). To wnosi poz. 7 (rollout trwały) i poz. 8 (wizard raportów).
- `c2bf2394e7` chore(release) — autofix + „data-truth compliance" na ExecutionHub (370 zmian), reportContentGenerator (186).
- `028a83896d` fix(qa) — +8 l. w `v8/execution-control.routes.ts` (BUG-18 fix: bramka `/manager` za `requirePermission('manage_workstreams')`, `:1420`).
- `6de62b2144` / `9faed953a6` — canon table conformance Execution.

**NOWE komponenty do inwentarza (nie były w INV_D explicite):** `Reports/Wizard/ReportGeneratorWizard.tsx`, `Reports/reportContentGenerator.ts`, `Reports/GeneratedReportView.tsx`, `Reports/Wizard/reportWizardTypes.ts`, `Execution/ReportDocumentView.tsx`, `Execution/executionReports.ts` — wszystkie REALNE (live-data, no fake numbers — potwierdzone w nagłówku `reportContentGenerator.ts:1-13`).

---

## KANDYDACI P0/P1 (do krzyżowej weryfikacji z SEC + FAZA 2)

- **P1 — Manager tab cicho martwy bez V8.** `getManagerProblems` (`ExecutionHub.tsx:1133`) → `v8Get /api/v8/...` (`client.ts:11`) → 404 gdy `ENABLE_V8_GLOBAL≠true` (`v8FeatureGate.middleware.ts:16`) → catch zwraca zera (`:1142`). Legacy execution-control NIE ma `/manager/lanes/*`. AI panel → error. Cała 9. pozycja inwentarza („Manager [DZIAŁA]") jest warunkowa od ENV flagi. Trzeba: albo fallback legacy dla managera, albo twardo wymagać V8, albo jawny banner „V8 disabled" zamiast pustych zer.
- **P1/P2 — `budgetHealth=100` hardcode** (`ExecutionHub.tsx:2216`). Kafelek „Budget Health" w portfolio zawsze 100% gdy istnieje jakikolwiek budżet — pozorna zieleń, wprowadza w błąd executive dashboard.
- **P2 — ciche degradacje catch→[]** dla execution-health (`:1301`) i action-queue (`:1317`) bez komunikatu błędu — różnica „zero realne" vs „backend padł" niewidoczna.
- **P2/CLEANUP — martwy/nieosiągalny kod:** `ImplementationView.tsx` (importowany, nigdy renderowany), `ExecutionView.tsx` (hardcode `projectId="default"`), `ExecutionDetailPanel.tsx`, kandydaci `PeopleChangeWorkspace`/`RiskSignalsPanel`/`DelayDetectionPanel`/`ReportCompactPanel`.

## IDOR — krzyżowa weryfikacja z SEC

Przeskanowano wszystkie `WHERE id = ?` w plikach modułu (executionControl, v8/execution-control, rollout, ExecutionController, manager*, executiveAggregate, v8ExecutionControlTower, executionControlRead, executionBudget).

- **WYNIK: każde `WHERE id = ?` na endpointach biorących :id/initiativeId z URL ma towarzyszące `AND organization_id = ?`.** Sprawdzone: rollout `/kpis/:id`,`/risks/:id`,`/changes/:id`,`/closures/:id` (`rollout.routes.ts:125,271,386,500` itd. — wszystkie org-scoped); v8 timeline-update (`:566,578`), reassign (`:728,750`), budget entry guard (`:524`), baseline-variance (`:1213`); ExecutionController wszystkie SQL org-scoped.
- **JEDYNY wyjątek:** `executionBudgetService.ts:413` — `UPDATE initiatives SET actual_budget_total = ? WHERE id = ?` **BEZ organization_id**. ALE: to funkcja wewnętrzna `recalcInitiativeActualTotal(organizationId, initiativeId)` wołana tylko po `createBudgetEntry`/`deleteBudgetEntry`, gdzie initiativeId został już zweryfikowany org-scoped (route guard `:524` + delete `:178` SELECT org-scoped). `initiativeId` nie pochodzi bezpośrednio z URL bez walidacji. **Niski risk, ale do zgłoszenia SEC** — defensywnie dopisać `AND organization_id = ?` (id inicjatywy jest globalnie unikalny, więc nie cross-org IDOR jak w M01/M03/M10/M13, ale brak defense-in-depth).
- **Wniosek:** moduł M14 NIE powiela systemowego wzorca cross-org IDOR z poprzednich modułów. Jedyna luka to brak org-scope w wewnętrznym recalc (defense-in-depth, nie eksploatowalne bezpośrednio).

## Naprawione vs 06-02 (nie powielać)

- Rollout in-memory (7 komponentów `fullSession`) → ZASTĄPIONE trwałymi `/api/rollout/*` + migracja `20260608_rollout_tables.sql`. POTWIERDZONE naprawione.
- BUG-18 (manager lane org-wide leak) → bramka `requirePermission('manage_workstreams')` na `/manager` (`v8/execution-control.routes.ts:1420`). Naprawione.

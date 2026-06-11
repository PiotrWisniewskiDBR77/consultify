# M14 Wdrożenie — FAZA 2: Testy automatyczne

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` @ `592fbb8211` · **Agent:** TESTY
**Log pełny:** `evidence/f2_tests.log` (wszystkie grupy uruchomione lokalnie, nie cytowane z cudzych wyników)

## 0. Wynik zbiorczy

| Grupa | Komenda | Pliki | PASS | FAIL | SKIP | Czas |
|---|---|---|---|---|---|---|
| A. FE komponenty/unit (root vitest) | `npx vitest run <17 plików>` | 17 | 113 | 5 | 0 | 6.6 s |
| B. BE server (`server/` vitest) | `cd server && npx vitest run <16 plików>` | 16 | 286 | 1 | 0 | 2.3 s |
| C. BE unit (root `tests/unit/backend`) | `npx vitest run <10 plików>` | 10 | 152 | 0 | 0 | 3.0 s |
| D. Integracyjne (root `tests/integration`) | `npx vitest run <8 plików> --no-file-parallelism` | 8 | 55 | 7 | 0 | 17.3 s |
| E1. E2E smoke deploy-gate (playwright, mock web-server) | `playwright test --config playwright.smoke.config.ts deploy-gate-…` | 1 | 21 | 0 | 0 | 7 s (testy) |
| E2. E2E execution-center + decision-management | `playwright test --config playwright.config.ts …` (heap 12 GB dla vite build) | 2 | 6 | 10 | 0 | 6.1 min |
| **RAZEM** | | **54** | **633** | **23** | **0** | |

Uwaga: `tests/unit/execution/status-machine.test.ts` (21 testów) policzony w grupie A i C (przebiegł 2×, oba PASS) → unikalnych PASS = 612.
Uwaga 2: pierwsze podejście do grupy E2 padło na OOM `vite build` w webServer (exit 134) — wymagane `NODE_OPTIONS=--max-old-space-size=12288`; to koszt środowiskowy, nie wynik testów.

## 1. Inwentarz testów modułu (per plik)

### FE (root vitest — jsdom)
| Plik | Zakres | Testy | Wynik |
|---|---|---|---|
| tests/components/Execution/DelayDetectionPanel.controlled.test.tsx | panel opóźnień (controlled) | 2 | PASS |
| tests/components/Execution/RiskSignalsPanel.controlled.test.tsx | sygnały ryzyk (controlled) | 2 | PASS |
| tests/components/Execution/MitigationPanel.test.tsx | panel mitygacji | 9 | PASS |
| tests/components/Execution/PeopleChangeWorkspace.communication.test.tsx | S7 people_change — seam komunikacji Api | 3 | **FAIL ×3** |
| tests/components/Implementation/RAIDLog.test.tsx | S4 RAID log render | 2 | PASS |
| tests/components/Implementation/DecisionBoard.test.tsx | S4 decision board render | 2 | PASS |
| tests/components/Implementation/ExecutiveDashboard.test.tsx | S1 executive dashboard render | 2 | PASS |
| tests/components/dashboard/DashboardExecutionSnapshot.test.tsx | S1 snapshot na dashboardzie (progress, stany) | 22 | PASS |
| tests/components/MyWork/ExecutionCurrentBlock.test.tsx | blok execution w My Work (styk M03) | 1 | PASS |
| src/components/Execution/__tests__/ManagerApproval.smoke.test.tsx | S7 manager approval smoke | 1 | PASS |
| src/components/Execution/__tests__/RolloutTab.smoke.test.tsx | S5 rollout KPI (empty state + add KPI POST) | 4 | **FAIL ×2** |
| src/services/executionModuleStandard/__tests__/useExecutionModuleManifest.test.tsx | klient API manifestów execution-module + hook cache | 13 | PASS |
| tests/unit/execution/status-machine.test.ts | maszyna stanów statusów wdrożenia | 21 | PASS |
| tests/unit/execution/executionPayloadGuards.test.ts | guardy payloadów execution | 4 | PASS |
| tests/unit/services/executionWriteTruth.test.ts | "write truth" zapisów execution | 3 | PASS |
| tests/unit/services/v8-execution-control-api.test.ts | FE klient /api/v8/execution-control | 16 | PASS |
| tests/unit/components/Assessment/RolloutPlanTab.test.tsx | S5 plan rolloutu (zakładka Assessment) | 11 | PASS |

### BE — root vitest (node env)
| Plik | Zakres | Testy | Wynik |
|---|---|---|---|
| tests/unit/backend/v4-smoke/r0-raid-scoring.test.ts | S4 scoring RAID | 7 | PASS |
| tests/unit/backend/aiActionExecutor.test.js | wykonawca akcji AI | 11 | PASS |
| tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts | jw. runtime wave3 | 5 | PASS |
| tests/unit/backend/actionDecision.service.test.js | serwis action decisions | 8 | PASS |
| tests/unit/backend/decisions.test.ts | logika decyzji | 33 | PASS |
| tests/unit/backend/decisions/decisionService.test.ts | decision service | 19 | PASS |
| tests/unit/backend/controllers/DecisionController.test.ts | kontroler decyzji | 19 | PASS |
| tests/unit/backend/routes/decisionsRole.security.test.ts | RBAC decyzji | 8 | PASS |
| tests/unit/backend/routes/pmo-decisions.routes.org-guard.test.ts | org-guard decyzji | 1 | PASS |
| tests/unit/execution/status-machine.test.ts | (jw., drugi przebieg) | 21 | PASS |

### Integracyjne (root `tests/integration`)
| Plik | Zakres | Testy | Wynik |
|---|---|---|---|
| tests/integration/actionDecision.test.ts | flow action decision | 5 | PASS |
| tests/integration/actionExecution.test.ts | flow action execution | 5 | PASS |
| tests/integration/routes/execution.test.js | /api/execution/:projectId summary/blockers/gate-check | 3 | PASS (ale 2 unhandled rejections "role iris") |
| tests/integration/routes/decisions.test.js | /api/decisions CRUD | 6 | **FAIL ×1** |
| tests/integration/routes/v8.execution.routes.test.ts | /api/v8/execution governed routes | 9 | **FAIL ×1** |
| tests/integration/routes/my-work.decisions.routes.test.ts | decyzje w My Work | 9 | PASS |
| tests/integration/routes/decisions.remind.routes.test.ts | POST /:id/remind | 2 | **FAIL ×2** |
| tests/integration/workflows/decision-management-integration.test.ts | L3 pełny workflow decyzji | 23 | **FAIL ×3** |

### BE — `server/` vitest (sqlite, node)
| Plik | Zakres | Testy | Wynik |
|---|---|---|---|
| server/src/services/__tests__/v8ExecutionControlTowerService.test.ts | S1 control tower aggregate | 2 | PASS |
| server/src/services/__tests__/executiveAggregateRolloutKpis.test.ts | S5→S1 merge rollout KPI do executive aggregate | 3 | PASS |
| server/src/services/executionModuleStandard/__tests__/executionModuleStandard.test.ts | standard modułów execution | 30 | PASS |
| server/src/services/executionModuleStandard/__tests__/executionModuleStandardManifests.test.ts | manifesty | 13 | PASS |
| server/src/routes/v8/__tests__/execution.routes.test.ts | /api/v8/execution (serwisy zamockowane) | 5 | PASS |
| server/src/routes/v8/__tests__/execution-control.routes.test.ts | /api/v8/execution-control (serwisy zamockowane) | 17 | PASS |
| server/src/services/v8/__tests__/executionSpineService.test.ts | spine: createRun/transitions (DbPromise zamockowany) | 50 | **FAIL ×1** |
| server/src/services/v8/__tests__/executionSpineService.initiative-scope.test.ts | spine: scope inicjatywy | 2 | PASS |
| server/src/services/v8/__tests__/executionSpineApprovalFlow.test.ts | spine: approval flow | 27 | PASS |
| server/src/services/v8/__tests__/executionVisibilityService.test.ts | widoczność execution | 70 | PASS |
| server/src/services/v8/__tests__/planningExecutionVisibility.test.ts | widoczność planning↔execution | 9 | PASS |
| server/src/services/v8/__tests__/pmSyncRefreshExecutionService.test.ts | sync PM refresh | 4 | PASS |
| server/src/services/v8/__tests__/chatExecutionService.test.ts | execution z czatu | 35 | PASS |
| server/src/services/v8/__tests__/managerActionExecutionService.test.ts | S7/S3 akcje managera | 9 | PASS |
| server/src/services/v8/__tests__/integration/t2-flows/executionApprovalFlow.test.ts | T2 flow approvals | 7 | PASS |
| server/src/services/v8/__tests__/integration/t2-flows/chatExecutionFlow.test.ts | T2 flow chat→execution | 2 | PASS |

### E2E (playwright)
| Plik | Zakres | Testy | Wynik |
|---|---|---|---|
| tests/e2e/smoke/deploy-gate-api-execution-benefits-finance.spec.ts | L4 smoke API execution/benefits/finance (no-5xx + kontrakt) | 21 | PASS |
| tests/e2e/execution-center.spec.ts | UI+API Execution Center (filtry, 5 widoków, kanban DnD, health, decyzje, handoff do Benefits) | 15 | 6 PASS / **9 FAIL** |
| tests/e2e/decision-management.spec.ts | zakładka Decisions w My Work | 1 | **FAIL ×1** |

## 2. Root-cause wszystkich 23 FAIL

| # | Test | Root-cause | Klasa |
|---|---|---|---|
| 1–3 | PeopleChangeWorkspace.communication ×3 | Mock `react-i18next` zwraca 2. argument pozycyjnie (`t(key, fallback)`), a renderowany primitive `ErrorState` woła `t('common.errorTitle', { defaultValue: … })` → obiekt `{defaultValue}` jako React child → crash | **mock-drift react-i18next** (znany wzorzec M13) |
| 4–5 | RolloutTab.smoke ×2 | CTA "Add KPI" przeniesione z RolloutTab do `ExecutionHub.menuCta` (src/components/Execution/ExecutionHub.tsx:4932-5002, Menu 2); RolloutTab renderuje już tylko empty-state "Load Atelier Toys example" | **UI-drift** (stale test po refaktorze) |
| 6 | executionSpineService "rejects invalid UUID for organizationId" | `CreateRunParamsSchema.organizationId` poluzowane z `.uuid()` na `.min(1)` (server/src/types/executionSpine.ts:231); test wciąż oczekuje ZodError | **schema-drift** (test stary; otwarte pytanie produktowe: czy orgId ma być UUID) |
| 7–9 | decision-management-integration ×3 (401 zamiast 400/422) | Test używa realnego Postgresa z rolą `iris`, której nie ma lokalnie (`role "iris" does not exist`) → auth lookup pada → 401 | **env-drift / efemeryczny PG** (znany wzorzec M13) |
| 10 | decisions.test.js "returns list of decisions" ([] zamiast 2) | seed nie wszedł — te same błędy PG `role iris` w tle | **env-drift** |
| 11–12 | decisions.remind.routes ×2 (`TypeError: argument handler must be a function` @ pmo/decisions.routes.ts:128) | Test mockuje DecisionController tylko 4 metodami; routes rejestrują też `getCreatedTasks` (istnieje w realnym kontrolerze, DecisionController.ts:1413) → w mocku undefined | **mock-drift** (mock częściowy vs rozrośnięty router) |
| 13 | v8.execution.routes "lists active runs" | `getActiveRuns` wywoływane teraz z `(org, undefined)` — sygnatura rozszerzona o 2. parametr (filtr), asercja `toHaveBeenCalledWith(ORG)` stara | **mock-drift / stale asercja** |
| 14 | decision-management.spec (E2E) | Hardcoded `http://localhost:3005` + realne kredki właściciela; ignoruje `E2E_API_URL` → ECONNREFUSED; nieuruchamialny w jakimkolwiek CI | **env-drift** (spec przyspawany do lokalnego środowiska) |
| 15–20 | execution-center UI ×6 (status filters, portfolio health, view modes, kanban DnD, decisions tab, benefits handoff) | E2E pisany pod stary Execution Center; obecny `/execution` to ExecutionHub z tabami Summary/Rollout/Reporting/Management (potwierdzone snapshotem strony); `data-testid="status-filter-EXECUTING"` nie istnieje nigdzie w `src/`; handoff dodatkowo wchodzi w `/benefits`, które jest beta-closed (MODULE_BENEFITS) | **UI-drift** (martwe selektory) + beta-gating M15 |
| 21–23 | execution-center API ×3 (`/api/execution/stats`, `/escalations`, `/calendar`) | **REALNY FINDING:** Gateway montuje `/api/execution` z `routes/pmo/execution.routes.ts` (tylko `:projectId/summary|blockers|gate-check|health|action-queue`); stary `server/src/routes/execution.routes.ts` z `/stats /escalations /calendar` + częścią ExecutionController jest NIEZAMONTOWANY (martwy kod) → endpointy 404 | **stale route po przeniesieniu do podkatalogu** (znany wzorzec M13) — decyzja: przywrócić montaż albo wyciąć plik+testy |

## 3. Mapa pokrycia scenariuszy krytycznych S1–S7

PR-gate (patrz §4): na PR do `Londyn` **nic** nie biega; kolumna „CI" = co realnie wykonuje się gdziekolwiek (main/develop push, nightly, weekly).

| Scenariusz | FE | BE | E2E | CI | Luka |
|---|---|---|---|---|---|
| S1 Executive dashboard Health Score + snapshot | ✅ DashboardExecutionSnapshot (22), ExecutiveDashboard (2) | 🟡 v8ExecutionControlTowerService (2, mocki); endpoint `:projectId/health` bez testu | ❌ test istnieje, ale FAIL (martwe selektory) | 🟡 component-tests tylko push main/develop | brak testu BE health-score na danych; E2E martwy |
| S2 Widoki tabela/kanban/timeline + DnD status→trwałość | ❌ brak | ❌ brak (status update przez API inicjatyw, nietestowany z perspektywy M14) | ❌ kanban-DnD test FAIL (stale) | ❌ | **cały scenariusz bez działającego testu** |
| S3 Action Queue akcje→trwałość | ❌ brak | 🟡 managerActionExecutionService (9, serwis); endpoint `:projectId/action-queue` bez testu | ❌ | 🟡 | brak testu endpointu i FE |
| S4 RAID + Decisions create/edit→liczniki | 🟡 RAIDLog (2), DecisionBoard (2) — tylko render | ✅ r0-raid-scoring (7) + ~120 testów decyzji (unit+integration; 6 FAIL env/mock) | ❌ decision-management nieuruchamialny | 🟡 integration-tests biegnie na PR do main/develop | brak asercji liczników; brak E2E RAID |
| S5 Rollout Plan/KPI/Risks/Change/Closure→trwałość | 🟡 RolloutTab.smoke (4, 2 FAIL), RolloutPlanTab (11) | ❌ **`rollout.routes.ts` bez żadnego testu**; tylko executiveAggregateRolloutKpis (3, merge) | 🟡 deploy-gate smoke pokrywa KPI benefits/initiatives, nie `/api/rollout/*` | 🟡 nightly smoke | **backend rolloutu nietestowany** |
| S6 Raporty generacja z live-data | ❌ executionReports.ts / ReportCompactPanel / ReportDocumentView — zero testów | ❌ brak | ❌ | ❌ | **cały scenariusz bez testu** |
| S7 Manager people_change + AI panel | 🟡 PeopleChangeWorkspace (3 FAIL mock-drift), ManagerApproval.smoke (1) | ✅ managerActionExecutionService (9) + sąsiednie managerProblems/managerAi | ❌ | 🟡 | FE testy czerwone; brak E2E |

## 4. Co realnie gate'uje PR (CI)

- `test-suite.yml`: trigger **tylko** `push`/`pull_request` na `main`/`develop`. Default branch repo = `Londyn` → **typowy PR feat/* → Londyn nie uruchamia żadnego testu M14**.
- Nawet na PR do main/develop: joby `unit-tests`, `component-tests`, `e2e-tests` (Tier-0), `levels-coverage-gates`, `coverage` mają warunek „Deferred outside main/develop" (`github.ref_name == main|develop`) — na evencie PR ref to `NN/merge`, więc kroki są **skipowane** (job zielony, pr-gate przechodzi). Realnie na PR biegną: lint+typecheck, test-quality-check, skip-scan, **integration-tests** (3 shardy, z usługą Postgres — obejmują `tests/integration` z testami execution/decisions), security-integrity, readiness-smoke, patch-coverage.
- Tier-0 E2E i tak nie zawiera żadnego speca M14.
- `e2e-nightly.yml` (cron 3:00): cały `playwright.smoke.config` → **deploy-gate-api-execution-benefits-finance.spec.ts biega co noc** (u nas 21/21 PASS).
- `e2e-weekly.yml` (niedziela 3:30): pełny `playwright test` → execution-center.spec + decision-management.spec — **obecnie 10 FAIL co tydzień** (jeśli ktoś patrzy w wyniki).

## 5. Pułapki (testy, które nie testują zachowania)

1. **Routes-testy z pełnym mockiem serwisów** — `server/src/routes/v8/__tests__/execution.routes.test.ts` i `execution-control.routes.test.ts` mockują wszystkie serwisy (spine, registry, governance, risk, delay, budget, control-tower) → testują wiring/kontrakt, nie zachowanie. Koszt tego stylu widać w `decisions.remind.routes.test.ts`: częściowy mock kontrolera wywala cały plik po dodaniu jednej trasy.
2. **executionSpineService na zamockowanym DbPromise** — maszyna stanów i walidacja testowane bez SQL; żadnej prawdy o schemacie `execution_agent_runs` (a to spine S2/S3).
3. **Flaga v8 w testach zawsze ON** — routes-testy mockują `isV8Enabled: true`, podczas gdy produkcja wymaga jawnego wiersza flagi per-org (featureFlagService.ts:187-189). Testy pokrywają ścieżkę, której świeży tenant na prodzie nie ma; ścieżka flaga-OFF (odmowa/fallback) nietestowana.
4. **RolloutTab.smoke mockuje `Api`** — „trwałość" KPI sprawdzana tylko do poziomu payloadu POST; przy braku jakiegokolwiek testu `rollout.routes.ts` nikt nie sprawdza, że POST cokolwiek zapisuje.
5. **execution-center.spec.ts daje fałszywy sygnał „mamy E2E"** — 9/15 przypadków to martwe selektory/endpointy po przebudowie UI; w trackerach wygląda jak pokrycie S1/S2/S4.

## 6. Backlog testowy

| # | Prio | Typ | Plik docelowy | Scenariusz |
|---|---|---|---|---|
| 1 | P0 | integration BE | `tests/integration/routes/rollout.routes.test.ts` (nowy) | CRUD `/api/rollout/plan|kpis|risks|change|closure` + trwałość (sqlite/PG) — S5 |
| 2 | P0 | E2E (rewrite) | `tests/e2e/execution-center.spec.ts` | przepisać na ExecutionHub (taby Summary/Rollout/Reporting/Management); usunąć/naprawić martwe asercje `/api/execution/stats|escalations|calendar` po decyzji: re-mount `routes/execution.routes.ts` vs wycięcie martwego pliku |
| 3 | P0 | fix testu | `tests/integration/routes/decisions.remind.routes.test.ts` | mock DecisionController przez `importActual` + nadpisanie 1 metody (odporność na nowe trasy) |
| 4 | P0 | fix testu | `tests/e2e/decision-management.spec.ts` | `E2E_API_URL` + demo-login zamiast hardcoded `localhost:3005` i kredek właściciela |
| 5 | P1 | unit FE | `tests/unit/execution/executionReports.test.ts` (nowy) | `computeRAG` + budowa raportu z danych live (S6) |
| 6 | P1 | component FE | `tests/components/Execution/ExecutionManagementView.kanban.test.tsx` (nowy) | DnD/zmiana statusu → wywołanie API z poprawnym payloadem (S2) |
| 7 | P1 | integration BE | rozszerzyć `tests/integration/routes/execution.test.js` | `GET /:projectId/action-queue` + `GET /:projectId/health` (S3, S1) |
| 8 | P1 | fix testu | `tests/components/Execution/PeopleChangeWorkspace.communication.test.tsx` | wspólny helper mocka i18n obsługujący `t(key, {defaultValue})` (naprawia też wzorzec z M13) |
| 9 | P1 | fix testu / decyzja | `server/src/services/v8/__tests__/executionSpineService.test.ts` | dostosować do `.min(1)` albo przywrócić `.uuid()` w `CreateRunParamsSchema` (decyzja produktowa) |
| 10 | P1 | fix testu | `tests/integration/routes/v8.execution.routes.test.ts` | `toHaveBeenCalledWith(ORG, undefined)` po rozszerzeniu sygnatury `getActiveRuns` |
| 11 | P1 | fix testu | `src/components/Execution/__tests__/RolloutTab.smoke.test.tsx` | testować CTA przez ExecutionHub.menuCta albo przez handler `onRegisterCta` |
| 12 | P2 | E2E smoke | `tests/e2e/smoke/execution-rollout-happy-path.spec.ts` (nowy) | happy-path rollout (KPI add → widoczny) — wpięty w nightly |
| 13 | P2 | CI (systemowe) | `.github/workflows/test-suite.yml` | dodać `Londyn` do triggers, żeby PR-gate w ogóle działał (dotyczy wszystkich modułów, nie tylko M14) |
| 14 | P2 | unit BE | `server/src/services/__tests__/v8ExecutionControlTowerService.test.ts` | Health Score liczony na realnym sqlite zamiast mocków (S1) |

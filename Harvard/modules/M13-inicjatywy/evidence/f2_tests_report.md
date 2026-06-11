# M13 — Inicjatywy — FAZA 2 (TESTY) — Raport

- Data: 2026-06-11 (UTC ~08:56–09:03)
- Branch: `feat/deliverables-light` @ `bfdb999147`
- Runner: vitest v4.1.8 (FE/integ) + playwright (E2E, statyczny inwentarz)
- Środowisko DB: lokalny Postgres na :5432 = `iris` brak; odtworzono CI przez efemeryczny `postgres:15` (iris/iris_test) na :55432, `db:migrate --safe` (oraz próba `--strict`)
- Log surowy: `Harvard/modules/M13-inicjatywy/evidence/f2_tests.log`

---

## 1. Inwentarz testów M13

### FE — unit/component (vitest, domyślnie DB_TYPE=sqlite)
| Plik | Zakres | ~Testów |
|---|---|---|
| tests/unit/initiatives/* (8 plików) | validators, createFlow, proposeCandidates, proposalReconciliation, gateReadinessPayload, workflowStatus | ~63 |
| tests/unit/pmo/pmo-validators.test.ts | PMO walidatory | 25 |
| tests/unit/backend/initiatives/** (gen + validators) | generateSectionContent (json/lang/missing/noLLM/tokens), suggestSections, enrichContext, validators (date/enum/schema) | ~22 |
| tests/unit/backend/initiativeStatuses/** + statusMachine/** | gates, lifecycle, modules, labels/transitions, validationRules | ~40 |
| tests/unit/backend/initiative*/InitiativeService*.test | service unit (ts+legacy js) | ~24 |
| tests/unit/services/initiativeWriteTruth.test.ts | preflight write-truth | 3 |
| tests/components/PMO/** (14 plików) | CharterBuilder, GateStatus, PhaseIndicator, PMODashboard, RACIMatrix, WorkstreamBoard, StatusTransition, AuditTrail, CompletenessChecker, ProjectTeam, PMOStatusBanner, PhaseIndicator… | ~75 |
| tests/components/Portfolio/PortfolioView.test.tsx | portfolio view | 3 |
| tests/components/Initiatives/** | DocumentView fail-closed, Hub load-error | (collection) |
| tests/components/governance/** | Dashboard, Rules, Settings | 16 |
| tests/components/Results/** | ROI drawers, KPI, ResultsHub, summary | ~70 |
| tests/components/Roadmap*.test.tsx, FullRoadmapView | gantt/summary/redirect | ~6 |
| src/components/Initiatives/__tests__/** | InitiativesHub smoke, PortfolioAnalysisView smoke | ~8 |
| src/views/FullROIView + Results/ROIAnalysisView smoke | ROI smoke | ~10 |

### BE — server/src (vitest)
| Plik | Zakres | ~Testów |
|---|---|---|
| server/src/services/initiative/__tests__/** (6) | lifecycleCanon, forbiddenTransitions, accessResolver, wizardService | ~38 |
| server/src/routes/__tests__/initiatives-additive.routes.test.ts | suggested-changes / propose | 11 |
| server/src/routes/__tests__/initiative-generator.routes.test.ts | POST /generate (persist draft) | 5 |
| server/src/routes/__tests__/initiative-controller-interview-insight.test.ts | insight→initiative | 2 |
| server/src/routes/__tests__/initiatives-crud.test.ts | CRUD routes | **0 (broken import)** |
| server/src/services/__tests__/initiativeSectionTypeService.test.ts | section types | 2 |
| server/src/services/v8/__tests__/resultsROIService.test.ts | ROI/KPI/reconciliation v8 | 93 |
| server/src/services/v8/__tests__/executionSpineService.initiative-scope.test.ts | initiative scope | 2 |
| server/src/services/v8/__tests__/integration/t2-flows/initiativeLifecycleFlow.test.ts | lifecycle flow | 2 |
| server/src/services/v8/__tests__/planningPortfolioReadService.support-tables.test.ts | portfolio read | 6 |

### Integration (vitest, tests/integration — wymaga PG w CI)
initiatives/{generate-section, suggest-sections, readiness-analysis, section-types, ai-generation.unavailable}; initiatives.test.js; routes/{initiatives, initiative-generator, pmo, pmo.initiatives.fail-closed, pmo-analysis, roadmap, governance}.

### E2E (playwright, statyczny inwentarz — NIE uruchamiane)
| Spec | ~Testów | Gate |
|---|---|---|
| smoke/tier0-initiative-create.spec.ts | 1 | **PR-gate (tier0)** — ale za guardem main/develop |
| smoke/pmo-workflow-role-sweep.spec.ts | 44 | nightly/weekly |
| smoke/interview-initiative-wizard.spec.ts | 2 | nightly/weekly |
| smoke/initiatives-ai-language.spec.ts | 2 | nightly/weekly |
| initiatives-roadmap.spec.ts | 30 | nightly/weekly |
| assessment-initiatives.spec.ts | 23 | nightly/weekly |
| journeys/onboarding-roadmap-initiative.spec.ts | 10 | nightly/weekly |
| initiatives/ai-comments-proposals + ai-cta-spinner | 1+1 | nightly/weekly |
| tools-to-initiatives.spec.ts | 1 | nightly/weekly |
| governanceFlow.spec.ts | 5 | nightly/weekly |

> Uwaga: `tests/unit/backend/services/pmo-*.test.db` (≈180 plików) to **artefakty SQLite** (leftover), NIE testy — nie pasują do glob `.{test,spec}.{js,ts,jsx,tsx}`, nie biegną.

---

## 2. Wyniki uruchomień (PASS/FAIL/SKIP)

| Grupa | Komenda (skrót) | Pliki | Testy | Wynik | Czas |
|---|---|---|---|---|---|
| A — unit (initiatives/pmo/status/gen/validators) | `vitest run tests/unit/initiatives tests/unit/pmo tests/unit/backend/{initiatives,initiativeStatuses,statusMachine,initiative} …` | 42 | 188 | **188 PASS** | 13s |
| B — BE server/src (initiative + v8) | `vitest run server/src/services/initiative server/src/routes/__tests__/initiative* server/src/services/v8/…` | 13 | 160 | **156 PASS / 4 FAIL / +1 plik collection-fail** | 12s |
| C — component (PMO/Portfolio/Init/gov/roadmap/Results) | `vitest run tests/components/{PMO,Portfolio,Initiatives,governance,Results} … src/components/Initiatives …` | 35 | 189 | **178 PASS / 9 FAIL / 2 SKIP (6 plików fail)** | 35s |
| D — integration (sqlite, DB lokalny brak roli iris) | `vitest run tests/integration/initiatives tests/integration/routes/{…}` | — | — | duże FAIL (env: rola `iris` nie istnieje) | 36s |
| D-REAL — integration vs efemeryczny postgres:15 (--safe) | `DB_TYPE=postgres DATABASE_URL=…:55432 vitest run tests/integration/…` | 13 | — | initiatives.test.js/pmo/governance/pmo-analysis/initiative-generator **PASS**; route-inicjatyw 503/401 nadal FAIL | 40s |

**Razem stabilnie zielone (unit+component+BE bez znanych braków): ~520 testów PASS.**

---

## 3. Awarie — klasyfikacja (root-cause)

### A. Mock-drift `react-i18next` (TEST-BUG, systemowy) — 4 pliki
`No "initReactI18next" export is defined on the "react-i18next" mock`.
- tests/components/Initiatives/InitiativeDocumentView.fail-closed.errors.contract.test.tsx (collection → 0 testów)
- tests/components/Initiatives/InitiativesHub.load-error-state.test.tsx (collection → 0 testów)
- src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx (1 fail — `Generate with Teresa` nie znaleziony, pochodna i18n)
- (ten sam wzorzec dotyka render z UnifiedChatPanel → i18n.ts:68)
> Mock `react-i18next` w setup/teście nie eksportuje `initReactI18next` — komponenty zaczęły importować ten symbol; mock nie nadążył.

### B. Broken import — stale path (TEST-BUG/martwy test) — 1 plik
`server/src/routes/__tests__/initiatives-crud.test.ts` importuje `../initiatives.routes.js`, plik **nie istnieje** (CRUD routes przeniesione do `server/src/routes/pmo/initiatives.routes.ts` w commit `ecee8c2dc5`). Suite = 0 testów (collection-fail).

### C. Mock-drift `notificationService.send` (TEST-BUG) — 4 testy
`resultsROIService.test.ts > resolveReconciliation*` — serwis `resultsROIService.ts:56` importuje `send as sendNotification` z `../notificationService.js`; test NIE deklaruje `vi.mock` dla notificationService → ścieżka resolveReconciliation wybucha na `send`. 89/93 testów w pliku przechodzi.

### D. Mock-drift `getTableColumns` (TEST-BUG) — 3 testy
`tests/components/controllers/InitiativeController.test.ts` — mock `../../../server/src/utils/queryHelpers.js` nie eksportuje `getTableColumns`; dodatkowo kontrakt błędu rozjechany: test oczekuje `{ error: 'Initiative not found' }`, kod zwraca `{ code: 'INITIATIVE_NOT_FOUND', … }` (controller zaktualizowany, test nie).

### E. Assertion-drift PhaseIndicator (TEST-BUG) — 3 testy
`tests/components/PMO/PhaseIndicator.test.tsx` — oczekiwane klasy `text-purple-500` / `.bg-purple-500/10`; render daje `text-primary-500 dark:text-primary-400`. Komponent przeszedł na tokeny `primary-*`, test ma zahardkodowane stare kolory.

### F. ResultsHub runtime-strip (do potwierdzenia, 2 testy)
`tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx:517/543` timeout `waitFor` — prawdopodobnie zależne od danych runtime; pozostałe 11/15 w pliku PASS.

### G. Integration — schema drift migracji (ENV/MIGRACJA, NIE product-bug w pewnym zakresie)
Nawet przeciw realnemu PG z `--safe`:
- `llm_providers.priority` brak kolumny → test „503 FEATURE_UNAVAILABLE" dostaje **500** (DB error zamiast honest-503).
- `roadmap_waves` relation brak → `/api/roadmap/:id/waves|summary` = 500 (2 testy roadmap).
- `user_sessions` relation brak → kontekst auth pada → 401/403 mismatch w generate-section/suggest-sections/readiness/section-types.
- `--strict` migrate **przerywa się** na `20260508_block_c_ai_operator.sql` (`functions in index expression must be marked IMMUTABLE` na postgres:15) → roadmap_waves/user_sessions/llm_providers.priority nadal nieobecne.
> Wniosek: M13-integration **nie jest odtwarzalny lokalnie** ani pod `--safe`, ani pod `--strict` na czystym `postgres:15`. CI (`integration-tests` job, `db:migrate:strict`) musi mieć inne warunki (pełny zestaw migracji przechodzi tam) — do potwierdzenia czy CI faktycznie zielone na tych testach na main/develop.

---

## 4. Mapa pokrycia 6 scenariuszy

| Scenariusz | FE | BE | E2E | Status pokrycia |
|---|---|---|---|---|
| **S1** Portfolio→preview→dokument | PortfolioView.test, PortfolioAnalysisView.smoke, InitiativesHub.smoke | planningPortfolioReadService.support-tables (PASS) | initiatives-roadmap.spec, assessment-initiatives.spec | **Pokryte** (FE smoke + BE read); brak jawnego „preview→dokument" e2e click-through w PR-gate |
| **S2** create via `?new=1`→trwałość | InitiativesHub.smoke (część fail i18n), initiativeCreateFlow.test (PASS) | initiatives-crud.test **BROKEN**, initiatives.routes.test (real PG: PASS) | tier0-initiative-create.spec (1, deferred) | **Częściowo** — deep-link `?new=1` trwałość NIE ma dedykowanego zielonego testu; CRUD-route unit martwy |
| **S3** dokument ~30 sekcji: edit RAID/KPI→reload→trwałość | initiativeSectionTypeService, generateSectionContent unit (PASS) | initiatives.section-types/generate-section (FAIL na env-schema) | — | **Słabe** — brak E2E edit-sekcji→reload; integ blokowane schema drift; jednostkowo gen OK |
| **S4** Analysis (graf/feasibility/completeness)→realne dane | PortfolioAnalysisView.smoke (PASS), InitiativeCompletenessChecker (PASS), gateReadinessPayload (PASS) | readiness-analysis.test (FAIL env), executionSpine initiative-scope (PASS) | — | **Częściowo** — completeness/feasibility unit OK; readiness-analysis integ blokowany env |
| **S5** Charter wizard z insightu→generacja | CharterBuilder.test (6 PASS) | initiativeWizardService (PASS), initiative-controller-interview-insight (PASS), aiCharterGeneratorService (unit) | interview-initiative-wizard.spec (2, nightly) | **Pokryte** (najlepsze pokrycie z całości) |
| **S6** Kanban DnD + archive/status (writeTruth preflight) | StatusTransitionDropdown (PASS), initiativeWriteTruth.test (3 PASS), initiativeWorkflowStatus (PASS) | forbiddenTransitions (22 PASS), initiativeLifecycleCanon (11 PASS), statusMachine (PASS) | pmo-workflow-role-sweep.spec (44, nightly) | **Pokryte** (status/transitions mocne); brak jawnego DnD-drop e2e w PR-gate |

### Pułapka CI (potwierdzona)
- `test-suite.yml`: `on.push/pull_request` tylko `[main, develop]` + `workflow_dispatch`. Na **`feat/deliverables-light` cały workflow się NIE uruchamia z push** (branch poza listą).
- Joby `unit-tests`, `component-tests`, `integration-tests`, `e2e-tests (Tier-0)`, `levels-coverage-gates` mają step **„Deferred outside main/develop"** + wszystkie kroki za `if: workflow_dispatch || ref==main || ref==develop`. → na `feat/*` te joby są no-op nawet gdyby workflow wystartował.
- **Jedyny initiative-E2E w PR-gate**: `tier0-initiative-create.spec.ts` (via `test:e2e:tier0`) — i tak deferred poza main/develop.
- Reszta initiative-E2E (pmo-role-sweep 44, roadmap 30, assessment 23, onboarding-journey 10, ai-language, wizard) tylko **nightly** (`e2e-nightly.yml` cron `0 3 * * *`, cały `playwright.smoke.config.ts`) i **weekly** (`e2e-weekly.yml` cron `30 3 * * 0`).
- **Potwierdzenie UWAGI z brief: na `feat/*` initiative testy (unit/component/integration/e2e) NIE biegną w CI** — ani jako trigger, ani jako deferred-step. Walidacja M13 na tym branchu = wyłącznie lokalna.

---

## 5. Backlog testowy (braki — TOP)

| # | Typ | Plik / miejsce | Scenariusz | Priorytet |
|---|---|---|---|---|
| 1 | Naprawa mock-drift i18n | tests/setup.ts / mock `react-i18next` (dodać `initReactI18next`) | S1/S2 (odblokowuje 4 pliki Initiatives) | **P0** |
| 2 | Martwy test / stale import | server/src/routes/__tests__/initiatives-crud.test.ts → `../pmo/initiatives.routes.js` lub usunąć | S2 (CRUD trwałość) | **P0** |
| 3 | Mock-drift notificationService | resultsROIService.test.ts — dodać `vi.mock('../notificationService.js', () => ({ send: vi.fn() }))` | S4/Results | **P1** |
| 4 | Mock-drift queryHelpers + kontrakt błędu | tests/components/controllers/InitiativeController.test.ts — `getTableColumns` + `{code:'INITIATIVE_NOT_FOUND'}` | S1/S2 | **P1** |
| 5 | Assertion-drift kolory | tests/components/PMO/PhaseIndicator.test.tsx — `text-purple-500`→`text-primary-500` | S5/PMO | **P2** |
| 6 | Migracje nieodtwarzalne lokalnie | `db:migrate:strict` pada na `20260508_block_c_ai_operator.sql` (IMMUTABLE); brak roadmap_waves/user_sessions/llm_providers.priority | S3/S4 integ | **P1** (blokuje całe integ M13 lokalnie) |
| 7 | Brak E2E PR-gate dla M13 | dodać lekki tier0 dla `?new=1` trwałość + section edit→reload | S2/S3 | **P2** |
| 8 | ResultsHub runtime-strip flaky/timeout | ResultsHub.v8-runtime-strip.test.tsx:517/543 | S4 | **P2** |
| 9 | Brak DnD-drop e2e w gate | Kanban status DnD tylko w pmo-role-sweep (nightly) | S6 | **P3** |

---

## 6. Evidence
- Log: `Harvard/modules/M13-inicjatywy/evidence/f2_tests.log`
- Raport: `Harvard/modules/M13-inicjatywy/evidence/f2_tests_report.md`

# M10 — Wywiad (Interview/Discovery) — FAZA 2: TESTY

Agent: TESTY (Protokół Audytu Harvard V1)
Data: 2026-06-11
Branch: `feat/deliverables-light` · node v24.12.0
Środowisko: vitest (FE/integ + server) — uruchomione realnie. Playwright E2E — zinwentaryzowane i skolekcjonowane (`--list`), **nie uruchomione** (wymagają zbudowanej aplikacji + serwerów + `TEST_SUPPORT_KEY` + zaseedowanej bazy — poza zakresem tego przebiegu).
Evidence log: `Harvard/modules/M10-wywiad/evidence/f2_tests.log`

---

## 1. Inwentarz testów M10

### FE — component / smoke / store (`tests/components`, `src/**/__tests__`, `tests/unit/store`, `tests/unit/services`)
| Plik | Zakres | Testy |
|---|---|---|
| `src/components/Interview/__tests__/InterviewHub.smoke.test.tsx` | Hub render/smoke | 5 |
| `src/components/Interview/__tests__/TemplateBuilder.smoke.test.tsx` | Builder szablonu (S1) | 5 |
| `src/components/DiscoveryTools/__tests__/genericDomainStep.smoke.test.tsx` | Discovery domain step | 4 |
| `src/components/DiscoveryTools/__tests__/toolCanvas.smoke.test.tsx` | Discovery canvas | 2 |
| `tests/components/Interview/InterviewHub.test.tsx` | Hub + tab resolver | 3 |
| `tests/components/Interview/InsightCreatorModal.context-documents.test.tsx` | InsightCreator: context docs (S5) | 1 |
| `tests/components/Interview/InsightCreatorModal.error-state.test.tsx` | InsightCreator: error/scope (S5) | 3 |
| `tests/components/Interview/InsightPackView.p10-alignment.test.tsx` | Insight pack P10 (S5) | 26 |
| `tests/components/Interview/InsightViewer.p10-handoff.test.tsx` | InsightViewer status/handoff (S5) | 7 |
| `tests/components/Interview/interview-barrel-exports.test.ts` | Eksporty barrel (modale assign, S2) | 1 |
| `tests/components/Interview/interviewErrorCopy.test.ts` | i18n copy błędów | 2 |
| `tests/components/Discovery/DiscoveryCanvas.test.tsx` | Discovery canvas | 6 |
| `tests/components/Discovery/DiscoveryConsultantView.test.tsx` | Discovery widok konsultanta | 4 |
| `tests/components/Discovery/nodes/InsightNode.test.tsx` | Node insightu | 7 |
| `tests/components/Discovery/nodes/PainPointNode.test.tsx` | Node pain point | 8 |
| `tests/components/discovery-tools/StrategicToolsView.artifact-query.contract.test.tsx` | Kontrakt artifact-query | (w bloku) |
| `tests/unit/store/useDiscoveryStore.test.ts` | Store Discovery | 15 |
| `tests/unit/services/v8-interview-api.test.ts` | Klient API v8 interview (S1/S3/S4/S5) | 34 |

### BE — server unit/route/service (`server/src/**/__tests__`, `tests/unit/backend`)
| Plik | Zakres | Testy |
|---|---|---|
| `server/src/routes/v8/__tests__/interview.routes.test.ts` | Routy v8 interview (insights, sesje, mutacje) | 49 |
| `server/src/routes/v8/__tests__/p10-interview-insight-canon.test.ts` | Kanon P10 insightów | 55 |
| `server/src/routes/v8/__tests__/interview-insights.routes.test.ts` | Routy insightów | 9 |
| `server/src/routes/__tests__/initiative-controller-interview-insight.test.ts` | Insight→inicjatywa (S6) | 2 |
| `server/src/services/__tests__/interviewManagerScope.test.ts` | Scope managera | 4 |
| `server/src/services/v8/__tests__/interviewInsightAnalysisService.test.ts` | Analiza insightów (S5) | 2 |
| `server/src/services/v8/__tests__/interviewInsightCandidateService.test.ts` | Kandydaci insightów (S5) | 5 |
| `server/src/services/v8/__tests__/interviewInsightFindingsService.test.ts` | Findings (S5) | 6 |
| `tests/unit/backend/controllers/InterviewAssignmentsController.test.ts` | Kontroler przydziałów (S2) | 7 |
| `tests/unit/backend/routes/interview.routes.org-guard.test.ts` | Org-guard routów | 1 |
| `tests/unit/backend/services/interviewInsightReportPackService.test.ts` | Report pack (S5) | 18 |
| `tests/unit/backend/services/interviewInsightService.lineage.test.ts` | Lineage insightów (S5) | 9 |
| `tests/unit/backend/services/interviewInsightService.lineage-read.test.ts` | Lineage read (S5) | 2 |
| `tests/unit/backend/services/taskAssignmentService.assignTask.test.ts` | Przydział zadań (S2) | 5 |
| `tests/unit/backend/services/taskAssignmentService.overdue.test.ts` | Zaległe przydziały (S2) | 10 |

### Integracja (`tests/integration`)
| Plik | Zakres | Testy |
|---|---|---|
| `tests/integration/interview/interview-routes.test.ts` | Auth-guardy routów (SQLite, MOCK_DB=false self-set) | 6 |
| `tests/integration/routes/v8Interview.contextDocuments.test.ts` | Context-documents routy (mockowane) | 3 |

### E2E (`tests/e2e`, `tests/e2e/smoke`)
| Plik | Zakres | Testy | Config |
|---|---|---|---|
| `tests/e2e/interview.spec.ts` | UI hub/tabs + API full workflow (S1/S2/S3) — w tym create→start→answer→submit→approve | 9 | `playwright.config.ts` (default → **weekly only**) |
| `tests/e2e/smoke/deploy-gate-api-interview.spec.ts` | API sesje/pytania CRUD + 403-guardy (S2/S3) | 20 | `playwright.smoke.config.ts` (→ **nightly Tier-1 / L4 remote**) |
| `tests/e2e/smoke/interview-initiative-wizard.spec.ts` | Wizard Interview→Inicjatywa, candidate gen, triage, draft→approval+refresh (S6) | 2 | `playwright.smoke.config.ts` (→ **nightly Tier-1 / L4 remote**) |

**Suma zinwentaryzowana:** 38 plików, ~333 testy (302 vitest + 31 E2E).

---

## 2. URUCHOMIENIE — wyniki PASS/FAIL/SKIP

| Blok | Komenda (skrót) | Pliki | Testy | PASS | FAIL | SKIP | Czas |
|---|---|---|---|---|---|---|---|
| 1 FE/component/store | `vitest run tests/components/{Interview,Discovery} src/**/__tests__ tests/unit/{store,services}` (MOCK_DB) | 18 | 109 | 103 | 6 | 0 | ~22s |
| 2 server route/service | `cd server && vitest run src/routes/v8/__tests__/interview* …` (MOCK_DB) | 8 | 132 | 130 | 2 | 0 | ~4s |
| 3 root-config backend | `vitest run tests/unit/backend/{controllers,routes,services}/…` (MOCK_DB) | 7 | 52 | 51 | 1 | 0 | ~5s |
| 4 integracja | `vitest run tests/integration/interview/… tests/integration/routes/v8Interview…` | 2 | 9 | 9 | 0 | 0 | ~11s |
| 5 E2E | `playwright … --list` (kolekcja) | 3 | 31 | — | — | — | — (NIE URUCHOMIONE) |

**EXECUTED RAZEM: 35 plików · 302 testy → 293 PASS · 9 FAIL · 0 SKIP.**
**E2E: 3 pliki · 31 testów → kolekcja OK, wykonanie pominięte (wymaga build+serwery+seed).**

### 9 FAILi (root cause)
1. **FE-2 (krytyczny, 26 testów stracone)** `InsightPackView.p10-alignment.test.tsx` — `Failed to resolve import "@/components/Interview/InsightPackView"`. Komponent usunięty/zmieniony nazwą; cały plik nie ładuje się → **26 testów S5 nieaktywnych**.
2. **FE-1** `InterviewHub.test.tsx` — `Cannot destructure 'resolveInterviewTabFromSearchParams' of '__private__'` (undefined). Test odwołuje się do nieaktualnego eksportu `__private__` po refaktorze Hub.
3. **FE-4** `interview-barrel-exports.test.ts` — `ManageAssignmentModal` = `undefined`. Drift barrela `components/Interview/index` (S2).
4. **FE-3** `DiscoveryConsultantView.test.tsx` — mock `react-i18next` bez `initReactI18next` → cały suite pada na ładowaniu (stale mock).
5. **FE-5** `InsightViewer.p10-handoff.test.tsx` — `'Published'` badge nie renderuje się (waitFor timeout). 1 z 7.
6. **FE-6** `InsightCreatorModal.context-documents.test.tsx` — wybrane `context document ids` nie trafiają do submitu (S5).
7. **FE-7/8** `InsightCreatorModal.error-state.test.tsx` — (2) governed analysis scope nie wysyłany; brak retryowalnego błędu ładowania zamiast „brak sesji".
8–9. **BE-1/2** `interview.routes.test.ts` — `PATCH /api/v8/interview/insights/:id` zwraca **404** zamiast 200 (update) i 400 (no fields) **pod MOCK_DB**. Prawdopodobnie luka mocka routingu, nie potwierdzony bug prod.
10. **BE-3** `interviewInsightReportPackService.test.ts` — edycja report-packa nie utrwala `worksheets` (`[]` vs oczekiwane executive_summary itd.).

> Uwaga: FE-2/FE-1/FE-3/FE-4 to **stale tests vs refaktor M10** (przesunięte/usunięte moduły) — sygnał driftu między testami a kodem, do potwierdzenia czy regresja czy zaległe testy.

---

## 3. Mapa pokrycia 6 scenariuszy

| Scenariusz | FE (component/unit) | BE (unit/route/service) | E2E | Status |
|---|---|---|---|---|
| **S1** szablon create→pytania→publish draft→approved→trwałość | `TemplateBuilder.smoke` (5), `v8-interview-api` (część) | `interview.routes` (template/status) | `interview.spec` UI + API | **Częściowy** — trwałość draft→approved nie pokryta unit-owo; pełny cykl tylko w E2E (nie uruchamiany w PR) |
| **S2** przydział (AssignInterviewModal)→inbox assignee | `interview-barrel-exports` (FAIL — modal undefined), `v8-interview-api` | `InterviewAssignmentsController` (7), `taskAssignmentService` (15) | `deploy-gate-api-interview` (assignments/my, counts) | **Dobry BE**, **FE zepsuty** (barrel drift); pełny inbox-flow tylko E2E |
| **S3** sesja start→odpowiedzi (single_question/task_list)→submit→trwałość | `v8-interview-api` (API klient) | route-level w `interview.routes` | `interview.spec` (full workflow), `deploy-gate-api-interview` (session/question CRUD) | **Luka unit**: brak testu runtime `single_question`/`task_list` (`InterviewSingleQuestionRuntime`); trwałość submitu tylko E2E |
| **S4** wywiad konwersacyjny AI→parse transkryptu→draft answers→review | `v8-interview-api` (część) | **BRAK** dedykowanego testu `interviewInferenceService.ts` / `interviewTranscriptService.ts` | brak | **Najsłabszy** — logika parse/inference bez unit-testów; tylko `smoke-v6-interview.ts` (skrypt, nie w CI) |
| **S5** generacja wniosków (inference)→InsightViewer evidence+material_quality→workflow statusów | `InsightViewer.p10-handoff` (1 FAIL), `InsightCreatorModal.*` (3 FAIL), `InsightPackView` (cały suite FAIL na imporcie), `InsightNode` | `interviewInsight{Analysis,Candidate,Findings}Service`, `interviewInsightService.lineage`, `interviewInsightReportPackService` (1 FAIL), `p10-...-canon` (55) | `deploy-gate-api-interview` (pośrednio) | **Najszerzej pokryty BE**, ale **FE w rozpadzie** (4+ faili, 26 utraconych testów); `material_quality` asercje są w report-pack/lineage/routes, brak bezpośredniego testu generatora `material_quality` w `interviewInferenceService` |
| **S6** generacja inicjatywy `generate_from_evidence` | `InterviewHub` (entrypoint, FAIL) | `initiative-controller-interview-insight` (2) | `interview-initiative-wizard.spec` (wizard, candidate gen, draft→approval+refresh) | **Częściowy** — happy-path w 1 BE-teście + E2E (nightly); brak unit dla pełnego `generate_from_evidence` |

---

## 4. Pułapka CI (gating)

**Wszystkie jobsy testowe w `.github/workflows/test-suite.yml` triggerują się TYLKO na push/PR do `main`/`develop`** (`on: push/pull_request: branches: [main, develop]`). Na branchu `feat/deliverables-light`:
- Workflow **w ogóle się nie uruchamia** (branch nie pasuje do triggera) — chyba że ręcznie `workflow_dispatch`.
- Dodatkowo każdy job (`unit-tests`, `component-tests`, `integration-tests`, `e2e-tests` Tier-0, `levels-coverage-gates`, `critical-path-coverage`, `patch-coverage`) ma krok **„Deferred outside main/develop"** — `if: workflow_dispatch || ref_name == main || develop`. **Potwierdzone dla testów interview**: leżą w `tests/unit/**`, `tests/components/**`, `tests/integration/**`, więc na `feat/*` **NIE BIEGNĄ**.

**Gdzie biegają poszczególne testy M10:**
| Test M10 | PR-gate (Tier-0) | nightly | weekly | uwaga |
|---|---|---|---|---|
| unit/component/integration (vitest) | **NIE na feat/***; tak na main/develop | — | — | deferred poza main/develop |
| E2E `interview.spec.ts` | NIE (nie w `test:e2e:tier0`) | NIE | **TAK** (`e2e-weekly.yml`, default config, cron `30 3 * * 0`) | |
| E2E `deploy-gate-api-interview.spec.ts` | NIE (poza listą tier0) | **TAK** (`e2e-nightly.yml`, smoke config, cron `0 3 * * *`); też L4-remote (non-PR) | TAK | |
| E2E `interview-initiative-wizard.spec.ts` | NIE | **TAK** (nightly smoke) + L4-remote | TAK | |

**Wniosek:** żaden test M10 nie jest **PR-blokujący** (tier0 PR-gate = login/pages-render/sidebar/settings/core-workflows/initiative-create — bez interview). Najmocniejsze pokrycie E2E (CRUD sesji, wizard) jest **nightly/weekly**, więc regresje wykrywane są z opóźnieniem ≤24h (nightly) / ≤7 dni (weekly), nie na PR.

---

## 5. Backlog testowy (braki — TOP)

| # | Brak | Typ | Plik docelowy | Scenariusz | Priorytet |
|---|---|---|---|---|---|
| 1 | `InsightPackView.p10-alignment` nie ładuje się (import martwy) — 26 testów S5 wyłączonych | Napraw/usuń stale | `tests/components/Interview/InsightPackView.p10-alignment.test.tsx` | S5 | **P0** |
| 2 | Brak unit-testu parsera transkryptu + inference | Nowy unit | `server/src/services/__tests__/interviewTranscriptService.test.ts`, `interviewInferenceService.test.ts` | S4 | **P0** |
| 3 | `interview-barrel-exports` FAIL (`ManageAssignmentModal` undefined) | Napraw barrel/test | `tests/components/Interview/interview-barrel-exports.test.ts` + `components/Interview/index` | S2 | **P1** |
| 4 | `InterviewHub.test` FAIL (`__private__` drift) | Napraw stale test | `tests/components/Interview/InterviewHub.test.tsx` | S6/nav | **P1** |
| 5 | `DiscoveryConsultantView` mock i18n stale (cały suite pada) | Napraw mock | `tests/components/Discovery/DiscoveryConsultantView.test.tsx` | S5 (discovery) | **P1** |
| 6 | `InsightCreatorModal` context-docs + error-state (3 FAIL) | Napraw kod/test | `tests/components/Interview/InsightCreatorModal.*.test.tsx` | S5 | **P1** |
| 7 | PATCH insights 404 pod MOCK_DB (2 FAIL) — zweryfikować czy bug routingu czy luka mocka | Diagnoza + fix | `server/src/routes/v8/__tests__/interview.routes.test.ts` | S5 | **P1** |
| 8 | Report-pack nie utrwala `worksheets` przy edycji | Diagnoza + fix | `interviewInsightReportPackService` (kod+test) | S5 | **P1** |
| 9 | Brak unit dla runtime odpowiedzi `single_question`/`task_list`→submit→trwałość | Nowy unit/integ | `tests/unit/.../InterviewSingleQuestionRuntime` + service | S3 | **P1** |
| 10 | Brak bezpośredniego testu generacji `material_quality` (role_coverage/department_coverage) — istotne wg notatki o crashu InsightViewer przy partial material_quality | Nowy unit | `server/src/services/__tests__/interviewInferenceService.materialQuality.test.ts` | S5 | **P1** |
| 11 | Brak unit dla `generate_from_evidence` (tylko E2E nightly + 1 controller test) | Nowy unit | `server/src/services/.../generateFromEvidence.test.ts` | S6 | **P2** |
| 12 | Trwałość szablonu draft→approved (publish persist) niepokryta unit-owo | Nowy unit/integ | service szablonów | S1 | **P2** |
| 13 | Żaden E2E interview w PR-gate (tier0) — flow create→start→answer→submit→approve łapany dopiero nightly/weekly | Dodać do gate | `package.json` `test:e2e:tier0` + `.github/workflows/test-suite.yml` | S2/S3 | **P2** |
| 14 | Integracja interview pokrywa tylko 401-guardy (brak realnego CRUD na DB w PR) | Rozszerz integ | `tests/integration/interview/interview-routes.test.ts` | S1–S3 | **P2** |

---

## 6. Ścieżki evidence
- Log przebiegu: `Harvard/modules/M10-wywiad/evidence/f2_tests.log`
- Raport: `Harvard/modules/M10-wywiad/evidence/f2_tests_report.md`

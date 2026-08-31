---
doc_id: funkcje-kontrakt-kart-kpi-okr-roi
status: canonical
owner: piotr
truth_type: design
established: 2026-08-31
---

# Kontrakt kart KPI, OKR i ROI

Pomiar na markerze `8a224541f4` (FIX-199 przeliczenie; poprzedni marker `60581ed6b5`
z dyżuru 199 miał 19/30 fałszywych numerów tras + 11 złych definicji — odbiór
198+199, `docs/program/funkcje/ODBIOR_198_199.md`). Kontrakt opisuje zamontowane
komponenty i realne trasy. Wspólna koperta backendu to `ApiGateway` oraz
`requireResultsInternalBetaVisibility`; montaże są w `server/src/Gateway.ts:1233-1286`.
Karta KPI używa `NModeShell` z `ArtifactRightPanel`, natomiast OKR i ROI używają
`StandardModuleBar`; to jawna niespójność inwentarzowa, nie zakres naprawy tego
dyżuru. Rejestry nie obsługują podwójnego kliknięcia. OKR i ROI zachowują
`window.location.search` w nawigacji do karty, KPI polega na mechanizmie flagi w
`resultsVNextFeatureFlags.ts:126-134`.

**Wszystkie numery linii poniżej pochodzą wyłącznie z komend w sekcji
„Jak odtworzyć numery" — żaden nie jest ręcznie przepisany z poprzedniej wersji
tego dokumentu.** Kolumny „Trasa API"/„Rejestracja trasy" pochodzą z komendy 1
(dopasowanie po ŚCIEŻCE, nie po kolejności w pliku); kolumna „Definicja w
kodzie" pochodzi z komendy 2 (dopasowanie po identyfikatorze sekcji/zakładki).

## KPI — 8 z 8 sekcji

| # | Sekcja (id + etykieta PL) | Definicja w kodzie | Trasa API | Rejestracja trasy | Wołacz we froncie | Tabele źródłowe | Stan pusty | Stan błędu | Werdykt |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | `performance` — Wynik | `KpiToolPage.tsx:605` | `GET /api/vnext/results/kpi/:kpiId`; `GET /api/vnext/results/kpi/:kpiId/measurements` | `kpi.routes.ts:524,1000`; `Gateway.ts:1260` | `kpiApi.ts:getKpi,listKpiMeasurements` | `rvn_kpi_definitions`, `rvn_kpi_measurements` | „Brak pomiaru”; żadnego zmyślonego zera | błąd KPI zatrzymuje kartę; błąd pomiaru daje brak wartości | SPIĘTA |
| 2 | `contract` — Kontrakt definicji | `KpiToolPage.tsx:665` | `GET /api/vnext/results/kpi/:kpiId/version` | `kpi.routes.ts:552`; `Gateway.ts:1260` | `kpiApi.ts:getKpiCurrentDefinitionVersion` | `rvn_kpi_definitions`, `rvn_kpi_definition_versions` | komunikat o braku widocznej wersji + pola root KPI | komunikat o nieudanym odczycie wersji | SPIĘTA |
| 3 | `measurements` — Pomiary | `KpiToolPage.tsx:729` | `GET /api/vnext/results/kpi/:kpiId/measurements` | `kpi.routes.ts:1000`; `Gateway.ts:1260` | `kpiApi.ts:listKpiMeasurements`; `ResultsKpiMeasurementsPanel.tsx` | `rvn_kpi_measurements` | stan pusty panelu pomiarów | stan błędu panelu | SPIĘTA |
| 4 | `deviations` — Sprawy odchyleń | `KpiToolPage.tsx:743` | `GET /api/vnext/results/kpi/deviation-cases?kpiId=:kpiId` | `kpiDeviation.routes.ts:292`; `Gateway.ts:1244` | `kpiDeviationApi.ts:listDeviationCases` | `rvn_kpi_deviation_cases` | „Brak spraw odchyleń” | obecnie błąd jest redukowany do pustej listy | SPIĘTA_CZĘŚCIOWO — brak odrębnego błędu |
| 5 | `correctiveActions` — Działania korygujące | `KpiToolPage.tsx:797` | brak agregatu per KPI; istnieje tylko `GET /api/vnext/results/kpi/deviation-cases/:caseId/corrective-actions` | `kpiDeviation.routes.ts:542`; `Gateway.ts:1244` | tylko link do podwidoku sprawy (stan budowany client-side z odpowiedzi `addCorrectiveAction`/`updateCorrectiveAction`, nigdy z GET) | `rvn_kpi_corrective_actions` | „Brak otwartych spraw…” | brak osobnej obsługi | DO_ZBUDOWANIA |
| 6 | `initiatives` — Inicjatywy wpływające na KPI | `KpiToolPage.tsx:836` | `GET /api/vnext/results/kpi/:kpiId/initiative-impacts` | `kpiPerspectives.routes.ts:476`; `Gateway.ts:1259` | `kpiInitiativeImpactApi.ts:listInitiativeImpactsForKpi` | `rvn_kpi_initiative_impacts`, `initiatives` | „Brak powiązanych inicjatyw” | obecnie błąd jest redukowany do pustej listy | SPIĘTA_CZĘŚCIOWO — brak odrębnego błędu |
| 7 | `scorecards` — Karty wyników i konteksty | `KpiToolPage.tsx:970` | `GET /api/vnext/results/kpi/scorecards/for-kpi/:kpiId` | `kpiScorecard.routes.ts:458`; `Gateway.ts:1249` | `kpiScorecardApi.ts:listKpiScorecardsForKpi` | `rvn_kpi_scorecards`, `rvn_kpi_scorecard_items`, `rvn_platform_resource_visibility` | „Brak kart wyników” | jawny stan błędu | SPIĘTA |
| 8 | `history` — Historia / rodowód | `KpiToolPage.tsx:1000` | `GET /api/vnext/results/kpi/:kpiId/history` | `kpi.routes.ts:469`; `Gateway.ts:1260` | `kpiApi.ts:getKpiHistory` | `rvn_platform_events`, `rvn_kpi_definitions`, widoczność | „Brak historii KPI” | jawny stan błędu | SPIĘTA |

Uwaga do wiersza 6 (korekta FIX-199): poprzednia wersja tego kontraktu wskazywała
`kpi.routes.ts:1000` (czyli `GET /:kpiId/measurements`, sekcja 3) jako rejestrację
dla `initiative-impacts` — trasa NIE jest w `kpi.routes.ts` w ogóle. Realna
definicja jest w `kpiPerspectives.routes.ts` (router KPI-E005, montowany
OSOBNO i PRZED `resultsVnextKpiRoutes` — `Gateway.ts:1259`, patrz komentarz
„MOUNT-ORDER NOTE” w tym pliku).

## OKR — 6 z 6 zakładek

| # | Sekcja (id + etykieta PL) | Definicja w kodzie | Trasa API | Rejestracja trasy | Wołacz we froncie | Tabele źródłowe | Stan pusty | Stan błędu | Werdykt |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | `overview` — Przegląd | `OkrSetWorkspace.tsx:160` | `GET /api/vnext/results/okr/sets/:setId` | `okr.routes.ts:1081`; `Gateway.ts:1286` | `okrApi.ts:getOkrSet` | `okr_vnext_sets`, `okr_vnext_cycles`, `okr_vnext_programs` | brak zestawu → uczciwy not-found/forbidden | stan błędu strony | SPIĘTA |
| 2 | `objectives` — Cele i Kluczowe Rezultaty (drill-down do check-inów) | `OkrSetWorkspace.tsx:100-133,161` | `GET /api/vnext/results/okr/sets/:setId/objectives`; `GET .../key-results/:keyResultId/check-ins` | `okr.routes.ts:1594,1988`; `Gateway.ts:1286` | `okrObjectiveApi.ts:listObjectivesForSet`; `okrCheckInApi.ts:listCheckIns` | `okr_vnext_objectives`, `okr_vnext_key_results`, `okr_vnext_checkins`, `okr_vnext_checkin_occurrences` | puste listy z CTA zależnym od roli | jawny stan błędu widoków | SPIĘTA |
| 3 | `alignment` — Dopasowania | `OkrSetWorkspace.tsx:162`; `OkrAlignmentsView.tsx` | `GET /api/vnext/results/okr/objectives/:objectiveId/alignments` | `okr.routes.ts:2252`; `Gateway.ts:1286` | `okrWorkspaceApi.ts:listAlignmentsForObjective` | `okr_vnext_alignments`, `okr_vnext_objectives` | brak dopasowań | jawny błąd | SPIĘTA |
| 4 | `support` — Rozmowy i wsparcie | `OkrSetWorkspace.tsx:163`; `OkrSupportView.tsx` | `GET /api/vnext/results/okr/sets/:setId/support-requests` | `okr.routes.ts:3184`; `Gateway.ts:1286` | `okrWorkspaceApi.ts:listSupportRequestsForSet` | `okr_vnext_support_requests` i komentarze/recognition/decision links | brak próśb i rozmów | jawny błąd | SPIĘTA |
| 5 | `review` — Przegląd i refleksja | `OkrSetWorkspace.tsx:164`; `OkrReviewReflectionView.tsx` | `GET /api/vnext/results/okr/sets/:setId/reviews`; `GET /objectives/:objectiveId/reflection` | `okr.routes.ts:2877,2490`; `Gateway.ts:1286` | `okrWorkspaceApi.ts:listOkrSetReviews,getObjectiveReflection` | `okr_vnext_reviews`, `okr_vnext_reflections` | brak przeglądów/refleksji | jawny błąd | SPIĘTA |
| 6 | `history` — Historia | `OkrSetWorkspace.tsx:165`; `OkrHistoryView.tsx` | `GET /api/vnext/results/okr/sets/:setId/history` | `okr.routes.ts:2994`; `Gateway.ts:1286` | `okrWorkspaceApi.ts:getOkrSetHistory` | zdarzenia/audyt OKR | „Brak historii” | jawny błąd | SPIĘTA |

Korekta FIX-199: wszystkie 6 wierszy OKR miały błędną „Rejestrację trasy” w
poprzedniej wersji (odbiór: „OKR 6/6 złych”) — lista tras była zbudowana przez
zszycie (zip) kolejności zakładek UI z kolejnością definicji w pliku, a te dwie
kolejności się nie pokrywają (`okr.routes.ts` przeplata trasy programów/cykli/
zestawów między trasami zakładek). Każdy numer poniżej jest teraz dopasowany po
ŚCIEŻCE, nie po pozycji.

## ROI — 16 z 16 podzakładek w 4 fazach

Wszystkie trasy poniżej są zdefiniowane w `server/src/routes/resultsVnext/roi.routes.ts` i zamontowane w `server/src/Gateway.ts:1276` pod `/api/vnext/results/roi`.

| # | Sekcja (id + etykieta PL) | Definicja w kodzie | Trasa API | Rejestracja trasy | Wołacz we froncie | Tabele źródłowe | Stan pusty | Stan błędu | Werdykt |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Build `settings` — Baseline i polityka | `RoiCaseModelWorkspace.tsx:640` | `GET /api/vnext/results/roi/cases/:caseId/baseline`; `GET .../calculation-policy` | `roi.routes.ts:826,932`; `Gateway.ts:1276` | `roiCaseDetailApi.ts:getRoiBaseline,getRoiCalculationPolicy` | `rvn_roi_baselines`, `rvn_roi_calculation_policy` | jawny brak każdego rekordu | błąd workspace | SPIĘTA |
| 2 | Build `assumptions` — Założenia | `RoiCaseModelWorkspace.tsx:641` | `GET /api/vnext/results/roi/cases/:caseId/assumptions` | `roi.routes.ts:997`; `Gateway.ts:1276` | `roiCaseDetailApi.ts:listRoiAssumptions` | `rvn_roi_assumptions` | pusta tabela | błąd workspace | SPIĘTA |
| 3 | Build `cost-lines` — Koszty | `RoiCaseModelWorkspace.tsx:642` | `GET /api/vnext/results/roi/cases/:caseId/cost-lines` | `roi.routes.ts:1170`; `Gateway.ts:1276` | `roiCaseDetailApi.ts:listRoiCostLines` | `rvn_roi_cost_lines` | pusta tabela | błąd workspace | SPIĘTA |
| 4 | Build `benefit-lines` — Korzyści | `RoiCaseModelWorkspace.tsx:643` | `GET /api/vnext/results/roi/cases/:caseId/benefit-lines` | `roi.routes.ts:1345`; `Gateway.ts:1276` | `roiCaseDetailApi.ts:listRoiBenefitLines` | `rvn_roi_benefit_lines`, `rvn_roi_benefit_evidence_links` | pusta tabela | błąd workspace | SPIĘTA |
| 5 | Build `scenarios` — Scenariusze | `RoiCaseModelWorkspace.tsx:644` | `GET /api/vnext/results/roi/cases/:caseId/scenarios` | `roi.routes.ts:1633`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiScenarios` | `rvn_roi_scenarios`, overrides | pusta tabela | błąd workspace | SPIĘTA |
| 6 | Build `calculation-runs` — Przebiegi kalkulacji | `RoiCaseModelWorkspace.tsx:645` | `GET /api/vnext/results/roi/cases/:caseId/calculation-runs` | `roi.routes.ts:1935`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiCalculationRuns` | `rvn_roi_calculation_runs` | brak przebiegów | błąd workspace | SPIĘTA |
| 7 | Decision `approval-snapshots` — Migawki zatwierdzenia | `RoiCaseDecisionWorkspace.tsx:91` | `GET /api/vnext/results/roi/cases/:caseId/approval-snapshots` | `roi.routes.ts:2200`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiApprovalSnapshots` | `rvn_roi_approval_snapshots` | brak migawek | błąd workspace | SPIĘTA |
| 8 | Decision `compare` — Porównanie | `RoiCaseDecisionWorkspace.tsx:92` | `GET /api/vnext/results/roi/cases/:caseId/compare` | `roi.routes.ts:2339`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:getRoiCaseCompareView` | baseline, koszty, korzyści, kalkulacje, snapshoty | jawne wartości nieobliczalne/brak | błąd workspace | SPIĘTA |
| 9 | Realize `forecast-versions` — Prognoza | `RoiCaseRealizeValueWorkspace.tsx:226` | `GET /api/vnext/results/roi/cases/:caseId/forecast-versions` | `roi.routes.ts:2296`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiForecastVersions` | `rvn_roi_forecast_versions` | brak prognoz | błąd workspace | SPIĘTA |
| 10 | Realize `actuals` — Wykonania | `RoiCaseRealizeValueWorkspace.tsx:227` | `GET /api/vnext/results/roi/cases/:caseId/actuals` | `roi.routes.ts:2361`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiActualEntries` | `rvn_roi_actual_entries` | brak wykonań | błąd workspace | SPIĘTA |
| 11 | Realize `actual-snapshots` — Migawki wykonania | `RoiCaseRealizeValueWorkspace.tsx:228` | `GET /api/vnext/results/roi/cases/:caseId/actual-snapshots` | `roi.routes.ts:2589`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiActualSnapshots` | `rvn_roi_actual_snapshots` | brak migawek | błąd workspace | SPIĘTA |
| 12 | Realize `variances` — Wariancje | `RoiCaseRealizeValueWorkspace.tsx:229` | `GET /api/vnext/results/roi/cases/:caseId/variances` | `roi.routes.ts:2632`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiVariances` | `rvn_roi_variances` i przyczyny | brak wariancji | błąd workspace | SPIĘTA |
| 13 | Realize `benefits-realization` — Realizacja korzyści | `RoiCaseRealizeValueWorkspace.tsx:230` | `GET /api/vnext/results/roi/cases/:caseId/benefits-realization` | `roi.routes.ts:2881`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:getRoiCaseBenefitsRealization` | benefits, actuals, baseline, snapshots | uczciwe braki zamiast zera | błąd workspace | SPIĘTA |
| 14 | Learn `pir` — PIR | `RoiCaseLearnWorkspace.tsx:166` | `GET /api/vnext/results/roi/cases/:caseId/post-investment-reviews` | `roi.routes.ts:2995`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiPostInvestmentReviews` | `rvn_roi_post_investment_reviews` | brak PIR | błąd workspace | SPIĘTA |
| 15 | Learn `finance-links` — Powiązania Finance | `RoiCaseLearnWorkspace.tsx:167` | `GET /api/vnext/results/roi/cases/:caseId/finance-links` | `roi.routes.ts:3229`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiFinanceLinks` | `rvn_roi_finance_links` | brak powiązań | błąd workspace | SPIĘTA |
| 16 | Learn `finance-reconciliations` — Rekoncyliacje | `RoiCaseLearnWorkspace.tsx:168` | `GET /api/vnext/results/roi/cases/:caseId/finance-reconciliations` | `roi.routes.ts:3325`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiFinanceReconciliations` | `rvn_roi_finance_reconciliations` | brak rekoncyliacji | błąd workspace | SPIĘTA |

Korekta FIX-199 (imienna, z instrukcji dyżuru): wiersze 9-16 miały „Rejestrację
trasy” przesuniętą o jedną pozycję w dół względem realnego pliku (wiersz N w
starej wersji nosił numer linii realnej trasy wiersza N+1) — klasyczny efekt
zszycia (zip) dwóch list w różnej kolejności zamiast dopasowania po ścieżce:
- #8/#9 (`compare`/`forecast-versions`) były **zamienione miejscami**: stara
  wersja dawała `compare→2296` (to w rzeczywistości linia `forecast-versions`)
  i `forecast-versions→2339` (to w rzeczywistości linia `compare`).
- #16 (`finance-reconciliations`) wskazywał `roi.routes.ts:3447` — ta linia
  leży W ŚRODKU handlera `listRoiFinanceProjections` (kod pomocniczy, nie
  deklaracja `router.get(`), więc nie jest nawet trasą GET. Realny GET dla
  `finance-reconciliations` to `roi.routes.ts:3325`.

## LUKI — DO_ZBUDOWANIA

| Luka | Brak | Rząd wielkości |
|---|---|---|
| Agregat działań korygujących per KPI | trasa read-only nad sprawami KPI, serwis/repozytorium już potrafi czytać działania per sprawa; potrzebne jawne tenant/visibility scoping oraz konsument w sekcji KPI | M — nowa trasa, test RealPG przez `ApiGateway`, wołacz, render i odbiór |

## TRASY BEZ KONSUMENTA

Metoda (komenda 3 poniżej): dla każdy GET z komendy 1 (wszystkie 5 routerów —
`kpi.routes.ts`, `kpiDeviation.routes.ts`, `kpiScorecard.routes.ts`,
`okr.routes.ts`, `roi.routes.ts` — router #6, `kpiPerspectives.routes.ts`, jest
poza tym zakresem, bo jego jedyny GET obsługuje wiersz 6 karty KPI i ma
konsumenta) sprawdzono, czy istnieje funkcja-owijka w odpowiednim pliku `*Api.ts`
wołająca dokładnie tę ścieżkę, i czy ta funkcja ma choć jednego wołacza w `src/`
poza plikiem `*Api.ts`, w którym jest zdefiniowana. 30/30 sekcji karty ma
konsumenta (patrz tabele wyżej); poniższa lista to WSZYSTKIE pozostałe GET-y
tych 5 routerów — 23 trasy łącznie.

### KPI-rodzina (`kpi.routes.ts`, `kpiDeviation.routes.ts`, `kpiScorecard.routes.ts`) — 6

| Trasa | Definicja | Wynik pomiaru frontu |
|---|---|---|
| `GET /api/vnext/results/kpi/:kpiId/trend` | `kpi.routes.ts:433` | brak wołacza w `src/` (nie ma nawet funkcji-owijki w `kpiApi.ts`) |
| `GET /api/vnext/results/kpi/:kpiId/next-obligation` | `kpi.routes.ts:496` | brak wołacza w `src/` (nie ma nawet funkcji-owijki w `kpiApi.ts`) |
| `GET /api/vnext/results/kpi/deviation-cases/:caseId/recovery-card` | `kpiDeviation.routes.ts:365` | brak wołacza; odczyt recovery card we froncie idzie przez INNĄ, starszą trasę (`v8/results.ts:getRecoveryCard` → `/results/deviation-cases/:caseId/recovery-card`, poza `/vnext`) |
| `GET /api/vnext/results/kpi/deviation-cases/:caseId/corrective-actions` | `kpiDeviation.routes.ts:542` | brak wołacza — to ta sama luka co wiersz 5 karty KPI (`DO_ZBUDOWANIA`, patrz LUKI wyżej); front buduje listę client-side z odpowiedzi zapisu, nigdy nie odpytuje tej trasy |
| `GET /api/vnext/results/kpi/deviation-cases/:caseId/effectiveness-verifications` | `kpiDeviation.routes.ts:797` | brak wołacza (nie ma funkcji-owijki w `kpiDeviationApi.ts`; istnieje tylko `POST` na tej samej ścieżce, dokumentowane wprost w nagłówku tego pliku jako „left for a future package”) |
| `GET /api/vnext/results/kpi/scorecards/:scorecardId/review-snapshots/published` | `kpiScorecard.routes.ts:754` | brak wołacza — `getPublishedKpiScorecardSnapshot` istnieje w `kpiScorecardApi.ts`, ale nic go nie wywołuje (tylko wzmianki w komentarzach `KpiScorecardSnapshotDialogs.tsx`/`kpiScorecardPresenters.tsx`) |

### OKR (`okr.routes.ts`) — 5

| Trasa | Definicja | Wynik pomiaru frontu |
|---|---|---|
| `GET /api/vnext/results/okr/sets/:setId/check-in-summary` | `okr.routes.ts:3555` | brak wołacza w `src/` (dopisana imiennie w instrukcji tego dyżuru) |
| `GET /api/vnext/results/okr/sets/:setId/attention` | `okr.routes.ts:3507` | brak wołacza — `attentionState` na kartach zestawu OKR pochodzi z pola zwracanego przez `GET /sets/:setId`/`GET /sets`, nie z tej osobnej trasy |
| `GET /api/vnext/results/okr/sets/:setId/approval-snapshots/:snapshotId` | `okr.routes.ts:1499` | brak wołacza (tylko lista mnoga `listOkrSetApprovalSnapshots` jest wywoływana; pojedynczy GET nie ma funkcji-owijki) |
| `GET /api/vnext/results/okr/key-results/:keyResultId` | `okr.routes.ts:1814` | brak wołacza (nie ma funkcji-owijki `getKeyResult` w `okrObjectiveApi.ts`) |
| `GET /api/vnext/results/okr/objectives/:objectiveId/alignment-tree` | `okr.routes.ts:2282` | brak wołacza — `getAlignmentTreeUnderObjective` istnieje w `okrWorkspaceApi.ts`, ale nic go nie wywołuje |

### ROI (`roi.routes.ts`) — 12

| Trasa | Definicja | Wynik pomiaru frontu |
|---|---|---|
| `GET /api/vnext/results/roi/cases/:caseId/assumptions/:assumptionId` | `roi.routes.ts:1020` | brak wołacza (nie ma funkcji-owijki w `roiCaseDetailApi.ts`) |
| `GET /api/vnext/results/roi/cases/:caseId/cost-lines/:costLineId` | `roi.routes.ts:1193` | brak wołacza (nie ma funkcji-owijki) |
| `GET /api/vnext/results/roi/cases/:caseId/benefit-lines/:benefitLineId` | `roi.routes.ts:1368` | brak wołacza (nie ma funkcji-owijki) |
| `GET /api/vnext/results/roi/cases/:caseId/scenarios/:scenarioId` | `roi.routes.ts:1656` | brak wołacza (nie ma funkcji-owijki) |
| `GET /api/vnext/results/roi/cases/:caseId/scenarios/:scenarioId/overrides` | `roi.routes.ts:1837` | brak wołacza — udokumentowane wprost w `RoiCaseModelWorkspace.tsx` (komentarz przy `scenarioOverrides`): trasa nie istnieje jako lista po stronie klienta „by server design”, overrides pokazywane są tylko z akumulacji client-side tej sesji |
| `GET /api/vnext/results/roi/cases/:caseId/calculation-runs/:runId` | `roi.routes.ts:1959` | brak wołacza — `getRoiCalculationRun` istnieje w `roiCaseFullToolApi.ts`, ale nic go nie wywołuje |
| `GET /api/vnext/results/roi/cases/:caseId/approval-snapshots/:snapshotId` | `roi.routes.ts:2220` | brak wołacza — `getRoiApprovalSnapshot` istnieje, ale nic go nie wywołuje |
| `GET /api/vnext/results/roi/cases/:caseId/forecast-versions/:forecastVersionId` | `roi.routes.ts:2312` | brak wołacza — `getRoiForecastVersion` istnieje, ale nic go nie wywołuje |
| `GET /api/vnext/results/roi/cases/:caseId/actuals/:entryId` | `roi.routes.ts:2428` | brak wołacza — `getRoiActualEntry` istnieje, ale nic go nie wywołuje |
| `GET /api/vnext/results/roi/cases/:caseId/actual-snapshots/:actualSnapshotId` | `roi.routes.ts:2605` | brak wołacza — `getRoiActualSnapshot` istnieje, ale nic go nie wywołuje |
| `GET /api/vnext/results/roi/cases/:caseId/variances/:varianceId` | `roi.routes.ts:2688` | brak wołacza — `getRoiVariance` istnieje, ale nic go nie wywołuje |
| `GET /api/vnext/results/roi/cases/:caseId/finance-projections` | `roi.routes.ts:3425` | brak wołacza — `listRoiFinanceProjections` istnieje w `roiCaseFullToolApi.ts`, ale nic go nie wywołuje (i to jest ta sama linia, do której błędnie wskazywał stary wiersz 16 karty — patrz korekta ROI #16 wyżej) |

Trasy `for-kpi/:kpiId` oraz `:kpiId/history` miały brak konsumenta na wejściu dyżuru 199; po spięciu przez `listKpiScorecardsForKpi` i `getKpiHistory` nie należą już do tej listy.

## Jak odtworzyć numery

Trzy komendy, uruchamiane z korzenia repo. Wszystkie trzy dają diff=0 na tym
markerze; jeśli po zmianie kodu diff≠0, ten dokument jest przestarzały i wymaga
przeliczenia — nie ręcznej korekty pojedynczych liczb.

### Komenda 1 — numer linii `router.get(` dopasowany do ŚCIEŻKI (nie kolejności)

Zapisz jako `/tmp/route_lines.awk`:

```awk
/^router\.get\(/ {
  n = FNR
  rest = $0
  sub(/^router\.get\(/, "", rest)
  if (match(rest, /^[ \t]*['"][^'"]+['"]/)) {
    p = substr(rest, RSTART, RLENGTH)
    gsub(/^[ \t]*['"]/, "", p)
    gsub(/['"]$/, "", p)
    printf "%s:%d: %s\n", FILENAME, n, p
    next
  }
  getline nxt
  while (nxt ~ /^[ \t]*$/) { getline nxt }
  if (match(nxt, /^[ \t]*['"][^'"]+['"]/)) {
    p = substr(nxt, RSTART, RLENGTH)
    gsub(/^[ \t]*['"]/, "", p)
    gsub(/['"]$/, "", p)
    printf "%s:%d: %s\n", FILENAME, n, p
  } else {
    printf "%s:%d: <UNRESOLVED>\n", FILENAME, n
  }
}
```

Uruchom (daje `plik:linia: ścieżka` dla KAŻDEGO `router.get(` w 6 routerach —
5 z karty + `kpiPerspectives.routes.ts` dla wiersza 6 KPI):

```bash
awk -f /tmp/route_lines.awk \
  server/src/routes/resultsVnext/kpi.routes.ts \
  server/src/routes/resultsVnext/kpiDeviation.routes.ts \
  server/src/routes/resultsVnext/kpiScorecard.routes.ts \
  server/src/routes/resultsVnext/okr.routes.ts \
  server/src/routes/resultsVnext/roi.routes.ts \
  server/src/routes/resultsVnext/kpiPerspectives.routes.ts
```

Znajdź numer dla KONKRETNEJ ścieżki wiersza tabeli, np. dla wiersza ROI #16:

```bash
awk -f /tmp/route_lines.awk server/src/routes/resultsVnext/roi.routes.ts \
  | grep "/cases/:caseId/finance-reconciliations$"
# server/src/routes/resultsVnext/roi.routes.ts:3325: /cases/:caseId/finance-reconciliations
```

`Gateway.ts` — numer linii `app.use` per router (nie zmienia się w tym dyżurze,
podany dla kompletności odtwarzania):

```bash
grep -n "app.use('/api/vnext/results" server/src/Gateway.ts
```

### Komenda 2 — numer linii „Definicja w kodzie” po IDENTYFIKATORZE sekcji/zakładki (nie kolejności)

KPI (`id: 'x',` wewnątrz definicji sekcji `NModeSection`):

```bash
grep -n "^    id: '" src/components/ResultsVNext/kpiTool/KpiToolPage.tsx
```

OKR (para `{ id: 'x', label: ... }` w liście zakładek Menu 2):

```bash
grep -n "{ id: '.*label: isPolish" src/components/ResultsVNext/okr/OkrSetWorkspace.tsx
```

ROI (analogiczna para `{ id: 'x', label: ... }`, po jednym pliku na fazę):

```bash
grep -n "id: '" src/components/ResultsVNext/roi/RoiCaseModelWorkspace.tsx | head -6
grep -n "id: '" src/components/ResultsVNext/roi/RoiCaseDecisionWorkspace.tsx | head -2
grep -n "id: '" src/components/ResultsVNext/roi/RoiCaseRealizeValueWorkspace.tsx | head -5
grep -n "id: '" src/components/ResultsVNext/roi/RoiCaseLearnWorkspace.tsx | head -3
```

### Komenda 3 — TRASY BEZ KONSUMENTA (pełne przeskanowanie 5 routerów)

Dla każdej ścieżki z komendy 1 (5 routerów karty, bez `kpiPerspectives.routes.ts`):
znajdź funkcję-owijkę w odpowiednim `*Api.ts` po literalnym fragmencie URL, potem
sprawdź, czy ta funkcja ma wołacza poza plikiem, w którym jest zdefiniowana:

```bash
# przykład dla jednej funkcji już zidentyfikowanej jako owijka danej trasy
fn=getRoiCalculationRun
grep -rln "\b$fn(" src --include="*.tsx" --include="*.ts" | grep -v "roiCaseFullToolApi.ts$"
# brak wyniku = brak wołacza = trasa bez konsumenta
```

Pliki `*Api.ts` do przeszukania po funkcje-owijki dla 5 routerów:
`src/components/ResultsVNext/kpiApi.ts`,
`src/components/ResultsVNext/kpiTool/kpiDeviationApi.ts`,
`src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts`,
`src/components/ResultsVNext/okr/{okrApi,okrObjectiveApi,okrWorkspaceApi,okrCheckInApi}.ts`,
`src/components/ResultsVNext/roi/{roiApi,roiCaseDetailApi,roiCaseFullToolApi}.ts`.

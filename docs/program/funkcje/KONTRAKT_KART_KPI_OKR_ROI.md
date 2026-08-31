---
doc_id: funkcje-kontrakt-kart-kpi-okr-roi
status: canonical
owner: piotr
truth_type: design
established: 2026-08-31
---

# Kontrakt kart KPI, OKR i ROI

Pomiar na markerze `60581ed6b5`. Kontrakt opisuje zamontowane komponenty i realne trasy. Wspólna koperta backendu to `ApiGateway` oraz `requireResultsInternalBetaVisibility`; montaże są w `server/src/Gateway.ts:1233-1286`. Karta KPI używa `NModeShell` z `ArtifactRightPanel`, natomiast OKR i ROI używają `StandardModuleBar`; to jawna niespójność inwentarzowa, nie zakres naprawy tego dyżuru. Rejestry nie obsługują podwójnego kliknięcia. OKR i ROI zachowują `window.location.search` w nawigacji do karty, KPI polega na mechanizmie flagi w `resultsVNextFeatureFlags.ts:126-134`.

## KPI — 8 z 8 sekcji

| # | Sekcja (id + etykieta PL) | Definicja w kodzie | Trasa API | Rejestracja trasy | Wołacz we froncie | Tabele źródłowe | Stan pusty | Stan błędu | Werdykt |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | `performance` — Wynik | `KpiToolPage.tsx:598` | `GET /api/vnext/results/kpi/:kpiId`; `GET /api/vnext/results/kpi/:kpiId/measurements` | `kpi.routes.ts:410,524`; `Gateway.ts:1259-1260` | `kpiApi.ts:getKpi,listKpiMeasurements` | `rvn_kpi_definitions`, `rvn_kpi_measurements` | „Brak pomiaru”; żadnego zmyślonego zera | błąd KPI zatrzymuje kartę; błąd pomiaru daje brak wartości | SPIĘTA |
| 2 | `contract` — Kontrakt definicji | `KpiToolPage.tsx:659` | `GET /api/vnext/results/kpi/:kpiId/version` | `kpi.routes.ts:552`; `Gateway.ts:1259-1260` | `kpiApi.ts:getKpiCurrentDefinitionVersion` | `rvn_kpi_definitions`, `rvn_kpi_definition_versions` | komunikat o braku widocznej wersji + pola root KPI | komunikat o nieudanym odczycie wersji | SPIĘTA |
| 3 | `measurements` — Pomiary | `KpiToolPage.tsx:705` | `GET /api/vnext/results/kpi/:kpiId/measurements` | `kpi.routes.ts:524`; `Gateway.ts:1259-1260` | `kpiApi.ts:listKpiMeasurements`; `ResultsKpiMeasurementsPanel.tsx` | `rvn_kpi_measurements` | stan pusty panelu pomiarów | stan błędu panelu | SPIĘTA |
| 4 | `deviations` — Sprawy odchyleń | `KpiToolPage.tsx:719` | `GET /api/vnext/results/kpi/deviation-cases?kpiId=:kpiId` | `kpiDeviation.routes.ts:292`; `Gateway.ts:1244` | `kpiDeviationApi.ts:listDeviationCases` | `rvn_kpi_deviation_cases` | „Brak spraw odchyleń” | obecnie błąd jest redukowany do pustej listy | SPIĘTA_CZĘŚCIOWO — brak odrębnego błędu |
| 5 | `correctiveActions` — Działania korygujące | `KpiToolPage.tsx:773` | brak agregatu per KPI; istnieje tylko `GET /api/vnext/results/kpi/deviation-cases/:caseId/corrective-actions` | `kpiDeviation.routes.ts:542`; `Gateway.ts:1244` | tylko link do podwidoku sprawy | `rvn_kpi_corrective_actions` | „Brak otwartych spraw…” | brak osobnej obsługi | DO_ZBUDOWANIA |
| 6 | `initiatives` — Inicjatywy wpływające na KPI | `KpiToolPage.tsx:806` | `GET /api/vnext/results/kpi/:kpiId/initiative-impacts` | `kpi.routes.ts:1000`; `Gateway.ts:1259-1260` | `kpiInitiativeImpactApi.ts:listInitiativeImpactsForKpi` | `rvn_kpi_initiative_impacts`, `initiatives` | „Brak powiązanych inicjatyw” | obecnie błąd jest redukowany do pustej listy | SPIĘTA_CZĘŚCIOWO — brak odrębnego błędu |
| 7 | `scorecards` — Karty wyników i konteksty | `KpiToolPage.tsx:972` | `GET /api/vnext/results/kpi/scorecards/for-kpi/:kpiId` | `kpiScorecard.routes.ts:458`; `Gateway.ts:1249` | `kpiScorecardApi.ts:listKpiScorecardsForKpi` | `rvn_kpi_scorecards`, `rvn_kpi_scorecard_items`, `rvn_platform_resource_visibility` | „Brak kart wyników” | jawny stan błędu | SPIĘTA |
| 8 | `history` — Historia / rodowód | `KpiToolPage.tsx:1003` | `GET /api/vnext/results/kpi/:kpiId/history` | `kpi.routes.ts:469`; `Gateway.ts:1259-1260` | `kpiApi.ts:getKpiHistory` | `rvn_platform_events`, `rvn_kpi_definitions`, widoczność | „Brak historii KPI” | jawny stan błędu | SPIĘTA |

## OKR — 6 z 6 zakładek

| # | Sekcja (id + etykieta PL) | Definicja w kodzie | Trasa API | Rejestracja trasy | Wołacz we froncie | Tabele źródłowe | Stan pusty | Stan błędu | Werdykt |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | `overview` — Przegląd | `OkrSetWorkspace.tsx:159` | `GET /api/vnext/results/okr/sets/:setId` | `okr.routes.ts:787`; `Gateway.ts:1286` | `okrApi.ts:getOkrSet` | `okr_vnext_sets`, `okr_vnext_cycles`, `okr_vnext_programs` | brak zestawu → uczciwy not-found/forbidden | stan błędu strony | SPIĘTA |
| 2 | `objectives` — Cele i Kluczowe Rezultaty (drill-down do check-inów) | `OkrSetWorkspace.tsx:100-133,160` | `GET /api/vnext/results/okr/sets/:setId/objectives`; `GET .../key-results/:keyResultId/check-ins` | `okr.routes.ts:1475,1814`; `Gateway.ts:1286` | `okrObjectiveApi.ts:listObjectivesForSet`; `okrCheckInApi.ts:listCheckIns` | `okr_vnext_objectives`, `okr_vnext_key_results`, `okr_vnext_checkins`, `okr_vnext_checkin_occurrences` | puste listy z CTA zależnym od roli | jawny stan błędu widoków | SPIĘTA |
| 3 | `alignment` — Dopasowania | `OkrSetWorkspace.tsx:161`; `OkrAlignmentsView.tsx` | `GET /api/vnext/results/okr/objectives/:objectiveId/alignments` | `okr.routes.ts:2152`; `Gateway.ts:1286` | `okrWorkspaceApi.ts:listAlignmentsForObjective` | `okr_vnext_alignments`, `okr_vnext_objectives` | brak dopasowań | jawny błąd | SPIĘTA |
| 4 | `support` — Rozmowy i wsparcie | `OkrSetWorkspace.tsx:162`; `OkrSupportView.tsx` | `GET /api/vnext/results/okr/sets/:setId/support-requests` | `okr.routes.ts:2877`; `Gateway.ts:1286` | `okrWorkspaceApi.ts:listSupportRequestsForSet` | `okr_vnext_support_requests` i komentarze/recognition/decision links | brak próśb i rozmów | jawny błąd | SPIĘTA |
| 5 | `review` — Przegląd i refleksja | `OkrSetWorkspace.tsx:163`; `OkrReviewReflectionView.tsx` | `GET /api/vnext/results/okr/sets/:setId/reviews`; `GET /objectives/:objectiveId/reflection` | `okr.routes.ts:2252,2490`; `Gateway.ts:1286` | `okrWorkspaceApi.ts:listOkrSetReviews,getObjectiveReflection` | `okr_vnext_reviews`, `okr_vnext_reflections` | brak przeglądów/refleksji | jawny błąd | SPIĘTA |
| 6 | `history` — Historia | `OkrSetWorkspace.tsx:164`; `OkrHistoryView.tsx` | `GET /api/vnext/results/okr/sets/:setId/history` | `okr.routes.ts:1956`; `Gateway.ts:1286` | `okrWorkspaceApi.ts:getOkrSetHistory` | zdarzenia/audyt OKR | „Brak historii” | jawny błąd | SPIĘTA |

## ROI — 16 z 16 podzakładek w 4 fazach

Wszystkie trasy poniżej są zdefiniowane w `server/src/routes/resultsVnext/roi.routes.ts` i zamontowane w `server/src/Gateway.ts:1267-1276` pod `/api/vnext/results/roi`.

| # | Sekcja (id + etykieta PL) | Definicja w kodzie | Trasa API | Rejestracja trasy | Wołacz we froncie | Tabele źródłowe | Stan pusty | Stan błędu | Werdykt |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Build `settings` — Baseline i polityka | `RoiCaseModelWorkspace.tsx:640` | `GET /api/vnext/results/roi/cases/:caseId/baseline`; `GET .../calculation-policy` | `roi.routes.ts:826,932`; `Gateway.ts:1276` | `roiCaseDetailApi.ts:getRoiBaseline,getRoiCalculationPolicy` | `rvn_roi_baselines`, `rvn_roi_calculation_policy` | jawny brak każdego rekordu | błąd workspace | SPIĘTA |
| 2 | Build `assumptions` — Założenia | `RoiCaseModelWorkspace.tsx:641` | `GET /api/vnext/results/roi/cases/:caseId/assumptions` | `roi.routes.ts:1020`; `Gateway.ts:1276` | `roiCaseDetailApi.ts:listRoiAssumptions` | `rvn_roi_assumptions` | pusta tabela | błąd workspace | SPIĘTA |
| 3 | Build `cost-lines` — Koszty | `RoiCaseModelWorkspace.tsx:642` | `GET /api/vnext/results/roi/cases/:caseId/cost-lines` | `roi.routes.ts:1170`; `Gateway.ts:1276` | `roiCaseDetailApi.ts:listRoiCostLines` | `rvn_roi_cost_lines` | pusta tabela | błąd workspace | SPIĘTA |
| 4 | Build `benefit-lines` — Korzyści | `RoiCaseModelWorkspace.tsx:643` | `GET /api/vnext/results/roi/cases/:caseId/benefit-lines` | `roi.routes.ts:1345`; `Gateway.ts:1276` | `roiCaseDetailApi.ts:listRoiBenefitLines` | `rvn_roi_benefit_lines`, `rvn_roi_benefit_evidence_links` | pusta tabela | błąd workspace | SPIĘTA |
| 5 | Build `scenarios` — Scenariusze | `RoiCaseModelWorkspace.tsx:644` | `GET /api/vnext/results/roi/cases/:caseId/scenarios` | `roi.routes.ts:1633`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiScenarios` | `rvn_roi_scenarios`, overrides | pusta tabela | błąd workspace | SPIĘTA |
| 6 | Build `calculation-runs` — Przebiegi kalkulacji | `RoiCaseModelWorkspace.tsx:645` | `GET /api/vnext/results/roi/cases/:caseId/calculation-runs` | `roi.routes.ts:1935`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiCalculationRuns` | `rvn_roi_calculation_runs` | brak przebiegów | błąd workspace | SPIĘTA |
| 7 | Decision `approval-snapshots` — Migawki zatwierdzenia | `RoiCaseDecisionWorkspace.tsx:91` | `GET /api/vnext/results/roi/cases/:caseId/approval-snapshots` | `roi.routes.ts:2200`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiApprovalSnapshots` | `rvn_roi_approval_snapshots` | brak migawek | błąd workspace | SPIĘTA |
| 8 | Decision `compare` — Porównanie | `RoiCaseDecisionWorkspace.tsx:92` | `GET /api/vnext/results/roi/cases/:caseId/compare` | `roi.routes.ts:2296`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:getRoiCaseCompareView` | baseline, koszty, korzyści, kalkulacje, snapshoty | jawne wartości nieobliczalne/brak | błąd workspace | SPIĘTA |
| 9 | Realize `forecast-versions` — Prognoza | `RoiCaseRealizeValueWorkspace.tsx:226` | `GET /api/vnext/results/roi/cases/:caseId/forecast-versions` | `roi.routes.ts:2339`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiForecastVersions` | `rvn_roi_forecast_versions` | brak prognoz | błąd workspace | SPIĘTA |
| 10 | Realize `actuals` — Wykonania | `RoiCaseRealizeValueWorkspace.tsx:227` | `GET /api/vnext/results/roi/cases/:caseId/actuals` | `roi.routes.ts:2589`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiActualEntries` | `rvn_roi_actual_entries` | brak wykonań | błąd workspace | SPIĘTA |
| 11 | Realize `actual-snapshots` — Migawki wykonania | `RoiCaseRealizeValueWorkspace.tsx:228` | `GET /api/vnext/results/roi/cases/:caseId/actual-snapshots` | `roi.routes.ts:2688`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiActualSnapshots` | `rvn_roi_actual_snapshots` | brak migawek | błąd workspace | SPIĘTA |
| 12 | Realize `variances` — Wariancje | `RoiCaseRealizeValueWorkspace.tsx:229` | `GET /api/vnext/results/roi/cases/:caseId/variances` | `roi.routes.ts:2881`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiVariances` | `rvn_roi_variances` i przyczyny | brak wariancji | błąd workspace | SPIĘTA |
| 13 | Realize `benefits-realization` — Realizacja korzyści | `RoiCaseRealizeValueWorkspace.tsx:230` | `GET /api/vnext/results/roi/cases/:caseId/benefits-realization` | `roi.routes.ts:2995`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:getRoiCaseBenefitsRealization` | benefits, actuals, baseline, snapshots | uczciwe braki zamiast zera | błąd workspace | SPIĘTA |
| 14 | Learn `pir` — PIR | `RoiCaseLearnWorkspace.tsx:166` | `GET /api/vnext/results/roi/cases/:caseId/post-investment-reviews` | `roi.routes.ts:3325`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiPostInvestmentReviews` | `rvn_roi_post_investment_reviews` | brak PIR | błąd workspace | SPIĘTA |
| 15 | Learn `finance-links` — Powiązania Finance | `RoiCaseLearnWorkspace.tsx:167` | `GET /api/vnext/results/roi/cases/:caseId/finance-links` | `roi.routes.ts:3425`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiFinanceLinks` | `rvn_roi_finance_links` | brak powiązań | błąd workspace | SPIĘTA |
| 16 | Learn `finance-reconciliations` — Rekoncyliacje | `RoiCaseLearnWorkspace.tsx:168` | `GET /api/vnext/results/roi/cases/:caseId/finance-reconciliations` | `roi.routes.ts:3447`; `Gateway.ts:1276` | `roiCaseFullToolApi.ts:listRoiFinanceReconciliations` | `rvn_roi_finance_reconciliations` | brak rekoncyliacji | błąd workspace | SPIĘTA |

## LUKI — DO_ZBUDOWANIA

| Luka | Brak | Rząd wielkości |
|---|---|---|
| Agregat działań korygujących per KPI | trasa read-only nad sprawami KPI, serwis/repozytorium już potrafi czytać działania per sprawa; potrzebne jawne tenant/visibility scoping oraz konsument w sekcji KPI | M — nowa trasa, test RealPG przez `ApiGateway`, wołacz, render i odbiór |

## TRASY BEZ KONSUMENTA

| Trasa | Definicja | Wynik pomiaru frontu |
|---|---|---|
| `GET /api/vnext/results/kpi/:kpiId/trend` | `kpi.routes.ts:433` | brak wołacza w `src/` |
| `GET /api/vnext/results/kpi/:kpiId/next-obligation` | `kpi.routes.ts:496` | brak wołacza w `src/` |

Trasy `for-kpi/:kpiId` oraz `:kpiId/history` miały brak konsumenta na wejściu dyżuru 199; po spięciu przez `listKpiScorecardsForKpi` i `getKpiHistory` nie należą już do tej listy.

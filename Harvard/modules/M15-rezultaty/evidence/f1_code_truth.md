# M15 — Rezultaty (Results / Benefits Realization) — FAZA 1: Prawda kodu

Branch: `feat/deliverables-light`. Hub runtime: `src/components/Results/ResultsHub.tsx` (1610 l.).
Trasa: `ROUTES.BENEFITS` (`/benefits`, alias `/kpi-okr`) → renderuje **ResultsHub** (AppRoutes.tsx:2144).
Beta gate: `MODULE_BENEFITS: 'closed'` (src/utils/betaAccess.ts:39) — zamknięty dla wszystkich.

Metoda: czytany kod runtime (FE + BE). Dokumenty traktowane jako hipotezy.

---

## WERDYKTY PER POZYCJA (8)

### 1. Zakładka Initiatives (tracked, filtry lifecycle/health) — **REALNE**
- Dane z V8 `getKpiCatalog()` → `initiatives` (kpiRuntime.ts:17-38), mapowane do `ResultsTrackedInitiative`.
- Fallback legacy `/benefits/*` przy błędzie V8 (kpiRuntime.ts:39-75). Legacy zwraca `initiatives: []` (linia 59) — w trybie legacy lista inicjatyw pusta, ale KPI realne.
- Backend: realne tabele DB (`initiative_kpis`, `v8_kpi_definitions`), org-scoped. Nie placeholder.

### 2. Zakładka KPI (overview/queue/catalog/scorecards + signal sheet, time-series drawer, create modal) — **REALNE**
- Catalog: `loadResultsKpis()` → V8 `v8_kpi_definitions` lub legacy `/benefits/kpis` + `/benefits/kpi-mappings` (kpiRuntime.ts:51-60).
- Scorecards: `ResultsKpiScorecardsView.tsx` ładuje realne goals (rawGoals), pokazowe TYLKO gdy puste+demo (linia 144).
- Time-series: zapis `POST /benefits/kpis/:kpiId/time-series` → INSERT do `kpi_time_series` (benefits.routes.ts:445-459, resultsEnterpriseService.ts:147). Realna persystencja DB.
- Snapshot runtime z `v8_kpi_definitions` (AVG progress, COUNT po statusie — resultsROIService.ts:722-745). Realne obliczenia.

### 3. Zakładka Reports (tracked/reports/schedules cron+approval/wallboards/connectors) — **REALNE**
- Wszystkie 5 trybów na realnych tabelach: `kpi_report_schedules`, `kpi_wallboards`, `kpi_connectors`, `kpi_ingestion_log`, `roi_evidence` (resultsEnterpriseService.ts: INSERT/SELECT linie 49, 133, 147, 257, 340, 529, 596).
- **Approval gating EGZEKWOWANY SERWEROWO**: `executeReportSchedule()` blokuje wykonanie do statusu `awaiting_approval` gdy `approval_required && approval_status !== 'approved'` (resultsEnterpriseService.ts:796-808). Nie czysto-kosmetyczne.
- Cron: `schedule_cron` + `resolveNextRunAt()` zapisywane do DB; harmonogram persystowany.

### 4. Zakładka ROI (portfolio summary V8→fallback, edytor założeń) — **REALNE**
- `ROITrackingView.tsx`: V8 `getRoiPortfolioSummary()` (linia 219) → fallback `GET /benefits/roi/portfolio/summary` (linia 224).
- Backend ROI: `v8_roi_realization_entries` INSERT (resultsROIService.ts:438), `roi_snapshot` JSON z NPV/payback (typ `ROISnapshot`). Realne wpisy + obliczenia, nie zaślepka.

### 5. Zakładka ROI Analysis — **REALNE** (operacyjna analiza)
- `OperationalAnalysisView.tsx` ładuje `/benefits/kpis` + `/benefits/kpi-mappings` (linie 76-77) i liczy impacty po `kpi_financial_mappings` × delta time-series (benefits.routes.ts:1684-1694). Realne dane finansowe-KPI.

### 6. Showcase / demo-data — **JAWNY DEMO-TOGGLE, NIE ciche fabrykowanie** ✅
- Warunek: `shouldUseResultsShowcaseData()` (resultsShowcaseData.ts:85-91) zwraca `shouldAllowDemoData()`.
- `shouldAllowDemoData()` (api.ts:623-626) = `isDemoMode || isDemoSession`, oba wynikają WYŁĄCZNIE z jawnego przełącznika usera „Show demo data" (api.ts:609-613, persystowany serwerowo jako `demo:enabled`).
- Komentarze kodu potwierdzają: **„Demo data must NEVER auto-activate"** (resultsShowcaseData.ts:87), brak localhost/DEV/email backdoor (api.ts:605-608).
- `MODE === 'test'` → zawsze false (linia 86).
- Podstawienie zachodzi TYLKO gdy realne PUSTE: `length === 0 && shouldUseResultsShowcaseData()` (kpiRuntime.ts:26,62; ScorecardsView:144; ReportsView:228; EnterpriseViews:265/709/1045).
- **Widoczność dla usera**: gdy `source === 'showcase'` ResultsHub renderuje chip „Showcase data — local" z niebieską kropką (ResultsHub.tsx:909-915). `runtimeSnapshot` podstawia `createResultsShowcaseSnapshot()` tylko przy showcase (linie 892-900).
- **WERDYKT: bezpieczny, jawny demo-toggle z widocznym oznaczeniem.** Real call → fake numbers NIE zachodzi bez świadomego włączenia demo przez usera, a gdy włączone, UI jawnie oznacza „Showcase data". To NIE jest ciche fabrykowanie wyników klientowi.

### 7. Dual-runtime V8→legacy — **DZIAŁA z fallbackiem, ale degradacja CICHA dla usera**
- `shouldFallbackToLegacyResults(error)` decyduje; przy fallbacku tylko `console.warn` (kpiRuntime.ts:44-49) — sygnał wyłącznie w konsoli deweloperskiej.
- W UI brak chipa „legacy": renderowany jest chip tylko dla `showcase` (ResultsHub.tsx:909). Dla `source === 'legacy'/'empty'` brak banera degradacji.
- **WERDYKT: funkcjonalnie OK (nie cicha pustka — dane legacy się pokazują), ale degradacja runtime nie jest komunikowana użytkownikowi (cichy downgrade).**

### 8. BenefitsHub.tsx (8 zakładek) — **MARTWY KOD** ✅
- `src/components/Benefits/BenefitsHub.tsx` (884 l.) eksportowany przez `BenefitsRealizationView.tsx` (renderuje `<BenefitsHub />`).
- `BenefitsRealizationView` lazy-importowany w AppRoutes (linie 115-117), ale identyfikator **NIE występuje w żadnym JSX/elemencie trasy** — jedyne wystąpienie to deklaracja. Trasa `/benefits` renderuje `ResultsHub`, nie BenefitsRealizationView.
- **0 ścieżek renderu. Potwierdzony martwy kod.** (Workspace'y Budget/FinancialAnalysis/Valuation żyją w FinanceHub — poza tym modułem.)

---

## TABELE

### 1e — Wiring (dane → DB/migracja)
| Encja | Tabela DB | Migracja |
|---|---|---|
| KPI definicje | `initiative_kpis`, `v8_kpi_definitions` | 612_results_kpi_global_and_deviation, 20260323_v8_results_roi |
| Time-series | `kpi_time_series` | 565_kpi_time_series_roi_attribution_finance |
| ROI realizacja | `v8_roi_realization_entries`, `roi_evidence` | 20260323_v8_results_roi, 656_v4_results_enterprise |
| Report schedules | `kpi_report_schedules` + delivery_log | 656_v4_results_enterprise, 750_v4_results_enterprise_runtime_completion |
| Wallboards | `kpi_wallboards`, `kpi_wallboard_alerts` | 656/750 |
| Connectors | `kpi_connectors`, `kpi_ingestion_log` | 656/750 |
| Deviation | `kpi_deviation_cases`, `kpi_deviation_actions` | 612 |
| Exec packs | `v8_executive_review_packs`, `v8_kpi_finance_reconciliations` | 20260323_v8_results_roi |

**Persystencja: REALNA (raw SQL, org-scoped).** NIE fasada `new Map()`. Przeżywa restart.

### 1f — Flagi (realne defaulty)
| Flaga | Źródło | Default |
|---|---|---|
| Beta gate `MODULE_BENEFITS` | betaAccess.ts:39 | `'closed'` (zablokowane dla nie-adminów) |
| V8 results runtime | V8ResultsApi + `shouldFallbackToLegacyResults` | V8 włączone, fallback do legacy `/benefits/*` |
| `shouldUseResultsShowcaseData` | resultsShowcaseData.ts:85 → `shouldAllowDemoData` | **false** domyślnie; true tylko po jawnym demo-toggle usera |
| Demo session | api.ts:609 (`isDemoMode === true` ze store) | false; brak auto-triggera |

### 1g — Połączenia
| Połączenie | Status | Dowód |
|---|---|---|
| M13 Inicjatywy → tracked initiatives | **REALNE** | V8 catalog `initiatives` + `initiative_kpis.initiative_id` (kpiRuntime.ts:20; benefits.routes.ts:317) |
| M16 Finanse → ROI / KPI-finance | **REALNE** | `kpi_financial_mappings` JOIN `financial_statement_lines` (benefits.routes.ts:1668-1674); `v8_kpi_finance_reconciliations` |
| **M20 Tabele → publish-to-results** | **DEAD-END (Results nic nie odbiera)** | `POST /governed-models/:id/publish-to-results` (table-platform.routes.ts:3413) → `syncToModule(modelId,'results',...)` zapisuje TYLKO do `tp_module_sync_results` (ModuleSyncService.ts:90). **Żaden moduł Results (benefits/v8/enterprise) NIE czyta `tp_module_sync_results`** — 0 trafień. Sync rejestruje stan, ale 0 wierszy KPI trafia do Results. Lepiej niż „tylko log", ale dla Results funkcjonalnie martwe. |

---

## SYGNAŁY CROSS-ORG / IDOR (próbka endpointów by-id)

Wzorzec M16: legacy raw-DB dziurawe, V8 czyste. Tu potwierdzony **mieszany** obraz:

| Endpoint | Org-scope? | Werdykt |
|---|---|---|
| `DELETE /benefits/kpis/:kpiId` | guard `COALESCE(k.organization_id, i.organization_id)=?` przed kaskadą (benefits.routes.ts:315-322); samo `DELETE initiative_kpis WHERE id=?` (353) PO guardzie | **OK** (chroniony upstream) |
| **`POST /benefits/kpis/:kpiId/time-series`** | `orgId` jest, ALE kpiId z URL **NIE weryfikowany** vs org przed: SELECT meta (439 `WHERE id=?`) i `UPDATE initiative_kpis SET current_value WHERE id=?` (468) | **🔴 CROSS-ORG WRITE IDOR** — user może zapisać time-series i nadpisać `current_value` KPI obcej organizacji. INSERT używa własnego orgId (linia 451), ale UPDATE na cudzym kpiId przechodzi. |
| `GET .../kpis/:kpiId/financial-impact` (1665) | mappings scoped `m.organization_id=?` (1672), ale `SELECT * FROM initiative_kpis WHERE id=?` (1676) + time-series (1678) **bez org** | **🟡 CROSS-ORG READ** — odczyt metadanych/serii KPI obcej org (impacty puste jeśli brak mappingów, ale dane KPI wyciekają). |
| `kpi_deviation_cases WHERE id=? AND organization_id=?` (599,641,686,794,845) | org w WHERE | **OK** |
| V8 `resultsROIService` (`v8_kpi_definitions WHERE organization_id=?` itd.) | org wszędzie | **OK (V8 czyste)** |

**Wniosek cross-org:** zgodne z systemowym wzorcem — **V8 czyste, legacy raw-DB (`/benefits/kpis/:id/...`) dziurawe**. Co najmniej 1 zapis (time-series/current_value) i 1 odczyt (financial-impact) cross-org bez walidacji przynależności kpiId do org. Do eskalacji w SEC.

---

## PODSUMOWANIE WERDYKTÓW
- poz.1-5 (za beta): **REALNE** — V8 + legacy fallback, realne tabele DB, realne obliczenia KPI/ROI.
- poz.6 showcase: **JAWNY DEMO-TOGGLE z widocznym chipem „Showcase data"** — NIE ciche fabrykowanie.
- poz.7 dual-runtime: **DZIAŁA**, ale degradacja V8→legacy cicha (tylko console.warn, brak baneru UI).
- poz.8 BenefitsHub: **MARTWY KOD** (0 ścieżek renderu).
- Persystencja: **REALNA DB** (nie fasada Map), przeżywa restart.
- M20→Results: **dead-end** — sync zapisuje tylko bridge table, Results nic nie konsumuje.
- IDOR: **legacy by-id dziurawe** (time-series write + financial-impact read cross-org); V8 czyste.

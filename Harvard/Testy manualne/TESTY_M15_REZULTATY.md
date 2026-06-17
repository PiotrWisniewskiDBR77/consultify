# TESTY — M15 Rezultaty (Results / Benefits Realization)

> **Moduł:** M15 Rezultaty (`/benefits`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`, inwentarz `Harvard/podzial/inventory/INV_D_inicjatywy_wdrozenie_rezultaty_finanse.md` (sekcja REZULTATY, poz. 1–8)
> **Zakres tej paczki:** hub + nawigacja, zakładka **Initiatives** (tracked), zakładka **KPI** (4 tryby: overview / queue / catalog / scorecards + time-series drawer + signal sheet), zakładka **Reports** (5 trybów enterprise + approval gating), zakładka **ROI** (portfolio summary + edytor założeń), zakładka **ROI Analysis**, showcase/demo-data fallback, dual-runtime V8→legacy, weryfikacja martwego `BenefitsHub`, ścieżki cross-module (M13↔M15↔M16).
> **Poza zakresem:** FinanceHub (M16), BenefitsHub — weryfikujemy tylko jego martwość.
> **Cel:** agent piszący i testujący moduł wykonuje każdy krok z dowodem E2E: UI + stan + payload sieciowy. Każda operacja zapisu potwierdzona w Network i — gdzie oznaczono [DB] — widoczna w wierszu DB.
> **Wzorzec formatu:** `TESTY_M01_CZAT.md` + `TESTY_M03_MOJA_PRACA.md`.
> **Legenda:** **[MANUAL]** = ręczna weryfikacja (curl / bezpośredni URL); **[FLAG]** = zależne od flagi/capability/roli; **[DB]** = dowód obejmuje wiersz/kolumnę w bazie; **[SEC]** = test bezpieczeństwa — wykonaj ostrożnie na staging, NIE na prod.
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny

### 0.1 Mapa komponentów → pliki → stan

| Obszar | Komponent | Plik | Stan, na który działa |
|---|---|---|---|
| Hub i nawigacja | `ResultsHub` | `src/components/Results/ResultsHub.tsx` (~1610 l.) | `activeTab`, `kpiWorkspaceMode`, `reportWorkspaceMode`, `resultsSource`, `kpis[]`, `trackedInitiatives[]`, URL `?tab=`, `?mode=`, `?rmode=` |
| Runtime KPI | `loadResultsKpis()` | `src/components/Results/kpiRuntime.ts` | zwraca `{initiatives, kpis, source: 'v8'|'legacy'|'empty'|'showcase'}` |
| Showcase | `shouldUseResultsShowcaseData()` | `src/components/Results/resultsShowcaseData.ts:85` | `shouldAllowDemoData()` (jawny toggle, NIGDY auto) |
| Zakładka Initiatives | `ResultsInitiativesView` | `src/components/Results/ResultsInitiativesView.tsx` | `trackedInitiatives[]` z ResultsHub |
| KPI — overview | `KpiOverviewView` | `src/components/Results/KpiOverviewView.tsx` | `kpis[]`, `v8Snapshot` |
| KPI — queue | `KpiQueueView` | `src/components/Results/KpiQueueView.tsx` | `kpis[]` (filtry needs-entry/below/discrepancy), signal sheets |
| KPI — catalog | `ResultsKpisTableV3` | `src/components/Results/ResultsKpisTableV3.tsx` | `kpis[]`, `TableWithPreviewLayout` |
| KPI — scorecards | `ResultsKpiScorecardsView` | `src/components/Results/ResultsKpiScorecardsView.tsx` | goals/OKR z API |
| KPI — time-series drawer | `KPITimeSeriesDrawer` | `src/components/Results/KPITimeSeriesDrawer.tsx` | data KPI z V8 lub legacy |
| KPI — signal sheet | `KpiSignalSheetView` | `src/components/Results/KpiSignalSheetView.tsx` | `SignalSheetRecord[]` |
| Reports — tracked | `ResultsKpiReportsView` | `src/components/Results/ResultsKpiReportsView.tsx` | lista raportów z `/results/kpi-reports` |
| Reports — schedules | `ResultsReportSchedulesView` | `src/components/Results/ResultsReportingEnterpriseViews.tsx` | schedules + approval chip |
| Reports — wallboards | `ResultsWallboardsView` | `src/components/Results/ResultsReportingEnterpriseViews.tsx` | wallboards z API |
| Reports — connectors | `ResultsKpiConnectorsView` | `src/components/Results/ResultsReportingEnterpriseViews.tsx` | connectors z API |
| ROI | `ROITrackingView` | `src/components/Results/ROITrackingView.tsx` | V8→fallback `/benefits/roi/portfolio/summary` |
| ROI drawer | `ROIDetailDrawer` | `src/components/Results/ROIDetailDrawer.tsx` | dane per inicjatywa |
| ROI Analysis | `ROIAnalysisView` | `src/components/Results/ROIAnalysisView.tsx` | V8→fallback `/benefits/roi/portfolio/summary` |
| KPI create modal | `KPICreateModal` | `src/components/Results/KPICreateModal.tsx` | form + `V8ResultsApi.createKpi()` |
| ROI open modal | `ROIOpenModal` | `src/components/Results/ROIOpenModal.tsx` | record ROI actual |
| Backend legacy | `benefits.routes.ts` (35 verbs) | `server/src/routes/benefits.routes.ts` | tabele: `initiative_kpis`, `kpi_time_series` |
| Backend V8 | `v8/results.routes.ts` (37 verbs) | `server/src/routes/v8/results.routes.ts` | tabele: `v8_kpi_definitions`, `kpi_time_series`, `v8_roi_realization_entries` |
| Backend enterprise | `results-enterprise.routes.ts` (19 verbs) | `server/src/routes/results-enterprise.routes.ts` | schedules/wallboards/connectors/ROI evidence |
| Backend KPI reports | `results-kpi-reports.routes.ts` (6 verbs) | `server/src/routes/results-kpi-reports.routes.ts` | `kpi_definitions`, semantic layer |
| Martwy | `BenefitsRealizationView` / `BenefitsHub` | `src/views/BenefitsRealizationView.tsx`, `AppRoutes.tsx:116` | NIGDY renderowany — `lazy`, brak JSX w drzewie |

### 0.2 Dual-runtime V8 → legacy (kiedy który odpala)

```
loadResultsKpis():
  → próbuje V8ResultsApi.getKpiCatalog()  [GET /api/v8/results/kpis/catalog]
    ├── sukces + dane: source = 'v8'
    ├── sukces + puste + demo=ON: source = 'showcase'
    └── błąd (shouldFallbackToLegacyResults()):
          → Api.get('/benefits/kpis') + '/benefits/kpi-mappings'  [legacy]
          └── source = 'legacy' | 'empty' | 'showcase'
```

**Ważne:** `source:'legacy'` wywołuje tylko `console.warn`, NIE renderuje żadnego banera (znany gap L-01). `source:'showcase'` renderuje chip "Showcase data — local" (`ResultsHub.tsx:909`).

ROI-path (oddzielny): `ROITrackingView` i `ROIAnalysisView` wywołują niezależnie `V8ResultsApi.getRoiPortfolioSummary()` → fallback `Api.get('/benefits/roi/portfolio/summary')`.

### 0.3 Zasada E2E (obowiązkowa)

Każda operacja MUSI być potwierdzona w Network (DevTools → zakładka Sieć):
- **Odczyt:** właściwy GET zwraca 200 + oczekiwany kształt danych
- **Zapis:** właściwy POST/PUT zwraca 201/200, po reloadzie dane trwałe
- **Bezpieczeństwo [SEC]:** oczekiwany status 403/404 na niedozwolonych operacjach

Sama zmiana w UI bez żądania sieciowego = FAIL.

### 0.4 Beta gating (krytyczne)

- Moduł `MODULE_BENEFITS` ma beta CLOSED dla WSZYSTKICH (łącznie z adminami).
- `/benefits` jest owinięty tylko w `<BetaGate>` (nawigacyjny) + `<ProductionModuleGate>` (produkcja).
- Brak dodatkowego guard'a na samej trasie → direct URL `/benefits` może ominąć sidebar lock dla zalogowanego użytkownika.
- Rola KPI (kto może tworzyć/edytować/usuwać) = JWT `req.user?.role` (po naprawie `91c8245559`).

### 0.5 Role

| Rola | Dostęp |
|---|---|
| `owner` (DBR77) | pełny (KPI read/write, Reports create/approve, ROI record) |
| `admin` | pełny (jak owner) |
| `member` | read-only (KPI read, Reports view, ROI view) |
| `viewer` | read-only; próba zapisu KPI → 403 |
| nieoprawniony / inna org | żądania do `/api/v8/results/*` z obcym tokenem → 401/403 |

---

## SETUP środowiska testowego

1. Uruchom dev server: Vite na `:3000` (FE), backend na `:3001` (lub wg `VITE_API_URL`).
2. Zaloguj się jako **owner DBR77** (pełny dostęp).
3. Otwórz DevTools → zakładka **Network** (filtr: `/benefits`, `/results`, `/v8/results`) + **Console** (0 błędów to wymóg).
4. Przygotuj dane testowe w bazie staging:
   - Co najmniej **2 inicjatywy w statusie DONE lub TRACKING** z przypisanym KPI (`initiative_kpis`).
   - Co najmniej **1 KPI z historią time-series** (`kpi_time_series`).
   - Co najmniej **1 KPI z wartością poniżej targetu** (status `below`).
   - Co najmniej **1 schedule raportów** (z `approval_required = TRUE`).
5. Miej pod ręką drugie konto (rola `viewer`) do testów [SEC].
6. **Uwaga PROD:** dev `.env.local` może wskazywać Railway PROD DB — sprawdź `DATABASE_URL` przed jakimkolwiek zapisem. Testy [DB] wykonuj wyłącznie na staging (caboose).

---

## §1 Hub i zakładka Initiatives

### 1.1 Wejście na `/benefits`

- Nawiguj do `/benefits` przez sidebar (kliknij „Rezultaty" lub odpowiednik).
- **Asercja:** ładuje się `ResultsHub`; aktywna zakładka = `results_initiatives` (domyślna gdy brak `?tab=`).
- **Asercja Network:** `GET /api/v8/results/kpis/catalog` (lub fallback `/api/benefits/kpis`) zwraca 200.
- **Asercja:** `GET /api/v8/results/dashboard` (snapshot) zwraca 200 + JSON z `kpiScorecard`, `roiDashboard`, `reconciliationHealth`.
- **Asercja Console:** 0 błędów; jeśli V8 niedostępny — dokładnie 1 `console.warn` z tekstem `[kpiRuntime] V8 Results API unavailable`.

### 1.2 Zakładka Initiatives — lista inicjatyw

- Kliknij zakładkę „Initiatives" (jeśli nie jest aktywna).
- **Asercja:** lista `ResultsInitiativesView` zawiera initywaty z `initiative_kpis`.
- **Asercja:** każda inicjatywa ma widoczny status (chip `EntityStatusChip`) i liczbę KPI (`trackedKpiCount`).
- **Asercja:** lifecycle bucket widoczny (np. „In realization" / „Post-implementation").

### 1.3 Filtrowanie inicjatyw

- Zmień filtr lifecycle (dropdown „Lifecycle: All" → „In realization").
- **Asercja:** lista odświeża się lokalnie (bez nowego requesta sieciowego) — filtrowanie jest client-side.
- Zmień filtr health → „At risk".
- **Asercja:** pozostają tylko inicjatywy at-risk.
- Zmień filtr KPI link → „Attached".
- **Asercja:** tylko inicjatywy z KPI.
- Reset filtrów → wszystkie inicjatywy wracają.

### 1.4 Drill-down na inicjatywę

- Kliknij inicjatywę z listy → otwiera preview po prawej stronie (`TableWithPreviewLayout`).
- **Asercja:** preview zawiera: nazwę, status, lifecycle, relacje KPI.
- Kliknij „Open KPIs" (lub odpowiednik) → przełącza do zakładki KPI, filtruje po tej inicjatywie.
- Kliknij „View initiative" → nawiguje do `/initiatives/:id` (M13).

### 1.5 Showcase fallback — zakładka Initiatives [FLAG]

- Warunek: baza staging pusta (brak inicjatyw) + demo=ON (włącz jawny toggle demo data).
- **Asercja:** lista zawiera showcase inicjatywy (np. „SMED rollout on bottleneck line").
- **Asercja:** widoczny chip „Showcase data — local" (niebieski, `ResultsHub.tsx:909`).
- **Asercja Network:** brak żadnego żądania POST/PUT na `/api/v8/results/*` — showcase nie przecieka do backendu.
- Wyłącz demo → lista pusta lub realne dane.

### 1.6 Pusty stan (brak inicjatyw, demo=OFF)

- Warunek: baza pusta + demo=OFF.
- **Asercja:** widoczny pusty stan (brak crasha), `source = 'empty'`, brak chipa „Showcase".

---

## §2 Zakładka KPI — 4 tryby

### 2.0 Przełączanie trybów KPI

- Kliknij zakładkę „KPI".
- **Asercja:** domyślny tryb = `catalog` (`kpiWorkspaceMode`).
- **Asercja URL:** `?tab=results_kpi&mode=catalog`.
- Kliknij kolejno: Overview → Queue → Catalog → Scorecards.
- **Asercja URL** per tryb: `?mode=overview`, `?mode=queue`, `?mode=catalog`, `?mode=scorecards`.
- Odśwież stronę z URL `?tab=results_kpi&mode=queue` → tryb zachowany (URL-driven state).

### 2.1 Tryb 1 — Overview (`mode=overview`)

**Komponent:** `KpiOverviewView`

- Kliknij tryb „Overview".
- **Asercja:** widoczne karty cockpit z liczbami: Governed KPIs, needs-entry, below-target, deviations.
- **Asercja:** liczby spójne z chipami w górnym pasku `governedRuntimeStrip` (np. „Governed KPIs: 5").
- **Asercja:** kliknięcie karty „Below target" → przełącza do trybu Queue z filtrem `below-target`.
- **Asercja:** kliknięcie karty „Needs entry" → przełącza do trybu Queue z filtrem `needs-entry`.
- **Asercja:** kliknięcie karty „Open deviations" → przełącza do trybu Queue z filtrem `discrepancy`.
- **Asercja Network:** brak nowego żądania przy przełączeniu — dane z już załadowanego `v8Snapshot`.

### 2.2 Tryb 2 — Queue (`mode=queue`)

**Komponent:** `KpiQueueView`

- Przejdź do trybu Queue.
- **Asercja:** KPIs pogrupowane wg terminów pomiaru (cadence: DAILY/WEEKLY/MONTHLY/QUARTERLY).
- **Asercja:** KPI „needs entry" (przeszłe terminy bez wpisu) widoczne w odpowiedniej grupie.

#### 2.2.1 Tworzenie signal sheet [FLAG]
- Kliknij „New signal sheet" (lub odpowiednik w Queue).
- **Asercja:** otwiera się formularz `KpiSignalSheetView`.
- Wypełnij: KPI, wartość, okres, notatka.
- Kliknij Zapisz.
- **Asercja Network:** `POST /api/benefits/kpis/:kpiId/time-series` (legacy) lub `POST /api/v8/results/kpis/:kpiId/time-series` (V8) → 201.
- **Asercja [DB]:** nowy wiersz w `kpi_time_series` z `kpi_id` = target, `organization_id` = org zalogowanego usera.
- Odśwież → wartość widoczna w historii KPI.

#### 2.2.2 Filtrowanie Queue
- Aktywuj filtr „Needs entry" → widoczne tylko te KPI.
- Aktywuj filtr „Below target" → tylko KPI `status='below'`.
- Aktywuj filtr „Discrepancy" → tylko KPI z otwartym `deviation_case`.
- Reset filtra → wszystkie grupy wracają.

### 2.3 Tryb 3 — Catalog (`mode=catalog`)

**Komponent:** `ResultsKpisTableV3`

- Przejdź do trybu Catalog.
- **Asercja:** lista KPI w `TableWithPreviewLayout` (tabela z kolumnami: Nazwa, Inicjatywa, Status, Trend, Wartość, Target, Faza).
- **Asercja:** `§27` — brak surowego `<table>` bez `TableWithPreviewLayout` (KpisTableV3 jest zgodny).

#### 2.3.1 Tworzenie KPI
- Kliknij „+ Add KPI" (topbar lub FAB).
- **Asercja:** otwiera się `KPICreateModal`.
- Wypełnij: Nazwa, jednostka, target, inicjatywa (powiąż z istniejącą).
- Kliknij Zapisz.
- **Asercja Network:** `POST /api/v8/results/kpis` → 201, body: `{id, organizationId, name, target, ...}`.
- **Asercja [DB]:** nowy wiersz w `v8_kpi_definitions` (lub `initiative_kpis`) z `organization_id` poprawnym.
- **Asercja:** nowe KPI widoczne w Catalog bez reloadu strony.

#### 2.3.2 Edycja KPI
- Kliknij KPI z listy → otwiera preview.
- W preview kliknij „Edit" (lub kebab → Edit).
- Zmień target → zapisz.
- **Asercja Network:** `PUT /api/v8/results/kpis/:kpiId` → 200.
- Odśwież → zmieniona wartość trwała.

#### 2.3.3 Usunięcie KPI
- Kliknij kebab na KPI → Delete.
- **Asercja:** dialog potwierdzenia.
- Potwierdź.
- **Asercja Network:** `DELETE /api/v8/results/kpis/:kpiId` → 200.
- **Asercja:** KPI znikło z listy; odśwież → dalej niewidoczne.

#### 2.3.4 KPI time-series drawer — zapis pomiaru
- Kliknij KPI w Catalog → otwiera `KPITimeSeriesDrawer`.
- Zakładka „Record" → wpisz wartość + period.
- Kliknij Zapisz.
- **Asercja Network (V8):** `POST /api/v8/results/kpis/:kpiId/time-series` → 201.
  - Fallback (V8 niedostępne): `POST /api/benefits/kpis/:kpiId/time-series` → 201.
- **Asercja [DB] [SEC]:** wiersz w `kpi_time_series` ma `organization_id` = org zalogowanego; UPDATE `initiative_kpis SET current_value` dotyczy KPI tej samej org (weryfikacja P0 cross-org — po naprawie `91c8245559` musi być bezpieczne).

#### 2.3.5 KPI time-series drawer — historia i deviation
- Zakładka „History" → widoczne poprzednie pomiary z datami.
- Zakładka „Deviation" → otwarta sprawa (`deviation_case`) jeśli istnieje: RCA, dowody, akcje.
- Dodaj akcję do sprawy → `POST /api/v8/results/deviation-cases/:caseId/actions` → 201.
- Zamknij drawer (X lub ESC) → drawer znika bez reloadu.

#### 2.3.6 Powiązanie KPI z inicjatywą (mapping)
- W drawerze KPI zakładka „Link" → wybierz inicjatywę.
- **Asercja Network:** `POST /api/v8/results/kpi-mappings` → 201.
- Usuń powiązanie → `DELETE /api/v8/results/kpi-mappings/:mappingId` → 200.

### 2.4 Tryb 4 — Scorecards (`mode=scorecards`)

**Komponent:** `ResultsKpiScorecardsView`

- Przejdź do trybu Scorecards.
- **Asercja Network:** `GET /api/v8/results/goals` (lub `/api/benefits/goals`) → 200, lista celów/OKR.
- **Asercja:** lista celów z `TableWithPreviewLayout`, kolumny: Cel, Typ, Status, Postęp, Target.
- Kliknij cel → otwiera preview z detalami (powiązane inicjatywy, rollup progress).

#### 2.4.1 Showcase w Scorecards [FLAG]
- Demo=ON + baza pusta → showcase goals widoczne.
- Chip „Showcase data — local" obecny.

### 2.5 Tworzenie KPI — kontrola roli [SEC] [FLAG]

- Zaloguj się jako `viewer` na drugim koncie.
- Wejdź na `/benefits` (bezpośredni URL, jeśli dostępny — patrz §6 beta-guard).
- Kliknij „+ Add KPI".
- **Asercja:** albo przycisk ukryty, albo próba zapisu → `POST /api/v8/results/kpis` → 403.
- **Asercja:** brak nowego KPI w bazie.

---

## §3 Zakładka Reports — 5 trybów enterprise

### 3.0 Przełączanie trybów Reports

- Kliknij zakładkę „Reports".
- **Asercja:** domyślny tryb = `tracked` (`reportWorkspaceMode`).
- **Asercja URL:** `?tab=results_reports&rmode=tracked`.
- Kliknij kolejno: Tracked → Reports → Schedules → Wallboards → Connectors.
- **Asercja URL** per tryb: `?rmode=tracked`, `?rmode=reports`, `?rmode=schedules`, `?rmode=wallboards`, `?rmode=connectors`.

### 3.1 Tryb 1 — Tracked (rmode=tracked)

- **Asercja:** widoczne KPI/inicjatywy aktualnie śledzone (analog Initiatives z perspektywy raportów).
- **Asercja:** lista inicjatyw z paginacją (jeśli wiele).

### 3.2 Tryb 2 — Reports (rmode=reports)

**Komponent:** `ResultsKpiReportsView`

- **Asercja Network:** `GET /api/results/kpi-reports` → 200, lista raportów.
- **Asercja:** lista raportów w `TableWithPreviewLayout` z kolumnami: Nazwa, Typ, Okres, Status, Data.
- Kliknij raport → preview: InitiativeCount, KpiCount, OpenActionCount.

#### 3.2.1 Tworzenie raportu KPI
- Kliknij „+ New report" (topbar).
- Wypełnij: `periodStart`, opcjonalnie KPI IDs.
- Kliknij Utwórz.
- **Asercja Network:** `POST /api/v8/results/kpi-reports` → 200, body: `{snapshotId, reportId}`.
  - Fallback (V8 OFF): `POST /api/results/kpi-reports`.
- **Asercja:** nowy raport widoczny na liście.

#### 3.2.2 Finalizacja/lock guard (approval gating — Reports)
- Warunek: KPI mają status finalized/locked.
- Kliknij „+ New report" na tych KPI.
- **Asercja Network:** `POST /api/v8/results/kpi-reports` → **409** z `code: 'KPI_FINALIZED'` lub podobnym.
- **Asercja UI:** toast z komunikatem błędu; raport nie powstaje.

#### 3.2.3 Odświeżenie raportu (refresh)
- Kliknij kebab na raporcie → „Refresh".
- **Asercja Network:** `POST /api/v8/results/kpi-reports/:snapshotId/refresh` → 200.
- **Asercja:** status raportu zmieniony.

#### 3.2.4 Showcase Reports [FLAG]
- Demo=ON + brak raportów → showcase raporty widoczne (fixtures z `createResultsShowcaseReports()`).
- Chip „Showcase data — local" obecny.

### 3.3 Tryb 3 — Schedules (rmode=schedules)

**Komponent:** `ResultsReportSchedulesView`

- **Asercja Network:** `GET /api/results-v4/kpi-report-schedules` → 200, lista schedulów.
- **Asercja:** lista z `TableWithPreviewLayout`, kolumny: Nazwa, Cron, Status, Approval, LastSent, NextRun.
- **Asercja:** chip `ScheduleApprovalChip` poprawny per rekord (Auto / Approved / Awaiting / Rejected).

#### 3.3.1 Tworzenie schedule
- Kliknij „+ New schedule".
- Wypełnij: reportName, kpiIds[], scheduleCron, recipientPolicy, `approvalRequired: true`.
- Kliknij Utwórz.
- **Asercja Network:** `POST /api/results-v4/kpi-report-schedules` → 201.
- **Asercja [DB]:** nowy wiersz w `kpi_report_schedules` z `approval_required = 1`, `approval_status = 'pending'`.

#### 3.3.2 Approval workflow — pełna ścieżka [kluczowe]
**Krok A — schedule z `approval_required=true` w stanie NOT approved:**
- Kliknij „Run now" na schedule z `approvalRequired=true` + `approvalStatus != 'approved'`.
- **Asercja Network:** `POST .../run` → 200, body: `{status: 'awaiting_approval'}` (nie 'sent').
- **Asercja UI:** status schedule = `awaiting_approval`, chip zmieniony.

**Krok B — zatwierdzenie:**
- Kliknij „Approve" na schedule (kebab lub przycisk).
- **Asercja Network:** `POST /api/results-v4/kpi-report-schedules/:scheduleId/approve` → 200.
- **Asercja [DB]:** `approval_status = 'approved'`, `approved_by` = id usera, `approved_at` ustawiony.
- **Asercja UI:** chip → „Approved" (zielony).

**Krok C — uruchomienie po zatwierdzeniu:**
- Kliknij „Run now" ponownie.
- **Asercja Network:** `POST .../run` → 200, body: `{status: 'sent'}` (lub inny sukces).

**Krok D — log dostaw:**
- Otwórz preview schedule → sekcja „Delivery log".
- **Asercja Network:** `GET .../delivery-log` → 200, lista deliveries.

#### 3.3.3 Cron runtime [FLAG]
- Kliknij „Run due" (lub wymuś przez `POST /api/results-v4/runtime/run-due`).
- **Asercja:** brak crasha; schedule uruchomiony.
- **Asercja:** schedules z `approvalRequired=true` i `approvalStatus != 'approved'` zwracają `awaiting_approval`, nie wysyłają.

### 3.4 Tryb 4 — Wallboards (rmode=wallboards)

**Komponent:** `ResultsWallboardsView`

- **Asercja Network:** `GET /api/results-v4/wallboards` → 200.
- **Asercja:** lista wallboardów z kolumnami: Nazwa, KPI count, Refresh interval, Status.

#### 3.4.1 Tworzenie wallboard
- Kliknij „+ New wallboard".
- Wypełnij: name, kpiIds[], refreshIntervalSeconds.
- **Asercja Network:** `POST /api/results-v4/wallboards` → 201.

#### 3.4.2 Alerty wallboard
- Otwórz wallboard → sekcja alertów.
- **Asercja Network:** `GET /api/results-v4/wallboards/:wallboardId/alerts` → 200.
- Dodaj alert → `POST .../alerts` → 201.

### 3.5 Tryb 5 — Connectors (rmode=connectors)

**Komponent:** `ResultsKpiConnectorsView`

- **Asercja Network:** `GET /api/results-v4/kpi-connectors` → 200.
- **Asercja:** lista konektorów z kolumnami: Nazwa, Typ, KPI count, LastRun, Status.

#### 3.5.1 Tworzenie konektora
- Kliknij „+ New connector".
- Wypełnij: connectorName, connectorType (`manual`), config `{}`, targetKpiIds[].
- **Asercja Network:** `POST /api/results-v4/kpi-connectors` → 201.

#### 3.5.2 Uruchomienie konektora
- Kliknij „Run now" na konektorze.
- **Asercja Network:** `POST /api/results-v4/kpi-connectors/:connectorId/run` → 200 lub 404 jeśli nie znaleziono.

#### 3.5.3 Connector IRIS — secrets [SEC] [FLAG]
- Zaloguj się jako zwykły `member` (nie admin).
- Wywołaj `GET /api/mcp/providers` (przez DevTools lub curl).
- **Asercja:** pole `config` (zawierające plaintext tokeny/klucze) NIE zwracane dla non-admina → 403 lub brak pola `config` w odpowiedzi.
- **Uwaga:** znany gap L-02 (P2) — może FAIL; odnotuj wynik.

---

## §4 Zakładka ROI

### 4.1 Portfolio summary

**Komponent:** `ROITrackingView`

- Kliknij zakładkę „ROI".
- **Asercja Network (V8):** `GET /api/v8/results/roi/portfolio-summary` → 200, body: `{items[], summary: {totalProjected, totalRealized, ...}}`.
  - Fallback: `GET /api/benefits/roi/portfolio/summary` → 200.
- **Asercja:** widoczne karty summary: Total Projected, Total Realized, Variance, Coverage %.
- **Asercja:** lista inicjatyw z kolumnami: Nazwa, Status, Projected, Realized, Variance, Confidence.

### 4.2 ROI status chips

- **Asercja:** inicjatywy kolorowane wg statusu: on-track (zielony) / below (czerwony) / above (niebieski/złoty).
- Kliknij inicjatywę → otwiera `ROIDetailDrawer`.
- **Asercja Network:** `GET /api/v8/results/roi/initiative/:initiativeId/detail` → 200.
- **Asercja:** drawer zawiera breakdown (CAPEX, benefity, NPV, payback period).

### 4.3 Record actual ROI

- Kliknij „Record actual" (topbar lub FAB).
- **Asercja:** otwiera `ROIOpenModal`.
- Wypełnij: initiativeId, value, period, evidenceType (`measurement`).
- Kliknij Zapisz.
- **Asercja Network:** `POST /api/results-v4/roi-evidence` → 201.
- **Asercja [DB]:** nowy wiersz w tabeli roi evidence z `organization_id` poprawnym.
- Odśwież → Realized zmieniony.

### 4.4 Verify ROI evidence

- Kliknij „Verify" na wpisie evidence.
- **Asercja Network:** `POST /api/results-v4/roi-evidence/:evidenceId/verify` → 200.
- **Asercja:** status evidence zmieniony na `verified`.

### 4.5 ROI showcase [FLAG]

- Demo=ON + brak danych ROI → dane showcase widoczne.
- Chip „Showcase data — local".
- **Asercja:** brak POST na `/api/v8/results/roi/*` podczas wyświetlania showcase.

### 4.6 Integracja M15→M16 (ROI → Finanse)

- W `ROIDetailDrawer` sprawdź, czy dane NPV/payback są obliczeniami z `v8_roi_realization_entries` + `kpi_financial_mappings` (nie hardkodowane).
- Nawiguj do M16 Finanse (`/finance`): ekonomia inicjatywy powinna być spójna z wartościami ROI z M15.
- **Asercja:** wartości „Total realized" w M15 ROI są spójne z danymi finansowymi w M16 dla tej samej inicjatywy.

---

## §5 Zakładka ROI Analysis

### 5.1 Dashboard

**Komponent:** `ROIAnalysisView`

- Kliknij zakładkę „ROI Analysis".
- **Asercja Network:** `GET /api/v8/results/roi/portfolio-summary` (lub fallback `/benefits/roi/portfolio/summary`) → 200.
- **Asercja:** widoczne metryki análizy: NPV, IRR, Payback period, anomalie.
- **Asercja:** inicjatywy kategoryzowane (kategoria z pola `category`).

### 5.2 Szanse i anomalie

- **Asercja:** inicjatywy z `status='above'` (powyżej targetu) wyróżnione jako szanse.
- **Asercja:** inicjatywy z `status='below'` wyróżnione jako ryzyka/anomalie (ikona `AlertTriangle`).

### 5.3 ROI Analysis — funnel analytics

- **Asercja:** przy wejściu na zakładkę `trackFunnelEvent('roi_analysis_view')` lub analogiczny event wywoływany (weryfikuj `import { trackFunnelEvent }` w `ROIAnalysisView.tsx:31`).

### 5.4 ROI Analysis — fallback do legacy

- Symuluj V8 niedostępne (np. zablokuj `/api/v8/*` w Network DevTools → throttle/block).
- **Asercja:** ROIAnalysisView ładuje dane z `/api/benefits/roi/portfolio/summary`.
- **Asercja:** brak białego ekranu / crash.

---

## §6 Dual-runtime V8 vs legacy

### 6.1 V8 ON (normal flow) [FLAG]

- Normalny start → `loadResultsKpis()` odpytuje `/api/v8/results/kpis/catalog`.
- **Asercja Network:** `GET /api/v8/results/kpis/catalog` → 200.
- **Asercja:** `resultsSource = 'v8'`, chip „Showcase data" NIEWIDOCZNY, brak `console.warn` o fallbacku.
- **Asercja:** w górnym pasku widoczne chropy: „Governed KPIs: N", „Deviations: N", „Realized ROI: N", „Reconciliation: N".

### 6.2 V8 OFF / niedostępne — fallback do legacy [FLAG]

- Zablokuj endpoint `/api/v8/results/kpis/catalog` (DevTools → Network → Block request URL).
- Przeładuj `/benefits`.
- **Asercja Console:** dokładnie 1 `console.warn` z tekstem `[kpiRuntime] V8 Results API unavailable`.
- **Asercja Network:** `GET /api/benefits/kpis` + `GET /api/benefits/kpi-mappings` → 200.
- **Asercja:** KPI z legacy ładują się poprawnie.
- **Asercja znany gap (L-01):** `source = 'legacy'` NIE renderuje banera degradacji — odnotuj jako KNOWN FAIL (czeka na fix).
- **Asercja:** brak crasha, brak białego ekranu.

### 6.3 Degraded banner — weryfikacja gaps (L-01) [FLAG]

- Patrz §6.2.
- **Oczekiwane (po naprawie L-01):** baner `source:'legacy'` renderowany podobnie do `FinanceDegradedBanner` w M16.
- **Stan obecny:** BRAK banera — tylko `console.warn` — to jest **znany defekt P2 (L-01)**.
- Odnotuj: `source:'legacy'` widoczny tylko w chipsie (jeśli zaimplementowany) lub w konsoli.
- **Asercja aktualnego kodu (linia 916):** chip `ResultsRuntimeChip` z `label='Legacy data', value='fallback'` pojawia się gdy `resultsSource === 'legacy'` (sprawdź czy kod w tej wersji już ma ten blok — w `ResultsHub.tsx:916-920`).

### 6.4 Source chip — weryfikacja

- V8 ON, dane realne → brak chipa showcase, brak chipa legacy.
- V8 OFF, dane legacy → chip „Legacy data — fallback" (jeśli zaimplementowany).
- Demo=ON, dane puste → chip „Showcase data — local" (niebieski, `ResultsHub.tsx:909`).

### 6.5 ROI path — oddzielny dual-runtime

- Zablokuj `/api/v8/results/roi/*`.
- Przejdź do zakładki ROI.
- **Asercja:** `ROITrackingView` i `ROIAnalysisView` wracają do `/api/benefits/roi/portfolio/summary`.
- **Asercja:** brak crasha.

---

## §7 BenefitsHub — weryfikacja martwości

### 7.1 BenefitsHub nigdy nie renderowany [MANUAL]

- Przeszukaj kod: `grep -r "BenefitsHub" src/` — jedyne trafienie to `AppRoutes.tsx:116` (lazy import) i plik źródłowy.
- **Asercja:** `BenefitsHub` NIE jest używany jako `<BenefitsHub />` w żadnym aktywnym JSX.
- **Asercja:** `BenefitsRealizationView` podobnie — tylko lazy import, nigdy renderowany.
- **Asercja:** trasa `/benefits` w `AppRoutes.tsx:2167–2182` montuje `ResultsHub`, nie `BenefitsRealizationView`.

### 7.2 Bezpośredni URL do martwego widoku [MANUAL]

- Sprawdź czy istnieje jakaś inna trasa prowadząca do `BenefitsRealizationView` — przez grep `AppRoutes.tsx`.
- **Asercja:** brak aktywnej trasy (0 `<Route ... element={<BenefitsRealizationView`).
- Jeśli trasa istnieje → odnotuj jako defekt.

### 7.3 Beta-guard na /benefits — direct URL [MANUAL] [SEC]

- Zaloguj się jako user (dowolna rola).
- Wpisz bezpośrednio URL `/benefits` w przeglądarce (nie przez sidebar).
- **Asercja:** strona ładuje się (użytkownik zalogowany ma dostęp nawet przez direct URL — znany gap L-03).
- **Asercja znany gap (L-03):** brak beta-guarda na samej trasie (tylko `ProductionModuleGate`); direct URL OMIJA sidebar lock.
- Odnotuj wynik: czy widoczny moduł czy plate / redirect.

---

## §8 Ścieżki cross-module

### 8.1 M13 → M15 (Inicjatywa DONE → Results tracking)

- W M13 Inicjatywy (`/initiatives`) zmień status inicjatywy na `DONE`.
- Przejdź do M15 (`/benefits`) → zakładka Initiatives.
- **Asercja:** inicjatywa widoczna w liście tracked (przez `initiative_kpis` join).
- Kliknij „View initiative" w preview → wraca do M13 dla tej inicjatywy.

### 8.2 M15 → M16 (ROI → Finanse)

- W `ROIDetailDrawer` kliknij ewentualny link do Finance.
- **Asercja:** nawigacja do `/finance` lub `/economics/analyses/:id`.
- W M16 sprawdź, że dane finansowe inicjatywy są spójne z ROI z M15.

### 8.3 M14 → M15 (Wdrożenie DONE → Tracking)

- Otwórz inicjatywę w `results_reports` → przycisk „View execution" lub „Go to implementation".
- **Asercja Network:** nawigacja do `/implementation?initiativeId=...` (M14).
- Callback: z M14 do M15 przez `openScopedExecutionLane()` (`ResultsHub.tsx:748`).

### 8.4 M15 → M13 (Results → Inicjatywa — feedback loop)

- Kliknij „View initiative" w preview Initiatives.
- **Asercja:** nawigacja do `ROUTES.INITIATIVES` z `?initiativeId=` lub otwarcie dokumentu inicjatywy przez `ResultsInitiativeDocumentView` (lazy).
- **Asercja:** dokument inicjatywy ładuje się w hub-tab (open document).

### 8.5 M20 → M15 (Tabele publish-to-results — dead-end) [FLAG]

- Zweryfikuj: `publish-to-results` z M20 pisze do `tp_module_sync_results`.
- **Asercja:** brak żadnego endpointu w Results czytającego `tp_module_sync_results` (0 trafień grep w `server/src/routes/v8/results.routes.ts`).
- **Odnotuj:** dead-end L-05 (DP-6 = preview teraz; realny odbiór = osobna fala).

---

## §9 Testy przekrojowe

### 9.1 Beta gating (dla wszystkich ról)

- Zaloguj się jako rola `member`.
- **Asercja:** w sidebarze zakładka „Rezultaty" jest locked (badge beta lub brak widoczności).
- Mimo to wejdź przez direct URL `/benefits` (znany gap L-03).
- **Asercja:** jeśli zalogowany → moduł dostępny (to jest defekt L-03, odnotuj).
- Wyloguj → wejdź na `/benefits` → redirect do logowania lub 401.

### 9.2 Showcase — szczelność (nie przecieka do DB) [FLAG] [SEC]

- Demo=ON, puste dane.
- Przeglądaj KPI showcase, ROI showcase, Reports showcase.
- **Asercja Network:** 0 żądań `POST/PUT/PATCH` na `/api/v8/results/*` ani `/api/benefits/*` podczas samego przeglądania showcase.
- **Asercja [DB]:** brak nowych wierszy w `kpi_time_series`, `v8_kpi_definitions`, `kpi_report_schedules`.
- Chip „Showcase data — local" widoczny przez cały czas.

### 9.3 Persistencja (reload)

- Wejdź na `?tab=results_kpi&mode=queue`.
- Odśwież (F5) → tryb zachowany.
- Wejdź na `?tab=roi_analysis`.
- Odśwież → zakładka zachowana.

### 9.4 i18n — PL/EN

- Zmień język na EN → wszystkie etykiety w angielskim (używa `t()`, 0× `isPolish`).
- Zmień na PL → polskie etykiety.
- **Asercja:** 0 hardkodowanych polskich/angielskich ciągów widocznych w UI (najzdrowszy moduł: 952× `t()`).
- **Asercja [DB]:** `grep -r "isPolish\|i18n.language === 'pl'" src/components/Results/` → 0 trafień (utrzymać standard).

### 9.5 Dark mode

- Przełącz dark mode.
- **Asercja:** wszystkie widoki (Overview/Queue/Catalog/Scorecards/Reports/ROI) renderują się poprawnie.
- **Asercja:** 0 twardych hex kolorów — `grep -r "#[0-9a-fA-F]" src/components/Results/` → 0 trafień (utrzymać).

### 9.6 Zero błędów konsoli

- Przejdź przez wszystkie 5 zakładek + zmień tryb w KPI i Reports.
- **Asercja:** Console: 0 błędów (tylko ewentualny 1 `console.warn` z `[kpiRuntime]` jeśli V8 niedostępne).

### 9.7 Responsywność / viewport

- Zmień viewport do 1024px i 1440px.
- **Asercja:** tabele nie uciekają poza ekran; preview panel używalny; topbar nie nakłada się.

### 9.8 A11y

- Użyj Tab do nawigacji po zakładkach (Initiatives / KPI / Reports / ROI / ROI Analysis).
- **Asercja:** `role="tab"` i `aria-selected` poprawne; focus widoczny.
- Select lifecycle `<select>` ma `aria-label` (sprawdź `ResultsControlSelect.tsx`, linia ~119).
- `KpiOverviewView` — karty cockpit: klikalne `<button>` (nie div).

### 9.9 Wydajność — KPI time-series na dużej serii

- Otwórz drawer KPI z >50 wpisami.
- **Asercja:** drawer ładuje się < 2s; paginacja lub limit na agregacie (sprawdź query).

---

## §10 Testy regresji automatyczne

Uruchom testy automatyczne M15:

```bash
# FE smoke (3 pliki)
npx vitest run src/components/Results/__tests__/

# BE (rezultaty + IDOR + approval)
npx vitest run server/src/**/__tests__/results*
npx vitest run server/src/routes/v8/__tests__/results*
```

### 10.1 Oczekiwane wyniki (przed naprawą)

| Blok | Oczekiwane | Znany drift |
|---|---|---|
| FE smoke (ResultsHub, ROIAnalysisView, ResultsKpiReportsView) | 13 PASS, 0 FAIL | — |
| BE resultsROIService / runtime / routes / p04-kpi | ~239 PASS | **5 FAIL (test-drift)** |
| BE finalization-guard | PASS | — |

### 10.2 Znane 5 FAIL test-drift (do naprawy, L-08)

1. 4× `resolveReconciliation` — stary mock nie obejmuje `notificationService.send` (`:56`).
2. 1× `getResultsKpiCatalog` — `toEqual` na starym kształcie (mapping urósł o 6 pól → zmień na `toMatchObject`).

**Asercja:** po naprawie L-08 — 0 FAIL.

### 10.3 Brakujące testy (backlog L-09/L-10)

- B3: test szczelności showcase demo=ON (showcase nie przecieka do `/api/v8/results/*`).
- B4: fallback V8-OFF (`source='legacy'`) nie crashuje.
- B5: cron `runtime/run-due` z `approvalRequired=true` zatrzymuje się na `awaiting_approval`.

---

## §11 Mapa epików → pokrycie testów

| Epik | Story | Sekcja testu | Status pokrycia |
|---|---|---|---|
| EPIK 1 — Bezpieczeństwo P0 | 1.1 cross-org time-series write | §2.3.4 [DB][SEC] | pokryty |
| EPIK 1 — Bezpieczeństwo P0 | 1.1 RBAC bypass `x-kpi-role` | §2.5 [SEC] | pokryty |
| EPIK 2 — Widoczność degradacji P2 | 2.1 baner `source:'legacy'` | §6.2, §6.3 | pokryty (KNOWN FAIL L-01) |
| EPIK 3 — Bezpieczeństwo drugorzędne | 3.1 connector secrets non-admin | §3.5.3 [SEC] | pokryty |
| EPIK 3 — Bezpieczeństwo drugorzędne | 3.1 beta-route direct URL | §6 →§7.3 [SEC] | pokryty (KNOWN FAIL L-03) |
| EPIK 4 — Integracja M20 dead-end | 4.1 publish-to-results | §8.5 [FLAG] | pokryty (odnotuj dead-end) |
| EPIK 5 — Szlif BenefitsHub | 5.1 BenefitsHub martwy | §7.1, §7.2 | pokryty |
| EPIK 6 — Testy auto | 6.1 5 FAIL drift | §10.2 | pokryty (opisane FAIL) |
| S1 tracked initiatives + filtry | — | §1.2, §1.3 | pokryty |
| S2 KPI 4 tryby + time-series | — | §2.1–2.4 | pokryty |
| S3 Reports 5 trybów + cron + approval | — | §3.1–3.5 | pokryty |
| S4 ROI portfolio + edytor założeń | — | §4.1–4.4 | pokryty |
| S5 ROI Analysis | — | §5.1–5.4 | pokryty |
| S6 showcase/demo-data | — | §1.5, §2.4.1, §3.2.4, §4.5, §9.2 | pokryty |
| S7 dual-runtime V8→legacy | — | §6.1–6.5 | pokryty |

---

## Format raportu z testu

Po wykonaniu pełnego cyklu testerskiego uzupełnij poniższy szablon:

```
# Raport testu M15 — Rezultaty
Data: ___
Tester: ___
Środowisko: staging / prod (caboose / centerbeam)
Commit/branch: ___

## Wyniki per sekcja

| Sekcja | PASS | FAIL | SKIP | Uwagi |
|--------|------|------|------|-------|
| §1 Initiatives | | | | |
| §2 KPI 4 tryby | | | | |
| §3 Reports 5 trybów | | | | |
| §4 ROI | | | | |
| §5 ROI Analysis | | | | |
| §6 Dual-runtime | | | | |
| §7 BenefitsHub | | | | |
| §8 Cross-module | | | | |
| §9 Przekrojowe | | | | |
| §10 Testy auto | | | | |
| **RAZEM** | | | | |

## Znane FAIL (oczekiwane)
- L-01: baner V8→legacy niewidoczny — KNOWN FAIL (P2)
- L-03: beta-guard na trasie `/benefits` omijany direct URL — KNOWN FAIL (P2)
- L-08: 5 FAIL test-drift (auto) — KNOWN FAIL (do naprawy)

## Nowe FAIL (nieoczekiwane)
- [ lista nowych defektów ]

## Dowody
- Screenshots: ...
- Network HAR: ...
- DB query wyniki: ...
```

---

## Definition of Done (DoD)

- [ ] 1. Wszystkie sekcje §1–§9 PASS (z wyjątkiem znanych L-01/L-03/L-08 odnotowanych)
- [ ] 2. Testy auto §10: PASS po naprawie drift (0 FAIL)
- [ ] 3. 0 nowych błędów konsoli (poza `console.warn` o fallbacku)
- [ ] 4. Showcase nie przecieka do backendu (§9.2 PASS)
- [ ] 5. Oba P0 (`91c8245559`): cross-org time-series PASS + RBAC bypass PASS
- [ ] 6. BenefitsHub potwierdzony martwy (§7.1–7.2 PASS)
- [ ] 7. i18n: 0 `isPolish` w katalogu Results (grep czyste)
- [ ] 8. Dual-runtime: fallback bez crasha (§6.2 PASS)
- [ ] 9. Approval workflow: pełna ścieżka draft→awaiting→approved→sent PASS (§3.3.2)
- [ ] 10. Cross-module: M13↔M15↔M16 nawigacja spójna (§8.1–§8.4 PASS)

# F0. Finanse — audyt luki backend ↔ frontend (weryfikacja tezy właściciela)

> **Baza pomiaru.** Worktree `/private/tmp/m03`, gałąź `codex/m03-admin-20260824`, HEAD
> `888e8a52b9` (05.09.2026, 19:46). Staging odpytany na żywo: `GET /api/health` → `gitSha`
> `dda794943ee1ec1e8e88b4eb0805658f976f3d59`.
> **Zero zmian w kodzie w tej paczce** — to dokument pomiarowy.
> **Teza do zweryfikowania (właściciel, 05.09):** „Mam wrażenie, że backend Finansów mamy
> kompletny, a frontend jest zupełnie nieprzygotowany."
> **Zasada:** uczciwość ponad optymizm. Każda liczba niżej ma komendę albo `plik:linia`.
> Trzy liczby nadzorcy przeliczone od zera w §6 — jedna wyszła inna niż w rejestrze.

---

## 1. Werdykt do tezy właściciela (pięć zdań, z liczbami)

1. **Teza jest odwrócona w obu połowach.** Backend NIE jest kompletny: przy 132 tabelach
   `finance_*`/`financial_*` w migracjach, 138 plikach serwisów i 178 plikach testów (w tym 89 na
   realnym Postgresie) **sześć tabel kanonicznych nie ma ani jednego producenta w kodzie
   produkcyjnym** — `finance_stmt_calendars`, `finance_stmt_periods`, `finance_baseline_models`,
   `finance_analysis_definitions`, `finance_analysis_kpi_values`, `finance_analysis_benchmarks`
   (pomiar §2.3; F-program mówił o pięciu — dwie z rodziny Analizy dokładam ja).
2. **Frontend NIE jest „zupełnie nieprzygotowany":** 134 pliki w `src/components/Finance/**` +
   87 w `src/components/Economics/**`, lista L1 z pięcioma zakładkami stoi na `StandardTable` +
   `StandardPreview` (`FinanceHub.tsx:47-56`), pokazuje realne dane DBR77 (14 sprawozdań, 2 modele,
   4 wyceny), a odbiór CTO z 05.09 zamknął **9 z 13 ekranów jako OK**, przy czym **wszystkie 4
   defekty są opisane jako „wymagają pracy backendowej"**
   (`docs/program/ODBIOR_CTO_20260905/09-10-11.md:27,42`).
3. **Realna luka nie jest luką „brakuje ekranów", tylko luką „ekran jest, dane nie powstają":**
   z 22 zdolności backendu (§4) **5 ma pełny przewód do ekranu osiągalnego z menu (23 %)**,
   6 stoi za flagą domyślnie OFF (27 %), 4 mają ekran, ale przewód kończy się błędem lub pustką
   (18 %), 1 ma gotowego klienta bez ani jednego wołacza, a 4 trasy backendu nie mają w `src/`
   żadnego wołacza (martwe).
4. **Jeden pojedynczy fakt tłumaczy większość pustych ekranów:** `finance_baseline_models` ma
   zero `INSERT`-ów poza jednym skryptem dowodowym i testami, a kontrakt
   `baselineContextService.ts` wymaga tego wiersza **przed** czymkolwiek innym — więc żaden model
   bazowy nie dojdzie do `APPROVED`, przez co pusty jest także chooser źródła Wyceny i panel
   Porównania (łańcuch potwierdzony pomiarem, nie przepisany z rejestru).
5. **Wniosek dla programu:** Finanse nie potrzebują „zrobienia frontendu od nowa" — potrzebują
   **sześciu producentów danych i trzech przełączników** (siedem pozycji „za flagą OFF" z §4 stoi
   na trzech flagach — pięć narzędzi warsztatu ma jeden wspólny mount
   `FinanceWorkspaceUtilities.tsx`), plus polszczyzny na ekranie flagowym
   (21 twardych etykiet EN, `FinanceValuePanelsSurface.tsx:80-100`). To zmienia wycenę: MINIMUM
   MVP jest osiągalne w **8 sesjach Codexa**, PEŁNY w **24** — plan paczkowy w
   `F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md`.

---

## 2. Inwentarz backendu

### 2.1 Zamontowane rodziny tras (`server/src/Gateway.ts`, `server/src/routes/v8/index.ts`)

| Zdolność | Trasa (mount) | Kontroler / serwis | Tabele | Bramka | Testy |
| --- | --- | --- | --- | --- | :-: |
| Import sprawozdania (legacy) | `POST /api/v8/finance/statements/upload-and-analyze` — allowlista `financeStatementMountedSurface.ts:18` (omija `v8FeatureGate`) | `financialStatementService.ts` | `financial_statements`, `financial_statement_packs`, `financial_statement_versions` | `MODULE_ECONOMICS` (closed, wyjątek OWNER/ADMIN) | tak |
| Mapowanie linii (kanoniczne) | `POST /api/v8/finance-v2/statements/:bv/map` (`statements.routes.ts:57`) | `statementMappingService.ts` | `finance_stmt_lines` | v8 global + `MODULE_ECONOMICS` | `.pg` |
| Uzgodnienie / rekoncyliacja | `POST …/statements/:bv/reconcile` (`:106`), `GET …/reconciliation-runs` (`:234`) | `statementReconciliationService` | `finance_stmt_*` | jw. | `.pg` |
| Pakiet sprawozdań (rejestr) | `GET /api/v8/finance/statement-packs`, `…/:id` (allowlista) | `statementPackRegistrationService.ts:72` | `finance_artifacts`, `finance_business_versions`, `finance_artifact_aliases` | allowlista | tak |
| Zatwierdzanie / wersje bazowe | `POST /api/v8/finance-v2/versions/:bv/transitions` (`versions.routes.ts:118`), `POST /models/:id/approve|reopen` (`models.routes.ts:105,200`) | `artifactVersionService.ts` | `finance_business_versions`, `finance_lifecycle_events` | v8 + moduł | `.pg` |
| Analiza historyczna | `POST /finance-v2/analysis/:bv/compute` (`analysis.routes.ts:83`), `GET …/kpi-values` (`:130`), `GET /analysis/kpi-catalog` (`:39`) | `kpiComputeService.ts` | `finance_analysis_kpi_values` (**tylko UPDATE**), `finance_analysis_kpi_catalog` (seed z migracji) | v8 + moduł | `.pg` |
| Model finansowy (legacy) | `/api/financial-modeling/*` (Gateway `:1470`) | `financialModelingService.ts:1393` | `financial_models`, `financial_model_versions` | `gatewayVerifyToken` + `MODULE_ECONOMICS` | tak |
| Model bazowy (kanoniczny) | `GET/PUT /finance-v2/baseline/:bv/context` (`baseline.routes.ts:47,66`), `assumptions` (`:130,178,243`), `compute` (`:269`), `outputs` (`:322`) | `baselineContextService.ts`, `baselineComputeService.ts` | `finance_baseline_models`, `…_workspace_contexts`, `…_assumptions`, `…_outputs`, `…_schedules` | v8 + moduł | `.pg` |
| Prognoza / predykcja | `/finance-v2/prediction/:bv/{authoring,preflight,calculate}` (`prediction.routes.ts:46,69,116,163`) | `predictionAuthoringService.ts` | `finance_prediction_*` (11 tabel) | v8 + moduł | `.pg` |
| Wycena | `/finance-v2/valuation/*` — 34 rejestracje tras (`valuation.routes.ts`) + `/api/v8/finance-valuation/*` | `valuationRegistrationService`, `valuationVariantService`, `valuationSourceBindingService` | `finance_valuation_*` | v8 + moduł | `.pg` |
| Panele wartości (21 narzędzi) | `/api/v8/finance-value`, `/finance/value-tracking`, `/finance-planning`, `/finance-intelligence` | 27 silników M16 | `finance_*` value/ledger | v8 + moduł | częściowo |
| Porównanie wersji | `/finance-v2/compare/{periods,versions,entities,scenarios,valuation-methods,actual-vs-forecast}` (`compare.routes.ts:93-265`) | `financeCompareService.ts` | odczyt | v8 + moduł | `.pg` |
| Eksport / import XLSX | `GET /finance-v2/export/statement-pack/:artifactId/:bv` (`export-import.routes.ts:67`), `POST /import/{parse,preview,apply}` (`:98,120,212`) | `financeExportService.ts`, `financeExcelShared.ts` | `finance_export_manifests`, `finance_import_receipts` | v8 + moduł | `.pg` |
| Rodowód / nawigator | `POST /versions/:src/derived-analysis` (`lineage-navigator.routes.ts:227`), `POST /versions/lineage-edges` (`:361`), `GET …/lineage-navigator` (`:445`) | `lineageService.ts` | `finance_lineage_edges` (append-only) | v8 + moduł | `.pg` |
| Komentarze | `/finance-v2/comments/*` — 17 rejestracji | `finance/collaboration/*` | `finance_comments`, `finance_comment_assignments` | v8 + moduł | `.pg` |
| Widoki zapisane | `/finance-v2/saved-views/*` — 6 rejestracji (`saved-views.routes.ts:86-225`) | `savedViewService.ts` | `finance_saved_views` | v8 + moduł | `.pg` |
| Zadania obliczeniowe | `/finance-v2/compute/jobs*` (`compute.routes.ts:77,142,166,204`) | `computeJobService.ts` | `compute_jobs` | v8 + moduł | `.pg` |
| Wyjątki / świeżość | `/finance-v2/versions/:bv/{lineage,freshness-events}`, `/exceptions/{open,inbox}` (`crosscutting.routes.ts:39-148`) | `financeExceptionService` | `finance_exceptions`, `…_freshness_events` | v8 + moduł | `.pg` |
| Handoff kandydatów | `/api/finance/candidate-handoff/{investment-case,digitization-analysis,statement-pack,valuation-recommendation}` (Gateway `:1484-1505`) | 4 osobne routery | `finance_candidate_handoffs`, `initiative_candidates` | `gatewayVerifyToken` + `tenantStrictMembership` | tak |
| Budżety | `/api/budgets` (`:969`), `/api/budget` (`:1436`) | `budgets.routes.ts`, `budget.routes.ts` | `budgets`, `finance_budget_*_receipts` | `verifyToken` | częściowo |
| Finance enterprise (v4) | `/api/finance-v4` (`:1507`) | `finance-enterprise.routes.ts` | jw. | `deprecationHeader` | częściowo |
| Przychody (SaaS Consultify) | `/api/revenue` (`:961`) | `revenue.routes.ts` (`@ts-nocheck`) | `subscription_*` | `requireSuperAdmin` | brak |

### 2.2 Bramki — pomiar, nie założenie

- `MODULE_ECONOMICS: 'closed'` (`server/src/sharedRuntime/utils/betaMenuStatus.ts:52`), ale
  `BETA_ADMINS_EXEMPT = true` → OWNER/ADMIN/SUPERADMIN przechodzą
  (`betaGate.middleware.ts:38-43`). Właściciel widzi moduł, klient nie.
- `v8FeatureGate` przepuszcza **tylko** przy `ENABLE_V8_GLOBAL === 'true'`
  (`v8FeatureGate.middleware.ts:15`). **Zmierzone na stagingu:**
  `curl -s -o /dev/null -w '%{http_code}' https://staging.consultify.ai/api/v8/finance-v2/statements`
  → `401` (a nie `404 V8_DISABLED`), czyli **globalna bramka V8 jest włączona**. Ta sama sonda dla
  `/api/v8/finance/statements`, `/api/v8/finance-v2/baseline`, `/api/financial-modeling/models`,
  `/api/finance-statements` → wszystkie `401`. Backend Finansów jest zatem osiągalny po zalogowaniu.
- Wyjątek architektoniczny: `mountedFinanceStatementRouter` (`financeStatementMountedSurface.ts:13-38`)
  omija `v8FeatureGate` dla **5 tras dokładnych i 7 wzorców** — cała reszta `/finance-v2/*` zależy od
  globalnego przełącznika V8.

### 2.3 Producenci tabel kanonicznych — pomiar własny

Komenda (dla każdej tabeli `T`):
`grep -rl "INSERT INTO T" server/src | grep -v __tests__ | grep -v "/scripts/"`

| Tabela | Producent produkcyjny |
| --- | --- |
| `finance_artifacts` | `canonical/artifactVersionService.ts` |
| `finance_business_versions` | `canonical/artifactVersionService.ts` |
| `finance_stmt_calendars` | **BRAK** |
| `finance_stmt_periods` | **BRAK** |
| `finance_stmt_entities` | `canonical/financeImportService.ts` (tylko kopia z istniejącej wersji) |
| `finance_stmt_lines` | `canonical/financeImportService.ts`, `canonical/statementMappingService.ts` |
| `finance_baseline_models` | **BRAK** |
| `finance_baseline_workspace_contexts` | `canonical/baselineContextService.ts` |
| `finance_baseline_assumptions` | `canonical/baselineComputeService.ts` |
| `finance_baseline_outputs` | `canonical/baselineComputeService.ts` |
| `finance_lineage_edges` | `canonical/lineageService.ts` |
| `finance_analysis_definitions` | **BRAK** |
| `finance_analysis_kpi_values` | **BRAK** (patrz niżej) |
| `finance_analysis_benchmarks` | **BRAK** |
| `finance_prediction_scenarios` | `canonical/predictionAuthoringService.ts` |
| `finance_valuation_cases` | `canonical/valuationRegistrationService.ts`, `canonical/valuationVariantService.ts` |

**★ Znalezisko własne, spoza programu F.** `kpiComputeService.ts` **z założenia nie zakłada**
wierszy wskaźników — komentarz autora, `:19-21`: „row PRESENCE is KPI/period SELECTION, this module
never inserts new selection rows, only computes into existing ones", a jedyna operacja na tabeli to
`UPDATE finance_analysis_kpi_values` (`:866`). Skoro nikt w produkcji nie robi `INSERT`-a wierszy
selekcji, **`POST /analysis/:bv/compute` zawsze policzy 0 wskaźników**. To znaczy, że kryterium
odbioru ogniwa 3 programu F („widzi w niej wskaźniki 3 lat", `F_FINANSE_PELNA_TABELA.md:363`)
**nie jest dziś osiągalne krokami wypisanymi w tym ogniwie** — brakuje siódmego producenta.
Program F trzeba o to rozszerzyć (ujęte w F1, paczka **F-A3**).

---

## 3. Inwentarz frontendu

### 3.1 Osiągalność z menu

Trasa: `/finance` i `/economics` → `EconomicsView` (`src/views/EconomicsView.tsx:22`) → `FinanceHub`.
Trasy szczegółu `/finance/{statements,models,analyses,predictions,valuations}/:id`
(`src/routes/AppRoutes.tsx:2450-2527`) — **wszystkie renderują ten sam `EconomicsView`**, czyli
głębokie linki wchodzą przez hub, nie przez osobny ekran.

### 3.2 Ekrany i przewody

| Ekran / komponent | Osiągalny z menu | Woła API | Kanon tabeli | Flaga | Uwagi |
| --- | :-: | --- | --- | --- | --- |
| `FinanceHub` — lista L1, 5 zakładek | **TAK** | `V8FinanceApi.getStatementPacks/getModels/…`, `listFinanceArtifacts({artifactType})` (`useFinanceData.ts:131,169,209,247`), fallback legacy `/api/economics/*` | `StandardTable` + `StandardPreview` (`FinanceHub.tsx:47-56`) | — | zakładki: Sprawozdania · Analiza · Modele · Predykcja · Wycena (`:1563-1592`) |
| `StatementPackWorkspaceV2` — karta N pakietu | TAK | `/finance-v2/statements/*`, `versions/transitions` | sekcje zwijane, `deriveStatementTable.ts` | `financeStatementPackWorkspaceV2` **ON** | odbiór CTO: kompozycja zgodna |
| `BaselineWorkspace` — karta N modelu | TAK | `/finance-v2/baseline/:bv/*` | `AssumptionsView`/`CalculationsView`, `<table §27-exempt>` | `financeBaselineWorkspaceV1` **ON** | **409 przy każdym otwarciu** |
| `ValuationWorkspace` — 7 kroków | TAK | `/finance-v2/valuation/*`, `/api/economics/valuations/:id` | `<table §27-exempt>` w krokach | `financeValuationWorkspaceV1` **ON** | krok „Wyniki" zablokowany `NO_VALUATION_SOURCE_EDGE` |
| `AnalysisWorkspace` (Pakiet E) | NIE | `computeAnalysisKpis`, `kpi-values` | `StandardTable` w tabeli KPI | `financeAnalysisWorkspaceV1` **OFF** | fallback: stary `Benefits/FinancialAnalysisWorkspace` |
| `PredictionWorkspace` (Pakiet G) | NIE | `/finance-v2/prediction/*` | `<table §27-exempt>` | `financePredictionWorkspaceV1` **OFF** | fallback: legacy |
| `FinanceValuePanelsSurface` — 21 narzędzi | TAK (zakładka Wycena) | `/api/v8/finance-value`, `finance-planning`, `finance-valuation`, `finance-intelligence` | pasek `role="tablist"` | `VITE_FINANCE_VALUE_PANELS=true` | **21 etykiet twardo po angielsku** (`:80-100`) |
| `FinanceWorkspaceUtilities` — Powiązania · Porównaj · Komentarze · Widoki · Excel | NIE | `financeV2.api` | `aside` | `useFinanceWorkspacePlatformFlag` **defaultValue: false** (`:34`) | pięć gotowych paneli, jedna flaga |
| `FinancialStatementImportWizard` | TAK | `/api/v8/finance/statements/upload-and-analyze` | kreator | — | tor legacy, działa |
| `FinancialModelWorkspace` (legacy) | TAK | `/api/financial-modeling/models/*` | `<table>` **bez** `§27-exempt` (`:1768`, `:1935`) | — | dług kanonu |
| `FinanceCandidateHandoffModal` | TAK | `/api/finance/candidate-handoff/*` | modal | — | działa |
| `CreateModelModal` | TAK | `V8FinanceApi.createModel` → legacy `financial_models` | modal | — | brak pól `entityId`/`openingBalanceSheetPeriodId`/`forecastPeriodIds` |

### 3.3 Polszczyzna — pomiar

Skrypt (scratchpad, `i18n-fin2.mjs` + `en-hard.mjs`) nad 136 plikami `Finance` + `Economics`
(bez `__tests__`), 1 479 wywołań `t(klucz, domyślny)`:

| Rodzaj długu | Liczba | Przykład |
| --- | :-: | --- |
| Klucz **nieobecny** w `public/locales/pl/translation.json`, domyślny po angielsku | **7** | `finance.blocked` → „Access to the Finance module is restricted by your organization" |
| Klucz obecny w `pl`, ale trzyma angielski / hybrydę | **17** | `finance.toast.statementConfirmed` → „Statement potwierdzony"; `finance.m16.sensitivity.addDriver` → „+ driver" |
| Twarde napisy EN w JSX (bez `t()`) | **20** | `StatementValidationBadges.tsx:41` „Validation results"; `EvidencePanel.tsx:295` „Delete" |
| Twarde etykiety EN w mapie `LABELS` (poza detektorem JSX) | **21** | `FinanceValuePanelsSurface.tsx:80-100` |
| Hybrydy PL+EN (ślad codemodu) | 4 | „Nazwa analysis", „Historia version", „Nazwa version (opcjonalnie)", „Wycen model" |
| **Razem** | **~65** | |

### 3.4 Czerwień (`primary-*` = crimson #85182F)

`grep -rn "primary-" src/components/Finance src/components/Economics --include="*.tsx" | grep -v __tests__`
po odjęciu linii komentarza → **34 wystąpienia w 9 plikach**:
`ExportToOutputDialog.tsx` (12), `AIRecommendationsPanel.tsx` (7), `VersionHistoryPanel.tsx` (5),
`FinanceLanePanel.tsx` (3), `ExportButton.tsx` (2), `EvidencePanel.tsx` (2),
`StatementExplainPanel.tsx` (1), `FinancialModelWorkspace.tsx` (1), `FinanceVersionTimeline.tsx` (1).

### 3.5 Własne tabele

18 plików z `<table` (bez testów). **Oznaczone `§27-exempt`** (archetyp Excel, dozwolone):
`ScenarioResultsView`, `ScenarioAssumptionsView`, `baseline/AssumptionsView`,
`baseline/CalculationsView`, `compare/FinanceComparePanel`, trzy kroki Wyceny.
**Nieoznaczone (dług kanonu):** `FinancialModelWorkspace` (×2), `FinancialStatementMappingEditor`,
`FinancialStatementWorkspace`, `InitiativeBusinessCaseCard`, `ModelVersionHistory` (×2),
`BenefitsTrackingDashboard`, `FinancePreviewPanel` (×2), `FinanceModelDocumentView`,
`ValueLedgerPanel`, `ValueCapturePipelinePanel` (×2).
`bash scripts/check-list-canon.sh` → exit 0, „naruszeń 361, baseline 364 — dług nie rośnie".

---

## 4. Macierz luki (zdolność backendu × ekran)

Legenda: **DZIAŁA** = pełny przewód do ekranu osiągalnego z menu; **BRAK EKRANU**;
**EKRAN BEZ DANYCH** = ekran jest, wołacz jest, odpowiedź to błąd albo pustka z powodu backendu;
**WOŁACZ BEZ EKRANU** = klient API gotowy, zero wołaczy; **ZA FLAGĄ OFF**; **MARTWE** = trasa
zamontowana, zero wołaczy w `src/`.

| # | Zdolność | Ekran | Werdykt | Dowód |
| :-: | --- | --- | --- | --- |
| 1 | Import sprawozdania (legacy) | `FinancialStatementImportWizard` | **DZIAŁA** | 14 rekordów na liście, `finanse/01-lista.png` |
| 2 | Pakiet sprawozdań — rejestr | zakładka Sprawozdania | **DZIAŁA** | jw. |
| 3 | Pakiet sprawozdań — karta N | `StatementPackWorkspaceV2` (flaga ON) | **DZIAŁA** | odbiór CTO „OK" |
| 4 | Handoff kandydatów | `FinanceCandidateHandoffModal` | **DZIAŁA** | 3 pliki wołaczy |
| 5 | Model finansowy legacy | `FinancialModelWorkspace` | **DZIAŁA** | 2 rekordy, `06-modele-lista.png` |
| 6 | Mapowanie linii kanonicznych | `FinancialStatementMappingEditor` | **EKRAN BEZ DANYCH** | „Zmapowane linie 0 / 0" (`02-sprawozdanie-detal.png`); `finance_stmt_periods` bez producenta |
| 7 | Model bazowy kanoniczny | `BaselineWorkspace` (flaga ON) | **EKRAN BEZ DANYCH** | 409 `BASELINE_CONTEXT_NOT_CONFIGURED` (`baselineContextService.ts:99`); `finance_baseline_models` bez producenta |
| 8 | Kontekst modelu bazowego (`PUT`) | — | **WOŁACZ BEZ EKRANU** | `financeV2.api.ts:803` — zero wołaczy w `src/**/*.tsx` |
| 9 | Wycena — kroki 1–3, 5–7 | `ValuationWorkspace` (flaga ON) | **DZIAŁA CZĘŚCIOWO** | krok „Wyniki" → `NO_VALUATION_SOURCE_EDGE` (odbiór CTO, defekt 3) |
| 10 | Wycena — panele wartości | `FinanceValuePanelsSurface` | **DZIAŁA, PO ANGIELSKU** | `07-wycena-detal.png` — 21 chipów EN |
| 11 | Zatwierdzanie / wersje bazowe | paski warsztatów | **EKRAN BEZ DANYCH** | „Zatwierdzone 0" we wszystkich zakładkach; żaden artefakt DBR77 nie osiąga `APPROVED` |
| 12 | Analiza historyczna | `AnalysisWorkspace` | **ZA FLAGĄ OFF** + brak producenta | `useFinanceAnalysisWorkspaceFlag.ts` `defaultValue: false`; `finance_analysis_kpi_values` bez `INSERT` |
| 13 | Prognoza / predykcja | `PredictionWorkspace` | **ZA FLAGĄ OFF** | `useFinancePredictionWorkspaceFlag.ts` `defaultValue: false` |
| 14 | Porównanie wersji | `FinanceComparePanel` | **ZA FLAGĄ OFF** + brak 2. wersji | `useFinanceWorkspacePlatformFlag.ts:34`; odbiór CTO defekt 1 |
| 15 | Komentarze | `FinanceCommentsPanel` | **ZA FLAGĄ OFF** | jw. |
| 16 | Widoki zapisane | `FinanceSavedViewsPanel` | **ZA FLAGĄ OFF** | jw. |
| 17 | Rodowód / nawigator | `FinanceLineageNavigator` | **ZA FLAGĄ OFF** | jw. |
| 18 | Eksport / import XLSX | `FinanceExportImportPanel` | **ZA FLAGĄ OFF** | jw. |
| 19 | Zadania obliczeniowe (`compute/jobs`) | — | **BRAK EKRANU** | zero wołaczy `compute/jobs` w `src/` |
| 20 | Wyjątki / świeżość (`exceptions/inbox`) | — | **BRAK EKRANU** | jw. |
| 21 | Budżety (`/api/budgets`, `/api/budget`) | — | **MARTWE** | `grep -rl "/api/budgets" src` → 0 plików |
| 22 | Finance enterprise (`/api/finance-v4`) | — | **MARTWE** | `grep -rl "/api/finance-v4" src` → 0 plików |

**Sumy (22 zdolności):**

| Werdykt | Liczba | Udział |
| --- | :-: | :-: |
| DZIAŁA (przewód pełny do ekranu z menu) | 5 | **23 %** |
| DZIAŁA CZĘŚCIOWO (ekran działa, jedna funkcja zablokowana) | 2 | 9 % |
| EKRAN BEZ DANYCH (przewód kończy się błędem/pustką) | 3 | 14 % |
| ZA FLAGĄ OFF | 7 | 32 % |
| WOŁACZ BEZ EKRANU | 1 | 5 % |
| BRAK EKRANU | 2 | 9 % |
| MARTWE | 2 | 9 % |

**Odpowiedź na tezę liczbowo: 23 % zdolności backendu ma dziś pełny przewód do ekranu osiągalnego
z menu; 32 % czeka wyłącznie na przełącznik, a 14 % wyłącznie na producenta danych.**
Poza `MARTWE` i `BRAK EKRANU` (18 %) **każda zdolność backendu ma już zbudowany ekran**.

---

## 5. Stan na żywo

**Ograniczenie pomiaru — powiedziane wprost.** Lokalne stanowisko na `http://127.0.0.1:3000` działa
(vite nasłuchuje), ale zapisana sesja `ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json`
**wygasła**: pięć prób `node scripts/dev/odbior-zywo/zrzut.mjs --url=/finance?tab=…` skończyło się
przekierowaniem na `/login?redirect=…` z `[TokenService] Refresh failed: 401` w `.json`.
Zalogować się nie mogę (wpisanie hasła właściciela jest poza moimi uprawnieniami). Dlatego §5 stoi
na **zrzutach z tego samego dnia i tej samej gałęzi**, wykonanych tym samym narzędziem, nie na
zrzutach starszych: `evidence/audyt-award-20260905/finanse/` (12 obrazów, audyt CES 2027, 05.09) i
`evidence/odbior-zywo-20260905/09-finanse/` (rundy 1–7 odbioru CTO, 05.09).

**Co realnie widać (obejrzane, nie przepisane):**

1. **`finanse/01-lista.png` — Sprawozdania.** Lista **działa i wygląda dobrze**: `StandardTable`,
   14 rekordów z realnymi nazwami („DBR77 Sp. z o.o.", „CD PROJEKT Group", „Tesla, Inc."), chipy
   stanu (Wszystkie 14 · Odrzucone importy 4 · Kolejka naprawcza 3 · Gotowe sprawozdania 7), kebab
   pionowy, polskie zakładki. **Defekty widoczne okiem:** kolumna `STATUS` ucięta do „Sz…/Pr…/Za…",
   nagłówek `KOMPLETN…` ucięty, przycisk „Importuj sprawozdanie" przykryty przez stały prawy panel
   Teresy (~380 px), a w kolumnie kompletności rendering „—P&L / BS / —CF" (myślnik sklejony
   z nazwą sekcji).
2. **`finanse/02-sprawozdanie-detal.png` — podgląd pakietu.** Pole „Stan pakietu" pokazuje
   **surowy angielski komunikat z kodami enum**: „Statement pack needs attention: MISSING_PLAN,
   MISSING_CF, INVALID_PERIOD_COUNT, INVALID_MEMBER_COUNT, MISSING_PERIOD_STATEMENT,
   HAS_PENDING_STATEMENT". Obok: chip `DRAFT` (surowy enum), „Zmapowane linie **0 / 0**",
   „POWIĄZANIA — *Brak powiązań*". To jest wizualny dowód §2.3: tożsamość kanoniczna jest,
   danych kanonicznych i rodowodu nie ma.
3. **`finanse/06-modele-lista.png` — Modele.** Dwa rekordy („DBR77 — Model bazowy 2023-…",
   „Budżet wdrożenia robotyzacji 2…"). Kolumny `DOKUMENT`/`PROGNOZA`/`WARIANTY`/`POZIOMY`
   **całkowicie puste**. Chipy: „Szkic 2 · Przegląd 0 · **Zatwierdzone 0**" — czyli
   §4 wiersz 11 widać gołym okiem. **Brakuje kolumny „SPRAWOZDANIE ŹRÓDŁOWE"** wymaganej przez
   `FINANSE_ZALOZENIA_CTO_20260905.md` §6 pkt 2.
4. **`finanse/07-wycena-detal.png` — Wycena (ekran flagowy).** Nad listą stoi pasek **21 chipów
   w 100 % po angielsku** (Banking value … Scenario compute) zajmujący cztery rzędy i spychający
   właściwą tabelę wycen poniżej pierwszego ekranu. Podgląd rekordu: `VAL` `DRAFT`, „ŹRÓDŁO —",
   „0 lat". Panel Monte Carlo (jedyny widoczny) jest po polsku i sensowny — czyli merytoryka
   jest, opakowanie nie.
5. **`09-finanse/_probe-baseline-canonical-dzis.png`** — złapany w stanie szkieletu; rozstrzygający
   opis stanu Baseline pochodzi z `09-finanse/RUNDA3.md` (runda 7) i `ODBIOR_CTO_20260905/09-10-11.md:66-84`:
   każdy sposób utworzenia modelu kończy się `409 BASELINE_CONTEXT_NOT_CONFIGURED`, a jedyną akcją
   na ekranie jest „Spróbuj ponownie", które powtarza to samo żądanie.

**Wniosek z oglądu:** listy L1 nie są „nieprzygotowane" — są dobre i mają realne dane. Puste są
**kolumny pochodne** (prognoza, warianty, poziomy, źródło) i **karty poziomu 2 zależne od
łańcucha**. To dokładnie odwrotność tezy.

---

## 6. Weryfikacja trzech liczb nadzorcy

### 6.1 „Łańcuch Baseline v3 = 6 ogniw wymuszonych kontraktem `baselineContextService.ts`" — **POTWIERDZONE, z doprecyzowaniem**

Przeczytałem `readContextTx` (`server/src/services/finance/canonical/baselineContextService.ts:73-200`)
i policzyłem warunki sam. Odczyt kontekstu wymaga **jedenastu** spełnionych warunków, z czego
**dziewięć** stoi w jednym zapytaniu „authority" (`:102-141`):

1. artefakt typu `BASELINE_MODEL` → `NOT_FOUND` (`:86`)
2. wiersz w `finance_baseline_workspace_contexts` → `BASELINE_CONTEXT_NOT_CONFIGURED` (`:99`)
3–4. pakiet: `finance_business_versions.status='APPROVED'` **i** `artifact_type='STATEMENT_PACK'`
5–6. analiza: `status='APPROVED'` **i** `artifact_type='HISTORICAL_ANALYSIS'`
7–9. trzy krawędzie: `STATEMENT_TO_MODEL`, `STATEMENT_TO_ANALYSIS`, `ANALYSIS_TO_MODEL`
   (`JOIN finance_lineage_edges` ×3) → wspólnie `BASELINE_CONTEXT_SOURCE_STALE` (`:148`)
10. komplet i kolejność okresów w `finance_stmt_periods` → `BASELINE_CONTEXT_INVALID` (`:168`, `:176`)
11. ≥1 wiersz `finance_baseline_assumptions` → `BASELINE_CONTEXT_NOT_READY` (`:197`)

Kolejność jest wymuszona, bo warunek 2 wymaga rekordu w rejestrze (`JOIN finance_baseline_models`
w zapisie, `:385`), a warunki 3–9 wymagają zatwierdzonych poprzedników. **Liczba „6" jest
dekompozycją programu F, nie liczbą z kodu** — w kodzie jest 11 warunków odczytu i 17 zapisu.
Teza nadzorcy jest prawdziwa co do wymuszenia kolejności; „6" należy czytać jako nazwę pakietów
roboczych, nie jako pomiar.

### 6.2 „22 nazwy narzędzi w Finansach po angielsku" — **BŁĘDNE O JEDEN: jest 21**

`src/components/Economics/FinanceValuePanelsSurface.tsx:79-101` — mapa `LABELS` ma **21 wpisów**
(`bankingValue` w linii 80 … `scenarios` w linii 100). Sam raport CES 2027
(`AUDYT_AWARD_20260905/C_…:161-170`) wymienia w nawiasie **21 nazw**, a w zdaniu podsumowującym
pisze „22 etykiety" — to zwykła pomyłka w zliczeniu własnej listy; powtórzona potem w
`D_SYNTEZA_I_PLAN.md:52` i w rejestrze. Policzyłem też chipy na obrazie
`finanse/07-wycena-detal.png`: 6 + 6 + 7 + 2 = **21**.
**Korekta w drugą stronę:** ten sam plik ma jeszcze dwa angielskie napisy poza mapą —
`aria-label="Valuation analysis panels"` (`:116`) i `Loading panel…` (`:131`), więc **angielskich
napisów w tym pliku jest 23, a nazw narzędzi 21**. Do naprawy idą wszystkie 23.

### 6.3 „`finance_baseline_models` nie ma producenta w kodzie produkcyjnym" — **POTWIERDZONE**

`grep -rn "INSERT INTO finance_baseline_models" server src scripts` (całe repo) daje **9 trafień**
i **ani jednego w kodzie produkcyjnym**:
- `server/src/scripts/baselineContextOpeningPeriodRealDbProof.ts:195` — skrypt dowodowy,
- 8 × `__tests__` (`baseline.routes.pg.test.ts:476,635`, `statementOwnerAcceptance.pg.test.ts:1259`,
  `idempotentComputeRetry.pg.test.ts:149`, `coldReopen.pg.test.ts:505`, `tenantMatrix.pg.test.ts:182`,
  `perfSlo.pg.test.ts:232`, `w2FalseSuccessW9B2.pg.test.ts:167`).
Zero `INSERT`-ów w `server/src/repositories`. Czytelnik `baselineComputeService.ts:217` zwraca
`NO_BASELINE_MODEL_ROW` (`:223`). Potwierdzam bez zastrzeżeń — i dokładam do listy trzy kolejne
tabele bez producenta z rodziny Analizy (§2.3).

---

## 7. Czego brakuje, żeby „sformułować tabelę frontendu prawidłowo"

Właściciel pyta o kształt tabel. Poniżej **projekt kolumn per lista L1 i sekcji per karta N**, każda
kolumna ze wskazanym źródłem danych. Tam, gdzie źródła dziś nie ma, jest to napisane wprost —
to jest lista zamówień do backendu, nie życzenie.

### 7.1 L1 — **Sprawozdania** (`?tab=statements`)

| Kolumna | Źródło | Stan |
| --- | --- | --- |
| Typ (STM) | stała ikonografia | jest |
| Nazwa | `GET /api/v8/finance/statement-packs` → `name` | jest |
| Firma / jednostka | `finance_stmt_entities.name` przez `GET /statement-packs/:id` | **brak** — potrzebny producent jednostki (F-A1) |
| Okres · Okres porównawczy | `financial_statement_packs.period_label` + `comparative_period_label` | okres jest, porównawczy niepewny |
| Zakres (RZiS · Bilans · CF) | `pack_readiness_status` + `sections[]` | jest (dziś renderowany jako „—P&L / BS / —CF" — do naprawy) |
| Waluta | `packs.currency` | jest |
| Zmapowane linie | `GET /finance-v2/statements/:bv/lines` → `count` | jest, dziś zawsze `0 / 0` |
| Stan (Szkic / Do przeglądu / Zatwierdzony) | `finance_business_versions.status` → **słownik PL** | enum surowy — do zmapowania |
| Gotowość | `pack_readiness_status` → **słownik PL** | 6 kodów enum widocznych w UI — do zmapowania |
| Źródło (import / ręcznie) | `financial_statement_versions.source_kind` | jest |
| Zaktualizowano | `updated_at` | jest |

### 7.2 L1 — **Analizy** (`?tab=analysis`)

| Kolumna | Źródło | Stan |
| --- | --- | --- |
| Nazwa własna analizy | `finance_artifacts.name` (`POST /artifacts/:id/rename`) | jest |
| **SPRAWOZDANIE ŹRÓDŁOWE** (1..n) | `GET /finance-v2/versions/:bv/lineage` → krawędzie `STATEMENT_TO_ANALYSIS` | endpoint jest, krawędzi nie tworzy kreator wewnątrz warsztatu |
| Lata / liczba okresów | `finance_analysis_kpi_values` DISTINCT `period_id` | **brak producenta** (F-A3) |
| Liczba wskaźników policzonych / wymaganych | jw. | **brak producenta** |
| Waluta | z pakietu źródłowego | jest |
| Stan | `finance_business_versions.status` | jest |
| Zaktualizowano | `updated_at` | jest |

### 7.3 L1 — **Modele bazowe** (`?tab=models`)

| Kolumna | Źródło | Stan |
| --- | --- | --- |
| Nazwa | `finance_artifacts.name` | jest |
| **SPRAWOZDANIE ŹRÓDŁOWE** | krawędź `STATEMENT_TO_MODEL` | **brak producenta** (F-A4) |
| **ANALIZA ŹRÓDŁOWA** | krawędź `ANALYSIS_TO_MODEL` | **brak producenta** (F-A4) |
| Rok bazowy / okres otwarcia | `finance_baseline_workspace_contexts.opening_balance_sheet_period_id` → etykieta z `finance_stmt_periods` | **brak producenta okresów** (F-A2) |
| Horyzont (mies.) | `finance_baseline_models.horizon_months` | **brak rejestru** (F-A4) |
| Warianty (liczba scenariuszy) | `finance_prediction_scenarios` po `business_version_id` | producent jest |
| Stan | `finance_business_versions.status` | jest (dziś zawsze `DRAFT`) |

### 7.4 L1 — **Wyceny** (`?tab=valuation`)

| Kolumna | Źródło | Stan |
| --- | --- | --- |
| Nazwa | `finance_artifacts.name` | jest |
| **ŹRÓDŁO (model/scenariusz + wersja)** | krawędź `MODEL_TO_VALUATION` / `SCENARIO_TO_VALUATION` (`valuationSourceBindingService.ts`) | producent jest, ale chooser oferuje tylko `APPROVED` → dziś pusty |
| **SPRAWOZDANIE ŹRÓDŁOWE** (przechodnio) | `GET …/lineage-navigator` | endpoint jest, kolumny nie ma |
| Metoda (DCF/FCFF, mnożniki) | `finance_valuation_variants.method_set` | jest |
| Wartość (EV / equity) | `finance_valuation_results` | jest po `compute` |
| Horyzont | wariant | jest (dziś „0 lat") |
| Stan | `finance_business_versions.status` | jest |

### 7.5 Karta N — **Sprawozdanie** (archetyp D — Matryca, `SPEC-A` §13.4)

Powłoka: Menu 1 z okruszkiem `Finanse › Sprawozdania › DBR77 2025`, Menu 3 = **Dane · Walidacja ·
Raporty**, prawy panel accordion (`ArtifactRightPanel`): *Właściwości · Rodowód · Źródła ·
Komentarze · Historia · Teresa*.
Centrum: **trzy pełne tabele** RZiS · Bilans · CF, pozycje w wierszach (hierarchia z roll-upem),
okresy w kolumnach (okres + porównawczy), liczby do prawej, sumy pogrubione, `<table §27-exempt>`.
Źródło: `GET /finance-v2/statements/:bv/lines` (jest) + `finance_stmt_periods` (**brak producenta**).
Sekcja Rodowód: `GET /finance-v2/versions/:bv/lineage` (jest).

### 7.6 Karta N — **Analiza** (archetyp D)

Centrum: tabela wskaźników — wiersz = wskaźnik z §7 założeń CTO (rentowność · płynność ·
zadłużenie · efektywność · wzrost · cash flow · sygnały ryzyka), kolumny = lata, plus kolumna
Definicja (dymek) i Trend. Źródło: `GET /finance-v2/analysis/:bv/kpi-values` (endpoint jest,
**wierszy nikt nie zakłada**) + `GET /analysis/kpi-catalog` (seed z migracji `…d03_analysis_03_kpi_p0_catalog.sql`).
Sekcja Rodowód: lista sprawozdań źródłowych (wiele-do-wielu, §6 pkt 4 założeń CTO).

### 7.7 Czego brakuje ponad kolumny

1. **Słownik PL dla stanów i kodów gotowości** (12 enumów: `DRAFT`/`READY_FOR_REVIEW`/`APPROVED` +
   6 kodów `MISSING_*`/`INVALID_*`/`HAS_PENDING_*` + 3 kody błędów kontekstu).
2. **Kolumna „SPRAWOZDANIE ŹRÓDŁOWE" jako komponent współdzielony** (jedno lub kilka, klikalne) —
   wymóg właściciela z §6 założeń CTO, dziś nie istnieje w żadnej z 4 list.
3. **Sekcja „Rodowód" w powłoce artefaktu** — dane są (`/lineage`), montażu nie ma poza panelem
   za flagą OFF.
4. **Producent wierszy selekcji KPI** — bez niego karta Analizy jest pusta niezależnie od reszty.
5. **Producent kalendarza i okresów** — bez niego karta Sprawozdania nie ma kolumn.

---

## 8. Granica dowodu (czego NIE zmierzyłem)

1. **Nie zmierzyłem stanu żywej bazy stagingu.** Sesja przeglądarki wygasła, a bezpośredniego
   dostępu SQL do bazy stagingu w tej sesji nie miałem. Wszystkie zdania o „zero zatwierdzonych
   pakietów" pochodzą z chipów na zrzutach z 05.09 i z `ODBIOR_CTO_20260905/`, nie z `SELECT`-a.
2. **Nie przeklikałem żadnego przepływu na żywo.** Zrzuty w §5 zrobił wcześniej inny agent tym
   samym narzędziem tego samego dnia; ja je obejrzałem, ale nie odtworzyłem.
3. **Nie uruchomiłem suity serwerowej Finansów.** Testy `.pg` wymagają `RUN_DB_TESTS=1` i realnego
   Postgresa; policzyłem tylko liczbę plików (89), nie ich wynik. „89 plików testów na realnym PG"
   ≠ „89 zielonych testów".
4. **Nie zweryfikowałem 27 silników M16** stojących za 21 panelami wartości — sprawdziłem tylko,
   że trasy są zamontowane i że frontend je woła; czy zwracają sensowne liczby na realnych danych,
   nie wiem.
5. **Nie sprawdziłem trybu ciemnego** ani szerokości 1280/1920 dla żadnego ekranu Finansów.
6. **Detektor angielszczyzny jest heurystyczny.** Liczby z §3.3 (7 / 17 / 20 / 21) to dolna
   granica: wykrywam napisy w `t(k, 'default')`, węzłach tekstowych JSX i `aria-label`/`placeholder`,
   ale nie wykrywam napisów budowanych z fragmentów ani przychodzących z serwera (a właśnie taki
   jest komunikat „Statement pack needs attention: …" z §5 pkt 2).
7. **Nie rozstrzygnąłem przyczyny białego ekranu Predykcji (~6 %)** — odbiór CTO zostawił to jako
   defekt bez deterministycznej reprodukcji; nie próbowałem jej znaleźć.
8. **Liczba „22 zdolności" w §4 to moja dekompozycja**, nie kategoria z kodu. Przy innym cięciu
   (np. licząc 21 paneli wartości osobno) procenty się zmienią — niezmienna jest lista werdyktów
   per pozycja.

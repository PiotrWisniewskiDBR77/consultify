# PKG_M — Finance v3 UI/API Inventory & Visual Acceptance Harness

Data: 2026-08-11 · Gałąź: `codex/fv3p-m-inventory` · Baza: `585af4ce4b` (origin/demo-derived)
Robotnik: Sonnet, pakiet M (rozpoznanie + harness, **nie** przebudowa frontendu)
Statusy w tym dokumencie: `PASS` / `FAIL` / `PARTIAL` / `BLOCKED_EXTERNAL` / `EVIDENCE_MISSING` / `NOT_APPLICABLE`
(zgodnie z poleceniem — bez `READY`/`DONE`)

---

## 0. Streszczenie dla pięciu inżynierów (D–H)

| Pytanie | Odpowiedź |
|---|---|
| Ile ekranów/komponentów Finance w `src/` | 66 plików `.tsx` bez testów (`src/components/Finance/**`, `src/components/Economics/**`) |
| Ile z nich jest **martwych** (zero JSX mount w produkcji) | **co najmniej 35** — patrz §2 |
| Ile z 22 wymagań właścicielskich spełnionych w pełni dziś | **0** |
| Częściowo | **2** (`OWN-FIN-002`, `OWN-FIN-009`/`010` razem jako jedna praca bezpieczeństwa) |
| Wcale / brak śladu w kodzie | **19** |
| Poza zakresem tego pakietu (backend/env) | `OWN-FIN-009`, `OWN-FIN-010` — pakiet B |
| Harness dev-render | Był **zepsuty** (1 brakujący plik → 500 na WSZYSTKICH ekranach, ten sam wzorzec co w pamięci projektu) — **naprawiony minimalnie**, dowód niżej |
| Bezpieczniki `check-list-canon.sh` / `check-artefakt.sh` | Oba `exit 0` dziś na tej gałęzi — **ale to ratchet na baseline długu, nie zero naruszeń** (408/409 plików i 7/7 crimson odpowiednio) |

**Najważniejsze dla D–H, zanim ktokolwiek zacznie pisać kod:**

1. **`OWN-FIN-001` jest twardym ograniczeniem, nie sugestią.** Właściciel zaakceptował obecny wzorzec **list** (Statements/Analysis/Models/Prediction) na zrzutach SHA `9c23e3d80e`. Ekran `FinanceHub.tsx` (lista+preview) **już jest zgodny z TRIADA** (`StandardTable`/`StandardModuleBar`/`StandardPreview` — dowód §1.1). Wszystkie 22 uwagi właścicielskie dotyczą **workspace'ów szczegółu** (Statements/Models/Analysis/Valuation/Prediction po otwarciu rekordu), nie list. **Nie redesignuj listy.**
2. **Żaden z pięciu workspace'ów szczegółu nie używa `StandardTable`/`StandardModuleBar`/`StandardPreview`.** Zmierzone (`grep -c`, zero trafień w każdym z 5 plików) — patrz §1.2. To jest dokładnie luka, którą `OWN-FIN-011`/`014`/`016` opisują.
3. **Frontend Finance woła wyłącznie legacy `/api/v8/finance/*`** (i głębszy fallback `/api/financial-modeling/*`), **zero odwołań do kanonicznego `/api/v8/finance-v2/*`**, który ma dziś tylko 2 endpointy produkcyjne (approve/reopen modelu). Most między pakietem B (backend) a D–H (frontend) **nie istnieje jeszcze** — dowód §1.3.
4. **Duży klaster martwego kodu**: `Economics/panels/` (19 z 20 plików) + cały `Economics/charts/` (9/9) + `financeValuationApi.ts` — nigdy nie montowane w produkcji, mimo komentarzy w kodzie sugerujących odwrotnie. Nie budujcie na tym „bo już jest" — sprawdźcie najpierw, czy jest żywe (§2).

---

## 1. Zadanie 1 — Inwentaryzacja UI

### 1.1 Router → ekran (co jest osiągalne, pod jaką trasą)

| Trasa | Element | Plik |
|---|---|---|
| `/finance`, `/finance/statements/:id`, `/finance/models/:id`, `/finance/analyses/:id` | wszystkie → `<EconomicsView>` → `<FinanceHub>` | `src/routes/AppRoutes.tsx:2038-2115`, `src/views/EconomicsView.tsx:19-22` |
| `/economics` | redirect 301-style (`RedirectPreservingQuery`) → `/finance` | `src/routes/AppRoutes.tsx:2038-2047` |

**Brak osobnej trasy dla Prediction i Enterprise valuation** — obie żyją jako zakładki (`activeTab`) wewnątrz tego samego `FinanceHub`, nie jako adresowalne URL-e (`/finance/predictions/:id`, `/finance/valuations/:id` **nie istnieją** — zweryfikowano `grep -n "path=" src/routes/AppRoutes.tsx | grep -i "predict\|valuation"` → 0 trafień poza wzmiankami w innych modułach).

`FinanceHub` (`src/components/Economics/FinanceHub.tsx`, 3240 linii) jest **jedynym punktem wejścia**. Renderuje:
- listę+preview (5 zakładek: Statements/Analysis/Models/Prediction/Enterprise valuation) przez `StandardTable`/`StandardPreview` — **zgodne z TRIADA**, dowód:
  `grep -n "<StandardTable\|<StandardModuleBar\|<StandardPreview" FinanceHub.tsx` → linie **2203, 2286, 2563, 2595, 3077** (dwie instancje `StandardTable`+`StandardPreview` — jedna dla Statements, jedna dla wspólnego bloku Models/Analysis/Prediction/Valuation/Investment — plus jeden `StandardModuleBar` na całość).
- „pełny widok" (`fullView`, `FinanceHub.tsx:2648-2758`) po otwarciu rekordu — **bespoke wrapper z własnym nagłówkiem** (`px-4 py-3 border-b … "Wróć do listy"`, linie **2666-2680**), wewnątrz którego montuje jeden z pięciu workspace'ów szczegółu:

| `activeDocument.kind` | Komponent montowany | Plik |
|---|---|---|
| `statements` | `<FinancialStatementPackWorkspace>` | `src/components/Finance/FinancialStatementPackWorkspace.tsx` (1459 linii) |
| `models` lub `prediction`+`predictionType==='model'` | `<FinancialModelWorkspace>` | `src/components/Finance/FinancialModelWorkspace.tsx` (2060 linii) |
| `analysis` lub `investment` | `<FinancialAnalysisWorkspace>` | `src/components/Benefits/FinancialAnalysisWorkspace.tsx` (764 linii) |
| `valuation` | `<ValuationWorkspace>` | `src/components/Benefits/ValuationWorkspace.tsx` (1799 linii) |
| `prediction`+`predictionType==='budget'` | `<BudgetWorkspace>` | `src/components/Benefits/BudgetWorkspace.tsx` (1116 linii) |

Dowód JSX: `FinanceHub.tsx:2696-2733`.

### 1.2 Standard vs bespoke — zmierzone

```
grep -c "StandardTable\|StandardModuleBar\|StandardPreview" <plik>
```

| Plik (workspace szczegółu) | Trafienia | Wniosek |
|---|---|---|
| `FinancialModelWorkspace.tsx` | **0** | bespoke header + bespoke tabs, zero komponentów standardu |
| `FinancialStatementPackWorkspace.tsx` | **0** | bespoke |
| `FinancialAnalysisWorkspace.tsx` | **0** | bespoke — `RatioBlocksTable` to lokalny komponent (`FinancialAnalysisWorkspace.tsx:676`), nie `StandardTable` |
| `ValuationWorkspace.tsx` | **0** | bespoke |
| `BudgetWorkspace.tsx` | **0** | bespoke |

**Wniosek: WSZYSTKIE PIĘĆ workspace'ów szczegółu jest poza kanonem.** Jedyny zgodny ekran to lista (`FinanceHub` w trybie tabeli). To bezpośrednio potwierdza `OWN-FIN-014` (tabela wskaźników Analysis bez standardu) i częściowo `OWN-FIN-011`/`016` (bespoke header zamiast wspólnego paska).

### 1.3 API — legacy vs kanoniczne (zmierzone)

- Kanoniczny `/api/v8/finance-v2/*` ma dziś **2 endpointy produkcyjne**: `POST /models/:modelId/approve` (`server/src/routes/v8/finance-v2/models.routes.ts:103`) i `POST /models/:modelId/reopen` (tamże, linia `175`), montowane w `server/src/routes/v8/index.ts:110` (`v8Router.use('/finance-v2', financeV2Routes)`).
- Frontend Finance **nigdy** nie woła `/finance-v2` (`grep -rn "finance-v2" src/` → **0 trafień** poza tym raportem).
- `V8FinanceApi` (`src/services/api/v8/finance.ts`) woła **legacy** `/api/v8/finance/*` — `V8_BASE = '/api/v8'` (`src/services/api/v8/client.ts:9`) + `v8Post('/finance/models/${modelId}/approve', …)` (`finance.ts:537-544`) → realny URL `POST /api/v8/finance/models/:id/approve`.
- Każde wywołanie ma **drugi, głębszy fallback** do jeszcze starszego `/api/financial-modeling/*` przy 400/404/405/501 (`shouldFallbackToLegacyFinance`, `finance.ts:3-6`; wzorzec `…WithFallback` w `FinancialModelWorkspace.tsx:132-217`, np. `approveModelWithFallback` → `Api.post('/api/financial-modeling/models/${modelId}/approve', {})`).

**Wniosek: trzy warstwy API nałożone na siebie (finance-v2 kanoniczne / finance legacy v8 / financial-modeling bardzo stare), a UI rozmawia wyłącznie z dwoma najstarszymi.** Most do finance-v2 (pakiet B) jeszcze nie istnieje po stronie frontendu — to zadanie dla D–H, nie coś już zrobione.

### 1.4 Ile pięter nagłówka ma ekran szczegółu (`OWN-FIN-011`)

Na przykładzie Models (identyczny wzorzec w pozostałych czterech workspace'ach):

1. **Piętro 1** — `FinanceHub.tsx:2666-2680`: `code` (np. „MDL") + `activeDocument.title` + przycisk „Wróć do listy".
2. **Piętro 2** — `FinancialModelWorkspace.tsx:944-1003`: `<h2>{selectedModel.name}</h2>` + status badge + `currency · granularity · horizon` + **cztery** przyciski (`Eksportuj`, `Wycen model`, `Zatwierdź`/`Zatwierdzony`, `Oblicz`).

**Dwa piętra tytułu, dwa różne miejsca z nazwą tego samego rekordu** — dokładnie zgłoszenie właścicielskie `OWN-FIN-011`. Dowód wizualny: `docs/validation/finance-v3/generated/gate-e/visual/finance-model-workspace-1440-light.png` (patrz §3).

**`FinanceWorkspaceBar` (lub odpowiednik) NIE ISTNIEJE w repo** — `grep -rn "FinanceWorkspaceBar" src/` → **0 trafień**.

### 1.5 Martwy kod w `src/components/Finance/` — dowód, że plik jest niezależny od Pack workspace

`FinancialStatementWorkspace.tsx` ≠ dead — jest zagnieżdżony wewnątrz `FinancialStatementPackWorkspace.tsx:37,1255` (per-statement widok wewnątrz paczki). Nie mylić dwóch podobnie nazwanych plików.

---

## 2. Martwy kod — duże znalezisko (zgłoszone, NIE naprawione — poza zakresem tego pakietu)

Metoda: dla każdego pliku `grep -rn "<NazwaKomponentu" src --include="*.tsx"` poza plikiem własnym i `__tests__/`. Zero trafień = brak montowania w produkcji.

**`src/components/Economics/panels/` — 19 z 20 plików ma ZERO JSX mount w produkcji:**
`BankingValuePanel`, `CashForecastPanel`, `DriverPlannerPanel`, `DriverTreePanel`, `EfficientFrontierPanel`, `ExtendedRatiosPanel`, `HeadcountPlannerPanel`, `InvestmentAppraisalPanel` (montowany tylko w teście), `MonteCarloNpvPanel`, `RealOptionsPanel`, `RollingForecastPanel`, `ScenarioComputePanel`, `ValuationVisualsPanel`, `ValueAttributionPanel`, `ValueCapturePipelinePanel`, `ValueLedgerPanel`, `ValueOfficePanel`, `VarianceBridgePanel`, `VarianceNarrationPanel`, `WhatIfSensitivityPanel`.
Jedyny żywy: `EvBasketFootballField.tsx` — montowany w `ValuationWorkspace.tsx:1181` (import `ValuationWorkspace.tsx:8-10`).

**Cały `src/components/Economics/charts/` (9/9 plików) jest martwy pośrednio** — jedyni konsumenci to właśnie te martwe panele (`BulletChart`, `ChartLegendChips`, `DistributionHistogram`, `FinanceWaterfall`, `FootballField`, `GoldenThreadSankey`, `PortfolioBubble`, `SCurve`, `SensitivityHeatmap`, `TornadoChart`).

**`src/services/financeValuationApi.ts`** — importowany wyłącznie przez te same martwe panele; sam nigdzie indziej nieużywany.

**Pozostałe martwe pliki:** `Economics/AIRecommendationsPanel.tsx`, `Economics/BenefitsTrackingDashboard.tsx`, `Economics/DigitizationToolTab.tsx`, `Economics/ExcelImportWizard.tsx`, `Economics/PDFExportModal.tsx`, `Economics/FinancialMetricsPanel.tsx`, `Economics/FinanceModelDocumentView.tsx` (skomentowane w kodzie jako zastąpione przez `FinancialModelWorkspace`, `FinancialModelWorkspace.tsx:2710-2716).

**`Economics/VersionHistoryPanel.tsx`** jest żywy, ale **nie dla Finance** — montowany w `src/components/Presentations/DeckBuilder/DeckBuilder.tsx:1808,2101`. Mylące umiejscowienie w katalogu `Economics/`, nie licz go jako Finance UI.

**Szczególnie mylący przypadek — `dev-render/screens/finance-value-panels.tsx`** (istniejący PRZED tym pakietem): komentarz w pliku twierdzi „the two M16 Finance panels wired to real data in section B" (`ValueOfficePanel`, `DriverPlannerPanel`) i odwołuje się do funkcji `FinanceHub.mapInitiativesToValueOffice()` / `buildDriverTreeFromModelPreview()`. **Żadna z tych funkcji ani żaden JSX-mount tych paneli nie istnieje w `FinanceHub.tsx` dziś** (`grep -n "ValueOfficePanel\|DriverPlannerPanel\|mapInitiativesToValueOffice\|buildDriverTreeFromModelPreview" FinanceHub.tsx` → 0 trafień). To dokładnie wzorzec z pamięci projektu „audyty starzeją się w ~3 dni" — harness/komentarz twierdzi co innego niż stan kodu. Nie ufaj temu komentarzowi bez ponownego zmierzenia.

**Rekomendacja dla D–H**: nie zakładaj, że coś jest „już zrobione" bo plik istnieje i ma ładny komentarz. Zawsze `grep -rn "<KomponentName" src --include="*.tsx"` przed użyciem.

---

## 3. Zadanie 2 — Harness wizualny

### 3.1 Stan zastany: ZEPSUTY (potwierdzony ten sam wzorzec co w pamięci projektu)

`dev-render/main.tsx` importuje eagerly (przez `React.lazy`) **każdy** zarejestrowany ekran przy starcie modułu. `dev-render/screens/tools-sesja-wyjscie.tsx` był **nieobecny na dysku** mimo że:
- `main.tsx` referuje go od commita `af62da5a6e`,
- plik **był** przywrócony jako jawna zaślepka w commicie `02b7268371` („fix(m08): finance-hub dev-render harness + repair dangling harness import"),
- `02b7268371` **jest przodkiem** mojego HEAD (`git merge-base --is-ancestor 02b7268371 HEAD` → true),
- a mimo to `git show HEAD:dev-render/screens/tools-sesja-wyjscie.tsx` → `fatal: path does not exist` (plik zniknął z drzewa między tamtym commitem a moją bazą, bez jawnego commita usuwającego w `git log --diff-filter=D`).

Efekt: **każdy** z 136 ekranów w rejestrze `SCREENS` (nie tylko Finance) dawał `500 Internal server error` z Vite (`Failed to resolve import "./screens/tools-sesja-wyjscie"`), więc harness był całkowicie martwy dla całego repo, nie tylko dla Finance.

### 3.2 Naprawa (minimalna)

Przywrócono **dokładnie tę samą jawną zaślepkę** z `02b7268371` (`git show 02b7268371:dev-render/screens/tools-sesja-wyjscie.tsx > dev-render/screens/tools-sesja-wyjscie.tsx`) — plik jawnie mówi „PLACEHOLDER, nie odtwarza oryginalnego ekranu, nie używaj do odbioru". Zero innych zmian w istniejących ekranach.

### 3.3 Nowy ekran harnessu dla Finance

`dev-render/screens/finance-model-workspace.tsx` (nowy) — montuje **realny** `<FinancialModelWorkspace>` (nie reimplementację) z mockami w kształcie kontraktu (`V8FinanceModelDetail` / `V8FinanceModelOutputsResult` / `V8FinanceModelValidationResult` — `src/services/api/v8/finance.ts:44-107`), wpiętymi przez podmianę metod singletona `V8FinanceApi` (ten sam wzorzec co istniejący `dev-render/screens/decision-record.tsx`, które patchuje `Api.getDecision`). Bez logowania, bez żywej bazy — wszystkie sieciowe zależności są zaślepione.

Zarejestrowany w `dev-render/main.tsx` jako `?screen=finance-model-workspace`, z parametrami `&status=draft|approved` i `&name=<string>`.

### 3.4 Dowód działania — zrzuty realnego ekranu

`docs/validation/finance-v3/generated/gate-e/visual/`:

| Plik | Rozdzielczość | Motyw |
|---|---|---|
| `finance-model-workspace-1920-light.png` | 1920×1080 | light |
| `finance-model-workspace-1440-light.png` | 1440×900 | light |
| `finance-model-workspace-1280-light.png` | 1280×800 | light |
| `finance-model-workspace-1440-dark.png` | 1440×900 | dark |
| `finance-model-workspace-zoom200-light.png` | 1440×900, `document.documentElement.style.zoom='200%'` | light |

**Light jest realnie wspierana** — nie zakładałem, sprawdziłem: `?theme=light` renderuje spójny jasny motyw przez cały ekran (tła `bg-c-bg`/`bg-white`, tekst ciemny), zero nieprzetłumaczonych ciemnych bloków. Dowód: pliki `*-light.png` powyżej.

Zrzuty są czyste (zero gwiazdek/ozdób harnessu w kadrze — panel „Uwagi"/„Lista" harnessu widoczny w rogu to część samego narzędzia deweloperskiego, nie produktu; nie wchodzi w kadr `--clip` użyty do kontroli negatywnej).

### 3.5 Kontrola negatywna (wymagana) — PASS

Dwa zrzuty tego samego regionu (nagłówek, `--clip=0,0,1440,140`) z **różnymi wartościami mocka**:

- `NEGCTRL-a-before-draft.png`: `name="DBR77 — Model bazowy FY2026"`, `status=draft` → nagłówek pokazuje ten tytuł, badge `DRAFT`, przycisk **„Zatwierdź"** (aktywny, klikalny).
- `NEGCTRL-b-after-approved-renamed.png`: `name="KONTROLA NEGATYWNA - zmieniony mock"`, `status=approved` → nagłówek pokazuje NOWY tytuł, badge zmienia się na **`APPROVED`** (zielony), a przycisk „Zatwierdź" znika, zastąpiony statycznym **„Zatwierdzony"** (zielona pigułka z kłódką, bez akcji).

Tytuł, badge i zestaw przycisków zmieniły się w odpowiedzi na zmianę mocka — **to dowód, że harness renderuje realny komponent, nie atrapę/cache**. Ten sam zrzut jest jednocześnie **żywym dowodem `OWN-FIN-013`**: stan `approved` faktycznie nie daje dziś żadnej ścieżki dalszej pracy (statyczna etykieta, zero `Otwórz ponownie`/`Utwórz nową wersję`), dokładnie jak zgłosił właściciel.

### 3.6 Ograniczenia harnessu — jawnie

- Testowano tylko workspace **Models**. Pozostałe cztery workspace'y (Statements/Analysis/Valuation/Prediction-budget) **nie mają jeszcze** własnego ekranu dev-render — `EVIDENCE_MISSING` dla wizualnego dowodu tamtych ekranów; ustalenia o nich w §1/§4 pochodzą z czytania kodu (plik:linia), nie ze zrzutu. Budowa pozostałych czterech ekranów harnessu to naturalna kontynuacja dla D–H przy pracy nad każdym workspace'em.
- Zrzuty `browser preview` (interaktywne, przez `mcp__Claude_Browser`) bywały niestabilne (puste białe klatki przy pierwszym renderze po nawigacji) — **finalne zrzuty w repo pochodzą z `dev-render/shot.mjs` (Playwright headless)**, nie z interaktywnego podglądu, żeby uniknąć fałszywie pustych plików.

---

## 4. Mapa 22 wymagań właścicielskich

Legenda statusu: **SPEŁNIONE** / **CZĘŚCIOWO** / **WCALE** (osobno od `PASS`/`FAIL` używanych dla samego pakietu M).

| ID | Skrót zgłoszenia | Stan | Dowód (plik:linia) |
|---|---|---|---|
| `OWN-FIN-001` | Obecny układ list zaakceptowany | **CONSTRAINT, nie do zmiany** | `FinanceHub.tsx` — zgodny z TRIADA (§1.1); traktować jako bazę |
| `OWN-FIN-002` | Błąd wyceny nie może zabić widoku | **CZĘŚCIOWO** | Brak importu `ErrorBoundary`/`componentDidCatch` w `ValuationWorkspace.tsx` (0 trafień) — ale są punktowe guardy: `Array.isArray(computed?.sensitivity?.matrix) && …length > 0 ? … : …` (`ValuationWorkspace.tsx:1503-1506`). To „doraźna naprawa podglądu", nie lokalny error boundary, zgodnie z opisem w rejestrze właścicielskim |
| `OWN-FIN-003` | „Report section" niezrozumiałe | **WCALE** | Etykieta wciąż `t('finance.pack.section.cta', 'Report section')` (`FinancialStatementPackWorkspace.tsx:907-910`), bez rozdzielenia generuj/publikuj/pokaż |
| `OWN-FIN-004` | Tryb pełnego obszaru roboczego | **WCALE** | `grep -rn "fullscreen\|Fullscreen\|Maximize" src/components/Finance src/components/Benefits` → **0 trafień** w żadnym z 5 workspace'ów |
| `OWN-FIN-005` | Paski statusów zabierają wysokość | **WCALE** | `FinancialStatementPackWorkspace.tsx` ma osobne rzędy: walidacje (linia 966-974), lineage (976-1029), report-section (1031+) — nie scalone w główny pasek P&L/BS/CF |
| `OWN-FIN-006` | Anonimowe strzałki zwijania | **CZĘŚCIOWO** | Triggery MAJĄ etykiety/liczniki (badge fail/warn przy walidacjach, ikona+tooltip przy lineage, tekst „Report section") — `FinancialStatementPackWorkspace.tsx:860-918` — ale nie w formacie „X/Y" postulowanym przez właściciela |
| `OWN-FIN-007` | Sekcja „Powiązane" (Analysis/Models/Prediction/Valuation z licznikami + `+New`) | **WCALE** | Istnieją tylko 2 skróty tworzenia (`onCreateModelFromPack`, `onCreateAnalysisFromPack`, `FinancialStatementPackWorkspace.tsx:756-772`) — brak Prediction/Valuation, brak listy ISTNIEJĄCYCH powiązanych artefaktów z licznikami |
| `OWN-FIN-008` | Kreator Analysis daje pusty Draft bez KPI | **WCALE** | `CreateAnalysisModal.tsx` (287 linii) ma tylko: tytuł, wybór statement pack, initialInvestment, horizon, discountRate, annualBenefits — **zero** pól KPI/katalogu/branży/preflight (`grep -n "kpi\|KPI\|indicator\|catalog\|preflight" CreateAnalysisModal.tsx` → 0). Tekst „No KPI values are available yet for this analysis" wciąż w kodzie (`FinancialAnalysisWorkspace.tsx:544-546`) |
| `OWN-FIN-009` | Fail-closed lokalny serwer vs prod DB | **NOT_APPLICABLE dla PKG_M** | Backend/env — poza zakresem (pakiet B); nie weryfikowane tutaj |
| `OWN-FIN-010` | Logowanie do bezpiecznego staging | **NOT_APPLICABLE dla PKG_M** | Backend/env — poza zakresem (pakiet B) |
| `OWN-FIN-011` | Jeden `Finance Workspace Bar` | **WCALE** | Komponent nie istnieje (`grep -rn "FinanceWorkspaceBar" src/` → 0). Dwa piętra nagłówka potwierdzone §1.4, zrzut `finance-model-workspace-1440-light.png` |
| `OWN-FIN-012` | Lifecycle sterowanie (Draft→Review→Approve) | **WCALE** | Analysis: status to statyczna pigułka (`FinancialAnalysisWorkspace.tsx:508-511`), zero przycisków przejścia poza „Use as model assumptions". Models: jest `Approve` (draft→approved), ale brak `Przekaż do przeglądu`/stanu `REVIEW` w UI |
| `OWN-FIN-013` | Approved bez akcji dalszej pracy | **WCALE** | Models: `status === 'approved'` renderuje wyłącznie statyczny `<span>` z kłódką (`FinancialModelWorkspace.tsx:986-989`), zero `Otwórz ponownie`/`Utwórz nową wersję`. **Dowód wizualny**: `NEGCTRL-b-after-approved-renamed.png` |
| `OWN-FIN-014` | Tabela wskaźników = kanon tabel | **WCALE** | `RatioBlocksTable` to lokalny komponent (`FinancialAnalysisWorkspace.tsx:676`), zero `StandardTable` w pliku (§1.2). Brak kontrolera Kolumn, kebaba per-wiersz, karty szczegółowej |
| `OWN-FIN-015` | Baseline/no-decision model jako kanon Models | **EVIDENCE_MISSING (głównie domena/silnik, nie UI)** | UI nie sprzeciwia się jawnie kanonowi, ale też go nie wymusza: `FinancialModelWorkspace` ma 4 zakładki (Inputs/Events/Outputs/Validation, `FinancialModelWorkspace.tsx:849-873`) z pełnym CRUD zdarzeń (`Events Timeline`) — to dokładnie to, co `OWN-FIN-015` chce **wykluczyć** z baseline. Wymaga decyzji domenowej, nie tylko UI |
| `OWN-FIN-016` | Wspólny pasek w Models (bez wyjątków) | **WCALE** | §1.4 — dwa piętra, `Wycen model` wciąż w głównym pasku (`FinancialModelWorkspace.tsx:965-975`), sprzecznie z `OWN-FIN-018` |
| `OWN-FIN-017` | Dwa widoki: Założenia / Wyliczenia | **WCALE** | Cztery zakładki, nie dwa widoki (`FinancialModelWorkspace.tsx:849-873`: `inputs`, `events`, `outputs`, `validation`) |
| `OWN-FIN-018` | Usunąć wycenę z głównego toku Models; naprawić Compute | **WCALE (wycena)** / **EVIDENCE_MISSING (Compute E2E)** | Przycisk „Wycen model" nadal w głównym pasku (`FinancialModelWorkspace.tsx:965-975`, nawiguje do `/economics?tab=valuation&createFrom=financial_model&…`). Realny E2E test `Compute` przy różnych horyzontach nie był w zakresie tego pakietu (read-only inwentaryzacja) — nie potwierdzam ani nie obalam timeoutu |
| `OWN-FIN-019` | Prediction: warianty A/B/C (standard/wskaźnikowy/fundamentalny) | **WCALE** | `BudgetWorkspace.tsx` ma 4 zakładki `inputs\|projections\|scenarios\|initiatives` (linia 104-107) — inna architektura niż postulowana; brak nazewnictwa Base/Bull/Bear, brak jawnego `initiative → assumption → driver → statement line → forecast` |
| `OWN-FIN-020` | Prediction: wspólny pasek + fullscreen | **WCALE** | Zero `StandardModuleBar` w `BudgetWorkspace.tsx` (§1.2); zero fullscreen (§4 `OWN-FIN-004`) |
| `OWN-FIN-021` | Valuation: `Methods & weights` jako osobny krok, Advisor widoczny | **WCALE** | Nawigacja to nadal `source, assumptions, results, sensitivity, export` (`ValuationWorkspace.tsx:757-761`) — brak `Methods & weights`. Advisor osadzony jako karta wewnątrz `results` (`ValuationWorkspace.tsx:1190-1220`), nie osobny krok |
| `OWN-FIN-022` | `Finance Lineage Navigator` (przodkowie/dzieci/rodzeństwo) | **WCALE** | `grep -rn "Lineage Navigator\|LineageNavigator" src/` → 0. Istnieje wyłącznie jednokierunkowy panel „source lineage" (skąd numer pochodzi) w `FinancialStatementPackWorkspace.tsx:976-1029` — nie graf rodziny artefaktów, nie licznik dzieci/wariantów |

**Podsumowanie liczbowe:** 0 w pełni spełnionych · 3 częściowo (`002`, `006`, częściowo `018`) · 17 wcale · 2 poza zakresem (`009`/`010`, backend) · 1 constraint (`001`).

---

## 5. Zadanie 3 — Kanon UI: reguły twarde dla D–H

Źródła: `docs/ui-standards/CANON.md`, `TRIADA_KANON.md`, `UI_UX_IMPLEMENTATION_STANDARD.md`, `03-modules/TABLE_AND_PREVIEW_CANON.md`, `03-modules/KEBAB_MENU_STANDARD.md`.

1. **Żelazna zasada** (`CANON.md` §1): ekrany funkcjonalne **nie wymyślają wyglądu** — składają zatwierdzone komponenty. Nowy lokalny wygląd = kandydat do refaktoru, nie standard. **Wszystkie 5 workspace'ów Finance dziś łamią tę zasadę** (§1.2).
2. **Hierarchia prawdy** (`CANON.md` §2): `CANON.md` → warstwy `00-04` → kod SSOT → implementacje referencyjne → `_archive/` (nigdy autorytet). Anatomia ekranu **listowego** rozstrzyga `TRIADA_KANON.md`, nie `TABLE_AND_PREVIEW_CANON.md` (ten drugi to mechanika/szczegół, nie redefinicja).
3. **Pułapka `primary-*` = crimson `#85182F`** (`TRIADA_KANON.md` §A10, `CANON.md` §6): crimson wyłącznie dla semantyki krytycznej (overdue/error/blocked/delete). Aktywne stany UI = neutralne. **Fokus zawsze `--c-focus` (niebieski), nigdy `primary-*`/crimson.** Egzekwowane przez `npm run lint:focus` (`scripts/check-focus-canon.sh`).
4. **Listy = wyłącznie `StandardTable`/`StandardModuleBar`/`StandardPreview`** (`src/components/standard/`). Zakaz bespoke tabel/menu/preview w powłokach list. Egzekwowane przez `scripts/check-list-canon.sh` (ratchet na baseline, patrz §6).
5. **Dokładnie jeden Command Row (Menu 3)** pod topbarem (`CANON.md` §4.5) — toolbary nie dublują Module Topbar, nie tworzą 2./3. rzędu, nie hostują akcji AI (te żyją po prawej Menu 3).
6. **Kebab wiersza = 5 bloków w niezmiennej kolejności**, 3 strefy wizualne (`TRIADA_KANON.md` §A6): wejście+domknięcie → przejścia stanu → czas → uniwersalny (Open preview/Edit/Archive) → destrukcyjny (zawsze ostatni, jedyna czerwień menu). Komponent (`RowActionsMenu.tsx`) **nic z tego nie wymusza automatycznie** — moduł musi podać bloki we właściwej kolejności.
7. **Preview = 6 bloków od góry do dołu** (`TRIADA_KANON.md` §A7); jeden komponent przycisku akcji, 4 warianty (§A8).
8. **Honest UI — zakazane** (`CANON.md` §4.1): fake success, silent fail, nieskończony spinner bez recovery, surowy błąd backendu jako jedyny komunikat, `[object Object]`/`NaN`/`Invalid Date`, stack trace w UI.
9. **Save state ≠ lifecycle state** (`CANON.md` §4.2): `Saved/Saving/Save failed` (trwałość) nie miesza się z `Draft/In Review/Approved/Generated/Failed` (lifecycle) — **dokładnie błąd, który `OWN-FIN-012` opisuje** dla Analysis (status = etykieta bez lifecycle).
10. **Akcje destrukcyjne**: wariant danger + confirm modal + jasna nazwa skutku + toast/error po wyniku (`CANON.md` §4.3).
11. **Kontrast i klawiatura**: mierzalne wymagania a11y i focus-matrix w `light-mode-readability.md` (warstwa 00-foundation) — nie grep-lint, wymaga VISUAL SWEEP (`scripts/audit-ui-compliance.js`).
12. **DoD dla pracy UI** (`CANON.md` §5): zatwierdzony shell/wzorzec · taksonomia przycisków · Menu 2/3 respektowane · brak dodatkowego rzędu toolbara · AI actions we właściwym miejscu · anatomia table/card/preview zgodna · dark+light czytelne · stany empty/loading/error uczciwe · brak nowego lokalnego języka wizualnego.

### 5.1 Bezpieczniki — stan na tej gałęzi

| Skrypt | Exit code | Metoda | Liczby |
|---|---|---|---|
| `scripts/check-list-canon.sh` | **0 (PASS)** | ratchet na baseline (fallback na pełny skan repo, bo staging był pusty) | **408 plików z naruszeniami dziś, baseline 409 — dług spadł o 1, nie rośnie.** To NIE znaczy zero naruszeń — znaczy „nie gorzej niż wczoraj" |
| `scripts/check-artefakt.sh` | **0 (PASS)** | ratchet na baseline | **7 naruszeń crimson w powłoce artefaktów dziś, baseline 7 — bez zmian** |

**Dla D–H**: oba bezpieczniki dziś przepuszczają commit, ale to nie dowód zgodności — to dowód, że **nie pogarszacie** istniejącego (bardzo dużego) długu. Jeśli któryś z pięciu workspace'ów Finance zostanie przepisany na `StandardTable`, liczba 408 powinna **spaść**, nie zostać płaska — jeśli zostanie płaska, sprawdźcie czy hook faktycznie widzi wasz diff (wymaga stage'owanych zmian, inaczej robi pełny fallback-skan).

---

## 6. Kontrola negatywna — inwentaryzacja (3 losowe twierdzenia „ekran X woła endpoint Y")

1. **Twierdzenie**: `FinancialModelWorkspace` woła `POST /api/v8/finance/models/:id/approve` (legacy), nie `/finance-v2`.
   **Dowód**: `src/components/Finance/FinancialModelWorkspace.tsx:193-199` (`approveModelWithFallback` → `V8FinanceApi.approveModel`) → `src/services/api/v8/finance.ts:537-544` (`v8Post('/finance/models/${modelId}/approve', …)`) → `V8_BASE='/api/v8'` (`src/services/api/v8/client.ts:9`). **Potwierdzone.**
2. **Twierdzenie**: kanoniczny `finance-v2` ma dokładnie dwa endpointy.
   **Dowód**: `server/src/routes/v8/finance-v2/models.routes.ts:103` (`router.post('/models/:modelId/approve', …)`) i `:175` (`router.post('/models/:modelId/reopen', …)`) — jedyne dwa `router.post/get/put/delete` w całym pliku (`grep -n "router\.\(get\|post\|put\|delete\|patch\)"` → 2 trafienia). **Potwierdzone.**
3. **Twierdzenie**: `CreateAnalysisModal` nie ma pól KPI.
   **Dowód**: `grep -n "kpi\|KPI\|indicator\|catalog\|preflight\|industry" src/components/Economics/modals/CreateAnalysisModal.tsx` → **0 trafień**; pola formularza to `title/selectedStatementPackId/initialInvestment/horizon/discountRatePct/annualBenefits` (`CreateAnalysisModal.tsx:32-39`). **Potwierdzone.**

Wszystkie trzy losowe próby się potwierdziły — nie było potrzeby przeglądania reszty inwentaryzacji ponownie.

---

## 7. Definition of Done — self-check

- [x] Tabelaryczna inwentaryzacja UI z dowodami plik:linia — §1, §2
- [x] Mapa 22 wymagań właścicielskich: spełnione/częściowo/wcale — §4 (0/3/17, +2 poza zakresem, +1 constraint)
- [x] Działający harness + co najmniej jeden realny zrzut Finance — §3, 7 plików PNG w `visual/`
- [x] Kontrola negatywna harnessu (zmiana mocka → zmiana zrzutu) — §3.5
- [x] Streszczenie kanonu jako lista reguł dla D–H — §5
- [x] Stan bezpieczników `check-list-canon.sh`/`check-artefakt.sh` — §5.1
- [x] Kontrola negatywna inwentaryzacji (3 losowe twierdzenia, plik:linia) — §6
- [x] `OWN-FIN-001` zapisane jawnie jako constraint dla D–H — §0, §4

**Status pakietu M: PARTIAL.** Rdzeń (Models workspace) w pełni zinwentaryzowany i udokumentowany zrzutem; pozostałe cztery workspace'y zinwentaryzowane przez czytanie kodu (plik:linia) ale **bez** własnego zrzutu harnessu — `EVIDENCE_MISSING` dla ich wizualnej strony, nie dla ich stanu kodu. `OWN-FIN-018` (realny E2E Compute) i `OWN-FIN-015` (kanon domenowy baseline) — `EVIDENCE_MISSING`/wymagają decyzji spoza czystego UI.

---

## 8. Co NIE zostało zrobione (jawnie)

- Nie zbudowano ekranów harnessu dla Statements/Analysis/Valuation/Prediction-budget (tylko Models). Naturalna kontynuacja przy pracy nad każdym z nich.
- Nie zweryfikowano realnego E2E `Compute` (timeout 20s z `OWN-FIN-018`) — poza zakresem read-only inwentaryzacji, wymaga żywego backendu, którego ten pakiet nie miał dotykać.
- Nie naprawiono żadnego z 19 martwych plików w `Economics/panels/`+`charts/` — zgłoszone w §2, decyzja (dokończyć wpięcie czy usunąć) należy do właściciela/D–H.
- Nie zmierzono a11y/kontrastu na żadnym z 5 workspace'ów (wymaga VISUAL SWEEP, poza zakresem tego pakietu).

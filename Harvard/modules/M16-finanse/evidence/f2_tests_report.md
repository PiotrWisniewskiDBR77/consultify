# M16 — Finanse (Economics / Financial Analysis v3) — FAZA 2: TESTY

**Agent:** TESTY
**Data:** 2026-06-11
**Branch:** `feat/deliverables-light`
**Repo:** `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify`
**Log:** `Harvard/modules/M16-finanse/evidence/f2_tests.log`

---

## 0. PODSUMOWANIE (TL;DR)

| Blok | PASS | FAIL | SKIP | Pliki |
|---|---|---|---|---|
| FE komponenty/hooki | 142 | 2 | 0 | 23 |
| Unit serwisy (valuation/modeling/statement/economics) | 160 | 0 | 0 | 19 |
| Integration (economics routes + p05/p04 kontrakty) | 37 | 4 | 0 | 5 |
| BE server (financeRuntime/financeIntegration/finance.routes/p05) | 171 | 8 | 0 | 4 |
| **RAZEM** | **510** | **14** | **0** | **51** |

E2E (Playwright) **nie uruchamiane** w F2 (wymagają działającego serwera): 2 pliki, 33 testy.

**Werdykt o obliczeniach finansowych:** **CZĘŚCIOWO testowane realnie.**
- Modele finansowe (P&L/BS/CF) i metryki ROI/NPV/IRR/payback — **TAK**, asercje na konkretnych liczbach.
- **Wycena (DCF/terminal value/WACC) — NIE** weryfikowana numerycznie (tylko `toBeTypeOf('number')`).
- **Ratio analysis, budgeting, forecast — BRAK** dedykowanych testów obliczeniowych (mockowane lub tylko shape).

---

## 1. INWENTARZ TESTÓW

### 1a. FE — komponenty/hooki (`vitest`, config root `vitest.config.ts`)

| Plik | Czego dotyczy | #testów |
|---|---|---|
| `src/components/Economics/__tests__/useFinanceData.test.tsx` | hook ładowania danych finansowych | 8 |
| `src/components/Economics/__tests__/financeModelLabels.test.ts` | etykiety/i18n modeli | 12 |
| `src/views/__tests__/FullROIView.smoke.test.tsx` | smoke widoku ROI | 3 |
| `tests/components/Economics/BenefitsTrackingDashboard.test.tsx` | dashboard śledzenia korzyści | 4 |
| `tests/components/Economics/CreateAnalysisModal.v8-create.test.tsx` | modal create analizy (V8 seam) | 2 |
| `tests/components/Economics/CreateModelModal.v8-create.test.tsx` | modal create modelu (V8 seam) | 2 |
| `tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx` | hub + governed V8 seam routing | 6 |
| `tests/components/Economics/FinanceLaneStrip.test.tsx` | pasek toru P05 | 9 |
| `tests/components/Economics/FinancePreviewPanel.v8-analysis-mutations.test.tsx` | panel preview + mutacje | 6 |
| `tests/components/Economics/FinancialMetricsPanel.test.tsx` | panel metryk | 2 |
| `tests/components/Economics/useFinanceData.v8-analyses.test.tsx` | hook listy analiz V8 | 10 |
| `tests/components/Economics/useFinanceLane.test.tsx` | hook toru | 8 |
| `tests/components/Economics/useFinanceRowActions.v8-analysis-create.test.tsx` | akcje wierszy: create | 4 |
| `tests/components/Economics/useFinanceRowActions.v8-analysis-delete.test.tsx` | akcje wierszy: delete | 4 |
| `tests/components/Economics/useFinanceRowActions.v8-analysis-mutations.test.tsx` | akcje wierszy: mutacje | 6 |
| `tests/components/Economics/useFinanceSelection.v8-analysis-ratios.test.tsx` | selekcja + ratio (UI) | 2 |
| `tests/components/Economics/useFinanceSelection.v8-statement-pack-detail.test.tsx` | selekcja + detal pakietu sprawozdań | 7 |
| `tests/components/Finance/ExportToOutputDialog.v8-proposals.test.tsx` | eksport do Outputs (propozycje V8) | 4 |
| `tests/components/Finance/FinancialModelWorkspace.v8-outputs.test.tsx` | workspace modelu + outputs | 16 |
| `tests/components/Finance/FinancialStatementImportWizard.v8-manual-flow.test.tsx` | wizard importu sprawozdań (manual) | 8 |
| `tests/components/Finance/FinancialStatementPackWorkspace.v8-read-seam.test.tsx` | workspace pakietu (read seam) | 5 |
| `tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx` | workspace sprawozdania (read seam) | 12 |
| `tests/components/Benefits/FinancialAnalysisWorkspace.v8-read-seam.test.tsx` | workspace analizy finansowej (read seam) | 4 |

### 1b. Unit — serwisy obliczeniowe (`vitest`, config root)

| Plik | Czego dotyczy | #testów | Realne obliczenia? |
|---|---|---|---|
| `tests/unit/services/valuationService.computeValuation.test.ts` | DCF compute | 2 | **SŁABE** (tylko typeof number) |
| `tests/unit/services/valuationService.getValuation.test.ts` | odczyt wyceny | 2 | NIE (readback stałej 123) |
| `tests/unit/services/valuationService.updateAssumptions.test.ts` | zapis założeń WACC | 2 | częściowo (zapisane wartości) |
| `tests/unit/services/valuationService.defaultAssumptions.test.ts` | domyślne założenia | 3 | częściowo (defaulty) |
| `tests/unit/services/valuationService.approve-advisory-negotiation.test.ts` | workflow akceptacji | 7 | NIE (status flow) |
| `tests/unit/services/valuationService.more.test.ts` | edge-case'y wyceny | 6 | częściowo |
| `tests/unit/services/v8-finance-api.test.ts` | API V8 finance (kontrakty) | 37 | NIE (shape/kontrakt) |
| `tests/unit/backend/services/financialModelingService.computeModel.test.ts` | **P&L/BS/CF compute** | 2 | **TAK** (REVENUE=100, COGS=-40, GROSS_PROFIT=60, BS/CF tie pass) |
| `tests/unit/backend/services/financialStatementService.test.ts` | serwis sprawozdań | 9 | częściowo |
| `tests/unit/backend/services/financialStatementPackService.test.ts` | serwis pakietów | 2 | NIE (shape) |
| `tests/unit/backend/services/financialPackDownstream.test.ts` | downstream pakietu | 2 | NIE |
| `tests/unit/backend/services/financialService.test.js` | serwis finansowy (legacy) | 7 | częściowo |
| `tests/unit/backend/financialCalculatorService.test.js` | ROI/NPV/IRR/payback/CAGR | 10 | **FAŁSZYWA ZIELEŃ** (impl. zdefiniowany w teście, nie importuje produkcji) |
| `tests/unit/backend/financialService.test.js` | serwis finansowy (legacy 2) | 9 | częściowo |
| `tests/unit/backend/economics/economicsFinancials.test.ts` | **NPV/IRR/ROI/payback/scenariusze** | 36 | **TAK** (importuje realny serwis, asercje numeryczne) |
| `tests/unit/backend/middleware/economicsValidation.test.js` | walidacja inputu | 7 | n/d (walidacja) |
| `tests/unit/backend/scripts/financeImportTarget.test.ts` | target importu (DB resolver) | 5 | n/d (config) |
| `tests/unit/backend/v4-smoke/r1-finance.test.ts` | smoke financeEnterpriseService | 10 | **NIE** (tylko `typeof === 'function'`) |
| `tests/backend/services/economicsFinancials.test.ts` | duplikat smoke economics | 2 | częściowo |

### 1c. Integration (`vitest`, `--no-file-parallelism`)

| Plik | Czego dotyczy | #testów |
|---|---|---|
| `tests/integration/routes/economics.test.js` | endpointy economics | 3 |
| `tests/integration/routes/economicsFinancials.test.js` | endpoint financials | 1 |
| `tests/integration/routes/economicsFlow.test.js` | pełny flow analizy (real DB) | 4 |
| `tests/integration/p05-finance-lane.contract.test.ts` | kontrakt toru P05 (serwis) | 10 |
| `tests/integration/p04-kpi-workflow.contract.test.ts` | kontrakt KPI/finance lane | 12 |

### 1d. BE server (`vitest --config server/vitest.config.ts --dir server`)

| Plik | Czego dotyczy | #testów |
|---|---|---|
| `server/src/services/v8/__tests__/financeRuntime.test.ts` | runtime: readiness, confidence, linkages | 14 |
| `server/src/services/v8/__tests__/financeIntegrationService.test.ts` | dashboard, hooks, integracje | 97 |
| `server/src/routes/v8/__tests__/finance.routes.test.ts` | routery V8 finance | 36 |
| `server/src/routes/v8/__tests__/p05-finance-lane.test.ts` | router toru P05 (advance/lane) | 32 |

### 1e. E2E (Playwright — NIE uruchamiane w F2)

| Plik | Czego dotyczy | #testów |
|---|---|---|
| `tests/e2e/smoke/p05-finance-lane.spec.ts` | smoke toru P05 | 12 |
| `tests/e2e/smoke/deploy-gate-api-execution-benefits-finance.spec.ts` | deploy-gate API benefits/finance | 21 |

---

## 2. WYNIKI URUCHOMIENIA (PASS/FAIL/SKIP + czas)

| Blok | PASS | FAIL | SKIP | Czas |
|---|---|---|---|---|
| FE komponenty/hooki | 142 | 2 | 0 | 3.19 s |
| Unit serwisy | 160 | 0 | 0 | 1.86 s |
| Integration | 37 | 4 | 0 | 15.37 s |
| BE server | 171 | 8 | 0 | 2.11 s |
| **RAZEM** | **510** | **14** | **0** | ~22.5 s |

### Root-cause każdej awarii

**A) FinanceHub.v8-runtime-strip (2 FAIL, FE)** — *UI label drift*.
Testy klikają `getByRole('button', { name: '+ Importuj statement…' })` i `'complete-import…'`, ale przycisk o tej nazwie już nie istnieje w renderze (toolbar przebudowany: „Ready Statements / Recovery Queue / Rejected Imports"). To **stary import/label-drift** — testy nie nadążyły za przebudową hubu. Nie jest to bug logiki finansowej.

**B) economicsFlow.test.js (4 FAIL, integration)** — *schema-drift PG / rola `iris`*.
Plik ustawia `MOCK_DB='false'` + SQLite path, ale resolver targetu DB i tak wybiera **Postgres** → `INSERT INTO organizations ...` kończy się `role "iris" does not exist`. Brak lokalnego Postgresa z rolą `iris`. **Awaria infrastrukturalna środowiska, nie logiki finansowej.** Te testy zielenią się tylko z prawdziwym Postgresem (`DATABASE_URL=postgresql://iris:...`).

**C) p05-finance-lane.test.ts router (8 FAIL, BE)** — *mock-drift `DbPromise`*.
Plik **w pełni mockuje** `DbPromise` (0 błędów `iris` w runie). Test seeduje `mockDbGet.mockResolvedValueOnce(run)` raz na test, ale obecny handler `advanceLane` woła `DbPromise.get` wielokrotnie (flagi org → `getLaneRun` → …). Pojedyncza wartość `mockResolvedValueOnce` jest konsumowana przez wcześniejsze wywołanie, więc `getLaneRun` dostaje `undefined` → `SELECT * FROM v8_finance_lane_runs` zwraca null → **HTTP 404 zamiast 200**. Serwis `financeLaneService.ts` i ten test plik były ostatnio ruszane w tym samym commicie `2291c6c8b4` — kolejność wywołań DB w handlerze się zmieniła, sekwencja mocków nie. **Czysty mock-drift (kontraktowy), do naprawy w teście.** Uwaga: ten sam tor P05 jako kontrakt serwisowy (`tests/integration/p05-finance-lane.contract.test.ts`) **przechodzi** — czyli logika żyje, dryfuje tylko mock route-testu.

---

## 3. MAPA POKRYCIA S1–S8

Legenda: ✅ jest i przechodzi · ⚠️ jest, ale słabe / fałszywa zieleń / failing · ❌ brak.
PR-gate = `test-suite.yml` uruchamia się **tylko na `main`/`develop`** (lub `workflow_dispatch`). Branch roboczy `feat/deliverables-light` ORAZ domyślny `Londyn` **NIE są bramkowane** — dla M16 PR-gate efektywnie = **brak**.

| Seam | FE | BE | E2E | PR-gate | Uwagi |
|---|---|---|---|---|---|
| **S1** Statements import Excel + canonical table | ✅ ImportWizard, StatementWorkspace, PackWorkspace | ⚠️ financialStatementService (częściowo), financeRuntime readiness ✅ | ⚠️ deploy-gate spec (nieuruch.) | ❌ (Londyn) | import-complete lookup test (FinanceHub) **FAIL** — label-drift |
| **S2** Modele finansowe create + workspace | ✅ CreateModelModal, FinancialModelWorkspace (16) | ✅ **computeModel** P&L/BS/CF z realnymi liczbami | ⚠️ | ❌ | najlepiej pokryty seam obliczeniowy |
| **S3** Analiza finansowa (ratio / obliczenia) | ⚠️ useFinanceSelection.ratios (tylko UI selekcja) | ⚠️ economicsFinancials ✅ NPV/IRR/ROI; **ratioAnalysisService mockowany w route, brak unit compute** | ❌ | ❌ | ratio NIE liczone realnie nigdzie |
| **S4** Predykcja / forecast | ❌ | ⚠️ financeRuntime linkages forecast (shape), **financeEnterpriseService.createForecastCycle tylko `typeof`** | ❌ | ❌ | **brak testu obliczeń forecastu** |
| **S5** Wycena (valuation formuły DCF/WACC/terminal) | ❌ | ⚠️ valuationService: compute zwraca `number`, **brak asercji wartości DCF/TV/EV** | ❌ | ❌ | **silnik wyceny nieweryfikowany numerycznie** |
| **S6** Analiza inwestycyjna (ROI/NPV/IRR/payback) | ✅ FullROIView smoke, BenefitsTrackingDashboard | ✅ economicsFinancials (realne), ⚠️ financialCalculatorService = **fałszywa zieleń** | ⚠️ | ❌ | core math OK w economicsFinancials |
| **S7** Dual-runtime V8→legacy degradacja | ✅ *.v8-read-seam, FinanceHub seam routing (2 FAIL) | ✅ financeRuntime fallback, financeIntegrationService (97) | ⚠️ p05 spec | ❌ | seam dobrze pokryty, 2 FE testy label-drift |
| **S8** Export do Outputs | ✅ ExportToOutputDialog.v8-proposals, FinancialModelWorkspace.v8-outputs | ⚠️ przez finance.routes | ❌ | ❌ | FE-only, brak E2E faktycznego eksportu |

---

## 4. PUŁAPKI (kluczowe dla modułu finansowego)

1. **FAŁSZYWA ZIELEŃ — `financialCalculatorService.test.js` (10 testów).** Plik **definiuje własną implementację** kalkulatora (ROI/NPV/IRR/payback/CAGR/breakeven) wewnątrz testu i testuje ją zamiast importować produkcyjny serwis. Wszystkie zielone, ale **nie chronią ani jednej linii kodu produkcyjnego.** Najgroźniejsza pułapka w module — daje złudzenie pokrycia rdzennej matematyki inwestycyjnej.

2. **Wycena testowana tylko „że zwraca number".** `valuationService.computeValuation` — jedyna asercja na wynik DCF to `expect(results.dcf.enterpriseValue).toBeTypeOf('number')`. `getValuation` czyta z powrotem zaszytą stałą `123`. **Żaden test nie sprawdza, czy DCF/terminal value/WACC liczą się POPRAWNIE.** Błąd w formule wyceny przeszedłby przez całą suitę.

3. **Endpoint zwraca 200 ≠ obliczenia poprawne.** `v8-finance-api.test.ts` (37) i `r1-finance` (10) to kontrakty/shape — `typeof === 'function'`, kształt odpowiedzi. Mylą „API żyje" z „liczby się zgadzają".

4. **Mock serwisów obliczeniowych w route-testach.** `p05-finance-lane.test.ts` mockuje `ratioAnalysisService`, `valuationService`, `financialModelingService`, `budgetingService` — czyli **router jest testowany bez prawdziwej matematyki pod spodem**. To poprawne dla testu routingu, ale oznacza, że realne obliczenia muszą być pokryte w unit-ach (a S3/S4/S5 nie są).

5. **Testy ścieżki za flagą — który stan?** Cały moduł jest za `beta` + V8 (`isV8Enabled`). Testy FE/BE jawnie mockują `getV8Flags → { v8_enabled: true }` / `isV8Enabled → true` — czyli **testowany jest WYŁĄCZNIE stan flagi ON (ścieżka V8)**. Stan flagi OFF (legacy fallback dla org bez V8) testowany tylko punktowo w `*.v8-read-seam` (bounded compatibility statuses) — i jeden z tych FE testów (`falls back to legacy child statement detail`) **FAIL** przez label-drift. Realny user beta-OFF nie ma pokrycia E2E.

6. **Schema-drift PG / rola `iris`.** `economicsFlow.test.js` zielenieje wyłącznie z lokalnym Postgresem; w CI bez DB to fałszywy FAIL/blocker. Resolver targetu DB ignoruje `MOCK_DB=false` ustawione w teście — pułapka konfiguracji środowiska.

---

## 5. BACKLOG (typ · plik · scenariusz · priorytet)

| # | Typ | Plik | Scenariusz | Priorytet |
|---|---|---|---|---|
| B1 | **Fałszywa zieleń → przepisać** | `tests/unit/backend/financialCalculatorService.test.js` | Usunąć inline-impl, importować realny serwis ROI/NPV/IRR/payback; asercje numeryczne na znanych przykładach (np. NPV(cf, r) = X) | **P0** |
| B2 | **Brak compute test** | nowy `valuationService.computeValuation.numeric.test.ts` | Asercja DCF: dla zadanego FCFF + WACC + terminal (gordon/exit) sprawdzić `enterpriseValue`, `terminalValue`, `equityValue = EV − netDebt` z `toBeCloseTo` | **P0** |
| B3 | **Brak compute test** | nowy unit dla `ratioAnalysisService` | Realne ratio (current, quick, gross/net margin, ROE, D/E) na zadanym bilansie; brak jakiegokolwiek testu obliczeń ratio | **P0** |
| B4 | **Brak compute test** | nowy unit dla forecast (`financeEnterpriseService.createForecastCycle` / runtime forecast) | Weryfikacja wartości prognozy (growth, period roll-forward), nie tylko `typeof`/shape | **P1** |
| B5 | **Mock-drift → naprawić** | `server/src/routes/v8/__tests__/p05-finance-lane.test.ts` | Zaktualizować sekwencję `mockDbGet.mockResolvedValueOnce` do obecnej kolejności wywołań w `advanceLane`/`getLaneRun` (8 testów 404→200) | **P0** |
| B6 | **Label-drift → naprawić** | `tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx` | Zaktualizować selektory przycisków importu do obecnego toolbara (2 testy `+ Importuj statement`/`complete-import`) | **P1** |
| B7 | **Infra / env** | `tests/integration/routes/economicsFlow.test.js` | Wymusić realny SQLite (resolver respektuje `MOCK_DB=false`) lub jawnie `skipIf(!RUN_DB_TESTS)`; obecnie twardy FAIL bez Postgres `iris` | **P1** |
| B8 | **Brak E2E flagi OFF** | nowy E2E / unit | Ścieżka legacy gdy `isV8Enabled=false` (beta-OFF org) — render + degradacja; obecnie testowany prawie wyłącznie stan ON | **P2** |
| B9 | **Brak realnego E2E export** | `tests/e2e/smoke/...benefits-finance.spec.ts` (rozszerzyć) | Faktyczny eksport modelu do Outputs (S8) zamiast tylko FE-mock dialogu | **P2** |
| B10 | **PR-gate** | `.github/workflows/test-suite.yml` | Branże `main`/`develop` — dodać `Londyn` (default) do triggerów albo świadomie zaakceptować brak bramki dla finansów na trunk | **P1** |

---

## 6. CZY OBLICZENIA FINANSOWE SĄ TESTOWANE REALNIE? (werdykt)

**CZĘŚCIOWO — z poważnymi lukami w rdzeniu finansowym.**

- ✅ **Modele P&L/BS/CF** (`financialModelingService.computeModel`) — realne asercje liczbowe, w tym walidacje twarde (balance-sheet tie, cash tie = `pass`).
- ✅ **NPV/IRR/ROI/payback + scenariusze** (`economicsFinancials`) — realny serwis, asercje na znaku/wartościach/multiplikatorach scenariuszy.
- ⚠️ **Wycena (DCF/WACC/terminal)** — silnik **NIE** zweryfikowany numerycznie (tylko `toBeTypeOf('number')`).
- ❌ **Ratio analysis** — brak jakiegokolwiek unit compute (mockowany w route).
- ❌ **Forecast/budgeting** — brak testu obliczeń (tylko shape/`typeof`).
- ❌ **`financialCalculatorService.test.js`** — fałszywa zieleń, testuje własną kopię, nie produkcję.

Innymi słowy: dwa filary (modele, metryki inwestycyjne) są twardo pokryte, a trzy (wycena, ratio, forecast) opierają się na shape/mockach — błąd formuły w tych trzech przeszedłby przez całą suitę niezauważony.

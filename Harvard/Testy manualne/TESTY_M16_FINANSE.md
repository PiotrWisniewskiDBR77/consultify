# TESTY — M16 Finanse (FinanceHub / EconomicsView) — v2 po W1

> **Moduł:** M16 Finanse (`/finance`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki (v2):** 9 epik (F0–F9) — pełny stack wartości 5-warstwowej: dane → planowanie FP&A → decyzje kapitałowe → motor wartości → złota nić M16↔M13↔M14↔M15. Nowe fale W1: 5 paneli wartości, linkowanie inicjatyw, wersjonowanie modeli, investment appraisal, variance bridge, driver planner.
> **Testy automatyczne:** 30 testów w `tests/components/finance/*M16.test.tsx` + `tests/integration/routes/initiativeEconomicsLinks.test.ts` + `tests/integration/routes/financeModelVersions.test.ts`
> **Data aktualizacji:** 2026-06-24

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

### Architektura modułu

| Warstwa | Komponent | Ścieżka |
|---|---|---|
| Entry | `EconomicsView` → `FinanceHub` | `src/components/Economics/FinanceHub.tsx` (~2428 linii) |
| Feature flags | `isFinanceFlagEnabled(flag)` | `src/components/Economics/financeFeatureFlags.ts` |
| 5 paneli wartości | InvestmentAppraisal / ValueOffice / VarianceBridge / ValuationVisuals / DriverPlanner | `src/components/Economics/panels/` |
| Linkowanie inicjatyw | `LinkInitiativeModal` | `src/components/Economics/modals/LinkInitiativeModal.tsx` |
| Wersjonowanie modeli | `ModelVersionHistory` | `src/components/Economics/ModelVersionHistory.tsx` |
| API v8 | `V8FinanceApi` | `src/services/api/v8/finance.ts` |
| Backend router | `finance.routes.ts` (v8) + `financeValueRoutes.ts` | `server/src/routes/v8/` |
| Integracja M14→M16 | `financeIntegrationService` | `server/src/services/v8/financeIntegrationService.ts` |
| Bridge M14→M15 | `M14HandoffInbox` | `src/components/Results/M14HandoffInbox.tsx` |

### Zakładki FinanceHub

| Zakładka | Tab key | Główna zawartość |
|---|---|---|
| Sprawozdania (Statements) | `statements` | Tabele P&L / BS / CF importowane z dokumentów |
| Modele (Models) | `models` | Modele finansowe 3-letniej prognozy |
| Analizy (Analysis) | `analysis` | Business cases, investment cases |
| Predykcja (Prediction) | `prediction` | Budget vs. Actual variance bridge |
| Wycena (Enterprise Valuation) | `valuation` | DCF + comps + NAV → football field |
| Inwestycje (Investment) | `investment` | Appraisal NPV / IRR / MIRR |

### Feature flags — jak aktywować

Flagi domyślnie OFF. Włącz przez URL query param:
```
/finance?valueOffice=1&investmentAppraisal=1&valuationVisuals=1&varianceBridge=1&driverPlanner=1&modelVersioning=1
```
Lub przez `localStorage`: `localStorage.setItem('ff_valueOffice', '1')`.

### Kluczowe zasady weryfikacji E2E
1. **Zawsze otwieraj DevTools → Network** — same zmiany UI to za mało; sprawdź response payload.
2. **V8-first + fallback**: `shouldFallbackToLegacyFinance` przy 400/404 → stary endpoint. Sprawdź status response.
3. **Seed danych**: `/api/v8/finance/seed` → generuje dane testowe; bez seedu panele mogą być puste.
4. **Testy inwestycyjne**: InvestmentAppraisalPanel jest na zakładce `investment` za flagą `investmentAppraisal=1`.

### Setup środowiska testowego
1. Uruchom dev server (`npm run dev`).
2. Zaloguj się jako admin organizacji z seedem danych (piotr/<HASLO> → org DBR77).
3. Przejdź na `/finance?valueOffice=1&investmentAppraisal=1&valuationVisuals=1&varianceBridge=1&driverPlanner=1&modelVersioning=1`.
4. Otwórz DevTools → Network (filtr: `/api/v8/finance` + `/api/initiatives`).
5. Miej pod ręką: ID inicjatywy z M13/M14 (z NetworkTab lub bazy), cashflow testowy (`-100, 40, 40, 40, 40`).

---

## F0. Infrastruktura i brama flagowa

### F0.1 Domyślny stan — zero paneli wartości bez flag
- Otwórz `/finance` (bez query params).
- **Asercja:** żaden panel wartości NIE jest widoczny (brak InvestmentAppraisalPanel, ValueOfficePanel, etc.).
- Zakładki Modele, Inwestycje, Predykcja, Wycena wyświetlają tylko standardową tabelę.

### F0.2 Aktywacja flagi przez URL
- Otwórz `/finance?investmentAppraisal=1`.
- Przejdź na zakładkę Inwestycje.
- **Asercja:** `InvestmentAppraisalPanel` widoczny poniżej standardowej tabeli.
- Przeładuj stronę — panel dalej widoczny (localStorage persists).

### F0.3 Aktywacja przez localStorage
- Otwórz DevTools Console: `localStorage.setItem('ff_valueOffice', '1')`.
- Przeładuj `/finance`.
- **Asercja:** `ValueOfficePanel` pojawia się na zakładce Modele.
- Usuń: `localStorage.removeItem('ff_valueOffice')` → po przeładowaniu panel znika.

### F0.4 Niezależność flag
- Aktywuj tylko `driverPlanner=1`.
- **Asercja:** wyłącznie `DriverPlannerPanel` widoczny na zakładce Modele. Żaden inny panel nie wyskakuje.

### F0.5 V8-first routing
- Sprawdź w Network: pierwsze wywołanie do `/api/v8/finance/models` (v8 endpoint).
- Symuluj 404 (DevTools → Block request patterns → `/api/v8/finance/models`).
- **Asercja:** app fallback do `/api/finance/models` (legacy) bez crash i bez białej strony.

---

## F1. Wycena przedsiębiorstwa (Football Field)

### F1.1 Renderowanie football field z danymi DCF
- Otwórz zakładkę Wycena (Enterprise Valuation) z flagą `valuationVisuals=1`.
- Wybierz rekord z DCF enterprise value.
- **Asercja:** `ValuationVisualsPanel` widoczny; sekcja "Football Field" zawiera co najmniej jeden pas (DCF).
- W Network sprawdź że `ValuationResults.dcf.enterpriseValue` jest liczbą, nie null.

### F1.2 Komparacja (Comps)
- Wybierz rekord z danymi porównawczymi (`comps.impliedEnterpriseValue.min/median/max`).
- **Asercja:** pas "Porównawcza" pojawia się w football field obok pasa DCF.
- `min <= median <= max` — brak wizualnego błędu (odwrócone pasy).

### F1.3 Wycena majątkowa (NAV)
- Wybierz rekord z `assetBased.netAssetValue`.
- **Asercja:** pas "Majątkowa (NAV)" widoczny jako degenerowany (low=mid=high).

### F1.4 Sensitivity heatmap (WACC × g)
- Wybierz rekord z `sensitivity.matrix` (min. 4 komórki).
- **Asercja:** sekcja "Heatmapa wrażliwości" widoczna; kolory odzwierciedlają wartości EV.
- Sprawdź że osie mają etykiety WACC (kolumny) i g (wiersze).

### F1.5 Tor pusty — graceful empty state
- Otwórz zakładkę Wycena bez żadnego wybranego rekordu.
- **Asercja:** panel pokazuje stan pusty (wskazówka "Wybierz rekord wyceny") zamiast crash.

---

## F2. Integracja M14 → M16 (Linkowanie inicjatyw)

### F2.1 Badge "Unlinked" na rekordzie modelu
- Przejdź na zakładkę Modele; znajdź model bez powiązanej inicjatywy.
- **Asercja:** badge "Unlinked" widoczny w komórce Inicjatywa (kolor neutralny/szary).

### F2.2 Kliknięcie "Unlinked" → modal LinkInitiativeModal
- Kliknij badge "Unlinked".
- **Asercja:** pojawia się modal z tytułem "Powiąż z inicjatywą" lub podobnym.
- Modal zawiera: dropdown inicjatyw, pole "Finance Model Ref" (auto-uzupełnione), opcje linkage type.

### F2.3 Linkowanie — success path
- Wybierz inicjatywę z dropdownu, kliknij "Powiąż".
- **Asercja w Network:** `POST /api/initiatives/{id}/economics-links` z body `{ financeModelRef, linkageType, status }` → response 201.
- **Asercja w UI:** modal zamknięty; badge zmieniony na nazwę inicjatywy (lub "Linked").

### F2.4 Linkowanie — 400 na brakującym `financeModelRef`
- Wyczyść pole financeModelRef w modalu i kliknij "Powiąż".
- **Asercja:** UI pokazuje błąd walidacji zamiast wysyłania requestu.

### F2.5 GET listy powiązań
- Po powiązaniu, sprawdź w Network `GET /api/initiatives/{id}/economics-links`.
- **Asercja:** response `200` z polem `links` będącym tablicą zawierającą nowo dodane powiązanie.

---

## F3. Motor wartości — Value Office Panel

### F3.1 Renderowanie z przykładowymi danymi
- Aktywuj `valueOffice=1` i przejdź na zakładkę Modele.
- **Asercja:** `ValueOfficePanel` wyświetlony z waterfallowym mostem wartości i bąbelkowym portfolio.
- Jeśli brak inicjatyw w org — panel używa przykładowych danych (nigdy nie jest pusty).

### F3.2 Value Bridge — kroki waterfalla
- Sprawdź w Network `POST /api/v8/finance/value/value-bridge`.
- **Asercja:** response zawiera `steps` (tablica) i `totalRealized` (liczba).
- UI: sekcja "Most wartości" z etykietami Baseline / etapy / Total.

### F3.3 Portfolio Bubble — kwadranty
- Sprawdź w Network `POST /api/v8/finance/value/portfolio/prioritize`.
- **Asercja:** response zawiera inicjatywy z polem `quadrant` (fund / evaluate / quick_win / defer).
- UI: bąble mają różne kolory wg kwadrantu (zielony=fund, bursztyn=evaluate, niebieski=quick_win, szary=defer).

### F3.4 Fail-soft na błędzie serwera
- Zablokuj `/api/v8/finance/value/value-bridge` (DevTools).
- **Asercja:** panel pokazuje cichą notatkę błędu (nie blokuje całego widoku); portfolio może nadal działać.

---

## F4. Tornado chart + advanced sensitivity

### F4.1 Tornado — wrażliwość na parametry
- Wybierz rekord wyceny z danymi `tornado: [{label, low, high}]`.
- **Asercja:** sekcja "Tornado" wyświetlona; najszerszy pasek (największa delta) na górze.

### F4.2 Brak danych tornado — graceful
- Wybierz rekord bez pola `tornado` w danych.
- **Asercja:** sekcja tornado nie wyświetlona (nie "null crash").

---

## F5. Variance Bridge + Driver Planner

### F5.1 Variance Bridge — dane plan vs aktual
- Aktywuj `varianceBridge=1`, przejdź na zakładkę Predykcja.
- **Asercja:** `VarianceBridgePanel` widoczny z polami do wpisania linii variance.

### F5.2 Waterfall po obliczeniu
- Dodaj co najmniej 2 linie variance.
- Kliknij "Oblicz most".
- **Asercja w Network:** `POST /api/v8/finance/value/variance-bridge`.
- **Asercja w UI:** waterfall z krokami (zielony=favorable, czerwony=unfavorable).

### F5.3 Liczniki F/U
- **Asercja:** widoczny licznik favorable (zielony "F: n") i unfavorable (czerwony "U: n").

### F5.4 Driver Planner — drzewo domyślne SaaS
- Aktywuj `driverPlanner=1`, przejdź na zakładkę Modele.
- **Asercja:** `DriverPlannerPanel` pokazuje domyślne drzewo (Przychód = Klienci × ARPU) ze sliderami dla liści.

### F5.5 What-If — zmiana suwaka aktualizuje wynik
- Przesuń suwak "Klienci" (np. z 1200 na 1500).
- **Asercja:** wartość "Przychód" w sekcji wynikowej aktualizuje się w czasie rzeczywistym (bez request do serwera).

### F5.6 Wariancja pusta — graceful empty state
- Usuń wszystkie linie variance i kliknij "Oblicz".
- **Asercja:** panel pokazuje stan pusty ("Brak linii variance") zamiast crash.

---

## F6. Wersjonowanie modeli finansowych

### F6.1 Historia wersji — renderowanie
- Aktywuj `modelVersioning=1`; kliknij rekord modelu (otwiera `FinanceModelDocumentView`).
- **Asercja:** na dole dokumentu sekcja "Version history" widoczna.

### F6.2 Lista wersji z serwera
- Sprawdź w Network `GET /api/v8/finance/models/{modelId}/versions`.
- **Asercja:** response `200` z polem `data.versions` (tablica).

### F6.3 Diff między wersjami
- Jeśli lista ma ≥ 2 wersje: zaznacz dwie i kliknij "Compare".
- **Asercja w Network:** `GET /api/v8/finance/models/{modelId}/versions/diff?from={id1}&to={id2}` → `200`.
- **Asercja w UI:** tabela diff z kolumnami `Parametr / Poprzedni / Nowy`.

### F6.4 Diff bez parametrów — 400
- Wywołaj ręcznie: `GET /api/v8/finance/models/test/versions/diff` bez `from`/`to`.
- **Asercja:** response `400` z komunikatem "from and to required".

### F6.5 Flag OFF — brak sekcji wersji
- Wyłącz flagę `modelVersioning`; otwórz dokument modelu.
- **Asercja:** sekcja "Version history" niewidoczna.

---

## F7. Appraiser inwestycyjny (NPV / IRR / MIRR / PI)

### F7.1 Formularz wejściowy — layout
- Aktywuj `investmentAppraisal=1`, przejdź na zakładkę Inwestycje.
- **Asercja:** `InvestmentAppraisalPanel` z polami: Nakład inicjalny, Stopa dyskontowa (default 10%), Cashflows, przycisk "Oblicz".

### F7.2 Obliczenie — success path (Go)
- Nakład -100 000, cashflows: [40000, 40000, 40000], stopa: 10%.
- Kliknij "Oblicz".
- **Asercja w Network:** `POST /api/v8/finance/value/appraise` z body `{ cashFlows, discountRate, hurdleRatePct }`.
- **Asercja w UI:** wyniki (NPV, IRR, MIRR, Payback, Disc.Payback, PI) + badge "Realizować (go)".

### F7.3 Verdict "No-go" — ujemne NPV
- Nakład -1 000 000, cashflows: [10000, 10000], stopa: 15%.
- **Asercja:** verdict badge "Odrzucić (no-go)" (czerwony).

### F7.4 Verdict "Conditional" — NPV marginalne
- Dobierz cashflows żeby NPV ≈ 0 (PI ≈ 1.0–1.05).
- **Asercja:** verdict badge "Warunkowo (conditional)" (bursztynowy).

### F7.5 Degradacja na błąd serwera
- Zablokuj `POST /api/v8/finance/value/appraise`.
- **Asercja:** error notice (data-testid="appraise-failed"); brak crash; można spróbować ponownie.

### F7.6 Cashflows edycja dynamiczna
- Dodaj wiersz cashflow (przycisk "+") i usuń (przycisk "×").
- **Asercja:** każdy klik aktualizuje listę wierszy; brak wierszy nie blokuje UI.

---

## F8. Modal tworzenia analizy — Investment Case

### F8.1 Otwieranie modalu — investment_case type
- Zakładka Analizy → "Nowa analiza" → typ "Investment Case".
- **Asercja:** sekcja "Parametry inwestycyjne" z polami: Nakład inicjalny, Horyzont (default 5), Stopa % (default 10), Roczne korzyści.

### F8.2 Tytuł modalu zmienia się
- **Asercja:** tytuł = "New Investment Case" dla investment_case; standardowy dla innych typów.

### F8.3 Create — payload z polami inwestycyjnymi
- Tytuł: "Test Case", type: investment_case, nakład: 500000, horyzont: 5, stopa: 8, korzyści: 120000.
- **Asercja w Network:** `POST /api/v8/finance/analyses` body zawiera `{ initialInvestment: 500000, horizon: 5, discountRatePct: 8, annualBenefits: 120000 }`.

### F8.4 Walidacja pól numerycznych
- Wpisz tekst ("abc") w pole "Nakład inicjalny".
- **Asercja:** nie wyśle NaN do serwera; błąd walidacji lub ignorowanie.

---

## F9. Złota nić M16 ↔ M13 ↔ M14 ↔ M15

### F9.1 M14 → M16 linkowanie
- Model finansowy → badge "Unlinked" → modal → wybierz inicjatywę z M14.
- **Asercja:** `POST /api/initiatives/{id}/economics-links` → 201.

### F9.2 M15 Benefits Register bridge
- W M15 (`/results` z flagą `m14Handoff=1`): `M14HandoffInbox` widoczny.
- **Asercja w Network:** `GET /api/benefits-register/benefits` → 200.

### F9.3 Promote benefit
- Kliknij "Promuj" przy beneficie w M14HandoffInbox.
- **Asercja:** `POST /api/benefits-register/benefits/{id}/promote` → 200.

### F9.4 Nawigacja cross-module (M13 → M16)
- W M13: otwórz inicjatywę z `economics-links`; kliknij link do modelu finansowego.
- **Asercja:** nawigacja do `/finance` z widocznym powiązanym modelem.

### F9.5 Spójność danych seed
- `POST /api/v8/finance/seed` dla org → weryfikuj wszystkie 6 zakładek FinanceHub mają ≥1 rekord.
- **Asercja:** te same inicjatywy z M13/M14 pojawiają się w dropdownie modal linkowania.

---

## Podsumowanie epik ↔ testy automatyczne

| Epika | Opis | Auto-testy | Scenariusze manualne |
|---|---|---|---|
| F0 | Brama flagowa | `financeFeatureFlags` (w financeValueRoutes) | F0.1–F0.5 |
| F1 | Football Field + sensitivity | `ValuationVisualsPanelM16.test.tsx` (5 testów) | F1.1–F1.5 |
| F2 | Linkowanie M14→M16 | `initiativeEconomicsLinks.test.ts` (3 testy) | F2.1–F2.5 |
| F3 | Value Office / Value Bridge | `ValueOfficePanelM16.test.tsx` (4 testy) | F3.1–F3.4 |
| F4 | Tornado chart | `ValuationVisualsPanelM16.test.tsx` (test 4–5) | F4.1–F4.2 |
| F5 | Variance Bridge + Driver Planner | `VarianceBridgePanelM16.test.tsx` (5) + `DriverPlannerPanelM16.test.tsx` (5) | F5.1–F5.6 |
| F6 | Model versioning | `financeModelVersions.test.ts` (2 testy) | F6.1–F6.5 |
| F7 | Investment Appraisal | `InvestmentAppraisalPanelM16.test.tsx` (6 testów) | F7.1–F7.6 |
| F8 | Create Analysis (investment case) | — (UI-only) | F8.1–F8.4 |
| F9 | Złota nić M16↔M13↔M14↔M15 | — (cross-module, manual only) | F9.1–F9.5 |

**Łącznie auto:** 30 testów (25 komponent + 5 integracyjnych)
**Łącznie scenariusze manualne:** 43 scenariusze end-to-end

---

## Kryteria akceptacji (DoD M16 W1)

| # | Kryterium | Weryfikacja |
|---|---|---|
| 1 | Wszystkie 6 zakładek FinanceHub renderują się bez białej strony | Manual F0.1 |
| 2 | Feature flags działają izolowanie (aktywacja/dezaktywacja per flag) | Manual F0.1–F0.4 |
| 3 | Football Field renderuje się dla rekordów z DCF/comps/NAV | Manual F1.1–F1.3; auto `ValuationVisualsPanelM16` |
| 4 | Linkowanie inicjatyw M14→M16 — full cycle (POST 201 + UI update) | Manual F2.2–F2.3; auto `initiativeEconomicsLinks` |
| 5 | Value Office Panel — value bridge + portfolio w jednym kokpicie | Manual F3.1–F3.3; auto `ValueOfficePanelM16` |
| 6 | Variance Bridge — waterfall F/U z payload serwera | Manual F5.1–F5.3; auto `VarianceBridgePanelM16` |
| 7 | Driver Planner — what-if client-side bez backend call | Manual F5.4–F5.5; auto `DriverPlannerPanelM16` |
| 8 | Model Versioning — lista + diff przez dedykowane endpointy | Manual F6.1–F6.3; auto `financeModelVersions` |
| 9 | Investment Appraisal — go/conditional/no-go verdict badge | Manual F7.2–F7.4; auto `InvestmentAppraisalPanelM16` |
| 10 | Create Investment Case — payload zawiera pola finansowe | Manual F8.3 |
| 11 | Wszystkie panele degradują fail-soft (brak crash na błąd API) | Manual F3.4, F5.6, F7.5; auto: testy "degrades" |
| 12 | Złota nić M16↔M15 (benefits-register) działa end-to-end | Manual F9.1–F9.3 |
> **Cel:** agent testujący ma wykonać każdy krok, dostarczyć dowód (screenshot UI + payload Network + DB gdzie wskazano), oznaczyć PASS/FAIL.
> **Wzorzec formatu:** `TESTY_M01_CZAT.md`, `TESTY_M03_MOJA_PRACA.md`.
> **Legenda:** **[MANUAL]** = ręczna weryfikacja (drag&drop / plik binarny / incognito); **[FLAG]** = zależne od flagi/capability; **[DB]** = dowód obejmuje wiersz/kolumnę w bazie; **[SEC]** = test bezpieczeństwa/uprawnień.
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

### Mapa komponentów

| Obszar | Komponent / plik | Stan/usługa |
|---|---|---|
| Hub (szkielet) | `src/components/Economics/FinanceHub.tsx` (2381 l.) | `useFinanceData`, `useFinanceLane`, `useFinanceSelection`, `useFinanceRowActions` |
| Zakładka Statements (workspace) | `src/components/Finance/FinancialStatementPackWorkspace.tsx` | `/api/finance-statements/*` + `/api/v8/finance/statements/*` |
| Import wizard | `src/components/Finance/FinancialStatementImportWizard.tsx` | 4-krokowy: Upload→Detect→Map→Confirm |
| Zakładka Modele (workspace) | `src/components/Economics/FinanceModelDocumentView.tsx` | `/api/financial-modeling/models/*` |
| Zakładka Analiza | `src/components/Benefits/FinancialAnalysisWorkspace.tsx` | `/api/economics/analyses/*` |
| Zakładka Predykcja | `src/components/Benefits/BudgetWorkspace.tsx` | `/api/economics/budgets/*` |
| Zakładka Wycena | `src/components/Benefits/ValuationWorkspace.tsx` | `/api/economics/valuations/*` + `valuationService.ts` |
| Zakładka Inwestycyjna | `FinancialAnalysisWorkspace` (filtr `investment_case`) | `/api/economics/analyses` (typ `investment_case`) |
| Dual-runtime + degraded banner | `FinanceDegradedBanner.tsx`, `FinanceLaneStrip.tsx`, `FinanceLanePanel.tsx` | `useFinanceLane.ts` (hook) |
| V8 API | `src/services/api/v8/finance.ts` | `/api/v8/finance/*` |
| Backend obliczenia | `server/src/services/financialAnalysisService.ts`, `valuationService.ts`, `financialModelingService.ts` | tabele `financial_models`, `financial_model_outputs`, `financial_analyses`, `valuations`, `financial_statements`, `financial_statement_values`, `financial_statement_lines` |
| Eksport | `src/components/Finance/ExportToOutputDialog.tsx` | `/api/outputs/*` |

### Tabele DB (kluczowe)

| Tabela | Zawartość |
|---|---|
| `financial_statements` | nagłówki sprawozdań (org-scoped `organization_id`) |
| `financial_statement_values` | zmapowane wartości per linia×okres |
| `financial_statement_lines` | definicje linii canonical |
| `financial_models` | modele finansowe (org-scoped po `e3945bc7fc`) |
| `financial_model_outputs` | skompilowane outputy monthly per model |
| `financial_model_events` | zdarzenia ekonomiczne (revenue/cost events) |
| `financial_analyses` | analizy i case studies inwestycyjne |
| `valuations` | wyceny DCF/WACC |
| `budgets` | budżety i forecasty |

### Zasada weryfikacji E2E (OBOWIĄZKOWA)

Każda akcja tworząca/modyfikująca dane MUSI być potwierdzona:
1. **UI** — zmiana widoczna bez manualnego odświeżenia (lub po odświeżeniu);
2. **Network** — DevTools → Network (filtr `/api/`) pokazuje właściwy request + status 200/201;
3. **Persistencja** — przeładuj stronę (F5), encja nadal istnieje.

Dla obliczeń (NPV, IRR, DCF, WACC): odpowiedź z backendu musi zawierać wartości numeryczne, nie `null`/`undefined`. Porównaj z ręcznym spot-checkiem (wzory podane w sekcjach).

### Gating — stan domyślny

| Brama | Domyślny stan | Jak sprawdzić |
|---|---|---|
| Beta CLOSED | Wszyscy zablokowany przez sidebar | `Sidebar.tsx:152` — `betaAccess.ts` mówi CLOSED |
| `useV8FeatureFlag('finance')` | per-org (w dev: sprawdź `organization_settings`) | request do `/api/v8/finance/dashboard` — 200 (V8 ON) lub 503/404 (V8 OFF/legacy) |
| `isFeatureBlocked('finance')` | polityka org (AccessPolicyContext) | może zwrócić blocked mimo beta-lock |
| `VITE_BILLING_SELF_SERVE` | OFF (`null`→`false`) | **Billing NIE jest w module Finance**; AddCardModal za kill-switchem |

### Co NIE jest w module Finance

- **Billing/płatności** — `BillingCenterView`, `RevenueModule` są w superadminie. Na `/finance` nie ma i nie powinno być żadnego przycisku „Kup plan", „Upgrade", „Dodaj kartę".
- Konfiguracja organizacji (M23), ustawienia konta (M25), panel admina organizacji (M24/M27).
- Ideas / My Work (inne moduły).

---

## Setup środowiska testowego

1. Uruchom dev server: `npm run dev` → `http://localhost:3000` (FE) + `:3001` (BE).
2. Zaloguj się jako **OWNER organizacji DBR77** (pełne uprawnienia; beta-admin = widzi moduł pomimo beta-lock).
3. Otwórz DevTools → zakładka **Network** (filtr: `/api/`) + zakładka **Console** (zero błędów = wymóg).
4. Przygotuj dane testowe:
   - **Plik Excel P&L**: arkusz `P&L` z kolumnami Rok/Q, pozycje rachunku zysku i strat (Revenue, COGS, Gross Profit, EBITDA, EBIT, Net Income). Format `.xlsx`, max 10 MB.
   - **Plik Excel Balance Sheet**: arkusz `BS`, aktywa i pasywa.
   - **Plik Excel Cash Flow**: arkusz `CF`, przepływy operacyjne/inwestycyjne/finansowe.
   - **Plik błędny**: plik `.csv` z podwójnym rozszerzeniem `.csv.xlsx` lub plik > 10 MB.
   - **Plik nie-Excel**: `test.pdf` (do testu walidacji formatu).
   - Dwa konta z **różnych organizacji** (do testów cross-org SEC — patrz §7).
5. Otwórz `/finance` bezpośrednio przez pasek adresu (do testu beta-guard — §7).

---

## 1. Statements — import i wyświetlanie

> **Epik F-1 (S1)** | Endpoint: `/api/finance-statements/*`, `/api/v8/finance/statements/*`
> Kluczowe pliki: `FinancialStatementImportWizard.tsx`, `finance-statements.routes.ts:221`

### 1.1 Wejście do zakładki Statements

- Nawiguj do `/finance` → hub ładuje się, domyślna zakładka = **Statements** (wynika z `activeTab = 'statements'` domyślnie).
- **Asercja:** tytuł zakładki „Statements" aktywny (podkreślenie/kolor), licznik paczek w badge.
- Network: request `GET /api/finance-statements/packs` lub `GET /api/v8/finance/statements/packs` — status 200.
- Empty state (brak danych): wyświetla komunikat o braku sprawozdań, CTA „Importuj statement" widoczne.

### 1.2 Import wizard — otwarcie

- Klik CTA **„+ Importuj statement"** (lub „Import Statement") → otwiera `FinancialStatementImportWizard` (modal/overlay, klasa `fixed inset-0 z-50`).
- **Asercja:** wizard widoczny, 4 kroki w pasku postępu: `Wgraj file | Preview | Nazwa | Confirm`.
- Console: zero błędów przy otwarciu.

### 1.3 Krok 1 — Upload pliku [MANUAL]

- **Happy path (P&L):**
  - Przeciągnij lub kliknij „Upload" → wybierz przygotowany plik `P&L.xlsx`.
  - **Asercja:** podgląd nazwy pliku, rozmiar, ikonka Excel. Przycisk „Dalej" aktywny.
  - Pliki akceptowane: `.xlsx`, `.xls` (sprawdź walidację MIME w `ExcelImportWizard.tsx:53-76`).
- **Walidacja formatu — plik PDF:**
  - Spróbuj wgrać `test.pdf` → toast błędu „Supported are only filei Excel (.xlsx, .xls)" (uwaga: literówka w kodzie — sprawdź czy jest poprawiona czy nie; odnotuj PASS/FAIL z cytatem toastu). [MANUAL]
- **Walidacja rozmiaru — plik > 10 MB:**
  - Wgraj plik > 10 MB → toast „File jest too large. Maximum size to 10MB.". Wizard pozostaje na kroku 1. [MANUAL]
- **Anulowanie:** klik „X" na wizardzie → zamknięcie bez żadnego żądania sieciowego.

### 1.4 Krok 2 — Detect & Extract [FLAG]

- Po wgraniu prawidłowego Excel: wizard przechodzi do kroku 2 automatycznie (lub po kliknięciu „Dalej").
- Backend:
  - `POST /api/finance-statements` — tworzy rekord (status DRAFT).
  - `POST /api/finance-statements/:id/detect` — auto-detekcja typu (P&L / BS / CF), okresu, waluty, skali.
  - `POST /api/finance-statements/:id/extract` — ekstrakcja linii finansowych.
- **Asercja:** wynik detekcji widoczny na UI: `statementType`, `periodLabel`, `currency`, `scaling`.
- **Asercja pozycji:** lista wyekstrahowanych linii (originalLabel, wartość, confidence).
- Jeśli detekcja niepewna (confidence < 0.7): UI pokazuje ostrzeżenie z opcją ręcznej korekty.

### 1.5 Krok 3 — Map & Correct (mapowanie kolumn)

- **Asercja:** każda linia finansowa z kroku 2 ma sugested canonical ID (`suggestedCanonicalId`) z katalogu.
- Edycja mapowania:
  - Zmień mapping jednej linii na inną kategorię canonical (dropdown).
  - **Asercja:** zmiana widoczna w UI, linia oznaczona jako ręcznie zmapowana.
- Linie oznaczone `mappingTier = 'review_required'` powinny być wyróżnione wizualnie (np. żółty pasek).
- Linie `isNonFinancial = true` oznaczone jako wykluczone (np. szary, etykieta „Non-financial").
- `POST /api/finance-statements/:id/map` — auto-map; sprawdź payload: array linii z `canonicalId`.
- `PUT /api/finance-statements/:id/values` — zapis ręcznych korekt; payload: `{lineId, canonicalId, value}`.

### 1.6 Krok 4 — Confirm i finalise

- Klik „Confirm" → `POST /api/finance-statements/:id/confirm`.
- **Asercja UI:** wizard zamknięty, toast sukcesu.
- Toast warianty (sprawdź każdy):
  - `readinessStatus === 'ready'` → „Import zakończony" (sukces).
  - `readinessStatus === 'recoverable'` → „Import zakończony. Statement trafił do recovery queue i wymaga domknięcia jakości."
  - `readinessStatus === 'rejected'` → „Import zakończony, ale plik został odrzucony i wymaga ponownego podejścia."
- **Asercja zakładki:** po zamknięciu wizarda system przełącza się na zakładkę `statements`, stosuje odpowiedni filtr statusu i otwiera workspace nowego sprawozdania.
- **[DB]** Sprawdź: `SELECT * FROM financial_statements WHERE organization_id = '<orgId>' ORDER BY created_at DESC LIMIT 1` — rekord istnieje, `status` = `confirmed`/`ready`; wartości w `financial_statement_values`.

### 1.7 Workspace sprawozdania (CanonicalStatementTable)

- Po otwarciu paczki sprawozdań (`FinancialStatementPackWorkspace`):
  - Tabela `CanonicalStatementTable` (własny grid, uzasadniony — macierz pozycje×okresy) wyświetla dane.
  - Kolumny = okresy; wiersze = pozycje canonical P&L / BS / CF.
  - Przełączanie typów (P&L / BS / CF) działa — odpowiednie wiersze.
- **Ratio panel:** po otwarciu zakładki Ratios/Wskaźniki w workspace → `GET /api/finance-statements/:id/ratios` → wyniki wskaźników (płynność, rentowność, zadłużenie). Wartości numeryczne, nie null.
- **Validation panel:** `POST /api/finance-statements/:id/validate` → lista walidacji (bilans aktywów = pasywów, suma przepływów, itp.). Wynik pass/fail per walidacja.
- **Explain:** przycisk „Explain" przy wskaźniku → Teresa (czat AI) otwiera się z kontekstem finansowym wskaźnika.

### 1.8 Edycja pozycji po imporcie

- W workspace klik w komórkę wartości → możliwość edycji (inline input lub modal).
- `PUT /api/finance-statements/:id/values` — payload z poprawioną wartością + linią.
- **Asercja:** wartość zaktualizowana w tabeli bez przeładowania strony.
- Odśwież stronę → wartość zachowana. **[DB]** `SELECT * FROM financial_statement_values WHERE statement_id = ':id'`.

### 1.9 Filtry statusowe w zakładce Statements

- Menu 3 (CommandRow): chipy `All | Draft | Recovery Queue | Ready Statements`.
- Klik „Recovery Queue" → tabela filtruje tylko `status = REVIEW`.
- Klik „Ready Statements" → tylko `status = APPROVED`.
- Klik „All" → filtr wyczyszczony.
- **Asercja:** chipy `All/Draft/Review/Approved` mają liczniki; licznik spada przy filtrowaniu.

### 1.10 Negatywne — brak nagłówków / błędny Excel [MANUAL]

- Wgraj Excel bez żadnych nagłówków kolumn → detekcja może zwrócić `confidence < 0.5`; wizard MUSI dać opcję ręcznej korekcji zamiast crashować.
- Wgraj Excel z pustymi komórkami w kluczowych liniach → wartości `null`/`0` w mapowaniu (nie crash).
- Wgraj plik `.xls` (starszy format) → akceptowany (MIME `application/vnd.ms-excel`).

### 1.11 Eksport Statements

- W workspace paczki: przycisk „Export to Output" → otwiera `ExportToOutputDialog`.
- Wypełnij tytuł, wybierz typ outputu → klik „Eksportuj".
- Network: `POST /api/outputs` lub podobny — status 200/201.
- Toast: „Output created".

---

## 2. Modele finansowe

> **Epik F-2 (S2)** | Endpointy: `/api/financial-modeling/models/*` (legacy, org-scoped po `e3945bc7fc`), `/api/v8/finance/models/*`
> Kluczowe pliki: `FinanceModelDocumentView.tsx`, `CreateModelModal.tsx`, `financialModelingService.ts`

### 2.1 Tworzenie modelu — modal

- Klik CTA **„+ Nowy model"** (zakładka Models) → otwiera `CreateModelModal`.
- Pola formularza:
  - `name` (wymagane) — nazwa modelu.
  - `startDate` (wymagane) — data startu (`YYYY-MM-DD`).
  - `horizonMonths` — horyzont w miesiącach (domyślnie 12 lub 24; sprawdź default).
  - `currency` — waluta (PLN, EUR, USD; check dropdown).
  - `granularity` — granularność (monthly domyślnie; quarterly/annual opcjonalne).
  - `scenario` — scenariusz (base, optimistic, pessimistic).
  - `sourceStatementPackId` — opcjonalne seeding ze sprawozdania (dropdown gotowych paczek).
  - `initiativeId` / `projectId` — opcjonalne powiązanie z inicjatywą/projektem.
- **Walidacja:** próba submit bez `name` → błąd inline „name and startDate required" (backend 400). **Asercja:** modal pozostaje otwarty, błąd widoczny.
- **Happy path:** wypełnij wszystkie pola → klik „Utwórz" → `POST /api/financial-modeling/models` — status 201.
- **Asercja:** nowy model pojawia się na liście zakładki Models. Toast sukcesu.
- **[DB]** `SELECT * FROM financial_models WHERE organization_id = '<orgId>' ORDER BY created_at DESC LIMIT 1` — rekord z poprawnymi polami.

### 2.2 Workspace modelu (pełny widok)

- Otwórz model przez double-click lub „Open" → `FinanceModelDocumentView`.
- Sekcje workspace:
  - **Assumptions (założenia):** edytowalne pola `initialCash`, `initialEquity`, `initialDebt`, `initialPPE`, stopy wzrostu.
  - **Events (zdarzenia ekonomiczne):** lista `ModelEvent`s. `POST /api/financial-modeling/models/:id/events` — dodaj nowe zdarzenie (revenue event, cost event).
  - **Outputs:** tabela z wynikami per okres (`GET /api/financial-modeling/models/:id/outputs`).
  - **Validations:** `GET /api/financial-modeling/models/:id/validations`.

### 2.3 Tworzenie zdarzeń ekonomicznych

- W workspace modelu → „+ Add Event".
- Pola: `name`, `eventType` (revenue/cost/capex), `amount`, `startDate`, `recurrence` (one-time/monthly/quarterly/annual), `growth_rate`.
- Submit → `POST /api/financial-modeling/models/:id/events` — status 201.
- **Asercja:** zdarzenie pojawia się na liście, badge licznika zdarzeń aktualizuje się.
- Edytuj zdarzenie → `PUT /api/financial-modeling/events/:eventId`.
- Usuń zdarzenie → `DELETE /api/financial-modeling/events/:eventId`.
- **Asercja persistencji:** odśwież → zdarzenia nadal na liście. **[DB]** `SELECT * FROM financial_model_events WHERE model_id = ':id'`.

### 2.4 Compute modelu (silnik monthly)

- W workspace klik **„Compute"** → `POST /api/financial-modeling/models/:id/compute`.
- **Asercja backendu:** odpowiedź zawiera `outputs` z tablicą monthly periods; każdy period ma `pl`, `bs`, `cf` (P&L, Balance Sheet, Cash Flow).
- **Asercja UI:** tabela Outputs ładuje się z danymi per miesiąc/kwartał.
- **Spot-check matematyki (manualny):**
  - Ustaw revenue event 10 000 PLN/miesiąc, horyzont 3 miesiące, growth_rate = 0.
  - Po compute: suma Revenue P&L = 30 000 PLN.
  - Ustaw growth_rate = 10%: miesiąc 1 = 10 000, miesiąc 2 ≈ 10 833, miesiąc 3 ≈ 11 735.
- **Asercja persistencji:** `GET /api/financial-modeling/models/:id/outputs` po przeładowaniu → dane wciąż dostępne (persystowane do `financial_model_outputs`). **[DB]**
- Loading state: podczas compute przycisk „Compute" ma spinner, niemożliwy drugi klik.

### 2.5 Submit Review i Approve

- `POST /api/financial-modeling/models/:id/submit-review` → status modelu zmienia się na REVIEW.
- `POST /api/financial-modeling/models/:id/approve` → zmiana na APPROVED (wymaga przejścia walidacji).
- **Warunek approve:** jeśli walidacje nie przeszły, approve zwraca 400. **Asercja:** komunikat błędu w UI, nie crash.
- **Asercja statusu:** chip statusu w tabeli i workspace aktualizuje się (Draft → Review → Approved).

### 2.6 Wersjonowanie modeli (Version History)

- Workspace → zakładka „Version History" / `FinanceVersionTimeline` — lista snapshotów.
- Każdy compute tworzy nowy snapshot.
- Klik na poprzednią wersję → podgląd historycznych outputów. **Asercja:** nie nadpisuje bieżącej wersji.

### 2.7 Negatywne i graniczne

- Model z zerowym horyzontem `horizonMonths = 0` → backend 400 lub obliczenia zwracają pustą tablicę (nie crash). Sprawdź komunikat UI.
- Model bez eventów → compute produkuje zerowe P&L (nie crash; baseline assumptions mogą generować niezerowe wartości).
- Usunięcie modelu (`DELETE /api/financial-modeling/models/:id`) gdy status = APPROVED → sprawdź czy backend blokuje (403/400) lub pozwala. Odnotuj zachowanie.

---

## 3. Analiza finansowa

> **Epik F-3 (S3)** | Endpointy: `/api/economics/analyses/*`
> Kluczowe pliki: `FinancialAnalysisWorkspace.tsx`, `CreateAnalysisModal.tsx`, `financialAnalysisService.ts`

### 3.1 Tworzenie analizy

- Zakładka **Analiza** → CTA „+ Nowa analiza" → `CreateAnalysisModal`.
- Pola: `title`, `analysisType` (ratio/vertical/horizontal/full), `sourceStatementPackId` (dropdown gotowych paczek), opcjonalnie `projectId`, `initiativeId`.
- Submit → `POST /api/economics/analyses` — status 201.
- **Asercja:** nowa analiza na liście, status DRAFT.
- **[DB]** `SELECT * FROM financial_analyses WHERE organization_id = '<orgId>' ORDER BY created_at DESC LIMIT 1`.

### 3.2 Uruchomienie pełnej analizy (Full Analysis)

- W workspace analizy: klik **„Run Analysis"** → `POST /api/economics/analyses/:id/run` (lub podobny endpoint — sprawdź w kodzie `financialAnalysisService`).
- **Asercja odpowiedzi:** JSON zawiera `vertical`, `horizontal`, `ratios`, `trends`, `insights`.

### 3.3 Widoki analityczne

- **Vertical analysis (analiza pionowa — udział %):** każda pozycja jako % przychodu (P&L) lub sumy aktywów (BS). Sprawdź że sumy = 100% dla pozycji głównych.
- **Horizontal analysis (analiza pozioma — zmiany):** każda pozycja ma `change` (wartość bezwzględna) i `pct` (%). Sprawdź że obliczenia są poprawne dla 2 okresów.
- **Ratios (wskaźniki):**
  - Płynność bieżąca = Aktywa obrotowe / Zobowiązania krótkoterminowe.
  - Rentowność netto = Net Income / Revenue × 100%.
  - Wskaźnik zadłużenia = Total Debt / Total Assets × 100%.
  - **Asercja:** przy zerowym mianowniku (safeDiv) → wartość `null`, nie `Infinity`/`NaN`.
- **Trends (trendy):** CAGR per linia. CAGR = (wartość_końcowa / wartość_początkowa)^(1/n) − 1. Sprawdź dla 2 znanych wartości.
- **Insights (automatyczne):** lista `FinancialInsight` z typami `driver/risk/action/quality_note/narrative`. Musi być ≥ 1 pozycja przy pełnych danych.

### 3.4 Porównanie okresów (QoQ / YoY)

- W filtrach analizy: wybierz zakres dat (2 kwartały / 2 lata).
- **Asercja:** analiza pozioma pokazuje delta QoQ lub YoY zgodnie z wyborem.
- Filtr dat → Network: `GET /api/economics/analyses/:id?...` z parametrami okresu.

### 3.5 Filtry w zakładce Analiza

- Filtry statusowe (Draft/Review/Approved) — jak w §1.9.
- Wyszukiwanie po nazwie: wpisz fragment tytułu → filteredRows aktualizuje się po stronie FE (bez nowego requestu).
- Filtr `analysisType` (jeśli dostępny w FilterableTable) → tylko wybrane typy.

### 3.6 Drill-down do szczegółów

- Klik w wiersz tabeli → panel preview (prawy panel `TableWithPreviewLayout`) ładuje skrócony podgląd.
- Double-click → workspace pełny, tab dokumentu otwiera się w navbarze ModuleHub.
- Zamknięcie taba → powrót do listy (bez utraty filtrów).

### 3.7 Approve analizy

- W workspace: przycisk „Submit Review" → `POST /api/economics/analyses/:id/submit-review`.
- Approve → `POST /api/economics/analyses/:id/approve`.
- **Asercja statusu:** DRAFT → REVIEW → APPROVED. Chip statusu w tabeli i workspace zsynchronizowany.

---

## 4. Predykcja (Forecast / Budżety)

> **Epik F-4 (S4)** | Endpointy: `/api/economics/budgets/*`
> Kluczowe pliki: `BudgetWorkspace.tsx`, `CreateBudgetModal.tsx`
> **Uwaga: predykcja to forecasty i budżety oparte na modelach, NIE model predykcyjny AI/ML** (potwierdzono w kodzie — matematyka, nie LLM).

### 4.1 Tworzenie budżetu / forecastu

- Zakładka **Predykcja** → CTA „+ Nowy budżet" lub „+ Nowy forecast" → `CreateBudgetModal`.
- Pola: `name`, `period` (rok/kwartał), `sourceModelId` (dropdown zatwierdzonych modeli), `type` (budget/forecast).
- Submit → `POST /api/economics/budgets` — status 201.
- **Asercja:** nowy budżet na liście zakładki Predykcja.
- **Warunek seeding:** seeding z modelu możliwy tylko gdy model = APPROVED. **Asercja:** próba seed z modelu DRAFT → błąd 400 lub opcja wyłączona w dropdownie.

### 4.2 Workspace budżetu — dane forecastu

- Otwórz workspace budżetu (`BudgetWorkspace`).
- Tabela P&L per okres (monthly/quarterly) z kolumną Plan, Actual (jeśli dane rzeczywiste) i Variance.
- Edycja linii planu: klik w komórkę → inline edit → save → `PUT /api/economics/budgets/:id`.
- **Asercja:** variance = Actual − Plan obliczona po stronie FE (lub BE; sprawdź w Network).

### 4.3 Scenariusze budżetowe

- Zakładka Scenarios w workspace: `GET /api/economics/budgets/:id/scenarios` (lub w `budgetPreviewScenarios`).
- Dodaj scenariusz (optimistic +10%, pessimistic −10%).
- **Asercja:** wykresy i tabele zmieniają się per scenariusz.
- Porównanie scenariuszy side-by-side (jeśli UI dostępne).

### 4.4 Wizualizacja (CashFlowChart)

- W workspace budżetu: zakładka Cash Flow → `CashFlowChart.tsx`.
- **Asercja:** wykres słupkowy/liniowy renderuje się bez błędów SVG.
- Dane == dane z workspace (brak rozbieżności wykres vs tabela).

### 4.5 Approve budżetu (warunek dla Wyceny)

- `POST /api/economics/budgets/:id/approve`.
- Status APPROVED jest wymagany przed seedem Wyceny (`valuationService.ts:101-113`).
- **Asercja:** po approve — dropdown wyceny zawiera ten budżet jako dostępne źródło.

### 4.6 Negatywne

- Zakładka Predykcja bez żadnych modeli → empty state „Brak danych do predykcji. Najpierw utwórz model." (PL; zweryfikuj tekst dokładnie).
- Budżet z `sourceModelId` usuniętego modelu → UI pokazuje ostrzeżenie lub placeholder.

---

## 5. Wycena przedsiębiorstw (DCF / WACC)

> **Epik F-5 (S5)** | Endpointy: `/api/economics/valuations/*`
> Kluczowe pliki: `ValuationWorkspace.tsx`, `CreateValuationModal.tsx`, `valuationService.ts`
> **Priorytet:** liczby są produktem — obliczenia MUSZĄ być poprawne numerycznie.

### 5.1 Tworzenie wyceny

- Zakładka **Wycena** → CTA „+ Nowa wycena" → `CreateValuationModal`.
- Pola:
  - `title` (wymagane).
  - `sourceType`: `financial_model | financial_analysis | budget | manual`.
  - `sourceId`: id zatwierdzonego źródła (dla `manual` = nie wymagane).
  - `horizonYears` (domyślnie 5).
  - `waccPercent` (domyślnie 12 lub z `organization_settings`; sprawdź `getOrgDefaultWacc`).
  - `terminalMethod`: `gordon | exit_multiple`.
  - `terminalGrowthPercent` (dla gordon; np. 2%).
  - `exitMultiple` i `exitMultipleMetric` (dla exit_multiple; EV/EBITDA lub EV/Revenue).
  - `netDebt`, `sharesOutstanding` (opcjonalne).
- **Warunek źródła:**
  - `financial_model` → musi być APPROVED.
  - `budget` → musi być APPROVED.
  - `financial_analysis` → musi być APPROVED.
  - `manual` → brak wymagania.
  - **Asercja [SEC]:** spróbuj POST z `sourceId` z modelu DRAFT → backend 400 „Financial model must be approved before it can seed a valuation".
- Submit → `POST /api/economics/valuations` — status 201.

### 5.2 Workspace wyceny — obliczenia DCF

- Otwórz workspace (`ValuationWorkspace`).
- **Uruchom compute** → `POST /api/economics/valuations/:id/compute` (lub przy create jeśli auto).
- **Asercja wyników:**
  - `enterpriseValue` — wartość Enterprise Value w walucie.
  - `equityValue = enterpriseValue − netDebt`.
  - `pricePerShare = equityValue / sharesOutstanding` (jeśli podane).
  - Wszystkie wartości to liczby, nie `null`/`undefined`/`NaN`.

### 5.3 Spot-check DCF (manualny) [MANUAL]

Prosta wycena ręczna (dane testowe):
- `manualForecast`: 5 lat, FCFF = [100, 110, 121, 133, 146] (roczny wzrost 10%).
- `waccPercent = 10%`, `terminalMethod = gordon`, `terminalGrowthPercent = 2%`.
- Oczekiwane: PV FCFF (suma zdyskontowanych) ≈ 531; TV terminal = 146×1.02 / (0.10−0.02) = 1860.75; PV(TV) = 1860.75/1.10^5 ≈ 1155.7; Enterprise Value ≈ 1687.
- **Asercja:** backend zwraca wartość w zakresie ±5% od oczekiwanej (odchylenie = błąd matematyczny).
- **Exit multiple check:** `exitMultiple = 8`, metrika EV/EBITDA, EBITDA = 200 → TV = 8×200 = 1600; PV(TV) ≈ 993.8; EV ≈ 1525.

### 5.4 WACC breakdown

- W workspace → sekcja „WACC Breakdown".
- Edytowalne pola: `riskFreeRate`, `equityRiskPremium`, `beta`, `costOfDebt`, `taxRate`, `debtWeight`, `equityWeight`.
- **Asercja walidacji:** `debtWeight + equityWeight` musi = 100%. Jeśli nie — błąd inline lub auto-korekcja.
- Formuła WACC = equityWeight×(riskFreeRate + beta×equityRiskPremium) + debtWeight×costOfDebt×(1−taxRate/100).
- **Spot-check:** riskFreeRate=4%, ERP=5%, beta=1.2, costOfDebt=8%, taxRate=19%, debt=30%, equity=70% → Cost of Equity = 4+1.2×5=10%; WACC = 0.7×10 + 0.3×8×0.81 = 7+1.944 = 8.944%.
- **Asercja:** backend zwraca `waccBreakdown` ze zgodnymi wartościami.

### 5.5 Sensitivity analysis (SensitivityChart)

- Workspace → zakładka Sensitivity / `SensitivityChart.tsx`.
- Parametry osi: WACC (%) vs Terminal Growth Rate (%) lub WACC vs Exit Multiple.
- **Asercja:** macierz wartości EV × (WACC range) × (growth range) renderuje się.
- Hover na komórce → tooltip z wartością EV.
- Kolor heatmapy zmienia się proporcjonalnie (wyższy EV = ciemniejszy/jaśniejszy kolor).
- Console: zero błędów SVG przy renderze.

### 5.6 Status przepływu wyceny

- DRAFT → (compute) → REVIEW → (approve) → APPROVED.
- `POST /api/economics/valuations/:id/approve`.
- APPROVED wycena pojawia się jako dostępne źródło w późniejszych analizach inwestycyjnych.

### 5.7 Negatywne i graniczne

- `waccPercent = 0` → backend musi obsłużyć division by zero (WACC w mianowniku). Oczekiwany wynik: błąd 400 lub wartość `Infinity` zablokowana przez clamp. Odnotuj.
- `waccPercent = terminalGrowthPercent` (np. oba = 5%) → Gordon Growth: TV = FCFF/(0) → `Infinity`. Sprawdź czy backend zwraca błąd.
- `horizonYears = 0` → oczekiwany błąd 400.
- Brak historycznych FCFF przy `sourceType = manual` bez `manualForecast` → backend zwraca błąd 400.

---

## 6. Analiza inwestycyjna (NPV / IRR / Payback)

> **Epik F-6 (S6)** | Endpoint: `GET /api/economics/analyses` + filtry `analysisType = investment_case`
> Kluczowe pliki: `financialAnalysisService.ts:264-318` (bisekcja IRR), `FinanceHub.tsx:111-123` (`isInvestmentAnalysisType`)

### 6.1 Widok zakładki Analiza inwestycyjna

- Zakładka **Analiza inwestycyjna** → `GET /api/economics/analyses?analysisType=investment_case` (lub FE filtruje po `isInvestmentAnalysisType`).
- **Asercja:** licznik w zakładce = liczba analiz z typem `investment`/`investment_case`/`capex`.
- Empty state: komunikat „Brak case studies inwestycyjnych. Utwórz pierwszą analizę inwestycyjną." (tekst PL — zweryfikuj dokładny string).
- Przyciski [NPV, IRR, Payback, ROI] widoczne w empty state jako poglądowe.

### 6.2 Tworzenie analysis investment_case

- CTA „+ Nowa analiza" → `CreateAnalysisModal` z `analysisType = investment_case`.
- Powiąż z inicjatywą (`initiativeId`) — dropdown inicjatyw orga.
- Submit → `POST /api/economics/analyses` z body `{analysisType: 'investment_case', initiativeId: '...'}`.
- **Asercja:** nowa analiza na liście zakładki Inwestycyjna.

### 6.3 Obliczenia NPV / IRR / Payback

- Dane cash flow (z modelu lub manual): array wartości per okres.
- Uruchom analizę → `POST /api/economics/analyses/:id/run`.
- **Asercja wyników** (z `computeInvestmentRatios`):
  - `npv` — wartość w PLN (wynik `npvAt(0.1)` — uwaga: rate 10% hardcoded w obecnym kodzie).
  - `irr_pct` — IRR w % (bisekcja ze zbieżnością <0.0001).
  - `payback_periods` — okres zwrotu z interpolacją.
  - `roi` — ROI w %.
  - Wszystkie = liczby, nie `null`, przy dostępnych danych.
- **Spot-check NPV [MANUAL]:**
  - Przepływy: [-100, 30, 40, 50] (inwestycja 100 + 3 lata zwrotów).
  - NPV przy stopie 10% = −100 + 30/1.1 + 40/1.21 + 50/1.331 = −100 + 27.27 + 33.06 + 37.56 = −2.11.
  - **Asercja:** backend zwraca NPV ≈ −2.11 (±0.01).
- **Spot-check IRR [MANUAL]:**
  - Przy przepływach [-100, 30, 40, 50] IRR ≈ 8.8%.
  - Bisekcja 80 iteracji powinna osiągnąć zbieżność <0.0001.
  - **Asercja:** `irr_pct ≈ 8.8`.

### 6.4 Ranking / porównanie inicjatyw

- Na liście kilku analiz investment_case: tabela powinna sortować wg NPV lub ROI.
- Klik nagłówka kolumny NPV → sortowanie malejące/rosnące.
- **Asercja:** kolejność wierszy zmienia się, wartości NPV zgodne z wynikami analiz.

### 6.5 Integracja M13→M16 (ROI linkages)

- Otwórz inicjatywę w M13 (`/initiatives/:id`) z powiązaną analizą inwestycyjną.
- Zakładka ROI w inicjatywie → `FullROIView` → `GET /api/economics/analyses?initiativeId=<id>`.
- **Asercja:** NPV/ROI/payback widoczne w ROI view inicjatywy (dane z M16, nie placeholder).
- Klik w ROI view inicjatywy → deep-link do M16 `/finance?tab=investment&analysisId=<id>`.

### 6.6 Integracja M15→M16 (Results → Finance)

- Z modułu M15 Rezultaty: dane ROI powinny być dostępne przez ten sam endpoint `/api/economics/analyses`.
- **Asercja:** dane z M16 pojawiają się w widoku ROI M15 (zakładka ROI). Jeśli M15 używa własnego serwisu, sprawdź spójność danych.

---

## 7. V8, Kill-switch i Gating

> **Epiki F-7 / bezpieczeństwo** | Pliki: `useFinanceLane.ts`, `FinanceDegradedBanner.tsx`, `Sidebar.tsx:152`, `betaAccess.ts`

### 7.1 Beta CLOSED — blokada sidebara

- Zaloguj się jako zwykły user (nie admin, nie owner DBR77).
- **Asercja:** zakładka Finanse w sidebarze NIE jest widoczna lub jest zablokowana (lock icon, tooltip „Beta").
- Bezpośredni URL `/finance` → sprawdź: czy pojawia się plate `BETA_LOCKED` (pełnoekranowy komunikat), czy też strona ładuje się (L-01 = znana luka: beta-lock tylko nawigacyjny). **Odnotuj wynik bez naprawiania.**
- **Asercja [FLAG]:** jeśli strona ładuje się przy direct URL → zapis: **FAIL (L-01 open)** — brak route-level guard.

### 7.2 V8 Finance OFF (domyślny stan dla org bez V8)

- Użyj orga, dla której `useV8FeatureFlag('finance')` = false.
- Nawiguj do `/finance` → UI wyświetla komunikat „Finance module is not enabled for this organization." (kalkulator icon + tekst z `finance.v8Disabled`).
- **Asercja:** żadne endpointy V8 (`/api/v8/finance/*`) NIE są wywoływane — Network filtr `/api/v8/finance` = pusty.
- Legacy endpointy (`/api/financial-modeling`, `/api/economics`, `/api/finance-statements`) — nadal dostępne.

### 7.3 V8 Finance ON — dual-runtime i degraded banner [FLAG]

- Włącz V8 dla org (w `organization_settings.setting_value` ustaw `v8_features.finance = true` lub przez panel superadmina).
- Nawiguj do `/finance`.
- **Asercja V8 ON:** CommandRow pokazuje chipy runtime: `V8 Ingestion | Escalations | Linkages | Gate pass` z wartościami (nie `—`).
- **Asercja V8 dashboard:** `GET /api/v8/finance/dashboard` → status 200, response zawiera `ingestionPipeline`, `linkageHealth`, `unresolvedEscalationsCount`.
- **Test FinanceLaneStrip:** pasek lane na górze/CommandRow widoczny gdy `isFinanceRuntimeV8 = true`.
- **Test degradacji (symulacja):**
  - Wyłącz V8 endpoint po załadowaniu (np. przez mock/intercept) lub użyj orga z V8=false po refresh.
  - **Asercja:** `FinanceDegradedBanner` pojawia się z: tytułem alertu, licznikiem problemów, severity, next action.
  - Banner WIDOCZNY (nie ukryty, nie pusta przestrzeń) — wzorzec lepszy niż M13/M14.
  - Klik „View All" → otwiera `FinanceLanePanel` (boczny drawer).
- **FinanceLanePanel:**
  - Sekcje: `activeLaneRun`, `degradedAlerts`, `mutationAudits`, `kpiCoherence`, `versionSnapshots`.
  - Przycisk „Advance Step" → `POST /api/v8/finance/lane/:id/advance`.
  - Przycisk „Finalize Version" → `V8FinanceApi.finalizeVersion(snapshotId)` → toast „Version finalized".

### 7.4 isFeatureBlocked — polityka org

- Jeśli org ma `isFeatureBlocked('finance') = true` (AccessPolicy): UI pokazuje „Access to the Finance module is restricted by your organization's policy." (kalkulator icon + tekst `finance.blocked`).
- **Asercja:** to INNE od V8 disabled — odróżnij dwa komunikaty w teście.

### 7.5 Self-serve kill-switch OFF — BRAK elementów billingowych

- `VITE_BILLING_SELF_SERVE = false` (domyślnie).
- Przeglądaj WSZYSTKIE zakładki (`statements`, `models`, `analysis`, `prediction`, `valuation`, `investment`).
- **Asercja KRYTYCZNA:** BRAK jakichkolwiek:
  - Przycisków „Upgrade", „Kup plan", „Dodaj kartę" (AddCardModal).
  - Linków do płatności, cennika.
  - Komponentu `AddCardModal`.
- **Billing jest TYLKO w superadminie** — `/superadmin/billing`. Sprawdź że `/finance` nie redirectuje do billing i nie renderuje żadnego komponentu billing.

### 7.6 [SEC] Cross-org IDOR — weryfikacja fix `e3945bc7fc` [SEC] [DB]

> **Uwaga bezpieczeństwa: test tylko read-only. NIE modyfikuj danych innej orgi.**

- Zaloguj się jako **User A** (orga A). Utwórz model finansowy, zanotuj jego UUID (`model_id`).
- Wyloguj się. Zaloguj jako **User B** (orga B, inny token).
- `GET /api/financial-modeling/models/<model_id_z_org_A>`.
- **Asercja:** status 404 (nie 200) — `getModel` robi `WHERE id = ? AND organization_id = ?`. Jeśli zwróci 200 → **FAIL P0-SEC** (IDOR niezałatany).
- Powtórz dla `PUT` (symulacja, sprawdź tylko status response, nie modyfikuj danych) i `DELETE` (sprawdź tylko 404, nie usuwaj).
- **Asercja V8:** `GET /api/v8/finance/models/<model_id_z_org_A>` → 403 lub 404 (V8 ma dodatkowy check `model.organization_id !== orgId → 403`).

---

## 8. Ścieżki cross-module

### 8.1 M13 Inicjatywy → M16 Finanse (wejście)

- Otwórz inicjatywę w M13 z uzupełnioną sekcją `financial*` / `v8_initiative_economics_linkages`.
- Zakładka „ROI" w dokumencie inicjatywy → `FullROIView` → wywołanie `GET /api/economics/analyses?initiativeId=<id>`.
- **Asercja:** NPV/ROI/payback i ewentualny link do M16.
- Klik „Open in Finance" (jeśli CTA istnieje) → deep-link do `/finance?tab=investment&analysisId=<id>`.
- **Asercja deep-linku:** M16 otwiera się, zakładka Investment aktywna, właściwa analiza zaznaczona.

### 8.2 M16 Finanse → M17 Outputs (eksport)

- Otwórz analizę w workspace.
- Klik **„Export to Output"** → `ExportToOutputDialog` (modal).
- Wybierz typ outputu (presentation/document), podaj tytuł.
- Klik „Eksportuj" → `POST /api/outputs` (lub podobny) — status 201.
- Toast: „Output created".
- Nawiguj do M17 (`/presentations` lub `/outputs`) → nowo stworzony output pojawia się na liście.
- **Asercja:** bez błędów konsoli przy eksporcie.

### 8.3 M20 Tabele → M16 Finanse (sync STUB — DP-6)

- Sprawdź że **BRAK** przycisku „Sync from Tabele" / „Importuj z M20" w M16.
- Jeśli jest komunikat „preview" o integracji z Tabelami → odnotuj jako PASS (DP-6 = „preview teraz").
- Jeśli brak jakiegokolwiek UI elementu sync → PASS (STUB honorowany przez brak UI).
- **NIE oczekuj działającego mostu** — `ModuleSyncService:57` tylko loguje, Finance nie odbiera.

### 8.4 M16 → M24/M27 Billing — tylko redirect, brak funkcji

- Sprawdź że `/finance` nie zawiera żadnego linku billing do `/superadmin/billing` (nie powinno być w module klienckim).
- Jeśli jest jakikolwiek link billing → odnotuj ścieżkę i oceń czy to błąd UX.

---

## 9. Testy przekrojowe

### 9.1 Persistencja danych

- Utwórz jeden obiekt każdego typu (statement, model, analiza, budżet, wycena).
- Przeładuj stronę (F5). **Asercja:** wszystkie obiekty nadal widoczne na listach.
- Otwórz nową sesję (nowa karta) → te same dane widoczne (DB, nie sessionStorage).
- **[DB]** Po każdym create: sprawdź tabelę DB przez DevTools → XHR lub bezpośrednie query.

### 9.2 Stany disabled i loading

- Podczas ładowania zakładki (`loadingTab = true`) → spinner w contencie, tabela się nie renderuje.
- Podczas compute modelu → przycisk „Compute" disabled (spinner), nie można kliknąć drugi raz.
- Podczas importu wizarda → „Dalej" disabled na kroku extract/detect dopóki odpowiedź nie wróci.
- Przy błędzie sieci (np. wyłącz network) → toast błędu, nie biały ekran. `loadError` obsługiwany.

### 9.3 i18n — PL / EN

> **Uwaga:** kod ma 0 wywołań `isPolish` w `Economics/` (grep potwierdził). Tłumaczenia przez `t('klucz', 'fallback')`.

- Zmień język na **EN** (ustawienia lub URL param `?lang=en`).
- **Asercja:** zakładki, chipy, CTA, komunikaty empty-state zmieniają się na angielskie.
- Sprawdź mixed-language empty messages:
  - `models` tab empty: „Brak modeli. Dodaj pierwszy model finansowy." (PL literał w kodzie `FinanceHub.tsx:1756`) — czy zmienia się na EN? Jeśli nie → **FAIL (L-04 open)**, odnotuj bez naprawiania.
  - `statements` tab empty messages używają `t()` → powinny być tłumaczone.
- Zmień z powrotem na **PL** → UI wraca do PL.

### 9.4 Dark mode

- Włącz dark mode (ustawienia / media query `prefers-color-scheme: dark`).
- **Asercja:**
  - Tabele, chipy, modal wizarda, workspace modeli, banery — ciemne tło.
  - `SensitivityChart` i `CashFlowChart` — palety kolorów widoczne na ciemnym tle (51 hex w chartach = legalne, DP-8).
  - Żadna wartość tekstowa nie jest niewidoczna (biały tekst na białym tle / czarny na czarnym).

### 9.5 Dostępność (A11y)

- Wszystkie interaktywne elementy (przyciski CTA, chipy statusów, rzędy tabeli) dostępne przez Tab/Enter.
- Import wizard — fokus przenosi się na krok 2 po przejściu z kroku 1.
- `SensitivityChart` — jeśli czysto SVG, sprawdź czy ma `aria-label` lub `role="img"`.
- Komunikaty toast — `aria-live` region dla ekranoczytników.

### 9.6 Zero błędów konsoli

- Przejdź przez wszystkie 6 zakładek Finanse.
- Otwórz workspace jednego obiektu w każdej zakładce.
- Uruchom import wizard (do kroku 2 bez wysyłania).
- **Asercja:** Console = **0 błędów** (error-level). Ostrzeżenia o brakujących `key` prop lub deprecated API odnotować (nie blokują PASS, ale dokumentuj).

### 9.7 URL i deep-linki

- `/finance` → domyślna zakładka Statements.
- `/finance?tab=models` → zakładka Modele.
- `/finance?tab=valuation` → zakładka Wycena.
- `/finance/statements/<uuid>` → deep-link do workspace paczki statements.
- `/finance/models/<uuid>` → deep-link do workspace modelu.
- `/finance/analyses/<uuid>` → deep-link do workspace analizy.
- `/economics` → redirect do `/finance` (sprawdź `useEffect` z `ROUTES.ECONOMICS`).
- **Asercja każdego:** URL poprawny, tab aktywny, lub dokument otwarty — bez 404 lub white screena.

### 9.8 Wyszukiwanie

- W każdej zakładce: wpisz fragment nazwy istniejącego obiektu → `filteredRows` aktualizuje się (FE-side, bez nowego requestu).
- Wpisz nieistniejącą frazę → empty state „Brak wyników" (lub aktualny tekst empty-state).
- Wyczyść wyszukiwanie → powrót pełnej listy.

---

## 10. Testy regresji (istniejące testy automatyczne)

> Uruchom przed testem manualnym — gwarantują brak regresji obliczeniowej.

```bash
# Z katalogu root projektu
npx vitest run src/components/Economics/__tests__/
npx vitest run server/src/services/__tests__/financialModelingService.listModels.test.ts
npx vitest run server/src/services/__tests__/financialStatementService.contract.test.ts
npx vitest run server/src/routes/v8/__tests__/finance.routes.test.ts
npx vitest run server/src/routes/v8/__tests__/p05-finance-lane.test.ts
npx vitest run server/src/services/v8/__tests__/financeIntegrationService.test.ts
npx vitest run server/src/services/v8/__tests__/financeRuntime.test.ts
```

**Znane problemy (drift — nie blokują testów manualnych):**
- `p05-finance-lane.test.ts` — 8× FAIL z powodu drift sekwencji mocków `DbPromise` (L-03, otwarta).
- `financeModelLabels.test.ts` — 2× FAIL label-drift (L-03, otwarta).
- `economicsFlow env` — błąd zmiennej środowiskowej w integration tests (L-03, otwarta).

**Co MUSI być zielone (P0-test):**
- `financialAnalysisService` NPV/IRR/payback testy numeryczne.
- `financialStatementService.contract` — schema correctness.
- `financeIntegrationService` / `financeRuntime` — V8 integration.

**Fałszywa zieleń (L-02 — odnotuj, nie naprawiaj teraz):**
- `tests/unit/backend/financialCalculatorService.test.js` definiuje własny inline kalkulator zamiast importować produkcyjny serwis → testy przechodzą nawet przy błędzie w `financialAnalysisService.ts`.

---

## 11. Mapa epików — weryfikacja pokrycia

| Epik | Opis | Sekcja testu |
|---|---|---|
| **EPIK 1** — Bezpieczeństwo (P0/P1) | Cross-org IDOR, beta-guard na route | §7.1, §7.6 [SEC] |
| **EPIK 2** — Testy obliczeń (P0) | DCF/WACC/NPV/IRR spot-check | §5.3, §5.4, §6.3 [MANUAL] |
| **EPIK 3** — 14 FAIL drift (P0-test) | Uruchomienie suite, znane failures | §10 |
| **EPIK 4** — Integracja M20 (STUB/preview) | Brak mostu, DP-6 honorowany | §8.3 |
| **EPIK 5** — Szlif (i18n, EntityStatusChip) | mixed PL/EN, własne chipy | §9.3, §9.5 |

---

## 12. Format raportu

Każdy tester wypełnia na koniec:

```
## Raport wykonania TESTY_M16_FINANSE.md
Data: YYYY-MM-DD
Tester: [imię / nick]
Branch / commit: [git log --oneline -1]
Środowisko: dev :3000/:3001 | staging | prod

### Wyniki per sekcja
| Sekcja | Nazwa | Status | Uwagi / Dowód |
|--------|-------|--------|---------------|
| §1.1   | Wejście Statements | PASS/FAIL | |
| §1.2   | Import wizard — otwarcie | PASS/FAIL | |
| §1.3   | Upload Excel P&L | PASS/FAIL | |
| §1.4   | Detect & Extract | PASS/FAIL | |
| §1.5   | Map & Correct | PASS/FAIL | |
| §1.6   | Confirm + toast | PASS/FAIL | |
| §1.7   | Workspace — CanonicalTable + ratios | PASS/FAIL | |
| §1.8   | Edycja pozycji | PASS/FAIL | |
| §2.1   | Create Model | PASS/FAIL | |
| §2.4   | Compute modelu + spot-check | PASS/FAIL | |
| §2.5   | Submit Review / Approve | PASS/FAIL | |
| §3.1   | Create Analysis | PASS/FAIL | |
| §3.3   | Widoki analityczne (vertical/horizontal/ratios) | PASS/FAIL | |
| §4.1   | Create Budget | PASS/FAIL | |
| §5.1   | Create Valuation | PASS/FAIL | |
| §5.3   | DCF spot-check manualny | PASS/FAIL | |
| §5.4   | WACC breakdown spot-check | PASS/FAIL | |
| §5.5   | SensitivityChart | PASS/FAIL | |
| §6.3   | NPV/IRR spot-check manualny | PASS/FAIL | |
| §7.1   | Beta CLOSED (direct URL) | PASS/FAIL | L-01 open? |
| §7.2   | V8 OFF — komunikat | PASS/FAIL | |
| §7.3   | V8 ON — degraded banner | PASS/FAIL/N/A | |
| §7.5   | Brak billing na /finance | PASS/FAIL | |
| §7.6   | Cross-org IDOR fix | PASS/FAIL | |
| §8.1   | M13→M16 ROI linkage | PASS/FAIL | |
| §8.2   | M16→M17 eksport | PASS/FAIL | |
| §9.3   | i18n PL/EN | PASS/FAIL | L-04 open? |
| §9.6   | Zero błędów konsoli | PASS/FAIL | |
| §10    | Testy auto (regresja) | PASS/FAIL | drift FAILs ok |

### Znane otwarte luki (nie blokują PASS modułu przy PASS reszty)
- L-01: beta-lock tylko nawigacyjny (P1)
- L-02: fałszywa zieleń testów obliczeń (P0-test)
- L-03: 14 drift FAIL w suite (P0-test)
- L-04: mixed PL/EN empty messages (P3)
- L-05: brak EntityStatusChip SSOT (P3)
- L-06: sync-from-M20 STUB / DP-6 preview (INTEGRACJA)

### Definition of Done (M16 gotowy do Fazy 4)
- [ ] Wszystkie §1–§6 (happy path) = PASS
- [ ] §7.5 (brak billing) = PASS
- [ ] §7.6 (cross-org IDOR) = PASS
- [ ] §5.3 i §6.3 (spot-check matematyki) = PASS (liczby poprawne ±5%)
- [ ] §9.6 (zero błędów konsoli) = PASS
- [ ] Testy auto zielone (bez L-03 drift) = PASS
- [ ] Fazy 3+4 wykonane (Railway smoke + żywa weryfikacja)
```

---

*Plik wygenerowany 2026-06-16 na potrzeby Fazy 4 audytu M16 Finanse. SSOT: `Harvard/wdrozenie-100/M16-finanse.md` + `Harvard/modules/M16-finanse/KARTA_AUDYTU.md`.*

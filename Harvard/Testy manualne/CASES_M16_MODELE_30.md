# CASES — M16 Finanse · Zakładka Modele finansowe · 30 bogatych case'ów testowych

> **Moduł:** M16 Finanse — zakładka Modele (`/finance?tab=models`)
> **Główny plik:** `src/components/Economics/FinanceHub.tsx` (~2428 lin.)
> **Widok dokumentu:** `src/components/Economics/FinanceModelDocumentView.tsx`
> **Cel paczki:** 30 realistycznych scenariuszy pracy konsultanta finansowego — nie smoke'i, lecz bogate przepływy budowania modeli 3-letnich prognoz, zarządzania wersjami, linkowania inicjatyw i eksploracji paneli Value Office / Driver Planner.
> **Data:** 2026-06-25
> **Autor:** sesja projektowa (czytanie kodu, bez uruchamiania serwerów/testów)

---

## Legenda znaczników

- **[DB]** — utrwalenie w bazie danych (financial_models, financial_model_versions, v8_initiative_economics_linkages). Weryfikuj hard-refresh.
- **[FLAG]** — funkcja za feature-flagą (`financeFeatureFlags.ts`). Aktywacja: URL query `?ff_<name>=1` LUB `localStorage.setItem('ff.<name>', '1')`.
- **[CROSS-MODULE]** — operacja dotykająca M14 Wdrożenie / M15 Rezultaty. Sprawdź spójność po obu stronach.
- **[REAL-AI]** — wywołanie żywego LLM. Weryfikuj żądanie w Network + niezdeterminizm odpowiedzi.
- **[V8]** — endpoint w przestrzeni `/api/v8/finance/`. Fallback do legacy API gdy v8 niedostępne.

**Zasada E2E (każdy case [DB]):** każda trwała zmiana → weryfikacja żądania HTTP w Network (endpoint, status, payload) → hard-refresh strony → stan identyczny. Zmiana UI bez żądania = FAIL.

**Flagi modeli finansowych (SSOT: `financeFeatureFlags.ts`):**
| Flaga | URL query | localStorage key |
|---|---|---|
| modelVersioning | `?ff_modelVersioning=1` | `ff.fin_model_versioning` |
| valueOffice | `?ff_valueOffice=1` | `ff.fin_value_office` |
| driverPlanner | `?ff_driverPlanner=1` | `ff.fin_driver_planner` |

---

## Spis 30 case'ów

### A. Tworzenie i konfiguracja modeli (MC-16M-01 … MC-16M-06)
- **MC-16M-01** · Ręczne tworzenie modelu — tryb manual, PLN, 36 miesięcy
- **MC-16M-02** · Tworzenie modelu z paczki zestawień — tryb „from statement"
- **MC-16M-03** · Tworzenie modelu z założeniami — initialCash, initialEquity, initialDebt, initialPPE
- **MC-16M-04** · Granularność miesięczna vs kwartalna vs roczna — efekt na output
- **MC-16M-05** · Waluta EUR — model dla klienta zagranicznego
- **MC-16M-06** · Edycja metadanych modelu — PATCH name/scenario/currency

### B. Generacja i przeglądanie outputów (MC-16M-07 … MC-16M-12)
- **MC-16M-07** · Generacja projekcji P&L na 3 lata — POST /models/:id/outputs
- **MC-16M-08** · Przełączanie P&L → BS → CF — variant switcher w dokumencie
- **MC-16M-09** · Porównanie wariantów base vs optimistic — zmiana scenariusza
- **MC-16M-10** · Rachunek przepływów pieniężnych — sekcje operating/investing/financing
- **MC-16M-11** · Flaga isEstimated — dane szacunkowe vs serwer-backed
- **MC-16M-12** · Persystencja outputów po hard-refresh

### C. Wersjonowanie modeli (MC-16M-13 … MC-16M-16)
- **MC-16M-13** · Przeglądanie historii wersji — lista snapshot'ów (za flagą)
- **MC-16M-14** · Diff między dwiema wersjami — zmiana założeń
- **MC-16M-15** · Stan pusty historii wersji — model bez snapshots
- **MC-16M-16** · Flaga OFF — sekcja wersjonowania ukryta

### D. Linkowanie inicjatyw (MC-16M-17 … MC-16M-20)
- **MC-16M-17** · Klik badge „Unlinked" → otwarcie LinkInitiativeModal
- **MC-16M-18** · Linkowanie modelu do inicjatywy — POST 201
- **MC-16M-19** · Pobieranie listy powiązań — GET economics-links
- **MC-16M-20** · Brak autoryzacji — 401 bez tokenu

### E. Value Office Panel (MC-16M-21 … MC-16M-25)
- **MC-16M-21** · Aktywacja flagi valueOffice — panel pojawia się pod tabelą
- **MC-16M-22** · Most wartości (waterfall) — kroki Baseline→Realized→Banked
- **MC-16M-23** · Portfel decyzyjny — bąble w kwadrantach fund/evaluate/quick_win/defer
- **MC-16M-24** · Fail-soft na błędzie API — degradacja do cichej notki
- **MC-16M-25** · Dane przykładowe gdy brak inicjatyw — SAMPLE_INITIATIVES

### F. Driver Planner What-If (MC-16M-26 … MC-16M-30)
- **MC-16M-26** · Domyślne drzewo SaaS — Przychód = Klienci × ARPU
- **MC-16M-27** · Suwak what-if — aktualizacja w czasie rzeczywistym (bez API)
- **MC-16M-28** · Własne drzewo sterowników — prop driverTree
- **MC-16M-29** · Fan scenariuszy — base / optimistic / conservative
- **MC-16M-30** · Wykres tornadowy — analiza wrażliwości

---

# A. Tworzenie i konfiguracja modeli

---

### MC-16M-01 · Ręczne tworzenie modelu PLN 36 miesięcy · [DB] [V8]

**Co się dzieje**
Konsultant VTS Group otwiera zakładkę Modele (`/finance?tab=models`) i nie ma jeszcze żadnego modelu — widzi pusty stan z komunikatem zachęcającym do stworzenia pierwszego modelu. Klika przycisk CTA „+ New model" w prawym górnym rogu. Otwiera się `CreateModelModal` w trybie `manual` (domyślny, brak zestawień źródłowych). Konsultant wpisuje nazwę „Prognoza transformacji VTS Group 2026–2029", wybiera walutę PLN, horyzont 36 miesięcy i granularność `monthly`. Klika „Utwórz". Pojawia się toast sukcesu „Model utworzony". Nowy wiersz pojawia się natychmiast na liście modeli z tytułem, statusem i forecastWindowLabel „3Y".

**Efekty pracy**
`POST /api/v8/finance/models` (fallback: `POST /api/financial-modeling/models`) z body `{ name, startDate, horizonMonths: 36, granularity: "monthly", currency: "PLN", assumptions: { initialCash: 0, initialEquity: 0, initialDebt: 0, initialPPE: 0 } }` → 201 z `{ model: { id, name, scenario, currency, horizon_months, start_date, status } }`. Po hard-refresh modelu na liście jest wiersz z poprawną nazwą, walutą PLN, scenariuszem `base`, statusem DRAFT. Wiersz zachowany w tabeli `financial_models` (kolumna `organization_id` = bieżąca org).

**Grafika**
`CreateModelModal` — modal centralny na ciemnym tle, dwa przyciski trybu „Create manually" / „Create from statement" (segment control), formularz z polami: Name (input), Start Date (datepicker), Horizon Months (select: 12/24/36/60), Granularity (select: monthly/quarterly/annual), Currency (select: PLN/EUR/USD). Przycisk „Utwórz" aktywny dopiero po wypełnieniu Name + Start Date. Toast sukcesu w prawym dolnym rogu. Lista modeli (`FilterableTable`) — nowy wiersz z kolumnami: typ (ikona TrendingUp), tytuł, Document (—), Forecast (3Y), Variants (base), Levels (—), Status (DRAFT), Updated.

**Funkcjonalność**
`FinanceHub.tsx` (CTA → `setShowCreateModelModal(true)`), `CreateModelModal.tsx` (`handleCreate` → `createModelWithFallback` → `V8FinanceApi.createModel`), `V8FinanceApi.ts` (`POST /api/v8/finance/models`), fallback `POST /api/financial-modeling/models`, `normalizeModelStatus`, `onCreated` callback → `loadModels()`.

---

### MC-16M-02 · Tworzenie modelu z paczki zestawień finansowych · [DB] [V8]

**Co się dzieje**
Konsultant Apator otwiera zakładkę Zestawienia i importuje sprawozdanie roczne 2024 — zestawienie pojawia się na liście. Klika na kebab menu (⋮) zestawienia → „Utwórz model" (`finance.row.createModelFromStatement`). System otwiera `CreateModelModal` w trybie `statement` z wstępnie wybranym `sourceStatementPackId`. Nazwa modelu wypełnia się automatycznie jako np. „Sprawozdanie 2024 forecast". Data startu (startDate) wyliczona automatycznie jako miesiąc po `periodEnd` zestawienia (`toForecastStartDate`). Konsultant koryguje tylko horyzont na 36 miesięcy i klika „Utwórz". Nowy model pojawia się na zakładce Modele z kolumną Document = tytuł zestawienia źródłowego.

**Efekty pracy**
`POST /api/v8/finance/models` z `{ ..., sourceStatementPackId: "<id>", startDate: "<data>", assumptions: undefined }` — brak `assumptions` gdy tryb `statement`. Odpowiedź 201. Model w bazie danych ma `source_statement_pack_id` uzupełniony. W widoku listy modeli kolumna „Document" pokazuje `sourceDocumentTitle` (tytuł zestawienia). Hard-refresh → kolumna Document zachowana. Powiązanie model↔zestawienie umożliwia późniejszą generację outputów bazujących na realnych danych historycznych.

**Grafika**
`CreateModelModal` w trybie `statement` — dodatkowy dropdown listy dostępnych zestawień (`availableStatements`) ponad formularzem, lista filtruje po nazwie/dacie. Wybranie zestawienia → auto-fill name i startDate. Segment control z aktywnym „Create from statement" (tło białe/shadow). Po stworzeniu — wiersz modelu z kolumną Document niepustą (vs „—" przy trybie manual).

**Funkcjonalność**
`FinanceHub.tsx` (`handleCreateModelFromStatement` → `setCreateModelSourceStatementPackId` → `setShowCreateModelModal(true)`), `CreateModelModal.tsx` (`mode: 'statement'`, `updateFromStatement`, `toForecastStartDate`), `V8FinanceApi.createModel`, `loadModels` po `onCreated`.

---

### MC-16M-03 · Tworzenie modelu z założeniami startowymi · [DB] [V8]

**Co się dzieje**
Konsultant Elkomtech buduje model od zera dla nowego projektu inwestycyjnego bez dostępnych zestawień historycznych. Tworzy model w trybie `manual`. Po stworzeniu modelu (status DRAFT) klika na kebab → „Edytuj" → otwiera widok pełny `FinanceModelDocumentView`. W nagłówku dokumentu widoczna sekcja metadanych: Dokument (—), Okno prognozy (3Y), Warianty (base/optimistic/conservative), Poziomy (L1-L3). Konsultant weryfikuje, że `assumptions` w bazie danych zawierają `{ initialCash: 0, initialEquity: 0, initialDebt: 0, initialPPE: 0 }` — widoczne w GET /models/:id odpowiedzi (pole `assumptions`). Następnie generuje outputy by sprawdzić, czy model startowy z zerowymi założeniami produkuje spójne (zerowe) wartości bazowe.

**Efekty pracy**
Model created z `assumptions: { initialCash: 0, initialEquity: 0, initialDebt: 0, initialPPE: 0 }` w payload POST. `GET /api/v8/finance/models/:id` zwraca `assumptions` w body. Po `POST /api/v8/finance/models/:id/outputs` → `GET /api/v8/finance/models/:id/outputs` zwraca wiersze P&L z wartościami zerowymi lub szacunkowymi. Hard-refresh → model nadal dostępny na liście i w widoku.

**Grafika**
Widok dokumentu (`FinanceModelDocumentView`) — dark background (#slate-950), nagłówek z tytułem modelu i siatką metadanych 2×2 (Dokument / Okno prognozy / Warianty / Poziomy). Tabela P&L z kolumnami lat (np. 2026 / 2027 / 2028) i wierszami linii (Revenue, EBITDA, EBIT, Net Income). Wartości zerowe wyświetlone jako „0", nie „—". Sekcja wariantu aktywna (pill niebieski: Base).

**Funkcjonalność**
`CreateModelModal.tsx` (payload `assumptions` przy trybie manual: `{ initialCash, initialEquity, initialDebt, initialPPE }`), `V8FinanceApi.createModel`, `V8FinanceApi.getModel`, `FinanceModelDocumentView.tsx` (metadane z `row` + `detail`).

---

### MC-16M-04 · Granularność miesięczna vs kwartalna vs roczna · [DB] [V8]

**Co się dzieje**
Konsultant VTS Group tworzy trzy modele dla tego samego klienta z różną granularności: (1) `monthly` — 36 miesięcy, (2) `quarterly` — 12 kwartałów, (3) `annual` — 3 lata. Dla każdego generuje outputy (`POST /models/:id/outputs`). Następnie otwiera widok dokumentu każdego modelu i porównuje kolumny osi czasu — przy granularity `monthly` oś X ma 36 kolumn (2026-01, 2026-02, …), przy `quarterly` — 12 kolumn (Q1-2026, Q2-2026, …), przy `annual` — 3 kolumny (2026, 2027, 2028). Sprawdza, czy liczba kolumn w `serverOutputs.grouped` zgadza się z oczekiwaną granularności i czy UI renderuje je poprawnie bez poziomego overflow tabeli.

**Efekty pracy**
Trzy modele w DB z różnym `granularity`. `GET /api/v8/finance/models/:id/outputs` dla każdego zwraca `grouped.PL` z inną liczbą kluczy (periodów). `forecastYears` (keys `Object.values(grouped)[0]`) ma odpowiednią długość. `FinanceModelDocumentView` renderuje tabelę z dynamiczną liczbą kolumn. Hard-refresh → outputy zachowane (jeśli serwer je zapisał) LUB `isEstimated=true` ze szacunkowymi danymi klienckimi.

**Grafika**
Tabela dokumentu z nagłówkami kolumn: przy monthly — etykiety formatu `YYYY-MM`; przy quarterly — etykiety `QN-YYYY`; przy annual — `YYYY`. Tabela przewijalna poziomo dla 36 kolumn (miesięcznie). Pill wariantu Base aktywny (niebieski). Ikona/badge „szacunkowe" jeśli `isEstimated=true`.

**Funkcjonalność**
`CreateModelModal.tsx` (pole granularity), `V8FinanceApi.createModel` (granularity w payload), `FinanceModelDocumentView.tsx` (`forecastYears` z `serverOutputs.grouped` vs `detail.forecastYears`), tabela wierszy (`rows`).

---

### MC-16M-05 · Model w walucie EUR dla klienta zagranicznego · [DB] [V8]

**Co się dzieje**
Konsultant przygotowuje model finansowy dla projektu Elkomtech w Niemczech. Tworzy model ręcznie z walutą EUR, nazwą „Elkomtech DE Expansion Model 2026–2029", horyzont 36 miesięcy. Po stworzeniu sprawdza, że w widoku dokumentu wartości formatowane są z separatorem tysiąca i symbolem EUR (lub z prefiksem walutowym). Generuje outputy i weryfikuje w Network żądanie `POST /models/:id/outputs` — czy nagłówek Accept-Language lub pole `currency` w body trafia na serwer. Porównuje z modelem PLN: formatowanie liczb (`Intl.NumberFormat`) różni się lokalizacją (`pl-PL` vs `en-US`), ale jednostka walutowa pochodzi z `row.currency`.

**Efekty pracy**
Model w DB z `currency = "EUR"`. `GET /api/v8/finance/models/:id` → `{ model: { currency: "EUR", ... } }`. W `FinanceModelDocumentView` `isPl` wpływa jedynie na format liczb (`pl-PL` / `en-US`), waluta nie zmienia formattera — ale etykieta w UI (`row.currency`) pokazuje „EUR". Hard-refresh → waluta zachowana. Weryfikacja: lista modeli na zakładce — brak dedykowanej kolumny waluty w tabeli modeli (Currency to kolumna analizy), ale Preview Panel lub widok dokumentu powinien ją pokazywać.

**Grafika**
Modal tworzenia: dropdown Currency z opcjami PLN / EUR / USD (lista z `financeTypes`). Widok dokumentu: nagłówek metadanych bez dedykowanej komórki Currency, ale tytuł „Elkomtech DE Expansion Model" widoczny. Toast „Model utworzony". Lista modeli — wiersz bez kolumny currency (inaczej niż w zakładce Analysis). Weryfikacja currency przez Preview Panel lub widok pełny.

**Funkcjonalność**
`CreateModelModal.tsx` (`form.currency: "EUR"`), `V8FinanceApi.createModel`, `FinanceModelDocumentView.tsx` (`row.currency`, `isPl` → `Intl.NumberFormat`), `financeTypes.ts` (FinanceModelRow.currency).

---

### MC-16M-06 · Edycja metadanych istniejącego modelu · [DB] [V8]

**Co się dzieje**
Konsultant VTS Group stworzył model „Prognoza transformacji VTS Group 2026–2029" w poprzednim tygodniu. Klient zmienił decyzję co do scenariusza — zamiast `base` chce wariant `conservative` jako główny punkt wyjścia. Konsultant klika kebab ⋮ przy wierszu modelu → „Edytuj" (otwiera `handleOpenFull`). Ewentualnie konsultant szuka przycisku edycji w widoku dokumentu (header modelu). Sprawdza, czy jest możliwość zmiany metadanych (name, scenario, currency) przez `PATCH /api/v8/finance/models/:id`. Weryfikuje żądanie w Network (body, status 200, pola odpowiedzi). Następnie sprawdza, że lista modeli odświeżyła scenariusz wiersza.

**Efekty pracy**
`PATCH /api/v8/finance/models/:id` z `{ assumptions: { ... } }` lub innymi polami — zależy co obsługuje backend. W Network: status 200. Po `loadModels()` → wiersz modelu z nowym stanem. Hard-refresh → zmieniony metadane zachowane. Uwaga: `updateModel` w `V8FinanceApi.ts` przyjmuje `{ assumptions?: Record<string, unknown> }` — edycja name/scenario może wymagać rozszerzonego PATCH lub jest na razie niedostępna (odnotować jako known gap jeśli brak UI edycji metadanych poza założeniami).

**Grafika**
Kebab menu (⋮): pozycje „Otwórz podgląd", „Edytuj", „Eksportuj", „Zatwierdź" (jeśli DRAFT), „Usuń". Widok pełny modelu (lub modal edycji) z polami Name, Scenario, Currency. Toast po zapisie. Lista modeli — zaktualizowany scenariusz w kolumnie Variants.

**Funkcjonalność**
`useFinanceRowActions.ts` (`handleOpenFull`, `getRowActions` → action `edit`), `V8FinanceApi.updateModel` (`PATCH /api/v8/finance/models/:id`), `loadModels` po sukcesie.

---

# B. Generacja i przeglądanie outputów

---

### MC-16M-07 · Generacja projekcji P&L 3-lata — POST /models/:id/outputs · [DB] [V8]

**Co się dzieje**
Konsultant VTS Group ma model DRAFT z pustymi outputami — widok dokumentu pokazuje dane szacunkowe (`isEstimated=true`). Klika przycisk „Generuj prognozy" (kebab lub przycisk w panelu) → `POST /api/v8/finance/models/:id/outputs`. Serwer uruchamia silnik projekcji 3-letniej P&L/BS/CF — żądanie może zająć kilka sekund. Konsultant obserwuje loader/spinner. Po zakończeniu (`GET /api/v8/finance/models/:id/outputs`) dane serwera (`grouped.PL`, `grouped.BS`, `grouped.CF`) zastępują szacunki — badge `isEstimated` znika, tabela wypełnia się realnymi wartościami z rozróżnieniem `isTotal`/`isSubtotal` per wiersz. Konsultant weryfikuje, że sumy (EBITDA, EBIT, Net Income) są spójne matematycznie.

**Efekty pracy**
`POST /api/v8/finance/models/:id/outputs` → 200/201. Następnie `GET /api/v8/finance/models/:id/outputs` → `{ grouped: { PL: { "2026-01": [...], "2026-02": [...], ... }, BS: {...}, CF: {...} } }`. `setServerOutputs(result)` → `setIsEstimated(false)`. Tabela P&L z ~36 kolumnami miesięcznymi i ~20 wierszami linii. Hard-refresh → outputy trwałe (jeśli serwer je zachował) LUB ponowna generacja wymagana.

**Grafika**
Loader/spinner na czas generacji (kilka sekund). Tabela dokumentu — dark background, wiersze z `lineCode` + `lineName` + wartości per okres. Wiersze `isTotal=true` pogrubione lub z wyróżnionym tłem. Brak badge'u „szacunkowe" po generacji z serwera. Wariant Base aktywny (pill niebieski). Nagłówki kolumn = klucze `grouped.PL` (okresy).

**Funkcjonalność**
`V8FinanceApi.getModelOutputs` (`GET /api/v8/finance/models/:id/outputs?scenario=base`), `FinanceModelDocumentView.tsx` (`loadOutputs` useEffect, `setServerOutputs`, `setIsEstimated`), `serverRows` useMemo (mapowanie grouped → `FinanceModelForecastLine[]`), `isTotal`/`isSubtotal` z `ServerOutputLine`.

---

### MC-16M-08 · Przełączanie P&L → Bilans → Cash Flow w widoku dokumentu · [V8]

**Co się dzieje**
Konsultant Apator ma model z wygenerowanymi outputami. Otwiera widok dokumentu modelu. Domyślnie aktywny jest P&L. Klika przycisk „BS" (Bilans / Balance Sheet) — tabela natychmiast przeładowuje się danymi z `grouped.BS`: wiersze aktywów, pasywów, sumy bilansowej. Następnie klika „CF" (Cash Flow) — tabela pokazuje przepływy operacyjne, inwestycyjne i finansowe. Klika z powrotem „P&L" — tabela wraca do rachunku wyników. Weryfikuje, że przełączanie nie generuje nowych żądań sieciowych (dane już załadowane w `serverOutputs.grouped`) — wyłącznie zmiana `selectedStatement` w stanie komponentu.

**Efekty pracy**
Brak dodatkowych żądań HTTP przy przełączaniu (dane z `serverOutputs` raz załadowanego). `setSelectedStatement('BS')` → `serverRows` useMemo przelicza dla `grouped.BS`. `setSelectedStatement('CF')` → `serverRows` z `grouped.CF`. Wszystkie trzy zestawy danych dostępne bez ponownego fetch. Loader NIE pojawia się przy przełączaniu (wyłącznie przy pierwszym `loadOutputs`).

**Grafika**
Segmentowy przełącznik wariantów w nagłówku dokumentu: trzy przyciski `P&L`, `BS` (Bilans), `CF` (Cash Flow) — aktywny z niebieskim tłem pill, nieaktywne szare. Tabela zmienia etykiety wierszy na odpowiednie dla danego sprawozdania. BS: wiersze jak Rzeczowe aktywa trwałe, Należności, Zobowiązania krótkoterminowe. CF: wiersze jak Przepływy z działalności operacyjnej, Capex, Dywidendy.

**Funkcjonalność**
`FinanceModelDocumentView.tsx` (`selectedStatement` state, `setSelectedStatement`, `statementLabels`, `serverRows` useMemo z `statementKey = selectedStatement === 'P&L' ? 'PL' : selectedStatement`), brak re-fetch przy zmianie `selectedStatement`.

---

### MC-16M-09 · Porównanie wariantów base vs optimistic — przełącznik scenariuszy · [V8] [DB]

**Co się dzieje**
Konsultant VTS Group prezentuje zarządowi trzy scenariusze transformacji. Model ma wygenerowane outputy dla wariantu `base`. Konsultant klika pill „Optymistyczny" w headerze dokumentu — komponent wywołuje `loadOutputs()` z `{ scenario: 'optimistic' }` (useEffect zależy od `selectedVariant`). Serwer zwraca `grouped` dla scenariusza optymistycznego — wyższe przychody, lepsza marża EBITDA. Konsultant przełącza na „Konserwatywny" — dane bardziej zachowawcze. Klika z powrotem „Base" — wyjściowe wartości. Weryfikuje w Network, że każde przełączenie trigguje nowy `GET /api/v8/finance/models/:id/outputs?scenario=<wariant>`.

**Efekty pracy**
Trzy żądania GET do `GET /api/v8/finance/models/:id/outputs?scenario=base`, `?scenario=optimistic`, `?scenario=conservative` — każde po przełączeniu wariantu (`selectedVariant` → useEffect). Odpowiedź 200 lub brak danych (→ `isEstimated=true` dla wariantu bez outputów). Tabela zmienia wartości przy każdym przełączeniu. Aktywny pill wskazuje bieżący wariant.

**Grafika**
Trzy pill-przyciski wariantu: „Base" / „Optymistyczny" (isPl) / „Konserwatywny" (isPl). Aktywny pill: `bg-blue-500 text-slate-950`. Nieaktywne: `bg-white/[0.04] text-slate-600`. Tabela rzuca natychmiastowe „Loading…" lub nowe wartości bez całościowego unmount. Jeśli wariant bez danych → `isEstimated=true` → tabela szacunkowa.

**Funkcjonalność**
`FinanceModelDocumentView.tsx` (`selectedVariant` state, `activeVariant` useMemo z fallback na `detail.variants[0]`, useEffect `[row.id, selectedVariant]` → `loadOutputs`), `V8FinanceApi.getModelOutputs(row.id, { scenario: selectedVariant })`.

---

### MC-16M-10 · Rachunek Cash Flow — sekcje operating / investing / financing · [V8]

**Co się dzieje**
Konsultant Elkomtech analizuje zdolność projektu do obsługi długu. Przełącza widok na „CF" (Cash Flow). W tabeli sprawdza, czy serwer zwrócił zorganizowane wiersze z trzema sekcjami: (1) działalność operacyjna — EBITDA, zmiany kapitału obrotowego, podatki; (2) działalność inwestycyjna — CAPEX, nabycia środków; (3) działalność finansowa — emisja długu, spłaty, dywidendy. Weryfikuje `lineCode` z `grouped.CF` w Network — sprawdza, czy backend używa konwencji `CF_OPERATING_*`, `CF_INVESTING_*`, `CF_FINANCING_*`. Oblicza ręcznie Free Cash Flow = CF operacyjny + CF inwestycyjny i porównuje z wierszem sumy (jeśli `isTotal=true` na odpowiednim wierszu).

**Efekty pracy**
`GET /api/v8/finance/models/:id/outputs?scenario=base` → `grouped.CF` z kluczami periodów. Każdy okres zawiera tablicę `{ lineCode, lineName, value, level, isTotal, isSubtotal }`. `serverRows` useMemo z `statementKey = 'CF'` wypełnia tabelę. Wiersze `isTotal=true` = sumy sekcji. Hard-refresh → outputy CF dostępne (jeśli serwer je zachował). Brak zerowych/null wartości dla pozycji z danymi.

**Grafika**
Tabela CF: wiersze sekcji (level=0 pogrubione), sub-wiersze (level=1 z wcięciem), sumy sekcji (isTotal — tło accent). Kolumny: nazwy wierszy (lineName) + kolumny periodów z wartościami numerycznymi. Ujemne wartości (np. CAPEX) — znak minus lub nawiasy (zależy od formattera `formatValue`). `Intl.NumberFormat` bez dziesiętnych (`maximumFractionDigits: 0`).

**Funkcjonalność**
`FinanceModelDocumentView.tsx` (`selectedStatement = 'CF'`, `serverRows` useMemo → `grouped.CF`), `ServerOutputLine` interface (`lineCode`, `lineName`, `value`, `level`, `isTotal`, `isSubtotal`), `formatValue` (`Intl.NumberFormat`).

---

### MC-16M-11 · Flaga isEstimated — dane szacunkowe vs serwer-backed · [V8]

**Co się dzieje**
Konsultant otwiera widok dokumentu modelu, który NIE ma jeszcze wygenerowanych outputów (nowo stworzony, POST /outputs nie był wywołany). `FinanceModelDocumentView` wywołuje `GET /api/v8/finance/models/:id/outputs?scenario=base` — serwer zwraca pustą `grouped` lub błąd. `setIsEstimated(true)` → tabela pokazuje dane szacunkowe z `detail.scenarioTables[activeVariant][selectedStatement]`. Konsultant sprawdza, czy w UI jest jawna informacja o szacunkowości (badge, tooltip, opis). Następnie generuje outputy (POST /outputs) i przeładowuje widok — `isEstimated=false`, tabela przełącza się na dane serwera. Weryfikuje, że przejście szacunkowe→serwer jest płynne (brak białego ekranu).

**Efekty pracy**
Ścieżka A (brak outputów): `GET /outputs` → puste lub błąd → `setServerOutputs(null)`, `setIsEstimated(true)` → `rows = detail?.scenarioTables[activeVariant][selectedStatement] || []`. Ścieżka B (outputy wygenerowane): `GET /outputs` → `grouped` niepuste → `setServerOutputs(result)`, `setIsEstimated(false)` → `rows = serverRows`. Brak crash przy pustych danych. Hard-refresh ścieżka A → nadal szacunkowe.

**Grafika**
Ścieżka A (szacunkowe): ewentualny badge/komunikat „Dane szacunkowe" lub „Szacunkowa projekcja" w headerze. Tabela z danymi z `detail` — mniejszy zestaw linii (L1-L3 uproszczony). Ścieżka B (serwer): tabela pełna z `lineCode`/`lineName` z serwera, brak badge szacunkowego. Płynne przejście bez flash.

**Funkcjonalność**
`FinanceModelDocumentView.tsx` (`isEstimated` state, `loadOutputs` useEffect, `setIsEstimated(true/false)`, `serverOutputs`, `rows = serverRows || detail?.scenarioTables[activeVariant]?.[selectedStatement] || []`).

---

### MC-16M-12 · Persystencja outputów po hard-refresh · [DB] [V8]

**Co się dzieje**
Konsultant VTS Group generuje pełny zestaw outputów dla modelu 36-miesięcznego (POST /outputs, wszystkie trzy sprawozdania). Sprawdza w Network wszystkie trzy `GET /models/:id/outputs?scenario=base/optimistic/conservative` — odpowiedzi 200 z danymi. Zamknęło przeglądarkę i wraca po 30 minutach. Odświeża stronę (hard-refresh `Ctrl+Shift+R`). Otwiera widok dokumentu modelu. Sprawdza, że `GET /models/:id/outputs` nadal zwraca te same dane — outputy są trwałe w DB, nie tylko w pamięci sesji. Porównuje liczby z wcześniejszym widokiem — identyczne.

**Efekty pracy**
Outputy zapisane po stronie serwera (tabela `financial_model_outputs` lub odpowiednik). Po hard-refresh: `loadOutputs()` → `GET /api/v8/finance/models/:id/outputs` → `grouped` niepuste → `isEstimated=false`. Dane identyczne z poprzednią sesją. Brak konieczności ponownego `POST /outputs`. Status modelu mógł zmienić się na coś innego niż DRAFT (odnotować).

**Grafika**
Hard-refresh → krótki loading spinner tabeli → dane serwera załadowane. Brak widocznej różnicy w stosunku do poprzedniej sesji. Badge szacunkowy nieobecny. Kolumny i wartości identyczne.

**Funkcjonalność**
`FinanceModelDocumentView.tsx` (useEffect `[row.id, selectedVariant]` → `loadOutputs` przy każdym mountzie), `V8FinanceApi.getModelOutputs`, persystencja po stronie serwera Railway (caboose staging).

---

# C. Wersjonowanie modeli

---

### MC-16M-13 · Przeglądanie historii wersji modelu — lista snapshot'ów · [FLAG] [DB] [V8]

**Co się dzieje**
Konsultant Apator chce prześledzić historię zmian modelu finansowego przed prezentacją zarządowi. Aktywuje flagę wersjonowania URL: `/finance?tab=models&ff_modelVersioning=1`. Otwiera widok dokumentu modelu (klika tytuł lub „Edytuj"). Na dole dokumentu pojawia się sekcja `ModelVersionHistory` — panel z listą wersji modelu pobrana z `GET /api/v8/finance/models/:id/versions`. Konsultant widzi kolumny: nr wersji (`versionNumber`), etykieta scenariusza (`scenarioLabel`), status, data i autor (`createdBy`). Przewija listę i wybiera wersję do porównania z aktualną.

**Efekty pracy**
Flaga aktywna → `isFinanceFlagEnabled('modelVersioning')` = true → `ModelVersionHistory` wyrenderowany. `GET /api/v8/finance/models/:id/versions` → `{ data: { versions: [{ id, modelId, versionNumber, scenarioLabel, status, createdAt, createdBy }] } }` → `setVersions(arr)`. Lista wersji w stanie komponentu. Hard-refresh z flagą → lista wersji ponownie załadowana.

**Grafika**
`ModelVersionHistory` — panel pod tabelą outputów. Loading spinner podczas `GET /versions`. Lista wersji: każdy wiersz z `#N`, `scenarioLabel` lub „—", `status`, data (ISO string), autor. Przyciski selekcji „od" i „do" dla diff. Brak wersji → komunikat pustego stanu (odnotować treść). Przycisk „Pokaż diff" aktywny dopiero po wyborze dwóch różnych wersji.

**Funkcjonalność**
`FinanceModelDocumentView.tsx` (`isFinanceFlagEnabled('modelVersioning')` → `<ModelVersionHistory modelId={row.id} />`), `ModelVersionHistory.tsx` (useEffect → `V8FinanceApi.getModelVersions(modelId)` → `res.data.versions`), `financeFeatureFlags.ts` (`FLAGS.modelVersioning` → query `ff_modelVersioning`, localStorage `ff.fin_model_versioning`).

---

### MC-16M-14 · Diff między dwiema wersjami — zmiana założeń · [FLAG] [V8]

**Co się dzieje**
Konsultant VTS Group zmienił tydzień temu założenia modelu (np. wzrost przychodów z 8% na 12%) co utworzyło nową wersję. Aktywuje flagę `ff_modelVersioning=1`. W panelu `ModelVersionHistory` widzi dwie wersje: v1 i v2. Wybiera v1 w dropdownie „Od" i v2 w dropdownie „Do". Klika „Pokaż diff" → `GET /api/v8/finance/models/:id/versions/diff?from=<id1>&to=<id2>`. Serwer zwraca `{ data: { diff: { fromVersion: 1, toVersion: 2, assumptionChanges: [{ key: "revenueGrowth", from: 0.08, to: 0.12 }] } } }`. Panel wyświetla tabelę zmian: klucz założenia, wartość „od", wartość „do".

**Efekty pracy**
`GET /api/v8/finance/models/:id/versions/diff?from=<id1>&to=<id2>` → 200 → `res.data.diff` → `setDiff(diff)`. Tabela diff z kolumnami `key | from | to`. `fmt()` helper formatuje wartości (null → „—", objekt → JSON.stringify, inne → String). Błąd diff → `setDiffError(msg)` → komunikat błędu w UI. Loading spinner (`diffLoading`) podczas żądania.

**Grafika**
Panel diff: dwa dropdown selecty (lista wersji jako `<option value={v.id}>#N — scenarioLabel (data)</option>`). Przycisk „Porównaj" (aktywny gdy `selectedFrom !== selectedTo && obie wybrane`). Tabela wyniku: 3 kolumny (Klucz, Wartość od, Wartość do). Wiersz per zmiana w `assumptionChanges`. Błąd: czerwony komunikat zamiast tabeli.

**Funkcjonalność**
`ModelVersionHistory.tsx` (`loadDiff` useCallback → `V8FinanceApi.getModelVersionDiff(modelId, selectedFrom, selectedTo)` → `res.data.diff`, `selectedFrom`/`selectedTo` state, `diffLoading`/`diffError`, `fmt()` helper), `financeFeatureFlags.ts`.

---

### MC-16M-15 · Stan pusty historii wersji — model bez snapshots · [FLAG] [V8]

**Co się dzieje**
Konsultant otwiera widok dokumentu nowo stworzonego modelu (zero zmian po stworzeniu). Aktywuje flagę `ff_modelVersioning=1`. `GET /api/v8/finance/models/:id/versions` zwraca `{ data: { versions: [] } }` — pusta tablica. `ModelVersionHistory` wyrenderowuje stan pusty. Konsultant sprawdza, że: (1) nie ma crash ani białego ekranu, (2) widoczny jest czytelny komunikat o braku wersji, (3) dropdown selekcji wersji jest pusty lub ukryty, (4) przycisk „Porównaj" jest disabled lub niewidoczny. Następnie wykonuje jedną zmianę modelu (jeśli API tworzy wersje automatycznie) i odświeża — sprawdza, czy wersja v1 się pojawiła.

**Efekty pracy**
`GET /api/v8/finance/models/:id/versions` → `[]` → `setVersions([])`. Komponent nie crashuje. Brak listy wersji → stan pusty (tekst). Jeśli zmiana modelu (`PATCH`) tworzy nową wersję automatycznie: po PATCH → GET versions → `[{ versionNumber: 1, ... }]`. Brak wersji NIE blokuje reszty widoku dokumentu.

**Grafika**
`ModelVersionHistory` po załadowaniu pustej tablicy: tekst pusty stanu (np. „Brak historii wersji — zmiany będą tu rejestrowane" — odnotować faktyczną treść), brak tabeli/dropdownów. Loading → znika, pojawia się pusty stan. Reszta widoku dokumentu (tabela outputów, wariant switcher) nienaruszona.

**Funkcjonalność**
`ModelVersionHistory.tsx` (`loading=false`, `versions=[]` → render pustego stanu; sprawdź czy jest warunek `if (versions.length === 0)` lub analogiczny), `V8FinanceApi.getModelVersions`.

---

### MC-16M-16 · Flaga OFF — sekcja wersjonowania ukryta · [FLAG]

**Co się dzieje**
Konsultant pracuje bez aktywowania flagi modelVersioning. Otwiera widok dokumentu modelu — `isFinanceFlagEnabled('modelVersioning')` zwraca `false` (brak query `ff_modelVersioning`, brak localStorage `ff.fin_model_versioning`, brak env `VITE_FIN_MODEL_VERSIONING_ENABLED`). Sekcja `ModelVersionHistory` w ogóle nie wyrenderowuje się — brak w DOM. Konsultant sprawdza w DevTools → Elements, że nie ma `data-testid` ani śladów panelu wersjonowania. Następnie aktywuje flagę przez localStorage: `localStorage.setItem('ff.fin_model_versioning', '1')` i odświeża stronę → sekcja pojawia się. Usuwa klucz i odświeża → znika ponownie.

**Efekty pracy**
Brak flagi → `isFinanceFlagEnabled('modelVersioning') = false` → brak `<ModelVersionHistory>` w JSX. Brak żądania `GET /models/:id/versions` w Network (nie ma komponentu który go wysyła). Aktywacja przez localStorage → restart komponentu przy odświeżeniu → `readLocalStorage('ff.fin_model_versioning')` = `true` → sekcja wyrenderowana. Priorytet flag: URL query > localStorage > env.

**Grafika**
Bez flagi: widok dokumentu kończy się na tabeli outputów — brak panelu wersjonowania poniżej. Z flagą: paneel `ModelVersionHistory` widoczny poniżej tabeli (z nagłówkiem i listą/pustym stanem). Brak wizualnego placeholder'u gdy flaga OFF.

**Funkcjonalność**
`financeFeatureFlags.ts` (`isFinanceFlagEnabled('modelVersioning')` → `readQuery` → `readLocalStorage` → `readEnv`), `FinanceModelDocumentView.tsx` (warunek `{isFinanceFlagEnabled('modelVersioning') && <ModelVersionHistory modelId={row.id} />}`).

---

# D. Linkowanie inicjatyw

---

### MC-16M-17 · Klik badge „Unlinked" → otwarcie LinkInitiativeModal · [V8] [CROSS-MODULE]

**Co się dzieje**
Konsultant VTS Group otwiera zakładkę Modele. W dashboardzie v8 (`v8Dashboard.linkageHealth`) widoczny jest wskaźnik niepowiązanych inicjatyw. Lista modeli ma kolumnę Initiative (lub badge) — modele bez powiązania z inicjatywą pokazują badge „Unlinked" (tekst z i18n key `finance.v8.unlinked` = „Unlinked"). Konsultant klika ten badge dla konkretnego modelu → `setShowLinkInitiativeModal(true)` → otwiera się `LinkInitiativeModal` z wstępnie ustawionym `financeRef` = id modelu. Konsultant weryfikuje, że pole Finance Ref jest już wypełnione i że modal wyjaśnia cel linkowania.

**Efekty pracy**
`v8Dashboard.linkageHealth.unlinkedInitiativesCount > 0` → badge widoczny. Klik → `setShowLinkInitiativeModal(true)`. `LinkInitiativeModal` wyrenderowany z `financeRef = row.id`. `GET /api/v8/finance/dashboard` (lub odpowiednik) musi zwracać `linkageHealth` — weryfikuj w Network na mount FinanceHub. Brak kliknięcia badge'u bez inicjatywy do linkowania = bez sensu (odnotować UX gap).

**Grafika**
Badge „Unlinked" — czerwony lub szary chip/button w kolumnie Initiative (lub w KPI strip). Klik → modal centralny `LinkInitiativeModal` z: tytułem „Link initiative to finance", opisem celu, polem Initiative ID (text input), polem Finance Ref (prefilled), dropdownem Linkage Type (financial_model / budget / analysis / valuation / investment_case), przyciskiem „Powiąż".

**Funkcjonalność**
`FinanceHub.tsx` (`v8Dashboard.linkageHealth`, `finance.v8.unlinked` i18n key, `setShowLinkInitiativeModal(true)` → `<LinkInitiativeModal financeRef={...} />`), `LinkInitiativeModal.tsx` (props: `financeRef`, `onClose`, `onLinked`).

---

### MC-16M-18 · Linkowanie modelu do inicjatywy — POST 201 · [DB] [CROSS-MODULE]

**Co się dzieje**
Konsultant Apator chce powiązać model finansowy z inicjatywą „Automatyzacja zakupów" (zna jej ID z zakładki M14 Wdrożenie). W `LinkInitiativeModal` wpisuje ID inicjatywy, weryfikuje że Finance Ref jest poprawny (ID modelu), wybiera typ linkażu `financial_model`. Klika „Powiąż". `POST /initiatives/:initiativeId/economics-links` z body `{ financeModelRef, linkageType, status: 'not_started' }`. Serwer odpowiada 201. Toast sukcesu „Initiative linked to finance". Modal zamyka się. Konsultant przechodzi do M15 Rezultaty i weryfikuje, że powiązanie z ekonomiką (benefits_register / economics link) jest widoczne.

**Efekty pracy**
`POST /initiatives/<id>/economics-links` z `{ financeModelRef: "<model-id>", linkageType: "financial_model", status: "not_started" }` → 201. Wiersz w tabeli `v8_initiative_economics_linkages`. Toast sukcesu. `onLinked?.()` callback → ewentualne odświeżenie. Hard-refresh i przejście do M14 Inicjatywy → karta inicjatywy → zakładka Ekonomika → powiązanie modelu widoczne. Cross-module: M16↔M14↔M15.

**Grafika**
`LinkInitiativeModal` — pole Initiative ID z placeholderem UUID, pole Finance Ref (prefilled, edytowalne), dropdown Linkage Type (5 opcji). Przycisk „Powiąż" z spinnerem (`saving=true`). Toast sukcesu w prawym dolnym rogu. Modal zamknięty po `onClose()`. Zakładka M14 Inicjatywy → powiązanie ekonomiczne.

**Funkcjonalność**
`LinkInitiativeModal.tsx` (`handleLink` → `Api.post('/initiatives/${encodeURIComponent(iId)}/economics-links', { financeModelRef, linkageType, status })` → toast → `onLinked?.()` → `onClose()`), tabela `v8_initiative_economics_linkages` (M14 backend).

---

### MC-16M-19 · Pobieranie listy powiązań — GET economics-links · [DB] [CROSS-MODULE]

**Co się dzieje**
Konsultant weryfikuje, że po linkowaniu modelu do inicjatywy (MC-16M-18) lista powiązań jest dostępna przez API. Otwiera DevTools → Network i nawiguje do zakładki Inicjatywy (M14). Szuka żądania `GET /initiatives/:id/economics-links`. Odpowiedź powinna zawierać tablicę z nowo stworzonym wierszem: `[{ financeModelRef, linkageType, status, createdAt, ... }]`. Konsultant symuluje też pobieranie przez URL bezpośredni w DevTools (lub curl z tokenem z localStorage). Weryfikuje, że `financeModelRef` = ID modelu z MC-16M-18.

**Efekty pracy**
`GET /initiatives/:id/economics-links` → 200 → `[ { id, initiativeId, financeModelRef, linkageType, status, createdAt } ]`. Dokładnie jeden wiersz po jednym linkowaniu. Po dodaniu drugiego linkażu (inny model dla tej samej inicjatywy) — lista ma dwa wiersze. Hard-refresh → lista zachowana.

**Grafika**
Zakładka M14 inicjatywy → sekcja Ekonomika/Powiązania finansowe — lista kart powiązanych modeli (jeśli M14 UI ma to wyrenderowane). DevTools Network → `GET /initiatives/<id>/economics-links` → 200 z tablicą. Brak UI dla `GET` po stronie M16 (linkowanie → write-only w M16).

**Funkcjonalność**
Backend `pmo/initiatives.routes.ts` lub `v8/initiatives.routes.ts` (endpoint `GET /initiatives/:id/economics-links`), tabela `v8_initiative_economics_linkages` (SELECT WHERE `initiative_id = ?`), M14 FinanceHub widok ekonomiki (cross-module).

---

### MC-16M-20 · Brak autoryzacji — 401 przy linkowaniu bez tokenu · [V8]

**Co się dzieje**
Konsultant testuje bezpieczeństwo endpointu linkowania. Otwiera `LinkInitiativeModal` i wypełnia pola. Przed kliknięciem „Powiąż" symuluje wygaśnięcie sesji: usuwa token z localStorage (`localStorage.removeItem('token')` lub odpowiednik) LUB otwiera DevTools → Application → Cookies i usuwa auth cookie. Klika „Powiąż" — `POST /initiatives/:id/economics-links` leci bez ważnego tokenu. Serwer odpowiada 401 Unauthorized. Toast błędu w UI: komunikat o błędzie (`e?.response?.data?.error || e?.message`). Modal NIE zamyka się (błąd, nie sukces). Konsultant sprawdza, że brak możliwości linkowania bez autoryzacji.

**Efekty pracy**
`POST /initiatives/<id>/economics-links` bez ważnego JWT → 401. `catch(e)` → `toast.error(msg)`. `setSaving(false)`. Modal nadal otwarty. Brak wiersza w `v8_initiative_economics_linkages`. Token usunięty → przeładowanie strony → redirect do logowania (SPA auth flow). Weryfikacja: żaden dane nie zostają zapisane w DB przy 401.

**Grafika**
Toast błędu (czerwony) z komunikatem „Linking failed — check initiative ID" lub serwer-side komunikatem 401. Przycisk „Powiąż" wraca do stanu aktywnego (nie spinuje). Modal nadal widoczny z wypełnionymi polami.

**Funkcjonalność**
`LinkInitiativeModal.tsx` (`handleLink` → `catch(e)` → `toast.error`), auth middleware (JWT verification), `setSaving(false)` po błędzie.

---

# E. Value Office Panel

---

### MC-16M-21 · Aktywacja flagi valueOffice — panel pojawia się pod tabelą · [FLAG]

**Co się dzieje**
Konsultant VTS Group chce zobaczyć kokpit wartości transformacji. Otwiera `/finance?tab=models` — panelu Value Office nie widzi (flaga domyślnie OFF). Aktywuje przez URL: `/finance?tab=models&ff_valueOffice=1`. Strona przeładowuje się z flagą aktywną — `isFinanceFlagEnabled('valueOffice')` = true. Pod tabelą modeli pojawia się `ValueOfficePanel`. Konsultant weryfikuje, że panel jest widoczny tylko na zakładce `models` (linia: `_showValue = isFinanceFlagEnabled('valueOffice') && activeTab === 'models'`). Przełącza na zakładkę Analysis — panel znika. Wraca na Models — panel znów widoczny.

**Efekty pracy**
`isFinanceFlagEnabled('valueOffice')` (query `ff_valueOffice=1`) = true → `_showValue = true` tylko gdy `activeTab === 'models'`. Zmiana zakładki → `activeTab !== 'models'` → `_showValue = false` → `ValueOfficePanel` znika. Brak żadnych żądań HTTP od panelu gdy nie wyrenderowany.

**Grafika**
Z flagą OFF: zakończenie strony na tabeli modeli + ewentualna sekcja DriverPlanner (jeśli też ON). Z flagą ON: pod tabelą pojawia się `ValueOfficePanel` — sekcja z nagłówkiem, loaderem, a następnie: wykres waterfall (Most wartości) i bąble portfela. Layout: `flex flex-col gap-4 px-4 pb-6`.

**Funkcjonalność**
`FinanceHub.tsx` (`isFinanceFlagEnabled('valueOffice')`, `_showValue`, `<ValueOfficePanel />`), `financeFeatureFlags.ts` (`FLAGS.valueOffice.query = 'ff_valueOffice'`).

---

### MC-16M-22 · Most wartości (waterfall) — kroki Baseline → Realized → Banked · [FLAG] [V8]

**Co się dzieje**
Konsultant Apator z aktywną flagą `ff_valueOffice=1` widzi `ValueOfficePanel`. Panel na mount wysyła `POST /api/v8/finance/value/value-bridge` z listą inicjatyw (lub przykładowymi `SAMPLE_INITIATIVES` gdy brak). Serwer zwraca `{ data: { steps: [{ label, value, kind }], totalRealized, totalIdentified } }`. Panel renderuje `FinanceWaterfall` — diagram krokowy z kroki: „Baseline" (start), „Automatyzacja zakupów" (+1,2M, increase), „Konsolidacja systemów" (+0,8M, increase), „Nowy kanał sprzedaży" (-0,2M, decrease), „Total Realized" (total). Konsultant sprawdza, czy kolory kroków: increase = zielony, decrease = czerwony, start/total = niebieski.

**Efekty pracy**
`POST /api/v8/finance/value/value-bridge` z `{ initiatives: [...] }` → 200 → `{ data: { steps, totalRealized, totalIdentified } }` → `setBridge(res.data)`. `FinanceWaterfall` wyrenderowany z krokami. `loading=false` po sukcesie. `failed=false`. Hard-refresh → panel ponownie woła API na mount.

**Grafika**
`FinanceWaterfall` — diagram krokowy poziomy/pionowy z paskami na każdy krok. Kolory: `WaterfallStepKind` = start (niebieski), increase (zielony), decrease (czerwony), total (niebieski ciemny). Etykiety: `label` nad/pod paskiem, wartość `fmtMoney(value)` przy pasku. KPI strip nad wykresem: „Total Realized: X,XM" / „Total Identified: X,XM".

**Funkcjonalność**
`ValueOfficePanel.tsx` (`defaultValueBridgeFetcher` → `Api.post('/api/v8/finance/value/value-bridge', { initiatives: [...] })`, `setBridge(bridgeRes?.data)`, `FinanceWaterfall`), `fmtMoney`, `charts/FinanceWaterfall`.

---

### MC-16M-23 · Portfel decyzyjny — bąble w kwadrantach fund/evaluate/quick_win/defer · [FLAG] [V8]

**Co się dzieje**
Konsultant VTS Group analizuje portfel inicjatyw przez pryzmat NPV i ryzyka. W `ValueOfficePanel` drugi blok to `PortfolioBubble`. Panel woła `POST /api/v8/finance/value/portfolio/prioritize` z inicjatywami. Serwer zwraca `{ data: [{ id, name, npv, risk, effort, quadrant, rank }] }`. Konsultant sprawdza, że bąble w odpowiednich kwadrantach: „Automatyzacja zakupów" (npv=900k, risk=0.2) → kwadrant `quick_win` (niebieski); „Nowy kanał sprzedaży" (npv=200k, risk=0.7) → `defer` (szary). Rozmiar bąbla proporcjonalny do `effort`. Klik na bąbel → tooltip z nazwą inicjatywy.

**Efekty pracy**
`POST /api/v8/finance/value/portfolio/prioritize` z `{ initiatives: [...] }` → 200 → `{ data: [{ id, npv, risk, effort, quadrant, rank }] }` → `setPortfolio(arr)`. `bubbleData` useMemo = mapowanie portfolio → `{ id, x: risk, y: npv, size: effort, color: QUADRANT_COLOR[quadrant], label: name }`. `PortfolioBubble` wyrenderowany z bąblami w kwadrantach.

**Grafika**
`PortfolioBubble` — wykres XY: oś X = ryzyko (0..1), oś Y = NPV (wartość). Bąble kołowe z kolorami: fund=zielony (#16a34a), evaluate=bursztyn (#f59e0b), quick_win=niebieski (#2563eb), defer=szary (#6b7280). Rozmiar bąbla = effort. Linie podziału na 4 kwadraty. Legenda kwadrantów.

**Funkcjonalność**
`ValueOfficePanel.tsx` (`defaultPortfolioFetcher` → `Api.post('/api/v8/finance/value/portfolio/prioritize', { initiatives: [...] })`, `setPortfolio`, `bubbleData` useMemo, `QUADRANT_COLOR`), `charts/PortfolioBubble`.

---

### MC-16M-24 · Fail-soft na błędzie API — degradacja do cichej notki · [FLAG] [V8]

**Co się dzieje**
Konsultant testuje odporność panelu Value Office w degradowanym środowisku. Aktywuje flagę `ff_valueOffice=1`. Symuluje błąd API (np. przez DevTools → Network → Block Request URL dla `/api/v8/finance/value/*`). `ValueOfficePanel` na mount próbuje obie kwerendy (`POST /value-bridge`, `POST /portfolio/prioritize`) — obie fail. `catch` blok: `setBridge(null)`, `setPortfolio(null)`, `setFailed(true)`. Panel degraduje się do cichej notki o błędzie (NIE crashuje całej strony). Tabela modeli nad panelem działa normalnie.

**Efekty pracy**
`Promise.all([valueBridgeFetcher, portfolioFetcher])` → throw → `catch` → `setFailed(true)`, `setLoading(false)`. Komponent wyrenderowuje komunikat degradowany (odnotować dokładny tekst). Brak unmount/crash reszty `FinanceHub`. Odblokowanie Network → odświeżenie strony → panel działa. Wzorzec fail-soft wg komentarza: „błąd degraduje do cichej notki, NIE blokuje kokpitu".

**Grafika**
W miejscu panelu (lub jego części): mała notka tekstowa w muted kolorze — np. „Dane kokpitu wartości niedostępne" lub analogiczna. Brak spinnerów (loading=false). Brak wykresów (bridge=null, portfolio=null). Tabela modeli nad panelem nienaruszona — w pełni interaktywna.

**Funkcjonalność**
`ValueOfficePanel.tsx` (`failed` state, `catch` blok `setFailed(true)`, render warunkowy: `failed && <p className="text-sm text-slate-500">...</p>`), `Promise.all` dla obu fetcherów.

---

### MC-16M-25 · Dane przykładowe gdy brak inicjatyw — SAMPLE_INITIATIVES · [FLAG]

**Co się dzieje**
Konsultant pracuje w świeżej organizacji bez żadnych powiązanych inicjatyw — `FinanceHub` nie przekazuje inicjatyw do `ValueOfficePanel` (props `initiatives` = undefined lub `[]`). Aktywuje flagę `ff_valueOffice=1`. Panel wykrywa brak inicjatyw: `effectiveInitiatives = initiatives && initiatives.length > 0 ? initiatives : SAMPLE_INITIATIVES`. Używa czterech przykładowych inicjatyw zaszytych w kodzie: Automatyzacja zakupów (1,2M, realized), Konsolidacja systemów (0,8M, in_flight), Optymalizacja energii (0,45M, committed), Nowy kanał sprzedaży (0,6M, identified). Panel nigdy nie jest pusty. Konsultant weryfikuje, że dane przykładowe wyraźnie oznaczone jako przykładowe (lub nie — odnotować UX gap).

**Efekty pracy**
`initiatives` prop = undefined → `effectiveInitiatives = SAMPLE_INITIATIVES` (4 inicjatywy). `POST /value-bridge` z tymi 4 inicjatywami. Wykres waterfall z przykładowymi danymi. `POST /portfolio/prioritize` z NPV/ryzykiem z SAMPLE_INITIATIVES. Brak crash. Panel widoczny z danymi demonstracyjnymi.

**Grafika**
Panel `ValueOfficePanel` z pełnymi wykresami zasilonymi SAMPLE_INITIATIVES. Brak informacji o braku inicjatyw — panel wygląda jak z realnymi danymi (potencjalny UX gap: brak disclaimeru „dane przykładowe"). Waterfall: 4 kroki (Automatyzacja, Konsolidacja, Optymalizacja, Nowy kanał). PortfolioBubble: 4 bąble.

**Funkcjonalność**
`ValueOfficePanel.tsx` (`effectiveInitiatives = useMemo(() => (initiatives?.length > 0 ? initiatives : SAMPLE_INITIATIVES), [initiatives])`, `SAMPLE_INITIATIVES` constant), brak props `initiatives` z `FinanceHub`.

---

# F. Driver Planner What-If

---

### MC-16M-26 · Domyślne drzewo SaaS — Przychód = Klienci × ARPU · [FLAG]

**Co się dzieje**
Konsultant VTS Group aktywuje flagę `ff_driverPlanner=1` (URL `/finance?tab=models&ff_driverPlanner=1`). Pod tabelą modeli pojawia się `DriverPlannerPanel`. Bez przekazanego prop `driverTree` — panel używa `DEFAULT_TREE`: root „Przychód" (multiply, PLN) z dwoma liśćmi: „Klienci" (wartość domyślna: 1200 szt.) i „ARPU" (240 zł). Wizualizacja drzewa (`DriverTreeViz`) pokazuje: węzeł root z wartością obliczoną `evalTree = 1200 × 240 = 288 000 zł`, dwa węzły liści z ich wartościami, symbol operacji `×` między nimi. Konsultant weryfikuje matematykę: 1200 × 240 = 288 000 zł.

**Efekty pracy**
Brak żądania API (Driver Planner = czysto kliencki, komentarz: „pure client-side computation (no API)"). `DEFAULT_TREE` → `evalTree(DEFAULT_TREE, {})` = 288 000. `DriverTreeViz` wyrenderowany rekurencyjnie. `overrides = {}` (suwaki w pozycji domyślnej). `formatValue(288000) = "288,0 tys."` (defaultFormat). Flaga OFF → panel niewidoczny, zero żądań.

**Grafika**
`DriverPlannerPanel` — nagłówek „Driver-based planning" lub analogiczny. `DriverTreeViz`: węzeł root (niebieskie tło indigo dla gałęzi, `border-indigo-200 bg-indigo-50`) z „Przychód" i obliczoną wartością „288,0 tys. zł". Dwa węzły liści (białe tło) z „Klienci: 1 200 szt." i „ARPU: 240 zł". Symbol `×` (`OP_SYMBOL.multiply`) między liśćmi. `data-testid="driver-tree-node"` dla testów.

**Funkcjonalność**
`DriverPlannerPanel.tsx` (`DEFAULT_TREE`, `DriverTreeViz`, `evalTree`, `collectLeaves`, `defaultFormat`), `FinanceHub.tsx` (`isFinanceFlagEnabled('driverPlanner')` → `<DriverPlannerPanel />`), `financeFeatureFlags.ts` (`FLAGS.driverPlanner.query = 'ff_driverPlanner'`).

---

### MC-16M-27 · Suwak what-if — aktualizacja wartości w czasie rzeczywistym (bez API) · [FLAG]

**Co się dzieje**
Konsultant Elkomtech konfiguruje scenariusz wzrostu: chce zobaczyć jak zmiana liczby klientów wpłynie na przychód. Z aktywną flagą `ff_driverPlanner=1` i domyślnym drzewem SaaS widzi suwaki dla każdego liścia. Przesuwa suwak „Klienci" z 1200 na 2500 (max: 5000, step: 50). Wartość root „Przychód" natychmiastowo przelicza się: 2500 × 240 = 600 000 zł = „600,0 tys. zł". Przesuwa ARPU z 240 na 300 (max: 1000, step: 10): 2500 × 300 = 750 000 zł = „750,0 tys. zł". Konsultant weryfikuje w Network — ZERO żądań HTTP przy przesuwaniu suwaka.

**Efekty pracy**
`overrides` state: każdy suwak → `setOverrides(prev => ({ ...prev, [leafId]: newValue }))`. `evalTree(driverTree, overrides)` przelicza się synchronicznie per `onChange` suwaka. Brak `useEffect` na `overrides`, brak fetch. Root węzeł pokazuje nową wartość natychmiast. `formatValue` = `defaultFormat` lub prop `formatValue`. Precyzja: `evalTree` zwraca `null` tylko gdy wartość liścia nieskończona — w domyślnym przykładzie zawsze skończona.

**Grafika**
Suwaki HTML `<input type="range">` dla każdego liścia drzewa, pod węzłem liścia (lub w oddzielnej sekcji sliders). Etykieta wartości suwaka aktualizuje się na bieżąco (`value={overrides[node.id] ?? node.value}`). Root węzeł `DriverTreeViz` — wartość monospace zmienia się przy każdym ruchu suwaka. Brak loaderów, brak opóźnienia.

**Funkcjonalność**
`DriverPlannerPanel.tsx` (`overrides` state = `Record<string, number>`, suwak `onChange` → `setOverrides`, `evalTree(driverTree, overrides)` w `DriverTreeViz`), `collectLeaves` (lista liści do suwaka), `evalTree` (rekurencyjna ewaluacja z overrides).

---

### MC-16M-28 · Własne drzewo sterowników — prop driverTree · [FLAG]

**Co się dzieje**
Deweloper wstrzykuje własne drzewo sterowników do `DriverPlannerPanel` (prop `driverTree`) — np. dla modelu przemysłowego Apator: root „Przychód" (add) = „Sprzęt pomiarowy" (600k) + „Serwis i utrzymanie" (200k) + „Oprogramowanie" (150k). Konsultant sprawdza w UI, że węzeł root oblicza się poprawnie: 600k + 200k + 150k = 950k (op: `add`). Weryfikuje `OP_SYMBOL.add = '+'` między węzłami. Następnie przesuwa suwak „Sprzęt pomiarowy" do 800k → root = 1 150k. Sprawdza, że `evalTree` z `op: 'add'` używa `APPLY.add = (acc, v) => acc + v` (akumulacja addytywna, init = 0, dla add `acc + v`).

**Efekty pracy**
`driverTree` prop niepusty → `DEFAULT_TREE` pominięty (`driverTree ?? DEFAULT_TREE`). `evalTree` z op `'add'`: init = 0, iteracja: `0 + 600k = 600k → 600k + 200k = 800k → 800k + 150k = 950k`. Wynik = 950k. Po suwaku 800k: `800k + 200k + 150k = 1150k`. Brak żądań API. Walidacja fail-soft: jeśli `driverTree` ma błędną strukturę (null child) → `evalTree` zwraca `null` → węzeł pokazuje „—".

**Grafika**
Drzewo z trzema liśćmi (addytywne). Symbol `+` (`OP_SYMBOL.add`) między węzłami w `DriverTreeViz`. Root węzeł z łączną wartością. Suwaki dla trzech liści (min/max/step zdefiniowane lub domyślne). Węzły liści: białe tło, węzeł branch: indigo.

**Funkcjonalność**
`DriverPlannerPanel.tsx` (`driverTree` prop, `const root = driverTree ?? DEFAULT_TREE`, `evalTree` z `APPLY.add`), `DriverTreeVizProps`, `collectLeaves` per custom tree.

---

### MC-16M-29 · Fan scenariuszy — base / optimistic / conservative · [FLAG]

**Co się dzieje**
Konsultant VTS Group chce porównać trzy ścieżki wzrostu na jednym widoku. Liście drzewa `DEFAULT_TREE` mają pole `scenario: { optimistic: 1.25, conservative: 0.75 }` (Klienci) i `scenario: { optimistic: 1.15, conservative: 0.85 }` (ARPU). `DriverPlannerPanel` oblicza warianty: (1) **base**: 1200 × 240 = 288k, (2) **optimistic**: (1200×1.25) × (240×1.15) = 1500 × 276 = 414k, (3) **conservative**: (1200×0.75) × (240×0.85) = 900 × 204 = 183,6k. Konsultant weryfikuje, że fan scenariuszy (pasek lub trzy wartości) jest widoczny w panelu i że wartości zgadzają się matematycznie.

**Efekty pracy**
`scenarioFan = useMemo`: dla każdego scenariusza `['base', 'optimistic', 'conservative']` oblicza `evalTree` z `overrides` zmodyfikowanymi przez multiplikatory `scenario.*`. Base: `overrides` bez zmian. Optimistic: `overrides` z każdym liściem × `scenario.optimistic`. Conservative: × `scenario.conservative`. Wynik: `{ base: 288000, optimistic: 414000, conservative: 183600 }`. Fan nie zależy od API.

**Grafika**
Sekcja fan scenariuszy w panelu: trzy wartości (Base: 288k / Optimistic: 414k / Conservative: 183,6k) lub wykres słupkowy/liniowy z trzema liniami. Kolory: base = niebieski, optimistic = zielony, conservative = bursztyn/szary. Aktualizacja na żywo przy zmianie suwaka (fan przelicza z nowymi `overrides`).

**Funkcjonalność**
`DriverPlannerPanel.tsx` (`DriverNode.scenario` field, `scenarioFan` useMemo iterujący scenariusze, `evalTree` z overrides×multiplier), `collectLeaves` (dostęp do `node.scenario`).

---

### MC-16M-30 · Wykres tornadowy — analiza wrażliwości · [FLAG]

**Co się dzieje**
Konsultant Elkomtech chce zidentyfikować, który sterownik ma największy wpływ na wynik (do czego warto przykładać uwagę w negocjacjach). `DriverPlannerPanel` renderuje `TornadoChart` gdy dostępne dane wrażliwości. Dla każdego liścia drzewa oblicza: wartość bazowa root, wartość root gdy liść = `min`, wartość root gdy liść = `max`. Sterownik „Klienci" (min=0, max=5000): wpływ = `evalTree(DEFAULT_TREE, { customers: 5000 }) - evalTree(DEFAULT_TREE, { customers: 0 })` = 5000×240 - 0 = 1 200 000 zł. Sterownik „ARPU" (min=0, max=1000): wpływ = 1200×1000 - 0 = 1 200 000 zł. `TornadoChart` sortuje słupki od największego wpływu do najmniejszego.

**Efekty pracy**
`TornadoChart` wyrenderowany z danymi wrażliwości (`sensitivityData` prop). Każdy liść drzewa = jeden słupek: `{ driverId, label, low, high, baseValue }`. `low = evalTree(tree, { [id]: min })`, `high = evalTree(tree, { [id]: max })`. Posortowane wg `(high - low)` malejąco. Brak żądań API (czysto klienckie). Zmiana suwaka → wartość bazowa w tooltipie tornacha aktualizuje się.

**Grafika**
`TornadoChart` — poziome pary słupków (low/high) dla każdego sterownika, posortowane od największego zakresu do najmniejszego. Oś Y = nazwy sterowników. Oś X = wartości root. Linia bazowa (bieżący stan suwaka). Słupek low: czerwony/ciemny; high: zielony/jasny. Etykiety wartości na końcach słupków (`fmtMoney` lub `defaultFormat`). Sekcja z nagłówkiem „Analiza wrażliwości" lub „Tornado Chart".

**Funkcjonalność**
`DriverPlannerPanel.tsx` (`TornadoChart` z `@/components/Economics/charts`, `sensitivityData` useMemo dla każdego liścia z `collectLeaves`, `evalTree` przy min/max każdego), `charts/TornadoChart`.

---

## Macierz pokrycia funkcji → case'y

| Obszar funkcji | Case'y |
|---|---|
| Tworzenie modelu — manual/statement/assumptions | MC-16M-01, 02, 03 |
| Granularność / waluta / metadane | MC-16M-04, 05, 06 |
| Generacja outputów P&L/BS/CF | MC-16M-07, 08, 10 |
| Warianty base/optimistic/conservative | MC-16M-09 |
| isEstimated — dane szacunkowe vs serwer | MC-16M-11 |
| Persystencja outputów po hard-refresh | MC-16M-12 |
| Historia wersji (za flagą modelVersioning) | MC-16M-13, 14, 15, 16 |
| Linkowanie inicjatyw — Unlinked badge | MC-16M-17 |
| POST economics-links / GET economics-links | MC-16M-18, 19 |
| Bezpieczeństwo 401 | MC-16M-20 |
| ValueOfficePanel — aktywacja flagi | MC-16M-21 |
| Waterfall most wartości | MC-16M-22 |
| Portfolio bubble kwadranty | MC-16M-23 |
| Fail-soft błąd API | MC-16M-24 |
| Dane przykładowe SAMPLE_INITIATIVES | MC-16M-25 |
| DriverPlannerPanel — drzewo SaaS domyślne | MC-16M-26 |
| What-if suwaki (bez API) | MC-16M-27 |
| Własne drzewo sterowników | MC-16M-28 |
| Fan scenariuszy base/optimistic/conservative | MC-16M-29 |
| Tornado Chart wrażliwości | MC-16M-30 |

---

## Uwagi metodyczne

- **Weryfikacja sieci (każdy case [V8]):** otwórz DevTools → Network przed akcją, filtruj `/api/v8/finance/`, zweryfikuj endpoint + status HTTP + kluczowe pola odpowiedzi (id, status, grouped, versions, data).
- **Hard-refresh (każdy case [DB]):** `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac) → dane muszą być identyczne z poprzednim stanem. Zmiana bez hard-refresh = konieczna, ale niewystarczająca.
- **Flagi (każdy case [FLAG]):** priorytet URL query > localStorage > env. Testuj oba sposoby aktywacji (URL param i `localStorage.setItem('ff.<key>', '1')`). Po localStorage — wymagany reload.
- **Fallback legacy:** `CreateModelModal`, `useFinanceRowActions` mają fallback do `/api/financial-modeling/models` gdy `shouldFallbackToLegacyFinance(error)`. Jeśli V8 niedostępny — sprawdź czy fallback działa (status 200 z legacy) i odnotuj.
- **Cross-module [CROSS-MODULE]:** linki inicjatyw (D-seria) dotykają M14 (Wdrożenie/ExecutionHub) i M15 (Rezultaty). Po wykonaniu MC-16M-18 — przejdź do M14 i M15 i potwierdź widoczność powiązania.
- **Driver Planner bez API:** Wszystkie case'y F-serii (MC-16M-26…30) NIE generują żądań HTTP przy interakcji. Weryfikuj Network → zero żądań przy suwaku. Jedyne żądania to `GET /models` przy ładowaniu strony.
- **Realistyczne dane:** używaj nazw VTS Group / Apator / Elkomtech i konkretnych kwot (288k zł, 1,2 mln, 36 miesięcy) zamiast ogólnych przykładów — to zwiększa wykrywalność błędów formatowania i lokalizacji.

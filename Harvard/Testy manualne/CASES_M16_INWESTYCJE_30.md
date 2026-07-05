# CASES — M16 Finanse · Zakładka Investment (Analiza inwestycyjna) · 30 bogatych case'ów testowych

> **Moduł:** M16 Finanse (`/finance?tab=investment`)
> **Główny plik:** `src/components/Economics/FinanceHub.tsx` (~2428 lin.) + `src/components/Economics/panels/InvestmentAppraisalPanel.tsx`
> **Backend:** `server/src/routes/v8/financeValueRoutes.ts` + `server/src/services/investmentAppraisalService.ts`
> **Cel paczki:** 30 realistycznych scenariuszy pracy konsultanta eksploatujących zakładkę Investment — przegląd analiz, aktywację panelu wyceny, wszystkie trzy werdykty (go/conditional/no-go), edycję przepływów, fail-soft i edge case'y matematyczne.
> **Data:** 2026-06-25
> **Autor:** sesja projektowa (czytanie kodu + weryfikacja numeryczna logiki `appraise()`)

---

## Legenda znaczników

- **[V8]** — wywołanie endpointu V8: `POST /api/v8/finance/value/appraise` (odpowiedź `{ data: { npv, irr, mirr, payback, discountedPayback, pi, verdict }, meta }`).
- **[FLAG]** — wymaga aktywacji flagi `investmentAppraisal` (URL query `?ff_investAppraisal=1` lub `localStorage ff.fin_invest_appraisal=1`).
- **[DB]** — analiza persystowana w tabeli finance (tworzenie/odczyt rekordów `financial_analysis`).
- **[NPV]** — scenariusz z dokładnymi wyliczeniami NPV/IRR/PI według algorytmów w `investmentAppraisalService.ts`.
- **[IRR]** — scenariusz weryfikujący IRR lub jego brak (null — nie ma rozwiązania bisekcji).

**Zasada E2E (każdy case z API):** każde kliknięcie „Oblicz" → `POST /api/v8/finance/value/appraise` z `{ cashFlows, discountRate, hurdleRatePct }` → 200 + `{ data: { npv, irr, mirr, payback, discountedPayback, pi, verdict } }`. Odpowiedź bez wcześniejszego żądania = FAIL.

**Zasada werdyktu (według `investmentAppraisalService.ts:269`):**
- `no-go`: NPV < 0 LUB PI < 1
- `go`: NPV > 0 ORAZ PI > 1 ORAZ IRR ≠ null ORAZ IRR > hurdleRate
- `conditional`: wszystko inne (NPV ≥ 0 i PI ≥ 1, ale IRR = null lub IRR ≤ hurdle)

---

## Spis 30 case'ów

### A. Investment tab — przegląd (MC-16I-01 … MC-16I-04)
- **MC-16I-01** · Zakładka Investment wyświetla tylko analizy typu inwestycyjnego
- **MC-16I-02** · Pusta zakładka Investment — stan zero danych z CTA
- **MC-16I-03** · Tworzenie analizy inwestycyjnej przez modal — defaultowy typ `investment_case`
- **MC-16I-04** · Filtrowanie typów investment_case vs capex vs financial

### B. Appraisal Panel — aktywacja (MC-16I-05 … MC-16I-08)
- **MC-16I-05** · Aktywacja flagi `investmentAppraisal` przez URL query — panel pojawia się
- **MC-16I-06** · Aktywacja flagi przez localStorage — panel trwa po reloadzie
- **MC-16I-07** · Panel wyświetla pola inputowe i przycisk „Oblicz" w stanie gotowości
- **MC-16I-08** · Flaga OFF — panel niewidoczny, zakładka działa normalnie

### C. Werdykt „Go" — opłacalny projekt (MC-16I-09 … MC-16I-14)
- **MC-16I-09** · Klasyczny go: nakład 100 000, przepływy 4×40 000, stopa 10% — NPV ≈ 26 795 PLN
- **MC-16I-10** · Weryfikacja payloadu Network: cashFlows, discountRate, hurdleRatePct w ciele POST
- **MC-16I-11** · Wszystkie 6 metryk wyświetlone: NPV, IRR, MIRR, Payback, Disc.Payback, PI
- **MC-16I-12** · Krótki payback: nakład 50 000, przepływy 3×30 000 → payback 1,67 lat
- **MC-16I-13** · Wysoki IRR (>30%): nakład 100 000, przepływy 2×80 000 → IRR ≈ 37,98%
- **MC-16I-14** · Wieloletnie przepływy zmienne (5 lat): nakład 200 000, przepływy zróżnicowane

### D. Werdykt „No-go" — nieopłacalny projekt (MC-16I-15 … MC-16I-19)
- **MC-16I-15** · Klasyczny no-go: nakład 1 000 000, przepływy 2×10 000, stopa 15%
- **MC-16I-16** · IRR nieistniejące (null): przepływy monotonnie ujemne po T0
- **MC-16I-17** · Payback nieskończony: nakład nie zwraca się w horyzoncie 5 lat
- **MC-16I-18** · PI < 1 — projekt niszczy wartość przy niskich przepływach
- **MC-16I-19** · Zero błędów w konsoli przy werdykcie no-go

### E. Werdykt „Conditional" — warunkowo opłacalny (MC-16I-20 … MC-16I-22)
- **MC-16I-20** · Conditional przy IRR null: niemonotoniczne przepływy — NPV > 0 i PI > 1, ale brak IRR
- **MC-16I-21** · Badge conditional — kolor bursztynowy, tekst „Warunkowo (conditional)"
- **MC-16I-22** · Zmiana stopy dyskontowej nie zmienia werdyktu conditional gdy IRR = null

### F. Edycja cashflows i UX (MC-16I-23 … MC-16I-27)
- **MC-16I-23** · Dodaj okres (+) → nowy wiersz przepływu, brak żądania API
- **MC-16I-24** · Usuń okres (×) → wiersz znika, minimalna liczba 2 wierszy
- **MC-16I-25** · Edycja nakładu → poprzedni wynik znika (stan czysty, stale data nie wyświetlana)
- **MC-16I-26** · Wartość nienumeryczna w polu nakładu → input nie propaguje NaN do API
- **MC-16I-27** · Stopa dyskontowa = domyślna 10% wpisana jest w pole przy otwarciu panelu

### G. Fail-soft i edge case'y (MC-16I-28 … MC-16I-30)
- **MC-16I-28** · Zablokowanie POST /appraise w DevTools → `appraise-failed` notice (brak crash)
- **MC-16I-29** · Bardzo duże przepływy (miliardy) → brak overflow w wyświetleniu wyników
- **MC-16I-30** · Stopa dyskontowa 0% → NPV = prosta suma przepływów minus nakład; IRR obliczona

---

# A. Investment tab — przegląd

---

### MC-16I-01 · Zakładka Investment wyświetla tylko analizy inwestycyjne · [DB] [V8]

**Co się dzieje**
Konsultant pracujący nad oceną projektów inwestycyjnych dla Apator przechodzi do modułu Finanse (`/finance`) i klika zakładkę „Investment analysis". W organizacji istnieje 5 analiz: 2 z `analysisType = 'comprehensive'` (zakładka Analysis), 1 z `analysisType = 'investment_case'`, 1 z `analysisType = 'capex'`, 1 z `analysisType = 'investment'`. Zakładka Investment powinna pokazać dokładnie 3 ostatnie rekordy. Konsultant weryfikuje listę i upewnia się, że żadna analiza typu `comprehensive` nie jest widoczna — sprawdza nazwy w tabeli i porównuje z zakładką Analysis.

**Efekty pracy**
Lista rekordów przefiltrowana przez `isInvestmentAnalysisType()` (FinanceHub.tsx:118): `normalized === 'investment_case' || normalized === 'investment' || normalized === 'capex' || normalized.includes('investment') || normalized.includes('capex')`. Zakładka Analysis zawiera te same 5 rekordów (brak filtra), Investment — 3. `GET /api/v8/finance/analyses` (lub legacy endpoint) zwraca wszystkie, filtr po stronie klienta. Reload → filtrowanie stabilne.

**Grafika**
Zakładka „Investment analysis" aktywna w górnej belce zakładek (`ModuleTab`). Tabela rekordów z kolumnami: nazwa, typ, waluta, liczba okresów, data. Rekordy typu `investment_case` i `capex` widoczne; `comprehensive` — niewidoczne. Stan zakładki z aktywnym podkreśleniem.

**Funkcjonalność**
`FinanceHub.tsx`: `isInvestmentAnalysisType()` (lin. 118-128), filtrowanie `filteredRows` (lin. 798), zakładka `investment` w tablicy `TABS` (lin. 794). Backend: `GET` endpoint dla analiz finansowych. Filtr kliencki, nie serwerowy.

---

### MC-16I-02 · Pusta zakładka Investment — stan zero danych z CTA · [DB]

**Co się dzieje**
Konsultant zakłada świeże konto w nowej organizacji i jako pierwszy wchodzi na zakładkę Investment. W bazie nie ma żadnych analiz z typem inwestycyjnym. Zakładka powinna wyświetlić pusty stan (empty state) z tytułem „Investment analysis workspace", opisem o NPV/IRR/payback/ROI oraz przyciskiem CTA „+ New investment case". Konsultant czyta komunikat, rozumie cel zakładki i klika CTA, który otwiera modal tworzenia analizy.

**Efekty pracy**
Stan pusty renderowany z `filteredRows.length === 0` i `activeTab === 'investment'` (FinanceHub.tsx:1997). Tekst i18n `finance.investment.emptyTitle` = „Investment analysis workspace", `finance.investment.emptyBody` = „Use this tab for initiative-level investment cases and go/no-go decisions based on NPV, IRR, payback, and ROI." (lin. 2008-2029). Klik CTA → modal `CreateAnalysisModal` otwiera się. Brak żądań API do `/appraise` na pustym stanie.

**Grafika**
Pusty stan: ikona lub ilustracja centralna, tytuł bold, akapit opisowy, przycisk CTA niebieski „+ New investment case". Tabela niewidoczna. Belka zakładek nad pustym stanem. Hint wskazuje na tworzenie case study NPV/IRR/payback/ROI (FinanceHub.tsx:2028-2029).

**Funkcjonalność**
`FinanceHub.tsx`: blok empty state (lin. 1997-2036), `t('finance.investment.emptyTitle')`, `t('finance.cta.newInvestment', '+ New investment case')` (lin. 1172). `CreateAnalysisModal` otwierany przez CTA. Brak wywołań `InvestmentAppraisalPanel` na pustym stanie.

---

### MC-16I-03 · Tworzenie analizy inwestycyjnej przez modal — defaultowy typ `investment_case` · [DB]

**Co się dzieje**
Konsultant przygotowuje analizę wykonalności dla projektu wdrożenia systemu ERP w VTS Group. Klika „+ New investment case" w zakładce Investment. Otwiera się modal `CreateAnalysisModal`. Konsultant sprawdza, że pole `analysisType` domyślnie wskazuje `investment_case` (FinanceHub.tsx:2354 — `defaultAnalysisType={activeTab === 'investment' ? 'investment_case' : 'comprehensive'}`). Wpisuje nazwę „Wdrożenie SAP S/4HANA — feasibility", wybiera walutę PLN, horyzont 5 lat. Klika „Utwórz" — analiza pojawia się w tabeli zakładki Investment.

**Efekty pracy**
`POST /api/finance/analyses` (lub V8 odpowiednik) z `analysisType: 'investment_case'` → 201, nowy rekord w tabeli. Lista odświeżona: nowa analiza widoczna w Investment tab. Rekord z `analysis_type = 'investment_case'` zwrócony przez `isInvestmentAnalysisType()` = true. W zakładce Analysis rekord TAKŻE widoczny (brak wykluczenia). Reload → rekord przetrwa.

**Grafika**
Modal `CreateAnalysisModal` z polem nazwy, selektorem typu (domyślnie `investment_case`), waluty, horyzontu. Przycisk „Utwórz" / „Create". Toast sukcesu po zapisie. Nowa analiza pojawia się w tabeli zakładki Investment z ikoną lub badge `investment_case`.

**Funkcjonalność**
`FinanceHub.tsx`: `defaultAnalysisType` prop (lin. 2354), `createAnalysis` handler (lin. 564), `targetTab = 'investment'` (lin. 569). `CreateAnalysisModal.tsx` — modal tworzenia. Backend: endpoint tworzenia analizy. `isInvestmentAnalysisType()` filtruje po zapisie.

---

### MC-16I-04 · Filtrowanie typów investment_case vs capex w zakładce Investment · [DB]

**Co się dzieje**
Konsultant przegląda portfel inwestycyjny złożony z różnych typów: projekt IT (typ `investment_case`), zakup linii produkcyjnej (typ `capex`), ogólna analiza finansowa (typ `financial`). Wchodzi do zakładki Investment. Oczekuje widoku obu typów inwestycyjnych — `investment_case` i `capex` — razem. Następnie przechodzi do zakładki Analysis, gdzie widzi wszystkie analizy bez wyjątku. Weryfikuje, że `capex` jest wykryty przez `normalized.includes('capex')` w funkcji `isInvestmentAnalysisType`.

**Efekty pracy**
`isInvestmentAnalysisType('capex')` = true (lin. 126-128). `isInvestmentAnalysisType('financial')` = false (nie spełnia żadnego warunku). Zakładka Investment: 2 rekordy (IT + capex). Zakładka Analysis: 3 rekordy (wszystkie). Żadne żądanie API nie jest filtrowane — filtr kliencki na `analysisType || analysis_type`.

**Grafika**
Tabela zakładki Investment z dwoma rekordami: kolumna `analysisType` pokazuje `investment_case` i `capex` odpowiednio. Zakładka Analysis z trzema rekordami w tym `financial`. Różnica typów widoczna w kolumnie bez żadnego badge'a błędu.

**Funkcjonalność**
`FinanceHub.tsx`: `isInvestmentAnalysisType()` (lin. 118-128), filtrowanie w `filteredRows` (lin. 798: `isInvestmentAnalysisType(row.analysisType || row.analysis_type)`). Typy weryfikowane: `'financial'|'investment_case'|'investment'|'capex'` i zawierające `'investment'` lub `'capex'`.

---

# B. Appraisal Panel — aktywacja

---

### MC-16I-05 · Aktywacja flagi `investmentAppraisal` przez URL query — panel pojawia się · [FLAG]

**Co się dzieje**
Konsultant chce przetestować nową funkcję analizy inwestycyjnej. Otwiera zakładkę Investment bez żadnego parametru — panel `InvestmentAppraisalPanel` niewidoczny (flaga domyślnie OFF). Następnie dodaje do URL parametr `?ff_investAppraisal=1` (zgodnie z `financeFeatureFlags.ts`: `query: 'ff_investAppraisal'`). Strona się przeładowuje. Konsultant weryfikuje, że pod tabelą analiz pojawia się panel „Analiza inwestycyjna (NPV/IRR/payback)" z polami inputowymi i przyciskiem „Oblicz".

**Efekty pracy**
`isFinanceFlagEnabled('investmentAppraisal')` = true przez `readQuery('ff_investAppraisal')` → zwraca true (FinanceHub.tsx:111, financeFeatureFlags.ts:19-24). Panel `InvestmentAppraisalPanel` renderowany w bloku `{isFinanceFlagEnabled('investmentAppraisal') && <div className="px-6 pb-6"><InvestmentAppraisalPanel /></div>}` (lin. 2036-2037). Flaga aktywna TYLKO na tej sesji URL; inny tab bez query → panel niewidoczny. Brak zmian w bazie danych — flaga czysto kliencka.

**Grafika**
Bez flagi: zakładka Investment z tabelą, brak panelu poniżej. Z flagą: pod tabelą nowy panel z białym tłem, zaokrągloną ramką, nagłówkiem „Analiza inwestycyjna (NPV/IRR/payback)", opisem instrukcji, polami T0 i przepływów, stopą dyskontową, przyciskiem „Oblicz". Element `data-testid="investment-appraisal-panel"` obecny w DOM.

**Funkcjonalność**
`financeFeatureFlags.ts`: `isFinanceFlagEnabled()` (eksport), `readQuery('ff_investAppraisal')`, `parseFlag()`. `FinanceHub.tsx`: warunkowy render `isFinanceFlagEnabled('investmentAppraisal')` (lin. 2036, 2109). `InvestmentAppraisalPanel.tsx` — renderowany komponent.

---

### MC-16I-06 · Aktywacja flagi przez localStorage — panel trwa po reloadzie · [FLAG]

**Co się dzieje**
Konsultant konfiguruje środowisko testowe i chce, by panel `InvestmentAppraisalPanel` był dostępny po każdym odświeżeniu, bez konieczności wpisywania query w URL. Otwiera DevTools → Application → Local Storage → ustawia klucz `ff.fin_invest_appraisal` na wartość `1`. Przeładowuje stronę. Panel pojawia się. Konsultant zamyka DevTools, czyści pasek URL z parametrów i przeładowuje jeszcze raz — panel nadal widoczny (localStorage działa po usunięciu query). Usuwa klucz z localStorage → po przeładowaniu panel znika.

**Efekty pracy**
`isFinanceFlagEnabled('investmentAppraisal')`: `readQuery()` zwraca null (brak query) → `readLocalStorage('ff.fin_invest_appraisal')` zwraca true. Panel widoczny. Kolejność rozwiązania flag (financeFeatureFlags.ts:77-87): URL query > localStorage > env. Usunięcie z localStorage → powrót do false. Brak żadnych żądań API przy samej aktywacji flagi.

**Grafika**
DevTools Local Storage z kluczem `ff.fin_invest_appraisal = 1`. Po przeładowaniu panel widoczny bez query w URL. Po usunięciu klucza → panel znika. Identyczna wizualnie jak MC-16I-05.

**Funkcjonalność**
`financeFeatureFlags.ts`: `readLocalStorage('ff.fin_invest_appraisal')` (lin. ~60), `parseFlag()` — akceptuje `'1'|'true'|'on'|'yes'`. Kolejność: URL → localStorage → env (VITE_FIN_INVEST_APPRAISAL_ENABLED). Trwałość flag przez LocalStorage.

---

### MC-16I-07 · Panel wyświetla pola inputowe i przycisk „Oblicz" w stanie gotowości · [FLAG]

**Co się dzieje**
Konsultant (z aktywną flagą `?ff_investAppraisal=1`) otwiera zakładkę Investment. Panel `InvestmentAppraisalPanel` renderuje się z domyślnym zestawem przepływów (`DEFAULT_CASHFLOWS = [-1000, 400, 400, 400, 400]` — InvestmentAppraisalPanel.tsx:55). Konsultant przegląda interfejs: widzi pole T0 (nakład) z wartością -1000, cztery pola „Rok 1–4" z wartościami 400, pole „Stopa dyskontowa (%)" z wartością 10, przycisk „Oblicz" niebieski i aktywny. Weryfikuje `data-testid` atrybuty obecne w DOM: `investment-appraisal-panel`, `appraise-cashflows`, `appraise-compute`. Żadne żądanie API nie leci w fazie inicjalnej (przed kliknięciem „Oblicz").

**Efekty pracy**
Stan startowy panelu: `cashflows = [-1000, 400, 400, 400, 400]`, `discountRate = 10`, `result = null`, `loading = false`, `failed = false`. Sekcja wyników (`appraise-verdict`, `appraise-metrics`, `appraise-npv`) niewidoczna — wymagane kliknięcie „Oblicz". Network: zero żądań do `/appraise` na samym renderze. Przycisk nie ma `disabled` (loading=false).

**Grafika**
Panel z sekcją input: pole T0 z `aria-label="Nakład początkowy"`, pola `aria-label="Przepływ rok N"` dla lat 1-4, przycisk „+ okres" (dashed border), pole stopy dyskontowej, przycisk „Oblicz" (niebieski, `bg-blue-600`). Brak sekcji wyników w DOM (conditional render `{!failed && result && ...}`). Napis pod nagłówkiem: „Wprowadź przepływy pieniężne (pierwszy ujemny = nakład początkowy) i stopę dyskontową."

**Funkcjonalność**
`InvestmentAppraisalPanel.tsx`: `useState(DEFAULT_CASHFLOWS)` (lin. 97-98), `useState(10)` dla discountRate (lin. 100-101), `useState(null)` dla result. DOM: `data-testid="investment-appraisal-panel"` (lin. 173), `data-testid="appraise-cashflows"` (lin. 176), `data-testid="appraise-compute"` (lin. 215). Inicjalizacja prop `initialCashFlows`/`discountRatePct` gdy przekazane.

---

### MC-16I-08 · Flaga OFF — panel niewidoczny, zakładka działa normalnie · [FLAG]

**Co się dzieje**
Konsultant sprawdza, że wyłączona flaga nie degraduje działania zakładki. Upewnia się, że URL nie zawiera `?ff_investAppraisal=1` i że localStorage nie ma klucza `ff.fin_invest_appraisal`. Otwiera `/finance?tab=investment`. Zakładka działa normalnie: tabela analiz widoczna, tworzenie analiz dostępne, filtrowanie typów działa. Panel `InvestmentAppraisalPanel` nieobecny w DOM (warunkowy render). Scroll do dołu strony potwierdza brak panelu. Konsultant sprawdza w DevTools → Elements, że `data-testid="investment-appraisal-panel"` nie istnieje w DOM.

**Efekty pracy**
`isFinanceFlagEnabled('investmentAppraisal')` = false → blok `{isFinanceFlagEnabled('investmentAppraisal') && ...}` (lin. 2036) nie renderuje nic. Tabela, CTA i modal tworzenia działają bez zmian. Brak żądań do `POST /api/v8/finance/value/appraise` (panel nie istnieje). Wydajność niezmieniona.

**Grafika**
Zakładka Investment: tabela analiz + empty state (jeśli brak danych) + CTA. Brak panelu pod tabelą. DOM: element `investment-appraisal-panel` nieobecny (`querySelector('[data-testid="investment-appraisal-panel"]')` → null).

**Funkcjonalność**
`financeFeatureFlags.ts`: `isFinanceFlagEnabled()` = false gdy brak query, localStorage, env. `FinanceHub.tsx`: oba bloki warunkowe (lin. 2036, 2109) zwracają null. Brak import side-effectów `InvestmentAppraisalPanel` na UI.

---

# C. Werdykt „Go" — opłacalny projekt

---

### MC-16I-09 · Klasyczny Go — nakład 100 000, przepływy 4×40 000, stopa 10% → NPV ≈ 26 795 PLN · [FLAG] [V8] [NPV]

**Co się dzieje**
Konsultant ocenia projekt modernizacji linii produkcyjnej dla klienta. Nakład początkowy: 100 000 PLN (pole T0: `-100000`). Przepływy roczne: rok 1–4: 40 000 PLN rocznie. Stopa dyskontowa: 10%. Klika „Oblicz". Server oblicza: NPV = 26 795 PLN, IRR = 21,86%, MIRR = 16,73%, Payback = 2,50 lat, Disc.Payback = 3,02 lat, PI = 1,268. Warunek werdyktu `go`: NPV > 0 ORAZ PI > 1 ORAZ IRR (21,86%) > hurdle (10%) — spełnione. Badge „Realizować (go)" pojawia się w kolorze zielonym.

**Efekty pracy**
`POST /api/v8/finance/value/appraise` → body: `{ cashFlows: [-100000, 40000, 40000, 40000, 40000], discountRate: 10, hurdleRatePct: 10 }` → 200 → `{ data: { npv: 26795, irr: 21.86, mirr: 16.73, payback: 2.50, discountedPayback: 3.02, pi: 1.268, verdict: 'go' }, meta: { version: 'v8', contract: 'finance_value_compute_v1' } }`. Panel zapisuje result w `useState`, renderuje sekcję wyników. Brak zapisu do bazy — endpoint pure-compute (financeValueRoutes.ts:104: „No DB access").

**Grafika**
Panel po obliczeniu: sekcja werdyktu z napisem „Werdykt:" i badge `data-testid="appraise-verdict"` — zielone tło `bg-emerald-100 text-emerald-700 border-emerald-200`, tekst „Realizować (go)". Siatka metryk (`appraise-metrics`) z 6 kafelkami: NPV `data-testid="appraise-npv"` = „26 795 PLN", IRR = „21,9%", MIRR = „16,7%", Payback = „2,5 lat", Disc. payback = „3,0 lat", PI = „1,27". BulletChart NPV vs próg 0 — słupek wyraźnie po prawej stronie zera.

**Funkcjonalność**
`InvestmentAppraisalPanel.tsx`: `compute()` (lin. ~155), `defaultFetcher()` → `Api.post('/v8/finance/value/appraise', ...)`, `setResult(res)`. `VERDICT_LABEL['go'] = 'Realizować (go)'`, `VERDICT_STYLE['go'] = 'bg-emerald-100...'`. `fmtMoney()`, `fmtPct()`, `fmtYears()` dla formatowania. `investmentAppraisalService.ts`: `appraise()` (lin. 269).

---

### MC-16I-10 · Weryfikacja payloadu Network — cashFlows, discountRate, hurdleRatePct · [FLAG] [V8]

**Co się dzieje**
Konsultant weryfikuje poprawność żądania wysyłanego do serwera. Otwiera DevTools → Network, filtruje po „appraise". Używa dowolnego scenariusza: nakład -80 000 PLN, przepływy rok 1: 50 000 PLN, rok 2: 50 000 PLN, stopa 12%. Klika „Oblicz". W zakładce Network klikam żądanie `POST /api/v8/finance/value/appraise` → zakładka Payload. Weryfikuje, że body JSON zawiera dokładnie: `cashFlows: [-80000, 50000, 50000]`, `discountRate: 12`, `hurdleRatePct: 12`. Sprawdza, że `hurdleRatePct` = `discountRate` (panel zawsze wysyła oba równe — InvestmentAppraisalPanel.tsx: `hurdleRatePct: discountRate`). Response headers: `Content-Type: application/json`.

**Efekty pracy**
`compute()` wywołuje `defaultFetcher({ cashFlows: [-80000, 50000, 50000], discountRate: 12, hurdleRatePct: 12 })` (InvestmentAppraisalPanel.tsx: `hurdleRatePct: discountRate`). `Api.post('/v8/finance/value/appraise', body)`. Router `financeValueRoutes.ts` odbiera: `cashFlows` z `req.body.cashFlows` (lin. 118-123), `discountRatePct = Number(req.body.discountRate)` = 12, `hurdleRatePct = Number(req.body.hurdleRatePct)` = 12. Serwer extrahuje CF[0]=-80000 jako `initialInvestment=80000` i `flows=[50000,50000]`. Response: NPV ≈ 6 777 PLN, IRR ≈ 14,49%, go.

**Grafika**
DevTools Network: request URL = `/api/v8/finance/value/appraise`, method POST, status 200. Payload tab: JSON z polami `cashFlows`, `discountRate`, `hurdleRatePct`. Response tab: `{ data: { npv, irr, mirr, payback, discountedPayback, pi, verdict }, meta: { version: 'v8', contract: 'finance_value_compute_v1' } }`.

**Funkcjonalność**
`InvestmentAppraisalPanel.tsx`: `compute()` (lin. ~155) → `fetcher({ cashFlows: cashflows, discountRate, hurdleRatePct: discountRate })`. `defaultFetcher()`: `Api.post('/v8/finance/value/appraise', req)`. `financeValueRoutes.ts`: odbiór body i przekazanie do `appraise()` (lin. 108-133). `V8_FINANCE_VALUE_CONTRACT = 'finance_value_compute_v1'` w meta.

---

### MC-16I-11 · Wszystkie 6 metryk wyświetlone po obliczeniu · [FLAG] [V8] [NPV]

**Co się dzieje**
Konsultant chce zobaczyć pełny profil inwestycji: nie tylko werdykt, ale każdą z sześciu metryk. Używa scenariusza: nakład 150 000 PLN, przepływy rok 1–4: 50 000 PLN rocznie, stopa 10%. Klika „Oblicz". Oczekuje, że panel wyświetli wszystkie 6 kafelków w siatce `appraise-metrics`: NPV, IRR, MIRR, Payback, Disc.Payback, PI. Każdy kafelek ma etykietę (uppercase, szary), wartość (bold, ciemna) i opis (hint, mały szary). Konsultant sprawdza obecność każdego elementu i poprawność jednostek (PLN dla NPV, % dla IRR/MIRR, „lat" dla payback).

**Efekty pracy**
Metryki obliczone: NPV ≈ 8 493 PLN (stopa 10%, 4×50k−150k), IRR ≈ 12,59%, MIRR ≈ 11,25%, Payback = 3,00 lat, Disc.Payback = 3,63 lat, PI ≈ 1,057. Tablica `metrics` (InvestmentAppraisalPanel.tsx:~165) zawiera 6 wpisów: `key: 'npv'|'irr'|'mirr'|'payback'|'discountedPayback'|'pi'`. `data-testid="appraise-metrics"` zawiera siatkę 6 kafelków. `data-testid="appraise-npv"` obecny na kafelku NPV.

**Grafika**
Siatka `grid-cols-2 sm:grid-cols-3` z 6 kafelkami szarego tła `bg-gray-50`. Każdy kafelek: etykieta `text-[10px] font-semibold uppercase tracking-wide text-gray-400`, wartość `text-sm font-semibold text-gray-900`, opis `text-[10px] text-gray-400`. NPV: „8 493 PLN" lub formatowanie `Intl.NumberFormat('pl-PL')`. IRR: „12,6%". MIRR: „11,2%". Payback: „3,0 lat". Disc. payback: „3,6 lat". PI: „1,06". BulletChart poniżej siatki.

**Funkcjonalność**
`InvestmentAppraisalPanel.tsx`: `useMemo(() => metrics, [result])` (lin. ~165), `fmtMoney(result.npv)`, `fmtPct(result.irr)`, `fmtPct(result.mirr)`, `fmtYears(result.payback)`, `fmtYears(result.discountedPayback)`, `result.pi.toFixed(2)`. Formatowanie pl-PL przez `Intl.NumberFormat`. `BulletChart` z `actual=npv`, `baseline=0`, `target=0`, `max=abs(npv)*1.2`.

---

### MC-16I-12 · Krótki payback — nakład 50 000, przepływy 3×30 000 → payback 1,67 lat · [FLAG] [V8] [NPV]

**Co się dzieje**
Konsultant analizuje projekt o szybkim zwrocie: zakup maszyny pakującej za 50 000 PLN, która przez 3 lata przyniesie 30 000 PLN rocznie. Wpisuje: T0 = -50 000, rok 1–3 = 30 000, stopa 10%. Klika „Oblicz". Oczekiwane wyniki: NPV ≈ 24 606 PLN, IRR ≈ 36,31%, MIRR ≈ 25,70%, Payback = 1,67 lat (nakład 50k zwraca się w 1 roku 30k + 0,67 × 30k drugiego roku), Disc.Payback = 1,92 lat, PI ≈ 1,492. Werdykt: „Realizować (go)" — NPV > 0, PI = 1,492 > 1, IRR = 36,31% > hurdle 10%. Konsultant odnotowuje, że Payback = 1,67 lat < 2 lata — dobry wskaźnik dla projektu o niskim ryzyku czasowym.

**Efekty pracy**
`POST /api/v8/finance/value/appraise` → `{ cashFlows: [-50000, 30000, 30000, 30000], discountRate: 10, hurdleRatePct: 10 }` → 200 → `{ npv: 24606, irr: 36.31, mirr: 25.70, payback: 1.67, discountedPayback: 1.92, pi: 1.492, verdict: 'go' }`. Payback liczony przez `payback([30000,30000,30000], 50000)`: po roku 1 kumulacja = 30 000 (niewystarczająca), po roku 2 kumulacja = 60 000 > 50 000; interpolacja: rok 1 + (50000-30000)/30000 = 1 + 0,667 = 1,67. Badge zielony.

**Grafika**
Kafelek Payback wyróżniony wartością „1,7 lat" — krótki zwrot. Kafelek IRR: „36,3%". PI: „1,49". Badge go: zielony. BulletChart NPV: słupek przy 24 606 PLN względem baseline 0. Stopa dyskontowa w polu = „10".

**Funkcjonalność**
`investmentAppraisalService.ts`: `payback([30000,30000,30000], 50000)` (lin. 167-185) — interpolacja liniowa wewnątrz okresu. `irr()` — bisekcja 200 iteracji. `profitabilityIndex()` (lin. 220). `appraise()` → werdykt `'go'`.

---

### MC-16I-13 · Wysoki IRR (>30%) — nakład 100 000, przepływy 2×80 000 → IRR ≈ 37,98% · [FLAG] [V8] [IRR] [NPV]

**Co się dzieje**
Konsultant ocenia projekt z intensywnymi przepływami w krótkim horyzoncie: nakład 100 000 PLN, przez 2 lata przepływy 80 000 PLN rocznie. Stopa dyskontowa: 10%. Wpisuje: T0 = -100 000, rok 1 = 80 000, rok 2 = 80 000. Klika „Oblicz". Oczekiwane: NPV ≈ 38 843 PLN, IRR ≈ 37,98%, MIRR ≈ 29,61%, Payback = 1,25 lat (po 1 roku kumulacja 80k; shortfall = 20k; 20k/80k = 0,25; payback = 1,25), Disc.Payback = 1,41 lat, PI ≈ 1,388. Werdykt: „Realizować (go)". Konsultant zwraca uwagę, że IRR 37,98% to prawie 4× stopa dyskontowa — sygnał bardzo wysokiej rentowności projektu.

**Efekty pracy**
`POST /api/v8/finance/value/appraise` → `{ cashFlows: [-100000, 80000, 80000], discountRate: 10, hurdleRatePct: 10 }` → 200 → `{ npv: 38843, irr: 37.98, mirr: 29.61, payback: 1.25, discountedPayback: 1.41, pi: 1.388, verdict: 'go' }`. IRR = 37,98% obliczone przez bisekcję (200 iteracji, zbieżność do 1e-9). Werdykt `'go'`: IRR = 37,98% > hurdle = 10%.

**Grafika**
Kafelek IRR: „38,0%" — wartość duża, wyraźna. Kafelek MIRR: „29,6%". Payback: „1,2 lat" — bardzo krótki. Badge: zielony „Realizować (go)". BulletChart z NPV ≈ 38 843 PLN daleko po prawej. Disc.Payback: „1,4 lat".

**Funkcjonalność**
`investmentAppraisalService.ts`: `irr([80000,80000], 100000)` — bisekcja między -0,9999 a 10 (=1000%), konwergencja ~0,3799; zwraca 37,98. `fmtPct(37.98)` = „38,0%". Werdykt: IRR > hurdleRatePct (10) → `'go'`.

---

### MC-16I-14 · Wieloletnie przepływy zmienne (5 lat) — nakład 200 000 PLN · [FLAG] [V8] [NPV]

**Co się dzieje**
Konsultant modeluje projekt transformacji cyfrowej dla Elkomtech: nakład inwestycyjny 200 000 PLN, przepływy narastające przez 5 lat (ramp-up efektów): rok 1: 60 000, rok 2: 65 000, rok 3: 70 000, rok 4: 75 000, rok 5: 80 000 PLN. Stopa dyskontowa: 10%. Klika „+ okres" dwukrotnie, by rozszerzyć panel do 6 pól (T0 + 5 lat). Wpisuje wartości. Klika „Oblicz". Oczekiwane wyniki: NPV ≈ 61 756 PLN, IRR ≈ 20,85%, MIRR ≈ 16,08%, Payback ≈ 3,07 lat, Disc.Payback ≈ 3,76 lat, PI ≈ 1,309. Werdykt: „Realizować (go)".

**Efekty pracy**
`POST /api/v8/finance/value/appraise` → `{ cashFlows: [-200000, 60000, 65000, 70000, 75000, 80000], discountRate: 10, hurdleRatePct: 10 }` → 200 → `{ npv: 61756, irr: 20.85, mirr: 16.08, payback: 3.07, discountedPayback: 3.76, pi: 1.309, verdict: 'go' }`. Panel przed kliknięciem miał 5 pól (DEFAULT_CASHFLOWS 5 wpisów); dwie operacje `addPeriod()` zwiększają do 7 pól. Payback 3,07 lat: po 3 latach kumulacja = 195 000 PLN < 200 000, w roku 4 = 270 000 > 200 000; interpolacja = 3 + 5000/75000 = 3,067.

**Grafika**
7 pól inputowych: T0, rok 1–6 (panel rozszerzony). Wartości nierówne — rok 5 (80 000 PLN) większy od roku 1 (60 000 PLN). Kafelek IRR: „20,9%". Payback: „3,1 lat". PI: „1,31". Badge zielony. BulletChart NPV 61 756 PLN.

**Funkcjonalność**
`InvestmentAppraisalPanel.tsx`: `addPeriod()` (lin. ~145) dodaje 0 do `cashflows`. Minimalna długość: brak dolnego limitu na `addPeriod`. `investmentAppraisalService.ts`: `payback([60k,65k,70k,75k,80k], 200000)` z interpolacją. `discountedPayback()` z dyskontowaniem każdego CF przed kumulacją.

---

# D. Werdykt „No-go" — nieopłacalny projekt

---

### MC-16I-15 · Klasyczny No-go — nakład 1 000 000, przepływy 2×10 000, stopa 15% · [FLAG] [V8] [NPV]

**Co się dzieje**
Konsultant analizuje propozycję akwizycji aktywów za 1 000 000 PLN, która wygeneruje zaledwie 10 000 PLN rocznie przez 2 lata. Stopa hurdle funduszu private equity: 15%. Wpisuje: T0 = -1 000 000, rok 1 = 10 000, rok 2 = 10 000, stopa 15%. Klika „Oblicz". Wyniki: NPV ≈ -983 743 PLN (przepaść!), IRR ≈ -89,49% (projekt niszczy wartość), MIRR ≈ -85,34%, Payback = ∞ (nie zwróci się nigdy przy tych CF), Disc.Payback = ∞, PI ≈ 0,016. Werdykt: „Odrzucić (no-go)" — PI < 1 (0,016 << 1), NPV << 0. Badge czerwony.

**Efekty pracy**
`POST /api/v8/finance/value/appraise` → `{ cashFlows: [-1000000, 10000, 10000], discountRate: 15, hurdleRatePct: 15 }` → 200 → `{ npv: -983743, irr: -89.49, mirr: -85.34, payback: null (Infinity→serwer), discountedPayback: null, pi: 0.016, verdict: 'no-go' }`. Warunek `no-go`: NPV = -983 743 < 0 ORAZ PI = 0,016 < 1 — spełniony od razu (pierwszy warunek w if). Payback = Infinity (10 000 + 10 000 = 20 000 << 1 000 000).

**Grafika**
Badge `data-testid="appraise-verdict"` — czerwone tło `bg-rose-100 text-rose-700 border-rose-200`, tekst „Odrzucić (no-go)". Kafelek NPV: „-983 743 PLN" — liczba ujemna z minusem. IRR: „-89,5%". MIRR: „-85,3%". Payback: „—" (`fmtYears(-Infinity)` lub NaN → „—"). PI: „0,02". BulletChart: słupek NPV daleko po lewej stronie zera.

**Funkcjonalność**
`investmentAppraisalService.ts`: `npv([10000,10000], 15, 1000000)` → ogromnie ujemna wartość. `payback([10000,10000], 1000000)` → Infinity (20k < 1M). `fmtYears(Infinity)` = „—" (test: `v < 0` → „—"; nieskończoność nie jest finite). `VERDICT_STYLE['no-go'] = 'bg-rose-100...'`.

---

### MC-16I-16 · IRR nieistniejące (null) — przepływy monotonnie ujemne po nakładzie · [FLAG] [V8] [IRR]

**Co się dzieje**
Konsultant spotyka projekt, gdzie oprócz nakładu początkowego planowane są wyłącznie koszty (ujemne przepływy) — np. długoterminowy kontrakt serwisowy bez przychodów. Wpisuje: T0 = -100 000, rok 1 = -10 000, rok 2 = -10 000, rok 3 = -10 000, stopa 10%. Klika „Oblicz". IRR nie istnieje (brak zmiany znaku w funkcji NPV — wszystkie przepływy ujemne, NPV stale maleje). Serwis `irr()` zwraca `null` (brak rozwiązania bisekcji: `fLo * fHi > 0`). Panel wyświetla IRR = „—". Werdykt: „Odrzucić (no-go)" (NPV < 0, PI < 0).

**Efekty pracy**
`POST /api/v8/finance/value/appraise` → 200 → `{ irr: null, verdict: 'no-go' }`. Serwer: `irr([-10000,-10000,-10000], 100000)` — `npvAt(lo)` i `npvAt(hi)` obydwa ujemne → `fLo * fHi > 0` → `return null` (lin. 85). Panel: `result.irr === null` → `fmtPct(null)` = „—" (sprawdzono w kodzie). Metryki z IRR = null: kafelek IRR pokazuje „—".

**Grafika**
Kafelek IRR: „—" (myślnik, nie „0%" ani „-100%"). NPV: silnie ujemny. MIRR: zależny od przepływów. Badge czerwony „Odrzucić (no-go)". Brak crash, brak błędu JS — fail-safe dla null IRR obsłużony przez `result.irr === null ? '—' : fmtPct(result.irr)`.

**Funkcjonalność**
`investmentAppraisalService.ts`: `irr()` (lin. 62-104) — bisekcja, warunek `fLo * fHi > 0 → return null`. `InvestmentAppraisalPanel.tsx`: metryki array (lin. ~165): `value: result.irr === null ? '—' : fmtPct(result.irr)`. Brak renderowania error — to normalny wynik domenowy.

---

### MC-16I-17 · Payback nieskończony — nakład nie zwraca się w horyzoncie 5 lat · [FLAG] [V8] [NPV]

**Co się dzieje**
Konsultant bada projekt z bardzo małymi rocznymi wpływami: nakład 200 000 PLN, rok 1–5: 10 000 PLN rocznie, stopa 10%. Suma prostych przepływów przez 5 lat = 50 000 PLN < 200 000 PLN — nakład nigdy nie zostanie odzyskany w podanym horyzoncie. Klika „Oblicz". Wyniki: NPV ≈ -162 092 PLN, IRR ≈ -33,53%, Payback = ∞ (nie zwróci się), Disc.Payback = ∞, PI ≈ 0,190. Werdykt: „Odrzucić (no-go)". Konsultant sprawdza, że kafelki Payback i Disc.Payback pokazują „—" (nie błąd, nie 0, nie Infinity dosłownie).

**Efekty pracy**
`payback([10000,10000,10000,10000,10000], 200000)` → Infinity (kumulacja maks. 50 000 < 200 000). `fmtYears(Infinity)` → sprawdzenie: `!Number.isFinite(v)` → `return '—'`. `discountedPayback()` → Infinity. Serwer zwraca `payback: Infinity` (JavaScript Infinity w JSON → `null` lub `"Infinity"` — sprawdzić format odpowiedzi). Panel: `fmtYears()` obsługuje wartości nieciągłe. Werdykt: `'no-go'` (NPV < 0).

**Grafika**
Kafelek Payback: „—". Kafelek Disc. payback: „—". NPV: „-162 092 PLN" (ujemny). IRR: „-33,5%". PI: „0,19". Badge czerwony.

**Funkcjonalność**
`investmentAppraisalService.ts`: `payback()` (lin. 167) → pętla for, warunek `cumulative >= initialInvestment` nigdy nie spełniony → `return Infinity` (lin. 185). `fmtYears(v)`: warunek `!Number.isFinite(v) || v < 0 → return '—'` (InvestmentAppraisalPanel.tsx). JSON serialization: sprawdzić czy serwer wysyła `null` dla Infinity (JSON.stringify(Infinity) = null).

---

### MC-16I-18 · PI < 1 — projekt niszczy wartość, niskie przepływy · [FLAG] [V8] [NPV]

**Co się dzieje**
Konsultant ocenia projekt o zdecydowanie niekorzystnym wskaźniku rentowności. Nakład: 100 000 PLN. Przepływy: rok 1–3: 30 000 PLN rocznie, stopa 10%. PV przepływów = 74 606 PLN < 100 000 PLN nakładu → PI = 74 606 / 100 000 = 0,746. Klika „Oblicz". NPV = -25 394 PLN, PI = 0,746 < 1. Werdykt: „Odrzucić (no-go)". Konsultant wyjaśnia klientowi, że PI < 1 oznacza, że każda zainwestowana złotówka zwróci jedynie 0,75 PLN wartości bieżącej — projekt jest value-destroying.

**Efekty pracy**
`POST /api/v8/finance/value/appraise` → `{ cashFlows: [-100000, 30000, 30000, 30000], discountRate: 10, hurdleRatePct: 10 }` → 200 → `{ npv: -25394, irr: -5.09, mirr: -0.23, payback: null, discountedPayback: null, pi: 0.746, verdict: 'no-go' }`. Warunek: `piValue < 1` → `verdict = 'no-go'` (pierwszy warunek w if, lin. 296-298). PI = `presentValueOfFlows([30k,30k,30k], 10) / 100000 = 74606 / 100000 = 0.746`.

**Grafika**
Kafelek PI: „0,75" — wyraźnie poniżej 1. NPV: „-25 394 PLN". Payback: „—" (kumulacja 3×30k=90k < 100k). Badge: czerwony „Odrzucić (no-go)". BulletChart: słupek NPV po lewej stronie baseline 0.

**Funkcjonalność**
`investmentAppraisalService.ts`: `profitabilityIndex([30000,30000,30000], 10, 100000)` = `presentValueOfFlows([30k,30k,30k], 10) / 100000` (lin. 220-227). Warunek werdyktu: `if (npvValue < 0 || piValue < 1) verdict = 'no-go'` (lin. 296). `result.pi.toFixed(2)` w panelu.

---

### MC-16I-19 · Zero błędów w konsoli przy werdykcie No-go · [FLAG] [V8]

**Co się dzieje**
Konsultant QA weryfikuje, że werdykt no-go nie generuje żadnych błędów w konsoli. Otwiera DevTools → Console, czyści log. Wpisuje scenariusz no-go: nakład 500 000 PLN, przepływy rok 1–2: 5 000 PLN rocznie, stopa 20%. Klika „Oblicz". Odbiera werdykt „Odrzucić (no-go)" — PI = 0,017, NPV ≈ -491 840 PLN. Przegląda konsolę: oczekuje zero błędów (Error, TypeError, Warning). Sprawdza szczególnie obsługę `Infinity` (payback), `null` (irr) i bardzo ujemnych liczb (-491 840) w komponentach formatujących.

**Efekty pracy**
Panel nie rzuca wyjątków: `fmtMoney(-491840)` → „-491 840 PLN" (bez NaN ani undefined). `fmtPct(irr)` gdzie irr może być liczbą ujemną → „-X,X%" — poprawnie. `fmtYears(Infinity)` → „—" bez console.error. `result.pi.toFixed(2)` gdzie pi = 0,017 → „0,02" bez błędu. `BulletChart` z `actual = -491840` i `max = abs(-491840)*1.2 = 590208` → słupek po lewej, brak błędu renderu. Konsola: zero wpisów Error/Warning.

**Grafika**
Konsola DevTools: pusta (zero Error, zero Warning). Panel: wyniki wyświetlone poprawnie. Badge czerwony. Kafelki bez wartości `NaN`, `undefined`, `null` — wszystkie pokazują „—" lub liczbę.

**Funkcjonalność**
`fmtMoney()`: `!Number.isFinite(v) → '—'` (InvestmentAppraisalPanel.tsx:75). `fmtYears()`: `!Number.isFinite(v) || v < 0 → '—'` (lin. 84). `BulletChart` z `max = Math.max(1, Math.abs(result.npv) * 1.2)` — nigdy 0 (lin. ~240). `compute()` w try/catch — brak nieobsłużonych promisów.

---

# E. Werdykt „Conditional" — warunkowo opłacalny

---

### MC-16I-20 · Conditional przy IRR null — niemonotoniczne przepływy, NPV > 0, brak IRR · [FLAG] [V8] [IRR] [NPV]

**Co się dzieje**
Konsultant strukturyzuje projekt z niestandardowym profilem przepływów: brak wpływów w roku 1, duży wpływ w roku 2, a następnie duży koszt zamknięcia w roku 3 (np. rekultywacja terenu). Nakład: 100 000 PLN, przepływy: rok 1 = 0 PLN, rok 2 = 400 000 PLN, rok 3 = -300 000 PLN. Stopa dyskontowa: 10%. Panel oblicza: NPV ≈ 5 184 PLN (NPV > 0), PI ≈ 1,052 (PI > 1), ale IRR = null (niemonotoniczne przepływy — funkcja `irr()` nie może znaleźć zmiany znaku w przedziale bisekcji → zwraca null). Ponieważ IRR = null, warunek werdyktu `go` nie jest spełniony (wymaga `irrValue !== null`) → werdykt: „Warunkowo (conditional)".

**Efekty pracy**
`POST /api/v8/finance/value/appraise` → `{ cashFlows: [-100000, 0, 400000, -300000], discountRate: 10, hurdleRatePct: 10 }` → 200 → `{ npv: 5184, irr: null, mirr: 10.58, payback: 1.25, discountedPayback: 1.30, pi: 1.052, verdict: 'conditional' }`. Bisekcja IRR: `npvAt(lo)` i `npvAt(hi)` mają ten sam znak (oba dodatnie lub oba ujemne dla skrajnych r) → `fLo * fHi > 0` → `return null`. Werdykt: `piValue >= 1` AND `npvValue >= 0` AND `irrValue === null` → blok `else` → `'conditional'`.

**Grafika**
Badge `data-testid="appraise-verdict"` — bursztynowe tło `bg-amber-100 text-amber-700 border-amber-200`, tekst „Warunkowo (conditional)". Kafelek IRR: „—". Kafelek NPV: „5 184 PLN" (niewielki, dodatni). PI: „1,05". MIRR: „10,6%". Payback: „1,2 lat" (rok 2 przynosi 400k, odzysk nakładu: 0 w roku 1, 100k/400k = 0,25 roku 2 → payback=1,25). BulletChart: słupek NPV lekko po prawej stronie 0.

**Funkcjonalność**
`investmentAppraisalService.ts`: `irr([0, 400000, -300000], 100000)` → null (brak zmiany znaku). Werdykt (lin. 293-309): `npvValue(5184) < 0 → false`; `npvValue > 0 AND irrValue !== null AND irrValue > hurdle → false` (irr null); → `'conditional'`. MIRR obliczony mimo null IRR — używa innego algorytmu (FV pozytywnych / PV negatywnych).

---

### MC-16I-21 · Badge conditional — kolor bursztynowy i tekst „Warunkowo" · [FLAG] [V8]

**Co się dzieje**
Konsultant weryfikuje wygląd werdyktu conditional (używa scenariusza z MC-16I-20: nakład 100 000, przepływy [0, 400 000, -300 000], stopa 10%). Po kliknięciu „Oblicz" i uzyskaniu werdyktu conditional sprawdza w DevTools → Elements klasę CSS elementu `[data-testid="appraise-verdict"]`. Oczekuje klasy `bg-amber-100 text-amber-700 border-amber-200`. Sprawdza tekst wewnątrz elementu: „Warunkowo (conditional)". Porównuje z kolorem badge go (emerald) i no-go (rose) — bursztynowy badge musi być wyraźnie odróżnialny od obu.

**Efekty pracy**
`VERDICT_STYLE['conditional'] = 'bg-amber-100 text-amber-700 border-amber-200'` (InvestmentAppraisalPanel.tsx:~63). `VERDICT_LABEL['conditional'] = 'Warunkowo (conditional)'` (lin. ~68). Element badge w DOM: `<span class="rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 border-amber-200" data-testid="appraise-verdict">Warunkowo (conditional)</span>`. Kontrast wizualny: amber ≠ emerald ≠ rose.

**Grafika**
Badge bursztynowy (amber) widocznie różny od zielonego (go) i czerwonego (no-go). Tekst „Warunkowo (conditional)" w formacie polsko-angielskim. Element lekko zaokrąglony (`rounded-full`), z obramowaniem, padding poziomy 2,5.

**Funkcjonalność**
`VERDICT_STYLE` i `VERDICT_LABEL` records (InvestmentAppraisalPanel.tsx). Render: `<span className={\`rounded-full border px-2.5 py-0.5 text-xs font-semibold \${VERDICT_STYLE[result.verdict]}\`} data-testid="appraise-verdict">`. Weryfikacja CSS przez DevTools Inspector.

---

### MC-16I-22 · Zmiana stopy dyskontowej nie zmienia werdyktu conditional gdy IRR = null · [FLAG] [V8] [IRR]

**Co się dzieje**
Konsultant sprawdza, jak zmiana stopy dyskontowej wpływa na projekt z niemonotonicznymi przepływami (nakład 100 000, przepływy [0, 400 000, -300 000]). Używa scenariusza z MC-16I-20 przy stopie 10% → conditional. Zmienia stopę na 5% i klika „Oblicz": NPV rośnie do ≈ 3 661 PLN, PI = 1,037 — nadal conditional (IRR = null, IRR null → nie czyści warunku go). Zmienia na 12% i klika „Oblicz": NPV ≈ 5 343 PLN, PI = 1,053 — nadal conditional. Wniosek: werdykt conditional trwa niezależnie od stopy, gdy IRR = null i NPV > 0, PI > 1.

**Efekty pracy**
Trzy żądania `POST /api/v8/finance/value/appraise` z różnymi `discountRate` (5, 10, 12). Wszystkie trzy zwracają `irr: null, verdict: 'conditional'`. Zmiana stopy modyfikuje NPV i PI, ale nie „naprawia" IRR — bisekcja nadal nie znajduje zmiany znaku. Warunek `go`: `irrValue !== null` zawsze niespełniony → conditional.

**Grafika**
Trzy obliczenia kolejno: stopa 5% → badge bursztynowy, PI „1,04"; stopa 10% → badge bursztynowy, PI „1,05"; stopa 12% → badge bursztynowy, PI „1,05". NPV delikatnie zmienia się między obliczeniami. IRR = „—" we wszystkich przypadkach.

**Funkcjonalność**
`investmentAppraisalService.ts`: algorytm bisekcji `irr()` niezależny od `discountRatePct` (IRR = stopa gdzie NPV=0 → zależy tylko od cashflows i initialInvestment). Zmiana stopy nie wpływa na IRR computation. Werdykt: `irrValue === null` → zawsze `'conditional'` (gdy NPV≥0, PI≥1).

---

# F. Edycja cashflows i UX

---

### MC-16I-23 · Dodaj okres (+) — nowy wiersz przepływu bez wywołania API · [FLAG]

**Co się dzieje**
Konsultant zaczyna od domyślnego scenariusza (5 pól: T0 + 4 lata) i rozbudowuje horyzont do 7 lat. Klika przycisk „+ okres" (dashed border, tekst „+ okres") — nowe pole „Rok 5" pojawia się z wartością 0. Klika znów — pojawia się „Rok 6". Panel ma teraz 7 pól. W DevTools → Network sprawdza, że żadne żądanie do `/appraise` NIE zostało wysłane w wyniku dodania pól (API leci dopiero po kliknięciu „Oblicz"). Wpisuje wartości dla nowych lat i klika „Oblicz" — żądanie zawiera 7 elementów w `cashFlows`.

**Efekty pracy**
`addPeriod()` (InvestmentAppraisalPanel.tsx:~145): `setCashflows(prev => [...prev, 0])` — state update bez żądania API. Komponent rerenderuje się z nowym polem. Network: zero nowych żądań po kliknięciu „+ okres". Po „Oblicz": `cashFlows` w body POST zawiera 7 liczb. Brak limitu górnego na liczbę pól.

**Grafika**
Przed: 5 pól (T0, rok 1-4). Po 2× kliknięciu: 7 pól (T0, rok 1-6). Nowe pole: label „Rok 5", input type=number z wartością 0, przycisk „×" usunięcia. Przycisk „+ okres": dashed border `border-dashed border-gray-300`, hover niebieski. Layout: flex wrap, pola rozmieszczone poziomo.

**Funkcjonalność**
`addPeriod` (lin. ~145): `useCallback(() => setCashflows(prev => [...prev, 0]), [])`. Renderowanie pól: `{cashflows.map((cf, idx) => ...)}`. Przycisk „+ okres": `onClick={addPeriod}`. Brak side-effectów poza setState.

---

### MC-16I-24 · Usuń okres (×) — wiersz znika, minimalna liczba 2 wierszy · [FLAG]

**Co się dzieje**
Konsultant chce skrócić horyzont analizy z 4 lat do 2 lat. Klika „×" przy roku 3 — znika. Klika „×" przy roku 2 — zostają tylko T0 i rok 1 (2 pola). Próbuje kliknąć „×" przy roku 1 — nic się nie dzieje (panel utrzymuje minimum 2 wierszy przez warunek `cashflows.length > 2`). Weryfikuje: przy 2 polach przycisk „×" jest niewidoczny lub nieaktywny. Klika „Oblicz" — żądanie z `cashFlows: [-X, Y]` (2 elementy).

**Efekty pracy**
`removePeriod(idx)` (InvestmentAppraisalPanel.tsx:~148): `setCashflows(prev => prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev)`. Przy `length = 2`: filter NIE jest wywołany, state bez zmian. Przycisk „×": widoczny tylko gdy `{cashflows.length > 2 && <button onClick={() => removePeriod(idx)}>×</button>}` (lin. ~186-189). Network: zero żądań przy usunięciu — tylko rerenderów.

**Grafika**
Przy 4 polach: każde pole ma przycisk „×". Przy 3 polach: każde ma „×". Przy 2 polach: brak przycisków „×" (conditionally rendered). Klik na nieobecny „×" — niemożliwy. Layout adjustuje się poziomo.

**Funkcjonalność**
`removePeriod` (lin. ~148): `prev.length > 2 ? filter : prev`. Warunkowy render `×` button: `cashflows.length > 2 &&`. Aria-label: `aria-label={\`Usuń okres \${idx}\`}`.

---

### MC-16I-25 · Edycja nakładu → poprzedni wynik znika (stan czysty) · [FLAG]

**Co się dzieje**
Konsultant oblicza scenariusz i widzi wyniki (NPV, IRR, werdykt). Następnie zmienia wartość nakładu (pole T0) z -100 000 na -150 000. Wyniki werdyktu i metryk powinny zniknąć — nie mogą wyświetlać wartości sprzed zmiany (stale data). Konsultant weryfikuje, że po zmianie pola T0 sekcja z wynikami (badge werdyktu, siatka metryk) staje się niewidoczna. Klika „Oblicz" ponownie z nowym nakładem — pojawia się zaktualizowany wynik.

**Efekty pracy**
`updateFlow(0, '-150000')` → `setCashflows(copy)` zmienia tylko `cashflows` state — NIE resetuje `result`. Sekcja wyników warunek: `{!failed && result && ...}` (InvestmentAppraisalPanel.tsx:~200). Zmiana cashflows NIE resetuje `result` automatycznie — **UWAGA:** zweryfikuj w kodzie czy zmiana inputu czyści result czy nie. Jeśli NIE czyści: wyniki mogą być stale po zmianie nakładu → odnotować jako defekt UX. Oczekiwane zachowanie: rezultat powinien zniknąć po każdej zmianie inputu; jeśli nie znika — oznacz jako FAIL UX.

**Grafika**
Przed edycją: badge + metryki widoczne. Po zmianie nakładu: badge + metryki widoczne lub niewidoczne — **sprawdzić**. Jeśli widoczne → stale data displayed → defekt. Jeśli niewidoczne → wymagany explicit reset `result` po zmianie inputu.

**Funkcjonalność**
`updateFlow()` wywołuje `setCashflows()` — NIE `setResult(null)`. Brak `useEffect([cashflows, discountRate], () => setResult(null))` — nie ma automatycznego czyszczenia. Odnotować: UX może wymagać jawnego resetu. Weryfikacja przy `onChange` na polach inputowych.

---

### MC-16I-26 · Wartość nienumeryczna w polu nakładu — nie propaguje NaN do API · [FLAG] [V8]

**Co się dzieje**
Konsultant omyłkowo wpisuje literę w polu T0 (np. „abc"). Pole input `type="number"` blokuje wpisanie liter w większości przeglądarek, jednak konsultant sprawdza zachowanie: jeśli mimo to wartość nie-numeryczna dotrze do `updateFlow()`, funkcja `Number('abc')` zwróci `NaN`, a warunek `Number.isFinite(next) ? next : 0` zastąpi go zerem (`copy[idx] = 0`). Klika „Oblicz" z nakładem = 0 (wynikiem zastąpienia): serwer otrzyma `cashFlows[0] = 0`, co jest prawidłowe numerycznie (choć zmienia semantykę). NaN NIE trafia do API.

**Efekty pracy**
`updateFlow(idx, 'abc')`: `Number('abc')` = NaN. `Number.isFinite(NaN)` = false → `copy[idx] = 0`. `cashflows` state z 0 zamiast NaN. `POST /api/v8/finance/value/appraise` z `cashFlows[0] = 0` — serwer parsuje `Number(flows[0]) < 0 → false` (nie extrahuje jako initialInvestment), `initialInvestment = 0`, flows = cały array. Brak 400 Bad Request. Brak `NaN` w payload JSON.

**Grafika**
Pole input T0: typ `number` — przeglądarka blokuje większość znaków nienumerycznych. Wartość wyświetlona w polu po wpisaniu "abc": zostanie zastąpiona 0. Żądanie Network: cashFlows bez NaN.

**Funkcjonalność**
`updateFlow` (lin. ~130): `const next = Number(raw); setCashflows(prev => { const copy = [...prev]; copy[idx] = Number.isFinite(next) ? next : 0; return copy; })`. Zabezpieczenie: `Number.isFinite()` guard. Input HTML: `type="number"` — natywna walidacja przeglądarki.

---

### MC-16I-27 · Stopa dyskontowa domyślna 10% wpisana jest przy otwarciu panelu · [FLAG]

**Co się dzieje**
Konsultant aktywuje flagę i otwiera zakładkę Investment. Widzi panel bez wcześniejszego obliczenia. Sprawdza pole „Stopa dyskontowa (%)" — wartość domyślna wynosi 10 (props `discountRatePct = 10` przez `useState(typeof discountRatePct === 'number' ? discountRatePct : 10)`). Nie zmienia pola i klika „Oblicz" natychmiast — żądanie leci z `discountRate: 10`. Następnie konsultant zmienia stopę na 15% i ponownie klika „Oblicz" — żądanie z `discountRate: 15, hurdleRatePct: 15`. Weryfikuje, że oba parametry body idą tej samej wartości (panel zawsze wysyła `hurdleRatePct: discountRate`).

**Efekty pracy**
`useState(typeof discountRatePct === 'number' ? discountRatePct : 10)` (InvestmentAppraisalPanel.tsx:100-101): bez prop → 10. `onChange` na polu stopy: `setDiscountRate(Number(e.target.value) || 0)`. `compute()`: `{ discountRate, hurdleRatePct: discountRate }` — zawsze równe. Network: pierwsze żądanie: `discountRate: 10, hurdleRatePct: 10`. Drugie: `discountRate: 15, hurdleRatePct: 15`.

**Grafika**
Pole stopy dyskontowej: `value={discountRate}`, `aria-label="Stopa dyskontowa"`, typ number, szerokość w-24. Domyślna wartość 10 widoczna od razu. Po zmianie na 15: pole pokazuje 15.

**Funkcjonalność**
`setDiscountRate` przez `onChange={(e) => setDiscountRate(Number(e.target.value) || 0)}` (lin. ~208). Fallback `|| 0` przy pustym polu (brak NaN). `compute()` wysyła `hurdleRatePct: discountRate` (lin. ~157).

---

# G. Fail-soft i edge case'y

---

### MC-16I-28 · Zablokowanie POST /appraise w DevTools → `appraise-failed` notice, brak crash · [FLAG] [V8]

**Co się dzieje**
Konsultant weryfikuje odporność panelu na awarię serwera. Otwiera DevTools → Network → Request Blocking (lub Network Conditions). Dodaje regułę blokowania URL zawierającego „appraise" (lub wyłącza sieć przez DevTools). Wypełnia formularz nakładem -100 000 PLN, przepływami rok 1-3: 40 000 PLN, stopa 10%. Klika „Oblicz". Panel pokazuje tymczasowo „Liczę…" (loading state), żądanie jest zablokowane lub zwraca błąd sieciowy → `catch` w `compute()` → `setFailed(true)`, `setResult(null)`, `setLoading(false)`. Pojawia się komunikat `data-testid="appraise-failed"`. Strona NIE crashuje, brak white-screen.

**Efekty pracy**
`compute()` (InvestmentAppraisalPanel.tsx:~150): `try { ... } catch { setResult(null); setFailed(true); } finally { setLoading(false); }`. Brak `throw` — błąd połknięty. `failed = true` → render: `{failed && <p data-testid="appraise-failed">Analiza niedostępna chwilowo — spróbuj ponownie.</p>}`. Sekcja wyników (`!failed && result`) niewidoczna. Przycisk „Oblicz" powraca do aktywności (`loading=false`). Brak wpisów Error w konsoli (catch bez rethrow).

**Grafika**
Podczas obliczania: przycisk „Liczę…" z `disabled` (`disabled:opacity-50`). Po błędzie: komunikat szary „Analiza niedostępna chwilowo — spróbuj ponownie." (`text-sm text-gray-500`). Brak badge werdyktu, brak siatki metryk. Panel nadal widoczny i reaktywny. Po odblokowaniu sieci: klik „Oblicz" → normalne działanie.

**Funkcjonalność**
`compute()`: `try { const res = await (fetcher ?? defaultFetcher)(...); setResult(res ?? null); setFailed(!res); } catch { setResult(null); setFailed(true); } finally { setLoading(false); }`. `{failed && <p data-testid="appraise-failed">...}` (lin. ~220). Fail-soft: komentarz w pliku: „Fail-soft: a request error degrades to a quiet inline notice, never throws."

---

### MC-16I-29 · Bardzo duże przepływy (miliardy) — brak overflow w wyświetleniu wyników · [FLAG] [V8] [NPV]

**Co się dzieje**
Konsultant analizuje projekt infrastrukturalny dużej skali. Wpisuje: T0 = -1 000 000 000 (1 miliard PLN), przepływy rok 1–3: 500 000 000, 600 000 000, 700 000 000 PLN. Stopa 10%. Klika „Oblicz". Oczekiwane: NPV ≈ 476 333 584 PLN (≈ 476 mln), IRR ≈ 33,87%, MIRR ≈ 25,25%, Payback ≈ 1,83 lat, Disc.Payback ≈ 2,09 lat, PI ≈ 1,476. Werdykt: „Realizować (go)". Konsultant weryfikuje, że `Intl.NumberFormat('pl-PL')` poprawnie formatuje 476 333 584 jako „476 333 584" (spacja jako separator tysięcy w pl-PL) bez overflow w kafelku NPV.

**Efekty pracy**
`POST /api/v8/finance/value/appraise` → `{ cashFlows: [-1000000000, 500000000, 600000000, 700000000], discountRate: 10, hurdleRatePct: 10 }` → 200 → `{ npv: 476333584, irr: 33.87, mirr: 25.25, payback: 1.83, discountedPayback: 2.09, pi: 1.476, verdict: 'go' }`. JavaScript: `Number.MAX_SAFE_INTEGER = 9_007_199_254_740_991` >> 1 000 000 000 → brak utraty precyzji. `fmtMoney(476333584)` = `new Intl.NumberFormat('pl-PL', {maximumFractionDigits:0}).format(476333584)` = „476 333 584".

**Grafika**
Kafelek NPV: „476 333 584" z polskimi spacjami jako separatorami. Tekst mieści się w kafelku (szerokość `text-sm`, pole skaluje się). Kafelek IRR: „33,9%". PI: „1,48". Badge zielony „Realizować (go)". Brak ucięcia tekstu w kafelku NPV.

**Funkcjonalność**
`fmtMoney()`: `new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(v)` — obsługuje duże liczby. `investmentAppraisalService.ts`: `npv()`, `irr()`, `mirr()` — JavaScript floats działają do ~2^53 bez utraty precyzji. BulletChart: `max = abs(476333584)*1.2 = 571600300.8` — bez overflow SVG.

---

### MC-16I-30 · Stopa dyskontowa 0% → NPV = prosta suma przepływów minus nakład · [FLAG] [V8] [NPV] [IRR]

**Co się dzieje**
Konsultant testuje graniczny przypadek zerowej stopy dyskontowej (co odpowiada braku kosztu kapitału lub analizie czysto kasowej). Nakład: 100 000 PLN. Przepływy rok 1–4: 30 000 PLN rocznie. Stopa dyskontowa: 0%. Klika „Oblicz". Przy stopie 0%: NPV = Σ CF/(1+0)^t − 100 000 = 30k+30k+30k+30k − 100k = 120k − 100k = 20 000 PLN. IRR: stopa, przy której NPV=0 → 30k×4 = 120k > 100k przy r=0, więc NPV=0 przy r > 0; bisekcja zwraca IRR ≈ 7,71% (gdzie NPV=0). Werdykt: NPV=20000 > 0, PI=1,20 > 1, IRR=7,71% > 0% → „Realizować (go)".

**Efekty pracy**
`POST /api/v8/finance/value/appraise` → `{ cashFlows: [-100000, 30000, 30000, 30000, 30000], discountRate: 0, hurdleRatePct: 0 }` → 200 → `{ npv: 20000, irr: 7.71, mirr: 4.66, payback: 3.33, discountedPayback: 3.33, pi: 1.2, verdict: 'go' }`. `npv([30k,30k,30k,30k], 0, 100000)`: `r=toRate(0)=0`; każdy CF podzielony przez `(1+0)^t = 1`; PV = 120 000; NPV = 120 000 − 100 000 = 20 000. Przy stopie 0% Disc.Payback = Payback (zdyskontowanie przez 1 → bez zmiany). MIRR: `rReinvest = 0%` → FV każdego pozytywnego CF = CF × (1+0)^(n-t) = CF → MIRR może być zdefiniowany lub NaN przy granicznych wartościach.

**Grafika**
Pole stopy dyskontowej: wartość „0". NPV: „20 000 PLN" (prosta suma minus nakład). Disc.Payback = Payback = „3,3 lat" (identyczne przy stopie 0%). Badge: zielony „Realizować (go)". IRR: „7,7%". Brak błędów — stopa 0% obsługiwana przez serwis (`toRate(0) = 0`, `Math.pow(1+0, t) = 1`).

**Funkcjonalność**
`investmentAppraisalService.ts`: `toRate(0) = 0 / 100 = 0`. `npv(cfs, 0, inv)`: `r=0` → `Math.pow(1+0, t) = 1` → PV = suma CFs. `discountedPayback(cfs, 0, inv)`: zdyskontowane CF = CF (brak dyskonta) → Disc.Payback = Payback. `mirr()` przy `rReinvest=0`: FV = CF × 1 = CF → MIRR = `(FVpos/-PVneg)^(1/n) - 1`. `irr()` przy zerowej stopie: bisekcja szuka zmiany znaku — działa normalnie.

---

## Macierz pokrycia funkcji → case'y

| Obszar funkcji | Case'y |
|---|---|
| Filtrowanie typów inwestycyjnych (`isInvestmentAnalysisType`) | MC-16I-01, MC-16I-04 |
| Empty state zakładki Investment | MC-16I-02 |
| Tworzenie analizy inwestycyjnej (`CreateAnalysisModal`, `investment_case` default) | MC-16I-03 |
| Aktywacja flagi URL query (`ff_investAppraisal=1`) | MC-16I-05 |
| Aktywacja flagi localStorage (`ff.fin_invest_appraisal`) | MC-16I-06 |
| Panel w stanie gotowości (DOM, testid, stan startowy) | MC-16I-07 |
| Flaga OFF — panel niewidoczny | MC-16I-08 |
| Werdykt go — pełen scenariusz NPV/IRR/PI | MC-16I-09 |
| Payload Network POST /appraise | MC-16I-10 |
| Wszystkie 6 metryk (NPV/IRR/MIRR/Payback/DiscPayback/PI) | MC-16I-11 |
| Krótki payback (< 2 lata) | MC-16I-12 |
| Wysoki IRR (> 30%) | MC-16I-13 |
| Wieloletnie zmienne przepływy (5 lat) | MC-16I-14 |
| Klasyczny no-go (NPV << 0, PI << 1) | MC-16I-15 |
| IRR = null (brak rozwiązania bisekcji) | MC-16I-16 |
| Payback nieskończony | MC-16I-17 |
| PI < 1 — projekt niszczy wartość | MC-16I-18 |
| Brak błędów konsoli przy no-go | MC-16I-19 |
| Werdykt conditional (IRR=null, NPV>0, PI>1) | MC-16I-20 |
| Badge conditional — kolor bursztynowy amber | MC-16I-21 |
| Conditional niezmienny przy różnych stopach (IRR null) | MC-16I-22 |
| Dodaj okres (+) — brak żądania API | MC-16I-23 |
| Usuń okres (×) — minimum 2 wiersze | MC-16I-24 |
| Edycja nakładu → stale data / stan czysty | MC-16I-25 |
| Walidacja NaN w inputach | MC-16I-26 |
| Domyślna stopa dyskontowa 10% | MC-16I-27 |
| Fail-soft przy błędzie sieci (appraise-failed) | MC-16I-28 |
| Bardzo duże przepływy (miliardy) — brak overflow | MC-16I-29 |
| Stopa 0% — NPV = prosta suma, Disc.Payback = Payback | MC-16I-30 |

---

## Uwagi metodyczne

- **E2E jako wymóg:** każdy case z kliknięciem „Oblicz" musi pokazać `POST /api/v8/finance/value/appraise` w Network z poprawnym ciałem i odpowiedzią 200. Wynik bez żądania = FAIL.
- **Flaga wymagana:** testy sekcji B–G wymagają aktywacji flagi `?ff_investAppraisal=1` lub localStorage `ff.fin_invest_appraisal=1` przed każdym testem. Brak flagi → panel niewidoczny → SKIP, nie FAIL.
- **Pure-compute endpoint:** `POST /api/v8/finance/value/appraise` nie dotyka bazy danych (komentarz: „No DB access" w financeValueRoutes.ts:104). Dane analiz (nazwa, opis, tabele) przechowywane przez inne endpointy — oddzielne od kalkulatora.
- **IRR null jako poprawny wynik domenowy:** IRR = null przy niemonotonicznych przepływach to oczekiwane zachowanie `irr()` (brak zmiany znaku → `return null`). Panel wyświetla „—" bez błędu — NIE oznacza awarii.
- **Precyzja numeryczna:** wartości NPV/IRR/PI w tych case'ach wyliczone ręcznie na podstawie algorytmów z `investmentAppraisalService.ts`. Akceptowalny margines odchylenia ±1 PLN dla NPV (zaokrąglenia float), ±0,01% dla IRR (zbieżność bisekcji 1e-9).
- **Werdykt conditional w praktyce:** werdykt `conditional` dla panelu standardowego (discountRate = hurdleRatePct) jest osiągalny jedynie dla projektów z niemonotonicznymi przepływami (IRR=null) LUB z NPV dokładnie = 0. Nie jest bug — to edge case matematyczny celowo odwzorowany w scenariuszach E.
- **Payback = Infinity w JSON:** `JSON.stringify(Infinity)` = `null` w JavaScript. Sprawdzić, czy serwer zwraca `null` czy specjalną wartość dla nieskończonego paybacku — panel obsługuje oba przez `fmtYears()`.

# CASES — M16 Finanse · Zakładka Analizy finansowe · 30 bogatych case'ów testowych

> **Moduł:** M16 Finanse (`/finance?tab=analysis`)
> **Główne pliki:** `src/components/Economics/FinanceHub.tsx` (~2428 lin.) · `src/components/Benefits/FinancialAnalysisWorkspace.tsx` · `src/components/Economics/modals/CreateAnalysisModal.tsx` · `src/components/Finance/ExportToOutputDialog.tsx` · `src/components/Economics/hooks/useFinanceRowActions.ts` · `src/services/api/v8/finance.ts`
> **Inwentarz modułu:** `Harvard/M16-AUDYT-2026-06-24.md`
> **Cel paczki:** 30 realistycznych scenariuszy pracy konsultanta eksploatujących PEŁNE możliwości zakładki Analizy — tworzenie wszystkich typów, pola inwestycyjne, wskaźniki finansowe w 5 blokach KPI, AI insights, benchmarki, zarządzanie i eksport.
> **Data:** 2026-06-25
> **Autor:** sesja projektowa (czytanie kodu, bez uruchamiania serwerów/testów)

---

## Legenda znaczników

- **[DB]** — utrwalenie w tabeli bazy danych (finance_analyses lub economics/financial-analyses). Weryfikuj hard-refresh.
- **[REAL-AI]** — wywołuje żywy LLM (`POST /analyses/:id/insights`). Odpowiedź zmienna.
- **[EXPORT]** — produkuje artefakt Outputs (raport/deck/inicjatywy). Weryfikuj przez ExportToOutputDialog.
- **[V8]** — endpoint `GET/POST/PATCH/DELETE /api/v8/finance/analyses/*`. Weryfikuj w Network.
- **[INVESTMENT]** — dotyczy pól specyficznych dla `investment_case` (nakład/horyzont/stopa/korzyści, sekcja amber).

**Zasada E2E (każdy case z zapisem):** każda operacja tworzenia/edycji/usunięcia → żądanie HTTP do `/api/v8/finance/analyses` (lub fallback `/api/economics/financial-analyses`) z kodem 200/201 → hard-refresh strony = stan identyczny. Zmiana UI bez żądania w Network = FAIL.

---

## Spis 30 case'ów

### A. Tworzenie analiz (MC-16A-01 … MC-16A-08)
- **MC-16A-01** · Business Case VTS Group — standard comprehensive analysis
- **MC-16A-02** · Investment Case Apator ICT — pola inwestycyjne z realnymi liczbami [INVESTMENT]
- **MC-16A-03** · DCF Analysis — Discounted Cash Flow z sourceStatementPack
- **MC-16A-04** · Cost-Benefit Analysis (cost_benefit) — porównanie opcji strategicznych
- **MC-16A-05** · Sensitivity Analysis — wrażliwość kluczowych założeń
- **MC-16A-06** · Scenario Analysis — warianty base/opt/pess
- **MC-16A-07** · Break-Even Analysis — próg rentowności nowej linii produktowej
- **MC-16A-08** · Walidacja — brakująca nazwa = blokada przycisku Create

### B. Investment Case — pola inwestycyjne (MC-16A-09 … MC-16A-13)
- **MC-16A-09** · Zmiana tytułu modalu dla investment_case ("New Investment Case")
- **MC-16A-10** · Sekcja amber z 4 polami — widoczność i wartości domyślne
- **MC-16A-11** · Payload zawiera initialInvestment / horizon / discountRatePct / annualBenefits
- **MC-16A-12** · Horyzont domyślny 5, stopa dyskontowa domyślna 10 — bez edycji
- **MC-16A-13** · Zmiana typu analizy na ROI — sekcja amber znika

### C. Wskaźniki finansowe (MC-16A-14 … MC-16A-19)
- **MC-16A-14** · Blok Rentowność — gross_margin_pct, EBITDA, net_profit, contribution
- **MC-16A-15** · Blok Koszty i Struktura — COGS, labor, energy ratios
- **MC-16A-16** · Blok Płynność i Cash — current_ratio, quick_ratio, CCC
- **MC-16A-17** · Blok Kapitał Obrotowy — inventory_days, DSO, DPO, turnover
- **MC-16A-18** · Blok Zadłużenie — debt_to_ebitda, interest_coverage
- **MC-16A-19** · Brak danych KPI — komunikat "No KPI values available"

### D. AI Insights (MC-16A-20 … MC-16A-23)
- **MC-16A-20** · Generowanie insights (POST /insights) — realny LLM [REAL-AI]
- **MC-16A-21** · Lista insights (GET /insights) po wygenerowaniu
- **MC-16A-22** · Insights powiązane z wskaźnikami ratios
- **MC-16A-23** · Teresa AI — kontekst analizy w czacie finansowym

### E. Benchmarking i porównania (MC-16A-24 … MC-16A-26)
- **MC-16A-24** · Dodanie benchmarku branżowego (POST /benchmarks)
- **MC-16A-25** · Porównanie YoY — dwa okresy w jednej analizie
- **MC-16A-26** · Peer comparison — wskaźnik benchmark_value w tabeli ratios

### F. Zarządzanie i eksport (MC-16A-27 … MC-16A-30)
- **MC-16A-27** · Edycja metadanych analizy (Edytuj w row actions)
- **MC-16A-28** · Usunięcie analizy — DELETE 200, hard-refresh = brak rekordu
- **MC-16A-29** · Filtrowanie po typie i statusie na liście analiz
- **MC-16A-30** · Eksport do Output — ExportToOutputDialog (raport / deck / inicjatywy) [EXPORT]

---

# A. Tworzenie analiz

---

### MC-16A-01 · Business Case VTS Group — standard comprehensive analysis · [Tworzenie / comprehensive] [DB] [V8]

**Co się dzieje**
Konsultant pracuje nad uzasadnieniem inwestycji strategicznej VTS Group i tworzy pierwszą analizę finansową projektu. Przechodzi do `/finance?tab=analysis`, klika „+ New analysis" (przycisk CTA) → otwiera się `CreateAnalysisModal`. Typ domyślny to `comprehensive` (brak pól inwestycyjnych). Konsultant wpisuje tytuł „VTS Group — Business Case Ekspansja 2026", wybiera dostępny statement pack (np. „VTS Group FY2025 PLN") z listy w sekcji „Source statement pack" (radio-lista z oznaczeniem ● / ○), klika „Create". Toast „Analiza utworzona" potwierdza sukces, nowa pozycja pojawia się na liście i jest od razu zaznaczona.

**Efekty pracy**
Rekord `finance_analyses` (lub tabela v8) z `analysisType='comprehensive'`, `title='VTS Group — Business Case Ekspansja 2026'`, `sourceStatementPackId` i `currency='PLN'`. Network: `POST /api/v8/finance/analyses` → 201, body `{ title, analysisType: 'comprehensive', currency: 'PLN', sourceStatementPackId }`, response `{ analysis: { id, title, analysisType, status, ... } }`. Hard-refresh `/finance?tab=analysis` = analiza widoczna na liście.

**Grafika**
`CreateAnalysisModal` (modal centralny, białe tło, max-w-md, rounded-2xl): pole `Analysis Name`, sekcja `Source statement pack` (border-slate-200, lista radio, max-h-48 scroll), brak sekcji amber (to nie investment_case). Przyciski „Cancel" + „Create" (emerald-600, disabled gdy brak tytułu lub brak wybranego pack). Po zamknięciu modalu — lista analiz w FinanceHub (zakładka `analysis`) odświeżona, nowa pozycja wyróżniona.

**Funkcjonalność**
`CreateAnalysisModal.tsx` (`handleCreate` → `V8FinanceApi.createAnalysis`, fallback `Api.post('/api/economics/financial-analyses')`), `useFinanceData.ts` (`loadAnalyses`), `FinanceHub.tsx` (`showAnalysisCreateModal`, `setShowAnalysisCreateModal`, `onCreated` → `loadAnalyses`). Endpoint: `POST /api/v8/finance/analyses`.

---

### MC-16A-02 · Investment Case Apator ICT — pola inwestycyjne z realnymi liczbami · [Tworzenie / investment_case] [DB] [V8] [INVESTMENT]

**Co się dzieje**
Konsultant przygotowuje uzasadnienie inwestycji dla Apator ICT: wdrożenie nowego ERP za 500 000 PLN. Przechodzi do zakładki `analysis`, klika „+ New analysis" → modal otwiera się z `defaultAnalysisType='comprehensive'`; konsultant zmienia typ na `investment_case` (albo przechodzi przez link tab=investment, który zmienia defaultAnalysisType). Modal pokazuje sekcję amber z nagłówkiem „Investment parameters". Wypełnia: Nakład inicjalny = `500000`, Horyzont = `5`, Stopa dyskontowa = `8`, Roczne korzyści = `120000`. Tytuł: „Apator ICT — ERP Investment Case". Wybiera statement pack, klika „Create".

**Efekty pracy**
Rekord z `analysisType='investment_case'`, `initialInvestment=500000`, `horizon=5`, `discountRatePct=8`, `annualBenefits=120000`. Network: `POST /api/v8/finance/analyses` → 201, body zawiera te 4 pola inwestycyjne. Response: `{ analysis: { id, kind, analysisType: 'investment_case', ... } }`. Hard-refresh = rekord widoczny w zakładce `investment` (FinanceHub filtruje `isInvestmentAnalysisType`).

**Grafika**
Modal z tytułem „New Investment Case" (tekst zmieniony dla investment_case). Sekcja amber: `border-amber-200 bg-amber-50/60` z nagłówkiem „INVESTMENT PARAMETERS" w amber-700, siatka 2×2 z polami: Initial investment (PLN) / Horizon (years) / Discount rate (%) / Annual benefits (PLN/yr). Placeholder "1 000 000" w polu nakładu. Pozostałe pola modal bez zmian.

**Funkcjonalność**
`CreateAnalysisModal.tsx` (`isInvestmentCase = defaultAnalysisType === 'investment_case'`, `investmentPayload = { initialInvestment, horizon, discountRatePct, annualBenefits }`), `V8FinanceApi.createAnalysis`. `FinanceHub.tsx` (`activeTab === 'investment' ? 'investment_case' : 'comprehensive'`). Endpoint: `POST /api/v8/finance/analyses`.

---

### MC-16A-03 · DCF Analysis — Discounted Cash Flow z sourceStatementPack · [Tworzenie / dcf_analysis] [DB] [V8]

**Co się dzieje**
Konsultant Elkomtech przygotowuje wycenę metodą DCF dla nowej linii produktowej. Klika „+ New analysis", wpisuje tytuł „Elkomtech — DCF Q3 2026", w polu wyboru type (gdyby był dostępny selector) wskazuje `dcf_analysis`; jeśli modal nie posiada selectora typów (aktualnie `defaultAnalysisType` przekazywany z zewnątrz), konsultant korzysta z kontekstu API lub parametru URL. Wybiera statement pack zawierający sprawozdania finansowe Elkomtech z trzech ostatnich lat. Klika „Create". Weryfikuje w Network, że `analysisType='dcf_analysis'` w body żądania.

**Efekty pracy**
Rekord z `analysisType='dcf_analysis'`, `sourceStatementPackId` wskazujący na paczka Elkomtech. Network: `POST /api/v8/finance/analyses` → 201. Lista analiz odświeżona przez `loadAnalyses()`. Hard-refresh = analiza widoczna na liście zakładki `analysis`. Odnotować: jeśli modal nie posiada selectora typów po stronie UI, `analysisType` może zawsze wynosić `'comprehensive'` — to P2 bug (zanotuj jako ustalenie).

**Grafika**
Modal `CreateAnalysisModal` bez sekcji amber (dcf_analysis !== investment_case). Tytuł „New Financial Analysis". Lista statement packs z podglądem: `entityName • periodLabel • currency • completenessLabel`. Zaznaczony pack oznaczony ● i border-emerald-300. Przycisk „Create" aktywny po wpisaniu tytułu + wybraniu pack.

**Funkcjonalność**
`CreateAnalysisModal.tsx`, `V8FinanceApi.createAnalysis({ title, analysisType: 'dcf_analysis', currency, sourceStatementPackId })`. `useFinanceData.ts` (`loadAnalyses`). Odnotować: brak drop-down typów w modalu = P2.

---

### MC-16A-04 · Cost-Benefit Analysis — porównanie opcji strategicznych · [Tworzenie / cost_benefit] [DB] [V8]

**Co się dzieje**
Konsultant porównuje dwie opcje dla VTS Group: digitalizacja procesów sprzedaży vs rozbudowa kanału partnerskiego. Tworzy analizę `cost_benefit` pt. „VTS Group — CBA Digitalizacja vs Partnerzy 2026". Nie wybiera statement pack (brak dostępnych lub analiza bez danych historycznych) — weryfikuje, czy modal pozwala na Create bez pack (przycisk disabled = tak). Jeśli wymagany pack, dodaje szkieletowy pack. Klika „Create".

**Efekty pracy**
Rekord `analysisType='cost_benefit'`. Network: `POST /api/v8/finance/analyses` → 201. Odnotować, że `sourceStatementPackId` może być `undefined` jeśli nie wybrano pack, ale przycisk „Create" jest `disabled` bez wybranego pack (`disabled={!title.trim() || creating || !selectedStatementPackId}`). Jeśli wymagane = P1 blokada dla analiz bez danych finansowych. Rejestruje ustalenie.

**Grafika**
Modal z pustą sekcją statement packs jeśli brak dostępnych: komunikat „No statements available" (tekst `t('finance.analysis.noStatements')`). Przycisk Create szary (disabled). Jeśli pack dostępny — standardowy modal. Brak sekcji amber.

**Funkcjonalność**
`CreateAnalysisModal.tsx` (`disabled={!title.trim() || creating || !selectedStatementPackId}`), `availableStatements` prop. `FinanceHub.tsx` (przekazuje `availableStatements={workableStatements}`). Odnotować: czy workableStatements dostarcza dane do modalu analizy — sprawdzić `initialStatementPackId`.

---

### MC-16A-05 · Sensitivity Analysis — wrażliwość kluczowych założeń · [Tworzenie / sensitivity_analysis] [DB] [V8]

**Co się dzieje**
Konsultant bada wrażliwość modelu biznesowego VTS Group na zmianę kluczowych zmiennych: ceny energii (+20%), popytu (-15%), kosztów pracy (+10%). Tworzy analizę `sensitivity_analysis` pt. „VTS Group — Sensitivity: Energia / Popyt / Praca Q4 2026". Wybiera statement pack z danymi YTD 2026. Klika „Create". Po stworzeniu klika na rekord na liście → otwiera się `FinancialAnalysisWorkspace` (workspace z panelem bocznym + blokami ratios). Weryfikuje, że wybrany rekord załadował wskaźniki przez `GET /api/v8/finance/analyses/:id/ratios`.

**Efekty pracy**
Rekord z `analysisType='sensitivity_analysis'`. Network przy otwieraniu workspace: `GET /api/v8/finance/analyses/:id/ratios` → 200, response `{ ratios: [...] }` (lub pusta tablica). `FinancialAnalysisWorkspace.tsx` załadowany z listą analiz po lewej (`selectAnalysis` dispatch). Hard-refresh = workspace otwiera analizę przez `initialAnalysisId`.

**Grafika**
Po stworzeniu analizy — lista w panelu bocznym `FinancialAnalysisWorkspace` (aside w-72, bg-slate-950/80, border-r) z nową pozycją. Aktywna analiza: `bg-white/[0.08] text-slate-100`. Nagłówek workspace: label „RATIO ANALYSIS", title analizy (text-xl font-semibold), description „Only the 18 core KPI blocks...". Bloki ratios lub komunikat „No KPI values".

**Funkcjonalność**
`FinancialAnalysisWorkspace.tsx` (`fetchAnalyses` → `V8FinanceApi.getAnalyses`, `selectAnalysis` → `V8FinanceApi.getAnalysisRatios`), `useEffect` auto-select `initialAnalysisId`. `V8FinanceApi.getAnalyses`: `GET /api/v8/finance/analyses`. `V8FinanceApi.getAnalysisRatios`: `GET /api/v8/finance/analyses/:id/ratios`.

---

### MC-16A-06 · Scenario Analysis — warianty base/opt/pess · [Tworzenie / scenario_analysis] [DB] [V8]

**Co się dzieje**
Konsultant modeluje trzy scenariusze dla projektu digitalizacji Apator: bazowy (wzrost 8%), optymistyczny (wzrost 15%), pesymistyczny (wzrost 2%). Tworzy analizę `scenario_analysis` pt. „Apator — Scenariusze Digitalizacji 2027-2029". Wybiera pack ze sprawozdaniami Apator. Po stworzeniu otwiera workspace, weryfikuje ładowanie ratios (mogą być puste bez obliczonej analizy) i stan statusu `'pending'` / `'draft'`. Następnie wywołuje akcję `Przelicz ponownie` z row menu (reanalyze) i weryfikuje `POST /api/v8/finance/analyses/:id/run` → 200.

**Efekty pracy**
Rekord `analysisType='scenario_analysis'`. Network: `POST /api/v8/finance/analyses` → 201. Po `reanalyze`: `POST /api/v8/finance/analyses/:id/run` → 200, toast „Analiza przeliczona". Status może zmienić się na `'running'` / `'completed'`. Hard-refresh = status zaktualizowany.

**Grafika**
Row actions menu (FinanceHub lista): kontekstowe menu z akcją `Przelicz ponownie` (ikona `RefreshCw`), `Eksportuj` (ikona `Download`), `Zatwierdź` (ikona `CheckCircle`, wariant primary), `Edytuj`, `Usuń`. Spinner/loader podczas run jeśli widoczny. Toast sukcesu.

**Funkcjonalność**
`useFinanceRowActions.ts` (`tabSpecific` dla `row.kind === 'analysis'`: `reanalyze` → `V8FinanceApi.runAnalysis(row.id)`). `V8FinanceApi.runAnalysis`: `POST /api/v8/finance/analyses/:id/run`. Fallback: `Api.post('/api/economics/financial-analyses/:id/run')`.

---

### MC-16A-07 · Break-Even Analysis — próg rentowności nowej linii produktowej · [Tworzenie / break_even] [DB] [V8]

**Co się dzieje**
Elkomtech planuje uruchomić linię produktów IoT. Konsultant tworzy analizę `break_even` pt. „Elkomtech — Break-Even: Linia IoT 2026" powiązaną z pack Elkomtech FY2025. Po stworzeniu klika „Otwórz podgląd" (akcja `preview` w row menu) — FinanceHub otwiera podgląd po prawej stronie (`FinancePreviewPanel`). Weryfikuje, że panel boczny ładuje dane przez `GET /api/v8/finance/analyses/:id` lub przez `getAnalysisRatios`. Następnie klika „Zatwierdź" (approve) → `POST /api/v8/finance/analyses/:id/approve` → 200, toast „Analiza zatwierdzona", status → APPROVED.

**Efekty pracy**
Rekord `analysisType='break_even'`, status `APPROVED` po zatwierdzeniu. Network: `POST /api/v8/finance/analyses/:id/approve` → 200. Akcja `Zatwierdź` znika z row menu (warunek `row.status !== 'APPROVED'`). Hard-refresh = status `APPROVED` na liście.

**Grafika**
Row menu: `Zatwierdź` (CheckCircle, variant='primary', zielone tło), `Przelicz ponownie` (RefreshCw), `Utwórz wycenę` (TrendingUp, link do `/economics?tab=valuation&createFrom=financial_analysis&sourceId=:id`). Akcja `Zatwierdź` disabled po approvalе. `FinancePreviewPanel` po prawej (collapsed/expanded).

**Funkcjonalność**
`useFinanceRowActions.ts` (`approve` → `V8FinanceApi.approveAnalysis`, fallback `Api.post('/api/economics/financial-analyses/:id/approve')`). `loadAnalyses()` po approve. Akcja `createValuation` → `window.location.assign`.

---

### MC-16A-08 · Walidacja — brakująca nazwa = blokada przycisku Create · [Tworzenie / walidacja]

**Co się dzieje**
Konsultant otwiera `CreateAnalysisModal` i próbuje stworzyć analizę bez tytułu. Zostawia pole `Analysis Name` puste, wybiera statement pack, klika „Create" — weryfikuje, że przycisk jest `disabled` (szary) i nie wysyła żadnego żądania HTTP. Następnie wpisuje samą spację (whitespace) — nadal disabled (guard `!title.trim()`). Wpisuje prawidłową nazwę „Test Analysis" — przycisk aktywuje się. Usuwa nazwę ponownie → disabled. Weryfikuje też przypadek: brak wybranego statement pack (tytuł wpisany, pack nie wybrany) → disabled. Wreszcie wpisuje tytuł + wybiera pack → Create aktywny → klik → 201.

**Efekty pracy**
Brak żądania HTTP przy próbie kliknięcia disabled przycisku. Network tab: cisza. Stan UI: `disabled={!title.trim() || creating || !selectedStatementPackId}`. Dopiero przy tytule + pack → `POST /api/v8/finance/analyses` → 201. Edge: guard `handleCreate` → `if (!title.trim()) return` (linia 53 CreateAnalysisModal.tsx).

**Grafika**
Przycisk „Create" (emerald-600): `disabled:opacity-50` = szary, kursor not-allowed. Pole tytułu bez red-border (brak wizualnego error state — odnotować jako P3 brak komunikatu walidacji). Sekcja statement pack ze stanem `0 selected` gdy nic niezaznaczone.

**Funkcjonalność**
`CreateAnalysisModal.tsx` (`disabled={!title.trim() || creating || !selectedStatementPackId}`, `handleCreate` guard `if (!title.trim()) return`). Walidacja kliencka, brak żądania HTTP. Odnotować: brak komunikatu błędu inline = P3.

---

# B. Investment Case — pola inwestycyjne

---

### MC-16A-09 · Zmiana tytułu modalu dla investment_case ("New Investment Case") · [Investment / modal title] [INVESTMENT]

**Co się dzieje**
Konsultant przechodzi do zakładki `investment` w FinanceHub (`/finance?tab=investment`). Klika „+ New analysis" (CTA). Modal otwiera się z `defaultAnalysisType='investment_case'` (FinanceHub przekazuje `activeTab === 'investment' ? 'investment_case' : 'comprehensive'`). Weryfikuje, że tytuł modalu zmienił się na „New Investment Case" (PL: tłumaczenie klucza `finance.investment.createTitle`), a NIE standardowe „New Financial Analysis". Zamyka modal, przechodzi do zakładki `analysis`, otwiera modal → tytuł „New Financial Analysis". Potwierdza rozbieżność tytułów.

**Efekty pracy**
Brak zapisu DB (test UI). Konkluzja: `isInvestmentCase = defaultAnalysisType === 'investment_case'` zmienia tekst `h3` w modalu. Network: zero żądań przy samym otwarciu modalu. Warunek w kodzie: `CreateAnalysisModal.tsx` linia 122-126. Stan zakładki investment poprawnie zmienia typ.

**Grafika**
Modal `CreateAnalysisModal`: nagłówek `h3` — tekst „New Investment Case" (investment tab) vs „New Financial Analysis" (analysis tab). Czcionka: `text-lg font-bold text-slate-900`. Brak sekcji amber przy typ `comprehensive`. Sekcja amber widoczna przy `investment_case`.

**Funkcjonalność**
`FinanceHub.tsx` (`<CreateAnalysisModal defaultAnalysisType={activeTab === 'investment' ? 'investment_case' : 'comprehensive'} />`). `CreateAnalysisModal.tsx` (`isInvestmentCase`, warunkowy `h3`). Klucz i18n: `finance.investment.createTitle`.

---

### MC-16A-10 · Sekcja amber z 4 polami — widoczność i wartości domyślne · [Investment / amber section] [INVESTMENT]

**Co się dzieje**
Konsultant otwiera modal Investment Case (tab=investment) i szczegółowo weryfikuje sekcję amber. Sprawdza: (1) border amber (`border-amber-200`), (2) tło `bg-amber-50/60`, (3) nagłówek „INVESTMENT PARAMETERS" w uppercase amber-700, (4) siatka 2×2 z 4 polami: Initial investment (PLN) / Horizon (years) / Discount rate (%) / Annual benefits (PLN/yr). Weryfikuje wartości domyślne załadowane ze stanu: `horizon='5'`, `discountRatePct='10'`, `initialInvestment=''` (puste), `annualBenefits=''` (puste). Placeholder pola nakładu = „1 000 000". Zmienia horyzont na 7 i stopę na 12% — wartości w inputach aktualizują się.

**Efekty pracy**
Test UI, brak zapisu DB. Stan komponentu: `useState` hooks `horizon` (default '5'), `discountRatePct` (default '10'), `initialInvestment` (default ''), `annualBenefits` (default ''). Kontrola wizualna sekcji amber — jeśli nie widać = FAIL (regresja `isInvestmentCase`).

**Grafika**
Sekcja amber: `rounded-xl border border-amber-200 bg-amber-50/60 p-4`. Nagłówek `text-xs font-semibold text-amber-700 uppercase tracking-wide`. Siatka `grid grid-cols-2 gap-3`. Każde pole: `label text-xs text-slate-500` + `input type="number"`. Pole `Horizon` ma `min=1 max=30`, stopa ma `min=0 max=100 step=0.5`.

**Funkcjonalność**
`CreateAnalysisModal.tsx` (linie 140-198): warunkowy render `{isInvestmentCase && ( <div className="...amber..."> )}`. Stan: `useState` dla `initialInvestment`, `horizon` ('5'), `discountRatePct` ('10'), `annualBenefits`. Ograniczenia min/max inputów.

---

### MC-16A-11 · Payload zawiera investmentFields — weryfikacja Network · [Investment / payload] [V8] [INVESTMENT]

**Co się dzieje**
Konsultant tworzy Investment Case dla Apator ICT z następującymi parametrami: nakład inicjalny = 750 000 PLN, horyzont = 7 lat, stopa dyskontowa = 12%, roczne korzyści = 180 000 PLN. Tytuł: „Apator ICT — System MES Investment Case". Klika „Create". Otwiera DevTools → Network → filtruje żądania POST → wyświetla body `POST /api/v8/finance/analyses`. Weryfikuje, że body zawiera:
```json
{
  "title": "Apator ICT — System MES Investment Case",
  "analysisType": "investment_case",
  "currency": "PLN",
  "sourceStatementPackId": "...",
  "initialInvestment": 750000,
  "horizon": 7,
  "discountRatePct": 12,
  "annualBenefits": 180000
}
```
Weryfikuje typy: `initialInvestment` = Number (nie string), `horizon` = parseInt (nie string).

**Efekty pracy**
Network: `POST /api/v8/finance/analyses` → 201. Body JSON = dokładnie jak powyżej z `parseFloat`/`parseInt` (linia 58-63 CreateAnalysisModal.tsx). Brak pól inwestycyjnych gdy pusty string → `undefined` (nie `NaN`). Response: `{ analysis: { id, title, analysisType: 'investment_case', ... } }`.

**Grafika**
DevTools Network → Request Payload: JSON z 8 polami. Sekcja amber pól przed wysłaniem: wszystkie wypełnione cyframi, bez liter/specjalnych znaków. Toast „Analiza utworzona" po 201.

**Funkcjonalność**
`CreateAnalysisModal.tsx` linie 56-63: `investmentPayload = { initialInvestment: parseFloat(initialInvestment) || undefined, horizon: parseInt(horizon, 10) || undefined, discountRatePct: parseFloat(discountRatePct) || undefined, annualBenefits: parseFloat(annualBenefits) || undefined }`. `V8FinanceApi.createAnalysis`.

---

### MC-16A-12 · Horyzont domyślny 5, stopa 10 — bez edycji przez usera · [Investment / defaults] [INVESTMENT]

**Co się dzieje**
Konsultant otwiera modal Investment Case, nie modyfikuje pól inwestycyjnych (tylko wpisuje tytuł i wybiera pack), klika „Create". Weryfikuje w Network payload — czy `horizon=5` i `discountRatePct=10` (wartości `parseInt('5')` i `parseFloat('10')`) pojawiają się w body, pomimo że user ich nie edytował. To test istotny z perspektywy produktowej: domyślne parametry muszą być wysłane (inaczej backend mógłby przyjąć `undefined` zamiast sensownych wartości NPV). Edge: sprawdza, że `horizon=0` (pusty string → `parseInt('', 10) = NaN`) NIE jest wysłane jako 0 — guard powinien przekazać `undefined`.

**Efekty pracy**
Network: `POST /api/v8/finance/analyses`, body zawiera `horizon: 5` i `discountRatePct: 10` (z domyślnych state). Wynik testu: potwierdzenie, że defaulty '5' / '10' działają jako sensowne fallbacki. Edge: sprawdzić zachowanie przy `initialInvestment=''` → `parseFloat('') = NaN` → `undefined` (nie `NaN`).

**Grafika**
Sekcja amber z wartościami domyślnymi: pola Horizon = „5", Discount rate = „10", reszta pusta. Przycisk Create aktywny (tytuł wpisany + pack wybrany). Payload sprawdzany przez DevTools.

**Funkcjonalność**
`useState('5')`, `useState('10')` + `parseInt`/`parseFloat` w `investmentPayload`. Guard `initialInvestment ? parseFloat(initialInvestment) : undefined`. Dokumentuj zachowanie przy `NaN`.

---

### MC-16A-13 · Zmiana typu z investment_case na roi_analysis — sekcja amber znika · [Investment / type switch]

**Co się dzieje**
Konsultant jest w zakładce `investment`, otwiera modal Investment Case. Sekcja amber widoczna. Teraz konsultant przechodzi do zakładki `analysis` (nie zamykając tabeli, tylko zmieniając tab) i klika „+ New analysis" — modal otwiera się z `defaultAnalysisType='comprehensive'` (nie `investment_case`). Sekcja amber nie powinna być widoczna (`isInvestmentCase = false`). Weryfikuje, że UI renderuje wyłącznie pole `Analysis Name` + sekcję statement pack + przyciski — bez sekcji amber. Następnie sprawdza: czy `CreateAnalysisModal` jest montowany z nowym `defaultAnalysisType` przy każdym otwarciu (brak stale state między otwarciami).

**Efekty pracy**
Test UI. W modalu zakładki `analysis`: brak `<div className="...amber...">`. Kod: `isInvestmentCase = defaultAnalysisType === 'investment_case'` = false → React nie renderuje sekcji amber. Brak ryzyka zachowania pól inwestycyjnych w stanie między zakładkami (komponent montowany na nowo przy każdym `showAnalysisCreateModal=true`).

**Grafika**
Modal w zakładce `analysis`: brak sekcji amber. Widoczne pola: `Analysis Name` + `Source statement pack` + przyciski. Porównanie z zakładką `investment`: sekcja amber widoczna z 4 polami w siatce. Rozmiar modalu większy przy investment_case (wyższy o sekcję amber).

**Funkcjonalność**
`FinanceHub.tsx` (`setShowAnalysisCreateModal(true)`, `defaultAnalysisType={activeTab === 'investment' ? 'investment_case' : 'comprehensive'}`). `CreateAnalysisModal.tsx` (`isInvestmentCase`). Montowanie = stan zresetowany (useState z defaultami).

---

# C. Wskaźniki finansowe

---

### MC-16A-14 · Blok Rentowność — gross_margin_pct, EBITDA, net_profit, contribution · [Ratios / profitability] [V8]

**Co się dzieje**
Konsultant otwiera analizę VTS Group w `FinancialAnalysisWorkspace`. Po załadowaniu ratios (`GET /api/v8/finance/analyses/:id/ratios`) sprawdza blok 1 „Rentowność" (profitability). Weryfikuje cztery wskaźniki: `gross_margin_pct` (format %, formula `(Gross Profit / Revenue) * 100`, benchmarkHint `>= 30%`), `ebitda_margin_pct` (>= 15%), `net_profit_margin_pct` (>= 8%), `contribution_margin_pct` (>= 20%). Dla każdego: odczytuje wartość w kolumnie „Wyliczenie" (format `XX.XX%`), czyta formułę pod wartością, czyta interpretację (lub komunikat „Brak automatycznej interpretacji"), sprawdza benchmark column (wartość lub `—`). Weryfikuje, że formatowanie `percent` działa: wartość 35.5 → „35.50%".

**Efekty pracy**
Network: `GET /api/v8/finance/analyses/:id/ratios` → 200, `{ ratios: [{ id, ratio_code: 'gross_margin_pct', ratio_name, value, period, interpretation, benchmark_value }, ...] }`. `groupRatiosForBlocks` grupuje ratios według `RATIO_BLOCKS[0].codes`. `getLatestRatios` filtruje według najpóźniejszego okresu. Formatowanie `formatRatioValue(value, 'percent', fmtNumber)`.

**Grafika**
`RatioBlocksTable` → `section` per blok, `overflow-hidden rounded-2xl bg-white/[0.03]`. Nagłówek: „Blok 1" (text-[11px] uppercase slate-500), „Rentowność" (text-sm font-semibold slate-100), subtitle. Tabela min-w-[980px]: kolumny „Wskaźnik" / „Wyliczenie" / „Interpretacja" / „Wskaźnik branżowy". Wartości w `font-mono text-sm text-slate-100`. Benchmark w `font-mono` + hint poniżej w slate-500. Tło dark: `bg-slate-950`.

**Funkcjonalność**
`FinancialAnalysisWorkspace.tsx` (`RATIO_BLOCKS[0]` profitability, `RATIO_META`, `formatRatioValue`, `RatioBlocksTable`). `V8FinanceApi.getAnalysisRatios`: `GET /api/v8/finance/analyses/:id/ratios`. `getLatestRatios`, `groupRatiosForBlocks`. Fallback: `Api.get('/api/economics/financial-analyses/:id/ratios')`.

---

### MC-16A-15 · Blok Koszty i Struktura — COGS, labor, energy ratios · [Ratios / cost_control] [V8]

**Co się dzieje**
Konsultant analizuje strukturę kosztów Apator ICT. W workspace otwiera analizę Apator, ładuje ratios. Przechodzi do bloku 2 „Koszty i Struktura" (cost_control): `cogs_to_revenue_pct` (formula `(COGS / Revenue) * 100`, benchmark `<= 65%`), `labor_cost_ratio_pct` (`<= 18%`), `energy_cost_ratio_pct` (`<= 8%`). Dla branży produkcyjnej Apator weryfikuje, czy benchmarki są realistyczne. Sprawdza, że blok renderuje się TYLKO gdy `items.length > 0` (warunkowy render `if (items.length === 0) return null`). Jeśli blok pusty (brak kodów w danych) — sprawdza brak crash i brak pustego `<section>`.

**Efekty pracy**
Network: `GET /api/v8/finance/analyses/:id/ratios` → 200, response zawiera lub nie zawiera kody bloku `cost_control`. Jeśli 3 kody w response → blok renderuje się z 3 wierszami. Jeśli brak — blok niewidoczny (warunkowy return null). Brak crash przy pustych blokach.

**Grafika**
Blok 2 „Koszty i Struktura": subtitle „Czy produkcja, praca i energia są pod kontrolą." Kolumna „Wskaźnik branżowy": `<= 65%` dla COGS. Wartości `%` w font-mono. Brak bloku = brak `<section>` w DOM. Scrollowalna tabela `overflow-x-auto`.

**Funkcjonalność**
`FinancialAnalysisWorkspace.tsx` (`RATIO_BLOCKS[1]` cost_control, kody: cogs_to_revenue_pct / labor_cost_ratio_pct / energy_cost_ratio_pct). `groupRatiosForBlocks` → `byCode.get(code)` — brak kodu = `undefined` → `.filter(Boolean)`. `return null` gdy `items.length === 0`.

---

### MC-16A-16 · Blok Płynność i Cash — current_ratio, quick_ratio, CCC · [Ratios / cash_liquidity] [V8]

**Co się dzieje**
Konsultant diagnostykuje ryzyko płynnościowe Elkomtech (firma z wydłużonym cyklem należności). W bloku 3 „Płynność i Cash" sprawdza: `current_ratio` (format `multiple`, benchmark `>= 1.5x`), `quick_ratio` (`>= 1.0x`), `cash_conversion_cycle` (format `days`, benchmark `<= 45 dni`), `operating_cf_to_ebitda` (`>= 0.8x`), `free_cash_flow` (format `currency`, benchmark `> 0`). Dla `current_ratio = 1.23` → formatowanie `formatRatioValue(1.23, 'multiple', fmt)` → „1.23x". Dla `free_cash_flow = -500000` → wartość ujemna w PLN bez specjalnego oznaczenia. Sprawdza obecność pola `Okres` pod nazwą wskaźnika (podtytuł `Okres: {ratio.period}`).

**Efekty pracy**
Network: ratios z bloku `cash_liquidity` obecne w response. Formatowanie: `percent` → `XX.XX%`, `multiple` → `XX.XXx`, `days` → `XX.XX d`, `currency` → liczba sformatowana Intl bez jednostki. `getLatestRatios` wybiera ostatni dostępny okres z set dat.

**Grafika**
Blok 3 „Płynność i Cash": subtitle „Tu firmy się wywracają." Kolumna „Wskaźnik": nazwa (`font-medium text-slate-100`) + „Okres: 2025-Q4" (`text-xs text-slate-500`). Kolumna „Wyliczenie": wartość mono + formula poniżej. Benchmark: wartość + hint `>= 1.5x` (slate-500). Dark background `bg-slate-950`.

**Funkcjonalność**
`FinancialAnalysisWorkspace.tsx` (`RATIO_BLOCKS[2]` cash_liquidity, kody: current_ratio / quick_ratio / cash_conversion_cycle / operating_cf_to_ebitda / free_cash_flow). `RATIO_META` dla każdego kodu. `formatRatioValue` 4 formaty. `getLatestRatios` (sortuje periods, wybiera `.at(-1)`).

---

### MC-16A-17 · Blok Kapitał Obrotowy — inventory_days, DSO, DPO, turnover · [Ratios / working_capital] [V8]

**Co się dzieje**
Konsultant analizuje efektywność zarządzania kapitałem obrotowym w VTS Group — dużym producencie z długim cyklem produkcyjnym. Blok 4 „Kapitał Obrotowy": `inventory_days` (formula `(Inventory / COGS) * 365`, format `days`, benchmark `<= 75 dni`), `dso` (Days Sales Outstanding, `<= 45 dni`), `dpo` (Days Payable Outstanding, `~ 60 dni`), `inventory_turnover` (`>= 5.0x`). Konsultant interpretuje: DSO = 67 dni (powyżej benchmarku = problem z należnościami). Sprawdza kolumnę „Interpretacja" — czy system dostarcza automatyczną interpretację dla tych kodów czy placeholder „Brak automatycznej interpretacji dla tego KPI."

**Efekty pracy**
Network: ratios bloku `working_capital`. Wartości days: `formatRatioValue(67, 'days', fmt)` → „67.00 d". Turnover: `formatRatioValue(4.2, 'multiple', fmt)` → „4.20x". Kolumna Interpretacja: `ratio.interpretation` z response (jeśli backend wylicza) albo fallback tekst.

**Grafika**
Blok 4 „Kapitał Obrotowy": subtitle „Gdzie gotówka blokuje się w operacji." DPO benchmark: „~ 60 dni" (hint relatywny, nie >= / <=). DSO format days. Tabela min-w-[980px] wymagająca horizontal scroll na wąskim ekranie.

**Funkcjonalność**
`FinancialAnalysisWorkspace.tsx` (`RATIO_BLOCKS[3]` working_capital, kody: inventory_days / dso / dpo / inventory_turnover). `RATIO_META`: formula + format + benchmarkHint. Fallback `interpretation || 'Brak automatycznej interpretacji...'`.

---

### MC-16A-18 · Blok Zadłużenie i Stabilność — debt_to_ebitda, interest_coverage · [Ratios / leverage] [V8]

**Co się dzieje**
Konsultant ocenia stabilność finansową Apator pod kątem zdolności kredytowej i obsługi długu. Blok 5 „Zadłużenie i Stabilność": `debt_to_ebitda` (formula `Total Debt / EBITDA`, format `multiple`, benchmark `<= 3.0x`), `interest_coverage` (formula `EBIT / Interest Expense`, format `multiple`, benchmark `>= 4.0x`). Dla `debt_to_ebitda = 4.5` → przekroczony benchmark `<= 3.0x` = czerwona flaga. Konsultant sprawdza, czy UI sygnalizuje przekroczenie benchmarku kolorystycznie (jeśli nie — P3 gap do odnotowania). Następnie korzysta z pola `benchmark_value` z response (backend ustawia wartość referencyjną) vs `benchmarkHint` (klient ustawia opis zakresu).

**Efekty pracy**
Network: ratios bloku `leverage` z `ratio_code: 'debt_to_ebitda'`, `value: 4.5`, `benchmark_value: 3.0`. Formatowanie: `4.50x` (wartość) vs `3.00x` (benchmark). Brak kolorystycznej sygnalizacji przekroczenia = P3 (brak warunkowego className w tabeli) — odnotować. `benchmark_value ?? benchmark` — oba pola obsługiwane.

**Grafika**
Blok 5 „Zadłużenie i Stabilność": subtitle „Poziom ryzyka finansowego i obsługa odsetek." Kolumna „Wskaźnik branżowy": wartość `benchmark_value` w font-mono (jeśli istnieje) + hint poniżej. Bez koloru red/green dla przekroczeń — monochrome design. Tylko 2 wskaźniki → krótka tabela.

**Funkcjonalność**
`FinancialAnalysisWorkspace.tsx` (`RATIO_BLOCKS[4]` leverage, kody: debt_to_ebitda / interest_coverage). `const benchmark = ratio.benchmark_value ?? ratio.benchmark` (linia 491). `formatRatioValue(benchmark, meta.format, fmtNumber)`. P3: brak `className` conditional na przekroczenie.

---

### MC-16A-19 · Brak danych KPI — komunikat "No KPI values available" · [Ratios / empty state] [V8]

**Co się dzieje**
Konsultant tworzy nową analizę bez powiązanego statement pack z danymi liczbowymi (lub analizę świeżo stworzoną bez uruchomionego `run`). Po otwarciu workspace i wybraniu tej analizy — `GET /api/v8/finance/analyses/:id/ratios` zwraca pustą listę `{ ratios: [] }`. Sprawdza, że: (1) `hasRatios = false` (wszystkie bloki puste), (2) widoczny komunikat „No KPI values are available yet for this analysis." zamiast tabel, (3) brak crash, (4) nagłówek workspace nadal widoczny (tytuł, status, waluta, okres). Weryfikuje też przypadek częściowy: ratios dla niektórych bloków — bloki z danymi widoczne, puste bloki `return null`.

**Efekty pracy**
Network: `GET /api/v8/finance/analyses/:id/ratios` → 200, `{ ratios: [] }`. `hasRatios = Object.values(groupedRatios).some((items) => items.length > 0)` = false → render empty state `<div className="...text-center...">`. Brak crash. Odnotować: czy status analizy wskazuje na potrzebę uruchomienia `run`.

**Grafika**
Workspace z zaznaczoną analizą: nagłówek (RATIO ANALYSIS / tytuł / description / badges status+currency+period). Poniżej: `rounded-2xl bg-white/[0.03] px-5 py-10 text-center text-sm text-slate-500` z komunikatem braku danych. Brak tabel, brak bloków.

**Funkcjonalność**
`FinancialAnalysisWorkspace.tsx` (`hasRatios`, warunkowy render: `{!hasRatios ? <div>No KPI...</div> : <RatioBlocksTable />}`). `groupRatiosForBlocks(ratios)` zwraca wszystkie puste tablice.

---

# D. AI Insights

---

### MC-16A-20 · Generowanie AI insights (POST /insights) — realny LLM · [AI Insights] [REAL-AI] [V8]

**Co się dzieje**
Konsultant chce uzyskać od AI komentarz do wskaźników VTS Group. W workspace lub FinanceHub klika przycisk „Generuj insights" (jeśli istnieje w UI) lub wywołuje akcję z row menu / panelu analizy. System wysyła `POST /api/v8/finance/analyses/:id/insights` — realny LLM analizuje ratios i zwraca listę insightów. Konsultant odczytuje odpowiedź: każdy insight zawiera tekst interpretacji wskaźnika, powiązanie z ratio_code i rekomendację działania. Weryfikuje w Network: żądanie z `analysisId`, odpowiedź `{ insights: [...] }`. Odnotowuje, że wyniki są zmienne (realny LLM).

**Efekty pracy**
Network: `POST /api/v8/finance/analyses/:id/insights` → 200/201, body `{}` lub `{ context }`, response `{ insights: [{ id, text, ratioCode, recommendation, ... }] }`. Realny LLM (nie mock) — odpowiedź różni się między uruchomieniami. Odnotować: czy button insightów istnieje w aktualnym UI (`FinancialAnalysisWorkspace` — sprawdzić brak widocznego przycisku = P2 gap).

**Grafika**
Panel insightów (jeśli zaimplementowany): lista kart z tekstem / powiązanym ratio / rekomendacją. Loader podczas oczekiwania na LLM. Toast sukcesu lub panel z wynikami. Jeśli brak UI — odnotować jako P2 (endpoint istnieje w V8FinanceApi ale UI może nie mieć przycisku w FinancialAnalysisWorkspace).

**Funkcjonalność**
`V8FinanceApi` (brak `postInsights` w widocznym kodzie — sprawdzić). Endpoint: `POST /api/v8/finance/analyses/:id/insights`. Weryfikuj istnienie w `src/services/api/v8/finance.ts`. Odnotować lukę jeśli brak w API clientze lub UI.

---

### MC-16A-21 · Lista AI insights (GET /insights) po wygenerowaniu · [AI Insights / list] [V8]

**Co się dzieje**
Po wygenerowaniu insightów (MC-16A-20) konsultant przeładowuje stronę (`hard-refresh`) i sprawdza, czy insights przetrwały w bazie. System wywołuje `GET /api/v8/finance/analyses/:id/insights` po otwarciu analizy (albo na żądanie). Weryfikuje, że lista insightów z poprzedniej sesji nadal dostępna. Porównuje liczbę insightów przed i po refresh. Sprawdza, że insights są przypisane do konkretnej analizy (nie globalnie). Testuje edge: brak insightów (brak poprzedniego wygenerowania) → pusta lista lub komunikat „Brak insightów".

**Efekty pracy**
Network: `GET /api/v8/finance/analyses/:id/insights` → 200, `{ insights: [...] }` lub `{ insights: [] }`. Hard-refresh = stan zachowany (DB-backed). Odnotować: czy endpoint `GET /insights` jest wywoływany automatycznie przy load analizy, czy dopiero po explicit fetch.

**Grafika**
Panel insightów (jeśli UI istnieje): lista wczytanych z DB insightów. Data wygenerowania każdego insightu. Powiązanie z `ratio_code`. Jeśli UI brak — odnotować P2 gap (endpoint v8 istnieje, UI niedomagające).

**Funkcjonalność**
`GET /api/v8/finance/analyses/:id/insights`. Endpoint opisany w specyfikacji zadania. Sprawdzić w `V8FinanceApi` — jeśli brak = luka w kliencie API.

---

### MC-16A-22 · Insights powiązane z wskaźnikami ratios · [AI Insights / ratio linkage] [V8]

**Co się dzieje**
Konsultant weryfikuje jakość powiązania insightów z konkretnymi wskaźnikami finansowymi. Po wygenerowaniu insightów sprawdza, czy każdy insight ma pole `ratio_code` odpowiadające kodowi z `RATIO_META` (np. `gross_margin_pct`, `current_ratio`). W panelu insightów klika insight dotyczący płynności → oczekuje nawigacji/podświetlenia do bloku 3 „Płynność i Cash" w tabeli ratios (cross-reference). Odnotowuje, czy cross-reference jest zaimplementowany w UI, czy tylko na poziomie danych. Jeśli brak nawigacji = P3 gap UX.

**Efekty pracy**
Network: GET insights → `[{ ratioCode: 'current_ratio', text: '...', ... }]`. Cross-reference UI: scrollTo do sekcji `cash_liquidity` lub podświetlenie wiersza (jeśli zaimplementowane). Brak crash. Odnotować brak cross-reference jako P3 jeśli niewidoczny.

**Grafika**
Insight karta z tagiem ratio (np. badge `current_ratio`). Jeśli nawigacja: podświetlony wiersz w tabeli ratios (ring lub bg-zmiana). Bez nawigacji: statyczna lista insightów.

**Funkcjonalność**
Powiązanie `insight.ratio_code` z `RATIO_META` kluczem. `FinancialAnalysisWorkspace.tsx` — sprawdzić implementację panelu insightów. `GET /api/v8/finance/analyses/:id/insights`.

---

### MC-16A-23 · Teresa AI — kontekst analizy w czacie finansowym · [AI / chat context]

**Co się dzieje**
Konsultant otwiera czat Teresa z poziomu wiersza analizy — klika akcję `Chat` (ikonka `MessageCircle`) z row menu FinanceHub (`handleOpenEntityChat`). Oczekuje, że czat otwiera się z kontekstem analizy: tytuł analizy w promptcie wstępnym, wskaźniki finansowe w system prompt lub pierwszej wiadomości. Pyta Teresę: „Jakie są główne ryzyka dla tej analizy na podstawie wskaźników płynności?". Weryfikuje w Network: żądanie czatu (`POST /api/chat` lub `/api/teresa`) zawiera `context.analysisId` lub `context.ratios`. Odnotowuje, czy odpowiedź uwzględnia konkretne dane (nie generyczna).

**Efekty pracy**
Network: `POST /api/chat` (lub odpowiednik) z body zawierającym `sourceType: 'financial_analysis'`, `sourceId: analysisId`. Teresa odpowiada z uwzględnieniem kontekstu analizy. Odnotować: jeśli `handleOpenEntityChat` tylko otwiera pusty czat bez kontekstu = P2 gap.

**Grafika**
Panel czatu po prawej stronie FinanceHub (lub nawigacja do `/chat`). Wstępna wiadomość systemu: kontekst analizy. Pole wpisywania pytania. Toast/loader podczas odpowiedzi Teresa.

**Funkcjonalność**
`useFinanceRowActions.ts` (`handleOpenEntityChat` → callback z `row`). `FinanceHub.tsx` (`handleOpenEntityChat` prop). Sprawdzić jak wiring z czatem Teresa.

---

# E. Benchmarking i porównania

---

### MC-16A-24 · Dodanie benchmarku branżowego (POST /benchmarks) · [Benchmarking] [V8]

**Co się dzieje**
Konsultant chce porównać wskaźniki VTS Group z danymi branżowymi dla sektora HVAC w Polsce. W workspace lub FinanceHub dla wybranej analizy wywołuje akcję „Dodaj benchmark" (jeśli dostępna w UI). System wysyła `POST /api/v8/finance/analyses/:id/benchmarks` z body zawierającym dane referencyjne branży (np. `{ industryCode: 'HVAC_PL', source: 'GUS2025' }`). Response aktualizuje pole `benchmark_value` przy ratios. Konsultant sprawdza w tabeli ratios, że kolumna „Wskaźnik branżowy" wyświetla teraz wartości numeryczne zamiast `—`. Weryfikuje, że `benchmark = ratio.benchmark_value ?? ratio.benchmark`.

**Efekty pracy**
Network: `POST /api/v8/finance/analyses/:id/benchmarks` → 200/201. `GET /api/v8/finance/analyses/:id/ratios` po operacji zwraca ratios z wypełnionym `benchmark_value`. Tabela ratios: kolumna „Wskaźnik branżowy" = wartości liczbowe. Odnotować: jeśli brak przycisku w UI = P2 gap (endpoint v8 istnieje w specyfikacji).

**Grafika**
Przed: kolumna benchmark = `—` (brak wartości). Po: wartości `1.50x`, `30.00%` itp. w font-mono + hint poniżej. Toast sukcesu po dodaniu benchmarku. Panel lub modal wyboru benchmarku (jeśli istnieje w UI).

**Funkcjonalność**
`POST /api/v8/finance/analyses/:id/benchmarks` (endpoint opisany w spec zadania). `V8FinanceApi` — sprawdzić czy `postBenchmarks` zaimplementowane w kliencie. `formatRatioValue(benchmark, meta.format, fmtNumber)`.

---

### MC-16A-25 · Porównanie YoY — dwa okresy w jednej analizie · [Benchmarking / YoY] [V8]

**Co się dzieje**
Konsultant analizuje trend rentowności Apator przez dwa lata: FY2024 vs FY2025. W workspace sprawdza, czy `getLatestRatios` pokazuje TYLKO ostatni okres, czy jest możliwość przełączenia na inne okresy. Sprawdza mechanizm `getLatestRatios`: sortuje `periods`, wybiera `.at(-1)` — weryfikuje, że gdy response zawiera ratios z periodami `['2024-Q4', '2025-Q4']`, wyświetlane są tylko `2025-Q4`. Testuje edge: co się dzieje przy ratios bez `period` (null) — `getLatestRatios` zwraca całą listę. Odnotowuje, czy UI oferuje selektor okresu (brak = P2).

**Efekty pracy**
Network: `GET /api/v8/finance/analyses/:id/ratios` → response z ratios z różnymi `period`. `getLatestRatios` zwraca najnowszy. `latestPeriod = getLatestRatios(ratios)[0]?.period || '—'` widoczny w badge nagłówka workspace. Odnotować: brak selectora okresu = P2 (YoY niedostępne w UI).

**Grafika**
Badge w nagłówku workspace: „Okres: 2025-Q4" (rounded-full bg-white/[0.04]). Tabela zawiera wiersze tylko z najnowszego okresu. Kolumna „Wskaźnik" → podtytuł „Okres: 2025-Q4".

**Funkcjonalność**
`FinancialAnalysisWorkspace.tsx` (`getLatestRatios`, `latestPeriod`, `groupRatiosForBlocks(ratios)` → używa `getLatestRatios` wewnątrz). Edge: `period = null` → set z null → filtr null periods → brak sort → zwraca wszystkie. P2: brak selectora okresu.

---

### MC-16A-26 · Peer comparison — wskaźnik benchmark_value w tabeli ratios · [Benchmarking / peer] [V8]

**Co się dzieje**
Konsultant porównuje `interest_coverage` Elkomtech z peer group (3 konkurentów z branży elektronicznej). Backend wypełnia `benchmark_value=5.2` dla `interest_coverage` (np. mediana peer grupy). Konsultant w tabeli ratios bloku 5 „Zadłużenie" odczytuje: wartość firmy `3.1x` vs benchmark `5.20x` (poniżej benchmarku `>= 4.0x` = problem). Sprawdza obydwa pola: `ratio.benchmark_value` (backend) i `RATIO_META['interest_coverage'].benchmarkHint` (`>= 4.0x`). Oba wyświetlane w kolumnie „Wskaźnik branżowy": numeryczna wartość (z backend) + opis zakresu (z frontend meta) poniżej w slate-500.

**Efekty pracy**
Network: `GET /api/v8/finance/analyses/:id/ratios` → `{ ratios: [{ ratio_code: 'interest_coverage', value: 3.1, benchmark_value: 5.2, interpretation: '...' }] }`. Render: wartość `3.10x` (firma) + benchmark `5.20x` (peer mediana) + hint `>= 4.0x`. Logika: `const benchmark = ratio.benchmark_value ?? ratio.benchmark` (linia 491 workspace).

**Grafika**
Kolumna „Wskaźnik branżowy": font-mono `5.20x` (kolor slate-100) + poniżej tekst xs `>= 4.0x` (kolor slate-500). Dwa źródła informacji: numeryczna (backend) + tekstowa (frontend meta). Brak kolorystycznego sygnalizowania ryzyka — monochrome.

**Funkcjonalność**
`FinancialAnalysisWorkspace.tsx` (linie 491, 510-515): `benchmark_value ?? benchmark`, `formatRatioValue(benchmark, ...)`, `meta.benchmarkHint || 'Reference range'`. `V8FinanceAnalysisRatio` interface: `benchmark_value?: number | null`.

---

# F. Zarządzanie i eksport

---

### MC-16A-27 · Edycja metadanych analizy (Edytuj w row actions) · [Zarządzanie / edit] [V8]

**Co się dzieje**
Konsultant chce zmienić tytuł analizy VTS Group (np. dodać sufiks „— wersja zatwierdzona"). Klika akcję „Edytuj" (Pencil icon) z row menu FinanceHub — `getRowActions` → akcja `edit` → `handleOpenFull(row)`. Sprawdza, jaki flow uruchamia `handleOpenFull` dla `kind='analysis'`: otwiera `FinancialAnalysisWorkspace` (nie modal edycji). Odnotowuje, że aktualnie edycja to „otwórz pełny workspace", a nie dedykowany modal edycji tytułu. Weryfikuje PATCH endpoint: sprawdza, czy `PATCH /api/v8/finance/analyses/:id` jest wywoływany przy modyfikacji tytułu (jeśli workspace ma pole edycji tytułu).

**Efekty pracy**
Akcja `edit` w row menu → nawigacja/open do workspace. Network: `PATCH /api/v8/finance/analyses/:id` (jeśli inline edit tytułu istnieje) → 200. Jeśli brak inline edit = P2 gap (PATCH endpoint istnieje ale UI nie używa). Odnotować konkluzję.

**Grafika**
Row menu: ikona `Pencil` + „Edytuj" (manifest linia 311-315 `useFinanceRowActions.ts`). `handleOpenFull` → otwiera workspace po prawej stronie (activeDocument). Tytuł w workspace: `h2 text-xl font-semibold` — czy edytowalny (click-to-edit)?

**Funkcjonalność**
`useFinanceRowActions.ts` (manifest: `{ id: 'edit', label: 'Edytuj', icon: Pencil, onClick: () => handleOpenFull(row) }`). `FinanceHub.tsx` (`handleOpenFull`). `PATCH /api/v8/finance/analyses/:id` (z spec; sprawdzić czy w V8FinanceApi brak = luka).

---

### MC-16A-28 · Usunięcie analizy — DELETE 200, hard-refresh = brak rekordu · [Zarządzanie / delete] [DB] [V8]

**Co się dzieje**
Konsultant usuwa testową analizę „Test — do usunięcia" (stworzoną wcześniej w sesji). Klika trójkropek menu w wierszu → akcja „Usuń" (`Trash2` icon, variant danger, `divider: true`) → `handleDelete(row)`. Pojawia się natywny `window.confirm`: „Czy na pewno chcesz usunąć 'Test — do usunięcia'?". Klika OK. System wysyła `DELETE /api/v8/finance/analyses/:id`. Toast „Usunięto". Lista analiz odświeżona (`loadAnalyses()`). Konsultant wykonuje hard-refresh strony → analiza niewidoczna na liście.

**Efekty pracy**
Network: `DELETE /api/v8/finance/analyses/:id` → 200, response `{ success: true, deleted: ':id' }`. `loadAnalyses()` po usunięciu → GET → lista bez usuniętego rekordu. Hard-refresh → brak rekordu w DB. Anulowanie `window.confirm` → brak żądania DELETE.

**Grafika**
Row menu akcja „Usuń": `variant='danger'` (czerwony tekst/icon), `divider: true` (linia nad). `window.confirm` natywny dialog. Toast „Usunięto" (sukces). Lista analiz skróciła się o jeden rekord.

**Funkcjonalność**
`useFinanceRowActions.ts` (`handleDelete` dla `row.kind === 'analysis'`: `V8FinanceApi.deleteAnalysis(row.id)`, fallback `Api.delete('/api/economics/financial-analyses/:id')`). `loadAnalyses()` po usunięciu. Confirm: `window.confirm`.

---

### MC-16A-29 · Filtrowanie po typie i statusie na liście analiz · [Zarządzanie / filter]

**Co się dzieje**
Konsultant ma na liście 8 analiz różnych typów i statusów: business_case, investment_case, dcf_analysis, roi_analysis, status: PENDING / APPROVED / RUNNING. Używa paska wyszukiwania (searchQuery) wpisując „VTS" — lista filtruje się do analiz zawierających „VTS" w tytule (`title.toLowerCase().includes(q)`). Następnie używa filtrów statusu (chip filters na pasku zakładki): klika „APPROVED" → lista pokazuje tylko zatwierdzone. Kombinuje: wyszukiwanie „Apator" + status filter „PENDING". Usuwa filtry: resetuje search i odznacza chip. Weryfikuje brak żądania API przy filtrowaniu (filtrowanie klienckie przez `filteredRows`).

**Efekty pracy**
Filtrowanie w pełni klienckie: `filteredRows = useMemo(() => { rows.filter(...) }, [rowsForActiveTab, searchQuery, activeFilters])`. Brak Network żądań przy zmianie filtrów. Wynik filtrowania widoczny natychmiast. Wyczyszczenie filtrów → pełna lista.

**Grafika**
Pasek searchQuery: `input` z ikoną lupki (Search). Filtry statusu: chips `PENDING / APPROVED / RUNNING` (aktywny chip = bg-primary, nieaktywny = border-slate-200). Licznik filtrowanych wyników (badge `N analiz`). Pusty stan po filtrowaniu: `emptyMessage` z zakładki analysis. Kolumny: tytuł / analysisType / status / updatedAt.

**Funkcjonalność**
`useFinanceData.ts` (`searchQuery.trim().toLowerCase()`, `activeFilters` → `statusFilterValues`, `filteredRows`). `FinanceHub.tsx` (`searchQuery`, `activeFilters`, `setActiveFilters`, filter chips). `setActiveFilters` dla kolumny `status`.

---

### MC-16A-30 · Eksport do Output — ExportToOutputDialog (raport / deck / inicjatywy) · [Eksport / export] [EXPORT] [V8]

**Co się dzieje**
Konsultant kończy analizę VTS Group i eksportuje ją jako deliverable dla zarządu. Z row menu klika „Eksportuj" (Download icon) → `handleExport(row)` → otwiera `ExportToOutputDialog`. Modal: 3 karty output type (Report / Presentation / Initiatives). Wybiera „Report" (karta lewa), wypełnia brief: Cel = „Wsparcie decyzji zarządu o ekspansji", Odbiorcy = „Zarząd / CFO VTS", Język = „PL". Klika „Create Draft". System wywołuje `exportFinancialAnalysis({ analysisId, analysisTitle, analysisType, outputType: 'report', brief: {...} })`. Veryfikuje w Network żądanie do report-builder/deliverables. Toast sukcesu + callback `onExportComplete`.

**Efekty pracy**
Network: żądanie do `/report-builder/...` lub `/api/deliverables/...` (przez `exportFinancialAnalysis`). Response zawiera `{ outputId, outputType, title, hasTemplate }`. `onExportComplete` wywoływany → callback w FinanceHub. `trackFunnelEvent('finance_export_created', { outputId, type: 'report' })`. Odnotować: jeśli eksport tworzy rekord w Outputs M17 → weryfikacja przez `/outputs`.

**Grafika**
`ExportToOutputDialog` (modal max-w-lg, rounded-xl, ring-1): nagłówek „Export Financial Analysis", 3 karty w `grid grid-cols-3 gap-3` (hover:ring-2 hover:ring-primary-400/50). Karta aktywna: `border-primary-500 bg-primary-50/50`. Toggle „Use template" (switch). Brief section: pola Goal / Audience / Language / Format / Scope. Footer: przycisk „Create Draft" (rounded-full bg-primary-500). Summary box: Name / Type / Date analizy.

**Funkcjonalność**
`ExportToOutputDialog.tsx` (`handleConfirm` → `exportFinancialAnalysis` z `services/financeExportService`). Ścieżka `outputType='initiatives'`: `V8FinanceApi.getInitiativeProposals` (GET) + `V8FinanceApi.createInitiativesFromAnalysis` (POST). `useFinanceRowActions.ts` (akcja `export` → `handleExport`). `FinanceHub.tsx` (`exportDialogOpen`, `exportTarget`, `setExportDialogOpen`).

---

## Macierz pokrycia funkcji → case'y

| Obszar funkcji | Case'y |
|---|---|
| Tworzenie — comprehensive/standard | MC-16A-01 |
| Tworzenie — investment_case + pola amber | MC-16A-02, 09, 10, 11, 12, 13 |
| Tworzenie — dcf_analysis | MC-16A-03 |
| Tworzenie — cost_benefit | MC-16A-04 |
| Tworzenie — sensitivity_analysis | MC-16A-05 |
| Tworzenie — scenario_analysis + reanalyze | MC-16A-06 |
| Tworzenie — break_even + approve | MC-16A-07 |
| Walidacja formularza (disabled, guard) | MC-16A-08 |
| Wskaźniki — profitability (blok 1) | MC-16A-14 |
| Wskaźniki — cost_control (blok 2) | MC-16A-15 |
| Wskaźniki — cash_liquidity (blok 3) | MC-16A-16 |
| Wskaźniki — working_capital (blok 4) | MC-16A-17 |
| Wskaźniki — leverage (blok 5) | MC-16A-18 |
| Wskaźniki — empty state | MC-16A-19 |
| AI Insights — generowanie (POST) | MC-16A-20 |
| AI Insights — lista (GET) | MC-16A-21 |
| AI Insights — powiązanie z ratios | MC-16A-22 |
| AI — kontekst Teresa w czacie | MC-16A-23 |
| Benchmarking — POST /benchmarks | MC-16A-24 |
| Benchmarking — YoY / getLatestRatios | MC-16A-25 |
| Benchmarking — peer / benchmark_value | MC-16A-26 |
| Zarządzanie — edycja (Edytuj row action) | MC-16A-27 |
| Zarządzanie — usunięcie (DELETE 200) | MC-16A-28 |
| Zarządzanie — filtrowanie/wyszukiwanie | MC-16A-29 |
| Eksport — ExportToOutputDialog | MC-16A-30 |

---

## Uwagi metodyczne

- **E2E wymóg:** każda operacja tworzenia/usunięcia → Network żądanie → hard-refresh = stan DB potwierdzony. Zmiana UI bez żądania = FAIL.
- **V8 fallback:** każdy endpoint v8 ma fallback do `/api/economics/financial-analyses/*`. Testy weryfikują V8 jako primary; fallback uruchamiany przez `shouldFallbackToLegacyFinance(error)`.
- **Znane luki do odnotowania (NIE jako FAIL bloker, chyba że opisano inaczej):** brak selectora `analysisType` w modalu UI (P2) — zawsze `comprehensive` jeśli nie investment; brak kolorystycznej sygnalizacji przekroczenia benchmarku w ratios (P3); brak walidacji inline w polu tytułu (P3); brak selectora okresu YoY (P2); brak PATCH endpoint w V8FinanceApi kliencie (P2 gap).
- **REAL-AI (MC-16A-20, 21, 22):** odpowiedzi LLM są zmienne — weryfikuj żądanie Network i obecność danych w response, nie konkretną treść.
- **Klienci API:** `V8FinanceApi.createAnalysis`, `deleteAnalysis`, `getAnalyses`, `getAnalysisRatios`, `runAnalysis`, `approveAnalysis`, `getInitiativeProposals`, `createInitiativesFromAnalysis` — wszystkie z `src/services/api/v8/finance.ts`.
- **Scenariusze klientów:** VTS Group (expansion business case), Apator ICT (ERP investment case, MES), Elkomtech (IoT, DCF, break-even) — realistyczne konteksty konsultingowe dla polskich klientów przemysłowych.

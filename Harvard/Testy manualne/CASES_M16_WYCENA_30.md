# CASES — M16 Finanse · Wycena przedsiębiorstw · 30 bogatych case'ów testowych

> **Moduł:** M16 Finanse — zakładka Wycena przedsiębiorstw (`/finance?tab=valuation`)
> **Główny plik:** `src/components/Economics/FinanceHub.tsx` (~2428 lin.) + `src/components/Benefits/ValuationWorkspace.tsx`
> **Komponenty wizualne:** `src/components/Economics/panels/ValuationVisualsPanel.tsx`, `src/components/Economics/charts/FootballField.tsx`, `SensitivityHeatmap.tsx`, `TornadoChart.tsx`
> **Cel paczki:** 30 realistycznych scenariuszy pracy konsultanta analitycznego/M&A, eksplorujących pełne możliwości zakładki Wycena — tworzenie, obliczenia DCF, komparatywna, Football Field, heatmapa wrażliwości, tornado, eksport.
> **Data:** 2026-06-25
> **Autor:** sesja projektowa (czytanie kodu, bez uruchamiania serwerów/testów)

---

## Legenda znaczników

- **[DB]** — operacja utrwalona w bazie (tabela wycen, wyniki); weryfikuj przez hard-refresh i odczyt z Network.
- **[FLAG]** — wymaga aktywnej flagi `valuationVisuals` (URL `?ff_valuationVisuals=1` lub localStorage `ff.fin_valuation_visuals=1`).
- **[V8]** — endpoint w ścieżce `/api/v8/finance/valuations/...`; weryfikuj prefiks w Network.
- **[DCF]** — scenariusz eksploatujący metodę Discounted Cash Flow.
- **[COMPS]** — scenariusz eksploatujący metodę porównawczą (comparable companies).
- **[NAV]** — scenariusz eksploatujący metodę majątkową (Net Asset Value / asset-based).

**Zasada E2E (każdy case z mutacją):** każda zmiana danych → żądanie API (Network tab, konkretny endpoint i status) + hard-refresh → stan identyczny. UI-zmiana bez żądania = FAIL.

---

## Spis 30 case'ów

### A. Tworzenie wycen (MC-16W-01 … MC-16W-06)
- **MC-16W-01** · Tworzenie wyceny DCF — ręczne założenia
- **MC-16W-02** · Tworzenie wyceny z modelu finansowego (sourceType=financial_model)
- **MC-16W-03** · Tworzenie wyceny Comps — 4 grupy porównawcze z EV/EBITDA
- **MC-16W-04** · Tworzenie wyceny majątkowej Asset-Based (NAV)
- **MC-16W-05** · Tworzenie wyceny hybrydowej Hybrid (DCF + Comps + NAV)
- **MC-16W-06** · Walidacja błędna: WACC < g (Gordon Growth violation)

### B. DCF — obliczenia i wyniki (MC-16W-07 … MC-16W-11)
- **MC-16W-07** · Uruchomienie obliczenia DCF (POST /compute)
- **MC-16W-08** · Odczyt Enterprise Value DCF w PLN
- **MC-16W-09** · Założenie WACC 9.5% — wpływ na EV
- **MC-16W-10** · Terminal growth rate g 2.0% — preset makro
- **MC-16W-11** · Panel założeń — PV explicit vs PV terminal split

### C. Football Field — wizualizacja (MC-16W-12 … MC-16W-17)
- **MC-16W-12** · Aktywacja flagi valuationVisuals i pojawienie się panelu
- **MC-16W-13** · Football Field — pas DCF na podstawie sensitivity matrix
- **MC-16W-14** · Football Field — pas Comps (min/mediana/max)
- **MC-16W-15** · Football Field — pas NAV (degenerowany, low=mid=high)
- **MC-16W-16** · Football Field — punkt triangulacji (linia pionowa)
- **MC-16W-17** · Football Field — pusty stan przy braku wyceny

### D. Sensitivity Heatmap (MC-16W-18 … MC-16W-22)
- **MC-16W-18** · Macierz wrażliwości 5×4 (WACC 8–12% × g 1–3%)
- **MC-16W-19** · Kolory heatmapy: rose=niskie EV, emerald=wysokie EV
- **MC-16W-20** · Etykiety osi — WACC kolumny, g wiersze
- **MC-16W-21** · Tooltip komórki — hover → wyświetla EV
- **MC-16W-22** · Heatmapa nieobecna przy braku danych sensitivity.matrix

### E. Tornado Chart (MC-16W-23 … MC-16W-26)
- **MC-16W-23** · Tornado renderuje słupki posortowane malejąco (|high−low|)
- **MC-16W-24** · 5 driverów (WACC, wzrost, marża, capex, NWC) + linia bazowa
- **MC-16W-25** · Tornado nieobecne bez danych (pusty stan)
- **MC-16W-26** · Kolory słupków: rose=strata (poniżej base), emerald=zysk (powyżej)

### F. Komparacja i zarządzanie (MC-16W-27 … MC-16W-30)
- **MC-16W-27** · Edycja założeń wyceny (PATCH) + ponowne przeliczenie
- **MC-16W-28** · Usunięcie wyceny
- **MC-16W-29** · Stepper 5-krokowy (source→assumptions→results→sensitivity→export)
- **MC-16W-30** · Eksport wyceny do Output (ExportButton / ExportToOutputDialog)

---

# A. Tworzenie wycen

---

### MC-16W-01 · Tworzenie wyceny DCF — ręczne założenia · [DB] [DCF]

**Co się dzieje**
Konsultant M&A otwiera `/finance?tab=valuation` dla klienta Elkomtech. Panel Wycena przedsiębiorstw ładuje listę wycen (`GET /api/economics/valuations`). Lista jest pusta. Konsultant klika „+ New valuation" (przycisk górny prawy) — modal `showCreate`. Wypełnia: tytuł „Wycena DCF — bazowy Q1 2026", typ źródła „Ręczne dane" (sourceType=`manual`), horyzont 5 lat. Brak konieczności wyboru sourceId (pole niewidoczne dla manual). Klika „Create". Zaczeka na spinner busy.

**Efekty pracy**
`POST /api/economics/valuations` z body `{title, sourceType:'manual', sourceId:null, horizonYears:5, currency:'PLN'}` → 201, response `{id, title, status:'DRAFT'}`. Toast sukces „Wycena utworzona". Lista wycen odświeżona (`GET /api/economics/valuations`). Nowa pozycja pojawia się w liście po lewej, zostaje automatycznie zaznaczona (setSelectedId). Hard-refresh → wycena nadal widoczna na liście.

**Grafika**
Modal `showCreate`: nakładka czarna 50% opacity, biała karta max-w-lg, tytuł „New valuation", pole input tytułu z placeholderem „Fundraising valuation — base case", select sourceType z opcjami: Ręczne dane / Model finansowy / Budżet / Analiza finansowa, pole horizon (number). Lista wycen po lewej (col-span-4) z wierszami: tytuł bold + podtytuł xs „Source: manual • DRAFT". Zaznaczona pozycja = bg-slate-50. Spinner `Loader2` na przycisku podczas POST.

**Funkcjonalność**
`ValuationWorkspace.tsx` → `handleCreate()` → `POST /api/economics/valuations`. `CreateValuationModal.tsx` (alternatywna ścieżka z FinanceHub). `fetchValuations()` po create. `trackFunnelEvent('valuation_created', ...)`. `ValuationWorkspace.tsx:227-269`.

---

### MC-16W-02 · Tworzenie wyceny z modelu finansowego (sourceType=financial_model) · [DB] [DCF]

**Co się dzieje**
Konsultant chce użyć zatwierdzonego modelu finansowego Apator jako bazy dla wyceny. Otwiera modal „New valuation", zmienia typ źródła na „Model finansowy" (sourceType=`financial_model`). Pojawia się select z listą modeli pobraną z `GET /api/economics/valuations/sources` (`sources.financialModels`). Wybiera model „Apator FP&A 2026 — APPROVED". Uzupełnia tytuł „Wycena — model Apator Q2 2026", horyzont 7 lat. Klika Create.

**Efekty pracy**
`POST /api/economics/valuations` z `{sourceType:'financial_model', sourceId:'<model-id>', horizonYears:7}` → 201. Nowy rekord wyceny powiązany z modelem finansowym. W panelu szczegółów po wybraniu tej wyceny pojawia się badge „View source" z linkiem do `/economics?tab=models&openId=<model-id>`. Hard-refresh → wycena na liście, sourceId zachowane.

**Grafika**
Modal: po zmianie sourceType na `financial_model` pojawia się select „Wybierz model" z opcjami z `sources.financialModels`. `CreateValuationModal.tsx`: pełna lista sources (budgets/financialModels/financialAnalyses). Walidacja: jeśli sourceType != manual i sourceId puste → disabled Create + toast błędu. Badge „View source" w headerze panelu szczegółów: niebieskie tło primary-500/10, ikona ExternalLink 10px.

**Funkcjonalność**
`CreateValuationModal.tsx` → `Api.post('/api/economics/valuations', {...})`. `GET /api/economics/valuations/sources` → `sources.financialModels`. `ValuationWorkspace.tsx` → `fetchSources()`. Badge „View source" → navigate `/economics?tab=models&openId=`. `ValuationWorkspace.tsx:573-590`.

---

### MC-16W-03 · Tworzenie wyceny Comps — 4 grupy porównawcze z EV/EBITDA · [DB] [COMPS]

**Co się dzieje**
Konsultant przygotowuje wycenę porównawczą Elkomtech wobec 4 polskich i europejskich spółek przemysłowych. Tworzy wycenę ręczną „Comps — przemysł elektryczny Q1 2026". Po stworzeniu przechodzi do zakładki Założenia (tab `assumptions`). W prawym panelu „Comparable valuation (multiples)" wypełnia: Min=28 mln PLN, Mediana=38 mln PLN, Max=52 mln PLN, lista peers (comma-separated): „Apator SA, Schneider Electric PL, Siemens Polska, ABB Ltd". Klika „Save comps".

**Efekty pracy**
`PUT /api/economics/valuations/:id/peers` z body `{metric:'EV/EBITDA', min:28000000, median:38000000, max:52000000, peerSet:[{name:'Apator SA'},{name:'Schneider Electric PL'},{name:'Siemens Polska'},{name:'ABB Ltd'}]}` → 200. Toast „Comps saved". Hard-refresh → `GET /api/economics/valuations/:id` odtwarza peers. Pole peers wchodzi jako tekst rozdzielony przecinkami, parser `.split(',')` tworzy tablicę obiektów `{name}` (maks 20 peers). Peer group 4 spółki widoczna po reload.

**Grafika**
Panel prawej kolumny (bg-slate-50 rounded-xl p-4): nagłówek „Comparable valuation (multiples)", 3 pola numeryczne (Min/Median/Max) w grid-cols-3, pole tekstowe Peers z placeholder „e.g., Company A, Company B". Puste peers → placeholder widoczny. Peers wpisane → ciągły tekst „Apator SA, Schneider Electric PL, Siemens Polska, ABB Ltd" w input. Przycisk „Save comps" (full-width, bg-navy-900). Toast sukces.

**Funkcjonalność**
`ValuationWorkspace.tsx` → `handleSaveComps()` → `PUT /api/economics/valuations/:id/peers`. `multiples.peerSet` mapuje `value.split(',').map(x=>({name:x.trim()})).slice(0,20)`. `DEFAULT_MULTIPLES: {metric:'EV/EBITDA', min:6, median:8, max:10}` (bez prefixu PLN — multiples wymagają jednostek EV z założeń). `ValuationWorkspace.tsx:299-317`.

---

### MC-16W-04 · Tworzenie wyceny majątkowej Asset-Based (NAV) · [DB] [NAV]

**Co się dzieje**
Konsultant wycenia aktywa zakładu produkcyjnego klienta (Apator AIR ICT) metodą majątkową — aktywa netto. Tworzy wycenę „Wycena majątkowa — zakład Toruń 2026" (sourceType=`manual`, horyzont 3 lata). Po stworzeniu przechodzi do Założeń. W sekcji DCF assumptions zmienia metodę końcową z `gordon` na `exit_multiple`, uzupełnia exit multiple=8.5, metric=EV/EBITDA. Zapisuje założenia. Następnie, by dostarczyć NAV, uruchamia obliczenie (Compute) które zwróci backend `results.assetBased.netAssetValue`.

**Efekty pracy**
`PUT /api/economics/valuations/:id/assumptions` z `{waccPercent:12, terminalMethod:'exit_multiple', exitMultiple:8.5, exitMultipleMetric:'EV/EBITDA'}` → 200. Toast „Assumptions saved". Następnie `POST /api/economics/valuations/:id/compute` → 200. `GET /api/economics/valuations/:id` po compute → `results.assetBased.netAssetValue` zwrócone przez backend. Hard-refresh → wyniki zachowane, aktywny step zmienia się na `results`.

**Grafika**
Po zmianie terminalMethod na `exit_multiple` sekcja g% znika, pojawia się grid-cols-2 z polami „Exit multiple" (number) i „Metric" (select EV/EBITDA | EV/Revenue). Brak preset-pills dla exit_multiple (tylko dla gordon). Przycisk „Save assumptions" full-width. Panel wyników (results tab) pokazuje EV z sekcji `dcf.enterpriseValue` (PLN compact). Sekcja comps Empty jeśli brak peers.

**Funkcjonalność**
`ValuationWorkspace.tsx` → `assumptions.terminalMethod='exit_multiple'` → renderuje pola exitMultiple/exitMultipleMetric (linie 793-829). `handleSaveAssumptions()` → `PUT /api/economics/valuations/:id/assumptions`. `handleCompute()` → `POST /api/economics/valuations/:id/compute`. `safeJson(selected.results, {})` → `computed.assetBased`.

---

### MC-16W-05 · Tworzenie wyceny hybrydowej Hybrid (DCF + Comps + NAV) · [DB] [DCF] [COMPS] [NAV]

**Co się dzieje**
Konsultant przygotowuje pełną wycenę przed transakcją M&A — łączy wszystkie 3 metody. Tworzy „Wycena hybrid — M&A Elkomtech 2026" (sourceType=`manual`). W Założeniach ustawia DCF: WACC=9.5%, gordon growth, g=2.0%. Zapisuje. W comps: Min=38 mln PLN, Mediana=45 mln PLN, Max=58 mln PLN, peers „ZPAS Group, Schneider Electric PL, Rittal GmbH, Eaton Corp PL". Zapisuje. Uruchamia Compute — backend oblicza DCF, comps i NAV, zwraca `results` z polem `assetBased`, `dcf` i `comps.impliedEnterpriseValue`.

**Efekty pracy**
Dwa wywołania `PUT` (assumptions + peers) i jeden `POST /compute` → backend wypełnia `results.dcf`, `results.comps.impliedEnterpriseValue`, `results.assetBased`. Tab Results pokazuje zarówno sekcję DCF summary jak i sekcję Comps (min/mediana/max). Hard-refresh → wszystkie wyniki zachowane. `ValuationVisualsPanel` (po aktywacji flagi) wyrenderuje 3 pasy Football Field i heatmapę.

**Grafika**
Tab Results (grid-cols-2): lewy panel „Valuation summary" (EV, Equity value, WACC, PV split), prawy panel „Comparable range" z min/mediana/max w PLN. Jeśli `computed.comps.impliedEnterpriseValue` null → komunikat „Configure comps in Assumptions" (nie crash). Obie sekcje widoczne gdy oba bloki danych istnieją.

**Funkcjonalność**
`ValuationWorkspace.tsx` → `handleSaveAssumptions()` + `handleSaveComps()` + `handleCompute()`. `computed = safeJson(selected.results, {})` → `dcf`/`comps`/`assetBased`. `fmtValue()` → `Intl.NumberFormat(PL, currency:PLN, notation:compact)`. `ValuationWorkspace.tsx:190-193, 932-1017`.

---

### MC-16W-06 · Walidacja błędna: g ≥ WACC (Gordon Growth violation) · [DCF]

**Co się dzieje**
Konsultant przez nieuwagę wpisuje WACC=2.0% i terminal growth g=4.0% — naruszenie warunku Gordon Growth Model (g < WACC). Przechodzi do zakładki Założenia wybranej wyceny. Wpisuje w pole WACC wartość 2, a w pole g wartość 4. Klika „Save assumptions". Oczekuje blokady z komunikatem walidacyjnym — NIE Toast, lecz inline banner.

**Efekty pracy**
`validationError` = `t('valuation.validation.gLessThanWacc', 'Terminal growth must be lower than WACC (g < WACC)')` aktywuje się gdy `!(g < w)` (ValuationWorkspace.tsx:214-225). `handleSaveAssumptions()` → `toast.error(validationError)` + return przed wywołaniem PUT. Żadne żądanie do API NIE jest wykonane (brak PUT w Network). Błąd wyświetlony jako czerwony banner inline (bg-danger-500/10 border border-danger-500/30) ORAZ toast. Po poprawieniu g=2.0% błąd znika, „Save assumptions" działa.

**Grafika**
Inline banner pod tytułem zakładki Założenia: czerwone tło `bg-danger-500/10`, obramowanie `border-danger-500/30`, tekst `text-danger-400`. Tekst: „Terminal growth must be lower than WACC (g < WACC)". Pojawia się reaktywnie bez wysyłania formularza (computed `useMemo`). Przycisk „Save assumptions" nadal klikalny, ale toast błędu pojawia się po kliknięciu. Brak PUT w Network tab przy błędzie.

**Funkcjonalność**
`ValuationWorkspace.tsx` → `validationError = useMemo(...)` (linie 214-225), warunek `!(g < w)`. `handleSaveAssumptions()` sprawdza `validationError` (linia 276). `DEFAULT_ASSUMPTIONS: {waccPercent:12, terminalGrowthPercent:3}` — domyślnie poprawne (12 > 3). Walidacja dotyczy TYLKO `terminalMethod === 'gordon'`.

---

# B. DCF — obliczenia i wyniki

---

### MC-16W-07 · Uruchomienie obliczenia DCF (POST /compute) · [DB] [DCF] [V8]

**Co się dzieje**
Konsultant ma wycenę „Wycena DCF — bazowy Q1 2026" z zapisanymi założeniami (WACC=9.5%, g=2.0%, gordon). Klika przycisk „Compute" (Play icon, bg-slate-900) w headerze panelu. Czeka na odpowiedź backendu — spinner Loader2 pojawia się na miejscu Play ikony. Backend przelicza FCFF na horyzont 5 lat, wartość terminalną Gordon, zdyskontowane sumy. Po zakończeniu toast „Valuation computed" i automatyczne przejście na tab `results`.

**Efekty pracy**
`POST /api/economics/valuations/:id/compute` (ValuationWorkspace.tsx:323) → 200. Response zawiera obliczone wyniki lub backend je zapisuje do rekordu wyceny. `fetchValuation(selectedId)` wywoływane po compute odświeża `selected` z polami `results` (JSON). `setActiveStep('results')` przenosi na tab wyników. Hard-refresh → `GET /api/economics/valuations/:id` zwraca `results` z wartościami DCF. W Network: dokładna kolejność: PUT assumptions → POST compute → GET :id.

**Grafika**
Przycisk Compute: stan normalny (Play icon + tekst „Compute"), stan busy (Loader2 animate-spin). Oba przyciski headera (Compute + Approve) z gap-2 w flex. Po compute: tab `results` aktywny (bg-primary-600 text-white). Tab bar ze step indicators (kółka): 3 z 5 zabarwione (source, assumptions, results). Pasek postępu (linia) dociera do kroku 3.

**Funkcjonalność**
`ValuationWorkspace.tsx` → `handleCompute()` (linie 319-339). `setBusy(true)` → fetch POST → `setBusy(false)`. `toast.success(t('valuation.compute.ok', 'Valuation computed'))`. `onValuationChanged?.()`. Legacy API: `GET /api/finance/valuations` — zweryfikuj czy lista korzysta z `/api/economics/valuations` (FinanceHub vs ValuationWorkspace).

---

### MC-16W-08 · Odczyt Enterprise Value DCF w PLN · [DCF] [V8]

**Co się dzieje**
Po przeliczeniu wyceny konsultant przechodzi do taba `results`. Widzi panel „Valuation summary" z kluczową linią „Enterprise value (EV)". Sprawdza format: wartość 45 mln PLN powinna być wyświetlona jako „45 mln PLN" (Intl.NumberFormat, currency PLN, notation compact). Sprawdza również Equity value (EV - dług netto), WACC (9.5%), PV split (explicit / terminal). Weryfikuje, że wartości są numeryczne, nie string „undefined" ani „—".

**Efekty pracy**
`GET /api/economics/valuations/:id` → `valuation.results` (JSONB) → `safeJson(v.results, {})` → `computed.dcf.enterpriseValue = 45000000`. `fmtValue(45000000)` → `"45M"` (compact PLN). `dcf.discountRatePercent` = 9.5. `dcf.pvExplicit` + `dcf.pvTerminal` = sumy zdyskontowanych przepływów. Network: jeden GET :id po compute. Brak reload po przejściu na tab results (client-side state, nie fetch).

**Grafika**
Panel grid-cols-2 w tab results: lewy „Valuation summary" (bg-slate-50 rounded-xl p-4), prawy „Comparable range". Wiersze w space-y-2: `flex justify-between` — lewa etykieta slate-500 xs, prawa wartość `font-mono text-slate-900`. EV: „45M PLN" (compact). WACC: „9.5%". PV split: „32M / 13M PLN" (explicit/terminal). Jeśli `dcf` null → komunikat „Compute the valuation to see results" (brak crash).

**Funkcjonalność**
`ValuationWorkspace.tsx` → `fmtCurrency = Intl.NumberFormat(i18n.language, {style:'currency', currency:cur, notation:'compact'})`. `fmtValue(v)` (linia 205-212). `computed.dcf` = `safeJson(selected.results, {}).dcf`. `selected.currency = 'PLN'`. `ValuationWorkspace.tsx:195-212, 933-977`.

---

### MC-16W-09 · Założenie WACC 9.5% — wpływ na EV · [DCF]

**Co się dzieje**
Konsultant testuje wrażliwość wyceny na WACC. Wraca do taba `assumptions`. W polu WACC wpisuje 9.5 (poprzednio 12.0 — domyślny). Zapisuje założenia (`PUT /assumptions`). Uruchamia Compute. Weryfikuje, że EV wzrósł (niższy WACC = wyższe zdyskontowane FCFF). Ponownie zmienia WACC na 14.0%, compute → EV spada. Dokumentuje różnicę: WACC 9.5% → EV ~45 mln PLN; WACC 14.0% → EV ~31 mln PLN.

**Efekty pracy**
Dwa wywołania `PUT /assumptions` (zmiana WACC) + dwa `POST /compute`. Po każdym compute `GET :id` zwraca nowy `results.dcf.enterpriseValue`. Konsultant porównuje wartości w tab results. Hard-refresh po ostatnim compute → EV z WACC 14.0% zachowane. Walidacja: g=2.0% < WACC=9.5% ✓ oraz g=2.0% < WACC=14.0% ✓ — brak błędu walidacji.

**Grafika**
Pole WACC (number input): mt-1 w-full, rounded-lg border. Preset-pills dla g (NOT dla WACC — tylko g ma presety makro). Zmiana WACC nie triggeruje presetu. Po każdym compute tab zmienia się na results automatycznie. EV w font-mono bold: różnica widoczna gołym okiem między 45M a 31M PLN.

**Funkcjonalność**
`ValuationWorkspace.tsx` → `assumptions.waccPercent` (state), `handleSaveAssumptions()`, `handleCompute()`. `validationError` sprawdza `!(g < w)` — przy g=2.0% i WACC=9.5% warunek spełniony (brak błędu). `DEFAULT_ASSUMPTIONS.waccPercent = 12`.

---

### MC-16W-10 · Terminal growth rate g 2.0% — preset makro · [DCF]

**Co się dzieje**
Konsultant używa wbudowanych presetów makroekonomicznych dla terminal growth rate. Widzi pod polem g% panel pill-buttons: „GDP PL ~2.5%", „GDP EU ~1.5%", „GDP US ~2.0%", „Inflation target ~2.5%", „Tech sector ~4.0%", „Conservative ~1.0%". Klika „GDP US ~2.0%" — pole g natychmiast ustawia się na 2.0. Klika „Conservative ~1.0%" — g=1.0. Sprawdza, że aktywny preset jest podświetlony (primary-500/10 + primary border). Zapisuje z g=2.0%.

**Efekty pracy**
`setAssumptions(p => ({...p, terminalGrowthPercent: preset.value}))` — zmiana stanu lokalnego (OptimisticUI). `PUT /assumptions` przy kliknięciu „Save assumptions". Brak żądania przy samym kliknięciu presetu (zmiana stanu lokalnego). Hard-refresh → bez zapisu: g wraca do wartości z bazy. Z zapisem: g=2.0 trwałe. Brak błędu walidacji (9.5 > 2.0 ✓).

**Grafika**
Presety: flex flex-wrap gap-1, text-[10px] px-1.5 py-0.5 rounded border. Aktywny: `border-primary-500 bg-primary-500/10 text-primary-600`. Nieaktywny: `border-slate-200 text-slate-500 hover:border-primary-300`. Widoczne TYLKO gdy `terminalMethod === 'gordon'` (nie dla exit_multiple). 6 presetów w jednej linii (mogą zawijać na węższym ekranie).

**Funkcjonalność**
`ValuationWorkspace.tsx` linie 751-789: presety Gordon growth — 6 obiektów `{label, value}`. `onClick → setAssumptions(p => ({...p, terminalGrowthPercent: preset.value}))`. Renderowane warunkowo `{assumptions.terminalMethod === 'gordon' ? (...)}`. `DEFAULT_ASSUMPTIONS.terminalGrowthPercent = 3`.

---

### MC-16W-11 · Panel założeń — PV explicit vs PV terminal split · [DCF]

**Co się dzieje**
Po obliczeniu DCF konsultant analizuje strukturę wartości: ile pochodzi z prognozowanych FCFF (PV explicit), ile z wartości terminalnej (PV terminal). Przechodzi do taba `results`, w sekcji „Valuation summary" czyta wiersz „PV split (explicit/terminal)". Dla WACC=9.5%, g=2.0%, horyzont 5 lat — typowy rozkład to ok. 30% explicit / 70% terminal (typowa reguła kciuka DCF). Dokumentuje stosunek i ocenia, czy model nie jest nadmiernie zależny od wartości terminalnej (>80% terminal = ostrzeżenie).

**Efekty pracy**
`computed.dcf.pvExplicit` + `computed.dcf.pvTerminal` z `GET :id` po compute. `fmtValue(dcf.pvExplicit)` + `fmtValue(dcf.pvTerminal)` wyświetlone w jednym wierszu: „32M / 13M PLN". Backend wylicza obie składowe. Hard-refresh → split zachowany. Brak UI-alertu przy nadmiernym udziale terminal (pure informacja, brak walidacji FE).

**Grafika**
Wiersz PV split: `flex justify-between`, label „PV split (explicit/terminal)" po lewej, wartość `font-mono` po prawej w formacie „32M / 13M PLN". Kolejność wierszy w panelu: EV → Equity value → WACC → PV split. Brak osobnego wykresu (tylko tekst). Wartości „—" gdy `dcf.pvExplicit` undefined (safeNumber zwraca NaN → fmtValue zwraca „—").

**Funkcjonalność**
`ValuationWorkspace.tsx:967-977`. `fmtValue(dcf.pvExplicit)` + `fmtValue(dcf.pvTerminal)`. `dcf = computed?.dcf`. `safeJson(selected.results, {})`. `fmtValue` sprawdza `Number.isFinite(n)` → `'—'` jeśli nie skończona.

---

# C. Football Field — wizualizacja

---

### MC-16W-12 · Aktywacja flagi valuationVisuals i pojawienie się panelu · [FLAG]

**Co się dzieje**
Konsultant chce zobaczyć wizualizacje wyceny (Football Field, heatmapa, tornado). Domyślnie panel `ValuationVisualsPanel` jest niewidoczny. Otwiera URL `/finance?tab=valuation&ff_valuationVisuals=1`. Strona przeładowuje się z aktywną flagą `isFinanceFlagEnabled('valuationVisuals') = true`. Pod tabelą/workspace wycen pojawia się nowy panel z 3 sekcjami. Alternatywnie: `localStorage.setItem('ff.fin_valuation_visuals', '1')` + F5 daje ten sam efekt. Weryfikuje w konsoli przeglądarki, że brak błędów JS.

**Efekty pracy**
`isFinanceFlagEnabled('valuationVisuals')` (financeFeatureFlags.ts:81) → resolucja: URL query (pierwsze trafienie) → `true`. `FinanceHub.tsx:2113` → `_showValVis = true` → `{_showValVis && <ValuationVisualsPanel valuation={selectedItem as any} />}` (linia 2123) renderuje panel. Brak żądania API tylko dla flagi. Bez flagi: `_showValVis = false`, `ValuationVisualsPanel` NOT rendered (brak w DOM). Konsola: brak error/warning po aktywacji.

**Grafika**
Z flagą OFF: żaden dodatkowy panel poniżej ValuationWorkspace. Z flagą ON: pojawia się `<div data-testid="valuation-visuals-panel">` z 3 sekcjami w `space-y-4`: „Triangulacja wyceny" (Football Field), „Wrażliwość WACC×wzrost" (Heatmap), „Wrażliwość jednozmiennowa" (Tornado). Każda sekcja = `rounded-xl border border-gray-200 bg-white p-4`. Przed wybraniem wyceny lub bez danych — każda sekcja wyświetla tekst empty-state, NIE crash.

**Funkcjonalność**
`financeFeatureFlags.ts` → `isFinanceFlagEnabled('valuationVisuals')`. Resolucja: URL `ff_valuationVisuals` → localStorage `ff.fin_valuation_visuals` → Vite env `VITE_FIN_VALUATION_VISUALS_ENABLED`. `FinanceHub.tsx:2109-2123`. `ValuationVisualsPanel.tsx:138-197`.

---

### MC-16W-13 · Football Field — pas DCF na podstawie sensitivity matrix · [FLAG] [DCF]

**Co się dzieje**
Konsultant aktywuje flagę `ff_valuationVisuals=1` i wybiera wycenę z przeliczonymi wynikami DCF (WACC=9.5%, g=2.0%, EV=45 mln PLN). Backend zwrócił `results.sensitivity.matrix` z 20 komórkami (5 WACC × 4 g). `ValuationVisualsPanel.tsx` buduje Football Field: pas DCF z `low=min(EV matrix)` i `high=max(EV matrix)`, mid=`dcf.enterpriseValue`. Konsultant widzi poziomy pasek DCF z szerokością odzwierciedlającą rozpiętość scenariuszy (np. 36 mln – 57 mln PLN przy WACC 8–12% × g 1–3%).

**Efekty pracy**
`buildRanges(v)` (ValuationVisualsPanel.tsx:53-98): `dcfEv=45000000`, `evs = sensitivity.matrix.map(c=>c.ev)` → min=36M, max=57M → `ranges.push({label:'DCF', low:36M, mid:45M, high:57M})`. `FootballField` (charts/FootballField.tsx) renderuje SVG z `data-testid="football-field"`. Pas DCF: `data-testid="ff-range" data-label="DCF"`. Brak żądania API — read-only z aktualnego `selectedItem`. Nie trzeba reload.

**Grafika**
`FootballField` SVG (viewBox 720×144+): etykieta „DCF" po lewej (PAD_LEFT=132px), prostokąt slate/blue od 36M do 57M na osi X, marker violet (linia 2.5px) na 45M. Oś X: 5 ticków z labelami kompaktowymi (36M, 39M, 42M, 45M, …, 57M). Ticks: dashed pionowe linie szare. Jeśli sensitivity.matrix pusta → low=45M*0.85=38.25M, high=45M*1.15=51.75M (fallback ±15%).

**Funkcjonalność**
`ValuationVisualsPanel.tsx:58-68` → `evs = (v.sensitivity?.matrix ?? []).map(c=>c?.ev).filter(isNum)`. `FootballField.tsx` props: `ranges=[{label:'DCF', low, mid, high}]`. `data-testid="ff-range"`. `PAD_LEFT=132, ROW_HEIGHT=44, BAR_HEIGHT=18`. `defaultFormatValue` → skala k/M.

---

### MC-16W-14 · Football Field — pas Comps (min/mediana/max) · [FLAG] [COMPS]

**Co się dzieje**
Konsultant konfiguruje comps: Min=38 mln, Mediana=45 mln, Max=58 mln PLN (peers: ZPAS Group, Schneider Electric PL, Rittal GmbH, Eaton Corp PL, EV/EBITDA 7–10×). Po Compute i z aktywną flagą wizualizacji Football Field pokazuje DWA pasy: DCF i Porównawcza. Pas Porównawcza (label „Porównawcza") ciągnie się od 38M do 58M, marker na 45M. Konsultant porównuje nakładanie się pasm — jeśli DCF i Comps pokrywają ten sam zakres, wycena jest spójna.

**Efekty pracy**
`buildRanges(v)`: `comps.impliedEnterpriseValue = {min:38M, median:45M, max:58M}` → `ranges.push({label:'Porównawcza', low:38M, mid:45M, high:58M})`. `FootballField` z 2 wierszami: DCF (row 0) + Porównawcza (row 1). `viewHeight = 2×44 + 16 + 40 = 144px`. Brak żądania API — czysto klienckie. Jeśli tylko `comps.min` podane (bez median i max) → fallback: `min=min, max=min, median=min` (degenerated bar).

**Grafika**
SVG z 2 pasami. Górny pas (row 0): etykieta „DCF", pasek szary/blue. Dolny pas (row 1): etykieta „Porównawcza", pasek szary/blue. Marker violet na `mid` każdego pasa. Pasy renderują się w kolejności tablic ranges: DCF zawsze pierwszy (buildRanges dodaje go przed Comps). Oś X wspólna dla obu (domainMin = min wszystkich low, domainMax = max wszystkich high).

**Funkcjonalność**
`ValuationVisualsPanel.tsx:72-78` → `comps = v.comps?.impliedEnterpriseValue`. Logika fallback: `min = isNum(comps.min) ? comps.min : isNum(comps.median) ? comps.median : comps.max`. `FootballField.tsx:165-219` → `safeRanges.map((r,i) => <g data-testid="ff-range" data-label={r.label}>)`. Kolejność w SVG: indeks i odpowiada kolejności w ranges[].

---

### MC-16W-15 · Football Field — pas NAV (degenerowany, low=mid=high) · [FLAG] [NAV]

**Co się dzieje**
Wycena hybrydowa zawiera wyniki majątkowe: backend zwrócił `results.assetBased.netAssetValue=42000000`. `ValuationVisualsPanel.tsx` buduje pas NAV jako degenerowany (low=mid=high=42M). Football Field wyświetla teraz 3 pasy: DCF, Porównawcza, Majątkowa (NAV). Pas NAV jest wizualnie iną kreską o zerowej szerokości (lub 2px minimum). Konsultant sprawdza, że render nie crashuje przy degenerowanym zakresie (lo=hi → xScale(lo)=xScale(hi), width=max(2, x2-x1)=2).

**Efekty pracy**
`buildRanges(v)`: `nav = v.assetBased.netAssetValue = 42M` → `ranges.push({label:'Majątkowa (NAV)', low:42M, mid:42M, high:42M})`. 3 pasy w SVG. Pas NAV: `lo=hi=42M` → `x1=x2=xScale(42M)` → `width=Math.max(2, 0)=2` (minimum 2px, nie NaN). Brak crash. `point` = `dcf.enterpriseValue = 45M` (nie NAV).

**Grafika**
3 pasy: DCF (row 0, szer. np. 120px), Porównawcza (row 1, szer. 140px), Majątkowa (NAV) (row 2, szer. 2px — pionowa kreska). Etykieta „Majątkowa (NAV)" po lewej. Tooltip na pasku: „Majątkowa (NAV): 42M – 42M (mid 42M)". Marker violet na mid=42M (identyczny z krawędziami). SVG viewHeight = 3×44 + 56 = 188px.

**Funkcjonalność**
`ValuationVisualsPanel.tsx:81-88` → `nav = isNum(v.assetBased?.enterpriseValue) ? ... : isNum(v.assetBased?.netAssetValue) ? ...`. `FootballField.tsx:191` → `width={Math.max(2, x2 - x1)}` (zabezpieczenie na degenerację). `<title>` tooltip renderuje obie granice.

---

### MC-16W-16 · Football Field — punkt triangulacji (linia pionowa) · [FLAG] [DCF]

**Co się dzieje**
Po Football Field z 2-3 pasami konsultant szuka punktu triangulacji — pionowej przerywanej linii pokazującej „gdzie jest wycena". Weryfikuje, że punkt = `dcf.enterpriseValue` (45 mln PLN) gdy DCF istnieje. Następnie testuje scenariusz bez DCF: usuwa pole enterpriseValue z wyników (symulacja) → punkt powinien przeskoczyć na mediany comps (45M). Sprawdza tooltip nad linią i wartość tekstową nad nią.

**Efekty pracy**
`buildRanges(v)` → `point = isNum(dcfEv) ? dcfEv : isNum(comps?.median) ? comps.median : undefined`. Gdy `dcfEv=45M` → `point=45M`. `FootballField` renderuje `<g data-testid="ff-point-line">` z `<line>` violet dashed + `<text>` „45M" (compact) nad linią. Gdy `dcfEv=undefined` i `comps.median=45M` → `point=45M` z comps. Gdy brak obu → `point=undefined` → brak linii (NIE crash).

**Grafika**
Linia pionowa: `stroke="rgb(139 92 246)" strokeWidth=2 strokeDasharray="5 4"`. Rozciąga się od PAD_TOP-4 do axisY (pełna wysokość pola wykresu). Etykieta tekstowa: `fontSize=11, fontWeight=600, fill="rgb(124 58 237)"` — nad górną krawędzią linii. Wartość: „45M". Tooltip `<title>Punkt referencyjny: 45M`. Bez punktu: blok `{Number.isFinite(point as number) && (...)}` nie renderuje nic.

**Funkcjonalność**
`ValuationVisualsPanel.tsx:91-96`. `FootballField.tsx:223-246`. `data-testid="ff-point-line"`. Fallback: `comps?.median` gdy brak DCF. `Number.isFinite(point as number)` — zabezpieczenie na NaN/undefined.

---

### MC-16W-17 · Football Field — pusty stan przy braku wyceny · [FLAG]

**Co się dzieje**
Konsultant aktywuje flagę wizualizacji, ale nie wybiera żadnej wyceny z listy (lub wybrana wycena nie ma przeliczonych wyników). `ValuationVisualsPanel` otrzymuje `valuation=null`. `buildRanges({})` zwraca `{ranges:[], point:undefined}`. `hasAnything = false` → komponent renderuje pusty stan centralny, NIE crash.

**Efekty pracy**
`ValuationVisualsPanel.tsx:150-160`: `!hasAnything` → `<div data-testid="valuation-visuals-panel" data-empty="true">` z tekstem „Uruchom wycenę, aby zobaczyć wizualizacje." Brak SVG w DOM. `FootballField` NIE jest montowany. Brak żądań API (read-only). Analogicznie: Football Field z `ranges=[]` renderuje własny pusty stan `data-empty="true"` z tekstem „Brak danych — dodaj metody wyceny" (FootballField.tsx:105-118).

**Grafika**
Panel `valuation-visuals-panel` z `data-empty="true"`: `rounded-xl border border-gray-200 bg-white p-6 text-center`. Tekst centralny: „Uruchom wycenę, aby zobaczyć wizualizacje." Brak ikon, brak sekcji. Gdy poszczególne dane częściowo brak (np. tylko DCF bez heatmapy): panel renderuje się, Football Field OK, Heatmapa pokazuje własny empty „Brak danych — uruchom analizę wrażliwości".

**Funkcjonalność**
`ValuationVisualsPanel.tsx:145-160`: `hasFootball = ranges.length > 0`, `hasHeatmap = xLabels.length > 0 && yLabels.length > 0 && cells.length > 0`, `hasTornado = bars.length > 0`, `hasAnything = hasFootball || hasHeatmap || hasTornado`. Pusty stan: gdy `!hasAnything`. Sekcjonowe puste stany: `SectionEmpty` komponent.

---

# D. Sensitivity Heatmap

---

### MC-16W-18 · Macierz wrażliwości 5×4 (WACC 8–12% × g 1–3%) · [FLAG] [DCF]

**Co się dzieje**
Backend po wywołaniu `POST /compute` zwrócił macierz wrażliwości w `results.sensitivity.matrix` z 20 komórkami: WACC {8, 9, 10, 11, 12}% × g {1.0, 1.5, 2.0, 3.0}%. Każda komórka: `{wacc: 9.5, g: 2.0, ev: 45000000}`. `results.sensitivity.waccGrid=[8,9,10,11,12]`, `results.sensitivity.gGrid=[1.0,1.5,2.0,3.0]`. `ValuationVisualsPanel` montuje `SensitivityHeatmap` z 5 kolumnami (WACC) i 4 wierszami (g), 20 komórkami.

**Efekty pracy**
`buildHeatmap(v)`: `xLabels=[8,9,10,11,12]`, `yLabels=[1.0,1.5,2.0,3.0]`, `cells = matrix.map(c=>({x:c.wacc, y:c.g, value:c.ev}))` (20 komórek). `SensitivityHeatmap` renderuje SVG `viewBox="0 0 (96+5×84+20) (44+4×40+48)"`. 20 `<g data-testid="heat-cell">`. Brak żądania API. Hard-refresh → wyniki zachowane (persistence po stronie backendu).

**Grafika**
SVG heatmap: nagłówek kolumn (WACC: 8% 9% 10% 11% 12%), nagłówek wierszy (g: 1.0 1.5 2.0 3.0), siatka 5×4 kolorowych komórek. Rozmiary komórek: `CELL_W=84, CELL_H=40`. Każda komórka z zaokrąglonymi narożnikami (rx=3). Tekst wartości EV w komórce (compact: „57M", „45M", „36M" itd.). Legenda kolorów pod siatką (gradient rose→slate→emerald, 24 stopnie). Aktywna sekcja sensitivity w tab bar FinanceHub wyświetla tę heatmapę.

**Funkcjonalność**
`ValuationVisualsPanel.tsx:101-115` → `buildHeatmap()`. `SensitivityHeatmap.tsx`: `xLabels`, `yLabels`, `matrix`. `valueIndex = Map<"${x} ${y}", value>`. Klucz string: `${c.x} ${c.y}` (ValuationVisualsPanel mapuje na `{x:c.wacc, y:c.g}`). Rozmiary SVG: `viewWidth = PAD_LEFT + cols*CELL_W + PAD_RIGHT = 96+420+20=536`. `viewHeight = PAD_TOP + rows*CELL_H + PAD_BOTTOM = 44+160+48=252`.

---

### MC-16W-19 · Kolory heatmapy: rose=niskie EV, emerald=wysokie EV · [FLAG] [DCF]

**Co się dzieje**
Konsultant interpretuje kolory heatmapy. Komórka WACC=12%/g=1% → najniższe EV = ~32 mln PLN → kolor rose/czerwony. Komórka WACC=8%/g=3% → najwyższe EV = ~65 mln PLN → kolor emerald/zielony. Środkowe wartości → kolor neutralny slate-100. Weryfikuje logikę kolorowania: `divergentColor(normalize(value))` — interpolacja rose→slate→emerald. Sprawdza też tekst (biały przy nasyconych kolorach, ciemny przy jasnych).

**Efekty pracy**
`normalize(v) = (v - minVal) / (maxVal - minVal)`. Najniższe EV → t=0 → `rose-500 rgb(244,63,94)`. Najwyższe EV → t=1 → `emerald-500 rgb(16,185,129)`. Środek t=0.5 → `slate-100 rgb(241,245,249)`. `textColorFor(t)`: `|t-0.5|>0.32` → biały; środek → ciemny slate. `SensitivityHeatmap.tsx:53-75`. Brak request API — klienckie obliczenia kolorów.

**Grafika**
Komórka WACC=12%, g=1%: tło czerwone, tekst biały, wartość „32M". Komórka WACC=8%, g=3%: tło zielone, tekst biały, wartość „65M". Komórka środkowa (np. WACC=10%, g=2%): tło jasno-szare, tekst ciemny, wartość „45M". Legenda pod siatką: gradient od rose (lewo, minVal „32M") do emerald (prawo, maxVal „65M"). Brak odwróconej kolorystyki (EV wysokie=zielone zgodnie z intuicją finansową).

**Funkcjonalność**
`SensitivityHeatmap.tsx:53-75` → `divergentColor(t)`, `textColorFor(t)`. `SensitivityHeatmap.tsx:90-113` → `valueIndex`, `normalize`. `SensitivityHeatmap.tsx:190-237` → renderowanie komórek z fill z `divergentColor`.

---

### MC-16W-20 · Etykiety osi — WACC kolumny, g wiersze · [FLAG] [DCF]

**Co się dzieje**
Konsultant sprawdza poprawność etykiet osi heatmapy. Kolumny (oś X): wartości WACC (8, 9, 10, 11, 12) — powinny być wyświetlone jako „8", „9", „10", „11", „12" (bez znaku %, bo przychodzą jako liczby z backendu). Wiersze (oś Y, po lewej): wartości g (1, 1.5, 2, 3). Weryfikuje nagłówek sekcji: „Wrażliwość WACC×wzrost" (ValuationVisualsPanel.tsx:176). Sprawdza orientację: WACC na górze (xLabels), g po lewej (yLabels) — standard finansowy.

**Efekty pracy**
`SensitivityHeatmap.tsx` → `xLabels=[8,9,10,11,12]` (kolumny) → renderowane jako `<text>` PAD_LEFT + ci*CELL_W. `yLabels=[1.0,1.5,2.0,3.0]` (wiersze) → `<text>` PAD_LEFT-12, y=PAD_TOP + ri*CELL_H. `String(cx)` i `String(ry)` — konwersja na string. Nagłówek sekcji z ValuationVisualsPanel: `<h3>Wrażliwość WACC×wzrost</h3>`. Brak request API.

**Grafika**
Etykiety kolumn (WACC): `fontSize=12, fontWeight=600, fill="rgb(51 65 85)"`, centrowane nad kolumną. Etykiety wierszy (g): `fontSize=12, fontWeight=600, fill="rgb(51 65 85)"`, wyrównane do prawej (textAnchor=end). Lewa strona (PAD_LEFT=96px): przestrzeń na etykiety wierszy. Górna strona (PAD_TOP=44px): przestrzeń na etykiety kolumn. Nagłówek sekcji „Wrażliwość WACC×wzrost": `text-sm font-semibold text-gray-900`.

**Funkcjonalność**
`SensitivityHeatmap.tsx:159-187` → dwa bloki map dla etykiet. `PAD_LEFT=96, PAD_TOP=44`. Walidacja: `if (cols.length === 0 || rows.length === 0 || valueIndex.size === 0)` → pusty stan `data-empty="true"` (nie crash przy brakujących etykietach). `buildHeatmap(v)`: `xLabels = Array.isArray(s?.waccGrid) ? s!.waccGrid : []`.

---

### MC-16W-21 · Tooltip komórki — hover → wyświetla EV · [FLAG] [DCF]

**Co się dzieje**
Konsultant najeżdża myszą na komórkę heatmapy WACC=9%, g=2.0%. Oczekuje pojawienia się native SVG tooltip z wartością EV. Tooltip pochodzi z `<title>` wewnątrz `<rect>` — wyświetlany przez przeglądarkę natywnie (bez custom React tooltip). Treść: „9 × 2: 48M" (format: `{String(cx)} × {String(ry)}: {formatValue(value)}`). Jeśli komórka bazowa (baseX/baseY match) → dodatkowy suffix „(bazowa)". Sprawdza zachowanie na brakującej komórce: `has=false` → tooltip „brak".

**Efekty pracy**
`<rect>` z `<title>`: `{String(cx)} × {String(ry)}: {has ? formatValue(value) : 'brak'}{isBase ? ' (bazowa)' : ''}`. Natywny tooltip przeglądarki (nie custom). `formatValue = defaultFormatValue` → compact. Komórka bazowa zaznaczona: `stroke="rgb(139 92 246)" strokeWidth=3` (fioletowa obwódka). Brak komórki z `has=false` → tło slate-50, tekst w komórce niewidoczny (`{has && <text>...`).

**Grafika**
Hover: kursor zmienia się na pointer (lub default, SVG). Tooltip: mały prostokąt systemowy z tekstem „9 × 2: 48M". Komórka bazowa: fioletowa obwódka 3px, tekst w tej komórce `fontWeight=700`. Komórka z brakującą wartością: tło `rgb(248 250 252)` (slate-50), brak tekstu. Legenda kolorów widoczna pod siatką niezależnie od hover.

**Funkcjonalność**
`SensitivityHeatmap.tsx:203-219`. Klucz `"${cx} ${ry}"` mapowany z `valueIndex`. `isBase`: `String(cx) === String(baseX) && String(ry) === String(baseY)`. `formatValue(value)` → `defaultFormatValue` → compact. SVG `<title>` — natywny tooltip. Brak `onMouseEnter` event na komórkach (Tornado ma, Heatmap NIE ma custom tooltip).

---

### MC-16W-22 · Heatmapa nieobecna przy braku danych sensitivity.matrix · [FLAG]

**Co się dzieje**
Konsultant wybiera wycenę, dla której backend zwrócił wyniki DCF, ale NIE macierz wrażliwości (`results.sensitivity` = null lub `results.sensitivity.matrix` = null). `ValuationVisualsPanel` buduje heatmapę: `buildHeatmap(v)` → `xLabels=[], yLabels=[], cells=[]`. `hasHeatmap = false`. Sekcja heatmapy renderuje się z `SectionEmpty` (pusty stan), NIE z `SensitivityHeatmap`. Football Field i Tornado mogą nadal renderować dane.

**Efekty pracy**
`buildHeatmap(v)`: `s = v.sensitivity` = null → `xLabels = Array.isArray(null?.waccGrid) ? ... : [] = []`. `hasHeatmap = xLabels.length > 0 && yLabels.length > 0 && cells.length > 0 = false`. Sekcja heatmap: `{hasHeatmap ? <SensitivityHeatmap .../> : <SectionEmpty>Brak analizy wrażliwości — uruchom wycenę.</SectionEmpty>}`. Brak crash. `SensitivityHeatmap` NIE jest montowany (brak SVG). `hasAnything` może być true jeśli hasFootball lub hasTornado.

**Grafika**
Sekcja „Wrażliwość WACC×wzrost": biała karta (border, rounded-xl). Zamiast siatki kolorów: tekst `text-sm text-gray-500` „Brak analizy wrażliwości — uruchom wycenę." Alternatywnie: jeśli `SensitivityHeatmap` jest montowany z pustymi xLabels → renderuje `<div data-testid="sensitivity-heatmap" data-empty="true">` z tekstem „Brak danych — uruchom analizę wrażliwości" (SensitivityHeatmap.tsx:126-139).

**Funkcjonalność**
`ValuationVisualsPanel.tsx:106-115` → `buildHeatmap`. `hasHeatmap` (linia 147). `SectionEmpty` komponent (linia 134-136). `SensitivityHeatmap.tsx:126-139` → empty state gdy `cols.length=0 || rows.length=0 || valueIndex.size=0`. Dwa poziomy ochrony: ValuationVisualsPanel (`SectionEmpty`) i SensitivityHeatmap (własny empty state).

---

# E. Tornado Chart

---

### MC-16W-23 · Tornado renderuje słupki posortowane malejąco (|high−low|) · [FLAG] [DCF]

**Co się dzieje**
Backend zwrócił `results.tornado = [{label:'WACC', low:32000000, high:62000000}, {label:'Wzrost przychodów', low:38000000, high:55000000}, {label:'Marża EBITDA', low:40000000, high:52000000}, {label:'Capex', low:42000000, high:50000000}, {label:'Kapitał obrotowy (NWC)', low:43000000, high:49000000}]`. `TornadoChart` sortuje malejąco po `|high-low|`: WACC (30M), Wzrost (17M), Marża (12M), Capex (8M), NWC (6M) — WACC na górze.

**Efekty pracy**
`TornadoChart.tsx:60-66` → `sorted = [...bars].sort((a,b) => Math.abs(b.high-b.low) - Math.abs(a.high-a.low))`. WACC (|62-32|=30M) na pozycji 0 (góra). NWC (|49-43|=6M) na pozycji 4 (dół). Brak żądania API. Sortowanie czysto klienckie. `data-testid="tornado-bar" data-label="WACC"` dla pierwszego słupka. SVG renderuje 5 słupków.

**Grafika**
SVG TornadoChart (viewBox 720×(5×38+44)=234): najszerszy słupek na górze (WACC), najwęższy na dole (NWC) — kształt tornada. Etykiety driverów po lewej (LABEL_W=150px), textAnchor=end. Linia pionowa bazowa (45M) przerywana szara. Tekst pod linią: „baza 45M". Każdy słupek = BAR_H=24px wysoki, GAP=14px między. Szerokość słupka proporcjonalna do |high-low|.

**Funkcjonalność**
`buildTornado(v)` (ValuationVisualsPanel.tsx:118-132): filtruje `isNum(t.low) && isNum(t.high) && typeof t.label === 'string'`. `TornadoChart.tsx:60-66`: sortowanie. Baza: `v.dcf?.enterpriseValue = 45M`. `bars.length > 0` → render SVG (nie empty state).

---

### MC-16W-24 · 5 driverów (WACC, wzrost, marża, capex, NWC) + linia bazowa · [FLAG] [DCF]

**Co się dzieje**
Konsultant analizuje wykres tornado z 5 driverami. Linia pionowa bazowa przebiega przez 45 mln PLN (EV DCF). Słupek WACC: część poniżej 45M (low=32M → strata: różnica 13M) jest kolorowana na rose, część powyżej (high=62M → zysk: różnica 17M) na emerald. Konsultant weryfikuje, że kierunek jest poprawny: wyższe EV po prawej stronie linii bazowej, niższe po lewej. Najeżdża na słupek WACC → tooltip „min 32M · max 62M · wpływ 30M".

**Efekty pracy**
`TornadoChart.tsx:140-154`: `negFrom=min(xLow,xHigh,baseX)`, `negTo=baseX` → segment rose. `posFrom=baseX`, `posTo=max(xLow,xHigh,baseX)` → segment emerald. `hover=0` (WACC) → `data-testid="tornado-tooltip"` z wartościami. Tooltip: `<div data-testid="tornado-tooltip">` absolutnie pozycjonowany. `sorted[hover].label="WACC"`, `sorted[hover].low=32M`, `sorted[hover].high=62M`. `Math.abs(high-low)=30M`.

**Grafika**
Słupek WACC (row 0): rose segment od 32M do 45M (lewo od linii bazowej), emerald segment od 45M do 62M (prawo od linii bazowej). Łącznie słupek ciągły z przerwą na linię bazową. Linia bazowa: `stroke-slate-400 strokeWidth=1.5 strokeDasharray="4 3"`. Tekst „baza 45M" poniżej linii. Tooltip: biała karta z shadow-md, `rounded-md border`. Na górze komponentu (absolute top-2).

**Funkcjonalność**
`TornadoChart.tsx:135-189`: SVG bars map. `onMouseEnter={() => setHover(i)}`, `onMouseLeave`. `hover !== null && sorted[hover]` → tooltip render (linia 193-209). `formatValue(Math.abs(sorted[hover].high - sorted[hover].low))` → „30M". `xScale(base)=baseX`. Domyślny zakres osi: symetryczny wokół base: `spread = max(base-min, max-base)`.

---

### MC-16W-25 · Tornado nieobecne bez danych (pusty stan) · [FLAG]

**Co się dzieje**
Konsultant wybiera wycenę gdzie `results.tornado` = null lub pusta tablica `[]`. `buildTornado(v)` zwraca `{bars:[], base:45000000}`. `hasTornado = false`. Sekcja Tornado renderuje `SectionEmpty` z komunikatem. Jeśli `TornadoChart` jest jednak montowany z `bars=[]` → TornadoChart sam renderuje pusty stan `data-testid="tornado-chart"` bez `data-empty` ale z tekstem „Brak danych — dodaj drivery wrażliwości" (TornadoChart.tsx:95-103).

**Efekty pracy**
`ValuationVisualsPanel.tsx:147` → `hasTornado = bars.length > 0 = false`. Sekcja tornado (linia 184-191): `{hasTornado ? <TornadoChart .../> : <SectionEmpty>Brak driverów wrażliwości — uruchom wycenę.</SectionEmpty>}`. Brak crash. `TornadoChart` NIE montowany. Jeśli mimo to bars=[] i TornadoChart montowany → `if (!bars.length) return <div>Brak danych...` (linia 95-103).

**Grafika**
Sekcja „Wrażliwość jednozmiennowa": biała karta, nagłówek, poniżej: szary tekst „Brak driverów wrażliwości — uruchom wycenę." Brak SVG, brak słupków, brak linii bazowej. Reszta panelu (Football Field, Heatmap) może nadal renderować dane poprawnie.

**Funkcjonalność**
`ValuationVisualsPanel.tsx:118-133`: `buildTornado` → `bars = []` gdy `v.tornado` null/[]. `hasTornado = bars.length > 0`. `TornadoChart.tsx:95-103`: własny pusty stan. Dwa poziomy ochrony analogiczne do heatmapy.

---

### MC-16W-26 · Kolory słupków: rose=strata (poniżej base), emerald=zysk (powyżej) · [FLAG] [DCF]

**Co się dzieje**
Konsultant weryfikuje semantykę kolorów Tornado: CZERWONY (rose) = wartość EV maleje (driver w kierunku negatywnym), ZIELONY (emerald) = EV rośnie. Dla drivera WACC: wzrost WACC → niższe EV (negatyw = rose). Spadek WACC → wyższe EV (pozytyw = emerald). Sprawdza też szczegółowy case: driver „Wzrost przychodów" — high=55M > base=45M → emerald po prawej; low=38M < base → rose po lewej. Weryfikuje semantykę na 2-3 driverach.

**Efekty pracy**
`TornadoChart.tsx:140-154`: `negFrom=Math.min(xLow,xHigh,baseX)`, `negTo=baseX` → `<rect fill-rose-500/85>` (segment ROSE). `posFrom=baseX`, `posTo=Math.max(xLow,xHigh,baseX)` → `<rect fill-emerald-500/85>` (segment EMERALD). `negTo > negFrom` warunek na renderowanie rose (jeśli low >= base → brak rose). `posTo > posFrom` warunek na emerald. Brak żądania API.

**Grafika**
Każdy słupek podzielony na dwa prostokąty przy linii bazowej. Rose segment: fill `fill-rose-500/85 dark:fill-rose-500/70`, opacity 0.92 (0 hover) → 1 (hover). Emerald segment: fill `fill-emerald-500/85 dark:fill-emerald-500/70`. Krawędzie obydwu prostokątów rx=3. Na hover (isHover=true) oba segmenty opacity=1 (podświetlone). Pas WACC (najszerszy) najbardziej widoczny w obu kolorach.

**Funkcjonalność**
`TornadoChart.tsx:155-178`: dwa osobne `<rect>` — rose (negFrom→baseX) i emerald (baseX→posTo). Warunek `negTo > negFrom` zabezpiecza przed renderowaniem rose o zerowej szerokości. `isHover = hover === i`. `className="fill-rose-500/85 dark:fill-rose-500/70"`. `className="fill-emerald-500/85 dark:fill-emerald-500/70"`.

---

# F. Komparacja i zarządzanie

---

### MC-16W-27 · Edycja założeń wyceny (PATCH) + ponowne przeliczenie · [DB] [DCF]

**Co się dzieje**
Konsultant zmienia scenariusz wyceny: klient zdecydował o bardziej agresywnym wzroście, g podniesione z 2.0% do 2.5%. Otwiera zakładkę Założenia dla wyceny „Wycena DCF — bazowy Q1 2026". Zmienia g% z 2.0 na 2.5 (preset „GDP PL ~2.5%" lub ręczny wpis). Sprawdza walidację (9.5 > 2.5 ✓). Klika „Save assumptions" → `PUT /api/economics/valuations/:id/assumptions`. Następnie klika „Compute" → nowe EV (wyższe niż przy g=2.0%). Weryfikuje nowy EV w tab Results i porównuje z poprzednim (różnica ~+8%).

**Efekty pracy**
`PUT /api/economics/valuations/:id/assumptions` z nowym `terminalGrowthPercent=2.5` → 200. Toast „Assumptions saved". `POST /compute` → nowe wyniki w `results.dcf.enterpriseValue`. `fetchValuation(selectedId)` odświeża `selected`. Tab Results: nowy EV widoczny. Hard-refresh → `GET :id` zwraca zaktualizowane założenia i wyniki. Brak zapisu jeśli `validationError` aktywny (zabezpieczenie linia 276).

**Grafika**
Pole g%: wartość zmienia się z 2.0 na 2.5. Preset pill „GDP PL ~2.5%" zabarwia się (primary-500/10 + primary border). Przycisk „Save assumptions" (full-width, navy-900). Toast sukces. Tab Results: EV zmienia się (np. „48M PLN" zamiast „45M PLN"). Nagłówek panelu: status nadal „DRAFT". Linia bazowa Football Field (przy aktywnej fladze) przesuwa się na nowy EV.

**Funkcjonalność**
`ValuationWorkspace.tsx` → `handleSaveAssumptions()` (linia 271-297). `trackFunnelEvent('valuation_assumption_updated', {valuationId})`. Następnie `handleCompute()`. `onValuationChanged?.()` po compute. `selected.assumptions` po `fetchValuation` odtwarza nowe wartości formularza. `setAssumptions({...DEFAULT_ASSUMPTIONS, ...safeJson(v.assumptions, DEFAULT_ASSUMPTIONS)})`.

---

### MC-16W-28 · Usunięcie wyceny · [DB] [V8]

**Co się dzieje**
Konsultant chce usunąć wycenę testową „Wycena test — do usunięcia". Szuka opcji usunięcia w UI — sprawdza czy dostępna jest akcja Delete w FinanceHub (tabela wycen). Klika akcję delete (trash icon lub przycisk w menu wiersza tabeli). Potwierdza operację. Po usunięciu weryfikuje, że wycena zniknęła z listy i nie można jej otworzyć.

**Efekty pracy**
`DELETE /api/economics/valuations/:id` → 200/204. Lista wycen odświeżona (`GET /api/economics/valuations`). Wycena NIE pojawia się po hard-refresh. Jeśli wycena była zaznaczona (selectedId = id usuniętej) → `selected` = null, panel szczegółów pokazuje stan „Select a valuation to continue". Toast sukces usunięcia. Cross-module: ewentualne zależności (advisory, negotiation pack) — weryfikować kaskadowe usunięcie przez backend.

**Grafika**
FinanceHub tabela (tab valuation): ikona trash / przycisk Delete w wierszu lub menu `...`. Modal potwierdzenia lub natychmiastowe usunięcie (do weryfikacji). Po usunięciu: lista skraca się o jeden wiersz. Panel szczegółów (col-span-8): `h-[520px] flex items-center justify-center` z tekstem „Select a valuation to continue". Toast.

**Funkcjonalność**
`FinanceHub.tsx` → `DELETE /api/economics/valuations/:id` (v8 endpoint). `ValuationWorkspace.tsx` NIE implementuje delete bezpośrednio (lista i akcje w FinanceHub). Weryfikuj w Network: `DELETE /api/v8/finance/valuations/:id` lub `DELETE /api/economics/valuations/:id`. Po delete: `loadValuations()` → `setValuations(...)`.

---

### MC-16W-29 · Stepper 5-krokowy (source→assumptions→results→sensitivity→export) · [DCF]

**Co się dzieje**
Konsultant eksploruje kompletny 5-krokowy przepływ wyceny. Po wybraniu wyceny z listy widzi stepper z 5 zakładkami: Source, Assumptions, Results, Sensitivity, Export. Przechodzi kolejno przez wszystkie kroki: (1) Source — informacja o źródle, (2) Assumptions — DCF i Comps, (3) Results po compute — EV + advisory, (4) Sensitivity — heatmapa i tornado inline (nie ValuationVisualsPanel), (5) Export — przycisk PPTX + ExportButton. Weryfikuje pasek postępu (linia + kółka).

**Efekty pracy**
`setActiveStep(s)` zmienia lokalny stan. Brak żądania API przy zmianie kroku (client-side routing). Krok Source: prosty tekst informacyjny. Krok Sensitivity: renderuje heatmapę z `computed.sensitivity.matrix` i tornado z `computed.tornado` inline (nie ValuationVisualsPanel). Krok Export: dostępny bez APPROVED (przycisk PPTX klikalny, ale backend może zwrócić błąd jeśli nie APPROVED). Pasek postępu: `progressPercent = (activeIndex / 4) × 100`.

**Grafika**
Stepper: `div className="relative mb-3"` z linią tła (bg-slate-200) i linią postępu (bg-navy-900 transition-all). Nad linią: 5 kółek (3px border-radius, 12px wymiar). Aktywne/przeszłe kółka: `bg-primary-600 border-primary-600`. Przyszłe: `bg-white border-slate-300`. Zakładki tekstowe poniżej: `px-3 py-1.5 rounded-lg text-sm border` — aktywna `bg-primary-600 text-white`. Zawartość panelu zmienia się w miejscu (bez navigate).

**Funkcjonalność**
`ValuationWorkspace.tsx:118-119` → `activeStep: 'source'|'assumptions'|'results'|'sensitivity'|'export'`. Stepper (linia 612-671). Warunkowe rendery `{activeStep === 'assumptions' && (...)}`. Krok sensitivity (linia 1312-1432): własna heatmapa z `computed.sensitivity.matrix` (tabela HTML) i tornado (lista `ul`). Krok export (linia 1434-1461): `handleExportPptx()` + `ExportButton`.

---

### MC-16W-30 · Eksport wyceny do Output (ExportButton / ExportToOutputDialog) · [DB]

**Co się dzieje**
Po zatwierdzeniu wyceny (Approve → status=APPROVED) konsultant przechodzi do kroku Export. Widzi dwa przyciski: „Export PPTX" (deck) i ExportButton (eksport do Outputs M17). Klika ExportButton — otwiera `ExportToOutputDialog` z `analysisType='valuation'`. W dialogu wybiera: format „Raport PDF", tytuł „Wycena Elkomtech Q1 2026 — Eksport". Klika Eksportuj. Weryfikuje w Network żądanie do eksportu Outputs. Następnie klika „Export PPTX" — `POST /api/economics/valuations/:id/export/pptx` → backend generuje plik PPTX, zwraca `downloadUrl`, okno otwiera URL.

**Efekty pracy**
PPTX: `POST /api/economics/valuations/:id/export/pptx` z `{language:'pl', theme:'corporate', confidentiality:'confidential'}` → 200, `{downloadUrl:...}`. `window.open(downloadUrl, '_blank')`. Toast „PPTX generated". `trackFunnelEvent('valuation_exported', {valuationId, format:'pptx'})`. ExportButton: `ExportToOutputDialog` z `analysisId=selectedId`, `analysisType='valuation'` → kreuje rekord w Outputs M17 (M17 GET Outputs endpoint). Hard-refresh Outputs → nowy export widoczny.

**Grafika**
Krok Export: tekst informacyjny „Export requires APPROVED valuation and includes disclaimers." Flex z przyciskami: „Export PPTX" (navy-900, Download icon) i ExportButton (osobny komponent). ExportButton renderuje ExportToOutputDialog: modal z polami (format, tytuł, opcje). Jeśli status ≠ APPROVED → PPTX przycisk jest klikalny (brak FE disable — backend odrzuca) lub może być disabled (do weryfikacji). Toast po udanym eksporcie.

**Funkcjonalność**
`ValuationWorkspace.tsx:363-388` → `handleExportPptx()`. `ExportButton` (src/components/Finance/ExportButton.tsx): `<ExportButton analysisId={selectedId} analysisTitle={selected?.title} analysisType="valuation">`. Wewnątrz: `ExportToOutputDialog`. `POST /api/economics/valuations/:id/export/pptx`. `trackFunnelEvent('valuation_exported')`. `onValuationChanged?.()` po eksporcie.

---

## Macierz pokrycia funkcji → case'y

| Obszar funkcji | Case'y |
|---|---|
| Tworzenie wyceny (manual/model/budget) | MC-16W-01, 02, 03, 04, 05 |
| Walidacja Gordon Growth (g < WACC) | MC-16W-06 |
| Compute DCF (`POST /compute`) | MC-16W-07 |
| Enterprise Value w PLN (compact format) | MC-16W-08 |
| WACC zmiana i wpływ na EV | MC-16W-09 |
| Presety g makro (gordon growth) | MC-16W-10 |
| PV explicit vs terminal split | MC-16W-11 |
| Flaga valuationVisuals (aktywacja) | MC-16W-12 |
| Football Field — pas DCF + sensitivity | MC-16W-13 |
| Football Field — pas Comps | MC-16W-14 |
| Football Field — pas NAV (degeneracja) | MC-16W-15 |
| Football Field — punkt triangulacji | MC-16W-16 |
| Football Field — pusty stan | MC-16W-17 |
| Sensitivity Heatmap 5×4 | MC-16W-18 |
| Kolory heatmapy (rose/emerald/neutral) | MC-16W-19 |
| Etykiety osi WACC×g | MC-16W-20 |
| Tooltip komórki (SVG title) | MC-16W-21 |
| Heatmapa przy braku danych | MC-16W-22 |
| Tornado — sortowanie malejące | MC-16W-23 |
| Tornado — 5 driverów + linia bazowa + tooltip | MC-16W-24 |
| Tornado — pusty stan | MC-16W-25 |
| Tornado — kolory rose/emerald | MC-16W-26 |
| Edycja założeń (PUT) + recompute | MC-16W-27 |
| Usunięcie wyceny (DELETE) | MC-16W-28 |
| Stepper 5-krokowy + pasek postępu | MC-16W-29 |
| Eksport PPTX + ExportButton do Outputs | MC-16W-30 |

---

## Uwagi metodyczne

- **Zasada E2E:** każda mutacja (PUT assumptions, POST compute, POST /peers) weryfikowana przez Network tab + hard-refresh → stan identyczny. UI-zmiana bez żądania = FAIL.
- **Walidacja Gordon Growth:** `g < WACC` — sprawdzana **tylko** dla `terminalMethod === 'gordon'`. Exit multiple nie ma tej walidacji.
- **Flaga `valuationVisuals`:** resolucja: URL `ff_valuationVisuals=1` → localStorage `ff.fin_valuation_visuals=1` → Vite env `VITE_FIN_VALUATION_VISUALS_ENABLED`. Domyślnie OFF.
- **Puste stany (fail-soft):** każdy komponent (FootballField, SensitivityHeatmap, TornadoChart, ValuationVisualsPanel) ma własny empty state z `data-empty="true"`. Brak danych ≠ crash.
- **Football Field kolejność pasów:** DCF (1.) → Porównawcza (2.) → Majątkowa NAV (3.) — wg kolejności pushów w `buildRanges()`.
- **Heatmapa kolory:** ROSE = niskie EV (t→0), EMERALD = wysokie EV (t→1), NEUTRAL = środek. Tekst biały przy nasyconych kolorach (|t-0.5| > 0.32).
- **Tornado:** sortowanie `|high−low|` malejąco — najszerszy słupek na górze. ROSE = poniżej base (strata), EMERALD = powyżej base (zysk).
- **Currency format:** `Intl.NumberFormat(i18n.language, {style:'currency', currency:'PLN', notation:'compact', maximumFractionDigits:0})` → „45M PLN" w trybie compact.
- **API endpoints:** `ValuationWorkspace` używa `/api/economics/valuations` (NIE `/api/v8/finance/valuations`); `FinanceHub` może używać obu — zweryfikować prefiks w Network.
- **Advisory i Negotiation Pack:** dostępne TYLKO przy `status === 'APPROVED'` (bramka FE: `disabled={busy || selected?.status !== 'APPROVED'}`). Test MC-16W-30 weryfikuje ten gate.

# Financial Analysis v3 — SSOT

> **Status:** v3.1 — Professional-Grade Specification  
> **Benchmark:** Bloomberg Terminal · Capital IQ · Anaplan · Deloitte PrecisionView  
> **Cel:** Kanoniczny moduł **Financial Analysis** (6 zakładek) z **AI Chat jako aktywnym orkiestratorem** pracy analitycznej — nie komentatorem, lecz narzędziem zarządzającym analizą.  
> **Powiązane SSOT:**  
> - Operating model: `docs/product/OPERATING_MODEL_V3.md`  
> - Tools catalog: `docs/product/TOOLS_CATALOG_V3.md`  
> - AI Orchestration: `docs/product/AI_FINANCE_ORCHESTRATION_SPEC.md` ← **NOWY**  
> - Professional Readiness: `docs/validation/finance-v3/PROFESSIONAL_ANALYSIS_READINESS.md`  
> - Statement Ready Contract: `docs/product/STATEMENT_READY_CONTRACT.md`  
> - View modes: `docs/ui-standards/03-modules/view-modes-standard.md`  
> - Interactive boards: `docs/ui-standards/03-modules/interactive-board-standard.md`  
> - Finance Export: `docs/product/FINANCE_EXPORT_V3.md`

---

## 0) Zasada nadrzędna: AI Chat jako Financial Analyst-in-the-Loop

**Consultify nie jest arkuszem kalkulacyjnym z AI komentarzem. AI Chat jest aktywnym analitykiem finansowym**, który:

1. **Orchestruje** — proponuje kolejne kroki analizy, identyfikuje luki, sugeruje działania
2. **Wykonuje** — uruchamia obliczenia, buduje modele, generuje wyceny na polecenie
3. **Waliduje** — sprawdza spójność, wykrywa anomalie, kwestionuje nierealistyczne założenia
4. **Raportuje** — generuje profesjonalne narratywy analityczne z cytowaniami do danych
5. **Zarządza workflow** — pilnuje statusów, blokuje niekompletne artefakty, eskaluje problemy

**Kontrakt AI (MUST):**
- AI **nigdy nie wymyśla liczb** — każda wartość numeryczna pochodzi z silnika obliczeniowego (`numerical anchor` principle)
- AI **zawsze cytuje źródło** — każde stwierdzenie ma referencję do konkretnej linii/wskaźnika/okresu
- AI **proponuje, nie decyduje** — każda zmiana wymaga potwierdzenia użytkownika (Confirm/Reject/Refine)
- AI **rozumie kontekst** — wie w której zakładce jest user, jaki model jest otwarty, jakie dane są dostępne

> **Pełna specyfikacja AI orchestration:** `docs/product/AI_FINANCE_ORCHESTRATION_SPEC.md`

---

## 1) Cel produktu (v3.1)

Financial Analysis to obszar, w którym użytkownik — wspierany przez AI Chat jako aktywnego analityka — realizuje pełny cykl analizy finansowej:

| Etap | Zakładka | AI rola |
|------|----------|---------|
| Import i standaryzacja danych | **Statements** | AI mapuje, waliduje, naprawia |
| Budowa modelu finansowego | **Modele** | AI buduje baseline, zamyka pętlę P&L→CF→BS |
| Analiza wskaźnikowa i diagnostyka | **Analiza** | AI uruchamia analizy, generuje narratywy, identyfikuje ryzyka |
| Scenariusze i prognozy | **Predykcja** | AI proponuje założenia, zadaje pytania, porównuje scenariusze |
| Wycena przedsiębiorstwa | **Wycena** | AI przeprowadza DCF/comps, generuje sensitivity, raportuje |
| Analiza inwestycyjna | **Analiza inwestycyjna** | AI liczy NPV/IRR/ROI, ocenia inicjatywy |

Wynik pracy jest wykorzystywany w:

- **Reports** — raporty dla zarządu / inwestorów / banków (z traceability)
- **Presentations** — deck sponsor/VC-grade (z grounding do danych)
- **Initiatives** — traceability: skąd wzięły się założenia, KPI, ROI

---

## 2) 6 zakładek (kanon v3.1)

### 2.1 Statements (Financial Statement Ingestion)

> **Status:** Zaimplementowane. Pipeline: Upload → Detect → Extract → Map → Validate → Confirm.  
> **SSOT implementacji:** `docs/product/STATEMENT_READY_CONTRACT.md`  
> **Szczegóły:** 256 linii kanonicznych (91 P&L + 92 BS + 76 CF), 4-tier mapping policy, learning loop.

Statements to fundament — bez `ready` statements żaden downstream flow nie może wystartować.

---

### 2.2 Modele finansowe (Financial Modeling)

**Cel:** Zbudować zamknięty, powiązany 3-statement model finansowy (P&L + Balance Sheet + Cash Flow) jako środowisko symulacyjne klasy investment banking.

**Benchmark:** Bloomberg XLTP, Macabacus, Wall Street Prep, Deloitte PrecisionView.

#### 2.2.1 Architektura silnika obliczeniowego (MUST)

Silnik modelowania (`FinancialModelEngine`) operuje na **zamkniętej pętli 3-statement**:

```
P&L (Income Statement)
  │
  ├─→ Net Income ──→ CF (Operating: indirect method)
  │                    │
  │   ΔWC ←───────────┤
  │   D&A ←───────────┤
  │   Capex ──────────→ CF (Investing)
  │   Debt ───────────→ CF (Financing)
  │                    │
  │              Net Change in Cash
  │                    │
  └─── Interest ←── BS (Debt balances) ←── CF (closing cash → BS)
```

**Zasady zamknięcia pętli (MUST):**

1. **P&L → CF:** Net Income otwiera CF (indirect). D&A, ΔWC, Capex, Debt service z P&L/BS zasilają CF.
2. **CF → BS:** Net Change in Cash aktualizuje Cash on BS. Debt drawdown/repayment aktualizuje Debt on BS.
3. **BS → P&L:** Interest expense = f(avg debt balance × cost of debt). Depreciation = f(PPE balance × depreciation rate).
4. **Circular reference resolution:** Iteracyjne rozwiązanie (max 100 iteracji, convergence threshold ε = 0.01).
5. **Balance check (MUST):** Assets = Liabilities + Equity. Jeśli nie — model jest `invalid`, AI raportuje rozbieżność.

#### 2.2.2 Driver-based modeling (MUST)

Każda pozycja modelu jest sterowana **driverem**, nie kwotą absolutną:

| Pozycja | Driver | Źródło |
|---------|--------|--------|
| Revenue | Growth rate YoY (%) | Historyczny CAGR lub manual |
| COGS | % of Revenue (Gross Margin) | Historyczna średnia |
| SG&A | % of Revenue | Historyczna średnia |
| R&D | % of Revenue | Historyczna średnia |
| D&A | % of avg PPE+Intangibles | Historyczna stawka |
| Capex | % of Revenue lub kwota | Historyczna intensywność |
| AR (DSO) | Days Sales Outstanding | Historyczny DSO |
| Inventory (DIO) | Days Inventory Outstanding | Historyczny DIO |
| AP (DPO) | Days Payable Outstanding | Historyczny DPO |
| Tax | Effective Tax Rate (%) | Historyczny ETR |
| Interest | Cost of Debt × avg Debt | Historyczna stawka |
| Dividends | Payout Ratio × Net Income | Historyczny payout |
| Debt | Maturity schedule + new issuance | Manual lub schedule |

**AI rola:** AI analizuje historyczne dane i **proponuje drivery** z uzasadnieniem. User zatwierdza lub modyfikuje.

#### 2.2.3 Zero-change baseline model (MUST)

Po imporcie `ready` statements system automatycznie generuje prognozę "zero-change":

- Wszystkie drivery = historyczne wartości (bez zmian)
- Revenue growth = 0% (flat) lub historyczny CAGR (user choice)
- Marże, rotacje, intensywność CAPEX — utrzymane z ostatniego okresu
- Pętla P&L→CF→BS zamknięta i zwalidowana

**AI rola:** AI generuje "Model Health Report" — podsumowanie baseline z flagami:
- ✅ Pętla zamknięta, bilans się zgadza
- ⚠️ Ujemny cash w roku 3 — sugeruje refinansowanie
- ⚠️ Gross margin poniżej mediany branżowej
- ❌ Brak danych CAPEX — model niekompletny

#### 2.2.4 Okresy i normalizacja (MUST)

- **Internal compute resolution:** miesięczna (MUST)
- **Input granularity:** roczna / kwartalna / miesięczna
- **Alokacja do miesięcy:**
  - Jeśli dostępna historia miesięczna → profil sezonowości
  - Jeśli nie → flat 1/12 (rok) lub 1/3 (kwartał)
  - Revenue sezonowość: AI może zaproponować profil na podstawie branży
- **Agregacja widoków:** UI pokazuje miesięcznie / kwartalnie / rocznie (toggle)
- **Roll-up:** P&L/CF sumowane; BS jako snapshot na koniec okresu

#### 2.2.5 Wersjonowanie i audit trail (MUST)

Każdy model ma pełny audit trail:

| Element | Tracking |
|---------|----------|
| Wartość | `origin`: imported / computed / manual_override / ai_suggested |
| Driver | `source`: historical_average / manual / ai_proposed / scenario_delta |
| Zmiana | `changelog`: kto, kiedy, co, z jakiej wartości na jaką |
| Snapshot | Immutable version z timestamp, hash, powiązanie z source statements |
| Diff | Porównanie dwóch wersji modelu (cell-level diff) |

**Workflow statusów:**
```
DRAFT → REVIEW → APPROVED → LOCKED
  │        │         │
  └─ edit  └─ edit   └─ snapshot only (new version = new DRAFT)
```

#### 2.2.6 Cash Flow — zasady konstrukcji (MUST)

**Metoda:** Indirect (standard investment banking).

**Jeśli CF nie jest dostarczony w danych:**
1. System **wylicza CF** z P&L + ΔBS
2. Oznacza jako `estimated / non-statutory`
3. AI generuje notę wyjaśniającą metodologię i ograniczenia

**Jeśli CF jest dostarczony ale niespójny:**
1. System pokazuje warning z kwotą rozbieżności
2. AI proponuje reconciliation (identyfikuje prawdopodobne źródło różnicy)
3. User decyduje: accept as-is / adjust / override

**Jeśli brak wystarczających danych (no BS):**
1. System blokuje budowę modelu
2. AI komunikuje: "Brak bilansu uniemożliwia zamknięcie pętli. Zaimportuj BS lub podaj kluczowe pozycje ręcznie."

#### 2.2.7 AI Chat — aktywne zarządzanie modelem (MUST)

AI Chat w kontekście modelu ma dostęp do **pełnych danych modelu** i może wykonywać:

| Polecenie użytkownika | AI akcja |
|----------------------|----------|
| "Zbuduj model z tych sprawozdań" | AI identyfikuje ready statements, proponuje drivery, tworzy DRAFT modelu |
| "Co jest nie tak z tym modelem?" | AI uruchamia validation suite, raportuje: balance check, CF tie-out, anomalie |
| "Zmień revenue growth na 8%" | AI proponuje override z **impact analysis**: jak zmiana wpłynie na NI, CF, BS, key ratios |
| "Porównaj z poprzednią wersją" | AI generuje diff table z komentarzem do istotnych zmian |
| "Jakie założenia przyjąłeś?" | AI wyświetla tabelę driverów z source i rationale |
| "Sprawdź czy model jest gotowy do wyceny" | AI weryfikuje completeness checklist: 3 statements, min 2 okresy historyczne, zamknięta pętla, CAPEX defined |
| "Wyjaśnij skąd pochodzi ta wartość" | AI pokazuje lineage: source file → extracted line → mapping → driver → computed value |

**AI proaktywnie (bez pytania):**
- Po każdej zmianie drivera: przelicza model i raportuje impact
- Po zamknięciu pętli: weryfikuje balance i CF tie-out
- Przy anomaliach: flaguje (np. "Debt/EBITDA przekracza 5x w roku 4 — covenant risk")

#### 2.2.8 UI: FinancialModelWorkspace (MUST)

**Layout:**
- **Left sidebar:** Lista modeli + status badges (DRAFT/REVIEW/APPROVED)
- **Main area:** Tabbed view:
  - **Statements** — 3 tabelki (P&L, BS, CF) z kolumnami: historyczne + prognoza
  - **Drivers** — tabela driverów z edycją inline
  - **Validation** — checks, warnings, errors
  - **Versions** — history + diff
- **Right panel:** AI Chat (context-aware, widzi model)
- **Top bar:** Toggle granularity (M/Q/Y), Export, Approve, Version

**Interakcje:**
- Click na komórkę → provenance tooltip (source, driver, formula)
- Double-click → edit (manual override, tracked in audit trail)
- Drag column headers → reorder periods

---

### 2.3 Analiza finansowa (Financial Analysis)

**Cel:** Profesjonalna analiza diagnostyczna na poziomie equity research / credit analysis, z AI jako aktywnym analitykiem generującym insights i narratywy.

**Benchmark:** Bloomberg Intelligence, S&P Capital IQ, Moody's Analytics, McKinsey Valuation (Koller et al.).

#### 2.3.1 Katalog analiz (MUST)

System oferuje następujące typy analiz, każdy uruchamialny przez AI Chat lub UI:

**A. Analiza wskaźnikowa (Ratio Analysis)**

42 wskaźniki w 6 kategoriach + 4 modele composite:

| Kategoria | Wskaźniki | Count |
|-----------|-----------|-------|
| Liquidity | Current, Quick, Cash, WC/Revenue | 4 |
| Profitability | Gross/Operating/EBT/EBITDA/Net Margin, ROA, ROE, ROCE, ROIC, ETR | 10 |
| Leverage | D/E, Debt Ratio, Equity Ratio, Financial Leverage, ND/EBITDA, Interest Coverage, DSCR, OCF/TD | 8 |
| Efficiency | Asset/FA/WC Turnover, Inventory Turnover, DIO, DSO, DPO, CCC | 8 |
| Cash Flow | OCF/NI, FCF/Revenue, Capex/Revenue, Capex/D&A | 4 |
| Growth (2-period) | Revenue, GP, EBIT, EBITDA, NI, Assets, Equity, OCF Growth | 8 |
| **Composite** | DuPont 5-Factor, Altman Z-Score (3 variants), Piotroski F-Score, SGR | **4 models** |

**Każdy wskaźnik ma:**
- Formułę (deterministic, computed from model data)
- Status: ok / warn / critical / n/a (threshold-based)
- Benchmark: P25 / median / P75 (branżowy, gdy dostępny)
- Trend: ↑ / → / ↓ (vs prior period)
- AI interpretation: 1-2 zdania kontekstu

**B. Analiza pionowa (Vertical / Common-Size Analysis)**

- P&L: każda pozycja jako % Revenue
- BS: każda pozycja jako % Total Assets
- Porównanie struktury między okresami
- AI identyfikuje istotne zmiany strukturalne (>2pp shift)

**C. Analiza pozioma (Horizontal / Trend Analysis)**

- Zmiana YoY (%) dla każdej pozycji
- CAGR za N lat (user-defined)
- Trend lines z identyfikacją inflection points
- AI flaguje: "Revenue CAGR 12% ale NI CAGR -3% → margin compression"

**D. Analiza DuPont (ROE Decomposition)**

```
ROE = Tax Burden × Interest Burden × Operating Margin × Asset Turnover × Financial Leverage
    = (NI/EBT)   × (EBT/EBIT)      × (EBIT/Rev)       × (Rev/TA)       × (TA/Eq)
```

- Waterfall chart: dekompozycja zmiany ROE między okresami
- AI identyfikuje: "ROE wzrósł o 3pp, z czego 2pp z poprawy marży operacyjnej, 1pp z wyższej dźwigni"

**E. Credit Analysis (Altman Z-Score + DSCR)**

- Altman Z-Score w 3 wariantach (public, private, emerging)
- Strefy: Safe (>2.99) / Grey (1.81-2.99) / Distress (<1.81)
- DSCR (Debt Service Coverage Ratio)
- AI generuje: "Credit assessment: [rating equivalent], key risks: [list]"

**F. Quality of Earnings (Piotroski F-Score)**

- 9 sygnałów binarnych (0/1), score 0-9
- Interpretacja: Strong (7-9) / Moderate (4-6) / Weak (0-3)
- AI komentuje każdy sygnał z kontekstem

**G. Cash Flow Analysis**

- OCF vs Net Income quality check
- FCF yield analysis
- Cash Conversion Cycle trend
- Capex maintenance vs growth split (jeśli dane dostępne)
- AI: "Cash generation quality: [assessment]. OCF/NI = 1.3x → strong accrual quality"

#### 2.3.2 Tryb pracy: Live View → Save (MUST)

- Domyślnie analiza = **Live View** (przeliczana na bieżąco z aktualnego modelu)
- **Save** tworzy immutable snapshot: `FinancialAnalysisRun`
  - Parametry (typ analizy, okresy, model version)
  - Wyniki (wszystkie wskaźniki, scores, narratywa)
  - Timestamp + author
- **Reanalyze** — ponowne przeliczenie na aktualnych danych (tworzy nowy run, stary zachowany)
- **Compare** — porównanie dwóch runów (diff table + AI commentary)
- **Export** — do Reports/Presentations z traceability do konkretnego runu

#### 2.3.3 AI-generated Financial Narrative (MUST)

Każda analiza zawiera automatycznie generowaną **narratywę analityczną**:

**Struktura narratywy (equity research standard):**

1. **Executive Summary** (3-5 zdań) — najważniejsze wnioski
2. **Profitability Assessment** — marże, ROE decomposition, trend
3. **Liquidity & Solvency** — WC, coverage ratios, debt capacity
4. **Operational Efficiency** — turnover, CCC, asset utilization
5. **Growth Dynamics** — revenue/earnings growth, sustainability (SGR)
6. **Risk Factors** — top 3-5 ryzyk z quantification
7. **Key Drivers** — co napędza wyniki (positive + negative)

**Zasady narratywy (MUST):**
- Ton: neutralny analityk finansowy (nie konsultant, nie sprzedawca)
- Każde stwierdzenie ma **cytat do danych** (np. "Gross margin 34.2% [P&L 2024]")
- Brak rekomendacji typu "buy/sell/hold"
- Brak spekulacji — tylko fakty i ich implikacje
- Język = język aplikacji (PL/EN)

**AI rola w dopracowaniu:**
- User: "Dodaj sekcję o working capital" → AI rozszerza narratywę
- User: "Skróć executive summary" → AI kondensuje
- User: "Porównaj z branżą" → AI dodaje benchmark context (jeśli dostępny)
- User: "Zmień ton na bardziej formalny" → AI przeformatowuje

#### 2.3.4 Benchmarki i dane makro (MUST)

**Benchmarki branżowe:**
- System utrzymuje bazę benchmarków (P25/median/P75) per branża/region
- Źródła: wbudowany dataset + user-defined + (v4) external API
- Każdy benchmark ma: source, date, sample size
- AI porównuje wskaźniki firmy z benchmarkami i flaguje outliers

**Dane makro (whitelist sources):**
- Stopy procentowe (central bank rates)
- Inflacja (CPI/PPI)
- FX rates (referencyjne)
- Każda wartość makro: source + date + cytowalność
- AI może sugerować użycie danych makro w kontekście (np. "Stopa referencyjna NBP = 5.75% [2024-03] — sugeruję jako proxy dla cost of debt")

#### 2.3.5 AI Chat — aktywne zarządzanie analizą (MUST)

| Polecenie użytkownika | AI akcja |
|----------------------|----------|
| "Przeanalizuj tę firmę" | AI uruchamia pełną analizę (ratios + composites + narrative), prezentuje wyniki |
| "Jakie są główne ryzyka?" | AI identyfikuje top 5 ryzyk z quantification i evidence |
| "Porównaj 2023 z 2024" | AI robi horizontal analysis, identyfikuje top zmiany, generuje waterfall |
| "Czy firma jest zagrożona bankructwem?" | AI liczy Altman Z (3 warianty) + Piotroski F + DSCR, interpretuje |
| "Rozłóż ROE na czynniki" | AI robi DuPont 5-Factor, waterfall chart, komentarz do każdego czynnika |
| "Zapisz tę analizę" | AI tworzy FinancialAnalysisRun z pełnym snapshot |
| "Przygotuj raport dla zarządu" | AI generuje executive-grade narrative + key charts → export to Reports |
| "Co powinienem sprawdzić dalej?" | AI proponuje next steps na podstawie wyników (np. "Wysoki CCC sugeruje analizę WC drivers") |

---

### 2.4 Predykcja (Forecasting / Scenarios)

**Cel:** Scenariusze i prognozy modyfikujące model bazowy — od stress testów po pełne business plany, z AI jako aktywnym partnerem w definiowaniu założeń.

**Benchmark:** Anaplan, Pigment, Planful, Adaptive Planning, Causal.

#### 2.4.1 Trzy tryby predykcji (MUST)

**Tryb 1: Index-driven (wskaźnikowy)**

Użytkownik (lub AI) modyfikuje drivery modelu bazowego:

- Bazuje na strukturze common-size (% revenue) z modelu
- Zmiany definiowane jako:
  - **Tabela per okres** (default): driver × miesiąc/kwartał/rok
  - **Step change** od daty: "od Q3 2025 gross margin = 36%" → materializowane do tabeli
  - **Ramp** (linear/exponential): "revenue growth rośnie z 5% do 12% w ciągu 3 lat"
- System przelicza pełny 3-statement model z nowymi driverami
- Zamknięcie pętli P&L→CF→BS (jak w modelu bazowym)

**Tryb 2: Document-driven (z dokumentów założeń)**

1. User uploaduje dokumenty (PDF/XLS/CSV): budżety sprzedaży, plany CAPEX, prognozy kosztów
2. AI parsuje dokumenty i identyfikuje założenia:
   - Revenue targets, cost budgets, headcount plans, CAPEX schedules
   - Mapuje do driverów modelu
3. AI identyfikuje **luki** i zadaje pytania w chacie:
   - "Dokument zawiera plan sprzedaży ale brak CAPEX. Jaki CAPEX planujesz?"
   - "Budżet kosztów nie obejmuje R&D. Utrzymać historyczną stawkę (4.2% revenue)?"
4. Po zebraniu odpowiedzi AI tworzy **podsumowanie założeń** → Confirm/Reject/Refine
5. Po Confirm → system generuje scenariusz

**Tryb 3: AI-assisted (konwersacyjny)**

1. User opisuje scenariusz w języku naturalnym:
   - "Co się stanie jeśli przychody spadną o 20% a koszty stałe zostaną?"
   - "Zaplanuj ekspansję na rynek niemiecki z revenue 5M EUR w roku 2"
2. AI tłumaczy na drivery, proponuje pełny zestaw założeń
3. User zatwierdza lub modyfikuje
4. System generuje scenariusz

#### 2.4.2 Horyzont i agregacje (MUST)

- **Default:** 3 lata (user może zmienić: 1-10 lat)
- **Rozdzielczość:**
  - Pierwsze 12/24/36 miesięcy: miesięczna
  - Dalsze lata: roczna
- **Roll-up:** P&L/CF sumowane; BS snapshot na koniec okresu
- **Sezonowość:** AI może zaproponować profil sezonowy (na podstawie historii lub branży)

#### 2.4.3 CAPEX i Working Capital — zasady twarde (MUST)

**CAPEX gate (blokada):**
- Scenariusz **nie może być zatwierdzony** bez zdefiniowanego CAPEX
- Dopuszczalne formy: kwota/tabela/recurrence/driver/% revenue
- AI proaktywnie: "Scenariusz nie ma CAPEX. Historyczna intensywność = 3.2% revenue. Zastosować?"

**Working Capital:**
- Jeśli brak explicit WC assumptions → system estymuje z historycznych rotacji (DSO/DIO/DPO)
- AI flaguje: "WC assumptions = historical. Przy revenue growth +15% DSO może wzrosnąć — rozważ adjustment"

#### 2.4.4 Porównanie scenariuszy (MUST)

System umożliwia porównanie **do 5 scenariuszy** side-by-side:

| Element | Baseline | Optimistic | Conservative | Stress |
|---------|----------|------------|--------------|--------|
| Revenue Y3 | 100M | 120M | 90M | 70M |
| Net Income Y3 | 8M | 14M | 5M | -3M |
| Cash Y3 | 15M | 25M | 10M | -5M |
| ND/EBITDA Y3 | 2.1x | 1.5x | 2.8x | 6.2x |

**Wizualizacje:**
- Revenue bridge (waterfall): baseline → delta per driver → scenario
- Margin waterfall: co zmienia marżę
- Cash flow waterfall: skąd cash, dokąd idzie
- Tornado chart: sensitivity per driver (which driver matters most)

**AI rola:**
- Generuje comparison narrative: "Scenariusz optymistyczny zakłada... Kluczowa różnica vs baseline to..."
- Identyfikuje break-even points: "Przy revenue drop >18% firma traci płynność w Q3 2027"
- Rekomenduje: "Stress test sugeruje potrzebę linii kredytowej min 5M jako buffer"

#### 2.4.5 Wpływ inicjatyw na scenariusz (MUST)

W predykcji można włączyć wybrane **inicjatywy** z modułu Initiatives:

**Kanon materializacji:**
- **Revenue uplift** → wzrost przychodu (nie GP). Marża podąża za bazowymi wskaźnikami.
- **Cost savings** → redukcja konkretnej grupy kosztów (musi być przypięta).
- **CAPEX** → konkretne kwoty w harmonogramie (timeline), nie % revenue.

**System:**
1. Pobiera financial effects z Initiative artifacts
2. Materializuje do osi miesięcznej
3. Liczy delta vs baseline
4. AI generuje: "Inicjatywa X dodaje +2.3M revenue w Y2 ale wymaga 1.5M CAPEX w Y1. Net impact on cash: -0.8M Y1, +1.1M Y2"

#### 2.4.6 Chat i potwierdzenie założeń (MUST)

**Workflow potwierdzenia:**
1. AI zbiera założenia (z dokumentów, konwersacji, lub UI)
2. AI tworzy **Assumptions Summary** — strukturalny dokument:
   - Revenue assumptions (growth, mix, pricing)
   - Cost assumptions (margins, headcount, inflation)
   - CAPEX assumptions (schedule, categories)
   - WC assumptions (rotations, changes)
   - Financing assumptions (debt, equity, cost)
3. User: **Confirm** / **Reject** / **Refine** (z komentarzem)
4. Po Confirm: snapshot założeń jest immutable (kto, kiedy, co potwierdził)
5. Scenariusz przechodzi do statusu `confirmed`

#### 2.4.7 AI Chat — aktywne zarządzanie predykcją (MUST)

| Polecenie użytkownika | AI akcja |
|----------------------|----------|
| "Stwórz scenariusz optymistyczny" | AI proponuje drivery (+10% revenue, +2pp margin, etc.) z uzasadnieniem branżowym |
| "Co się stanie jeśli przychody spadną o 15%?" | AI uruchamia stress test, pokazuje impact na NI, CF, covenants, cash runway |
| "Dodaj inicjatywę X do scenariusza" | AI pobiera financial effects, nakłada na model, pokazuje delta |
| "Porównaj wszystkie scenariusze" | AI generuje comparison table + narrative + recommendation |
| "Jakie założenia przyjąłeś?" | AI wyświetla Assumptions Summary z source/rationale |
| "Które założenie ma największy wpływ?" | AI uruchamia tornado analysis, identyfikuje top 3 sensitivity drivers |
| Upload PDF z budżetem | AI parsuje, mapuje do driverów, identyfikuje luki, zadaje pytania |
| "Zatwierdź ten scenariusz" | AI weryfikuje completeness (CAPEX defined? WC defined?), tworzy snapshot |

---

### 2.5 Wycena przedsiębiorstw (Valuation)

**Cel:** Profesjonalna wycena na poziomie equity research / M&A advisory, z AI jako aktywnym analitykiem prowadzącym proces wyceny.

**Benchmark:** Bloomberg DCF Template, Capital IQ Comps, PitchBook, Damodaran Online.

#### 2.5.1 Metody wyceny (MUST)

**A. DCF (Discounted Cash Flow) — metoda podstawowa**

```
Enterprise Value = Σ PV(UFCF₁..ₙ) + PV(Terminal Value)

UFCF = NOPAT + D&A − ΔWC − Capex
     = EBIT × (1 − Tax Rate) + D&A − ΔWC − Capex

Terminal Value = UFCFₙ × (1 + g) / (WACC − g)    [Gordon Growth]
           lub = EBITDAₙ × Exit Multiple            [Exit Multiple]

WACC = E/(D+E) × Ke + D/(D+E) × Kd × (1−t)

Ke (CAPM) = Rf + β × (Rm − Rf) + Size Premium + Country Risk Premium

Equity Value = EV − Net Debt − Minority Interest + Associates + Excess Cash
```

**Parametry (MUST):**

| Parametr | Default | Source | Editable |
|----------|---------|--------|----------|
| Forecast horizon | 5 lat | Standard | ✅ |
| Terminal method | Gordon Growth | Standard | ✅ (Gordon / Exit Multiple) |
| Perpetual growth (g) | 2.0% | Market standard | ✅ |
| Risk-Free Rate (Rf) | 4.5% | User input (10Y govt bond) | ✅ |
| Beta (β) | 1.0 | User input (or industry avg) | ✅ |
| Equity Risk Premium | 5.5% | Damodaran / user | ✅ |
| Size Premium | 0% | User input | ✅ |
| Country Risk Premium | 0% | User input | ✅ |
| Cost of Debt (Kd) | From model (interest/avg debt) | Computed | ✅ override |
| Tax Rate | ETR from model | Computed | ✅ override |
| D/E weights | From model (market or book) | Computed | ✅ override |

**AI rola:**
- AI proponuje parametry z uzasadnieniem: "Beta = 1.2 (industry median for SaaS). Rf = 4.3% (10Y UST as of 2024-12). ERP = 5.5% (Damodaran 2024)."
- AI waliduje: "WACC = 7.2%. Terminal Value = 68% of EV — within acceptable range (50-80%)."
- AI flaguje: "g (2.5%) > long-term GDP growth (2.0%) — consider reducing to avoid overvaluation."

**B. Comparable Companies (Trading Comps)**

| Element | Specyfikacja |
|---------|-------------|
| Peer selection | User-defined lub AI-suggested (na podstawie branży, size, geography) |
| Multiples | EV/EBITDA, EV/Revenue, EV/EBIT, P/E, P/B |
| Statistics | Mean, Median, P25, P75 per multiple |
| Implied EV | Subject company metric × peer multiple → implied EV per method |
| Output | Comps table + implied valuation range |

**AI rola:**
- AI sugeruje peer group: "Na podstawie branży (SaaS, B2B, ARR 10-50M) sugeruję: [lista 5-8 firm]"
- User może dodać/usunąć peers
- AI liczy implied valuation i komentuje: "Median EV/EBITDA = 12.5x → implied EV = 125M. Vs DCF (118M) = +6% premium."

**C. Football Field Chart (Valuation Summary)**

Zestawienie wyników z wszystkich metod na jednym wykresie:

```
DCF (base)        |████████████████████|  95M ─── 135M
DCF (optimistic)  |██████████████████████████|  110M ─── 160M
DCF (stress)      |████████████|  70M ─── 100M
EV/EBITDA comps   |█████████████████|  105M ─── 140M
EV/Revenue comps  |██████████████████████|  90M ─── 155M
52-week range     |████████████████|  88M ─── 128M
```

- Każda metoda = range (min-max lub P25-P75)
- Highlighted: "fair value range" (overlap zone)
- AI narrative: "Fair value range: 105-135M. DCF base case (118M) is within range. Key upside: margin expansion. Key risk: customer concentration."

#### 2.5.2 Sensitivity Analysis (MUST)

**2D Sensitivity Matrix (WACC × g):**

|  | g=1.0% | g=1.5% | g=2.0% | g=2.5% | g=3.0% |
|--|--------|--------|--------|--------|--------|
| WACC=6% | 145M | 158M | **175M** | 198M | 230M |
| WACC=7% | 118M | 126M | **135M** | 148M | 165M |
| WACC=8% | 98M | 104M | **112M** | 121M | 132M |
| WACC=9% | 84M | 88M | **94M** | 100M | 108M |
| WACC=10% | 73M | 76M | **80M** | 85M | 91M |

- Heatmap coloring (green → yellow → red)
- Base case highlighted (bold)
- AI: "Valuation is most sensitive to WACC (±1pp = ±18% EV change). Terminal growth has moderate impact."

**Tornado Chart (driver sensitivity):**
- Top 10 drivers ranked by impact on EV
- Each driver: ±10% change → EV impact
- AI identifies: "Revenue growth is the #1 driver. ±1pp revenue growth = ±8M EV."

#### 2.5.3 Market Assumptions Panel (MUST)

Dedykowany panel UI dla danych rynkowych:

| Input | Potrzebne do | Default | Source |
|-------|-------------|---------|--------|
| Risk-Free Rate | CAPM → Ke → WACC | 4.5% | User (10Y govt bond) |
| Beta | CAPM → Ke → WACC | 1.0 | User (or industry) |
| Equity Risk Premium | CAPM → Ke → WACC | 5.5% | User (Damodaran) |
| Market Cap | P/E, P/B, Altman Z (original) | Book Value | User (for public co.) |
| Peer multiples | Comps valuation | — | User input per peer |

AI może sugerować wartości z uzasadnieniem, ale user zawsze potwierdza.

#### 2.5.4 Artefakt Valuation (MUST)

```
Valuation
├── method: DCF | Comps | Blended
├── status: DRAFT → REVIEW → APPROVED
├── model_version: link to FinancialModel snapshot
├── scenario: link to FinancialScenario (optional)
├── parameters: all inputs (WACC, g, peers, etc.)
├── results: EV, Equity Value, per-share, ranges
├── sensitivity: matrices + tornado
├── narrative: AI-generated valuation summary
├── football_field: multi-method comparison
└── audit_trail: who, when, what changed
```

#### 2.5.5 AI Chat — aktywne zarządzanie wyceną (MUST)

| Polecenie użytkownika | AI akcja |
|----------------------|----------|
| "Wycenij tę firmę" | AI proponuje DCF z parametrami, generuje pełny output + narrative |
| "Jaki WACC powinienem przyjąć?" | AI analizuje strukturę kapitału, sugeruje WACC z uzasadnieniem |
| "Pokaż sensitivity" | AI generuje heatmapę WACC × g + tornado chart + komentarz |
| "Dodaj comparable companies" | AI sugeruje peers, user zatwierdza, AI liczy implied multiples |
| "Porównaj DCF z comps" | AI generuje football field chart + narrative o rozbieżnościach |
| "Czy ta wycena jest realistyczna?" | AI porównuje implied multiples z rynkowymi, flaguje outliers |
| "Przygotuj podsumowanie dla inwestora" | AI generuje equity research-grade valuation summary |
| "Co mogłoby zwiększyć wycenę?" | AI identyfikuje value drivers i quantyfikuje impact (→ link do T056 Valuation Improvement Advisory) |
| "Przygotuj argumenty negocjacyjne" | AI generuje pro/contra + Q&A (→ link do T057 Negotiation Argument Builder) |

---

### 2.6 Analiza inwestycyjna (Investment Analysis)

**Cel:** Ocena zwrotu z inwestycji per inicjatywa — NPV, IRR, Payback, ROI — z AI jako analitykiem oceniającym opłacalność.

**Benchmark:** Corporate finance textbook standard (Brealey/Myers, Damodaran).

#### 2.6.1 Metryki (MUST)

| Metryka | Formuła | Interpretacja |
|---------|---------|---------------|
| **NPV** | Σ PV(CF_t) − Initial Investment | >0 = value-creating |
| **IRR** | Rate where NPV = 0 | >WACC = acceptable |
| **Payback** | Time to recover investment (simple) | Shorter = less risky |
| **Discounted Payback** | Time to recover at PV | More conservative |
| **ROI** | (Total Benefits − Total Costs) / Total Costs | >0 = positive return |
| **Profitability Index** | PV(Benefits) / PV(Costs) | >1 = value-creating |
| **MOIC** | Total Value / Total Invested | Multiple of money |

#### 2.6.2 Źródło danych (MUST)

Podstawowe źródło: `Initiative > Finance`:
- CAPEX jako **kwotowy timeline** (wymagane; brak = blokada)
- Cost savings przypięte do **konkretnej grupy kosztów**
- Revenue uplift jako **wzrost przychodu**

Narzędzie może:
- Wykorzystać dane 1:1 z inicjatywy
- Pozwolić na "wariant inwestycyjny" (modyfikacja harmonogramu) — propozycja z potwierdzeniem

#### 2.6.3 Sensitivity (MUST)

Standardowo:
- **Stopa dyskontowa** (WACC ±2pp)
- **Skala korzyści** (±10%, ±20%, ±30%)
- **Czas realizacji** (opóźnienie startu: +3m, +6m, +12m)
- **CAPEX overrun** (+10%, +20%, +50%)

2D matrix: WACC × benefit scale → NPV grid

#### 2.6.4 AI Chat — aktywne zarządzanie analizą inwestycyjną (MUST)

| Polecenie użytkownika | AI akcja |
|----------------------|----------|
| "Oceń opłacalność tej inicjatywy" | AI pobiera dane z Initiative, liczy NPV/IRR/Payback/ROI, generuje assessment |
| "Czy to się opłaca?" | AI: "NPV = +2.3M, IRR = 18% (>WACC 9%), Payback = 2.1 lat. Verdict: value-creating." |
| "Co jeśli CAPEX wzrośnie o 30%?" | AI przelicza z CAPEX +30%, pokazuje impact na NPV/IRR/Payback |
| "Porównaj 3 inicjatywy" | AI generuje ranking table (NPV, IRR, Payback, PI) + recommendation |
| "Przygotuj business case" | AI generuje structured business case → export to Reports |

---

## 3) Artefakty (v3.1) — kontrakt domeny

| Artefakt | Pola kluczowe | Statusy | AI może tworzyć |
|----------|--------------|---------|-----------------|
| `FinancialModel` | 3 statements, drivers, periods, validation | DRAFT → REVIEW → APPROVED → LOCKED | ✅ (propozycja → confirm) |
| `FinancialAnalysisRun` | typ, parametry, wyniki, narratywa | saved (immutable snapshot) | ✅ |
| `FinancialScenario` | assumptions, drivers, model delta, initiative links | DRAFT → CONFIRMED | ✅ (propozycja → confirm) |
| `Valuation` | method, params, results, sensitivity, football field | DRAFT → REVIEW → APPROVED | ✅ (propozycja → confirm) |
| `InvestmentCase` | initiative link, metrics, sensitivity | DRAFT → APPROVED | ✅ (propozycja → confirm) |

**Każdy artefakt ma:**
- `id`, `organizationId`, `projectId`
- `status` (workflow-specific)
- `version` (auto-increment on save)
- `createdBy`, `createdAt`, `updatedBy`, `updatedAt`
- `sourceTraceability`: array of `{ type, id, label }` — co było źródłem
- `auditTrail`: array of `{ action, actor, timestamp, details }`
- `aiGenerated`: boolean — czy AI zaproponował (vs user created manually)
- `confirmedBy`, `confirmedAt` — kto i kiedy zatwierdził

---

## 4) Integracje (v3.1)

| System | Integracja | Kierunek |
|--------|-----------|----------|
| **Reports** | Export analizy/wyceny/scenariusza → Report section | Finance → Reports |
| **Presentations** | Export key charts + narrative → Deck slides | Finance → Presentations |
| **Initiatives** | Financial effects → Scenarios; Investment analysis → Initiative | Bidirectional |
| **AI Chat** | Full context injection; AI executes finance operations | Bidirectional |
| **MyWork / Notebook** | Notatki → założenia; Konwersje do finance artifacts | MyWork → Finance |
| **Agent Audit Layer** | CFO/Finance agent reviews Deep Thinking outputs | AI → Finance validation |

---

## 5) Dane rynkowe i zewnętrzne (v3.1)

### 5.1 Market Assumptions (MUST — v3.1)

Panel "Market Assumptions" dostępny globalnie w module Finance:

| Input | Default | Potrzebne do |
|-------|---------|-------------|
| Risk-Free Rate | 4.5% | WACC, DCF |
| Beta | 1.0 | WACC, DCF |
| Equity Risk Premium | 5.5% | WACC, DCF |
| Market Cap | Book Value | P/E, P/B, Altman Z (public) |
| Perpetual Growth (g) | 2.0% | Terminal Value |
| Industry benchmarks | Built-in dataset | Ratio analysis, comps |

### 5.2 External Data Sources (v4 — planned)

- Damodaran dataset (betas, ERPs, industry multiples)
- Central bank rates API
- Stock exchange API (for public companies)
- Industry benchmark providers

---

## 6) Quality Gates i Governance (MUST)

### 6.1 Statement → Model gate

Model może być utworzony **tylko** z `ready` statements (patrz `STATEMENT_READY_CONTRACT.md`).

### 6.2 Model → Analysis gate

Analiza wymaga modelu w statusie min. `DRAFT` z zamkniętą pętlą (balance check = pass).

### 6.3 Model → Scenario gate

Scenariusz wymaga modelu + zdefiniowanego CAPEX.

### 6.4 Model → Valuation gate

Wycena wymaga:
- Model z min. 2 okresami historycznymi
- Zamknięta pętla (balance check = pass)
- Zdefiniowane Market Assumptions (WACC inputs)
- Min. 3 lata prognozy

### 6.5 Numerical Anchor Principle (MUST)

**Każda wartość numeryczna w systemie pochodzi z silnika obliczeniowego, nigdy z LLM.**

- AI text musi być spójny z computed values
- Jeśli AI generuje narratywę, wartości są wstrzykiwane z engine (nie generowane przez LLM)
- Audit: każda wartość w narratywie ma `ref` do computed field

---

## 7) Out of scope (v3.1)

- Consolidation (multi-entity) — v4+
- ERP/GL connectors — v4+
- Real-time market data feeds — v4+
- Monte Carlo simulation — v4+
- LBO analysis — v4+
- Sum-of-the-Parts valuation — v4+
- Automated MCP operational/automation analysis — v4+

---

## 8) Powiązane specyfikacje

| Dokument | Opis |
|----------|------|
| `AI_FINANCE_ORCHESTRATION_SPEC.md` | Pełna specyfikacja AI Chat jako orkiestratora pracy finansowej |
| `STATEMENT_READY_CONTRACT.md` | Kontrakt jakości statements |
| `FINANCE_EXPORT_V3.md` | Export do Reports/Presentations/Initiatives |
| `PROFESSIONAL_ANALYSIS_READINESS.md` | Assessment gotowości analitycznej |
| `V4_GAP_ANALYSIS.md` § 6.7 | Gap analysis vs benchmark leaders |
| `FINANCE_MAPPING_POLICY.md` | 4-tier mapping policy |
| `FINANCE_IMPORT_ARCHITECTURE_DECISION.md` | ADR: rebuild extraction core |

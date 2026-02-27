# Financial Analysis v3 — SSOT

> **Status:** Draft (v3)  
> **Cel:** Opisać kanoniczny moduł **Financial Analysis** (5 zakładek) oraz “self‑reliant financial statement” jako narzędzie pracy.  
> **Powiązane SSOT:**  
> - Operating model: `docs/product/OPERATING_MODEL_V3.md` (Financial Analysis jako osobny obszar v3)  
> - Tools catalog: `docs/product/TOOLS_CATALOG_V3.md` (tool surfaces + integracje)  
> - View modes: `docs/ui-standards/03-modules/view-modes-standard.md`  
> - Interactive boards: `docs/ui-standards/03-modules/interactive-board-standard.md` *(v3)*  

---

## 1) Cel produktu (v3)

Financial Analysis to obszar, w którym użytkownik:

- buduje lub importuje **model finansowy** (P&L, Balance Sheet, Cash Flow)
- generuje **predykcje** (miesiące/lata)
- uruchamia **analizy** i zapisuje je jako zestawienia (biblioteka analiz)
- przygotowuje **wyceny** i **analizy inwestycyjne**

Wynik pracy jest wykorzystywany w:

- `Reports` (raporty dla zarządu / inwestorów)
- `Presentations` (deck “Gamma-like”)
- `Initiatives` (traceability: skąd wzięły się założenia i KPI/ROI)

---

## 2) 5 zakładek (kanon v3)

### 2.1 Modelowanie finansowe (Financial Modeling)

**Cel (v1/v3):** zbudować “wersję 0” zamkniętego modelu finansowego (**P&L + Balance Sheet + Cash Flow**) jako środowisko symulacyjne.

Wymagane elementy:

- import danych historycznych (MUST: **PDF sprawozdania**; opcjonalnie Excel)
- mapowanie do **kanonicznego formatu Consultinity** (3 statementy):
  - **P&L** (rachunek wyników)
  - **Balance Sheet** (bilans)
  - **Cash Flow** (rachunek przepływów)
- obsługa wejścia o różnej granularności: **rok / kwartał / miesiąc** (import + normalizacja okresów)
- walidacja spójności (twarde reguły + ostrzeżenia) i transparentne komunikaty braków danych
- wersjonowanie (snapshoty modelu) + traceability do źródła importu i mapowania

#### 2.1.1 Kanoniczna mechanika v1: “zero‑change model” (MUST)

Po imporcie i zbudowaniu okresu bazowego system generuje prognozę “bez zmian założeń”:

- **P&L**: wszystkie poziomy przychodów i kosztów utrzymujemy jako **% od sumy przychodów** z okresu bazowego.  
  Jeśli revenue nie zmienia się → P&L jest flat; jeśli revenue rośnie → koszty rosną proporcjonalnie (stałe wskaźniki).
- **Working capital**: wskaźniki rotacji (np. DSO/DPO/DIO lub WC%) utrzymujemy **bez zmian** (jak w bazie).
- **CAPEX + amortyzacja**: analogicznie jak w bazie (brak zmian).
- **Dług + koszt długu**: analogicznie jak w bazie (brak zmian).
- **CF → BS**: po P&L system liczy CF i aktualizuje bilans tak, by pętla się domykała.

To jest “baseline autopilot” — punkt odniesienia przed wprowadzeniem scenariuszy i zmian fundamentalnych.

#### 2.1.2 Okresy i normalizacja (MUST)

- System przyjmuje dane wejściowe w granularności **rocznej/kwartalnej/miesięcznej**.
- **Silnik obliczeniowy** liczy kanonicznie na osi **miesięcznej** (internal compute resolution).  
  Widoki kwartalne/roczne są agregacją (UI/view).
- Alokacja rocznych/kwartalnych danych do miesięcy:
  - jeśli mamy miesięczną historię (lub profil sezonowości) → używamy wag sezonowości,
  - jeśli nie → fallback “jak w życiu”: **flat 1/12** (rok) lub **1/3** (kwartał).

#### 2.1.3 Import PDF → mapping → walidacje (MUST)

Kanon pipeline:

1. **Extract** (OCR/tabele) → surowe pozycje i kwoty
2. **Normalize** (waluta, jednostki: tys./mln, okresy)
3. **Map** do kanonicznych linii (template IFRS/US GAAP/PL GAAP + custom)
4. **Validate** spójność (bilans, cash tie‑out gdzie możliwe)
5. **Baseline**: zapis okresów bazowych w 3 statementach + start prognozy “zero‑change”

#### 2.1.4 Cash Flow (CF) — zasady w v1 (MUST)

- Jeśli CF **nie jest dostarczony** w danych: system **wylicza CF** i oznacza go jako **estimated / non‑statutory** (może nie być zgodny z ustawowym formatem).  
- Jeśli CF nie da się policzyć (brak wystarczającego zbioru danych / brak bilansu / zbyt mało okresów) → system blokuje start i komunikuje brakujące dane.
- Jeśli CF jest dostarczony, ale ma niespójności → system pokazuje **warning/uwagę** (bez “cichej” korekty).

**UI surface (v3):**

- “interactive board / table” dla statementów + panel narzędzi/validacji

### 2.2 Analiza finansowa (Financial Analysis)

**Cel:** uruchamiać analizy na bazie modelu i utrzymywać bibliotekę wyników.

Przykłady analiz:

- wskaźniki rentowności / płynności / zadłużenia
- analiza zmian r/r i m/m
- analiza marż i kosztów (drivers)

**UI surface:**

- Module Hub: tabela + karty + (opcjonalnie) timeline
- każdy wpis w bibliotece analiz ma parametry/okres + wynik + “cover card”

#### 2.2.2 Tryb pracy: Live view → Save (MUST)

- Domyślnie analiza działa jako **Live View** (nie tworzymy artefaktów “na siłę”).
- Użytkownik może kliknąć **Save** — wtedy powstaje wpis w **bibliotece analiz** (status: `saved` w MVP).
- Zapisana analiza może zostać **ponownie przeliczona** (reanalyze) na aktualnych danych/modelu.
- Z zapisanej analizy można tworzyć **Reports/Presentations** — outputy są linkowane do konkretnej analizy (traceability).

#### 2.2.3 Komentarze i dopracowanie (MUST)

- Analiza zawiera automatyczne **omówienie analityczne** (neutralne, “financial analyst style”, bez rekomendacji konsultingowych).
- Użytkownik może dopracować analizę przez **chat w kontekście analizy**:
  - usuń/dodaj sekcję,
  - dodaj KPI,
  - doprecyzuj weryfikację,
  - popraw interpretację.
- Język komentarza = język aplikacji.

#### 2.2.1 Benchmarki i dane makro (v3)

- **Benchmarki** są częścią wyłącznie zakładki **Analiza finansowa** (nie Modelowania, nie Predykcji).  
  W v3 MVP: benchmarking odkładamy (rozwiniemy później).
- **Dane makro** (np. stopy, inflacja, FX referencyjny) mogą być pobierane wyłącznie ze **źródeł zatwierdzonych** (whitelist) oraz muszą być cytowalne (źródło + data).

### 2.3 Predykcja (Forecasting / Scenarios)

**Cel:** scenariusze i założenia, które modyfikują model (analysis scenariuszowa).

Wymagane:

- definicja założeń (drivers)
- uruchomienie predykcji i zapis wyniku
- porównanie scenariuszy (baseline vs scenario)

**UI surface:**

- interactive board (parametry + wynik) + biblioteka scenariuszy

#### 2.3.1 Dwa moduły predykcji (MUST)

W v3 predykcja działa w dwóch trybach:

1. **Predykcja wskaźnikowa (index-driven)** — zmieniamy wskaźniki wynikające z analizy:
   - bazujemy na strukturze P&L “as‑received” (grupy przychodów i kosztów) oraz common‑size (% revenue),
   - system wymaga zdefiniowania zmian wskaźników na przestrzeni okresu prognozy,
   - zmiany mogą być modelowane jako tabela per okres (default) lub jako “step change” od daty (materializowane do tabeli).

2. **Predykcja z dokumentów założeń (document-driven)**:
   - user uploaduje założenia (PDF/XLS/CSV) — budżety sprzedaży, koszty, CAPEX itp.,
   - system bierze to, co jest i uzupełnia brakujące parametry przez chat (Q&A), a następnie tworzy podsumowanie i czeka na potwierdzenie,
   - nie “zgadujemy” automatycznie braków bez interakcji — preferujemy pytania w czacie po analizie dokumentów.

#### 2.3.2 Horyzont i agregacje (MUST)

- Prognoza domyślnie obejmuje **3 lata** (user może zmienić).
- Rozdzielczość:
  - pierwsze **12 / 24 / 36 miesięcy** (wybór),
  - dalsze lata liczone jako **roczne** (bez miesięcy).
- System umożliwia **roll‑up do pełnych lat** (jak w Excelu):
  - P&L/CF sumowane rocznie,
  - BS jako snapshot na koniec roku.

#### 2.3.3 CAPEX i WC — zasady twarde (MUST)

- **Working capital**: jeśli brak danych, system estymuje (zgodnie z bazą/rotacjami lub fallback).
- **CAPEX**: jeśli brak informacji o CAPEX w scenariuszu → scenariusza **nie zatwierdzamy** (blokada).  
  CAPEX musi być zdefiniowany w jednej z dopuszczalnych form (kwota/tabela/recurrence/driver), a w inicjatywach — patrz 2.3.5.

#### 2.3.4 Chat i potwierdzenie założeń (MUST)

- System zadaje pytania, user odpowiada, system tworzy **podsumowanie założeń** i czeka na **Confirm**.
- Nie wymagamy archiwizacji transkryptu czatu, ale zapisujemy snapshot potwierdzonych założeń (co/od kiedy/kto potwierdził).

#### 2.3.5 Wpływ inicjatyw na scenariusz (MUST)

W predykcji można włączyć do scenariusza wybrane inicjatywy, które wnoszą “financial effects” w czasie.

Kanon (Initiative → Finance tab):

- **Revenue uplift** oznacza wzrost **przychodu** (nie gross profit).  
  Marża i COGS podążają wg bazowych wskaźników, chyba że scenariusz zmienia wskaźniki marż.  
  Zmiana cen rynkowo (inflacja) jest driverem scenariusza, nie inicjatywą.
- **Cost savings** zawsze dotyczy **konkretnej grupy kosztów** (musi być przypięta do grupy).
- **CAPEX w inicjatywach** jest podawany jako **konkretne kwoty w harmonogramie** (timeline), nie jako % revenue/PPE.

System materializuje wpływy inicjatyw do osi miesięcznej i liczy delta vs baseline.

### 2.4 Wycena (Valuation)

**Cel:** formatka pod wycenę przedsiębiorstwa (np. DCF / multiples).

Wymagane:

- definicja metody
- parametry (WACC, growth, multiples)
- wynik + wrażliwość (sensitivity)

#### 2.4.1 Kanon v1: DCF + EV/Equity (MUST)

- Podstawowa metoda: **DCF**.
- Horyzont projekcji: **5 lat** (default; user może zmienić).
- Terminal value: **Gordon Growth** (default).
- Dyskontowanie: **FCF to Firm (unlevered)** dyskontowane **WACC** (variant A).
- Wyniki:
  - **Enterprise Value (EV)**
  - **Equity Value** (EV → minus net debt + cash adjustments wg modelu)
- Sensitivity (MUST): **WACC × perpetual growth (g)**.
- `perpetual growth (g)` domyślnie jako market standard z makro (whitelist) + uzasadnienie w dokumencie; user może nadpisać.
- WACC: domyślnie per organizacja (market/średnia) + user może zmienić; koszt kapitału powinien być spójny między wyceną i analizami.

### 2.5 Analiza inwestycyjna (CAPEX / Investment)

**Cel:** analiza inwestycji i zwrotu (np. NPV/IRR, payback).

Wymagane:

- CAPEX/OPEX split
- harmonogram
- wynik i wrażliwość

#### 2.5.1 Kanon v1: Investment analysis per Initiative (MUST)

Analiza inwestycyjna jest osobnym narzędziem (nie “wycena firmy”). Służy do oceny pojedynczej inicjatywy:

- ROI / NPV / IRR / Payback
- harmonogram nakładów i korzyści
- wrażliwość na kluczowe parametry

##### 2.5.1.1 Źródło danych (MUST)

Podstawowe źródło to `Initiative > Finance`:

- CAPEX jako **kwotowy timeline** (wymagane; brak CAPEX blokuje zatwierdzenie)
- oszczędności kosztowe przypięte do **konkretnej grupy kosztów** (kwotowy timeline)
- revenue uplift jako **wzrost przychodu** (kwotowy timeline)

Narzędzie Investment może:

- wykorzystać te dane 1:1,
- lub pozwolić na “wariant inwestycyjny” (modyfikacja harmonogramu dla analizy) — zawsze jako propozycja z potwierdzeniem.

##### 2.5.1.2 Metryki (MUST)

Minimalny zestaw:

- **NPV** (PV przepływów zdyskontowanych)
- **IRR**
- **Payback period** (simple + opcjonalnie discounted payback)
- **ROI** (definicja robocza: \(\frac{\text{suma korzyści} - \text{suma nakładów}}{\text{suma nakładów}}\) w okresie analizy)

##### 2.5.1.3 Stopa dyskontowa i parametry (MUST)

- Domyślnie używamy **WACC per organizacja** (market/średnia) — spójnie z wyceną.
- Użytkownik może nadpisać stopę dla danego `InvestmentCase`.
- Okres analizy: domyślnie zgodny z horyzontem scenariusza (np. 3 lata) lub ustawiany przez usera dla inicjatywy.

##### 2.5.1.4 Sensitivity (MUST)

W v1 standardowo liczymy wrażliwość co najmniej dla:

- stopy dyskontowej (WACC)
- skali korzyści (np. ±X%)
- czasu realizacji (opóźnienie startu / ramp)

##### 2.5.1.5 Artefakt i biblioteka (MUST)

- `InvestmentCase` zapisujemy jako artefakt powiązany z inicjatywą.
- Działa jak: Live view → Save (analogicznie do analiz finansowych), aby nie tworzyć “śmieciowych” obiektów.
- Z `InvestmentCase` można generować raport/prezentację i wysyłać/drukować (traceability do inicjatywy).

---

## 3) Artefakty (v3) — kontrakt domeny

Kanonicznie (nazwy robocze; implementacja może ewoluować):

- `FinancialModel` (snapshot + mapping + metadata)
- `FinancialAnalysisRun` (wynik analizy, parametry, okres)
- `FinancialScenario` (założenia + powiązany run)
- `Valuation` (metoda + parametry + wynik)
- `InvestmentCase` (CAPEX + wynik)

Każdy artefakt ma:

- status (draft/approved) tam, gdzie ma sens
- traceability do źródeł (np. imported file / tool session / initiative)

---

## 4) Integracje (v3)

- **Reports/Presentations**: Financial Analysis jest jednym z głównych “źródeł contentu”.
- **Initiatives**: model i analizy wpływają na ROI/KPI i muszą być linkowalne do inicjatyw.
- **MyWork / Notebook**: notatki mogą generować założenia lub kontekst do analiz (przez “3‑tools strip” i konwersje).

---

## 5) Out of scope (v3)

- automatyczne “MCP operational analysis” i “MCP automation analysis” (v4+)

> **Uwaga scope:** W v3 MVP koncentrujemy się na: Modelowanie finansowe (zero‑change) + Analiza wskaźnikowa + Predykcja (scenariusze).  
> Wycena i analiza inwestycyjna pozostają zdefiniowane, ale rozwijane poza tym projektem.


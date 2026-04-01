# Plik 01: Funkcjonalność i User Journey Consultify

**Producent:** DBR77 Robotics Sp. z o.o.  
**Produkt:** Consultify (consultify.ai)  
**Wersja dokumentu:** 1.0 | Marzec 2026

---

## 1. Czym jest Consultify?

Consultify to platforma AI do zarządzania transformacją cyfrową i doradztwem strategicznym klasy enterprise. Łączy metodologie oceny dojrzałości cyfrowej (SIRI, ADMA, DRD, Lean 4.0, CMMI) z silnikiem sztucznej inteligencji (LLMind™), modułem zarządzania inicjatywami, narzędziami finansowymi oraz generatorem raportów i prezentacji — wszystko w jednym miejscu.

Misja platformy: **„Strategia spotyka się z operacją w jednym cyfrowym workspace'ie."**

Consultify nie jest kolejnym narzędziem do tworzenia raportów. Jest systemem operacyjnym transformacji — od pierwszej diagnozy organizacji, przez planowanie inicjatyw, po śledzenie realnego zwrotu z inwestycji.

---

## 2. Architektura Funkcjonalna

Platforma opiera się na przepływie 9 modułów połączonych centralnym obiektem — **Inicjatywą**:

```
Chat (kontekst) → MyWork (hub osobisty) → Interview (wywiad odkrywczy)
→ Tools/Assessment (diagnostyka) → Initiatives (portfolio) 
→ Execution (realizacja) → Benefits/Economics (analiza finansowa)
→ Results (śledzenie KPI) → Reports & Presentations (output)
```

Każdy element pipeline'u zasilany jest przez warstwę AI: PMO Brain (koordynator agentów), 22 wyspecjalizowane dostawcy kontekstu, Narrative Engine oraz Visual Director.

---

## 3. User Journey — Krok po Kroku

### Etap 0: Rejestracja i Onboarding

1. Użytkownik wchodzi na `consultify.ai` i klika **„Rozpocznij bezpłatny okres próbny"** (14 dni, bez karty kredytowej).
2. Rejestracja przez e-mail lub SSO (Google, Microsoft, GitHub, WebAuthn).
3. System tworzy izolowaną, wielodostępną organizację z osobną przestrzenią danych (Row-Level Security PostgreSQL).
4. Wizard onboardingowy zbiera podstawowe dane: nazwa organizacji, branża, liczba pracowników, główne wyzwanie transformacyjne.
5. System sugeruje gotowy scenariusz startowy (np. „Ocena dojrzałości produkcji" lub „Planowanie portfolio inicjatyw DX").

---

### Etap 1: Pierwsze Zalogowanie i Dashboard Główny

Po zalogowaniu użytkownik trafia do **MyWork Hub** — osobistego centrum dowodzenia:

- **Zadania (My Tasks)**: lista przypisanych zadań w poprzek wszystkich inicjatyw.
- **Decyzje (Decisions)**: decyzje oczekujące na zatwierdzenie z pełną ścieżką audytu.
- **Idea Canvas**: przestrzeń do szybkiego szkicowania pomysłów przed formalizacją.
- **Idea Map**: mapa myśli powiązanych koncepcji transformacyjnych.
- **Powiadomienia AI**: inteligentne powiadomienia — AI wskazuje, co wymaga uwagi dzisiaj.

Panel zapewnia widok 360° na wszystkie aktywności użytkownika: co jest spóźnione, co wymaga decyzji, jakie nowe rekomendacje wygenerował system.

---

### Etap 2: Przeprowadzenie Assessmentu

#### 2.1 Wybór frameworku oceny

Użytkownik przechodzi do modułu **Discovery Tools Hub** i wybiera assessment:

| Framework | Obszar oceny | Certyfikat |
|---|---|---|
| **SIRI** (Smart Industry Readiness Index) | Gotowość na Przemysł 4.0 | Licencja SIRI |
| **ADMA** (Assessment of Digital Maturity) | Dojrzałość cyfrowa end-to-end | Licencja ADMA |
| **DRD** (Digital Readiness & Development) | Własna metodologia DBR77 | Proprietary |
| **Lean 4.0** | Lean + Przemysł 4.0 | DBR77 adaptation |
| **CMMI** | Dojrzałość procesów inżynieryjnych | CMMI Institute |

#### 2.2 Wypełnianie Assessmentu

- **Workbench Editor**: formularz pytań z wagami, możliwość dodawania dowodów (pliki, linki, zdjęcia).
- **Tryb kolaboracji**: wielu uczestników może jednocześnie wypełniać różne sekcje (np. dział IT + produkcja + logistyka).
- **Import danych**: możliwość wczytania poprzednich danych (CSV, Excel, PDF, format SIRI).
- **AI-Assist**: podczas wypełniania AI podpowiada typowe wartości dla branży i wskazuje niespójności.
- **Wersjonowanie**: każdy assessment jest wersjonowany — system śledzi zmiany dojrzałości w czasie.

#### 2.3 Wyniki Assessmentu

Po zakończeniu system generuje:

- **Radar Chart**: dojrzałość w każdym wymiarze wizualizowana na osi 0–5.
- **Gap Analysis**: automatyczna identyfikacja luk między stanem obecnym a celem benchmarkowym.
- **Heatmapa obszarów krytycznych**: które procesy wymagają natychmiastowej interwencji.
- **Benchmark Comparison**: porównanie z medianą branżową i liderami sektora.
- **AI-Generated Initiatives**: system automatycznie proponuje pakiet inicjatyw adresujących zidentyfikowane luki.
- **Executive Summary**: jednostronne podsumowanie gotowe do prezentacji zarządowi.

---

### Etap 3: Moduł Interview (Wywiad Odkrywczy)

**Interview Hub** to AI-prowadzony wywiad strukturyzowany, który gromadzi wiedzę procesową organizacji:

- AI zadaje pytania odkrywcze (tzw. Discovery Questions) dotyczące przepływów pracy, systemów IT, barier organizacyjnych.
- Odpowiedzi pracowników są parsowane i klasyfikowane do odpowiednich obszarów wiedzy.
- System identyfikuje sprzeczności między deklaracjami a danymi (np. jeśli KPI mówi jedno, a pracownicy drugie).
- Wyniki zasilają bazę wiedzy RAG (Retrieval-Augmented Generation) — AI „zna" organizację.
- Możliwość przeprowadzenia wywiadów z wieloma uczestnikami (różne szczeble hierarchii).

---

### Etap 4: Portfolio Inicjatyw

#### 4.1 Tworzenie Inicjatywy

Inicjatywa to centralny obiekt platformy. Może być tworzona:
- **Automatycznie** przez AI po assessmencie (z pełną uzasadnieniem i referencją do luki).
- **Ręcznie** przez użytkownika z pomocą AI (sugestie nazwy, zakresu, KPI, budżetu).
- **Z szablonu** (ponad 200 gotowych szablonów inicjatyw branżowych).

Każda inicjatywa zawiera:
- Cel strategiczny (powiązany z wynikiem assessmentu).
- Zakres, właściciel, termin, priorytety.
- Budżet i business case (NPV/IRR/payback wyliczane automatycznie).
- KPI docelowe i bazowe.
- Ryzyko i plan mitygacji.
- Powiązania z innymi inicjatywami (zależności, konflikty zasobów).

#### 4.2 Dashboard Portfolio

- **Widok Kanban**: inicjatywy w kolumnach wg statusu (Backlog / In Review / Approved / In Execution / Completed).
- **Widok Roadmap (Gantt)**: wizualizacja osi czasu i zależności.
- **Widok Tabeli**: filtrowanie i sortowanie wg priorytetu, wartości NPV, ryzyka.
- **Portfolio Score**: AI agreguje wszystkie inicjatywy w jeden wskaźnik zdrowia portfolio.
- **Optymalizator PMO**: AI wskazuje, jak maksymalizować łączny NPV przy ograniczonych zasobach.

---

### Etap 5: Planowanie Zadań i Realizacja

#### 5.1 Execution Hub

Każda zatwierdzona inicjatywa przechodzi do **Execution Hub**:

- **Rollout Plan**: szczegółowy plan wdrożenia z kamieniami milowymi.
- **Task Board (Kanban/Scrum)**: zadania przypisane do członków zespołu z terminami i priorytetami.
- **Risk Registry**: rejestr ryzyk z właścicielem, prawdopodobieństwem, wpływem i planem mitygacji.
- **Team Management**: alokacja zasobów, pojemność zespołów, konflikty zasobów.
- **Governance Checkpoints**: punkty decyzyjne wymagające zatwierdzenia sponsora.
- **AI Nudges**: system automatycznie wysyła przypomnienia, alerty o przekroczeniu terminów i sugestie korygujące.
- **Closure Report**: po zakończeniu inicjatywy AI generuje raport zamknięcia z oceną realizacji.

#### 5.2 Przyspieszanie Decyzji

Moduł **Decisions** gwarantuje, że żadna kluczowa decyzja nie zginie w e-mailach:

- Każda decyzja ma strukturę: kontekst → opcje → rekomendacja AI → zatwierdzone przez.
- Pełna ścieżka audytu — kto zdecydował, kiedy, na podstawie jakich danych.
- Eskalacja: jeśli decyzja nie zostanie podjęta w zadanym terminie, system eskaluje do przełożonego.
- Powiązanie z inicjatywami i zadaniami — decyzja automatycznie odblokowuje kolejne kroki.

---

### Etap 6: Analiza Finansowa i Ekonomika

#### 6.1 Benefits Workspace

- **Finansowa Analiza Korzyści**: kwantyfikacja oszczędności, przychodów i unikniętych kosztów.
- **Budget Workspace**: planowanie budżetu inicjatywy, śledzenie wydatków.
- **Valuation Workspace**: wycena wartości biznesowej transformacji (DCF, EVA, Multiple).

#### 6.2 Economics Hub — Modelowanie Finansowe

- **Financial Modeling Workspace**: budowanie modeli finansowych (P&L, cashflow, balance sheet) z scenariuszami optymistycznym/bazowym/pesymistycznym.
- **Financial Statement Import**: import danych finansowych z plików Excel, CSV, PDF (automatyczny OCR i parsing).
- **NPV/IRR Calculator**: automatyczne wyliczanie kluczowych wskaźników finansowych dla każdej inicjatywy.
- **Scenario Analysis**: symulacja „co jeśli" — jak zmiana założeń wpływa na ROI.

---

### Etap 7: Śledzenie Wyników i KPI

**Results Hub** zamyka pętlę strategia–realizacja–wyniki:

- **KPI Dashboard**: realne wyniki vs. wartości bazowe i docelowe — aktualizowane na bieżąco.
- **ROI/Payback Charts**: wykres zwrotu z inwestycji w czasie z zaznaczonym punktem breakeven.
- **Deviation Analysis**: AI automatycznie wykrywa odchylenia od planu i generuje alert z propozycją korekty.
- **KPI Report Snapshots**: migawki stanu KPI w wybranych datach — do raportowania periodycznego.
- **Global KPI View**: zagregowany widok wszystkich KPI w poprzek całego portfolio inicjatyw.

---

### Etap 8: Generowanie Raportów i Prezentacji

#### 8.1 Report Builder

Zaawansowany generator raportów oparty na AI:

- **Narrative Engine**: czterofazowy pipeline generowania tekstu (ekstrakcja faktów → selekcja obserwacji → plan dyskursu → realizacja językowa → post-checks).
- **Brand Voice Profile**: możliwość skonfigurowania tonu, stylu i terminologii raportu zgodnie z identyfikacją klienta.
- **Entity Links Panel**: raporty automatycznie linkują do inicjatyw, KPI, assessmentów — pełna traceability.
- **Source Traceability**: każde zdanie raportu ma przypis do źródła danych.
- **Quality Gates**: przed wygenerowaniem ostatecznego raportu AI przeprowadza 12 automatycznych kontroli jakości.
- **Stale Data Badge**: system ostrzega, jeśli dane bazowe zmieniły się od ostatniego generowania.
- **Formaty eksportu**: PDF, DOCX.

#### 8.2 Deck Builder (Prezentacje)

Profesjonalny kreator prezentacji:

- **Wizard Krok po Kroku**: setup → źródła → outline → styl → generowanie → wynik.
- **Edytor Slajdów**: drag-and-drop, ponad 15 typów bloków (tekst, bullet, tabela, wykres, diagram, KPI widget, timeline, callout, image).
- **Theme Switcher**: zmiana motywu w jednym kliknięciu (kolory, typografia, układ).
- **AI Agent Panel**: chat z AI bezpośrednio w kreatorze — „dodaj slajd o ROI inicjatywy X".
- **Real-time Collaboration**: wielu użytkowników edytuje jednocześnie (present indicators).
- **Version History**: pełna historia wersji z możliwością przywrócenia.
- **Present Mode**: tryb pełnoekranowy do prezentacji.
- **Share & Analytics**: link do udostępnienia + analityka wyświetleń.
- **Formaty eksportu**: PPTX, PDF.

---

## 4. Moduły Pomocnicze

### Intelligence (AI Insights)
- Ciągłe monitorowanie organizacji i generowanie proaktywnych rekomendacji.
- Feed nudges: AI codziennie wskazuje 3–5 kluczowych sygnałów wymagających uwagi.

### Knowledge Base (RAG)
- Wewnętrzna baza wiedzy organizacji — dokumenty, wywiady, wyniki assessmentów.
- Kontekstowe wyszukiwanie semantyczne (pgvector).
- Context Pack Builder: pakiety kontekstowe dla poszczególnych inicjatyw.

### PMO Brain
- Koordynator 22 wyspecjalizowanych agentów AI.
- Zarządzanie pojemnością, optymalizacja portfolio, planowanie strategiczne.
- Integracja z modułami Execution i Benefits.

---

## 5. Przepływ Danych End-to-End

```
Dane wejściowe (dokumenty, Excel, API, wywiad)
        ↓
Warstwa parsowania i OCR
        ↓
Baza wiedzy organizacji (RAG/pgvector)
        ↓
Assessment + Gap Analysis
        ↓
AI → Inicjatywy + Business Case
        ↓
Execution (zadania, ryzyka, governance)
        ↓
KPI Tracking (wyniki realne vs. plan)
        ↓
Raporty + Prezentacje (PDF/DOCX/PPTX)
        ↓
Kolejny cykl assessmentu (improvement loop)
```

---

## 6. Dashboardy i Widoki

| Dashboard | Odbiorca | Zawartość |
|---|---|---|
| MyWork Hub | Każdy użytkownik | Zadania, decyzje, powiadomienia AI |
| Portfolio Dashboard | PMO, COO, CEO | Inicjatywy, roadmap, wartość NPV |
| Assessment Dashboard | Lean Manager, DX Manager | Radar, gap analysis, trendy dojrzałości |
| KPI Dashboard | COO, CFO, PMO | Wyniki realne vs. plan, odchylenia |
| Financial Dashboard | CFO, Finance | Modele finansowe, P&L, cashflow |
| Executive Aggregate | CEO, Zarząd | Zagregowany widok całej transformacji |
| Advanced Analytics | DX Manager, Analityk | Heatmapy, korelacje, trendy |

---

## 7. Integracje

- **Import**: Excel (.xlsx), CSV, PDF (OCR), format SIRI Assessment, API REST.
- **Eksport**: PDF, DOCX, PPTX, CSV.
- **Autoryzacja SSO**: Google Workspace, Microsoft 365, GitHub.
- **Przyszłe integracje roadmapowe**: SAP, Microsoft Dynamics, Power BI, Salesforce, IoT data streams.

---

## 8. Podsumowanie User Journey

| Faza | Moduł | Czas typowy | Kluczowy output |
|---|---|---|---|
| Onboarding | Rejestracja + Wizard | 1–2 h | Organizacja skonfigurowana |
| Diagnoza | Assessment | 1–5 dni | Raport dojrzałości + luki |
| Odkrycie | Interview Hub | 2–10 h | Baza wiedzy organizacji |
| Planowanie | Initiatives | 1–3 dni | Portfolio inicjatyw z NPV |
| Realizacja | Execution | Ongoing | Zadania, kamienie milowe |
| Pomiar | Results / KPI | Ongoing | Wyniki vs. plan, ROI |
| Komunikacja | Reports & Decks | 2–4 h | Raport zarządowy / deck |
| Optymalizacja | Kolejny assessment | Kwartalnie | Nowy cykl improvement |

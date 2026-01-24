# Plan wdrozenia: Analiza Ekonomiczna (Economics)

## Instrukcja dla agenta (do rozliczenia)
### Cel
Wdrozyc modul analiz finansowych z wieloma scenariuszami i powiazaniem do inicjatyw.

### Zakres
- Workflow DRAFT/REVIEW/APPROVED
- Scenariusze (base/optimistic/conservative)
- Create Initiative z analizy
- Integracje: Initiatives, Reporting, Decision Management

### Deliverables (musi dostarczyc)
1) UI/UX dla listy analiz i workspace
2) Model danych scenariuszy + relacje
3) API i walidacje finansowe
4) Gate decisions finansowe (Go/No-Go)
5) Testy (API/E2E) dla flow analizy

### Kryteria rozliczenia
- Analiza moze istniec niezaleznie i byc przypisana do inicjatywy
- Jeden initiative ma wiele analiz/scenariuszy
- Metryki NPV/IRR/ROI wyliczaja sie poprawnie

## Cel i kontekst
Analiza ekonomiczna sluzy do podejmowania decyzji inwestycyjnych dla inicjatyw. Modul musi umozliwiac:
1) tworzenie analizy z poziomu inicjatywy (powiazanie 1->N),
2) tworzenie analizy niezaleznie od inicjatyw oraz pozniejsze utworzenie inicjatywy na bazie analizy.

UI/UX musi byc spojny z pozostalymi modulami (dynamiczny pasek, filtry, widoki).

## Zasady domenowe
### Statusy analizy
- DRAFT -> REVIEW -> APPROVED
- tylko APPROVED moze byc uzyta do decyzji inwestycyjnej

### Powiazania
- Jedna inicjatywa moze miec wiele analiz (wersje/scenariusze)
- Jedna analiza moze nie miec inicjatywy (pomysl wstepny)
- Z analizy mozna utworzyc inicjatywe (generuje DRAFT initiative)

## Decyzje (gates)
- Decision: Approve Analysis (owner: Finance/PMO)
- Decision: Select Active Scenario (owner: Sponsor/PMO)
- Decision: Investment Go/No-Go (owner: Steering Committee)

## Format analizy finansowej (klasyczny)
Minimum zestaw:
- CAPEX / OPEX
- Cashflow (rok 0..n)
- NPV
- IRR
- Payback period
- ROI
- Scenariusze: base / optimistic / conservative
- Wrażliwosc (sensitivity: 2-3 kluczowe zalozenia)

## UX i UI (opis)
### Lista analiz
Widok listy/kafli:
- kolumny: nazwa, status, powiazana inicjatywa, stage inicjatywy, ROI/NPV, updated
- filtry: status, typ, initiative stage
- przycisk: New Analysis

### Widok analizy (workspace)
Podobny do innych modulow:
- pasek statusu (Draft/Review/Approved)
- sekcje: Zalozenia, Koszty, Przychody/Benefity, Cashflow, Wyniki
- wykresy: cashflow, NPV, wrażliwosc
- przycisk: Create Initiative (gdy brak powiazania)

### Powiazanie z inicjatywa
W initiative:
- zakladka "Economic Analysis"
- lista analiz (wersje/scenariusze)
- oznaczenie aktywnej analizy

## Flow procesowy
1) Analiza tworzona z Initiative -> status DRAFT
2) Review -> Approved
3) Approved moze byc oznaczona jako "active scenario"

Alternatywa:
1) New Analysis bez inicjatywy
2) Po APPROVED -> Create Initiative (Draft)

## DoD (Definition of Done)
- statusy analizy dzialaja
- mozliwosc wielu analiz w jednej inicjatywie
- analiza moze istniec bez inicjatywy
- Create Initiative z analizy dziala
- UI/UX spójny z innymi modulami

## Zadania implementacyjne
### Frontend
- lista analiz + filtry
- workspace analizy z wykresami
- zakladka w initiative z lista analiz
- przycisk Create Initiative

### Backend
- modele: analysis, scenario
- relacje analysis <-> initiative (1..N)
- workflow statusow
- API: create analysis, approve, link initiative, create initiative from analysis

### AI / wspomaganie
- podpowiedzi dla zalozen finansowych
- walidacja anomalii w cashflow
- rekomendacje scenariuszy

## Grafiki i diagramy (do dostarczenia)
1) Layout listy analiz
2) Widok workspace analizy
3) Flow: analiza -> initiative

## Ryzyka i mitigacje
- Ryzyko: zbyt zlozony formularz -> sekcje + autosave
- Ryzyko: sprzeczne scenariusze -> walidacje danych

## Kryteria akceptacji
- uzytkownik tworzy analize, zatwierdza, przypisuje do inicjatywy
- mozliwosc tworzenia inicjatywy z analizy
- raporty finansowe generuja kluczowe metryki (NPV/IRR/ROI)

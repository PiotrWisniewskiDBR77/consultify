# Plan wdrozenia: Integracja przeplywu miedzy modulami + dane

## Instrukcja dla agenta (do rozliczenia)
### Cel
Spiac end-to-end flow miedzy modulami oraz dane i statusy.

### Zakres
- Mapowanie statusow i widokow per modul
- Model kanoniczny danych + relacje
- API integracyjne i reguly widocznosci
- Integracje: wszystkie moduly + Decision Management

### Deliverables (musi dostarczyc)
1) Diagram statusow i przeplywu
2) Model danych (ERD)
3) Lista endpointow integracyjnych
4) Reguly widocznosci per modul
5) Testy end-to-end flow

### Kryteria rozliczenia
- Inicjatywa przechodzi przez wszystkie moduly bez duplikacji
- Statusy widoczne tylko w odpowiednich ekranach

## Cel
Spiec caly proces end-to-end: Interview -> Tools/Assessment -> Initiatives (Planning/Approved) -> Execution -> Benefits + powiazania z Economics i Reporting. Plan obejmuje przeplywy, statusy, relacje danych i punkty integracji API/UI.

## Globalny przeplyw biznesowy
1) Interview (kontekst organizacji)
2) Tools / Assessment (generacja inicjatyw DRAFT)
3) Initiatives (REVIEW -> APPROVED -> PLANNING)
4) Execution (EXECUTING -> DONE / BLOCKED / CANCELLED / ARCHIVED)
5) Benefits (monitoring rezultatow)
6) Economics (analizy inwestycyjne na kazdym etapie)
7) Reporting (raporty zarzadcze i eskalacje)

## Warstwa decyzji (globalnie)
Decyzje sa warstwa przekrojowa w calym systemie:
- Tools/Assessment: Request Review, Approve, Generate Initiatives
- Initiatives: Go/No-Go, Resources Commit, Schedule Lock
- Execution: Scope Change, Risk Acceptance, Phase Transition
- Economics: Approve Analysis, Select Scenario, Investment Go/No-Go
- Benefits: Accept Outcomes, Close/Archive
Wszystkie decyzje maja ownera, deadline, status i log eskalacji.

## Statusy i mapowanie widokow
### Inicjatywa (globalna)
- DRAFT: Tools / Assessment
- REVIEW: Initiatives
- APPROVED: Initiatives + Roadmap
- PLANNING: Initiatives + Roadmap (gotowa do Execution)
- EXECUTING: Execution Center
- BLOCKED: Execution (alert) + widok historyczny w Initiatives
- DONE: Benefits
- CANCELLED / ARCHIVED: Initiatives (historyczne)

### Narzedzia (Tools/Assessment)
- DRAFT -> REVIEW -> APPROVED
- APPROVED generuje inicjatywy DRAFT

### Analysis (Economics)
- DRAFT -> REVIEW -> APPROVED
- APPROVED moze byc powiazana z inicjatywa jako aktywna

## Glowne obiekty danych (model kanoniczny)
1) Organization
2) Project
3) ToolSession / AssessmentSession
4) Initiative
5) Task
6) Decision
7) EconomicAnalysis
8) BenefitTracking
9) Report

## Kluczowe relacje
- Organization -> Projects (1..N)
- Project -> Initiatives (1..N)
- ToolSession/AssessmentSession -> Initiatives (1..N)
- Initiative -> Tasks (1..N)
- Initiative -> Decisions (0..N)
- Task -> Decisions (0..N)
- Initiative -> EconomicAnalysis (0..N)
- Initiative -> BenefitTracking (0..1)
- Reports -> Initiatives/Projects (N..N)

## Synchronizacja danych miedzy modulami
### Generacja inicjatyw
Tools/Assessment -> Initiative (DRAFT) + link do source_id i batch_id

### Przejscie do Execution
Initiatives (PLANNING) -> Execution (EXECUTING)
- ustawienie start/end, zasoby, decyzje

### Przejscie do Benefits
Execution (DONE) -> BenefitTracking
- kopiowanie kluczowych KPI i celu inicjatywy

### Economics
EconomicAnalysis moze powstac:
- z Initiative (linked)
- niezaleznie -> Create Initiative

### Reporting
Report pobiera dane z:
- Initiatives (status, ROI, risk)
- Execution (progress, decisions, RAID)
- Benefits (outcome)
- Economics (NPV/IRR/ROI)

## Integracja UI (spojny UX)
- dynamiczny pasek modulow i drawer wspolny
- statusy filtrowane per modul
- jednolita nawigacja "Open wider"

## Punkty integracji API
1) POST /initiatives/generate (source tool/assessment)
2) PATCH /initiatives/:id/status
3) GET /initiatives?status=
4) POST /economic-analyses (linked/unlinked)
5) POST /reports/generate (type, scope, schedule)
6) GET /reports/history

## DoD
- kazdy status inicjatywy wyswietlany w odpowiednim module
- inicjatywy przenosza sie przez caly workflow bez duplikacji
- raporty agreguja dane z wszystkich modulow
- UI nie pokazuje statusow nieadekwatnych do modulu

## Ryzyka i mitigacje
- Ryzyko: niespojne statusy -> centralny enum i walidacja
- Ryzyko: duplikacja inicjatyw -> source_id + batch_id
- Ryzyko: brak spójnych KPI -> definicja wspolnych metryk

## Kryteria akceptacji
- end-to-end flow dziala bez przerw
- inicjatywa zmienia statusy i pojawia sie w odpowiednich modulach
- raportowanie zbiera dane spójnie

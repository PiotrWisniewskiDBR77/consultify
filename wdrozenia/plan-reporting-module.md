# Plan wdrozenia: Reporting (Management Reports)

## Instrukcja dla agenta (do rozliczenia)
### Cel
Zbuduj w pelni funkcjonalny generator raportow zarzadczych z eksportem i harmonogramami.

### Zakres
- Typy raportow: Steering, Team Weekly, Portfolio Health, RAID
- Wizard generatora + template builder + historia + schedule
- Eksport PDF/PPTX
- Integracje: Initiatives, Execution, Benefits, Economics, Decision Management

### Deliverables (musi dostarczyc)
1) UI/UX generatora i historii raportow
2) Model danych raportu + harmonogramy
3) API generowania + eksporty
4) Sekcja Decisions Required + eskalacje
5) Testy (API/E2E) dla generowania i eksportu

### Kryteria rozliczenia
- Raporty generuja sie on-demand i cyklicznie
- Eksport PDF/PPTX dziala
- Raporty zawieraja RAG i eskalacje

## Cel i kontekst
Modul raportowania to centralne miejsce generowania raportow zarzadczych. Obecny ekran to placeholder i musi byc przebudowany niemal w calosci: menu, workflow, funkcjonalnosci i prezentacja wynikow. UI/UX musi byc spojny z reszta aplikacji (te same przyciski, układ, drawer, dynamiczny pasek).

Wymagania biznesowe:
- typy raportow: Steering Committee, Team Weekly, Portfolio Health, RAID
- raporty sa generowane on-demand lub cyklicznie
- eksport do PDF i PowerPoint
- raporty pokazują postep, eskalacje i RAG status
- generator raportow jest elastyczny i konfigurowalny

## Standardy i inspiracje (BCG + PMO best practices)
BCG promuje raportowanie outcome-oriented governance: raport ma laczyc wyniki zespolu z celami strategicznymi i dawac szybka widocznosc eskalacji. Kluczowe elementy:
- RAG status (Green/Amber/Red) jako standard zdrowia projektu
- 15-25 kluczowych milestone na roadmapie (story-driven)
- eskalacje przy przekroczeniu tolerancji (czas, budzet, ryzyko)
- portfelowy przeglad, nie tylko zadania

## UX i UI (opis)
### Widok glowny
Zakladki jak w innych modulach:
- Generate Report
- History
- Templates
- Schedule
- Settings

### Generator raportu
Kroki:
1) Report Type (Steering/Team Weekly/Portfolio/RAID)
2) Scope (portfolio vs single project)
3) Period (last 7d, 30d, quarter)
4) Sections (configurable checklist)
5) Output (PDF/PPTX)
6) Schedule (one-time vs recurring)

### Widok raportu
Podzielony na sekcje:
- Executive Summary (RAG + eskalacje)
- Progress vs plan (time/budget)
- Milestones / Roadmap
- Risks / Issues / Dependencies
- Decisions log
- Next period priorities

## Typy raportow (definicje)
### Steering Committee Report
Cel: decyzje zarzadcze i eskalacje.
Sekcje: RAG, kluczowe ryzyka, decyzje do podjecia, budget variance.

### Team Weekly Report
Cel: status prac zespolu.
Sekcje: wykonane zadania, plan na tydzien, blokery, workload.

### Portfolio Health Report
Cel: stan portfela inicjatyw.
Sekcje: % on-track, budget health, critical path, agregowane ryzyka.

### RAID Report
Cel: przeglad ryzyk, zalozen, problemow i zaleznosci.

## Decyzje (w raportach)
- Kazdy raport ma sekcje "Decisions Required"
- Decyzje maja ownera, deadline i poziom eskalacji
- Raporty Steering Committee generuja wnioski Go/No-Go

## Eskalacje
Poziomy eskalacji:
- Green: brak eskalacji
- Amber: eskalacja do PMO
- Red: eskalacja do Steering Committee

Warunki eskalacji:
- przekroczenie tolerancji (np. >10% od planu)
- brak decyzji krytycznej > X dni
- blokada zadania krytycznego

## Integracje z reszta aplikacji
Zrodla danych:
- Initiatives (statusy, harmonogram, ROI)
- Execution (taski, decyzje, RAID, budget)
- Benefits (wyniki)
- Economic Analysis (financial outcomes)

## DoD (Definition of Done)
- generator raportow dziala dla kazdego typu
- raporty maja RAG i eskalacje
- eksport do PDF i PPTX dziala
- cykliczne raporty dzialaja
- UI/UX spójny z innymi modulami

## Zadania implementacyjne
### Frontend
- nowe menu i zakladki raportow
- wizard generatora raportow
- template builder
- history + schedule list

### Backend
- model raportu i harmonogramu
- generowanie raportow (PDF/PPTX)
- logika eskalacji i RAG

### AI / wspomaganie
- automatyczne Executive Summary
- wykrywanie ryzyk i eskalacji
- podsumowania w stylu "key insights"

## Grafiki i diagramy (do dostarczenia)
1) Layout generatora raportow
2) Report template schema
3) Przykładowy Steering Committee Report (wireframe)

## Ryzyka i mitigacje
- Ryzyko: zbyt sztywny szablon -> template builder
- Ryzyko: brak spójności danych -> ujednolicone KPI
- Ryzyko: zbyt duza zlozonosc -> wizard krokowy

## Kryteria akceptacji
- raporty generuja się na żądanie i cyklicznie
- eksport PDF/PPTX dziala
- raporty prezentuja status i eskalacje
- UI/UX spójny z innymi modulami

# Plan wdrozenia: Benefits Tracking (Rozliczenie efektow)

## Instrukcja dla agenta (do rozliczenia)
### Cel
Wdrozyc modul Benefits do monitorowania i rozliczania efektow zrealizowanych inicjatyw.

### Zakres
- Widoki: dashboard, lista, szczegoly inicjatywy
- Metryki: KPI, ROI realized, outcome vs target
- Timeline efektow (przed/po)
- Raportowanie efektow
- Integracje: Execution, Economics, Reporting

### Deliverables (musi dostarczyc)
1) UI/UX dashboard benefits z KPI cards
2) Lista inicjatyw DONE z metrykami
3) Szczegoly: outcome tracking, evidence, ROI realized
4) API dla metrics i evidence
5) Testy E2E

### Kryteria rozliczenia
- Inicjatywy DONE widoczne w Benefits
- Metryki outcome vs target dzialaja
- Evidence (dowody efektow) mozna dodawac

## Cel i kontekst
Benefits to ostatni etap cyklu zycia inicjatywy. Tu mierzymy, czy inicjatywa przyniosla oczekiwane efekty. Modul pozwala porownac zalozone cele z rzeczywistymi wynikami.

Wymagania biznesowe:
- Pokazuje tylko inicjatywy w statusie DONE
- Metryki: planned vs actual KPI
- ROI realized (na podstawie Economics)
- Evidence: dokumenty, screenshoty, metryki jako dowody
- Raportowanie: eksport do Reporting module

## Zasady domenowe
- Do Benefits trafiaja tylko inicjatywy z DONE
- Benefits NIE zmienia statusu inicjatywy (DONE jest finalny)
- Mozna archiwizowac (DONE -> ARCHIVED) po rozliczeniu
- Evidence wymaga approve (opcjonalnie)

## Metryki (standardowe)
### Outcome Metrics
- Target KPI (z Initiatives)
- Actual KPI (wprowadzane recznie lub z integracji)
- Variance (% roznica)
- Status (Achieved / Partially / Not Achieved)

### Financial Metrics
- Planned ROI (z Economics)
- Realized ROI (obliczany)
- Payback actual vs planned
- Budget variance

### Timeline Metrics
- Planned completion date
- Actual completion date
- Time variance

## UX i UI (opis)
### Dashboard Benefits
- KPI Cards: total initiatives, achieved %, avg ROI, total value delivered
- Charts: outcome distribution, ROI trend, timeline adherence
- Filters: by project, by category, by time period

### Lista inicjatyw DONE
- Tabela: nazwa, outcome status, ROI, completion date, evidence count
- Filtry: status, project, date range
- Akcje: View details, Add evidence, Archive

### Szczegoly inicjatywy
- Overview: cele, opis, planned vs actual
- Outcomes: lista KPI z target/actual/variance
- Evidence: dokumenty, screenshoty, linki
- Timeline: before/after comparison
- Notes: komentarze zespolu

### Evidence Panel
- Upload dokumentow (PDF, images)
- Linki zewnetrzne
- Metryki z systemow (API integration - faza 2)
- Approve workflow (opcjonalnie)

## Polaczenia z reszta aplikacji
### Zrodla danych
- Execution: inicjatywy DONE
- Initiatives: cele, KPI, target values
- Economics: planned ROI, financial targets

### Docelowe destynacje
- Reporting: sekcja Benefits w raportach
- Analytics: agregowane metryki portfela

## API Endpoints
- GET /benefits - lista inicjatyw DONE z metrykami
- GET /benefits/:initiativeId - szczegoly z evidence
- POST /benefits/:initiativeId/outcomes - aktualizacja KPI
- POST /benefits/:initiativeId/evidence - dodanie dowodu
- GET /benefits/dashboard - agregowane metryki

## DoD (Definition of Done)
- Dashboard z KPI cards dziala
- Lista inicjatyw DONE z metrykami
- Szczegoly: outcomes + evidence
- Evidence upload dziala
- Integracja z Reporting

## Zadania implementacyjne
### Frontend
- src/views/BenefitsView.tsx
- src/components/Benefits/BenefitsDashboard.tsx
- src/components/Benefits/BenefitsList.tsx
- src/components/Benefits/BenefitsDetail.tsx
- src/components/Benefits/OutcomeTracker.tsx
- src/components/Benefits/EvidencePanel.tsx

### Backend
- server/src/controllers/BenefitsController.ts
- server/src/routes/benefits.routes.ts
- server/src/services/benefitsService.ts
- server/migrations/XXX_benefits_tracking.sql

### Model danych
- benefit_tracking (initiative_id, outcome_status, roi_realized, evidence_count)
- benefit_outcomes (benefit_id, kpi_name, target_value, actual_value, variance)
- benefit_evidence (benefit_id, type, url, uploaded_by, approved_by)

## Ryzyka i mitigacje
- Ryzyko: brak danych -> przypomnienia o uzupelnieniu
- Ryzyko: nieprecyzyjne KPI -> template KPI per category
- Ryzyko: brak dowodow -> soft requirement z progress bar

## Kryteria akceptacji
- Inicjatywy DONE widoczne w Benefits
- Metryki planned vs actual dzialaja
- Evidence mozna dodawac i przegladac
- Dashboard pokazuje agregowane KPI
- Integracja z Reporting dziala

---

## Priorytet wdrozenia
Benefits to FAZA 3 (po Execution). Wymaga:
1. Dzialajacego Execution Center (zrodlo DONE)
2. Economics (zrodlo planned ROI)
3. Initiatives (zrodlo KPI targets)

Rekomendacja: wdrozyc po Execution Center, przed Reporting.

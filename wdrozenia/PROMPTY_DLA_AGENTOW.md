# Prompty dla agentów - Wdrożenie modułów Consultify

## Stan wdrożenia (2026-01-20)

### ✅ Wdrożone
1. **Tools** - ~95% zgodności (szczegóły: `ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md`)

### ❌ Do wdrożenia (w kolejności priorytetów)
1. Assessment (+ Interview jako część)
2. Initiatives + Roadmap
3. Execution Center
4. Benefits (do dodania plan)
5. Economic Analysis
6. Reporting
7. Decision Management
8. System Integration (end-to-end)

---

## 🎯 PROMPT 1: MODUŁ ASSESSMENT

### Kontekst dla agenta

```
ZADANIE: Wdrożenie modułu Assessment zgodnie z planem wdrozenia/plan-assessment-initiatives.md

PRZECZYTAJ NAJPIERW:
1. wdrozenia/plan-assessment-initiatives.md (pełna specyfikacja)
2. wdrozenia/ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md (wzorzec audytu)
3. src/components/DiscoveryTools/ (wzorzec UI z Tools)
4. server/src/controllers/ToolController.ts (wzorzec controllera)
5. server/migrations/291_tools_initiatives.sql (wzorzec migracji)

CEL: Assessment to drugi moduł generujący inicjatywy (obok Tools). 
Mechanika jest podobna do Tools, ale z 5 różnymi narzędziami assessment.

ZAKRES WDROŻENIA:
1. Lista assessmentów (My Assessments) z CRUD
2. Dynamiczne submenu (aktywnie otwarte assessmenty)
3. 5 narzędzi assessment:
   - DRD (Digital Readiness Diagnosis) - PEŁNA implementacja
   - SIRI (Smart Industry Readiness Index) - PEŁNA implementacja
   - ADMA - Coming soon placeholder
   - CMMI - Coming soon placeholder  
   - Lean 4.0 - Coming soon placeholder
4. Workspace z formularzem, wizualizacjami, live scoring
5. Raport assessment + approval flow
6. Generowanie inicjatyw (DRAFT) po APPROVED
7. Prawy drawer inicjatyw (50% viewport)

WORKFLOW STATUSÓW:
DRAFT -> IN_REVIEW -> AWAITING_APPROVAL -> APPROVED
(mapowanie do uproszczonych: DRAFT -> REVIEW -> APPROVED)

GATE DECISIONS:
- Request Review (owner: Project Lead)
- Approve Report (owner: PMO/Owner) - wymagane przed APPROVED
- Approve Assessment (owner: PMO/Owner)
- Generate Initiatives (owner: Consultant Lead)

DELIVERABLES:
1. Frontend:
   - src/components/Assessment/AssessmentList.tsx
   - src/components/Assessment/AssessmentWorkspace.tsx
   - src/components/Assessment/AssessmentReport.tsx
   - src/components/Assessment/InitiativesDrawer.tsx
   - src/components/Assessment/tools/DRDForm.tsx
   - src/components/Assessment/tools/SIRIForm.tsx
   - src/views/AssessmentView.tsx

2. Backend:
   - server/src/controllers/AssessmentController.ts
   - server/src/routes/assessment.routes.ts
   - server/src/services/AssessmentInitiativeService.ts
   - server/migrations/XXX_assessment_module.sql

3. Testy:
   - tests/unit/backend/assessment.test.ts
   - tests/e2e/assessment-initiatives.spec.ts

KRYTERIA AKCEPTACJI:
- [ ] CRUD assessmentów działa
- [ ] Dynamiczne submenu pokazuje tylko otwarte assessmenty (max 6)
- [ ] Formularze DRD i SIRI działają z live scoring
- [ ] Raport generuje się i wymaga approval
- [ ] Generate initiatives tylko po APPROVED
- [ ] Inicjatywy widoczne w drawer (50%) jako DRAFT
- [ ] Przejście do globalnych Initiatives po PLANNING
- [ ] Permissions role-based działają
- [ ] Testy E2E przechodzą

ŹRÓDŁA DANYCH DLA FORMULARZY:
- DRD: knowledge/extracted_content.txt + src/services/drdStructure.ts + src/drd_data.json
- SIRI: src/services/siriStructure.ts (3 Building Blocks, 8 Dimensions, 16 Areas)

STANDARD UI/UX:
Używaj wzorców z ToolWorkspace:
- Górny pasek: nazwa, status badge, progress, akcje
- Lewa nawigacja: sekcje formularza
- Środek: formularz z wizualizacjami
- Prawy panel: completion checker, AI assist, drawer inicjatyw

PO ZAKOŃCZENIU:
1. Uruchom testy: npm run test:assessment
2. Uruchom E2E: npx playwright test assessment
3. Przygotuj audyt zgodności (jak ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md)
```

---

## 🎯 PROMPT 2: MODUŁ INITIATIVES + ROADMAP

### Kontekst dla agenta

```
ZADANIE: Wdrożenie modułu Initiatives + Roadmap zgodnie z planem wdrozenia/plan-initiatives-roadmap.md

PRZECZYTAJ NAJPIERW:
1. wdrozenia/plan-initiatives-roadmap.md (pełna specyfikacja)
2. src/components/Initiatives/ (istniejące komponenty)
3. src/views/InitiativesView.tsx (istniejący widok)
4. server/src/controllers/InitiativeController.ts (istniejący controller)

CEL: Centrum zarządzania inicjatywami - planowanie, priorytetyzacja, harmonogramowanie.
To tu trafiają inicjatywy z Tools/Assessment i są przygotowywane do Execution.

KLUCZOWE WYMAGANIE:
Moduł pokazuje TYLKO statusy: REVIEW, APPROVED, PLANNING
NIE pokazuje: DRAFT (w Tools/Assessment), EXECUTING (w Execution), DONE (w Benefits)

ZAKRES WDROŻENIA:
1. 4 widoki: Lista, Kanban, Kafle, Timeline (Roadmap)
2. Filtry statusów tylko dla tej fazy
3. Drawer inicjatywy (50%) + "Open wider" do pełnego ekranu
4. Harmonogramowanie: start/end dates, milestones, dependencies
5. Zarządzanie zasobami: team, capacity, budget
6. AI: rekomendacje terminów, wykrywanie konfliktów

WORKFLOW STATUSÓW (w tym module):
REVIEW -> APPROVED -> PLANNING
(PLANNING przechodzi do Execution poza tym modułem)

GATE DECISIONS:
- Go/No-Go (REVIEW -> APPROVED)
- Resources Commit (APPROVED -> PLANNING)
- Schedule Lock (APPROVED -> PLANNING)

DELIVERABLES:
1. Frontend:
   - src/components/Initiatives/InitiativesList.tsx (refactor)
   - src/components/Initiatives/InitiativesKanban.tsx
   - src/components/Initiatives/InitiativesTiles.tsx
   - src/components/Initiatives/InitiativesTimeline.tsx (Roadmap)
   - src/components/Initiatives/InitiativeDrawer.tsx
   - src/components/Initiatives/InitiativeFullView.tsx (Open wider)

2. Backend:
   - server/src/controllers/InitiativeController.ts (rozbudowa)
   - server/migrations/XXX_initiatives_roadmap.sql

3. Testy:
   - tests/e2e/initiatives-roadmap.spec.ts

KRYTERIA AKCEPTACJI:
- [ ] Wszystkie 4 widoki działają
- [ ] Filtry statusów pokazują tylko REVIEW/APPROVED/PLANNING
- [ ] Kanban drag & drop zmienia status (z permissions)
- [ ] Timeline pokazuje dependencies i critical path
- [ ] Drawer + Open wider działają jak w Tools
- [ ] Harmonogramowanie (daty, milestones) działa
- [ ] AI rekomenduje terminy i wykrywa konflikty

STANDARD UI/UX:
Spójność z Tools/Assessment:
- Ten sam dynamiczny pasek nawigacji
- Te same przyciski i style
- Ten sam pattern drawer (50%) + open wider
```

---

## 🎯 PROMPT 3: MODUŁ EXECUTION CENTER

### Kontekst dla agenta

```
ZADANIE: Wdrożenie Execution Center zgodnie z planem wdrozenia/plan-execution-center.md

PRZECZYTAJ NAJPIERW:
1. wdrozenia/plan-execution-center.md (pełna specyfikacja)
2. src/components/Execution/ (istniejące komponenty)
3. src/components/MyWork/ (wzorce task management)

CEL: Centralne miejsce realizacji inicjatyw i tasków.
Dwa poziomy pracy: Initiatives -> Tasks + decyzje jako osobny byt.

KLUCZOWE WYMAGANIE:
Moduł pokazuje TYLKO statusy: EXECUTING, BLOCKED, DONE, CANCELLED, ARCHIVED
DONE przechodzi do Benefits, reszta wraca do Initiatives jako historyczne.

ZAKRES WDROŻENIA:
1. 5 widoków: Lista, Kanban, Kafle, Timeline (Gantt), Kalendarz
2. Dwa poziomy: Initiatives i zagnieżdżone Tasks
3. Decyzje powiązane z initiative LUB task
4. Portfolio Health dashboard
5. Identyfikacja opóźnień z decyzji
6. Eskalacje przy overdue decisions

WORKFLOW STATUSÓW:
EXECUTING -> BLOCKED/DONE/CANCELLED/ARCHIVED
(DONE -> Benefits, reszta -> Initiatives historyczne)

GATE DECISIONS:
- Scope Change (owner: Sponsor/PMO)
- Risk Acceptance (owner: Sponsor/PMO)
- Blocker Resolution (owner: Project Lead)
- Phase Transition (Plan/Pilot/Scale)

DELIVERABLES:
1. Frontend:
   - src/components/Execution/ExecutionDashboard.tsx
   - src/components/Execution/ExecutionList.tsx
   - src/components/Execution/ExecutionKanban.tsx
   - src/components/Execution/ExecutionTimeline.tsx (Gantt)
   - src/components/Execution/ExecutionCalendar.tsx
   - src/components/Execution/TaskList.tsx
   - src/components/Execution/DecisionPanel.tsx
   - src/components/Execution/PortfolioHealth.tsx

2. Backend:
   - server/src/controllers/ExecutionController.ts
   - server/src/routes/execution.routes.ts
   - server/migrations/XXX_execution_center.sql

3. Testy:
   - tests/e2e/execution-center.spec.ts

KRYTERIA AKCEPTACJI:
- [ ] Wszystkie 5 widoków działa
- [ ] Initiatives i Tasks zarządzane w jednym miejscu
- [ ] Decyzje powiązane z initiative/task
- [ ] Overdue decisions generują alerty
- [ ] Portfolio Health pokazuje % on track, blockers, budget
- [ ] Timeline (Gantt) pokazuje dependencies
- [ ] Kalendarz pokazuje deadlines decyzji i tasków

PORTFOLIO HEALTH (kluczowe metryki):
- % initiatives on track / at risk
- Liczba blockers
- Decyzje opóźnione (overdue)
- Budget health
- Średni postęp
```

---

## 🎯 PROMPT 4: MODUŁ ECONOMIC ANALYSIS

### Kontekst dla agenta

```
ZADANIE: Wdrożenie modułu Economic Analysis zgodnie z planem wdrozenia/plan-economic-analysis.md

PRZECZYTAJ NAJPIERW:
1. wdrozenia/plan-economic-analysis.md (pełna specyfikacja)
2. src/components/Economics/ (istniejące komponenty)
3. src/views/EconomicsView.tsx (istniejący widok)

CEL: Analizy finansowe dla decyzji inwestycyjnych.
Analiza może istnieć niezależnie LUB być powiązana z inicjatywą.

KLUCZOWE WYMAGANIE:
1. Jedna inicjatywa -> wiele analiz (wersje/scenariusze)
2. Analiza bez inicjatywy -> można utworzyć inicjatywę z analizy
3. Tylko APPROVED analiza może być użyta do decyzji inwestycyjnej

ZAKRES WDROŻENIA:
1. Lista analiz + filtry
2. Workspace analizy z formularzem i wykresami
3. Scenariusze: base / optimistic / conservative
4. Metryki: CAPEX, OPEX, Cashflow, NPV, IRR, Payback, ROI
5. Sensitivity analysis (2-3 kluczowe założenia)
6. "Create Initiative" z analizy (gdy brak powiązania)

WORKFLOW STATUSÓW:
DRAFT -> REVIEW -> APPROVED
(APPROVED = aktywny scenariusz dla inicjatywy)

GATE DECISIONS:
- Approve Analysis (owner: Finance/PMO)
- Select Active Scenario (owner: Sponsor/PMO)
- Investment Go/No-Go (owner: Steering Committee)

DELIVERABLES:
1. Frontend:
   - src/components/Economics/AnalysisList.tsx (refactor)
   - src/components/Economics/AnalysisWorkspace.tsx
   - src/components/Economics/ScenarioTabs.tsx
   - src/components/Economics/CashflowChart.tsx
   - src/components/Economics/SensitivityChart.tsx
   - src/components/Economics/CreateInitiativeFromAnalysis.tsx

2. Backend:
   - server/src/controllers/EconomicsController.ts (rozbudowa)
   - server/migrations/XXX_economics_module.sql

3. Testy:
   - tests/unit/backend/economics.test.ts

KRYTERIA AKCEPTACJI:
- [ ] CRUD analiz działa
- [ ] Analiza może być powiązana z 0..1 inicjatyw
- [ ] Inicjatywa może mieć wiele analiz
- [ ] Scenariusze (base/optimistic/conservative) działają
- [ ] Metryki NPV/IRR/ROI wyliczają się poprawnie
- [ ] "Create Initiative" tworzy DRAFT initiative
- [ ] Wykresy cashflow i sensitivity działają

FORMAT ANALIZY FINANSOWEJ:
- CAPEX (jednorazowe koszty)
- OPEX (koszty operacyjne rocznie)
- Cashflow (rok 0..n, domyślnie 5 lat)
- NPV (Net Present Value)
- IRR (Internal Rate of Return)
- Payback period (w latach)
- ROI (Return on Investment)
- Discount rate (domyślnie 10%)
```

---

## 🎯 PROMPT 5: MODUŁ REPORTING

### Kontekst dla agenta

```
ZADANIE: Wdrożenie modułu Reporting zgodnie z planem wdrozenia/plan-reporting-module.md

PRZECZYTAJ NAJPIERW:
1. wdrozenia/plan-reporting-module.md (pełna specyfikacja)
2. src/components/Reports/ (istniejące komponenty)
3. server/src/services/reportGenerationService.ts
4. server/src/services/managementReportsService.ts

CEL: Centralne miejsce generowania raportów zarządczych.
Obecny ekran to placeholder - wymaga pełnej przebudowy.

TYPY RAPORTÓW:
1. Steering Committee Report - decyzje zarządcze, eskalacje
2. Team Weekly Report - status prac zespołu
3. Portfolio Health Report - stan portfela inicjatyw
4. RAID Report - ryzyka, założenia, problemy, zależności

ZAKRES WDROŻENIA:
1. Generator raportów (wizard krokowy)
2. Template builder
3. Historia raportów
4. Schedule (cykliczne raporty)
5. Eksport PDF i PowerPoint
6. RAG status (Green/Amber/Red)
7. Sekcja "Decisions Required" z eskalacjami

WORKFLOW:
1. Wybór typu raportu
2. Wybór scope (portfolio vs single project)
3. Wybór okresu (7d/30d/quarter)
4. Konfiguracja sekcji
5. Generowanie + preview
6. Eksport lub schedule

DELIVERABLES:
1. Frontend:
   - src/components/Reports/ReportGenerator.tsx (wizard)
   - src/components/Reports/ReportTemplateBuilder.tsx
   - src/components/Reports/ReportHistory.tsx
   - src/components/Reports/ReportSchedule.tsx
   - src/components/Reports/ReportPreview.tsx
   - src/components/Reports/sections/ (Executive, Progress, RAID, Decisions)

2. Backend:
   - server/src/controllers/ReportController.ts (rozbudowa)
   - server/src/services/pdfGenerator.ts
   - server/src/services/pptxGenerator.ts
   - server/migrations/XXX_reporting_module.sql

3. Testy:
   - tests/e2e/reporting.spec.ts

KRYTERIA AKCEPTACJI:
- [ ] Generator raportów działa dla każdego typu
- [ ] Raporty mają RAG status i eskalacje
- [ ] Eksport PDF działa
- [ ] Eksport PPTX działa
- [ ] Cykliczne raporty (schedule) działają
- [ ] Template builder pozwala konfigurować sekcje

SEKCJE RAPORTU (standard):
- Executive Summary (RAG + eskalacje)
- Progress vs plan (time/budget)
- Milestones / Roadmap
- Risks / Issues / Dependencies
- Decisions log (pending + overdue)
- Next period priorities

ESKALACJE (standard BCG):
- Green: brak eskalacji
- Amber: eskalacja do PMO (przekroczenie do X dni)
- Red: eskalacja do Steering Committee (>X dni lub critical)
```

---

## 🎯 PROMPT 6: MODUŁ DECISION MANAGEMENT

### Kontekst dla agenta

```
ZADANIE: Wdrożenie przekrojowego modułu Decision Management zgodnie z planem wdrozenia/plan-decisions-management.md

PRZECZYTAJ NAJPIERW:
1. wdrozenia/plan-decisions-management.md (pełna specyfikacja)
2. src/components/MyWork/DecisionsList.tsx (istniejące)
3. src/components/MyWork/DecisionsPanel.tsx (istniejące)
4. server/migrations/292_tools_decisions_link.sql (wzorzec)

CEL: Przekrojowy system decyzji (gates) działający we wszystkich modułach.
Decyzje blokują workflow i generują eskalacje.

KLUCZOWE WYMAGANIE:
Decyzje są osobnym bytem powiązanym z:
- Initiative (strategic gates)
- Task (execution gates)
- Analysis (economic gates)
- Assessment (assessment gates)
- Tool (tool gates) - już zaimplementowane

ZAKRES WDROŻENIA:
1. Unified decision model (wspólny dla wszystkich modułów)
2. Decision Inbox (Moje decyzje) w My Work
3. Decisions by Initiative/Project view
4. Dashboard eskalacji
5. Logika eskalacji (amber/red)
6. Integracja z Reporting (sekcja "Decisions Required")

LIFECYCLE DECYZJI:
PENDING -> APPROVED / REJECTED / ESCALATED

TYPY DECYZJI:
- Strategic: Go/No-Go inicjatywy
- Budget: zatwierdzenie budżetu
- Scope: zmiana zakresu
- Risk: akceptacja ryzyka
- Execution: blokady i przejścia faz

ESKALACJE:
- None: w terminie
- Amber: przekroczony termin do X dni
- Red: przekroczony > X dni lub decyzja krytyczna

DELIVERABLES:
1. Frontend:
   - src/components/Decisions/DecisionInbox.tsx
   - src/components/Decisions/DecisionsByInitiative.tsx
   - src/components/Decisions/EscalationDashboard.tsx
   - src/components/Decisions/DecisionCard.tsx

2. Backend:
   - server/src/controllers/DecisionController.ts (rozbudowa)
   - server/src/services/escalationService.ts
   - server/migrations/XXX_unified_decisions.sql

3. Testy:
   - tests/unit/backend/decisions.test.ts

KRYTERIA AKCEPTACJI:
- [ ] Decision Inbox pokazuje wszystkie pending decisions
- [ ] Eskalacje generują się automatycznie
- [ ] Decyzje blokują workflow (gate rules)
- [ ] Dashboard eskalacji działa
- [ ] Integracja z Reporting (Decisions Required)

MODEL DANYCH DECYZJI:
- id, type, title, description
- owner_id, due_date
- status (pending/approved/rejected/escalated)
- impact (low/medium/high)
- escalation_level (none/amber/red)
- context_type (initiative/task/analysis/assessment/tool)
- context_id
- created_at, updated_at, resolved_at
```

---

## 🎯 PROMPT 7: SYSTEM INTEGRATION (END-TO-END)

### Kontekst dla agenta

```
ZADANIE: Spięcie end-to-end wszystkich modułów zgodnie z planem wdrozenia/plan-system-integration-flow.md

PRZECZYTAJ NAJPIERW:
1. wdrozenia/plan-system-integration-flow.md (pełna specyfikacja)
2. wdrozenia/plan-rollout-master.md (master plan)
3. Wszystkie pozostałe plany w wdrozenia/

CEL: Upewnić się, że cały proces działa end-to-end:
Interview -> Tools/Assessment -> Initiatives -> Execution -> Benefits

ZAKRES INTEGRACJI:
1. Centralny enum statusów (globalny)
2. Synchronizacja danych między modułami
3. Spójny UI/UX (dynamiczny pasek, drawer, nawigacja)
4. Widoczność statusów per moduł (tylko odpowiednie)
5. Testy end-to-end całego flow

GLOBALNY PRZEPŁYW:
1. Interview (kontekst organizacji)
2. Tools / Assessment -> inicjatywy DRAFT
3. Initiatives (REVIEW -> APPROVED -> PLANNING)
4. Execution (EXECUTING -> DONE/BLOCKED)
5. Benefits (monitoring rezultatów)
6. Economics (analizy na każdym etapie)
7. Reporting (raporty zarządcze)

STATUSY INICJATYWY (centralny enum):
- DRAFT: widoczny w Tools/Assessment
- REVIEW: widoczny w Initiatives
- APPROVED: widoczny w Initiatives + Roadmap
- PLANNING: widoczny w Initiatives + Roadmap
- EXECUTING: widoczny w Execution
- BLOCKED: widoczny w Execution (alert)
- DONE: widoczny w Benefits
- CANCELLED/ARCHIVED: historyczne w Initiatives

DELIVERABLES:
1. Centralny enum statusów:
   - server/src/constants/initiativeStatuses.ts
   - src/types/initiative.ts (frontend enum)

2. API integracyjne:
   - GET /initiatives?status= (filtrowane)
   - PATCH /initiatives/:id/status (z walidacją przejść)
   - POST /initiatives/generate (z Tools/Assessment)

3. Testy E2E:
   - tests/e2e/full-flow.spec.ts (cały przepływ)

KRYTERIA AKCEPTACJI:
- [ ] Inicjatywa przechodzi przez wszystkie moduły bez duplikacji
- [ ] Każdy moduł pokazuje tylko swoje statusy
- [ ] Dane są spójne (source_id, batch_id)
- [ ] UI/UX spójny we wszystkich modułach
- [ ] Test E2E przechodzi (DRAFT -> DONE -> Benefits)

REGUŁY WIDOCZNOŚCI:
| Moduł          | Widoczne statusy                    |
|----------------|-------------------------------------|
| Tools          | DRAFT (własne)                      |
| Assessment     | DRAFT (własne)                      |
| Initiatives    | REVIEW, APPROVED, PLANNING          |
| Execution      | EXECUTING, BLOCKED, DONE, CANCELLED |
| Benefits       | DONE                                |
```

---

## 🎯 PROMPT 8: INTERVIEW MODULE (opcjonalny)

### Kontekst dla agenta

```
ZADANIE: Rozbudowa Interview jako pierwszy krok w procesie Discovery

PRZECZYTAJ NAJPIERW:
1. wdrozenia/plan-system-integration-flow.md (sekcja Interview)
2. src/components/AIInterviewModal.tsx (istniejący komponent)
3. src/components/Intelligence/InterviewProgress.tsx (istniejący)

CEL: Interview zbiera kontekst organizacji przed Tools/Assessment.
To opcjonalny, ale wartościowy krok w procesie.

ISTNIEJĄCA IMPLEMENTACJA:
- AIInterviewModal - modal z AI dla osi assessment
- InterviewProgress - progress bar kategorii

ROZSZERZENIE (jeśli potrzebne):
1. Osobny widok Interview (nie tylko modal)
2. Zapisywanie kontekstu organizacji
3. Przekazywanie kontekstu do Tools/Assessment
4. Historia wywiadów per organizacja

DELIVERABLES (jeśli wdrażany):
1. src/views/InterviewView.tsx
2. src/components/Interview/InterviewWorkspace.tsx
3. server/src/controllers/InterviewController.ts
4. server/migrations/XXX_interview_context.sql

UWAGA: Interview może być wdrożony jako część Assessment lub jako osobny moduł.
Decyzja zależy od priorytetu - na razie Assessment ma wyższy priorytet.
```

---

## 📋 KOLEJNOŚĆ WDROŻENIA (REKOMENDOWANA)

```
FAZA 1 - Źródła inicjatyw (po Tools):
1. Assessment (+ Interview jako część)

FAZA 2 - Centrum zarządzania:
2. Initiatives + Roadmap

FAZA 3 - Realizacja:
3. Execution Center
4. Benefits (do dodania plan)

FAZA 4 - Wsparcie decyzji:
5. Economic Analysis
6. Reporting

FAZA 5 - Warstwa przekrojowa:
7. Decision Management (unified)
8. System Integration (end-to-end)
```

---

## 🔧 JAK UŻYWAĆ TYCH PROMPTÓW

### Dla jednego agenta (sekwencyjnie):
1. Wyślij prompt dla modułu 1 (Assessment)
2. Poczekaj na implementację i audyt
3. Wyślij prompt dla modułu 2 (Initiatives)
4. itd.

### Dla wielu agentów (równolegle):
Można uruchomić równolegle:
- Agent A: Assessment
- Agent B: Initiatives + Roadmap

NIE RÓWNOLEGLE (zależności):
- Execution wymaga Initiatives
- Benefits wymaga Execution
- Decision Management wymaga wszystkich modułów
- System Integration wymaga wszystkich modułów

### Checkpoint po każdym module:
1. Audyt zgodności (jak ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md)
2. Testy E2E
3. Aktualizacja plan-rollout-master.md
4. Commit z tagiem wersji

---

## 📊 SZABLON AUDYTU ZGODNOŚCI

Po każdym module agent powinien wygenerować audyt:

```markdown
# Analiza zgodności implementacji

## Data analizy: YYYY-MM-DD
## Moduł: [NAZWA]

## ✅ ZGODNOŚĆ - Wymagania spełnione
[Lista z lokalizacjami w kodzie]

## ⚠️ CZĘŚCIOWA ZGODNOŚĆ
[Lista z opisem różnic]

## ❌ BRAKI / NIEZGODNOŚCI
[Lista braków]

## 📊 PODSUMOWANIE
- Zgodność ogólna: XX%
- Kryteria rozliczenia: [spełnione/niespełnione]
- Deliverables: [kompletne/niekompletne]

## ✅ REKOMENDACJE DALSZE
[Lista ulepszeń nice-to-have]
```

---

## 🚨 WAŻNE ZASADY DLA AGENTÓW

1. **NIGDY nie uruchamiaj `git reset --hard` ani `rm -rf`**
2. **Używaj `git stash` zamiast niszczących operacji**
3. **Commituj co 15-30 minut** (checkpoint "description")
4. **Przed edycją pliku - przeczytaj go najpierw**
5. **Po edycji - sprawdź linter errors**
6. **Testy uruchamiaj po każdej większej zmianie**
7. **Spójność UI/UX** - używaj wzorców z Tools
8. **Permissions** - zawsze sprawdzaj uprawnienia
9. **Audit log** - loguj wszystkie akcje workflow
10. **Dokumentuj braki** - jeśli czegoś nie zaimplementujesz, opisz dlaczego

---

*Dokument wygenerowany: 2026-01-20*
*Wersja: 1.0*

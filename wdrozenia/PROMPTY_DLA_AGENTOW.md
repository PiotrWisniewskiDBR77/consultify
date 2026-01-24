# Prompty dla agentów - Wdrożenie modułów Consultify

## Stan wdrożenia (2026-01-20)

### ✅ Wdrożone
1. **Tools** - ~95% zgodności (szczegóły: `ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md`)

### ❌ Do wdrożenia (w kolejności priorytetów)
1. **Interview** - PRZEBUDOWA (5 kategorii, ClickUp-like UI)
2. **Assessment** - DRD + SIRI pełne, ADMA/CMMI/Lean = Coming soon
3. **Initiatives + Roadmap** - 4 widoki, drawer 50%, harmonogram
4. **Execution Center** - 5 widoków, Gantt, RAID, Portfolio Health
5. **Benefits** - monitoring efektów, rozliczenie
6. **Economic Analysis** - scenariusze, powiązanie z inicjatywami
7. **Reporting** - generator, PDF/PPTX, schedule
8. **Decision Management** - unified model, eskalacje
9. **System Integration** - end-to-end flow

### 📊 Przepływ statusów inicjatyw
```
INTERVIEW → TOOLS/ASSESSMENT → INITIATIVES → EXECUTION → BENEFITS
              (DRAFT, PLANNING)   (REVIEW,      (EXECUTING,   (DONE)
                                  APPROVED,     BLOCKED,
                                  PLANNING)     CANCELLED)
```

### 🎨 UI/UX GOLDEN STANDARD (obowiązuje wszystkie moduły)

**Pełna dokumentacja:** `wdrozenia/UI_UX_GOLDEN_STANDARD.md`

#### Główny kontener: ModuleHub
Wszystkie moduły listowe muszą używać `src/components/shared/ModuleHub/`:
```tsx
import { ModuleHub, ModuleNavBar, DynamicTabs, FilterableTable, GridView } from '@/components/shared/ModuleHub';
```

#### Elementy obowiązkowe:

1. **ModuleNavBar** (górny pasek):
   - Search button (ikona lupy)
   - Taby główne z licznikami: `[Tab1 N] [Tab2 N] [Tab3 N]`
   - View mode toggle: `[≡] [⊞] [⊟] [📅]` (table/grid/kanban/timeline)
   - Przycisk akcji: `+ New Item` (gradient primary)

2. **DynamicTabs** (dynamiczne menu dokumentów):
   - Max 6 widocznych tabów
   - Przycisk "List" do powrotu
   - Tab: TYPE badge + nazwa + status dot + X
   - Overflow dropdown dla >6 dokumentów

3. **Widok tabeli (FilterableTable)**:
   ```
   | TYPE | NAME | STATUS | PROGRESS | UPDATED | ACTIONS |
   ```
   - Status badges: Draft (szary), In Review (żółty), Approved (zielony), Completed (zielony)
   - Progress bar z kolorami wg postępu
   - Actions visible on hover

4. **Widok kart (GridView)**:
   - Karta z gradientowym tłem wg typu
   - Header: TYPE + menu (3 kropki)
   - Progress bar + procent
   - Footer: status + data
   - Quick view button (eye) on hover

#### Style przycisków:
```tsx
// Primary (akcja główna)
className="bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25"

// Secondary (nieaktywny)
className="bg-navy-800 border-navy-600 text-slate-300 hover:bg-navy-700"

// Active tab
className="bg-primary-500/15 border-primary-500 text-primary-400"
```

#### Kolory statusów:
| Status | Dot | Background |
|--------|-----|------------|
| Draft | `bg-slate-400` | `bg-slate-500/20` |
| In Review | `bg-amber-400` | `bg-amber-500/20` |
| Approved | `bg-emerald-400` | `bg-emerald-500/20` |
| Completed | `bg-emerald-400` | `bg-emerald-500/20` |
| Blocked | `bg-rose-400` | `bg-rose-500/20` |
| Executing | `bg-cyan-400` | `bg-cyan-500/20` |

#### Moduły zgodne z ModuleHub:
- ✅ Assessment (`AssessmentModuleHub.tsx`)
- ✅ Initiatives (`InitiativesHub.tsx`)
- ✅ Execution (`ExecutionHub.tsx`)
- ✅ Benefits (`BenefitsHub.tsx`)
- ✅ Reports (`ReportsHub.tsx`)

#### Moduły z uzasadnionymi różnicami:
- ⚠️ My Work - dashboard (SplitLayout 65/35)
- ⚠️ Interview - workspace pattern
- ⚠️ Tools - landing page z kategoriami
- ❌ Economics - **DO MIGRACJI na ModuleHub**

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
3. src/components/Initiatives/ (wzorzec UI)
4. server/src/controllers/InitiativeController.ts (istniejący controller)

CEL: Centralne miejsce realizacji inicjatyw i zarządzania projektami.
To tu trafiają inicjatywy po zatwierdzeniu w Initiatives (status EXECUTING).
Wzorowane na najlepszych narzędziach: Asana, ClickUp, Jira, monday, Wrike.

KLUCZOWE WYMAGANIE:
Moduł pokazuje TYLKO statusy: EXECUTING, BLOCKED, DONE, CANCELLED, ARCHIVED
- DONE -> przechodzi do Benefits
- BLOCKED/CANCELLED/ARCHIVED -> wraca do Initiatives (historycznie)

ZAKRES WDROŻENIA:
1. 5 widoków: Lista, Kanban, Kafle, Timeline (Gantt), Kalendarz
2. Dashboard Portfolio Health (góra ekranu)
3. Dwa poziomy pracy: Initiatives -> Tasks
4. Decyzje powiązane z Initiative lub Task
5. RAID Log (Risks, Assumptions, Issues, Dependencies)
6. Alerty: overdue, blockers, high-risk

WORKFLOW STATUSÓW (w tym module):
EXECUTING -> BLOCKED / DONE / CANCELLED / ARCHIVED
(DONE przechodzi do Benefits, reszta wraca do Initiatives)

GATE DECISIONS:
- Scope Change (owner: Sponsor/PMO)
- Risk Acceptance (owner: Sponsor/PMO)
- Blocker Resolution (owner: Project Lead)
- Phase Transition (Plan -> Pilot -> Scale)

PORTFOLIO HEALTH DASHBOARD:
- % initiatives on track / at risk
- Liczba blockers
- Decyzje opóźnione (overdue)
- Budget health
- Średni postęp

DELIVERABLES:
1. Frontend:
   - src/components/Execution/ExecutionDashboard.tsx
   - src/components/Execution/ExecutionHub.tsx (główny kontener)
   - src/components/Execution/ExecutionList.tsx
   - src/components/Execution/ExecutionKanban.tsx
   - src/components/Execution/ExecutionTiles.tsx
   - src/components/Execution/ExecutionTimeline.tsx (Gantt)
   - src/components/Execution/ExecutionCalendar.tsx
   - src/components/Execution/TaskList.tsx
   - src/components/Execution/RAIDLog.tsx
   - src/components/Execution/DecisionPanel.tsx
   - src/components/Execution/PortfolioHealth.tsx

2. Backend:
   - server/src/controllers/ExecutionController.ts (rozbudowa)
   - server/src/routes/execution.routes.ts
   - server/migrations/XXX_execution_center.sql

3. Testy:
   - tests/e2e/execution-center.spec.ts

KRYTERIA AKCEPTACJI:
- [ ] Wszystkie 5 widoków działa
- [ ] Portfolio Health dashboard pokazuje metryki
- [ ] Initiatives i Tasks zarządzane w jednym miejscu
- [ ] Decyzje powiązane z initiative/task
- [ ] Overdue decisions generują alerty
- [ ] Timeline (Gantt) pokazuje dependencies
- [ ] Kalendarz pokazuje deadlines
- [ ] RAID Log działa
- [ ] Drag & drop w Kanban zmienia status

STANDARD UI/UX:
Spójność z pozostałymi modułami:
- Ten sam dynamiczny pasek nawigacji (max 6 otwartych)
- Te same przyciski i style
- Ten sam pattern drawer (50%) + open wider
- Dashboard na górze ekranu
```

---

## 🎯 PROMPT 3.5: MODUŁ BENEFITS (Rozliczenie)

### Kontekst dla agenta

```
ZADANIE: Wdrożenie modułu Benefits do nadzoru i rozliczenia zakończonych inicjatyw

PRZECZYTAJ NAJPIERW:
1. src/components/Execution/ (wzorzec UI)
2. src/views/BenefitsRealizationView.tsx (istniejący widok)
3. server/src/controllers/InitiativeController.ts

CEL: Monitoring efektów i rozliczenie zakończonych inicjatyw (status DONE).
Tu trafiają inicjatywy po zakończeniu realizacji w Execution Center.

KLUCZOWE WYMAGANIE:
Moduł pokazuje TYLKO status: DONE
- Inicjatywa może zmienić status na BLOCKED/ARCHIVED -> wraca do Initiatives

ZAKRES WDROŻENIA:
1. Lista inicjatyw DONE z metrykami
2. Dashboard efektów (planned vs actual)
3. Evidence (dowody realizacji)
4. Benefit tracking per inicjatywa
5. Możliwość zmiany statusu (BLOCKED, ARCHIVED)

WORKFLOW:
DONE (z Execution) -> monitoring w Benefits
- Jeśli problemy: BLOCKED -> wraca do Initiatives
- Jeśli zamknięte: ARCHIVED -> historyczne w Initiatives

GATE DECISIONS:
- Benefit Acceptance (owner: Sponsor/PMO)
- Close vs Archive (owner: PMO)

METRYKI DO ŚLEDZENIA:
- ROI (planned vs actual)
- Savings (planned vs actual)
- Time to value
- User adoption
- Business impact score

DELIVERABLES:
1. Frontend:
   - src/components/Benefits/BenefitsList.tsx
   - src/components/Benefits/BenefitsDashboard.tsx
   - src/components/Benefits/BenefitTracking.tsx
   - src/components/Benefits/BenefitMetrics.tsx
   - src/components/Benefits/EvidencePanel.tsx
   - src/views/BenefitsView.tsx (refactor)

2. Backend:
   - server/src/controllers/BenefitsController.ts
   - server/src/routes/benefits.routes.ts
   - server/migrations/XXX_benefits_tracking.sql

3. Testy:
   - tests/e2e/benefits-tracking.spec.ts

KRYTERIA AKCEPTACJI:
- [ ] Lista inicjatyw DONE wyświetla się poprawnie
- [ ] Dashboard pokazuje planned vs actual
- [ ] Evidence można dodawać i przeglądać
- [ ] Zmiana statusu na BLOCKED/ARCHIVED działa
- [ ] Metryki ROI/Savings wyliczają się poprawnie

STANDARD UI/UX:
Spójność z pozostałymi modułami:
- Ten sam dynamiczny pasek nawigacji
- Te same przyciski i style
- Ten sam pattern drawer (50%) + open wider
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

Prompt 6 decyzje 
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

## - nie a/interview.routes.ts (istniejące)

CEL: Interview zbiera kontekst organizacji "as-is" przed Tools/Assessment.
TYLKO FAKTY - bez rekomendacji, planów działań, analiz.
To WYMAGANY pierwszy krok w procesie Discovery.

UWAGA: Obecna implementacja jest przestarzała i wymaga PEŁNEJ PRZEBUDOWY UI/UX.
Nowy interfejs ma być wzorowany na ClickUp (task-list style).

5 KATEGORII WYWIADU (nie 8!):
1. Strategy - cele biznesowe, wizja, kierunki strategiczne
2. Operations - procesy operacyjne, efektywność, bottlenecki
3. Digital - dojrzałość cyfrowa, systemy IT, automatyzacja
4. People - kompetencje, kultura, gotowość na zmiany
5. Finance - budżety, ograniczenia finansowe, ROI expectations

NOWA STRUKTURA UX (ClickUp-like):
┌──────────────────────────────────────────────────────────────────┐
│ TOP BAR: Session name | Status | Owner | Last updated           │
├──────────────────────────────────────────────────────────────────┤
│ TABS: [Questions] [Notes] [Evidence] [Summary]                   │
├──────────────┬───────────────────────────────────┬───────────────┤
│ LEFT SIDEBAR │     MAIN WORKSPACE                │ RIGHT PANEL   │
│              │                                   │               │
│ Categories:  │  Lista pytań (task-list style)   │ Company Facts │
│ • Strategy   │  - Inline edit                   │ Key Metrics   │
│ • Operations │  - Status per pytanie            │ Stakeholders  │
│ • Digital    │  - Confidence score (1-5)        │ Open Gaps     │
│ • People     │  - Owner (kto odpowiedział)      │               │
│ • Finance    │  - Tags (risk, opportunity)      │               │
└──────────────┴───────────────────────────────────┴───────────────┘

ZAKRES PRZEBUDOWY:
1. Nowy layout ClickUp-like (lewy sidebar, środek, prawy panel)
2. 4 taby: Questions, Notes, Evidence, Summary
3. Lista pytań jako task-list (inline edit, statusy)
4. Status per pytanie: Not started / In progress / Answered / Needs follow-up
5. Confidence score (1-5) per pytanie
6. Evidence panel (załączniki, linki)
7. Summary view (auto-generowane + manual, BEZ rekomendacji)
8. Company Facts panel (prawy sidebar)

WORKFLOW SESJI:
1. Użytkownik tworzy sesję Interview
2. System proponuje szablon pytań per kategoria
3. Użytkownik odpowiada - statusy zmieniają się automatycznie
4. Na końcu generuje się Summary: "Current state snapshot"
5. "Mark as Complete" -> zamyka etap Interview
6. Kontekst dostępny w Tools/Assessment

ZASADA: BRAK REKOMENDACJI
W Summary tylko:
- najważniejsze fakty (as-is)
- główne luki informacyjne (gaps)
- ryzyka i ograniczenia (constraints)
- current pain points (opisowo)
NIE MA: planów działań, rekomendacji, next steps

DELIVERABLES:
1. Frontend (PRZEBUDOWA):
   - src/views/InterviewView.tsx (refactor)
   - src/components/Interview/InterviewWorkspace.tsx (refactor)
   - src/components/Interview/QuestionsList.tsx (nowy - task-list)
   - src/components/Interview/NotesPanel.tsx (nowy)
   - src/components/Interview/EvidencePanel.tsx (nowy)
   - src/components/Interview/SummaryView.tsx (nowy)
   - src/components/Interview/CompanyFactsPanel.tsx (nowy)
   - src/components/Interview/CategorySidebar.tsx (nowy)

2. Backend (rozbudowa):
   - server/src/controllers/InterviewController.ts (rozbudowa)
   - server/src/routes/interview.routes.ts (rozbudowa)
   - server/migrations/XXX_interview_redesign.sql (update schema)

3. Testy:
   - tests/e2e/interview.spec.ts

KRYTERIA AKCEPTACJI:
- [ ] Nowy layout ClickUp-like działa
- [ ] 5 kategorii (Strategy, Operations, Digital, People, Finance)
- [ ] Lista pytań z inline edit i statusami
- [ ] Confidence score per pytanie
- [ ] Evidence panel działa (upload, links)
- [ ] Summary generuje się BEZ rekomendacji
- [ ] Kontekst przekazywany do Tools/Assessment
- [ ] Historia sesji per organizacja

STANDARD UI/UX:
Spójność z pozostałymi modułami:
- Ten sam dynamiczny pasek nawigacji (max 6 otwartych)
- Te same przyciski i style  
- Task-list pattern jak w ClickUp
- Minimalizm, dużo przestrzeni
```

---

## 📋 KOLEJNOŚĆ WDROŻENIA (REKOMENDOWANA)

```
FAZA 0 - Kontekst organizacji:
0. Interview (PRZEBUDOWA - 5 kategorii, ClickUp-like UI)

FAZA 1 - Źródła inicjatyw:
1. Assessment (DRD + SIRI pełne, ADMA/CMMI/Lean = Coming soon)

FAZA 2 - Centrum zarządzania:
2. Initiatives + Roadmap (4 widoki, drawer, harmonogram)

FAZA 3 - Realizacja:
3. Execution Center (5 widoków, Gantt, RAID, Portfolio Health)
4. Benefits (monitoring, rozliczenie)

FAZA 4 - Wsparcie decyzji:
5. Economic Analysis (scenariusze, powiązanie z inicjatywami)
6. Reporting (generator, PDF/PPTX, schedule)

FAZA 5 - Warstwa przekrojowa:
7. Decision Management (unified model, eskalacje)
8. System Integration (end-to-end flow, testy)
```

### 🔗 Zależności między modułami
- Interview -> Tools/Assessment (kontekst)
- Tools/Assessment -> Initiatives (inicjatywy DRAFT)
- Initiatives -> Execution (inicjatywy EXECUTING)
- Execution -> Benefits (inicjatywy DONE)
- Economic Analysis -> może działać niezależnie LUB z inicjatywą
- Reporting -> wymaga danych z wszystkich modułów
- Decision Management -> przenika wszystkie moduły

---

## 🔧 JAK UŻYWAĆ TYCH PROMPTÓW

### Dla jednego agenta (sekwencyjnie):
1. Wyślij PROMPT 8 (Interview) - PRZEBUDOWA UI
2. Wyślij PROMPT 1 (Assessment)
3. Wyślij PROMPT 2 (Initiatives)
4. Wyślij PROMPT 3 (Execution)
5. Wyślij PROMPT 3.5 (Benefits)
6. Wyślij PROMPT 4-7 (pozostałe)
7. itd.

### Dla wielu agentów (równolegle):
Można uruchomić równolegle:
- Agent A: Interview (PROMPT 8)
- Agent B: Assessment (PROMPT 1)
- Agent C: Initiatives + Roadmap (PROMPT 2)

NIE RÓWNOLEGLE (zależności):
- Execution wymaga Initiatives (czekaj na PROMPT 2)
- Benefits wymaga Execution (czekaj na PROMPT 3)
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

## 📝 LISTA PROMPTÓW (spis treści)

| # | Moduł | Priorytet | Status |
|---|-------|-----------|--------|
| 8 | **Interview** | 🔴 WYSOKI | PRZEBUDOWA - 5 kategorii, ClickUp UI |
| 1 | **Assessment** | 🔴 WYSOKI | DRD + SIRI pełne |
| 2 | **Initiatives + Roadmap** | 🔴 WYSOKI | 4 widoki, drawer, harmonogram |
| 3 | **Execution Center** | 🔴 WYSOKI | 5 widoków, Gantt, RAID |
| 3.5 | **Benefits** | 🟡 ŚREDNI | Monitoring, rozliczenie |
| 4 | **Economic Analysis** | 🟡 ŚREDNI | Scenariusze, inicjatywy |
| 5 | **Reporting** | 🔴 WYSOKI | Generator, PDF/PPTX |
| 6 | **Decision Management** | 🔴 WYSOKI | Unified model, eskalacje |
| 7 | **System Integration** | 🔴 WYSOKI | E2E flow, testy |

---

*Dokument zaktualizowany: 2026-01-20*
*Wersja: 2.1*
*Zmiany w v2.1:*
- *Rozbudowano sekcję UI/UX Golden Standard*
- *Dodano referencję do pełnej dokumentacji: `wdrozenia/UI_UX_GOLDEN_STANDARD.md`*
- *Dodano audyt zgodności modułów z ModuleHub*
- *Dodano szczegóły stylów przycisków i statusów*

*Zmiany w v2.0:*
- *Dodano PROMPT 3: Execution Center (brakowało)*
- *Dodano PROMPT 3.5: Benefits (brakowało)*
- *Zaktualizowano PROMPT 8: Interview (wymagany, 5 kategorii, przebudowa UI)*
- *Dodano przepływ statusów inicjatyw*
- *Dodano standard UI/UX*
- *Zaktualizowano kolejność wdrożenia*

# Consultify Table Platform — Plan Wdrożenia V7

**Data:** 2026-03-16  
**Status:** READY FOR EXECUTION  
**Kod programu:** `V7`  
**Charakter dokumentu:** docelowy plan rozwoju funkcjonalności Airtable-class wewnątrz Consultify  
**Zastępuje jako plan referencyjny:** wcześniejsze plany wykonawcze (`V2` i pochodne)  
**Bazuje na:**  
- `CONSULTIFY_AIRTABLE_OPERATING_MODEL_2026-03-16.md`
- `CONSULTIFY_AIRTABLE_ACTION_PLAN_2026-03-16.md`
- `AIRTABLE_REPRESENTATION_ANALYSIS_FOR_CONSULTIFY_2026-03-16.md`
- `TABLE_PLATFORM_HONEST_AUDIT_AND_PLAN_2026-03-16.md`
- archiwum dokumentacji Airtable + pełny pakiet screenshotów

---

## 1. Cel programu V7

Program `V7` ma doprowadzić Consultify do stanu, w którym system operacyjny danych i pracy:

- ma **moc operacyjną Airtable**
- zachowuje **tożsamość Consultify**
- wspiera **zarządzanie, decyzje, wykonanie i raportowanie**
- nie jest tylko modułem tabel, ale **warstwą operacyjną firmy**

### Docelowy rezultat

Po zakończeniu `V7` użytkownik powinien móc:

1. opisać potrzebę biznesową w języku naturalnym,
2. otrzymać gotowy projekt systemu operacyjnego,
3. uruchomić wielotabelową bazę z widokami, formularzami, interfejsami i automatyzacjami,
4. zasilać ją danymi ręcznie i automatycznie,
5. używać jej do codziennej pracy operacyjnej,
6. łączyć dane z KPI, finansami, decyzjami, execution i dystrybucją artefaktów.

---

## 2. Założenia strategiczne

### 2.1 Czego NIE budujemy

Nie budujemy:

- klona Airtable 1:1
- osobnego narzędzia tabelowego oderwanego od Consultify
- kolejnej warstwy „feature zoo” bez spójnego shellu

### 2.2 Co budujemy

Budujemy:

> **AI-native operating layer for business systems**

czyli produkt złożony z pięciu powierzchni:

1. `AI Build Surface`
2. `Base / Data Surface`
3. `Schema / Tools Surface`
4. `Apps Surface`
5. `Workflow / Data Hub Surface`

### 2.3 Warunek sukcesu

V7 uznajemy za zakończony tylko wtedy, gdy:

- platforma działa live na Railway,
- użytkownik może pracować na wielu tabelach w jednej bazie,
- AI tworzy nie tylko schemat, ale gotowy system pracy,
- forms, interfaces, automations i sync są realnymi surface’ami,
- warstwa operacyjna zasila decyzje, execution i raportowanie w Consultify.

---

## 3. Prawda startowa

Program V7 zakłada uczciwy punkt wyjścia:

### 3.1 Co jest mocne

- backend usługowy jest rozbudowany i w dużej mierze gotowy
- istnieje szeroki model domenowy tabel
- istnieją CRUD-y, relacje, formuły, comments, watches, sync, templates, relays, distributions
- istnieje duża liczba komponentów frontendowych
- istnieje architektura metadata-first

### 3.2 Co jest słabe

- brak pewności runtime deployment truth
- brak migration runnera jako pierwszoplanowego mechanizmu
- nadmiernie przeciążony shell UI
- brak realnego base-first UX
- AI flow jest zbyt techniczny i zbyt wąski
- interfaces/forms istnieją, ale nie są pełnymi powierzchniami produktu
- brak spójnego operator shell dla schema/tools
- brak date dependencies i record templates na poziomie realnego workflow

---

## 4. Architektura programu V7

Program dzielimy na 7 epików głównych.

## Epic V7-0 — Platform Reality

**Cel:** upewnić się, że system istnieje realnie, a nie tylko jako kod.

### Zakres

- migration runner
- migracje na Railway
- sprawdzenie zdrowia `tp_*` schema
- bezpieczny fallback do legacy
- naprawa fake UI interactions
- template seeding
- prawdziwa identyfikacja użytkownika w collaboration

### Rezultat

Po tej fazie:

- backend naprawdę działa,
- frontend nie ukrywa danych użytkownika,
- nie ma „teatru gotowości”.

---

## Epic V7-1 — Base Shell

**Cel:** zbudować prawdziwy shell bazy klasy Airtable.

### Zakres

- baza jako kontener wielu tabel
- tabs dla tabel
- saved views jako obiekty pierwszej klasy
- czysty top shell
- tools menu
- status bar
- footer aggregates
- row numbers
- hide fields / sort / group / color / share-sync controls

### Rezultat

Po tej fazie system wygląda i działa jak realny operacyjny base workspace, a nie pojedynczy rozbudowany grid.

---

## Epic V7-2 — AI Front Door

**Cel:** uczynić AI głównym wejściem do budowy systemu.

### Zakres

- AI intake flow
- company-aware configuration
- use case / business problem intake
- build plan preview
- approval flow
- schema generation
- sample data generation
- initial automations
- split-screen AI + workspace mode

### Rezultat

Po tej fazie użytkownik zaczyna od problemu biznesowego, a nie od pustej tabeli.

---

## Epic V7-3 — Schema & Planning Power

**Cel:** nadać systemowi głębię operator-level Airtable.

### Zakres

- field manager
- dependency browser
- field descriptions
- field permissions
- record templates
- date dependencies
- planning logic in timeline/gantt
- dependency diagnostics and repair UX

### Rezultat

Po tej fazie Consultify zyskuje realną głębię strukturalną i planistyczną.

---

## Epic V7-4 — Apps Surface

**Cel:** zrobić z interfaces i forms pełne produkty.

### Zakres

- interfaces index
- interface designer persistence
- page settings / publishing / role access
- forms index
- persistent form builder
- public/internal submissions
- form behavior controls

### Rezultat

Po tej fazie warstwa aplikacyjna działa dla nie-technicznych użytkowników i odbiorców zewnętrznych.

---

## Epic V7-5 — Workflow & Data Hub

**Cel:** spiąć dane, sync, automations, relays i dystrybucję w jedną operacyjną infrastrukturę.

### Zakres

- sync manager
- connector surfaces
- automation manager
- webhook/relay manager
- sharing manager
- artifact distribution manager
- provenance + governed integration

### Rezultat

Po tej fazie system staje się hubem przepływu danych i działań.

---

## Epic V7-6 — Consultify Integration

**Cel:** połączyć warstwę operacyjną z rdzeniem Consultify.

### Zakres

- governed models integration
- KPI and trust layer
- powiązania z Results
- powiązania z Finance
- powiązania z Execution
- powiązania z Presentations / Reports
- AI-generated insight and distribution outputs

### Rezultat

Po tej fazie system tabel nie jest osobnym narzędziem, tylko operacyjną warstwą firmy zasilającą decyzje i execution.

---

## 5. Fazy wdrożenia V7

## Faza 0 — Truth First

**Zależność krytyczna:** bez tej fazy nie wolno iść dalej.

### Zadania

1. Zbudować migration runner.
2. Uruchomić wszystkie migracje w środowisku staging.
3. Zweryfikować poprawność schematu.
4. Zweryfikować live CRUD dla base/table/field/view/record.
5. Naprawić fallback z platform mode do legacy mode.
6. Naprawić `FormBuilder`.
7. Naprawić `InterfaceDesigner`.
8. Naprawić redo w platform mode.
9. Włączyć real user identity w presence.
10. Seedować domyślne templates i dane pomocnicze.

### Exit criteria

- platform działa live
- nie ma pustych tabel przez broken feature flag
- nie ma no-op UI na kluczowych surface’ach

### Szacowany czas

`3-5 dni`

---

## Faza 1 — Build The Base

### Zadania

1. Wprowadzić base-first navigation model.
2. Dodać tabs dla wielu tabel w jednej bazie.
3. Dodać status bar i footer aggregates.
4. Dodać row numbers.
5. Zbudować clean tools menu.
6. Wydzielić shell controls z przerośniętego toolbara.
7. Wprowadzić view-centric interaction model.

### Exit criteria

- użytkownik może prowadzić pracę w jednej bazie z wieloma tabelami
- shell jest prostszy i bardziej czytelny niż obecnie

### Szacowany czas

`1-2 tygodnie`

---

## Faza 2 — AI System Builder

### Zadania

1. Zaprojektować AI intake contract.
2. Wprowadzić pola kontekstu firmy:
   - company
   - industry
   - team
   - language
   - operating goals
3. Zbudować planner:
   - tables
   - views
   - forms
   - interfaces
   - automations
4. Zbudować plan preview z uzasadnieniem.
5. Dodać sample data generation.
6. Dodać auto-suggest automations.
7. Zbudować split-screen AI + workspace mode.

### Exit criteria

- użytkownik może „opisać system” i otrzymać działający pierwszy draft operacyjny

### Szacowany czas

`2-3 tygodnie`

---

## Faza 3 — Schema & Planning Depth

### Zadania

1. Zbudować field manager jako osobny surface.
2. Dodać field descriptions i usage graph.
3. Dodać record templates.
4. Dodać date dependencies:
   - field mapping
   - rescheduling modes
   - predecessor logic
   - working day handling
5. Powiązać to z timeline/gantt.
6. Dodać dependency validation UX.

### Exit criteria

- schema operations są first-class
- project planning use cases są wiarygodne

### Szacowany czas

`2 tygodnie`

---

## Faza 4 — Apps For Real Users

### Zadania

1. Zbudować interfaces index.
2. Włączyć persistence dla Interface Designer.
3. Dodać publish/unpublish/roles/page settings.
4. Zbudować forms index.
5. Włączyć persistence dla Form Builder.
6. Dodać submission behavior, redirect, access modes.

### Exit criteria

- interfaces i forms działają jako realne produkty użytkowe

### Szacowany czas

`1-2 tygodnie`

---

## Faza 5 — Workflow Infrastructure

### Zadania

1. Zbudować sync manager.
2. Zbudować automation manager shell.
3. Zbudować connector setup UX.
4. Zbudować sharing manager.
5. Zbudować relay / webhook manager.
6. Zbudować distribution manager.
7. Dodać provenance and run logs visibility.

### Exit criteria

- przepływ danych i działań jest zarządzalny z poziomu produktu

### Szacowany czas

`2 tygodnie`

---

## Faza 6 — Consultify Core Integration

### Zadania

1. Wpiąć tables do governed models.
2. Wpiąć operational tables do KPI logic.
3. Wpiąć tables do Results i Finance.
4. Wpiąć tables do Execution flows.
5. Wpiąć outputs do reports/presentations/distribution.
6. Dodać AI-generated reporting and explanation layer.

### Exit criteria

- tabela staje się częścią systemu zarządzania, a nie osobnym silosem

### Szacowany czas

`2 tygodnie`

---

## 6. Workstreamy wykonawcze

Program `V7` prowadzimy w 6 równoległych strumieniach.

### WS-A — Runtime & Platform Safety

Zakres:

- migracje
- Railway
- feature-flag safety
- fallback
- runtime health

### WS-B — Base Shell & Navigation

Zakres:

- base model
- multi-table tabs
- shell cleanup
- controls
- footer/status shell

### WS-C — AI Builder

Zakres:

- company-aware intake
- planning
- preview
- seed data
- suggested automations

### WS-D — Schema & Planning Tools

Zakres:

- field manager
- record templates
- date dependencies
- dependency UX

### WS-E — Apps Surfaces

Zakres:

- forms
- interfaces
- publishing
- access behavior

### WS-F — Workflow & Consultify Integration

Zakres:

- sync
- automations
- relays
- sharing
- distribution
- governed model linkage

---

## 7. Priorytety P0 / P1 / P2

## P0 — Must Have Before Public Confidence

- migration runner
- live schema on Railway
- safe fallback
- fixed no-op UI
- multi-table base shell
- field manager
- AI plan preview
- form/interface persistence

## P1 — Must Have For Airtable-Class Credibility

- date dependencies
- record templates
- split AI + workspace mode
- sync manager
- automation manager
- sharing manager
- footer aggregates / status bar

## P2 — Must Have For Consultify Advantage

- governed model integration
- KPI linkage
- report generation
- distribution integration
- execution/decision linkage

---

## 8. Program gates

## Gate G0 — Reality Gate

Warunki:

- wszystkie migracje działają
- live CRUD jest potwierdzone
- frontend nie ukrywa legacy danych

## Gate G1 — Shell Gate

Warunki:

- multi-table shell istnieje
- toolbar chaos został usunięty
- narzędzia są zorganizowane w czytelną strukturę

## Gate G2 — AI Gate

Warunki:

- AI tworzy realne pierwsze środowisko operacyjne
- wynik jest reviewable i explainable

## Gate G3 — Schema Gate

Warunki:

- field manager działa
- record templates działają
- date dependencies działają deterministycznie

## Gate G4 — Apps Gate

Warunki:

- interfaces i forms są produktami, nie widgetami

## Gate G5 — Operating System Gate

Warunki:

- workflow layer działa
- system zasila decyzje i execution

---

## 9. Zakres testowania dla V7

Każda faza kończy się pakietem testów:

### Testy techniczne

- migrations applied
- schema health
- API smoke tests
- E2E tests
- integration tests
- no regression in legacy mode

### Testy produktowe

- create base from AI
- create base from template
- import external data
- manage multiple tables
- create and publish form
- create and publish interface
- configure automation
- configure sync
- run management use case

### Testy biznesowe

- CRM
- budget management
- investment / CAPEX-OPEX tracking
- project planning with dependencies
- KPI + reporting flow

---

## 10. Artefakty wyjściowe programu V7

Po zakończeniu programu V7 mają istnieć:

1. działająca warstwa operacyjna live
2. AI builder
3. wielotabelowa baza
4. tools/schema manager
5. date dependencies
6. record templates
7. interfaces product surface
8. forms product surface
9. workflow/data hub manager
10. integracja z governed models i execution

---

## 11. Rekomendowana kolejność uruchomienia

### Sprint 1

- Epic V7-0

### Sprint 2-3

- Epic V7-1

### Sprint 4-6

- Epic V7-2

### Sprint 7-8

- Epic V7-3

### Sprint 9-10

- Epic V7-4

### Sprint 11-12

- Epic V7-5

### Sprint 13-14

- Epic V7-6

---

## 12. Finalna definicja sukcesu V7

`V7` kończy się sukcesem, jeśli użytkownik może wejść do Consultify i powiedzieć:

> „Potrzebuję systemu do zarządzania tym fragmentem firmy”

a Consultify:

- zrozumie kontekst firmy,
- zbuduje odpowiedni system operacyjny,
- pozwoli prowadzić pracę w tabelach, interfejsach i formularzach,
- będzie synchronizować i automatyzować dane,
- i połączy to z decyzjami, execution i raportowaniem.

To jest właściwy zakres `V7`.

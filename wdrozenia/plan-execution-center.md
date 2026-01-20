# Plan wdrozenia: Execution Center (Wykonawstwo)

## Instrukcja dla agenta (do rozliczenia)
### Cel
Wdrozyc Execution Center do realizacji inicjatyw i taskow z decyzjami i eskalacjami.

### Zakres
- Widoki: kanban, list, tiles, timeline, calendar
- Zarzadzanie taskami i decyzjami
- Portfolio Health i alerty
- Integracje: Initiatives, Benefits, Decision Management, Reporting

### Deliverables (musi dostarczyc)
1) UI/UX dla 5 widokow + dashboard
2) Workflow statusow EXECUTING/BLOCKED/DONE
3) Decyzje (initiative/task) + eskalacje
4) API dla taskow/decisions i statystyk
5) Testy E2E (execution -> done -> benefits)

### Kryteria rozliczenia
- Inicjatywy i taski zarzadzane w jednym miejscu
- Decyzje generuja eskalacje przy opoznieniach
- Portfolio Health odzwierciedla stan portfela

## Cel i kontekst
Execution Center to centralne miejsce realizacji inicjatyw. Uzytkownik zarzadza inicjatywami i zagniezdzonymi taskami, a decyzje sa osobnym bytem powiazanym z inicjatywa lub taskiem. Modul ma dawac pelna widocznosc postepu, ryzyk, zasobow i terminow, a takze identyfikowac opoznienia wynikajace z braku decyzji.

Wymagania biznesowe:
- dwa poziomy pracy: Initiatives -> Tasks
- decyzje moga byc powiazane z inicjatywa lub taskiem (ale nie musza)
- widoki: kanban, timeline (gantt), lista, kafle + kalendarz
- spojnosc UI/UX z reszta aplikacji (dynamiczny pasek, przyciski)
- statusy inicjatyw w Execution: EXECUTING, BLOCKED, DONE, CANCELLED, ARCHIVED
- kluczowa funkcja: identyfikacja opoznien wynikajacych z decyzji
- dodac Portfolio Health (panel zdrowia portfela)

## Zasady domenowe
### Statusy inicjatyw w Execution
- EXECUTING: aktywne w realizacji
- BLOCKED: zablokowane
- DONE: zakonczone -> przekazanie do Benefits
- CANCELLED / ARCHIVED: zamkniete -> powrot do Initiatives jako historyczne

### Decyzje
- decyzja ma: owner, due date, status (pending/approved/rejected)
- decyzje moga byc tworzone na poziomie initiative lub task
- decyzje nie sa wymagane, ale system raportuje opoznienia

## Decyzje (gates)
- Decision: Scope Change (owner: Sponsor/PMO)
- Decision: Risk Acceptance (owner: Sponsor/PMO)
- Decision: Blocker Resolution (owner: Project Lead)
- Decision: Phase Transition (Plan/Pilot/Scale)
Overdue decyzje podnosza poziom eskalacji w Portfolio Health.

## UX i UI (opis)
### Gorny pasek (spojny z innymi modulami)
- filtry statusow (Executing/Blocked/Done/Cancelled/Archived)
- widoki: list / kanban / tiles / timeline / calendar
- przyciski: New Task, New Decision, Export

### Widoki
1) Kanban
   - kolumny statusow taskow (To Do / In Progress / Review / Done)
   - drag & drop

2) Lista
   - lista inicjatyw z mozliwoscia rozwiniecia taskow
   - szybkie filtry (status, owner, due date, decyzje)

3) Kafle
   - karty inicjatyw z progressem, ROI, budgetem
   - klik otwiera drawer

4) Timeline (Gantt)
   - inicjatywy jako belki
   - zaleznosci i critical path

5) Kalendarz
   - widok decyzji i taskow z deadline
   - filtry po ownerach

### Drawer inicjatywy
Wysuwa sie z prawej strony (50%) i zawiera:
- Overview (cele, opis, priorytet)
- Tasks (lista + statusy)
- Decisions (pending / due soon)
- Resources (ownerzy, capacity)
- Timeline (start/end)
- przycisk "Open wider" do dynamicznego paska

## Portfolio Health (zdrowie portfela)
Panel syntetyczny:
- % initiatives on track / at risk
- liczba blockers
- decyzje opoznione
- budget health
- sredni postep

Widok "Portfolio Health" jako karta na dashboardzie + filtr globalny.

## Decyzje (koncepcja funkcjonalna)
Decyzje sa traktowane jako "milestone approvals":
- owner musi podjac decyzje do due date
- opoznienia decyzji generuja alerty
- statystyki opoznien na poziomie initiative i portfolio

## Polaczenia z reszta aplikacji
- Initiatives (Planning) -> Execution (status EXECUTING)
- DONE -> Benefits tracking
- BLOCKED/CANCELLED/ARCHIVED -> historyczne w Initiatives
- Decisions widoczne w My Work (task-like)

## DoD (Definition of Done)
- wszystkie widoki dzialaja
- statusy inicjatyw filtrowane i poprawne
- decyzje powiazane z initiative/task
- alerty dla overdue decisions
- portfolio health dashboard dziala
- drawer + open wider zgodne ze standardem UI

## Zadania implementacyjne
### Frontend
- widoki list/kanban/tiles/timeline/calendar
- drawer initiative + open wider
- decyzje w UI (listy + filtry)
- dashboard + portfolio health

### Backend
- endpointy dla initiatives/tasks/decisions
- logika statusow Execution
- statystyki opoznien decyzji

### AI / wspomaganie
- rekomendacje priorytetow taskow
- wykrywanie konfliktow w timeline
- sugestie ryzyk i decyzji

## Grafiki i diagramy (do dostarczenia)
1) Layout Execution Center (dashboard + widoki)
2) Drawer initiative + open wider flow
3) Portfolio Health card
4) Gantt + Calendar mock

## Ryzyka i mitigacje
- Ryzyko: zbyt skomplikowany UI -> wspolne komponenty
- Ryzyko: brak decyzji w praktyce -> soft reminders
- Ryzyko: chaos taskow -> filtry i owner-based view

## Kryteria akceptacji
- inicjatywy i taski zarzadzane w jednym module
- decyzje widoczne i raportowane
- timeline i calendar funkcjonalne
- spojnosc UX z reszta aplikacji

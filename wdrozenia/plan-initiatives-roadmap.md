# Plan wdrozenia: Initiatives + Roadmap (Portfolio & Timeline)

## Instrukcja dla agenta (do rozliczenia)
### Cel
Zbuduj modul planowania inicjatyw (Review/Approved/Planning) z roadmapa.

### Zakres
- Widoki: lista, kanban, kafle, timeline
- Priorytety, zasoby, harmonogram i decyzje
- Drawer + Open wider (spójny standard)
- Integracje: Tools/Assessment, Execution, Decision Management

### Deliverables (musi dostarczyc)
1) UI/UX dla 4 widokow + filtry statusow
2) Workflow statusow i gate decisions
3) Harmonogram (timeline) z zaleznosciami
4) API dla statusow i harmonogramu
5) Testy E2E dla flow Review -> Approved -> Planning

### Kryteria rozliczenia
- Statusy widoczne tylko dla tego etapu
- Drawer i Open wider dzialaja
- Timeline pozwala planowac inicjatywy i zaleznosci

## Cel i kontekst
Ten modul jest kluczowym etapem planowania i porzadkowania inicjatyw przed wykonaniem. To tu pracujemy na inicjatywach, priorytetach, zasobach i harmonogramie. UI/UX musi byc spojny z pozostalymi modulami (Tools/Assessment) i korzystac z dynamicznego paska nawigacji.

Wymagania biznesowe:
- UI/UX identyczny jak w pozostalych modulach (pasek dynamiczny, przyciski, styl)
- praca na inicjatywach na roznych widokach: lista, kanban, kafle, timeline
- kluczowa funkcja: harmonogramowanie i zarzadzanie czasem
- inicjatywy musza rozwijac sie z prawej strony (drawer), z opcja "Open wider" do paska dynamicznego
- na pasku statusow pokazywac tylko statusy aktywne dla tego etapu
- wyczyscic statusy, ktore nie powinny byc widoczne (np. Draft, pierwsze zatwierdzenie, Executing itp.)

## Zasady domenowe
Modul Initiatives pokazuje tylko inicjatywy z wybranych statusow:
- Widoczne: REVIEW, APPROVED, PLANNING
- Niewidoczne: DRAFT, EXECUTING, DONE, BLOCKED (te sa na innych ekranach)
- Statusy widoczne w pasku filtrow tylko dla tej fazy

Status flow w tym module:
Review -> Approved -> Planning
Planning -> (przejscie do Execution poza tym modulem)

## Decyzje (gates)
- Decision: Go/No-Go (Review -> Approved)
- Decision: Resources Commit (Approved -> Planning)
- Decision: Schedule Lock (Approved -> Planning)
Decyzje wymagaja ownera i terminu; bez decyzji brak przejscia statusu.

## UX i UI (opis)
### Pasek dynamiczny
Zachowuje standard z innych modulow:
- filtry statusow tylko dla tej fazy
- przyciski widokow: lista / kanban / kafle / timeline
- przyciski akcji: New Initiative, Bulk edit

### Widoki
1) Lista:
   - kolumny: status, priorytet, owner, budget, progress, start/end date
   - szybkie edycje pola (inline)

2) Kanban:
   - kolumny: Review, Approved, Planning
   - drag & drop zmienia status (z uprawnieniami)

3) Kafle:
   - wizualne karty z ROI, budget, progress
   - klik otwiera drawer

4) Timeline (Roadmap):
   - kwartaly/tygodnie
   - inicjatywy jako belki na osi czasu
   - dependencies i critical path

### Drawer inicjatywy
Domyslnie wysuwa sie z prawej strony (do ok. 50% szerokosci).
Zawiera:
- opis, cele, ROI, priorytet
- zasoby (team, role, capacity)
- terminy i kamienie milowe
- decyzje i ryzyka
- przycisk "Open wider" -> otwiera w pasku dynamicznym

### Widok "Open wider"
Ten sam układ co w innych modulach:
- pelna szerokosc w dynamicznym panelu
- sekcje i zakladki inicjatywy (Details, Resources, Timeline, Tasks)

## Harmonogramowanie i zasoby
Kluczowe funkcje:
- start/end dates
- fazy inicjatywy (Plan/Pilot/Scale)
- zaleznosci miedzy inicjatywami
- obciazenie zasobow (capacity)

AI wspiera:
- propozycje terminow
- wykrywanie konfliktow zasobow
- rekomendacje priorytetow

## Powiazania z reszta aplikacji
- Tools/Assessment -> tworza inicjatywy w DRAFT
- Initiatives module: Review/Approved/Planning
- Execution module: tylko status EXECUTING
- Benefits module: DONE

## DoD (Definition of Done)
- UI/UX spojny z innymi modulami
- filtr statusow pokazuje tylko Review/Approved/Planning
- drawer inicjatywy + open wider dziala
- wszystkie 4 widoki funkcjonuja
- timeline z osi czasu i zaleznosciami
- walidacje i uprawnienia dzialaja

## Zadania implementacyjne
### Frontend
- refactor UI/UX do wspolnych komponentow
- widoki: lista/kanban/kafle/timeline
- drawer + open wider
- status filter tylko dla etapow inicjatyw

### Backend
- endpointy filtrowane po statusach
- obsługa drag & drop status change
- harmonogramowanie (start/end, milestones)

### AI / logika
- rekomendacje terminow i priorytetow
- wykrywanie konfliktow w timeline

## Grafiki i diagramy (do dostarczenia)
1) Layout widoku Initiatives (lista/kanban/kafle)
2) Drawer + Open wider flow
3) Roadmap / timeline z dependencies

## Ryzyka i mitigacje
- Ryzyko: za duzo statusow na pasku -> ograniczenie do aktywnych
- Ryzyko: zbyt malo miejsca w drawer -> open wider
- Ryzyko: chaos w timeline -> ograniczenia i walidacje

## Kryteria akceptacji
- widoki sa spójne z innymi modulami
- inicjatywy mozna planowac (czas + zasoby)
- statusy sa poprawnie ograniczone
- drawer i open wider działaja

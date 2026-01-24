# Plan wdrozenia: Zarzadzanie decyzjami (Decision Management)

## Instrukcja dla agenta (do rozliczenia)
### Cel
Wdrozyc przekrojowy system decyzji (gates) z eskalacjami i widokami.

### Zakres
- Model decyzji + statusy + eskalacje
- Inbox (Moje decyzje) + widoki per initiative/project
- Integracje: Tools/Assessment/Initiatives/Execution/Economics/Benefits

### Deliverables (musi dostarczyc)
1) Model danych decyzji + API
2) UI/UX inbox + lista decyzji
3) Logika eskalacji (amber/red)
4) Integracja z Reporting i Portfolio Health
5) Testy (API/E2E) dla decyzji

### Kryteria rozliczenia
- Decyzje blokuja workflow zgodnie z gate rules
- Escalations dzialaja i sa widoczne w raportach

## Cel i kontekst
Decyzje sa kluczowym mechanizmem blokad i eskalacji w calym procesie. Celem jest widocznosc tego, kto i do kiedy musi podjac decyzje, oraz jak opoznienia w decyzjach wplywaja na realizacje inicjatyw.

## Definicja decyzji
Decyzja = formalny punkt kontroli z ownerem i terminem.
Minimalne pola:
- owner (osoba odpowiedzialna)
- due_date
- status (pending / approved / rejected / escalated)
- context (initiative_id lub task_id)
- impact (low/medium/high)
- escalation_level (none/amber/red)

## Typy decyzji
- Strategic: Go/No-Go inicjatywy
- Budget: zatwierdzenie budzetu
- Scope: zmiana zakresu
- Risk: akceptacja ryzyka
- Execution: blokady i przejscia faz

## Lifecycle decyzji
1) Pending (utworzona)
2) Approved / Rejected
3) Escalated (po przekroczeniu terminu)

## Escalacje (standard)
- Amber: przekroczony termin do X dni
- Red: przekroczony termin > X dni lub decyzja krytyczna

## Widoki i UX
- Decision Inbox (Moje decyzje)
- Decisions by Initiative
- Decisions by Project
- Dashboard eskalacji

## Integracje
Decyzje powiazane z:
- Initiatives (Review/Approved/Planning)
- Execution (taski i blokady)
- Reporting (sekcja "Decisions Required")

## DoD
- decyzje widoczne w My Work
- eskalacje generuja alerty
- decyzje blokujace zatrzymuja workflow

## Kryteria akceptacji
- uzytkownik widzi wszystkie decyzje z terminami
- opoznienia generuja eskalacje
- decyzje spójne w kazdym module

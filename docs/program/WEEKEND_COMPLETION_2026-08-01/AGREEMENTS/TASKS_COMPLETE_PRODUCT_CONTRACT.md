---
document_id: TASKS-COMPLETE-PRODUCT-CONTRACT
module: My Work / Tasks
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Tasks — kompletny kontrakt produktu

## 1. Cel

Tasks zamienia zobowiązania w możliwą do kontrolowania pracę. Dobry task opisuje
rezultat, a nie aktywność; wiadomo kto odpowiada, kiedy wynik jest potrzebny,
co go blokuje i jaki dowód pozwala uznać go za wykonany.

## 2. Powierzchnie

| Powierzchnia | Funkcja |
| --- | --- |
| List | pełny rejestr, szybka edycja, filtry, bulk i zapisane widoki |
| Kanban | przepływ według statusu; limity WIP i blokady |
| Calendar | terminy i zaplanowane bloki pracy, nie długie paski projektów |
| Detail | komplet informacji, kart, relacji, komentarzy i audytu |
| My Day / Inbox | projekcja tego, co wymaga uwagi użytkownika |

Minimalne filtry: owner, projekt, initiative, status, priorytet, termin, blocked,
reviewer, tag, source i overdue. Grupowanie: status, owner, projekt, initiative,
priority i due date. Widoki mogą być osobiste lub współdzielone.

## 3. Model danych

Wymagane pola readiness:

- `title` w formie oczekiwanego rezultatu;
- `description/scope` z granicą in/out;
- `owner`; `projectId` lub jawne `personal/general`;
- `priority`; planowany `dueAt` albo uzasadniony brak terminu;
- `definitionOfDone` / kryteria akceptacji;
- provenance i relacje do Initiative/Decision/Execution/KPI/Meeting.

Pola planowania: start, estimate, workload, milestone, recurrence, dependencies,
subtasks/checklist, contributors, reviewer, risk, budget/cost reference.
Pola zamknięcia: evidence, completion note, actual dates/effort, review outcome.

## 4. Lifecycle i przejścia

Canonical runtime: `backlog`, `todo`, `in_progress`, `review`, `blocked`,
`on_hold`, `done`, `cancelled`.

| Status | Znaczenie | Warunek wejścia | Następna odpowiedzialność |
| --- | --- | --- | --- |
| backlog | uznany, jeszcze nieplanowany | sens i provenance znane | project lead planuje/odrzuca |
| todo | gotowy do podjęcia | readiness gate spełniony | owner rozpoczyna |
| in_progress | trwa realna praca | owner i zakres aktualne | owner aktualizuje/blokuje |
| review | wynik gotowy do odbioru | DoD i evidence dostarczone | reviewer przyjmuje/odsyła |
| blocked | brak możliwości postępu | blocker i jego owner wskazani | blocker owner/lead usuwa |
| on_hold | świadomie wstrzymany | powód i data przeglądu | lead podejmuje ponownie |
| done | wynik odebrany | review/polityka zamknięcia | system robi read-back |
| cancelled | praca świadomie zakończona bez wyniku | powód i wpływ zapisane | lead porządkuje zależności |

Przejścia muszą respektować guardy w `taskWorkflowService.ts`. `done` i
`cancelled` mogą być ponownie otwarte z audytem. Bulk action pokazuje diff,
liczbę obiektów, wyjątki i wymaga potwierdzenia.

## 5. Karty detail

| Karta | Cel | Minimum | Rola Teresy |
| --- | --- | --- | --- |
| Opis i zakres | jednoznaczny rezultat | why, outcome, in/out | pisze draft, wykrywa niejasność |
| Pomysły realizacji | warianty wykonania | podejścia i trade-offy | proponuje, nie wybiera za ownera |
| Ryzyko i alternatywy | odporność planu | ryzyko, skutek, mitygacja | analizuje i aktualizuje propozycję |
| Checklist / DoD | kontrola wykonania | sprawdzalne kryteria | generuje i testuje mierzalność |
| Zależności | prawdziwe blokady | obiekt, owner, potrzebny termin | wykrywa konflikty i brakujące linki |
| Evidence | dowód wyniku | artefakt lub pomiar | ocenia zgodność, nie poświadcza faktu |
| RACI i eskalacja | odpowiedzialność | owner, reviewer, escalation | proponuje; człowiek zatwierdza |
| Załączniki i linki | materiały źródłowe | plik/link + provenance | klasyfikuje, nie fabrykuje źródeł |
| Komentarze | współpraca | autor, czas, kontekst | streszcza na żądanie |
| Activity log | audyt | niezmienialne zdarzenia | nie generuje treści |

Rekomendowany zestaw domyślny: Opis, Checklist/DoD, Zależności, Evidence.
Pozostałe karty dobiera Teresa na podstawie ryzyka i złożoności albo użytkownik
przez manager kart. Dla tasków wysokiego ryzyka Governance i Risk są wymagane.

## 6. Teresa i akcje AI

Teresa może: przekształcić wiadomość/decyzję w draft taska, rozbić rezultat na
podzadania, zaproponować ownerów na podstawie ról projektu, wykryć duplikaty,
oszacować ryzyko spiętrzenia, zaproponować termin, DoD i evidence, podsumować
postęp oraz przygotować eskalację.

Każda propozycja pokazuje przesłanki i zmianę przed zapisem. Teresa nie może:
zmienić ownera, terminu, priorytetu, budżetu, statusu `done/cancelled` ani utworzyć
pracy downstream bez odpowiedniego potwierdzenia/polityki.

## 7. Powiązania

- Decision → proponowane taski z zachowaniem `decisionId` i treści rozstrzygnięcia;
- Initiative/Execution → task jako jednostka wykonawcza, nie kopia inicjatywy;
- KPI/Results → task naprawczy z alertu, z zachowaniem progu i odchylenia;
- Calendar → projekcja terminu i bloków pracy;
- Inbox → projekcja przypisania, review, blokady i overdue;
- Meeting/Interview/Tools/Assessment/Finance/Materials → task draft z provenance;
- zewnętrzne systemy → jawne mapowanie, sync state, conflict i source link.

## 8. Quality gates

`Ready`: rezultat, owner, projekt/scope, priorytet, termin lub wyjątek, DoD,
zależności i źródło są kompletne. `Done`: DoD spełnione, evidence dostępne,
review wykonany zgodnie z polityką, zależne obiekty oraz source read-back
zaktualizowane. AI quality score jest wskazówką, nigdy automatycznym odbiorem.

## 9. MVP golden flows

1. Utworzenie taska ręcznie i z obiektu źródłowego.
2. AI draft → human diff/accept → zapis.
3. List/Kanban/Calendar z równoważnymi filtrami i bezpiecznym powrotem.
4. Todo → progress → blocked → progress → review → done z pełnym audytem.
5. Decision → propozycja tasków → akceptacja → owner read-back.
6. Overdue/blocker → Inbox/notification → eskalacja → rozwiązanie.
7. Recurring task → nowa instancja z template, bez nadpisania historii.

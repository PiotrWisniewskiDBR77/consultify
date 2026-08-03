---
doc_kind: MVP_UX_FLOW_CONTRACT
spec_status: APPROVED_SPEC
runtime_status: PARTIAL
owner: Piotr Wisniewski
last_updated: 2026-08-02
authority: docs/ui-standards/CANON.md
---

# Przepływy UX end-to-end MVP

## 1. Wspólny backbone

Każda funkcja listowa realizuje ten sam model:

`wejście/deep link → loading → lista/empty/error → search/filter/view → zaznaczenie → preview → pełne wnętrze → edit/save → server read-back → success/error+recovery → back z zachowanym filtrem, sortem, widokiem i scrollem`.

Create/generator:

`CTA → wybór typu/template → dane minimalne → opcjonalna konfiguracja → review → create pending → wynik → workspace`, z Back, Save draft, Cancel, resume i błędem per krok.

AI:

`intent → jawny zakres i źródła → generation/stream → proposal → diff/preview → approve/reject/edit → execute → read-back → undo lub recovery`.

## 2. My Work

### Kontrakt przejść

| Funkcja | Wejście | Wynik użytkownika | Kontekst zachowany po powrocie | Krytyczne recovery |
|---|---|---|---|---|
| Pomysły | lista/deep link | edycja lub konwersja artefaktu | stage, tool, filter, view, scroll, selected idea | konflikt zapisu; nieudana konwersja bez duplikatu |
| Notatnik | biblioteka/notebook/note link | zapisana nota lub obiekt pochodny | notebook, query, note, cursor/selection, scroll | version compare + keep copy |
| Inbox | inbox/filter/source link | triage pojedynczy lub batch | filter, view, focused row, batch selection | częściowy batch z retry tylko failed |
| Kalendarz | data/event link | utworzone/zmienione wydarzenie | view, date range, timezone, filters | konflikt czasu z zachowaniem formularza |
| Zadania | lista/kanban/calendar/task link | zmieniony lifecycle zadania | view, filter, sort, lane/date, row/scroll | 403/409 rollback i zachowany draft |
| Decyzje | lista/kanban/timeline/decision link | zatwierdzenie/odrzucenie/odroczenie | view, filter, sort, selected decision | idempotent approve + pełny audit trail |
| Sejf | vault/document link | znalezienie/dodanie dokumentu | vault, query, category, folder, row | upload/index partial z retry per file |
| Run agent | process/template/run link | skonfigurowany lub wykonany proces | tab, filters, step, run state | resumable state i jawne skutki cancel |
| Manager | dashboard/problem link | przypisana akcja i śledzony wynik | time range, segment, lane, problem | stale recommendation wymaga refresh/review |

Każde przejście ma odtwarzalny URL tam, gdzie pozwala bezpieczeństwo. Back przywraca kontekst bez ponownego wykonania mutacji.

### Pomysły

Lista/grid → filtry/stage/tool → preview → Open → artefakt Table/Process Flow/Mind Map/Whiteboard → select/edit/context menu → save → convert. Prawy klik i kebab zachowują parytet. Każdy canvas ma zoom, fit, minimap, keyboard alternative i panel properties/context/AI.

### Notatnik

Biblioteka → notebook preview/kebab → notebook → note list/search/filter → editor → toolbar/slash/AI inline → context/backlinks/graph/attachments/history → autosave/read-back → convert do task/decision/idea. Konflikt wersji oferuje compare i zachowanie kopii.

### Inbox

Lista/card → filtry i triage → message preview → detail/source → quick action Today/Defer/Done/Save/Note → read-back → następny element. Triage AI pokazuje batch proposal i pozwala odznaczyć elementy przed wykonaniem.

### Kalendarz

Month/week/day/agenda → wybór slotu lub wydarzenia → preview → detail/edit → konflikt terminów → resolution → save/read-back → powrót do poprzedniego zakresu dat. Wszystkie operacje drag mają alternatywę formularzową.

### Zadania

Table/kanban/calendar → preview → detail workspace → sekcje opisu, pomysłów, ryzyka, checklisty, zależności, dowodów, RACI, załączników → start/assign/block/complete → read-back. Zadania są referencją wizualną kart rekordów.

### Decyzje

Table/kanban/timeline → preview → detail workspace → zakres, opcje/trade-offs, ryzyko, konsekwencje, RACI, załączniki → review → approve/reject/defer → audit/history. Decyzje są referencją wizualną kart rekordów.

### Sejf klienta

Lista sejfów → preview → open vault → documents/search/filter → document preview → download/open → add document wizard → upload/metadata/indexing → success/partial/error. Uprawnienia i tenant scope są widoczne, ale egzekwowane po stronie serwera.

### Run agent

Processes/templates → process preview/kebab → generator → template/goal/steps/inputs/review → create → process workspace → run/schedule → step status/gates/approval → report/history/cancel. Przerwanie pozostawia jednoznaczny resumable state.

### Manager

Dashboard → section/lane → filter → problem preview → detail → recommendation proposal → approve/assign/defer → tracked outcome. KPI prowadzi do danych źródłowych; brak vanity/employee surveillance metrics.

## 3. Przejścia między modułami

- Inbox → Task/Note/Decision zachowuje source link.
- Note → Idea/Task/Decision zachowuje backlink i snapshot źródła.
- Idea → Initiative/Task/Decision zachowuje provenance.
- Decision → Task/Initiative zapisuje decyzję jako governance source.
- Agent → Report/Task/Decision zapisuje run ID, inputs i approval trail.
- Vault document → Note/Idea/Decision zapisuje bezpieczny reference, nie kopiuje poufnej treści bez capability.

## 4. Uniwersalne wyjątki

No-access nie ujawnia istnienia poufnych danych. Missing/deleted record oferuje powrót do listy. Offline rozróżnia read cache od unsaved changes. Back/forward i deep link są testowane. Destrukcja wymaga consequence copy, confirm oraz feedback.

## 5. Kryterium ukończenia przepływu

Przepływ nie kończy się na kliknięciu CTA. Jest ukończony po odpowiedzi serwera, read-backu reprezentującym nowy stan, komunikacie zrozumiałym bez koloru i możliwości dalszego działania. Każdy krytyczny flow ma test happy path oraz co najmniej 403, 409, 422, timeout, offline/reconnect i double-submit.

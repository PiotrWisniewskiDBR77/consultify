---
document_id: RUN-AGENT-IA-UX-STANDARD
module: My Work / Run Agent
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Run Agent — architektura informacji, nawigacja i UX

## 1. Główne powierzchnie

### 1.1 My processes

Lista definicji agentów, nie runów. Kolumny podstawowe:

- nazwa i purpose;
- lifecycle definition: draft, in review, published, deprecated;
- scope/owner;
- published version;
- aktywne runy i wymagane approvals;
- trigger/schedule;
- last run outcome i czas;
- health indicator.

`Progress 0/6` dotyczy konkretnego runu i nie powinien być główną cechą
definicji. Jeśli agent ma wiele runów, lista pokazuje aktywne runy albo ostatni
run; klik prowadzi najpierw do overview definicji z oddzielnymi tabs `Runs`.

### 1.2 Templates

Katalog procesów: Consultify official, organization, team/project, personal i
marketplace w przyszłości. Karta ma outcome, dla kogo, wymagane inputs,
deliverables, moduły/tools, czas, koszt class, approvals, owner, version,
rating/usage i status weryfikacji. `Use template` tworzy draft definition i
prowadzi przez binding projektów, wiedzy, ludzi oraz connectorów.

### 1.3 Runs

Globalna lub wewnętrzna lista wykonań: status, agent/version, trigger, scope,
started by, start/end/duration, current step, waiting reason, output quality,
cost i error. Saved views: Active, Waiting for me, Failed, Scheduled, Completed,
Needs review. Definicje i runy nie mogą pozostać wymieszane w jednej tabeli.

### 1.4 Approvals

Osobista i projektowa kolejka zgód. Approval card odpowiada:

- co agent chce zrobić;
- dlaczego i na podstawie jakich danych;
- jaki dokładnie payload/diff zostanie zapisany;
- do jakiego systemu i w czyim imieniu;
- wpływ, odwracalność, ryzyko i expiry;
- co stanie się po approve/reject/request changes.

### 1.5 Connections i health

Nie służy do zarządzania OAuth od zera — odsyła do wspólnego control plane.
Pokazuje bindings użyte przez daną definicję, missing/reauth, test capability,
rate limit i ostatnie poprawne użycie.

## 2. Builder — układ ekranu

Desktop zachowuje trzy logiczne obszary, ale z adaptacyjną szerokością:

1. lewy panel `Process`: overview, input contract, triggers, run controls,
   versions, tests, approvals policy i settings;
2. środkowy canvas: fazy/graf oraz aktualny run overlay;
3. prawy panel: palette albo inspector wybranego bloku; Teresa może być osobnym
   tabem/panelem, nie czwartą stałą kolumną.

Na 13–14" panel lewy i prawy są collapsible. Canvas ma fit, zoom, minimap,
search step, outline i breadcrumbs podprocesu. Nie wymuszamy długiego pionowego
scrolla jako jedynej nawigacji.

## 3. Dwa tryby edycji jednego modelu

### Conversational builder

Użytkownik mówi: „Zbuduj proces diagnozy gotowości firmy do wdrożenia AI,
uwzględnij DRD, finanse i prezentację dla zarządu”. Teresa:

1. podsumowuje cel, odbiorców, zakres, wejścia i oczekiwane deliverables;
2. wskazuje brakujące decyzje tylko, jeśli zmieniają projekt procesu;
3. generuje draft grafu z uzasadnieniem faz;
4. oznacza missing bindings i ryzyka;
5. pokazuje diff na canvasie;
6. pozwala poprawiać rozmową: dodaj approval, równolegle, usuń web itp.

### Manual builder

Użytkownik dodaje, łączy i konfiguruje bloki. Każda manualna zmiana aktualizuje
opis Teresy. Rozmowa nigdy nie edytuje opublikowanej wersji — tworzy draft nowej.

## 4. Canvas interaction

- drag palette → canvas, insert między edge, connect handles;
- multi-select, move, duplicate, delete, group as phase/sub-process;
- undo/redo, copy/paste, keyboard shortcuts i auto-layout;
- branch labels i warunki widoczne na krawędziach;
- collapsed phase pokazuje wejścia, output, status i liczbę kroków;
- validation badges prowadzą do konkretnego pola;
- run overlay koloruje pending/running/waiting/success/failed/skipped;
- klik kroku w run otwiera input/output/log/citations/approval, z maskingiem;
- structural diff porównuje wersje: added/removed/moved/config changed.

Status nie opiera się tylko na kolorze. Strzałki nie mogą krzyżować treści bez
czytelnego routingu. Auto-layout nie zmienia semantyki ani zapisanej kolejności.

## 5. Inspector bloku

Sekcje:

1. Identity: label, description, capability/tool, owner;
2. Inputs: schema, source/mapping, required/default;
3. Instructions: prompt/rules, output schema, model profile;
4. Knowledge: source picker, exact/latest binding, citations;
5. Permissions: connection, scopes, execute-as;
6. Control: timeout, retry, error path, idempotency;
7. Approval: gate policy, approver role, expiry;
8. Test: sample input, run step, assertions i last evidence.

Prosty tryb pokazuje pola biznesowe; `Advanced` pokazuje expression, JSON schema,
headers, model i technical policy. Secret value nigdy nie jest wyświetlany.

## 6. Tworzenie nowego agenta

`New agent` otwiera wybór:

- Describe with Teresa — rekomendowany;
- Start from template;
- Start blank;
- Import definition (po walidacji i trust review).

Wizard zbiera: outcome, scope/project, consumers, inputs, deliverables, deadline,
autonomy, approvals i sensitivity. Następnie Teresa buduje draft. Nie pytamy o
każdy techniczny detal przed pokazaniem wartościowego pierwszego modelu.

## 7. Test mode

Test działa na unpublished draft, w sandbox/dry-run. Użytkownik może:

- podać sample inputs lub użyć redacted fixture;
- uruchomić step, branch, sub-process lub cały agent;
- mockować external write;
- pinować output testowy kolejnego kroku;
- ustawić assertions dla schema, citation, wartości i branch;
- porównać wynik z poprzednią wersją;
- zobaczyć przewidywany side effect, czas i koszt.

Publish jest blokowane, gdy brak required bindings, schema, owner, error policy,
approval dla high impact lub krytyczne testy nie przeszły.

## 8. Run experience

Run overview pokazuje business outcome, status, timeline, current/wait reason,
inputs manifest, outputs, decisions/approvals, cost/time i warnings. Default nie
zalewa użytkownika logami. Technical details są rozwijane per step.

Akcje zależne od stanu: pause, resume, cancel, retry failed, provide input,
approve/reject, rerun from checkpoint, create issue/task, download run report.
Rerun pokazuje, które wcześniejsze outputs zostaną użyte i które side effects
mogły już wystąpić.

## 9. Mobile i accessibility

Mobile: lista, run monitoring, approval, provide input, pause/cancel i outputs.
Pełna edycja grafu może być desktop-only w MVP, ale wersja mobilna musi pozwalać
przejrzeć strukturę. Canvas ma keyboard navigation, outline/tree alternative,
focus management, screen-reader labels i non-color status.

## 10. Pytania do odbioru

1. Czy `Runs` jest osobną zakładką Menu 2 od MVP?
2. Czy Teresa jest stałym prawym panelem, czy tabem inspektora otwieranym na żądanie?
3. Czy MVP canvas ma prawdziwe połączenia DAG, czy fazy z rozwijanym wnętrzem?
4. Czy użytkownik może importować/exportować definicję jako JSON/YAML?
5. Czy test mode może używać danych produkcyjnych projektu w trybie read-only?

---
doc_id: initiatives-execution-functions-canon
truth_type: target_product_canon
status: canonical
owner: product-owner
business_owner: piotr
version: 1.0
last_reviewed: 2026-08-09
applies_to:
  - MODULE_INITIATIVES
  - MODULE_EXECUTION
supersedes_in_scope:
  - legacy Initiatives Menu 2 surface definitions
  - legacy Execution Dashboard/Summary/Rollout/Management surface split
  - flat use of runtime Initiative status as business UI vocabulary
runtime_status: not_implemented
---

# Initiatives + Execution — kanon funkcji, procesu i powierzchni

> **Implementation package:** [`initiatives-execution-canon/00_INDEX_AND_AUTHORITY.md`](initiatives-execution-canon/00_INDEX_AND_AUTHORITY.md) expands this owner-level decision into process, governance, UI/UX, surface descriptors, domain/data/API/events, migration, implementation sequence, acceptance and owner-decision contracts. Implementers must read the package in its indexed order.

> **Initiative workspace depth:** [`initiatives-execution-canon/11_INITIATIVE_CARD_SYSTEM.md`](initiatives-execution-canon/11_INITIATIVE_CARD_SYSTEM.md) defines the 26 business cards, shell, lifecycle profiles and change mechanics. [`initiatives-execution-canon/12_TASK_DECISION_MY_WORK_INTEGRATION.md`](initiatives-execution-canon/12_TASK_DECISION_MY_WORK_INTEGRATION.md) defines the single-truth Task/Decision/My Work/Execution integration. These are mandatory parts of this canon, not optional supporting notes.

## 1. Cel i zakres decyzji

Ten dokument definiuje docelowy standard dla dwóch kolejnych kroków programu konsultingowego:

1. `Initiatives` — wybór **co**, **dlaczego**, **w jakim zakresie**, **w jakiej kolejności** i **czy organizacja prawdopodobnie to udźwignie**.
2. `Execution` — sterowanie **jak** zatwierdzone inicjatywy są wykonywane przy ograniczeniach ludzi, czasu i pieniędzy oraz czy dostarczają zakres i oczekiwany efekt.

Dokument zamraża w tym zakresie:

- Menu 2 obu modułów;
- odpowiedzialność każdej funkcji;
- wspólny wzorzec `Register -> Preview -> Workbench -> Full Workspace`;
- docelowy business lifecycle Initiative;
- rozdzielenie lifecycle, gate, readiness, disposition, health i effectiveness;
- granice własności między Initiatives, Execution, My Work, Finance i Results;
- minimalny kontrakt stanów, akcji, uprawnień, źródeł i odbioru.

Dokument nie stwierdza, że runtime jest już zgodny. Obecny kod, API i baza wymagają osobnej mapy migracyjnej oraz dowodu runtime/realDB.

## 2. Miejsce w czterostopniowym procesie konsultingowym

| Krok | Moduł/grupa modułów | Odpowiedź biznesowa | Główny output |
| --- | --- | --- | --- |
| 1. Ocena stanu obecnego | Interview | Jak jest? | evidence-backed As-Is |
| 2. Projekt stanu docelowego | Assessment, Consulting Tools, Audits | Jak powinno być? | To-Be, gap, rekomendacje i ograniczenia |
| 3. Projekt drogi | Initiatives | Co wybieramy, jaki zakres, kolejność i wykonalność? | zatwierdzony i zaplanowany portfel Initiative |
| 4. Realizacja drogi | Execution | Jak dowozimy zmianę i reagujemy na odchylenia? | dostarczony zakres, handoff efektów i audytowalna realizacja |

`Finance` i `Results` są przekrojowymi właścicielami prawdy finansowej oraz KPI/benefits. Nie są lokalnymi rejestrami Initiatives ani Execution.

## 3. Zamrożone Menu 2

### 3.1 Initiatives

`Inicjatywy -> Portfel -> Plan -> Obciążenie`

### 3.2 Execution

`Realizacje -> Praca -> Zasoby -> Sterowanie -> Raporty`

### 3.3 Funkcje, które nie są Menu 2

- lifecycle, analiza i approval jednej Initiative — żyją w jej karcie;
- Decisions jednej Initiative — żyją w karcie i kanonicznym Decision Case;
- Candidates przed rejestracją — żyją w module źródłowym/source-validation flow;
- Dashboard, Summary i Portfolio Health — są projekcjami/lensami, nie funkcjami;
- Rollout — jest profilem/sekcją Execution Case;
- Goals i outcome actuals — należą do Results;
- table, kanban, timeline, heatmap — są widokami lub narzędziami funkcji, nie funkcjami samymi w sobie.

## 4. Wspólny shell każdej funkcji

### 4.1 Zasada table-first

Każda funkcja rozpoczyna się od kanonicznego rejestru tabelowego. Tabela odpowiada na pytania:

- na jakim zbiorze pracuję;
- który rekord wymaga uwagi;
- dlaczego wymaga uwagi;
- kto ma następne działanie;
- jaki jest aktualny stan danych;
- gdzie otworzyć pełny kontekst.

Nie każda tabela zawiera Initiative:

| Funkcja | Rekord główny tabeli |
| --- | --- |
| Inicjatywy | Registered Initiative |
| Portfel | Initiative w wybranym Portfolio Scenario |
| Plan | Planned Initiative Window w Plan Scenario |
| Obciążenie | Capacity Constraint / Demand Envelope |
| Realizacje | Execution Case powiązany z Initiative |
| Praca | Task lub Decision jako typed Work Item projection |
| Zasoby | Allocation / Resource Constraint |
| Sterowanie | Management Signal / Intervention Case |
| Raporty | Report Definition albo Report Run |

### 4.2 Dwa dozwolone tryby powierzchni

#### Register mode — domyślny

- Menu 1, Menu 2 i Menu 3 zgodne z TRIADA;
- pełna tabela zajmuje główną powierzchnię;
- pojedynczy klik wybiera wiersz i otwiera prawy preview;
- preview nie zmienia route, filtrów ani pozycji scrolla;
- podwójny klik, `Enter` albo `Open` otwiera pełną kartę/workspace;
- zmiana Table/Kanban/Timeline zachowuje scope, filtry i wybór.

#### Workbench mode — po jawnej akcji użytkownika

- nie otwiera się automatycznie po pojedynczym kliknięciu;
- u góry pozostaje kompaktowy context register: breadcrumb zbioru, wybrane rekordy/scenariusz, filtry i powrót;
- pod nim otwiera się jedno właściwe narzędzie domenowe;
- prawy preview jest zamknięty, aby nie tworzyć trzech konkurencyjnych paneli;
- Workbench zapisuje własny draft/scenario, ale nie nadpisuje opublikowanej prawdy bez gate'u;
- powrót przywraca tabelę, selection, filtry, sort i scroll.

### 4.3 Archetypy Workbench

| Funkcja | Workbench |
| --- | --- |
| Inicjatywy | pełna Initiative Card / N-mode |
| Portfel | compare + scenario composition + coverage |
| Plan | timeline/waves/dependency sequencing |
| Obciążenie | capacity heatmap + assumptions + scenario compare |
| Realizacje | Execution Case / N-mode |
| Praca | Task albo Decision workspace |
| Zasoby | allocation board + capacity calendar + impact preview |
| Sterowanie | exception drill-down + intervention composer |
| Raporty | Report Run document + source rail |

### 4.4 Stała anatomia ekranu

1. Menu 1 — globalny kontekst.
2. Menu 2 — funkcje modułu w zamrożonej kolejności.
3. Menu 3 — scope/presety z licznikami; przy selection zamienia się w bulk; przy otwarciu może pokazać trwałe taby.
4. Local toolbar — wyłącznie kontrolki bieżącej tabeli lub Workbench.
5. Content surface — tabela albo jeden Workbench.
6. Preview — wyłącznie w Register mode.

### 4.5 Zasady tabeli

Każda tabela musi zapewnić:

- sticky header, sort, filter i settings;
- resize, kolejność i widoczność kolumn;
- checkbox tylko wtedy, gdy istnieją bezpieczne bulk actions;
- tytuł, opcjonalny opis, status tekstowy, next action i kebab;
- `—` dla prawdziwie pustej wartości;
- `Unknown`, `Not evaluated`, `Partial` i `Stale` zamiast zera lub zielonego defaultu;
- liczby z jednostką, okresem, mianownikiem i źródłem;
- status niekomunikowany wyłącznie kolorem;
- akcje wiersza generowane przez capability/authority, nie lokalne zgadywanie UI.

### 4.6 Zasady preview

Preview używa sześciu bloków TRIADY:

1. Header: Pin, Open, Close.
2. Meta: status, gate/health, owner, termin/as-of.
3. Details: dlaczego rekord istnieje i wymaga uwagi.
4. AI: propozycje jawnie oddzielone od system truth.
5. Relations: source, Initiative, Execution, Task, Decision, Finance, Results.
6. Actions: tylko realne, niedublowane i capability-driven.

### 4.7 Stany obowiązkowe

Każda funkcja projektuje i testuje osobno:

- first-use empty;
- filtered empty;
- loading;
- partial data;
- stale data;
- unknown/not evaluated;
- conflicting sources;
- permission-restricted;
- write in progress;
- write failed;
- read-back pending;
- offline/degraded dependency;
- success potwierdzony przez backend.

## 5. Business lifecycle Initiative

### 5.1 Statusy przed rejestracją — poza Initiatives

`PROPOSAL_DRAFT -> PROPOSAL_IN_VALIDATION`

Decyzje source-validation: `REGISTER`, `MERGE`, `EXTEND`, `RETURN`, `DEFER`, `DISMISS`.

### 5.2 Dwanaście głównych stanów zarejestrowanej Initiative

```text
REGISTERED_DRAFT
-> DEFINED
-> ANALYZING
-> READY_FOR_DECISION
-> APPROVED_BACKLOG
-> SCHEDULED
-> IN_EXECUTION
-> DELIVERED
-> BENEFITS_TRACKING
-> EFFECTIVENESS_REVIEWED
-> CLOSED
-> ARCHIVED
```

| Status | Znaczenie biznesowe | Główna bramka wyjścia |
| --- | --- | --- |
| `REGISTERED_DRAFT` | Initiative została zarejestrowana i ma lineage do źródła. | minimal brief, project, Initiative Owner |
| `DEFINED` | Problem, outcome, scope, opcje i success criteria są uzgodnione. | Definition Gate |
| `ANALYZING` | Trwa analiza wartości, wykonalności, ryzyka, Finance, KPI, change i dependencies. | wymagany profil analiz bez nierozstrzygniętych blockerów |
| `READY_FOR_DECISION` | Wersjonowany evidence snapshot jest gotowy dla decydenta. | Portfolio Decision |
| `APPROVED_BACKLOG` | Jest mandat merytoryczny, lecz brak zobowiązania czasowego. | Schedule + Capacity Commitment |
| `SCHEDULED` | Zatwierdzono okno, role, capacity, baseline i handoff. | Execution acceptance/read-back |
| `IN_EXECUTION` | Trwa realizacja w Execution. | Delivery Acceptance albo Stop Decision |
| `DELIVERED` | Zakres został przyjęty, ale efekt biznesowy nie jest jeszcze potwierdzony. | Benefits Handoff |
| `BENEFITS_TRACKING` | Results mierzy KPI, adopcję i korzyści. | Effectiveness Review |
| `EFFECTIVENESS_REVIEWED` | Formalnie oceniono osiągnięcie efektu. | Closure Decision |
| `CLOSED` | Lifecycle został formalnie zamknięty, lineage pozostaje dostępny. | Archive policy |
| `ARCHIVED` | Historyczny rekord read-only. | brak zwykłego wyjścia |

### 5.3 Niezależne wymiary

| Wymiar | Przykładowe wartości | Odpowiada na pytanie |
| --- | --- | --- |
| `lifecycle_status` | statusy z 5.2 | Gdzie Initiative jest w drodze? |
| `gate_state` | `NOT_REQUESTED`, `PREPARING`, `PENDING_DECISION`, `APPROVED`, `RETURNED`, `SUPERSEDED` | Jaka decyzja trwa? |
| `gate_readiness` | `NOT_EVALUATED`, `NOT_READY`, `CONDITIONALLY_READY`, `READY`, `BLOCKED` | Czy można poprosić o decyzję? |
| `disposition` | `ACTIVE`, `DEFERRED`, `REJECTED`, `MERGED`, `STOPPED`, `CANCELLED` | Czy i dlaczego normalna ścieżka została przerwana? |
| `execution_health` | `NOT_APPLICABLE`, `UNKNOWN`, `ON_TRACK`, `AT_RISK`, `CRITICAL` | Czy realizacja jest wiarygodna względem planu? |
| `effectiveness_result` | `NOT_MEASURED`, `CONFIRMED`, `PARTIAL`, `NOT_ACHIEVED` | Jaki efekt osiągnięto? |
| `save_state` | `SAVED`, `SAVING`, `SAVE_FAILED`, `CONFLICT` | Czy edycja została utrwalona? |

`BLOCKED` nie jest głównym etapem lifecycle. Initiative może być `IN_EXECUTION` z `execution_health=CRITICAL` i aktywnym blockerem. `DELIVERED` nie oznacza `effectiveness_result=CONFIRMED`.

### 5.4 Dyspozycje wyjątkowe

Każde `DEFERRED`, `REJECTED`, `MERGED`, `STOPPED` lub `CANCELLED` wymaga:

- Decision Case;
- decydenta i authority;
- daty;
- reason;
- evidence snapshot;
- wpływu na portfel, plan, zasoby, Finance i Results;
- target Initiative dla merge;
- review trigger dla defer;
- restart/replacement/archive policy dla stop.

### 5.5 Runtime migration

Obecne runtime statusy `DRAFT`, `PENDING_REVIEW`, `REVIEW`, `PROMOTED`, `PLANNING`, `APPROVED`, `SCHEDULED`, `EXECUTING`, `BLOCKED`, `DONE`, `TRACKING`, `CANCELLED`, `ARCHIVED` pozostają techniczną prawdą AS-IS do czasu migracji.

Nowe UI nie może mieszać starego i nowego słownika. Rekord bez jednoznacznego mapowania pokazuje `MIGRATION_REVIEW_REQUIRED`; system nie zgaduje `REVIEW -> DEFINED/READY_FOR_DECISION`, `PLANNING -> ANALYZING/READY_FOR_DECISION` ani `CANCELLED -> REJECTED/STOPPED/CANCELLED`.

## 6. Initiatives — funkcja 1: Inicjatywy

### 6.1 Cel

Odnaleźć konkretną Initiative, zrozumieć jej business status, gate, readiness i next action oraz doprowadzić jej kartę do następnej właściwej decyzji.

### 6.2 Wejścia

- zarejestrowany Proposal z source envelope;
- return z gate/review;
- Suggested Change;
- read-back z Execution, Finance albo Results;
- uprawnienia i governance profile.

### 6.3 Tabela

Kolumny domyślne:

1. Initiative — nazwa + problem/outcome summary.
2. Lifecycle status.
3. Next gate + gate state.
4. Readiness.
5. Owner / accountable next actor.
6. Next action.
7. Expected impact + confidence.
8. Planned window.
9. Health — tylko gdy dotyczy; wcześniej `N/A`.
10. Updated/as-of.
11. Kebab.

Menu 3: `All`, status bands, `Needs my action`, `Needs evidence`, `Waiting decision`, `Approved backlog`, `Scheduled`, `Historical`.

### 6.4 Preview

Pokazuje problem, expected outcome, źródło, status, gate, readiness, brakujące elementy, ownera, next action, Finance/Results refs i relacje.

### 6.5 Workbench/karta

Pełna Initiative Card zawiera:

- Source & lineage;
- Problem & outcome;
- Scope & exclusions;
- Options, w tym do nothing;
- Evidence & counter-evidence;
- Feasibility;
- Finance reference;
- KPI/Results contract;
- Risks, dependencies i change;
- Roles/RACI;
- Gates, decisions i immutable history;
- Schedule/handoff/read-back;
- closure i lessons learned.

This list is only an owner-level summary. The binding implementation contract is the 26-card catalog, applicability/state model and lifecycle profiles in `11_INITIATIVE_CARD_SYSTEM.md`; Task and Decision mechanics are binding from `12_TASK_DECISION_MY_WORK_INTEGRATION.md`.

### 6.6 Mechanika procesu

1. Source Validator rejestruje rekord.
2. Initiative Owner kompletuje definition.
3. Domain owners dostarczają analizy przez canonical Tasks/Decisions.
4. Teresa może wskazać braki i przygotować proposal, ale nie zatwierdza.
5. Readiness service ocenia warunki gate'u.
6. Uprawniony użytkownik składa Request Decision.
7. Decydent ogląda immutable snapshot i wybiera approve/return/defer/reject/merge.
8. Backend zapisuje Decision, status i read-back atomowo albo zwraca honest failure.

### 6.7 Output i granice

Output: wersjonowana Initiative gotowa do porównania, planowania, schedule lub handoffu.

Funkcja nie podejmuje trade-offów całego portfela, nie bilansuje capacity i nie zarządza wykonaniem.

## 7. Initiatives — funkcja 2: Portfel

### 7.1 Cel

Wybrać najlepszy łączny zestaw Initiative oraz uzasadnić, co jest included, conditional, deferred i excluded.

### 7.2 Primary objects

- Portfolio Scenario;
- Initiative Set Membership;
- Portfolio Decision Case;
- scoring/ranking model version;
- Coverage Segment.

### 7.3 Tabela

Wiersz: Initiative w aktywnym scenariuszu.

Kolumny: include state, rank, strategic fit, expected outcome/value, cost envelope, risk, readiness, confidence, coverage contribution, overlap/synergy, rough demand, decision state, owner.

Menu 3: `Current scenario`, `Unassigned`, `Included`, `Conditional`, `Deferred`, `Excluded`, `Mandatory`, `Low confidence`, `Coverage gaps`, `Duplicates`.

### 7.4 Workbench layout

Góra: kompaktowa tabela wybranych Initiative i scenario selector.

Dół:

- lewa 2/3: compare matrix albo coverage matrix;
- prawa 1/3: scenario summary, assumptions, constraints, mix, value/cost/risk ranges;
- dolny action rail: Save draft, Compare, Request inputs, Submit portfolio decision, Publish.

### 7.5 Mechanika

1. Utwórz wersjonowany scenario z jawnego scope i model version.
2. Dodaj/usuń Initiative bez zmiany ich lifecycle.
3. Porównaj value, cost, risk, time-to-value i confidence.
4. Wykryj luki, duplikaty, overlap, contradiction, synergy i double counting.
5. Ustal rank; score nie ustala automatycznie rankingu.
6. Manual override wymaga reason.
7. Porównaj scenario diff.
8. Portfolio Decision zatwierdza zbiór i tworzy `APPROVED_BACKLOG` tylko dla odpowiednich Initiative.

### 7.6 Output i granice

Output: wersjonowany Portfolio Decision i Approved Backlog.

Portfel nie układa szczegółowego czasu, nie potwierdza dostępności ludzi i nie posiada Finance/KPI actuals.

## 8. Initiatives — funkcja 3: Plan

### 8.1 Cel

Ułożyć wybrany portfel w logiczną kolejność, fale i realistyczne okna czasowe bez udawania szczegółowego planu Execution.

### 8.2 Primary objects

- Portfolio Plan Scenario;
- Planned Initiative Window;
- Dependency/Constraint;
- Schedule Decision Case.

### 8.3 Tabela

Kolumny: Initiative, backlog state, proposed window, earliest/latest, dependency readiness, mandatory deadline, cost of delay, rough demand, capacity state, schedule confidence, conflict, next action.

Menu 3: `Unscheduled`, `Now`, `Next`, `Later`, `Conflicted`, `Missing dependencies`, `Needs capacity`, `Ready for schedule`, `Published`.

### 8.4 Workbench layout

Góra: kompaktowa tabela scope scenariusza.

Dół:

- główna oś: timeline/Now-Next-Later/waves;
- opcjonalna warstwa: dependency graph lub constraint table;
- prawy panel: selected window, assumptions, conflicts, impact diff;
- dolna belka: Draft move, Compare, Send to Capacity, Request Schedule Decision, Publish.

### 8.5 Mechanika

1. Skopiuj wybrany Portfolio Scenario do draft Plan Scenario.
2. Ustal prerequisites, mutual exclusions i mandatory windows.
3. Nadaj tentative ranges, nie fałszywie dokładne daty.
4. Sekwencjonuj według logiki, value, cost of delay i constraints.
5. Każda zmiana tworzy scenario diff.
6. Przekaż ten sam scenario ID do Obciążenia.
7. Konflikt wraca z propozycjami move/split/reduce/defer.
8. Schedule Gate zatwierdza window, capacity commitment, role i handoff.
9. Dopiero zatwierdzenie zmienia lifecycle na `SCHEDULED`.

### 8.6 Output i granice

Output: published Plan Scenario i Schedule Decision.

Plan nie posiada tasków, actual schedule ani automatycznego baseline write przez drag-and-drop.

## 9. Initiatives — funkcja 4: Obciążenie

### 9.1 Cel

Ocenić, czy organizacja prawdopodobnie uniesie Plan Scenario, przy jakich założeniach i jakiej korekcie.

### 9.2 Primary objects

- Estimated Capacity Scenario;
- Demand Envelope;
- Supply Envelope;
- Capacity Constraint;
- tentative/confirmed Commitment.

### 9.3 Tabela

Wiersz: constraint albo role/team/time bucket.

Kolumny: period, role/team/skill, demand low/base/high, supply known/estimated, gap range, confidence, affected Initiative count, criticality, assumption freshness, owner, proposed response.

Menu 3: `All constraints`, `Critical`, `Unknown supply`, `Missing demand`, `Skill gaps`, `Management load`, `Budget envelope`, `Unconfirmed`, `Resolved in scenario`.

### 9.4 Workbench layout

Góra: constraint register.

Dół:

- heatmap role/team x period;
- scenario ranges i confidence overlay;
- affected Initiative list;
- assumptions/evidence rail;
- intervention simulator: move, split, reduce, add, outsource, defer, stop;
- impact: time, cost, risk, coverage i expected outcome.

### 9.5 Mechanika

1. Pobierz demand z tego samego Plan Scenario.
2. Oznacz każdy input jako known/estimated/unknown/unconfirmed.
3. Porównaj demand i supply w tym samym okresie i jednostce.
4. Niepełne dane nie stają się zerem.
5. Zidentyfikuj critical shared constraints i change saturation.
6. Zbuduj bounded alternatives i impact diff.
7. Resource/functional owner potwierdza albo odrzuca tentative commitment.
8. Wynik wraca do Plan Scenario; nie powstaje druga roadmapa.

### 9.6 Output i granice

Output: Capacity Assessment i warunki Schedule Gate.

Obciążenie nie posiada actual assignments, timesheets ani utilization Execution.

## 10. Execution — funkcja 1: Realizacje

### 10.1 Cel

Pokazać wszystkie Execution Cases, ich wiarygodny stan i właściwy punkt wejścia do szczegółów realizacji.

### 10.2 Primary object i wejście

Execution Case powstaje wyłącznie przez accepted/read-back handoff z `SCHEDULED` Initiative i zachowuje ten sam `initiativeId` lub jawny immutable link identity.

### 10.3 Tabela

Kolumny: Initiative/Execution Case, lifecycle, execution phase, owner, delivery profile, progress + confidence, baseline finish, forecast finish, variance, budget/forecast, health, blockers, pending decisions, resource constraint, next action, updated.

Menu 3: `Active`, `At risk`, `Critical`, `Blocked work`, `Missing baseline`, `Missing forecast`, `Closing`, `Recently delivered`, `Unknown data`.

Widoki: Table, Kanban i Timeline tego samego datasetu.

### 10.4 Preview i karta

Preview pokazuje execution brief, baseline/current/forecast, top exception, next action, work/resource rollups i effect follow-through.

Execution Case zawiera Plan, Work Packages, Tasks, Milestones, RAID, Decisions, Resources, Budget projection, Change, Rollout, Adoption, Closure i handoffy.

### 10.5 Mechanika

1. Execution Manager akceptuje albo zwraca handoff.
2. System tworzy idempotentny Execution Case i read-back.
3. Rollupy pochodzą z kanonicznych Tasks/Decisions/Risks/Finance/Results.
4. Status, phase, progress, health i confidence są osobnymi polami/projekcjami.
5. Klik w exception prowadzi do dokładnego źródła albo Sterowania.
6. Pause, stop, close i rebaseline wymagają właściwego Decision Case.

### 10.6 Output i granice

Output: jedna operacyjna lista aktywnego wykonania.

Realizacje nie są dashboardem, nie tworzą lokalnych kopii pracy i nie zatwierdzają nowych Initiative.

## 11. Execution — funkcja 2: Praca

### 11.1 Cel

Zapewnić przepływ wszystkich Task i Decision potrzebnych do wykonania aktywnych Initiative.

### 11.2 Tabela

Wiersz jest typed projection: `TASK` albo `DECISION`; identity i lifecycle encji pozostają kanoniczne.

Kolumny: type, item, Initiative/work package, status, owner/decision maker, due/SLA, blocked-by, priority/criticality, evidence/DoD, age, next action.

Menu 3: `All`, `Tasks`, `Decisions`, `Blocked`, `Overdue`, `Due soon`, `Missing owner`, `Missing DoD/evidence`, `Waiting dependency`, `Mine`, `By team`.

### 11.3 Preview/workspace

Preview i Open są type-aware. Task otwiera Task Workspace; Decision otwiera Decision Case z evidence snapshot, options, authority, rationale i follow-up.

### 11.4 Mechanika

1. Triage i priorytetyzacja według urgency, impact, dependency i SLA.
2. Assign/reassign tylko przez właściwe capability.
3. Task przechodzi przez własny lifecycle i DoD.
4. Decision przechodzi przez prepare/request/review/decide/follow-up.
5. Blocker wskazuje exact blocked-by i blast radius.
6. Bulk actions są dozwolone tylko dla jednorodnych, bezpiecznych operacji.
7. Każdy write wymaga read-back; partial failure pozostaje jawne.
8. My Work pokazuje osobistą projekcję tych samych rekordów.

### 11.5 Output i granice

Output: wykonana praca, audytowalne decyzje i jawne blockers.

Praca nie posiada supply/capacity, nie duplikuje My Work i nie spłaszcza Task oraz Decision do jednego generic lifecycle.

## 12. Execution — funkcja 3: Zasoby

### 12.1 Cel

Przydzielać i bilansować realnych ludzi, kompetencje, czas oraz koszt w aktywnym wykonaniu.

### 12.2 Warunek istnienia funkcji

Pełna funkcja jest dopuszczona dopiero, gdy istnieją kanoniczne obiekty Availability, Assignment, Acceptance, Calendar, Skill i Remaining Estimate. Do tego czasu UI pokazuje `PARTIAL/EVIDENCE_MISSING` i nie udaje kompletnego resource management.

### 12.3 Tabela

Wiersz: Allocation albo Resource Constraint.

Kolumny: person/team/role, period, committed availability, allocated demand, remaining demand, load range, skills match, affected work, cost/forecast, acceptance, conflict, freshness, next action.

Menu 3: `All`, `Overallocated`, `Unassigned work`, `Skill gaps`, `Unconfirmed assignments`, `Availability unknown`, `Cost risk`, `Needs decision`, `By team`, `By Initiative`.

### 12.4 Workbench layout

Góra: allocations/constraints table.

Dół:

- People/Teams capacity calendar;
- workload horizon day/week/month;
- skills/gaps;
- Money projection z Finance source;
- selected constraint blast radius;
- intervention composer i before/after impact.

### 12.5 Mechanika

1. Demand pochodzi z Tasks/Work Packages z remaining estimate.
2. Supply pochodzi z accepted availability w tym samym horyzoncie.
3. Użytkownik symuluje reassign/smooth/replan/backfill/outsource.
4. System pokazuje wpływ na datę, koszt, ryzyko i inne Initiative.
5. Uprawniony owner zatwierdza assignment/resource request.
6. Write trafia do kanonicznego źródła i wraca przez read-back.
7. Materialny konflikt tworzy Decision/Intervention Case.

### 12.6 Output i granice

Output: real allocation plan, confirmed assignments i capacity forecast.

Zasoby nie wybierają priorytetu Initiative; Finance pozostaje właścicielem ledger/actual cost, a Execution konsumuje projekcję.

## 13. Execution — funkcja 4: Sterowanie

### 13.1 Cel

Wykryć utratę wiarygodności delivery, zrozumieć przyczynę, zatwierdzić ograniczoną interwencję i zweryfikować jej efekt.

### 13.2 Tabela

Wiersz: deduplikowany Management Signal albo Intervention Case.

Kolumny: severity, urgency, confidence, signal/problem, affected Initiative, source, owner, age/SLA, blast radius, proposed intervention, approval state, verification due, outcome.

Menu 3: `Needs action`, `Critical`, `Decisions`, `Schedule`, `Resources`, `Cost`, `Risk`, `Dependencies`, `Adoption`, `Outcome risk`, `Verification overdue`, `Resolved`.

### 13.3 Workbench layout

Góra: exception queue.

Dół w kolejności narracyjnej:

1. What happened — source signal i as-of.
2. Why — evidence, counter-evidence i root-cause hypothesis.
3. Impact — time/cost/scope/capacity/risk/outcome.
4. Options — bounded alternatives i do-nothing.
5. Decision — authority, approver, conditions i audit.
6. Action/read-back — canonical write status.
7. Verification — wynik po określonym czasie.

### 13.4 Mechanika

`detect -> deduplicate -> prioritize -> investigate -> forecast -> propose -> approve -> act -> read-back -> verify`

AI może wykrywać, grupować, wyjaśniać i przygotowywać propozycje. Nie może samodzielnie reassignować ludzi, zmieniać baseline, scope, budget, ownera, risk acceptance ani zamykać Initiative.

### 13.5 Output i granice

Output: Intervention Case z decyzją, wykonanym write, read-backiem i effectiveness result.

Sterowanie nie jest dashboardem ani właścicielem Tasks, Assignments, Finance czy Results.

## 14. Execution — funkcja 5: Raporty

### 14.1 Cel

Tworzyć audytowalny obraz wykonania dla określonego odbiorcy, okresu i decyzji oraz uruchamiać follow-up.

### 14.2 Primary objects

- Report Definition;
- Report Run;
- frozen source snapshot;
- distribution/publication record;
- follow-up Task/Decision.

### 14.3 Tabela

Domyślnie katalog definicji; przełącznik `Definitions / Runs` zachowuje scope.

Kolumny: report, audience, cadence, scope, period/as-of, last run, freshness, completeness/confidence, approval/publication state, owner, required action, next run.

Menu 3: `All`, `Weekly`, `Monthly`, `On demand`, `Sponsor`, `Needs generation`, `Needs review`, `Partial/stale`, `Published`, `Failed`, `Recent runs`.

### 14.4 Workbench layout

Góra: compact report register i run selector.

Dół:

- lewa/centrum: pełny dokument Report Run;
- prawa: source rail z freshness, completeness, confidence i drill-through;
- dolny action rail: Refresh draft, Validate, Freeze, Approve, Export, Share, Create follow-up.

### 14.5 Mechanika

1. Wybierz Definition, audience, scope, period i as-of.
2. System pobiera wersjonowane źródła.
3. Brak/stale/partial nie jest ukrywany.
4. Generator tworzy draft Report Run.
5. Reviewer przechodzi data-quality gate i drill-through.
6. Freeze tworzy immutable snapshot.
7. Approver zatwierdza publikację.
8. Share/export zapisuje distribution evidence.
9. Finding tworzy canonical Task/Decision/Intervention, nie tekstową kopię.

### 14.6 Output i granice

Output: trwały Report Run i follow-up.

Raporty nie są generic BI builderem, nie edytują Execution truth i nie zastępują Sterowania.

## 15. Granice danych i własności

| Obszar | Właściciel prawdy | Projekcja w tych modułach |
| --- | --- | --- |
| Initiative identity/lifecycle/gates | Initiatives | Execution read-back |
| Task | canonical Task runtime | Praca, My Work, rollupy |
| Decision | canonical Decision runtime | karta, Praca, Sterowanie, Raport follow-up |
| Finance ledger/actuals/ROI | Finance | references, envelopes, variance/forecast projections |
| KPI/benefits actuals | Results | target links, outcome risk, benefits follow-through |
| Availability/Assignment | Resource/Execution runtime | Zasoby i capacity projections |
| Personal queue | te same Tasks/Decisions | My Work projection |
| Report snapshot | Reports | drill-through do źródeł |

Zakazane są lokalne shadow registers statusu, KPI, risks, decisions, budgetu, benefits lub resource allocations.

## 16. Uprawnienia i decyzje

Każda materialna akcja musi mieć:

- capability zwrócone przez backend;
- accountable preparer;
- decision maker/approver;
- prerequisites/readiness;
- impact preview;
- explicit confirmation;
- audit event;
- idempotency key;
- read-back;
- failure/retry semantics;
- verification, jeśli akcja jest interwencją.

Teresa/AI:

- może analizować, wskazywać luki, generować drafty, scenariusze i rekomendacje;
- zawsze pokazuje scope, sources, assumptions i confidence;
- recommendation jest wizualnie odrębna od system truth;
- nie wykonuje materialnej decyzji bez jawnego człowieka i właściwego authority.

## 17. Responsywność i hierarchia wizualna

### Desktop szeroki

- Register: tabela + preview `clamp(340px, 28%, 480px)`;
- Workbench: compact context register nad narzędziem; bez preview;
- najważniejsze next action pozostaje above the fold;
- brak wielkich pustych dashboard cards.

### Desktop wąski/tablet

- preview jako overlay/drawer;
- Workbench zachowuje table context w collapsible header;
- złożone macierze/timeline mają poziomy scroll i jawny fit/zoom;
- żadne krytyczne pole nie jest dostępne wyłącznie na hover.

### Mobile

- rejestr przechodzi w listę compact rows/cards przy zachowaniu identity, statusu i next action;
- preview jest pełnoekranowy;
- Workbench o wysokiej gęstości może być read/triage-first, a materialna edycja wymaga wspieranego layoutu;
- akcje zachowują authority i confirmation.

## 18. Golden flows

1. Source Proposal -> validation -> `REGISTERED_DRAFT` z lineage bez duplikatu.
2. Definition -> analysis -> `READY_FOR_DECISION` z wersjonowanym snapshotem.
3. Portfolio scenario -> Portfolio Decision -> `APPROVED_BACKLOG`.
4. Plan <-> Capacity loop -> Schedule Decision -> `SCHEDULED`.
5. Scheduled handoff -> Execution acceptance/read-back -> `IN_EXECUTION`.
6. Task/Decision flow -> canonical write -> rollup w Realizacje i My Work.
7. Capacity conflict -> simulate -> approve -> allocation write -> read-back.
8. Management signal -> Intervention Case -> verification effectiveness.
9. Delivery Acceptance -> `DELIVERED` -> Results handoff -> `BENEFITS_TRACKING`.
10. Effectiveness Review -> result -> `CLOSED` -> policy archive.
11. Report Definition -> Report Run -> validation -> freeze -> publish -> follow-up.

## 19. Kryteria odbioru dokumentu w runtime

- dokładnie 4 funkcje Menu 2 Initiatives i 5 Execution;
- każda funkcja ma primary registry table zgodną z TRIADA;
- single click = preview, Open/double click = workspace;
- Workbench nie współistnieje jednocześnie z prawym preview;
- każda funkcja ma primary object, a nie tylko inny wykres;
- jeden Initiative identity i jeden lifecycle;
- business labels nie mieszają się ze starym enumem runtime;
- lifecycle, gate, readiness, disposition, health, effectiveness i save state są odrębne;
- `Approved backlog` nie znaczy `Scheduled`;
- `Delivered` nie znaczy `Benefit achieved`;
- unknown/partial/stale/conflict są odrębne od zero/healthy;
- każda liczba ma formula/unit/window/source/as-of/confidence;
- każdy write ma capability, preview, approval, audit i read-back;
- żadnych shadow registers;
- empty/error/degraded states prowadzą do prawdziwego następnego działania;
- testy obejmują role, tenant isolation, idempotency, partial failure i retry;
- odbiór wymaga realDB i runtime evidence, nie tylko kodu lub dokumentacji.

## 20. Otwarte decyzje implementacyjne, które nie zmieniają kanonu funkcji

1. Dokładne polskie etykiety wybranych statusów i CTA.
2. Czy `CANCELLED` pozostaje osobną disposition obok `REJECTED` i `STOPPED`.
3. Szczegółowy governance profile Lite/Standard/Complex.
4. Techniczna migracja 13 runtime statuses do nowego modelu.
5. Minimalny model danych wymagany do aktywacji pełnej funkcji Zasoby.
6. Zakres mobilnej edycji dla timeline, heatmap i allocation board.

Żadna z tych decyzji nie uprawnia do przywrócenia starych Menu 2 ani do zbudowania nowego dashboardu jako dziesiątej funkcji.

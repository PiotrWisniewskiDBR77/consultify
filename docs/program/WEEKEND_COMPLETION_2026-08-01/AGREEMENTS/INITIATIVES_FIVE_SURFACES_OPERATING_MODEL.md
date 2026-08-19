---
document_id: INITIATIVES-FIVE-SURFACES-OPERATING-MODEL
module: Initiatives
status: DRAFT_FOR_OWNER_REVIEW
superseded_in_scope_by: ../../../modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Pięć powierzchni Initiatives — kompletny model pracy

> **SUPERSEDED IN SCOPE (2026-08-09):** docelowe Menu 2, business lifecycle oraz podział funkcji Initiatives definiuje [`docs/modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md`](../../../modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md). Ten dokument pozostaje historycznym zapisem modelu pięciu powierzchni i nie ustanawia już docelowego Menu 2.

## 1. Rozstrzygnięcie

Pięć głównych powierzchni jest wystarczających:

1. **List**
2. **Candidates**
3. **Portfolio**
4. **Roadmap**
5. **Decisions**

Nie są to jednak kolejne fazy jednego liniowego kreatora. To pięć perspektyw na
ten sam system. Brakującym elementem nie jest szósta zakładka, tylko **pełny
Initiative Workspace**, otwierany z każdej powierzchni jako preview/detail.
Workspace zawiera 26 dobieranych kart, readiness, historię i przygotowanie
handoffu do Execution.

**Workspace nie jest kartą menu, szóstą funkcją ani etapem pipeline.** Jest
widokiem szczegółowym jednego obiektu, tak jak dokument/preview otwierany z
wiersza. Użytkownik nie „wchodzi do modułu Workspace”; otwiera konkretną
Initiative i pracuje na jej kartach.

Bez Workspace pięć zakładek byłoby tylko zestawem tabel. Z Workspace tworzą
kompletny proces zarządzania Initiative.

## 2. Kolejność menu a kolejność procesu

### 2.1 Rekomendowana kolejność menu

`List → Candidates → Portfolio → Roadmap → Decisions`

`List` pozostaje pierwsza, bo jest najczęstszym wejściem dla powracającego
użytkownika i pozwala natychmiast odnaleźć każdą Initiative. `Decisions` jest
ostatnia jako pozioma kolejka governance, a nie ostatni etap procesu.

### 2.2 Rzeczywista kolejność pracy

`Source Proposal Draft → Candidates validation → Registered Initiative in List
→ Initiative Workspace definition/analysis → Portfolio comparison → Roadmap
scenario and capacity → Decisions/gates → Approved Backlog → Schedule Decision
→ Scheduled → Execution Handoff`

Decisions występują w wielu miejscach: przy walidacji, wyborze wariantu,
zatwierdzeniu portfela, przyznaniu capacity oraz schedule commitment. Zakładka
`Decisions` agreguje te przypadki; nie oznacza, że decyzja następuje dopiero po
Roadmap.

## 3. List — organizacyjny rejestr Initiative

### 3.1 Cel

Jedno miejsce odnalezienia, zrozumienia stanu i rozpoczęcia pracy z każdą
**zarejestrowaną** Initiative. Proposal Draft przed Source Validation nie jest
tu widoczny.

### 3.2 Minimalne funkcje

- tabela wszystkich dostępnych Initiative niezależnie od statusu;
- wyszukiwanie pełnotekstowe i semantyczne;
- sortowanie, filtrowanie, grupowanie, zapisane i współdzielone widoki;
- filtry: status/gate, projekt, program, workstream, source cohort, owner,
  sponsor, jednostka, typ, priorytet, readiness, termin, ryzyko, health,
  strategic goal, KPI, decision due i capacity conflict;
- wybór kolumn, kolejności i gęstości tabeli;
- preview bez utraty kontekstu listy;
- otwarcie pełnego Initiative Workspace;
- bulk assignment/tag/project oraz bezpieczne bulk actions;
- eksport/link widoku z zachowaniem uprawnień;
- wskaźnik świeżości, braków, blokad i następnej wymaganej akcji;
- widoki systemowe: My Initiatives, Needs My Action, At Risk, Awaiting Decision,
  Approved Backlog, Scheduled, In Execution, Benefits Tracking, Archived.

### 3.3 Minimalny wiersz

Title, status, gate, project/program, owner, sponsor, source, expected outcome,
priority/score, readiness, health/risk, capacity state, planned window, next
decision/action, last update i freshness.

### 3.4 Teresa

- wyjaśnia stan i następny krok;
- wykrywa brak ownera, stagnację, niespójność statusu i dane stale;
- proponuje widok/filtry i bezpieczne bulk remediation;
- przygotowuje podsumowanie wybranego zbioru;
- nie zmienia statusów ani odpowiedzialności bez preview i zgody.

### 3.5 Wyjście

List nie ma pojedynczego „ukończenia”. Prowadzi do Workspace, Portfolio,
Roadmap, Decision Case lub Execution read-back. Jest rejestrem i centrum
nawigacji, nie fazą lifecycle.

## 4. Candidates — walidacja koncepcji przed ujawnieniem

Standard działania Teresy i jakości wyników obowiązujący we wszystkich
powierzchniach definiuje
[`INITIATIVE_AI_QUALITY_AND_OPERATING_PLAYBOOK.md`](INITIATIVE_AI_QUALITY_AND_OPERATING_PLAYBOOK.md).

### 4.1 Cel

Chronić wspólny portfel przed szumem, a jednocześnie nie zgubić wartościowych
propozycji pochodzących z Tools, Assessment, Audits, Interview, Finance,
Results/KPI, Chat/My Work i pracy ręcznej.

### 4.2 Inbox i zakres widoczności

Candidates agreguje lokalne `Initiative Proposal Drafts`, które zostały
wysłane do walidacji. Draft zachowuje source-private visibility. Reviewer widzi
tylko elementy wynikające z przypisania i uprawnień źródła.

Candidates są celowo „nieopierzonymi dziećmi”: mogą być niekompletne,
powtarzalne, sprzeczne, zbyt szerokie albo niewarte dalszej pracy. **Nie są
widoczne w List, Portfolio ani Roadmap i nie zużywają planistycznej capacity.**
Pojawiają się tam dopiero po rejestracji albo połączeniu z istniejącą Initiative.

Kolejki:

- New / unreviewed;
- Needs clarification;
- Similarity/overlap detected;
- Ready for validation;
- Deferred with review trigger;
- Registered / merged / extended;
- Dismissed history.

### 4.3 Funkcje

- preview źródła, findingu, evidence, wersji i confidence;
- edycja problemu, oczekiwanego rezultatu, wstępnego scope i KPI;
- przypisanie Proposal Ownera i Source Validatora;
- AI quality/readiness check;
- wyszukiwanie duplikatów, overlapów, sprzeczności i istniejących projektów;
- porównanie side-by-side z Registered Initiative;
- komentarze, pytania, delegated clarification Tasks i SLA;
- wybór visibility classification oraz proponowanego projektu;
- akcje: `Register`, `Merge`, `Extend`, `Return`, `Defer`, `Dismiss`;
- bulk triage tylko dla działań niskiego ryzyka; rejestracja pozostaje jawna;
- immutable Source Validation Decision i lineage.

### 4.3.1 `AI Analysis` — centralne narzędzie selekcji kandydatów

Candidates posiada wyraźną akcję `AI Analysis`, działającą dla jednego,
zaznaczonej grupy lub całej uprawnionej kolejki. To sesja analityczna z
preview, nie automatyczny bulk write.

Analiza:

- grupuje kandydatów według problemu, celu, procesu, KPI, jednostki i rozwiązania;
- wykrywa exact duplicate, partial overlap, extension i contradiction;
- porównuje kandydatów także ze wszystkimi Registered Initiatives;
- rozróżnia ten sam problem od tego samego proponowanego rozwiązania;
- pokazuje źródła, wspólne i sprzeczne evidence oraz confidence;
- proponuje: register separately, merge candidates, extend existing, link as
  supporting evidence, split, request clarification, defer albo dismiss;
- sugeruje wspólny tytuł, scope, ownera, projekt i visibility dla połączenia;
- wskazuje brakujące obszary — ważne problemy bez żadnego kandydata;
- tworzy porównanie `before → proposed result` i listę skutków każdej operacji;
- pozwala prowadzić rozmowę z Teresą i ręcznie zmieniać proponowane grupy;
- wymaga zatwierdzenia każdej operacji Register/Merge/Extend/Dismiss.

AI Analysis nigdy nie usuwa źródeł. Po merge każde źródło i każdy Proposal
Draft pozostają w lineage nowej lub rozszerzonej Initiative.

### 4.4 Teresa

- tworzy draft z zatwierdzonych findings, nie ze wszystkiego;
- syntetyzuje evidence i oddziela przyczynę od symptomu;
- ocenia `worth further analysis`, nie udaje pełnego business case;
- wskazuje braki, podobieństwa i konsekwencje merge/extend;
- proponuje decyzję oraz confidence, ale validator ją podejmuje;
- po Register przygotowuje początkowy Workspace Profile.

### 4.5 Definition of Done

Candidate opuszcza aktywną kolejkę tylko z jawną decyzją i powodem. `Register`
tworzy dokładnie jedną Registered Initiative, kanoniczne ID, lineage, projekt,
visibility, ownera i początkowy profil kart. Operacja jest idempotentna.

## 5. Initiative Workspace — widok szczegółowy, nie szósta zakładka

### 5.1 Cel

Zmienić zarejestrowaną koncepcję w kompletną, porównywalną i wykonalną
Initiative. Workspace otwiera się z List, Candidates history, Portfolio,
Roadmap, Decisions lub deep linku.

### 5.2 Funkcje

- 26-kartowa biblioteka zgodna z `INITIATIVE_CARD_FUNCTION_CATALOG.md`;
- AI Workspace Profile: required, recommended, optional, not applicable;
- etapowe definition i analysis playbooks zależne od typu Initiative;
- role/RACI, Tasks, Decisions, Risks, KPI, Finance i Materials jako typowane
  relacje, nie lokalne kopie;
- completeness/readiness z blockerami, warningami i deep linkami;
- delegated analysis Tasks i read-back;
- suggested changes, diff, wersjonowanie, komentarze i immutable gate snapshot;
- analiza wykonalności, capacity, change/adoption oraz jakości evidence;
- prepare for Portfolio, prepare Decision Brief i prepare Execution Handoff;
- StandardPreview i pełny dokument Initiative.

### 5.3 Teresa

Pełni role facilitator, analyst, challenger, planner, coach i verifier zgodnie z
kontraktem każdej karty. Nie zatwierdza danych właścicielskich ani gates.

### 5.4 Definition of Done

Initiative może wejść do Portfolio Decision, gdy karty wymagane przez jej profil
i politykę są kompletne, blocker risks rozstrzygnięte, KPI/Finance mają aktualne
linki, accountable roles są potwierdzone, a `Initiative Sense Review` i
`Feasibility Analysis` mają zaakceptowaną wersję.

## 6. Portfolio — merytoryczna analiza i alokacja zasobów

### 6.1 Cel

Odpowiedzieć nie tylko „czy ta Initiative ma sens?”, ale „czy jest lepszym
wykorzystaniem ograniczonych zasobów niż pozostałe i czy cały zestaw jest
spójny?”.

Portfolio odpowiada przede wszystkim na pytania **co i dlaczego warto zrobić,
czy organizacja ma do tego ludzi, kompetencje, pieniądze i mandat oraz jaki
zestaw zmian jest merytorycznie wykonalny**. Nie układa jeszcze szczegółowo tych
prac w czasie.

### 6.2 Funkcje

- porównanie Registered Initiatives na wspólnej, wersjonowanej metodzie;
- scoring z pełną dekompozycją i confidence;
- value/cost/risk/time-to-value/strategic fit/evidence quality;
- balans projektów, jednostek, typów zmiany, horizonów i celów strategicznych;
- capacity/skill/budget demand vs supply;
- dostępność i adekwatność zespołu, krytycznych ról, kompetencji, dostawców,
  technologii i budżetu jako resource envelope;
- wskazanie Initiative wykonalnych, warunkowo wykonalnych i niewykonalnych wraz
  z przyczyną;
- dependency graph, conflicts, overlaps, synergie i mutual exclusion;
- scenariusze what-if: budget, capacity, priorytety, przesunięcia, merge/split;
- efficient frontier / shortlist bez automatycznego wyboru;
- rank z jawnymi manual overrides i rationale;
- portfolio constraints i mandatory/regulatory lane;
- side-by-side Initiative comparison;
- wersjonowane scenariusze, komentarze, review i publication;
- przygotowanie Portfolio Decision Case.

Granica capacity:

- Portfolio sprawdza **czy zasoby istnieją i na co warto je przeznaczyć**;
- Roadmap sprawdza **w którym okresie te same zasoby są dostępne i jak uniknąć
  przeciążenia**;
- Execution zarządza **rzeczywistym wykorzystaniem i odchyleniami w realizacji**.

### 6.3 Teresa

- normalizuje porównanie i wskazuje nieporównywalne dane;
- wykrywa double counting value, pet projects, optimistic bias i resource clash;
- proponuje kilka scenariuszy, w tym `do nothing/defer/stop`;
- wyjaśnia trade-offs i kto traci/zyskuje;
- nie ustala ostatecznego priorytetu ani budżetu.

### 6.4 Definition of Done

Decydenci otrzymują wersjonowany scenariusz, listę included/excluded/deferred,
uzasadnienie, constraints, capacity/budget envelope, ryzyka i impact. Decyzja
tworzy `Approved Backlog`, nie automatycznie `Scheduled`.

## 7. Roadmap — czasowa analiza zatwierdzonego portfela

### 7.1 Cel

Przekształcić wybrany zestaw Initiative w realistyczną sekwencję strategiczną,
unikając spiętrzenia pracy i konfliktów zależności. Roadmap nie jest taskowym
planem Execution.

Roadmap nie rozstrzyga ponownie merytorycznego sensu Initiative. Odpowiada:
**kiedy, w jakiej kolejności i z jaką intensywnością możemy uruchomić wybrany
portfel bez przekroczenia czasowej capacity i zależności**.

### 7.2 Funkcje

- timeline oraz now/next/later, kwartały i strategic horizons;
- swimlanes po programie, projekcie, jednostce, celu i workstreamie;
- drag/drop jako propozycja scenariusza, nie ukryta zmiana baseline;
- zależności, milestones/gates, earliest/latest window;
- capacity heatmap dla ról, skills, jednostek i shared services;
- budżet/cash/value timing i constraints;
- conflict/overload detection oraz impact propagation;
- scenariusze manualne i AI z compare/diff;
- unscheduled Approved Backlog lane;
- confidence i assumptions dla terminu;
- freeze horizon, tolerancje i rebaseline policy;
- przygotowanie Schedule and Capacity Decision;
- po zatwierdzeniu read-back z Execution bez kopiowania jego task planu.

### 7.3 Teresa

- proponuje sekwencję, podział, przesunięcie, redukcję scope lub capacity uplift;
- analizuje critical shared resources i nierealną wielozadaniowość;
- pokazuje wpływ na termin, koszt, ryzyko, wartość i zależne Initiative;
- nie potwierdza dostępności ani nie zapisuje baseline bez zgody.

### 7.4 Definition of Done

Initiative osiąga `Scheduled`, gdy ma wybrany projekt, Execution Managera,
potwierdzone critical capacity, baseline window, zależności, tolerancje,
warunki approval oraz Schedule Decision. Dopiero wtedy może powstać Execution
Handoff.

## 8. Decisions — centrum decyzji Initiative, projektów i programów

### 8.1 Cel

Zapewnić, że każda istotna decyzja ma przygotowany kontekst, właściwego
decydenta, termin, rozstrzygnięcie, warunki i wykonany follow-up.

Zakres nie ogranicza się do decyzji „wewnątrz kart Initiative”. Obejmuje
decyzje wymagane przez Initiative, projekty, programy, Portfolio i Roadmap:
Go/No-Go, priorytet, zasoby, budżet, wyjątek, ryzyko, zmianę zakresu, schedule,
rebaseline, stop oraz odbiór. Decisions jest prawdą governance dla tego modułu;
My Work pokazuje osobistą projekcję wszystkich decyzji przypisanych danemu
użytkownikowi także z innych domen.

### 8.2 Kolejki

- My Decisions;
- Decisions for My Projects / Programs;
- Team / Board Decisions;
- Go / No-Go and Gates;
- Awaiting Evidence;
- Ready to Decide;
- Due Soon / Overdue;
- Escalated;
- Conditional Approvals;
- Decided — follow-up incomplete;
- Decision history.

### 8.3 Funkcje

- Decision Case z pytaniem, wariantami, rekomendacją, evidence i kontrdowodami;
- typy: Source Validation, Definition, Option, Risk Acceptance, Finance,
  Portfolio, Gate, Capacity, Schedule, Change, Rebaseline, Stop, Delivery,
  Effectiveness;
- scope każdej decyzji: Initiative, Project, Program albo Portfolio;
- relacje `blocks`, `unblocks`, `required_by_gate`, `affects` oraz zależne
  Initiative/Projects;
- widok „What is blocked by this decision?” i „What is this decision waiting
  for?”;
- owner preparacji, decydent/board, consulted/informed i quorum;
- due date, SLA, reminder i escalation path;
- approve/reject/return/defer/conditional/abstain zgodnie z typem;
- możliwość request evidence lub delegated analysis Task;
- snapshot wersji kart, Finance, KPI, Risk i Roadmap użytych w decyzji;
- konflikt interesów, delegation i substitute policy;
- warunki decyzji zamieniane na Tasks/Milestones/KPI/Risks;
- notification do zainteresowanych;
- audit trail, komentarze, podpis/acknowledgement zależnie od policy;
- monitor wykonania decyzji i reopen/new decision zamiast nadpisania historii.

Każda Decision ma dwa niezależne stany:

- `decision_status`: draft, awaiting evidence, ready, decided, deferred,
  cancelled;
- `follow_up_status`: not started, in progress, blocked, verified, complete.

Dzięki temu podjęta decyzja nie znika, jeżeli jej warunki nie zostały wykonane.

### 8.4 Teresa

- przygotowuje krótki i pełny Decision Brief;
- wykrywa brak wariantu, słabe evidence, przestarzałe dane i niespełnione gate;
- pokazuje konsekwencje, assumptions, confidence i rekomendację;
- pilnuje SLA, przypomina, eskaluje i sprawdza follow-up;
- nigdy nie głosuje ani nie zatwierdza.

### 8.5 Definition of Done

Decision jest zakończona, gdy ma wynik, decydenta, timestamp, rationale,
evidence snapshot, warunki, visibility oraz utworzone i przypisane follow-up
objects. Sam klik `Approve` bez tych elementów nie zamyka decyzji.

## 9. Czy czegoś brakuje?

### 9.0 Krytyczny werdykt

Model jest kompletny funkcjonalnie pod warunkiem zachowania czterech twardych
granic:

1. Candidates nigdy nie pojawiają się w List przed Register/Merge/Extend.
2. Portfolio jest merytoryczno-zasobowe, Roadmap czasowo-capacity.
3. Decisions obejmuje Initiative/Project/Program/Portfolio, a My Work jest tylko
   osobistą projekcją przypisań.
4. Workspace jest szczegółem Initiative, nie kolejną kartą menu.

Nie brakuje nowej głównej powierzchni. Brakowało natomiast trzech funkcji, które
teraz są obowiązkowe: `AI Analysis` w Candidates, jawna analiza resource
feasibility w Portfolio oraz dependency/blocking view w Decisions.

### 9.1 Nie dokładamy szóstej zakładki `Analysis`

Analysis jest pracą wewnątrz Initiative Workspace i kart. Oddzielna zakładka
tworzyłaby konkurencyjną listę Initiative i rozrywała kontekst.

### 9.2 Nie dokładamy zakładki `Execution`

Po `Scheduled` pełne zarządzanie realizacją należy do modułu Execution.
Initiatives pokazuje tylko status i read-back. Duplikowanie Execution w tym
menu zniszczyłoby granicę odpowiedzialności.

### 9.3 Potrzebne mechanizmy przekrojowe

Pięć powierzchni wymaga wspólnego:

- Initiative Workspace i StandardPreview;
- globalnego search/command/menu 3;
- saved views i personal `Needs My Action`;
- event/notification/escalation spine;
- project/program/workstream model;
- role/capability resolution;
- source provenance i lineage;
- one-task/one-decision/one-risk/one-KPI truth;
- AI suggestion/approval/write/verification spine;
- wersjonowania, gate snapshots i audit trail.

Jeśli któregokolwiek z tych mechanizmów zabraknie, dodanie kolejnej zakładki nie
naprawi procesu.

## 10. Kompletny golden flow do Execution

1. Użytkownik kończy Tool/Assessment/Audit/Interview/Finance/KPI analysis.
2. Teresa proponuje jeden lub kilka Proposal Drafts w źródłowej zakładce
   Initiatives.
3. Proposal Owner uzupełnia draft i wysyła do validation.
4. Candidates wykrywa duplicate/overlap i przygotowuje Source Validation.
5. Validator rejestruje, łączy, rozszerza, zwraca, odkłada albo odrzuca.
6. Register tworzy Initiative, lineage, projekt, visibility, ownera i AI profile.
7. Initiative pojawia się w List i otwiera w Workspace.
8. Zespół z Teresą przechodzi Definition, Tasks analityczne i wymagane karty.
9. Finance, Results, Risks, Decisions i Materials są linkowane jako prawdy
   domenowe.
10. Feasibility/Completeness potwierdza gotowość do porównania.
11. Portfolio porównuje Initiative i buduje scenariusze.
12. Portfolio Decision tworzy Approved Backlog albo reject/defer/merge/return.
13. Roadmap układa approved set względem dependencies i capacity.
14. Schedule Decision zatwierdza projekt, role, baseline, termin i tolerancje.
15. Status zmienia się na Scheduled; Teresa tworzy wersjonowany Handoff Pack.
16. Execution odbiera ten sam Initiative ID/lineage, tworzy Execution Case i
    potwierdza read-back.
17. Jeżeli handoff lub read-back zawiedzie, Initiative nie udaje rozpoczętej;
    pokazuje błąd i bezpieczny retry.

## 11. Execution Handoff — precyzyjny kontrakt

Handoff zawiera:

- Initiative ID, lineage, approved version i project/program/workstream;
- problem, scope, out-of-scope, target outcome i success criteria;
- wybrany wariant oraz odrzucone alternatywy z rationale;
- Sponsor, Initiative Owner, Benefit Owner, Execution Manager i RACI;
- deliverables, milestones, baseline window i tolerancje;
- KPI contract refs i Benefits plan;
- Investment Case version/ref oraz financial anchors;
- capacity assumptions/commitments i critical skills;
- dependencies, RAID, accepted residual risks i responses;
- Change/Adoption, Communication i Capability requirements;
- wszystkie approval conditions i unresolved unknowns;
- Decision snapshots, evidence, attachments i provenance;
- wymagane cadence, reporting i escalation policy.

Execution wykonuje walidację przyjęcia: kompletność, uprawnienia, projekt,
ownerzy, status i idempotency. Odpowiada `accepted`, `accepted with explicit
gaps` albo `rejected with blockers`. Po przyjęciu zwraca `executionCaseId`,
status i deep link. Nie wolno automatycznie zamykać braków przez generowanie
fikcyjnych danych.

## 12. Kryteria odbioru całego modelu

- każda z pięciu powierzchni ma jednoznaczny cel i nie dubluje pozostałych;
- List pokazuje tylko Registered Initiative, Candidates Proposal Drafts;
- Workspace używa jednej biblioteki kart i jednego Initiative ID;
- wszystkie decyzje trafiają do wspólnej kolejki Decisions;
- Portfolio Decision i Schedule Decision są oddzielne;
- Roadmap wykrywa capacity conflict przed Scheduled;
- żadna Initiative nie trafia do Execution przed Schedule Gate;
- handoff jest idempotentny, wersjonowany i ma read-back;
- Task, Decision, Risk, KPI, Finance i Material nie mają lokalnych kopii;
- AI nie zatwierdza, nie przyznaje capacity i nie tworzy ukrytych zapisów;
- permissions i visibility są egzekwowane przez backend;
- cały golden flow ma test E2E z błędem i bezpiecznym retry.

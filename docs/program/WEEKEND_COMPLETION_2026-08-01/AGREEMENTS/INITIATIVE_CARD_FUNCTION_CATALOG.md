---
document_id: INITIATIVE-CARD-FUNCTION-CATALOG
module: Initiatives
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Kanoniczny katalog i kontrakt wszystkich kart Initiative

## 1. Cel i reguła nadrzędna

Dokument jest **jednym kanonicznym plikiem opisującym wszystkie karty
Initiative** i wykonawczym kontraktem ich działania. Karta nie jest ekranową
dekoracją ani luźną notatką. Ma określony cel decyzyjny, właściciela prawdy,
wejścia, wyjścia, relacje, reguły AI, workflow i kryterium ukończenia.

Każda instancja karty przechowuje: `initiativeId`, `cardType`, wersję schematu,
status kompletności, ownera, źródła/provenance, ostatnią zmianę, autora zmiany,
powiązane obiekty i aktywne sugestie AI. Ukrycie karty nie usuwa jej danych.

Docelowym celem całego systemu kart jest doprowadzenie użytkownika od
niepełnej koncepcji do decyzji opartej na dowodach, wykonalnego zobowiązania,
kontrolowanego wdrożenia oraz potwierdzonego rezultatu — bez utraty kontekstu,
odpowiedzialności i historii.

### 1.1 Obowiązkowy kontrakt każdej karty

Każdy typ karty musi posiadać następujące pola specyfikacji:

1. `purpose` — po co karta istnieje i jaką decyzję lub pracę umożliwia;
2. `target_outcome` — stan biznesowy, który ma powstać po jej poprawnym użyciu;
3. `human_accountable` — człowiek odpowiadający za prawdziwość i akceptację;
4. `truth_owner` — moduł będący właścicielem kanonicznych danych;
5. `inputs` i `outputs` — wymagane dane wejściowe i formalne rezultaty;
6. `ai_role` — konkretne zadania Teresy, używane źródła i wymagane wyjaśnienie;
7. `ai_write_policy` — draft, suggested change, approved write albo read-only;
8. `relationships` — typowane relacje z innymi kartami i obiektami pracy;
9. `events` — zdarzenia wejściowe i emitowane po zmianie;
10. `notifications_and_escalations` — kto, kiedy i dlaczego otrzymuje wezwanie;
11. `permissions` — kto czyta, edytuje, akceptuje, publikuje i zamyka;
12. `states` — empty, draft, incomplete, ready, approved, stale, blocked, error;
13. `readiness_rules` — warunki kompletności oraz gate blockers/warnings;
14. `audit_and_versioning` — provenance, snapshot, diff i immutable history;
15. `acceptance_tests` — testy zachowania, uprawnień, AI i integracji.

Brak któregokolwiek elementu oznacza, że karta nie jest gotowa do rozpisania
zadań implementacyjnych.

## 2. Wspólny protokół operacyjny kart

### 2.1 Powiązane obiekty

Każda karta może tworzyć propozycję lub link do:

- **Task** — praca do wykonania, z ownerem, due, statusem, priorytetem i źródłem;
- **Decision** — rozstrzygnięcie z decydentem, terminem, wariantami i evidence;
- **Risk/RAID** — niepewność, assumption, issue lub dependency z reakcją;
- **KPI** — kontrakt pomiaru należący kanonicznie do Results;
- **Notification** — informacja wymagająca uwagi konkretnej roli;
- **Suggested Change** — wersjonowana propozycja modyfikacji danych karty.

Relacja jest dwukierunkowa i używa stabilnego ID. My Work agreguje przydziały,
ale nie tworzy kopii. Execution jest właścicielem zadań realizacyjnych; Results
KPI/actual; Finance Investment Case; Decisions decyzji; komunikacja dostarczenia
powiadomień. Initiative przechowuje kontekst i link.

### 2.1.1 Kanoniczny rekord relacji

Link nie jest tekstowym URL-em ani zduplikowaną tablicą ID. Każda relacja ma:

```text
Relation {
  id, organizationId, initiativeId,
  sourceType, sourceId, targetType, targetId,
  relationType, direction, lifecyclePhase,
  createdBy, createdAt, provenance,
  visibility, syncPolicy, status, version
}
```

`relationType` pochodzi z zamkniętego rejestru:

- `DEFINED_BY`, `MEASURED_BY`, `SUPPORTED_BY`, `DELIVERED_BY`;
- `REQUIRES_DECISION`, `CREATES_TASK`, `MITIGATES_RISK`;
- `DEPENDS_ON`, `BLOCKED_BY`, `OWNED_BY`, `APPROVED_BY`;
- `NOTIFIES`, `ESCALATES_TO`, `EVIDENCED_BY`, `GENERATED_FROM`;
- `SUPERSEDES`, `MERGED_INTO`, `TRACKED_IN`, `PUBLISHED_AS`.

Relacja określa `syncPolicy`: `reference-only`, `read-through`,
`event-synchronized` albo `snapshot-at-gate`. Usunięcie relacji wymaga
uprawnienia i pozostawia wpis w historii. Obiekt źródłowy nie może przez relację
nadpisywać prawdy obiektu docelowego.

### 2.1.2 Właściciele obiektów docelowych

| Obiekt/narzędzie | Właściciel prawdy | Jak karta z nim pracuje |
| --- | --- | --- |
| Decision | Decisions / governance service | Tworzy Decision Case, linkuje evidence i odbiera wynik/warunki. |
| Task | Initiatives przed handoff; Execution podczas realizacji | Tworzy zadanie w domenie właścicielskiej i pokazuje projekcję statusu. |
| Notification | Communication/notification service | Emisja zdarzenia; kanał dostarcza komunikat i przechowuje delivery state. |
| Risk/RAID | Wspólny RAID record w kontekście Initiative/Execution | Linkuje trigger, response Task, Decision i residual risk approval. |
| KPI/OKR | Results | Referencja do definicji i read-through wartości; Results emituje deviations. |
| Finance/Investment Case | Finance | Snapshot/referencja wersji użytej w gate, bez lokalnego przeliczania. |
| Project/Program | Portfolio/PMO governance | Przypisanie scope, ról, capacity, visibility i raportowania. |
| Material/Attachment | Materials | Link do wersjonowanego artefaktu i publication/access state. |
| Comment/Mention | Collaboration layer | Kontekstowy wątek może wygenerować Task/Decision/Notification. |

### 2.1.3 Propagacja bez dublowania

- karta inicjuje utworzenie obiektu przez API jego właściciela;
- po sukcesie zapisuje `Relation`, nie kopię całego obiektu;
- podsumowanie w karcie jest read model z freshness i deep linkiem;
- zmiana obiektu docelowego emituje event aktualizujący read model;
- gate zapisuje immutable snapshot użytych wersji;
- brak dostępu pokazuje istnienie ograniczonej relacji bez ujawnienia treści;
- awaria synchronizacji jest widoczna jako `stale/degraded`, nigdy jako sukces.

### 2.2 Zachowanie Teresy na każdej karcie

Teresa pracuje w cyklu `Observe → Diagnose → Propose → Preview → Approve →
Write/Link → Verify → Learn`:

1. czyta tylko dozwolony kontekst i wskazuje jego świeżość;
2. identyfikuje braki, sprzeczności, ryzyka i potrzebne decyzje;
3. zadaje pytania tylko o informacje, których nie da się wiarygodnie wywnioskować;
4. proponuje uzupełnienie z cytowanymi źródłami, assumptions i confidence;
5. pokazuje diff oraz skutki dla innych kart i statusu/gate;
6. po akceptacji zapisuje przez kanoniczne API lub tworzy powiązany obiekt;
7. sprawdza wynik zapisu i wycofuje/zgłasza błąd, jeśli zapis się nie powiódł;
8. nie nadpisuje zatwierdzonego snapshotu — tworzy nową wersję/change request.

AI może automatycznie wykonywać odwracalne analizy i drafty. Nie może samo:
zatwierdzić gate, przypisać odpowiedzialności bez zgody osoby, przyznać budżetu,
potwierdzić capacity, zaakceptować ryzyka, zmienić baseline, opublikować
komunikatu ani zamknąć Task/Decision/Risk/Initiative.

### 2.2.1 Role AI

Każda karta wybiera jawnie jedną lub więcej ról AI:

- **Extractor** — wydobywa fakty ze źródeł bez zmiany znaczenia;
- **Structurer** — układa informacje w schemat karty;
- **Analyst** — liczy/porównuje i pokazuje metodę oraz assumptions;
- **Challenger** — szuka luk, kontrdowodów, konfliktów i ryzyka;
- **Facilitator** — prowadzi użytkowników przez pytania i uzgodnienie;
- **Planner** — proponuje zadania, role, kolejność, terminy i scenariusze;
- **Coach** — pomaga ownerowi wykonać następny krok i usuwać blokady;
- **Monitor** — obserwuje zdarzenia/progi oraz zgłasza odchylenia;
- **Drafting assistant** — przygotowuje treść, Decision Brief lub komunikat;
- **Verifier** — sprawdza kompletność, spójność, zapis i osiągnięcie efektu.

Rola jest pokazywana użytkownikowi przy akcji. Ogólne „Ask AI” bez określonego
celu, kontekstu, wyjścia i uprawnienia nie spełnia kontraktu.

### 2.3 Powiadomienia i motywowanie

Powiadomienie nie powstaje od samego istnienia danych. Powstaje po zdarzeniu:
przypisanie odpowiedzialności, zbliżający się/minięty termin, brak odpowiedzi,
naruszenie tolerancji, zmiana zależności, ryzyko, wymagany gate lub odrzucenie
sugestii wymagające dalszej pracy. Zawiera `co się stało`, `dlaczego to ważne`,
`kto odpowiada`, `do kiedy`, `zalecaną akcję` i deep link.

System motywuje przez jasność celu, zauważanie postępu, coaching i usuwanie
blokad. Nie używa dark patterns, publicznego zawstydzania ani fałszywych metryk
aktywności. Brak reakcji uruchamia wersjonowaną eskalację do ustalonej roli.

## 3. Kontrakty 26 kart

| # | Karta i cel | Prawda / wejścia → wyjścia | Praca AI | Relacje i Definition of Done |
| --- | --- | --- | --- | --- |
| 1 | **Summary / Initiative Scope** — jednoznacznie wyjaśnia problem, zmianę i granice. | Findingi, źródła, strategia → problem statement, in/out, assumptions, expected outcome. | Syntetyzuje źródła, oddziela symptom od przyczyny, wykrywa scope creep i proponuje pytania. | Decision przy sporze zakresu; Risk dla niepotwierdzonego assumption. DoD: owner potwierdził problem, wynik i granice. |
| 2 | **Strategic Fit** — dowodzi związku ze strategią. | Cele/OKR/priorytety → jawne linki, contribution i konflikt. | Dopasowuje semantycznie, pokazuje kontrdowody i pet-project risk; nie inventuje alignmentu. | KPI/OKR w Results, Decision przy konflikcie priorytetów. DoD: co najmniej jeden potwierdzony cel albo jawne uzasadnienie wyjątku. |
| 3 | **Success Criteria** — definiuje rozpoznawalne ukończenie. | Scope, outcomes → target state, kryteria akceptacji, deliverables. | Zamienia ogólniki w mierzalne kryteria, testuje falsyfikowalność. | Task/Milestone i acceptance Decision. DoD: każde kryterium ma ownera, sposób dowodu i moment oceny. |
| 4 | **Outcomes & Benefits** — definiuje zmianę biznesową, nie aktywność. | Problem, strategy, Finance/Results → benefit hypotheses, beneficiaries, timing. | Buduje logic chain output→outcome→benefit, wykrywa podwójne liczenie. | KPI, Benefit Owner, Finance case. DoD: każdy benefit ma ownera, miarę, baseline/target lub jawny plan ich ustalenia. |
| 5 | **KPI** — kontraktuje pomiar sukcesu. | Outcomes, Results catalog → KPI refs, baseline, target, cadence, thresholds. | Proponuje metryki leading/lagging, sprawdza controllability i gaming risk. | Kanoniczny zapis w Results; alert tworzy Risk/Task/Notification. DoD: owner, wzór, źródło, unit, baseline, target, cadence i visibility. |
| 6 | **Options** — zapewnia realny wybór. | Problem, constraints, evidence → warianty, `do nothing`, trade-offs. | Generuje rozłączne opcje, challenge'uje preferowany wariant i koszt niewykonania. | Decision wybiera wariant; odrzucone zachowują rationale. DoD: ≥2 realne opcje plus do-nothing albo uzasadniony wyjątek. |
| 7 | **Financial Analysis** — wiąże decyzję z finansową prawdą. | Options, costs/benefits → wersjonowany link Investment Case. | Wykrywa brakujące założenia i zleca obliczenia Finance; nie liczy lokalnej prawdy. | Finance jest ownerem; Decision używa snapshotu. DoD: aktualna wersja, owner, confidence i reconciliation state. |
| 8 | **Financial Impact** — przedstawia wpływ dla decydenta. | Finance case → narracja P&L/cash/cost/value oraz sensitivity anchors. | Tłumaczy wyniki, porównuje scenariusze i oznacza niepewność. | Risk dla wrażliwych assumptions; KPI realizacji korzyści. DoD: brak sprzeczności z Finance i widoczna data wersji. |
| 9 | **People / Team** — zapewnia ludzi potrzebnych do pracy. | Project membership, capacity, skills → sponsor, owner, manager, team. | Wykrywa wakaty, overload, bus factor i konflikty ról; sugeruje kandydatów. | Assignment Notification i akceptacja osoby; Risk przy luce. DoD: wymagane role obsadzone i potwierdzone. |
| 10 | **Roles & RACI** — usuwa niejasność odpowiedzialności. | Deliverables, gates, decisions, workstreams → kontekstowe A/R/C/I. | Wykrywa brak/mnogość A, przeciążenie i role bez mandatu; proponuje korekty. | Task/Decision/KPI/Risk dziedziczą jawne assignment, nie domysł. DoD: dokładnie jedno A dla każdego krytycznego obiektu. |
| 11 | **Stakeholders** — zarządza poparciem i wpływem. | Org graph, interviews, change scope → mapa wpływu, postawa, potrzeby. | Klasyfikuje tylko z evidence, wykrywa pominięte grupy i proponuje engagement. | Change/Communication Task i Risk oporu. DoD: krytyczne grupy mają ownera relacji i plan. |
| 12 | **Resources & Capacity** — potwierdza realną wykonalność. | Team, portfolio load, budgets, calendars → demand, supply, skills, conflicts. | Szacuje warianty, wykrywa spiętrzenie i proponuje sekwencję/scope/capacity; nie potwierdza dostępności. | Project, Timeline, Finance, Risk; Decision capacity approval. DoD: named capacity dla krytycznych ról i rozwiązane/zaakceptowane konflikty. |
| 13 | **Dependencies** — chroni przepływ między pracami. | Portfolio, projects, systems → typed dependency, owner, needed-by, health. | Wykrywa zależności z danych, symuluje impact i proponuje sequencing. | Risk/Issue, Milestone i Notification obu ownerów. DoD: każda krytyczna zależność ma ownera, termin i response. |
| 14 | **Risk & RAID** — zarządza niepewnością i blokadami. | Wszystkie karty i sygnały → risk/assumption/issue/dependency records. | Identyfikuje, deduplikuje, ocenia scenariusze i proponuje response; nie akceptuje residual risk. | Task reakcji, Decision akceptacji/escalation, Notification progowa. DoD: owner, probability/impact, trigger, response, due i residual decision. |
| 15 | **Milestones** — wyznacza punkty kontroli wartości/postępu. | Success criteria, dependencies → milestones z outcome i evidence. | Proponuje sensowne punkty, wykrywa zbyt duże odstępy i pseudo-milestones. | Tasks, Gates, Timeline, Notifications. DoD: owner, date, acceptance/evidence i dependencies. |
| 16 | **Timeline** — określa realne okno i baseline. | Milestones, effort, dependencies, capacity → scenarios i approved window. | Planuje scenariusze, critical path, overload i confidence; nie baselinuje. | Schedule Decision, Tasks, Project Roadmap. DoD: wybrany scenariusz, capacity check, tolerance i approval przed Scheduled. |
| 17 | **Tasks** — organizuje konkretną pracę bez dublowania prawdy. | Gaps, decisions, risks, milestones → canonical Task refs. | Rozbija pracę, proponuje owner/due/dependencies, wykrywa brakujące i martwe taski. | My Work projection; Execution owns delivery tasks. DoD: task ma rezultat, ownera, due/status, źródło i acceptance rule. |
| 18 | **Decisions** — zapewnia terminowe i audytowalne rozstrzygnięcia. | Options, evidence, risks → Decision Case, result, conditions, snapshot. | Przygotowuje brief, warianty, konsekwencje i rekomendację; nie decyduje. | Task przygotowania, Risk braku decyzji, Notification/escalation. DoD: decydent, due, wynik, rationale, evidence snapshot i follow-up. |
| 19 | **Gates & Approvals** — kontroluje przejścia lifecycle. | Readiness wszystkich wymaganych kart → gate case i transition. | Wylicza braki, contradictions i suggested fixes; nie omija ani zatwierdza gate. | Decisions, Tasks naprawcze, Notifications. DoD: wymagania wersji polityki spełnione lub jawnie zaakceptowane wyjątki. |
| 20 | **Feasibility & Completeness** — odpowiada, czy inicjatywa ma sens i da się ją wykonać. | Wszystkie wymagane karty → issue register, score i confidence. | Stosuje consulting challenge: evidence, logic, delivery, financial, capacity, adoption, measurement. | Task/Decision/Risk z każdego findingu. DoD: brak nierozstrzygniętych blockerów; warningi mają ownerów. |
| 21 | **Change & Adoption** — prowadzi rzeczywistą zmianę zachowań. | Stakeholders, process/role impact → adoption outcomes, interventions, resistance plan. | Analizuje wpływ, bariery, readiness i reinforcement; proponuje eksperymenty. | KPI adopcji, Tasks, Risks, Communications. DoD: change owner, grupy, desired behaviors, measures i plan interwencji. |
| 22 | **Communication & Engagement** — dostarcza właściwy komunikat właściwym ludziom. | Stakeholders, milestones, decisions → audience/message/channel/cadence plan. | Draftuje komunikaty zgodne z kontekstem i tonem, wykrywa luki/sprzeczności; nie publikuje. | Approval Decision, communication Task, Notification/log. DoD: owner, audience, purpose, timing, channel i approval policy. |
| 23 | **Capabilities & Training** — zamyka luki kompetencyjne. | Team/skills, target operating model → capability gaps i learning plan. | Mapuje role do skills, proponuje build/buy/borrow i learning-in-work. | Tasks, Resources, Finance, adoption KPI. DoD: krytyczne luki mają działanie, ownera, termin i measure. |
| 24 | **Technical Specification** — zapewnia wykonalność techniczną tam, gdzie potrzebna. | Scope, architecture, security, integrations → requirements, NFR, interfaces, ADR refs. | Analizuje impact, zależności, zagrożenia i brakujące NFR; nie zatwierdza architektury. | Technical Decisions/ADR, Tasks, Risks, Materials. DoD: owner techniczny, acceptance, security/data review i zatwierdzone decyzje. |
| 25 | **Attachments & Materials** — utrzymuje dowody i artefakty. | Source documents, generated outputs → versioned links i publication state. | Klasyfikuje, streszcza, sprawdza świeżość i sugeruje materiały; nie publikuje bez approval. | Materials owns artefact; source provenance i access policy. DoD: wymagane dowody istnieją, są dostępne i wersjonowane. |
| 26 | **Comments, Activity & History** — zapewnia współpracę i audytowalność. | Zdarzenia wszystkich kart → komentarze, changelog, snapshots, audit trail. | Podsumowuje zmiany i otwarte wątki, wykrywa unanswered mentions; nie zmienia historii. | Notification/Task z komentarza, Decision link. DoD: immutable audit trail i rozstrzygnięte wymagane wątki przed gate. |

## 3.1 Macierz odpowiedzialności, roli AI i głównego zdarzenia

Ta macierz uszczegóławia kolumnę `Praca AI`. Właściciel odpowiada za akceptację;
AI nigdy nie staje się `Accountable`.

| Karta | Human Accountable | Rola AI | Główne zdarzenie i reakcja |
| --- | --- | --- | --- |
| Scope | Initiative Owner | Extractor, Structurer, Challenger | `scope.changed` → impact analysis zależności, terminu, kosztu, KPI i approval. |
| Strategic Fit | Sponsor/Strategy Owner | Analyst, Challenger | `alignment.changed` → ponowny scoring i portfolio review. |
| Success Criteria | Initiative Owner | Structurer, Verifier | `criterion.ready/failed` → Milestone/Decision/Task. |
| Outcomes & Benefits | Benefit Owner | Analyst, Challenger | `benefit.changed` → KPI oraz Finance consistency review. |
| KPI | KPI Owner | Analyst, Monitor, Verifier | `kpi.deviated` → alert, deviation case, corrective Task/Initiative proposal. |
| Options | Initiative Owner | Analyst, Challenger, Facilitator | `option.selected` → Decision snapshot i aktualizacja zależnych analiz. |
| Financial Analysis | Finance Owner | Extractor, Challenger, Verifier | `investment_case.versioned` → stale flag dla decyzji używających starej wersji. |
| Financial Impact | Benefit/Finance Owner | Analyst, Drafting assistant | `financial_impact.changed` → sensitivity/risk review. |
| People/Team | Execution Manager | Planner, Challenger | `assignment.proposed` → accept/decline notification do osoby. |
| Roles & RACI | Initiative Owner | Structurer, Challenger | `accountability.changed` → powiadomienia i walidacja dokładnie jednego A. |
| Stakeholders | Change Owner | Extractor, Analyst, Challenger | `stakeholder.risk_changed` → engagement Task/Risk. |
| Resources & Capacity | Resource/Execution Manager | Analyst, Planner, Challenger | `capacity.conflict` → scenariusze i Schedule Decision. |
| Dependencies | Workstream/Execution Manager | Extractor, Monitor, Planner | `dependency.changed` → impact po obu stronach i notification. |
| Risk & RAID | Risk Owner | Extractor, Challenger, Monitor | `risk.threshold_crossed` → response Task, Decision/escalation. |
| Milestones | Execution Manager | Planner, Monitor, Verifier | `milestone.at_risk/reached` → alert albo acceptance verification. |
| Timeline | Execution Manager | Planner, Analyst, Challenger | `baseline.changed` → impact assessment i rebaseline Decision. |
| Tasks | Task Owner | Planner, Coach, Monitor | `task.blocked/overdue/done` → coaching/escalation lub evidence check. |
| Decisions | Decision Owner/Approver | Analyst, Challenger, Drafting assistant | `decision.due/decided` → reminder/escalation lub follow-up Tasks. |
| Gates & Approvals | Gate Approver | Verifier, Challenger, Drafting assistant | `gate.ready/blocked` → Decision Brief lub remediation Tasks. |
| Feasibility & Completeness | Initiative Owner | Analyst, Challenger, Verifier | `readiness.changed` → blockers/warnings i właściwe deep links. |
| Change & Adoption | Change Owner | Analyst, Facilitator, Coach, Monitor | `adoption.deviated` → intervention Task i escalation. |
| Communication | Communication/Change Owner | Drafting assistant, Verifier | `communication.ready` → approval; po zgodzie publish task/service. |
| Capabilities & Training | Capability Owner | Analyst, Planner, Coach | `skill_gap.confirmed` → build/buy/borrow Decision i learning Tasks. |
| Technical Specification | Technical Owner | Extractor, Analyst, Challenger | `technical_decision.required` → ADR/Decision i dependent Tasks/Risks. |
| Attachments & Materials | Artefact Owner | Extractor, Structurer, Verifier | `material.versioned/published` → freshness i access update. |
| Comments & History | Governance Owner | Extractor, Structurer, Monitor | `mention/unresolved_thread` → Notification, opcjonalnie Task/Decision. |

## 4. Automatyczne propagowanie zdarzeń

| Zdarzenie | Obowiązkowa reakcja systemu |
| --- | --- |
| Osoba dostaje rolę/task/decyzję/KPI/risk | Powiadomienie z możliwością accept, decline with reason lub request clarification. |
| Termin jest zagrożony | Teresa diagnozuje przyczynę, proponuje warianty; owner dostaje alert, a po SLA następuje eskalacja. |
| Risk przekracza próg | Tworzy/aktualizuje response Task i Decision Case; nie duplikuje istniejącego rekordu. |
| Zmienia się scope/term/budget/KPI | Impact analysis na zależne karty, suggested changes i wymagany re-approval według tolerancji. |
| Decision zapada | Warunki i follow-up stają się Task/Milestone; zainteresowane role dostają informację. |
| Task zostaje ukończony | System sprawdza acceptance evidence; nie uznaje automatycznie milestone/gate za ukończony. |
| KPI odchyla się od progu | Results tworzy alert/deviation case; Initiative pokazuje wpływ i proponuje corrective action. |
| Dependency zmienia health/date | Obie strony i plan capacity/timeline otrzymują impact; ownerzy dostają actionable notification. |
| Gate jest gotowy | Decydent otrzymuje Decision Brief; brak decyzji podlega SLA i eskalacji. |

## 5. Profile startowe kart

Teresa rekomenduje profil, a governance może go zaostrzyć:

- **Quick improvement** — Scope, Success, KPI, Team/RACI, Risk, Milestones,
  Tasks, Decisions, Feasibility, History.
- **Investment** — powyższe plus Options, oba Finance, Capacity, Dependencies,
  Timeline, Gates i Benefits.
- **Technology** — Investment plus Technical Specification, Security/Data
  review, Capabilities i Adoption.
- **Organizational change** — Strategic Fit, Stakeholders, RACI, Change,
  Communication, Capabilities, KPI, Risks, Milestones i Decisions.
- **Regulatory/remediation** — Scope, Success, evidence, RACI, RAID, Tasks,
  Timeline, Gates, Technical/Process requirements i immutable History.

Profil jest punktem startowym, nie substytutem analizy kontekstu.

## 6. Kryterium gotowości do rozpisania zadań implementacyjnych

Funkcja karty jest `READY_FOR_TASK_BREAKDOWN` dopiero, gdy ma zaakceptowane:
schemat danych, ownera domenowego, permissions, statusy, API read/write,
AI actions z approval level, cross-object events, notifications/escalations,
empty/loading/error/degraded/success states, audit/provenance, kryteria UX,
testy unit/integration/E2E oraz migrację starszych danych. Niniejszy katalog
definiuje produkt; nie zastępuje technicznych kart wykonawczych A–T.

## 7. Podstawa metodyczna

Kanon adaptuje praktyki Transformation Office: stage gates, jedno źródło
prawdy, jawnych ownerów, wspólną miarę wartości, rytm action-oriented review,
zarządzanie overlapami i aktywne usuwanie blokad. Portfolio uwzględnia
strategiczne dopasowanie, sponsorship/accountability, resource utilization i
capacity constraints. Źródła:

- [McKinsey — The role of the transformation office](https://www.mckinsey.com/capabilities/transformation/our-insights/the-role-of-the-transformation-office)
- [McKinsey — The transformation office: key success factors](https://www.mckinsey.com/capabilities/transformation/our-insights/the-transformation-office-key-success-factors/)
- [McKinsey — How transformation offices help tech-enabled transformations succeed](https://www.mckinsey.com/industries/industrials/our-insights/how-transformation-offices-help-tech-enabled-transformations-succeed)
- [PMI — The Standard for Portfolio Management](https://www.pmi.org/learning/library/pmi-standard-portfolio-management-8216)

To adaptacja publicznie opisanych praktyk, nie odwzorowanie zastrzeżonego
narzędzia ani twierdzenie o zgodności/certyfikacji McKinsey lub PMI.

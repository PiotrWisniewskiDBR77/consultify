---
doc_id: initiatives-market-benchmark-2026-07-31
module: Initiatives
truth_type: benchmark
status: DRAFT_FOR_OWNER_REVIEW
owner: product
prepared_by: codex
last_reviewed: 2026-07-31
---

# Initiatives — benchmark rozwiązań konkurencyjnych

## 1. Zakres

Analiza obejmuje systemy zarządzania popytem na zmianę, pomysłami, strategicznym
portfelem i decyzjami inwestycyjnymi:

- Planview Strategic Portfolio Management;
- ServiceNow Strategic Portfolio/Demand Management;
- Aha! Ideas/Roadmaps;
- Jira Product Discovery.

Źródłami są oficjalne strony produktów i dokumentacja producentów. Celem nie
jest kopiowanie ekranów, lecz wybór mechanizmów potrzebnych Consultify.

## 2. Wzorce konkurencji

### Planview — strategia, inwestycje i capacity

Najmocniejsze mechanizmy:

- jedno wejście dla wielu typów demand;
- ciągłe powiązanie strategii, finansowania, capacity i efektów;
- obiektywne kryteria priorytetyzacji;
- wiele scenariuszy portfolio;
- realokacja ludzi oraz pieniędzy po zmianie priorytetów;
- śledzenie investment-to-outcome;
- wsparcie agile, waterfall i hybrid bez narzucenia jednego sposobu wykonania.

Wniosek: decyzja o Initiative musi uwzględniać nie tylko jej własny score, ale
koszt alternatywny i wpływ na cały portfel.

### ServiceNow — demand pipeline i governance playbook

Najmocniejsze mechanizmy:

- centralny rejestr demand;
- konfigurowalny lifecycle i playbook oceny;
- zlecanie stakeholderom zadań analitycznych dotyczących kosztu, wysiłku,
  ryzyka i korzyści;
- ocena risk/value/size i porównanie na bubble chart;
- strategia, business capabilities, impacted units, assumptions i barriers;
- ryzyko wykonania oraz ryzyko niewykonania;
- scenariusze budżetu i zasobów;
- konwersja zatwierdzonego demand do różnych typów wykonania.

Wniosek: Initiative nie może być formularzem wypełnianym samotnie przez autora.
Brakujące analizy powinny być delegowane i wracać do jednego decision record.

### Aha! — zamknięta pętla pomysłów

Najmocniejsze mechanizmy:

- portal pomysłów i feedback wielu interesariuszy;
- konfigurowalny scorecard;
- confidence niższe, gdy wiedza jest jeszcze słaba;
- rank ordering oraz widoczne priority limits;
- zapisane i udostępniane widoki priorytetów;
- promowanie pomysłu do realizowanego obiektu z trwałym linkiem;
- powiadomienie autora/subskrybentów o decyzji i późniejszym dostarczeniu;
- zachowanie historycznego score pomysłu po jego promocji.

Wniosek: odrzucony lub odroczony kandydat nadal wymaga odpowiedzi. Autor powinien
wiedzieć, co się stało i dlaczego.

### Jira Product Discovery — insight, views i delivery link

Najmocniejsze mechanizmy:

- insight jako dowód powiązany z pomysłem;
- merge pomysłów;
- typy i hierarchie pomysłów;
- konfigurowalne pola oraz formuły;
- list, board, matrix i timeline nad tymi samymi danymi;
- publikowanie widoków dla interesariuszy;
- przejście do delivery i śledzenie jego postępu.

Wniosek: różne wizualizacje powinny być zapisanymi widokami jednego rejestru, a
nie osobnymi kopiami Initiative.

## 3. Funkcje rekomendowane dla Consultify

### A. List — obowiązkowe wejście

Jedna tabela wszystkich Initiative w różnych statusach:

- `Candidate`, `Draft`, `Defined`, `Analyzing`, `Ready for review`;
- `Approved`, `Rejected`, `Deferred`, `Merged`;
- `In execution`, `Completed`, `Stopped`, `Archived`.

Domyślnie tabela pokazuje aktywne i wymagające uwagi. Użytkownik może włączyć
dowolne statusy, stworzyć zapisany widok i udostępnić go zgodnie z
uprawnieniami.

### B. Demand/Candidate Inbox

- wszystkie źródła kandydatów w jednej kolejce;
- formularz ręczny i intake link dla pracowników;
- kontekst z Chat, Interview, Tools, Assessment, Audit, Finance i Results;
- evidence/insight attachment;
- subskrybenci i zainteresowane grupy;
- szybkie triage SLA;
- merge/extend/dismiss/defer/request clarification;
- feedback do zgłaszającego.

### C. Definition Playbook

- wersjonowany template zależny od typu Initiative;
- Teresa prowadząca od problemu do expected outcome;
- obowiązkowy wariant `do nothing`;
- in/out of scope;
- assumptions, barriers i constraints;
- risk of doing oraz risk of not doing;
- impacted capabilities, processes, units i stakeholders;
- wymagane dowody i readiness score.

### D. Analysis Workbench

- delegowane `Analysis Tasks` dla Finance, Results, Resource Managera,
  Security, Legal, Operations i ekspertów;
- koszt, benefit, effort, size, time to value, feasibility i risk;
- stakeholder assessments;
- evidence quality i confidence;
- sprzeczne oceny widoczne zamiast automatycznego uśredniania;
- deadline, owner, status i read-back każdej analizy.

### E. Scoring i prioritization

- registry wielu wersjonowanych modeli scoringu;
- model dobierany do typu Initiative;
- inline scoring i jawne wagi;
- rank order niezależny od score;
- priority limit pokazujący, ile organizacja realnie może podjąć;
- matrix/bubble view z dowolnymi osiami;
- confidence-adjusted view;
- sensitivity względem zmiany wag;
- snapshot score użyty w decyzji.

### F. Portfolio Scenario Lab

- approved/proposed/deferred/stopped w jednym scenariuszu;
- ograniczenia budżetu, capacity, kompetencji i czasu;
- mandatory/regulatory items;
- strategic allocation targets;
- add/remove/defer/split/merge;
- wpływ na cele, value, ryzyko, cash i capacity;
- porównanie scenariuszy;
- publikacja wybranego scenariusza po approval;
- zapis powodów realokacji.

### G. Funding i capacity gate

- źródło i envelope finansowania;
- capex/opex oraz lata/okresy;
- incremental/stage funding;
- rough-order capacity przed approval;
- potwierdzenie dostępności krytycznych kompetencji;
- rezerwacja dopiero po decyzji;
- zwolnienie capacity i środków po stop/defer;
- read-back z Finance i Execution.

### H. Portfolio hygiene

- przegląd Initiative bez ownera, danych lub aktywności;
- stale assumptions i nieaktualne business case;
- duplikaty i overlap;
- zombie Initiative;
- brak strategic alignment;
- utracona przewaga lub zmieniony kontekst;
- rekomendacja continue, refresh, merge, defer lub stop;
- obowiązkowy okresowy portfolio review.

### I. Roadmap i communication

- now/next/later oraz timeline;
- cele, programy i strategic themes;
- dependencies i planowane okna;
- roadmap scenario;
- stakeholder-friendly published view;
- snapshot i komentarz decyzji;
- bez kopiowania task planu z Execution.

### J. Decision Center

- kolejka decyzji i review;
- readiness gaps;
- decision brief Teresy;
- opcje oraz trade-offs;
- approver matrix;
- approve/reject/defer/merge/stop/conditional approve;
- conditions, expiry i follow-up;
- immutable decision snapshot;
- powiadomienie autora i interesariuszy.

### K. Handoff i closed loop

- idempotentny Execution Handoff Pack;
- link do approved version;
- progress read-back bez kopiowania tasków;
- Results outcome tracking;
- Finance benefits realization;
- feedback do autora Initiative;
- post-decision i post-outcome review;
- porównanie obietnicy, wykonania i efektu;
- lessons learned zasilające przyszłe decyzje.

## 4. Rekomendowana architektura obszarów

1. **List** — tabela wszystkich Initiative i statusów.
2. **Candidates** — intake, evidence, triage i feedback.
3. **Portfolio** — prioritization, scenarios, funding i capacity.
4. **Roadmap** — strategiczne ułożenie w czasie.
5. **Decisions** — review, gates i immutable decisions.

Functionality `Analysis Workbench`, `Funding`, `Hygiene` i `Handoff` jest
otwierana w kontekście Initiative albo Portfolio; nie wymaga kolejnych zakładek
najwyższego poziomu.

## 5. MVP

1. List wszystkich statusów.
2. Candidate Inbox ze źródłem i feedbackiem.
3. Definition Playbook prowadzony przez Teresę.
4. Deduplikacja, merge i extend.
5. Analysis Tasks oraz readiness.
6. KPI i Finance linki.
7. Wersjonowany scoring, rank i priority limit.
8. Portfolio Scenario Lab: budżet + capacity + strategic fit.
9. Decision Center i immutable snapshot.
10. Roadmap.
11. Execution Handoff i read-back.
12. Outcome/feedback loop.

## 6. Źródła

- [Planview Strategic Portfolio Management](https://www.planview.com/products-solutions/solutions/strategic-portfolio-management/)
- [Planview Project Portfolio Management](https://www.planview.com/products-solutions/solutions/project-portfolio-management/)
- [ServiceNow Demand Management](https://www.servicenow.com/products/demand-management.html)
- [ServiceNow — assessing demands](https://www.servicenow.com/docs/r/it-business-management/demand-management/c_AssessingDemands.html)
- [ServiceNow — demand lifecycle](https://www.servicenow.com/docs/r/it-business-management/demand-management/r_UsingDemandManagement.html)
- [ServiceNow Scenario Planning](https://www.servicenow.com/products/scenario-planning.html)
- [Aha! — ideas portal and promotion](https://support.aha.io/aha-roadmaps/support-articles/best-practices/launch-your-ideas-portal~7444671363924936410)
- [Aha! — prioritization](https://support.aha.io/aha-roadmaps/support-articles/ideas/ideas-prioritization-page~7444635756077135515)
- [Jira Product Discovery resources](https://support.atlassian.com/jira-product-discovery/resources/)

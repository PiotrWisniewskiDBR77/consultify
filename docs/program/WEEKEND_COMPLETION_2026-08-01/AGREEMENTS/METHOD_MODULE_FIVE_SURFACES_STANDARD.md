---
document_id: METHOD-MODULE-FIVE-SURFACES-STANDARD
modules: Tools / Assessment / Audits
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Wspólny standard pięciu powierzchni modułów metodycznych

## 1. Kanoniczna nawigacja

Tools, Assessment i Audits używają dokładnie tej samej kolejności:

1. **Library**
2. **Processes**
3. **Outputs**
4. **Deliverables**
5. **Initiatives**

| Powierzchnia | Wspólne pytanie | Tools | Assessment | Audits |
| --- | --- | --- | --- | --- |
| Library | Jakiej metody użyć? | Tool Template | Methodology Pack | Audit Standard/Program Template |
| Processes | Nad czym pracujemy? | Tool Session | Assessment | Audit Engagement |
| Outputs | Jaki wynik zatwierdziliśmy? | Tool Output | Assessment Result | Audit Result/Findings Package |
| Deliverables | Jak wynik opakowano i udostępniono? | report/deck/sheet | assessment report/deck | audit/corrective reports/deck |
| Initiatives | Jaką zmianę warto rozważyć? | Proposal Drafts z moves | Proposal Drafts z maturity gaps | Proposal Drafts z findings/corrective needs |

Nazwy pięciu zakładek są wspólne. W nagłówku i kolumnach Processes używamy
języka domeny, np. `Tool Session`, `Assessment` albo `Audit`.

## 2. Library

Cel: zrozumieć, porównać i wybrać metodę przed rozpoczęciem pracy.

Funkcje:

- browse/search/filter/list-grid/favorites/recent/recommended;
- when to use/not use, inputs, participants, time, complexity i outcomes;
- method preview, visual example i optional micro-demo;
- compare side-by-side;
- Teresa `Help me choose` także między modułami;
- availability, readiness, version, license, qualification i permissions;
- `Start process` z setup summary przed utworzeniem;
- template/method source, owner i changelog.

## 3. Processes

Cel: zarządzać całą edytowalną pracą przed finalizacją.

Wspólne funkcje:

- jedna tabela procesów wszystkich statusów;
- My Processes, Needs My Action, Team, In Review, Blocked i History;
- status, phase/stage, owner/lead, project, participants, readiness, due, next
  action, last activity i save/freshness;
- filters/grouping/saved views/StandardPreview;
- create, resume, copy-as-new, share/link, archive;
- assignments, evidence requests, review tasks i decisions jako filtry/panele,
  nie osobna główna zakładka;
- otwarcie domenowego Workspace;
- autosave, version, collaboration, comments, history i review;
- Teresa resume summary, missing work i next action.

Workspace jest szczegółem procesu, nie szóstą zakładką. Każda domena posiada
własne phases i obiekty, ale korzysta ze wspólnego shellu, save/exit/resume,
AI proposal i approval semantics.

Wspólny shell nie oznacza identycznego środkowego UX. Tools używa metodycznego
Canvas i faz, Assessment używa sekwencyjnego Interview Focus oraz interaktywnej
macierzy, a Audits może używać programu/arkusza findings. Wspólność dotyczy
nawigacji systemowej, stanów i semantyki pracy.

## 4. Outputs

Cel: utrzymywać natywny, zatwierdzony i nieedytowalny wynik dokładnej wersji
procesu.

Wspólne reguły:

- finalizacja Process tworzy immutable Output;
- korekta tworzy revised Process/version i nowy Output;
- Output zawiera accepted structured content, sources/evidence, methodology
  version, quality review, approvals, limitations i provenance;
- jedna tabela z type, source process, owner, finalized at, quality, freshness,
  downstream state i supersession;
- native preview i source drill-down;
- create Deliverable i create Proposal Draft jako niezależne akcje;
- nie można edytować historycznego Outputu.

Domenowe Outputs:

- Tools — macierz/model/insights/moves/final source summary;
- Assessment — approved score, dimension results, maturity baseline/gaps,
  findings, target/pathway;
- Audits — approved findings, evidence conclusions, grading, nonconformities,
  corrective requirements i closure state.

## 5. Deliverables

Cel: pokazać wszystkie materiały wygenerowane z Outputów dla określonych
odbiorców i celów.

Funkcje:

- documents/reports, presentations, sheets/models, diagrams i exports;
- Setup/assumptions/outline approval przed generacją;
- template, brand, language, audience, purpose i confidentiality;
- Draft, In Review, Approved, Published, Superseded i Failed;
- preview/edit/review/publish/download/share;
- source mapping do Output/evidence i update available;
- wiele Deliverables z Outputu, wiele Outputs w Deliverable;
- read-back do modułu źródłowego.

Materials jest właścicielem artefaktu. Zakładka jest filtrowaną projekcją, nie
kopią danych.

## 6. Initiatives

Cel: przygotować lokalne Initiative Proposal Drafts z zatwierdzonych wyników,
bez automatycznego zapełniania wspólnego rejestru Initiatives.

Funkcje:

- generate zero/one/many drafts z accepted findings/moves/gaps;
- draft editor: problem, outcome, scope, KPI proposal, evidence, risk,
  assumptions i confidence;
- dedup/overlap check i compare with Registered Initiatives;
- link wielu findings do jednego draftu i split jednego findingu;
- send to Candidates, read validation status i open Registered Initiative;
- source/output/version lineage;
- Return/clarify/defer/dismiss feedback z Candidates.

Deliverable nie jest obowiązkową bramką. Proposal Draft linkuje bezpośrednio do
Output/evidence i opcjonalnie do materiału komunikacyjnego.

## 7. Assignments i My Work

Assignments nie są szóstą zakładką. Są wspólnym mechanizmem:

- w Processes: `Needs My Action`, role, respondent/evidence/reviewer queue;
- w Workspace: assignment do konkretnego obiektu/fazy;
- w My Work: osobista projekcja Tasks, Decisions, Reviews i Evidence Requests;
- w Notifications: actionable reminder/escalation z deep linkiem.

Każde assignment ma project/process/object, role, expected action, due/SLA,
status, owner, acceptance i escalation. Nie tworzymy oddzielnych kopii.

## 8. Wspólny lifecycle

```text
Template selected
→ Process Draft/Active
→ Needs Input/Review
→ Approved/Finalized
→ immutable Output
→ optional Deliverables
→ optional Initiative Proposal Drafts
→ Candidates validation
```

Audit i Assessment mogą posiadać domenowe statusy wewnątrz Process, ale mapują
je do wspólnych grup widoku.

## 9. Teresa i lokalne AI

W każdej powierzchni obowiązują dwa poziomy:

- Teresa prowadzi rozmowę, wybór metody, proces i quality coaching;
- lokalne akcje AI wykonują konkretną operację na znanym zakresie.

Rozmowa i przycisk korzystają z tej samej capability oraz proposal queue.
Teresa nie finalizuje, nie publikuje i nie rejestruje Initiative.

## 10. Wspólny UI/UX

- ten sam module shell i kolejność pięciu tabs;
- Library: list/grid + preview + compare;
- Processes/Outputs/Deliverables/Initiatives: table + StandardPreview;
- jedna Command Row i Menu 3;
- wspólna semantyka statusów, kolorów, AI proposals, save i freshness;
- stabilne deep links oraz zachowanie filtrów po powrocie;
- empty/loading/error/degraded/success i accessibility;
- domenowe grafiki nie zmieniają systemowej nawigacji.

## 11. Kryteria odbioru

- użytkownik uczący się jednego modułu rozumie dwa pozostałe;
- wszystkie moduły otwierają Library i mają dokładnie pięć tabs;
- definicje, procesy, Outputs i Deliverables są różnymi obiektami;
- Assignments trafiają do Processes/My Work, nie tworzą szóstej prawdy;
- finalized result jest immutable;
- Materials jest ownerem Deliverables;
- Initiatives zawiera Proposal Drafts, nie Registered Initiatives;
- wspólny lifecycle, AI semantics i UI states mają testy kontraktowe;
- domenowe golden flows przechodzą start→process→output→deliverable/proposal.

---
document_id: IDEAS-PROCESS-FLOW-INTERACTION-VISUAL-STANDARD
module: My Work / Ideas / Process Flow
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
benchmark_reviewed: Miro, Lucidchart
---

# Process Flow — interakcje, menu i standard wizualny

## 1. Cel

Process Flow ma pozwolić osobie nietechnicznej poprawnie odwzorować proces,
zweryfikować go z uczestnikami i zaprojektować stan docelowy. Dokument definiuje
język diagramu, menu, zachowania, wygląd, AI, walidację i granicę Run Agent.

## 2. Cztery sposoby rozpoczęcia

### A. Blank flow

Start, pierwsza activity i end; użytkownik rozwija proces ręcznie.

### B. Template

Starter ustawia orientację, lanes, typowe kroki i checklistę jakości.

### C. Generate with Teresa

Brief: purpose, trigger, outcome, scope, participants/roles, AS-IS czy TO-BE,
źródła, poziom szczegółowości i exceptions. Teresa proponuje najpierw outline
kroków i lanes, potem diagram jako proposal.

### D. Import/transform

Źródło: SOP, transcript, Table, Mind Map albo Whiteboard. Mapping preview
oddziela kroki jawne, inferred i unresolved.

## 3. Prosty język procesu P0

| Element | Znaczenie | Wymagane minimum |
| --- | --- | --- |
| Start | trigger procesu | nazwa zdarzenia |
| Activity | praca wykonywana | verb + object, owner/lane |
| Decision | rozgałęzienie | pytanie i opisane wyjścia |
| Approval | formalna zgoda | approver i rezultat |
| Wait | oczekiwanie | warunek/czas |
| Subprocess | odwołanie do szczegółów | linked artifact lub opis |
| Risk/Control | ryzyko albo kontrola | reason/evidence |
| Handoff | przekazanie odpowiedzialności/systemu | from/to i payload |
| End | outcome końcowy | rezultat/status |

Nie wymagamy BPMN w core MVP. Opcjonalny profil BPMN może być późniejszym
adapterem, nie ukrytą semantyką podstawowych kształtów.

## 4. Model danych

Flow Artifact ma variants, nodes, transitions, lanes, roles/systems, inputs,
outputs, metrics, risks/controls, sources, validations, comments, proposals,
snapshots i handoffs.

Node przechowuje ID/type/title/description, lane/owner, input/output, system,
duration/wait, evidence, status i provenance. Transition ma source/target,
condition, label, default/exception i validation state. Lane reprezentuje rolę,
zespół, system lub fazę — typ jest jawny.

## 5. Menu 2

Wspólny shell Ideas. Process Flow pokazuje dodatkowo badge `AS-IS`, `TO-BE` lub
variant oraz validation readiness. Variant switcher nie zastępuje artifact
switchera.

## 6. Menu 3

### Lewa strefa

- undo/redo;
- variant: AS-IS/TO-BE/compare;
- orientation: left-right/top-down;
- auto/manual layout i tidy;
- zoom/minimap/focus;
- search;
- history.

### Środek

- Lanes;
- Roles/Systems overlay;
- Inputs/Outputs;
- Time/Wait;
- Risks/Controls;
- Validate;
- Compare;
- Presentation.

### Prawa strefa

- Teresa;
- Generate/Complete;
- Find missing paths;
- Bottlenecks;
- Challenge controls;
- Redesign TO-BE;
- Transform;
- Prepare Run Agent;
- Handoff/Export.

## 7. Toolbar i inspector

Lewy toolbar: select/hand, start/end, activity, decision, approval, wait,
subprocess, risk/control, handoff, connector i lane.

Inspector zakładki:

- Properties;
- Responsibility;
- Input/Output;
- Condition;
- Time/Metric;
- Risk/Control;
- Source/Evidence;
- Comments;
- History.

Wymagane pola są progresywne. Szkic można szybko narysować, a validation
prowadzi do uzupełnienia przed review/handoff.

## 8. Nawigacja i interakcje

| Gest | Zachowanie |
| --- | --- |
| click/double click node | select/edit title |
| drag node | move; lane target pokazuje preview owner change |
| drag connector handle | new transition with snap preview |
| drop connector on canvas | quick-create compatible node menu |
| click edge label | edit condition/label |
| drag lane control | resize/add/reorder lane bez gubienia children |
| selection rectangle | multi-select |
| Space+drag / pinch | pan/zoom |
| follow path | podświetl upstream/downstream |

Przeniesienie node'a do innej lane zmienia responsibility dopiero po drop i
pokazuje diff. Cross-lane edge jest automatycznie traktowany jako handoff signal,
ale nie zmienia node type bez decyzji.

## 9. Klawiatura

- `V/H/L`: select/hand/connect;
- `Enter/F2`: edit;
- `Tab`: next node w logicznym path;
- `Shift+Tab`: previous;
- arrows: spatial navigation;
- `Cmd/Ctrl+Enter`: quick-create next activity;
- `D`: decision, `A`: activity w trybie canvas bez text edit;
- `Cmd/Ctrl+D`: duplicate;
- `Delete`: delete preview z impactem na paths;
- `Cmd/Ctrl+Z`: undo;
- `Cmd/Ctrl+F/K`: search/command palette;
- `0/1`: fit/100%;
- `F1`: shortcuts.

Delete node między dwoma krokami oferuje `Delete and reconnect`, `Delete with
edges`, `Cancel`. Dla Decision nigdy nie łączy ścieżek automatycznie.

## 10. Menu prawego przycisku

Canvas: add element/lane, paste, template, import, Ask Teresa, fit, snapshot.

Node: edit, add next, insert before/after, replace type, duplicate, move lane,
link subprocess, set IO/owner, add risk/control/source/comment, Ask Teresa,
transform/handoff, delete.

Transition: edit condition, set default/exception, direction/style, insert node,
source/comment, delete.

Lane: rename/type, add before/after, reorder, owner/system, collapse, select
contents, transform/export, delete with reassignment preview.

Multi-select: group/subprocess, align/distribute, set lane/owner, validate,
transform, export i delete.

## 11. Tworzenie i łączenie

- node ma cztery connector handles;
- drag pokazuje kompatybilne targety;
- auto-create menu preferuje Activity/Decision/End;
- Decision wymaga ≥2 opisanych outcomes albo warning;
- jeden default path maksymalnie;
- cross-link i primary sequence są wizualnie rozróżnione;
- edge crossing ogranicza auto-layout;
- snap/grid pomaga, ale można go wyłączyć;
- align/distribute nie zmienia lane ani sequence.

## 12. Swimlanes

Lane może oznaczać `Role`, `Team`, `System` albo `Phase`. Typ jest widoczny w
headerze. Horizontal/vertical orientation jest ustawieniem artefaktu.

- add/reorder/resize;
- collapse z liczbą ukrytych nodes/issues;
- sticky header podczas pan;
- lane owner i reviewer;
- WIP/time/issue summary opcjonalnie;
- node nie może „wypaść” z lane po layout;
- usunięcie lane wymaga mappingu children.

## 13. AS-IS, TO-BE i warianty

AS-IS opisuje potwierdzony obecny proces i źródła. TO-BE jest proposalem.
Użytkownik może forkować wariant, a compare pokazuje added/removed/changed,
owner/IO/condition/time impact i assumptions.

Accept TO-BE wymaga Process Ownera i wskazanych lane reviewers według policy.
Akceptacja nie uruchamia procesu, Tasks ani Run Agent.

## 14. Walidacja

Raport grupuje:

- structural blockers: missing start/end, orphan, dead end, invalid target;
- decision gaps: missing/duplicate conditions, no default when required;
- responsibility: missing owner/lane, ambiguous handoff;
- IO: missing required input/output;
- evidence: unsupported AS-IS claim;
- risk/control: critical risk without response;
- readiness: unresolved assumptions, permissions, Run Agent incompatibility.

Kliknięcie findingu prowadzi do dokładnego node/edge. Warning można zaakceptować
z reason; blocker nie przechodzi przez required gate.

## 15. Teresa

Na całym Flow: source-to-flow, propose lanes, complete paths, find bottlenecks,
identify waste/rework, challenge assumptions/controls, generate TO-BE variants.

Na node/path: clarify activity, suggest owner/IO, exceptions, next step,
alternative, risk/control i evidence question.

Proposal pokazuje before/after graph oraz listę zmian. Teresa nie potwierdza
AS-IS, nie przypisuje ludzi, nie zatwierdza TO-BE i nie uruchamia Run Agent.

## 16. 12 template

1. Simple Business Process;
2. Cross-functional Swimlane;
3. Approval Workflow;
4. Customer Journey/Service Flow;
5. Information/Data Flow;
6. Incident/Problem Resolution;
7. Sales/Lead Process;
8. Procurement/Supplier Process;
9. Product/Change Request;
10. Audit/Corrective Action Flow;
11. Employee Onboarding;
12. AS-IS → TO-BE Improvement.

Template zawiera scope questions, node/lanes starter, validation profile,
recommended Teresa actions i downstream options.

## 17. Import/export i integracje

Import: document/SOP, outline, CSV step list, BPMN only with verified parser,
Interview/Meeting/Tool output i Ideas transform. Każdy inferred step/condition
jest oznaczony.

Export: PNG/SVG/PDF, structured step table, process narrative, PPT scenes,
optional BPMN adapter. Export pokazuje variant, version, sources i status.

Integracje: Table (step register), Map (causes/dependencies), Whiteboard
(redesign workshop), Tasks/Decisions/Initiatives/Materials oraz Run Agent.

## 18. Run Agent boundary

`Prepare Run Agent` generuje proposal zawierający steps, inputs/outputs,
credentials needs, approvals, retries, timeouts, human checkpoints, failure
policy i unsupported nodes. Run Agent wykonuje osobny feasibility/security test.

Flow nigdy nie udaje, że diagram jest executable. Unsupported elementy blokują
automatyczny transfer albo stają się human steps po jawnej decyzji.

## 19. Standard wizualny

- activity: rounded rectangle;
- decision: diamond;
- start/end: rozpoznawalne terminators;
- approval/risk/control/handoff: spójne ikony + subtelne warianty;
- lanes spokojne, header czytelny, bez ciężkich ramek;
- primary path mocniejszy niż relations;
- conditions umieszczone przy wyjściu decision;
- error/warning/proposal/source nie polega tylko na kolorze;
- AS-IS neutralny, TO-BE proposal ma subtelny overlay;
- selection/focus/path highlight nie przesuwa grafu;
- dark/light, kontrast i reduced motion.

## 20. Collaboration, mobile i performance

Walkthrough mode prowadzi uczestników po krokach. Comments są anchored,
reviewer może potwierdzić lane/path. Konflikty structural edits są wersjonowane.

Tablet: pełny browse/edit podstawowy; mobile: walkthrough, comment, validation i
light edit. Large flows używają collapse/subprocess, virtualization i
background layout. Screen reader odczytuje node type, lane i incoming/outgoing
connectors; keyboard connector list jest dostępna.

## 21. MVP i luki

P0: cztery starty, 12 template, core node/edge/lane, conditions, IO/owner,
AS-IS/TO-BE, validation, sources/comments/history, AI proposals, transform,
exports oraz controlled handoffs.

Luki: multi-artifact storage, jeden readiness report, pełny compare, wspólny
shell visual QA, Run Agent gate/read-back, import semantic QA, mobile/accessibility
i E2E `SOP → AS-IS → TO-BE → approval → handoff`.

P1: BPMN adapter, deeper analytics i Meeting walkthrough. P2: process mining,
quantitative simulation i execution — tylko w odpowiednich systemach.

## 22. Testy odbiorcze

- keyboard-only blank flow;
- SOP import z inferred/missing steps;
- decision branches validation;
- lane move z owner diff;
- AS-IS → TO-BE fork/compare/approval;
- Teresa proposal selective accept/undo;
- Flow ↔ Table/Board transforms;
- Run Agent proposal z unsupported node;
- restricted source bez leakage;
- exit/resume/conflict recovery.

## 23. Benchmark

Z Miro/Lucidchart przyjmujemy shape grammar, connector handles, quick-create,
themes, swimlanes i diagram templates. Consultify upraszcza formalizm, dodaje
evidence, validation, AS-IS/TO-BE governance oraz twardą granicę wykonania.

Źródła:

- https://help.miro.com/hc/en-us/articles/4403634496402-Miro-for-mapping-diagramming
- https://help.miro.com/hc/en-us/articles/360017730733-Connection-lines
- https://help.lucid.co/hc/en-us/sections/14660069795860-Get-started

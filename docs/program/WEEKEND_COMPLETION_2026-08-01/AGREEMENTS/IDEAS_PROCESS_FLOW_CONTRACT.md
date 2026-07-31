---
document_id: IDEAS-PROCESS-FLOW-CONTRACT
module: My Work / Ideas
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Ideas — Process Flow

Szczegółowy, normatywny opis języka procesu, startów, Menu 2/3, sterowania,
swimlanes, AS-IS/TO-BE, walidacji, grafiki, 12 template i Run Agent boundary:
[`IDEAS_PROCESS_FLOW_INTERACTION_AND_VISUAL_STANDARD.md`](IDEAS_PROCESS_FLOW_INTERACTION_AND_VISUAL_STANDARD.md).

## 1. Cel

Process Flow opisuje, jak praca, informacja albo decyzja przepływa od startu do
wyniku. Pozwala zrozumieć stan obecny, zaprojektować stan docelowy i wykryć
wąskie gardła. Nie wykonuje procesu i nie jest silnikiem automatyzacji.

## 2. Obiekty

- start/end, activity, subprocess, decision, approval, wait, risk i handoff;
- edge/transition z warunkiem;
- lane/role/system;
- input, output, evidence, metric i issue;
- AS-IS/TO-BE variant oraz relation między krokami;
- validation/readiness state i source reference.

## 3. Funkcje

1. tworzenie kroków, połączeń, warunków i lanes;
2. templates dla process, journey, approval i information flow;
3. AS-IS/TO-BE oraz compare;
4. sequence validation: orphan, dead end, loop i missing condition;
5. ownership/RACI, inputs/outputs i system mapping;
6. bottleneck, delay, risk, duplicate work i control analysis;
7. comments, evidence, snapshots i presentation;
8. transform z/do Mind Map, Table i Whiteboard;
9. proposals dla Task, Decision, Initiative lub Tool;
10. export do grafiki, dokumentu i prezentacji.

## 4. Teresa

Może z rozmowy lub źródeł zaproponować flow, brakujące kroki, warunki, wyjątki,
role, bottlenecks i target design. Nie wymyśla wykonywanego procesu, nie uznaje
TO-BE za zatwierdzony i nie uruchamia workflow. Każda zmiana semantyczna ma
diff i source posture.

## 5. Standard jakości

Flow ma jednoznaczny początek/koniec, outcome, ownerów lanes, opisane decyzje i
warunki, inputs/outputs, wyjątki, brak osieroconych elementów oraz rozdzielenie
AS-IS od TO-BE. Handoff poza moduł jest jawny.

## 6. Granice

- wolna burza mózgów należy do Whiteboard;
- relacyjna dekompozycja problemu należy do Mind Map;
- porównanie wielu kroków według pól należy do Table;
- uruchamianie automatyzacji należy do Run Agent;
- realizacja planu należy do Execution.

## 7. Golden flow i DoD

`define scope/outcome → map AS-IS → validate with participants/evidence → detect
issues → design TO-BE variants → compare → accept target flow → hand off`

DoD: poprawne edge/condition editing, lanes, save/undo, validation, version
compare, export, transform lineage oraz handoff do Run Agent/Initiatives/Tasks
mają jawne preview i testy.

## 8. Menu i anatomia

Process Flow stosuje wspólny
[`shell Ideas`](IDEAS_ARTIFACT_SHARED_SHELL_AND_MENU_STANDARD.md).

Specyficzne Menu 3:

- AS-IS/TO-BE/compare;
- layout/orientation i lane controls;
- validate flow;
- roles/systems/data overlay;
- bottleneck/risk/control analysis;
- AI: generate, complete, challenge, redesign, explain;
- simulate path jako analiza, nie wykonanie workflow;
- export/handoff to Run Agent proposal.

Lewy toolbar: start/end, activity, subprocess, decision, approval, wait, risk,
handoff, connector i lane. Inspector: step purpose, owner, input/output,
condition, SLA/time, system, evidence, risk i comments.

## 9. Pełny katalog funkcji

| Grupa | Funkcje |
| --- | --- |
| Model | nodes, transitions, conditions, lanes, subprocesses, variants |
| Edit | connect, reconnect, group, align, auto-layout, duplicate, replace type |
| Describe | purpose, owner, input/output, system, time, control, evidence |
| Validate | orphan/dead-end, invalid condition, missing owner/output, loop review |
| Analyse | bottleneck, wait, risk, rework, handoff, automation opportunity |
| Compare | AS-IS vs TO-BE, variants, impact and assumptions |
| Collaborate | walkthrough, comments, mentions, review and acceptance |
| AI | source-to-flow, missing path, exception, role and redesign proposals |
| Transform | Flow ↔ Map/Table/Whiteboard with semantic mapping |
| Handoff | Tasks/Decisions/Initiative/Tool/Run Agent proposals |

## 10. Wejścia, wyjścia i integracje

Wejścia: SOP/document, transcript, step table, map, workshop board, Tool Output
albo rozmowa z Teresą. Imported process pozostaje draftem do walkthrough.

Wyjścia: diagram/render, process description, improvement candidates, controls,
derived artifacts i Run Agent proposal. Run Agent wymaga osobnej walidacji
wykonywalności, credentials, error handling i approval.

## 11. Role, stany i bezpieczeństwo

Process Owner zatwierdza semantykę; Facilitator/Editor modeluje; Domain
Contributors potwierdzają lanes; Reviewer akceptuje TO-BE. Restricted system
details i dane są maskowane w export/AI.

Stany dodatkowe: invalid graph, incomplete branch, unowned handoff, stale
source, compare conflict, unsupported automation step i validation warning.

## 12. MVP i później

P0: podstawowe node/edge/lane, conditions, properties, validation, AS-IS/TO-BE,
save/history, AI proposal, transform, export i handoff.

P1: variant compare, deeper bottleneck/control analysis oraz Run Agent mapping.
P2: symulacja ilościowa, process mining i automatyczne wykonanie — poza Ideas i
poza MVP.

## 13. Test odbiorczy

`import SOP → generate draft flow → walkthrough and correct → validate branches
→ mark bottlenecks/evidence → create TO-BE → compare → transform steps to Table
→ prepare Run Agent/Initiative proposal → owner read-back`.

## 14. AS-IS, MVP, wejścia/wyjścia i pytania

Macierz dowodów, braków i decyzji `PF-Q01..05` znajduje się w
[`IDEAS_FOUR_TOOLS_AS_IS_MVP_GAPS_AND_QUESTIONS.md`](IDEAS_FOUR_TOOLS_AS_IS_MVP_GAPS_AND_QUESTIONS.md).
Najważniejsze granice to brak automatycznego wykonania, rozdzielenie AS-IS/TO-BE
oraz osobna walidacja przed przejściem do Run Agent.

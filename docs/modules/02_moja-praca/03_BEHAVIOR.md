---
module_id: MODULE_MY_WORK
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Behavior — Moja Praca / My Work

## Runtime Behavior (As-Is)

- `/my-work/*` opens `MyWorkView`, which mounts `MyWorkHub` inside `SplitLayout`.
- `MyWorkHub` manages module tabs for personal execution surfaces (home, ideas, notebook, inbox, calendar, tasks, decisions, manager).
- Hub runtime integrates context-aware chat opening and cross-module links (for example outputs/library paths and artifact links).
- Heavy detail surfaces are lazy-loaded in hub code (task/decision/detail/calendar/workspace views).

## RADAR Behavior Contract (As-Is + Scope Freeze)

### Responsibility boundary

- `MW_HOME_RADAR` is a pre-initiative attention and triage layer.
- Radar must answer: "where are we versus technology change, what is relevant, and what should we explore next?"
- Radar must not become:
  - project execution cockpit,
  - task manager replacement,
  - initiative lifecycle owner.
  - operational event command queue.

### Runtime signal flow (As-Is)

- Frontend:
  - Home data and pulse blocks are rendered by `HomeView` + `useHomeData`.
  - Radar-specific cards and prioritization surface through `useRadarData`, `useRadarTriageData`, and `RadarTriageCard`.
- Backend:
  - Home/radar payloads resolve under `/api/my-work/home/*` and `/api/my-work/radar*`.
  - Triage ranking + handoff contract resolves under `/api/v8/radar-triage/*`.
- Prioritization semantics:
  - triage cards expose `priorityLevel` (`P0|P1|P2`) and numeric `score`,
  - hard-gate conditions (`triggeredRules`) increase urgency posture,
  - degraded states are explicit (`degraded_*`, `blocked_permission`).

### Function Runtime Breakdown (As-Is)

- Core functions: `MW_HOME_RADAR`, `MW_NOTEBOOK`, `MW_INBOX`, `MW_CALENDAR`, `MW_TASKS`, `MW_DECISIONS`, `MW_MANAGER` are routed and controlled by tab/runtime state in `MyWorkHub`.
- Ideas parent function: `MW_IDEAS` owns idea list + idea workspace entry.
- Ideas subfunctions (tool modes): `MW_IDEAS_MINDMAP`, `MW_IDEAS_TABLE`, `MW_IDEAS_PROCESS_FLOW`, `MW_IDEAS_WHITEBOARD` run inside the shared idea workspace and switch through `IdeaWorkspaceToolbar`.

## State Handling (As-Is)

- Module state is controlled in-hub (active tab, filters, view modes, open documents, selection state).
- Runtime handles pilot-access and feature-flag conditional behavior through explicit utility checks/hooks.
- Hub stores/reads persistent UI preferences and open-document state for continuity.
- Ideas workspace manages multi-tool local state (active tool, active panel, selection, graph/runtime context) and explicit cross-tool transforms.

## Ideas Family Behavior Contract (Unified)

`MW_IDEAS` is one `Idea` family inside `02_moja-praca`, implemented through four formats: `MW_IDEAS_MINDMAP`, `MW_IDEAS_TABLE`, `MW_IDEAS_PROCESS_FLOW`, and `MW_IDEAS_WHITEBOARD`.

### Common purpose

- Convert ambiguous thinking into reviewed, source-aware work candidates.
- Preserve one idea context while the user changes format.
- Keep My Work as the workspace/orchestration owner, not the canonical owner for initiatives, execution state, documents, presentations or outputs.

### Format boundaries

| Format | Primary behavior | Boundary |
| --- | --- | --- |
| Mind Map | Relationship graph, clusters, dependency/evidence gaps. | Does not own row scoring, process readiness or workshop session state. |
| Table | Rows, fields, views, sort/filter/group, scoring, validation. | Does not become a generic database, spreadsheet or downstream owner. |
| Process Flow | Nodes, edges, lanes, conditions, dependencies, readiness gates. | Does not execute workflows or mutate owner-module lifecycle silently. |
| Whiteboard | Free-form facilitation, synthesis, session phase, outcomes and snapshots. | Does not become PMO/task board or unreviewed owner of downstream artifacts. |

### Switching and handoff rules

- Switching between formats is an explicit transform from selected scope or full idea context.
- Transform payload must include source format, selected ids, source/evidence refs, provenance posture, validation/readiness state and intent.
- Lossy transforms must land as `draft/needs_review`, not approved truth.
- Handoff to `05_inicjatywy`, `06_realizacja` or artifact lanes creates candidate payloads only.
- Owner modules own canonical mutation, approval/read-back and lifecycle status.

### Shared behavior invariants

- AI output is proposal until explicitly accepted.
- Critical elements require visible provenance/evidence or explicit assumption.
- High-impact conversion follows `proposal -> approval -> handoff -> owner review/read-back`.
- Menu 3/right command row is the only location for contextual AI actions; canvas controls must not duplicate the same AI action set.
- Tenant/ACL uncertainty uses deny-by-default and visible restricted/degraded state.

## Ideas Mind Map Behavior Contract (`MW_IDEAS_MINDMAP`)

### Decision boundary (scope lock)

- `MW_IDEAS_MINDMAP` to format `Idea` w module `02_moja-praca`, a nie osobny modul.
- Mind Map odpowiada za strukture myslenia (nodes/edges/grouping/provenance), nie za bezposrednie wykonywanie lifecycle owner objects w innych modulach.
- Kazdy high-impact efekt musi przejsc przez jawny handoff i owner review flow.

### Job-to-be-done (when user chooses Mind Map)

- User wybiera Mind Map, gdy chce:
  - uporzadkowac chaos notatek/insightow w graf relacji,
  - zobaczyc zaleznosci i luki evidence,
  - przygotowac material do dalszych dzialan (task/inicjatywa/decyzja/artifact).
- Wynik:
  - powstaje mapa z czytelna struktura argumentacji i provenance,
  - user dostaje bezpieczny punkt przejscia do downstream functions.

### Runtime structure contract (nodes, relations, grouping)

- Nodes:
  - reprezentuja co najmniej: problem, hipoteze, opcje, ryzyko, evidence, next-step.
- Relations:
  - lacza przyczynowosc, zaleznosc, wsparcie evidence, konflikt i kolejnosc.
- Grouping:
  - klastrowanie tematyczne i/lub etapowe jest jawne, nie implicit.
- Action transitions:
  - przejscie z node/selection do `convert` lub quick-action jest zawsze explicit i audytowalne.

### Source / provenance / evidence behavior

- Kazdy krytyczny element mapy musi miec mozliwy do odczytu status pochodzenia:
  - user-authored,
  - AI-suggested,
  - imported/reference-backed.
- Suggestie bez evidence sa dozwolone jako draft, ale nie jako approved truth dla handoffu high-impact.
- Mapa musi zachowac source refs przy cross-tool transform (`mindmap <-> table/process_flow/whiteboard`).

### AI suggestion vs approved truth behavior

- `AI suggestion`:
  - propozycja robocza widoczna z provenance i confidence context.
- `Approved truth`:
  - element jawnie zatwierdzony przez usera do dalszego wykorzystania.
- Zakaz:
  - brak cichego podmiany tresci mapy i brak cichego zatwierdzania rekomendacji AI.

### Handoff behavior (export to next functions/modules)

- `MW_IDEAS_MINDMAP` moze przekazywac selection/idea context do:
  - funkcji Ideas (Table/Process Flow/Whiteboard),
  - `05_inicjatywy`,
  - `06_realizacja`,
  - owner artifact lanes.
- Handoff payload musi niesc source/evidence context oraz intent.
- Sukces handoffu nie moze byc komunikowany jako "owner mutation done" bez read-back owner flow.

## Ideas Table Behavior Contract (`MW_IDEAS_TABLE`)

### Decision boundary (scope lock)

- `MW_IDEAS_TABLE` to format funkcji `Idea` w module `02_moja-praca`, nie osobny modul i nie runtime code change w tym cyklu.
- Table odpowiada za strukturalne myslenie: rows, columns, field types, views, sort/filter/group, statuses, scoring, validation i provenance.
- Table nie jest mini-Excelem ani generyczna baza danych; jest consulting decision artifact dla idei, problemow, hipotez, ryzyk, decyzji, inicjatyw i dzialan.
- Kazdy high-impact efekt (`task`, `initiative`, `workflow`, owner artifact) musi przejsc przez explicit handoff i owner review/read-back.

### Job-to-be-done (when user chooses Table)

- User wybiera Table, gdy chce:
  - porownac wiele rekordow wedlug wspolnych kryteriow,
  - filtrowac, sortowac, grupowac i priorytetyzowac idee lub problemy,
  - przypisac status, ownera, ryzyko, confidence, next step i source refs,
  - przygotowac material do taskow, inicjatyw, workflow lub artifactow.
- Wynik:
  - powstaje uporzadkowany table artifact z jawna semantyka kolumn,
  - user widzi, ktore wartosci sa user-authored, AI-suggested, source-backed lub assumption,
  - downstream conversion jest mozliwy bez zgadywania provenance.

### Runtime structure contract (records, columns, views)

- Records:
  - reprezentuja co najmniej: idea, problem, hypothesis, risk, decision option, action, initiative candidate, evidence item.
- Columns / field types:
  - wymagane minimum: title/name, description, status, owner, priority/score, source/evidence, confidence, next step;
  - dozwolone typy: text, long text, number/score, select, multi-select, status, owner/user, date, checkbox, source ref, linked artifact, formula/derived, AI generated value.
- Views:
  - grid/table view jest bazowy;
  - saved views moga utrwalac visible columns, filters, sorting, grouping, density i focus context;
  - `tpTable` i `tpView` deep-linki musza byc obslugiwane jawnie albo uczciwie zdegradowane do default view.
- Sort/filter/group:
  - nie moga zmieniac tozsamosci rekordu ani ukrywac aktywnych warunkow;
  - grouping jest explicit wedlug pola, nie ukrytym AI clusteringiem.

### Validation and integrity behavior

- Required fields blokujace conversion:
  - record title/name,
  - status,
  - owner lub owner intent,
  - source/provenance albo explicit assumption,
  - target intent dla downstream handoff.
- AI-filled values startuja jako proposal, nie approved truth.
- Duplicate merge wymaga diff/review, zachowuje source refs z laczonych rekordow i zapisuje merge history where runtime supports it.
- Bulk edits, owner changes, status conversion i downstream creation musza byc explicit i audytowalne.

### Source / provenance / evidence behavior

- Kazdy krytyczny rekord i kazde krytyczne pole musi miec mozliwy do odczytu status pochodzenia:
  - user-authored,
  - AI-suggested,
  - imported/source-backed,
  - derived/calculated,
  - owner-approved.
- Brak provenance = draft/assumption, nie approved truth dla high-impact handoff.
- Table musi zachowac source refs przy cross-tool transform (`table <-> mindmap/process_flow/whiteboard`).

### Handoff behavior (export to next functions/modules)

- `MW_IDEAS_TABLE` moze przekazywac selected rows/table context do:
  - innych formatow Ideas (Mind Map/Process Flow/Whiteboard),
  - `05_inicjatywy` jako initiative candidate,
  - `06_realizacja` jako task/action candidate,
  - artifact lanes jako document/presentation/workshop summary input.
- Handoff payload musi niesc selected rows, field semantics, source/evidence context, validation state i intent.
- Sukces handoffu nie moze byc komunikowany jako owner mutation done bez potwierdzenia owner-module read-back.

## Ideas Whiteboard Behavior Contract (`MW_IDEAS_WHITEBOARD`)

### Decision boundary (scope lock)

- `MW_IDEAS_WHITEBOARD` to format funkcji `Idea` w module `02_moja-praca`, nie osobny modul i nie runtime code change w tym cyklu.
- Whiteboard odpowiada za facylitacje i synteze wizualna (`chaos -> clusters/themes -> outcomes -> handoff`), nie za bezposrednie mutacje owner object lifecycle poza modulem.
- Whiteboard nie moze stac sie ukrytym PMO/task boardem ani osobnym systemem ownership.

### Job-to-be-done (when user chooses Whiteboard)

- User wybiera Whiteboard, gdy chce:
  - przeprowadzic warsztat/facylitacje w free-form canvasie,
  - zebrac i uporzadkowac wiele perspektyw, hipotez, ryzyk i decyzji,
  - przejsc od notatek i dyskusji do outcome candidates gotowych do review.
- Wynik:
  - powstaje whiteboard artifact z jawna semantyka elementow i provenance,
  - user dostaje explicit sciezki handoffu do innych formatow Ideas i downstream owner lanes.

### Runtime structure contract (elements, relations, annotations)

- Elements:
  - co najmniej: note, cluster, theme, outcome, decision, action, area/frame, metric, link/image.
- Relations:
  - connectory i relacje zachowuja source-target identity i intencje.
- Annotations:
  - provenance labels, evidence refs, statusy warsztatowe, comments/activity.
- Grouping:
  - klastrowanie i obszary sa jawne (brak ukrytego AI regrouping bez review).

### Collaboration, versioning, and approval behavior

- Session/facilitation:
  - role model: `facilitator|participant|observer`,
  - phases: `start -> organize -> converge -> handoff`,
  - timer/voting/follow/spotlight sa explicit controls.
- Versioning:
  - snapshot/history/activity sa traktowane jako formalny mechanizm read-back i audytu.
- Approval:
  - AI generation, auto-organize i conversion actions sa proposal-based (explicit apply/accept),
  - high-impact handoff wymaga owner-module review policy.

### Source / provenance / evidence behavior

- Kazdy krytyczny element i outcome whiteboardu musi miec mozliwy do odczytu status pochodzenia:
  - user-authored,
  - AI-suggested,
  - imported/source-backed,
  - derived,
  - owner-approved (po read-back).
- Brak provenance/evidence = draft, nie approved truth dla high-impact handoff.
- Whiteboard musi zachowac sourceTrace przy cross-tool transform (`whiteboard <-> mindmap/table/process_flow`).

### Handoff behavior (export to executable artifacts)

- `MW_IDEAS_WHITEBOARD` moze przekazywac explicit output do:
  - formatow Ideas (`mindmap`, `table`, `process_flow`),
  - `05_inicjatywy` (initiative candidate),
  - `06_realizacja` (task/action candidate),
  - artifact lanes (report/presentation/action-plan/decision-oriented artifacts).
- Handoff payload musi niesc source nodes, provenance/evidence context, facilitation phase context i intent.
- Sukces handoffu nie moze byc komunikowany jako owner mutation done bez owner-module read-back.

## Ideas Process Flow Behavior Contract (`MW_IDEAS_PROCESS_FLOW`)

### Decision boundary (scope lock)

- `MW_IDEAS_PROCESS_FLOW` to format funkcji `Idea` w module `02_moja-praca`, nie osobny modul.
- Ten cykl obejmuje dokumentacje kontraktowa (bez runtime code change).
- Process Flow modeluje sekwencje, decyzje, warunki, ownership handoff i readiness do wykonania.
- Process Flow nie jest silent executor dla downstream owner modules.

### Job-to-be-done (when user chooses Process Flow)

- User wybiera Process Flow, gdy chce:
  - ulozyc kroki i zaleznosci od `problem` do `execution-ready action`,
  - oznaczyc decision points, approvals, ryzyka i warunki przejsc,
  - przejsc od pomyslu do handoffu do `05_inicjatywy` / `06_realizacja` z zachowaniem source/evidence.
- Wynik:
  - powstaje flow artifact z jawna logika przejsc i blokad,
  - user dostaje czytelny readiness status: co gotowe do konwersji, a co blokuje handoff.

### Runtime structure contract (nodes, edges, conditions, dependencies)

- Nodes (minimum):
  - `start`, `activity`, `decision`, `approval`, `risk`, `handoff`, `end`.
- Edges (minimum):
  - `sequence`, `conditional_true`, `conditional_false`, `fallback`, `exception`, `parallel_split`, `parallel_join`.
- Conditions:
  - kazda krytyczna krawedz warunkowa ma jawny condition payload, bez ukrytej inferencji AI.
- Dependencies:
  - kroki moga definiowac `dependsOn`, `blocks`, `parallelGroup`, `handoffTarget`.
- Lanes:
  - lane wskazuje owner role/context dla kroku i granice przekazania.

### Transition rules, validation and guard rails

- `start` musi miec co najmniej jedno wyjscie.
- `end` musi miec co najmniej jedno wejscie.
- `decision` musi miec min. dwa rozroznialne wyjscia warunkowe.
- Krytyczne kroki (`decision`, `approval`, `handoff`, `risk`) wymagaja source/evidence statusu przed high-impact conversion.
- Flow nie moze byc oznaczony jako gotowy do konwersji, jesli:
  - brak ownera dla kroku krytycznego,
  - brak warunku dla edge warunkowego,
  - istnieje bledna zaleznosc blokujaca (dead-end bez recovery),
  - brak explicit approval dla AI-generated structural mutation.

### Source / evidence visibility and decision impact

- Kazdy krok krytyczny musi pokazywac posture pochodzenia:
  - user-authored,
  - AI-suggested,
  - imported/source-backed,
  - assumption.
- Brak evidence dla kroku krytycznego = draft/assumption, nie approved truth.
- Quality flow:
  - source/evidence coverage i readiness score musza byc widoczne zanim user uruchomi handoff.

### AI assistance and approval points

- AI moze:
  - proponowac brakujace kroki/przejscia/warunki,
  - wykrywac bottlenecks, missing approvals, missing owners i compliance gaps.
- AI nie moze:
  - samodzielnie zatwierdzac flow,
  - wykonywac downstream owner mutation.
- Approval points:
  - akceptacja propozycji AI,
  - aktywacja conversion do downstream modules,
  - owner-module review/read-back dla high-impact handoff.

### Error/degraded behavior and recovery paths

- `error`:
  - jawny fallback + retry/reopen, bez raw internals.
- `degraded`:
  - partial AI/source/validation availability jest jawnie sygnalizowana;
  - flow moze pozostac edytowalny manualnie, ale conversion pozostaje guard-railed.
- Recovery paths:
  - remove invalid edge/condition,
  - restore from last valid structure,
  - add missing owner/evidence,
  - fallback do stabilnego narzedzia Ideas.

### Handoff behavior (export to next functions/modules)

- `MW_IDEAS_PROCESS_FLOW` moze przekazywac flow context do:
  - innych formatow `Idea` (`mindmap`, `table`, `whiteboard`),
  - `05_inicjatywy` jako initiative candidate,
  - `06_realizacja` jako task/action chain candidate,
  - artifact lanes (SOP/checklist/plan/report inputs).
- Handoff payload musi niesc:
  - selected scope,
  - dependencies i warunki przejsc,
  - source/evidence context,
  - validation/readiness posture,
  - intent.
- Sukces handoffu nie moze byc komunikowany jako owner mutation done bez owner read-back.

## RADAR State Contract

- Loading:
  - Home spinner state is shown until initial block payload is ready.
- Empty:
  - fallback `EmptyStateInline` with explicit retry action (not silent blank screen).
- Error:
  - user-facing unavailable message with retry; no raw backend traces in main surface.
- Degraded:
  - triage banners distinguish data quality, conflict, stale state, and permission block.
- Success:
  - technology-intelligence surfaces provide relevance rationale, maturity posture, and exploration direction.

## RADAR Presentation Direction (locked)

- Main Radar presentation is reading-first (`Reading` density posture).
- Top "to-do/headline" block is removed from target behavior contract.
- Literal radar visualization (technology map) is part of target Radar behavior and must remain source/evidence-aware.

## Cross-Module Runtime Impact (Explicit)

- `01_czat`:
  - Radar can consume conversationally-derived context signals (e.g., insights) but does not own conversation canon.
- `05_inicjatywy`:
  - Radar may hand off suggestion context toward initiative framing; initiative object lifecycle remains owned by `05_inicjatywy`.
- `06_realizacja`:
  - Radar may route user to execution follow-up/handoff, but no execution gate/status mutation is owned here.
- Ownership invariant:
  - Radar emits intent and navigation/handoff context only; canonical mutations stay in owner modules.

## Security / Tenant / Governance (As-Is)

- Access rules are consumed from shared role/policy hooks (`useUserCan`, pilot access guards, app store identity).
- No hidden write route is defined in `MyWorkView`; data mutations are initiated via explicit UI actions and shared API/services.
- Cross-module handoff keeps routing explicit (no hidden background navigation branch in route config).
- Manager function is explicitly role-restricted in hub runtime and presents a denied-access state instead of silent fallback.

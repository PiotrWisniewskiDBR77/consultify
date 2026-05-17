---
module_id: MODULE_MY_WORK
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# UI/UX — Moja Praca / My Work

## 1. Main Screen

As-Is: `/my-work/*` uses `MyWorkView` with `SplitLayout` and `MyWorkHub` as the main runtime surface. The screen job is personal work orchestration: tabbed workspace UX, document/detail side flows, attention items and cross-module next actions.

### RADAR Main Job (locked for this cycle)

- User job: understand where organization/user stand versus technology shifts, get inspired, and learn what is worth exploring next.
- Expected outcome: technology orientation + inspiration + education, not operational event management.
- Radar role in module:
  - in scope: technology intelligence, relevance context, maturity orientation, educational guidance, first exploration hints,
  - out of scope: PMO control, event queue management, task lifecycle ownership.

### UX Reset Decision (owner input, 2026-05-10)

- Remove top narrative "to-do/headline" block from Radar main screen.
- Default Radar surface should be an elegant technology portal feel (reading-first).
- A literal Radar visualization should exist (technology points/signals on radar view), with linked descriptions/news context.
- Primary purpose is inspiration and orientation, not command-and-control.
- Density preference for Radar: `Reading`.

## 1A. RADAR Layout Contract v1 (implementation-ready)

### Screen anatomy (top -> bottom)

1. `Radar Header Strip` (compact, informational only)
   - contains:
     - screen title (`Radar`),
     - last refresh timestamp,
     - optional lens indicator (role/company lens),
     - no "to-do" sentence, no urgent action hero.
2. `Radar Map Section` (primary visual anchor)
   - literal radar visualization with:
     - rings: `Understand`, `Watch`, `Explore`, `Pilot`, `Scale`, `Hold`,
     - category filter chips,
     - selectable technology dots/signals.
3. `Insight Feed Section` (reading-first list)
   - curated cards ordered by relevance/learning value, not by operational queue semantics,
   - each card has short narrative, context fit, source/evidence micro-block.
4. `Technology Detail Drawer/Panel` (opened from radar map or insight card)
   - shows full detail for selected technology:
     - why relevant for role/company,
     - maturity/readiness posture,
     - risks and hype caution,
     - "what to explore next".
5. `Optional Watchlist/Notebook actions` (secondary)
   - lightweight save/capture actions only,
   - no PMO/task governance controls in core reading surface.

### Forbidden layout elements

- No large top hero "what should be done now".
- No command-and-control urgency banner as default first block.
- No duplicated AI control row inside content when same actions exist in Menu 3.

### Interaction model v1

- Primary interaction: `scan -> select technology -> read detail -> optional capture`.
- Secondary interaction: `apply lens/filter -> compare relevance/maturity`.
- Tertiary interaction: `handoff/capture` only after reading context.
- Default expanded state:
  - radar map visible,
  - insight feed visible,
  - detail panel closed until user selects signal.

### Content density and readability

- Density mode: `Reading`.
- Max 1 core message per card block (no stacked micro-widgets).
- Typography hierarchy:
  - title -> short explanatory paragraph -> evidence/provenance microline.
- White space and section separation prioritized over dashboard compactness.

### Menu 3 contract for RADAR v1

- Left side: context tabs/filters for Radar lens (if needed).
- Right side (mandatory slot):
  - AI explain action,
  - AI compare action,
  - AI "what should I learn next?" action.
- Canvas/content area:
  - must not duplicate same AI actions.

## 2. Runtime States

- Loading: hub subviews must show explicit loading flags/spinners while personal work data is fetched.
- Empty: each tab/subview must explain why there is no work and what the user can do next.
- Error: failed work-queue or detail loads must surface toast/banner copy rather than raw errors.
- Degraded: feature/pilot restrictions or partial data must be visible and must not imply that all work is current.
- Success: completed refreshes, task transitions or opened details must confirm the result and route the user to the next logical step.

### RADAR state specifics (contract-level)

- Loading:
  - Home radar shows deterministic loading surface before first payload.
- Empty:
  - explicit unavailable/empty message with retry CTA, not silent blank canvas.
- Error:
  - user gets understandable fallback + retry path.
- Degraded:
  - triage-level reason must be visible (`missing_data`, `conflict`, `stale`, `permission_blocked`).
- Success:
  - user sees technology-oriented radar/insight surfaces with relevance explanation and exploration paths.
- Next-action expectation per state:
  - loading -> wait or navigate elsewhere,
  - empty/error -> retry or move to stable tab,
  - degraded -> collect missing inputs / use fallback path,
  - success -> handoff to target module or capture note.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps global app/module navigation. Menu 3 is the hub command row for the active My Work tab/detail context. `WorkspacePanelStrip` and module controls may expose context actions there; the canvas remains focused on the selected work surface.

## 4. AI Actions Placement

Chat/context actions must be invoked from hub command-row/right-side controls or equivalent Menu 3 slots. The module must not duplicate the same AI action in the work canvas and Menu 3.

### RADAR placement requirement

- Radar AI controls belong in Menu 3 right-side slot for active RADAR context.
- Same Radar AI action cannot be duplicated inside Home content blocks.
- As-Is gap:
  - Home radar brief currently renders inline AI buttons in content area; this requires alignment to Menu 3 invariant in next implementation cycle.

## 5. Next Action Guidance

Every item, tab state and restriction must tell the user the next action: open owner module, continue review, retry, clear filters, request access or wait for data.

### RADAR priority and guidance contract

- Radar guidance must stay educational and exploratory first.
- Each Radar element should show:
  - why this technology matters for role/company,
  - maturity/readiness posture,
  - what to explore next (not operational assignment).
- Radar must prefer calm, selective signal density (no noisy feed behavior).
- Event-management language ("queue", "urgent action list", "operational blockers") is prohibited in main Radar UX.

## 6. Source / Evidence / Provenance

Cross-module work cards must preserve owner-module context, source object and status. If the item is a projection from another module, My Work must not hide where the underlying record lives.

### RADAR evidence visibility

- Radar cards must expose evidence pointers and source coverage posture.
- Uncertainty boundary must be visible where ranking can change due to missing/conflicting inputs.
- Provenance visibility is mandatory before recommending high-impact follow-up.

## 7. Approval / Diff / Review

My Work is an orchestration surface. Canonical edits of external objects must route to owner modules or explicit review flows; high-impact transitions require visible approval/review, not hidden direct writes.

### RADAR approval/review flow

- Radar can recommend and hand off.
- Owner module must perform approval/review for high-impact mutations (initiative creation, execution/governance changes).
- No "one-click hidden mutation" from Radar card to owner canonical object.

## 8. Anti-Patterns

- Treating My Work as the source of truth for objects owned by other modules.
- Dead-end empty states without a next action.
- Hidden feature/pilot denial.
- Duplicate AI toolbar under the canvas.
- Success toast before owner-module write/read-back is confirmed.

### RADAR anti-patterns (explicit)

- Turning Radar into PMO dashboard or task board.
- Ranking without visible evidence/provenance.
- Hiding degraded state and pretending all recommendations are equally reliable.
- Recommending initiative/execution action without ownership handoff boundary.
- Large "what must be done now" hero strip dominating the top of Radar.

## 9. As-Is Gaps

- Existing docs confirm tabbed hub, side flows and permission checks, but the full copy matrix for each tab's loading/empty/error/degraded state is not enumerated here.
- Runtime evidence for refresh resistance of every cross-module transition remains to be validated.
- Radar-specific:
  - triage hook error is not explicitly rendered in Home screen contract copy,
  - Menu 3-only AI placement is not fully aligned in current Home radar rendering.

## 10. Acceptance Criteria

- `/my-work/*` renders `MyWorkView`/`MyWorkHub` as the documented main screen.
- Each hub tab exposes loading, empty, error, degraded and success states with next-step guidance.
- Contextual AI actions use Menu 3/right-side command placement only.
- Work items show source/owner-module provenance.
- High-impact actions route through owner-module approval/review flows.
- Radar-specific acceptance:
  - Radar default view does not include top "to-do/headline" hero block.
  - Radar includes technology-portal style reading flow and literal radar visualization target.
  - Radar elements show `why relevant`, maturity/readiness context, and exploration guidance.
  - Radar elements show source/evidence pointers.
  - Degraded Radar states are visually distinct and non-silent.
  - Radar handoff never implies canonical mutation success without owner-module flow.

## 10A. UX Contract Addendum — `MW_NOTEBOOK` (`Notatki` -> `Folder`)

### Naming and hierarchy

- Entry label in My Work is `Notatki`.
- Clicking `Notatki` opens level-1 view: folder list in table layout.
- Opening a selected folder enters level-2 view: folder workspace with many note cards.
- Legacy wording `Notebook` can stay as compatibility alias only where needed.

### Interaction grammar

- Primary flow: `Notatki -> wybierz folder -> pracuj na kartach notatek`.
- Secondary flow: `utworz folder -> dodaj pierwsza karte`.
- Navigation must preserve visible parent context (`Notatki` as list level, `Folder` as detail/workspace level).

### State behavior

- `loading`: loading folder table or selected folder content.
- `empty`: no folders or empty folder; next action points to create folder/card.
- `error`: safe fallback and retry on list/folder load.
- `degraded`: one panel/source unavailable, folder editing still possible.
- `success`: folder/note updates confirmed with next action guidance.

### Governance and AI

- AI actions stay in Menu 3/right command slot.
- Critical folder/note cards preserve source/provenance or explicit assumption.
- High-impact handoff remains candidate-only until owner read-back.

## 11. Function Annex — Menu 2 and Module Functions

The function-level contracts below are mandatory and use `FUNCTION_CONTRACT_STANDARD.md`.

| Function ID | Menu label | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `MW_HOME_RADAR` | `Start` / `Home` / `Radar` | `"/my-work"`, `"/my-work/home"` | real | `MyWorkView`, `MyWorkHub`, `HomeView` | `functions/MW_HOME_RADAR.md` |
| `MW_IDEAS` | `Pomysly` / `Ideas` | `"/my-work/ideas"`, `"/my-work/ideas/:ideaId"` | real | `MyIdeasListContent`, `IdeaMapWorkspace`, `WorkspacePanelStrip` | `functions/MW_IDEAS.md` |
| `MW_IDEAS_MINDMAP` | `Ideas / Mindmap` | `"/my-work/ideas/:ideaId"` (tool: `mindmap`) | real | `IdeaRecommendationMap`, `IdeaWorkspaceToolbar`, `CanvasLeftToolbar` | `functions/MW_IDEAS_MINDMAP.md` |
| `MW_IDEAS_TABLE` | `Ideas / Table` | `"/my-work/ideas/:ideaId"` (tool: `table`, `tpTable`, `tpView`) | real | `IdeaTableTool`, `IdeaWorkspaceToolbar`, table platform components | `functions/MW_IDEAS_TABLE.md` |
| `MW_IDEAS_PROCESS_FLOW` | `Ideas / Process Flow` | `"/my-work/ideas/:ideaId"` (tool: `process_flow`) | real | `IdeaProcessFlowTool`, `IdeaWorkspaceToolbar`, `IdeaWorkspaceTools` | `functions/MW_IDEAS_PROCESS_FLOW.md` |
| `MW_IDEAS_WHITEBOARD` | `Ideas / Whiteboard` | `"/my-work/ideas/:ideaId"` (tool: `whiteboard`) | real | `IdeaWhiteboardTool`, `IdeaWorkspaceToolbar`, `IdeaWorkspaceTools` | `functions/MW_IDEAS_WHITEBOARD.md` |
| `MW_NOTEBOOK` | `Notatki` / `Folder` (`Notebook` legacy) | `"/my-work/notebook"` | real | `NotebookContent`, `WorkspacePanelStrip` | `functions/MW_NOTEBOOK.md` |
| `MW_INBOX` | `Skrzynka` / `Inbox` | `"/my-work/inbox"` | real | `InboxContent`, `NotificationDetailView` | `functions/MW_INBOX.md` |
| `MW_CALENDAR` | `Kalendarz` / `Calendar` | `"/my-work/calendar"` | real | `CalendarView` (calendar workspace in `MyWorkHub`) | `functions/MW_CALENDAR.md` |
| `MW_TASKS` | `Zadania` / `Tasks` | `"/my-work/tasks"`, `"/my-work/tasks/:taskId"` | real | `MyTasksListContent`, `TasksKanbanBoard`, `TasksCalendarView`, `TaskDetailView` | `functions/MW_TASKS.md` |
| `MW_DECISIONS` | `Decyzje` / `Decisions` | `"/my-work/decisions"`, `"/my-work/decisions/:decisionId"` | real | `DecisionsPanelContent`, `DecisionsKanbanBoard`, `DecisionsTimelineContainer`, `DecisionDetailView` | `functions/MW_DECISIONS.md` |
| `MW_MANAGER` | `Menedzer` / `Manager` | `"/my-work/manager"` | real (role-restricted) | `ExecutiveDashboard` with role-gated access state | `functions/MW_MANAGER.md` |

## 11E. Idea Family UI/UX Contract (Unified)

The four `MW_IDEAS_*` formats are one `Idea` family in the same workspace. The UI must make format switching feel like changing structure, not changing module ownership.

Canonical integration/UI blueprint:

- `docs/modules/02_moja-praca/IDEA_FAMILY_INTEGRATION_BLUEPRINT.md`

### Format selection guidance

| User need | Recommended format | UX promise |
| --- | --- | --- |
| Discover relationships, dependencies, evidence gaps, clusters. | `Mind Map` | Spatial graph with source-aware nodes/edges and explicit conversion points. |
| Compare many items by shared fields, owners, scores, risk or status. | `Table` | Structured rows/columns/views with validation and provenance per critical value. |
| Model sequence, decisions, conditions, lanes and readiness. | `Process Flow` | Step/edge/condition model with blockers, recovery and handoff readiness. |
| Facilitate ambiguous group work and synthesize outcomes. | `Whiteboard` | Free-form canvas with phase/role/session context and reviewed outcomes. |

### Shared Menu 3 and AI placement

- `IdeaWorkspaceToolbar` / active command row is the Menu 3 equivalent for the Idea workspace.
- Format switch, selected-scope actions, governance controls and contextual AI actions must resolve through this command row or its right-side slot.
- Canvas-local controls are allowed for direct editing (`node`, `row`, `edge`, `sticky`, `selection`) but must not duplicate the same AI actions.
- Runtime placement audits remain a P2 evidence gap where existing format surfaces have not been checked against this rule.

### Shared state handling

| State | Family-level UX requirement | Next-action guidance |
| --- | --- | --- |
| `loading` | Show which layer is loading: idea workspace, format data, AI/source context, collaboration or validation. | Wait, return to Ideas list, or switch to a stable already-loaded format. |
| `empty` | Explain how to start in the active format and offer transform/import only as explicit actions. | Start from format starter, import source pack, or transform from another format. |
| `error` | Show safe copy, retry/reopen path and no raw internals. | Retry, reopen workspace, or move to another format without claiming success. |
| `degraded` | State which capability is partial: AI, source/evidence, validation, collaboration, permission or saved view. | Continue within safe manual scope and resolve blockers before conversion. |
| `success` | Confirm local format readiness, not downstream owner mutation. | Review provenance, approve proposals, transform, or hand off explicitly. |

### Shared provenance and evidence UX

- Critical items in every format must show provenance posture: `user-authored`, `AI-suggested`, `imported/source-backed`, `derived/calculated` where applicable, or `owner-approved` after read-back.
- Missing evidence is allowed only as `draft/assumption`, not as approved truth.
- Cross-format transform must visibly preserve source refs; if evidence is lost or degraded, the receiving format shows `needs_review`.
- High-impact handoff controls must show target module, payload intent and remaining blockers before execution.

### Shared anti-patterns

- No hidden AI apply, hidden learning or silent conversion.
- No "success" message for initiative/task/artifact creation until owner module confirms write/read-back.
- No duplicate AI toolbar inside canvas when Menu 3 already owns the action.
- No format-specific color/status semantics that conflict with shared status colors (`slate/blue/amber/emerald/rose`; primary/violet for focus/CTA).

## 11A. UX Contract Addendum — `MW_IDEAS_MINDMAP`

### UX job

- Kiedy user wybiera `Mindmap`, oczekiwany przeplyw to:
  - `capture/porzadkowanie` -> `relacje i grupowanie` -> `proof/provenance check` -> `explicit handoff`.
- UX wynik:
  - mapa ma byc czytelna poznawczo i gotowa do konwersji bez zgadywania, co jest propozycja AI, a co approved truth.

### UI composition and interaction grammar

- Primary surface:
  - central canvas (`IdeaRecommendationMap`) + left tool strip (`CanvasLeftToolbar`) + command row (`IdeaWorkspaceToolbar`).
- Interaction grammar:
  - node create/edit,
  - relation create/edit,
  - grouping/cluster intent,
  - quick action z selected nodes do downstream flow.
- Menu 3 / right slot:
  - AI actions i governance controls dla mindmap context.
- Forbidden:
  - duplikowanie tych samych akcji AI jako oddzielny toolbar pod canvas.

### Source/provenance UX contract

- Kazdy krytyczny node/rekomendacja musi byc oznaczona pochodzeniem:
  - user-authored,
  - AI-suggested,
  - imported/source-backed.
- Evidence pointers sa wymagane przed high-impact handoff.
- Brak provenance = mozliwy draft, ale nie approved truth.

### Mind Map states (mandatory)

- Loading:
  - widoczny stan ladowania mapy i metadata, bez mylenia ze stanem zapisu.
- Empty:
  - starter guidance jak rozpoczac mape (node centralny -> relacje -> evidence).
- Error:
  - jawny fallback z retry; bez surowych internals.
- Degraded:
  - jawna informacja o ograniczonej dostepnosci AI/source/context.
- Success:
  - potwierdzenie gotowosci do review/convert + wskazanie kolejnego kroku.

### Handoff UX contract

- CTA do handoffu zawsze explicit (`convert selection`, `convert idea`, quick actions).
- UX nie moze sugerowac, ze downstream owner mutation juz sie wydarzyla, dopoki nie ma owner read-back.
- Handoff zachowuje source/evidence context na granicy funkcji i modulow.

## 11B. UX Contract Addendum — `MW_IDEAS_TABLE`

### UX job

- Kiedy user wybiera `Table`, oczekiwany przeplyw to:
  - `source/chaos capture` -> `rows and columns` -> `sort/filter/group` -> `validation/scoring` -> `explicit handoff`.
- UX wynik:
  - tabela jest consulting artifactem, nie zwyklym arkuszem;
  - user rozumie semantyke kolumn, statusy rekordow, evidence coverage i gotowosc do conversion.

### UI composition and interaction grammar

- Primary surface:
  - table canvas/editor (`IdeaTableTool`) + command row (`IdeaWorkspaceToolbar`) + table platform controls/views.
- Interaction grammar:
  - row create/edit,
  - column create/edit with field type,
  - sort/filter/group,
  - saved view selection through `tpView`,
  - status/owner/score review,
  - row or table selection for downstream conversion.
- Menu 3 / right slot:
  - AI actions i governance controls dla table context.
- Forbidden:
  - duplikowanie tych samych AI actions jako oddzielny toolbar w canvas/workspace,
  - ukryte AI fill/merge/owner assignment bez diff/review,
  - komunikowanie downstream success bez owner read-back.

### Table model UX contract

- Columns must show or imply field type and validation expectations.
- Required fields for conversion must be visually discoverable:
  - title/name,
  - status,
  - owner/owner intent,
  - source/evidence or assumption marker,
  - target handoff intent.
- Sorting/filtering/grouping must be visible as active state, including no-results state.
- Status colors follow the shared semantic status map where applicable (`slate/blue/amber/emerald/rose`); primary/violet remains focus/selection/CTA.

### Source/provenance UX contract

- Kazdy krytyczny row/field value musi byc oznaczony pochodzeniem:
  - user-authored,
  - AI-suggested,
  - imported/source-backed,
  - derived/calculated,
  - owner-approved.
- Evidence pointers sa wymagane przed high-impact handoff.
- Brak provenance = draft/assumption, ale nie approved truth.
- Duplicate/merge UX musi pokazac diff i zachowac source refs.

### Table states (mandatory)

- Loading:
  - widoczny stan ladowania table/view/context, odrozniony od save/apply AI.
- Empty:
  - starter guidance: wybierz typ tabeli albo wygeneruj z source pack.
- Error:
  - jawny fallback z retry/reopen; bez surowych internals.
- Degraded:
  - jawna informacja o missing view, stale rows, restricted sources, unavailable AI lub partial table platform.
- Success:
  - potwierdzenie gotowosci do scoring/validation/convert + wskazanie kolejnego kroku.

### Handoff UX contract

- CTA do handoffu zawsze explicit (`convert selected rows`, `create task candidates`, `create initiative candidate`, `export artifact`).
- Handoff payload zachowuje rows, field semantics, source/evidence context, validation state i intent.
- UX nie moze sugerowac, ze downstream owner mutation juz sie wydarzyla, dopoki nie ma owner read-back.

## 11C. UX Contract Addendum — `MW_IDEAS_PROCESS_FLOW`

### UX job

- Kiedy user wybiera `Process Flow`, oczekiwany przeplyw to:
  - `chaos/context capture` -> `kroki i lanes` -> `decyzje i warunki` -> `validation + guard rails` -> `explicit handoff`.
- UX wynik:
  - flow jest operacyjnym modelem procesu, nie tylko rysunkiem;
  - user rozumie, ktore przejscia sa gotowe, ktore sa zablokowane i dlaczego.

### UI composition and interaction grammar

- Primary surface:
  - flow canvas/editor (`IdeaProcessFlowTool`) + command row (`IdeaWorkspaceToolbar`) + flow properties/health panel (`IdeaWorkspaceTools`).
- Interaction grammar:
  - node create/edit (`start`, `activity`, `decision`, `approval`, `risk`, `handoff`, `end`);
  - edge create/edit (`sequence`, `conditional`, `fallback`, `exception`, `parallel`);
  - lane assignment i ownership context;
  - dependency binding (`dependsOn`, `blocks`, `parallelGroup`);
  - condition authoring dla transition edges;
  - explicit convert/handoff action z zaznaczonego scope.
- Menu 3 / right slot:
  - AI actions i governance controls dla active Flow context.
- Forbidden:
  - duplikowanie tych samych AI actions jako osobny toolbar w canvas,
  - komunikowanie downstream success bez owner read-back.

### Flow validation and guard-rail UX contract

- Guard rails musza byc czytelne:
  - brak warunku dla edge warunkowego,
  - brak ownera dla kroku krytycznego,
  - brak evidence dla kroku krytycznego,
  - dead-end path bez recovery.
- Validation musi pokazywac:
  - severity (`info`, `warning`, `blocker`),
  - impacted node/edge,
  - rekomendowany next action.
- Flow health score jest pomocniczy i nie zastępuje jawnych blokad.

### Source/provenance UX contract

- Kazdy krok krytyczny (`decision`, `approval`, `handoff`, `risk`) musi pokazywac provenance:
  - user-authored,
  - AI-suggested,
  - imported/source-backed,
  - assumption.
- Brak provenance/evidence oznacza draft posture i blokuje high-impact conversion.
- Source visibility musi byc utrzymana przy cross-tool transform (`flow <-> mindmap/table/whiteboard`).

### AI assistance and approval UX contract

- AI moze sugerowac:
  - brakujace kroki i warunki przejsc,
  - bottlenecks i ryzyka,
  - mozliwe handoff paths.
- AI suggestion != approved truth:
  - kazda sugestia pozostaje proposal do jawnej akceptacji/odrzucenia.
- Approval points:
  - acceptance AI structural changes,
  - explicit conversion/handoff,
  - owner-module review/read-back przy high-impact mutation.

### Flow states and recovery (mandatory)

- Loading:
  - widoczny stan ladowania flow runtime i walidacji, odrozniony od save/apply AI.
- Empty:
  - starter guidance: zdefiniuj start/end, lanes i pierwszy decision point.
- Error:
  - jawny fallback z retry/reopen; bez surowych internals.
- Degraded:
  - jawna informacja o partial AI/source/validation availability;
  - conversion controls zablokowane, jesli ryzyko integralnosci jest wysokie.
- Success:
  - potwierdzenie gotowosci do review/convert z lista remaining blockers/warnings.
- Recovery:
  - fix invalid edge/condition,
  - add missing owner/evidence,
  - rollback do last valid graph,
  - fallback do innego formatu Ideas.

### Handoff UX contract

- CTA do handoffu zawsze explicit (`convert flow selection`, `create initiative candidate`, `create task chain`, `export SOP/checklist`).
- Handoff payload musi zawierac:
  - selected scope,
  - dependencies i transition conditions,
  - source/evidence context,
  - validation/readiness state,
  - intent.
- UX nie moze sugerowac, ze owner canonical mutation juz zaszla bez owner read-back.

## 11D. UX Contract Addendum — `MW_IDEAS_WHITEBOARD`

### UX job

- Kiedy user wybiera `Whiteboard`, oczekiwany przeplyw to:
  - `capture chaos` -> `facilitate/organize` -> `converge` -> `outcomes` -> `explicit handoff`.
- UX wynik:
  - tablica jest consulting artifactem warsztatowym, nie tylko szkicem;
  - user widzi, co jest propozycja, co jest uzgodnionym outcome i co jest gotowe do conversion.

### UI composition and interaction grammar

- Primary surface:
  - canvas (`IdeaWhiteboardTool`) + command row/tool switch (`IdeaWorkspaceToolbar`) + right-side context (`IdeaWorkspaceTools`) + whiteboard panels (`WhiteboardToolbar`, `WhiteboardSelectionBar`, `WhiteboardSessionPanel`).
- Interaction grammar:
  - create/edit/move/group elementow (`sticky`, `text`, `shape`, `frame/area`, `cluster`, `theme`, `outcome`, `decision`, `action`);
  - connect relations i annotate context;
  - facylitacja (`timer`, `voting`, `follow`, `spotlight`, `phase switch`);
  - explicit outcome capture i convert/handoff z wybranego scope.
- Menu 3 / right slot:
  - contextual AI actions i governance controls dla active Whiteboard context.
- Forbidden:
  - duplikacja tych samych AI akcji jako oddzielny toolbar w canvas,
  - komunikowanie downstream success bez owner read-back.

### Whiteboard session UX contract (collaboration + facilitation)

- Role model:
  - `facilitator`, `participant`, `observer` musi byc czytelny i jawny.
- Phase model:
  - `start -> organize -> converge -> handoff` z widocznym current phase i dozwolonymi przejsciami.
- Session controls:
  - timer/voting/follow/spotlight sa jawne, reversible i audytowalne.
- Degraded collaboration posture:
  - utrata sync lub czesci facilitation controls musi byc widoczna;
  - board pozostaje uzywalny w trybie bezpiecznego fallbacku, jesli integralnosc danych na to pozwala.

### Provenance/evidence UX contract

- Kazdy krytyczny element (`theme`, `outcome`, `decision`, `action`) musi miec provenance label:
  - user-authored,
  - AI-suggested,
  - imported/source-backed,
  - derived,
  - owner-approved (po read-back).
- Evidence pointers sa wymagane przed high-impact conversion.
- Brak provenance/evidence = draft posture, nie approved truth.
- Source trace musi byc zachowany przy cross-tool transform (`whiteboard <-> mindmap/table/process_flow`).

### AI assistance and approval UX contract

- AI moze wspierac:
  - brainstorming, clustering, synthesis, gap prompts, draft outcomes.
- AI suggestion != approved truth:
  - kazda sugestia pozostaje proposal do jawnej akceptacji/odrzucenia.
- Approval points:
  - apply AI changes,
  - approve outcomes do conversion,
  - trigger handoff do owner lanes.
- As-Is gap:
  - pelna weryfikacja zgodnosci Whiteboard AI actions z Menu 3-only placement wymaga osobnego runtime/UI audytu.

### Whiteboard states (mandatory)

- Loading:
  - widoczny stan ladowania board/session context, odrozniony od save/apply AI.
- Empty:
  - starter guidance dla pierwszej facylitacji (`capture -> organize -> converge`).
- Error:
  - jawny fallback z retry/reopen, bez surowych internals.
- Degraded:
  - jawna informacja o ograniczeniach collaboration/facilitation/source coverage.
- Success:
  - potwierdzenie gotowosci outcome pack do review/convert + wskazanie kolejnego kroku.

### Handoff UX contract

- CTA do handoffu zawsze explicit (`convert selection`, `create initiative candidate`, `create task/action candidates`, `export artifact`).
- Handoff payload musi zawierac:
  - selected nodes/relations,
  - facilitation phase i outcome context,
  - source/provenance/evidence context,
  - validation/readiness state,
  - intent.
- UX nie moze sugerowac, ze owner canonical mutation juz zaszla bez owner read-back.

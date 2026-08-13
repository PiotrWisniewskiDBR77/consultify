# CONSULTIFY IDEAS — complete transformation and final-acceptance program

Status: **MASTER EXECUTION PROGRAM — goal-driven implementation through final acceptance**
Prepared: `2026-08-09`
Executor: next Claude execution
Owner intent: deliver a complete, coherent and professionally competent Ideas system—not another partial UI repair

Normative epic, Definition of Done and review protocol: `11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md`.

## 0. The goal Claude must pursue until achieved

Transform Consultify Ideas into one governed business-ideation and decision-preparation system in which a user can:

1. capture and understand a business problem;
2. explore it visually through Mind Map and Whiteboard;
3. model its operational impact through Process Flow;
4. quantify, compare and govern alternatives through Table;
5. build an auditable business case, benefits model and financial case;
6. obtain grounded AI assistance with proposal-first control;
7. convert the accepted scope into a Decision, Initiative, Tasks, Report, Presentation, Budget or Financial Model without losing lineage;
8. return later and see exactly what was changed, by whom, from which evidence and with what outcome.

Claude must continue through implementation, repair, regression testing, runtime verification, evidence capture and final acceptance. `READY_FOR_REVIEW`, a green build, a large number of changed files or a self-authored report do not satisfy the goal.

## 1. Authority and source hierarchy

Read all listed documents before implementation. Resolve conflicts in this order:

1. `docs/standards/idea-workspace/01_MODEL_I_ZASADY.md` — product model and Z1–Z4;
2. `docs/standards/idea-workspace/13_MIGRACJA_NAWIGACJI_2026-08-09.md` — current owner decision for panel/rail geometry;
3. other canonical chapters `02`–`12` under `docs/standards/idea-workspace/`;
4. `14_MACIERZ_FUNKCJI_MENU_I_OCENA_2026-08-09.md`;
5. completed manual audit `docs/qa/ideas-manual-audit-2026-08-09/00`–`07`;
6. P1–P3 plan `08_P1_P3_EXECUTION_PLAN_FOR_CLAUDE.md`;
7. `11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md` for E00–E15, universal DoD, functional/visual/CX testing and Codex handoff;
8. this master program, which expands the delivery objective but does not override the four canonical principles.

If a newer explicit owner decision conflicts with an older visual standard, record the conflict and apply the newer owner decision. Never silently blend incompatible variants.

## 2. Non-negotiable product doctrine

### 2.1 One Idea, four representations

An Idea is one graph and one business object with shared metadata, elements, relations, comments, evidence, history, AI lineage and representation-specific extensions.

| Representation | Primary job |
|---|---|
| Mind Map | decompose the problem, hypotheses, causes, alternatives and dependencies |
| Whiteboard | facilitate workshops, cluster evidence, diverge/converge, vote and hand off |
| Process Flow | model operational reality, decisions, lanes, time, waste, automation and controls |
| Table | structure data, score alternatives, compare economics, govern decisions and create portfolio views |

Switching representation is a local view preference. It never creates a second Idea, mutates the graph merely by viewing it or changes another collaborator's screen.

### 2.2 Four acceptance principles

- **Z1 Analogiczność:** the same action has the same ID, name, icon, shortcut, state and behavior across tools unless a documented tool-specific difference exists.
- **Z2 System appearance:** all surfaces use the accepted Consultify design system and feel like one product.
- **Z3 Zero placeholders:** no dead button, fake success, silent error, empty handler or unsupported action presented as live.
- **Z4 Teresa controls everything:** every UI command is callable through the governed action registry; Teresa never invents an unavailable operation.

### 2.3 Professional competence rule

Every feature must help the user achieve a recognisable business result. A function remains only when it:

- has a clear user outcome;
- lives at the correct scope: document, view, selection, element, edge, lane/frame, row, column, cell or external artifact;
- has one canonical owner surface;
- executes a real handler or explains why disabled;
- has a visible result and appropriate undo/restore path;
- persists when persistence is expected;
- is usable with pointer and keyboard;
- can be invoked safely by Teresa.

## 3. End-state user journey

The final system must support this complete golden journey without switching to an unrelated tool or manually recreating data:

### Stage A — Capture

- create an Idea from Ideas, Notebook, Inbox, Teresa or another governed My Work source;
- enter title, problem statement, opportunity, owner, area, horizon, confidentiality and source;
- attach evidence and record assumptions separately from facts;
- system starts at `Spark`, shows save state and explains maturity stages.

### Stage B — Explore

- Mind Map decomposes the problem into causes, stakeholders, hypotheses, options, risks and evidence gaps;
- AI may propose branches but never applies them without preview/acceptance;
- cross-links express non-hierarchical dependencies;
- evidence cards and comments retain sources and authorship.

### Stage C — Workshop

- Whiteboard supports prepared workshop templates, roles, phases, timer, voting, follow-me and participants;
- notes and shapes are placed without overlap and named immediately;
- users cluster, frame, connect, draw, align, distribute, group, lock and layer elements;
- AI works only on meaningful current-board content and identifies missing semantic input;
- selected workshop results can be promoted to actions or decisions without losing source links.

### Stage D — Model operations

- Process Flow models Start, End, activities, decisions, lanes and connectors;
- Classic, Automation and Value Stream modes expose appropriate palettes and validation rules;
- decisions have editable conditions/Yes/No labels;
- loops, exceptions and alternate paths are explicit;
- steps can carry owner/role, system, duration, waiting time, cost, FTE, control and evidence;
- validation starts as `Not validated`, then reports warnings or a verified state honestly.

### Stage E — Quantify and compare

- Table provides governed field types and useful empty-state guidance;
- users create alternatives/initiatives as rows and compare value, cost, risk, effort, confidence and strategic fit;
- saved views support triage, scoring, decision log, timeline and portfolio review;
- formulas and AI-generated fields show lineage and never overwrite without preview;
- views are alternative presentations of the same underlying records.

### Stage F — Business and financial case

- define baseline, target outcome, affected population/process volume and time horizon;
- distinguish cash impact, accounting impact, capacity release, risk avoidance and qualitative benefit;
- capture one-time investment, recurring cost, internal effort, external spend, contingency and decommissioning cost;
- define benefit ramp, implementation ramp, confidence and scenario assumptions;
- calculate benefits, net cash flow, payback, ROI and NPV only when required inputs and units are valid;
- show Base / Upside / Downside scenarios and sensitivity drivers;
- preserve currency, units, period, source, formula version and assumption provenance;
- block approval when required financial evidence is missing, stale or internally inconsistent.

### Stage G — Decide and promote

- provide a decision-ready summary: problem, evidence, alternatives, recommendation, economics, risks, dependencies and unresolved assumptions;
- require stage-gate completeness appropriate to the target artifact;
- preview exactly what conversion will create;
- convert whole Idea, selected elements, a branch or selected rows with explicit scope;
- create durable backlinks and append-only conversion history;
- partial conversion does not mark the whole Idea `Promoted`.

### Stage H — Execute and learn

- Initiative, Tasks, Decision, Report, Presentation, Budget and Financial Model retain the source Idea and source element IDs;
- status/readback from downstream artifacts appears in Idea relations;
- realized benefits and lessons can be compared with the original case;
- history shows proposal, approval, conversion and later outcome without overwriting the original reasoning.

## 4. Functional architecture

### 4.1 Shared Idea object

Required canonical domains:

| Domain | Minimum content |
|---|---|
| Identity | ideaId, title, brief, owner, organization, area, confidentiality |
| Lifecycle | stage, stage history, readiness, approval state, archive state |
| Graph | elements, edges, containers, semantic types, shared IDs |
| Representations | layout/view preferences stored separately per user/tool where appropriate |
| Evidence | sources, attachments, knowledge cards, fact/assumption classification |
| Collaboration | comments, mentions, participants, workshop events, presence |
| Business case | objectives, alternatives, benefits, costs, risks, dependencies, assumptions |
| Financial case | currency, horizon, periods, scenarios, drivers, calculations, provenance |
| AI | proposals, model/provider, input scope, evidence references, accept/reject/apply history |
| Conversion | append-only target links with explicit source scope and IDs |
| Audit | versions, author, timestamp, before/after or patch, restore points |

Do not force all representation-specific fields into every element. Use a stable shared identity plus typed extensions. A node shown in another representation keeps identity; semantic translation between representations must be explicit and proposal-based, not an accidental shape conversion.

### 4.2 Action Registry as the control plane

Every action must be declared once with:

- stable action ID and i18n key;
- icon and canonical owner surface;
- primary scope and supported representations;
- availability predicate and `disabledReason`;
- permission requirement;
- mutation/destructive/external flags;
- confirmation policy;
- handler and terminal result schema;
- undo/restore policy;
- Teresa command mapping;
- analytics event without sensitive content.

Toolbar, rail, inspector, PPM, keyboard and Teresa invoke this same command. Automated checks fail when a visible command lacks a registry entry or live handler.

### 4.3 Screen ownership

Apply the current owner-approved geometry from chapter 13, while keeping these semantic responsibilities:

| Surface | Responsibility |
|---|---|
| Menu 1 | Idea identity, maturity, save, Teresa, Convert and document overflow |
| Menu 3 | current representation and its high-frequency work |
| Information panel | Overview, Properties, Relations, Comments, History |
| Movable tool rail | creation, interaction modes and fast tool-specific commands |
| Selection toolbar | immediate operations on current selection |
| PPM | concise contextual mirror of existing commands, never unique hidden functionality |
| Bottom controls | zoom, fit, minimap where relevant and representation switcher |

No floating layer may cover essential content at supported viewports or 200% browser zoom.

## 5. Complete capability by tool

### 5.1 Mind Map

Must deliver:

- root, child, sibling and multi-level hierarchy;
- one editor per insertion, deterministic focus, Escape/Enter/Tab behavior;
- collapse/expand branch and focus/isolate branch;
- cross-links, edge label/style/direction and duplicate prevention;
- frames/sections, comments, evidence, attachments and knowledge;
- auto-layout with undo and stable persisted positions;
- selection/branch/document AI scopes;
- branch summary, counterarguments, evidence gaps, prioritisation and challenge proposals;
- concise hierarchical PPM with nested AI/Convert/Appearance expert groups;
- node vs branch conversion as different commands;
- canonical Present and document-scope Import/Export locations only.

### 5.2 Whiteboard

Must deliver:

- sticky, text, shapes, frames, connectors and accessible freehand;
- collision-free insertion, immediate naming and optional tidy/auto-arrange;
- align, distribute, group/ungroup, lock/unlock and layer controls;
- workshop panel under Menu 3: role, phase, timer, voting, follow-me, participants and governance;
- small on-canvas workshop indicators, not a permanent obstructive session card;
- scenes/saved views and presentation mode;
- connector PPM with label, style, color and delete;
- real element copy/paste, not text-only copying disguised as object copy;
- grounded Find themes / Name clusters / Extract actions with semantic-input coaching;
- persistent comments, votes, workshop history and action/decision promotion links.

### 5.3 Process Flow

Must deliver:

- Classic, Automation and VSM modes with mode-specific palettes;
- Start, End, Action, Decision, Lane, connectors, split/join and insert-on-edge;
- one primary creation surface and immediate lane naming;
- source→target Connect plus selected-edge properties;
- editable condition label/type, direction, style and explicit delete;
- Yes/No quick labels and correction/exception loops;
- owner/role, system, duration, waiting time, VA/NVA, cost, FTE and control fields;
- auto-layout and Fit view that works from extreme zoom states;
- process validation with `Not validated` initial state;
- bottleneck, handoff, control-gap, automation and VSM analysis grounded in diagram data;
- process-specific AI and events only—no Mind Map handler leakage;
- undo, realtime replication and reopen persistence for all scene-critical semantics.

### 5.4 Table

Use one P15/platform UX; do not deepen legacy/P15 duplication.

Must deliver:

- typed fields: Text, Number, Select, Multi-select, Date, Date range, Rating, Person, Currency, Formula, Relation, Attachment and governed AI-derived fields;
- discoverable Add field wizard with validation and type settings;
- row, cell and column-header PPMs;
- views: Grid, Kanban, Timeline, Calendar, Matrix, Gallery in frozen order;
- saved presets for Default, Triage, Scoring, Decision Log and Timeline;
- filters, sorting, grouping, conditional formatting and field visibility;
- core toolbar only; Forms/Interfaces/Models/Workflow/Webhooks and other advanced tools under More tools or platform tabs;
- explicit Send and Close controls in Table AI;
- durable AI terminal states and preview-first mutations;
- CSV append/update/replace with preview, mapping, confirmation where destructive and result summary;
- governed export of the visible/current view with explicit included columns/rows;
- table completeness, missing-data and schema guidance in empty/partial states.

## 6. Business competence layer

### 6.1 Idea maturity model

Keep existing stages but make entry/exit criteria explicit in the product:

| Stage | User outcome | Minimum gate |
|---|---|---|
| Spark | problem/opportunity captured | owner, problem statement, source |
| Growing | explored with meaningful structure | hypotheses/options, evidence and stakeholders |
| Shaping | preferred direction formed | alternatives, operational model, risks and initial economics |
| Ready | decision-ready case | recommendation, owners, financial scenario, dependencies and unresolved assumptions |
| Promoted | whole Idea converted to an approved downstream artifact | explicit workspace-scope conversion and backlink |

Partial conversions add lineage but do not change the whole Idea to Promoted.

### 6.2 Business-case schema

Provide editable, inspectable sections—not an opaque AI narrative:

- problem and baseline;
- strategic objective and expected outcome;
- stakeholders/customers and affected processes;
- evidence, assumptions and evidence gaps;
- alternatives including `do nothing`;
- recommendation and rationale;
- benefits and disbenefits;
- costs and resource needs;
- operational impact and process changes;
- risks, controls, dependencies and constraints;
- implementation horizon and milestones;
- KPIs, baseline, target, owner and measurement source;
- confidence and readiness;
- decision requested and decision deadline.

Every section links back to originating elements/rows where possible. AI-generated summaries cite those internal sources and identify unsupported claims.

### 6.3 Scoring and prioritisation

Ship a configurable, transparent scoring model with default dimensions:

- strategic fit;
- customer/business value;
- financial impact;
- urgency/time criticality;
- confidence/evidence quality;
- delivery effort;
- implementation risk;
- dependency complexity;
- compliance/security impact.

Weights are visible and versioned. Score is never a mysterious AI number. Manual overrides require reason and appear in history. Portfolio comparison must show both absolute inputs and normalized score.

### 6.4 Decision governance

- decision log records question, alternatives, recommendation, approver, decision, rationale, conditions and expiry/review date;
- `Approve`, `Reject`, `Return for evidence` and `Defer` are distinct outcomes;
- approval is blocked by missing mandatory evidence or stale financial calculations;
- reopened decisions create a new version; they do not erase the approved one;
- role/permission behavior must be explicit before final release.

## 7. Financial competence layer

This layer must interoperate with Consultify Finance but retain an Idea-level pre-decision case. Finance remains the authority for governed valuation/approved financial artifacts; Ideas stores the assumptions and candidate case with lineage.

### 7.1 Financial inputs

| Category | Required structure |
|---|---|
| Baseline | quantity, unit, current value, period, source date and evidence |
| Investment | one-time internal/external costs, capex/opex classification where known, contingency |
| Recurring cost | licenses, operations, maintenance, headcount, vendors, inflation/escalation assumption |
| Benefits | revenue, margin, cash saving, avoided cost, capacity release, risk avoidance, qualitative benefit |
| Timing | start, implementation ramp, benefit ramp, useful horizon and terminal/decommissioning effect |
| Scenarios | Base, Upside, Downside with driver differences, not copied totals |
| Confidence | per-driver confidence and evidence state |
| Currency | ISO currency, scale, FX source/date when conversion is used |

Do not add unlike units or represent capacity release as cash saving without an explicit realization assumption.

### 7.2 Calculations

At minimum support transparent formulas for:

- gross and net annual benefit;
- implementation and recurring cost;
- net cash flow per period;
- cumulative cash flow and payback period;
- simple ROI with clearly named numerator/denominator;
- NPV with discount rate and period convention;
- optional IRR only when cash-flow shape supports it;
- benefit-cost ratio;
- sensitivity of key drivers;
- scenario comparison and confidence-adjusted value as a separate, clearly labelled view.

Every output shows formula version, units, periods, inputs and missing/invalid reason. No financial number may be inferred from formatted text alone or silently rescaled.

### 7.3 Financial UX

- Table is the principal structured editing surface for drivers and periods;
- the information panel shows a compact case summary and evidence health;
- charts show cumulative cash flow, benefit/cost composition, scenario range and sensitivity—not decorative dashboards;
- changes to drivers immediately mark calculations stale until recomputed;
- `Convert to Financial Model` and `Convert to Budget` use preview, create governed downstream artifacts and append backlinks;
- approved Finance data can be read back but must not be overwritten by an Idea draft.

### 7.4 Financial acceptance case

Build one reproducible case containing:

- at least three cost drivers and three benefit drivers;
- monthly periods for implementation and annual summary;
- Base/Upside/Downside scenarios;
- one non-cash benefit and one risk-avoidance benefit clearly separated;
- ROI, NPV, payback and sensitivity;
- source/evidence for every material driver;
- conversion to Financial Model or an honest `BLOCKED` state if the downstream contract is not yet live.

Verify compute → save → reopen → change driver → stale state → recompute → convert/readback.

## 8. AI and Teresa

### 8.1 Proposal-first contract

All mutating AI follows:

`request → scope/evidence inspection → proposal → preview/diff → accept or reject → apply → history → undo/restore`

No silent auto-application. Suggestions may be non-mutating, but must state their evidence and confidence.

### 8.2 Grounding

AI priority order:

1. selected items and explicit current scope;
2. current Idea content and attached evidence;
3. linked organizational context with visible provenance;
4. general model knowledge clearly marked as unverified suggestion.

An unsupported claim cannot be presented as a fact. Missing evidence should produce `Evidence needed`, not fabricated specificity.

### 8.3 Shared AI scopes

- `Selection / Zaznaczenie`
- `Branch / Gałąź` only where semantically valid
- `View / Widok`
- `Document / Dokument`

The visible scope and actual serialized input must match. No silent fallback from empty selection to whole document.

### 8.4 Teresa execution

- Teresa discovers actions only through Action Registry;
- preview confirms target, scope, mutation and side effects;
- destructive or external actions require confirmation;
- unavailable actions return an honest reason and next prerequisite;
- every executed command appears in activity/history with actor `Teresa on behalf of <user>` and the same result contract as the UI.

## 9. Conversion, lineage and downstream integration

Implement one conversion mechanism for workspace and list entry points.

Required targets:

- Initiative;
- Task set;
- Decision;
- Report;
- Presentation;
- Team Chat/context handoff;
- Financial Model;
- Budget.

For targets not yet supported end-to-end, show one consistent `soon/disabled` state with a reason; do not create empty placeholder artifacts.

Each conversion preview shows source scope, included elements, mapped target fields, warnings and target artifact name. Each successful conversion appends:

`{conversionId, targetType, targetId, scope, sourceElementIds, createdAt, createdBy, mappingVersion, sourceLink}`.

Downstream artifact retains backlink. A second conversion appends a new record. It never overwrites earlier lineage. Workspace stage changes to Promoted only after explicit whole-Idea conversion.

## 10. Data integrity, collaboration and reliability

### 10.1 Persistence states

Expose and test:

- `Saving…`;
- `Saved` with last successful timestamp;
- `Offline — local changes pending` where supported;
- `Save failed — retry`;
- conflict requiring resolution;
- permission-denied read-only mode.

Wait for server readback, not merely debounce completion, before claiming persistence.

### 10.2 History and restore

- append-only activity history for meaningful changes;
- explicit snapshots before destructive import/template replacement;
- AI proposal and application recorded separately;
- undo for local reversible operations;
- restore creates a new version instead of erasing history;
- conversion history cannot be removed by later conversions.

### 10.3 Collaboration

- presence and selection indicators cannot change another user's view preference;
- comments support element/document scope, mentions and resolution;
- workshop roles enforce edit permissions;
- simultaneous edits use an explicit conflict/merge policy;
- reconnect does not duplicate actions, edges or rows.

### 10.4 Security and governance

- organization and tenant boundaries are enforced server-side;
- authorization applies to Idea, comments, attachments, conversion targets and destructive actions;
- confidential/restricted Ideas do not leak content through AI prompts, exports or telemetry;
- audit events identify user, organization, action, target and result without storing unnecessary sensitive prompt content.

## 11. Complete visual and interaction system

### 11.1 Visual objective

The four representations must feel like four professional lenses on one Idea. Preserve Consultify's dark/light visual language and restrained executive character. Improve hierarchy and competence without redesigning the whole application or introducing tool-specific visual dialects.

### 11.2 Layout

- fixed Menu 1 and Menu 3;
- full remaining workspace for canvas/data;
- information panel and movable rail follow the current chapter-13 geometry;
- bottom navigation/zoom cluster remains viewport-relative;
- floating layers never overlap each other or essential content;
- Table scroll remains internal with sticky headers where supported;
- all supported sizes remain usable at 200% browser zoom.

### 11.3 Tokens and components

Use canonical foundation tokens for color, typography, spacing, radii, border, elevation, motion and focus. No arbitrary one-off grays or hardcoded light-only colors.

Common component families:

- icon button and tooltip;
- segmented mode control;
- toolbar/rail command button;
- context menu and submenu;
- information-panel tab/card/field;
- selection toolbar;
- status and scope chip;
- proposal/diff card;
- empty/error/loading/offline state;
- toast plus durable terminal result;
- confirmation dialog;
- zoom/fit/minimap/representation controls.

### 11.4 Hierarchy and density

- one primary CTA per state;
- high-frequency actions visible, expert actions grouped;
- icon-only controls always have accessible names/tooltips;
- PPM first level fits within 1280×800 without scrolling for common actions;
- avoid walls of icons and duplicated commands;
- selection-specific controls replace—not stack on—the default toolbar where the standard requires it.

### 11.5 Tool-specific graphics

#### Mind Map

- hierarchy readable through spacing and connector routing, not excessive color;
- selected branch, cross-link and collapsed state visually distinct;
- labels remain readable at normal zoom; minimap/fit preserves orientation.

#### Whiteboard

- sticky palette accessible in both themes;
- frames and clusters create hierarchy without overpowering content;
- connectors remain distinguishable from freehand;
- workshop state indicators are compact and non-obstructive;
- new-object cascade visibly communicates successful insertion.

#### Process Flow

- Start/End/Action/Decision/Lane have consistent semantic shapes;
- Yes/No/condition labels are readable and attached to their connectors;
- warnings are distinct from selected/focused state;
- VSM metrics are aligned, unit-labelled and not presented as decorative badges.

#### Table

- follows the table canon, not an Excel imitation or canvas metaphor;
- header, field type, sort/filter/group state and saved view are legible;
- row density remains professional and accessible;
- currency/rating/person/date cells communicate type without excessive chrome;
- financial charts use honest axes, units, periods and source notes.

### 11.6 Motion and feedback

- motion explains state change and stays short;
- no celebratory animation for routine saves;
- creation highlights the new element briefly;
- Connect shows source selected, target expectation and completion/cancellation;
- AI/application shows progress and durable terminal result;
- honor reduced-motion preference.

### 11.7 Accessibility

- semantic roles, names, states and focus order;
- visible focus in light/dark;
- Enter/Space activation, Escape cancellation and arrow navigation where expected;
- 44px-equivalent target policy where required by the design standard;
- contrast compliance for text, borders, statuses, charts and selected states;
- core flows possible without raw coordinate drag;
- zoom 200% without loss of functionality or two-dimensional page scrolling outside intentional canvas/table regions.

## 12. Delivery program

### Program A — establish candidate and contracts

- version/environment gate;
- dirty-tree ownership and file allowlist;
- canonical action and data inventories;
- reconcile original audit findings and P1–P3 plan;
- baseline screenshots and four-scene readback;
- define exact migrations and rollback/forward strategy before data changes.

Exit: one accepted candidate baseline and machine-readable execution ledger.

### Program B — stabilize shared platform

- Action Registry;
- command terminal-state contract;
- common persistence state;
- route/tab/representation synchronization regression shield;
- common Connect interaction;
- common AI proposal/diff/history shell;
- command ownership and duplicate cleanup.

Exit: shared primitives mounted by real consumers, not merely added to the repository.

### Program C — finish four authoring tools

Implement every P1–P3 item in `08_P1_P3_EXECUTION_PLAN_FOR_CLAUDE.md` plus the complete tool capabilities in §5. Work tool-by-tool, retaining cross-tool invariants.

Exit: all four original business scenes rebuild naturally and persist; open P1–P3 count is zero or has genuine blockers.

### Program D — business competence

- maturity gates;
- business-case schema and inspector;
- transparent scoring and readiness;
- evidence/assumption separation;
- decision governance;
- portfolio/saved views.

Exit: one decision-ready Idea can move from Spark to Ready with auditable inputs.

### Program E — financial competence

- typed financial drivers and scenarios;
- formula engine integration/contract;
- ROI/NPV/payback/sensitivity;
- stale/recompute behavior;
- Finance conversion and lineage;
- source and unit validation.

Exit: the reproducible financial acceptance case in §7.4 passes compute/save/reopen/change/recompute/readback.

### Program F — visual completion

- apply shared ownership model and design tokens;
- remove duplicate/overloaded surfaces;
- complete empty/loading/error/offline/disabled states;
- responsive, theme, locale and 200% zoom correction;
- visual regression baselines for all four tools and critical overlays.

Exit: visual review passes exact-SHA matrix with no clipped essential control or inconsistent component family.

### Program G — conversion and lifecycle

- append-only conversions;
- preview/mapping/confirmation;
- backlinks and downstream readback;
- whole vs fragment stage semantics;
- import/export/template guardrails;
- Teresa parity.

Exit: at least Initiative, Task, Decision, Report and Presentation convert end-to-end; Financial Model/Budget either pass or remain honestly disabled with a recorded downstream blocker.

### Program H — hardening and final check

- automated suites;
- manual passes A/B;
- error/recovery/concurrency/security checks;
- performance and large-document checks;
- evidence and lineage verification;
- final acceptance report.

Exit: all gates in §15 pass for the same candidate SHA.

## 13. Required test portfolio

### Automated

- unit tests for commands, reducers, mappings, formulas and validation;
- mounted component tests for menus, states, keyboard, proposal/apply and empty/error behavior;
- integration tests for routes, persistence, conversion history and backlinks;
- contract tests for API shapes, permissions, AI terminal states and financial units;
- migration tests with representative existing Ideas;
- end-to-end tests for the golden journey and four business scenes;
- accessibility scan plus manual keyboard checks;
- visual regression matrix.

### Runtime manual

For each tool:

1. Pass A: click every visible button/menu/PPM item; evaluate execution, sense, placement, duplicates, persistence and missing capability.
2. Pass B: rebuild its full business scene from zero.
3. Save, refresh, leave, reopen and inspect readback.
4. Repeat critical path with keyboard.
5. Exercise disabled, validation, loading, success, transport failure, save failure and offline states safely.

### Matrix

- 1280×800, 1440×900, 1920×1080;
- light/dark;
- PL/EN;
- browser zoom 100%/200%; canvas minimum/normal/high zoom;
- empty, small and large Ideas;
- owner/editor/viewer where permission model exists;
- reconnect and two-user collaboration;
- current supported browsers declared by the product.

## 14. Performance and scale gates

Define and measure on reference hardware; do not invent a pass from subjective smoothness.

Suggested initial targets, to be confirmed against product SLOs:

- initial usable workspace ≤2.5s warm and ≤5s cold on local/staging reference;
- command feedback ≤100ms for local actions;
- save acknowledgment ≤2s under normal network;
- pan/zoom/drag remains responsive for 500 canvas elements and 1,000 edges;
- Table remains usable for 5,000 rows with virtualization;
- AI shows running state immediately and supports cancellation;
- no unbounded history/presence render growth.

Record actual p50/p95, dataset, machine and build SHA. If official SLOs differ, replace these suggestions and explain the source.

## 15. Final acceptance — the finish line

The program is complete only when every applicable gate below is evidenced for one exact candidate SHA.

### Gate 1 — Product coherence

- one Idea remains one object across four representations;
- representation switching does not mutate content;
- shared actions behave analogously;
- every tool-specific difference is documented and justified.

### Gate 2 — Functional completeness

- all P1–P3 items repaired and retested;
- no visible placeholder/dead handler;
- every inventory command has a real result or honest disabled reason;
- four original scenes and the end-to-end golden journey pass.

### Gate 3 — Business competence

- Spark→Growing→Shaping→Ready criteria work;
- evidence, assumptions, alternatives, scoring, risks and decision request are complete;
- decision-ready summary links to underlying content;
- approval/rework/defer outcomes are auditable.

### Gate 4 — Financial competence

- typed drivers, periods, currencies, units and scenarios persist;
- ROI, NPV, payback and sensitivity recompute correctly;
- cash, capacity, risk avoidance and qualitative benefits are not conflated;
- stale and invalid calculations block misleading approval;
- financial conversion/readback passes or is honestly blocked by a named downstream contract.

### Gate 5 — AI and Teresa

- all mutating AI is proposal-first;
- scope and grounding are visible;
- unsupported claims are marked;
- every submitted command ends in result/error/cancelled state;
- Teresa has parity through Action Registry with confirmations.

### Gate 6 — Data integrity and lineage

- save/reopen/readback passes;
- conversion history is append-only;
- partial conversion does not promote whole Idea;
- imports/templates have preview, confirmation and restore as required;
- downstream backlinks and source element IDs survive.

### Gate 7 — Visual quality

- accepted design system and owner-approved geometry;
- no overlap, clipping, icon wall or unexplained duplicate;
- common components look identical across representations;
- tool-specific graphics communicate semantics clearly;
- exact visual matrix passes in both themes/locales and 200% zoom.

### Gate 8 — Accessibility

- accessible names/roles/states and visible focus;
- core work without raw coordinate drag;
- keyboard/PPM parity;
- contrast and reduced-motion checks;
- no serious/critical accessibility findings unresolved.

### Gate 9 — Reliability, security and collaboration

- loading/offline/retry/conflict behavior is honest;
- tenant/permission boundaries verified server-side;
- reconnect and concurrent edit tests do not duplicate or lose data;
- confidential data respects export, AI and telemetry policy.

### Gate 10 — Engineering quality

- focused and integration tests pass;
- root and relevant server type-checks pass or pre-existing baseline failures are isolated with no candidate regression;
- migrations are safe and tested;
- no new dual legacy/P15 implementation;
- runtime consumer wiring is proven.

### Gate 11 — Evidence integrity

- candidate SHA, runtime badge and deployment identity agree;
- code, tests, screenshots and database readback all refer to that candidate;
- missing proof remains `NOT VERIFIED`;
- reports separate facts, observations, conclusions and recommendations;
- no production GO from self-attestation.

### Gate 12 — Owner handoff

Final handoff begins with:

1. candidate SHA/runtime/deployment;
2. completed/blocked counts per program and priority;
3. four-scene result and golden-journey result;
4. financial acceptance-case result;
5. regressions and unresolved risks;
6. exact evidence index;
7. explicit recommendation: `ACCEPT`, `ACCEPT WITH NAMED LIMITATION`, or `DO NOT ACCEPT`.

The owner must never be the first person to discover a visual, persistence or workflow defect.

## 16. Required delivery package

Create:

`docs/qa/ideas-complete-transformation-YYYY-MM-DD/`

Required artifacts:

1. `00_PROGRAM_STATUS_AND_VERSION.md`
2. `01_CANON_AND_DECISION_REGISTER.md`
3. `02_EXECUTION_LEDGER.csv`
4. `03_DATA_AND_MIGRATION_REPORT.md`
5. `04_SHARED_PLATFORM_ACCEPTANCE.md`
6. `05_MIND_MAP_ACCEPTANCE.md`
7. `06_WHITEBOARD_ACCEPTANCE.md`
8. `07_PROCESS_FLOW_ACCEPTANCE.md`
9. `08_TABLE_ACCEPTANCE.md`
10. `09_BUSINESS_CASE_ACCEPTANCE.md`
11. `10_FINANCIAL_CASE_ACCEPTANCE.md`
12. `11_AI_TERESA_ACCEPTANCE.md`
13. `12_CONVERSION_LINEAGE_ACCEPTANCE.md`
14. `13_VISUAL_ACCESSIBILITY_MATRIX.md`
15. `14_TEST_PERFORMANCE_SECURITY_RESULTS.md`
16. `15_ALL_ACTIONS_INVENTORY.csv`
17. `16_OPEN_RISKS_AND_LIMITATIONS.csv`
18. `17_FINAL_ACCEPTANCE.md`
19. `screenshots/`, `exports/`, and machine-readable test results.

Each ledger row must include owner/scope, baseline, implementation, files, tests, runtime result, persistence/readback, responsive/theme/locale, evidence, final state and risk.

## 17. Claude execution instruction

Use this program as a terminal goal, not as a suggestion list. Maintain a plan with one in-progress item, keep working while a safe in-scope next step exists, repair defects found in the defined product scope, and update the execution ledger continuously.

Do not stop after completing only the P1–P3 polish. Do not stop after building the financial UI without real calculations and readback. Do not stop after code passes without exact-candidate runtime. Do not call the program complete while a final gate is merely assumed.

When blocked by a genuine owner decision, irreversible external action or missing downstream authority, record the exact blocker, complete every independent item, and present the smallest decision required. Everything else is Claude's responsibility to resolve and verify.

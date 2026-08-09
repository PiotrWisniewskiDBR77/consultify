# Case Workspace / Zlecenia — module SSOT

> Status: `APPROVED_SPEC / IMPLEMENTATION_PARTIAL`
> Date: 2026-08-09
> Owner: Product Owner + Product + Engineering + UX
> Scope: complete product concept for the Case Workspace module
> Decision authority: `11_OWNER_DECISION_REGISTER.md`
> Package canon: `00_CASE_WORKSPACE_CANON.md`
> UI authority: `CLAUDE.md`, `docs/ui-standards/TRIADA_KANON.md`,
> `src/components/standard/*` and artifact SPEC-A
> Runtime authority: `04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md`

## 1. Purpose

Case Workspace is Consultify's lightweight operating surface for durable,
outcome-oriented work. It joins planning, governed execution, native module
results, decisions, evidence and value without turning every activity into a
project and without creating a second Consultify behind Teresa.

The product promise is:

> The user may do specialist work directly in any Consultify module or ask
> Teresa to plan and conduct any size of work, from one bounded result to a full
> transformation, using the same canonical module objects and one durable Case.

The Workspace must answer four questions before exposing technical detail:

1. What do we want to achieve?
2. What is happening now?
3. What needs attention?
4. What results and value already exist?

Authority for this module is, in order: frozen owner decisions in
`11_OWNER_DECISION_REGISTER.md`; the `case-workspace/00–12` package; Agent
Execution V8 runtime contracts; earlier Run Agent and Transformation proposals;
then implementation AS-IS. Existing code is migration evidence, not authority
over an approved product or domain decision.

## 2. Product boundaries

### 2.1 Two equal work modes

**Direct module work** is first-class. A user may open Interview, Assessment,
Finance, KPI, Decisions, Initiatives, Documents or another owning module and
complete work without Teresa and without a Case.

**Teresa-orchestrated work** is also first-class. The user states an outcome;
Teresa clarifies material ambiguity, proposes a reviewable plan and conducts the
approved work through the same module capabilities and owning services.

Teresa is optional. A Case is optional for direct work. Neither mode is a
fallback or reduced version of the other.

### 2.2 Conversation is not execution

An informational answer, exploration or ordinary conversation creates no Case
and performs no hidden business mutation. Teresa may prepare an ephemeral brief
or proposal. Durable work begins only after the user confirms Teresa's exact
work-order summary by an explicit action or unambiguous language. Silence and
continued conversation are never consent.

The canonical promotion path is:

`conversation -> proposed brief -> proposed plan -> confirmation -> Case -> published plan version -> Run`

For a safe `LIGHT` Case, one literal `Zatwierdź i rozpocznij` action may confirm
the contract, publish plan v1 and start execution. It still discloses outcome,
scope, native result, autonomy, side effect and approval behavior. Larger,
material or risky work separates contract confirmation, plan publication, Run
start and consequential approvals.

### 2.3 One Case, one business truth

Every durable work order accepted by Teresa creates or reuses exactly one Case.
There is no separate Engagement, Job, Chat Case or Teresa-only runtime.

A Case references native module objects. It does not copy, replace or take
ownership of their business truth. A standalone module object may later be
linked or pinned at an exact revision. Any derived successor remains created
and owned by the native module with explicit lineage.

## 3. Terminology

| Product term | Domain/engineering term | Meaning |
| --- | --- | --- |
| Zlecenie | Case | Durable context for a contracted outcome. |
| Plan | CasePlanVersion / ProcessVersion | Reviewable intended work; published versions are immutable. |
| Realizacja | Run / NodeRun | One execution of one exact plan version. |
| Rezultat | Native artifact/deliverable/decision/outcome | Canonical output owned by its module or outcome record. |
| Wymaga uwagi | Attention projection | Decision, input, blocker, wait, expiry or exception requiring action. |
| Gotowy proces | Play / ProcessDefinition | Reusable, governed method; not a Case or Run. |
| Teresa | Orchestrator identity | Public engagement partner using bounded capabilities. |
| Wykonawca AI | Agent/capability adapter | Technical executor behind Teresa, not a persona catalog. |

`Zlecenie` is the default Polish category label. The business goal may be the
visible instance title. `Praca` is not an alternative object category. `Case`
remains the canonical domain/API term.

## 4. Personas and jobs to be done

### Business user

- get a bounded result without learning workflow tooling;
- understand what Teresa will do before execution;
- provide input or approve a material action;
- open the real Interview, Finance, KPI or other deliverable;
- see an honest result without reading technical logs.

### Consultant / Case owner

- contract outcome, scope and definition of done;
- assemble or adapt a plan;
- coordinate people, Teresa and modules;
- manage evidence, decisions, exceptions and client acceptance;
- preserve reusable learning without leaking client truth.

### Decision owner / approver

- see exact proposal, semantic diff, evidence, risk and consequence;
- approve, reject, defer or request changes;
- know what will execute, in whose name and within which validity window;
- receive an immutable decision receipt.

### Process owner / method designer

- author and test private Play drafts;
- use the Expert projection for graph, policies and contracts;
- submit a reusable Play for governed publication;
- compare versions without changing active Cases.

### Operator / administrator

- diagnose blocked, stale, failed or replayed work;
- trace correlation, authorization, wait, lease and provider health;
- recover safely without inventing success or bypassing governance.

## 5. Case classification and proportional governance

Case purpose and governance are separate axes:

- `profile`: `LIGHT | STANDARD | TRANSFORMATION | MONITORING`;
- `governanceTier`: `LIGHTWEIGHT | STANDARD | CONTROLLED`.

The profile describes the kind and horizon of work. The governance tier reflects
consequence, reversibility, access, accountability and audit need. Step count
does not determine governance. A smaller profile may be promoted to `CONTROLLED`
before a material action without migrating to a new Case object.

Detailed rules are in `08_GOVERNANCE_AUTONOMY_APPROVALS.md`.

## 6. Lifecycle

### 6.1 Product lifecycle

The primary workspace lifecycle is:

`Plan -> Realizacja -> Rezultaty`

- **Plan** defines the outcome, acceptance, nearest safe execution horizon,
  owners, inputs, steps, approvals and expected native deliverables.
- **Realizacja** shows the live Run, durable waits, attention, progress,
  decisions, recovery and business timeline.
- **Rezultaty** exposes native outputs, Findings, Recommendations, Decisions,
  evidence, lineage, acceptance and measured value.

These phases are projections of one Case. They are not separate stores.

### 6.2 Planning and execution lifecycle

`Draft -> Review -> Publish immutable version -> Start/ schedule Run -> Execute/wait/recover -> Accept results -> Close`

A Run always points to one exact plan version and semantic graph digest. A
material change creates a new reviewable version and explicit replan. Runtime
state belongs to Run and NodeRun, never to definition nodes.

### 6.3 Transformation completeness

Where required, one Case may cover mandate, discovery, interviews, diagnosis,
opportunity system, options, Finance/KPI, decisions, Initiatives, mobilization,
execution, benefits, sustainability and learning. This lifecycle is a
completeness model, not a mandatory wizard. A Case may enter later, reuse valid
existing artifacts and explicitly satisfy or waive prerequisites.

### 6.4 Closure

Closure uses an explicit contracted type:

- `DELIVERY_COMPLETED`;
- `DECISION_COMPLETED`;
- `IMPLEMENTATION_COMPLETED`;
- `OUTCOME_VALIDATED`;
- `COMPLETED_PARTIAL`.

Run completion does not close a Case. Delivery does not prove benefit. Benefit
does not prove sustainability. A closed Case keeps an immutable closure record;
continued work uses a successor phase/Run, successor Case or linked Monitoring
Case according to the contract.

## 7. Information architecture

### 7.1 Placement

The initial host is **My Work**, which remains the single operational and
attention system for human, direct-module and Teresa-orchestrated work.

The current `Run agent` surface evolves into `Zlecenia` with:

- a list and preview of Cases;
- filters and saved views;
- a shared attention projection;
- entry to the Case Workspace;
- native module deep links;
- an explicit advanced process-design entry.

Later, Teresa Chat embeds or opens the same Workspace and runtime. Chat never
receives a private plan, approval queue or execution truth.

### 7.2 Workspace shell

A compact header shows name, outcome, status, health, owner, deadline, last
confirmed update and one state-appropriate primary action. Full brief, scope,
participants, autonomy and budget use contextual disclosure.

Stable tabs are:

`Plan | Realizacja | Rezultaty`

Unavailable phases stay visible with a reason. The shell uses the existing
Consultify topbar and exactly one Command Row.

This is a **SPEC-A full-object surface: Archetype C — Record, class L**, using
the existing artifact shell from `ARTIFACT_ANATOMY_STANDARD.md`; it is neither
a dashboard nor a `ModuleHub`, and it is not a new local shell. Menu 1 remains
the product topbar, Menu 2 remains My Work navigation,
and `Plan | Realizacja | Rezultaty` is Menu 3 inside the SPEC-A object shell.
`ArtifactRightPanel` is the only contextual right-side inspector and is closed
by default. Phase tabs never replace Menu 1 or Menu 2. The Zlecenia index is a
**SPEC-L** surface and must not reuse the full-object shell.

### 7.3 Zlecenia list

The list follows the shared list/table canon. It prioritizes:

1. requires my decision;
2. blocked;
3. overdue or expiring;
4. active;
5. recent.

Each row answers: expected outcome, type, status, attention, result progress,
owner, next action, deadline and last activity. Definition and Run records are
not mixed as equivalent rows; the Case row may summarize and link to active and
historical Runs.

Before implementation the index must publish and review the three typed
descriptors required by `MY_WORK_TABLE_SURFACE_CONTRACT_V1.md`:

- `ZleceniaTableSurfaceCapabilities`: server sort/filter/page, saved views,
  column settings and export; selection and bulk actions remain disabled until
  a named safe action is approved;
- `ZleceniaPreviewSurfaceDescriptor`: outcome, status/health, attention,
  owner, deadline, next action and last activity, with `Otwórz zlecenie` as the
  primary action;
- `ZleceniaRowActionRegistry`: `Otwórz`, `Pokaż wynik`, authorized
  `Wstrzymaj/Wznów`, and `Anuluj` only behind destructive confirmation.
  Unsupported actions are absent, never `Coming soon`.

The reviewed descriptors, permission predicates, empty selections and
unavailable-state copy are a W0 gate.

### 7.4 Routes, compatibility and focus

The existing My Work slot and order of `Run agent` are retained; only its
user-visible label becomes `Zlecenia`. Canonical routes are:

- `/my-work/cases` — SPEC-L index;
- `/my-work/cases/:caseId/plan`;
- `/my-work/cases/:caseId/run`;
- `/my-work/cases/:caseId/results`;
- optional `?step=<stable-step-id>&view=simple|expert|list`.

Legacy `/agent-plan`, `#my-work?tab=agent`, `/my-work/run-agent` if previously
published, and supported legacy Case deep links redirect to the corresponding
canonical route while preserving Case, phase and step identity.
Opening a native deliverable records the originating Case URL and control; Back
returns to the same phase/step and restores focus. Missing, moved, unauthorized
or retired targets show a reason and a safe route to Zlecenia.

### 7.5 Authoritative Polish UI dictionary

Canonical labels are: `Zlecenia`, `Plan`, `Realizacja`, `Rezultaty`, `Prosty`,
`Ekspercki`, `Lista`, `Rozpocznij`, `Zaplanuj`, `Wstrzymaj`, `Wznów`, `Anuluj`,
`Otwórz wynik`, `Wymaga Twojej decyzji`, `Oczekuje`, `Zablokowane`,
`Częściowo zakończone` and `Brak dowodów`. Product identifiers and literal
evidence statuses `PARTIAL`, `UNKNOWN`, `BLOCKED`, `WAITING` and
`EVIDENCE_MISSING` may accompany, but never replace, a Polish explanation.
`Simple`, `Expert`, `List`, `Start` and `Schedule` are not UI labels. Every
wait/error/partial message states: what happened; who acts now (Teresa, human or
system); the impact; and the safe next action. Copy snapshots, truncation at
200% zoom and a pseudo-locale pass are mandatory.

## 8. Lightweight UI doctrine

The module uses high information density with low visual weight:

- one dominant work surface;
- no permanent palette or configuration wall;
- contextual `+`, popover, drawer and command palette;
- business outcome before graph mechanics;
- compact semantic elements and restrained borders;
- one primary action per active region;
- progressive disclosure from outcome to diagnostics;
- technical logs and identifiers hidden until requested;
- no current heavy builder promoted unchanged as the target;
- no decorative AI gradients, glow or continuous animation.

The existing UI canon owns tokens, color, focus, density, motion, primitives and
list anatomy. The Zlecenia list must use `StandardModuleBar`, `StandardTable`
and `StandardPreview` from `src/components/standard/*` and pass TRIADA checks.
Artifact surfaces must follow SPEC-A and the shared `ArtifactRightPanel` shell.
Required repository skills and visual-check scripts named in `CLAUDE.md` are
mandatory when available; inability to run a required gate remains
`EVIDENCE_MISSING`. Feature code must compose shared components rather than
establish a local design language.

## 9. One graph, three projections

There is one canonical semantic graph and three first-class projections:

### Simple

A guided, lightweight flow for normal users. Nodes show business label, type,
executor, owning module, expected output, duration/wait and validation/runtime
status. The palette opens contextually through `+`, search or insert-on-edge.

### Expert

A graph/detail projection for method designers and complex Cases. It exposes
typed bindings, conditions, branches, parallelism, policies, retries, timeouts,
idempotency, schemas, connections, evidence and diagnostics through progressive
disclosure. It is not a separate planner.

### List

The mobile, keyboard and accessibility-equivalent semantic editor. It exposes
the same node/edge identity, validation and operations without requiring zoom,
pan or drag-and-drop.

All three projections preserve the same graph digest. View layout, viewport,
collapsed state and selection are presentation data. A construct not editable in
Simple remains preserved and deep-links to Expert; it is never flattened.

Detailed graph, capability and API contracts are in
`05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md`.

## 10. Plan

The default Plan shows:

- outcome and definition of done;
- business steps and nearest safe horizon;
- Teresa/human/system owner;
- native module and expected result;
- main dependencies, waits and approvals;
- validation issues;
- time, cost and autonomy summary.

The step drawer reveals purpose, input, output, owner, approval, wait and risk.
Expert disclosure reveals routing, policy, schema, capability, retry, timeout,
evidence and diagnostics. Secrets are never displayed.

Before material execution, plan review discloses exact scope, writes, external
recipients, connections, risk, reversibility, limits, approvals and diff from
the previous published version.

## 11. Realizacja

The default execution view shows:

- health;
- active or waiting step;
- what requires attention;
- next action;
- progress by results/milestones, not only node count;
- time and cost;
- state-valid controls;
- business timeline.

User-visible controls may include `Rozpocznij`, `Zaplanuj`, `Wstrzymaj`,
`Wznów`, `Anuluj`, `Ponów`, `Przekaż dane`, `Przypomnij`, `Przypisz ponownie`
and `Zaproponuj zmianę planu` according to policy and role. API commands retain
their technical English identifiers. Each
mutation returns canonical readback and an auditable receipt.

Human, timer, event and external waits are durable first-class states. A step
waiting for days never appears as a spinner or as Teresa still computing. It
shows who or what is awaited, since when, expected signal, deadline, last
heartbeat/contact, escalation, next automatic action and impact.

The business timeline contains meaningful transitions, decisions, waits,
deliverables, failures and recovery. Heartbeats and raw events remain in
diagnostics.

## 12. Attention and approvals

Attention is one shared My Work projection, not a Case-specific inbox. Each item
states:

- required decision or input;
- why now;
- impact of no action;
- owner and deadline;
- Teresa's recommendation;
- evidence and freshness;
- actions and recovery/escalation.

Approval distinguishes:

`intent -> confirmation -> authorization -> execution -> validation -> acceptance`

An approval binds the exact proposal version, payload/material digest, scope,
approver role and expiry. Its UI shows summary, semantic diff, evidence, known
limitations, cost, risk, recipients, reversibility, alternatives and consequence
of no approval. The result becomes an immutable receipt.

Conversational confirmation is permitted only for exact Chat-to-Case
confirmation and A0/A1 work when exactly one current visible proposal and
digest resolve. A2 execution requires an explicit `Zatwierdź i rozpocznij` or
equivalent control, or an already published plan policy. Material A3/A4, formal
Decision, Initiative, budget, shared publication, external action and closure
require an explicit control plus step-up or dual control where policy requires
it. Ambiguity causes clarification, never guessed approval.

## 13. Autonomy

Every Case exposes exactly three user-selectable policies:

1. `ASK_EACH_ACTION` — ask before every execution step;
2. `ASK_MATERIAL_ACTIONS` — execute safe work and stop at material actions;
   default;
3. `EXECUTE_APPROVED_PLAN` — execute the disclosed approved plan and stop at
   hard policy boundaries or material change.

The organization sets the maximum. A user may choose a lower level. No level
bypasses tenant, membership, permissions, declared scope, data policy, target
system, recipients, cost/time limits, legal/organizational approval or audit.

These user policies control when Teresa asks. They do not replace the runtime
action classes A0–A4 defined in the governance contract. Autonomy never expands
silently during a Run.

## 14. Rezultaty, history and value

Results are domain objects, not a shelf of generated files. They include
Findings, Recommendations, Decisions, Finance analyses, KPI records,
Initiatives, execution objects, Documents and Presentations.

Each result shows owner module, status, revision, approval, source freshness,
evidence, lineage and `Otwórz w [module]`. The deep link opens the canonical
native object and returns to the same Case phase and selected step.

History is append-only and separates:

- business timeline;
- decision/approval history;
- execution and recovery audit;
- value timeline.

Value keeps baseline, target, forecast, actual, formula, source, owner,
measurement window, confidence and attribution distinct. Missing evidence is
not zero. Long-horizon measurement may move to an approved linked `MONITORING`
Case without upgrading the source Case to a proven outcome.

Literal states `PARTIAL`, `UNKNOWN`, `BLOCKED`, `EVIDENCE_MISSING`, `FAILED`,
`SKIPPED` and `WAITING` are never smoothed into success.

## 15. Plays and learning

A Play is a reusable, versioned method or process definition. It is not a Case,
Run, Teresa persona, Skill or Work Package.

Every authorized user may create and test a private Play draft. Shared team or
organization publication requires an authorized publisher or review and an
immutable published version. Instantiating a Play creates a Case plan or fragment pinned to the exact
version; editing the instance never mutates the source Play.

Historical patterns may suggest a Play or plan improvement. Frequency is not
correctness, prior approval is not current authorization and client evidence
never crosses tenant boundaries. Learned improvements remain proposals until
governed publication.

## 16. Responsive and accessibility

Target: WCAG 2.2 AA.

### Wide desktop

- Zlecenia uses the shared table + preview pattern;
- Plan may show flow plus one contextual drawer;
- Realizacja may show one attention rail;
- Teresa may later open as an optional contextual panel, never a permanent
  fourth column.

### Narrow desktop and tablet

- one primary content region;
- inspector and attention become drawers;
- view controls remain visible;
- later Chat and Work use tabs, not a boolean toggle.

### Mobile

- List is the default Plan projection;
- step detail is full-screen;
- Realizacja uses a vertical timeline and sticky attention action;
- approvals, input, pause, resume and cancel remain fully operable;
- no swipe-only action;
- complex graph authoring may require desktop, but ordinary semantic operations
  retain list/form equivalents.

Below 768 px the Zlecenia index becomes a single-column shared list-card
projection, not a compressed table or bespoke card system. Each item shows
outcome, status/attention, owner, deadline and next action; tap opens the Case.
Filter, sort, saved views and settings remain in the Command Row; row actions
use an accessible menu; selection and approved bulk actions use explicit
controls. Preview opens as a full-screen sheet with the desktop descriptor and
permission rules. There is no horizontal scroll or swipe-only behavior.

Accessibility invariants:

- complete keyboard path;
- visible `--c-focus` focus, never crimson;
- minimum 44 x 44 pt targets;
- semantic tabs, dialogs, drawers, menus and live regions;
- status is never color-only;
- canvas has List and textual connections equivalents;
- drag-and-drop has non-drag commands;
- live events never steal focus or force scroll;
- reduced motion and 200% zoom retain function;
- charts have text/table equivalents;
- deep links and overlays restore focus to the initiating control.

Detailed interaction requirements are in
`03_INTERACTION_RESPONSIVE_ACCESSIBILITY.md`.

## 17. Domain ownership and runtime boundaries

| Concern | Authoritative owner |
| --- | --- |
| Conversation and turn history | Chat |
| Goal, scope, plan lineage and outcome contract | Case service |
| Reusable Play definition | Process Definition service |
| Execution, wait and recovery truth | V8 Run orchestrator |
| Proposal and approval truth | Proposal/Decision service |
| Interview, Finance, KPI, Initiative, Documents and other artifacts | Owning module service |
| Human attention presentation | My Work projection |
| Intent, planning and orchestration | Teresa |

Human UI, Teresa and automation invoke the same typed application commands.
Actor type changes authorization and audit, not the produced domain object.

Every mutation carries tenant, actor, correlation/causation, idempotency and
expected version where applicable. Execution revalidates current membership,
permissions, capability, data and approval after long waits. My Work and Chat
are read/projection surfaces, never mutation owners.

The detailed aggregate, state-machine, API, security, event and observability
contracts live in `04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md`,
`05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md` and
`06_SECURITY_EVENTS_OBSERVABILITY.md`.

## 18. Required states and honest UI

Every primary surface must handle:

- empty;
- initial loading and background refresh;
- slow network;
- stale/offline;
- validation error;
- permission or membership denial;
- concurrency conflict;
- rate limit;
- backend/provider failure;
- lost event connection and reconnect;
- governance block;
- partial completion;
- expired approval;
- unavailable source;
- restart during active Run.

No state may show fake success, silent failure, raw backend error as the only
message or an infinite spinner without timestamp, timeout and recovery.

Save state is distinct from lifecycle state. Technical completion is distinct
from result acceptance and business outcome.

## 19. Non-goals

Case Workspace is not:

- a mandatory gateway to direct module work;
- a new task, approval or notification system beside My Work;
- a chat transcript presented as process state;
- a duplicate store for module artifacts;
- a catalog where users manage specialist agent personas;
- an unrestricted autonomous agent;
- a heavy graph editor as the default product experience;
- a replacement for owning module screens and validation;
- a guarantee that completed steps produced business value;
- a file generator whose output volume proves completion;
- a big-bang rewrite of AgentPlan, Chat, My Work and V8 runtime.

## 20. Current implementation and migration boundary

Current `AgentHubShell`, `AgentPlanWorkspace`, `AgentPlanCanvas`, palette,
AgentPlan API and scheduler are migration sources and component donors. They may
support compatibility reads and controlled legacy execution while the target
converges, but they cannot remain a second authoritative plan or runtime.

New execution converges on one Case-bound V8 Run/NodeRun and canonical module
commands. My Work receives the canonical Case/Run surface before Chat is
migrated. Retirement of legacy execution requires current runtime, realDB,
restart, replay, tenant and artifact proof.

The incremental migration and retirement gates are defined in
`07_LEGACY_MIGRATION_AND_DELIVERY_PLAN.md`.

## 21. Acceptance

The module remains `IMPLEMENTATION_PARTIAL` until one exact candidate SHA,
deployment and schema prove all required layers:

### Product boundary

- direct module work succeeds without Case or Teresa;
- informational Teresa chat creates zero Cases/Runs;
- confirmed durable Teresa work creates exactly one Case under replay;
- a native object links into Case without copy or ownership change;
- safe `LIGHT` one-click and reviewed material flows are both proven.

### Planning and execution

- Simple, Expert and List expose identical semantic identities and graph digest;
- published plan versions are immutable;
- each Run names the exact plan version;
- all three autonomy policies and A0–A4 ceilings are enforced server-side;
- approval, expiry, reject/request-changes and replan bind exact versions;
- waits, pause, cancel, retry and restart/resume persist honestly;
- duplicate request, dispatch, callback and approval create one business effect.

### Results, history and value

- native deliverables reopen in their owning modules and return to Case;
- evidence, approval and lineage survive restart and readback;
- files are editable/renderable and share one accepted facts digest where
  required;
- closure type and owner acceptance are persisted;
- delivery, implementation, actual value and sustainability remain distinct;
- literal partial/unknown/blocked/evidence-missing states remain unchanged.

### UX and access

- browser journeys prove outcome, state, attention and next action are clear;
- all required empty/loading/error/stale/blocked/partial states are exercised;
- desktop, tablet, mobile and 200% zoom evidence is current;
- keyboard and VoiceOver/NVDA paths pass;
- tenant/project/user denial and revoked membership fail closed;
- focus and deep-link restoration are proven.

### Evidence package

Acceptance requires documentation, code/schema, automated tests, mounted
runtime/API, real PostgreSQL readback before and after restart, browser/device,
artifact and contracted outcome evidence. Each claim maps to route, state,
artifact, viewport, SHA and deployment.

Build success, generated-file volume, mocks, helper tests, screenshots without
readback, stale deployment evidence and self-attestation are insufficient.

The literal terminal gate and Golden Cases are defined in
`10_TEST_ACCEPTANCE_AND_GOLDEN_CASES.md`. Until every gate required by the agreed
scope is current, no alternative success wording may imply final acceptance.

## 22. Detailed package map

- `00_CASE_WORKSPACE_CANON.md` — package authority and invariants;
- `01_PRODUCT_CANON_AND_MODES.md` — product model and work modes;
- `02_INFORMATION_ARCHITECTURE_AND_UX.md` — IA and phase UX;
- `03_INTERACTION_RESPONSIVE_ACCESSIBILITY.md` — interaction, responsive and a11y;
- `04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md` — aggregates and state machines;
- `05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md` — graph, registry and APIs;
- `06_SECURITY_EVENTS_OBSERVABILITY.md` — authorization, events and operations;
- `07_LEGACY_MIGRATION_AND_DELIVERY_PLAN.md` — incremental convergence;
- `08_GOVERNANCE_AUTONOMY_APPROVALS.md` — policy, autonomy and approvals;
- `09_HISTORY_VALUE_REUSE_AND_PLAYS.md` — history, value and reuse;
- `10_TEST_ACCEPTANCE_AND_GOLDEN_CASES.md` — evidence and terminal gates;
- `11_OWNER_DECISION_REGISTER.md` — frozen owner decisions;
- `13_CLAUDE_MULTI_AGENT_IMPLEMENTATION_MASTER_PLAN.md` — bounded staged execution handoff to Claude and independent Codex review;
- `14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md` — complete epics, DoD, functional/visual/CX acceptance and ready-to-send FULL_EXECUTION prompt.

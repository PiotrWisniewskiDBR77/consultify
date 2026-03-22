# Idea Workspace V5 — SSOT

> **Status:** ACTIVE DRAFT (v5 planning SSOT)  
> **Owner:** Product / Platform / CTO  
> **Scope:** `My Work -> Pomysły -> New Idea -> SuperCanvas -> Idea Card -> Outputs`  
> **Purpose:** define the canonical product, UX, data, AI, and visual rules for the next generation of the Ideas module.

> **Important:** This document supersedes `docs/product/IDEA_WORKSPACE_V3_SSOT.md` for all **new V5 planning and implementation work**.  
> V3 remains historical and compatibility-relevant for already shipped surfaces and contracts.

---

## 0) References (canonical)

Module / platform:
- `docs/MYWORK_MODULE_SPECIFICATION.md`
- `docs/product/IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
- `docs/product/LINK_GRAPH_V3.md`
- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
- `docs/product/TOOLS_CATALOG_V3.md`

UI / UX canon:
- `docs/ui-standards/README.md`
- `docs/ui-standards/FROZEN_LAYOUTS.md`
- `docs/ui-standards/00-foundation/visual-language.md`
- `docs/ui-standards/00-foundation/color-system.md`
- `docs/ui-standards/01-shell-layout/artifact-shell.md`
- `docs/ui-standards/01-shell-layout/presentation-modes.md`
- `docs/ui-standards/02-components/workspace-3-tools-strip.md`
- `docs/ui-standards/03-modules/interactive-board-standard.md`

Working implementation plans:
- `docs/product/IDEA_WORKSPACE_V5_IMPLEMENTATION_PROGRAM.md` (V5.0 — scaffolding complete)
- `docs/product/IDEA_WORKSPACE_V5_1_IMPLEMENTATION_PROGRAM.md` (V5.1 — depth + integration, **active**)

Historical / compatibility:
- `docs/product/IDEA_WORKSPACE_V3_SSOT.md`
- `docs/product/IDEA_WORKPLACE_VNEXT_IMPLEMENTATION_PLAN.md`

Cross-platform identity / traceability:
- `docs/product/LINK_GRAPH_V3.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `docs/ui-standards/00-foundation/artifact-identity-map.md`
- `docs/product/ARTIFACT_LINKING_V5_SSOT.md`

---

## 1) Product thesis

This document remains the main product thesis for `Idea Workspace V5`.

The newer document `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md` extends it by freezing:

- the shared organization of the whole `Idea` system,
- the one-idea-many-canvases doctrine,
- and the 6-step documentation order for the next phase.

It does not replace the core thesis below.

`Idea Workspace V5` is not just a mind map, a whiteboard, a flowchart tool, or a table.

It is a single AI-native problem-solving workspace where:
- the user starts from a thought, a problem, a note, a workshop outcome, or a chat conversation
- one idea becomes one living workspace
- four native systems of work coexist inside one shared canvas
- AI helps both as a builder and as a thinking expert
- knowledge, evidence, and context stay attached to the work
- the result can be converted into real execution artifacts

### 1.1 Canonical product statement

`Idea Workspace V5` is a **Thinking OS** for strategy, transformation, problem-solving, and initiative design.

### 1.2 What makes it unique

Unlike the market leaders, we do not want to win by making one tool slightly better.

We win by combining, in one coherent workspace:
- mind mapping
- whiteboard ideation
- process and system diagramming
- structured table thinking
- contextual knowledge
- AI co-thinking
- output conversion

### 1.3 Product promise

> Tell the system what you want to solve or create, and it will help you think faster, structure better, and convert ideas into action.

---

## 2) Product goals (V5)

### 2.1 North star

Move from raw thought to decision-ready or initiative-ready output without forcing the user into heavy documentation too early.

### 2.2 Primary goals

- **Light start** — idea capture must feel effortless.
- **One workspace** — no fragmentation into disconnected mini-apps.
- **AI advantage** — AI does more than draw; it helps think, question, structure, and recommend.
- **Knowledge advantage** — notes, evidence, and context are part of the workspace, not separate from it.
- **Execution advantage** — outputs are traceable and actionable.
- **Premium UX** — the module must feel world-class and unmistakably better.

### 2.3 Non-negotiables

- One idea = one workspace.
- AI never writes silently.
- All important AI changes use `propose -> preview -> accept/reject`.
- `Tools | Context | AI Suggestions` remains the only right workspace strip.
- Four systems of work are first-class but not separate products.
- Dark and light mode must both be premium-quality.

---

## 3) Canonical surfaces

`Idea Workspace V5` consists of five canonical surfaces.

## 3.1 Collection surface (Ideas hub)

Views:
- `List`
- `Cards`
- `Garden`

Purpose:
- browse, sort, open, and triage ideas
- open existing idea or create new idea

## 3.2 Seed Surface (`New Idea`)

This is the default creation surface for a new idea.

It must be light, calm, and low-friction.

Primary entry modes:
- `Describe with AI`
- `Start blank`
- `Use template`

Secondary / advanced entry:
- `Add structured brief`

Also available:
- `Popular starts` (intent-led suggestions)

## 3.3 SuperCanvas

This is the main workspace surface for one idea.

It is one shared, infinite working area where multiple systems of work can coexist:
- Mind Map
- Whiteboard
- Process / System Flow
- Table blocks

This is the biggest change versus simpler "switch between tools" models.

### Canonical rule

We are not building four disconnected canvases.

We are building **one SuperCanvas with four native work systems**.

## 3.4 Idea Card

The idea also has a more formal, deeper artifact layer:
- problem
- opportunity
- goal
- context
- risks
- assumptions
- evidence
- outputs

This surface is not the default entry point for a new idea, but it becomes essential as the idea matures.

## 3.5 Output surfaces

From the workspace, the user can create or update:
- task set
- decision
- initiative
- report
- presentation
- action plan
- RAID log

All outputs must remain traceable to the originating idea and, where possible, the originating selection / block / node / row.

---

## 4) One workspace, four native systems

## 4.1 Canonical systems

The workspace contains four native systems of work:

1. **Mind Map**
2. **Whiteboard**
3. **Process / System Flow**
4. **Table**

These are not "view modes" in the module-hub sense.
They are **native work systems** within one workspace.

## 4.2 Why this matters

Different people think differently:
- some branch ideas
- some sketch
- some model processes
- some structure data in tables

The system must let users move between these modes without switching products or losing context.

## 4.3 Coexistence rule (MUST)

The same idea may include, on one shared SuperCanvas:
- a mind map on the left
- workshop sticky clusters in the center
- a process flow below
- a table block on the right
- a pinned idea card in the top-right
- evidence cards nearby

### Prohibited model

Do not implement V5 as four fully isolated workspaces that happen to share an ID.

That would lose the core product advantage.

---

## 5) Entry model and startup logic

## 5.1 Startup philosophy

The user must never be forced into a heavy form before they have momentum.

### Canonical rule

Start simple by default. Offer deeper structure only when needed.

## 5.2 `New Idea` surface

Main hero input:
- `Describe the problem, idea, or outcome`

Primary starts:
- `Start with AI`
- `Blank canvas`
- `Use template`

Secondary aids:
- `Popular starts`
- `Add structured brief`

## 5.3 Popular starts

Popular starts must be intent-led, not tool-led.

Examples:
- break down a problem
- find root causes
- compare options
- map a process
- turn notes into structure
- prepare an initiative concept
- build a decision map
- simplify a financial statement into a working table

## 5.4 Structured brief

Advanced optional fields:
- problem
- current state
- desired outcome
- constraints
- evidence / notes

### Rule

Structured brief is opt-in. It is never the first wall.

## 5.5 Startup outcomes

Depending on input, the system may:
- open a blank SuperCanvas
- generate a first mind map
- generate a first process flow
- generate a structured table
- suggest the best template
- create a central idea card plus supporting first blocks

---

## 6) Chat-first operating model

## 6.1 Chat role

The persistent side chat is not just an assistant.

In V5, chat has two roles:
- **Builder**
- **Expert**

## 6.2 Builder role

Builder actions include:
- create first structure
- generate a mind map
- generate a table
- generate a process flow
- cluster notes
- expand branches
- create outputs

## 6.3 Expert role

Expert actions include:
- challenge assumptions
- suggest missing dimensions
- identify risks
- recommend frameworks
- explain tradeoffs
- suggest measurements / KPIs
- suggest next steps

## 6.4 Chat handoff contract

From the first screen, chat must be able to hand off into workspace creation with:
- idea seed
- preferred initial system
- optional template
- optional generated proposal
- optional focused object / selection

## 6.5 AI safety contract

All significant workspace mutations must be:
- proposed
- previewed
- reversible
- attributable

### Must include

- rationale
- confidence
- source context when relevant
- apply / reject / partial apply

## 6.6 Anti-patterns

Do not treat chat as:
- a separate product replacing the workspace
- a blind automation engine
- a text-only helper

Chat must be deeply contextual to the active idea and active selection.

---

## 7) SuperCanvas architecture

## 7.1 Canonical model

The SuperCanvas is one shared spatial workspace containing heterogeneous but compatible objects.

## 7.2 Object families

The workspace must support these object families:

- **Idea nodes**
  - topic
  - subtopic
  - hypothesis
  - option
  - risk
  - action
  - decision point
- **Whiteboard objects**
  - sticky
  - text
  - shape
  - frame
  - drawing
- **Process objects**
  - start
  - action
  - decision
  - document
  - data
  - system
  - handoff
  - lane
  - VSM object
- **Table objects**
  - table block
  - row
  - column
  - view definition
- **Knowledge objects**
  - knowledge card
  - note card
  - evidence card
  - linked artifact card
- **System objects**
  - pinned idea card
  - AI proposal block
  - output block

## 7.3 Spatial rules

- the user may place multiple object families on one canvas
- each family preserves its own semantics
- objects can be linked across families
- the canvas must remain one coherent idea workspace, not a junk drawer

## 7.4 Focus modes

The workspace should support:
- **full SuperCanvas mode**
- **focused system mode** (work mostly in one system)
- **focused object mode** (deep work in one node/block/row/step)

## 7.5 Open / close behavior

Canvas areas may be:
- expanded for deep work
- collapsed back into the wider workspace
- reopened with preserved viewport and selection

This is especially important for:
- process flows
- large tables
- complex branch exploration

## 7.6 Navigation contract

The workspace navigation must remain split into two clearly different layers:

- **work system switcher** — `Mind Map | Whiteboard | Process / System Flow | Table`
- **right-side workspace strip** — `Tools | Context | AI Suggestions`

Rules:

- the 4-system switcher changes how the user works on the same idea
- the right strip never changes the active work system
- the right strip remains the only workspace-side panel switcher
- the module topbar must not duplicate the 4-system switcher for an already open idea document
- contextual CTA buttons inside the canvas may open `Tools`, but must delegate to the strip contract instead of creating parallel navigation
- visual weight must make the distinction obvious: system navigation is local to the canvas, panel navigation is local to the right rail

---

## 8) Knowledge layer

## 8.1 Why this layer exists

The market has strong tools for notes and strong tools for canvases, but they are usually not one system.

V5 must unify knowledge and ideation.

## 8.2 Knowledge primitives

The workspace must support:
- knowledge cards
- imported notes
- linked documents
- evidence cards
- OCR / extracted text cards
- Q&A knowledge cards
- artifact references

## 8.3 Canonical rule

Knowledge must be attachable to:
- the whole idea
- a specific node
- a specific branch
- a flow step
- a table row
- a selection

## 8.4 Context panel

The `Context` panel remains the system contract for:
- linked artifacts
- backlinks (`Used in`)
- suggested links
- related notes
- related evidence
- KPI / metrics references
- interview insights

## 8.5 Search and retrieval

The user must be able to:
- search knowledge from the workspace
- insert knowledge into the workspace
- send knowledge to chat
- link workspace objects to knowledge

---

## 8.6 Internal linking and artifact identity

> Canonical cross-platform details for this system live in:
> `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
>
> The section below defines how that system must manifest specifically inside `Idea Workspace V5`.

## 8.6.1 Why this matters

The workspace should not only contain thinking objects.

It should also become a lightweight relational surface that can connect the thinking layer with the rest of the platform:
- initiatives
- tasks
- decisions
- reports
- presentations
- assessments
- notebook pages
- tool sessions
- finance artifacts
- future artifacts

This is how one idea becomes a living map of a real transformation or project.

## 8.6.2 Canonical terminology

### `Artifact`

An `Artifact` is any persistent platform object that can be opened, previewed, linked, and used as context.

Examples:
- `initiative`
- `task`
- `decision`
- `idea`
- `notebook_page`
- `tool_session`
- `assessment_report`
- `report`
- `presentation`
- `financial_model`
- `budget`
- `valuation`

### `ArtifactRef`

`ArtifactRef` is the stable machine-readable reference:
- `type`
- `id`

This remains the canonical technical identity for links and graph relations.

### `ArtifactIndex`

`ArtifactIndex` is the human-readable address shown in UI.

Examples:
- `INIT-024`
- `TASK-118`
- `DEC-041`
- `IDEA-017`
- `FIN-MOD-003`
- `BUD-012`
- `VAL-006`

### `ArtifactLink`

`ArtifactLink` is a relation between a workspace object and a platform artifact.

This is the thing the user experiences as:
- attached artifact
- linked artifact
- source artifact
- used artifact

## 8.6.3 Canonical rule

Every important platform artifact should have:
- a stable machine identity (`ArtifactRef`)
- a visible human address (`ArtifactIndex`)
- a canonical icon/accent identity
- deep-link open behavior
- preview behavior
- permission-aware metadata access

## 8.6.4 Workspace object linking

The following workspace objects must support attached artifacts:
- mind map node
- whiteboard sticky / cluster / frame
- process step / lane / VSM block
- table row / table block
- knowledge card
- pinned idea card

### Attachment cardinality

Each workspace object may have:
- zero artifacts
- one artifact
- many artifacts

## 8.6.5 UX rule: linking must stay light

The linking system must feel like a subtle superpower, not a heavy admin workflow.

Default behavior:
- an object shows a tiny linked-artifacts indicator only when links exist
- indicator may be icon + count, e.g. `3 linked`
- click opens a small preview stack / popover / side detail
- primary action remains the thinking object itself, not the link chrome

## 8.6.6 How users create links

Supported gentle entry points:
- `Attach artifact` from object context menu
- drag artifact from Context panel onto object
- AI proposal: "Attach 5 related initiatives to this branch"
- paste deep link / artifact address and resolve it
- table row autofill from attached artifact

### Must not do

- force the user to fill relation forms
- open a large modal for every small link
- turn each node into a busy metadata card

## 8.6.7 Open and preview behavior

If a linked artifact exists on a workspace object:
- single click on the object still focuses the object
- click on the link indicator opens linked artifact preview
- `Open` navigates to the artifact in its native module
- preview must show at least:
  - icon
  - title
  - `ArtifactIndex`
  - type
  - key metadata

## 8.6.8 LinkGraph rule

All workspace-to-artifact links must be persisted through the platform LinkGraph contract, not only inside local UI state.

This preserves:
- backlinks (`Used in`)
- AI context packs
- cross-module visibility
- future graph / navigation use cases

## 8.6.9 Finance artifact parity

Finance artifacts must participate in the same system.

At minimum V5 should treat these as first-class linkable artifacts:
- `financial_model`
- `budget`
- `valuation`
- `analysis`

This is important for:
- investment idea comparisons
- scenario tables
- process-to-economics mapping
- idea-to-business-case reasoning

## 8.6.10 AI retrieval and linking

AI should be able to work with artifact links in a controlled way.

Examples:
- "attach all initiatives related to this branch"
- "build a comparison table from these 7 investment artifacts"
- "find all finance models connected to this transformation theme"
- "turn this strategy map into a linked overview of initiatives"

### AI contract

AI may propose:
- which artifacts should be linked
- where they should be attached
- what fields should be autofilled

But the user still accepts the proposal before apply.

## 8.6.11 Table autofill rule

If a table row is linked to an artifact, the system may offer non-destructive autofill of useful fields.

Examples:
- title
- owner
- status
- spend
- timeline
- ROI / payback
- priority
- linked initiative count

### Rule

Autofill must be:
- previewable
- selective
- refreshable
- clearly sourced from the artifact

## 8.6.12 Naming recommendation

For product language:
- use `Artifacts` for the system concept
- use `Linked artifacts` in object-level UI
- use `Open artifact` for navigation
- use `Attach artifact` for the action

Avoid overloaded labels like:
- `references`
- `objects`
- `resources`

They are less concrete for users.

---

## 9) Idea Card (formalization layer)

## 9.1 Role

The Idea Card is the formal, maturing representation of the idea.

It must not block initial ideation, but it must exist as the place where the idea becomes rigorous.

## 9.2 Contents

At minimum:
- title
- one-line summary
- problem / opportunity
- current state
- desired outcome
- why now
- assumptions
- risks
- evidence
- status / maturity
- next best action

## 9.3 State model

Suggested states:
- `spark`
- `framing`
- `exploring`
- `structuring`
- `validating`
- `ready_to_convert`
- `converted`

## 9.4 Pinned card

The workspace should support a pinned summary card, visible in the canvas as a stable orientation anchor.

---

## 10) Mind Map system

## 10.1 Purpose

Mind Map is the fastest and most natural mode for:
- branching ideas
- exploring problems
- building hypotheses
- creating reasoning structures

## 10.2 Core interactions

- add child
- add sibling
- rename inline
- reparent
- detach branch
- duplicate branch
- collapse / expand branch
- connect nodes
- summarize branch
- convert branch

## 10.3 Node depth

Nodes are not just labels.

A node may include:
- title
- notes / context
- goal
- rationale
- evidence links
- risk note
- AI expansion history
- tags / semantic type

## 10.4 Visual rules

- branch-level color inheritance
- elegant curved edges
- subtle living-line motion where appropriate
- readable typography
- compact contextual mini-toolbar

## 10.5 AI actions

- expand branch
- find missing branches
- suggest root causes
- suggest actions
- cluster similar nodes
- summarize branch
- turn branch into tasks
- turn branch into process flow

---

## 11) Whiteboard system

This section is extended in the `Idea v8` program by:

- `docs/product/WHITEBOARD_V8_READINESS_AUDIT.md`
- `docs/product/WHITEBOARD_V8_SSOT.md`

These documents do not replace the inherited `V5` product thesis.
They finalize the whiteboard package by freezing readiness truth, missing functions, and the final product contract for step 3 of the `Idea` program.

## 11.1 Purpose

Whiteboard is the free-form ideation and workshop system.

It is where chaos is allowed to appear before being structured.

## 11.2 Core interactions

- sticky notes
- text blocks
- basic shapes
- frames
- connectors
- images
- comments
- grouping / ungrouping
- align / distribute
- lasso select

## 11.3 AI actions

- cluster notes
- summarize selection
- generate ideas from notes
- name clusters
- find themes
- turn clusters into map branches
- turn notes into a table
- extract actions

## 11.4 Scope discipline

Do not turn Whiteboard into an all-purpose design platform.

Keep it:
- lightweight
- fast
- facilitation-friendly
- business-problem oriented

---

## 12) Process / System Flow system

## 12.1 Purpose

This system is for:
- classical process flow mapping
- systems and dependency mapping
- automation-oriented process analysis
- VSM / value stream work

## 12.2 Three modes inside one engine

The Process Flow system must support:
- **Classic Flow**
- **Automation Flow**
- **VSM**

## 12.3 Classic Flow

Use for:
- general business process modeling
- decision paths
- dependencies
- information / document movement

## 12.4 Automation Flow

Use for:
- mapping current process
- measuring steps
- identifying optimization opportunities
- designing automation candidates
- linking economics / savings logic

## 12.5 VSM

Use for:
- current-state value stream
- future-state value stream
- lead time
- wait time
- inventory / queue
- information flow
- material flow

### Canonical rule

VSM is not just a prettier flowchart.
It requires dedicated object types and timeline / flow semantics.

## 12.6 Core interactions

- semantic step library
- lane management
- insert step between
- split path
- label decision edges
- move step between lanes
- auto-layout
- validate flow
- generate from notes / map / chat

## 12.7 AI actions

- generate flow from description
- generate lanes
- suggest missing steps
- find bottlenecks
- find handoff risks
- propose as-is / to-be variants
- convert process into tasks or initiatives

---

## 13) Table system

## 13.1 Purpose

The Table system is the structured thinking and analysis engine.

It must support:
- comparison
- prioritization
- assumptions
- experiments
- plans
- simplified data models

## 13.2 Canonical principle

Table is not a fallback surface.

It is a first-class workspace for:
- structure
- analysis
- simplification
- decision support

## 13.3 Supported views

- table
- kanban
- timeline
- calendar
- matrix
- grid

### Must respect global order

When these views are shown in chrome, they must follow the frozen canonical order from the UI standards.

## 13.4 AI actions

- generate columns
- generate first rows from text
- group rows
- suggest scoring model
- compare options
- create decision matrix
- create action plan
- simplify large source data into a usable model

## 13.5 Example use cases

- decision matrix
- cost structure breakdown
- automation backlog
- experiment tracker
- initiative options
- stakeholder table
- simplified financial statement

---

## 14) Templates

## 14.1 Template philosophy

Templates are accelerators, not cages.

They reduce blank-screen anxiety and speed up quality starts.

## 14.2 Two levels of templates

### Idea templates

Templates for starting an idea, e.g.:
- problem framing
- opportunity framing
- initiative concept
- workshop debrief

### System templates

Templates per native work system:

**Mind Map**
- problem tree
- issue tree
- solution tree
- root cause map

**Whiteboard**
- brainstorming board
- affinity mapping
- workshop board
- retrospective board

**Process / System Flow**
- classic flow
- automation flow
- VSM current state
- VSM future state

**Table**
- decision matrix
- assumptions log
- action plan
- simplified financial table

## 14.3 Entry points

Templates must be available from:
- New Idea screen
- chat recommendations
- system-specific empty states
- transform actions

---

## 15) AI rules

## 15.1 AI posture

AI in V5 is not only a generator.
It is:
- a builder
- an expert
- a critic
- a simplifier
- a converter

## 15.2 AI outputs

AI may produce:
- blocks
- nodes
- flows
- rows / columns
- summaries
- recommendations
- questions
- conversion proposals

## 15.3 Governance

All major AI outputs must support:
- rationale
- confidence
- source context or evidence hint where relevant
- preview
- partial accept
- reject
- auditability

## 15.4 Anti-spam rule

AI suggestions must be helpful without flooding the center workspace.

Default behavior:
- AI lives in chat, contextual actions, and the right-side strip
- no permanent noisy feed in the main canvas

---

## 16) Conversion and action layer

## 16.1 Purpose

The workspace must not stop at ideation.

It must convert work into execution.

## 16.2 Convert targets

- task
- task set
- decision
- initiative
- report
- presentation
- action plan
- RAID log

## 16.3 Granularity

Conversion may happen from:
- whole idea
- branch
- cluster
- selected notes
- flow segment
- selected table rows

## 16.4 Traceability rule

Every output must preserve:
- source idea
- source object or selection where possible
- LinkGraph backlinks

---

## 17) Visual language for V5 — `Tech Sexy 2026`

## 17.1 Canonical direction

V5 uses:

**Monochrome chrome, colorful intelligence.**

Meaning:
- application chrome remains quiet, restrained, and premium
- color and motion live mainly inside the canvas content

## 17.2 Chrome rules

- monochromatic UI chrome
- invisible borders
- depth through background layers
- outline icons
- max one primary CTA in a local action region

## 17.3 Canvas color rules

Canvas content may use richer semantic color systems than the chrome, but in a disciplined, intentional way.

### Mind Map
- hierarchical branch color inheritance
- premium, non-neon palette

### Process / System Flow
- semantic colors by lane / type / meaning

### Whiteboard
- cluster or note-type based colors

### Table
- restrained status / category / emphasis color only

## 17.4 Motion rules

Motion must be functional:
- orient the user
- reveal hierarchy
- support focus
- make the system feel alive

### Allowed motion examples

- gentle edge pulse on selected branch
- subtle directional activity on active process path
- smooth zoom and fit transitions
- quiet hover / focus transitions

### Disallowed

- flashy constant animation
- decorative movement without semantic purpose

## 17.5 Background rules

Per system defaults:
- Mind Map: clean or soft dot
- Whiteboard: dot grid
- Process / System Flow: soft grid
- Table: clean

## 17.6 Dark and light mode

Dark mode is primary, but light mode must be intentionally designed and equally premium.

Do not rely on simple color inversion.

---

## 18) Data contract (V5 evolution)

## 18.1 Compatibility rule

V5 should evolve from the current shared graph model instead of discarding it.

### Canonical direction

Keep compatibility with `nodes[]`, `edges[]`, and `extensions`, but evolve the schema toward a richer `IdeaWorkspaceDocument`.

## 18.2 Canonical V5 workspace document

At minimum:

- `ideaId`
- `title`
- `summary`
- `stage`
- `preferredSystem`
- `nodes[]`
- `edges[]`
- `extensions`
- `surfaceState`
- `selectionState`
- `knowledgeRefs[]`
- `outputLinks[]`

## 18.3 Node extensions

Nodes must support:
- `system`: `mindmap | whiteboard | process_flow | table | knowledge | system`
- `kind`
- `artifactRef?`
- `artifactLinks?`
- `payload`
- `style`
- `metadata`
- `aiMeta`

### `artifactLinks`

Workspace objects may store lightweight attached-artifact references:
- `artifactRef`
- `artifactIndex`
- `label`
- `linkRole` (`context | source | output | evidence | related`)
- `pinned?: boolean`

The persistent relation truth still belongs to LinkGraph.
The workspace stores only the object-local attachment contract required for rendering and interaction.

## 18.4 No-data-loss rule

Switching systems must never destructively migrate or drop data.

Hidden or currently unused semantics remain preserved in namespaced extensions until the user chooses a transform.

---

## 19) Definition of Done (module-level)

`Idea Workspace V5` is considered aligned with this SSOT only if:

- a new idea starts from a light Seed Surface
- chat can hand off into workspace creation
- one idea can contain multiple work systems on one canvas
- the four native systems are first-class and coherent
- knowledge and context are attached to work, not orphaned
- AI acts as builder and expert with governance
- conversion to outputs is traceable
- the module feels premium in both dark and light mode

---

## 20) Explicit exclusions (for scope control)

Not part of the initial V5 implementation unless explicitly promoted:

- full Figma-like collaboration suite
- plugin marketplace
- unrestricted whiteboard design system
- complete Airtable admin/database builder parity
- full BPMN certification scope
- full Miro / Mural facilitation parity in the first milestone

---

## 21) Migration and implementation note

For implementation, this SSOT must be paired with:
- `docs/product/IDEA_WORKSPACE_V5_IMPLEMENTATION_PROGRAM.md`

That document owns:
- task ledger
- dependencies
- execution order
- release cutline
- QA gates
- blockers
- progress log

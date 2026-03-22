# Process Flow v8 SSOT

> Status: Draft v8
> Owner: Product + Engineering
> Scope: define the final product truth for `Process Flow` inside `Idea Workspace`, including missing enterprise capabilities, interoperability, and the exact way those additions should be added to the system

---

## 1. Why this document exists

`Process Flow` already has meaningful runtime seams, but still lacks one final canonical product contract.

This document exists to freeze:

- what `Process Flow` is
- what `Process Flow` is not
- what capabilities are still missing or only partial
- how those missing capabilities should be added into the existing system architecture

This is the `Process Flow` equivalent of final product closure for step 4 of the `Idea v8` program.

---

## 2. Inherited truth

This document inherits:

- `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `IDEA_WORKSPACE_V5_SSOT.md`
- `CANVAS_OS_CONTRACT_FREEZE.md`
- `WORKSTATION_CANVAS_FINAL_MASTER_PLAN_2026-03-16.md`
- `WORKSTATION_CANVAS_IMPLEMENTATION_PLAN_2026-03-16.md`
- `PROCESS_FLOW_V8_READINESS_AUDIT.md`

Rule:

`Process Flow remains one native work system inside one idea workspace, never a disconnected diagram product or generic flowchart shell`

---

## 3. Final product statement

`Process Flow` is the formal process, dependency, automation, and value-stream modeling surface inside `Idea Workspace`.

It exists for moments when:

- exploration must become logic
- ownership, routing, and handoffs matter
- a process must be validated rather than only sketched
- the user needs to compare as-is versus to-be
- process work must feed execution, automation, ROI, and downstream artifacts

Canonical statement:

`Process Flow is where an idea becomes a governed operational model with real semantics, readable routing, validation, and traceable promotion into execution.`

---

## 4. Product identity

`Process Flow` is:

- a formal process modeling surface
- an automation analysis surface
- a systems and responsibility mapping surface
- a value-stream surface
- a bridge from thinking to execution architecture

`Process Flow` is not:

- a generic shape board
- only a prettier flowchart
- a disconnected BPMN specialist app
- a place where semantics live only visually
- a place where AI silently authors processes without review

---

## 5. Core jobs to be done

`Process Flow` must let the user:

- model current and future processes
- express decisions, handoffs, lanes, systems, and ownership
- validate the quality of a flow
- reason about automation candidates
- reason about value stream bottlenecks and waiting time
- convert process work into tasks, initiatives, execution plans, and ROI logic

---

## 6. Canonical operating modes

The engine must keep three modes inside one runtime:

### 6.1 Classic Flow

Use for:

- general business process mapping
- step logic
- decision paths
- dependencies and document movement

### 6.2 Automation Flow

Use for:

- trigger and action logic
- integrations and handoffs
- automation candidate design
- system interactions and execution metadata

### 6.3 VSM

Use for:

- current-state and future-state value streams
- lead time and wait time
- queues and inventory
- bottleneck visibility

Canonical rule:

`VSM is not a visual theme; it is a dedicated semantic mode with its own object expectations and analysis needs.`

---

## 7. Current capability truth

Use capability labels from `CANVAS_OS_CONTRACT_FREEZE.md`.

### 7.1 Real

- shared workspace placement
- lane-based editing
- multiple mode support
- basic semantic kit direction
- basic validation
- auto-layout
- node movement between lanes
- basic AI generation and summary entry points

### 7.2 Partial

- final properties strip
- full rules engine and problem workflow
- manual routing and orthogonal snapping
- BPMN round-trip semantics
- semantic step templates
- large-flow navigation and search
- traceability into downstream execution artifacts
- enterprise interop

### 7.3 Out of scope for current closure

- becoming a full standalone modeling suite outside `Idea Workspace`
- full Visio/Lucid parity in the first cut
- uncontrolled custom diagram studio breadth

---

## 8. Missing capabilities and how they must be added

This section freezes the exact additions still required.

### 8.1 Properties strip for nodes and edges

Missing capability:

- a final process-grade properties surface

Why it matters:

- a process system is not trustworthy if the important truth only lives in visible labels

How it must be added:

- expose a canonical `properties strip` inside the existing `Tools` panel
- support node and edge editing
- include at minimum:
  - label
  - type
  - lane / owner / system
  - semantic metadata
  - linked artifacts
  - decision or routing metadata
  - optional execution metadata

System placement:

- existing `Tools` panel
- no new side panel architecture
- persisted in shared graph plus `extensions.processFlow` where needed

### 8.2 Rules engine and Problems panel

Missing capability:

- a full quality-control workflow

Why it matters:

- enterprise process work needs explicit problem visibility, not just passive warnings

How it must be added:

- convert current validations into rules with:
  - `id`
  - `severity`
  - `message`
  - `targets`
- add a `Problems` panel with:
  - grouped issues
  - jump-to-element
  - highlight in canvas
  - optional ignore rule mechanism where appropriate

System placement:

- local process runtime
- `Context` panel or dedicated process subview inside existing right strip
- activity/audit awareness for ignored rules where needed

### 8.3 Manual routing, bendpoints, and reconnect

Missing capability:

- BPMN-class edge readability

Why it matters:

- process understanding depends heavily on clean routing and intentional connections

How it must be added:

- support bendpoints stored on edges
- support orthogonal snapping
- support reconnect without losing route shape
- reroute intelligently after node movement when useful

System placement:

- edge runtime and renderer
- shared selection and snap grammar where possible

### 8.4 BPMN import/export round-trip

Missing capability:

- real BPMN interoperability

Why it matters:

- without round-trip, the tool remains internally useful but externally weak

How it must be added:

- import BPMN XML into graph nodes/edges plus lane/pool semantics
- export graph back into BPMN XML with stable IDs
- preserve minimum BPMN symbol set and core semantics
- treat fidelity explicitly, not as an implicit promise

System placement:

- import/export pipeline
- process-flow-specific serializers/parsers
- shared audit and file handling

### 8.5 Semantic step templates

Missing capability:

- domain-specific reusable step definitions

Why it matters:

- enterprise process design uses repeatable semantic steps, not only raw shapes

How it must be added:

- support `step templates` or `element templates`
- templates should define:
  - visible defaults
  - metadata schema
  - semantic class
  - compatibility rules
- reject incompatible templates clearly

System placement:

- properties strip
- template/library metadata layer
- org-governed configuration

### 8.6 Search, jump, copy/paste, and convert

Missing capability:

- large-flow working grammar

Why it matters:

- process diagrams become hard to use quickly if users cannot search, jump, copy, and transform elements

How it must be added:

- support `CTRL/CMD+F` by label and ID
- support jump-to-result
- support copy/paste of selected process elements
- support in-place `Convert to...` for compatible step classes

System placement:

- local process runtime
- command palette and keyboard layer

### 8.7 Mermaid flowchart import

Missing capability:

- fast text-to-diagram entry path

Why it matters:

- this is one of the highest-value lightweight interop additions

How it must be added:

- support paste of Mermaid `flowchart`
- map `subgraph` into sections or frames
- preserve simple links and node labels
- treat richer Mermaid families later as additional cuts

System placement:

- import pipeline
- discovery/library or paste entry

### 8.8 Traceable promotion into downstream artifacts

Missing capability:

- full process-to-action lineage

Why it matters:

- a process that cannot feed execution remains too static

How it must be added:

- allow steps and flow outputs to link into:
  - tasks
  - initiatives
  - runbooks
  - automation candidates
  - ROI/economics artifacts
- preserve `source_type/source_id` style lineage

System placement:

- shared artifact linking layer
- convert/promotion flows
- execution and initiative integration surfaces

### 8.9 Clickable steps and richer context behavior

Missing capability:

- process elements as navigable business objects

Why it matters:

- users need process steps to open real context, not only sit in the diagram

How it must be added:

- support clickable steps with:
  - link preview
  - artifact open
  - context detail
  - `Used in` and backlinks over time

System placement:

- node toolbar / context menu
- `Context` panel
- shared object-reference layer

### 8.10 Versioning, diff, and simulation

Missing capability:

- higher-order process analysis beyond raw editing

Why it matters:

- mature process work requires comparison and scenario thinking

How it must be added:

- support version compare and diff as later-stage process tooling
- support simple what-if and bottleneck simulation where justified
- keep this explicitly post-P0/P1, not mixed into the foundation layer

System placement:

- later-stage analysis layer
- not required to block the first production closure

---

## 9. AI operating model

AI in `Process Flow` must act primarily as:

- flow drafter
- step gap detector
- bottleneck and handoff analyst
- as-is / to-be proposal assistant
- execution promotion assistant

AI in `Process Flow` must not act as:

- a silent process author
- a source of structurally unsafe flow mutations
- a fake validator replacing explicit rules

Canonical rule:

`AI may generate, summarize, and propose improvements, but real process truth still depends on explicit review, semantic metadata, and rule-based validation.`

---

## 10. System architecture placement

`Process Flow` should use the existing architecture in four layers:

### 10.1 Shared shell

- one idea = one workspace
- work-system switcher
- right strip `Tools | Context | AI Suggestions`
- shared export/share entry points

### 10.2 Local process runtime

- nodes and edges
- lanes and pools
- validators
- routing
- semantic mode behavior

### 10.3 Shared governance layer

- proposal review
- share policy
- audit/replay
- template governance

### 10.4 Shared artifact/promotion layer

- tasks
- initiatives
- ROI/economics artifacts
- execution records
- linked notes and evidence

---

## 11. Final product promise

When a user opens `Process Flow`, they should feel:

- they can formalize messy thinking into readable process logic,
- the system supports real semantics, not only drawing,
- the diagram can be validated and improved,
- AI helps with structure and analysis without bypassing review,
- and the resulting process can feed execution and operational artifacts.

---

## 12. Acceptance criteria

This document is satisfied only when:

- process nodes and edges have a real properties strip
- validation is rule-based and exposed through a real problems workflow
- routing is clean enough for serious process readability
- BPMN round-trip has explicit supported semantics
- semantic templates exist for domain steps
- search, copy/paste, and convert are usable on larger diagrams
- process outputs can promote into downstream artifacts with lineage
- AI assists process work without replacing explicit governance

---

## 13. Related canonical docs

- `PROCESS_FLOW_V8_READINESS_AUDIT.md`
- `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `IDEA_WORKSPACE_V5_SSOT.md`
- `CANVAS_OS_CONTRACT_FREEZE.md`
- `WORKSTATION_CANVAS_FINAL_MASTER_PLAN_2026-03-16.md`

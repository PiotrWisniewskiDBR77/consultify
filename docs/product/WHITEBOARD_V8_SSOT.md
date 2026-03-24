# Whiteboard v8 SSOT

> Status: Draft v8
> Owner: Product + Engineering
> Scope: define the final product truth for `Whiteboard` inside `Idea Workspace`, including missing functions, capability labels, and the exact way the missing functions should be added to the system

---

## 1. Why this document exists

`Whiteboard` already has meaningful runtime seams, but it still lacks one final canonical product contract.

This document exists to freeze:

- what `Whiteboard` is
- what `Whiteboard` is not
- what functions are still missing or only partial
- how those functions should be added into the existing system architecture

This is the `Whiteboard` equivalent of final product closure for step 3 of the `Idea v8` program.

---

## 2. Inherited truth

This document inherits:

- `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `IDEA_WORKSPACE_V5_SSOT.md`
- `CANVAS_OS_CONTRACT_FREEZE.md`
- `WORKSTATION_CANVAS_FINAL_MASTER_PLAN_2026-03-16.md`
- `WORKSTATION_CANVAS_RECOMMENDED_FEATURES_2026-03-16.md`
- `WORKSTATION_CANVAS_IMPLEMENTATION_PLAN_2026-03-16.md`
- `WHITEBOARD_V8_READINESS_AUDIT.md`

Rule:

`Whiteboard remains one native work system inside one idea workspace, never a disconnected board file or parallel product shell`

---

## 3. Final product statement

`Whiteboard` is the freeform workshop and synthesis canvas inside `Idea Workspace`.

It exists for moments when:

- thinking is still messy
- the user needs spatial freedom
- the team needs a facilitation surface
- ideas should first be captured, moved, clustered, and discussed
- structure should emerge from exploration rather than be imposed too early

Canonical statement:

`Whiteboard is where an idea is allowed to become messy, collaborative, and visual before being turned into clearer structure, outcomes, and execution artifacts.`

---

## 4. Product identity

`Whiteboard` is:

- a workshop surface
- a sticky-first ideation board
- a facilitation canvas
- a synthesis layer between chaos and structure
- an input and transformation surface for the broader `Idea Workspace`

`Whiteboard` is not:

- a generic infinite canvas wrapper
- a design system playground
- a Figma replacement
- a disconnected whiteboard file product
- a place where AI silently rewrites the board

---

## 5. Core jobs to be done

`Whiteboard` must let the user:

- capture fast thoughts on sticky notes
- sketch with text, shapes, arrows, and images
- group ideas into frames, clusters, and working areas
- facilitate workshops with timer, voting, follow, and spotlight behaviors
- synthesize chaos into themes, outcomes, decisions, and actions
- convert board outputs into notes, tasks, decisions, process flows, and other artifacts

---

## 6. Current capability truth

Use capability labels from `CANVAS_OS_CONTRACT_FREEZE.md`.

### 6.1 Real

- shared workspace placement
- shared graph persistence
- sticky, text, frame, image, link, summary, and metric object families
- grouping / ungrouping
- comments, activity, and history seams
- draw mode existence
- session seams for timer, voting, follow, and spotlight

### 6.2 Partial

- final whiteboard tool-state grammar
- pen / highlighter / eraser product closure
- first-class paste and clipboard pipeline
- affinity clustering and AI-assisted synthesis as one canonical flow
- workshop template system
- export contract and board-pack semantics
- snapping and large-board performance polish
- chat-sidekick and AI board collaboration doctrine

### 6.3 Out of scope for current closure

- turning `Whiteboard` into a full design platform
- unrestricted UI prototyping surface
- public standalone board product detached from `Idea Workspace`

---

## 7. Missing functions and how they must be added

This section is the final answer to the key product question:

which functions still matter, and how should they enter the system without breaking the architecture.

### 7.1 Explicit tool-state machine

Missing function:

- a calm, explicit tool model for `select`, `hand`, `draw`, and erase behavior

Why it matters:

- without this, `Whiteboard` feels like a feature bundle instead of a native board

How it must be added:

- add a canonical whiteboard interaction state model inside local board runtime
- keep the active state visible in the existing canvas toolbar
- make the selected tool change real behavior, not just labels
- reuse shared canvas grammar where possible so `hand`, viewport, and selection feel aligned with other canvases

System placement:

- local canvas runtime
- shared toolbar state
- persisted `extensions.whiteboard.mode` only where durable user preference is useful

### 7.2 Pen, highlighter, and eraser closure

Missing function:

- final, production-grade freehand workflow

Why it matters:

- without a trustworthy draw path, the board never feels like a real workshop canvas

How it must be added:

- treat drawing as a first-class object family under `extensions.whiteboard.drawingPaths`
- define at least two visible draw variants: `pen` and `highlighter`
- define eraser behavior as object/path editing, not as an unclear destructive shortcut
- ensure undo/redo and persistence are stable for draw operations

System placement:

- local board runtime
- shared history / undo layer
- persistence through `extensions.whiteboard`

### 7.3 First-class image and paste pipeline

Missing function:

- zero-friction paste and insertion of image, URL, and text content

Why it matters:

- this is one of the fastest ways to make `Whiteboard` feel native and modern

How it must be added:

- define external content handlers for pasted images, links, and plain text
- pasted image should create an `image` object
- pasted URL should create either a link object or a richer object when recognized
- pasted text may become sticky, text block, or outline import depending on context
- keep this as a pipeline, not a one-off event handler

System placement:

- input layer in local board runtime
- shared insert event grammar
- optional AI enrichment only after explicit user choice

### 7.4 Affinity clustering and synthesis flow

Missing function:

- final clustering workflow that turns a messy board into themes and outputs

Why it matters:

- this is one of the core reasons `Whiteboard` exists inside `Idea Workspace`

How it must be added:

- support manual clustering through frame/area selection and group semantics
- support AI-assisted clustering through `propose -> preview -> accept/reject`
- let the user turn clustered material into `theme`, `outcome`, `decision`, and `action`
- keep lineage from source sticky notes to synthesized outputs

System placement:

- local board runtime for manual moves
- AI Suggestions panel for governed clustering proposals
- output registry inside `extensions.whiteboard`

### 7.5 Frames, sections, and present mode

Missing or incomplete function:

- final board grammar for workshop sections and presentation by area

Why it matters:

- frames are not decoration; they are the main structure primitive for workshops

How it must be added:

- treat frames and areas as first-class board containers
- allow them to structure ideation spaces, clustering zones, and presentation scenes
- define scene navigation and present mode around frames or saved scenes
- keep these controls inside the existing shell, not via a new navigation layer

System placement:

- local board runtime
- shared export / presentation entry points
- optional scene metadata in `extensions.whiteboard`

### 7.6 Facilitation runtime hardening

Missing or incomplete function:

- final workshop session contract

Why it matters:

- current timer/voting/follow/spotlight seams are strategically good, but still not one hardened story

How it must be added:

- define a canonical `WhiteboardSessionState`
- keep session role vocabulary `facilitator`, `participant`, `observer`
- persist session changes durably enough for shared review and replay
- log session actions in board activity/audit trail
- keep facilitation state visible but lightweight

System placement:

- `extensions.whiteboard.session`
- collaboration/presence channel
- activity/audit layer

### 7.7 Workshop templates and library entry

Missing function:

- final intent-led workshop starts

Why it matters:

- a workshop board should start from real use cases, not from object picking alone

How it must be added:

- expose workshop templates such as brainstorm, retro, impact/effort, journey map, and decision jam
- keep templates in discovery/library entry, not as a replacement for the workspace shell
- let template application create a starting board structure without breaking one-idea-one-workspace identity

System placement:

- left discovery / template layer
- shared template metadata
- board object insertion through existing graph and insert contracts

### 7.8 Export and clipboard contract

Missing or incomplete function:

- final production export semantics

Why it matters:

- consulting workflow needs easy sharing into documents, decks, and reports

How it must be added:

- define baseline formats: `PNG`, `SVG`, `PDF`, and structured export where useful
- add clipboard export semantics for fast reuse
- preserve board classification and watermark policy when relevant
- define `board pack` as optional richer export with metadata and links

System placement:

- shared export/share entry points
- governance/share policy layer
- whiteboard-specific renderer/export helpers

### 7.9 Dot-grid, palette, snapping, and object polish

Missing or incomplete function:

- final ergonomic board feel

Why it matters:

- without this, even good runtime functions still feel rough

How it must be added:

- support dot-grid toggle and stable card palette
- keep sticky and card colors semantically clean and consistent
- add snapping indicators and stronger alignment behavior
- ensure z-order and layout actions behave predictably

System placement:

- local board renderer
- shared canvas primitives where applicable
- theme/settings layer in the existing `Tools` panel

### 7.10 Performance guardrails

Missing function:

- final large-board readiness

Why it matters:

- workshop boards can become large very quickly

How it must be added:

- add viewport-aware rendering and render-budget rules
- throttle expensive board operations
- separate model truth from render-heavy helpers where useful
- treat large-board smoothness as an explicit acceptance requirement

System placement:

- local render/runtime layer
- shared viewport grammar
- QA/perf baseline

### 7.11 AI sidekick for board synthesis

Missing or incomplete function:

- a canonical board-aware AI collaborator

Why it matters:

- `Whiteboard` is the canvas where AI should help synthesize, not just generate noise

How it must be added:

- AI must understand current selection, frame, cluster, and workshop phase
- AI may summarize, name clusters, find themes, extract actions, and suggest promotions
- material structural changes must remain proposal-governed
- AI should recommend when the board should turn into `Mind Map`, `Table`, or `Process Flow`

System placement:

- `AI Suggestions` panel
- shared proposal review overlay
- board-aware context package sent to chat/AI runtime

### 7.12 Backlinks, promotion, and traceability

Missing or incomplete function:

- full source-to-output traceability

Why it matters:

- board work must not die as workshop residue

How it must be added:

- keep links from sticky notes and clusters to promoted artifacts
- support `Used in` and backlink semantics from downstream artifacts
- record which notes produced which `theme`, `outcome`, `decision`, or `action`

System placement:

- shared graph/object-ref layer
- artifact linking layer
- downstream promotion flows

---

## 8. AI operating model

AI in `Whiteboard` must act primarily as:

- clustering assistant
- synthesis partner
- facilitation helper
- artifact extraction assistant

AI in `Whiteboard` must not act as:

- silent board mutator
- generic brainstorming spam generator
- facilitator replacement

Canonical rule:

`discussion may be conversational, but board mutations with material structural impact must stay proposal-governed`

---

## 9. System architecture placement

`Whiteboard` should use the existing architecture in four layers:

### 9.1 Shared shell

- one idea = one workspace
- work-system switcher
- right strip `Tools | Context | AI Suggestions`
- shared export/share entry

### 9.2 Local whiteboard runtime

- board object interactions
- draw behavior
- clustering moves
- frame and scene behavior
- workshop session state

### 9.3 Shared governance layer

- classification
- watermark/export policy
- activity and replay
- proposal review

### 9.4 Shared artifact/promotion layer

- notes
- tasks
- decisions
- process flows
- tables

---

## 10. Final product promise

When a user opens `Whiteboard`, they should feel:

- they can dump ideas quickly,
- shape the mess visually,
- run a workshop or solo thinking session without friction,
- get help from AI when synthesis is useful,
- and convert the results into durable artifacts without losing context.

---

## 11. Acceptance criteria

This document is satisfied only when:

- `Whiteboard` has a clear visible tool-state grammar
- freehand, erase, and sticky/image workflows feel native and reliable
- frames and scenes structure the board clearly
- facilitation session behavior is coherent and auditable
- clustering and synthesis can produce traceable outputs
- export and clipboard semantics are explicit
- large-board performance is treated as a real product requirement
- AI supports synthesis without bypassing human review

---

## 12. Related canonical docs

- `WHITEBOARD_V8_READINESS_AUDIT.md`
- `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `IDEA_WORKSPACE_V5_SSOT.md`
- `CANVAS_OS_CONTRACT_FREEZE.md`
- `WORKSTATION_CANVAS_FINAL_MASTER_PLAN_2026-03-16.md`

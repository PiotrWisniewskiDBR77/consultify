# Idea Workspace Navigation And Canvas Orchestration v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac kanoniczna organizacje calego systemu pracy z pomyslem: jak user porusza sie po module `Ideas`, jak jeden pomysl staje sie jednym workspace, jak cztery canvasy wspolpracuja w ramach tej samej idei i jak nie rozbic produktu na osobne mini-aplikacje.

---

## 1. Why this document exists

Najwieksza przewaga `Idea Workspace` nie polega na tym, ze ma wiele canvasow.

Najwieksza przewaga polega na tym, ze:

- user pracuje nad jednym problemem lub pomyslem,
- moze zaczac od dowolnego sposobu myslenia,
- i nie traci kontekstu, gdy przechodzi do innego canvasu.

Dlatego najpierw trzeba zamrozic organizacje calego systemu pracy z idea.
Dopiero potem ma sens opisywanie kazdego canvasa osobno.

---

## 2. Inherited truth

This document inherits:

- `IDEA_WORKSPACE_V5_SSOT.md`
- `IDEA_WORKSPACE_V5_FINAL_SSOT.md`
- `CANVAS_OS_CONTRACT_FREEZE.md`
- `MINDMAP_V1_SSOT.md`
- `WORKSTATION_CANVAS_FINAL_MASTER_PLAN_2026-03-16.md`
- `FROZEN_LAYOUTS.md`

Rule:

`user works on one idea through many work systems, not on many disconnected tools that happen to share an id`

Imported benchmark directions that strengthen this doctrine:

- `Lucid` style multi-surface document thinking: one container may hold many structured pages or diagram states without breaking shared identity
- `Miro` and whiteboard-class products: discovery, facilitation, templates, and workshop flow are first-class, but should not fracture the workspace shell
- `Airtable` and `Coda` table lessons: structured systems may live inside the same problem-solving container, but still need their own strong operating grammar

These benchmarks reinforce one key decision:

`Idea Workspace should behave like one intelligent container with several native ways of thinking, not a launcher for disconnected specialist apps.`

---

## 3. Core product statement

`Idea Workspace` is one AI-native problem-solving environment where:

- one idea becomes one workspace
- four native work systems coexist on the same shared substrate
- the user may enter from any thinking style
- the system preserves traceability, context, and momentum while switching lenses

Canonical statement:

`The user does not choose a product first. The user chooses a problem or idea, and the system exposes the best canvas for the current stage of thinking.`

---

## 4. The 6-step documentation and product program

The correct package order for `Idea` should be:

1. `Idea navigation and canvas orchestration`
2. `Mind Map`
3. `Whiteboard`
4. `Process Flow`
5. `Table`
6. `Integration with the rest of Consultify`

The final package closure for steps 1-6 is completed by:

- `IDEA_V8_READINESS_AUDIT.md`
- `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`

This document owns step 1.

It freezes the shared logic that all later canvas documents must inherit.

All later steps should use capability labels from `CANVAS_OS_CONTRACT_FREEZE.md` where useful:

- `real`
- `partial`
- `scaffold`
- `missing`
- `out_of_scope`

This prevents later canvas docs from overstating maturity.

---

## 5. One idea = one workspace

This remains non-negotiable.

Meaning:

- one problem or opportunity starts one idea object
- one idea object owns one workspace context
- all canvas work should remain attached to that same idea identity
- outputs, notes, links, evidence and downstream artifacts remain traceable back to that idea

Prohibited model:

- separate whiteboard file
- separate mind map file
- separate table file
- separate process-flow file

that only look related in UI but do not behave as one living workspace.

Allowed model:

- one workspace may contain many frames
- one workspace may contain many clusters or sections
- one workspace may contain many focused areas of work
- one workspace may later expose richer sub-views over the same substrate

But those are still parts of the same idea workspace, not sibling mini-products.

---

## 6. The four native work systems

The canonical local systems remain:

1. `Mind Map`
2. `Whiteboard`
3. `Process / System Flow`
4. `Table`

These are not equal to top-level module tabs.
They are native work systems inside the same idea workspace.

Each one should be excellent on its own.
But the user experience must still say:

`I am still working on the same idea`

not:

`I just entered another product`

---

## 7. Navigation doctrine

Navigation through the `Idea` module should work in four layers:

### 7.1 Ideas hub

Purpose:

- browse ideas
- sort and triage
- open existing idea
- create new idea

### 7.2 New Idea entry

Purpose:

- capture the problem or opportunity
- choose the lightest useful start
- avoid heavy documentation too early

Primary starts should remain intent-led, not tool-led.

### 7.3 Active workspace

Purpose:

- perform the real thinking work
- move between canvases without losing context
- attach knowledge, evidence, notes and AI suggestions

### 7.4 Maturing artifact layer

Purpose:

- deepen the idea card
- formalize assumptions, risks, evidence and outputs
- convert the work into execution-ready artifacts

---

## 8. Discovery vs workspace doctrine

The system must clearly separate:

- discovery and library entry
- active problem-solving work

Allowed discovery surfaces:

- ideas hub
- template picker
- left discovery rail
- search and library entry

Allowed active-work surfaces:

- SuperCanvas
- idea card depth layer
- output promotion flows

Rule:

`discovery may help the user enter the work, but it must not replace or fragment the workspace shell`

This is especially important for:

- template systems
- library search
- imported diagrams
- AI-suggested starts

The user should feel they are entering one workspace, not hopping through multiple launchers.

---

## 9. Start-with-what-feels-natural doctrine

Different users start differently:

- some branch thought first
- some sketch loosely
- some want structure immediately
- some think through process logic

Therefore the product must support:

- start in `Mind Map`
- start in `Whiteboard`
- start in `Process Flow`
- start in `Table`

but all of these must still open the same idea workspace.

The correct product message is:

`choose how you want to think first`

not:

`choose which tool you want to enter forever`

---

## 10. Focus modes doctrine

The workspace should support at least these focus modes conceptually:

- `whole idea mode`
- `focused canvas mode`
- `focused object mode`

Meaning:

- `whole idea mode` lets the user understand the broader workspace and switch lenses
- `focused canvas mode` lets the user work deeply in one native system without feeling distracted
- `focused object mode` lets the user deepen one branch, frame, row, cluster, or flow path

These are focus states inside one workspace.
They are not separate navigation products.

This helps the module feel deep without becoming fragmented.

---

## 11. Template and library entry doctrine

Templates and starter libraries should be first-class entry points.

But they must obey three rules:

1. they are intent-led before they are tool-led
2. they create or extend the current idea workspace rather than pulling the user into a detached flow
3. they carry enough metadata to support governance, discoverability, and later AI recommendations

Examples:

- `Start from workshop template`
- `Start from process template`
- `Start from decision-comparison table`
- `Start from root-cause map`

The system should increasingly support searchable template and library entry, but always as a doorway into the shared workspace.

---

## 12. Canvas switching doctrine

Switching canvases must preserve:

- idea identity
- shared graph or shared substrate
- nearby context
- selection or focus, where meaningful
- AI and link traceability
- user confidence that nothing was lost

Canvas switching must not feel like export-import.

Preferred mental model:

- same room
- different thinking lens

not:

- leaving one application and entering another

---

## 13. Shared shell doctrine

The shared shell must remain stable across all four systems.

Frozen truths:

- `My Work` tab order does not change
- `Ideas` remains the second tab inside `My Work`
- the right strip remains exactly `Tools | Context | AI Suggestions`
- no fourth strip button appears
- no alternate mini-sidebar is introduced

Inside the workspace, the shell should provide:

- idea title and identity
- current canvas indicator
- stable canvas switching
- access to context and AI without breaking flow
- shared conversion and export entry points

The shell should also preserve:

- discovery-first entry without discovery clutter during deep work
- stable keyboard and focus grammar
- shared viewport expectations where cross-canvas primitives overlap

---

## 14. Shared platform primitives doctrine

The workspace should increasingly share a common set of primitives across canvases where it helps continuity:

- frames and sections
- selection grammar
- lasso or marquee where relevant
- comments and anchored discussion
- export and share entry
- hand tool and viewport behavior where relevant
- presentation or reveal modes where useful

These should feel consistent across the work systems even if the editing grammar differs.

Consistency here is a major anti-fragmentation mechanism.

---

## 15. Canvas roles inside one idea

Each canvas should have a distinct role in the same journey:

- `Mind Map` = branch and structure the thought
- `Whiteboard` = workshop, explore, cluster, sketch, facilitate
- `Process Flow` = formalize sequence, roles, logic and governed operational design
- `Table` = structure comparison, prioritization, evidence and decision support

The system should allow the user to grow through these roles progressively.

Example path:

- start with a messy whiteboard
- turn a cluster into a mind map branch
- formalize one path as process flow
- compare options or owners in a table

This is the desired product behavior.

---

## 16. Collaboration and facilitation doctrine

Collaboration should be treated as a shared workspace concern, not as an afterthought inside one canvas.

That means the overall Idea system should be able to support:

- presence
- selections or attention cues
- comments anchored to workspace objects
- workshop or facilitation modes
- voting or structured convergence where relevant

Not every canvas needs the same facilitation depth.

But the overall product should preserve one collaboration story across them.

Especially important:

- `Whiteboard` may be the strongest facilitation canvas
- but it must not become the only place where collaboration makes sense

---

## 17. Shared substrate doctrine

The canvases may differ in editing grammar, but they must share the same deeper truth:

- same idea context
- same artifact identity
- same linkage model
- same AI governance posture
- same downstream output traceability

At the runtime level this may be represented through:

- shared graph
- shared extensions
- shared object references
- shared canvas orchestration layer

But at the product level the promise is simpler:

`your work remains one connected thinking system`

---

## 18. AI doctrine across canvases

AI must work across the whole idea, not as four unrelated assistants.

That means:

- AI understands the active canvas
- AI understands the wider idea context
- AI can suggest switching canvas when a different lens is better
- AI follows `propose -> preview -> accept/reject` for material changes

Examples:

- from `Mind Map`, AI may suggest formalizing one branch in `Process Flow`
- from `Whiteboard`, AI may suggest clustering and converting into structured idea nodes
- from `Table`, AI may suggest creating an initiative candidate or decision object

AI should strengthen the continuity of the idea, not fragment it.

---

## 19. Knowledge and note attachment doctrine

The idea workspace should not be only geometric canvas work.

It must stay connected to:

- notes
- evidence
- links
- source artifacts
- AI suggestions
- downstream outputs

This means knowledge and notes are not side content.
They are part of the same thinking system.

---

## 20. Promotion doctrine

The system should support promotion without losing source traceability:

- node -> note
- cluster -> idea card section
- branch -> process path
- selection -> table block
- idea -> task set
- idea -> decision
- idea -> initiative
- idea -> report or presentation

Promotion should always feel like:

- deepening the same work

not:

- abandoning the workspace

---

## 21. Integration readiness doctrine

Step 1 must already prepare for step 6.

That means the workspace organization should assume future deep links to:

- chat
- notebook
- tasks
- decisions
- initiatives
- reports and presentations

These integrations should remain idea-centric.

The rest of the app should connect to:

- the idea
- the selected object
- the selected canvas context

not to one canvas as if it were an isolated application.

---

## 22. UX tone doctrine

The idea workspace should feel:

- premium
- calm
- creative
- intelligent
- non-fragmented
- confidence-building

It should not feel:

- tool-heavy
- menu-heavy
- like four apps stitched together
- like the user must "pick the right tool" before understanding the problem

The user should feel safe to begin lightly and deepen later.

---

## 23. Biggest current structural gaps this document closes

Without this doctrine, the biggest future risks are:

- `Mind Map`, `Whiteboard`, `Process Flow`, and `Table` evolve as separate products
- users lose confidence when switching canvases
- each canvas starts inventing its own shell logic
- integrations to the rest of Consultify become canvas-specific instead of idea-centric
- the product feels powerful but incoherent

This document closes those risks by freezing the shared organization first.

---

## 24. Acceptance criteria

- the user journey is organized around one idea, not around isolated tools
- all four canvases are explicitly defined as native work systems inside one workspace
- switching canvas preserves idea continuity and user confidence
- shell, strip, and workspace structure remain aligned with frozen layouts
- later canvas-specific docs can specialize behavior without reopening the shared organization model
- discovery, templates, and library entry are clearly separated from deep-work navigation
- focus modes and collaboration are treated as shared workspace concerns, not per-canvas accidents
- the whole organization is ready for later integration with the rest of Consultify without reopening the core model

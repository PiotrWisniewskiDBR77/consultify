# Mindmap Completion Findings

Date: 2026-03-12
Status: Working findings log for finishing the mindmap / whiteboard interaction model.

Canonical follow-up documents created from these findings:
- `docs/product/MINDMAP_V1_SSOT.md`
- `docs/product/MINDMAP_V1_IMPLEMENTATION_PLAN.md`

## Goal

Build a working mindmap experience inspired by Miro:
- stable canvas
- obvious interaction model
- contextual AI sidekick
- complete but light template library
- text editing that feels native on canvas

This document captures findings from the current codebase review and visual comparisons against Miro.

## Core Product Principle

The target is not "more mindmap code".

The target is:
- a reliable mindmap / whiteboard canvas
- predictable interaction patterns
- low-friction creation and editing
- AI that understands what the user is building

## Current Code Reality

The workspace already has strong foundations:
- `IdeaMapWorkspace` orchestrates canvas, tools, context, AI suggestions, export, node detail, and selection state.
- `IdeaRecommendationMap` already implements ReactFlow-based mindmap interactions, context menus, connect, drag, selection reporting, and autosave hooks.
- `useMindMapPersistence` already supports backend save plus local draft fallback.
- `IdeaWhiteboardTool` already supports stickies, text blocks, shapes, links, frames, drawing, selection toolbar, and ReactFlow canvas behavior.

The current issue is not "nothing exists".

The issue is that core interaction and presentation are still fragmented, sometimes heavier than needed, and not yet shaped into one clear user model.

## Finding 1: AI Sidekick Should Be Contextual

Reference from Miro:
- the side panel is not just a generic chat
- it behaves like a contextual collaborator for the current board

What exists in our code:
- split chat can auto-send a kickoff message
- workspace can open chat with a generated prompt
- AI Suggestions panel already receives graph context

What is missing:
- AI still behaves more like "open chat" than "context-aware sidekick"
- kickoff is mostly based on idea title and seed text
- it is not consistently driven by current selection, current branch, focused node, or current building intent

Required direction:
- define a contextual sidekick mode for the canvas
- AI must understand whether the user is:
  - starting from blank canvas
  - expanding a selected branch
  - editing a selected node
  - reorganizing a map
  - filling a template
  - finding gaps in a partially built map

Priority:
- P0 product behavior

## Finding 2: Cursor Model Is Not Clearly Defined

Reference from Miro:
- arrow = select and operate on elements
- hand = pan the canvas

Current state in our code:
- `mm_select_mode` exists as an action
- but in mindmap quick actions it currently only shows a toast
- there is no equally explicit, first-class pan/hand mode in the mindmap interaction layer

Implication:
- if users see cursor/state changes today, they are not backed by a strong tool-state model
- this creates confusion and makes behavior feel accidental

Required direction:
- define explicit canvas modes:
  - Select
  - Pan
  - Connect (optional, only if truly needed)
- connect toolbar state to actual canvas behavior, not only labels or toasts

Priority:
- P0 interaction foundation

## Finding 3: Right-Click Menu Is Functional But Not Yet Product-Calibrated

Reference from Miro:
- pane right-click menu mixes canvas operations, creation shortcuts, and view/grid controls
- it feels simple and expected

Current state in our code:
- mindmap pane context menu already supports:
  - add node
  - add topic
  - paste
  - undo / redo
  - select all
  - collapse / expand all
  - auto layout
  - fit view
  - center root
  - zoom
  - AI suggest

What is good:
- there is real functionality already

What is missing:
- menu structure is still more "mindmap operations catalog" than "simple canvas menu"
- it is not yet aligned with a clear select/pan model
- it is not yet tuned for lowest-friction default usage

Priority:
- P1 after select/pan model is defined

## Finding 4: Templates Are Mostly Good, But the Library Is Not Yet Complete or Calm

Visual comparison against Miro:
- Miro starts with use cases and then shows templates
- the browsing model is lighter and easier to scan

Current state in our code:
- quick popover has template lists for:
  - mindmap
  - process flow
  - whiteboard
  - table
- full gallery exists and supports applying templates and optional AI fill

Important inconsistency:
- quick template popover includes table templates
- full `IdeaTemplateGallery` does not include table templates in `ALL_TEMPLATES`

Implication:
- the library is not yet a single canonical source from the user point of view

Why the current gallery feels heavy:
- filters expose technical metadata like `scope` and `category`
- cards include governance tags and multiple actions
- the experience reads more like a system catalog than a lightweight "start from template" flow

Required direction:
- build one canonical template library for all canvas tools
- shift navigation from technical filters to use-case navigation
- keep governance metadata secondary, not primary

Suggested top-level user-facing categories:
- All
- Ideation & Brainstorming
- Research & Design
- Strategy & Planning
- Diagramming & Mapping
- Workshops
- Presentations

Priority:
- P1

## Finding 5: Text Tool Exists, But Not Yet Like Miro

Reference from Miro screenshot:
- adding text opens a dedicated text-focused contextual toolbar
- visible controls include:
  - font family
  - font size
  - bold
  - text alignment
  - link
  - color
  - emoji
  - lock
  - overflow / more actions

Current state in our code:
- `IdeaWhiteboardTool` already supports creating a text element
- `TextBlockNode` exists as a real node type
- text block supports content editing
- text block currently supports `fontSize` rendering

What is missing in the current whiteboard UX:
- no dedicated Miro-like contextual text toolbar is exposed for text selection
- no visible text formatting strip with the expected editing controls
- no clear evidence of:
  - font family switching
  - bold / italic / underline formatting for whiteboard text blocks
  - text alignment controls for text blocks
  - inline link formatting for text blocks
  - lock shortcut specific to selected text
  - lightweight formatting workflow directly on top of the selected text object

What currently exists instead:
- a generic whiteboard selection toolbar for selected items
- it is useful for alignment / distribution / attach / linked artifacts
- but it is not a focused text-editing toolbar

Conclusion:
- text creation exists
- text editing exists in a basic form
- text formatting UX is not yet on the level shown in Miro

Priority:
- P1 for whiteboard usability

## Finding 6: The Whiteboard Already Contains Reusable Building Blocks

This is important because it means we should extend, not rewrite.

Reusable blocks already present:
- `TextBlockNode`
- `StickyNoteNode`
- `ShapeNode`
- frame/group support
- drawing mode
- multi-selection toolbar
- align / distribute actions
- export hooks
- viewport controls

Product implication:
- the next step is not rebuilding the whiteboard
- the next step is refining behavior, mode logic, and UI clarity around existing primitives

## Finding 7: Three-Dots "More" Menu Exists Partially, But Not Yet in the Right Product Form

Reference from Miro:
- when working with a text object, the top contextual toolbar includes a three-dots control
- the three-dots menu exposes secondary actions such as:
  - copy
  - copy link
  - duplicate
  - delete
  - add comment
  - copy style
  - arrange
  - link to
  - lock
  - create frame
  - export / info

What exists in our code:
- mindmap already has a floating node toolbar with a `MoreVertical` button
- that button opens the node context menu
- this means the general product pattern of "primary controls on toolbar, secondary controls in more menu" already exists in our implementation

Important limitation:
- this pattern is currently tied more to the mindmap node experience than to the whiteboard text-object experience shown in Miro
- the currently exposed node context menu is rich, but it is optimized for mindmap node operations rather than for lightweight object editing

Implication:
- we do not need to invent the three-dots pattern from zero
- we do need to adapt it into a cleaner whiteboard/object-editing pattern, especially for text blocks and other freeform board objects

Required direction:
- keep the three-dots / more-actions affordance
- use it as the secondary actions container for selected whiteboard objects
- reserve the main visible toolbar for only the most common actions
- move heavier and less frequent actions into the overflow menu

Suggested split:
- Primary toolbar:
  - font / size / bold / alignment / color / link / lock
- More menu:
  - copy
  - duplicate
  - delete
  - comment
  - copy style / paste style
  - arrange
  - create frame
  - advanced export / info if applicable

Priority:
- P1, after the main text-editing toolbar is defined

## Finding 8: Sticky Tool Needs to Move from Generic Creation to Sticky-First Workflow

Reference from Miro screenshots:
- sticky creation starts from a dedicated sticky affordance in the left toolbar
- color choice is immediate and visual
- there is a lightweight sticky palette instead of a generic "Create" list
- sticky editing uses a compact contextual toolbar
- sticky-specific actions are easy to reach:
  - color
  - size (S / M / L)
  - shape/type switching
  - tags
  - emoji / reactions
  - comment
  - lock
  - more actions
- there is also a visible sticky workflow helper such as `Stack`

What exists in our code:
- sticky notes are real first-class nodes (`stickyNote`)
- sticky colors already exist
- sticky sizes already exist (`s`, `m`, `l`)
- sticky inline editing exists
- sticky comment count badge exists
- selection toolbar already supports:
  - align
  - distribute
  - group / ungroup
  - duplicate
  - lock
  - delete

What the current UX still gets wrong:

### 1. Creation entry is too generic

Current behavior:
- sticky creation is hidden under a top `Create` dropdown shared with text, frame, shape, image, and link

Problem:
- this is functional, but not sticky-first
- Miro makes sticky creation feel immediate and visual
- our current interaction feels more like a tools menu than a natural sticky workflow

What should change:
- expose sticky creation as a dedicated primary tool
- show colors directly when sticky tool is active
- reduce the number of clicks to "pick color -> place sticky"

### 2. No dedicated sticky palette

Current behavior:
- color is chosen from a generic create dropdown

Problem:
- users do not get the sense of a sticky mode with visual color swatches
- this makes brainstorming feel heavier than necessary

What should change:
- add a sticky palette with visible swatches
- allow quick insertion of the last-used sticky color
- keep advanced object creation separate from sticky mode

### 3. Sticky formatting is not exposed as a compact object toolbar

Current behavior:
- sticky node has internal support for size and color data
- but the visible object-editing affordances do not yet expose sticky-specific editing the way Miro does

Problem:
- users cannot fluidly treat stickies as the main working object
- sticky editing feels implementation-driven, not product-driven

What should change:
- when a sticky is selected, surface sticky-specific controls first:
  - color
  - size S / M / L
  - duplicate
  - comment
  - lock
  - more actions

### 4. Tags and emoji are not a first-class sticky workflow

Current behavior:
- semantic labels exist
- comments exist
- there is no clear sticky-native tag or emoji workflow like in the Miro reference

Problem:
- sticky clustering, mood marking, workshop facilitation, and synthesis become harder than they should be

What should change:
- add lightweight sticky tags
- add emoji / reaction support directly on sticky objects or via toolbar

### 5. Sticky comments are present, but not lightweight enough

Current behavior:
- sticky shows comment count badge
- clicking it opens deeper detail flow

Problem:
- Miro-style comments feel lighter and more immediate
- our current experience is more "open node details" than "quick annotate object"

What should change:
- keep deep detail as a fallback
- add quick comment affordance for selected sticky

### 6. Missing sticky-specific helper actions like Stack

Reference from Miro:
- sticky mode exposes workflow helpers such as `Stack`

Current behavior:
- we support grouping and alignment, but there is no obvious sticky-native helper like stack / cluster / pile

What should change:
- add sticky batch helpers:
  - stack
  - tidy row / tidy column
  - cluster into frame
  - convert selected stickies into grouped theme

### 7. Toolbar hierarchy is backwards for sticky-heavy work

Current behavior:
- the whiteboard top toolbar is shared across all object types
- board/session controls sit next to creation controls

Problem:
- for sticky workshops, creation and editing actions compete with meta controls
- the interface feels heavier than the Miro sticky workflow

What should change:
- separate:
  - object creation tools
  - object formatting tools
  - board/session controls

Priority:
- P1 for usability
- P0 if sticky notes are meant to be the primary workshop object

## Finding 9: Shapes Are Present, But Miro Treats Them as a Full Diagramming System

Reference from Miro screenshots:
- there is a dedicated shapes entry in the left toolbar
- quick shape picker is available immediately
- user can open a larger shapes library
- shapes are organized into packs / families:
  - basic shapes
  - flowchart
  - connectors
  - callouts
  - BPMN
  - data flow
  - UML
  - ERD
  - value stream mapping
  - AWS
- there is also "Create diagram" and "Manage shapes"
- after selecting a shape, Miro exposes a lightweight contextual toolbar plus overflow actions

What exists in our code:
- whiteboard supports real shape nodes
- currently supported shapes are:
  - rectangle
  - circle
  - diamond
  - hexagon
- shape labels are editable
- shape background color is supported
- shape creation exists through whiteboard quick actions and top creation dropdown

Current limitations vs Miro:

### 1. Shapes are hidden inside generic creation flow

Current behavior:
- shape creation is under shared `Create`
- main entry creates only a rectangle-like default shape

Problem:
- Miro makes shapes a first-class tool
- our current flow makes shapes feel secondary

What should change:
- add a dedicated shapes tool entry in the left toolbar
- expose quick shape selection without first opening a generic create menu

### 2. Shape library is far too small

Current behavior:
- only 4 base shapes exist

Problem:
- enough for rough whiteboarding
- not enough for real diagramming, mapping, architecture, or process modeling

What should change:
- expand the library into packs
- start with a practical v1 set:
  - basic shapes
  - flowchart symbols
  - connectors / arrows
  - callouts
  - org / system blocks
- later packs can include:
  - BPMN
  - UML
  - ERD
  - data flow
  - value stream mapping
  - cloud / AWS

### 3. No "More shapes" / "Manage shapes" model yet

Reference from Miro:
- quick picker handles common shapes
- full panel handles packs, search, and management

Current behavior:
- there is no visible shape browser, no search over shapes, no pack management

What should change:
- split shapes UX into:
  - quick picker
  - full shapes browser

### 4. Shape styling is still too thin

Current behavior:
- shapes mainly expose fill color plus label editing

Problem:
- Miro exposes richer shape styling through contextual controls:
  - fill
  - border / stroke
  - line color
  - text styling
  - shape type switching

What should change:
- add shape-specific formatting controls:
  - fill color
  - border color
  - border thickness / line style
  - switch shape type in place
  - text style inside shape

### 5. No proper shape-family switching on selected object

Reference from Miro:
- selected object can switch type from the contextual toolbar

Current behavior:
- we create different shape kinds
- but the selected object does not expose a clear "switch type" workflow

What should change:
- allow changing selected shape between supported types without recreating it

### 6. Diagramming actions are not yet a coherent workflow

Reference from Miro:
- shapes + connectors + libraries form one diagramming mode

Current behavior:
- our shapes exist
- our arrows/connectors exist in broader whiteboard interactions
- but there is no cohesive diagramming-mode experience

What should change:
- define a dedicated diagramming workflow on top of whiteboard primitives
- keep it lightweight at first, but coherent

### 7. Overflow menu pattern should apply to shapes too

Reference from Miro:
- selected shapes use the same contextual-toolbar-plus-more-actions pattern

Current behavior:
- this is only partially present in our generic toolbars

What should change:
- for selected shapes, primary controls should stay small and obvious
- all secondary actions should live under overflow:
  - copy
  - duplicate
  - copy style / paste style
  - arrange
  - link to
  - lock
  - create frame
  - save as template
  - info

Priority:
- P1 if shapes support whiteboard enrichment
- P0 if diagramming is a core promise of the canvas

## Finding 10: Draw / Pen Mode in Miro Is a Separate Tool State, Not Just an Option

Reference from Miro screenshot:
- pen is a dedicated left-toolbar tool
- selecting it opens a compact vertical pen palette near the toolbar
- the user clearly understands:
  - "I am in drawing mode"
  - which drawing tool is active
  - what color is active
  - how to switch between drawing variants

What exists in our code:
- whiteboard already has a real draw mode
- `IdeaDrawingLayer` supports:
  - pen
  - highlighter
  - eraser
  - color picker
  - stroke width
  - undo / redo
  - clear
- whiteboard mode can switch between `board` and `draw`

What is good:
- the technical foundation is already real and useful
- this is not missing from scratch

What is still different from Miro:

### 1. Entry point is still too hidden inside the top whiteboard toolbar

Current behavior:
- draw mode is a top-toolbar button inside the whiteboard shell

Problem:
- Miro communicates draw as a primary tool on the left rail
- our current model makes draw feel like one toggle among many board controls

What should change:
- move draw into the main tool system as a first-class canvas mode

### 2. Tool-state visibility is weaker than in Miro

Current behavior:
- internally we have `board` vs `draw`
- but the state is not surfaced with the same clarity as a dedicated mode palette

Problem:
- users should immediately see whether they are navigating or drawing

What should change:
- make draw mode visually obvious
- show the active draw subtype and active color more prominently

### 3. Palette placement should feel mode-local

Reference from Miro:
- when draw is selected, the draw-specific controls appear close to the tool source

Current behavior:
- our drawing toolbar appears as a floating top panel

Problem:
- it works, but it feels more like an overlay than a native tool extension

What should change:
- consider a draw palette that anchors closer to the left tool rail or otherwise feels attached to the selected tool

### 4. Draw mode should remain clearly separated from board mode

Reference from Miro:
- drawing has its own mini-system
- it is obvious when the user is drawing versus selecting/moving

Current behavior:
- we do switch to draw mode
- but this should be tied more tightly to the global interaction model already identified earlier (`Select`, `Pan`, `Draw`)

What should change:
- treat draw as a first-class interaction mode, not a local board option

Priority:
- P1 if drawing is a secondary whiteboard capability
- P0/P1 if freehand facilitation is part of the core workshop promise

## Finding 11: Miro Has a Global Tool Catalog, But This Is a Platform Pattern, Not a Mindmap-V1 Requirement

Reference from Miro screenshots:
- there is a searchable tool catalog
- tools are grouped by families such as:
  - essentials
  - diagramming
  - planning
  - activities
  - collaboration
  - media
  - marketplace / addons
- the same board can surface many tool systems without crowding the primary toolbar
- sidekick can also suggest an intent such as "Create diagram or mindmap"

What this means product-wise:
- Miro separates:
  - the core editing toolbar
  - the object-specific contextual toolbar
  - the global "tool universe" browser

What exists in our code:
- we already have multiple tool families inside the workspace:
  - mindmap
  - whiteboard
  - process flow
  - table
- we also have template systems and AI entry points

What is missing:
- there is no equivalent lightweight "tool catalog" or searchable browser across all board capabilities

Important scope decision:
- this is valuable as a future platform pattern
- but it should not be confused with the current goal of making mindmap / whiteboard usable

Recommended scope:
- treat this as later-stage IA / platform work
- do not let it distract from P0 interaction and editing problems

Priority:
- P2 / later platform evolution

## Finding 12: A Dedicated Mindmap Inspector (Style / Layout / Theme) Is Still Missing

Reference from the dedicated mindmap app screenshots:
- the right panel is a permanent inspector for the currently edited map
- it is organized into three simple tabs:
  - Style
  - Layout
  - Theme
- this keeps map customization visible, calm, and mindmap-native

What the reference app exposes in a very direct way:
- branch style
- node width
- node shape
- font family / weight / size
- text alignment
- text color
- text background
- branch type
- layout mode
- spacing
- alignment
- document themes

What exists in our code:
- `FloatingNodeToolbar` already exposes some node-level styling:
  - semantic type
  - branch theme
  - color
  - font size
  - bold
  - lock
- `IdeaRecommendationMap` already supports layout changes and theme events internally
- `IdeaMapWorkspace` already has a way to dispatch canvas theme changes

What is missing:
- there is no single visible inspector that gathers these controls into one coherent mindmap editing system
- style controls are fragmented across:
  - floating node toolbar
  - node context menu
  - hidden theme events
  - deeper drawers / secondary tools
- layout and theme exist more as implementation capabilities than as a clear product surface

Implication:
- we already have parts of the engine
- we do not yet have a mindmap-native editing console
- this makes the product feel more like a generic canvas with hidden powers than a refined map editor

Required direction:
- create a dedicated right-side inspector for mindmap mode
- split it into:
  - Style
  - Layout
  - Theme
- keep it focused on the current map and current selection
- use this inspector to consolidate scattered controls instead of adding more one-off menus

Priority:
- P1 for usability
- P0/P1 if the product promise is "great mindmap app", not only "working canvas"

## Finding 13: Node Utility Actions Should Be Lightweight and Node-Centric, Not Hidden in Deep Panels

Reference from the dedicated mindmap app screenshots:
- the node context menu exposes practical, low-friction node utilities:
  - enter focus
  - create connection
  - fold node
  - show notes
  - add task
  - add link
  - tags
  - copy link to node
  - copy style
  - cut / copy / paste
  - delete
- there are also lightweight popups for:
  - notes
  - tags
  - task actions

What exists in our code:
- `NodeContextMenu` already supports:
  - focus subtree
  - drill down
  - connect to selected
  - detach branch
  - duplicate branch
  - copy style / paste style
  - comments
  - attach knowledge
  - attach artifact
  - copy link
  - delete
- `IdeaRecommendationMap` already implements those actions
- `IdeaNodeDetailDrawer` and `mindmap/NodeDetailDrawer` already support richer node metadata:
  - notes
  - tags
  - comments
  - attachments
  - linked artifacts
  - description / owner / status

What is missing:
- practical node utilities are still split between:
  - context menu
  - detail drawer
  - conversion flows
  - artifact flows
- there is no lightweight note popup, tag popup, or add-link popup directly tied to the selected node
- there is no true "add task to this node" micro-flow; we mainly have branch conversion to tasks
- node-level actions are powerful, but they do not yet feel immediate

Implication:
- our system is strong in depth
- the reference app is strong in speed
- for day-to-day map work, speed wins first impressions

Required direction:
- introduce quick node utility popovers for:
  - notes
  - tags
  - link
  - task
- keep the deep drawer for richer editing, but do not force it for small actions
- make the node context menu feel like a fast utility layer, not a gateway into larger workflows

Priority:
- P1
- P0/P1 if personal productivity inside the map is a core use case

## Finding 14: A Mindmap App Uses a Much Simpler Pane Menu Than Miro, and This Supports Our Earlier Direction

Reference from the dedicated mindmap app screenshots:
- canvas background menu stays very small:
  - new main node
  - paste
  - zoom to actual size
  - zoom to fit content
  - select all
  - import

What this confirms:
- a pure mindmap product does not need a heavy pane context menu
- background menu should prioritize the most common canvas actions
- advanced operations can live elsewhere

Current state in our code:
- `PaneContextMenu` is already real and useful
- but it still contains a longer operational list:
  - add node
  - add topic
  - paste
  - undo / redo
  - select all
  - collapse / expand all
  - auto layout
  - fit view
  - center root
  - zoom
  - AI suggest

Implication:
- the new reference app reinforces an earlier conclusion:
- our pane menu should get simpler, not richer

Required direction:
- keep background menu focused on:
  - create
  - paste
  - selection
  - zoom / fit
- move heavier structure actions into:
  - inspector
  - toolbar
  - command palette
  - more-tools surfaces

Priority:
- P1

## Finding 15: Node Creation and Connection Must Be Direct Manipulation, Not Mostly Menu-Driven

Reference from the latest dedicated mindmap app screenshots:
- selected node shows an obvious inline `+` affordance next to the node
- adding a child feels like a direct continuation of the branch, not a separate command flow
- creating a connection is a lightweight node action, not a hidden expert feature
- the user can stay focused on the canvas itself while growing the map

What exists in our code:
- node creation already exists through:
  - keyboard shortcuts via `addChildNode()` and `addSiblingNode()`
  - left toolbar add-node popover
  - pane context menu
  - node context menu
- `addChildNode()` and `addSiblingNode()` are already implemented in `useMindMapNodes.ts`
- direct edge creation already exists technically via React Flow `onConnect()`
- selected nodes already expose visible connection handles in `IdeaRecommendationMap.tsx`

What is missing:
- there is no clear inline `+` affordance on the selected node as the primary child-creation action
- add-node flow is still mostly command/menu driven:
  - popover
  - context menu
  - keyboard shortcut
- `mm_connect_mode` currently communicates itself mainly by toast, not by a strong first-class interaction state
- line / connection creation is technically possible, but not yet expressed as an obvious, friendly canvas action for normal users

Important distinction:
- we do have the engine
- we do not yet have the right product gesture

Why this matters:
- in a good mindmap app, branch growth should feel almost automatic
- the primary act is:
  - select node
  - hit visible plus
  - type next thought
- if the user has to remember commands or open menus, the map feels heavier than it should

Required direction:
- add an inline quick-add affordance for selected nodes
- make child creation the default fastest action on a selected node
- keep sibling creation as a secondary but still lightweight action
- make connection creation explicit through one clear interaction model:
  - either drag from visible handles
  - or dedicated connect mode with real visual state
- do not rely on toast-only mode switching

Desired default interaction:
- user clicks or touches a node
- small inline plus affordances appear around that node
- clicking a plus creates the next branch directly from that point
- the newly created node enters edit mode immediately
- user types the next thought without opening any menu
- repeating this interaction should let the user grow:
  - node -> child branch
  - child branch -> deeper child branch
  - sibling branches where relevant

Product rule:
- growing the tree should happen primarily through node-adjacent plus controls
- menus, shortcuts, and context actions should support this flow, not replace it

Suggested v1 interaction model:
- right-side plus = add child
- secondary plus / affordance = add sibling where relevant
- drag from visible handle = create non-tree connection
- after creation, focus text input immediately

This is likely the core creation gesture for the entire mindmap experience.

Priority:
- P0/P1 for mindmap usability

## Finding 16: Object Menus Should Share One Grammar, With Small Type-Specific Variations

Reference from the latest Miro screenshots:
- a connector/line has its own compact toolbar and overflow menu
- a text/document-like object has a richer toolbar and slightly richer overflow menu
- both still follow the same product grammar:
  - common base actions stay in the same place
  - object-specific actions are added only where relevant

Common actions visible across object types:
- copy
- copy link
- copy as image
- duplicate
- delete
- copy style / paste style
- arrange
- lock
- create frame
- save as template
- info

Type-specific variations visible in the screenshots:
- line / connector toolbar focuses on line controls
- text-like object adds actions such as:
  - add comment
  - clear content
  - link to
  - export to CSV in that specific object context

What exists in our code:
- `NodeContextMenu` exists for mindmap nodes
- `EdgeContextMenu` exists for edges / connections
- whiteboard objects already have their own editing surfaces in `IdeaWhiteboardTool`

What is missing:
- menus are still defined more as separate implementations than one shared product grammar
- there is no obvious unified base action set reused across:
  - node
  - edge
  - text object
  - sticky
  - shape
- object-specific actions exist, but the cross-object consistency is not yet a strong UX rule

Implication:
- the product risks feeling different depending on which object the user clicked
- Miro feels coherent because the user learns one menu language, then sees only small variations per object

Required direction:
- define one shared overflow-menu grammar for all canvas objects
- keep a stable common base action set
- allow only small type-specific deltas for:
  - connectors
  - text blocks
  - sticky notes
  - shapes
  - mindmap nodes
- use this rule for both toolbar composition and right-click / overflow menus

Priority:
- P1

## Finding 17: Node Properties Must Be the Semantic Control Center for Artifacts, Tags, Colors, and AI Growth

Desired product behavior described for our app:
- user can open a node and inspect its properties
- from node properties, user can attach links to our internal artifacts
- node can carry tags defined by the user
- tags should define or strongly influence node color / visual meaning
- those semantics should then guide AI when proposing the next nodes
- AI should grow the map thematically, in context of the current node and its tagged meaning

This is not just metadata.

This is the semantic engine of the map.

What exists in our code:
- node detail surfaces already exist:
  - `IdeaNodeDetailDrawer`
  - `mindmap/NodeDetailDrawer`
- artifact linking already exists
- tags already exist on node data
- semantic type already exists on node data
- node color / branch styling already exists in partial form
- AI already receives graph context and can expand nodes

What is still missing in product form:
- node properties are not yet clearly framed as the place where semantic meaning is authored
- there is no strong visible rule that:
  - tags influence color
  - color reflects semantic category
  - AI uses those semantics to propose the next context-aware nodes
- artifact links, tags, style, and AI expansion still feel like adjacent features, not one chain

Required product rule:
- a node is not only text
- a node is:
  - label
  - properties
  - linked artifacts
  - tags
  - visual semantic state
  - AI expansion context

Required direction:
- make node properties easy to open from the node
- keep artifact linking inside that node-properties flow
- define a canonical tag -> color mapping model
- allow manual override where needed, but keep semantic defaults strong
- use node tags, semantic type, linked artifacts, and nearby branch context when AI proposes new child nodes
- make AI expansion explicitly contextual, not generic

Suggested AI behavior:
- if a node is tagged around one theme, risk, domain, or artifact family, AI should propose the next nodes in that same semantic lane
- if a node has linked internal artifacts, AI should use them as grounding context for follow-up branches
- if colors represent semantic groups, AI should respect and extend that grouping instead of mixing unrelated suggestions

Priority:
- P0/P1
- this is core if the map is supposed to become an intelligent working surface rather than only a visual diagram

## Priority Map

### P0

- Define real `Select` and `Pan` modes.
- Make canvas tool state explicit and visible.
- Make AI sidekick contextual to canvas intent and selection.

### P1

- Add a dedicated mindmap inspector with `Style / Layout / Theme`.
- Unify the template library into one canonical source.
- Redesign template browsing to feel lighter and use-case driven.
- Add a real text-formatting toolbar for whiteboard text elements.
- Adapt the three-dots overflow menu for whiteboard object editing.
- Upgrade sticky-note UX into a dedicated sticky-first workflow.
- Expand shapes from basic nodes into a real diagramming system.
- Promote draw mode into a first-class canvas tool with clearer mode visibility.
- Simplify and calibrate pane right-click behavior.
- Add lightweight node utility popovers for notes / tags / link / task.

### P2

- Consider a future global canvas tool catalog / searchable tool browser.
- Add deeper template coverage by use case.
- Add richer sidekick flows after the core interaction model is stable.
- Expand advanced formatting and presentation helpers only after the basics feel obvious.

## What The Latest Miro Menu Confirms

The latest reference screenshot with the open three-dots menu confirms a useful product rule:
- the top contextual toolbar should expose only the most frequent actions
- the overflow menu should hold the longer tail of secondary actions

Confirmed secondary-action set from the reference:
- copy
- copy link
- copy as image
- duplicate
- delete
- copy style
- layout nodes
- arrange
- link to
- lock
- create frame
- save as template
- export
- info

Product implication for our implementation:
- we should not overload the primary object toolbar
- we should keep the main toolbar compact and fast
- secondary actions should consistently live under the overflow / three-dots menu across text, sticky, shape, and mindmap nodes where applicable

This does not create a new product area.

It strengthens earlier findings about:
- contextual toolbar hierarchy
- overflow-menu consistency
- keeping common vs advanced actions clearly separated

## Recommended Build Order

1. Fix interaction model first.
2. Add a dedicated mindmap inspector for style / layout / theme.
3. Make node utility actions lightweight.
4. Make AI sidekick context-aware.
5. Unify templates and simplify browsing.
6. Upgrade text editing / formatting UX.
7. Tune context menus and secondary affordances.

## Must Finish Before We Call It "Working"

These are the minimum completion items for a credible v1:

### 1. Core Interaction Foundation

- real `Select` mode with obvious behavior
- real `Pan` mode with obvious behavior
- visible active-mode state on canvas
- no fake tool states that only show a toast

### 2. Contextual Canvas AI

- AI opens with intent-aware context
- selection-aware prompts for nodes / branches / blank canvas
- AI suggestions align with current tool and current object focus

### 3. Mindmap-Native Editing Surface

- visible inspector for style / layout / theme
- common map styling does not require hunting through multiple menus
- layout changes are understandable and reversible

### 4. Low-Friction Creation

- add topic / node quickly
- add sticky quickly
- add text quickly
- no heavy multi-step flows for the most common creation actions

### 5. Native Feeling Object Editing

- text gets a real formatting toolbar
- sticky gets a sticky-specific lightweight toolbar
- shapes get shape-specific controls instead of generic editing only
- overflow menu is consistent and useful
- notes / tags / links / task actions are lightweight on the node itself

### 6. Stable Canvas Behavior

- autosave is trustworthy
- local draft restore remains safe
- no accidental resets, remounts, or "jumping" behavior during normal editing
- right-click and keyboard shortcuts feel predictable

## Polish Layer After V1 Works

These are worthwhile, but should not block the definition of a working mindmap:
- richer template coverage
- deeper shape packs
- advanced style-copy workflows
- image/export niceties
- broader sidekick recipes
- searchable global tool catalog

## Delivery Streams

To keep implementation clean, the remaining work can be split into streams:

### Stream A: Interaction Model

- select
- pan
- draw
- connect if we decide it remains necessary

### Stream B: Object Toolbars

- text toolbar
- sticky toolbar
- shape toolbar
- shared overflow menu pattern

### Stream C: Mindmap Inspector

- style tab
- layout tab
- theme tab
- consolidation of scattered style controls

### Stream D: Creation System

- templates
- sticky entry
- shapes quick picker
- lighter create flows

### Stream E: Node Utility Layer

- notes
- tags
- link
- task
- quick node actions vs deep drawer

### Stream F: AI Context Layer

- blank canvas intent
- selected-node intent
- selected-branch intent
- map-review / gap-finding intent

### Stream G: Stability and Persistence

- autosave confidence
- hydration consistency
- local draft fallback
- no remount regressions

## Working Product Definition of Done

Mindmap / whiteboard can be considered "working" when:
- users understand immediately how to select vs pan
- right click behaves predictably
- adding nodes, stickies, and text is low friction
- text editing feels native and contextual
- templates are easy to browse and not overwhelming
- AI opens with the right context and helps with the current building task
- autosave and restore are stable
- no accidental remount/reload behavior appears during normal editing

## Coverage Audit Against The Dedicated Mindmap App

Status legend:
- Have = implemented in a recognizably usable form
- Partial = present in code, but fragmented, hidden, or product-incomplete
- Missing = not meaningfully surfaced today

### Canvas Background Menu

- New main node: Partial
- Paste: Have
- Zoom to actual size: Missing
- Zoom to fit content: Have
- Select all: Have
- Import from device: Partial

### Node Context Menu

- Enter focus: Partial
- Create connection: Have
- Fold node: Have
- Detach branch: Have
- Show notes: Partial
- Add task: Missing / weak substitute via conversion
- Add link: Partial
- Quick look: Missing
- Tags submenu: Partial
- Copy link to node: Have
- Copy style / paste style: Have
- Cut / copy / paste: Partial
- Delete node: Have

### Node Quick Utilities

- Notes popup: Missing
- Tags popup: Missing
- Task popup: Missing
- Link popup: Missing
- Deep node drawer: Have

### Inspector: Style

- Branch style: Partial
- Node width: Missing
- Node shape switching: Partial
- Font family: Missing
- Font size: Partial
- Font weight / bold: Partial
- Text alignment: Missing
- Text color: Partial
- Text background: Missing

### Inspector: Layout

- Branch type: Partial
- Layout mode: Partial
- Spacing controls: Missing
- Alignment controls: Missing
- Layout presets: Partial

### Inspector: Theme

- Apply theme to map: Partial
- Visible theme browser in mindmap flow: Missing / weak
- Dynamic theme preview: Missing

### Productivity Around The Node

- Tags on node data: Have
- Notes on node data: Have
- Comments: Have
- Attachments / links: Have
- Linked artifacts: Have
- Owner / metadata: Have
- Task integration at node level: Partial / weak

### Nice-To-Have But Not Core

- Sync with reminders: Missing, not core
- Import from iPhone / iPad: Missing, not core
- Quick-look style preview helpers: Missing, low priority

## Bottom-Line Verdict

We do not have everything yet.

What we have is:
- a strong mindmap engine
- real node actions
- real drawers and metadata
- AI and conversion depth

What we still do not have in the product sense is:
- a polished mindmap-native inspector
- lightweight node utilities for notes / tags / link / task
- a simpler, calmer menu model
- a fast everyday editing surface comparable to a dedicated mindmap app

# Mindmap V1 SSOT

> **Status:** PROPOSED CANONICAL TARGET
> **Date:** 2026-03-12
> **Owner:** Product / Platform / CTO
> **Scope:** `My Work -> Idea Workspace -> Mind Map system inside SuperCanvas`
> **Purpose:** define the canonical product truth for a working, mindmap-native experience inside `Idea Workspace`.

> **Important:** this document does not replace `docs/product/IDEA_WORKSPACE_V5_SSOT.md`.
> It specializes that product truth for the `Mind Map` system and turns recent benchmark analysis into one explicit target state.

---

## 0) Canonical references

Internal:
- `docs/product/IDEA_WORKSPACE_V5_SSOT.md`
- `docs/product/IDEA_WORKSPACE_V5_FINAL_SSOT.md`
- `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
- `docs/product/MINDMAP_COMPLETION_FINDINGS_2026-03-12.md`
- `docs/ui-standards/FROZEN_LAYOUTS.md`
- `docs/ui-standards/README.md`
- `docs/ui-standards/02-components/workspace-3-tools-strip.md`
- `docs/ui-standards/03-modules/interactive-board-standard.md`

Implementation anchors:
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/mindmap/useMindMapNodes.ts`
- `src/components/MyWork/mindmap/useMindMapQuickActions.ts`
- `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx`
- `src/components/MyWork/mindmap/FloatingNodeToolbar.tsx`
- `src/components/MyWork/mindmap/NodeContextMenu.tsx`
- `src/components/MyWork/mindmap/PaneContextMenu.tsx`
- `src/components/MyWork/IdeaNodeDetailDrawer.tsx`
- `src/components/MyWork/mindmap/NodeDetailDrawer.tsx`

External benchmark families:
- Miro mind map / whiteboard patterns
- dedicated mindmap app patterns reviewed on 2026-03-12

---

## 1) Final product statement

`Mind Map V1` is the fastest structured-thinking surface inside `Idea Workspace`.

It must let the user:
- start from one node and grow a tree without friction
- move from thought to branch to sub-branch through direct manipulation
- attach meaning, artifacts, and context to any node
- ask AI to expand the map in the semantic context of the current node
- keep the workspace feeling calm, obvious, and trustworthy

The target is not "more canvas features".

The target is:
- direct tree growth
- semantic node editing
- predictable interaction
- contextual AI assistance
- stable persistence

---

## 2) Product identity

`Mind Map V1` is:
- one of the 4 native work systems in `Idea Workspace`
- optimized for branching thought and synthesis
- a semantic thinking surface, not just a visual diagram
- AI-augmented, but manual-first in editing

`Mind Map V1` is not:
- a generic whiteboard clone
- a separate product with separate navigation
- a mode that breaks the workspace shell
- a menu-heavy expert-only tool

---

## 3) Non-negotiables

- One idea = one workspace.
- Mind map stays inside the existing `Idea Workspace`.
- `Tools | Context | AI Suggestions` remains the only right-side workspace strip.
- Any inspector or styling surface for mind map must live inside the existing `Tools` panel, not as a new fourth strip.
- AI never writes silently.
- Important AI expansion flows use `propose -> preview -> accept/reject` where the change is material.
- Manual node growth must be first-class, not a fallback.
- The fastest creation gesture must happen on the node itself.

---

## 4) Core promise

> Touch a node, grow the next branch immediately, enrich meaning when needed, and let AI continue in the same semantic lane.

---

## 5) Canonical operating model

## 5.1 Default growth model

The primary interaction is:
1. User selects a node.
2. Inline plus affordances appear next to that node.
3. User clicks or taps a plus.
4. A new node is created directly from that point.
5. The new node enters text edit mode immediately.
6. User types the next thought.
7. The same gesture repeats deeper into the tree.

This is the canonical mindmap growth gesture.

Menus and keyboard shortcuts support this flow.
They do not replace it.

## 5.2 Node hierarchy model

The system must support:
- child branch creation
- deeper child-of-child growth
- sibling branch creation where relevant
- non-tree cross-connections as a separate action

Tree growth and graph connections are not the same interaction.

## 5.3 Creation speed rule

The user should not need to:
- open a popover
- remember a shortcut
- switch into a fake mode
- navigate a long context menu

for the most common act of adding the next branch.

---

## 6) Canonical interaction states

The mind map must have explicit interaction states:
- `Select`
- `Pan`
- `Connect` if retained

Optional:
- `Draw` when shared with board logic, but only if presented clearly

State must be visible.

State must change real canvas behavior.

Toast-only mode changes are not valid final UX.

---

## 7) What lives where

## 7.1 On-node surface

Visible on selected node:
- primary inline plus for `add child`
- optional secondary affordance for `add sibling`
- visible connection handle for non-tree links
- minimal selection affordance

Purpose:
- fastest branch growth
- immediate continuation of thought

## 7.2 Floating quick toolbar

Shown only when useful.

It should expose only high-frequency actions such as:
- basic style controls
- lightweight semantic controls
- AI quick action
- overflow trigger

It must stay compact.

## 7.3 Overflow / context menu

The menu is for secondary actions, not the main growth flow.

Canonical base actions:
- copy
- copy link
- duplicate
- delete
- copy style
- paste style
- arrange where relevant
- lock where relevant
- create frame where relevant
- save as template where relevant
- info where relevant

Node-specific additions may include:
- enter focus
- create connection
- detach branch
- show notes
- add task
- add link
- tags

## 7.4 Node properties surface

The user must be able to open node properties from the node quickly.

This surface is the semantic control center for that node.

It contains:
- label
- notes / description
- tags
- semantic type
- linked internal artifacts
- comments
- status / owner / priority where relevant
- AI context actions

The deep editing surface may remain a drawer, but access must feel direct.

## 7.5 Tools panel: Mindmap Inspector

Inside the existing `Tools` panel, mind map mode must expose a dedicated inspector with:
- `Style`
- `Layout`
- `Theme`

This is where map-wide and selection-aware styling belongs.

It must not create a new workspace strip.

## 7.6 Context panel

Purpose:
- related knowledge
- source context
- linked signals
- nearby artifact relevance

This is not the place for basic node styling.

## 7.7 AI Suggestions panel

Purpose:
- contextual AI proposals
- map expansion proposals
- gap analysis
- branch suggestions

This is not the place for manual node property editing.

---

## 8) Canonical node semantics

A node is not only text.

A node is:
- label
- properties
- linked artifacts
- tags
- visual semantic state
- AI expansion context

## 8.1 Tags

Tags are first-class.

Tags should:
- describe semantic meaning
- help cluster related nodes
- support filtering / grouping later
- help AI understand thematic intent

## 8.2 Tag-to-color rule

The system must define a canonical tag -> color mapping model.

Meaning:
- tags should define or strongly influence node color
- color should communicate semantic grouping
- user may override color when needed
- semantic defaults remain stronger than arbitrary manual styling

## 8.3 Artifact grounding

Nodes can link to internal Consultify artifacts.

These links must be authorable from node properties.

Linked artifacts are not decoration.

They are grounding context for:
- the user
- future navigation
- AI expansion

---

## 9) AI operating model for mind map

AI in mind map must be contextual.

It must understand whether the user is:
- starting from blank canvas
- expanding a selected node
- expanding a branch
- filling semantic gaps
- reviewing a partially built map

## 9.1 AI grounding inputs

AI should use:
- current node label
- node tags
- node semantic type
- linked artifacts
- nearby branch labels
- map-level idea title and seed context

## 9.2 AI semantic growth rule

If a node is tagged around one theme, risk, domain, or artifact family, AI should propose the next nodes in that same semantic lane unless the user asks to broaden.

AI should not produce generic branch spam detached from the node's meaning.

## 9.3 Trust rule

AI may accelerate thought.

AI may not silently mutate the map in ways the user cannot understand or control.

---

## 10) Menu grammar

All canvas object menus should follow one shared grammar with small type-specific deltas.

Objects:
- mindmap node
- edge / connector
- text-like object
- sticky
- shape

The user should learn one menu language, not five different ones.

---

## 11) Pane context menu

Background menu should stay small.

Allowed primary categories:
- create
- paste
- select all
- zoom / fit
- import

Heavier operations belong elsewhere:
- inspector
- command palette
- more-tools surfaces

---

## 12) Inspector requirements

## 12.1 Style tab

Must cover:
- branch style
- node width
- node shape
- font family
- font weight
- font size
- text alignment
- text color
- text background

## 12.2 Layout tab

Must cover:
- branch type
- layout mode
- width / branch thickness strategy
- spacing
- alignment

## 12.3 Theme tab

Must cover:
- map-level themes
- theme preview
- apply-to-current-map behavior

---

## 13) Definition of done for Mindmap V1

Mind map can be considered working when:
- users instantly understand how to select vs pan
- users can grow the tree mainly through node-adjacent plus controls
- newly created nodes enter edit mode immediately
- connection creation is understandable and visible
- node properties are easy to open and semantically meaningful
- internal artifact linking works from node properties
- tags and colors form a clear semantic model
- AI expands nodes in context, not generically
- the `Tools` panel contains a coherent `Style / Layout / Theme` inspector
- context menus feel secondary and predictable
- autosave and restore are stable

---

## 14) Explicit out of scope for V1

- full real-time collaboration parity
- marketplace-level shape ecosystems
- complex automation builder
- plugin marketplace
- mobile-device import parity
- presentation-grade export parity beyond basic useful export

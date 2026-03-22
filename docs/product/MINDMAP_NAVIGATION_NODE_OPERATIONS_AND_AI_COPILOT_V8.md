# Mind Map Navigation, Node Operations, And AI Copilot v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: freeze the final navigation model for `Mind Map`, including fast node growth, direct settings access, branch focus, and AI support for building branches and notes

---

## 1. Why this document exists

`Mind Map` can have many features and still fail if navigation feels heavy.

That is the current risk.

The main user pain is not only:

- adding nodes
- editing nodes
- using AI

The real pain is moving through a growing map without feeling lost or slowed down.

This document exists to freeze one final truth:

`Mind Map must be fast both in growth and in navigation`

---

## 2. Benchmark directions we should copy

The most useful directions from other tools are:

### 2.1 Miro

What is strong:

- `Tab` creates child
- `Enter` creates sibling
- arrow keys support movement
- selected node toolbar stays close to the node
- branch growth remains the main interaction, not menu hunting

Imported lesson:

`growth must be keyboard-fast and node-local`

### 2.2 XMind

What is strong:

- drill-down into one branch
- drill-up back to the full map
- breadcrumb bar during branch focus
- fold / unfold for complexity control
- branch-only work without losing the parent map identity

Imported lesson:

`big maps need branch focus modes, not only zoom`

### 2.3 Whimsical

What is strong:

- lightweight flow
- command menu as fast action access
- calm automatic behavior that does not force formatting work

Imported lesson:

`navigation should feel low-friction, not tool-heavy`

---

## 3. Core problem statement

The current `Mind Map` problem is:

- node creation exists
- node properties exist
- AI actions exist

but the full navigation grammar is still not explicit enough.

Users need one simple answer to three questions:

1. how do I move quickly through the map?
2. how do I open the right level of node editing instantly?
3. how does AI help me grow the branch instead of interrupting me?

---

## 4. Final navigation doctrine

`Mind Map` must support navigation on 4 layers:

### 4.1 Whole-map navigation

Used when the user wants to:

- understand the map shape
- jump between areas
- search and recenter
- collapse complexity

### 4.2 Branch navigation

Used when the user wants to:

- focus on one subtree
- work only inside one branch
- temporarily hide unrelated parts

### 4.3 Node navigation

Used when the user wants to:

- move between parent, child, and sibling
- create the next node
- edit or inspect one node

### 4.4 Semantic navigation

Used when the user wants to:

- jump to nodes by meaning, note presence, status, tag, evidence, or AI review state

---

## 5. Mandatory additions to v8

These are the additions that should now be treated as mandatory.

### 5.1 Branch drill-down and drill-up

Problem:

- zooming and panning are not enough for large maps

Addition:

- allow entering `branch focus mode`
- show only the selected node and its descendants
- keep a visible breadcrumb bar
- support fast drill-up back to parent and full map

Why this matters:

- this is the cleanest way to make large maps workable

System fit:

- local mindmap runtime
- no new shell navigation
- breadcrumb lives inside the canvas layer or local toolbar

### 5.2 Outline tree + jump navigation

Problem:

- once the map grows, canvas-only navigation becomes too slow

Addition:

- add an outline tree for the current map
- allow search in the outline
- allow click or keyboard jump to a node
- show note/status/tag indicators inside the outline rows

Why this matters:

- it gives users a structural navigation rail without leaving the map

System fit:

- `Context` panel or selection-aware subview
- must not create a fourth workspace strip

### 5.3 Canonical keyboard navigation

Problem:

- node creation is not enough; moving between nodes must also be reliable

Addition:

- `Tab` = add child
- `Enter` = add sibling
- arrow keys = move to parent / child / previous sibling / next sibling where possible
- `Escape` = exit edit or exit focus mode
- shortcut for opening node properties directly
- shortcut for branch focus / drill-down
- shortcut for search / jump

Why this matters:

- keyboard flow is the fastest path for heavy mindmap work

System fit:

- local mindmap runtime
- command palette integration where useful

### 5.4 Node-local action ring

Problem:

- users should not need to choose between a heavy drawer and a hidden context menu

Addition:

- every selected node should expose one calm, compact node-local action surface
- this surface should always contain:
  - add child
  - add sibling
  - open properties
  - branch AI
  - quick note

Why this matters:

- this turns each node into a true working handle, not just a shape on canvas

System fit:

- floating node toolbar
- keep it compact
- overflow menu stays secondary

### 5.5 Two-speed node editing

Problem:

- not every node change should require the full drawer

Addition:

- `Speed 1`: inline editing for label, quick note, quick tag, quick status
- `Speed 2`: full properties drawer for deeper editing

Canonical rule:

- tiny edits happen near the node
- deep edits happen in the drawer

Why this matters:

- this removes the feeling that every node edit is expensive

System fit:

- inline popovers or compact overlays
- existing drawer remains the deep semantic control center

### 5.6 Quick note access on every node

Problem:

- notes exist, but their entry path should be more direct and visible

Addition:

- every node should show note presence clearly
- every selected node should allow one-click quick note open
- notes should support:
  - capture
  - expand with AI
  - summarize branch into note
  - promote note into notebook artifact

Why this matters:

- notes are one of the main ways a map becomes useful beyond visual structure

System fit:

- compact note panel or inline note popover
- deep note editing remains in drawer or linked note flow

### 5.7 AI branch copilot

Problem:

- AI expand alone is not enough

Addition:

- AI should support 4 node-level copilot actions:
  - `expand this branch`
  - `find missing branch`
  - `challenge this branch`
  - `summarize this branch`

Canonical rule:

- AI must use current node label, branch ancestry, sibling labels, tags, semantic type, notes, evidence, and linked artifacts
- AI must stay in the semantic lane unless the user asks to broaden

Why this matters:

- AI should feel like a branch copilot, not a generic generator

System fit:

- node-local toolbar
- `AI Suggestions` panel
- proposal review for structural changes

### 5.8 AI note copilot

Problem:

- AI should help not only with branches, but with the semantic depth behind them

Addition:

- AI should support:
  - `write note draft for this node`
  - `expand rationale`
  - `extract risks`
  - `extract evidence gaps`
  - `turn note into action summary`

Why this matters:

- this is how the map becomes a thinking system, not just a shape tree

System fit:

- note popover or properties drawer
- notebook / artifact promotion flows

### 5.9 Search, filter, and semantic jump

Problem:

- users need to navigate by meaning, not only by geometry

Addition:

- search by node label
- filter or jump by:
  - notes present
  - status
  - semantic type
  - tags
  - evidence
  - converted nodes
  - AI-unreviewed areas

Why this matters:

- this is essential for medium and large maps

System fit:

- command palette
- outline tree
- `Context` panel helpers

### 5.10 Navigation-safe AI suggestions

Problem:

- AI can help or it can overwhelm

Addition:

- AI suggestions should be small, local, and contextual by default
- no branch spam
- no giant unsolicited changes
- AI suggestions should be grouped by intent:
  - grow
  - clarify
  - challenge
  - capture
  - convert

Why this matters:

- users need to feel guided, not flooded

System fit:

- node-local toolbar
- `AI Suggestions` panel

---

## 6. Final operating model for one node

Every node should support exactly 5 operating moves without friction:

1. grow the branch
2. move through nearby structure
3. capture or open note depth
4. open deeper properties
5. ask AI for branch or note help

If any of these five moves still feels hidden or heavy, the node model is not finished.

---

## 7. Proposed v8 additions list

This is the final additive list that should now be treated as part of the `Mind Map v8` package:

1. `Branch drill-down / drill-up` with breadcrumbs
2. `Outline tree` with search and jump-to-node
3. `Canonical keyboard navigation contract`
4. `Node-local action ring` for add / properties / note / AI
5. `Two-speed node editing` with quick inline layer plus deep drawer
6. `Quick note access` and visible note presence on every node
7. `AI branch copilot` for expand / gap / challenge / summarize
8. `AI note copilot` for rationale / risks / evidence / action summary
9. `Semantic search and filter navigation`
10. `Navigation-safe AI suggestions` grouped by intent

---

## 8. Strategic conclusion

The `Mind Map` issue is no longer "do we have enough features?"

The issue is:

`can a user move, grow, inspect, and deepen a map without friction?`

This is why navigation, node operations, and AI copilot behavior must now be treated as first-class `v8` scope.

---

## 9. Related canonical docs

- `MINDMAP_V8_READINESS_AUDIT.md`
- `MINDMAP_V1_SSOT.md`
- `MINDMAP_CHAT_SIDEKICK_AND_COLLABORATIVE_IDEA_RUNTIME_V8.md`
- `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`

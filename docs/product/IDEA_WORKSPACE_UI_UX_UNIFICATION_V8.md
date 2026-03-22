# Idea Workspace UI UX Unification v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: define one shared UI/UX language for the full `Idea` module so `Mind Map`, `Whiteboard`, `Process Flow`, and `Table` feel like one coherent workspace instead of four visually and behaviorally drifting systems

---

## 1. Why this document exists

`Idea` will fail product-wise if each canvas becomes "good on its own" but different in:

- colors
- control formats
- selection signals
- toolbar placement
- panel behavior
- state visibility

The user must feel:

`same workspace, different thinking mode`

not:

`different tool, different UI rules`

This document freezes the UI/UX unification layer for all native work systems inside `Idea`.

---

## 2. Inherited truth

This document inherits:

- `docs/ui-standards/FROZEN_LAYOUTS.md`
- `docs/ui-standards/03-modules/app-table-standard.md`
- `docs/ui-standards/02-components/workspace-3-tools-strip.md`
- `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `IDEA_V8_READINESS_AUDIT.md`

Rule:

`cross-canvas variety is allowed in editing grammar, but not in workspace chrome, status language, or visual trust cues`

---

## 3. Core product statement

All four native work systems must share one visible UI grammar:

- one shell
- one state language
- one color discipline
- one interaction confidence model

This does **not** mean each canvas looks identical.

It means:

- identity is shared
- controls are predictable
- colors mean the same thing
- the user never has to relearn basic workspace behavior when switching canvases

---

## 4. Frozen shell rules for Idea

The following are non-negotiable:

- `Ideas` remains inside `My Work` in frozen tab order
- the topbar respects the frozen module order
- the right strip remains exactly `Tools | Context | AI Suggestions`
- no extra mini-sidebar is introduced per canvas
- no extra toolbar row appears between topbar and main surface
- view-mode order remains canonical where views are shown

This document extends those frozen rules with visual and behavior consistency.

---

## 5. Color system doctrine

## 5.1 Colors must be semantic, not canvas-specific decoration

The same meaning should use the same visual family across all four work systems.

Examples:

- `selected`
- `focused`
- `active tool`
- `linked`
- `AI suggested`
- `warning`
- `blocked`
- `complete`
- `draft`

These meanings must not change color meaning from one canvas to another.

## 5.2 Canonical color usage classes

The exact token names may evolve in implementation, but the semantic mapping must stay stable:

- `neutral`: base surfaces, chrome, dividers, muted controls
- `accent-primary`: current workspace focus, selected object, active canvas-level action
- `accent-secondary`: links, related context, connected objects
- `success`: accepted, complete, healthy, ready
- `warning`: review needed, partial risk, dependency issue
- `danger`: blocked, destructive, critical validation issue
- `ai`: AI suggestion and proposal context, but never a noisy decorative theme

## 5.3 Cross-canvas color rules

- selection highlight uses one shared accent logic
- AI suggestion surfaces use one shared AI accent logic
- warnings and errors use one shared severity scale
- linked/contextual artifacts use one shared relation/link accent logic
- accepted/applied states use one shared success logic

## 5.4 What is allowed to differ

Allowed differences:

- local object colors when they are part of the thinking method itself
  - example: whiteboard sticky colors
  - example: mind map branch colors

But even then:

- local colors must sit inside a stable workspace palette
- they must not override shell/status/selection semantics
- they must not become the primary meaning carrier for validation, AI, or workflow state

---

## 6. State language doctrine

Every canvas must use a shared visible language for state.

The user should instantly recognize:

- selected
- multi-selected
- hovered
- focused
- editing
- locked
- AI-suggested
- AI-applied
- linked
- unresolved
- blocked

These states may render differently by object type, but they must feel equivalent.

Examples:

- selected object always gets a strong but non-chaotic emphasis
- locked object always looks unavailable in a consistent way
- AI-suggested object or proposal always looks review-oriented, not silently committed

---

## 7. Toolbar and controls doctrine

## 7.1 Shared expectations

Across all canvases:

- the active tool must be visibly clear
- local toolbars must appear in predictable positions
- there must be one obvious way to access object-level actions
- command palette behavior should feel aligned where supported

## 7.2 Object-level actions

Object-level actions may differ by canvas, but should obey one grammar:

- primary quick actions close to the object
- heavier configuration in side panel, menu, or properties layer
- destructive or structural actions never hidden behind ambiguous visuals

## 7.3 No canvas invents a separate chrome logic

Prohibited:

- custom mini topbars per canvas with different visual hierarchy
- random button shape changes by canvas
- different action-density rules in each native system

---

## 8. Panel and preview doctrine

The whole `Idea` workspace must reuse one panel logic:

- `Tools` = actions and transforms
- `Context` = links, backlinks, references, provenance
- `AI Suggestions` = proposals, next things to think about, send-to-chat

Panel behavior must feel the same across all canvases:

- one panel open at a time
- same open/close rhythm
- same visual chrome
- same confidence that switching panels does not discard work

Preview and detail logic should also stay aligned:

- lightweight preview for current object/context where appropriate
- deeper detail in a stable deepening surface
- no random mixture of modal, side sheet, floating popup, and inline expansion for the same class of action

---

## 9. Typography, spacing, and density doctrine

All four canvases should feel like members of one product family through:

- shared typography hierarchy
- shared spacing rhythm
- shared control heights where equivalent controls exist
- shared density logic for chrome and metadata

Rules:

- labels, captions, and helper text should have consistent hierarchy
- pills, chips, badges, and tags should use a shared sizing logic
- icon buttons of equivalent importance should use equivalent footprint
- empty states and loading states should not radically change tone between canvases

---

## 10. Status chips, tags, and badges doctrine

Common UI elements must behave analogously across the whole module:

- status chip
- tag chip
- relation chip
- source/provenance badge
- AI badge
- warning badge

This means:

- similar shape family
- similar padding and scale
- similar severity logic
- similar truncation and hover behavior

Canvas-specific content is allowed.
Canvas-specific component grammar is not.

---

## 11. Selection and focus doctrine

Selection is one of the biggest trust signals in a canvas product.

Therefore:

- single selection should feel equivalent across all canvases
- multi-selection should feel equivalent across all canvases
- focus mode transitions should feel equivalent across all canvases
- keyboard focus and visual focus should not diverge wildly between systems

The user should never wonder:

- what is currently selected
- whether a toolbar applies to the current object
- whether a command affects the local object or the whole canvas

---

## 12. AI visual behavior doctrine

Because `Idea` is AI-driven, AI-related UI must be especially consistent.

AI-related states should always distinguish:

- suggestion
- proposal
- preview
- applied result
- unresolved recommendation

Rules:

- AI never looks like silent truth
- AI states never mimic final/manual states too closely
- AI visuals should encourage review, not confusion
- AI suggestions should be visible but not noisy

---

## 13. Cross-canvas object family doctrine

Different canvases have different primitives, but some object families overlap:

- node
- frame/section
- card/object
- step/record-like object
- note/evidence attachment

Where these families overlap, their UI should converge on:

- common naming
- common state treatment
- common relation treatment
- common detail/deepen patterns

This is critical for cross-canvas continuity.

---

## 14. Empty, loading, and error state doctrine

All canvases must share one emotional tone:

- calm
- clear
- non-heavy
- encouraging

That means:

- empty states invite meaningful starts
- loading states feel stable, not broken
- error states explain what happened without panic
- blocked states show the next useful move

No canvas should feel harsh, over-technical, or abandoned relative to the others.

---

## 15. Concrete unification requirements by system

### 15.1 Mind Map

Must align with shared rules for:

- node selection emphasis
- node-local toolbar behavior
- note/status/tag indicators
- breadcrumb/local navigation chrome

### 15.2 Whiteboard

Must align with shared rules for:

- active tool visibility
- selection and frame emphasis
- sticky/card palette discipline
- AI clustering and synthesis proposal states

### 15.3 Process Flow

Must align with shared rules for:

- step and edge selection grammar
- warnings and validation severity cues
- node toolbar and context menu hierarchy
- KPI/warning overlays as structured status, not random color noise

### 15.4 Table

Must align with shared rules for:

- table shell discipline
- record preview/detail deepening
- status chips and relation chips
- AI-assisted schema or row actions as proposal states, not silent mutations

---

## 16. Biggest risks this document closes

Without this contract, the biggest risks are:

- each canvas drifts into its own color logic
- users stop trusting what states mean
- AI states become visually inconsistent
- the workspace feels patched together
- implementation teams polish locally but degrade module coherence globally

This document exists to prevent exactly that.

---

## 17. Acceptance criteria

This document is satisfied only when:

- colors mean the same thing across all four work systems
- shared controls and badges feel like one family
- shell, panels, and preview logic stay aligned
- selection, focus, locked, warning, and AI states are coherent across canvases
- local canvas variety does not break global workspace identity

---

## 18. Related canonical docs

- `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`
- `IDEA_V8_READINESS_AUDIT.md`
- `docs/ui-standards/FROZEN_LAYOUTS.md`
- `docs/ui-standards/03-modules/app-table-standard.md`
- `docs/ui-standards/02-components/workspace-3-tools-strip.md`

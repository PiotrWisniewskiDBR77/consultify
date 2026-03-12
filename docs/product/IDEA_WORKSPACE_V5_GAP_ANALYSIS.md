# Idea Workspace V5 Gap Analysis

> **Status:** ACTIVE WORKING GAP DOCUMENT
> **Date:** 2026-03-10
> **Owner:** Product / Platform / CTO
> **Scope:** `Idea Workspace` with focus on `Table OS`
> **Method:** compare final target from `IDEA_WORKSPACE_V5_FINAL_SSOT.md` against current code reality and classify each area as `ready`, `partial`, `scaffold only`, `missing`, or `needs refactor before feature work`.

---

## 0) Canonical anchors

Product target:
- `docs/product/IDEA_WORKSPACE_V5_FINAL_SSOT.md`
- `docs/product/IDEA_WORKSPACE_V5_SSOT.md`

Reality check:
- `docs/product/IDEA_WORKSPACE_V5_1_IMPLEMENTATION_PROGRAM.md`
- `docs/product/IDEA_WORKSPACE_V5_REMEDIATION_PLAN.md`
- `docs/product/IDEA_WORKSPACE_V5_FAILURE_INVENTORY_2026-03-09.md`

Code anchors:
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaWorkspaceTools.tsx`
- `src/components/MyWork/IdeaTableTool.tsx`
- `src/components/MyWork/table/tableTypes.ts`
- `src/components/MyWork/table/AddColumnDialog.tsx`
- `src/components/MyWork/table/FilterPanel.tsx`
- `src/components/MyWork/table/KanbanView.tsx`
- `src/components/MyWork/table/TimelineView.tsx`
- `src/components/MyWork/table/MatrixView.tsx`
- `src/components/MyWork/table/RowDetailPanel.tsx`
- `src/components/MyWork/table/AITableAssistant.tsx`

UI canon:
- `docs/ui-standards/FROZEN_LAYOUTS.md`
- `docs/ui-standards/03-modules/app-table-standard.md`
- `docs/ui-standards/03-modules/table-preview-pane-standard.md`

---

## 1) Executive summary

Current state is materially better than a blank scaffold, but still far from the final `Table OS` target.

Most important truth:
- the workspace shell is now structurally aligned with the intended IA
- the table runtime already contains meaningful capability breadth
- the product is still held back by partial views, mixed trust levels, and an oversized orchestration file

### 1.1 Overall classification

- Workspace IA: `partial`, moving toward `ready`
- Table core runtime: `partial`
- Property system: `partial`
- Views parity: `partial` with some `scaffold only` subareas
- Record page depth: `partial`
- AI prompt-to-table: `partial`
- Cross-artifact linking inside table flow: `partial`
- Persistence contract: `partial`
- Technical architecture and ownership: `needs refactor before feature work`
- Behavior-based verification: `missing`

### 1.2 The main gap pattern

The biggest risk is not that nothing exists.

The biggest risk is that the codebase already exposes many controls, overlays, and modes, but not all of them are equally trustworthy. That creates false parity with Airtable/Notion and slows down clean implementation.

---

## 2) Current-state snapshot

## 2.1 What is genuinely real already

- `IdeaMapWorkspace` correctly preserves the canonical shell of `4 systems + 3-panel strip`.
- `IdeaTableTool` already supports real column definitions, visible columns, resizing, sorting, filtering, grouping, saved views, selection, row detail, and persistence.
- The table already mounts distinct view components for `kanban`, `timeline`, and `matrix`, instead of being a single fake toggle.
- `RowDetailPanel` already acts like a record page with properties, comments, attachments, activity, AI, drawing, and convert actions.
- `AITableAssistant` already maps natural-language commands into structured actions like sort/filter/group/add-column/add-rows.
- Manual schema creation exists through `AddColumnDialog`.

## 2.2 What is still only partially real

- View parity is uneven: some modes are operational, some are still lightweight visualizations.
- Property type names are broader than the actual property semantics.
- AI table assistance is action-capable, but not yet a complete `proposal -> review -> accept/reject` builder for schema plus views plus starter data.
- Record-page depth exists, but attachment and relation experiences are still thinner than the target.
- Persistence exists, but still rides on a generic `extensions.table` structure without a stronger long-term contract.

## 2.3 What is currently unsafe to mistake for completion

- `calendar` is still a presentation-level rendering, not true calendar-grade behavior.
- Several advanced overlays inside `IdeaTableTool` suggest breadth, but the file itself indicates the system is still too centralized.
- Some AI affordances are real command helpers, not yet full trust-grade table-building workflows.

---

## 3) Capability-by-capability gap matrix

| Capability | Target state | Current state | Gap | Status | Recommended direction |
| --- | --- | --- | --- | --- | --- |
| Workspace IA and shell | One coherent workspace with 4 systems and canonical right strip | `IdeaMapWorkspace` already manages `activeTool` and `activePanel` cleanly | Small remaining work is consistency and rollout across the other systems, not structural redesign | `partial` | Keep shell stable; do not reopen IA beyond incremental hardening |
| Table as first-class system | Structured-thinking engine, not fallback | Existing SSOT says this; code already mounts a deep table runtime | Product perception still lags because some views and behaviors are uneven | `partial` | Strengthen trust and completeness before adding more chrome |
| Manual property modeling | Easy add/edit/reorder/hide/resize/configure properties | Add-column flow exists, column resize exists, visibility exists | Rename/edit semantics and full property governance are still shallow versus target | `partial` | Expand property-management domain before adding more AI layers |
| Property type system | Strong Airtable/Notion-style semantic properties | `tableTypes.ts` already lists many types | System-managed fields, status semantics, richer formulas, and config depth are incomplete | `partial` | Add metadata-rich property contract on top of current types |
| Saved views | Real multi-view operating model | Saved views, active view, layout, sort, filters, group state already persist | Governance and per-view configuration depth are still light | `partial` | Create dedicated view-state layer and saved-view model |
| Table view | Dense reliable primary work mode | Real table runtime exists | Needs continued polish and stronger preview/detail canon alignment | `partial` | Keep as baseline surface for trust and QA |
| Kanban view | Operational grouped board | Separate component exists | Needs parity validation for editing, grouping semantics, and saved-view integration | `partial` | Harden behavior using shared state contract |
| Timeline view | Operational planning surface | Separate component exists and supports date-column-driven interaction | Needs parity validation and richer scheduling semantics | `partial` | Evolve after property model stabilization |
| Calendar view | Real calendar working mode | Inline lightweight calendar render inside `IdeaTableTool` | Not yet competitive or trustworthy as a real calendar surface | `scaffold only` | Rebuild as its own real view after shared view-state refactor |
| Matrix view | Decision/priority matrix mode | Separate component exists | Needs parity rules, stronger axis configuration, and saved-view behavior | `partial` | Keep, but treat as specialized analysis mode, not done |
| Grid/cards view | Card-based scan mode | Inline grid rendering exists | Thin compared with target record-card experience | `partial` | Promote into a stronger card layout backed by the same record model |
| Record page / row detail | Notion-like record depth inside table | `RowDetailPanel` already provides tabs for properties/comments/attachments/activity/AI/drawing | Attachments, relationships, and page-level composition still need stronger product depth | `partial` | Promote row detail into first-class record page contract |
| Relations and rollups | Real linked records and derived values | Type names exist; cross-relations overlays exist | Relation UX and rollup semantics are not yet product-grade | `partial` | Introduce explicit relation config and rollup behavior contracts |
| AI prompt-to-table | Prompt can propose schema, views, starter rows, and linked context | `AITableAssistant` handles sort/filter/group/add-column/add-rows/summarize | It is an action parser, not yet the flagship trusted builder flow | `partial` | Build a proposal-driven AI builder layer above command parsing |
| AI governance | Material AI changes are previewed and auditable | Some workspace patterns already use proposal review | Table-local AI still mixes direct actions with lighter command execution | `partial` | Standardize proposal batching for table-building actions |
| Context/linking | Table rows visibly benefit from Consultify artifacts and backlinks | Row detail shows attachments and artifact-link counts; workspace context panel exists | Linking is not yet a dominant differentiator inside the table flow | `partial` | Move artifact-linking closer to row/page workflows and table generation |
| Conversion/export | Table structure can become platform outputs | Convert actions exist; CSV/export utilities exist | Needs stronger row-selection conversion trust and downstream contracts | `partial` | Add deterministic convert flows and clearer source-traceability rules |
| Persistence contract | Stable save/reload for schema, views, and data | `extensions.table` already saves columns/views/viewState/formatting/viewLayout | The contract is generic and may become brittle as complexity grows | `partial` | Evolve contract first; rewrite only if domain boundaries force it |
| Technical architecture | Clear domain ownership and maintainable modules | Many subcomponents already exist | `IdeaTableTool.tsx` still carries too many responsibilities | `needs refactor before feature work` | Extract domain slices before expanding parity work |
| Runtime verification | Behavior-based truth for shipped capability | Limited evidence of behavior-first verification | Risks overstated completion and regressions | `missing` | Add behavior-based tests and rollout gates per stage |

---

## 4) Detailed gap review

## 4.1 Workspace IA and entrypoints

### Current state

`IdeaMapWorkspace` now clearly separates:
- active system selection
- active right-side panel selection
- table mounting inside the shared workspace shell

This is the correct architectural direction for `Table OS` inside `Idea`.

### Gap

The shell is no longer the main problem.
The remaining gap is consistency and downstream capability depth.

### Implication

Do not redesign the workspace navigation again.
Use the existing shell as the stable host for strengthening the table.

### Status

`partial`

---

## 4.2 Property system and field semantics

### Current state

`tableTypes.ts` already includes:
- text
- number
- select and multiselect
- date
- checkbox
- rating
- person
- url
- progress
- formula
- ai_generated
- file
- relation
- rollup
- emoji
- color
- currency
- phone
- email

`AddColumnDialog.tsx` already lets the user create columns manually and configure select, formula, and AI-generated settings.

### Gap

The target requires more than a long enum.

Missing or weak areas:
- stronger `status` semantics
- system-managed properties like created/edited metadata
- richer formula and rollup config
- property editing/governance after creation
- clearer relation configuration model

### Implication

We have a solid base, but not yet a product-grade property system.

### Status

`partial`

---

## 4.3 Views and saved-view governance

### Current state

`IdeaTableTool.tsx` persists:
- `views`
- `activeViewId`
- `viewState`
- `formatting`
- `viewLayout`

Starter views already exist.

### Gap

The target requires deeper view behavior:
- per-view property visibility and layout semantics
- stronger configuration parity across all views
- better saved-view governance
- more trustworthy alternate views

### Implication

The current persistence model is enough to evolve from, but the view layer needs its own clearer ownership.

### Status

`partial`

---

## 4.4 View parity by mode

### Table

Current state:
- dense primary work mode with inline editing, selection, bulk actions, filtering, sorting, and save

Gap:
- needs more polish and strict preview/detail parity

Status:
- `partial`

### Kanban

Current state:
- real component with group-driven board rendering

Gap:
- needs parity validation and stronger behavior guarantees

Status:
- `partial`

### Timeline

Current state:
- real component with date-based planning interaction

Gap:
- needs broader scheduling semantics and saved-view parity

Status:
- `partial`

### Calendar

Current state:
- inline basic calendar render in `IdeaTableTool.tsx`

Gap:
- not yet a true operational calendar mode

Status:
- `scaffold only`

### Matrix

Current state:
- real component for 2-axis analysis

Gap:
- needs stronger axis configuration and behavioral parity

Status:
- `partial`

### Grid

Current state:
- inline card grid

Gap:
- thinner than target record-card experience

Status:
- `partial`

---

## 4.5 Record page / row detail

### Current state

`RowDetailPanel.tsx` already provides:
- properties
- comments
- attachments
- activity
- AI suggestions
- drawing
- related items
- convert actions

This is materially closer to the target than a normal preview drawer.

### Gap

Still missing or weak:
- stronger record-page composition
- richer relation UX
- stronger artifact-link surfacing
- more deliberate separation between preview and full detail
- deeper trust around row-centric workflows

### Implication

This is a high-leverage area.
Strengthening this page will make the module feel significantly more like the target product.

### Status

`partial`

---

## 4.6 AI prompt-to-table and AI assist

### Current state

`AITableAssistant.tsx` supports:
- `sort`
- `filter`
- `group`
- `add_column`
- `add_rows`
- `summarize`

This is real functionality, not only a placeholder prompt box.

### Gap

The final target is bigger:
- AI should propose schema plus views plus starter rows as one reviewable unit
- AI should be more context-grounded to workspace artifacts
- material structural changes should align with proposal-review governance

### Implication

Current assistant is a useful sub-layer.
It is not yet the flagship `AI-first builder`.

### Status

`partial`

---

## 4.7 Context, relations, and cross-artifact linking

### Current state

The workspace already has:
- `IdeaContextPanel`
- artifact-link patterns
- row-level attachments and artifact-link counts in record detail

### Gap

The table still does not visibly dominate competitors through linking.

Weak areas:
- linked context is not yet central to row creation and row editing
- relation semantics inside the table are still lighter than needed
- artifact-backed generation flow is not yet the default hero experience

### Implication

This is the most important differentiation gap, not just a nice-to-have gap.

### Status

`partial`

---

## 4.8 Conversion and export

### Current state

There are already:
- convert entrypoints
- export utilities
- row detail convert actions

### Gap

The target requires:
- deterministic selection-based conversion
- stronger traceability
- clearer output contracts
- less ambiguity between workspace experimentation and platform outputs

### Status

`partial`

---

## 4.9 Persistence contract

### Current state

The table persists through `extensions.table`, including:
- columns
- views
- active view id
- sort/filter/group state
- formatting
- view layout

### Gap

This is enough for incremental evolution, but weak for long-term domain clarity if complexity keeps growing inside one orchestration layer.

### Status

`partial`

### Recommended direction

Do not rewrite persistence first.
First define stronger domain contracts on top of the current model.

---

## 4.10 Technical architecture and code ownership

### Current state

`IdeaTableTool.tsx` manages a large number of responsibilities:
- view switching
- persistence
- keyboard behavior
- add-column flow
- filters
- detail state
- AI overlays
- summary widgets
- import/export
- row template handling
- view-specific rendering branches

### Gap

This makes every new feature more expensive and increases the risk of cross-feature regressions.

### Implication

Before large parity work, the code should be split into clearer domains.

### Status

`needs refactor before feature work`

---

## 4.11 Runtime verification and trust

### Current state

The broader V5 remediation documents already warn that completion claims became too optimistic.

### Gap

`Table OS` still lacks a strong behavior-first verification framework tied to each capability.

### Implication

Without this, the module can easily drift back into `looks rich, behaves unevenly`.

### Status

`missing`

---

## 5) Gap classes

## 5.1 Product gaps versus target

These are feature and UX gaps versus Airtable/Notion-informed target:
- stronger property semantics
- real calendar parity
- deeper saved-view behavior
- stronger record-page depth
- relation and rollup usability
- flagship prompt-to-table builder
- visible artifact-backed differentiation

## 5.2 Architecture gaps versus maintainability

These are engineering gaps that will block safe growth:
- oversized `IdeaTableTool.tsx`
- mixed ownership of view logic
- inline lightweight views living beside dedicated view components
- lack of explicit domain slices for schema, views, record page, AI builder, and persistence

---

## 6) Priority assessment

## P0

- Extract and stabilize table runtime domains before major parity expansion
- Turn partial view system into trustworthy view system
- Strengthen record page and linking layer
- Build proposal-driven AI-first builder for table structure
- Add behavior-based verification gates

## P1

- Property-system semantic depth
- Saved-view governance
- Stronger card/grid mode
- Deeper matrix/timeline configuration

## P2

- Advanced polish
- richer visual analytics surfaces
- further optional power-user affordances after trust baseline is complete

---

## 7) Final assessment

Current `Idea Workspace` table implementation is not a blank slate and not a failure in architecture direction.

It is a strong partial foundation with three critical problems:
- uneven parity across capability areas
- too much responsibility concentrated in one orchestration file
- insufficient distinction between `real behavior` and `promising-looking UI`

That means the correct next move is not another speculative redesign.

The correct next move is staged completion:
- preserve the current workspace shell
- strengthen the table's trusted core
- extract domains before piling on parity features
- then finish the flagship `AI-first + manual-first Table OS` experience

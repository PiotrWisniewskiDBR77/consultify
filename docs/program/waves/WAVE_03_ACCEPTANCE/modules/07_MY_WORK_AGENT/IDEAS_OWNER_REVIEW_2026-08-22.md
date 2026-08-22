# My Work → Ideas — owner product review

Date: `2026-08-22`  
Visual-review runtime badge: `75bed3bb6485`  
Routes: `/my-work`, `/my-work/ideas/:id/workspace/:tool`  
Status: `IDEAS_VISUAL_PRODUCT_REVIEW_COMPLETE / TWO_CORE_DESIGN_TASKS_REQUIRED / FUNCTIONAL_AUDIT_NOT_RUN / OWNER_VERDICT_PENDING`

## Evidence boundary

This packet records Piotr's visual and product review of Ideas. The mounted runtime used a Chat-oriented local fixture, not the retained qualified My Work fixture. Screenshots are valid owner visual evidence, but do **not** prove API wiring, persistence, authorization, refresh readback, conversion correctness or full My Work acceptance. These checks belong to the integrator after remediation.

The owner strongly likes the four-tool, canvas-first direction, especially Mind Map. Preserve it. Ideas is delivered in two stages: first the two shared core components below, then dependent polish and the complete functional audit. Polishing isolated screens first would create rework.

## Stage 1 — two core tasks

### MYW-IDEAS-CORE-001 — Final shared expandable left panel

**Priority:** `P0`  
**Scope:** the expandable rail shared by Mind Map, Process Flow, Table and Whiteboard.

**Problem:** The current six views are overlapping and dense, use tiny type and nested cards, duplicate Teresa and lack a coherent product purpose.

**Product role:** Help develop an idea while the canvas remains primary: understand and evolve the problem, brainstorm, detect gaps and contradictions, connect evidence and organizational knowledge, assess maturity and decide the next step. Teresa remains the dialogue surface; the rail is a structured companion, not a second chat.

**Required design and behavior:**

- One shared component and information architecture for all four tools; tool-specific content may vary, structure and interaction may not.
- Consolidate relations/context, statistics/health, warnings, backlinks, notes, evidence, linked artifacts, knowledge search and related ideas into a small number of understandable views.
- Preserve the useful statistics/health visual direction, but define what each metric means and which action follows.
- Reduce AI to `AI Summary` and `AI Advice`; remove/merge generic `AI Expand`. AI is a sourced proposal with explicit apply/dismiss and may not silently mutate the canvas.
- Hide raw IDs and technical stages from the normal view.
- Stable collapsed, expanded and active states; no unpredictable overlay or reflow; retain useful state across tool switching/refresh.
- Liquid Glass, shallow hierarchy, readable type/contrast, fewer containers, canvas dominance, tooltips, non-color-only selection, keyboard/a11y, light/dark and narrow desktop/tablet support.

**Acceptance:** one documented architecture and implementation serves all tools; every retained view has a named user question, data source/API, actions and complete empty/loading/error/stale states; no action duplicates Teresa without a unique structured benefit; expanded rail remains inside the workspace; owner can explain every view without guidance.

### MYW-IDEAS-CORE-002 — Final selected-element right panel

**Priority:** `P0`  
**Scope:** inspector opened for a selected node/card/row in all Idea tools.

**Problem:** Valuable element data currently behaves like a full-screen layer, collides with the shell, uses tiny type, large gaps and too many nested frames.

**Required design and behavior:**

- Render inside the workspace, never over global navigation. Provide bounded resize, close and responsive fallback; canvas fit/zoom accounts for the panel.
- Preserve selection, edits and viewport on open/close/resize, section switch and refresh.
- One shell/lifecycle for all tools, with fields adapted to element type.
- Reorganize Basic Info, Description, Notes & Context, Tags & Classification, AI Context, Evidence & Sources and Linked Artifacts; important identity/status above the fold, low-frequency groups collapsed.
- Editable fields are obvious before focus. Status, owner, priority and semantic type have real autosave/save receipts and validation.
- AI suggestions are concise, sourced and explicitly applied/dismissed; no silent overwrite.
- Liquid Glass in light/dark, readable type/control sizes, reduced dead space, no redundant borders, accessible labels/order/Escape behavior and no floating-toolbar collision.

**Acceptance:** panel stays within workspace at target widths; canvas remains usable; selection, edits, width and viewport survive expected lifecycle; every field has verified API/readback or explicit local-only status; saving/error/conflict/permission states are actionable; owner can scan identity, status, description and next action without opening every section.

## Stage 2 — dependent tasks

| ID | Task | Required result | Dependency |
| --- | --- | --- | --- |
| `MYW-IDEAS-003` | Polish New Idea modal | Always-visible description boundary, quieter accessible placeholder and Liquid Glass polish; keep a light start, not a heavy form. | CORE-001 principles |
| `MYW-IDEAS-004` | Redesign optional Add brief | Subtle optional disclosure, not dominant/immediate execution; preserve content and focus through Add/Hide. | 003 |
| `MYW-IDEAS-005` | Normalize start-mode cards | AI/Blank/Template share neutral base and explicit hover/focus/selected/disabled; no permanent green false selection. | 003 |
| `MYW-IDEAS-006` | Tool-aware Idea tabs | Actual idea name plus tool-specific icon/accent; never color-only; persist active/order state. | CORE-001 |
| `MYW-IDEAS-007` | Excel-like inline tab rename | Double-click/select, Enter/Escape/click-outside semantics, API persistence, saved/error feedback, keyboard and no close conflict. | 006 |
| `MYW-IDEAS-008` | Simplify contextual header | Remove three legacy icons after unique-function audit; add `New idea`; remove duplicate local Teresa/unneeded Save; audit/remove Spark. | CORE-001 |
| `MYW-IDEAS-009` | Output counters and discovery | Counters for ideas/proposals/candidates/initiatives; click opens names, microdescriptions, source, status and next action. | 008 |
| `MYW-IDEAS-010` | Clarify candidate → initiative | Discoverable, conscious review/confirm flow with source idea/version lineage and duplicate prevention. | 009 |
| `MYW-IDEAS-011` | Remove/govern bottom AI banner | Remove unless it shows real sourced suggestions; otherwise explicit preview/apply/dismiss and persistent dismissal. | CORE-001 |
| `MYW-IDEAS-012` | Complete Convert destinations | Add Note/Notebook to Initiative, Tasks and Report; preview scope/destination; lineage, existing-target handling and no duplicates. | CORE-002 |
| `MYW-IDEAS-013` | Audit all four workspaces | Exercise every visible control for neededness, clarity, API, permission, receipt, persistence, retry, conflict, undo and cold readback. Nonfunctional enabled controls are defects. | both core tasks |
| `MYW-IDEAS-014` | Verify conversion chain | UI/API/DB proof for Idea → Note/Task/Report/Candidate/Initiative, including failure, foreign tenant, duplicates and refresh/deep-link. | 010, 012, 013 |
| `MYW-IDEAS-015` | Responsive/theme/a11y regression | Shared panels and four tools at target desktop/tablet, PL/EN, light/dark, keyboard and screen-reader. | all above |

## Positive constraints

- Preserve the strongly approved four-tool and canvas-first concept; refine Mind Map, do not reconstruct it.
- Element-level structured data is valuable; fix presentation, workspace fit and interaction.
- Expanded brief is useful; it needs hierarchy and polish.
- Autosave is preferred only when real, observable and recoverable.

## Integrator verification

For every retained/added control record: intended outcome, frontend handler, endpoint/local contract, authorization, loading/success/error receipts, persistence, cold readback, duplicate behavior and downstream impact. The owner is not expected to perform this audit.

Minimum replay: create Ideas in every start mode and tool; rename/edit/close/reopen/cold-refresh; exercise every left view and right field state; apply/reject sourced AI without silent mutation; convert to Note, Task, Report, Candidate and Initiative with lineage/permissions/deduplication; replay desktop/tablet, PL/EN and light/dark with clean console/network.

## Gate decision

Ideas visual/product discovery is complete; implementation is not accepted. Start `MYW-IDEAS-CORE-001` and `MYW-IDEAS-CORE-002`. Sequence all remaining tasks behind them unless needed to unblock the core designs. Broader My Work owner review remains open.

Evidence: [evidence/ideas-owner-review-2026-08-22/INDEX.md](evidence/ideas-owner-review-2026-08-22/INDEX.md)

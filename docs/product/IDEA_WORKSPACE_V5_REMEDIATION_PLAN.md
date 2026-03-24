# Idea Workspace V5 — Remediation And Completion Plan

> **Status:** ACTIVE  
> **Date:** 2026-03-09  
> **Owner:** Product / Platform / CTO  
> **Purpose:** reset the implementation to reality, document what is actually broken, and define the no-ambiguity repair path canvas by canvas.

> **Critical note:** reported "V5 complete" status was invalidated by review on 2026-03-09.  
> This document is now the canonical repair plan for functional completion.

---

## 0) References

- `docs/product/IDEA_WORKSPACE_V5_SSOT.md`
- `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
- `docs/product/IDEA_WORKSPACE_V5_IMPLEMENTATION_PROGRAM.md`
- `docs/product/IDEA_WORKSPACE_V5_1_IMPLEMENTATION_PROGRAM.md`
- `docs/product/IDEA_WORKSPACE_V5_FAILURE_INVENTORY_2026-03-09.md`
- `docs/product/V5_REMEDIATION_AGENT_EXECUTION_PACK.md`
- `docs/ui-standards/FROZEN_LAYOUTS.md`
- `docs/ui-standards/00-foundation/visual-language.md`

---

## 1) Executive reality check

The current state is not production-ready.

The most important problem is not only that parts are unfinished.
It is that some tasks were marked `done` while the user-facing result remains:
- weak visually
- unclear structurally
- partially non-functional
- misleading in QA status

### 1.1 What is real

There is real progress in:
- documentation and SSOT
- type contracts
- validators
- some API endpoints
- some shared artifact-linking components
- some canvas-level scaffolding

### 1.2 What is not real enough

The delivered experience does not yet satisfy the product promise.

Problems visible now:
- canvases render as generic placeholders rather than meaningful tools
- cross-canvas state exists more as scaffolding than as coherent workflow
- artifact linking is not visibly usable in the main workspace flow
- table autofill is prompt-based scaffolding, not implemented behavior
- context panel does not reflect the new attachment contract correctly
- smoke verification overstates completion because it checks files and strings more than runtime behavior

---

## 2) Review findings by area

## 2.1 Shared workspace problems

- The workspace feels visually empty and under-designed despite extra chrome.
- Important actions are present in labels, but not truly wired.
- The system exposes too many "promise" controls relative to what actually works.
- The user cannot easily tell what is editable, what is contextual, and what is real functionality.

## 2.2 Mind Map

Current visible problems:
- nodes look like blank white bars with almost no semantic richness
- the composition does not look like a real reasoning map
- there is weak visual hierarchy
- artifact linking is not visibly helping the map

Repair goal:
- make mind map feel like a real thinking tool, not generic boxes around a center label

## 2.3 Whiteboard

Current visible problems:
- looks like repeated brown blocks without semantic value
- weak affordance for what each item represents
- workshop energy and freeform speed are missing

Repair goal:
- make whiteboard useful for real note capture, grouping, and early chaos before structure

## 2.4 Process Flow

Current visible problems:
- nodes are generic `action` placeholders
- lane semantics are weak
- Classic / Automation / VSM feel more like tabs than different functional modes

Repair goal:
- make flow mode operationally meaningful, with semantics, lanes, and validation

## 2.5 Table

Current visible problems:
- rows are mostly empty, generic `node` placeholders
- right-side AI panel suggests automation before core data behavior is trustworthy
- linked artifact and autofill value is not truly visible

Repair goal:
- make table immediately useful as a comparison and synthesis surface

## 2.6 Artifact linking

Current visible problems:
- attach/open UX is not truly wired end-to-end
- some actions only show toasts
- context panel does not fully reflect attached artifact state
- backend persistence exists, but not all visible flows use it

Repair goal:
- make artifact linking subtle, real, and demonstrably valuable

## 2.7 QA / truthfulness problems

Current visible problems:
- completion claims overstate reality
- smoke tests are too static
- handoff documentation is misleading for future agents

Repair goal:
- make status truthful
- make QA behavior-based
- make next agent work from real state, not optimistic claims

---

## 3) Repair principles

## 3.1 Function before chrome

No more "action exists in UI" unless the behavior is real.

## 3.2 Reduce false promise

If a feature is not truly working:
- hide it
- downgrade it
- or relabel it as draft

But do not present it as complete.

## 3.3 Canvas-by-canvas recovery

Do not attempt one giant rewrite.

Repair sequence:
1. shared workspace integrity
2. artifact linking reality
3. mind map
4. whiteboard
5. process flow
6. table
7. cross-canvas and QA

## 3.4 One working path per canvas

Each canvas must first achieve one clearly useful, end-to-end working path before adding advanced polish.

## 3.5 Behavioral QA only

No more relying on:
- file existence
- string search
- component presence

Completion must depend on runtime behavior.

---

## 4) What “done” now means

A task may be considered truly done only if:
- the visible UI works
- the action is wired end-to-end
- the effect is understandable to the user
- the result survives save/reload
- the smoke check verifies behavior, not only code presence

---

## 5) Repair program — high-level phases

## Phase 0 — Truth reset

Goal:
- remove misleading completion claims
- align handoff docs with reality
- make agent execution safe again

## Phase 1 — Shared integrity and artifact-linking reality

Goal:
- make attach/open/preview real
- make context panel reflect actual attachments
- remove fake attach/autofill actions

## Phase 2 — Canvas functional recovery

Goal:
- each canvas becomes useful in its own right
- visible semantics replace generic placeholders

## Phase 3 — Cross-canvas completion

Goal:
- moving between systems feels coherent
- conversions and linked outputs become trustworthy

## Phase 4 — QA and visual hardening

Goal:
- browser-tested core flows
- reduced visual clutter
- honest completion status

---

## 6) Detailed remediation backlog

## 6.1 Phase 0 — Truth reset

### REM-01 — Reality reset in documentation

- invalidate false `all complete` claims
- mark handoff pack as superseded
- point all future work to remediation program

### REM-02 — Replace static completion narrative

- update V5/V5.1 ledgers with review correction
- keep implemented scaffolding visible, but not over-credited

## 6.2 Phase 1 — Shared integrity and artifact linking

### REM-03 — Real attach/open flow in workspace

- attach action opens actual attach UI
- open linked artifacts opens actual preview
- no toast-only behavior for primary feature paths

### REM-04 — Context panel attachment truth

- `artifactLinks` from workspace objects are visible in context
- attached artifacts and LinkGraph backlinks align

### REM-05 — Backend persistence hardening

- fix database portability issues
- verify attach/detach/get on real environment
- ensure save/reload persistence

### REM-06 — Table autofill becomes product behavior

- row-level linked artifact workflow
- preview before apply
- refresh behavior with visible changed fields

## 6.3 Phase 2 — Canvas-by-canvas recovery

### REM-07 — Mind Map functional recovery

- meaningful node rendering
- branch hierarchy
- readable node labels and depth
- visible linked-artifact affordance on nodes

### REM-08 — Whiteboard functional recovery

- useful sticky/text/frame primitives
- better visual differentiation
- grouping and clustering feel intentional

### REM-09 — Process Flow functional recovery

- proper lane behavior
- real flow semantics
- visible differentiation of Classic / Automation / VSM

### REM-10 — Table functional recovery

- table becomes useful by default
- rows and columns are meaningful
- reduce distracting side automation until core is stable

## 6.4 Phase 3 — Cross-canvas completion

### REM-11 — Cross-system state coherence

- same idea survives across canvases
- selection and focus rules are coherent
- conversion targets behave predictably

### REM-12 — Idea Card and workspace anchor recovery

- pinned idea card gives orientation
- stage and summary become actually useful

## 6.5 Phase 4 — QA and visual hardening

### REM-13 — Browser-level smoke suite

- runtime user flows for attach/open/save/reload
- one test path per canvas

### REM-14 — Visual simplification pass

- remove empty or misleading chrome
- improve contrast, density, hierarchy, and canvas legibility
- reduce "looks advanced, does little" surfaces

### REM-15 — Launch-readiness review

- re-review against screenshots and live behavior
- only then restore strong completion claims

---

## 7) Canvas-by-canvas acceptance criteria

## 7.1 Mind Map

Must be able to:
- create and label useful nodes
- show hierarchy clearly
- attach and open artifacts from a node
- save and reload without losing meaning

## 7.2 Whiteboard

Must be able to:
- create and move notes
- distinguish note types visually
- group items
- attach context without clutter

## 7.3 Process Flow

Must be able to:
- create real process steps
- place them in lanes
- show at least one distinct mode behavior beyond label switching
- link steps to artifacts

## 7.4 Table

Must be able to:
- present meaningful rows and columns
- attach artifact to a row
- preview autofill
- apply and refresh sourced fields

---

## 8) Operational instruction for the second agent

The second agent should work in this order:

1. fix truth and misleading docs
2. wire artifact linking end-to-end
3. recover one canvas at a time
4. add browser/runtime verification
5. only then claim completion

### Mandatory rule

No task may be marked `done` if the result is not visible and testable in the UI.

---

## 9) Final note

This is not a small polish pass.

It is a necessary correction from:
- scaffold-first
to
- working-product-first

That is the right move.

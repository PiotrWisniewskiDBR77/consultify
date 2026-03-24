# Idea Workplace VNext - Implementation Plan

Owner: Piotr + AI  
Status: draft master plan  
Last updated: 2026-03-07  
Scope: `My Work -> Ideas -> single-idea workspace + entry flow + chat handoff + 4 canvases`  

> Purpose of this document: define one professional implementation plan for `Idea Workplace VNext` with product goals, UX rules, technical direction, phased rollout, task ledger, QA gates, and acceptance criteria.
>
> This document is an implementation plan, not the product SSOT. Product truth remains in the referenced SSOT files. This plan turns that truth into delivery work.
>
> **V5 note:** This document is now a working input / predecessor plan. For current implementation, use:
> - `docs/product/IDEA_WORKSPACE_V5_SSOT.md`
> - `docs/product/IDEA_WORKSPACE_V5_IMPLEMENTATION_PROGRAM.md`

---

## 0. References (SSOT / Canon)

Core product:
- `docs/product/IDEA_WORKSPACE_V3_SSOT.md`
- `docs/MYWORK_MODULE_SPECIFICATION.md`
- `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
- `docs/product/LINK_GRAPH_V3.md`
- `docs/product/REQUIREMENTS_V3_SSOT.md`

UI/UX canon:
- `docs/ui-standards/README.md`
- `docs/ui-standards/FROZEN_LAYOUTS.md`
- `docs/ui-standards/01-shell-layout/artifact-shell.md`
- `docs/ui-standards/01-shell-layout/presentation-modes.md`
- `docs/ui-standards/02-components/workspace-3-tools-strip.md`
- `docs/ui-standards/03-modules/module-hub-standard.md`
- `docs/ui-standards/03-modules/view-modes-standard.md`
- `docs/ui-standards/03-modules/interactive-board-standard.md`

Current implementation anchors:
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaWorkspaceToolbar.tsx`
- `src/components/MyWork/IdeaWorkspaceTools.tsx`
- `src/components/MyWork/IdeaContextPanel.tsx`
- `src/components/MyWork/IdeaTemplateGallery.tsx`
- `src/components/MyWork/layout/IdeaSmartLayout.ts`

---

## 1. Executive Summary

`Idea Workplace VNext` will evolve Ideas from a canvas-heavy tool switcher into a modern, elegant, AI-assisted thinking workspace.

The target experience is:
- user can start from one sentence, chat, blank canvas, template, or structured brief
- chat can hand off directly into workspace creation from the first screen
- one idea supports four canvases without losing state or content:
  - `Mind Map`
  - `Whiteboard`
  - `Process Flow`
  - `Table`
- context and AI help are always available, but never overpower the user
- the UI feels premium, calm, and intentional

Product promise:

> Tell the system what you want to work through, and it gives you the best start: chat, blank canvas, or template.

---

## 2. North Star and Product Goals

### 2.1 North star

Transform a raw thought into a decision-ready or initiative-ready artifact without forcing the user into a heavy form too early.

### 2.2 Primary goals

- Make idea capture feel light and inviting.
- Make AI useful from the first interaction, especially through the existing side chat.
- Preserve one-idea-many-views architecture across 4 canvases.
- Keep all large AI changes in `propose -> preview -> accept/reject`.
- Upgrade visual quality: zoom, map open/close states, backgrounds, node colors, edge routing, motion polish.

### 2.3 Success metrics

- user can create a new idea from chat in under 30 seconds
- user can switch between canvases without data loss
- template-assisted starts reduce blank-screen abandonment
- AI-generated workspace actions are applied via preview, not silent mutation
- Ideas module feels simpler on first entry, more powerful after the first edit

---

## 3. Product Principles

### 3.1 Experience principles

- `Light first`: default entry must be low-friction.
- `Structure later`: detailed brief is optional, not the first wall.
- `One idea, many views`: canvases are work modes, not separate products.
- `AI as copilot`: AI suggests, user decides.
- `Context on demand`: context is available and valuable, but not noisy.
- `Premium calm`: elegant visual language over feature clutter.

### 3.2 Non-negotiables

- Keep `Tools | Context | AI Suggestions` as the only right workspace strip.
- Respect frozen topbar, command row, and view mode order.
- No silent AI overwrite of user work.
- No data loss when switching between canvases.
- PL + EN support for all new user-facing copy.
- Existing traceability rules remain valid for convert flows.

---

## 4. Target Product Scope

## 4.1 In scope

- new `New Idea` entry experience
- chat-first handoff into workspace generation
- three primary start paths:
  - `Start with AI`
  - `Blank canvas`
  - `Use template`
- optional `Structured brief`
- single-idea workspace shell refinement
- four canvases and their switching model
- transform flows between canvases
- template system upgrade
- visual polish for canvas interaction layer
- AI suggestion and proposal workflows

## 4.2 Out of scope for this phase

- real-time collaboration
- fully fledged marketplace for templates
- advanced plugin ecosystem
- whiteboard shape zoo and infinite formatting surface
- complex automation builder inside Ideas
- full database-builder parity with Airtable/Notion

---

## 5. Target Information Architecture

## 5.1 New Idea entry

The `New Idea` screen becomes the lightest possible entry point.

Layout:
- hero input: `Describe the problem, idea, or outcome`
- primary actions:
  - `Start with AI`
  - `Blank canvas`
  - `Use template`
- `Popular starts` as lightweight suggestions
- `Add structured brief` as optional advanced disclosure

### 5.1.1 Popular starts

Popular starts are intent-led, not tool-led:
- break down a problem
- find root causes
- compare options
- map a process
- turn notes into structure
- prepare an initiative concept
- cluster workshop output
- build a decision map

### 5.1.2 Structured brief

Optional advanced disclosure with fields:
- problem
- current state
- desired outcome
- constraints
- evidence / notes

This is the heavy-description path, but it must remain opt-in.

## 5.2 Idea Workspace shell

Canonical workspace shell:
- sticky header
- properties strip
- CTA action bar
- main workspace area

### 5.2.1 Header

- back
- idea title
- status
- save
- chat
- `N / C` mode switch

### 5.2.2 Properties strip

Six fields:
- stage
- owner
- area
- priority
- confidence
- readiness

### 5.2.3 CTA action bar

Left:
- add
- template
- transform
- convert

Right:
- one AI CTA only: `Ask AI`

### 5.2.4 Main area

Left:
- section nav

Center:
- active section / active canvas

Right:
- `Tools | Context | AI Suggestions`

## 5.3 Section nav

Proposed section order:
- `Overview`
- `Canvas`
- `Evidence`
- `Validation`
- `Conversion`
- `Attachments`
- `Comments`
- `Activity`

Rules:
- new idea opens in lightweight `Canvas seed state`
- existing idea opens in `Overview`

---

## 6. Chat-First Operating Model

## 6.1 Goal

The persistent side chat must be able to move a user from conversation into workspace creation from the first screen.

## 6.2 Required behavior

User enters intent in chat, for example:
- "Help me map the client onboarding problem"
- "Turn these workshop notes into structure"
- "Build a process flow for complaints"

Chat responds with action-oriented next steps:
- `Create mind map`
- `Open blank whiteboard`
- `Generate process flow`
- `Create comparison table`
- `Show templates`

## 6.3 Handoff contract

Chat -> workspace handoff must support:
- workspace creation
- preferred initial canvas
- prefilled seed text
- optional template selection
- proposal preview before apply

## 6.4 AI safety rule

For all heavy actions:
- understand intent
- propose output
- show preview / summary
- apply only after explicit user acceptance

---

## 7. Four-Canvas Model

The four canvases are different work modes for the same idea.

## 7.1 Shared rules for all canvases

- same `ideaId`
- same core graph contract
- separate persisted `viewState`
- persisted zoom / pan / selection / viewport
- safe switching with no data loss
- transform entry points between canvases

## 7.2 Mind Map

Job to be done:
- explore
- branch ideas
- identify themes
- build options and hypotheses

Core actions:
- add child
- add sibling
- rename inline
- collapse / expand
- connect nodes
- group / cluster
- AI expand
- convert selection

## 7.3 Whiteboard

Job to be done:
- free-form thinking
- sticky-note ideation
- workshop dumping
- fast clustering

Core actions:
- sticky
- text
- shape
- frame
- connector
- group
- cluster
- summarize selection

## 7.4 Process Flow

Job to be done:
- operationalize idea
- map process
- model as-is / to-be
- identify handoffs and bottlenecks

Core actions:
- add step
- add decision
- add lane
- connect
- auto-layout
- validate flow
- convert to tasks

## 7.5 Table

Job to be done:
- compare
- prioritize
- structure assumptions
- manage experiments and options

Views:
- table
- kanban
- timeline
- calendar
- matrix
- grid

Core actions:
- add row
- add column
- group
- sort
- filter
- create view
- compare options

## 7.6 Canvas-specific tool systems (benchmark-derived MUST)

Shared shell stays common, but each canvas must expose its own tool system.

### 7.6.1 Shared rules for tool systems

- every canvas gets:
  - dedicated quick tools
  - dedicated insert actions
  - dedicated selection actions
  - dedicated AI actions
  - dedicated empty-state actions
- the right-side `Tools` panel must change by active canvas and current selection
- floating contextual actions near selection are allowed and recommended
- the global shell must not become overloaded with canvas-specific buttons

### 7.6.2 Global additions worth adding from benchmarks

Add these globally across canvases:
- `Quick insert` entry via plus menu or slash pattern
- `Recent / last used tools`
- `Focus selection`
- `Fit to content`
- `Reset to 100%`
- `Open full canvas`
- `Collapse back to workspace`
- `Transform current work`
- `Send selection to chat`
- `AI on selection`
- `Template for this canvas`
- `Canvas-specific empty states`

### 7.6.3 Mind Map tool contract

Mind Map must include:

- quick tools:
  - add child
  - add sibling
  - rename inline
  - reparent node
  - detach branch
  - duplicate branch
  - collapse / expand
  - connect nodes
- selection actions:
  - summarize branch
  - convert branch
  - color branch
  - tag / classify branch
- AI actions:
  - expand branch
  - find missing branches
  - cluster similar nodes
  - suggest root causes
  - suggest next steps
  - turn branch into tasks
  - turn branch into process flow
- visual requirements:
  - branch-level color inheritance
  - elegant curved edges
  - mini-toolbar on selected node or branch

### 7.6.4 Whiteboard tool contract

Whiteboard must include:

- insert tools:
  - sticky
  - text
  - shape
  - frame
  - connector
  - image
  - comment
- layout tools:
  - group
  - ungroup
  - align
  - distribute
  - bring forward / back
- AI actions:
  - cluster notes
  - summarize selection
  - generate ideas
  - name clusters
  - find themes
  - turn notes into mind map
  - turn notes into table
  - extract actions
- premium interaction rules:
  - lasso selection
  - lightweight text presets
  - optional simple assets / stickers / embeds
  - no large plugin zoo in the initial scope

### 7.6.5 Process Flow tool contract

Process Flow must include:

- semantic insert library:
  - start
  - action
  - decision
  - end
  - document
  - data
  - system
  - handoff
- lane tools:
  - add lane
  - rename lane
  - reorder lane
  - move step between lanes
- flow tools:
  - insert step between
  - split path
  - label edge
  - auto-layout
  - validate flow
- AI actions:
  - generate flow from description
  - generate lanes
  - suggest missing steps
  - find bottlenecks
  - find handoff risks
  - convert flow to tasks
  - create as-is / to-be variant
- visual requirements:
  - cleaner directional routing
  - clear decision-edge labeling
  - shape semantics must remain strict

### 7.6.6 Table tool contract

Table must include:

- structural tools:
  - add row
  - add column
  - edit column type
  - bulk edit
  - open row detail
- view tools:
  - create view
  - switch view
  - group
  - sort
  - filter
  - show / hide properties
  - resize columns
- AI actions:
  - generate columns
  - generate first rows from description
  - group rows
  - suggest scoring model
  - compare options
  - find missing fields
  - create decision matrix
  - create action plan
- product rule:
  - Table must be a strong planning and comparison workspace, not a weak fallback view

### 7.6.7 Benchmark takeaways that should become product rules

- from `Miro`: add transform-oriented actions and multi-surface output thinking
- from `Mural`: make AI actions direct and action-led, not passive-only
- from `Lucidchart` / `Visio`: give Process Flow the strongest semantic toolset
- from `Creately`: allow fast access to shapes/assets/templates without visual clutter
- from `Notion` / `Airtable`: make Table view-centric, lightweight, and configurable

---

## 8. Visual and Interaction Quality Targets

## 8.1 Zoom system

Every canvas must support:
- zoom in
- zoom out
- fit to content
- reset to 100%
- focus selection

Rules:
- smooth motion
- no viewport jumps
- preserve user orientation
- keyboard shortcuts for core zoom actions

## 8.2 Open / close map behavior

Map and canvas area should support:
- expanded full workspace mode
- collapsed / preview mode where relevant
- restore previous viewport on reopen

Use cases:
- mini-preview inside overview
- full canvas open for active editing
- return to section without losing context

## 8.3 Background system

Supported background styles:
- clean
- soft grid
- dot grid
- subtle blueprint

Guidelines:
- background supports orientation, not decoration
- table remains the cleanest
- process flow uses soft grid
- mind map prefers clean or dot grid
- whiteboard can use soft grid or dot grid

## 8.4 Node colors

Node colors must be semantic, restrained, and premium.

Suggested semantic set:
- neutral
- idea / opportunity
- problem / risk
- action / next step
- decision
- evidence / note
- metric / KPI

Rules:
- no neon palette
- max 6-8 canonical colors
- branch inheritance allowed
- manual override allowed
- AI may suggest color semantics, not force them

## 8.5 Edges and line design

Edges must feel elegant and readable.

Rules:
- mind map: soft curved edges
- whiteboard: light free-form connectors
- process flow: cleaner directional routing
- labels only where meaningful
- hover / selection states must be subtle but clear

---

## 9. Templates Strategy

Templates are a first-class acceleration mechanism, not a secondary extra.

## 9.1 Entry points

Templates must be reachable from:
- `New Idea` screen
- empty canvas states
- chat recommendations
- transform workflows

## 9.2 Template categories

- discovery
- analysis
- planning
- decision
- business
- workshop

## 9.3 Must-have templates

- problem tree
- 5 whys
- brainstorm cluster
- stakeholder map
- swimlane process
- decision matrix
- impact vs effort
- assumptions board
- risk map
- initiative skeleton
- workshop debrief
- notes to structure

## 9.4 Template rules

- templates are grouped by intent, not by technical renderer only
- applying a template never locks the user into one canvas
- optional AI fill may enrich a template, but still uses preview

---

## 10. AI Operating Rules

## 10.1 Allowed AI action families

- create
- expand
- cluster
- transform
- summarize
- compare
- validate
- convert

## 10.2 Core rule

All meaningful mutations use:
- propose
- preview
- accept / reject

## 10.3 Scope handling

AI can operate on:
- whole idea
- active canvas
- selection
- single node / edge / lane / row

## 10.4 AI Suggestions panel

Suggestion cards must support:
- preview
- apply
- send to chat
- dismiss

---

## 11. Delivery Strategy

The work should be delivered through staged workstreams rather than one monolithic rewrite.

## 11.1 Release framing

- `R0`: architecture and light-entry foundation
- `R1`: 4-canvas operational parity + chat-first handoff
- `R2`: premium polish, transforms, visual refinement

## 11.2 Workstreams

- `WS-IW-A` Product and IA
- `WS-IW-B` Entry flow and chat handoff
- `WS-IW-C` Workspace shell and navigation
- `WS-IW-D` 4 canvas capability hardening
- `WS-IW-E` Templates and AI start system
- `WS-IW-F` Visual quality and interaction polish
- `WS-IW-G` Context, conversion, and traceability
- `WS-IW-H` QA, telemetry, and adoption

---

## 12. Task Ledger

Legend:
- Spec status: `draft | review | locked`
- Impl status: `todo | in_progress | partial | blocked | done`
- QA status: `not_tested | smoke_passed | qa_passed`
- Release: `R0 | R1 | R2`

| ID | Workstream | Task | Description | Depends on | Spec | Impl | QA | Release |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IW-A01 | WS-IW-A | Lock VNext IA | Finalize IA for entry, workspace shell, sections, and 4-canvas model | - | draft | todo | not_tested | R0 |
| IW-A02 | WS-IW-A | Update SSOT mapping | Reconcile this plan with `IDEA_WORKSPACE_V3_SSOT` and `MYWORK_MODULE_SPECIFICATION` | IW-A01 | draft | todo | not_tested | R0 |
| IW-A03 | WS-IW-A | Define canonical canvas actions | Lock action sets, labels, and scope rules for each canvas | IW-A01 | draft | todo | not_tested | R0 |
| IW-B01 | WS-IW-B | Design New Idea screen | Implement light-first entry with hero input, three primary starts, popular starts, and structured brief | IW-A01 | draft | todo | not_tested | R0 |
| IW-B02 | WS-IW-B | Chat handoff contract | Add explicit chat-to-workspace handoff payloads and state restore | IW-A01 | draft | todo | not_tested | R0 |
| IW-B03 | WS-IW-B | Prompt UX for intent recognition | Create UX for chat responses that propose `Mind Map / Whiteboard / Process Flow / Table / Template` | IW-B02 | draft | todo | not_tested | R0 |
| IW-B04 | WS-IW-B | Structured brief behavior | Implement optional advanced brief entry with parse-and-generate actions | IW-B01 | draft | todo | not_tested | R1 |
| IW-C01 | WS-IW-C | Workspace shell refactor | Align header, properties strip, CTA bar, and main area with artifact shell rules | IW-A01 | draft | todo | not_tested | R0 |
| IW-C02 | WS-IW-C | Section nav implementation | Add `Overview / Canvas / Evidence / Validation / Conversion / Attachments / Comments / Activity` | IW-C01 | draft | todo | not_tested | R0 |
| IW-C03 | WS-IW-C | Canvas selector finalization | Make 4-canvas selector the canonical work-mode switch with state persistence | IW-C01 | draft | todo | not_tested | R0 |
| IW-C04 | WS-IW-C | State persistence | Persist preferred tool, viewport, zoom, selection, and reopen behavior per canvas | IW-C03 | draft | todo | not_tested | R1 |
| IW-C05 | WS-IW-C | Smart empty states | Add empty-state UX per canvas: blank, template, generate-from-chat, transform-from-current | IW-C03 | draft | todo | not_tested | R1 |
| IW-C06 | WS-IW-C | Selection-aware tool architecture | Introduce canvas-aware and selection-aware `Tools` panel contracts plus contextual mini-toolbars | IW-A03,IW-C03 | draft | todo | not_tested | R1 |
| IW-D01 | WS-IW-D | Mind Map hardening | Improve node creation, branch actions, inline editing, clustering, and keyboard flow | IW-A03 | draft | todo | not_tested | R1 |
| IW-D02 | WS-IW-D | Whiteboard hardening | Improve sticky/text/frame/connector tools and lightweight workshop flow | IW-A03 | draft | todo | not_tested | R1 |
| IW-D03 | WS-IW-D | Process Flow hardening | Improve lanes, step library, validation, auto-layout, and generation contracts | IW-A03 | draft | todo | not_tested | R1 |
| IW-D04 | WS-IW-D | Table hardening | Improve row/column handling, view generation, grouping, sorting, and comparison use cases | IW-A03 | draft | todo | not_tested | R1 |
| IW-D05 | WS-IW-D | Cross-canvas transform v1 | Add guided transforms between canvases with preview and user confirmation | IW-D01,IW-D02,IW-D03,IW-D04 | draft | todo | not_tested | R2 |
| IW-D06 | WS-IW-D | Mind Map dedicated tools | Implement branch mini-toolbar, branch color inheritance, branch summarize, and branch transform actions | IW-C06,IW-D01 | draft | todo | not_tested | R1 |
| IW-D07 | WS-IW-D | Whiteboard dedicated tools | Implement lasso, align/distribute, text presets, lightweight assets, and clustering-first tools | IW-C06,IW-D02 | draft | todo | not_tested | R1 |
| IW-D08 | WS-IW-D | Process Flow dedicated tools | Implement semantic shape library, lane manager, connector labels, and validation-first tools | IW-C06,IW-D03 | draft | todo | not_tested | R1 |
| IW-D09 | WS-IW-D | Table dedicated tools | Implement view creator, property visibility, grouping presets, and starter planning tables | IW-C06,IW-D04 | draft | todo | not_tested | R1 |
| IW-E01 | WS-IW-E | Template IA redesign | Reorganize templates by intent instead of renderer-only grouping | IW-A01 | draft | todo | not_tested | R1 |
| IW-E02 | WS-IW-E | Template gallery refresh | Refresh template browsing, preview, and apply flow | IW-E01 | draft | todo | not_tested | R1 |
| IW-E03 | WS-IW-E | AI-filled template flow | Add optional AI enrichment after template application with proposal review | IW-E02 | draft | todo | not_tested | R1 |
| IW-E04 | WS-IW-E | Popular starts wiring | Wire suggested starts to prompts, templates, or canvas creation flows | IW-B01 | draft | todo | not_tested | R1 |
| IW-E05 | WS-IW-E | Canvas-specific empty starts | Add benchmark-inspired start flows per canvas: blank, template, generate, transform, recent | IW-C05,IW-E02 | draft | todo | not_tested | R1 |
| IW-F01 | WS-IW-F | Zoom behavior system | Add fit-to-content, 100 percent, focus selection, smooth zoom, and shortcuts | IW-C04 | draft | todo | not_tested | R2 |
| IW-F02 | WS-IW-F | Open/close map states | Implement expanded and collapsed map behavior with viewport restore | IW-C04 | draft | todo | not_tested | R2 |
| IW-F03 | WS-IW-F | Canvas backgrounds | Introduce clean / soft grid / dot grid / blueprint backgrounds per canvas | IW-C01 | draft | todo | not_tested | R2 |
| IW-F04 | WS-IW-F | Semantic node colors | Reintroduce refined node color system with premium palette and branch inheritance rules | IW-D01,IW-D02,IW-D03 | draft | todo | not_tested | R2 |
| IW-F05 | WS-IW-F | Elegant edge routing | Upgrade edge styles, hover states, labels, and routing per canvas | IW-D01,IW-D03 | draft | todo | not_tested | R2 |
| IW-F06 | WS-IW-F | Motion polish | Add subtle motion, viewport transitions, and microinteractions | IW-F01,IW-F02,IW-F05 | draft | todo | not_tested | R2 |
| IW-G01 | WS-IW-G | Context panel promotion | Evolve context from helper side panel into stronger evidence and link surface | IW-C01 | draft | todo | not_tested | R1 |
| IW-G02 | WS-IW-G | Evidence section | Add a first-class section for interview insights, KPI, related artifacts, and notes | IW-G01 | draft | todo | not_tested | R1 |
| IW-G03 | WS-IW-G | Validation section | Add assumptions, risks, evidence coverage, and decision-readiness UX | IW-G02 | draft | todo | not_tested | R1 |
| IW-G04 | WS-IW-G | Conversion section | Add structured output conversion to initiative, decision, task set, report, and action plan | IW-G02 | draft | todo | not_tested | R1 |
| IW-G05 | WS-IW-G | Traceability hardening | Ensure all convert actions preserve source lineage and open-source navigation | IW-G04 | draft | todo | not_tested | R1 |
| IW-H01 | WS-IW-H | Telemetry model | Track starts, template adoption, chat handoffs, canvas switches, AI accept/reject, and conversions | IW-B02,IW-C03,IW-G04 | draft | todo | not_tested | R1 |
| IW-H02 | WS-IW-H | Smoke scripts | Add smoke coverage for entry flow, chat handoff, 4 canvases, transform, and convert flows | IW-B01,IW-C01,IW-D01,IW-D02,IW-D03,IW-D04 | draft | todo | not_tested | R1 |
| IW-H03 | WS-IW-H | UX audit and polish pass | Run full compliance pass against UI standards and frozen layouts | IW-C01,IW-F06 | draft | todo | not_tested | R2 |
| IW-H04 | WS-IW-H | Adoption review | Evaluate telemetry and define post-release iteration list | IW-H01 | draft | todo | not_tested | R2 |

---

## 13. Delivery Phases

## Phase 0 - Architecture Lock

Goal:
- lock IA, shell, canvas rules, and plan mapping before visual rework

Tasks:
- IW-A01
- IW-A02
- IW-A03

Definition of done:
- document-level agreement on IA and workflow
- no unresolved ambiguity around 4-canvas model

## Phase 1 - Light Entry Foundation

Goal:
- make starting an idea feel modern and effortless

Tasks:
- IW-B01
- IW-B02
- IW-B03
- IW-C01
- IW-C02
- IW-C03

Definition of done:
- user can start from hero input or chat
- workspace shell is coherent
- one idea can open directly into an appropriate canvas

## Phase 2 - Operational Canvas Parity

Goal:
- make all four canvases reliable and differentiated

Tasks:
- IW-C04
- IW-C05
- IW-C06
- IW-D01
- IW-D02
- IW-D03
- IW-D04
- IW-D06
- IW-D07
- IW-D08
- IW-D09
- IW-E01
- IW-E02
- IW-E04
- IW-E05
- IW-G01
- IW-G02
- IW-G03
- IW-G04
- IW-G05
- IW-H01
- IW-H02

Definition of done:
- 4 canvases are usable as first-class work modes
- templates and context are operational
- conversion remains traceable

## Phase 3 - Premium Polish

Goal:
- make the module feel premium, elegant, and clearly differentiated

Tasks:
- IW-B04
- IW-D05
- IW-E03
- IW-F01
- IW-F02
- IW-F03
- IW-F04
- IW-F05
- IW-F06
- IW-H03
- IW-H04

Definition of done:
- zoom and viewport behavior feel polished
- node colors and edge styles feel intentional
- transforms and AI enrichment feel trustworthy and premium

---

## 14. QA and Acceptance

## 14.1 Required smoke scenarios

- create idea from hero input
- create idea from chat handoff
- create idea from template
- create idea from structured brief
- switch between all 4 canvases without data loss
- restore viewport / zoom after leaving and reopening idea
- open and close canvas / map states where applicable
- apply AI proposal with preview
- reject AI proposal without side effects
- convert idea output with traceability preserved

## 14.2 UX acceptance checklist

- entry does not feel heavy
- chat handoff is understandable
- templates reduce blank-state anxiety
- context helps but does not dominate
- first-time user can understand how to start
- advanced user can move quickly
- 4 canvases feel distinct but connected
- right-side strip stays stable and predictable

## 14.3 Visual acceptance checklist

- clean spacing and visual calm
- semantic color use
- elegant line work
- polished zoom transitions
- refined dark mode
- no ad hoc extra chrome or competing toolbars

---

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Entry screen becomes too busy | High | Keep one primary input, lightweight suggestions, and optional advanced brief only |
| Chat-generated actions feel unsafe | High | Keep preview-first flow and explicit apply |
| Four canvases become inconsistent products | High | Lock common core contracts, selection model, and shell rules first |
| Visual polish work delays functional progress | Medium | Ship in phases; reserve polish for R2 after R1 parity |
| Table scope expands into full database builder | Medium | Limit scope to idea-appropriate structure, comparison, and planning views |
| Whiteboard scope balloons | Medium | Keep minimal premium interactions; avoid broad shape/plugin expansion |
| Context panel becomes noisy | Medium | Prioritize evidence and links, not recommendation spam |

---

## 16. Team Working Model

Recommended execution split:

- Product / IA:
  - IA lock
  - section model
  - canvas roles
  - template taxonomy

- Frontend / UX:
  - entry flow
  - workspace shell
  - canvas controls
  - visual polish

- Backend / platform:
  - proposal contracts
  - transform services
  - traceability
  - telemetry

- QA:
  - smoke scripts
  - regression passes
  - UX acceptance review

---

## 17. Definition of Done

`Idea Workplace VNext` is considered delivered for the targeted release only if:

- the new entry model is live
- chat can hand off into workspace creation
- all 4 canvases work as one idea workspace
- no data loss on canvas switching
- template workflow is operational
- AI actions use preview-first acceptance
- context and conversion are integrated
- visual polish targets for zoom, map states, backgrounds, node colors, and edges are implemented to agreed release level
- smoke pack passes
- UX audit confirms compliance with frozen layouts and workspace strip canon

---

## 18. Recommended Immediate Next Steps

1. Review and lock this implementation plan.
2. Convert `IW-A01..IW-A03` into active execution tasks.
3. Start Phase 1 with `New Idea` entry and chat handoff before deeper canvas polish.
4. Treat visual refinements like zoom, backgrounds, node colors, and elegant edges as a dedicated polish workstream, not ad hoc scattered fixes.

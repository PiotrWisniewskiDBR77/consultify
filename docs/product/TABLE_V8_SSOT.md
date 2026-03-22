# Table v8 SSOT

> Status: Draft v8
> Owner: Product + Engineering
> Scope: define the final product truth for `Table` inside `Idea Workspace`, including the Airtable/Coda-class relational operating model we still need to complete in Consultify

---

## 1. Why this document exists

`Table` already has broad runtime coverage, but still lacks one final canonical product contract.

This document exists to freeze:

- what the Table system is
- what the Table system is not
- which Airtable/Coda-grade capabilities are still missing or only partial
- how those missing capabilities should be added to the current Consultify reality

This is step 5 of the `Idea v8` program.

---

## 2. Inherited truth

This document inherits:

- `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `IDEA_WORKSPACE_V5_SSOT.md`
- `CANVAS_OS_CONTRACT_FREEZE.md`
- `TABLE_V8_READINESS_AUDIT.md`
- `TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md`
- `docs/strategy/TABELE_V8_AS_IS.md`
- `docs/strategy/TABELE_V8_BENCHMARK.md`
- `docs/strategy/AIRTABLE_REPRESENTATION_ANALYSIS_FOR_CONSULTIFY_2026-03-16.md`

Rule:

`Table remains one native work system inside one idea workspace, never a disconnected spreadsheet app and never only a technical metadata console`

---

## 3. Final product statement

`Table` is the relational structured thinking and operating system for data-backed work inside `Idea Workspace`.

It exists for moments when:

- structure matters more than loose spatial exploration
- comparisons and prioritization must become durable
- the user needs many records, fields, relations, and views
- work must become processable by roles and interfaces
- the same data should support analysis, execution, and presentation

Canonical statement:

`Table is where an idea becomes a governed relational work system that can be analyzed, operated, and exposed through multiple curated surfaces without losing one source of truth.`

---

## 4. Product identity

`Table` is:

- a relational work surface
- a schema-driven data system
- a multi-view operational workspace
- a base for interfaces and forms
- a decision-support and structured-analysis engine

`Table` is not:

- only a grid
- only a spreadsheet clone
- only a schema editor
- only a record list
- only a docs product with embedded tables

---

## 5. Core jobs to be done

`Table` must let the user:

- design a useful schema
- create and relate records across multiple tables
- work through saved views for different roles and tasks
- expose the same data through interfaces and forms
- use formulas, rollups, and dependencies as real semantics
- use AI to propose, refine, and evolve data structure safely
- connect structured data to the wider Consultify graph, initiatives, execution, and results

---

## 6. Canonical operating model

The final operating grammar should be:

1. `Base`
2. `Table`
3. `Field`
4. `View`
5. `Record`
6. `Interface`
7. `Form`

All seven layers must feel like one coordinated system.

If the user experiences them as disconnected features, the product is still unfinished.

---

## 7. Current capability truth

Use capability labels from `CANVAS_OS_CONTRACT_FREEZE.md`.

### 7.1 Real

- broad field type coverage
- formulas and rollups
- relation and cross-table primitives
- many view types
- forms and interface seams
- AI schema proposal direction
- sharing, audit, and lineage seams

### 7.2 Partial

- final base shell and multi-table experience
- schema governance as the canonical workflow
- relational navigation and explainability
- record page and record-workspace excellence
- docs-plus-data fusion
- final split between views, interfaces, and forms
- clear AI-first creation front door

### 7.3 Out of scope for current closure

- communication automation such as sending reports or outbound report flows
- full duplication of every Airtable or Coda workflow surface
- uncontrolled product breadth before the operating model is stable

---

## 8. Missing capabilities and how they must be added

This section freezes the exact additions still required.

### 8.1 Base and multi-table operating shell

Missing capability:

- one obvious multi-table operating surface

Why it matters:

- Airtable-class work begins with a base, not with a floating isolated table

How it must be added:

- treat `base` as the canonical relational container
- make table switching, base-level sharing, and base-level governance obvious
- distinguish clearly between base navigation and per-table view navigation

System placement:

- local table workspace shell
- no frozen-layout violations
- base-level metadata and permissions

### 8.2 Schema manager as product hub

Missing capability:

- field and schema work as the central place where relational truth is managed

Why it matters:

- field semantics drive formulas, validation, forms, interfaces, AI, and relations

How it must be added:

- promote the field manager into a first-class schema surface
- show type, description, dependencies, options, permissions, and primary-field behavior
- make schema evolution explicit and reviewable

System placement:

- existing `Tools` surface or dedicated schema manager layer inside table product shell
- product-safe schema workflow

### 8.3 Field types as mini-products

Missing capability:

- fully productized field-type behavior

Why it matters:

- Airtable-class power comes from field semantics, not just grid rendering

How it must be added:

- each advanced field type should have strong setup UX
- especially:
  - relation
  - lookup
  - rollup
  - formula
  - duration/dependency-aware date behavior
- ensure the field configuration is consistent across:
  - grid
  - forms
  - interfaces
  - AI schema proposals

System placement:

- schema manager
- formula/rollup editors
- relation config surfaces

### 8.4 True relational UX

Missing capability:

- natural work across related records and tables

Why it matters:

- relation semantics must feel native, not merely available

How it must be added:

- improve linked-record browsing and selection
- support reverse relation understanding
- improve relation traversal between tables
- strengthen cross-table summaries and rollups
- make related-data navigation feel one click away, not hidden

System placement:

- grid and record-detail layer
- relation pickers and cross-table panels

### 8.5 Explainable lookup and rollup logic

Missing capability:

- better transparency for computed relational values

Why it matters:

- users need to understand why a lookup or rollup shows a given result

How it must be added:

- show relation path
- show source records or source field
- show aggregation method
- distinguish computed fields clearly from manual fields

System placement:

- field manager
- record detail
- cell expand / formula explanation surfaces

### 8.6 Saved views as first-class operational objects

Missing capability:

- a fully coherent saved-view discipline

Why it matters:

- views are the main working layer for different roles and use cases

How it must be added:

- support saved views as durable objects with:
  - filters
  - sort
  - grouping
  - field visibility
  - layout
  - view metadata and sharing behavior
- define clearly which actions belong to the table, which to the view, and which to the interface

System placement:

- table shell
- view management layer

### 8.7 Record detail as workspace

Missing capability:

- elite record-workspace behavior

Why it matters:

- Airtable and Coda both become more powerful when the record stops being just a row

How it must be added:

- treat record detail as a real working surface
- support:
  - all fields
  - nested linked records
  - comments
  - attachments
  - audit
  - computed-field explanation
  - embedded related views where useful

System placement:

- record expand / record detail layer
- audit and activity integration

### 8.8 Interfaces as audience-specific apps

Missing capability:

- a clearly productized interfaces layer

Why it matters:

- not every user should work in the grid

How it must be added:

- treat interfaces as curated application shells over the same data
- support page composition, cards, charts, detail views, filters, and search
- define the contract between:
  - base
  - table
  - saved view
  - interface

System placement:

- interface designer and interfaces index
- separate from grid semantics, but built on the same source of truth

### 8.9 Forms as standalone input products

Missing capability:

- fully productized forms

Why it matters:

- forms are one of the main controlled-entry surfaces for relational data

How it must be added:

- treat forms as first-class assets
- support:
  - field order and visibility
  - conditional visibility
  - defaults
  - auth rules
  - submission behavior
  - public/private publication
- keep forms fully tied to table schema and field truth

System placement:

- forms index
- form builder
- publish/access control layer

### 8.10 Docs-plus-data composition

Missing capability:

- stronger Coda-class composition of text, workflow, and data

Why it matters:

- some work is best done in a context-rich surface, not a pure grid

How it must be added:

- support table work inside richer document-like and interface-like contexts
- let users embed views, summaries, relational blocks, and commentary around the data
- connect tables more tightly with note-, initiative-, and decision-oriented artifacts

System placement:

- interfaces
- record detail
- cross-artifact embedding layer

### 8.11 Template system for operational setups

Missing capability:

- templates for relational work systems, not only isolated records

Why it matters:

- users want to start from a proven operational model

How it must be added:

- support templates for:
  - schema
  - saved views
  - forms
  - interfaces
  - common workflows such as decision matrix, assumptions log, action plan, automation backlog

System placement:

- discovery/template layer
- AI schema build flow

### 8.12 Governed schema evolution

Missing capability:

- one safe schema-change workflow

Why it matters:

- Airtable-class power becomes dangerous without clear schema-change governance

How it must be added:

- schema changes should support:
  - proposal
  - review
  - diff
  - approval
  - rollback or undo
- make dependency impact visible before destructive changes

System placement:

- schema manager
- audit trail
- AI proposal review flow

### 8.13 AI-led table creation and refinement

Missing capability:

- one true AI-first table creation surface

Why it matters:

- Airtable’s strongest recent direction is not "AI helper in the corner", but `describe -> plan -> build`

How it must be added:

- make AI a primary creation path for:
  - schema proposal
  - sample records
  - saved views
  - interfaces/forms suggestions
- keep the model:
  - describe
  - propose
  - review
  - accept/reject

System placement:

- AI build surface
- schema proposal layer
- table empty states and entry points

### 8.14 Search, retrieval, and discovery

Missing capability:

- a named and productized discovery layer over relational data

Why it matters:

- users need to find data, views, fields, records, and related objects quickly

How it must be added:

- define discovery as a first-class layer
- support search across:
  - bases
  - tables
  - fields
  - records
  - views
  - forms
  - interfaces
- connect discovery to relational context and backlinks

System placement:

- search/discovery surface
- command palette and retrieval layer

---

## 9. AI operating model

AI in `Table` must act primarily as:

- schema planner
- field and relation advisor
- view and interface suggester
- data simplifier
- scoring and comparison assistant
- controlled mutation assistant

AI in `Table` must not act as:

- a silent schema mutator
- a magical build system with no review
- a source of hidden relation logic

Canonical rule:

`AI may propose structure and data work, but canonical schema truth still requires explicit review, explainability, and auditability.`

---

## 10. Explicit scope cutline

This package intentionally excludes communication automation such as:

- sending reports by email
- outbound message workflows
- report distribution orchestration

Those belong to later workflow or communication layers, not to the core relational-table closure.

---

## 11. System architecture placement

`Table` should use the existing architecture in four layers:

### 11.1 Shared shell

- one idea = one workspace
- work-system switcher
- right strip `Tools | Context | AI Suggestions`

### 11.2 Local table runtime

- grid and view work
- schema and field work
- record operations
- relation and formula behavior

### 11.3 App surfaces over data

- interfaces
- forms
- curated audience views

### 11.4 Governance and AI layer

- schema proposals
- audit
- lineage
- sharing and permissions

---

## 12. Final product promise

When a user opens `Table`, they should feel:

- they can design a real relational system, not just add columns
- related records behave like one data graph
- saved views, interfaces, and forms feel coordinated
- AI can help them build structure safely
- and the same data can support analysis, decision support, and operational work without duplication

---

## 13. Acceptance criteria

This document is satisfied only when:

- base and multi-table work feel canonical
- schema management is one obvious hub
- relations, lookup, and rollup are explainable and trusted
- saved views are durable first-class work surfaces
- record detail behaves like a workspace, not a popup
- interfaces and forms are fully tied to the same data truth
- docs-plus-data composition is explicitly supported
- AI-led build and schema evolution remain proposal-governed

---

## 14. Related canonical docs

- `TABLE_V8_READINESS_AUDIT.md`
- `TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md`
- `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `IDEA_WORKSPACE_V5_SSOT.md`

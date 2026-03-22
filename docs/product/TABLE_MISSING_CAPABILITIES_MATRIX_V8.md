# Table Missing Capabilities Matrix v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: exhaustive missing-capabilities matrix for the `Table` package, covering everything still required for Consultify to behave like a truly complete Airtable/Coda-class relational work system inside `Idea Workspace`

---

## 1. Why this document exists

The core `Table v8` package already freezes:

- readiness truth
- final product identity
- relational schema doctrine
- docs-plus-data doctrine

What it did not yet do in one place is:

`list every missing capability exhaustively enough that nothing important remains implicit`

This document exists to close that gap.

It should be read as:

- the final missing-capabilities ledger for `Table`
- the completion checklist for step 5 of the `Idea v8` program
- the bridge between broad product truth and future implementation waves

---

## 2. Canonical rule

The question is not:

`what table features do leading products have?`

The question is:

`what still prevents Consultify from becoming a complete relational operating system where tables can be created from intent, evolved safely, and fed with data from internal and external sources?`

This document answers that exact question.

---

## 3. Gap classification

Every missing item below is classified as one of:

- `P0 critical`: without this, the operating model is still structurally incomplete
- `P1 important`: strongly improves completeness and trust, but does not block the existence of the core model
- `P2 enrichment`: valuable parity or polish after the core model is stable

---

## 4. Surface-by-surface missing capability matrix

## 4.1 Base shell and multi-table operating model

### Why this area matters

Airtable-class work begins at the `base` level, not at a disconnected table or overloaded toolbar.

### Missing capabilities

- `P0 critical`: one explicit `base-first` shell where multiple tables are the default mental model
- `P0 critical`: clear separation between `base navigation`, `table navigation`, and `view navigation`
- `P0 critical`: clean, reduced, canonical top-shell discipline instead of capability sprawl
- `P1 important`: base-level metadata panel with owner, purpose, sharing, and lifecycle context
- `P1 important`: base-level create/import actions collected in one obvious entry area
- `P2 enrichment`: stronger base dashboard summarizing all tables, key counts, freshness, and health

### What this closes

This closes the current gap where the product has many features but still does not always feel like one coordinated relational system.

---

## 4.2 Schema management and field governance

### Why this area matters

In Airtable, schema is a primary operator surface.
In Consultify, the runtime is strong, but the product shell still under-represents schema as the center of truth.

### Missing capabilities

- `P0 critical`: one dedicated schema hub that consolidates field operations
- `P0 critical`: field descriptions and purpose metadata as first-class schema properties
- `P0 critical`: primary-field management as an explicit product action
- `P0 critical`: visible dependency map for formulas, rollups, lookups, views, forms, and interfaces
- `P0 critical`: change-impact preview before field rename, delete, type conversion, or relation mutation
- `P1 important`: field-level permission and editability visibility
- `P1 important`: field usage browser showing where the field is referenced
- `P1 important`: conversion guidance when changing field types
- `P2 enrichment`: schema history timeline and field-level change narrative

### What this closes

This closes the gap between "we technically support many field types" and "the user can safely operate a real business schema."

---

## 4.3 Field types as mini-products

### Why this area matters

Field semantics power the whole system.
If advanced fields are not fully productized, the whole table experience feels shallower than it really is.

### Missing capabilities

- `P0 critical`: stronger dedicated setup UX for `relation`, `lookup`, `rollup`, and `formula`
- `P0 critical`: consistent configuration grammar across grid, forms, interfaces, and AI proposals
- `P1 important`: richer formatting/behavior settings for numeric, duration, currency, percent, rating, and status fields
- `P1 important`: explainable validation and constraints model for field-level quality control
- `P2 enrichment`: richer display presets and semantic field templates for common business patterns

### What this closes

This closes the gap between raw field support and Airtable-grade field maturity.

---

## 4.4 Records and record operations

### Why this area matters

Rows are not enough.
In both Airtable and Coda, the record becomes a richer work object.

### Missing capabilities

- `P0 critical`: record detail must become a true record workspace, not only a detail modal
- `P0 critical`: stronger relation traversal from a record into related records and related tables
- `P0 critical`: computed-field explanation directly inside record work
- `P1 important`: embedded related views and summaries in record detail
- `P1 important`: stronger comments/activity/audit integration in the same record workspace
- `P1 important`: richer attachment behavior and provenance visibility for imported values
- `P2 enrichment`: record page templates by table type or workflow role

### What this closes

This closes the gap between spreadsheet-like row work and a richer relational object model.

---

## 4.5 Views and query discipline

### Why this area matters

Saved views are the main operational layer in Airtable-class systems.

### Missing capabilities

- `P0 critical`: fully frozen saved-view object model
- `P0 critical`: clear rules for what belongs to a table versus what belongs to a view
- `P0 critical`: clearer persistence of filters, sorts, grouping, hidden fields, layout, and view metadata
- `P1 important`: stronger view sharing and role-specific visibility rules
- `P1 important`: stronger operational cues such as status/footer aggregates and summary surfaces
- `P1 important`: explicit pinned/default views per role or use case
- `P2 enrichment`: richer personal-vs-shared view semantics and diagnostics for large datasets

### What this closes

This closes the gap between "many layouts exist" and "views behave like durable, trustworthy work surfaces."

---

## 4.6 Relational modeling and explainability

### Why this area matters

Consultify already has relation primitives.
What is still missing is a product experience where relation logic feels native and explainable.

### Missing capabilities

- `P0 critical`: clearer linked-record browsing and selection UX
- `P0 critical`: reverse-relation semantics that are visible and understandable
- `P0 critical`: explainable lookup path and rollup source logic
- `P0 critical`: stronger cross-table navigation model
- `P1 important`: relation health checks for broken, empty, cyclic, or suspicious structures
- `P1 important`: relation summaries and quick insights over connected records
- `P2 enrichment`: lightweight relation map or structure explorer for complex bases

### What this closes

This closes the gap between technical relation support and real relational trust.

---

## 4.7 Planning logic and dependency behavior

### Why this area matters

Tables often need to model plans, dates, predecessors, and operational dependencies.

### Missing capabilities

- `P0 critical`: full productization of date dependency logic as a planning layer, not just a configuration screen
- `P0 critical`: dependency-aware timeline/gantt behavior that responds to relational truth
- `P1 important`: conflict detection and repair guidance for schedule issues
- `P1 important`: stronger duration/lag/working-day semantics
- `P2 enrichment`: scenario comparison for plan changes and dependency alternatives

### What this closes

This closes the gap between table-as-data and table-as-plan.

---

## 4.8 Forms as input products

### Why this area matters

The table system must not only store data.
It must also accept controlled input from users who are not operators of the base.

### Missing capabilities

- `P0 critical`: forms must be treated as full first-class assets, not secondary tooling
- `P0 critical`: explicit forms index, form ownership, publish state, and lifecycle
- `P0 critical`: form-to-table schema truth must be fully guaranteed
- `P1 important`: richer post-submit behaviors and intake routing options
- `P1 important`: stronger internal vs public form publishing semantics
- `P1 important`: clearer authentication, access, and reuse rules
- `P2 enrichment`: richer branded form presets and template sets

### What this closes

This closes the gap between form runtime seams and a fully trustworthy intake layer.

---

## 4.9 Interfaces as audience-specific apps

### Why this area matters

Many users should consume relational truth through a curated application shell rather than through the grid.

### Missing capabilities

- `P0 critical`: interfaces must become a clearly separate product surface above the same source of truth
- `P0 critical`: persistent interfaces index and lifecycle model
- `P0 critical`: strong contract between interface, table, view, and record
- `P1 important`: role-based interface templates and guided interface assembly
- `P1 important`: clearer publishing and consumption modes
- `P1 important`: embedded metrics, charts, filters, and record detail flows as standardized interface blocks
- `P2 enrichment`: richer audience-specific interface kits for operator, manager, stakeholder, and submitter roles

### What this closes

This closes the gap between a promising interface designer and a true app layer.

---

## 4.10 AI builder and AI table copilot

### Why this area matters

The user should be able to describe what the table system is for, not manually engineer everything from scratch.

### Missing capabilities

- `P0 critical`: one obvious AI-first creation entry point
- `P0 critical`: `describe -> propose -> review -> approve -> build` must be the canonical creation and refinement flow
- `P0 critical`: AI should propose not only fields, but also:
  - tables
  - views
  - sample data
  - interfaces
  - forms
- `P0 critical`: plan and schema diff preview must be explicit before mutation
- `P1 important`: richer rationale for why each table, field, and view was suggested
- `P1 important`: domain-specific schema starters and AI refinement loops
- `P2 enrichment`: stronger split-screen co-building mode between AI and data surface

### What this closes

This closes the gap between current schema proposals and a fully convincing Airtable Omni-class front door adapted to Consultify.

---

## 4.11 Templates and accelerators

### Why this area matters

Users want to start from a useful operational model, not from emptiness.

### Missing capabilities

- `P0 critical`: templates for relational systems, not just rows or cosmetic presets
- `P1 important`: bundles combining schema + views + interfaces + forms for common table jobs
- `P1 important`: AI-assisted template selection from the user's stated goal
- `P2 enrichment`: organization-specific template libraries and governed presets

### What this closes

This closes the gap between generic building blocks and fast, confident starts.

---

## 4.12 Input, import, and external data ingestion

### Why this area matters

This is one of the most important missing areas to state explicitly.

If the table system can only be built manually, it is incomplete.
It must also be able to be fed by:

- controlled imports
- recurring sync
- external connectors
- internal system data

### Missing capabilities

- `P0 critical`: one canonical input model showing all supported ingestion paths
- `P0 critical`: explicit distinction between:
  - one-time import
  - recurring sync
  - form submission
  - API ingestion
  - internal-app projection
- `P0 critical`: source-to-table mapping review before import/sync activation
- `P0 critical`: provenance visibility showing where data came from
- `P1 important`: import-quality checks for type mismatch, empty values, duplicates, and relation mapping errors
- `P1 important`: refresh/failure diagnostics for recurring ingestion
- `P1 important`: reconciliation rules when external structure changes
- `P1 important`: safer merge/update strategies for imported rows
- `P2 enrichment`: reusable import presets by source type and use case

### What this closes

This closes the gap between "we can create tables" and "we can also keep them alive with trusted data from other sources."

---

## 4.13 Sync and connector operating model

### Why this area matters

Feeding the table with external data is not the same as having a coherent sync product.

### Missing capabilities

- `P0 critical`: clear product split between connectors, imports, sync, and automations
- `P0 critical`: sync manager as one dedicated control surface
- `P1 important`: health/status model for each data feed
- `P1 important`: run history and troubleshooting flow
- `P1 important`: ownership and policy model for who can create or edit data feeds
- `P2 enrichment`: richer sync templates and recommended connector playbooks

### What this closes

This closes the gap between technical connector seams and a trustworthy data-ingestion operating layer.

---

## 4.14 Sharing, publishing, and permissions

### Why this area matters

Relational truth is only useful if the right people can use the right surfaces safely.

### Missing capabilities

- `P0 critical`: sharper split between base permissions, table permissions, view visibility, form access, and interface access
- `P0 critical`: clearer publishing semantics for public, internal, and invited audiences
- `P1 important`: object-level access explanations
- `P1 important`: stronger permission previews before publishing or sharing
- `P2 enrichment`: richer collaboration patterns over shared views and interfaces

### What this closes

This closes the gap between raw sharing capabilities and enterprise-safe relational work.

---

## 4.15 Governance, audit, and lineage

### Why this area matters

Consultify should be stronger than Airtable here, not weaker.

### Missing capabilities

- `P0 critical`: one consistent governance story for schema changes, data provenance, and AI proposals
- `P0 critical`: lineage surfacing for imported and transformed values
- `P1 important`: stronger audit readability at schema, view, and record levels
- `P1 important`: governed model visibility where tables feed higher-order analytical or decision objects
- `P2 enrichment`: richer compliance/reporting views for operators and admins

### What this closes

This closes the gap between strong backend ambitions and visible business trust.

---

## 4.16 Analytics, summaries, and decision support

### Why this area matters

Consultify should not end at data coordination.
It should turn table truth into decision support.

### Missing capabilities

- `P0 critical`: stronger first-class summary and scoring surfaces over live data
- `P1 important`: clearer path from table -> insight -> recommendation -> execution
- `P1 important`: standardized KPI and summary blocks for interfaces and record pages
- `P2 enrichment`: richer analytical narratives and governed insight cards over table states

### What this closes

This closes the gap between operational data and actual business decision support.

---

## 4.17 Docs-plus-data composition

### Why this area matters

This is the main Coda lesson.
Some work requires context, explanation, and workflow around the data.

### Missing capabilities

- `P0 critical`: one clear model for embedding table truth in richer contextual surfaces
- `P0 critical`: support for summaries, narrative blocks, notes, and commentary around data without duplicating truth
- `P1 important`: stronger embedding into ideas, notes, initiatives, process outputs, and decision artifacts
- `P2 enrichment`: richer document-like compositions for stakeholder-facing data experiences

### What this closes

This closes the gap between a pure table app and a broader work-composition system.

---

## 4.18 Search, retrieval, and discovery

### Why this area matters

Large table systems become unusable if users cannot find the right data objects quickly.

### Missing capabilities

- `P0 critical`: first-class discovery across base, table, field, view, record, form, and interface
- `P1 important`: stronger context-aware search and jump behavior
- `P1 important`: discovery support for related records and imported-data provenance
- `P2 enrichment`: richer saved search or diagnostic discovery workflows

### What this closes

This closes the gap between broad capability and day-to-day usability at scale.

---

## 4.19 Operational quality and product polish

### Why this area matters

Users often judge maturity through shell discipline and trust cues more than through raw feature count.

### Missing capabilities

- `P0 critical`: clean shell discipline with lower cognitive load
- `P1 important`: stronger status/footer/aggregate cues
- `P1 important`: clearer loading/error/empty-state grammar
- `P1 important`: stronger lifecycle cues for published forms, interfaces, syncs, and AI proposals
- `P2 enrichment`: higher polish for performance, large-table ergonomics, and responsive role-specific consumption

### What this closes

This closes the gap between "rich but heavy" and "rich but obvious."

---

## 5. Cross-cutting missing contracts still required

Some missing capabilities are not one-surface concerns.

The most important cross-cutting contracts still required are:

- `P0 critical`: one canonical object model connecting base, table, field, view, record, form, interface, connector, and proposal
- `P0 critical`: one input and ingestion grammar across manual creation, imports, forms, APIs, and sync
- `P0 critical`: one governance grammar across schema changes, AI proposals, lineage, and publishing
- `P1 important`: one diagnostics grammar across data freshness, import health, sync health, and object validity
- `P1 important`: one completion grammar for when a table system is ready to be promoted from exploratory use to operational use

---

## 6. Hard bottom line

If we want to say that `Table` is fully complete, then not only the schema and views must be strong.

The following must all be true at once:

- users can create tables from intent
- users can model relations safely
- users can expose the same truth through views, forms, and interfaces
- users can feed tables with trusted data from internal and external sources
- users can understand provenance and health of the incoming data
- users can use the data for decision support, not only storage

Today, the package is strong and honest.
What remains is to close the missing capabilities above with the same level of discipline.

---

## 7. Relationship to the rest of the package

Use this document together with:

- `TABLE_V8_READINESS_AUDIT.md`
- `TABLE_V8_SSOT.md`
- `TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md`

Reading order:

1. `TABLE_V8_READINESS_AUDIT.md`
2. `TABLE_V8_SSOT.md`
3. `TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md`
4. `TABLE_MISSING_CAPABILITIES_MATRIX_V8.md`

---

## 8. Acceptance criteria

This document is successful only if:

- no major Airtable/Coda-class missing area remains implicit
- input/import/sync/connector gaps are named explicitly
- the user can understand exactly what is still missing before claiming table completeness
- future implementation waves can be planned directly from this matrix

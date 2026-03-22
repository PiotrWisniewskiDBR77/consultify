# Table Relational Schema And Docs Workflow v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: specialize the `Table v8` package around relational schema excellence, explainable linked data, and Coda-class docs-plus-data workflow composition

---

## 1. Why this companion document exists

The main `Table` SSOT defines the product.

This companion document exists because two benchmark strengths need extra precision:

- Airtable-grade relational schema and field governance
- Coda-grade docs-plus-data workflow composition

Without freezing these two areas more explicitly, `Table` risks remaining technically broad but product-fragmented.

---

## 2. Airtable lesson we must import

The biggest Airtable lesson is:

`schema is not backend plumbing; schema is a user-facing product surface`

This means:

- fields are first-class
- dependencies matter
- primary field matters
- linked records, lookup, rollup, and formulas are visible work semantics
- schema changes affect views, records, forms, interfaces, and AI behavior

---

## 3. Coda lesson we must import

The biggest Coda lesson is:

`tables become more powerful when they live inside richer contextual surfaces instead of standing alone as raw grids`

This means:

- text and workflow context matter
- summary and narrative blocks matter
- users should be able to operate on the same data through multiple contextual surfaces

Consultify does not need to become a copy of Coda.
But it should adopt this composition strength where it helps real work.

---

## 4. What we already have in Consultify

The current runtime already gives us promising foundations:

- broad field model in `tableTypes.ts`
- field editing via `useTableSchema` and field-management surfaces
- linked record and cross-table relation seams
- record expand and nested linked-record display
- date dependency configuration
- form builder with conditional visibility and publish logic
- interface designer with blocks for grid, detail, chart, text, filter, search, summary

Important:

These are strong building blocks.
The problem is not absence.
The problem is that the final product contract is still under-frozen.

---

## 5. Relational schema doctrine

The schema layer must support 6 truths:

### 5.1 Field is product truth

Each field must carry:

- type
- label
- description
- options
- dependency metadata
- permission semantics where relevant
- relation semantics where relevant

### 5.2 Primary field is identity truth

The primary field must be explicit and meaningful, not a hidden technical artifact.

### 5.3 Relation is semantic, not decorative

A relation must behave as:

- linked source of truth
- navigable edge between records/tables
- usable input for lookup, rollup, and formula logic

### 5.4 Computed fields must be explainable

For `formula`, `lookup`, `rollup`, and similar fields, users must be able to understand:

- what is computed
- from where
- by what rule

### 5.5 Dependency-aware change safety

Before changing or deleting a field, the system should surface impact on:

- formulas
- rollups
- forms
- interfaces
- saved views

### 5.6 Schema mutation is governed work

Schema edits should not feel like random toolbar events.
They should feel like intentional product-grade mutations.

---

## 6. Missing relational additions still required

The most important missing relational additions are:

1. stronger base-level schema shell
2. clearer field dependency map
3. better relation-path explanation
4. clearer reverse-link semantics
5. stronger cross-table rollup and lookup explanation
6. better schema-change diff and impact preview
7. more explicit primary-field and identity model

---

## 7. Docs-plus-data doctrine

Consultify should support richer table work through contextual surfaces.

This means:

- a table may remain the source of truth
- but work around it may include:
  - notes
  - summary blocks
  - KPI surfaces
  - record detail narratives
  - decision support panels
  - embedded views

Canonical rule:

`Tables should support context around data without creating a second source of truth beside the data.`

---

## 8. Where docs-plus-data should appear

This composition should appear mainly in:

### 8.1 Record detail

Record detail should feel like:

- structured data
- plus operational context
- plus related records
- plus commentary and audit

### 8.2 Interfaces

Interfaces should become the main curated docs-plus-data shell for:

- managers
- stakeholders
- submitters
- reviewers

### 8.3 Cross-artifact embedding

Table views and summaries should embed naturally into:

- ideas
- notes
- initiatives
- process outputs

---

## 9. Missing docs-plus-data additions still required

The most important missing additions are:

1. richer record page composition
2. embedded related views in record detail
3. stronger summary and narrative blocks over the data
4. clearer split between table work and interface work
5. stronger contextual table embedding into other Consultify artifacts

---

## 10. Final precision list versus current Consultify reality

Compared to what we already have, the most important product changes are:

### 10.1 What to strengthen, not reinvent

- existing field system
- existing linked-record and rollup base
- existing forms and interfaces
- existing schema proposal pipeline
- existing record detail and audit capabilities

### 10.2 What to explicitly upgrade

- `useTableSchema` and field manager into a true schema hub
- relation UX into a first-class navigation model
- `RecordExpandModal` into a record workspace, not only a modal
- `InterfaceDesigner` into a role-based app layer, not only a block canvas
- `FormBuilder` into a stronger productized input surface
- date dependency semantics into a broader operational dependency model

---

## 11. Explicit scope cutline

This companion document still excludes communication automation such as:

- outbound report sending
- message broadcasting
- email-delivery automation

The focus remains on:

- schema quality
- relational truth
- work surfaces over the same data

---

## 12. Acceptance criteria

This document is satisfied only when:

- schema work feels central and intentional
- linked records and rollups are explainable
- record detail behaves like a richer data workspace
- interfaces and forms become clearly differentiated product layers
- docs-plus-data composition appears without duplicating the source of truth

---

## 13. Related canonical docs

- `TABLE_V8_SSOT.md`
- `TABLE_V8_READINESS_AUDIT.md`
- `IDEA_WORKSPACE_V5_SSOT.md`

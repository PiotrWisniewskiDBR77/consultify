# Idea Workspace V5 Final SSOT

> **Status:** PROPOSED CANONICAL TARGET
> **Date:** 2026-03-10
> **Owner:** Product / Platform / CTO
> **Scope:** `My Work -> Idea Workspace -> Table system inside the 4-system workspace`
> **Purpose:** define the final product truth for `Idea Workspace` with `Table OS` as the strongest structured-thinking system in the workspace.

> **Important:** this document does not replace the `Idea Workspace` product thesis from `docs/product/IDEA_WORKSPACE_V5_SSOT.md`.
> It finalizes and operationalizes the target state for the table system so implementation, gap analysis, and rollout can work from one explicit end state.

---

## 0) Canonical references

Internal:
- `docs/product/IDEA_WORKSPACE_V5_SSOT.md`
- `docs/product/IDEA_WORKSPACE_V5_1_IMPLEMENTATION_PROGRAM.md`
- `docs/product/IDEA_WORKSPACE_V5_REMEDIATION_PLAN.md`
- `docs/product/IDEA_WORKSPACE_V5_FAILURE_INVENTORY_2026-03-09.md`
- `docs/ui-standards/FROZEN_LAYOUTS.md`
- `docs/ui-standards/03-modules/app-table-standard.md`
- `docs/ui-standards/03-modules/table-preview-pane-standard.md`
- `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`

External benchmark sources:
- [Airtable field types overview](https://support.airtable.com/docs/supported-field-types-in-airtable-overview)
- [Airtable fields overview](https://support.airtable.com/docs/en/fields-overview)
- [Airtable interface form layout](https://support.airtable.com/docs/airtable-interface-layout-form)
- [Notion database properties](https://www.notion.so/help/database-properties)
- [Notion relations and rollups](https://www.notion.com/en-gb/help/relations-and-rollups)
- [Notion working with databases](https://developers.notion.com/docs/working-with-databases)

---

## 1) Final product statement

`Idea Workspace V5` is one living problem-solving workspace.

Inside that workspace, `Table OS` is the structured-thinking engine for:
- comparison
- prioritization
- scenario analysis
- decision support
- work modeling
- synthesis from messy evidence into operational structure

This module must feel as powerful as Airtable in data operations, as editable as Notion in day-to-day modeling, and more valuable than both because it is natively linked to the rest of Consultify.

## 1.1 Core promise

> Tell the system what you need, let AI build the first trustworthy structure, and then refine it manually without friction until it becomes execution-ready.

## 1.2 Why we win

We do not win by cloning Airtable or Notion.

We win by combining:
- Airtable-style operational structure and multi-view work
- Notion-style manual flexibility and record-page editing
- Consultify-native context, backlinks, artifact linking, and conversion to platform outputs

---

## 2) Product thesis

`Table OS` is not a generic CRUD table.

It is a workspace-native operating layer where a user can:
- start from a prompt, note, transcript, or artifact
- generate a usable schema
- review and adjust properties manually
- switch between multiple views of the same truth
- open any row as a richer record page
- link rows to evidence, outputs, and other workspace objects
- convert structured work into decisions, tasks, initiatives, reports, and presentations

## 2.1 Product identity

`Table OS` is:
- part of `Idea Workspace`, not a separate module
- one of the 4 native systems of work
- the most structured system in the workspace
- optimized for `analysis -> synthesis -> action`

`Table OS` is not:
- a spreadsheet clone
- a full automation platform in this phase
- a detached admin database builder
- a separate product with its own navigation model

---

## 3) Non-negotiables

- One idea = one workspace.
- `Table OS` stays inside the existing `Idea Workspace`.
- `Tools | Context | AI Suggestions` remains the only right-side workspace strip.
- View order must remain `table -> kanban -> timeline -> calendar -> matrix -> grid`.
- There is exactly one command row under the topbar.
- `App Table + Preview Pane` rules remain canonical.
- AI never writes silently.
- All material AI actions follow `propose -> preview -> accept/reject`.
- Manual editing must be first-class, not a fallback.
- No automations program is included in this phase of the product.

---

## 4) Benchmark synthesis

## 4.1 Airtable lessons to adopt

From Airtable we adopt:
- fields as the core contract of the table
- multiple views over one data model
- interfaces/forms as evidence that data should support multiple interaction surfaces
- strong relation mindset
- system behavior where structure comes first and operations derive from that structure

What we do **not** adopt in this phase:
- full automation builder parity
- separate admin-style base management as a detached product
- standalone interface-builder complexity that breaks `Idea Workspace`

## 4.2 Notion lessons to adopt

From Notion we adopt:
- every row can behave like a richer page
- properties are editable and re-orderable by the user
- layout and visibility can be tuned without deep technical setup
- relations and rollups are essential for real knowledge work
- manual reconfiguration must stay lightweight and forgiving

What we do **not** adopt:
- document-first sprawl that dissolves the `Idea Workspace` system boundaries
- unconstrained layout freedom that breaks our table and preview standards

## 4.3 Consultify-native additions

Consultify must go beyond both tools through:
- linked artifacts from other modules
- backlink surfaces in context
- AI that is grounded in company and workspace context
- conversion into platform-native outputs
- preserved traceability from idea to execution artifact

---

## 5) Canonical operating model

`Table OS` must support two equally valid entry modes.

## 5.1 AI-first mode

User flow:
1. User states need in natural language.
2. System proposes table purpose, schema, starter views, starter rows, and linked context.
3. User reviews proposal as a structured preview.
4. User accepts all, accepts parts, or rejects.
5. User refines manually.

Typical prompts:
- build a decision matrix from these artifacts
- compare 6 vendors and propose a scoring model
- turn this interview summary into an action table
- create a risk register from this workshop output

## 5.2 Manual-first mode

User flow:
1. User starts from empty state or template.
2. User adds properties, widths, relations, views, filters, and groups manually.
3. User edits rows inline or through record pages.
4. User uses AI later only where it adds value.

Manual-first is mandatory because expert users must be able to shape the model directly.

## 5.3 Trust rule

AI may accelerate structure.
AI may not replace user control over structure.

The system must never trap the user inside AI-generated scaffolding they cannot easily modify.

---

## 6) Canonical surfaces inside Table OS

## 6.1 Table canvas

Primary dense working surface for:
- scanning
- editing
- bulk actions
- sorting
- filtering
- grouping
- selecting

## 6.2 Views layer

Same underlying records, different working modes:
- `table`
- `kanban`
- `timeline`
- `calendar`
- `matrix`
- `grid`

Each view must represent the same source of truth, not duplicate data.

## 6.3 Record page

Every row must open into a richer record page with:
- title and core properties
- body/notes
- linked evidence and attachments
- comments and activity
- relations to other rows and workspace objects
- AI insights and suggested next steps
- convert actions

This is the Notion-like depth layer inside our table system.

## 6.4 Properties system

Users must be able to:
- add properties
- rename properties
- reorder properties
- hide/show properties per view
- resize columns
- define select options
- manage property formulas and derived values
- configure relations and rollups

## 6.5 AI builder and copilot

AI should support:
- schema proposal
- view proposal
- starter row generation
- row enrichment
- summarization
- comparison
- scoring suggestions
- next-step recommendations

## 6.6 Context and linking layer

Rows and tables can link to:
- workspace nodes
- notes
- interview outputs
- files
- reports
- presentations
- initiatives
- decisions
- tasks

## 6.7 Convert and export layer

Structured work may convert into:
- decision
- task set
- initiative
- report
- presentation
- action plan
- RAID log

Exports may include:
- CSV
- structured copy/share payloads
- downstream render/export handoff

---

## 7) Canonical user journeys

## 7.1 Prompt-to-table

`prompt -> proposal -> accept -> refine -> save -> view switch -> convert`

This is the flagship experience.

## 7.2 Artifact-to-table

`attach/link artifacts -> extract structure -> propose fields and rows -> user accepts -> row pages keep source links`

This is the flagship differentiation path versus standalone tools.

## 7.3 Template-to-table

`choose template -> load trusted starter schema -> edit manually -> enrich with AI`

## 7.4 Empty-table expert flow

`start empty -> add properties -> add records -> configure views -> use filters/groups -> open preview/detail -> convert`

---

## 8) Target capability set

## 8.1 Property types

Minimum target property set:
- text
- long text / notes
- number
- currency
- percent / progress
- select
- multi-select
- status
- date
- person / owner
- checkbox
- URL
- email
- phone
- files / attachments
- formula
- relation
- rollup
- AI-generated / suggested field
- created time / created by
- last edited time / last edited by

Important:
- current implementation already supports many types
- target parity requires stronger semantics, not only type names

## 8.2 View system

Every view must support its own configuration while preserving one data model.

Minimum per-view configuration:
- visible properties
- sort state
- filter state
- grouping
- layout-specific options
- saved personal or workspace view definitions

## 8.3 Filtering, sorting, grouping

Must support:
- multi-filter groups
- AND / OR logic
- multi-sort
- persisted saved views
- quick ad hoc filters
- trustworthy empty states and counts

## 8.4 Record page behavior

Single click:
- selects row
- opens preview according to table-preview canon

Double click or Enter:
- opens full record page

Escape:
- closes preview/detail according to canon

## 8.5 Relations and rollups

Relations must support:
- row-to-row links inside the same table
- row-to-object links across the workspace
- optional mirrored/backlinked behavior where relevant

Rollups must support:
- aggregate from related records
- summarize related values for analysis and decision support

## 8.6 Templates

Mandatory trusted starters:
- decision matrix
- assumptions log
- action plan
- risk register
- initiative comparison
- stakeholder map table
- experiment tracker
- simplified financial table

## 8.7 AI governance

AI outputs must expose:
- rationale
- confidence
- source hint or context hint
- preview diff or proposal block
- accept all
- accept selected parts
- reject
- auditability

---

## 9) UX invariants

## 9.1 Frozen layout compliance

`Table OS` must obey:
- `FROZEN_LAYOUTS`
- `app-table-standard`
- `table-preview-pane-standard`

This means:
- no extra toolbar rows
- no custom 4th button in the right strip
- no custom view order
- no alternate preview anatomy

## 9.2 Workspace integrity

The 4 native systems remain:
- mind map
- whiteboard
- process flow
- table

`Table OS` must become stronger without breaking that system balance.

## 9.3 Chrome philosophy

Chrome stays quiet.
Value appears in the working content:
- meaningful properties
- meaningful records
- visible linked context
- confident but controlled AI assistance

---

## 10) Data model direction

## 10.1 Near-term rule

Use `extensions.table` as the evolution path for:
- columns/property definitions
- saved views
- view state
- formatting
- layout preferences

This is valid while table behavior remains a workspace-native subsystem.

## 10.2 When to extend the contract

Extend the contract, rather than rewrite it, when adding:
- stronger field metadata
- status semantics
- system-managed properties
- view-scoped visibility
- relation metadata
- rollup configuration

## 10.3 When a deeper refactor becomes justified

Introduce a more explicit `Table OS` contract only if one or more become necessary:
- clear separation of table records from generic graph nodes
- relation graph behavior too complex for current generic node model
- query/view persistence outgrows current `extensions.table` structure
- performance and ownership problems make the current monolith unsafe

Default rule:
- evolve first
- rewrite only when current structure blocks trust, clarity, or scale

---

## 11) Technical direction

## 11.1 Workspace shell contract

`IdeaMapWorkspace` remains the shell that owns:
- active system
- active right-side panel
- workspace-level context and AI surfaces

`Table OS` remains mounted as the table-native runtime inside that shell.

## 11.2 Table runtime direction

The runtime should be decomposed into clearer domains:
- schema/property management
- views and saved-view state
- row selection and bulk actions
- record page
- AI proposal layer
- import/export and conversion
- persistence adapter

## 11.3 Anti-monolith rule

`IdeaTableTool.tsx` may remain an orchestration surface.
It should not remain the long-term home for most domain logic.

---

## 12) Out of scope for this phase

- standalone automations builder
- public Airtable-style base administration
- custom interface designer parity
- real-time collaboration redesign beyond what the existing workspace plan already covers
- spreadsheet-grade formula engine parity
- fully separate table module outside `Idea Workspace`

---

## 13) Success criteria

`Table OS` is successful when:
- a user can start from prompt or empty state and reach a trustworthy working table fast
- manual editing feels natural, not secondary
- views are real operational modes, not visual placeholders
- preview and record pages feel coherent and information-rich
- linked artifacts make the table visibly more powerful than standalone competitors
- conversion to execution artifacts is trustworthy
- AI accelerates work without reducing user control

## 13.1 Definition of done for go-live quality

The module is not done because UI exists.

It is done only when:
- the visible path works end-to-end
- save/reload preserves behavior
- the table is useful before advanced polish
- partial views are either completed or explicitly downgraded
- QA validates runtime behavior, not only code presence

---

## 14) Final positioning statement

`Idea Workspace Table OS` is the premium structured-thinking core of Consultify:
- AI-native at the start
- manual-first in control
- deeply linked to company context
- traceable into execution

That combination is the product to build.

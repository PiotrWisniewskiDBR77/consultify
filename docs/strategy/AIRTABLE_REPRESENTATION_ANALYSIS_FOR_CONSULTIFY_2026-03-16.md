# Airtable Representation Analysis For Consultify

**Date:** 2026-03-16  
**Prepared from:** `knowledge/AirTable/Archive.zip` + `knowledge/AirTable/Screen.zip` + current Consultify codebase audit  
**Purpose:** Define how Airtable should be represented in Consultify based on real product evidence, not assumptions.

---

## Executive Summary

The analysis of the full Airtable support archive and more than 100 product screenshots leads to one hard conclusion:

**Airtable is not a table app.**

Airtable is a multi-layer operating system for business workflows built from:

1. **Relational structured data**
2. **Multiple views over the same data**
3. **Interfaces and forms for different audiences**
4. **Automations and sync as workflow infrastructure**
5. **AI as an orchestration and acceleration layer**
6. **Governance, permissions, sharing, and enterprise controls**

The current Consultify Table Platform is strongest in backend service coverage and weakest in:

- real deployment/runtime wiring
- coherent user experience
- multi-table base navigation
- AI-led app creation flow
- schema management UX
- date dependencies / project planning behavior
- interface/form/product shell parity

This means we should **stop thinking in terms of "replicating Airtable tables"** and instead represent Airtable in Consultify as a **five-surface product system**:

1. **AI Build Surface**
2. **Base / Data Surface**
3. **Schema / Tools Surface**
4. **Apps Surface** (`Interfaces` + `Forms`)
5. **Workflow Surface** (`Automations` + `Sync` + `Sharing`)

---

## 1. Source Base Used

### 1.1 Documentation archive

`knowledge/AirTable/Archive.zip` contains a large mirror of `support.airtable.com`, including approximately:

- field type overview
- formulas and formula reference
- views and layouts
- interfaces
- forms
- automations
- sync and two-way sync
- record templates
- permissions and sharing
- APIs, webhooks, PATs, service accounts
- AI / Omni / field agents
- insights
- enterprise admin and governance
- date dependencies

### 1.2 Screenshot archive

`knowledge/AirTable/Screen.zip` contains about 130 real screenshots grouped by product area:

- `1-7`: onboarding, Omni/chat, build flow, split-screen work modes
- `8`: multi-table navigation and sync list
- `9`: tools and manage fields
- `11`: field type configuration
- `12`: record templates
- `13`: date dependencies
- `14`: interfaces
- `15`: forms

These screenshots are more important than marketing copy because they show the **actual product shell, sequencing, and operator workflow**.

---

## 2. What Airtable Actually Is

### 2.1 Airtable is a five-surface product

From the archive and screenshots, Airtable should be understood as five coordinated surfaces:

#### Surface A: AI Build Surface

Observed in screenshots `1-7` and Omni docs.

Behavior:

- user describes what they need in natural language
- AI proposes an app/data structure
- AI asks for confirmation
- AI builds tables
- AI may generate seed data
- AI may generate automations
- user can continue iterating in chat
- work happens in split or full-screen mode

This is not "AI helper inside a table".  
This is a **front door** to the product.

#### Surface B: Base / Data Surface

Observed in screenshots `5d`, `7`, `8`, and view docs.

Behavior:

- one base contains multiple tables
- tables are top-level tabs
- same data is viewed through different saved views
- table shell includes filters, grouping, sorting, hiding fields, color, share/sync
- bottom status area shows record counts and aggregates

This is not a spreadsheet clone.  
It is a **relational operational workspace**.

#### Surface C: Schema / Tools Surface

Observed in screenshot group `9` and field docs.

Behavior:

- fields are managed in a dedicated field manager
- every field has type, settings, description, permissions, and dependency metadata
- fields can affect views, interfaces, and formulas
- date dependencies and record templates are surfaced from `Tools`
- schema is a first-class operating surface, not a hidden developer concern

This is one of Airtable's real strengths.

#### Surface D: Apps Surface

Observed in screenshot groups `14` and `15`, plus interface/form docs.

Behavior:

- same base can expose multiple custom interfaces
- interfaces are curated, audience-specific application shells
- forms are dedicated input products, not just table sub-features
- interfaces include dashboards, record drill-downs, charts, filters, actions

This is how Airtable becomes usable for non-operators.

#### Surface E: Workflow Surface

Observed in screenshot `5c`, sync docs, automation docs, sharing docs.

Behavior:

- sync pulls data into the base
- automations react to changes
- webhooks and external integrations connect to other systems
- sharing exposes views, forms, and interfaces
- permissions control who can change schema vs data vs presentation

This is what turns the product into a real system of work.

---

## 3. High-Signal Product Truths From The Evidence

### 3.1 Omni is the product entry point, not a side feature

Screenshots `1-5` show that Airtable's newest mental model is:

`describe the work -> confirm the design -> build the app`

Implication for Consultify:

- AI table creation cannot remain a hidden modal or secondary button
- it must become a primary creation path
- AI should produce more than schema:
  - table structure
  - sample records
  - views
  - interfaces/forms
  - automations

### 3.2 Field types are a massive product surface

The screenshot group `11 Field type` is the largest group in the archive.
That is a strong signal that Airtable's differentiation is heavily tied to **field semantics**, not just record CRUD.

Observed examples:

- AI-enabled fields
- number formatting and decimal precision
- duration configuration
- rollup configuration
- last modified time
- button actions with multiple action targets
- selection/multi-selection conversion

Implication for Consultify:

- field types need to be treated as mini-products
- field setup UX matters as much as grid UX
- our field manager must be a serious dedicated workspace

### 3.3 Manage Fields is a product hub

The screenshot group `9 tools - manage fields` shows Airtable exposes:

- list of fields
- field type
- description
- field permissions
- dependencies
- per-field actions
- primary field control
- show dependencies
- field editing permissions filters
- relationships to interfaces and other objects

Implication for Consultify:

- our current many-button toolbar is the wrong abstraction
- we need a focused schema management surface
- schema metadata must be inspectable at a glance

### 3.4 Interfaces are not optional polish

The screenshot group `14 Interfaces` shows a full app-builder layer:

- navigation at left
- pages/modules
- KPI cards
- charts
- filters
- modal drill-downs
- publishing
- page settings
- export and print allowances

Implication for Consultify:

- `InterfaceDesigner` cannot remain an empty overlay
- interfaces are a second front-end built on top of the base
- this surface is mandatory if we want parity with real Airtable usage

### 3.5 Forms are a standalone surface

The screenshot group `15 Forms` shows:

- a forms index
- dedicated form editing surface
- title, source, fields visibility
- appearance settings
- submission options
- redirect and post-submit behavior
- publish controls

Implication for Consultify:

- forms must be represented as first-class app assets
- current `FormBuilder` must persist to backend and appear in a forms index

### 3.6 Date dependencies are bigger than a single field type

The screenshots and Airtable article show:

- selecting table, start, end, duration, predecessor fields
- business logic modes
- optional weekend/holiday handling
- interaction with timeline/gantt views
- dependent rescheduling behavior

Implication for Consultify:

- date dependencies require:
  - table-level config
  - execution engine
  - timeline/gantt integration
  - validation and conflict repair UX
- this is not just `duration + linked record`

### 3.7 Airtable's shell is intentionally clean

From screenshots `7-10`:

- top bar is narrow and focused
- tools collapse into menus
- multi-table navigation is obvious
- views are prominent
- secondary complexity is pushed into drawers and managers

Implication for Consultify:

- our current `IdeaTableTool` toolbar is overcrowded
- feature richness without shell discipline makes the product feel less capable, not more

---

## 4. Current Consultify Reality Versus Airtable

### 4.1 What Consultify already has in principle

From current codebase audit:

- strong metadata-first backend design
- records CRUD and batch operations
- linked records, rollups, formulas, attachments
- forms backend
- interfaces backend
- automations backend
- permissions backend
- sync-related building blocks
- sharing building blocks
- AI schema proposal pipeline
- templates, webhook relays, distribution, PWA features

### 4.2 What is still structurally missing

#### A. Runtime / deployment truth

- migration runner is missing
- new table platform is not safely deployed
- fallback to legacy is not reliable

#### B. Product shell truth

- no true base-first multi-table shell
- no clean tools menu
- no proper schema manager experience
- no status bar / footer aggregates / row-number shell

#### C. AI truth

- current AI creates schema proposals, not full operational apps
- no guaranteed plan -> build -> seed -> automate flow
- no dedicated Omni entry point

#### D. Presentation truth

- interfaces exist in concept but are not represented as a real product surface
- forms exist but are not represented as a real product surface

#### E. Planning truth

- no date dependency system
- no record templates
- no dependency-aware timeline behavior

---

## 5. Representation Model For Consultify

The goal should **not** be "clone every Airtable screen."

The goal should be:

> Represent Airtable's operational model inside Consultify in a way that matches Consultify's purpose: helping people make and execute business decisions.

That means the right representation is:

### Layer 1: Consultify AI Builder

Equivalent to Airtable Omni, but adapted to Consultify.

Should do:

- intake user goal in natural language
- ask for business context
- propose base structure
- propose tables and fields
- propose views
- propose interfaces
- propose forms
- propose automations
- generate realistic seed data
- optionally generate first report/insight artifact

In Consultify this should be represented as:

- a top-level creation flow, not a secondary toolbar button
- multi-step but fast
- explicit and reviewable, not magical

### Layer 2: Base Workspace

Equivalent to Airtable base shell.

Should include:

- multi-table tabs
- view switcher
- filter/group/sort/hide/share/sync shell
- bottom status bar
- add table flow
- clean toolbar discipline

This should replace the current overloaded table toolbar.

### Layer 3: Schema Operations Surface

Equivalent to Airtable `Manage fields` + tools.

Should include:

- field manager
- field descriptions
- field permissions
- dependencies browser
- primary field management
- field usage in formulas / interfaces / forms
- record templates
- date dependencies

This should be a dedicated operator surface, not scattered modals.

### Layer 4: Business App Surfaces

Equivalent to Interfaces + Forms.

Should include:

- interfaces index
- interface designer with templates
- published interface mode
- forms index
- form builder
- public/internal form publishing

This matters because decision systems need different consumption modes for different people.

### Layer 5: Workflow and Data Hub

Equivalent to Automations + Sync + Integrations + Sharing.

Should include:

- sync manager
- automation manager
- external relay / webhook manager
- sharing manager
- distribution manager

This is where Consultify can outperform Airtable by unifying:

- inbound data
- operational data
- analytics
- output distribution

---

## 6. What Consultify Should Deliberately Do Better Than Airtable

We should not stop at parity.

### 6.1 Stronger analytics layer

Airtable has `Insights`, but Consultify already has the basis for:

- governed models
- KPI definitions
- trust flags
- richer analytical narratives

So in Consultify:

- tables should feed governed analytical objects
- interfaces should combine operational tables with KPI logic

### 6.2 Stronger AI explainability

Airtable Omni appears polished, but opaque.

Consultify should provide:

- plan preview
- schema diff preview
- explanation of why each table/field/view exists
- explanation of suggested automations

### 6.3 Better decision loop closure

Consultify should connect:

- table -> insight -> recommendation -> execution -> distribution

Airtable is strongest at coordination.  
Consultify should be strongest at **decision systems**.

### 6.4 Better governance for business operations

Our row-level permissions, governed models, and distribution architecture can become a stronger enterprise story than Airtable if we expose them coherently.

---

## 7. Recommended Build Sequence

### Phase 0: Make the platform real

Must happen before any parity work.

1. add migration runner
2. run table platform schema in Railway
3. make frontend fallback safe
4. fix no-op UI components (`FormBuilder`, `InterfaceDesigner`)
5. verify runtime end-to-end

### Phase 1: Build the actual Airtable shell

1. multi-table tabs
2. status bar + footer aggregates
3. tools dropdown
4. field manager as dedicated surface
5. row numbers + hide fields + cleaner top shell

### Phase 2: Build the Omni equivalent

1. dedicated AI creation entry point
2. plan confirmation surface
3. auto-seed realistic data
4. auto-create suggested automations
5. split-screen AI + data mode

### Phase 3: Build the missing planning layer

1. date dependencies
2. dependency-aware timeline/gantt
3. record templates

### Phase 4: Build the apps layer properly

1. forms index + real form publishing
2. interfaces index + real persistence
3. shared/published app consumption

### Phase 5: Build the workflow/data hub layer properly

1. sync manager
2. automation manager
3. sharing + relay + distribution manager
4. insights / health / operational diagnostics

---

## 8. Final Strategic Position

The right strategy is:

### Do not position Consultify as:

- "Airtable clone"
- "better spreadsheet"
- "table module"

### Position Consultify as:

> A business operating and decision platform that combines Airtable's structured workflow power with stronger AI reasoning, stronger analytics, and stronger execution flow.

So the representation target is:

- **Airtable-style operational data system**
- inside a **Consultify-style decision system**

This is a better product than attempting a literal clone.

---

## 9. Bottom Line

After reviewing the full documentation archive and large screenshot set, the most important correction is conceptual:

**We should not ask "How do we add more table features?"**

We should ask:

**How do we build a coherent five-surface business operating system where structured data, views, interfaces, forms, automations, sync, and AI work as one product?**

That is what Airtable actually is.

And that is the level Consultify must target.

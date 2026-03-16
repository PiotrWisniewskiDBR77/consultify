# Consultify Airtable Action Plan

**Date:** 2026-03-16  
**Purpose:** Turn the target operating model into an actionable execution plan.  
**Scope:** Build Airtable-class operational power inside Consultify while preserving Consultify's identity as a business management and decision platform.

---

## 1. Mission

Build a new operating layer in Consultify that enables teams to:

- describe a business operating need in natural language
- generate a structured operating system around that need
- run day-to-day work in tables, views, forms, and interfaces
- sync and automate operational workflows
- connect operational data to analytics, decisions, execution, and reporting

This plan does **not** aim to create an Airtable clone.

It aims to create:

> **Airtable-class operational capability inside a Consultify-class business operating system**

---

## 2. Success Criteria

The program is successful only if all of the following are true:

1. The platform works end-to-end on the real database and no longer depends on “files on disk”.
2. A user can create and operate a multi-table base from business intent, not just from manual schema work.
3. The product shell feels coherent, focused, and business-native.
4. Tables are visibly connected to forms, interfaces, automations, sync, and reporting.
5. Company context meaningfully shapes the generated system.
6. Operational data flows naturally into decision support and execution.

---

## 3. Strategic Principles

### Principle 1

Start from the **business problem**, not from a blank table.

### Principle 2

Make the **base** the primary operational container, not a single isolated table.

### Principle 3

Treat **schema, forms, interfaces, sync, and automations** as first-class surfaces.

### Principle 4

Preserve Consultify's advantage:

- governance
- context
- analytics
- decision support
- execution linkage

### Principle 5

Never ship UI theater:

- no dead overlays
- no fake save buttons
- no backend features without runtime wiring

---

## 4. Program Structure

The plan is divided into 6 workstreams and 5 delivery phases.

## 4.1 Workstreams

### WS1. Platform Reality

Goal:

- make the existing platform real, deployed, and safe

Scope:

- migration runner
- Railway schema rollout
- feature-flag safety
- legacy fallback
- no-op UI fixes
- runtime verification

### WS2. Product Shell

Goal:

- build the actual Airtable-class operating shell

Scope:

- base-level navigation
- multi-table tabs
- clean top shell
- tools menu
- status bar
- footer aggregates
- row numbers
- hide fields / sort / group / color / share-sync shell

### WS3. AI Builder

Goal:

- make AI the front door to system creation

Scope:

- business-intent intake
- context-aware planning
- plan confirmation
- schema generation
- sample data generation
- automation suggestions
- split-screen work mode

### WS4. Schema & Planning Tools

Goal:

- make schema and planning logic first-class

Scope:

- field manager
- dependency browser
- record templates
- date dependencies
- timeline/gantt dependency visualization
- field descriptions and permissions

### WS5. Apps Surface

Goal:

- make interfaces and forms real products, not supporting widgets

Scope:

- interface index
- persistent interface designer
- published interfaces
- forms index
- persistent form builder
- public/internal form handling

### WS6. Workflow & Data Hub

Goal:

- make tables an operational hub, not just storage

Scope:

- sync manager
- automation manager
- relay/webhook manager
- sharing manager
- distribution manager
- governed model integration

---

## 5. Delivery Phases

## Phase 0 — Make It Real

**Objective:** Remove all fake readiness and make the current platform actually runnable.

### Deliverables

1. Migration runner that executes `server/migrations/7*.sql` in order.
2. Production/staging execution of migrations on Railway.
3. Runtime verification that `tp_*` tables exist and are healthy.
4. Safe fallback from platform mode to legacy mode if backend is unavailable.
5. Fixes for known no-op or misleading UI:
   - `FormBuilder` save
   - `InterfaceDesigner` load/save
   - platform redo
   - real collaboration identity
   - template seeding

### Exit Criteria

- platform schema exists in Railway
- base CRUD works end-to-end
- records CRUD works end-to-end
- frontend no longer traps users in broken platform mode
- known fake interactions removed

### Estimated duration

2-4 days

---

## Phase 1 — Build The Base Shell

**Objective:** Create the core user-facing operational shell that feels like a serious multi-table base.

### Deliverables

1. Base-level model in UI:
   - one base
   - many tables
   - table tabs
2. Saved views as a primary object inside each table.
3. Clean shell:
   - tools dropdown
   - filter/group/sort/hide/share-sync controls
   - footer aggregates
   - status bar
   - row numbers
4. Better table-level navigation and layout discipline.

### Exit Criteria

- user can operate multiple tables inside one base without confusion
- shell is substantially cleaner than current `IdeaTableTool`
- top-level interaction pattern matches real Airtable-class usage

### Estimated duration

1-2 weeks

---

## Phase 2 — Build The AI Front Door

**Objective:** Move from “AI can mutate schema” to “AI creates a usable operating system”.

### Deliverables

1. Dedicated AI creation entry point.
2. Intake flow for:
   - company context
   - team
   - industry
   - use case
   - business objective
3. AI-generated build plan:
   - tables
   - fields
   - views
   - interfaces
   - forms
   - automations
4. User confirmation flow.
5. Auto-generated sample data.
6. Auto-generated first automations for obvious cases.
7. Split-screen AI + operating surface mode.

### Exit Criteria

- a user can describe a business system and get a usable first version
- the result is explainable and editable
- AI output is anchored in company context

### Estimated duration

2-3 weeks

---

## Phase 3 — Build Schema Power & Planning Logic

**Objective:** Reach parity on the deepest operator-level capabilities.

### Deliverables

1. Dedicated `Manage fields` surface.
2. Field metadata:
   - type
   - description
   - permissions
   - dependencies
   - usage relationships
3. Record templates.
4. Date dependencies:
   - start / end / duration / predecessor mapping
   - flexible / fixed / none logic
   - weekend/holiday handling
   - validation and repair flow
5. Dependency-aware timeline/gantt behavior.

### Exit Criteria

- field management is first-class
- project planning use cases become credible
- dependency behavior is deterministic and testable

### Estimated duration

2 weeks

---

## Phase 4 — Build Apps & Workflow Layers

**Objective:** Turn the base into a real company operating environment.

### Deliverables

1. Interfaces surface:
   - interfaces index
   - persistent builder
   - publishing
2. Forms surface:
   - forms index
   - persistent builder
   - submission options
   - public/internal modes
3. Workflow surface:
   - automation manager
   - sync manager
   - relay manager
   - sharing manager
   - distribution manager

### Exit Criteria

- non-table users can work in forms and interfaces
- workflows are visible and governable
- the system clearly operates beyond table editing

### Estimated duration

2-3 weeks

---

## Phase 5 — Connect To Consultify Core Value

**Objective:** Make the operational layer serve Consultify's real mission: decisions, management, execution, and reporting.

### Deliverables

1. Governed model integration:
   - KPI definitions
   - metrics
   - trusted analytical layer
2. Connections from bases to:
   - Results
   - Finance
   - Execution
   - Presentations
   - Reports
3. AI report generation from operational data.
4. Management-facing interfaces.
5. Artifact distribution on top of operational truth.

### Exit Criteria

- tables are not an isolated subsystem
- operational data supports decisions and execution
- Consultify identity is preserved and strengthened

### Estimated duration

2 weeks

---

## 6. Immediate Next Actions

These are the first 10 actions we should execute before any broad feature expansion.

1. Verify whether `tp_*` tables actually exist in Railway.
2. Build and wire a migration runner.
3. Execute migrations safely in staging.
4. Verify base/table/record CRUD live on Railway.
5. Add fallback logic so broken platform mode never hides legacy user data.
6. Fix `FormBuilder` save wiring.
7. Fix `InterfaceDesigner` persistence.
8. Seed templates automatically.
9. Redesign the current table shell into a base-first shell.
10. Define the exact AI intake contract for company-aware app generation.

---

## 7. Team Model

This plan is best executed with 6 parallel roles.

### Role A — Platform Runtime

Owns:

- migrations
- Railway rollout
- backend health
- feature-flag safety

### Role B — Base Shell

Owns:

- base navigation
- multi-table tabs
- tools shell
- status/footer shell

### Role C — AI Builder

Owns:

- intake flow
- plan generation
- sample data
- split-screen creation flow

### Role D — Schema & Planning

Owns:

- field manager
- dependencies
- record templates
- date dependencies

### Role E — Apps Surface

Owns:

- interfaces
- forms
- publishing UX

### Role F — Workflow & Data Hub

Owns:

- sync
- automations
- sharing
- distribution
- relay infrastructure

---

## 8. Program Gates

## Gate 1 — Reality Gate

Before Phase 1 begins, confirm:

- migrations are applied
- live CRUD works
- users cannot get trapped in broken platform mode

## Gate 2 — Shell Gate

Before Phase 2 begins, confirm:

- base shell is coherent
- multi-table navigation exists
- shell is simpler, not more complex

## Gate 3 — AI Gate

Before Phase 3 begins, confirm:

- AI can generate a usable first system
- outputs are reviewable and context-aware

## Gate 4 — Planning Gate

Before Phase 4 begins, confirm:

- schema manager is real
- date dependencies work deterministically
- record templates exist

## Gate 5 — Operating System Gate

Before declaring readiness, confirm:

- forms, interfaces, sync, automations, and sharing work together
- bases feed analytics, reporting, and execution

---

## 9. What We Must Avoid

### Avoid 1

Shipping more backend features before runtime truth is solved.

### Avoid 2

Adding more toolbar buttons instead of creating a coherent shell.

### Avoid 3

Treating forms, interfaces, and automations as secondary accessories.

### Avoid 4

Building AI as an opaque gimmick instead of a trustworthy operating builder.

### Avoid 5

Losing Consultify's identity by optimizing too hard for Airtable mimicry.

---

## 10. Final Statement

The correct action plan is not:

- “finish the table module”

The correct action plan is:

- **make the operational platform real**
- **build the actual base shell**
- **make AI the front door**
- **turn schema into a management surface**
- **make forms and interfaces into real products**
- **connect everything to Consultify's decision and execution system**

That is the path to a system that has the power of Airtable, but remains unmistakably Consultify.

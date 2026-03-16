# V7 OPUS Execution Instruction

**Date:** 2026-03-16  
**Target agent:** external `OPUS` agent working in another application/environment  
**Purpose:** provide one complete execution instruction for the `V7` implementation program

---

## 1. Mission

You are taking over the execution of the `V7` program for Consultify.

Your mission is to build:

> **Airtable-class operational power inside a Consultify-class business operating and decision system**

This is **not** a request to build an Airtable clone.

This is a request to build a company operating layer that combines:

- Airtable-style structured operational data
- views, forms, interfaces, automations, sync, and sharing
- AI-led system generation
- Consultify context, governance, analytics, execution, and reporting

---

## 2. Non-Negotiable Product Identity

You must preserve this rule at all times:

### Do NOT build

- a generic spreadsheet tool
- a feature pile of table capabilities
- a no-code toy detached from business context
- a literal screen-by-screen clone of Airtable

### Do build

- a business operating system
- where tables are the operational substrate
- and where operational data feeds decisions, execution, finance, reporting, and management workflows

The product identity must remain:

`Consultify first, Airtable-class power second`

---

## 3. Critical Reality Check

Before you implement anything, accept this as ground truth:

1. The codebase contains a lot of backend capability.
2. The previous "high parity" perception was overstated.
3. The current system is **not** production-ready.
4. The first problem to solve is **runtime truth**, not more feature coding.

### Known critical issues from the latest audit

- migration runner is missing or not primary
- runtime deployment truth is uncertain
- frontend can fall into broken platform mode
- some UI surfaces exist but are not truly wired
- the current shell is not Airtable-class
- multi-table base workflow is still not the real default UX
- forms/interfaces/schema tools are not yet first-class product surfaces

You must not assume readiness based on:

- number of files
- number of services
- number of routes
- older optimistic status documents

Only runtime-verified behavior counts.

---

## 4. Authoritative Documents To Read First

Read these documents in this exact order before making implementation decisions.

### Core truth and target model

1. `docs/strategy/TABLE_PLATFORM_HONEST_AUDIT_AND_PLAN_2026-03-16.md`
2. `docs/strategy/AIRTABLE_REPRESENTATION_ANALYSIS_FOR_CONSULTIFY_2026-03-16.md`
3. `docs/strategy/CONSULTIFY_AIRTABLE_OPERATING_MODEL_2026-03-16.md`
4. `docs/strategy/CONSULTIFY_AIRTABLE_ACTION_PLAN_2026-03-16.md`
5. `docs/strategy/TABLE_PLATFORM_IMPLEMENTATION_PLAN_V7.md`

### Foundational architecture and domain constraints

6. `docs/strategy/CONSULTIFY_TABLE_PLATFORM_ARCHITECTURE.md`
7. `docs/strategy/CONSULTIFY_DATA_COLLECTION_PLAN.md`
8. `docs/strategy/CONSULTIFY_ARTIFACT_DISTRIBUTION_AUTOMATION_PLAN.md`
9. `docs/strategy/workstreams/WS_B_ARCHITECTURE_BOUNDARIES.md`
10. `docs/strategy/workstreams/WS_C_TABLE_PLATFORM_CORE_SPEC.md`
11. `docs/strategy/workstreams/WS_D_CHAT_TO_SCHEMA_SPEC.md`
12. `docs/strategy/workstreams/WS_E_DATA_COLLECTION_SPEC.md`
13. `docs/strategy/workstreams/WS_G_DISTRIBUTION_SEPARATION.md`

### Airtable evidence base

14. `knowledge/AirTable/Archive.zip`
15. `knowledge/AirTable/Screen.zip`

---

## 5. How To Interpret Airtable

You must interpret Airtable correctly.

### Airtable is NOT:

- a spreadsheet app
- just a table/grid
- just a CRUD database UI

### Airtable IS:

1. **AI Build Surface**
2. **Base / Data Surface**
3. **Schema / Tools Surface**
4. **Apps Surface** (`Interfaces` + `Forms`)
5. **Workflow Surface** (`Automations` + `Sync` + `Sharing`)

You are not reproducing isolated features.
You are reconstructing this five-surface product logic inside Consultify.

---

## 6. V7 Program Goal

At the end of V7, a user should be able to:

1. describe a business operating need in natural language,
2. have Consultify understand the company context,
3. receive a proposed operational system,
4. approve it,
5. get a working base with:
   - multiple tables
   - views
   - forms
   - interfaces
   - automations
   - sample data
6. operate day-to-day work in that system,
7. connect the outputs to KPI, finance, execution, decisions, and reports.

---

## 7. V7 Program Structure

Follow the V7 program exactly as six major epics.

## Epic V7-0 — Platform Reality

### Objective

Make the platform actually real and runnable.

### Must deliver

- migration runner
- successful migration execution
- verified Railway schema
- safe fallback to legacy when platform is unhealthy
- fixes for no-op UI
- real collaboration identity
- seeded templates

### Rule

Do not move forward until this is truly complete.

---

## Epic V7-1 — Base Shell

### Objective

Build a real base-first operational shell.

### Must deliver

- base as multi-table container
- table tabs
- saved views as first-class objects
- clean shell controls
- tools dropdown
- row numbers
- status bar
- footer aggregates
- hide/group/sort/filter/share-sync shell

### Rule

Reduce shell complexity.
Do not add more toolbar chaos.

---

## Epic V7-2 — AI Front Door

### Objective

Make AI the first-class entry point for building operating systems.

### Must deliver

- intake for business need
- intake for company context
- build plan preview
- reviewable AI proposal
- sample data generation
- automation suggestions
- split-screen AI + workspace mode

### Rule

AI must build an operating environment, not only mutate schema.

---

## Epic V7-3 — Schema & Planning Power

### Objective

Add the deep operator capabilities that make Airtable credible.

### Must deliver

- field manager
- field descriptions
- field permissions
- dependency browser
- record templates
- date dependencies
- timeline/gantt dependency behavior

### Rule

Treat schema as a first-class management surface.

---

## Epic V7-4 — Apps Surface

### Objective

Make interfaces and forms into real products.

### Must deliver

- interfaces index
- persistent interface designer
- publish/access controls
- forms index
- persistent form builder
- public/internal form behavior

### Rule

Do not leave forms/interfaces as disconnected overlays.

---

## Epic V7-5 — Workflow & Data Hub

### Objective

Turn the base into an operational data and action hub.

### Must deliver

- sync manager
- automation manager
- connector setup UX
- relay/webhook manager
- sharing manager
- distribution manager
- provenance visibility

### Rule

Workflows must be visible, governable, and operationally useful.

---

## Epic V7-6 — Consultify Integration

### Objective

Connect the operational layer to the actual value of Consultify.

### Must deliver

- governed model integration
- KPI/trust linkage
- links to Results, Finance, Execution
- report/presentation/distribution outputs
- AI-generated insight and reporting support

### Rule

The system must end in decision support and execution, not in table maintenance.

---

## 8. Mandatory Execution Order

You must execute in this order:

1. `V7-0`
2. `V7-1`
3. `V7-2`
4. `V7-3`
5. `V7-4`
6. `V7-5`
7. `V7-6`

Do not jump ahead because a feature looks exciting.

### Prohibited shortcut

Do NOT build:

- more AI magic
- more backend endpoints
- more designer surfaces

before runtime truth and base shell are solved.

---

## 9. Your First Deliverable

Before coding, you must produce a short execution confirmation report with:

1. what you read
2. what you believe is the true current state
3. confirmation that you understand the five-surface model
4. confirmation that V7-0 is the first gate
5. a list of concrete implementation tasks for V7-0

If your first response does not start from runtime truth, you misunderstood the assignment.

---

## 10. Required Working Method

Use this method throughout the engagement.

### Step A — Verify truth before changing anything

For every major area:

- inspect the code
- verify wiring
- verify runtime behavior
- verify database/migration state
- distinguish between:
  - code exists
  - route exists
  - UI exists
  - feature actually works end-to-end

### Step B — Design before implementation in each epic

For each epic:

- define target behavior
- define shell changes
- define backend contracts
- define acceptance tests

### Step C — Build only what is connected

No dead code.
No speculative components without persistence.
No fake shell controls.

### Step D — Verify after each epic

Each epic must end with:

- technical verification
- runtime verification
- UX verification
- business-use verification

---

## 11. Mandatory Guardrails

### Guardrail 1 — No fake readiness

Never describe a feature as done because:

- service exists
- migration file exists
- component exists
- route exists

It is only done if it works end-to-end.

### Guardrail 2 — No UI theater

Never leave:

- fake save buttons
- overlays that don't persist
- builders without loading/saving
- toggles disconnected from backend behavior

### Guardrail 3 — No shell sprawl

Do not add more top-level buttons if the shell is already overloaded.
Prefer:

- grouped tools
- menus
- dedicated management surfaces
- progressive disclosure

### Guardrail 4 — No Airtable mimicry without Consultify value

If a feature only copies Airtable but does not strengthen:

- business context
- governance
- analytics
- decisions
- execution

then reconsider the implementation.

### Guardrail 5 — No opaque AI

AI must:

- explain its plan
- expose what it will create/change
- request approval where needed
- be auditable

---

## 12. Acceptance Criteria Per Epic

## For V7-0

Must prove:

- migrations run
- tables exist in DB
- CRUD works live
- frontend fallback works
- fake UI interactions removed

## For V7-1

Must prove:

- multi-table base shell exists
- table switching works
- shell is cleaner
- row counts and aggregates exist

## For V7-2

Must prove:

- AI intake is company-aware
- plan preview exists
- generated result includes more than schema
- split-screen workflow exists

## For V7-3

Must prove:

- field manager is first-class
- record templates work
- date dependencies work deterministically

## For V7-4

Must prove:

- forms and interfaces persist
- publishing/access controls work
- non-operator users can use them

## For V7-5

Must prove:

- sync and automation management are visible and real
- relay/distribution flows work
- provenance/run logs are visible

## For V7-6

Must prove:

- operational data feeds governed models
- operational work connects to decisions, reports, and execution

---

## 13. Reporting Format

For each epic, report back in this format:

### A. Reality status

- what was true before work started
- what was fake or disconnected

### B. What changed

- backend
- frontend
- data model
- UX shell

### C. What now works end-to-end

List only working flows.

### D. Remaining gaps

What is still not done or still risky.

### E. Go / no-go recommendation

Can the next epic begin?

---

## 14. External Agent Prompt Summary

If you need a shorter statement of the assignment, use this:

> Build V7 of Consultify Table Platform as a company operating system with Airtable-class operational power. Start from runtime truth, not file counts. First make the platform real on Railway, then build a base-first shell, then make AI the front door, then add schema/planning depth, then turn interfaces/forms into real product surfaces, then build workflow and data hub capability, and finally connect the whole system to Consultify's core value: governance, analytics, decisions, execution, and reporting. Never ship UI theater, fake readiness, or Airtable mimicry without Consultify value.

---

## 15. Final Instruction

Your job is not to “finish the table module.”

Your job is to:

> **make Consultify capable of generating and running company operating systems**

with Airtable-class structure and flow,
but with stronger context, stronger governance, stronger analytics, and stronger decision linkage.

That is the real assignment.

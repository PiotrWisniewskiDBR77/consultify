# Project Management Benchmark v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: benchmark how modern project and initiative platforms manage a living program from intake through approval, planning, execution, change, reporting and closure, without copying their UI

---

## 1. Why this document exists

`consultify` needs initiative management that behaves like a serious project operating system, not only a record of initiatives.

This benchmark extracts the strongest operating patterns from the project-management references in `Softs/Projekty`.

---

## 2. Benchmark source families

This document draws on local benchmark mirrors from:

- `Softs/Projekty/Clickup dev.zip`
- `Softs/Projekty/Clickup help.zip`
- `Softs/Projekty/Linear.zip`
- `Softs/Projekty/Monday dev.zip`
- `Softs/Projekty/Monday help.zip`
- `Softs/Projekty/Monday support.zip`

Important visible benchmark themes inside these mirrors include:

- `Linear`: `projects`, `triage`, `plan`, `initiatives`, `cycles`, `AI`
- `ClickUp`: help and developer material around task/project breadth, automation, goals, views and execution operations
- `Monday`: board-centric project operating patterns, automation and portfolio/dashboard behavior

Rule:

`consultify` adapts lifecycle and operating patterns, not competitor UI`

---

## 3. What the leaders teach

### 3.1 ClickUp

Teaches:

- one system spanning tasks, docs, goals, milestones and automations
- broad intake paths into structured work
- status-rich execution with many operational views
- event-driven automation around due dates, ownership and state changes

### 3.2 Linear

Teaches:

- extremely strong triage and planning discipline
- clear hierarchy between issues, projects, initiatives and cycles
- speed-first execution surfaces
- AI features attached to planning and execution context, not isolated novelty

### 3.3 Monday

Teaches:

- board-driven operational management with many audience-specific views
- strong dashboards and portfolio rollups
- automation as a first-class operational layer
- broad adoption patterns for approvals, ownership and cross-team coordination

---

## 4. Benchmark patterns to adopt

### 4.1 Initiative as a living object

A serious initiative is not static after creation.

It must support:

- creation from many sources
- go or no-go decisions
- planning and baseline creation
- active execution
- change requests
- delivery closure
- post-delivery tracking

### 4.2 One hierarchy, many surfaces

Modern project tools separate:

- portfolio or initiative layer
- project or workstream layer
- task and decision layer
- calendar or timeline layer
- reporting layer

The user sees different surfaces, but the operating model stays one.

For `consultify`, this specifically means:

- `Initiatives` owns shaping, planning and lifecycle governance
- `Execution -> Portfolio` owns the live portfolio of initiatives already in delivery
- `Execution -> Raporty` owns pre-defined execution reporting packs
- `Execution -> Manager` owns intervention, workload and PMO/operator control

Rule:

`Execution` may expose multiple surfaces, but it must not absorb full initiative planning or create a second project runtime.

### 4.3 Triage before execution chaos

Strong systems do not dump everything straight into execution.

They normalize:

- intake
- review
- readiness
- prioritization
- assignment

before work becomes active delivery.

### 4.4 Planning must include time and dependency logic

Benchmark tools consistently treat planning as more than editing fields.

Planning means:

- baseline dates
- milestones
- dependencies
- sequencing
- resource and workload awareness
- readiness for execution

### 4.5 Execution is signal-driven

Execution surfaces should show:

- what is late
- what is blocked
- what decision is pending
- what milestone is at risk
- what owner needs to act now

### 4.6 Reporting is operational, not decorative

Reporting should connect:

- status
- milestone health
- task throughput
- blockers and risks
- accountability
- benefits transition

Good reporting surfaces in this benchmark family also:

- are audience-specific,
- are cadence-driven,
- define what happens after the report is read,
- stay grounded in the same execution truth as the live operating surfaces.

### 4.7 AI belongs inside the work system

Benchmark lesson:

- AI should help shape work
- AI should help decompose initiatives into tasks and decisions
- AI should help re-plan
- AI should help summarize status and propose next actions

But:

- AI should not silently mutate execution truth

---

## 5. Benchmark-derived requirement areas for consultify

The initiative package should explicitly support:

- multi-entry initiative creation
- one canonical lifecycle from draft to benefits tracking
- task and decision decomposition as first-class runtime
- timeline, capacity and critical-path planning
- change-management inside execution, not outside it
- eventing and automation around execution signals
- AI copilot for initiative shaping and task execution support
- honest delivery reporting, risk and accountability

---

## 6. Anti-patterns to avoid

- initiative detail pages without operational execution logic
- AI that only drafts text but does not help manage work
- task lists detached from initiative goals and milestones
- fake reporting when dates, owners or baseline data are missing
- separate lifecycle truths across modules

---

## 7. Target statement

`Initiatives v8` in `consultify` should become a governed project operating system where initiative creation, planning, execution, change, reporting and AI-assisted work management stay connected through one canonical runtime.

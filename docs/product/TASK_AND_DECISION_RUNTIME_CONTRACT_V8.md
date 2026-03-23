# Task And Decision Runtime Contract v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical decomposition of initiatives into tasks, decisions, milestones and execution units across Initiatives and Execution

---

## 1. Why this document exists

An initiative becomes real only when it is decomposed into actionable work.

In `consultify`, this decomposition should not be an accidental side effect of one UI tab.

It needs one shared runtime contract for:

- tasks
- decisions
- milestones
- dependencies
- ownership

---

## 2. Core statement

Every active initiative should be able to materialize into a governed work graph:

`initiative -> milestones -> tasks -> decisions -> execution signals -> reporting outputs`

Rule:

`tasks and decisions are not parallel truth to initiatives; they are initiative-native execution objects`

---

## 3. Canonical work object classes

The package should distinguish:

- `InitiativeTask`
- `InitiativeDecision`
- `InitiativeMilestone`
- `InitiativeDependency`
- `InitiativeExecutionSignal`

### 3.1 Cross-initiative dependency model

> V8 Decision W3-6 applied — 2026-03-23

`InitiativeDependency` is formally extended for cross-initiative links. Dependencies support explicit `source_initiative_id` and `target_initiative_id` references. Optional lower-level task/milestone references may exist later; initiative-level cross-link is in scope now.

---

## 4. Task doctrine

Tasks should preserve:

- initiative linkage
- milestone or phase linkage where applicable
- parent or child hierarchy where applicable
- owner
- due or target timing
- current status
- execution notes
- why the task exists
- expected outcome
- acceptance or completion evidence where needed
- dependencies and blockers
- effort or workload signal where relevant
- field structure that can safely evolve for different task types

Tasks should support both:

- manually authored work
- AI-proposed work that still requires review or acceptance

Tasks should also support:

- decomposition into subtasks or work packages
- move across initiative structure where policy allows
- automation and escalation triggers
- reporting-safe custom metadata without breaking canonical execution truth

### 4.1 WBS depth model

> V8 Decision W3-4 applied — 2026-03-23

Canonical V8 depth: Initiative → Workstream/Phase → Task → Subtask.

This is the default maximum structured hierarchy. Anything deeper becomes: checklist, dependency-linked sibling task, or separate initiative/workstream decomposition.

Rule: `keep hierarchy shallow enough to remain governable`

---

## 5. Decision doctrine

Decisions should be treated as first-class execution blockers or enablers.

The system should distinguish:

- decision candidate
- pending decision
- approved decision
- rejected decision
- expired or escalated decision

Decisions should preserve:

- explicit decider ownership
- decision options and recommendation
- consequences of non-decision
- blocked work count and affected objects
- escalation state
- implementation follow-through into tasks, gates or schedule changes

Where needed, the system should also support:

- delegated decision handling
- approval chains or committee-style review
- conditional decisions and required follow-up actions

### 5.1 Decision chain model

> V8 Decision W3-7 applied — 2026-03-23

A minimal formal decision-chain model is in scope for V8. Supported chain types:

- `sequential` — A then B
- `parallel` — A and B concurrently
- `delegated` — A delegates to C

Rule: `formal enough for governance, not yet BPMN-grade`

Important:

`a blocked initiative often needs a decision, not just another task`

---

## 6. Surface doctrine

The same task or decision may appear in:

- Initiative detail
- Execution
- Inbox
- Calendar
- reporting and summaries
- AI execution proposal flows

But the underlying object should remain one.

Rule:

`many views are allowed; duplicate truth is not`

---

## 7. Readiness and quality rule

The initiative system should remain honest when decomposition is weak.

Examples:

- no owner
- no due timing
- no decision owner
- no milestone link for critical work
- no acceptance condition for completion-sensitive work
- no blocker link where blocked-by-decision is the real reason
- no effort signal where workload balancing depends on the task

These should become visible readiness or execution warnings.

---

## 8. AI rule

AI may:

- propose tasks
- propose decisions
- suggest decomposition improvements
- suggest priority, sequence and missing work
- draft clearer task and decision content
- prepare option comparison and blocker analysis
- act as writer, consultant and domain expert inside governed execution support

AI may not:

- silently create execution truth without governed acceptance

Rule:

`AI for tasks and decisions must help both with content quality and execution quality`

---

## 9. Related canonical docs

- `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md`
- `TASK_AUTOMATION_AND_EVENTING_V8.md`
- `INITIATIVE_AI_COPILOT_AND_EXECUTION_SUPPORT_V8.md`
- `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md`
- `AI_COLLABORATION_WITH_INITIATIVES_TASKS_AND_DECISIONS_V8.md`

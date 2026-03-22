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

---

## 4. Task doctrine

Tasks should preserve:

- initiative linkage
- milestone or phase linkage where applicable
- owner
- due or target timing
- current status
- execution notes
- why the task exists

Tasks should support both:

- manually authored work
- AI-proposed work that still requires review or acceptance

---

## 5. Decision doctrine

Decisions should be treated as first-class execution blockers or enablers.

The system should distinguish:

- decision candidate
- pending decision
- approved decision
- rejected decision
- expired or escalated decision

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

---

## 7. Readiness and quality rule

The initiative system should remain honest when decomposition is weak.

Examples:

- no owner
- no due timing
- no decision owner
- no milestone link for critical work

These should become visible readiness or execution warnings.

---

## 8. AI rule

AI may:

- propose tasks
- propose decisions
- suggest decomposition improvements
- suggest priority, sequence and missing work

AI may not:

- silently create execution truth without governed acceptance

---

## 9. Related canonical docs

- `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md`
- `TASK_AUTOMATION_AND_EVENTING_V8.md`
- `INITIATIVE_AI_COPILOT_AND_EXECUTION_SUPPORT_V8.md`
- `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md`

# Task Automation And Eventing v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical events, automation triggers and governed side effects for initiative tasks, milestones, dependencies and execution signals

---

## 1. Why this document exists

Task execution support in `consultify` should not depend only on users remembering to open a tab.

Modern project systems use eventing and automation to keep execution alive.

This document defines how initiative work should materialize events, nudges, escalations and AI proposals.

---

## 2. Core statement

Initiative work should produce a governed event layer:

`task or milestone change -> event -> policy evaluation -> automation or AI proposal -> user-facing consequence`

Rule:

`automation may route, remind, escalate or propose, but must not silently override business decisions`

---

## 3. Canonical event families

The package should support events such as:

- `initiative.task.created`
- `initiative.task.updated`
- `initiative.task.overdue`
- `initiative.task.blocked`
- `initiative.task.stale`
- `initiative.decision.pending`
- `initiative.decision.overdue`
- `initiative.milestone.at_risk`
- `initiative.dependency.breached`
- `initiative.execution.health_changed`
- `initiative.baseline.changed`

---

## 4. Automation classes

The system should support:

- reminder automation
- escalation automation
- assignment and re-engagement nudges
- inbox materialization
- calendar materialization
- AI proposal generation
- reporting signal refresh

---

## 5. Examples of governed automation

Examples:

- overdue critical task -> owner reminder + PMO visibility
- blocked task -> execution risk signal + escalation suggestion
- missing owner or date on key task -> readiness warning
- milestone drift -> schedule review proposal
- dependency breach -> critical-path warning
- pending decision near deadline -> decision-needed item in Inbox

---

## 6. AI support rule

AI may use events to propose:

- task regrouping
- next-best actions
- owner follow-up drafts
- rescheduling options
- recovery plans

But:

- proposals must attach to a governed review path
- applied changes should trace back to one proposal or run

---

## 7. Related canonical docs

- `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
- `INITIATIVE_AI_COPILOT_AND_EXECUTION_SUPPORT_V8.md`
- `DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`
- `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md`

# Inbox And Workflow Runtime Contract v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac kanoniczny runtime dla `My Work > Inbox` jako action queue, triage surface i governance enforcement layer

---

## 1. What this document owns

This document owns:

- canonical inbox item model
- section model
- triage behavior
- SLA and escalation semantics inside inbox runtime
- relation between inbox and downstream execution surfaces

It does not replace:

- `MY_WORK_INBOX_AND_SLA.md` as short governance doctrine
- `ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md` for channel-level notification semantics
- `AGENT_EXECUTION_V8_SSOT.md` for full execution run lifecycle

---

## 2. Core product statement

`Inbox` is not a todo list and not a generic notification center.

It is:

- the user's governed action queue
- the primary triage surface for incoming work
- the place where urgency, ownership, SLA and next action become explicit

Canonical statement:

`Inbox v8` is the normalized, source-aware action queue inside My Work where tasks, decisions, approvals, escalations, signals and async AI outcomes are triaged into real execution paths with durable state, visible rationale and auditable side effects.

---

## 3. Canonical object model

### 3.1 `CanonicalInboxItem`

Every surfaced inbox row must map to one canonical item object.

Minimum fields:

- `id`
- `itemKey`
- `itemType`
- `sourceObjectRef`
- `section`
- `title`
- `description`
- `source`
- `receivedAt`
- `dueDate?`
- `urgency`
- `sla?`
- `itemStatus`
- `reason`
- `isActionable`
- `linkedTaskId?`
- `linkedDecisionId?`
- `linkedInitiativeId?`
- `triaged`
- `triagedAt?`
- `triageAction?`
- `triageParams?`
- `suggestedAction?`
- `suggestedReason?`
- `suggestedConfidence?`

### 3.2 Canonical item types

Allowed `itemType` values:

- `task`
- `decision`
- `approval`
- `signal`

Rule:

`itemType` is the stable routing class for workflow behavior, even if the source system has richer native types.

### 3.3 Canonical section values

Allowed `section` values:

- `decisions_required`
- `approvals_gates`
- `assigned_tasks`
- `blocked_escalations`
- `overdue_sla_breach`
- `fyi_system`
- `fyi_mentions`
- `ai_insights`
- `other`

Rule:

- actionable sections come first
- FYI sections may exist but cannot dominate the action queue

### 3.4 Canonical status values

Allowed `itemStatus` values:

- `open`
- `done`
- `saved`
- `snoozed`
- `dismissed`

Rule:

`itemStatus` describes inbox handling state, not source object lifecycle.

---

## 4. Triage contract

### 4.1 Allowed triage actions

Canonical triage actions:

- `accept_today`
- `accept_week`
- `accept_later`
- `schedule`
- `delegate`
- `archive`
- `dismiss`
- `done`
- `save`
- `snooze`
- `reject`

### 4.2 Triage actions must have durable effects

Triage is not visual-only state.

Examples:

- `accept_today` routes item into focus `today`
- `accept_week` routes item into focus `thisWeek`
- `accept_later` routes item into focus `later`
- `schedule` changes a due date where the source artifact supports it
- `delegate` changes effective ownership where governance allows it
- `done` may complete a task
- `archive` and `dismiss` remove the item from active open queues with durable audit

### 4.3 AI triage

AI may suggest:

- section
- urgency
- next triage action
- reason
- confidence

AI may not:

- silently decide business-critical approvals
- silently change durable source ownership
- hide that a triage action was AI-applied

If AI-applied triage is supported, undo must exist.

---

## 5. SLA and escalation semantics

### 5.1 SLA-bearing sections

By default, SLA applies to:

- `decisions_required`
- `approvals_gates`
- `blocked_escalations`
- `assigned_tasks` where the source object is marked critical

### 5.2 Canonical SLA levels

Allowed values:

- `none`
- `L1`
- `L2`
- `L3`

Meaning:

- `L1` = approaching breach
- `L2` = breached
- `L3` = breached and escalated longer-term

### 5.3 Escalation rule

Escalation inside inbox must always preserve:

- source object
- current owner / reviewer
- escalation target
- reason for escalation
- timing context

---

## 6. Materialization model

`Inbox` must not rely only on raw notifications.

The system should materialize canonical inbox items from:

- tasks
- decisions
- approvals and gate-like requirements
- notifications
- AI review objects
- resumable async work
- escalations and SLA breaches

Rule:

`materialized canonical items are the contract shown to the user, even if raw source events come from many different tables or services`

---

## 7. Why-am-I-seeing-this rule

Every inbox item must support an explicit explanation.

The user should be able to understand:

- why this item is visible to me
- what source object created it
- whether action is required or this is FYI only
- what will happen if I ignore it

This explanation should be durable backend meaning, not only client heuristics.

---

## 8. Inbox vs notifications vs tasks

### 8.1 Inbox vs notification center

Notification center may contain many event classes.

Inbox contains only:

- work that should be triaged
- signals that should enter personal workflow
- governed reminders that remain action-relevant

### 8.2 Inbox vs task board

Task board is a full execution workspace for tasks.

Inbox is the intake and routing layer before or around task execution.

### 8.3 Inbox vs chat

Chat may start or explain work.

Inbox is where work becomes a durable action queue item when it needs personal triage outside the thread.

---

## 9. Required UX behaviors

Non-negotiable UX expectations:

- table + preview pattern remains canonical
- fixed action-first grouping remains stable
- quick actions exist where allowed
- bulk triage exists
- keyboard-first triage is allowed
- urgency and SLA cues are visible
- `open / done / saved / all` style filtering is allowed if mapped to durable status
- view may switch between flat list and smart sections

Rule:

UI richness may evolve, but it cannot break canonical item semantics.

---

## 10. Acceptance criteria

This contract is doing its job if:

- one inbox item model exists across runtime and docs
- triage has durable side effects
- source awareness is always available
- SLA and escalation are operational, not decorative
- AI triage remains explainable and undoable
- inbox remains an action queue, not a noisy event graveyard

---

## 11. Related canonical docs

- `PROJECT_TASKS_AND_WORKFLOW_SOFTS_BENCHMARK_V8.md`
- `INTAKE_AND_TRIAGE_RUNTIME_V8.md`
- `MY_WORK_INBOX_AND_SLA.md`
- `ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md`
- `AGENT_EXECUTION_V8_SSOT.md`

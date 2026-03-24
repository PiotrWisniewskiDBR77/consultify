# Intake And Triage Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac, jak sygnaly, requests i review objects trafiaja do `Inbox`, jak sa materializowane, deduplikowane i routingowane do dalszej pracy

---

## 1. Why this document exists

`Inbox` nie jest wartosciowy tylko dlatego, ze pokazuje itemy.

Jest wartosciowy tylko wtedy, gdy wiadomo:

- skad item przyszedl
- jak stal sie canonical inbox item
- co user moze z nim zrobic
- co system robi po triage

Ten dokument zamyka runtime:

`source -> intake -> materialize -> surface -> triage -> side effect -> audit`

---

## 2. Inherited truth

This document inherits:

- `PROJECT_TASKS_AND_WORKFLOW_SOFTS_BENCHMARK_V8.md`
- `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
- `MY_WORK_INBOX_AND_SLA.md`
- `AGENT_EXECUTION_V8_SSOT.md`
- `ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md`

Rule:

`every inbox item must be traceable back to a source object or source event family`

---

## 3. Core product statement

`Intake` is the process by which work-like signals enter personal workflow.

`Triage` is the process by which those signals are:

- accepted
- delayed
- delegated
- dismissed
- converted into stronger execution commitments

Canonical statement:

`Intake and Triage v8` is the AI-assisted but human-governed runtime that turns multi-source work signals into normalized inbox items and routes them into the correct next work state with durable side effects and full traceability.

---

## 4. Source families

Inbox intake may originate from:

- task assignment
- decision request
- approval or gate review
- escalation or blocked condition
- overdue / SLA breach
- mention or notification
- AI suggestion
- async execution completion
- resume-available session
- radar or signal-driven suggestion
- external or imported operational signal where policy allows

Rule:

`source families may be broad, but materialization into the inbox must remain typed and normalized`

---

## 5. Canonical intake objects

### 5.1 `InboxSourceObjectRef`

Represents the original object or event family.

It should contain:

- `sourceType`
- `sourceId`
- `sourceTableOrService`
- `organizationId`
- `actorRef?`
- `createdAt`

### 5.2 `InboxMaterializationRecord`

Represents the durable canonical item created from one or more sources.

It should contain:

- `itemKey`
- `itemType`
- `section`
- `materializedFrom`
- `reason`
- `isActionable`
- `sla?`
- `dedupeGroupRef?`

### 5.3 `InboxTriageRecord`

Represents the user or AI-applied triage decision.

It should contain:

- `itemKey`
- `action`
- `params`
- `triagedAt`
- `appliedBy`
- `fromAi?`
- `aiConfidence?`

---

## 6. Materialization rules

### 6.1 Normalize before surface

Before an item reaches the UI, the runtime should normalize:

- title
- description
- source explanation
- section
- urgency
- SLA
- actionability
- type

### 6.2 Dedupe before clutter

Multiple raw events may map to one inbox item.

Examples:

- repeated reminders for one task
- several signals around one overdue approval
- overlapping notification events for one decision request

Rule:

`the user should usually triage one canonical item, not ten near-duplicates`

### 6.3 Actionability is explicit

Every item must declare:

- `isActionable = true` when the user is expected to act
- `isActionable = false` when the item is informational or supportive

---

## 7. Triage lifecycle

Canonical lifecycle:

`surface -> understand -> triage -> apply side effects -> persist triage -> remain visible in status views -> resolve or age out`

### 7.1 Surface

The item appears in the inbox with:

- section
- urgency
- reason
- source context

### 7.2 Understand

The user can inspect:

- why am I seeing this
- source artifact
- SLA and urgency
- suggested action if AI assists

### 7.3 Triage

The user applies one canonical triage action.

### 7.4 Apply side effects

The system may:

- route item to focus columns
- update due date
- delegate owner
- mark notification as read
- mark task as done
- preserve save or snooze state

### 7.5 Persist

The triage decision becomes durable state.

### 7.6 Resolve or age out

The item may leave the open queue because:

- the source object was resolved
- the item was done or dismissed
- it became saved or snoozed
- policy retired it

---

## 8. AI role in intake and triage

AI may assist by:

- classifying item type
- suggesting section
- suggesting urgency
- suggesting action
- explaining why the item matters
- scoring confidence

AI may not:

- silently create fake urgency
- silently override owner-critical decisions
- hide source ambiguity
- make actionability opaque

If AI-applied triage exists:

- confidence must be stored
- undo must exist
- audit must remain visible

---

## 9. Routing from inbox into execution

### 9.1 Focus routing

`accept_today`
`accept_week`
`accept_later`

must route items into the focus surface with durable state.

### 9.2 Ownership routing

`delegate`

must change the effective owner only where permissions allow it.

### 9.3 Timeline routing

`schedule`

must update due-date style fields where the source artifact supports it.

### 9.4 Resolution routing

`done`
`dismiss`
`archive`
`reject`

must preserve enough auditability to reconstruct what happened.

---

## 10. Intake bridge from other product surfaces

### 10.1 Chat and execution agent

Chat and async execution may create inbox items for:

- review requests
- async completions
- resumable work
- failure with recovery path

### 10.2 Notifications

Notification service may feed inbox only when:

- action is expected
- re-entry is valuable
- governance requires persistence

### 10.3 Tasks and decisions

Tasks and decisions are primary canonical inbox sources.

### 10.4 Initiatives and blocked states

Blocked or escalated initiative work should surface through inbox as user-facing actionable items, not only buried in initiative views.

### 10.5 Radar and signal-driven suggestions

Radar-like signals may enter inbox only when they become work recommendations, not just passive insight.

---

## 11. Acceptance criteria

This runtime is doing its job if:

- source-to-inbox path is explicit
- dedupe prevents noise
- triage actions have durable side effects
- AI suggestions are explainable and undoable
- inbox remains the user-facing control layer between incoming work and real execution

---

## 12. Related canonical docs

- `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
- `PROJECT_TASKS_AND_WORKFLOW_SOFTS_BENCHMARK_V8.md`
- `MY_WORK_INBOX_AND_SLA.md`
- `AGENT_EXECUTION_V8_SSOT.md`
- `ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md`

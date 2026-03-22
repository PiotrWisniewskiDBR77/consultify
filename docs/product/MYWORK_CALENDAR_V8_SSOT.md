# MyWork Calendar v8 - SSOT

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical product truth for the My Work calendar as a unified PMO-grade time surface across internal work and external calendar systems

---

## 1. Core product statement

`MyWork Calendar v8` is the canonical time orchestration surface inside Consultify where tasks, initiative milestones, decisions, assignments, adjustments, meetings, approvals and external events are aggregated into one governed planning layer for transformation work.

It is not only:

- a calendar tab
- a meeting list
- an ICS consumer

It is:

- a single pane of time-bound work
- a PMO timing surface
- a decision and escalation timing surface
- a bridge between internal work and Outlook or Google reality

---

## 2. Inherited truth

This document inherits:

- `MYWORK_CALENDAR_V1_SSOT.md`
- `MYWORK_CALENDAR_V8_BENCHMARK.md`
- `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`
- `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md`
- `EXTERNAL_SYNC_READINESS_AUDIT_V8.md`
- `AI_WORKLOAD_CLASSES_AND_SLA_ARCHITECTURE_V8.md`
- `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`

Rule:

`calendar must unify internal planning and external time commitments without pretending external parity where runtime does not yet exist`

---

## 3. What the calendar owns

The calendar owns:

- unified time item model
- aggregation rules
- view and filtering doctrine
- reschedule and timing semantics
- PMO timing overlays

It does not replace:

- sync runtime docs for connectors
- inbox triage doctrine
- initiative governance doctrine

---

## 4. Canonical calendar item model

The calendar should support one canonical `CalendarItem` model with:

- `calendarItemId`
- `itemType`
- `sourceSystem`
- `sourceObjectRef`
- `title`
- `startAt`
- `endAt?`
- `allDay`
- `timeClass`
- `ownerRef?`
- `assigneeRef?`
- `projectRef?`
- `initiativeRef?`
- `decisionRef?`
- `adjustmentRef?`
- `syncState`
- `visibilityClass`
- `workloadClass?`

### 4.1 Allowed `itemType` values

- `task_due`
- `task_window`
- `initiative_milestone`
- `decision_deadline`
- `assignment`
- `adjustment`
- `meeting`
- `approval_window`
- `escalation_window`
- `external_event`
- `focus_block`

### 4.2 Allowed `sourceSystem` values

- `consultify`
- `google_calendar`
- `outlook_calendar`
- `other_external`

---

## 5. Calendar aggregation doctrine

The unified calendar must aggregate:

- tasks
- initiative milestones
- decisions
- meetings
- assignments
- adjustments
- approvals and escalations where time matters
- external Google and Outlook events

Rule:

`calendar aggregation should be source-aware and user-aware, but still feel like one time surface`

---

## 6. PMO-specific layers

To be PMO-grade, the calendar must support:

- milestone planning
- governance deadlines
- review windows
- assignment timing
- schedule adjustments
- escalation timing
- workload awareness

These are not optional enrichments.
They are what differentiates a transformation calendar from a generic personal schedule.

---

## 7. External calendar doctrine

The platform should support:

- Outlook / Microsoft 365
- Google Calendar

The calendar must clearly distinguish:

- imported or mirrored external events
- bidirectional synced events
- internal items projected outward

No UI may imply full bidirectional sync if only partial or read-style integration exists.

---

## 8. View doctrine

The calendar should preserve:

- month
- week
- day
- list

But the real product quality comes from:

- filtering by source and class
- understanding overload
- identifying conflicts
- seeing what changed and why

---

## 9. Workload and overload doctrine

The calendar should not stop at time placement.

It must also reflect:

- assignment pressure
- overloaded periods
- execution windows
- review density

This requires explicit linkage to workload and SLA architecture.

---

## 10. Reschedule and authority doctrine

Each time item must define:

- who may move it
- what source owns the date
- whether the move affects external systems
- whether review is needed

---

## 11. Acceptance criteria

- one unified calendar item model exists
- PMO timing objects are first-class
- Outlook and Google are explicit target systems
- workload and adjustment semantics are included in product scope
- source-of-truth and conflict logic are explicit

---

## 12. Related canonical docs

- `MYWORK_CALENDAR_V8_READINESS_AUDIT.md`
- `MYWORK_CALENDAR_V8_AS_IS.md`
- `MYWORK_CALENDAR_V8_GAP_MATRIX.md`
- `MYWORK_CALENDAR_V8_IMPLEMENTATION_PLAN.md`
- `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md`

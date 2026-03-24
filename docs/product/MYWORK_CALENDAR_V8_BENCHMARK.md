# MyWork Calendar v8 Benchmark

> Status: Draft v8
> Owner: Product + Engineering
> Scope: benchmark of calendar interoperability and PMO-grade time orchestration based on the local `Softs/Kalendarz` corpus and current platform goals

---

## 1. Why this benchmark exists

`Consultify` does not need a decorative calendar tab.

It needs a time operating surface that can support transformation work across:

- tasks
- decisions
- initiatives
- assignments
- adjustments
- external events

The local benchmark corpus is not a pure SaaS UI benchmark.
It is primarily:

- interoperability standards
- Google Calendar developer surface
- calendar sync semantics

This is valuable because it defines what a serious external-calendar integration must actually support.

---

## 2. Benchmark source families

### 2.1 `CALDAV (STANDARD)`

This corpus shows the protocol and interchange foundations:

- `iCalendar`
- `iTIP`
- `CalDAV`
- scheduling semantics
- WebDAV ACL patterns

Key lesson:

calendar maturity is not only UI.
It requires:

- stable identity
- recurrence
- scheduling state
- permissions
- incremental retrieval
- conflict-safe writes

### 2.2 `ONECAL` / Google Calendar developer material

This corpus shows:

- Google Calendar API
- CalDAV guide
- Workspace integration patterns

Key lesson:

real calendar integrations require:

- OAuth
- event CRUD
- stable event IDs
- calendar selection
- sync semantics beyond simple export

### 2.3 Outlook and Microsoft expectations

The local `Softs/Kalendarz` corpus is weak on a direct Microsoft benchmark mirror.

So the Microsoft side must be completed from:

- existing repo sync docs
- Graph-oriented planning

Key lesson:

the calendar package must explicitly support both:

- Google
- Outlook / Microsoft 365

even if the benchmark material is asymmetric.

---

## 3. What the benchmark teaches

### 3.1 One time surface, many item classes

The standards imply that serious calendar systems do not think only in "meetings."

A transformation-grade calendar must aggregate:

- events
- deadlines
- milestones
- to-dos
- availability
- change-driven date impacts

For Consultify this means:

- tasks
- decision deadlines
- initiative milestones
- assignments
- adjustments
- external events

must live in one coherent time model.

### 3.2 Scheduling is a state machine

From CalDAV and iTIP lessons:

- organizer and attendee roles matter
- replies and cancellations matter
- scheduling inbox and outbox behavior matters

This means Consultify cannot treat external calendar sync as just reading rows into a month grid.

### 3.3 Free or busy is not the same as workload

The standards help with:

- availability
- event timing

But PMO-grade workload still requires app-level concepts:

- allocation
- ownership
- capacity
- conflict priority

### 3.4 External sync needs durable identity

A mature calendar layer must preserve:

- external event identity
- source system
- sync cursor or checkpoint
- recurrence relation
- edit authority

### 3.5 Privacy and permission gradients matter

The benchmark reinforces that:

- seeing details
- seeing availability
- editing
- scheduling on behalf of others

are different permission levels.

### 3.6 Incremental sync and conflict-safe writes matter

Standards and API surfaces both imply:

- fetch by range
- incremental updates
- conditional writes
- conflict-aware scheduling behavior

This is essential for Outlook and Google parity.

---

## 4. PMO-grade lessons for Consultify

To become a serious transformation calendar, Consultify needs more than standard-compliant sync.

It must also become:

- a single pane of time-bound commitments
- a planning surface for PMO work
- an escalation and review timing surface
- a workload and overload awareness surface

That means a complete product must unify:

- internal planning
- external events
- approval and governance timing
- work materialization from calendar signals

---

## 5. Benchmark-derived requirement areas

### 5.1 Canonical calendar item model

Consultify needs one typed calendar model that can represent:

- task
- decision
- initiative milestone
- meeting
- assignment
- adjustment
- external event

### 5.2 Sync truth model

Consultify needs explicit rules for:

- pull
- push
- bidirectional sync
- import-only
- conflict resolution

### 5.3 Scheduling semantics

Consultify needs to define:

- organizer vs attendee semantics where relevant
- cancellations
- reschedule authority
- review windows

### 5.4 Workload layer

Consultify needs an app-level workload doctrine above raw calendar data.

### 5.5 PMO time overlays

Consultify needs calendar support for:

- milestones
- deadlines
- approvals
- changes or adjustments
- escalation windows

---

## 6. Benchmark conclusion

The local calendar corpus confirms that the current `V1` calendar direction was useful but incomplete.

The real target is:

`a PMO-grade calendar that unifies internal transformation timing with external Outlook and Google reality under one governed time model`

---

## 7. Related canonical docs

- `MYWORK_CALENDAR_V8_READINESS_AUDIT.md`
- `MYWORK_CALENDAR_V8_SSOT.md`
- `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`
- `EXTERNAL_SYNC_READINESS_AUDIT_V8.md`

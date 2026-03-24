# MyWork Calendar v8 - As Is

> Status: Draft v8
> Owner: Product + Engineering
> Scope: current-state interpretation of the existing Consultify calendar runtime, documentation and connector reality

---

## 1. Why this document exists

The current calendar system is real enough to build on, but not yet coherent enough to be called complete.

This document captures the current reality without overclaiming.

---

## 2. What currently exists

Current foundations include:

- `My Work Calendar` UI shell
- unified backend endpoint for internal calendar items
- FullCalendar-based views
- source filters
- create, conflict and reschedule scaffolding
- ICS-style external integration baseline

---

## 3. Internal sources currently represented

The current system already attempts to unify:

- tasks
- initiative milestones
- decisions
- meetings

This is a real strength.

---

## 4. Current external reality

The current calendar documentation and code suggest external support for:

- Google Calendar
- Outlook

But the actual maturity is still partial.

Current reality is closer to:

- ICS-style integration baseline
- settings and connector intent
- no full user-trustworthy Outlook and Google parity yet

---

## 5. Current product weaknesses

### 5.1 External sync overstatement risk

The platform can look more externally synchronized than it really is.

### 5.2 PMO depth gap

Current calendar is still weaker on:

- assignments
- adjustments
- workload
- escalation windows
- richer planning overlays

### 5.3 Multi-surface drift risk

There are multiple calendar-like surfaces in the repo.

Without one V8 contract, they risk diverging in meaning and maintenance.

---

## 6. Honest current-state summary

The calendar is currently:

- more than a mock
- less than a leader-grade PMO calendar

It is a real baseline with strong expansion potential.

---

## 7. Related canonical docs

- `MYWORK_CALENDAR_V8_SSOT.md`
- `MYWORK_CALENDAR_V8_GAP_MATRIX.md`
- `MYWORK_CALENDAR_V8_IMPLEMENTATION_PLAN.md`
- `MYWORK_CALENDAR_V1_SSOT.md`

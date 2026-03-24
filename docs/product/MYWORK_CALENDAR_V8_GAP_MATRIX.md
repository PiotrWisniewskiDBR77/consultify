# MyWork Calendar v8 - Gap Matrix

> Status: Draft v8
> Owner: Product + Engineering
> Scope: explicit gap matrix between the current calendar runtime and the target PMO-grade calendar system

---

## 1. Core gaps

### 1.1 External calendar sync

- `P0 critical`: real Google Calendar OAuth sync path
- `P0 critical`: real Outlook / Microsoft 365 sync path
- `P0 critical`: source-aware external event merge
- `P1 important`: bidirectional event policy
- `P1 important`: recurrence-safe sync handling

### 1.2 PMO planning depth

- `P1 important`: assignments as first-class calendar items
- `P1 important`: adjustments and change-driven date impacts
- `P1 important`: approval and escalation windows
- `P1 important`: richer initiative planning overlays

### 1.3 Workload and capacity

- `P1 important`: overload awareness
- `P1 important`: capacity and assignment density
- `P2 enrichment`: team and portfolio workload views

### 1.4 Conflict and authority

- `P1 important`: reschedule authority model
- `P1 important`: external vs internal date authority
- `P1 important`: conflict classes and visible resolution path

### 1.5 Product coherence

- `P1 important`: one V8 calendar contract across all calendar-like surfaces
- `P1 important`: honest capability labels for Outlook and Google sync
- `P2 enrichment`: stronger operator and support surfaces for calendar sync issues

---

## 2. Gap conclusion

The biggest gaps are not visual.

They are:

- external sync maturity
- PMO timing depth
- workload semantics
- source-of-truth clarity

---

## 3. Related canonical docs

- `MYWORK_CALENDAR_V8_SSOT.md`
- `MYWORK_CALENDAR_V8_AS_IS.md`
- `MYWORK_CALENDAR_V8_IMPLEMENTATION_PLAN.md`
- `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md`

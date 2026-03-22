# Execution On-Time Delivery, Forecasting And Baseline Control v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical doctrine for keeping projects on time through baseline control, variance tracking, critical path, forecast confidence, cadence and recovery-oriented schedule management

---

## 1. Why this document exists

Projects are not delivered on time by watching overdue tasks only.

Leaders such as `Asana`, `Wrike`, `Smartsheet`, `ClickUp` and `Linear` show that on-time delivery depends on a richer execution system:

- baseline truth
- variance visibility
- critical path awareness
- workload realism
- cadence discipline
- recovery before failure becomes final

This document defines that doctrine for `consultify`.

---

## 2. Core statement

`consultify` should manage on-time delivery using one honest schedule-control model:

`baseline -> current reality -> forecast -> intervention -> updated credible path`

Rule:

`the system should never claim a project is on time when baseline, effort or dependency truth is missing`

---

## 3. Canonical schedule-control layers

### 3.1 Baseline truth

The system should preserve:

- baseline start
- baseline end
- baseline milestones
- baseline dependency shape
- baseline capacity assumptions where relevant

Baseline changes should be governed and auditable.

### 3.2 Variance tracking

The system should compute and expose:

- start variance
- finish variance
- milestone variance
- owner-level execution drift
- project-level schedule drift

### 3.3 Current execution reality

The schedule-control layer should factor in:

- overdue work
- blocked work
- pending decisions
- stale work without update
- overloaded owners
- missing estimates
- missing dates or missing baseline

### 3.4 Forecast

The system should estimate whether work is still likely to finish on time using:

- current progress
- workload and availability
- historical throughput or recent completion pattern
- dependency pressure
- unresolved blockers
- decision latency

### 3.5 Confidence and honesty

Forecasts should carry explicit confidence states such as:

- high_confidence
- medium_confidence
- low_confidence
- insufficient_data

---

## 4. Critical path doctrine

The system should support:

- critical path identification
- dynamic critical path updates as dates or dependencies change
- filtering to schedule-driving work only
- showing what downstream dates are affected when critical work slips

Important:

`not every late task is schedule-critical; the system must distinguish between local lateness and path-critical lateness`

---

## 5. Cadence and rollover doctrine

Inspired by `Linear`-style discipline, the system should also understand:

- execution cadence
- carryover pressure
- unfinished work rolling into the next planning window
- whether current throughput rhythm supports the delivery target

This layer should help operators see:

- work that keeps slipping between windows
- chronic overcommitment
- projects that look active but are not truly moving

---

## 6. Timeliness states

At minimum, execution objects should support:

- on_track
- at_risk
- late
- critical_late
- blocked_but_recoverable
- no_baseline
- no_estimate
- insufficient_control_data

---

## 7. Recovery-oriented schedule management

When timeliness degrades, the system should support:

- schedule recovery proposals
- milestone resequencing
- dependency-aware replan options
- escalation to missing decision owners
- balancing proposals when overload is the root cause
- explicit recommendation to rebaseline when reality has structurally changed

---

## 8. Functional additions benchmarked from competitors

The strongest additions `consultify` should explicitly support are:

- baseline start and finish as first-class fields
- variance views across initiative, milestone and project scope
- dynamic critical path updates
- schedule confidence score or confidence class
- portfolio timeline coordination across many initiatives or projects
- workload-aware forecast, not date-only forecast
- carryover or rollover pressure signal
- planned vs actual effort or time comparison where actuals exist
- one drill-down from red schedule signal into the exact causes

---

## 9. AI role in on-time delivery

AI may:

- explain why delivery confidence dropped
- identify the most likely root causes of delay
- propose schedule recovery options
- compare intervention options
- prepare a rebaseline recommendation pack

AI may not:

- silently move deadlines
- silently rebaseline
- silently rewrite the critical path

---

## 10. Acceptance criteria

The package is strong when:

- baseline and variance are visible and honest
- critical path is explicit
- forecasts include confidence, not only dates
- carryover and stale-work pressure are visible
- operators can move from red signal to intervention path quickly

---

## 11. Related canonical docs

- `EXECUTION_MANAGEMENT_BENCHMARK_V8.md`
- `EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`
- `INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md`
- `DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`

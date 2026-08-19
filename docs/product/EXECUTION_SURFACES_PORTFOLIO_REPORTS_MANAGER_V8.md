# Execution Surfaces — Portfolio, Raporty, Manager (V8, superseded target split)

> Status: Superseded in target Menu 2 scope; retained as historical V8 contract and reuse inventory
> Owner: Product + Engineering
> Scope: canonical UX and operating split for the `Execution` module across `Portfolio`, `Raporty` and `Manager`
> Superseded by: [`docs/modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md`](../modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md) for the 2026-08-09 target split `Realizacje / Praca / Zasoby / Sterowanie / Raporty`

---

## 1. Purpose

This document freezes how `Execution` is divided into three operator surfaces:

- `Portfolio`
- `Raporty`
- `Manager`

The goal is to keep one execution runtime while exposing three different ways of working with the same truth:

- inspect the portfolio in motion,
- consume pre-defined delivery reports,
- intervene as a manager/PMO/operator.

Rule:

`Execution` is one operating system with three surfaces, not three separate runtimes.

---

## 2. Core statement

The `Execution` module answers three different user questions:

| Surface | Primary question |
| --- | --- |
| `Portfolio` | What initiatives are currently in execution and what is their state? |
| `Raporty` | What report should I use to understand and communicate delivery health? |
| `Manager` | Where should I intervene today to keep delivery credible? |

The surfaces share:

- the same initiative/task/decision/dependency truth,
- the same workload and baseline/forecast semantics,
- the same intervention vocabulary,
- the same preview/table canon where tabular work is shown.

---

## 3. Shared rules for all three surfaces

### 3.1 One runtime

All three surfaces must read from the same execution truth:

- initiatives,
- tasks,
- decisions,
- dependencies,
- baseline / forecast / variance,
- workload / capacity,
- blockers / risks / aging,
- governed intervention outputs.

No tab may introduce:

- a parallel status family,
- a parallel “reporting-only” work object,
- a separate dependency model,
- a second owner or deadline truth.

### 3.2 Frozen layout rules

Execution surfaces must respect the global UI canon:

- topbar order follows `Filters -> View -> Tool -> Add -> Area`,
- exactly one command row exists under the topbar,
- view icons keep canonical order,
- single click opens preview,
- double click / Enter opens the full detail.

### 3.3 Honest degraded posture

All surfaces must remain honest when data is weak:

- missing baseline is explicit,
- missing estimate is explicit,
- stale data is explicit,
- partial refresh failure is explicit,
- no fake confidence or fake precision.

---

## 4. Surface 1 — Portfolio

### 4.1 Intent

`Portfolio` is the live operating portfolio of initiatives already in execution.

It is not:

- a decorative dashboard,
- a separate planning module,
- a reporting packet generator,
- a PMO intervention cockpit.

### 4.2 User promise

`Portfolio` gives one reliable working list of active initiatives with immediate preview and standard execution views.

### 4.3 Primary objects

- initiative
- owner / assignee
- status
- progress
- alerts
- deadline / forecast finish
- baseline / variance summary
- linked tasks / decisions rollup

### 4.4 Allowed views

`Portfolio` supports:

- `table`
- `kanban`
- `timeline`

Rule:

`Portfolio` does not own calendar/grid-first exploration as its primary promise. It is the portfolio spine, not the report sandbox.

### 4.5 Required UX

#### Table mode

- canonical Outlook-style table + preview,
- single click = preview,
- double click = full detail,
- standard preview anatomy: header -> body -> footer,
- filters and counters live in the one command row.

#### Kanban mode

- grouped by canonical execution status,
- cards support quick status movement where allowed,
- card click opens the same object, not a duplicate view model.

#### Timeline mode

- shows initiative timing, deadlines, forecast windows and timeline warnings,
- must surface schedule truth, not a decorative roadmap,
- timeline interactions must map to governed execution actions only.

### 4.6 Allowed actions

- inspect initiative preview,
- open full initiative detail,
- filter and sort,
- view by table / kanban / timeline,
- perform bounded inline actions already declared in execution truth,
- navigate from initiative to linked work.

### 4.7 Non-goals

`Portfolio` must not become:

- a second Reporting tab,
- a PMO cockpit full of intervention widgets,
- a replacement for the `Initiatives` planning module,
- a custom dashboard builder.

---

## 5. Surface 2 — Raporty

### 5.1 Intent

`Raporty` is the pre-defined reporting layer for execution.

It answers:

- what should PMO see this week,
- what should leaders see this month,
- what should sponsors receive before a governance meeting,
- what execution picture is credible enough to share.

### 5.2 Product rule

`Raporty` is not a second live list of initiatives.

The main object of this tab is:

- a report definition,
- a report run,
- a report audience,
- a reporting cadence,
- a share/export-worthy snapshot built from execution truth.

### 5.3 What belongs here

- pre-defined report catalog,
- execution snapshot cards,
- operational and executive summaries,
- budget variance summaries,
- dependency and blocker summaries,
- delivery confidence summaries,
- generated management packs,
- export / share surfaces.

### 5.4 Required report families

The execution package should support at least:

- Weekly execution pack
- Monthly PMO review
- Program health summary
- Blockers and recovery report
- Milestone slippage report
- Capacity utilization report
- Budget variance report
- Decision backlog and approval aging report
- Cross-initiative dependency report
- Delivery confidence report
- Sponsor-ready one-pager

### 5.5 Report contract

Every report must declare:

- `audience`
- `cadence`
- `scope`
- `data sources`
- `mandatory sections`
- `RAG / confidence logic`
- `expected follow-up actions`

Detailed implementation contract:

- `docs/product/EXECUTION_REPORT_TEMPLATES_P03_V8.md`

### 5.6 Allowed actions

- open a pre-defined report,
- filter report scope,
- generate / refresh a report run,
- export or share,
- jump from report insight to underlying initiative/work object,
- trigger a governed follow-up if the report exposes a clear issue.

### 5.7 Non-goals

`Raporty` must not become:

- a second portfolio table,
- a generic BI builder,
- a place where users directly manage initiative execution,
- a duplicate of the global `Reports` module without execution-specific value.

---

## 6. Surface 3 — Manager

### 6.1 Intent

`Manager` is the operator cockpit for interventions, balancing and execution control.

This is the surface for PMO / manager / operator work.

It answers:

- where is delivery under stress,
- who is overloaded or underused,
- what is blocked,
- what is missing,
- what should be escalated,
- what intervention should happen next.

### 6.2 Primary promise

`Manager` should not stop at visibility.

It must support:

- detect,
- drill down,
- recommend,
- intervene,
- verify post-write coherence.

### 6.3 Required sections

#### A. Manager KPIs

Top summary cards should cover:

- workload changes,
- overdue approvals / decisions,
- KPI alerts without plan,
- blocked work count,
- missing dates / missing owner count where relevant.

#### B. Action Center

One prioritized intervention queue showing what needs action now, including:

- blocked items,
- overdue decisions,
- missing dates,
- due soon / late items,
- stale work,
- unresolved risk without mitigation.

#### C. Resource management

Capacity and balancing must support:

- day / week / month windows,
- per-person and per-team view,
- overload and underload signals,
- capacity horizon,
- team average and distribution insight,
- intervention-ready drill-down.

#### D. Execution risk

The cockpit must surface:

- blockers,
- dependency risk,
- timeline risk,
- missing baseline,
- missing estimate,
- aging / stale work,
- decision-latency risk,
- KPI drift without plan.

#### E. Intervention suggestions

The system should suggest bounded actions such as:

- `reassign`
- `smooth`
- `replan`
- `escalate`

Suggestions must always state:

- why this suggestion exists,
- what is expected to improve,
- what will be refreshed after the action,
- what the operator should verify.

### 6.4 Manager workflow

Canonical manager loop:

1. Detect the exception.
2. Open drill-down.
3. Understand `why`.
4. See `what next`.
5. Execute a bounded intervention.
6. Verify post-write coherence across summary and detail.

### 6.5 What makes Manager good

The strongest manager surface behaves like a serious PMO cockpit:

- exception-based, not everything-based,
- prioritizes the next move,
- connects capacity and deadlines,
- connects blockers and blast radius,
- shows who must act,
- keeps a clear escalation path,
- stays honest when data quality is weak.

### 6.6 Non-goals

`Manager` must not become:

- a passive dashboard wall,
- a broad HR workspace detached from execution,
- a duplicate of the `Portfolio` list,
- a generic “people change” sandbox without execution accountability,
- a place for silent AI mutations.

---

## 7. What we import from ClickUp and monday.com

### 7.1 ClickUp-inspired lessons

We import:

- portfolio visibility,
- actionable dashboards,
- workload over time,
- dependency-first execution logic,
- tight connection between timeline, workload and task movement.

We do not import:

- ClickUp UI patterns as-is,
- unbounded dashboard sprawl,
- vendor-specific object naming.

### 7.2 monday.com-inspired lessons

We import:

- portfolio aggregation,
- workload widgets with capacity logic,
- connected reporting across many boards/surfaces,
- timeline as a first-class execution signal,
- standardized execution fields enabling shared reporting.

We do not import:

- board-centric duplication of the same truth,
- reporting detached from operating action,
- UI parity for its own sake.

---

## 8. Best-practice PMO and manager moves

The execution package should help strong PMO and managers do the following consistently:

- maintain clean ownership, dates and next steps,
- review exceptions weekly, not every row equally,
- track baseline vs forecast honestly,
- manage approvals and decisions as delivery constraints,
- rebalance overloaded people before deadlines collapse,
- surface missing dates and missing baselines early,
- clear blockers with explicit blast radius,
- escalate only what needs escalation,
- use confidence and risk signals, not only progress percent,
- convert unresolved risk into governed action,
- keep reports audience-specific and cadence-driven.

---

## 9. Relationship to adjacent modules

### 9.1 `Initiatives`

`Initiatives` owns initiative planning, shaping and broader lifecycle governance.

`Execution` owns living delivery control once work is active.

Rule:

`Execution` may show portfolio rollups and bounded write actions, but it must not absorb the full planning runtime of Initiatives.

### 9.2 `Reports`

The global `Reports` module remains the broader reporting system.

`Execution -> Raporty` is the execution-specific reporting surface built on execution truth, with a fixed catalog of operating reports.

### 9.3 `KPI`, `Finance`, `Calendar`

These modules remain authoritative for their own objects.

`Execution` can consume their signals or summaries, but must not recreate their runtime as shadow copies.

---

## 10. Acceptance checklist

1. `Execution` is explicitly split into `Portfolio`, `Raporty`, `Manager`.
2. `Portfolio` is the live initiative portfolio and uses canonical table + preview.
3. `Raporty` is a report surface, not a second initiative list.
4. `Manager` is an intervention cockpit, not a decorative dashboard.
5. All three surfaces read from one execution truth.
6. No surface duplicates initiative-planning ownership from `Initiatives`.
7. Manager suggestions map only to bounded interventions.
8. Reporting outputs declare audience and cadence.
9. Workload, blockers and baseline honesty remain explicit across the split.
10. The split stays compliant with frozen layouts and command-row rules.

---

## 11. Related canonical docs

- `docs/product/EXECUTION_MANAGEMENT_BENCHMARK_V8.md`
- `docs/product/DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`
- `docs/product/REPORTING_CANONICAL_TEMPLATES.md`
- `docs/product/PROJECT_MANAGEMENT_V8_BENCHMARK.md`
- `docs/product/EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_03_WDROZENIA_2026-03-29.md`

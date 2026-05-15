# Execution Report Templates - P03 Wdrozenia V8

> Status: Canonical implementation spec  
> Owner: Product + Engineering  
> Scope: precise contract for `Execution > Raporty` inside P03 `Wdrozenia`

---

## 1. Purpose

This document defines exactly what each execution report in P03 must contain.

It exists to prevent three failure modes:

- decorative reporting with no operational value,
- reports that duplicate the live portfolio instead of summarizing it,
- ambiguous implementation where frontend, backend, and AI all guess different contracts.

Rule:

`Execution > Raporty` is a pre-defined execution reporting layer built from the same runtime truth as `Portfolio` and `Manager`.

It is not:

- a second initiative list,
- a generic BI canvas,
- a dashboard wall,
- a PM suite replacement.

---

## 2. Report doctrine

Every report in P03 must answer a real execution question:

- what is blocked,
- what is late,
- what is overloaded,
- what decision is missing,
- what initiative is no longer credible,
- what PMO / sponsor / manager should do next.

Every report must be:

- audience-specific,
- cadence-specific,
- bounded to one working purpose,
- actionable,
- honest when data is weak.

Every report must end in action, not just visibility.

---

## 3. Common report shell

Each report should use the same shell, but the body must differ per report type.

### 3.1 Header

The header must always show:

- report title,
- audience,
- cadence,
- scope,
- last refresh timestamp,
- RAG / confidence status.

### 3.2 Highlights strip

The highlights strip must show 2-6 signals only.

Allowed highlight types:

- blocked count,
- overdue tasks count,
- overdue decisions count,
- missing dates count,
- progress percent,
- overspend exception count,
- capacity alert count,
- timeline warning count.

Rule:

Highlights are not decorative KPIs. They must summarize the exact operational reason to open the report.

### 3.3 Main body

The report body must be made of explicit operational sections:

- tables,
- ranked exception lists,
- grouped issue queues,
- narrowly scoped summary blocks.

Avoid:

- long narrative paragraphs,
- marketing language,
- generic health cards with no drill-down value.

### 3.4 AI blocks

Every report may contain exactly two AI blocks:

- `AI Executive Readout`
- `AI Recommended Actions`

AI must not invent new truths.

AI may only:

- summarize what the runtime already shows,
- prioritize the most important exceptions,
- convert visible issues into next actions.

AI must not:

- estimate facts missing from source data,
- hide degraded posture,
- rewrite status truth,
- create fake precision.

### 3.5 Data quality footer

Every report must end with explicit trust posture:

- freshness,
- degraded flags,
- missing baseline,
- missing estimate / due dates,
- known limitations.

---

## 4. Runtime data sources

Implementation must use the execution runtime fields below as the primary input contract.

### 4.1 Core sources

From the current `ReportDataContext`:

- `initiatives`
- `tasks`
- `decisions`
- `blocked`
- `riskSignals`
- `delaySignals`
- `overdueDecisions`
- `missingDates`
- `dueSoonTasks`
- `overspendSignals`
- `nextMilestones`
- `priorityAlerts`
- `timelineWarnings`
- `capacityAlerts`
- `capacityTimeline`
- `phaseLabel`
- `progressPercent`
- `totalInitiatives`
- `lastRefreshAt`

### 4.2 Source-to-meaning map

| Runtime field | Meaning in reports | Typical use |
| --- | --- | --- |
| `initiatives` | current execution initiatives | per-initiative rows, owners, health, target date |
| `tasks` | task execution truth | overdue work, due soon, assignee load, missing due date |
| `decisions` | decision and approval truth | pending queue, aging, initiative blocked by decision |
| `blocked` | explicit blocked initiatives | blockers reports, sponsor asks, recovery packs |
| `riskSignals` | execution risk signals | health, confidence, steering summaries |
| `delaySignals` | timing drift signals | slippage and forecasting reports |
| `overdueDecisions` | decision debt already late | weekly pack, backlog, sponsor escalation |
| `missingDates` | initiatives without credible timing | degraded posture, PMO exceptions |
| `dueSoonTasks` | near-term execution load | weekly pack, capacity, focus windows |
| `overspendSignals` | budget / spend exceptions | finance and PMO reports |
| `nextMilestones` | upcoming milestone-like target markers | weekly, PMO, sponsor, slippage |
| `priorityAlerts` | portfolio-level control tower alerts | steering and recovery framing |
| `timelineWarnings` | governed schedule warnings | slippage, dependency, PMO review |
| `capacityAlerts` | governed overload / staffing warnings | workload and PMO review |
| `capacityTimeline` | forward capacity horizon | workload balancing and next 4 weeks |

Rule:

If a report cannot be grounded in at least one of the runtime fields above, it does not belong in P03.

---

## 5. Template catalog

The fixed execution report catalog contains 11 reports:

1. `Weekly Execution Pack`
2. `Monthly PMO Review`
3. `Program Health Summary`
4. `Blockers & Recovery Report`
5. `Milestone Slippage Report`
6. `Capacity Utilization Report`
7. `Budget Variance Report`
8. `Decision Backlog & Approval Aging`
9. `Cross-Initiative Dependency Report`
10. `Delivery Confidence Report`
11. `Sponsor-Ready One-Pager`

---

## 6. Detailed report specs

## 6.1 Weekly Execution Pack

### Audience

- PMO
- Team leads
- Delivery leads

### Cadence

- weekly

### Primary question

- what needs intervention in the next 7 days?

### Main use

- weekly operating review
- Monday execution sync
- short-horizon delivery control

### Must show

- initiatives needing action this week,
- due soon tasks,
- overdue tasks,
- overdue decisions,
- near-term milestones,
- operational hygiene gaps.

### Required sections

#### A. This week at a glance

Purpose:

- show the initiatives that need action now.

Rows must include:

- initiative name,
- owner,
- open tasks,
- overdue tasks,
- pending decisions,
- overdue decisions,
- main issue,
- target date.

#### B. Next 7 days focus

Purpose:

- show work that can quietly slip this week.

Rows must include:

- task or milestone name,
- initiative,
- owner,
- due date,
- urgency reason.

#### C. Decision queue this week

Purpose:

- show decisions that block execution in the weekly horizon.

Rows must include:

- decision title,
- initiative,
- owner,
- age,
- due date,
- blocking impact.

#### D. Execution hygiene gaps

Purpose:

- show weak execution discipline that makes weekly control unreliable.

Must include:

- initiatives without dates,
- open tasks without owner,
- open tasks without due date,
- items missing baseline where applicable.

### AI role

`AI Executive Readout` should:

- name the 2-3 most urgent weekly risks,
- explain what will slip first,
- state if the week is blocked by decisions, dates, or resource load.

`AI Recommended Actions` should:

- assign concrete actions for the next 2-5 days,
- identify owner,
- identify deadline,
- state expected effect.

### Data sources

- `initiatives`
- `tasks`
- `decisions`
- `overdueDecisions`
- `dueSoonTasks`
- `nextMilestones`
- `missingDates`

---

## 6.2 Monthly PMO Review

### Audience

- PMO director
- sponsors
- portfolio governance

### Cadence

- monthly

### Primary question

- where is the portfolio becoming non-credible and what needs PMO action this month?

### Main use

- monthly PMO review
- rebaseline discussion
- governance exception review

### Required sections

#### A. Portfolio control list

Rows must include:

- initiative,
- health,
- progress,
- owner,
- target date,
- confidence score or equivalent credibility cue.

#### B. Milestone and schedule exceptions

Must include:

- timeline warnings,
- slipped targets,
- governed schedule exceptions,
- high-risk upcoming milestones.

#### C. Budget and staffing exceptions

Must include:

- overspend signals,
- capacity alerts,
- overloaded roles,
- initiatives where spend and delivery stress appear together.

#### D. Governance exceptions

Must include:

- blocked initiatives,
- overdue decisions,
- missing dates,
- items requiring sponsor or steering escalation.

### AI role

AI should:

- summarize the 3-5 exceptions that justify PMO attention,
- recommend rebaseline / rebalance / escalation actions,
- explicitly mention where data quality weakens confidence.

### Data sources

- `initiatives`
- `nextMilestones`
- `timelineWarnings`
- `overspendSignals`
- `capacityAlerts`
- `blocked`
- `overdueDecisions`
- `missingDates`

---

## 6.3 Program Health Summary

### Audience

- steering committee
- PMO leadership

### Cadence

- bi-weekly

### Primary question

- which initiatives are healthy, which are deteriorating, and what should steering decide?

### Required sections

#### A. Program health register

Rows must include:

- initiative,
- status,
- health,
- confidence,
- primary issue.

#### B. Risk and delay drivers

Must include:

- top risk signals,
- top delay signals,
- severity,
- affected initiative.

#### C. What is turning red

Must include:

- initiatives with low confidence,
- blocked work,
- overdue tasks,
- overdue decisions,
- missing dates if they materially degrade control.

#### D. Steering implications

Must convert report insights into:

- decisions needed,
- approvals needed,
- reallocations or governance actions.

### AI role

AI should:

- identify the few initiatives that most threaten portfolio credibility,
- explain why confidence is dropping,
- convert that into steering-level actions.

### Data sources

- `initiatives`
- `riskSignals`
- `delaySignals`
- `blocked`
- `priorityAlerts`
- `overdueDecisions`

---

## 6.4 Blockers & Recovery Report

### Audience

- PMO
- delivery managers
- execution operators

### Cadence

- on demand

### Primary question

- what is blocked, what else is stalled behind it, and how do we recover?

### Required sections

#### A. Blocked initiatives recovery board

Rows must include:

- initiative,
- owner,
- blocked reason,
- open tasks count,
- overdue tasks count,
- pending decisions count,
- overdue decisions count.

#### B. Tasks stalled behind blockers

Rows must include:

- task,
- initiative,
- owner,
- due date,
- whether task is already overdue.

#### C. Escalation path

Must include:

- overdue decisions attached to blocked initiatives,
- priority alerts linked to blocked work,
- explicit escalation candidates.

#### D. Recovery options

Must show:

- unblock actions,
- owner,
- target date,
- expected effect.

### AI role

AI should:

- summarize blast radius,
- identify fastest unblock path,
- distinguish between operational unblock, sponsor escalation, and date cleanup.

### Data sources

- `blocked`
- `tasks`
- `decisions`
- `overdueDecisions`
- `priorityAlerts`

---

## 6.5 Milestone Slippage Report

### Audience

- PMO
- sponsors

### Cadence

- weekly

### Primary question

- which initiatives are slipping against committed dates and why?

### Required sections

#### A. Slippage register

Rows must include:

- initiative,
- target date,
- delay signal count,
- timeline warning count.

#### B. Baseline vs forecast gaps

Must include:

- overdue target dates,
- missing dates,
- timeline warnings,
- missing baseline posture where relevant.

#### C. Next milestones at risk

Rows must include:

- milestone,
- initiative,
- target date,
- linked schedule issue.

#### D. Recovery timeline

Must describe:

- what to replan,
- what to escalate,
- what to re-sequence.

### AI role

AI should:

- explain whether slippage comes from blockers, dependency drift, or data weakness,
- propose immediate recovery moves,
- state if the timeline is not credible enough to trust.

### Data sources

- `nextMilestones`
- `delaySignals`
- `timelineWarnings`
- `missingDates`
- `initiatives`

---

## 6.6 Capacity Utilization Report

### Audience

- resource managers
- PMO
- delivery leads

### Cadence

- monthly

### Primary question

- who is overloaded, who has spare capacity, and what work should move?

### Required sections

#### A. Governed capacity alerts

Rows must include:

- person,
- allocated hours,
- capacity hours,
- overload hours,
- suggested action.

#### B. Task load by assignee

Rows must include:

- assignee,
- open task count,
- overdue task count,
- tasks due in 4 weeks.

#### C. 4-week horizon

Rows must include:

- week start,
- allocated capacity,
- total capacity,
- free / deficit capacity.

#### D. Tasks to reassign

Rows must include:

- task,
- current owner,
- initiative,
- due date.

### AI role

AI should:

- identify which overloads are structural vs temporary,
- recommend reassignment or smoothing,
- point out if the horizon is already over-committed.

### Data sources

- `tasks`
- `capacityAlerts`
- `capacityTimeline`
- `dueSoonTasks`

---

## 6.7 Budget Variance Report

### Audience

- finance
- sponsors
- PMO

### Cadence

- monthly

### Primary question

- where do budget exceptions already affect execution credibility?

### Required sections

#### A. Overspend register

Rows must include:

- initiative,
- signal type,
- planned amount,
- actual amount,
- variance percent.

#### B. Execution impact of spend variance

Rows must include:

- initiative,
- blocked state,
- overdue tasks,
- overdue decisions,
- progress.

#### C. Work items inside overspending initiatives

Rows must include:

- task,
- initiative,
- owner,
- due date.

#### D. Finance actions

Must show:

- validate signal,
- freeze / reallocate / approve,
- owner,
- deadline.

### AI role

AI should:

- distinguish financial noise from true execution risk,
- identify where overspend and delivery degradation appear together,
- recommend concrete finance-side follow-up.

### Data sources

- `overspendSignals`
- `initiatives`
- `tasks`
- `blocked`
- `overdueDecisions`

---

## 6.8 Decision Backlog & Approval Aging

### Audience

- PMO
- decision owners
- sponsors when escalation is needed

### Cadence

- weekly

### Primary question

- which decisions are aging, and which initiatives are waiting on them?

### Required sections

#### A. Pending decisions queue

Rows must include:

- decision,
- initiative,
- owner,
- age,
- priority.

#### B. Aging buckets

Must include:

- `0-7d`
- `8-14d`
- `15d+`

#### C. Initiatives waiting on decisions

Rows must include:

- initiative,
- pending decisions,
- overdue decisions,
- blocked state.

#### D. Escalation candidates

Must show:

- which items need escalation now,
- who should decide,
- expected unblock effect.

### AI role

AI should:

- identify which decisions create the most delivery drag,
- recommend escalation ordering,
- highlight where decision debt has already become blocker debt.

### Data sources

- `decisions`
- `overdueDecisions`
- `initiatives`
- `blocked`

---

## 6.9 Cross-Initiative Dependency Report

### Audience

- PMO
- architects
- delivery leadership

### Cadence

- bi-weekly

### Primary question

- where do dependencies create cascade risk across initiatives?

### Required sections

#### A. Dependency conflict register

Rows must include:

- initiative,
- severity,
- issue message.

Source:

- dependency-type `timelineWarnings`

#### B. Critical chains

Rows must include:

- initiative,
- tasks due soon,
- pending decisions,
- warning count.

#### C. Broken links

Rows must include:

- initiative,
- blocked state,
- overdue tasks,
- next milestone.

#### D. Upstream / downstream impact

Must explain:

- what else gets hit next,
- which initiatives are upstream risk carriers,
- where governance should intervene.

### AI role

AI should:

- summarize the strongest cascade risks,
- point to the first link to repair,
- avoid pretending a full dependency graph if only bounded warnings exist.

### Data sources

- `timelineWarnings`
- `nextMilestones`
- `initiatives`
- `tasks`
- `decisions`
- `blocked`

---

## 6.10 Delivery Confidence Report

### Audience

- steering committee
- sponsors
- PMO

### Cadence

- monthly

### Primary question

- how credible is delivery, and what is eroding that credibility?

### Required sections

#### A. Confidence register

Rows must include:

- initiative,
- confidence,
- blocked state,
- high-risk count,
- overdue decision count.

#### B. Drivers of erosion

Must include:

- priority alerts,
- risk signals,
- delay signals,
- data-quality issues where they materially reduce trust.

#### C. Scenario outlook

Must explain:

- what happens if no action is taken,
- what could recover confidence fastest.

### AI role

AI should:

- summarize top confidence erosions,
- explain whether the problem is delivery reality or reporting weakness,
- propose the smallest set of actions that would improve confidence.

### Data sources

- `initiatives`
- `priorityAlerts`
- `riskSignals`
- `delaySignals`
- `blocked`
- `missingDates`
- `overdueDecisions`

---

## 6.11 Sponsor-Ready One-Pager

### Audience

- executive sponsors

### Cadence

- on demand

### Primary question

- what should a sponsor know, celebrate, decide, or unblock right now?

### Required sections

#### A. Sponsor summary

Must contain:

- concise state of execution,
- explicit sponsor-relevant risk,
- no PMO jargon overload.

#### B. Initiatives needing sponsor attention

Rows must include:

- initiative,
- why sponsor attention is needed,
- owner,
- target date.

#### C. Top achievements

Rows must include:

- initiative,
- progress,
- owner,
- next milestone.

#### D. Sponsor asks

Must show:

- decision or unblock needed,
- owner,
- by when,
- expected effect.

### AI role

AI should:

- compress the situation into executive language,
- separate "good news" from "need sponsor action",
- avoid operational noise not relevant to sponsor decisions.

### Data sources

- `initiatives`
- `blocked`
- `overdueDecisions`
- `overspendSignals`
- `nextMilestones`
- `progressPercent`

---

## 7. Report behavior rules

### 7.1 Open behavior

Each report should:

- open from the fixed report catalog,
- open as a dynamic execution document,
- keep stable report identity per template,
- allow navigation back to live work where appropriate.

### 7.2 Filtering behavior

The `Raporty` command row may filter by:

- `ALL`
- `Weekly`
- `Monthly`
- `Bi-weekly`
- `On demand`
- optional audience shortcut such as `Sponsor`

Filters must never turn `Raporty` into a second initiative table.

### 7.3 Export behavior

Export must include:

- header contract,
- highlights,
- main body sections,
- AI readout,
- AI actions,
- data quality posture.

Export must not degrade into:

- title only,
- contract only,
- highlights-only cards.

---

## 8. Implementation acceptance checklist

This report spec is implemented only when all items below are true:

- each of the 11 reports has a distinct working purpose,
- each report has bounded, explicit sections,
- each section maps to real runtime data,
- report body shows concrete initiative/task/decision rows where appropriate,
- AI only summarizes and prioritizes existing truth,
- data-quality posture is explicit,
- exports preserve operational content,
- `Raporty` remains a reporting surface, not a duplicate of `Portfolio`.

---

## 9. Related canonical docs

- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_03_WDROZENIA_2026-03-29.md`
- `docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`
- `docs/product/DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`

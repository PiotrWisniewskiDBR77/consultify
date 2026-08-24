# Results — final owner implementation specification

Date: `2026-08-23`  
Module: `Results`  
Scope: `KPI`, `OKR`, `ROI`  
Status: `OWNER_REQUIREMENTS_CAPTURED / IMPLEMENTATION_REQUIRED / NOT_ACCEPTED`  
Owner: Piotr Wisniewski  
Purpose: final owner entry closing the analysis phase and making the module ready for implementation planning.

## 1. Binding outcome

Results is one module containing three distinct management tools. They share the
Consultify shell and interaction standards, but they must not be implemented as
one generic record type or three copies of the same form.

| Tool | Management question | Primary object | Operating rhythm |
|---|---|---|---|
| KPI | Are we achieving the intended result, why are we outside the expected range, and what must change? | KPI | continuous/periodic measurement and exception response |
| OKR | What limited set of outcomes are we pursuing in this cycle, and how confident are we that we will achieve them? | OKR Set containing Objectives and Key Results | cycle, regular check-in, review and reflection |
| ROI | Is an investment worth approving or continuing, and did the promised value actually materialize? | ROI Case bound to an Initiative | business case, decision, realization and post-investment review |

The common product path is:

```text
registry table -> standard preview -> full tool -> governed command -> durable readback
```

Every tool must provide a complete create/edit/review path. A populated sample
table is review evidence only; it is not proof that the product workflow exists.

## 2. Shared Results shell

### 2.1 Navigation

- Menu 1 remains the global application navigation.
- Menu 2 is exactly: `Search | KPI | OKR | ROI`.
- The active domain is visually explicit.
- The right-hand primary action changes with the domain: `New KPI`, `New OKR`,
  `New ROI`.
- Menu 3 contains statuses, useful filters, view controls, bulk mode and tabs of
  objects opened in the current workspace. It must not expose backend entities,
  disabled lifecycle encyclopedias or alternative routes to the same action.
- Opening a row keeps the registry context. Preview opens on the right; `Open`
  opens the full tool in a third-menu workspace tab.

### 2.2 Registry tables

All three registries use `StandardModuleBar`, `StandardTable`,
`TableWithPreviewLayout`, `StandardPreview`, canonical chips, spacing, typography,
focus, keyboard and row-selection behavior.

Shared rules:

- headers remain visible in loading, empty and error states;
- table columns are domain-specific, not forced into one schema;
- row selection and the kebab are separate hit targets;
- the selected row remains highlighted while preview is open;
- filters and counts use the same authorized read model and must not leak hidden
  records;
- preview runs from below Menu 3 to the bottom of the viewport and follows the
  approved width/spacing standard;
- light/dark themes, PL/EN, desktop/tablet, keyboard and screen-reader states are
  part of acceptance, not later polish.

### 2.3 Preview and row menu

Preview answers only: what is this, what is its present state, why does it need
attention and what is the safe next action. It is not a compressed editor.

The row menu contains:

1. `Open` / `Open full tool` — one canonical navigation path;
2. at most one to three commands currently executable for this record and user;
3. `Open preview` when needed;
4. `Archive` only when permitted and meaningful.

Do not show unavailable transitions with technical explanations. Backend returns
`available_commands`; UI renders only allowed commands. KPI's currently reviewed
kebab and preview are accepted as the visual reference. The oversized OKR and
ROI menus are rejected and must be replaced by this rule.

### 2.4 Creation standard

Each `New …` action opens a domain-specific guided creator. The creator supports:

- manual entry;
- AI-assisted draft from a short business premise;
- selection of governed sources and relations;
- save as draft and resume;
- field-level validation and plain-language correction;
- preview before submission;
- explicit submit/approval where policy requires it;
- post-write readback using the newly created stable ID.

AI may propose content, formulas, owners, thresholds, KRs, assumptions or risks.
It never invents measurements/actuals, silently changes truth, approves its own
proposal or bypasses permissions. Every AI proposal is distinguishable from
accepted human content.

### 2.5 Shared technical path

```text
authenticated identity + organization context
  -> domain visibility policy
  -> typed command and expected row version
  -> authorization and maker-checker validation
  -> transactional domain write
  -> append-only event/outbox/audit record
  -> Results/MyWork/Decisions/Initiatives/Execution projections
  -> canonical query readback
  -> UI confirmation or actionable conflict/error
```

No domain may write through fixture-only routes, URL sample-data flags, browser
local state or legacy archive tables. Fixtures remain deterministic local/demo
reconstruction assets.

## 3. KPI tool

### 3.1 Purpose and registry

KPI is the operational performance-management system, not a passive dashboard.
The top-level owner-approved registry is a list of individual KPIs. Scorecards
remain saved governance views grouping references to those KPIs without copying
definitions or measurements.

Recommended table columns:

`KPI | status | current vs target | trend | data quality/freshness | owner | process/scope | next obligation | updated`

Status must not collapse four independent concepts:

- definition lifecycle;
- performance state (`safe`, `warning`, `critical`);
- data quality (`verified`, `provisional`, `missing`, `disputed`);
- freshness/measurement obligation.

### 3.2 New KPI creator

The creator collects or proposes:

1. name/code and concise business meaning;
2. linked business objective and organizational/process scope;
3. KPI category: strategic, operational or functional; leading or lagging;
4. exact definition, formula, unit and desired direction;
5. aggregation and time-period semantics;
6. baseline, target/range, warning and critical thresholds;
7. reporting frequency and measurement calendar;
8. data source, source owner, evidence requirements and freshness rule;
9. accountable KPI owner and reviewers;
10. scorecards and optional typed Initiative/ROI relations;
11. deviation response policy and materiality/maker-checker rule.

The creator must prevent approval if formula, unit, target, owner, cadence or
source is ambiguous. Draft creation may be incomplete; activation may not.

### 3.3 Full KPI card

Header:

- name and business meaning;
- current value against target/range;
- measurement period and trend;
- performance, data-quality and freshness states displayed separately;
- owner, scope and next obligation;
- one context-specific primary action.

Work areas:

1. **Performance** — actual vs target series, prior-period comparison,
   seasonality/context and exception-first summary.
2. **Measurements** — append-only records containing period, value, source,
   evidence, quality, actor and timestamp; correction is a linked record, not
   silent overwrite.
3. **Deviation and recovery** — variance, explanation, root cause, corrective
   plan, owner, due date, evidence and escalation.
4. **Contract** — current approved definition plus versioned formula, unit,
   thresholds, cadence, source and ownership.
5. **Relations** — scorecards, process, relevant objectives, Initiative impact,
   ROI benefit evidence and Execution action/receipt.
6. **History and lineage** — approvals, definition revisions, measurements,
   corrections, decisions and effectiveness verification.

### 3.4 KPI lifecycle and backend

```text
draft definition -> submit -> independent approval -> active
-> record measurement -> evaluate thresholds
-> if out of band: deviation -> root cause -> corrective plan
-> Initiative/Execution action where needed -> remeasure
-> verify effectiveness -> close or continue/escalate
```

Backend responsibilities:

- stable central KPI identity and versioned definition;
- scorecard membership by reference;
- append-only measurements and correction lineage;
- deterministic evaluation from the approved definition;
- idempotent obligation/deviation generation;
- typed evidence and Execution receipt references;
- visibility by scope/management chain;
- immutable review snapshots and audit history.

An underperforming KPI can create a small corrective action or propose a larger
Initiative. Completion of an action does not automatically prove KPI recovery;
only the subsequent governed measurement and effectiveness review do.

## 4. OKR tool

### 4.1 Purpose and registry

OKR manages ambition, focus, alignment, conversation and learning. It is not a
KPI clone, project plan, task list or employee rating system.

The top-level row is a materialized `OKR Set`:

```text
OKR Set = Program + Cycle + organizational scope + accountable owner
```

Recommended columns:

`OKR Set | status | scope | owner | progress | confidence | attention | last/next check-in | updated`

Progress, confidence, lifecycle and attention are separate values.

### 4.2 New OKR creator

`New OKR` starts a guided Set creator while the backend creates the governed Set
aggregate. Steps:

1. choose Program, Cycle, scope, owner and reviewer;
2. define the Set title and purpose;
3. draft one to three outcome-oriented Objectives;
4. define two to four measurable Key Results per Objective;
5. for every KR specify baseline, target, current-value method, unit, data source,
   cadence and owner;
6. set committed/aspirational character where policy permits;
7. add optional, explicit `contributes_to`, `supported_by` and `measured_by`
   relations without status inheritance;
8. configure visibility and check-in obligations;
9. run AI quality analysis for task-like wording, missing measurability,
   duplication, overloading and weak alignment;
10. preview, submit and approve/launch according to Program policy.

### 4.3 Full OKR card

Header:

- Set name, owner and scope;
- Program and Cycle;
- lifecycle, overall progress, confidence and attention separately;
- last and next check-in;
- one current CTA (`Continue drafting`, `Submit`, `Check in`, `Review` or
  `Reflect`).

Primary surface:

1. **Objectives and KRs** — Objectives as large sections; each KR shows baseline,
   current, target, progress, confidence, freshness, owner and support need.
2. **Check-in** — new value, evidence/source, confidence, narrative of what
   changed, blocker, support request and next commitment.
3. **Attention** — missed check-ins, falling confidence, blocked dependencies,
   required decision and owner obligations.
4. **Alignment** — typed contextual relationships, never automatic score/status
   propagation.
5. **Conversation and support** — comments, manager response, decisions and
   recognition connected to the same Set.
6. **Review and reflection** — final grade, outcome, learning and explicit choice:
   close, carry forward, rewrite or stop.
7. **History** — versioned text, approvals, check-ins and reviews.

Program and Cycle administration may be reached from settings/administration;
they are not competing row-menu destinations.

### 4.4 OKR lifecycle and backend

```text
Program/Cycle -> required/draft Set -> Objectives/KRs
-> submit -> review/approve -> active
-> recurring check-ins and support -> cycle review
-> grade/reflection -> close and learn
```

Backend responsibilities:

- distinct Program, Cycle, Set, Objective, KR, CheckIn, Review and Reflection
  records;
- policy version pinned to the Cycle/Set;
- typed KR measurement method and source;
- append-only check-ins with previous/current values;
- idempotent check-in/review obligations;
- open-organization visibility by default with governed override;
- owner/manager separation without overwriting the author's check-in;
- explicit alignment edges without implicit roll-up or lifecycle inheritance.

## 5. ROI tool

### 5.1 Purpose and registry

ROI is a governed investment case and benefits-realization dossier. It is not a
standalone percentage calculator and must not create a competing financial truth
beside Finance.

Every new ROI Case is bound 1:1 to an Initiative. Its lifecycle remains
independent: an Initiative may finish while benefit realization continues.

Recommended columns:

`ROI Case/Initiative | phase/status | owner/sponsor | currency | approved vs forecast vs actual | ROI/NPV/payback | evidence/confidence | next action | updated`

Missing metrics are shown as unknown/not calculated, never as zero.

### 5.2 New ROI creator

Steps:

1. choose/create the Initiative, owner, sponsor, reviewers and access policy;
2. define problem, strategic fit, decision question and do-nothing/BAU baseline;
3. define analysis period, currency, granularity, discount/cost-of-capital policy
   and calculation policy version;
4. compare feasible options and select the preferred option with rationale;
5. capture one-time, recurring, direct, indirect and internal-labour cost lines;
6. capture financial benefits, savings and cost avoidance separately, plus
   non-financial benefits without forced monetization;
7. assign owners, timing, ramp, evidence, confidence and double-counting groups;
8. define assumptions with downside/base/upside values and sensitivity rank;
9. generate deterministic period cash flows and ROI, NPV, IRR, payback and
   break-even where inputs support them;
10. review scenarios, risks, affordability and evidence gaps;
11. save draft, submit a versioned decision pack and obtain independent approval.

### 5.3 Full ROI card

Persistent executive header:

- Initiative, sponsor, owner and phase;
- next decision/action and deadline;
- Original Approved, Current Forecast and Actual shown side by side;
- ROI, NPV, IRR, payback and investment only where calculable;
- evidence quality/confidence, main downside and risk;
- model version and as-of date;
- one current CTA.

Four work phases:

1. **Build Case** — executive case, BAU, options, theory of change, assumptions,
   costs, benefits, scenarios, cash flow, sensitivity, funding and risks.
2. **Decision** — decision question, recommendation, option comparison,
   downside/base/upside, material assumptions, evidence gaps, affordability,
   reviewer comments and approve/request changes/reject.
3. **Realize Value** — immutable approved baseline vs forecast versions vs
   append-only actuals, benefit owners, variance bridge, KPI/Finance
   reconciliation, overdue obligations and intervention/rebaseline proposal.
4. **Learn** — post-investment review, forecast accuracy, realized/partial/
   unrealized benefits, unexpected costs/benefits, attribution/contribution,
   reusable lessons and governed closure/waiver.

### 5.4 ROI lifecycle and backend

```text
draft/build -> model/scenarios -> submit -> independent decision
-> approved snapshot -> forecast revisions -> evidence-backed actuals
-> variance/reconciliation -> benefits realization -> PIR -> close
```

Backend responsibilities:

- one active ROI Case per Initiative;
- line-item baseline, assumption, cost and benefit models;
- deterministic, versioned calculation engine and immutable run hashes;
- immutable approval snapshot;
- immutable forecast versions and append-only actual/correction entries;
- maker-checker for material decisions and no self-approval;
- typed, pinned Finance and KPI evidence references;
- reconciliation cases instead of silent synchronization;
- restricted build/decision access and separately governed approved summary;
- PIR scheduling and audit history.

Finance owns finance-native models and artifacts. Results owns the Initiative
value contract and its Approved/Forecast/Actual realization truth. Neither side
overwrites the other.

## 6. Cross-module connections

| Connection | Required behavior | Forbidden shortcut |
|---|---|---|
| Initiative -> KPI | declare expected contribution to a KPI | auto-claim causality or recovery |
| KPI -> Initiative | propose a larger corrective Initiative from a deviation | create/approve it silently |
| Initiative -> Execution | execute milestones, tasks, risks and decisions | treat completion as achieved result |
| Execution -> KPI | return typed action/evidence receipt | overwrite measurement |
| OKR <-> Initiative | optional versioned contribution/support relation | inherit progress or status |
| KPI -> ROI Benefit | pin definition/version as evidence reference | convert KPI change directly into money |
| Finance <-> ROI | exchange version-pinned artifacts and open reconciliation | dual-write or last-write-wins |
| Results -> MyWork/Decisions | project real obligations and approvals | create duplicate workflow truth |
| Results -> Reports | generate snapshots from governed data | let report become a parallel source of truth |

## 7. AI analysis requirements

Each full tool contains `Analyze AI`, scoped to authorized, current data.

- KPI: detect missing contract fields, anomalous trends, stale/weak evidence,
  likely root causes and recovery options.
- OKR: detect task-like KRs, weak measurability, overload, contradictory
  alignment, missed check-ins and support needs.
- ROI: challenge assumptions, identify double counting, missing costs, scenario
  sensitivity, weak evidence, reconciliation gaps and forecast risk.

Output is a reviewable proposal list with rationale, cited source records,
confidence and accept/reject/edit controls. No proposal mutates the domain until
an authorized human issues the typed command.

## 8. Error, concurrency and resilience contract

- `401/403`: preserve context, explain access without exposing record details.
- `404`: distinguish missing/deleted from unauthorized only where policy allows.
- `409`: show version conflict and allow compare/reload; never overwrite.
- `422`: attach plain-language validation to exact fields.
- dependency failure: keep other Results domains usable.
- retry uses idempotency keys and never duplicates measurement, check-in, actual,
  approval or generated obligation.
- cold reopen must reconstruct the same authorized state from server data.

## 9. Definition of done

The module is not complete until all of the following are proven on one frozen
candidate SHA and reconstructible owner fixture:

1. correct Menu 1/2/3, dynamic CTA, tables, accepted preview and concise menus;
2. create, edit, submit/review and reopen flow for KPI, OKR and ROI;
3. KPI measurement-to-deviation-to-recovery-to-effectiveness loop;
4. OKR Set-to-check-in-to-review/reflection loop;
5. ROI build-to-approval-to-actual/variance-to-PIR loop;
6. Initiative, Execution, MyWork, Decisions, Finance and Reporting seams with no
   duplicated source of truth;
7. allowed/denied personas, maker-checker, tenant isolation and non-leaking
   search/count/export/AI behavior;
8. stable IDs, optimistic concurrency, idempotency, immutable history and SQL/API
   readback after restart;
9. PL/EN, light/dark, desktop/tablet, keyboard, focus, screen reader and clean
   console/network verification;
10. owner review of meaningful populated states, empty/loading/error/conflict,
    overdue/stale/disputed, restricted and archived states.

## 10. Current verdict

- Requirements analysis: `COMPLETE_FOR_IMPLEMENTATION_HANDOFF`.
- Existing backend: `SUBSTANTIAL REUSABLE CONTRACTS EXIST`, but every command,
  projection and frontend binding must be mapped and verified; documentation is
  not runtime proof.
- Existing frontend: `PARTIAL / MATERIAL REBUILD REQUIRED`.
- KPI/OKR/ROI cards: `NOT OWNER_ACCEPTED` and must be rebuilt around the workflows
  above.
- Results module: `NOT ACCEPTED / NOT RELEASE READY`.

This document is the final owner analysis entry. It does not mark any item fixed,
tested or accepted and does not supersede lower-level technical plans; where an
older plan conflicts with the explicit owner decisions captured here, the
conflict must be resolved in the implementation traceability ledger before code
is promoted.

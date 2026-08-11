---
doc_id: initiatives-execution-ui-ux-interaction-spec
truth_type: target_ui_contract
status: canonical_supporting
owner: product-owner
business_owner: piotr
last_reviewed: 2026-08-09
depends_on:
  - ../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md
  - ../../ui-standards/TRIADA_KANON.md
  - ../../ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md
  - ../../ui-standards/UI_UX_IMPLEMENTATION_STANDARD.md
runtime_status: not_implemented
---

# Initiatives + Execution — UI/UX and interaction specification

## 1. Scope and frozen navigation

This document turns the functional canon into an implementation-ready interaction
contract. It does not change business ownership, lifecycle, gates or data truth.

Frozen Menu 2:

- Initiatives: `Inicjatywy -> Portfel -> Plan -> Obciążenie`;
- Execution: `Realizacje -> Praca -> Zasoby -> Sterowanie -> Raporty`.

Table, Kanban, Timeline, heatmap and graph are views/tools. Candidate validation stays
in the source flow. Initiative lifecycle, gates, approvals and decisions stay in the
Initiative Card.

## 2. One shell and two surface modes

All nine functions use: App Topbar -> Menu 2 -> exactly one Menu 3 -> content.

### 2.1 Register mode — default

```text
┌ App Topbar ───────────────────────────────────────────────────────────┐
├ Menu 2: search | frozen functions        view | CTA | area ──────────┤
├ Menu 3: presets/counts               contextual and AI actions ──────┤
├───────────────────────────────────────┬──────────────────────────────┤
│ canonical table registry              │ StandardPreview              │
│ one row = canonical object/projection │ six canonical blocks         │
└───────────────────────────────────────┴──────────────────────────────┘
```

- Single click selects and opens preview without route/filter/scroll loss.
- `Enter`, double click or the only `Open` opens the full Workspace/Workbench.
- View switches preserve scope, filters and selection.
- Preview width: `clamp(340px, 28%, 480px)`; at narrower desktop it becomes a drawer.

### 2.2 Workbench mode — explicit action only

```text
┌ App Topbar / Menu 2 / Menu 3 ─────────────────────────────────────────┐
├ compact context register: scope | scenario | selection | back ───────┤
├──────────────────────────────────────────────────────────────────────┤
│ exactly one domain workbench                                         │
│ compare / timeline / heatmap / case / intervention / report document│
└──────────────────────────────────────────────────────────────────────┘
```

Workbench does not auto-open below a clicked row. The Piotr pattern “table above,
detail below” is accepted only as `compact context register + whole-scope workbench`.
The lower region is never row detail. Preview is closed in Workbench mode, avoiding
three competing panels. Back restores selection, filters, sort and scroll.

## 3. Shared Menu, table, preview and action contract

### 3.1 Menu 2

- Left: search, then frozen functions in frozen order; no counters.
- Right: at most one primary CTA, canonical view switcher, then scope/area according to
  the global order.
- The CTA names a user outcome (`New scenario`, `Run report`), never generic `AI`.

### 3.2 Menu 3

- One row only; default presets/counts, selection mode or open-document tabs replace
  one another in the same row.
- Right side: up to five collection-level/AI proposal actions; remainder in overflow.
- Period, zoom, graph layout, scale and scenario overlays are local Workbench controls.
- Bulk actions appear only for real, safe capabilities; mixed entity selection exposes
  only common non-lifecycle actions.

### 3.3 Tables

- Sticky uppercase 11 px header, fixed widths, zero-sum persisted resize, hairline rows,
  no zebra, `Settings2` visible-columns/description popover.
- Title left; figures right with unit/period/denominator/source. `—` means empty;
  `Unknown`, `Not evaluated`, `Partial`, `Stale` remain literal.
- Checkbox only with real bulk actions. Checkbox selection is independent from preview.
- Kebab zones: entry/completion/transitions -> time/manage -> destructive last.
  Unsupported actions are absent; capability-disabled actions state the real reason.

### 3.4 Preview — six blocks

1. Header: title, pin, only `Open`, close.
2. Meta: type/status plus gate or health, owner and due/as-of.
3. Details: why the record exists/requires attention; properties are not prose.
4. AI proposals: labelled proposal, sources, assumptions, confidence, review actions.
5. Relations: stable IDs/deep links or honest no-relations/restricted state.
6. Actions: two-column rows ordered decision, information, time/escalation.

### 3.5 Selection, navigation and keyboard

- Arrows move row/card selection; `Space` toggles checkbox; `Enter` opens; `Shift+F10`
  opens row menu; `Esc` closes the most local layer and returns focus to its trigger.
- Workbench graphic and context register share one selection model.
- Graphs, heatmaps, timelines and charts provide an operable table/list equivalent.
- If a filter removes selection, announce it and retain the nearest safe focus.

## 4. Truth, AI, simulation and state matrix

Canonical truth, AI proposal, draft scenario and stale/conflict must not look identical.

| Kind | Required treatment |
| --- | --- |
| Canonical truth | Standard surface, owner/source/as-of visible. |
| AI proposal | Proposal frame; sources, assumptions, confidence, accept/edit/reject. |
| Scenario/draft | Persistent banner, scenario ID/version, baseline diff, unpublished state. |
| Stale/partial/conflict | Warning names affected source/fields and recovery path. |

AI never silently changes lifecycle, approval, rank, window, baseline, allocation,
financial/KPI actual or published report. Apply is capability-controlled, idempotent,
audited and ends in server-confirmed read-back.

| System state | Required UI |
| --- | --- |
| Initial loading | Geometry-matching skeleton; no indefinite full-page spinner. |
| Background refresh | Keep data, show regional refresh and as-of. |
| First-use empty | Explain value, one primary path and manual alternative. |
| Filtered empty | Name active filters and `Clear filters`. |
| Partial | Preserve available regions; identify missing source/fields. |
| Stale | As-of, age/source, refresh/review. |
| Unknown/not evaluated | Literal value; never zero or green default. |
| Conflict | Both versions, owners and resolution action. |
| Permission | Capability/owner/request path without data leakage. |
| Offline/degraded | Persistent limitations; mutating actions disabled with reason. |
| Write/read-back | Pending in place, retry semantics, confirmed final state. |

## 5. Initiatives — Inicjatywy

**Primary table:** Registered Initiatives. Default columns: Initiative (title +
problem/outcome); Lifecycle status; Next gate/state; Readiness; Owner/next actor; Next
action; Expected impact/confidence; Planned window; Health (`N/A` before relevant);
Updated/as-of; actions. Default sort: `Needs my action`, then Updated descending. Filters:
status band, gate, readiness, owner, project, source, historical. No default group.

**Menu 3:** All, status bands, Needs my action, Needs evidence, Waiting decision,
Approved backlog, Scheduled, Historical. Selection: Assign owner, Request input,
Compare/open in Portfolio, governed archive. Right: Review gaps, Prepare decision brief.
**CTA:** `New proposal` opens source-validation intake, never direct ungoverned register.

**Preview:** source/problem/outcome; lifecycle/gate/readiness; missing requirements;
owner/next action; Finance/Results refs; relations; capability-driven actions.

**Workbench:** canonical Initiative Card/N-mode: source/lineage, definition, scope/options
including do nothing, evidence/counter-evidence, feasibility, Finance, KPI/Results, risk,
dependencies/change, roles, gates/decisions/history, schedule/handoff/read-back/closure.

```text
INICJATYWY
┌ All Needs my action Needs evidence Waiting decision Approved … ┐
├ Initiative registry ────────────────────────┬ Preview ─────────┤
│ Status | Gate | Readiness | Next action …   │ six blocks       │
└─────────────────────────────────────────────┴──────────────────┘
                            Open -> full Initiative Card
```

## 6. Initiatives — Portfel

**Primary table:** Initiative membership in active Portfolio Scenario. Columns: Include
state; Initiative; Rank; Strategic fit; Expected outcome/value; Cost envelope; Risk;
Readiness; Confidence; Coverage contribution; Overlap/synergy; Rough demand; Decision
state; Owner; actions. Default sort: Include state then Rank; group by Include state.
Filters: scenario, mandatory, confidence, coverage, overlap, owner.

**Menu 3:** Current scenario, Unassigned, Included, Conditional, Deferred, Excluded,
Mandatory, Low confidence, Coverage gaps, Duplicates. Selection: Include/exclude in draft,
Compare, Request inputs. Right: New scenario, Analyze coverage/overlap, Compare scenario.
**CTA:** `New portfolio scenario`.

**Preview:** membership/rank; value-cost-risk ranges; evidence/confidence; coverage and
overlap; rough demand; decision state; scenario diff; Initiative link.

**Workbench:** top compact selected-Initiative register; main 2/3 compare or coverage
matrix; right 1/3 scenario summary/assumptions/constraints/mix/ranges; action rail Save,
Compare, Request inputs, Submit decision, Publish. Score never auto-sets rank.

```text
PORTFEL
┌ scenario register: Included Conditional Deferred Excluded … ┐
├ compare / coverage matrix ───────────┬ scenario summary ─────┤
│ Initiative comparison and selection │ assumptions/ranges     │
└ Save draft | Compare | Submit portfolio decision | Publish ──┘
```

## 7. Initiatives — Plan

**Primary table:** Planned Initiative Windows in Plan Scenario. Columns: Initiative;
Backlog state; Proposed window; Earliest/latest; Dependency readiness; Mandatory
deadline; Cost of delay; Rough demand; Capacity state; Schedule confidence; Conflict;
Next action; actions. Default sort: proposed start then dependency order; no default
group. Filters: horizon, conflict, dependency, capacity, confidence, published state.

**Menu 3:** Unscheduled, Now, Next, Later, Conflicted, Missing dependencies, Needs
capacity, Ready for schedule, Published. Selection: Draft move, Sequence, Send to
capacity, Request review. Right: New plan scenario, Validate dependencies, Compare.
**CTA:** `New plan scenario`.

**Preview:** tentative range, prerequisites/exclusions, cost of delay, rough demand,
capacity/readiness/confidence, conflicts, scenario diff and next schedule action.

**Workbench:** top scenario scope register; main timeline/Now-Next-Later/waves; optional
dependency graph/constraint table; right selected-window assumptions/conflicts/impact;
action rail Draft move, Compare, Send to Capacity, Request Schedule Decision, Publish.
Drag edits draft scenario only.

```text
PLAN
┌ scenario scope: Unscheduled Now Next Later Conflicted … ┐
├ timeline / waves / dependency layer ──┬ window impact ──┤
└ Draft move | Send to Capacity | Request Decision | Publish┘
```

## 8. Initiatives — Obciążenie

**Primary table:** Capacity Constraint or role/team/time bucket. Columns: Period;
Role/team/skill; Demand low/base/high; Supply known/estimated; Gap range; Confidence;
Affected Initiative count; Criticality; Assumption freshness; Owner; Proposed response;
actions. Default sort: criticality then worst gap; group by period or role only by user.
Filters: scenario, unit, confidence, freshness, commitment.

**Menu 3:** All constraints, Critical, Unknown supply, Missing demand, Skill gaps,
Management load, Budget envelope, Unconfirmed, Resolved in scenario. Selection: Add to
scenario, Assign owner, Request estimate/confirmation. Right: Analyze load, Compare
scenario. **CTA:** `New capacity scenario`.

**Preview:** known/estimated/unknown inputs; range/unit/period; affected Initiatives;
assumptions/freshness; criticality; bounded responses and cross-impact.

**Workbench:** constraint register above heatmap role/team x period, range/confidence
overlay, affected-Initiative list, evidence rail and simulator move/split/reduce/add/
outsource/defer/stop with time-cost-risk-coverage-outcome diff. It writes assessment and
returns conditions to the same Plan Scenario, never a second roadmap.

```text
OBCIĄŻENIE
┌ constraints: Critical Unknown supply Missing demand Skill gaps … ┐
├ role/team × period heatmap ──────┬ assumptions/evidence ─────────┤
├ intervention alternatives ───────┴ impact diff ──────────────────┤
└ Confirm/return conditions to the same Plan Scenario ─────────────┘
```

## 9. Execution — Realizacje

**Primary table:** Execution Cases with immutable Initiative identity link. Columns:
Initiative/Case; Lifecycle; Execution phase; Owner; Delivery profile; Progress/confidence;
Baseline finish; Forecast finish; Variance; Budget/forecast projection; Health; Blockers;
Pending decisions; Resource constraint; Next action; Updated; actions. Default sort:
critical health/blocker then variance; filters by phase, owner, health, baseline/forecast.

**Menu 3:** Active, At risk, Critical, Blocked work, Missing baseline, Missing forecast,
Closing, Recently delivered, Unknown data. Selection: Request update, Assign where
capable, Export. Right: Analyze exceptions. **CTA:** none; creation is handoff-only.
Views: Table/Kanban/Timeline of the same IDs.

**Preview:** execution brief; baseline/current/forecast; top exception; next action;
work/resource rollups; effect follow-through; exact source links.

**Workbench:** Execution Case/N-mode with Plan, Work Packages, Tasks, Milestones, RAID,
Decisions, Resources, Budget projection, Change, Rollout, Adoption, Closure and handoffs.

```text
REALIZACJE
┌ Active At risk Critical Blocked Missing baseline … ┐
├ Execution Case registry ───────────────┬ Preview ──┤
└────────────────────────────────────────┴───────────┘
```

## 10. Execution — Praca

**Primary table:** typed `TASK` or `DECISION` projection retaining native identity and
lifecycle. Columns: Type; Item; Initiative/work package; Status; Owner/decision maker;
Due/SLA; Blocked-by; Priority/criticality; Evidence/DoD; Age; Next action; actions.
Default sort: blocking/overdue then due; filters by type, team, Initiative and capability.

**Menu 3:** All, Tasks, Decisions, Blocked, Overdue, Due soon, Missing owner, Missing
DoD/evidence, Waiting dependency, Mine, By team. Mixed selection only common actions;
homogeneous selection safe type actions. Right: Prioritize, Draft decision brief.
**CTA:** `New task` only where Execution owns it.

**Preview/Open:** type-aware. Task opens Task Workspace; Decision opens Decision Case
with evidence snapshot, options, authority, rationale and follow-up. No generic editor.

```text
PRACA
┌ All Tasks Decisions Blocked Overdue Due soon Mine … ┐
├ typed work registry ─────────────────────┬ Preview ──┤
│ native Task/Decision IDs and authority   │ type-aware│
└──────────────────────────────────────────┴───────────┘
```

## 11. Execution — Zasoby

**Primary table:** Allocation or Resource Constraint. Columns: Person/team/role; Period;
Committed availability; Allocated demand; Remaining demand; Load range; Skills match;
Affected work; Cost/forecast; Acceptance; Conflict; Freshness; Next action; actions.
Default sort: conflict/overload then gap; filters by team, Initiative, period, acceptance.

**Menu 3:** All, Overallocated, Unassigned work, Skill gaps, Unconfirmed assignments,
Availability unknown, Cost risk, Needs decision, By team, By Initiative. Selection: Build
intervention, Request confirmation, Assign resolver. Right: Suggest balancing, Compare.
**CTA:** `New allocation scenario` only when availability/assignment contracts exist.

**Preview:** canonical supply/demand, range and freshness; affected work/blast radius;
skills/cost projection; acceptance and bounded interventions.

**Workbench:** allocations table above People/Teams capacity calendar, day/week/month
horizon, skill gaps, Finance-sourced money projection, blast radius and before/after
intervention composer. Until Availability/Assignment/Calendar/Remaining Estimate are
proven, it remains visibly `PARTIAL/EVIDENCE_MISSING`.

```text
ZASOBY
┌ allocations/constraints: overload skills unknown acceptance … ┐
├ people/time allocation board ─────┬ blast radius / cost ───────┤
└ intervention composer + before/after + governed apply ─────────┘
```

## 12. Execution — Sterowanie

**Primary table:** deduplicated Management Signal or Intervention Case. Columns:
Severity; Urgency; Confidence; Signal/problem; Affected Initiative; Source; Owner;
Age/SLA; Blast radius; Proposed intervention; Approval state; Verification due; Outcome;
actions. Default sort: priority function severity x urgency x blast radius x age,
confidence visible; filters by source/type/owner/approval/verification.

**Menu 3:** Needs action, Critical, Decisions, Schedule, Resources, Cost, Risk,
Dependencies, Adoption, Outcome risk, Verification overdue, Resolved. Selection: Assign,
Group/deduplicate proposal, Escalate. Right: Investigate, Draft intervention.
**CTA:** none without selected signal; `Compose intervention` is contextual.

**Preview:** what happened/source/as-of, why hypothesis/evidence/counter-evidence, impact,
options/do nothing, authority, next action and verification plan.

**Workbench:** exception queue context above narrative sequence What happened -> Why ->
Impact -> Options -> Decision -> Action/read-back -> Verification. Every material action
uses impact preview, human authority, idempotent canonical write and effectiveness check.

```text
STEROWANIE
┌ exception queue: Needs action Critical Decisions Resources … ┐
├ What happened -> Why -> Impact -> Options ───────────────────┤
├ Decision -> canonical write/read-back -> Verification ──────┤
└ one Intervention Case with audit and outcome ────────────────┘
```

## 13. Execution — Raporty

**Primary tables:** Definitions and Runs. Definition columns: Report; Audience; Cadence;
Scope; Last run; Freshness; Completeness/confidence; Approval/publication; Owner;
Required action; Next run; actions. Run adds Period/as-of, generation/freeze/distribution
state. Default sort: next run then last run; filters by audience/cadence/state.

**Menu 3:** All, Weekly, Monthly, On demand, Sponsor, Needs generation, Needs review,
Partial/stale, Published, Failed, Recent runs. Selection only real archive/export actions.
Right: Run report, New definition if capability permits. **CTA:** `Run report`.

**Preview:** definition/run identity; audience/cadence/scope/as-of; source coverage;
freshness/completeness/confidence; approval/publication; required follow-up.

**Workbench:** compact register/run selector above Report Run document; right source rail
with freshness, confidence and drill-through; action rail Refresh draft, Validate, Freeze,
Approve, Export, Share, Create follow-up. Freeze creates immutable snapshot; refresh never
mutates a published run.

```text
RAPORTY
┌ Definitions/Runs Weekly Monthly Sponsor Needs review … ┐
├ Report Run document ──────────────────┬ source rail ────┤
└ Refresh | Validate | Freeze | Approve | Export | Follow-up┘
```

## 14. Responsive, accessibility and acceptance

### 14.1 External function -> preview -> Initiative Card

Every Initiatives collective function preserves one route back to the same Initiative
case file:

```text
Portfel / Plan / Obciążenie table or Workbench
        -> select Initiative/membership/window/constraint
        -> six-block contextual preview
        -> Open Initiative
        -> Initiative Card at exact relevant card/finding
        -> remediate / request input / create Task or Decision / submit gate
        -> read-back refreshes Card and originating function
```

The preview must carry `initiativeId`, originating function, scenario/version, selected
finding/constraint/window and return context. `Open Initiative` deep-links to the exact
card (`cardKey`) and optionally exact finding (`findingId`), not merely the Overview.
Back restores function, scenario, selected row/graphic, filters, sort and scroll.

Collective functions never write narrative copies into the Card. They contribute typed
relations:

| Origin | Card contribution | Canonical action |
| --- | --- | --- |
| Portfel | scenario membership, rank/override rationale, coverage/overlap finding, Portfolio Decision and conditions | open Strategic Fit, Outcomes, Options, Finance, Feasibility or Gates card; create linked remediation Task/Decision |
| Plan | planned-window relation, dependency/constraint finding, scenario assumptions/diff and Schedule Decision | open Timeline, Milestones, Dependencies, Resources or Gates; request schedule input/Decision |
| Obciążenie | Capacity Assessment, demand/supply assumption, constraint, tentative commitment and response proposal | open Resources & Capacity, People/Team, Roles/RACI, Feasibility or Gates; request estimate/commitment or Decision |

The Card shows a compact `External findings` inbox inside the relevant card and Context
rail, not a new 27th business card. Each item has origin, scenario/version, severity,
freshness, owner, exact affected fields and one next action. Accepting it links/applies a
versioned proposal; dismiss/waive requires reason and authority where policy demands.

### 14.2 Initiative Card layout without dashboard wall

The 26 cards remain stable capabilities grouped as:

1. Definition/value: Summary/Scope, Strategic Fit, Success Criteria, Outcomes/Benefits,
   KPI, Options, Financial Analysis, Financial Impact.
2. Organization/feasibility: People/Team, Roles/RACI, Stakeholders, Resources/Capacity,
   Dependencies, Risk/RAID, Feasibility/Completeness, Technical Specification.
3. Plan/governance: Milestones, Timeline, Tasks, Decisions, Gates/Approvals.
4. Adoption/evidence: Change/Adoption, Communication/Engagement, Capabilities/Training,
   Attachments/Materials, Comments/Activity/History.

One card is selected at a time. The workspace is:

```text
┌ Header: identity | lifecycle | owner/sponsor | save/freshness ───────┐
├ Next action: one action | reason | actor | SLA | blocker link ───────┤
├ lifecycle rail ┬ card navigation ┬ selected card ┬ context rail ─────┤
│ 12 states      │ groups/status   │ one job only │ findings/work/AI  │
└ sticky actions: draft/input/Task/Decision/gate by capability ────────┘
```

- Header summarizes identity and truth quality, not KPIs/cards.
- Next-action strip contains exactly one primary next action. Secondary work is in the
  selected card or context rail.
- Lifecycle rail shows completed/current/future; gates and disposition are separate.
- Navigation rail shows each card's applicability, completion, quality, freshness and
  review state, with search and unresolved count.
- Overview narrates the case and routes to deficient cards; it does not repeat all data.
- Context rail holds Teresa proposal, evidence/source, impact, open Task/Decision,
  comments and audit; it is collapsible.

Card state dimensions are independent:

`applicability REQUIRED/OPTIONAL/NOT_APPLICABLE`; `completion EMPTY/IN_PROGRESS/COMPLETE`;
`quality UNKNOWN/SUFFICIENT/WARNING/BLOCKER`; `freshness CURRENT/STALE/SOURCE_UNAVAILABLE`;
`review NOT_REQUESTED/REQUESTED/CHANGES_REQUESTED/ACCEPTED`; and save state. Complete is
not approved; a complete card may contain a blocker.

### 14.3 Gate/readiness and approval behavior

The Card never represents readiness as a decorative percentage. Selecting `Next gate`
opens a Gate/Approval view with:

- transition and policy version;
- required cards/fields/Decision types, evidence freshness and unresolved Task/Risk
  rules;
- findings grouped `BLOCKER`, `WARNING`, `INFO`, each linked to exact card/object;
- preparer, decider/authority, due/SLA, waivers and approval conditions;
- immutable evidence snapshot preview and changed-since-last-decision summary.

Navigation behavior:

1. Next-action strip opens the first highest-priority actionable finding.
2. Finding opens exact card and focuses the affected field/relation without entering
   edit automatically.
3. `Create remediation Task/Decision` opens an impact/creation preview, then creates one
   canonical object with relation key/idempotency.
4. Task/Decision appears immediately as synchronization pending, then as confirmed
   read-back in Card, My Work and Execution where applicable.
5. Completion/evidence recomputes readiness; it never decides the gate.
6. `Submit gate` is enabled only with capability and no unwaived blocker.
7. Decider sees frozen snapshot, options including return/defer/reject where allowed,
   conditions, affected objects and consequences. AI can prepare, never decide.
8. Successful decision atomically returns lifecycle/gate/card read-back; failure leaves
   no partial success.

### 14.4 Material-change impact preview

Editing scope, selected option, owner, target window, budget envelope, KPI target,
critical dependency or approved baseline creates a versioned change proposal. Before
publish, impact preview shows:

- old/new diff and source version;
- affected Portfolio/Plan/Capacity scenarios;
- affected Tasks, Decisions, milestones, risks, assignments and access;
- Finance/Results references and Execution handoff/baseline;
- tolerance result, required approver and reapproval gates;
- reversible/non-reversible character and generated follow-up proposals.

The user can return to edit, request missing input, create the required Decision, or
submit. Publish is atomic and audited. Old versions and decision evidence remain linked.

### 14.5 Task, Decision and My Work interaction

- Task and Decision are canonical records; the Card, My Work and Execution only project
  them with the same ID/lifecycle.
- `Create Task` requires why/outcome, acceptance evidence/rule, owner/assignee, due or
  explicit no-date reason, context relations and impact preview.
- `Create Decision` requires question, options/do-nothing where meaningful, requested
  authority, due/SLA, evidence snapshot, no-decision consequence and affected set.
- A Task blocked by Decision shows the exact Decision and blast radius. Resolving the
  Decision re-evaluates rather than blindly unblocks the Task.
- My Work row deep-links to Initiative card/finding or native Task/Decision workspace;
  snooze changes personal presentation only.
- Projection lag displays `Saved; synchronization pending` with correlation ID; the UI
  never creates a private local copy.

### 14.6 Responsive and accessibility for the Card/gate loop

- Wide desktop: lifecycle rail + navigation rail + selected card + collapsible context.
- 1280: context becomes overlay drawer; navigation remains visible/compact.
- 1024: lifecycle and card navigation combine into one accessible drawer; selected card
  remains primary. Sticky next action stays visible without covering content.
- Mobile: header/next action, card selector and selected card are linear; impact/gate
  views are full-screen steps. Material approval remains available only if full evidence,
  authority and confirmation can be presented safely.
- Card navigation is a semantic tree/list; states have text and icons, not color only.
- `Alt/Option + Up/Down` may move cards; `Enter` opens; `Esc` closes context/impact and
  returns focus. Finding-to-field focus is announced with severity and remediation.
- Gate finding summary and AI streaming use appropriate live regions without repeatedly
  reading the full workspace.

### 14.7 Additional acceptance criteria

1. Portfel, Plan and Obciążenie preview open the same Initiative ID at the exact related
   card/finding and return with context intact.
2. All 26 cards are present as capabilities; templates change order/requiredness only.
3. No screen renders 26 expanded panels or a dashboard wall.
4. Gate evaluation returns finding objects, not only a score; blocker prevents submit.
5. Stale Finance/KPI/capacity evidence cannot yield green readiness.
6. Finding -> Task -> My Work -> completion evidence -> recomputed readiness is proven
   with one canonical Task ID.
7. Task -> blocking Decision -> conditional result -> follow-up -> verified re-evaluation
   is proven with one canonical Decision ID.
8. Material change -> impact preview -> reapproval -> versioned Card -> Execution/My Work
   read-back is proven.
9. Unauthorized users see safe read-only/degraded behavior and cannot mutate through
   alternate projections.
10. Responsive/keyboard/screen-reader evidence covers external function, preview, exact
    card deep-link, gate finding, impact preview and focus return.

- Evidence: 1440x900 and 1280x720, light/dark; 125% no clipping; 200% no lost
  capability. At 1024 preview is drawer and Workbench context register collapses.
- Mobile: compact list preserves identity/status/next action; preview full-screen;
  high-density Workbench may be read/triage-first but cannot offer unsafe partial edit.
- WCAG 2.2 AA, visible `--c-focus`, no color-only status, full keyboard cycle, focus
  return, reduced motion, accessible alternatives for all visualizations.
- A surface is accepted only with real-data selection -> preview -> action -> confirmed
  write/read-back -> reopen, all relevant state cases, and no shadow status/decision/
  Finance/Results/resource truth.

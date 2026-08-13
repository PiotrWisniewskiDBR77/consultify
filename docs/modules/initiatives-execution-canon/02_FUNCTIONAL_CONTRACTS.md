---
doc_id: initiatives-execution-functional-contracts
truth_type: target_product_contract
status: draft_for_owner_review
owner: product-owner
business_owner: piotr
version: 1.0
last_reviewed: 2026-08-09
runtime_status: not_implemented
parent_canon: ../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md
process_contract: ./01_PROCESS_GOVERNANCE_AND_GATES.md
---

# Initiatives + Execution — functional contracts

## 1. Shared implementation contract

The nine functions are fixed as:

- Initiatives: `Inicjatywy → Portfel → Plan → Obciążenie`.
- Execution: `Realizacje → Praca → Zasoby → Sterowanie → Raporty`.

All functions implement the [parent canon](../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md) and [process/gates contract](./01_PROCESS_GOVERNANCE_AND_GATES.md). The `Inicjatywy` function additionally implements the complete [Initiative Card system](./11_INITIATIVE_CARD_SYSTEM.md) and [Task/Decision/My Work integration](./12_TASK_DECISION_MY_WORK_INTEGRATION.md).

Each has one primary registry, capability-driven actions, single-click preview and an explicit Workbench/full workspace. Workbench and right preview never compete simultaneously. All values carry unit/window/source/as-of/confidence where applicable. `Unknown`, `Partial`, `Stale`, `Conflict` and `N/A` are not zero.

Shared write sequence:

`capability check → input validation → impact preview → explicit confirmation/approval → idempotent write → audit → backend read-back → UI success or honest recovery state`.

## 2. Initiatives / Inicjatywy

### Purpose and primary job

Find one registered Initiative, understand lifecycle/gate/readiness/disposition and complete its management case to the next authorized decision.

### Inputs and primary objects

Inputs: registered source envelope; return/change request; governance profile; project/visibility; Finance/Results/domain refs; Execution/benefits read-backs.

Primary objects: `Initiative`, `Initiative Management Case`, `Gate/Decision Case`, immutable snapshot and lineage. Pre-registration proposals remain exclusively in the source-validation flow and are not rows in the Inicjatywy registry. A successful register/merge/extend read-back supplies the link/status back to the source.

### Registry and workflow

Required columns: identity/problem-outcome summary, lifecycle, next gate/state, readiness, disposition, owner/next actor, next action, expected impact/confidence, planned window, health if applicable, updated/as-of.

1. Load only records permitted by organization/project/item scope.
2. Resolve runtime mapping; unmapped records show `MIGRATION_REVIEW_REQUIRED` and cannot perform semantic gate writes.
3. Select row to preview source, management state, missing/stale conditions and relations.
4. Open the Initiative workspace.
5. Complete the lifecycle-appropriate subset of the 26 governed business cards. Card applicability, completion, quality, freshness, review and save state remain separate; workspace utilities are not peer business cards.
6. Readiness service evaluates the active governance profile and returns dimension-level results; blocker cannot be averaged away.
7. User with `gate.request` capability freezes a Decision Brief snapshot and requests a decision.
8. Authorized approver chooses only outcomes allowed by the active gate and profile.
9. Persist decision, lifecycle/gate/disposition and follow-up atomically; show success after read-back.
10. Project the same canonical Initiative into Portfel/Plan/Obciążenie or handoff to Execution; never copy it.

### Card-to-function and approval mechanics

1. External functions consume published card/source projections; they cannot edit card fields through scenario tools.
2. Portfel writes scenario membership/rank/decision preparation. Plan writes proposed windows/dependencies. Obciążenie writes constraints/commitments. Each record carries `initiativeId`, scenario/version and source card versions.
3. Opening an Initiative from any external function opens the same Initiative Card and preserves return context (`function`, scenario, filters and selected record).
4. `Request gate` is issued from the Initiative Card `Gates & Approvals` capability. It assembles required published card versions plus the external scenario/version required by the gate.
5. The Decision result returns to the card first; only successful canonical read-back changes lifecycle/disposition and refreshes all external projections.
6. A return points to exact deficient cards or external scenario records. Remediation uses canonical Task/Decision/request objects and My Work projection under [Task/Decision integration](./12_TASK_DECISION_MY_WORK_INTEGRATION.md).
7. Full decision authority and required card basis for Definition, Portfolio, Schedule, Handoff, Change/Reapproval, Delivery, Effectiveness and Closure are defined in [process section 5.2](./01_PROCESS_GOVERNANCE_AND_GATES.md#52-decision-basis-by-gate).

### Permissions and decisions

Proposal/Initiative Owner edits permitted fields and requests decisions. Project Leader validates registration/definition and schedule inside envelope. Sponsor/Board makes Go/No-Go and exceptions. Domain owners approve their own linked truth. Teresa drafts/challenges only.

### Output and handoff

Outputs: versioned Management Case, gate snapshot, Approved Backlog, Scheduled Handoff, lifecycle/read-back and closure lineage.

### Invariants

- one initiativeId/lineage;
- lifecycle lives in the card, not Menu 2 tabs;
- no local Finance/KPI/Task/Decision copies;
- one canonical Task or Decision may be projected in the card, My Work, Execution and reports but never copied;
- status, readiness, health and effectiveness remain independent;
- `APPROVED_BACKLOG` never implies start.
- complete card never implies approved gate;
- dirty/conflicting/unpublished card versions cannot enter a gate snapshot;
- cross-function scenario output is an approval input, not a direct lifecycle command.

### Failure and recovery

Permission restriction hides protected detail but retains permitted identity/state. Missing/stale/conflicting source blocks the relevant gate. Save conflict returns diff. Handoff timeout stays Scheduled/Handoff Pending and retries idempotently. Partial domain outage shows unavailable refs and a refresh/request action.

## 3. Portfolio / Portfel

### Purpose and primary job

Choose and justify the combined set of Initiatives that best uses strategy, capital, risk capacity and management attention.

### Inputs and primary objects

Inputs: decision-comparable Initiatives, strategic goals, Finance/KPI refs, value/cost/risk/time-to-value, confidence, dependencies, rough demand and mandatory lanes.

Objects: `Portfolio Scenario`, membership, scoring/ranking model version, coverage segment and Portfolio Decision Case.

### Workflow and mechanics

1. Create a draft scenario from explicit portfolio scope and model version.
2. Validate record comparability, source freshness and permission coverage.
3. Add/remove/mark memberships without changing Initiative lifecycle.
4. Run duplicate/overlap/contradiction/synergy/double-count checks with evidence.
5. Compare value, cost, risk, fit, time-to-value and confidence; score decomposition remains visible.
6. Rank separately from score. Manual override requires actor, reason and affected positions.
7. Build at least baseline and one alternative scenario, including defer/do-nothing at portfolio level.
8. Compare included/conditional/deferred/excluded, coverage, ranges, assumptions and rough demand.
9. Request missing inputs through canonical Tasks/Decisions.
10. Freeze Portfolio Decision snapshot; authorized Sponsor/Board approves, conditionally approves, returns, defers, rejects or merges.
11. Approved memberships move corresponding Initiatives to `APPROVED_BACKLOG`; other dispositions retain reasons and lineage.

Step 11 is executed only through each Initiative's canonical Portfolio Decision/gate read-back. Batch decision is permitted only when authority, evidence policy and outcome/conditions are homogeneous and every Initiative receives its own Decision relation and immutable snapshot. Scenario publication alone never changes lifecycle.

### Permissions

Portfolio Owner/PMO composes. Initiative Owners explain but cannot rank their own Initiative unilaterally. Sponsor/Board decides. Teresa proposes scenarios but cannot publish/approve.

### Output/handoff

Published Portfolio Scenario, Decision, Approved Backlog and conditions; same scenario/version becomes Plan input and rough-demand input to Obciążenie.

### Invariants

Score never equals decision; a blocker remains visible; scenario membership does not mutate Initiative content; published scenario is immutable; Finance/Results remain sources.

### Failure/recovery

Non-comparable data => `PARTIAL` scenario and blocked publish unless explicit exception. Stale source requires refresh/re-freeze. Missing portfolio visibility shows coverage gap. Concurrent edit creates scenario conflict/branch, not last-write-wins.

## 4. Plan / Plan

### Purpose and primary job

Sequence an approved/considered portfolio into justified waves and realistic windows without pretending to own Execution task scheduling.

### Inputs and objects

Inputs: published Portfolio Scenario/Approved Backlog, prerequisites, dependencies, mutual exclusions, mandatory dates, funding windows, rough demand and tolerances.

Objects: `Portfolio Plan Scenario`, `Planned Initiative Window`, dependency/constraint and Schedule Decision Case.

### Workflow and mechanics

1. Clone a specific Portfolio Scenario version into a Plan draft; preserve source version.
2. Place all included unscheduled Initiatives in an explicit lane.
3. Validate prerequisites, dependencies, mandatory windows and unknowns.
4. Assign ranges (`earliest`, `target window`, `latest`) with confidence, not unsupported exact dates.
5. Sequence by dependency, value, cost of delay, constraints and change saturation.
6. Every move records a draft diff and impact propagation; drag/drop never writes lifecycle/baseline.
7. Send the same Plan Scenario ID/version and units to Obciążenie.
8. Receive constraint/commitment results; simulate move, split, reduce, defer or capacity uplift.
9. Compare versions and publish one Plan Scenario after required review.
10. Freeze Schedule Decision per Initiative or approved batch where authority/conditions are homogeneous.
11. Only successful Schedule Gate changes Initiative to `SCHEDULED` and creates its Handoff Package.

Schedule request is assembled in the Initiative Card from exact Milestones, Timeline, Resources & Capacity, People/Team, RACI, Dependencies, RAID and approval-condition card versions plus the published Plan and Capacity versions. Plan cannot invoke a direct `set SCHEDULED` command.

### Permissions

Planner/PMO edits draft. Project Leader prepares Schedule. Resource owners confirm capacity. Sponsor/Board approves tolerance exceptions. Teresa suggests sequencing only.

### Output/handoff

Published Plan Scenario, planned windows, conflicts, Schedule Decisions and versioned Execution Handoffs.

### Invariants

Plan and Capacity use one scenario identity; no second roadmap; no task-level baseline; proposed window differs from commitment; stale Portfolio version blocks publish or requires explicit rebase.

### Failure/recovery

Missing dependency/capacity/funding remains Unknown and blocks relevant commitment. Stale scenario offers compare/rebase. Handoff rejection returns exact blockers without duplicate Execution Case.

## 5. Capacity / Obciążenie

### Purpose and primary job

Estimate whether the organization can carry a Plan Scenario, expose uncertainty and return bounded correction options before commitment.

### Inputs and objects

Inputs: same Plan Scenario/version, demand ranges by role/skill/team/period, estimated supply, non-project work, budget envelope, external supply and assumptions.

Objects: `Estimated Capacity Scenario`, demand/supply envelope, constraint and tentative/confirmed commitment.

### Workflow and mechanics

1. Validate shared periods, units and source version with Plan.
2. Classify every input `KNOWN`, `ESTIMATED`, `UNKNOWN` or `UNCONFIRMED` with source/as-of.
3. Aggregate low/base/high demand and comparable supply; never coerce missing to zero.
4. Calculate gap ranges and coverage/confidence.
5. Identify critical roles/skills/shared services, management load and change saturation.
6. Link each constraint to affected Initiatives and plan windows.
7. Simulate move, split, reduce, add, outsource, defer and stop; show time/cost/risk/value impact.
8. Resource/Functional owner confirms/rejects tentative supply; Sponsor approves new envelope where needed.
9. Write commitment/constraint outcome against the same Plan Scenario and return a diff.
10. Schedule Gate consumes only confirmed/conditional commitments with explicit conditions.

Obciążenie never approves the Schedule Gate. It returns an Initiative-specific Capacity Assessment/Commitment relation to the card. The card readiness service evaluates it together with Timeline, Team/RACI, Dependencies, RAID and outstanding approval conditions.

### Permissions

Planner/PMO simulates. Resource owner owns supply confirmation. Project Leader requests commitment. Sponsor/Finance authority owns additional envelope. Teresa cannot assign people.

### Output/handoff

Capacity Assessment, constraints, commitments and Plan corrections; confirmed summary flows to Handoff, while actual allocation later belongs to Execution Zasoby.

### Invariants

Pre-execution estimate is not actual utilization; no timesheet truth; confidence and coverage mandatory; no autonomous assignment; Plan remains temporal source.

### Failure/recovery

Unavailable availability/skills/non-project load/budget => Unknown/Partial with owner/request action. Unit/time mismatch rejects calculation. Stale supply invalidates commitment and triggers re-review rather than silent red/green recalculation.

## 6. Executions / Realizacje

### Purpose and primary job

Provide one reliable registry of active Execution Cases and the correct entry into each delivery workspace.

### Inputs and objects

Input: accepted Scheduled Handoff plus canonical Task/Decision/Risk/Resource/Finance/Results rollups. Primary object: `Execution Case` linked immutably to Initiative.

### Workflow and mechanics

1. Validate Handoff completeness, permissions, project, roles, source status and idempotency.
2. Accept, accept with explicit gaps or reject with blockers.
3. Create/link exactly one Execution Case and return ID/state/deep link.
4. Execution Manager completes/approves Execution Brief and baseline before active work where profile requires.
5. Registry separately displays Initiative lifecycle, execution phase/state, progress/confidence, baseline/forecast, variance and health/reasons.
6. Table/Kanban/Timeline use one dataset and preserve filters/selection.
7. Open case workspace for Plan, Work Packages, RAID, Resources, Change, Rollout, Adoption and Closure.
8. Drill every rollup/exception to canonical source or Sterowanie.
9. Pause, stop, rebaseline and close only through authorized Decision/Change Case.
10. Delivery Acceptance and Benefits Handoff follow process contract.

Delivery acceptance is prepared in the Execution Case, but its Decision snapshot references the Initiative Card's Success Criteria and approved scope plus canonical Execution evidence. After successful read-back, Initiative lifecycle moves to `DELIVERED`; Execution cannot infer delivery solely from all Tasks being Done.

### Permissions

Execution Manager accepts/operates. Owners update canonical objects. Sponsor/Board approves material exceptions. Benefit Owner receives outcome handoff. Teresa challenges plan/forecast and drafts interventions.

### Output/handoff

Execution Case, operational state/forecast, Delivery Acceptance, Benefits Handoff and read-back to Initiative.

### Invariants

No dashboard-only truth; no shadow work; health includes reason/as-of/coverage; Delivered is not benefit achieved; missing baseline/forecast stays explicit.

### Failure/recovery

Pending/rejected handoff, missing baseline, contradictory progress/evidence, partial rollup, stale update and unavailable linked object each have distinct states/actions. Retry never duplicates case.

## 7. Work / Praca

### Purpose and primary job

Move all canonical execution Tasks and Decisions to completion/decision without losing their distinct lifecycles.

### Inputs and objects

Inputs: Tasks, Decisions, dependency handoffs, due/SLA, DoD/evidence and blockers. Registry row is a typed projection (`TASK`/`DECISION`); canonical identities remain separate.

### Workflow and mechanics

1. Aggregate only canonical items visible to user; preserve source case/work package.
2. Prioritize by urgency, impact, dependency, decision latency and SLA.
3. Preview type-specific context, blocked-by, blast radius and next capability.
4. Task: assign/accept/start/block/complete/reopen under Task policy; completion requires DoD/evidence.
5. Decision: prepare/request evidence/ready/decide/defer/return/follow-up under Decision policy and immutable snapshot.
6. Orphan/missing owner/date/DoD creates remediation, not guessed default.
7. Homogeneous safe bulk actions only; each item returns individual read-back.
8. Blocker/resource conflict emits linked signal to Sterowanie/Zasoby.
9. Write rollup to Execution Case projection and My Work; never copy item.

### Permissions

Task Owner updates task; Workstream/Execution Manager assigns within authority; Decision Approver decides; PMO triages/escalates; Teresa drafts/reminds but does not decide.

### Output/handoff

Completed task with evidence, decision with rationale/conditions/follow-up, exact blockers and source read-back.

### Invariants

My Work is personal projection; Praca is execution-wide. Task/Decision never share a generic state machine. No completion without backend read-back.

### Failure/recovery

Duplicate/orphan/stale/unauthorized/conflicting items display exact remediation. Partial bulk failure preserves per-item result and safe retry. Missing evidence prevents verified completion.

## 8. Resources / Zasoby

### Purpose and activation gate

Allocate and balance real people, skills, time and labor cost during active delivery. Full activation requires canonical Availability, Assignment, Acceptance, Calendar, Skill and Remaining Estimate. Missing components force `PARTIAL/EVIDENCE_MISSING`; UI must not claim complete resource management.

### Inputs and objects

Inputs: accepted availability/calendars, assignments, remaining estimates, work demand, skills, rates/cost refs and external supply. Objects: Resource/Team, Assignment, Availability, Allocation, Skill Requirement and Resource Constraint.

### Workflow and mechanics

1. Load actual supply and assignments for selected day/week/month horizon.
2. Demand originates in Tasks/Work Packages with remaining estimate; classify missing estimates.
3. Calculate load ranges and skill match with source coverage/as-of.
4. Detect double booking, overload, unassigned critical work, skill/cost risk and unconfirmed assignment.
5. Simulate reassign, smooth, replan, backfill or outsource with blast radius across tasks/milestones/Initiatives.
6. Show before/after date, cost, risk and other affected commitments.
7. Authorized Resource/Execution/Finance actors approve assignment/request/cost as applicable.
8. Write canonical allocation; require assignee acceptance where policy demands.
9. Read back allocation and update forecast; material conflict creates Decision/Intervention Case.

### Permissions

Resource Manager owns availability/supply; Execution Manager requests; assignee acknowledges; Finance/Procurement approves external cost; Sponsor approves material envelope. Teresa proposes only.

### Output/handoff

Real allocation plan, confirmed assignments, capacity forecast, skill/resource request and linked Sterowanie signal.

### Invariants

No priority decision, attendance-productivity proxy or copied Finance ledger. Initiatives Obciążenie receives aggregated learning/read-back, not actual-record overwrite.

### Failure/recovery

Calendar unavailable, double booking, skill unknown, assignment unaccepted, estimate/timesheet stale, contractor pending and privacy restriction remain distinct. Failed write restores prior assignment or exposes repair case; it never shows optimistic load.

**OPEN DECISION OD-F01:** Define minimum model/API evidence for activation and which subfeatures remain hidden while partial.

## 9. Control / Sterowanie

### Purpose and primary job

Detect loss of delivery credibility, understand cause, authorize a bounded intervention and verify its effect.

### Inputs and objects

Inputs: source-linked management signals from schedule, cost, work, decisions, resources, risks, dependencies, data freshness, adoption and outcome risk. Objects: Signal, Intervention Case, Forecast, Change Request and Verification Record.

### Workflow and mechanics

1. Detect signal with source/as-of/threshold and evidence.
2. Deduplicate/correlate; retain contributing sources.
3. Prioritize severity, urgency, confidence and blast radius; assign/acknowledge within SLA.
4. Investigate root-cause hypothesis, counter-evidence and unknowns.
5. Forecast upside/base/downside against baseline and outcome.
6. Present bounded options including do-nothing: remove blocker, clarify decision, reassign, smooth, split, defer, add capacity, resequence, pilot, rebaseline, escalate or stop.
7. Show time/cost/scope/capacity/risk/outcome impact, reversibility and required authority.
8. Request decision/approval; no material autonomous action.
9. Execute canonical write with idempotency; verify post-write coherence/read-back.
10. Set `verifyBy`, expected effect and measurement source.
11. Record `EFFECTIVE`, `PARTIAL`, `INEFFECTIVE` or `NOT_VERIFIED`; update forecast/lesson and close/escalate.

### Permissions

Execution Manager/PMO triages. Object owner performs bounded correction. Sponsor/Board approves material change, residual risk, rebaseline or stop. Teresa L0–L2; L3 only reversible action after preview/confirmation and policy.

### Output/handoff

Auditable intervention, canonical action/read-back, verification result and management narrative; work/resource/decision outputs return to their owner functions.

### Invariants

Every signal resolves through action, accepted risk/dismissal with reason, merge or escalation. Sterowanie owns neither Tasks, Assignments, Finance actuals nor Results actuals. Health is projection, not lifecycle.

### Failure/recovery

Signal without source is invalid. Alert storm deduplicates without deleting evidence. Unknown baseline prevents precise forecast. Expired recommendation requires refresh. Failed/partial write creates recovery case. Overdue verification remains open; ineffective intervention escalates or creates next case.

## 10. Reports / Raporty

### Purpose and primary job

Produce an auditable execution picture for a named audience/period/decision and create governed follow-up.

### Inputs and objects

Inputs: Report Definition, audience, cadence, scope, period/as-of and versioned Execution sources. Objects: Definition, Report Run, frozen snapshot, distribution record and follow-up.

### Workflow and mechanics

1. Select Definition and explicit audience/scope/period/as-of.
2. Validate permissions, mandatory sections and data-source availability.
3. Fetch versioned sources; classify missing/partial/stale/conflicting.
4. Generate draft Run with formula/unit/window/source/confidence and prior-run diff.
5. Reviewer performs data-quality gate and drill-through.
6. Refresh creates a new draft version; it does not rewrite a frozen run.
7. Freeze immutable source snapshot.
8. Authorized approver approves publication.
9. Export/share/distribute under recipient policy and store delivery evidence.
10. Finding drills to source or creates canonical Task/Decision/Intervention with report-run link.

### Permissions

Report Owner prepares; data owners own sources; Report Approver publishes; distribution policy controls recipients; Teresa drafts narrative only.

### Output/handoff

Approved Report Run, export/share/publication proof and canonical follow-up; Materials may publish, while source remains Execution.

### Invariants

Report Run, not a dashboard row, is the product. No generic BI editing of execution truth. No publish with hidden partial/stale state. Every reported issue has drill-through or explicit evidence limitation.

### Failure/recovery

Binding/source/permission/generation/export/delivery failures remain separate. Partial draft may be reviewed but cannot publish unless policy explicitly permits and disclosure is frozen. Retry creates/reuses the intended run idempotently; it never duplicates distribution silently.

## 11. Cross-function routing matrix

| Trigger | Source function | Destination | Canonical object/action |
| --- | --- | --- | --- |
| Initiative ready for comparison | Inicjatywy | Portfel | scenario membership proposal |
| Portfolio set proposed/published | Portfel | Initiative Card approval | Portfolio Scenario/version and one Decision input per Initiative |
| Portfolio Decision approved | Initiative Card/Decision | Plan | `APPROVED_BACKLOG` plus published scenario/version |
| Plan demand requires feasibility | Plan | Obciążenie | same scenario/version demand |
| Capacity conflict changes sequence | Obciążenie | Plan/Portfel | constraint and scenario diff |
| Schedule inputs ready | Plan + Obciążenie | Initiative Card approval | Plan/Capacity versions and Schedule Decision input |
| Schedule approved | Initiative Card/Decision | Realizacje | `SCHEDULED` and versioned Handoff Package |
| Handoff accepted | Inicjatywy | Realizacje | one Execution Case/read-back |
| Work created/changed | Realizacje | Praca | canonical Task/Decision projection |
| Work requires allocation | Praca | Zasoby | resource request/constraint |
| Exception exceeds tolerance | any Execution function | Sterowanie | source-linked Signal/Intervention |
| Management communication due | Realizacje/Sterowanie | Raporty | Report Run scope/source refs |
| Delivery evidence ready | Realizacje | Delivery Decision/Initiative Card read-back | Delivery Acceptance snapshot |
| Scope delivered/accepted | Realizacje | Results | Benefits Handoff |
| Benefit deviation | Results | Sterowanie or new source proposal | signal/corrective proposal |

## 12. Acceptance scenarios required for every function

Each implementation must prove: happy path; alternate valid path; validation failure; permission denial; cross-tenant denial; stale/conflict; integration read-back; partial failure and recovery; audit trail; keyboard/accessibility; first-use/filtered empty; unknown/partial/stale data; idempotent retry.

Acceptance requires current-SHA runtime and realDB evidence. Code, mocks, generated documents or green helper tests alone are insufficient.

## 13. Assumptions and open decisions

- **ASSUMPTION A-F01:** The parent canon's table-first shell and Workbench archetypes are binding.
- **ASSUMPTION A-F02:** `effectiveness_result` is consumed from Results and displayed, never authored, by Execution.
- **ASSUMPTION A-F03:** Decision and Task rows may share one typed registry projection but retain separate APIs/lifecycles.
- **OPEN DECISION OD-F01:** Zasoby activation model, noted in section 8.
- **OPEN DECISION OD-F02:** Exact Polish labels and CTA copy require UX/product approval without changing semantics.
- **OPEN DECISION OD-F03:** Mobile material-edit support for timeline, heatmap and allocation board remains to be set; mobile must at least support read/triage/deep-link.
- **OPEN DECISION OD-F04:** Exact formulas/thresholds for execution health and signal severity require a versioned metric contract. Until then health may be `UNKNOWN`, never guessed.
- **OPEN DECISION OD-F05:** Authority uncertainties for Definition, Delivery Acceptance and non-confirmed effectiveness are inherited from OD-07–OD-09 in the process contract; functions must fail closed until resolved.

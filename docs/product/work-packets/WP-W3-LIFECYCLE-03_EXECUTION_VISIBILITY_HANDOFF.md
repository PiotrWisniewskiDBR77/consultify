# WP-W3-LIFECYCLE-03 — Execution Visibility and Handoff Integrity Analysis

> Status: Completed
> Packet: WP-W3-LIFECYCLE-03
> Wave: 3 — First transformation lifecycle
> Priority: P0
> Date: 2026-03-23
> Canonical inputs read:
> - `EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`
> - `EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md`
> - `DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`
> - `EXECUTION_RESOURCE_BALANCING_AND_CAPACITY_OPERATIONS_V8.md`
> Supporting anchors:
> - `V8_IMPLEMENTATION_MASTER_PROGRAM.md` — §8.4 Wave 3
> - `work-packets/WP-W1-AI-03_EXECUTION_PROPOSAL_APPROVAL_SPINE.md`
> - `work-packets/WP-W1-TRUST-01_TRUST_AUDIT_OBSERVABILITY_BASELINE.md`
> - `work-packets/DECISION_LOG_WAVE_1.md`
> Additional context:
> - `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
> - `RESULTS_V8_SSOT.md`

---

## 1. Execution state visibility model

### 1.1 What must be visible

The canonical execution state model is defined across `EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md` §4 and `EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md` §3–6. The following execution state dimensions must be surfaced:

| State dimension | Source doctrine | Canonical objects |
|---|---|---|
| Task progress and status | Control Tower §4.1, Task/Decision Runtime §4 | `InitiativeTask` status, owner, due date, effort |
| Decision latency and resolution | Control Tower §4.4, Task/Decision Runtime §5 | `InitiativeDecision` status, decider, blocked-work count |
| Milestone health | Control Tower §4.1, Baseline Control §3.1 | `InitiativeMilestone` baseline vs current, variance |
| Initiative health | Control Tower §4.1 | Initiative status, overall credibility |
| Timeliness classification | Baseline Control §6 | `on_track`, `at_risk`, `late`, `critical_late`, `blocked_but_recoverable`, `no_baseline`, `no_estimate`, `insufficient_control_data` |
| Workload and capacity | Resource Balancing §3.1–3.3 | Per-person/team capacity, balancing states (`under_capacity` through `unknown_capacity`) |
| Blocker and dependency state | Control Tower §4.4 | Blocked work, active risks, critical dependencies, dependency blast radius |

### 1.2 Execution signals as the visibility contract

`EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md` §8 defines 13 minimum execution signals. These signals form the canonical visibility contract — they are the structured output of execution state that downstream consumers (operator control tower, delivery reporting, results tracking) must be able to read:

- `overdue_tasks_count`
- `blocked_tasks_count`
- `blocked_initiatives_count`
- `pending_blocking_decisions_count`
- `critical_risks_count`
- `owners_over_capacity_count`
- `milestones_at_risk_count`
- `stale_items_count`
- `missing_baseline_count`
- `missing_estimate_count`
- `critical_path_slip_count`
- `forecast_low_confidence_count`
- `rollover_pressure_count`

### 1.3 Honesty under weak data

All four canonical docs share one principle: execution visibility must degrade honestly when planning inputs are weak. The system must distinguish between "on track because data confirms it" and "unknown because data is missing." The timeliness states `no_baseline`, `no_estimate`, and `insufficient_control_data` (Baseline Control §6) are the canonical mechanism for this.

The resource balancing layer adds `unknown_capacity` (Resource Balancing §3.3) as the equivalent honest state for workload visibility.

### 1.4 Multi-level scope

Per Control Tower §6, execution state visibility must work at:

- one initiative
- one project with many initiatives
- cross-initiative project oversight
- future cross-project PMO oversight

The same signals and timeliness states apply at all levels. Aggregation rules (how initiative-level signals roll up to project or PMO level) are not yet specified in the canonical docs.

---

## 2. Operator control tower integration

### 2.1 What the control tower consumes from execution

The control tower (`EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`) is defined as "one operator layer over the canonical delivery objects" (§2). It does not create a second workflow. This means the control tower is a consumer of execution state, not a producer of separate execution truth.

The control tower consumes:

| Input | Source |
|---|---|
| Initiative baseline and status | Initiative objects |
| Task dates, status, owner, effort | `InitiativeTask` objects |
| Decisions and escalation state | `InitiativeDecision` objects |
| Risks, blockers and mitigation | Risk objects linked to initiatives/tasks |
| Dependencies and milestone links | `InitiativeDependency`, `InitiativeMilestone` |
| Time tracking or actual effort | Where available from task-level actuals |
| Execution signals (§1.2 above) | Computed from the above objects |

### 2.2 Operator actions

The control tower must support actions, not only visualization (Control Tower §5):

- Open the root object (initiative, task, decision)
- Assign or reassign responsibility
- Create or request a decision
- Escalate
- Add or update risk
- Trigger follow-up task creation
- Accept a recovery proposal
- Adjust timing through governed proposal flow

These actions mutate the canonical execution objects. The control tower does not maintain a separate action log — it writes back to the same objects that feed it.

### 2.3 Intervention queue

The control tower maintains one operator-facing queue (Control Tower §4.5):

- Overdue work
- Stale work
- Overloaded owners
- Pending decisions
- Critical blockers
- Recovery proposals
- Escalation candidates

This queue is the primary handoff surface between raw execution state and operator attention. It prioritizes what needs intervention now.

### 2.4 Recovery and correction

Per Control Tower §4.6, the operator layer supports:

- Corrective actions
- Workaround planning
- Re-sequencing proposals
- Reassignment proposals
- Escalation
- Schedule adjustment proposals
- Closure of resolved execution incidents

Recovery actions feed back into execution state (updated task dates, reassigned owners, new decisions), which in turn updates the execution signals and timeliness classifications.

---

## 3. Delivery reporting continuity

### 3.1 What delivery reporting consumes

`DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md` §3 defines reporting on:

- Milestone health
- Task progress and overdue work
- Blocked work
- Pending decisions
- Owner accountability
- Baseline drift
- Closure readiness

All of these are derived from the same canonical execution objects that feed the control tower. The reporting layer does not maintain separate execution truth.

### 3.2 Reporting honesty rule

Per Delivery Reporting §3: "reporting should stay honest when data is missing or planning quality is weak."

This aligns with the execution visibility honesty principle (§1.3 above). Reports must propagate the same timeliness states and confidence levels that the execution layer produces. A report must not claim "on track" when the execution layer classifies the work as `no_baseline` or `insufficient_control_data`.

### 3.3 Accountability chain

Per Delivery Reporting §6, reporting preserves:

- Accountable owner
- Last meaningful update
- Unresolved blockers
- Missed commitments
- Closure confirmation

This accountability chain is the reporting-side contract for handoff integrity: every execution object that appears in a report must carry its owner, last update timestamp, and blocker state. If any of these are missing, the report must flag the gap.

### 3.4 Continuity from execution to report

The data flow is:

```
Execution objects (tasks, decisions, milestones, risks)
  → Execution signals (§1.2)
  → Timeliness classification (§1.1)
  → Delivery report sections (milestone health, overdue work, blocked work, accountability)
```

No transformation should lose the timeliness state or accountability metadata. The report is a view over execution truth, not a separate truth.

---

## 4. Risk and blocker visibility

### 4.1 Risk taxonomy

`DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md` §4 defines the canonical risk types:

| Risk type | Description |
|---|---|
| Blocker | Work cannot proceed |
| Operational risk | Execution-level risk to delivery |
| Dependency risk | External or cross-initiative dependency threatens delivery |
| Timeline risk | Schedule is threatened |
| Owner or resource risk | Capacity or availability threatens delivery |
| Decision-latency risk | A pending decision is blocking or delaying work |

### 4.2 Risk metadata

Each risk must carry (Delivery Reporting §4):

- Severity
- Age
- Owner
- Mitigation plan
- Escalation state

### 4.3 Risk propagation path

Risks propagate through three layers:

1. **Execution layer**: risks are attached to tasks, decisions, milestones, or initiatives. The execution signals `critical_risks_count`, `blocked_tasks_count`, and `blocked_initiatives_count` aggregate risk state.

2. **Operator control tower**: the intervention queue (Control Tower §4.5) surfaces critical blockers and escalation candidates. The operator can act on risks (add mitigation, escalate, trigger recovery).

3. **Delivery reporting**: reports surface risk state as part of milestone health, blocked work, and accountability sections. Risks that have been escalated or are unresolved for extended periods appear as reporting-level warnings.

### 4.4 Dependency blast radius

Per Control Tower §4.4, the operator must see "dependency blast radius" — the downstream impact of a blocked or late item. This requires the execution layer to compute which milestones, tasks, and initiatives are affected when a specific item slips or is blocked.

This blast radius computation is also critical for the baseline control layer (Baseline Control §4), which must show "what downstream dates are affected when critical work slips."

### 4.5 Recovery doctrine

Per Delivery Reporting §5, when execution health degrades:

- Recovery plan proposals
- Unblock suggestions
- Escalation paths
- Timeline alternatives
- Decision-needed flags

Recovery must not be hidden in comments only — it must be a structured, visible part of the execution and reporting flow.

---

## 5. Handoff to Results/KPI tracking

### 5.1 The handoff boundary

Wave 3 (V8 Implementation Master Program §8.4) requires "handoff integrity into operator and reporting layers." The handoff to Results is the final downstream boundary of the execution lifecycle within this packet's scope.

`RESULTS_V8_SSOT.md` §6.5 defines the lifecycle continuity doctrine:

> KPI should survive the whole path: definition during initiative design → activation during execution → transition at closure → post-delivery benefits realization → long-term operational stewardship where applicable.

This means the execution layer must produce structured outputs that the Results module can consume at the "activation during execution" and "transition at closure" stages.

### 5.2 What execution must hand off to Results

| Handoff element | Execution source | Results consumer |
|---|---|---|
| Initiative completion state | Task/milestone completion, closure confirmation | `MetricTimeSeriesPoint` activation, `RoiTrackingArtifact` realized entries |
| Execution actuals (effort, duration) | Task-level actual effort, milestone actual dates | Planned-vs-actual comparison for KPI deviation analysis |
| Baseline variance | Baseline Control §3.2 variance tracking | `DeviationCase` root cause input |
| Risk and blocker history | Risk objects, escalation history | Post-delivery risk review, lessons learned |
| Decision outcomes | `InitiativeDecision` approved/rejected state | Decision impact on KPI trajectory |
| Accountability trail | Owner, last update, missed commitments | Accountability in executive review packs |

### 5.3 Strategy linkage

Per `RESULTS_V8_SSOT.md` §6.4, Results must make it obvious how initiatives influence KPIs. This requires the execution layer to preserve the `initiative → KPI` linkage metadata throughout execution. When an initiative completes or a milestone is reached, the linked KPIs should be notified (through the platform event system) so that Results can trigger measurement, review, or deviation analysis.

### 5.4 ROI evidence handoff

Per `RESULTS_V8_SSOT.md` §6.6, ROI values must preserve baseline snapshot, realized entries, and evidence. The execution layer's baseline control data (Baseline Control §3.1) and actual effort/outcome data are primary inputs to the ROI evidence chain.

The handoff contract: when an initiative reaches a closure or realization milestone, the execution layer must make available:

- Baseline assumptions (from initiative planning)
- Actual execution data (effort, duration, cost where tracked)
- Completion evidence (closure confirmation, acceptance criteria met)
- Variance summary (baseline vs actual)

### 5.5 Handoff integrity rule

The handoff from execution to Results must not lose:

1. **Timeliness context**: whether the initiative was on time, late, or recovered.
2. **Baseline variance**: the gap between plan and reality.
3. **Risk history**: what risks materialized and how they were resolved.
4. **Accountability**: who was responsible and whether commitments were met.

If any of these are missing at the handoff boundary, the Results module should flag the gap (consistent with the honesty principle from §1.3).

---

## 6. Baseline control and forecast integrity

### 6.1 Baseline truth preservation

Per `EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md` §3.1, the system must preserve:

- Baseline start
- Baseline end
- Baseline milestones
- Baseline dependency shape
- Baseline capacity assumptions where relevant

Baseline changes must be governed and auditable. This is critical for handoff integrity: if the baseline is silently changed, variance tracking and delivery reporting lose their anchor.

### 6.2 Variance tracking

Per Baseline Control §3.2, the system must compute and expose:

- Start variance
- Finish variance
- Milestone variance
- Owner-level execution drift
- Project-level schedule drift

These variance signals feed both the operator control tower (for intervention) and delivery reporting (for accountability and trend analysis).

### 6.3 Forecast model

Per Baseline Control §3.4, the forecast uses:

- Current progress
- Workload and availability
- Historical throughput or recent completion pattern
- Dependency pressure
- Unresolved blockers
- Decision latency

Forecasts must carry explicit confidence states (Baseline Control §3.5):

- `high_confidence`
- `medium_confidence`
- `low_confidence`
- `insufficient_data`

### 6.4 Critical path integrity

Per Baseline Control §4:

- Critical path must be explicitly identified
- Dynamic critical path updates as dates or dependencies change
- The system must distinguish between local lateness and path-critical lateness

This distinction is essential for handoff integrity: a report that flags all late tasks equally is less useful than one that highlights which late tasks are on the critical path and threaten the delivery date.

### 6.5 Cadence and rollover

Per Baseline Control §5, the system must track:

- Execution cadence
- Carryover pressure
- Unfinished work rolling into the next planning window
- Whether current throughput rhythm supports the delivery target

This is a leading indicator for delivery reporting: chronic carryover signals that the project is not truly progressing, even if individual tasks are being completed.

### 6.6 Estimate vs actual

Per `EXECUTION_RESOURCE_BALANCING_AND_CAPACITY_OPERATIONS_V8.md` §5, where actuals exist:

- Planned effort vs current estimate vs actual effort vs variance

This feeds both forecast quality (improving future predictions) and delivery reporting (honest accounting of execution efficiency).

---

## 7. Downstream dependency map

### 7.1 What this packet provides to downstream work

| Downstream packet/capability | What this packet provides | Consequence if missing |
|---|---|---|
| **Wave 6 — Results/KPI module** | Structured handoff contract (§5.2): completion state, actuals, variance, risk history, accountability trail. Strategy linkage preservation. ROI evidence inputs. | Results module cannot reliably consume execution outcomes; KPI lifecycle continuity breaks at the execution-to-results boundary. |
| **Wave 6 — Reports and Presentations** | Delivery reporting continuity model (§3): execution signals, timeliness states, accountability chain, risk propagation. Baseline variance data for report content. | Reports either duplicate execution truth or lose honesty guarantees when presenting delivery status. |
| **Wave 6 — Finance** | Execution actuals (effort, duration, cost) and baseline variance as inputs to financial analysis and ROI tracking. | Finance module cannot reconcile planned vs actual costs without execution-layer actuals. |
| **WP-W3-LIFECYCLE-01/02 (upstream lifecycle packets)** | Confirmation that execution visibility consumes the same canonical objects that upstream planning produces. No second workflow. | Risk of execution layer creating parallel truth that diverges from planning-layer objects. |
| **Wave 5 — Operator and support hardening** | Operator control tower integration model (§2): intervention queue, recovery actions, operator action paths. | Operator hardening builds on an undefined execution-to-operator interface. |
| **Wave 1 — Trust/Audit baseline** | Execution audit trail (from WP-W1-AI-03 §6) feeds the trust/observability baseline. Execution signals and timeliness states are observable health indicators. | Trust and observability cannot cover execution-layer health. |

### 7.2 What this packet depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W1-AI-03 — Execution proposal/approval spine** | `ExecutionAgentRun` lifecycle, proposal schema, approval states, apply results, audit trail | Completed |
| **WP-W1-TRUST-01 — Trust/audit/observability baseline** | Universal trust vocabulary, provenance ledger, support trace model, observability signals | Completed |
| **DECISION_LOG_WAVE_1.md** — Decisions 13, 14, 15 | Review expiration (72h), re-planning within same run, mixed-mode approval | Ratified |
| **TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md** | Canonical work object classes (`InitiativeTask`, `InitiativeDecision`, `InitiativeMilestone`), surface doctrine, readiness rules | Canonical |
| **EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md** | Control tower operating layers, execution signals, operator actions, multi-level scope | Canonical |
| **EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md** | Baseline truth, variance tracking, forecast model, critical path, cadence | Canonical |
| **DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md** | Reporting doctrine, risk taxonomy, recovery doctrine, accountability | Canonical |
| **EXECUTION_RESOURCE_BALANCING_AND_CAPACITY_OPERATIONS_V8.md** | Capacity model, workload model, balancing operations, estimate vs actual | Canonical |

---

## 8. Open questions and conflicts

### 8.1 Aggregation rules for multi-level execution signals

`EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md` §6 requires execution visibility at initiative, project, cross-initiative, and PMO levels. §8 defines 13 execution signals. However, no canonical doc specifies how these signals aggregate across levels. For example:

- Does `milestones_at_risk_count` at the project level sum all initiative-level counts, or does it re-evaluate at the project scope?
- Does `forecast_low_confidence_count` at the PMO level include initiatives with `insufficient_data`, or only those with an explicit low-confidence forecast?

**Recommendation:** Define aggregation as additive counts at each level, with `insufficient_data` items counted separately (not collapsed into `low_confidence`). This preserves the honesty principle. Needs product decision.

### 8.2 Execution-to-Results event contract

`RESULTS_V8_SSOT.md` §6.5 requires KPI lifecycle continuity through execution. The execution canonical docs define what data exists (completion state, actuals, variance) but do not define the event or notification mechanism for handing this data to Results.

**Recommendation:** Define a structured execution event (`initiative_milestone_reached`, `initiative_closed`, `task_completed_with_actuals`) that the Results module subscribes to. This is an implementation-level contract that should be specified during Wave 6 Results work, but the execution layer must be designed to emit these events.

### 8.3 Baseline change governance specifics

`EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md` §3.1 states "baseline changes should be governed and auditable" but does not specify the governance mechanism (who can approve a rebaseline, what approval flow applies, whether AI can propose a rebaseline).

Baseline Control §7 says the system should support "explicit recommendation to rebaseline when reality has structurally changed," and AI §9 says AI may "prepare a rebaseline recommendation pack" but may not "silently rebaseline."

**Recommendation:** Rebaseline should follow the same proposal/approval spine defined in WP-W1-AI-03 when AI-initiated, and a governed workflow (operator proposes, project lead approves) when human-initiated. The approval class should be `requires_human_approval` with `risk_class = governance_transition`. Needs product confirmation.

### 8.4 Capacity-confidence impact on delivery forecasts

`EXECUTION_RESOURCE_BALANCING_AND_CAPACITY_OPERATIONS_V8.md` §7 defines capacity-confidence doctrine (missing estimates, missing owners, inconsistent schedules). `EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md` §3.5 defines forecast confidence states. However, the interaction between capacity confidence and forecast confidence is not specified.

**Recommendation:** If the capacity layer reports `unknown_capacity` for owners on the critical path, the forecast confidence should be automatically capped at `low_confidence` or `insufficient_data`. This prevents forecasts from claiming high confidence when the workload data underlying them is unreliable.

### 8.5 No conflicts detected between canonical docs

The following pairs were checked for conflicts and found consistent:

- Control Tower §2 ("one operator layer over canonical delivery objects") ↔ Delivery Reporting §3 (reporting on the same canonical objects): Both consume the same objects. No parallel truth.
- Baseline Control §6 timeliness states ↔ Control Tower §4.3 timeliness states: Control Tower lists `on_track`, `at_risk`, `late`, `blocked`, `no_baseline`, `no_estimate`. Baseline Control adds `critical_late`, `blocked_but_recoverable`, `insufficient_control_data`. These are additive refinements, not contradictions. The Baseline Control list is the superset.
- Resource Balancing §5 (estimate vs actual) ↔ Baseline Control §3.2 (variance tracking): Resource Balancing focuses on effort variance; Baseline Control focuses on schedule variance. Complementary, not overlapping.
- Control Tower §5 (operator actions) ↔ Delivery Reporting §5 (recovery doctrine): Both describe recovery paths. Control Tower defines the action mechanics; Delivery Reporting defines the reporting visibility of recovery. Aligned.
- Task/Decision Runtime §2 ("initiative → milestones → tasks → decisions → execution signals → reporting outputs") ↔ Control Tower §7 (data doctrine reusing canonical data): The control tower explicitly reuses initiative-native objects. Consistent.

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - Execution state visibility model with 13 canonical signals, 8 timeliness states, multi-level scope, and honesty-under-weak-data principle
  - Operator control tower integration model: consumer of canonical objects, intervention queue, operator actions, recovery and correction paths
  - Delivery reporting continuity: same-truth consumption, reporting honesty rule, accountability chain, no-loss data flow from execution to report
  - Risk and blocker visibility: 6-type risk taxonomy, risk metadata, 3-layer propagation path (execution → operator → reporting), dependency blast radius, recovery doctrine
  - Handoff to Results/KPI tracking: structured handoff contract (completion state, actuals, variance, risk history, accountability), strategy linkage preservation, ROI evidence inputs, handoff integrity rule
  - Baseline control and forecast integrity: baseline truth preservation, variance tracking, forecast with confidence states, critical path integrity, cadence/rollover, estimate vs actual
  - Downstream dependency map (6 downstream consumers, 8 upstream dependencies)
  - Open questions and conflict analysis (4 items identified, 0 conflicts between canonical docs)
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Multi-level signal aggregation rules (§8.1) need a product decision before implementation
  - Execution-to-Results event contract (§8.2) must be specified during Wave 6 but execution layer must be designed to support it
  - Baseline change governance mechanism (§8.3) needs product confirmation of the approval flow
- **Questions requiring escalation:**
  1. How should execution signals aggregate across initiative, project, and PMO levels? Should `insufficient_data` items be counted separately or collapsed? (§8.1)
  2. What is the event/notification contract for handing execution completion data to the Results module? (§8.2)
  3. What governance flow applies to rebaseline actions — should it use the WP-W1-AI-03 proposal/approval spine? (§8.3)
  4. Should forecast confidence be automatically capped when capacity data on the critical path is unreliable? (§8.4)

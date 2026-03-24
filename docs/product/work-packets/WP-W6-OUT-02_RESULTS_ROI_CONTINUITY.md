# WP-W6-OUT-02 — Results and ROI Continuity Analysis

> Status: Completed
> Packet: WP-W6-OUT-02
> Wave: 6 — Outputs, finance and realization
> Priority: P1
> Date: 2026-03-23
> Canonical inputs read:
> - `RESULTS_V8_SSOT.md`
> - `RESULTS_KPI_OPERATING_MODEL_AND_OKR_FUNCTIONS_V8.md`
> - `RESULTS_SCORECARDS_OKR_AND_EXECUTIVE_REVIEW_RUNTIME_V8.md`
> - `RESULTS_DEVIATION_ACTION_AND_ROI_GOVERNANCE_V8.md`
> - `RESULTS_ROI_REGISTRY_AND_REALIZATION_TRACKING_RUNTIME_V8.md`
> - `RESULTS_PLATFORM_INTEGRATION_PLAN_V8.md`
> Supporting anchors:
> - `V8_IMPLEMENTATION_MASTER_PROGRAM.md` — §8.7 Wave 6
> - `work-packets/WP-W3-LIFECYCLE-03_EXECUTION_VISIBILITY_HANDOFF.md` — execution handoff events
> - `work-packets/DECISION_LOG_WAVE_3.md` — Decision W3-9 (results handoff event contract)

---

## 1. KPI operating model

### 1.1 Dual-mode KPI identity

The canonical KPI operating model (`RESULTS_KPI_OPERATING_MODEL_AND_OKR_FUNCTIONS_V8.md` §3–4) requires KPIs to function in two simultaneously valid modes:

| Mode | Anchor | Lifecycle |
|---|---|---|
| **Initiative-linked** | Initiative business case, promise mapping, benefits realization | design → baseline → activation → measurement → review → deviation → improvement → benefits realization |
| **Standalone operational** | Business operations, quality management, process control, compliance | create → baseline → activate → measure → review → deviate → improve → steward |

Both modes share the same `MetricDefinition` object and the same time-series, freshness, and governance infrastructure. The difference is the origin and linkage context, not the measurement mechanics.

### 1.2 Full KPI lifecycle

The canonical lifecycle spans six phases (`KPI Operating Model` §4.1–4.6):

1. **Design** — candidate KPI defined during initiative shaping or standalone request; includes formula, unit, direction, baseline hypothesis, target hypothesis, cadence, source hypothesis.
2. **Baseline and measurement readiness** — baseline captured, measurement-readiness checklist completed, source-system and cadence confirmed, threshold and alert setup, readiness gate before activation.
3. **Activation during execution** — regular updates, missing-entry control, freshness monitoring, early warnings, variance visibility, accountability for data submission.
4. **Transition at closure** — formal handoff: ownership transfer if needed, post-delivery measurement schedule, benefit-tracking start date, open risks documented.
5. **Post-delivery effects tracking** — realized effect tracking, sustained trend monitoring, variance vs plan, benefit realization review, recovery action if benefits do not materialize.
6. **Long-term operational stewardship** — standing KPI for operations, quality management, service-level reviews, functional scorecards, recurring action cycles.

### 1.3 Governing doctrines

Six doctrines govern KPI truth (`RESULTS_V8_SSOT.md` §6):

| Doctrine | Core rule |
|---|---|
| Semantic truth | One metric keeps one governed meaning across Results, Reports, Execution, Initiatives, executive packs |
| Source and freshness | Every metric explains where the value came from, how recent it is, whether manual or synced, whether trusted/stale/disputed |
| Deviation-to-action | Out-of-band KPI triggers detection → owner response → explanation → corrective actions → follow-up → closure |
| Strategy linkage | Initiatives influence KPIs → KPIs roll into scorecards → scorecards support strategic goals → operational KPI connect process reality to strategy |
| KPI-finance linkage | Economically relevant KPIs may carry linked finance interpretation, evidence, reconciliation status, and dedicated reconciliation workflow |
| Lifecycle continuity | KPI survives the whole path from initiative design through post-delivery benefits realization to long-term stewardship |

### 1.4 Quality-management and strategy bridge modes

Beyond the two primary modes, KPIs support two additional bridge modes (`KPI Operating Model` §5):

- **Quality-management mode** — control thresholds, recurring review boards, corrective and preventive actions, process-owner accountability, evidence and auditability.
- **Strategy-operations bridge mode** — strategic goal linkage, translation of goals into measurable outcomes, visibility where operations do not support strategy and vice versa.

### 1.5 Canonical object model

The minimum object model (`RESULTS_V8_SSOT.md` §5):

`MetricDefinition` · `MetricTimeSeriesPoint` · `MetricDimension` · `MetricSlice` · `MetricView` · `Scorecard` · `Objective` · `KeyResult` · `DeviationCase` · `CorrectiveActionPlan` · `RoiTrackingArtifact` · `ResultsReviewPack`

---

## 2. OKR functions

### 2.1 Separation from KPI

OKR is a separate strategic function inside Results, not a renaming of KPI (`KPI Operating Model` §6.1):

- KPIs are enduring control metrics.
- OKRs are time-bounded strategic commitment structures.

KPIs may feed OKRs, but must not be collapsed into them.

### 2.2 Canonical OKR doctrine

OKR supports (`Scorecards, OKR and Executive Review` §5):

- Objectives and key results
- Separate OKR cycles and timeboxes
- Progress state and confidence
- Owner and cadence
- Alignment to initiatives and scorecards
- Status history

### 2.3 KPI ↔ OKR relationship

The system allows (`KPI Operating Model` §6.3):

| Relationship | Description |
|---|---|
| KPI backing a key result | A key result uses one or more KPIs for progress measurement |
| Non-KPI key results | Strategic commitment precedes mature measurement; governed manual progress |
| OKR-to-KPI conversion | Mature OKR tracking converts into standing KPI where appropriate |

### 2.4 Canonical OKR objects

`Objective` · `KeyResult` · `ScorecardMetricSlot` · `ResultsReviewCadence`

### 2.5 Strategy alignment chain

The canonical chain (`Scorecards, OKR and Executive Review` §2):

```
objective → key result → KPI → initiative → execution actions → executive review
```

The rollup and alignment doctrine (`Scorecards, OKR and Executive Review` §7) must answer:

- Which initiatives support a key result?
- Which KPIs support an objective?
- Where is strategy under-supported by active work?
- Where is work happening but result alignment is weak?

---

## 3. Scorecards and executive review

### 3.1 Scorecard doctrine

A scorecard supports (`Scorecards, OKR and Executive Review` §4):

- Grouped KPIs with per-period target expectations
- Overall status and owner accountability
- Rollup visibility
- Links to strategic areas or perspectives

Canonical scorecard types: executive, program, functional, operational, department.

### 3.2 Executive review cadence

Results supports recurring review cycles (`Scorecards, OKR and Executive Review` §6):

- Weekly, monthly, quarterly cadences
- Each review preserves: reviewed metrics, status summary, deviations and concerns, owner commentary, actions decided, next review expectation

### 3.3 Executive review pack

The `ExecutiveReviewPack` and `ResultsNarrative` objects (`Scorecards, OKR and Executive Review` §3) structure the review output. AI may draft executive review narratives and summarize what changed since the last review, but may not silently change official scorecard status or create executive truth without review.

### 3.4 Review-to-action loop

Actions from reviews link back into initiatives, tasks, and decisions (`Scorecards, OKR and Executive Review` §10). This closes the loop: executive review → identified gap → corrective action → execution → next review.

---

## 4. Deviation management

### 4.1 Closed-loop doctrine

The canonical deviation loop (`Deviation, Action and ROI Governance` §2–5):

```
threshold breach → case creation → severity assignment → owner acknowledgement
→ root cause analysis → corrective plan → linkage to initiatives/tasks/decisions
→ effectiveness verification → closure
```

Core rule: "a red KPI without ownership, explanation and verification is not managed performance."

### 4.2 Deviation case structure

Each `DeviationCase` carries:

- Threshold-based detection trigger
- Severity (amber / red)
- Owner acknowledgement state
- Root cause analysis
- Corrective and preventive actions
- Follow-up checks
- Effectiveness verification
- Recurring issue detection
- Escalation and review-board routing

### 4.3 Corrective action doctrine

Each `CorrectiveActionPlan` carries (`Deviation, Action and ROI Governance` §4):

- Owner, due date, status
- Relation to a deviation case
- Relation to an initiative, task, or decision
- Verification outcome

This keeps Results connected to Execution — corrective actions are not isolated inside the Results module but link to the execution objects that must change.

### 4.4 Verification and closure

Deviation cases do not close only because time passed (`Deviation, Action and ROI Governance` §5). Closure requires:

- Updated KPI evidence
- Owner review
- Verified effectiveness
- Explicit resolution state

### 4.5 Quality-management loop integration

The quality-management mode (`KPI Operating Model` §5.1) extends deviation management with:

- Control thresholds for recurring review boards
- Recurring deviations tracked as chronic issues
- Corrective and preventive actions (CAPA pattern)
- Process-owner accountability
- Evidence and auditability

---

## 5. ROI registry and realization tracking

### 5.1 Registry structure

The ROI registry (`ROI Registry and Realization Tracking` §3) is the canonical catalog of economic analyses. It lists:

- Initiative-linked and standalone analyses
- Draft, active-tracking, reconciled, amended, and archived analyses

The registry answers: what analyses exist, who owns them, what they are linked to, whether tracking is current, whether reconciliation is pending.

### 5.2 Two canonical ROI modes

| Mode | Anchor | Characteristics |
|---|---|---|
| **Initiative-linked** | Initiative business case, gate readiness, benefits realization | Created inside an initiative; preserves initiative reference, stage context, baseline version; post-delivery tracking continues after initiative closure |
| **Standalone** | Operational improvement, quality economics, investment options, portfolio tracking | Not anchored in one initiative; owns its own cadence, review, and reconciliation path; optional later linkage to initiative |

Rule: "standalone ROI must not be treated as a second-class experiment surface" (`ROI Registry` §4.2).

### 5.3 Canonical ROI lifecycle

Seven phases (`ROI Registry` §5.1–5.7):

1. **Analysis request and intake** — from initiative shaping, standalone business request, finance/PMO request, operational issue, or discovery output.
2. **Analysis building and modeling** — scope, scenarios, baseline assumptions, CAPEX/OPEX modeling, benefit-line modeling, timing, risks, confidence.
3. **Baseline finalization** — approval-ready baseline, version snapshot, final assumptions, owner and finance reviewer confirmation.
4. **Tracking activation** — cadence selection, realized-entry accountability, benefit owner assignment, measurement start date.
5. **Realized monitoring** — periodic realized entries, delta vs baseline, cumulative realization, evidence attachment, no-entry and stale-tracking signals.
6. **Review and reconciliation** — owner review, finance review, reconciliation with financial truth, explanation of major variances, amended-baseline decision.
7. **Closure or long-term stewardship** — `RECONCILED`, `AMENDED`, long-term active stewardship, or archival.

### 5.4 ROI evidence doctrine

ROI values must not be silently editable claims (`RESULTS_V8_SSOT.md` §6.6). They preserve:

- Baseline snapshot
- Realized entries with evidence
- Version history
- Review and lock semantics
- Immutable audit-safe history
- Corrections and reversals as explicit governed operations

### 5.5 Relationship to KPI

ROI and KPI are distinct but connected (`ROI Registry` §10):

- ROI analyses may link to KPIs where economic value depends on measured outcomes
- KPIs support benefits realization reviews
- ROI handoff is visible at initiative closure
- Results reviews combine KPI and ROI evidence without collapsing them into one object

Rule: "KPI describe measured performance and outcome signals; ROI describes the economic interpretation and financial realization of change."

---

## 6. Execution handoff integration (Wave 3)

### 6.1 Decision W3-9 — Results handoff event contract

`DECISION_LOG_WAVE_3.md` Decision W3-9 establishes the minimal canonical event family:

| Event | Trigger | Results consumer action |
|---|---|---|
| `initiative_baseline_confirmed` | Initiative baseline approved | KPI baseline and target finalization; ROI baseline snapshot |
| `execution_progress_updated` | Periodic execution state change | KPI freshness update; variance monitoring |
| `milestone_completed` | Initiative milestone reached | KPI measurement trigger; ROI realized-entry prompt |
| `delivery_risk_changed` | Risk severity change | Deviation case input; benefits-at-risk flag |
| `rebaseline_approved` | Governed rebaseline accepted | KPI target adjustment; ROI amended-baseline decision |
| `handover_completed` | Initiative delivery formally closed | KPI ownership handoff; benefit-tracking start; ROI tracking activation |
| `realization_tracking_started` | Post-delivery tracking begins | KPI post-delivery effects phase; ROI realized monitoring phase |

### 6.2 Structured handoff contract from WP-W3-LIFECYCLE-03

The execution handoff packet (`WP-W3-LIFECYCLE-03` §5.2) defines what execution must hand off to Results:

| Handoff element | Execution source | Results consumer |
|---|---|---|
| Initiative completion state | Task/milestone completion, closure confirmation | `MetricTimeSeriesPoint` activation, `RoiTrackingArtifact` realized entries |
| Execution actuals | Task-level actual effort, milestone actual dates | Planned-vs-actual comparison for KPI deviation analysis |
| Baseline variance | Baseline Control variance tracking | `DeviationCase` root cause input |
| Risk and blocker history | Risk objects, escalation history | Post-delivery risk review, lessons learned |
| Decision outcomes | `InitiativeDecision` approved/rejected state | Decision impact on KPI trajectory |
| Accountability trail | Owner, last update, missed commitments | Accountability in executive review packs |

### 6.3 Handoff integrity rules

Per `WP-W3-LIFECYCLE-03` §5.5, the handoff must not lose:

1. **Timeliness context** — whether the initiative was on time, late, or recovered.
2. **Baseline variance** — the gap between plan and reality.
3. **Risk history** — what risks materialized and how they were resolved.
4. **Accountability** — who was responsible and whether commitments were met.

If any of these are missing at the handoff boundary, the Results module must flag the gap (consistent with the honesty-under-weak-data principle).

### 6.4 Lifecycle continuity doctrine alignment

`RESULTS_V8_SSOT.md` §6.5 requires KPI to survive the whole path: definition during initiative design → activation during execution → transition at closure → post-delivery benefits realization → long-term operational stewardship.

The Wave 3 event contract (Decision W3-9) provides the structural mechanism for the "activation during execution" and "transition at closure" stages. The Results module subscribes to these events to trigger measurement, review, or deviation analysis at the right lifecycle moments.

### 6.5 ROI evidence chain from execution

Per `WP-W3-LIFECYCLE-03` §5.4, when an initiative reaches a closure or realization milestone, the execution layer makes available:

- Baseline assumptions (from initiative planning)
- Actual execution data (effort, duration, cost where tracked)
- Completion evidence (closure confirmation, acceptance criteria met)
- Variance summary (baseline vs actual)

These feed directly into the ROI tracking activation and realized monitoring phases.

---

## 7. Downstream dependency map

### 7.1 What this packet provides to downstream work

| Downstream consumer | What this analysis provides | Consequence if missing |
|---|---|---|
| **WP-W6-OUT-01 (Reports/Presentations)** | Canonical KPI, scorecard, and ROI surfaces that reports must snapshot; executive review pack structure; deviation case summaries for delivery reports | Reports build on undefined result truth; risk of parallel metric surfaces |
| **WP-W6-OUT-03 (Finance)** | KPI-finance linkage doctrine; ROI registry structure and reconciliation model; realized-value evidence chain | Finance module cannot reconcile ROI with KPI truth; silent divergence between financial and operational metrics |
| **WP-W6-OUT-04 (Publish/Review)** | Review cadence model; executive review pack structure; scorecard and OKR status that enter published artifacts | Published artifacts lack governed result context |
| **Wave 3 execution layer** | Confirmation that Results consumes the W3-9 event contract; structured handoff contract is the integration seam | Execution-to-Results boundary remains undefined; KPI lifecycle breaks at closure |
| **Platform integration (all modules)** | Integration contracts from `RESULTS_PLATFORM_INTEGRATION_PLAN_V8.md` §4: 9 canonical contracts covering initiative→KPI, closure→benefits, deviation→task, calendar→review, chat→KPI, connector→metric, finance→ROI, report→snapshot, KPI↔Finance | Results remains isolated; other modules build local metric surfaces |

### 7.2 What this packet depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W3-LIFECYCLE-03** | Execution handoff contract, execution signals, timeliness states, ROI evidence inputs | Completed |
| **DECISION_LOG_WAVE_3 — Decision W3-9** | Canonical event family for execution-to-Results handoff | Ratified |
| **DECISION_LOG_WAVE_3 — Decision W3-8** | Signal aggregation rules (summary up, traceability down) | Ratified |
| **WP-W1-AI-03** | Execution proposal/approval spine (used for rebaseline governance per Decision W3-10) | Completed |
| **WP-W1-TRUST-01** | Trust vocabulary, provenance ledger, audit trail model | Completed |
| **RESULTS_V8_SSOT.md** | Primary canonical truth for Results module | Canonical |
| **RESULTS_KPI_OPERATING_MODEL_AND_OKR_FUNCTIONS_V8.md** | KPI lifecycle, dual-mode identity, OKR function | Canonical |
| **RESULTS_SCORECARDS_OKR_AND_EXECUTIVE_REVIEW_RUNTIME_V8.md** | Scorecard, OKR, executive review cadence | Canonical |
| **RESULTS_DEVIATION_ACTION_AND_ROI_GOVERNANCE_V8.md** | Deviation loop, corrective actions, ROI governance | Canonical |
| **RESULTS_ROI_REGISTRY_AND_REALIZATION_TRACKING_RUNTIME_V8.md** | ROI registry, dual-mode ROI, realization lifecycle | Canonical |
| **RESULTS_PLATFORM_INTEGRATION_PLAN_V8.md** | Cross-module integration map and contracts | Canonical |

---

## 8. Open questions and conflicts

### 8.1 Event contract depth for Wave 6

Decision W3-9 defines a minimal event family for Wave 3. The Results canonical docs (`RESULTS_V8_SSOT.md` §6.5, `KPI Operating Model` §4.4) require richer lifecycle transitions — particularly around measurement-readiness gates, KPI ownership handoff details, and benefit-tracking cadence initialization. Wave 6 implementation must extend the W3-9 event contract to cover these transitions.

**Recommendation:** Extend the event family with: `kpi_measurement_readiness_confirmed`, `kpi_ownership_transferred`, `benefit_tracking_cadence_set`, `roi_baseline_finalized`, `roi_tracking_activated`. These are Results-side events that complement the execution-side events from W3-9.

### 8.2 Standalone KPI/ROI governance without initiative lifecycle events

The canonical docs define both initiative-linked and standalone modes for KPI and ROI. The Wave 3 handoff contract is initiative-centric (all events reference initiative lifecycle). Standalone KPIs and standalone ROI analyses need their own activation, review, and deviation triggers that do not depend on initiative events.

**Recommendation:** Define a parallel governance trigger set for standalone mode: `standalone_kpi_activated`, `standalone_kpi_review_due`, `standalone_roi_tracking_activated`, `standalone_roi_review_due`. These should use the same platform event infrastructure but with different origin context.

### 8.3 KPI-Finance reconciliation workflow boundary

`RESULTS_V8_SSOT.md` §6.4A defines KPI-finance linkage doctrine including "dedicated reconciliation workflow when comparison needs review and action." `RESULTS_DEVIATION_ACTION_AND_ROI_GOVERNANCE_V8.md` §7 mentions "explicit KPI-Finance reconciliation workflow where financial interpretation and KPI truth diverge." However, the boundary between what Results owns and what Finance owns in this reconciliation workflow is not specified.

**Recommendation:** Results owns the KPI truth side; Finance owns the financial model truth side. The reconciliation workflow is a shared surface with dual ownership. This needs a cross-packet decision between WP-W6-OUT-02 (this packet) and WP-W6-OUT-03 (Finance). Escalate to program level.

### 8.4 Executive review pack composition across modules

`RESULTS_SCORECARDS_OKR_AND_EXECUTIVE_REVIEW_RUNTIME_V8.md` §6 defines executive review cadence within Results. `RESULTS_PLATFORM_INTEGRATION_PLAN_V8.md` §3.12 defines integration with Reports and Presentations for board-review packs and deck generation. The question is whether the `ExecutiveReviewPack` is a Results-native object that Reports consumes, or whether Reports assembles its own executive pack from Results data.

**Recommendation:** The `ExecutiveReviewPack` should be a Results-native governed object. Reports and Presentations consume it as a snapshot source. Reports may add presentation formatting and narrative but must not create a parallel executive truth. This aligns with the SSOT §6.1 semantic truth doctrine.

### 8.5 No conflicts detected between canonical docs

The following pairs were checked and found consistent:

- `RESULTS_V8_SSOT.md` §6.5 (lifecycle continuity) ↔ `KPI Operating Model` §4 (canonical lifecycle): The SSOT defines the principle; the Operating Model defines the phases. Aligned.
- `KPI Operating Model` §6 (OKR separate from KPI) ↔ `Scorecards, OKR and Executive Review` §5 (OKR doctrine): Both maintain OKR as separate strategic function. Consistent.
- `Deviation, Action and ROI Governance` §6 (ROI governance) ↔ `ROI Registry` §5 (ROI lifecycle): Governance doc defines the evidence and lineage rules; Registry doc defines the lifecycle phases. Complementary.
- `RESULTS_V8_SSOT.md` §4.4 (ROI surface) ↔ `ROI Registry` §4 (two canonical modes): SSOT mentions "initiative-linked and standalone ROI analyses"; Registry elaborates both modes. Consistent.
- `KPI Operating Model` §4.4 (transition handoff) ↔ `WP-W3-LIFECYCLE-03` §5 (execution handoff): Both describe the same boundary. The Operating Model defines what Results needs; the execution packet defines what execution provides. Aligned.

---

## 9. Packet output

- **Status:** Completed
- **Key findings:**
  1. The Results realization layer is architecturally coherent — KPI dual-mode identity (initiative-linked + standalone), separate OKR function, scorecard/executive review cadence, closed-loop deviation management, and dual-mode ROI registry form one governed performance system.
  2. The Wave 3 execution handoff event contract (Decision W3-9) provides the structural bridge between execution and Results, but must be extended for Wave 6 to cover measurement-readiness gates, KPI ownership transfers, and ROI-specific lifecycle events.
  3. Standalone KPI and standalone ROI modes need their own governance trigger sets independent of initiative lifecycle events — the current event contract is initiative-centric.
  4. The KPI-Finance reconciliation workflow boundary is unresolved — Results and Finance both claim governance over reconciliation, and a cross-packet decision is needed.
  5. No conflicts were found between the six canonical Results docs or between the Results docs and the Wave 3 execution handoff contract.
- **Escalation items:**
  1. **KPI-Finance reconciliation ownership** (§8.3) — requires cross-packet decision between WP-W6-OUT-02 and WP-W6-OUT-03 to define which module owns which side of the reconciliation workflow.
  2. **Standalone mode governance triggers** (§8.2) — needs product confirmation that standalone KPI/ROI governance events are in scope for Wave 6 implementation.
  3. **Executive review pack ownership** (§8.4) — needs confirmation that `ExecutiveReviewPack` is a Results-native object consumed by Reports, not a Reports-assembled artifact.

---

## Related packets

- `WP-W3-LIFECYCLE-03_EXECUTION_VISIBILITY_HANDOFF.md`
- `DECISION_LOG_WAVE_3.md`
- `WP-W6-OUT-01` (Reports/Presentations — downstream)
- `WP-W6-OUT-03` (Finance — downstream, shared reconciliation boundary)
- `WP-W6-OUT-04` (Publish/Review — downstream)

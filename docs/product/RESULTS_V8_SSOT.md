# Results v8 SSOT

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical product truth for Results covering KPI, scorecards, OKRs, dashboards, deviations, ROI and executive review

---

## 1. Why this document exists

`consultify` needs Results as the proof that transformation produced measurable outcomes.

This module should not be a passive reporting shelf.

It should be the place where the organization:

- defines what success means
- tracks whether it is happening
- understands when performance deviates
- links results to initiatives
- governs ROI and evidence
- drives corrective action

---

## 2. Core statement

`Results v8` should be the governed performance layer that connects:

- metrics
- key results
- scorecards
- strategic goals
- initiatives
- ROI
- executive reviews
- action after deviation

And it should support KPI in two simultaneously valid modes:

- initiative-linked transformation and benefits tracking
- standalone operational, quality-management and process-performance control

Additional optional linkage:

- `KPI may link to Finance analysis and modeling where economic interpretation is valuable`

Rule:

`Results is not just a BI tab; it is the evidence and intervention layer of the transformation system`

---

## 3. What Results owns

`Results v8` owns:

- KPI and key-result definitions
- AI-generated KPI and OKR proposal orchestration
- time-series and refresh state
- metric dimensions and slices
- scorecards and OKR alignment
- KPI deviation and corrective loop
- ROI registry, analysis building and realized tracking with evidence
- executive and operator result views
- result-linked drill-down to initiatives, tasks and decisions
- cross-platform result integration and review materialization
- governed `KPI <-> Finance` linkage metadata and review context on the Results side

---

## 4. Canonical product surfaces

At product level, Results should support at least:

### 4.1 KPI and metrics surface

For:

- KPI library
- definitions
- measurement readiness
- time-series
- owners
- status
- freshness
- drill-down
- initiative-linked and standalone KPI modes

### 4.2 Scorecards and OKR surface

For:

- strategic goals
- objectives
- key results
- separate OKR cycles
- rollups
- scorecard views
- alignment to initiatives

### 4.3 KPI review and deviation surface

For:

- KPI reports
- review cadences
- deviation cases
- root cause
- corrective actions
- verification and closure

### 4.4 ROI and realized value surface

For:

- ROI registry
- initiative-linked and standalone ROI analyses
- structured analysis building
- baseline assumptions
- realized entries
- evidence
- variance
- versioning
- review and governance

### 4.5 Dashboards and wallboards surface

For:

- executive dashboards
- operational KPI dashboards
- wallboards
- scheduled results packs

---

## 5. Canonical Results object model

At minimum the package should distinguish:

- `MetricDefinition`
- `MetricTimeSeriesPoint`
- `MetricDimension`
- `MetricSlice`
- `MetricView`
- `Scorecard`
- `Objective`
- `KeyResult`
- `DeviationCase`
- `CorrectiveActionPlan`
- `RoiTrackingArtifact`
- `ResultsReviewPack`

---

## 6. Governing doctrines

### 6.1 Semantic truth doctrine

One metric should keep one governed meaning across:

- Results
- Reports
- Execution
- Initiatives
- executive packs

### 6.2 Source and freshness doctrine

Every metric should explain:

- where the value came from
- how recent it is
- whether it was manually entered or synced
- whether the value is trusted, stale or disputed

### 6.3 Deviation-to-action doctrine

When a KPI goes out of band, the system should support:

- detection
- owner response
- explanation
- corrective actions
- follow-up
- closure

### 6.4 Strategy linkage doctrine

Results should make it obvious how:

- initiatives influence KPIs
- KPIs roll into scorecards
- scorecards support strategic goals
- standing operational KPI connect process reality back to strategy

### 6.4A KPI-finance linkage doctrine

When economically relevant, Results should support:

- linked finance interpretation
- linked finance evidence
- linked reconciliation status
- dedicated reconciliation workflow when comparison needs review and action
- no silent collapse of metric truth into finance model truth

#### Reconciliation ownership

> V8 Decision W6-5 applied — 2026-03-23

- **Results** owns KPI truth and the reconciliation workflow trigger. Reconciliation starts in Results.
- **Finance** owns finance interpretation, finance model truth, and CFO review semantics. Finance resolves finance-side meaning.
- Reconciliation is a shared cross-module process; the primary runtime anchor starts in Results.

Canonical rule:

`Results starts reconciliation, Finance resolves finance-side meaning`

### 6.4B Standalone KPI/ROI governance triggers

> V8 Decision W6-6 applied — 2026-03-23

Standalone KPI/ROI governance events are in scope. The system must not depend only on initiative-linked flows for governance triggers.

Standalone mode requires its own activation, review, and deviation triggers that do not depend on initiative lifecycle events. Results dual-mode logic (initiative-linked + standalone) must be honored in event and review design.

---

### 6.5 Lifecycle continuity doctrine

KPI should survive the whole path:

- definition during initiative design
- activation during execution
- transition at closure
- post-delivery benefits realization
- long-term operational stewardship where applicable

### 6.5A Results handoff event contract

> V8 Decision W3-9 applied — 2026-03-23

Results consumes a minimal canonical event family emitted by the execution layer:

- `initiative_baseline_confirmed`
- `execution_progress_updated`
- `milestone_completed`
- `delivery_risk_changed`
- `rebaseline_approved`
- `handover_completed`
- `realization_tracking_started`

These events are the structured handoff mechanism that enables KPI lifecycle continuity through execution.

### 6.6 ROI evidence doctrine

ROI values should not be silently editable claims.

They should preserve:

- baseline snapshot
- realized entries
- evidence
- version history
- review and lock semantics
- initiative-linked and standalone registry modes

### 6.7 ExecutiveReviewPack ownership

> V8 Decision W6-7 applied — 2026-03-23

`ExecutiveReviewPack` is a **Results-native** governed object. Results owns the executive review semantics, structure, and truth.

Reports and Presentations consume `ExecutiveReviewPack` as a structured snapshot source. Reports may add presentation formatting and narrative, but must not create a parallel executive truth or become the source-of-truth owner of executive review semantics.

---

## 7. AI role

AI may:

- summarize trends
- detect anomalies
- create draft KPI and OKR candidates from governed context
- assemble draft review tables and packs
- propose questions for review
- draft executive narratives
- suggest corrective actions
- explain likely drivers with citations where possible
- propose optional finance linkage for economically meaningful KPI

AI may not:

- silently alter metric values
- silently close deviation cases
- silently rewrite ROI truth
- silently replace KPI truth with modeled finance estimates

---

## 8. Acceptance criteria

`Results v8` is strong when:

- KPIs are governed and source-aware
- scorecards and OKRs connect to initiatives and results
- deviations become actionable workflows
- ROI is evidence-based
- dashboards and reports are connected to one metrics truth

---

## 9. Related canonical docs

- `RESULTS_V8_BENCHMARK.md`
- `RESULTS_KPI_OPERATING_MODEL_AND_OKR_FUNCTIONS_V8.md`
- `RESULTS_AI_COPILOT_AUTOMATION_AND_AGENT_RUNTIME_V8.md`
- `RESULTS_PLATFORM_INTEGRATION_PLAN_V8.md`
- `RESULTS_ROI_REGISTRY_AND_REALIZATION_TRACKING_RUNTIME_V8.md`
- `RESULTS_KPI_DEVIATION_MANAGEMENT_V3.md`
- `ROI_TRACKING_CONTRACT_V3.md`

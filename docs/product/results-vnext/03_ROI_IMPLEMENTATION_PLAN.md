# Consultify Results vNext — ROI Implementation Plan

**Document type:** Implementation architecture, delivery plan and acceptance contract  
**Status:** Target implementation plan / architecture decisions applied  
**Version:** 1.0  
**Date:** 2026-08-09  
**Owners:** Product, Results, Finance Architecture, Engineering, Enterprise UX  
**Primary source:** `02_CONSULTIFY_ROI_BENEFITS_REALIZATION_SYSTEM.md`

## 0. Executive decision

Results ROI is the economic lifecycle and value contract of an Initiative. It is not a free-standing calculator, a Finance dashboard, a KPI child, or a single editable ROI percentage.

The implementation must preserve three simultaneous truths:

1. **Approved / Committed** — the immutable promise used for a decision;
2. **Current Forecast** — the latest expected outcome;
3. **Actual / Realized** — evidence-backed observed value.

The Initiative and ROI lifecycles run in parallel. An Initiative may be `Completed` while its ROI Case remains in `Benefits Realization` or `Post-Investment Review`.

This plan applies the following founder decisions:

- every new ROI Case is obligatorily linked 1:1 to an Initiative;
- Results ROI and Finance Investment Analysis remain separate models for this delivery stage (decision **D06**, founder response 6C);
- the separation is explicit, not accidental: a versioned future-integration seam is designed now;
- no migration of legacy ROI data into the new aggregate at launch;
- legacy ROI remains a read-only archive, clearly labelled as legacy and never presented as current governed truth;
- delivery proceeds in parallel work packages behind bounded contracts;
- Teresa participates from the first usable increment, initially as a cited advisor and workflow guide;
- the product supports both an individual work perspective and an organizational portfolio/governance perspective.

## 1. Critical review of the current state

### 1.1 What is usable

The repository already contains useful bounded capabilities:

- organization-scoped Results APIs;
- initiative-linked `roi_assumptions` and periodic `roi_realized_values`;
- KPI-to-Finance reconciliation primitives;
- ROI portfolio and initiative-detail read seams;
- KPI evidence, provenance and deviation concepts;
- MyWork, Decision, audit and event infrastructure;
- table, preview and workspace UI primitives;
- Initiative ownership, lifecycle and role concepts;
- existing ROI, KPI and Finance screens that can provide interaction fragments.

These are inputs and compatibility references, not proof that the target ROI product already exists.

### 1.2 Structural defects

The current ROI implementation is not an expandable foundation for the target specification:

- `roi_assumptions` is one flat row per Initiative rather than a governed aggregate;
- costs, benefits and assumptions are headline values instead of independently owned, timed and evidenced line items;
- there is no explicit BAU/reference case;
- Initiative status is used as a proxy for ROI state in several UI paths;
- approval does not freeze a reconstructable model snapshot;
- forecast revisions are not first-class versions;
- actual entries lack sufficient provenance, verification and correction semantics;
- current calculations conflate benefits, costs and CAPEX and do not implement a deterministic, auditable cash-flow engine;
- current UI exposes plan/realized summaries, not Approved/Forecast/Actual;
- duplicated `ROITrackingView` and `ROIAnalysisView` create competing surfaces over the same incomplete truth;
- existing Finance `InvestmentCase` and Results ROI concepts have no formal version-pinned integration boundary;
- legacy and v8 realization tables can be mistaken for one canonical actual ledger;
- missing values can collapse into numeric zero in display or aggregation paths.

### 1.3 Critical contradictions resolved by this plan

| Conflict | Resolution |
|---|---|
| Earlier Results doctrine permits standalone ROI | Superseded for new vNext ROI Cases: `initiative_id` is mandatory. Legacy standalone artifacts remain archive-only. |
| Earlier ROI status depends on Initiative lifecycle | Rejected. ROI has an independent lifecycle and synchronization rules. |
| Initiative completion locks/closes ROI | Rejected. Completion normally transitions ROI to Benefits Realization. |
| Results ROI and Finance InvestmentCase may both claim economic truth | Deliberately separate under D06, with typed references and no silent synchronization. |
| Current portfolio calls benefit/CAPEX a form of ROI | Replaced by an organization-policy formula registry and deterministic engine. |
| Existing approved-like rows have no full snapshot | They are not promoted. They remain explicitly legacy/read-only. |

## 2. Product boundaries

### 2.1 Results ROI owns

- the Initiative value contract;
- baseline and Business-as-Usual;
- assumptions, costs and benefits;
- benefit ownership and evidence requirements;
- Approved, Forecast and Actual economic views;
- scenario selection for the ROI Case;
- ROI lifecycle and approval context;
- benefit-realization tracking;
- variance explanation and contribution/attribution notes;
- Post-Investment Review;
- ROI work obligations, review state and audit history;
- portfolio visibility and organizational learning inputs.

### 2.2 Finance owns during D06 (founder response 6C)

- Finance-native models and investment-analysis artifacts;
- accounting and corporate-finance interpretation;
- Finance model inputs, calculation versions and reviewer semantics;
- CFO controls, finance policy and finance-side approval evidence;
- source financial statements, forecast models and valuations;
- Finance artifact lineage and freshness.

### 2.3 Shared but not collapsed

- a Results ROI Case may reference a specific Finance artifact and version;
- a Finance artifact may reference the ROI Case and the Initiative;
- values cross the boundary only through an explicit, versioned mapping or evidence link;
- Results never overwrites Finance values;
- Finance never overwrites Approved, Forecast or Actual ROI truth;
- divergence produces a reconciliation case, not silent last-write-wins synchronization.

### 2.4 Non-goals

This delivery does not include:

- migrating legacy rows into vNext ROI Cases;
- merging Results ROI and Finance InvestmentCase;
- probabilistic Monte Carlo simulation;
- a full FX, tax, depreciation or consolidation engine;
- automatic monetization of all operational improvements;
- automatic benefit attribution to an Initiative;
- automatic approval or silent financial-model edits by Teresa;
- advanced reference-class intelligence before sufficient governed history exists;
- full mobile financial-model editing;
- portfolio dashboards that duplicate the canonical ROI Case list.

## 3. Target domain aggregate

### 3.1 Aggregate root: `ROICase`

```yaml
ROICase:
  id: uuid
  organization_id: uuid
  initiative_id: uuid # mandatory and unique for active case
  title: string
  owner_user_id: uuid
  status: ROIStatus
  currency: string
  granularity: monthly | annual
  analysis_start: date
  analysis_end: date
  original_approved_snapshot_id: uuid | null
  latest_approved_snapshot_id: uuid | null
  current_forecast_version_id: uuid | null
  current_actual_snapshot_id: uuid | null
  next_action_type: string | null
  next_action_due_at: datetime | null
  next_review_at: datetime | null
  visibility_mode: restricted_acl | private | scope | management_chain | open_org
  visibility_policy_id: uuid
  sensitivity: normal | confidential | highly_confidential
  approved_summary_visibility_policy_id: uuid | null
  row_version: integer
  created_by: uuid
  created_at: datetime
  updated_by: uuid
  updated_at: datetime
```

Invariants:

- `initiative_id` is mandatory;
- one Initiative has at most one active vNext ROI Case;
- organization of Initiative and ROI Case must match;
- deleting an Initiative cannot silently delete an approved ROI history;
- normal users cannot hard-delete an approved, submitted, tracking or closed case;
- all mutations require expected `row_version` or an equivalent optimistic-concurrency token.
- build/decision content defaults to restricted access; publication of an Approved summary never broadens access to the full Case, inputs or evidence.

### 3.2 Child entities

#### `ROIBaseline`

Stores current measured state, BAU forecast, intervention comparison, source, confidence, owner and freeze state. Baseline values must be period-aware and must not be overwritten after approval.

#### `ROIAssumption`

One record per material assumption with category, typed value, unit, confidence, evidence, owner, downside/base/upside values and sensitivity rank.

#### `ROICostLine`

One-time or recurring positive outflow with category, amount, currency, timing, recurrence, confidence, source, owner and scenario behavior.

#### `ROIBenefitLine`

Financial or non-financial benefit with category, owner, formula, timing/ramp, evidence, confidence, optional KPI link and a double-counting group.

The optional KPI relationship is a typed `ROIBenefitEvidenceLink`, not a loose foreign key. It stores Benefit Line and KPI IDs, pinned KPI definition version, expected unit, evidence purpose, linked actor/time, freshness and dispute status. A stale/disputed KPI changes evidence state or opens reconciliation; it never silently overwrites ROI Actual.

#### `ROIScenario`

Named scenario with type `downside | base | upside | custom`, input overrides and lifecycle state. A scenario stores inputs, never a manually typed headline ROI.

#### `ROICashFlowPeriod`

Normalized engine output for one period and version: costs, financial benefits, net cash flow, cumulative cash flow and discount factor.

#### `ROICalculationRun`

Immutable run record containing input snapshot/hash, engine version, policy version, scenario, status, metrics, warnings, errors, start/end timestamps and initiator.

#### `ROIForecastVersion`

Immutable business version of current expectations, with reason, author, input snapshot, linked calculation run and comparison to approval.

#### `ROIApprovalSnapshot`

Immutable reconstruction package containing all approved inputs, normalized cash flows, metrics, evidence completeness, reviewer decisions, engine/policy versions and semantic hash.

#### `ROIActualEntry`

Append-only period entry for actual cost, benefit or observation, linked to a cost/benefit line where applicable. It includes provenance, verification and correction/reversal relationship.

#### `ROIVariance`

Structured Approved-versus-Forecast or Approved/Forecast-versus-Actual variance with one or more causes, contribution estimates, narrative, owner and action state.

#### `ROIPostInvestmentReview`

Scheduled review containing delivery, cost, benefit, timing, assumptions, attribution/contribution, adoption/execution and lessons sections.

#### `ROIEventLog`

Append-only domain audit including before/after values for material numeric changes and references to Decision and MyWork objects.

### 3.3 Version families

The system distinguishes:

- **working revisions** — autosave, undo/redo, collaborative editing and compute snapshots inside one Draft;
- **business versions** — created at submission, approval, formal forecast publication, reapproval and closure;
- **calculation runs** — immutable engine executions against a working or business snapshot.

Frequent edits must not create hundreds of business versions. Every calculation run must still be reproducible.

## 4. Canonical lifecycle

```text
NOT_STARTED
  -> DRAFT
  -> MODELING
  -> READY_FOR_REVIEW
  -> SUBMITTED_FOR_APPROVAL
  -> CHANGES_REQUESTED -> MODELING
  -> APPROVED
  -> TRACKING
  -> BENEFITS_REALIZATION
  -> POST_INVESTMENT_REVIEW_DUE
  -> POST_INVESTMENT_REVIEW
  -> CLOSED

SUBMITTED_FOR_APPROVAL -> REJECTED
Any pre-close material state -> CANCELLED (policy-controlled)
```

### 4.1 Transition rules

| From | To | Minimum guard | Resulting side effects |
|---|---|---|---|
| Not Started | Draft | Initiative exists; create permission | Case, owner, audit event, MyWork setup task |
| Draft | Modeling | minimum identity and horizon | completeness evaluation |
| Modeling | Ready for Review | required sections complete; successful fresh base compute | review package draft |
| Ready for Review | Submitted | submit permission; no unresolved blocking exceptions | Decision request, reviewer tasks, business version |
| Submitted | Changes Requested | reviewer reason required | author MyWork item, audit |
| Submitted | Approved | policy reviewers satisfied; maker-checker | immutable approval snapshot, Initiative summary update |
| Submitted | Rejected | approver reason required | Decision result, audit |
| Approved | Tracking | Initiative approved/started or explicit activation | forecast cadence and obligations |
| Tracking | Benefits Realization | Initiative completed or benefit window begins | owner obligations continue; ROI remains open |
| Benefits Realization | PIR Due | schedule reached/material trigger | review task and decision context |
| PIR Due | PIR | reviewer starts | frozen review input snapshot |
| PIR | Closed | required review and evidence resolved/waived | lessons, final snapshot, closure event |
| Any eligible | Cancelled | reason and permission | retain actual costs/benefits; optional cancellation review |

Server-side transition services are authoritative. The UI must not infer state changes from Initiative labels.

### 4.2 Initiative synchronization

- Initiative entering approval checks ROI policy; missing or incomplete ROI may warn or block.
- Initiative approval can activate an already approved ROI Case for Tracking.
- Initiative completion transitions ROI to Benefits Realization when the benefit window remains.
- Initiative cancellation preserves the ROI Case and actuals and may require a cancellation review.
- a changed Initiative scope never mutates the approved ROI snapshot; it creates a forecast change or formal reapproval.

## 5. Financial semantics

### 5.1 Sign convention

- cost lines are stored as positive outflows;
- benefit lines are stored as positive incremental value;
- engine cash flow applies signs deterministically;
- actual reversals/corrections are explicit entry types;
- UI never relies on users guessing positive/negative conventions.

### 5.2 Missing is not zero

`missing`, `not applicable`, `not yet measured`, `disputed` and numeric `0` are separate states. Aggregation and display must preserve them. A headline metric is unavailable when required inputs are unavailable; it is not coerced to zero.

### 5.3 Baseline / BAU

Benefits are incremental against an approved BAU/reference case, not automatically against the last observed value. Baseline includes source date, period, expected BAU movement and confidence.

### 5.4 Benefit rules

- revenue uplift enters financial ROI through incremental contribution/margin unless organization policy explicitly permits another definition;
- cost reduction and cost avoidance remain distinct;
- released capacity is non-financial until a declared conversion path proves saving, avoided hiring, additional production or another financial effect;
- non-financial benefits are retained but excluded from financial ROI;
- each material benefit has an accountable owner;
- double-counting groups require resolution before a clean approval.

### 5.5 Cost rules

The model supports one-time and recurring CAPEX/OPEX, internal labor, implementation, integration, training, change, disruption, maintenance and contingency. Organization policy determines mandatory categories and treatment.

### 5.6 Required metrics

Default simple ROI:

```text
ROI = (Total Financial Benefits - Total Costs) / Total Costs
```

Other MVP metrics:

- total investment;
- total and annualized financial benefit;
- net cash flow and cumulative cash flow;
- payback and break-even date;
- NPV;
- benefit/cost ratio;
- benefit realization percentage;
- variance versus original Approved and current Forecast.

IRR is optional and policy-controlled.

### 5.7 Policy registry

`ROIPolicyVersion` defines base currency, discount rate, horizon constraints, tax/internal-labor/cost-avoidance treatment, required metrics, materiality thresholds, finance review threshold, maker-checker rules and PIR requirements. Calculations and approvals pin its version.

## 6. Deterministic engine boundary

### 6.1 Contract

```text
Typed inputs
  -> validation and normalization
  -> period cash-flow expansion
  -> scenario overrides
  -> metrics calculation
  -> validation findings
  -> immutable CalculationRun
```

The engine must be a pure domain package without UI, database or network dependencies. Persistence and orchestration wrap it.

### 6.2 Input contract

Inputs include:

- currency and granularity;
- analysis horizon;
- policy version;
- baseline/BAU;
- cost and benefit lines with timing/ramp;
- scenario-specific assumption values;
- discount rate and optional finance parameters.

### 6.3 Output contract

Outputs include:

- normalized period series;
- headline metrics;
- break-even/payback status;
- missing-input and numerical warnings;
- sensitivity-ready dependency metadata;
- engine version, policy version and semantic input hash.

### 6.4 Safety rules

- divide-by-zero and undefined IRR yield typed `N/A`, never fabricated results;
- mixed currencies fail validation unless explicit conversion is provided;
- calculations use decimal-safe arithmetic and declared rounding policy;
- scenario output is regenerated from inputs;
- recomputation against the same canonical input and engine version is deterministic;
- changing engine methodology does not mutate historical calculation runs;
- approval requires a successful, current run matching the submitted snapshot.

## 7. Governance and maker-checker

### 7.1 Roles

- ROI Author / Analyst;
- Initiative Owner;
- Benefit Owner;
- Finance Reviewer;
- Business Sponsor;
- Approver / Executive Approver;
- Actual Entry Contributor;
- Actual Verifier;
- Post-Investment Reviewer;
- ROI Policy Administrator.

One person may hold multiple roles only where policy permits. Material/high-risk cases must prohibit self-approval.

### 7.2 Permissions by action and state

Authorization is evaluated server-side using organization, Initiative membership/effective role, ROI state, materiality and action. Separate permissions cover draft editing, forecast editing, actual entry, verification, submission, approval, rejection, reapproval, policy changes, reopening and invalidation.

### 7.3 Approval package

The reviewer sees:

- Initiative and decision request;
- base/downside/upside results;
- Approved candidate metrics and cash flow;
- top assumptions and sensitivity;
- low-confidence/high-impact inputs;
- evidence completeness;
- unresolved exceptions/comments;
- declared double-counting resolutions;
- calculation and policy versions.

### 7.4 Immutability

- approval snapshot is immutable;
- forecast change creates a new forecast version;
- reapproval creates a new approved version and preserves the original;
- actual entries are append-only; corrections reference the corrected entry;
- approved artifacts cannot be normally deleted, only superseded, archived or invalidated with reason and authority.

### 7.5 Visibility and published summary

Build and Decision phases default to `RESTRICTED_ACL`. The full Case, model inputs, comments and evidence retain their policy after approval. Approval may create a separate minimal `ApprovedROISummaryProjection` under a broader governed policy, containing only explicitly permitted headline facts. The summary is not a copy of mutable domain state and cannot be used to infer hidden assumptions, evidence, participants or counts.

Authorization is applied before list counts, search, aggregation, export, notification and Teresa context construction. Runtime acceptance covers owner, Initiative owner, reviewer, manager/portfolio viewer, approved-summary viewer and restricted outsider.

## 8. Information architecture and enterprise UX

### 8.1 Top-level ROI list

The Results ROI tab opens the organization economic portfolio, not a calculator or dashboard.

Columns:

- ROI Case / Initiative;
- Initiative Owner and status;
- ROI Owner and ROI status;
- approval state;
- Approved ROI;
- Current Forecast ROI;
- Actual ROI;
- Approved / Forecast payback;
- Approved / Forecast NPV;
- benefit realization percentage;
- confidence / evidence quality;
- next action;
- next review date.

Filters and saved views:

- My ROI Cases;
- My approvals;
- My benefit obligations;
- organization / business unit;
- build case;
- awaiting decision;
- tracking;
- benefits realization;
- review due;
- underperforming;
- confidence and evidence quality;
- owner, approval state and Initiative state.

Table headers remain visible for empty, loading and error states. Missing data displays `—` or a typed `N/A`, never a misleading zero.

### 8.2 Preview

Preview is read-oriented and decision-relevant:

- identity, Initiative and owners;
- independent Initiative and ROI statuses;
- Approved / Forecast / Actual headline comparison;
- confidence and evidence quality;
- next action and review due date;
- top risk/variance;
- relations to Initiative, Decision, MyWork, KPI evidence and pinned Finance references;
- one primary action: `Open ROI Study`;
- lifecycle review actions only when authorized and contextually appropriate.

Preview does not contain the full model, twelve tabs or complex editors.

### 8.3 Phased full tool

The full workspace uses four phases rather than exposing twelve equal tabs at once:

#### Build Case

- Summary;
- Baseline;
- Assumptions;
- Costs;
- Benefits;
- Scenarios;
- Cash Flow;
- Sensitivity.

#### Decision

- Review readiness;
- Approval;
- comments and exceptions;
- decision history.

#### Realize Value

- Current Forecast;
- Actuals and evidence;
- variance;
- reconciliation;
- benefit-owner obligations.

#### Learn

- Post-Investment Review;
- lessons;
- complete history and lineage.

The sticky workspace bar shows Back, title, lifecycle, version, Initiative context, current phase, freshness/next obligation, one primary CTA, More and fullscreen. The CTA follows lifecycle: complete baseline, compute, submit, review, update forecast, record actual or complete PIR.

### 8.4 Individual and organizational perspectives

Individual perspective prioritizes assigned work:

- cases I own;
- approvals/reviews assigned to me;
- benefits I own;
- actuals/evidence due;
- forecast updates and PIR tasks overdue.

Organizational perspective prioritizes governance:

- value portfolio and exposure;
- approval pipeline;
- underperforming and low-confidence cases;
- benefit-realization coverage;
- overdue reviews;
- forecast accuracy and variance taxonomy when sufficient data exists.

Both perspectives query the same ROI Case truth. They are saved views and role-aware summaries, not separate databases or competing modules.

## 9. API contract

All endpoints are rooted at `/api/vnext/results/roi`, organization-scoped, permission-checked and version-aware.

### 9.1 Registry and case

```text
GET    /api/vnext/results/roi/cases
POST   /api/vnext/results/roi/cases
GET    /api/vnext/results/roi/cases/:caseId
PATCH  /api/vnext/results/roi/cases/:caseId
POST   /api/vnext/results/roi/cases/:caseId/archive
GET    /api/vnext/results/roi/cases/:caseId/history
```

Create accepts an Initiative ID and returns the existing case on an idempotent duplicate request or a typed conflict with its deep link.

### 9.2 Model sections

```text
GET/PUT /cases/:caseId/baseline
GET/POST/PATCH/DELETE /cases/:caseId/assumptions[/:id]
GET/POST/PATCH/DELETE /cases/:caseId/cost-lines[/:id]
GET/POST/PATCH/DELETE /cases/:caseId/benefit-lines[/:id]
GET/POST/DELETE /cases/:caseId/benefit-lines/:benefitLineId/kpi-evidence-links[/:linkId]
GET/POST/PATCH/DELETE /cases/:caseId/scenarios[/:id]
```

Writes require expected aggregate or section version and return validation/completeness state.

### 9.3 Compute and versions

```text
POST /cases/:caseId/calculation-runs
GET  /cases/:caseId/calculation-runs/:runId
POST /cases/:caseId/forecast-versions
GET  /cases/:caseId/versions
GET  /cases/:caseId/compare?left=&right=
```

Long-running compute uses persisted jobs, idempotency key, immutable input snapshot, retry and exactly-one committed result.

### 9.4 Lifecycle and decisions

```text
POST /cases/:caseId/transitions/ready-for-review
POST /cases/:caseId/transitions/submit
POST /cases/:caseId/transitions/request-changes
POST /cases/:caseId/transitions/approve
POST /cases/:caseId/transitions/reject
POST /cases/:caseId/transitions/start-tracking
POST /cases/:caseId/transitions/start-realization
POST /cases/:caseId/transitions/start-post-review
POST /cases/:caseId/transitions/close
POST /cases/:caseId/transitions/cancel
POST /cases/:caseId/reapprove
```

### 9.5 Actuals, evidence and review

```text
GET/POST /cases/:caseId/actuals
POST     /cases/:caseId/actuals/:entryId/verify
POST     /cases/:caseId/actuals/:entryId/corrections
GET/POST/PATCH /cases/:caseId/variances[/:varianceId]
GET/PUT  /cases/:caseId/post-investment-review
POST     /cases/:caseId/post-investment-review/complete
```

### 9.6 Future Finance seam

```text
GET/POST   /cases/:caseId/finance-links
DELETE     /cases/:caseId/finance-links/:linkId
POST       /cases/:caseId/finance-reconciliations
GET        /cases/:caseId/finance-reconciliations
```

Every link pins `finance_artifact_type`, `finance_artifact_id`, `finance_version_id`, mapping version, source/as-of, semantic unit/currency and link purpose.

### 9.7 Legacy archive

```text
GET /api/vnext/results/roi/legacy/cases
GET /api/vnext/results/roi/legacy/cases/:sourceType/:legacyId
```

No `POST`, `PUT`, `PATCH` or `DELETE` exists under `/legacy`. Unsupported mutation methods fail closed and archive reads remain organization-scoped and audited.

## 10. Schema and storage plan

Create new namespaced tables; do not mutate legacy tables into the target model:

- `rvn_roi_cases`;
- `rvn_roi_visibility_policies` and `rvn_roi_visibility_acl`;
- `rvn_roi_baselines`;
- `rvn_roi_assumptions`;
- `rvn_roi_cost_lines`;
- `rvn_roi_benefit_lines` and `rvn_roi_benefit_evidence_links`;
- `rvn_roi_scenarios`;
- `rvn_roi_working_revisions`;
- `rvn_roi_calculation_runs`;
- `rvn_roi_cashflow_periods`;
- `rvn_roi_forecast_versions`;
- `rvn_roi_approval_snapshots`;
- `rvn_roi_actual_entries`;
- `rvn_roi_variances` and `rvn_roi_variance_causes`;
- `rvn_roi_post_investment_reviews`;
- `rvn_roi_event_log`;
- `rvn_roi_finance_links`;
- `rvn_roi_finance_reconciliations`.

Required controls:

- organization-scoped unique keys and indexes;
- foreign keys to Initiative, user and pinned internal objects where stable;
- append-only protection for snapshots, runs, event log and actual history;
- semantic decimal types, not floating-point storage for money;
- explicit currency, unit, period and timezone;
- JSON only for immutable snapshots or bounded extension data, not as a substitute for queryable core fields;
- soft archival/invalidation for governed records;
- retention and legal-hold hooks;
- row version and idempotency keys;
- tenant isolation in query, cache, job envelope and object storage.

## 11. Legacy archive strategy

Legacy sources include `roi_assumptions`, `roi_realized_values`, `v8_roi_realization_entries` and legacy ROI UI/API surfaces.

Rules:

1. no automatic backfill into vNext;
2. legacy records remain read-only;
3. legacy UI is labelled `Legacy ROI archive — not governed under vNext`;
4. legacy values are never shown in Approved/Forecast/Actual columns of a new Case;
5. users may open archived detail and source provenance where available;
6. creating a vNext Case for an Initiative with legacy data may offer a reviewed, explicit import proposal later, but it is out of current scope;
7. legacy endpoints receive deprecation telemetry and no new capabilities;
8. archive access remains organization-scoped and auditable.

## 12. Events and integrations

### 12.1 Domain events emitted by ROI

- `roi.case_created`;
- `roi.case_ready_for_review`;
- `roi.case_submitted`;
- `roi.changes_requested`;
- `roi.case_approved`;
- `roi.case_rejected`;
- `roi.tracking_started`;
- `roi.forecast_published`;
- `roi.actual_recorded`;
- `roi.actual_verified`;
- `roi.material_variance_detected`;
- `roi.benefits_realization_started`;
- `roi.post_review_due`;
- `roi.post_review_completed`;
- `roi.case_closed`;
- `roi.case_cancelled`;
- `roi.finance_reconciliation_required`.

Each event uses the shared versioned `ResultsEventEnvelope`: organization, aggregate/case and Initiative IDs, business and schema version, actor/effective role, policy version, correlation, causation and idempotency IDs, timestamp, reason/evidence references and before/after or state hash. Contract tests verify schema compatibility and consumer idempotency.

### 12.2 Events consumed

- Initiative baseline confirmed;
- Initiative submitted/approved/started/completed/cancelled;
- execution progress and scope changed;
- rebaseline approved;
- handover completed;
- KPI evidence updated/disputed;
- Finance artifact approved/superseded/stale;
- user/role ownership changed.

Consumers must be idempotent. Events request evaluation or transition; they do not directly rewrite immutable truth.

## 13. Teresa from day one

Teresa is an advisor and orchestrator, never an autonomous approver or silent model editor.

### 13.1 First increment

Teresa can:

- explain the current phase and next required action;
- identify missing baseline, owner, evidence or cost/benefit categories;
- distinguish facts, historical evidence, estimates and unsupported assumptions;
- propose draft assumptions or downside inputs with citations and confidence;
- warn about raw revenue, monetized time saving, missing ramp-up and double counting;
- draft reviewer questions and variance explanations;
- create a proposal that the user explicitly accepts.

### 13.2 Context contract

Teresa receives only version-pinned ROI context:

- Case and Initiative IDs;
- current lifecycle and permissions;
- specific working/business/calculation version IDs;
- evidence references;
- policy version;
- unresolved validation findings;
- allowed proposal actions.

Every Teresa output stores provider/model/prompt/tool version, input evidence digest, citations, confidence and user disposition. Teresa cannot change values, submit, approve, verify actuals or close a Case without the accountable user's explicit governed action.

## 14. MyWork and Decision integration

### 14.1 MyWork

Create or update idempotent obligations for:

- start/complete ROI study;
- provide baseline, cost, benefit, assumption or evidence;
- review low-confidence/high-impact assumptions;
- resolve double-counting findings;
- submit/review/approve;
- update forecast;
- provide or verify actuals;
- explain material variance;
- conduct and approve PIR.

An obligation references the Case plus the exact child object/version where applicable. Completing a task does not bypass the ROI transition guard.

Individual views use these obligations for `My ROI Cases`, `My approvals` and `My benefits due`.

### 14.2 Decision

Submission creates or updates a governed Decision request containing the pinned submitted version, calculation run, scenario range, assumptions, risks, evidence quality, exceptions and reviewer comments.

Decision outcomes map to ROI transitions:

- Approve -> Approved snapshot;
- Reject -> Rejected;
- Request Changes -> Changes Requested;
- Defer -> remains submitted with next review date.

The Decision record and ROI event reference each other. A Decision cannot approve a different version from the one presented.

## 15. Parallel delivery plan

Parallel execution is allowed only after contracts are frozen. Packages own disjoint files or modules and integrate through reviewed interfaces.

### WP0 — Contract freeze and baseline

Outputs:

- precedence/supersession note;
- aggregate, lifecycle, permission and event contracts;
- API/OpenAPI fixtures;
- Teresa context/proposal/action contract;
- legacy inventory/read-only plan;
- exact baseline SHA, test inventory and ownership map.

Gate: architecture review accepts invariants and no competing ROI aggregate remains unspecified.

### WP1 — Domain and deterministic engine

Outputs:

- typed domain models and validators;
- policy version contract;
- pure cash-flow/scenario/metrics engine;
- semantic hashing and validation results;
- known-answer unit suite.

May run in parallel with WP2 after WP0.

### WP2 — Persistence, jobs and lifecycle

Outputs:

- new tables and repositories;
- transaction boundaries and optimistic concurrency;
- compute-run job orchestration;
- lifecycle transition service;
- immutable snapshots/event log;
- tenant and permission enforcement.

### WP3 — Registry, preview and Quick Create

Outputs:

- typed top-level ROI Case table;
- individual/organizational saved views;
- preview and Initiative relation;
- Initiative-first Quick Create with duplicate prevention;
- loading/empty/error and deep-link behavior.
- Teresa guidance for empty state, legacy posture, duplicate Case conflict, permissions and next action.

May use contract-backed fixtures until WP2 API is ready; fixture mode cannot count as acceptance.

### WP4 — Build Case workspace

Outputs:

- baseline/BAU;
- assumption register;
- cost/benefit line editors;
- scenarios, cash flow, metrics and initial sensitivity;
- completeness and validation findings;
- Teresa proposals with explicit acceptance.

### WP5 — Decision and approval

Outputs:

- review readiness;
- comments/exceptions;
- MyWork reviewer obligations;
- Decision request;
- maker-checker approval and immutable snapshot;
- Initiative summary read model.

### WP6 — Forecast, actual and benefit realization

Outputs:

- forecast business versions;
- append-only actuals/evidence/verification/corrections;
- variance classification;
- post-Initiative-completion continuation;
- benefit-owner view and overdue obligations.

### WP7 — PIR, learning and portfolio governance

Outputs:

- review scheduling and structured PIR;
- lessons and close transition;
- organization portfolio metrics based only on governed data;
- Teresa post-review draft;
- audit/history UI.

### WP8 — Future Finance seam

Outputs:

- version-pinned link ledger;
- freshness and supersession events;
- reconciliation request/status;
- comparison UX without value collapse;
- contract tests with Finance fixtures.

### WP9 — Legacy archive and hardening

Outputs:

- read-only archive route and UI;
- endpoint deprecation telemetry;
- accessibility, localization, performance and recovery;
- security/tenant tests;
- realDB and exact-SHA runtime evidence.

## 16. Test and evidence strategy

### 16.1 Known-answer financial tests

Maintain independent reviewed workbooks/fixtures for at least:

1. one-time investment plus level monthly benefit;
2. recurring cost and ramped benefit;
3. downside/base/upside assumption overrides;
4. delayed start and fractional payback;
5. negative ROI/no payback;
6. non-financial-only benefit;
7. missing input and true zero distinction;
8. mixed-currency rejection;
9. correction/reversal actual entries;
10. reapproval preserving original Approved comparison.

Verify intermediate period cash flows, discount factors, cumulative cash flow and headline outputs. Matching two implementations is not sufficient evidence without an independently reviewed known answer.

### 16.2 Domain and service tests

- lifecycle transition matrix, including rejected transitions;
- Initiative completion while ROI remains open;
- original/latest Approved, Forecast and Actual immutability;
- maker-checker/self-approval policy;
- row-version conflict and idempotent retry;
- snapshot reconstruction;
- benefit double-counting and missing-data validation;
- actual verification/correction audit;
- event idempotency and MyWork/Decision linkage;
- organization isolation and cross-tenant IDOR;
- Finance link pinned-version/freshness semantics.

### 16.3 API and job tests

- exact request/response fixtures;
- create duplicate Initiative Case behavior;
- job kill/retry/race produces one committed run;
- timeout leaves prior successful result intact and marks new run failed;
- approval rejects stale/mismatched compute;
- cold reopen returns the same business version and snapshot hash;
- legacy endpoints cannot mutate archive records.

### 16.4 UX acceptance

- top-level row is always a ROI Case/Initiative pair;
- table header remains visible for loading, empty and error;
- single click opens preview, Enter/double click opens tool, Esc closes preview;
- Back restores ROI tab, filters, sorting, scroll and selected view;
- preview shows Approved/Forecast/Actual without editing the model;
- tool shows current phase and exactly one primary CTA;
- missing values are not displayed as zero;
- permission and lifecycle-disabled actions explain why;
- keyboard-only completion of creation, review and actual-entry flows;
- PL/EN, dark/light and 200% zoom;
- desktop 1920/1440/1280 and tablet read/review mode;
- local failure boundary does not crash Results or other tabs.

### 16.5 Runtime and realDB evidence

Acceptance requires evidence from the exact candidate SHA and environment:

- create Case for a real Initiative;
- reload and open by deep link;
- build baseline, cost, benefit and scenarios;
- calculate and reproduce known outputs;
- submit, review and approve under two permitted identities for maker-checker cases;
- confirm immutable Approved snapshot via direct readback;
- publish Forecast without modifying Approved;
- complete Initiative and record/verify Actual afterward;
- classify variance, complete PIR and cold reopen;
- verify MyWork, Decision, audit and reverse Initiative links;
- prove cross-tenant isolation and forbidden actions;
- prove legacy archive is read-only.

Build, typecheck and mocked tests alone do not satisfy this gate.

## 17. Acceptance matrix

| Capability | Individual outcome | Organizational outcome | Required evidence |
|---|---|---|---|
| Create | Owner creates one Case from/selecting Initiative | No duplicate active Case | API + realDB + UI cold reopen |
| Build | Analyst completes baseline, lines and scenarios | Completeness/evidence visible | known answer + persisted inputs |
| Calculate | User obtains reproducible metrics | Policy/engine versions governed | workbook tie-out + hash replay |
| Submit | Author sends exact version | Approval pipeline visible | Decision and MyWork references |
| Approve | Reviewer sees evidence and freezes case | Maker-checker and audit enforced | two-identity runtime + snapshot readback |
| Forecast | Owner updates current expectation | Original promise retained | Approved/Forecast compare after reload |
| Actual | Benefit owner enters evidence-backed result | Verification and coverage visible | provenance + verifier + correction test |
| Continue after completion | User records benefits post-project | Delivery and value lifecycle separated | Initiative Completed + ROI active runtime |
| Variance | Owner explains material difference | Taxonomy supports portfolio learning | structured causes + action trace |
| PIR | Reviewer captures lessons and closes | Reviews due/completed governed | scheduled task + closed snapshot |
| Teresa | User receives cited proposal, accepts/rejects | AI actions auditable and bounded | evidence digest + disposition + no silent write |
| Finance seam | User opens pinned finance context | Divergence is reconciled, not hidden | version/freshness/reconciliation contract |
| Legacy | User can inspect old record | Old data cannot masquerade as vNext | archive label + GET-only contract and mutation denial |
| Visibility | Owner/reviewer sees full governed Case; approved-summary viewer sees only minimum projection | Counts/search/export/Teresa/notifications do not reveal restricted content | multi-role realDB, API, export and AI negative tests |
| KPI evidence | Benefit owner links a pinned KPI definition as evidence | Stale/disputed evidence creates state/reconciliation without overwriting Actual | API + event + runtime |

## 18. Definition of Done

The ROI system is complete for the agreed scope only when:

- every new Case has a valid Initiative and organization match;
- Initiative and ROI statuses are independent and synchronized only through explicit rules;
- baseline/BAU, assumptions, cost lines and benefit lines are persisted and governed;
- downside/base/upside scenarios derive from inputs;
- deterministic period cash flows reproduce known answers;
- ROI, payback and NPV follow pinned policy semantics;
- Approved, Forecast and Actual are visually and structurally separate;
- approval freezes a reconstructable immutable snapshot;
- forecast and reapproval never erase original approval;
- actuals retain provenance, verification and correction history;
- Initiative can be Completed while ROI continues through realization and PIR;
- MyWork and Decision references share the same Case/version truth;
- Teresa proposals are cited, bounded, auditable and require acceptance;
- individual and organizational perspectives operate on the same aggregate;
- list, preview and phased tool pass UX acceptance;
- tenant isolation, permissions, concurrency, idempotency and recovery pass;
- legacy data remains read-only and visibly non-vNext;
- exact-SHA realDB runtime evidence demonstrates the full gold flow.

Any missing item remains `EVIDENCE_MISSING`, `PARTIAL` or `BLOCKED`; it must not be reported as complete.

## 19. Risks and mitigations

| Risk | Consequence | Mitigation |
|---|---|---|
| Results/Finance dual truth drifts | contradictory decision numbers | typed version-pinned seam, freshness, reconciliation, explicit ownership |
| Revenue/time savings overstated | false ROI | policy semantics, contribution rule, conversion path, Teresa warning, review |
| Double counting | inflated benefits | groups, preflight finding, accountable resolution |
| Approval revisionism | original promise lost | immutable original snapshot and version compare |
| Initiative completion closes value work | unmeasured benefit | independent lifecycle and explicit completion event rule |
| Missing coerced to zero | misleading portfolio | typed missing states and aggregation rules |
| Weak actual provenance | unverifiable realized value | append-only evidence/verification ledger |
| Engine error | financially wrong approval | pure engine, known answers, intermediate-output review, version pinning |
| Parallel delivery fragments architecture | incompatible surfaces/services | WP0 freeze, disjoint ownership, contract tests and integration gates |
| Teresa hallucination or silent edit | governance breach | citations, evidence digest, proposal/accept pattern, no approval permission |
| Legacy mistaken for governed truth | false history | separate archive, labels, no migration and no shared current columns |
| Large tool overwhelms users | low adoption | four phases, progressive disclosure, lifecycle CTA and personal obligations |
| Self-approval | control failure | policy-based maker-checker and server enforcement |

## 20. Conditions for future Results–Finance consolidation

Decision D06 may be revisited only when all of the following are true:

1. both Results ROI and Finance artifact/version contracts are stable and production-proven;
2. canonical ownership of baseline, cash-flow inputs, calculated outputs and approvals is agreed field by field;
3. semantic units, currencies, periods, sign conventions and missing-value behavior are compatible;
4. Finance exposes immutable version IDs, freshness and supersession events;
5. Results exposes immutable Approved/Forecast/Actual versions and reconstruction manifests;
6. the mapping and reconciliation seam has real production usage and measured mismatch reasons;
7. migration inventory identifies duplicates, conflicts, orphans and approved artifacts without snapshots;
8. dual-read parity is demonstrated on known-answer and real cases;
9. rollback, retention, tenant isolation, permissions and maker-checker behavior are rehearsed;
10. a product decision chooses one aggregate owner or a durable orchestration pattern without hiding domain divergence.

Until then, integration means typed linkage and reconciliation, not shared mutable tables or copied headline values.

## 21. Recommended execution order

1. Accept this plan and formalize supersession/D06 boundaries.
2. Freeze domain, lifecycle, policy, permission, event and API contracts.
3. Produce independent known-answer workbooks before implementing the engine.
4. Run WP1, WP2 and WP3 in parallel behind the frozen contracts.
5. Deliver one real Initiative-bound Build Case slice.
6. Add Decision/maker-checker and immutable approval.
7. Add Forecast/Actual/Benefits Realization and prove post-completion continuity.
8. Add PIR, organizational views and Teresa learning support.
9. Activate the versioned Finance seam and reconciliation.
10. Complete legacy archive, security, accessibility and exact-SHA realDB acceptance.

The product is successful when it can answer, without rewriting history:

> What did we approve, what do we now forecast, what did we actually realize, why did it differ, and what should the organization learn before approving the next Initiative?

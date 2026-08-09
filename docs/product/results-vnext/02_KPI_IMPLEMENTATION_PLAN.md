# Consultify Results vNext — KPI Implementation Plan

**Status:** implementation-ready product and architecture plan  
**Scope:** KPI domain only  
**Date:** 2026-08-09  
**Authority:** founder-approved vNext direction plus `01_CONSULTIFY_KPI_MANAGEMENT_SYSTEM.md`  

## 1. Executive decision

KPI is an independent domain inside Results and a complete process-performance management system. It is not a dashboard lane, an Initiative child, a scorecard row, or an employee-rating engine.

The operating loop is:

`Define → assign accountability → measure with evidence → evaluate → detect deviation → explain → correct → execute → remeasure → verify effectiveness → learn`

The vNext implementation starts from a clean, additive schema and a new central KPI aggregate. Existing KPI tables and routes remain a read-only legacy archive. No legacy migration, merge, dual write, or automatic backfill is in the initial delivery.

Approved structural decisions:

1. KPI is an independent domain and source of metric truth.
2. `Results → KPI` opens on the top-level Scorecards list.
3. KPI receives a new central aggregate and stable identity.
4. A Scorecard is a live collection of KPI references; review snapshots preserve published historical views.
5. Legacy data remains available only through an explicitly labelled read-only archive.
6. Delivery is parallel by bounded packages behind one domain contract.
7. Teresa participates from the first stage as a contextual advisor, never as the source of truth.
8. The product serves both individual accountability and organization/process governance.

## 2. Critical review and contradictions

### 2.1 Current UI exposes the wrong depth

`ResultsWorkspaceV2` correctly restores a list of Scorecards, but its full-tool view is only a four-column KPI list. It does not expose definition governance, measurement provenance, deviation response, corrective execution, effectiveness verification, review snapshots, or learning.

Decision: retain the Scorecards entry surface and replace the shallow full-tool content incrementally with the vNext Scorecard and KPI tools.

### 2.2 Existing KPI identity is split

The repository contains overlapping models including `initiative_kpis`, `v8_kpi_definitions`, `kpi_definitions`, scorecard membership, time-series and two deviation representations. Their semantics and identifiers are not a safe foundation for a new write model.

Decision: create a new namespace and schema-owned vNext aggregate. Do not infer equivalence or reuse legacy IDs as canonical IDs in the initial release.

### 2.3 Lifecycle and performance status are conflated

Current UI reduces KPI state to variants such as `on-target`, `below`, `no-data`, while list rows also use lifecycle labels such as `active`, `draft`, and `closed`. The new specification additionally requires warning/critical, provisional and disputed data.

Decision: lifecycle, performance, data quality and workflow attention are separate dimensions. No single `status` field may stand in for all four.

### 2.4 Current creation flow is not a KPI contract

The existing modal captures a name, unit, baseline, target, cadence and simplified direction. It omits KPI type, process purpose, formal formula, aggregation, review cadence, source definition, target geometry, version approval, response policy and quality review.

Decision: replace it with Quick Create plus Guided Create. Quick Create still has to create a valid Draft; activation requires contract completeness.

### 2.5 Deviation workflow closes too early

Existing deviation actions support acknowledgement, RCA, actions, resolve and close, but repository evidence does not prove that closure requires a post-action measurement and an effectiveness window.

Decision: `actions completed`, `recovery observed`, `effectiveness verified` and `case closed` are distinct transitions.

### 2.6 Scorecard semantics are ambiguous

Historical implementations mix scorecards, Goals and KPI catalogs. The vNext rule is explicit:

- KPI owns measurement truth.
- Scorecard owns selection, ordering, audience and review rhythm.
- Scorecard Review Snapshot owns the immutable published view for a review event.
- Goals and OKR are not KPI Scorecards.

### 2.7 Individual and organizational perspectives are both mandatory

A pure organization portfolio neglects the owner's obligations. A pure `My KPIs` view neglects process coverage and governance.

Decision: the same KPI aggregate powers both perspectives; view membership never creates copies.

## 3. Domain boundaries and target model

### 3.1 Aggregate roots

#### KPI

```yaml
KPI:
  id: uuid
  organization_id: uuid
  name: string
  description: text
  purpose: text
  type: accountability | informational | observation
  primary_process_id: uuid | null
  process_scope: string | null
  owner_user_id: uuid
  manager_user_id: uuid | null
  data_owner_user_id: uuid | null
  lifecycle_status: draft | pending_approval | active | suspended | archived
  visibility_policy_id: uuid
  primary_flag: boolean
  current_definition_version_id: uuid
  created_by: uuid
  created_at: datetime
  updated_at: datetime
```

#### KPI Definition Version

```yaml
KPIDefinitionVersion:
  id: uuid
  kpi_id: uuid
  version: integer
  effective_from: datetime
  effective_to: datetime | null
  formula_text: text
  formula_expression: text | null
  aggregation_method: sum | avg | weighted_avg | min | max | last | custom
  unit_code: string
  direction: higher_better | lower_better | range | exact | binary | custom
  baseline_value: decimal | null
  target_value: decimal | null
  target_low: decimal | null
  target_high: decimal | null
  warning_low: decimal | null
  warning_high: decimal | null
  critical_low: decimal | null
  critical_high: decimal | null
  tolerance: decimal | null
  binary_success_value: boolean | string | null
  custom_status_expression: text | null
  measurement_frequency: daily | weekly | monthly | quarterly | annual | custom
  measurement_frequency_config: json | null
  review_frequency: weekly | monthly | quarterly | annual | custom
  review_frequency_config: json | null
  data_source_definition: json
  response_policy_id: uuid | null
  reason_for_change: text
  approval_status: draft | submitted | approved | rejected
  approved_by: uuid | null
  approved_at: datetime | null
  created_by: uuid
  created_at: datetime
```

#### KPI Measurement

```yaml
KPIMeasurement:
  id: uuid
  kpi_id: uuid
  definition_version_id: uuid
  period_start: datetime
  period_end: datetime
  actual_numeric: decimal | null
  actual_text: string | null
  actual_boolean: boolean | null
  source_type: manual | import | connector | mcp | calculated
  source_reference: string | null
  evidence_refs: json
  confidence: high | medium | low | null
  data_quality_status: verified | provisional | missing | disputed
  performance_status: neutral | safe | warning | critical
  status_reason: json
  correction_of_measurement_id: uuid | null
  entered_by: uuid | service
  entered_at: datetime
```

Measurements are append-only. A correction adds a new record linked through `correction_of_measurement_id`; it does not silently overwrite history.

#### Deviation Case

```yaml
DeviationCase:
  id: uuid
  organization_id: uuid
  kpi_id: uuid
  measurement_id: uuid
  severity: warning | critical
  status: open | analysis_required | plan_required | plan_submitted | approved | executing | recovery_observed | verification | closed | escalated
  owner_user_id: uuid
  manager_user_id: uuid | null
  detected_at: datetime
  response_due_at: datetime
  root_cause_summary: text | null
  root_cause_category: string | null
  recurrence_flag: boolean
  expected_recovery_date: date | null
  expected_recovery_value: decimal | null
  closed_at: datetime | null
```

#### Corrective Action and verification

```yaml
CorrectiveAction:
  id: uuid
  deviation_case_id: uuid
  title: string
  description: text
  owner_user_id: uuid
  due_date: datetime
  status: planned | active | blocked | completed | cancelled
  expected_effect: text
  actual_effect: text | null

EffectivenessVerification:
  id: uuid
  deviation_case_id: uuid
  verification_window_start: datetime
  verification_window_end: datetime
  measurement_ids: uuid[]
  status: pending | effective | partially_effective | ineffective
  rationale: text
  verified_by: uuid
  verified_at: datetime
```

#### Scorecard and published review

```yaml
Scorecard:
  id: uuid
  organization_id: uuid
  name: string
  description: text | null
  scope_type: organization | business_unit | team | process | individual | custom
  scope_id: uuid | null
  owner_user_id: uuid
  review_frequency: weekly | monthly | quarterly | annual | custom
  lifecycle_status: draft | active | suspended | archived
  visibility_policy_id: uuid

ScorecardItem:
  id: uuid
  scorecard_id: uuid
  kpi_id: uuid
  role: primary | supporting
  sort_order: integer
  display_config: json | null

ScorecardReviewSnapshot:
  id: uuid
  scorecard_id: uuid
  review_period_start: datetime
  review_period_end: datetime
  snapshot_payload: json
  source_measurement_ids: uuid[]
  status: draft | published | superseded
  published_by: uuid | null
  published_at: datetime | null
  content_hash: string
```

#### Initiative impact link

`InitiativeKPIImpact` is a reference relationship, not KPI ownership. It freezes the baseline at commitment and keeps expected contribution separate from reviewed attribution.

### 3.2 Supporting entities

- `KPIResponsePolicy`
- `KPIVisibilityPolicy`
- `KPIProcessLink`
- `InitiativeKPIImpact`
- `KPICommentThreadReference`
- `KPIEvidenceReference`
- `KPIEventLog`
- `KPIOutboxEvent`

### 3.3 Invariants

1. One KPI ID represents one metric contract across all contexts.
2. Accountability KPI requires owner, approved target geometry, source and cadence before activation.
3. Observation KPI may activate without a target.
4. A closed period always resolves through the definition version effective for that period.
5. Approved definition versions are immutable.
6. Missing is never inferred as zero.
7. Scorecard membership cannot mutate KPI truth.
8. A critical measurement creates at most one active case for the configured case key.
9. Corrective action completion cannot close a case without effectiveness verification when policy requires it.
10. Expected initiative contribution is not causal attribution.
11. The author or submitter of a material definition/target version cannot approve that same version.
12. Escalation is an attention overlay and never replaces the underlying Deviation Case lifecycle state.

## 4. Lifecycle and status taxonomy

### 4.1 KPI lifecycle

`draft → pending_approval → active ↔ suspended → archived`

- Draft: editable and not used as governed performance truth.
- Pending approval: contract frozen for reviewer decision.
- Active: accepts governed measurements and triggers policies.
- Suspended: history remains visible; scheduled obligations pause with reason.
- Archived: terminal for normal use; restoration is governed.

### 4.2 Definition lifecycle

`draft → submitted → approved | rejected`

A material edit to an active KPI creates a new Draft definition version. It never edits the active version.

### 4.3 Performance status

- `neutral`: no target or no applicable performance comparison.
- `safe`: inside acceptable zone.
- `warning`: warning boundary crossed.
- `critical`: critical boundary crossed.

### 4.4 Data-quality status

- `verified`
- `provisional`
- `missing`
- `disputed`

Performance and data quality render independently. A provisional value can be numerically critical but must show both facts.

### 4.5 Obligation/attention status

- no action,
- update due,
- explanation due,
- plan due,
- manager review due,
- action overdue,
- verification due,
- escalated.

### 4.6 Deviation lifecycle

`open → analysis_required → plan_required → plan_submitted → approved → executing → recovery_observed → verification → closed`

`escalated` is an attention overlay entered by policy. Reopening creates history and preserves the previous closure.

## 5. Permissions and visibility

### 5.1 Roles

- Organization Admin
- KPI Governance Owner
- Process Owner
- Scorecard Owner
- KPI Owner
- Data Owner
- Manager/Reviewer
- Corrective Action Owner
- Viewer

### 5.2 Permission verbs

- `kpi.view`
- `kpi.create_draft`
- `kpi.edit_draft`
- `kpi.submit_definition`
- `kpi.approve_definition`
- `kpi.activate`
- `kpi.enter_measurement`
- `kpi.verify_measurement`
- `kpi.dispute_measurement`
- `kpi.propose_target_change`
- `kpi.approve_target_change`
- `kpi.respond_deviation`
- `kpi.approve_corrective_plan`
- `kpi.verify_effectiveness`
- `kpi.close_deviation`
- `kpi.archive`
- `scorecard.manage`
- `scorecard.publish_review`

### 5.3 Visibility policy

Supported policies:

- organization,
- business unit,
- team,
- management chain,
- owner plus named collaborators,
- restricted ACL.

Default vNext policy is `SCOPE_AND_MANAGEMENT_CHAIN`. Organization-wide visibility requires an explicit governed policy. A per-record policy may narrow access; a Scorecard can never broaden it.

Rules:

1. Permission to view does not imply permission to edit.
2. Scorecard visibility cannot broaden a more restrictive KPI policy.
3. Aggregate counts must not leak restricted KPI existence.
4. MyWork items inherit source-object visibility and expose only the minimum task context.
5. Every query and command is organization-scoped on the server.

## 6. Information architecture: list → preview → tool

### 6.1 Menu 2

Within Results:

- KPI
- ROI
- OKR

KPI-specific actions on the right:

- table/grid view,
- table settings,
- primary action `New KPI Scorecard` on the registry. `New KPI` belongs inside an opened Scorecard/KPI workspace or a dedicated Portfolio route, never competes with the registry CTA.

### 6.2 KPI Menu 3

Normal Scorecards context contains only filter presets with counts, for example:

- All,
- My scorecards,
- Draft,
- Active,
- Review due,
- At risk,
- No data,
- Closed.

The right side may expose the standard contextual Teresa action. Selection replaces filters with safe bulk actions; already opened objects may appear as dynamic tabs according to TRIADA.

`Portfolio`, `My KPIs`, `Attention`, `Deviation Queue` and `Legacy Archive` use distinct schemas and behaviors. They are therefore explicit KPI workspace routes/views, not Menu 3 filters pretending to be the same table.

Selected-row context replaces filters with standard bulk actions. Destructive bulk edits to KPI definitions or targets are not allowed.

### 6.3 Top-level Scorecards list

Default columns:

- Scorecard,
- Scope,
- Owner,
- Review cadence,
- KPI count,
- Safe / Warning / Critical,
- Missing data,
- Next review,
- Lifecycle.

Preview includes purpose, scope, owner, status distribution, next review and recent published snapshots. Full open enters Scorecard Tool.

### 6.4 Portfolio list

Default columns:

- KPI,
- Process,
- Type,
- Owner,
- Target/range,
- Actual,
- Performance,
- Data quality,
- Trend,
- Freshness,
- Next obligation,
- Open deviation.

Optional columns include formula, unit, cadence, data owner, source, definition version and linked scorecards.

### 6.5 My KPIs

Individual view prioritizes:

- update due,
- actual/target/trend,
- explanation/plan obligations,
- owned actions,
- manager decisions waiting,
- upcoming review.

### 6.6 Organization and manager views

- process coverage,
- owner load,
- missing ownership,
- warning/critical distribution,
- overdue obligations,
- repeated deviations,
- ineffective corrective actions,
- review cadence compliance.

### 6.7 Scorecard Tool

Sections:

1. Current review
2. KPI list
3. Attention and deviations
4. Review notes and decisions
5. Published snapshots
6. Membership and display settings
7. History

### 6.8 KPI Tool

Header:

- name, process, owner, type,
- actual, target/range, period,
- performance and data-quality status,
- trend and freshness,
- next obligation.

Sections:

1. Performance
2. Contract
3. Record / Measurements
4. Deviations
5. Corrective Actions
6. Initiatives affecting KPI
7. Scorecards and contexts
8. History / Lineage

Preview is concise and actionable; it does not become a compressed full tool.

### 6.9 Empty, error and degraded states

- Table headers remain visible with zero rows and errors.
- Empty distinguishes `no data`, `no filter results`, `no access`, and `not configured`.
- Partial source failure remains explicit per surface.
- Legacy results are labelled `Read-only legacy archive`; they cannot be mistaken for vNext truth.

## 7. API contract

All vNext endpoints live under `/api/vnext/results/kpi`. Commands require idempotency key and expected aggregate version. Legacy V8 routes remain compatibility/read-only surfaces and are not aliases for new commands.

### 7.1 KPI commands

- `POST /kpis`
- `PUT /kpis/:kpiId/draft`
- `POST /kpis/:kpiId/submit`
- `POST /kpis/:kpiId/definition-versions/:versionId/approve`
- `POST /kpis/:kpiId/definition-versions/:versionId/reject`
- `POST /kpis/:kpiId/activate`
- `POST /kpis/:kpiId/suspend`
- `POST /kpis/:kpiId/archive`
- `POST /kpis/:kpiId/measurements`
- `POST /kpis/:kpiId/measurements/:measurementId/corrections`
- `POST /kpis/:kpiId/measurements/:measurementId/verify`
- `POST /kpis/:kpiId/measurements/:measurementId/dispute`

### 7.2 KPI queries

- `GET /kpis`
- `GET /kpis/:kpiId`
- `GET /kpis/:kpiId/measurements`
- `GET /kpis/:kpiId/history`
- `GET /kpis/:kpiId/contexts`
- `GET /portfolio/summary`
- `GET /my-kpis`
- `GET /attention`

### 7.3 Deviation commands and queries

- `GET /deviation-cases`
- `GET /deviation-cases/:caseId`
- `POST /deviation-cases/:caseId/acknowledge`
- `PUT /deviation-cases/:caseId/root-cause`
- `POST /deviation-cases/:caseId/plans`
- `POST /deviation-cases/:caseId/plans/:planId/submit`
- `POST /deviation-cases/:caseId/plans/:planId/approve`
- `POST /deviation-cases/:caseId/actions`
- `PATCH /deviation-cases/:caseId/actions/:actionId`
- `POST /deviation-cases/:caseId/recovery-observations`
- `POST /deviation-cases/:caseId/verifications`
- `POST /deviation-cases/:caseId/close`
- `POST /deviation-cases/:caseId/reopen`

### 7.4 Scorecard commands and queries

- `GET /scorecards`
- `POST /scorecards`
- `GET /scorecards/:scorecardId`
- `PATCH /scorecards/:scorecardId`
- `POST /scorecards/:scorecardId/items`
- `PATCH /scorecards/:scorecardId/items/reorder`
- `DELETE /scorecards/:scorecardId/items/:itemId`
- `POST /scorecards/:scorecardId/review-snapshots`
- `POST /scorecards/:scorecardId/review-snapshots/:snapshotId/publish`
- `GET /scorecards/:scorecardId/review-snapshots`

### 7.5 Legacy archive

- `GET /legacy/kpis`
- `GET /legacy/kpis/:legacyId`
- `GET /legacy/scorecards`

No POST, PUT, PATCH or DELETE routes exist for the archive.

## 8. Domain events

Every state-changing transaction appends an audit event and an outbox event with `event_id`, `organization_id`, aggregate type/id/version, actor, timestamp, correlation and causation IDs.

Required events:

- `kpi.created`
- `kpi.definition_submitted`
- `kpi.definition_approved`
- `kpi.activated`
- `kpi.measurement_due`
- `kpi.measurement_recorded`
- `kpi.measurement_corrected`
- `kpi.measurement_verified`
- `kpi.measurement_disputed`
- `kpi.performance_evaluated`
- `kpi.data_missing`
- `kpi.deviation_opened`
- `kpi.deviation_acknowledged`
- `kpi.corrective_plan_submitted`
- `kpi.corrective_plan_approved`
- `kpi.corrective_action_updated`
- `kpi.recovery_observed`
- `kpi.effectiveness_verified`
- `kpi.deviation_closed`
- `kpi.definition_change_proposed`
- `kpi.definition_version_changed`
- `scorecard.created`
- `scorecard.membership_changed`
- `scorecard.review_published`

Consumers must be idempotent.

## 9. Additive clean-start schema and migrations

### 9.1 Naming

Use a clearly isolated prefix or schema, for example `results_vnext.kpi_*` where supported, otherwise `rvn_kpi_*`. Do not reuse ambiguous existing table names.

### 9.2 Migration sequence

1. `rvn_001_kpi_identity_and_governance`
   - KPI, visibility policy, process links, response policy.
2. `rvn_002_kpi_definition_versions`
   - versions, geometry constraints, cadence, sources.
3. `rvn_003_kpi_measurements_and_status`
   - append-only measurements, corrections, indexes and uniqueness.
4. `rvn_004_kpi_deviation_loop`
   - cases, plans, actions, verification.
5. `rvn_005_kpi_scorecards`
   - scorecards, items, review snapshots.
6. `rvn_006_kpi_integrations`
   - initiative impacts, evidence refs, event log and outbox.
7. `rvn_007_kpi_read_models`
   - portfolio, attention and individual projections.
8. `rvn_008_legacy_archive_views`
   - read-only views/adapters with explicit origin metadata.

### 9.3 Database rules

- UUID primary keys.
- Organization ID on every tenant-owned table.
- Server-side tenant checks and composite/validated FK posture where appropriate.
- Check constraints for enumerations and geometry completeness.
- Unique active definition version per KPI and effective interval overlap protection.
- Unique measurement case key according to policy.
- Append-only audit protection.
- Optimistic concurrency through aggregate version.
- Transactional outbox in the same transaction as the aggregate write.
- No runtime DDL.
- No destructive legacy statements.
- No automatic legacy backfill.

### 9.4 Legacy posture

Legacy records retain:

- original IDs,
- original fields,
- organization scope,
- source table/route,
- last known timestamp,
- explicit `legacy_read_only` label.

The vNext tool may link to an archive record only as contextual evidence. Such a link does not establish identity equivalence.

## 10. Teresa, MyWork and Decisions

### 10.1 Teresa from stage one

Teresa is embedded contextually in:

- Scorecards list: explain attention distribution and review readiness.
- KPI creation: question purpose, actionability, owner load, target evidence and duplicate risk.
- KPI Tool: explain formula, trend and status reason.
- Deviation Case: summarize facts, retrieve similar cases and propose root-cause questions.
- Corrective plan: test whether actions address the stated cause.
- Verification: compare expected recovery with observed measurements.
- Organization view: identify coverage, overload and repeated management failures.

Teresa may draft and recommend. It may not:

- create or activate a governed KPI without confirmation,
- invent values, evidence or root causes,
- silently change definitions, targets or status,
- approve plans,
- verify effectiveness,
- close cases.

Every Teresa output distinguishes facts, inference, missing evidence and recommendation.

### 10.2 MyWork references

Generated obligation types:

- enter KPI value,
- verify imported value,
- resolve missing data,
- explain warning/critical deviation,
- prepare/submit corrective plan,
- review corrective plan,
- execute corrective action,
- resolve blocker,
- verify effectiveness,
- perform periodic KPI review,
- reassess Observation baseline,
- approve definition/target change,
- resolve disputed measurement.

Contract:

```yaml
MyWorkReference:
  organization_id: uuid
  assignee_user_id: uuid
  reference_type: kpi | kpi_measurement | deviation_case | corrective_action | scorecard_review
  reference_id: uuid
  aggregate_version_at_creation: integer
  obligation_type: string
  due_at: datetime
  status: open | completed | cancelled | superseded
  policy_version_id: uuid
  source_event_id: uuid
  cadence_occurrence_id: string | null
  deduplication_key: string
```

Submitting from MyWork invokes the same domain command and updates the same object.

At most one active obligation of a given type may exist for `organization + reference + cadence occurrence + policy version`. Event retry or replay must resolve through `deduplication_key` and cannot create a duplicate.

### 10.3 Decisions

Create or link a Decision when:

- target/definition change requires formal approval,
- corrective plan requires manager/resource decision,
- recurring deviation should become an Initiative,
- scorecard review records a material management choice.

Decision resolution emits a domain-consumable event; it does not directly mutate KPI tables outside the approved command handler.

## 11. Parallel delivery model

Parallel work begins only after shared types, invariants and endpoint contracts are frozen. Packages use non-overlapping ownership.

### Workstream A — Domain and persistence

- schema/migrations,
- repositories,
- aggregate commands,
- status engine,
- outbox/audit.

### Workstream B — Scorecards and portfolio UI

- top-level list,
- Preview,
- Scorecard Tool,
- KPI Portfolio/My KPIs/Attention,
- legacy archive.

### Workstream C — KPI contract and measurement

- Guided/Quick Create,
- KPI Tool Contract/Performance,
- actual entry,
- correction/verification/dispute.

### Workstream D — Deviation and execution loop

- cases,
- RCA,
- plan/actions,
- recovery and effectiveness verification,
- MyWork/Decisions.

### Workstream E — Teresa and advisors

- contextual contracts,
- fact/inference boundaries,
- creation advisor,
- deviation coach,
- manager briefs.

### Workstream F — Independent verification

- schema and tenant audit,
- contract tests,
- realDB readback,
- runtime visual/interaction proof,
- accessibility and permission matrix.

No workstream may introduce a competing domain type or persistence path.

## 12. Vertical slices and work packages

### Slice K0 — Foundation and truthful empty product

Packages:

- `KPI-K0-DOMAIN-CONTRACT`
- `KPI-K0-ADDITIVE-SCHEMA`
- `KPI-K0-API-SHELL`
- `KPI-K0-SCORECARDS-LIST`
- `KPI-K0-LEGACY-ARCHIVE`
- `KPI-K0-TERESA-CONTEXT`

Exit: empty Scorecards and Portfolio surfaces render canonical headers/states, new schema is deployed, legacy is visibly read-only, and no writes hit legacy.

### Slice K1 — Create and activate a KPI contract

Packages:

- Guided and Quick Create,
- types and geometry,
- process/owner/source/cadence,
- quality review with Teresa,
- submit/approve/activate,
- definition history,
- MyWork approval obligation.

Exit: Accountability, Informational and Observation KPI can be created correctly; invalid contracts cannot activate.

### Slice K2 — Measure and evaluate

Packages:

- manual actual entry,
- provenance/evidence,
- higher/lower/range/exact/binary evaluation,
- missing/provisional/disputed,
- corrections,
- trend/history,
- MyWork measurement schedule.

Exit: measurement has period, source, definition version and deterministic status; missing is not zero.

### Slice K3 — Closed deviation loop

Packages:

- warning and critical policies,
- idempotent case creation,
- explanation/RCA,
- corrective plan and manager review,
- corrective actions,
- remeasurement,
- effectiveness verification,
- close/reopen,
- Teresa coaching and MyWork/Decision routing.

Exit: one critical Accountability KPI completes the full loop with durable readback.

### Slice K4 — Scorecard as operating review

Packages:

- create/edit scorecard,
- membership/order,
- individual/process/team/org scopes,
- review readiness,
- review notes/decisions,
- publish immutable snapshot,
- compare snapshots.

Exit: a manager runs a review without duplicating KPI truth and can reopen the published historical view.

### Slice K5 — Initiative and organization integration

Packages:

- InitiativeKPIImpact,
- frozen commitment baseline,
- expected contribution vs attribution,
- process coverage,
- owner load,
- manager attention,
- repeated deviation analytics.

Exit: one KPI appears consistently in Scorecard, Process, Initiative and owner context with one ID.

## 13. Test strategy and evidence

### 13.1 Unit tests

- all target geometries and boundary values,
- zero/negative targets where allowed,
- missing vs zero,
- effective definition resolution by period,
- cadence due-date calculation,
- idempotent deviation triggers,
- lifecycle transitions,
- effectiveness rules,
- visibility intersection,
- Teresa fact/inference formatting.

### 13.2 Database tests

- migrations apply on clean database,
- migrations are rerunnable where declared idempotent,
- no legacy table is altered,
- tenant isolation,
- FK/check/unique constraints,
- append-only correction behavior,
- overlapping effective versions rejected,
- outbox and aggregate write are atomic.

### 13.3 API contract tests

- role matrix per command,
- IDOR/cross-organization negative tests,
- idempotency keys,
- optimistic concurrency,
- exact error codes,
- read-after-write,
- partial failure posture,
- archive has no mutation endpoints.

### 13.4 Component tests

- Menu 2/3 and context actions,
- empty/error/loading tables retain headers,
- list/preview/tool continuity,
- individual vs organization views,
- status dimensions rendered separately,
- permissions hide or disable actions with explanation,
- Teresa actions use current context,
- no duplicate mutation from Preview and Tool.

### 13.5 End-to-end tests

Required golden flows:

1. Create Accountability KPI → approve → activate.
2. Create Observation KPI without target.
3. Record safe measurement.
4. Record critical measurement → automatic case and MyWork item.
5. Explain → plan → approve → actions → new safe measurements → effectiveness verification → close.
6. Change target through a new approved definition version; historical period remains unchanged.
7. Add one KPI to two Scorecards; update once and observe both contexts.
8. Publish and reopen Scorecard Review Snapshot.
9. Restricted KPI is absent for unauthorized user, including aggregate counts.
10. Legacy archive remains readable and cannot be mutated.

### 13.6 Required evidence per slice

- exact commit SHA,
- migration output and schema inspection,
- automated test report,
- API request/response evidence,
- realDB persisted row and cold readback,
- runtime screenshots for list, preview and tool,
- role/tenant negative proof,
- event/outbox evidence,
- MyWork same-object readback,
- declared `EVIDENCE_MISSING` for anything not proven.

### 13.7 Definition of Done

A slice is Done only when:

1. domain invariants are implemented server-side;
2. migrations and rollback/forward-repair posture are documented;
3. permissions and tenant isolation pass;
4. command produces persisted readback;
5. UI shows loading/empty/error/degraded/success;
6. audit and outbox events exist;
7. MyWork/Decision references update the same object where in scope;
8. Teresa is grounded and cannot silently mutate truth;
9. runtime and realDB evidence match the candidate SHA;
10. no legacy write or hidden fallback occurred.

Build success, unit tests, screenshots or self-attestation alone do not satisfy Done.

## 14. Risks and mitigations

| Risk | Severity | Mitigation |
|---|---:|---|
| New UI accidentally calls legacy write endpoints | P0 | network contract allowlist, tests rejecting legacy mutations, server read-only archive |
| A generic status collapses lifecycle/performance/quality | P0 | separate enums and DTO fields; boundary tests |
| Definition edits rewrite history | P0 | immutable approved versions and period-bound measurement FK |
| Deviation closes when actions are merely completed | P0 | mandatory verification transition and policy checks |
| Restricted KPI leaks in Scorecard totals | P0 | visibility-filter before aggregation; negative tests |
| Teresa invents cause or changes truth | P0 | grounded context, typed proposals, confirmation commands, audit |
| Parallel teams create competing contracts | P0 | one contract package, API/schema ownership and integration gate |
| Scorecard snapshot becomes second KPI truth | P1 | immutable presentation snapshot with source IDs/version/hash |
| Too many KPIs weaken focus | P1 | advisory owner/process load warning, not hard block |
| Missing data rendered as poor performance | P1 | independent data-quality state |
| Custom formulas create unsafe execution | P1 | restricted expression engine, version/hash, no arbitrary code |
| Manual entry lacks evidence | P1 | provenance required by policy and visible confidence |

## 15. Dependencies

Hard dependencies:

- organization/user/team identity,
- process identity or explicit null process posture,
- authorization and visibility service,
- MyWork typed reference contract,
- Decisions typed reference contract,
- notifications/event consumer,
- evidence/source reference contract,
- migration and environment promotion process,
- standard Table/Preview/Tool shell.

Soft dependencies:

- Initiative impact presentation,
- Reporting snapshots,
- Finance reconciliation,
- connector/MCP platform,
- advanced AI retrieval of historical deviations.

KPI K0–K3 must not depend on ROI or OKR completion.

## 16. Explicit non-goals

Initial vNext does not include:

- migration or automatic deduplication of legacy KPI data,
- legacy dual write,
- advanced SPC/control charts,
- automatic connector/MCP ingestion,
- KPI Grid Advisor for the whole organization,
- predictive alerts,
- causal attribution of Initiative impact,
- employee performance rating,
- compensation calculation,
- generic spreadsheet replacement,
- arbitrary code execution in custom formulas,
- automatic root-cause determination,
- automatic case closure,
- automatic monetary conversion of non-financial outcomes.

Architecture must leave room for connectors, advanced analytics and organization learning without pretending they are part of the initial proof.

## 17. Acceptance matrix

| ID | Capability | Acceptance condition | Required evidence | Slice |
|---|---|---|---|---|
| KPI-A01 | Independent SSOT | Active vNext commands, queries, projections and metrics never consume or mutate legacy tables; only explicit `/legacy/*` queries may read them | SQL trace + API test | K0 |
| KPI-A02 | Truthful entry surface | Scorecards table renders headers in loading/empty/error and shows canonical states | component + runtime | K0 |
| KPI-A03 | Legacy archive | Legacy data is labelled read-only and has no mutation route | route inventory + negative test | K0 |
| KPI-A04 | Teresa foundation | Authorization-filtered personal/organizational context; facts/inference/recommendation and sources are separate; proposal carries expected version and accept/reject outcome; no silent write | contract, negative auth, audit + runtime | K0 |
| KPI-A05 | Accountability KPI | Owner, source, cadence, target geometry and approved definition required to activate | API + realDB | K1 |
| KPI-A06 | Informational KPI | Can activate without target under valid policy | API + realDB | K1 |
| KPI-A07 | Observation KPI | Can activate without target and has reassessment obligation | E2E + MyWork readback | K1 |
| KPI-A08 | Version governance | Active definition edit creates new version; closed periods retain old version | DB + API + E2E | K1 |
| KPI-A09 | Target geometry | Higher/lower/range/exact/binary boundary cases evaluate deterministically | unit matrix | K2 |
| KPI-A10 | Measurement provenance | Actual stores period, source, evidence, actor and definition version | realDB readback | K2 |
| KPI-A11 | Data quality | Missing/provisional/disputed remain separate from performance | unit + component | K2 |
| KPI-A12 | Correction | Correction preserves original measurement and reason | DB + API | K2 |
| KPI-A13 | Critical trigger | Critical measurement creates one idempotent Deviation Case | service + E2E | K3 |
| KPI-A14 | Same-object MyWork | MyWork response updates the referenced case, not a copy | E2E + DB | K3 |
| KPI-A15 | Corrective plan | Plan supports multiple owners/actions/deadlines and manager review | API + runtime | K3 |
| KPI-A16 | Effectiveness | Completed actions do not equal effective; closure requires verification per policy | transition tests + E2E | K3 |
| KPI-A17 | Scorecard membership | One KPI may appear in multiple Scorecards with one identity | DB + E2E | K4 |
| KPI-A18 | Review snapshot | Published snapshot is immutable, hashed and reopenable | DB + runtime | K4 |
| KPI-A19 | Individual perspective | Owner sees due updates, deviations and actions | role E2E | K4 |
| KPI-A20 | Organization perspective | Authorized manager sees process coverage and exception queue without restricted leaks | role/tenant E2E | K5 |
| KPI-A21 | Initiative impact | Link freezes baseline and separates expected contribution from attribution | DB + API + runtime | K5 |
| KPI-A22 | Auditability | Every material event contains actor, time, before/after or referenced version | audit query | all |
| KPI-A23 | Event reliability | Aggregate write and outbox event are atomic and consumers idempotent | integration test | all |
| KPI-A24 | Accessibility | Keyboard operation, focus, semantic controls and 44px targets pass | automated + manual QA | all |
| KPI-A25 | Maker-checker | Material definition/target self-approval is denied; authorized second reviewer approves the same version | two-user API + realDB + event | K1 |
| KPI-A26 | Projection integrity | Minimal owner and manager readback exists from K1 onward; complete personal/org UX does not duplicate aggregate truth | contract + role E2E | K1–K5 |

Visible control geometry follows TRIADA. Where a visible pill is `h-9`, its semantic hit area still reaches at least 44×44 px without changing the canonical appearance.

## 18. Release gates

### Gate G0 — Architecture ready

- target model and invariants approved,
- schema/API/event contracts frozen,
- workstream ownership established,
- no unresolved P0 contradiction.

### Gate G1 — Foundation ready

- K0 acceptance complete,
- additive schema promoted,
- legacy archive proven read-only,
- no legacy write traffic.

### Gate G2 — KPI contract ready

- K1 and K2 acceptance complete,
- realDB create/approve/measure/cold-read proven,
- all geometry tests pass.

### Gate G3 — Closed loop ready

- K3 gold flow passes end-to-end,
- MyWork same-object behavior proven,
- effectiveness closure proven.

### Gate G4 — Operational product ready

- Scorecard review and both perspectives pass,
- visibility/tenant matrix passes,
- candidate-matched runtime evidence accepted.

Only G4 qualifies the KPI module as a complete initial vNext product. Earlier gates are controlled increments, not product completion.

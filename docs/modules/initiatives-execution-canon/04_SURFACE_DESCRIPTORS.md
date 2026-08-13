---
doc_id: initiatives-execution-surface-descriptors
truth_type: implementation_test_descriptors
status: canonical_supporting
owner: product-owner
business_owner: piotr
last_reviewed: 2026-08-09
depends_on:
  - ../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md
  - 03_UI_UX_AND_INTERACTION_SPEC.md
runtime_status: not_implemented
---

# Initiatives + Execution — surface descriptors

## 1. Common implementation binding

These descriptors are executable inputs, not another functional canon. Every instance
binds route, canonical ID, data owner, query/write contract, capability resolver,
idempotency/read-back and telemetry. Code presence is not acceptance.

```yaml
shell:
  menu: UI-HUB-01 / StandardModuleBar / ModuleMenu3
  registry: UI-TABLE-01 / canonical StandardTable adapter
  preview: UI-PREVIEW-01 / schema-driven StandardPreview
  actions: UI-ACTION-01 / RowActionsMenu capability schema
  workspace: UI-NMODE-01 or approved artifact shell
  states: UI-STATE-01 / shared states
  ai: UI-AI-01 / proposal envelope and review diff
keyboard: [arrows_select, space_checkbox, enter_open, shift_f10_menu, esc_local_close]
preview_blocks: [header, meta, details, ai_proposals, relations, actions]
required_states: [loading, empty_first, empty_filtered, partial, stale, unknown,
  conflict, permission, offline_degraded, write_pending, write_failed, readback_pending]
```

## 2. `INI_INITIATIVES`

```yaml
menu2: { en: Initiatives, pl: Inicjatywy, order: 1 }
pattern: register
primary_object: RegisteredInitiative
views: [table, kanban_optional]
preview: InitiativePreview
workbench: InitiativeCardNMode
cta: New proposal
default_sort: [needsMyAction:desc, updatedAt:desc]
presets: [all, status_bands, needs_my_action, needs_evidence, waiting_decision,
  approved_backlog, scheduled, historical]
columns_default: [initiative, lifecycle_status, next_gate_state, readiness,
  owner_next_actor, next_action, expected_impact_confidence, planned_window,
  health_if_applicable, updated_as_of, actions]
bulk: [assign_owner, request_input, compare_in_portfolio, archive_if_capable]
ai: [review_gaps, prepare_decision_brief]
```

Kebab: Open; request/prepare allowed next transition; manage/share/archive; destructive
only by capability. Tests: source lineage present; status/gate/readiness/save separate;
decision snapshot immutable; AI cannot approve; same ID persists after reopen.

## 3. `INI_PORTFOLIO`

```yaml
menu2: { en: Portfolio, pl: Portfel, order: 2 }
pattern: register_to_workbench
primary_object: InitiativeSetMembership
aggregate_object: PortfolioScenario
workbench: PortfolioCompareCoverageScenario
cta: New portfolio scenario
default_sort: [includeState:asc, rank:asc]
default_group: include_state
presets: [current_scenario, unassigned, included, conditional, deferred, excluded,
  mandatory, low_confidence, coverage_gaps, duplicates]
columns_default: [include_state, initiative, rank, strategic_fit, expected_value,
  cost_envelope, risk, readiness, confidence, coverage_contribution, overlap_synergy,
  rough_demand, decision_state, owner, actions]
bulk: [include_exclude_in_draft, compare, request_inputs]
ai: [analyze_coverage_overlap, propose_scenario]
```

Workbench components: compact scenario register; compare/coverage matrix; scenario
summary; assumption/constraint/value-cost-risk ranges; action rail. Tests: membership
change does not change Initiative lifecycle; score does not auto-set rank; override has
reason; Portfolio Decision versions scenario and changes only eligible Initiatives.

## 4. `INI_PLAN`

```yaml
menu2: { en: Plan, pl: Plan, order: 3 }
pattern: register_to_workbench
primary_object: PlannedInitiativeWindow
aggregate_object: PortfolioPlanScenario
workbench: PlanTimelineDependencies
cta: New plan scenario
default_sort: [proposedStart:asc, dependencyOrder:asc]
presets: [unscheduled, now, next, later, conflicted, missing_dependencies,
  needs_capacity, ready_for_schedule, published]
columns_default: [initiative, backlog_state, proposed_window, earliest_latest,
  dependency_readiness, mandatory_deadline, cost_of_delay, rough_demand,
  capacity_state, schedule_confidence, conflict, next_action, actions]
bulk: [draft_move, sequence, send_to_capacity, request_review]
ai: [validate_dependencies, propose_ranges, compare_scenario]
```

Workbench: scenario scope register, timeline/waves, dependency/constraint layer,
selected-window impact and action rail. Tests: range not fake exact date; drag changes
draft only; same scenario ID passes to Capacity; Schedule Decision alone changes status
to `SCHEDULED`; no Execution task/actual baseline shadow.

## 5. `INI_CAPACITY`

```yaml
menu2: { en: Capacity, pl: Obciążenie, order: 4 }
pattern: register_to_workbench
primary_object: CapacityConstraint
aggregate_object: EstimatedCapacityScenario
workbench: CapacityHeatmapAssumptionsSimulator
cta: New capacity scenario
default_sort: [criticality:desc, worstGap:desc]
presets: [all_constraints, critical, unknown_supply, missing_demand, skill_gaps,
  management_load, budget_envelope, unconfirmed, resolved_in_scenario]
columns_default: [period, role_team_skill, demand_range, supply_state, gap_range,
  confidence, affected_initiative_count, criticality, assumption_freshness,
  owner, proposed_response, actions]
bulk: [add_to_scenario, assign_owner, request_estimate_confirmation]
ai: [analyze_load, propose_bounded_alternatives, compare_scenario]
```

Workbench: role/team x period heatmap, range/confidence overlay, affected Initiatives,
evidence rail, bounded simulator and cross-impact. Tests: known/estimated/unknown remain
distinct; units/period align; result returns to same Plan Scenario; tentative commitment
requires resource owner; no actual assignment/timesheet/utilization shadow.

## 6. `EXE_EXECUTIONS`

```yaml
menu2: { en: Executions, pl: Realizacje, order: 1 }
pattern: register
primary_object: ExecutionCase
identity: same_initiative_id_or_immutable_link
views: [table, kanban, timeline]
preview: ExecutionCasePreview
workbench: ExecutionCaseNMode
cta: null_handoff_only
default_sort: [healthSeverity:desc, forecastVariance:desc]
presets: [active, at_risk, critical, blocked_work, missing_baseline, missing_forecast,
  closing, recently_delivered, unknown_data]
columns_default: [initiative_case, lifecycle, execution_phase, owner, delivery_profile,
  progress_confidence, baseline_finish, forecast_finish, variance, budget_forecast,
  health, blockers, pending_decisions, resource_constraint, next_action, updated, actions]
bulk: [request_update, assign_if_capable, export]
ai: [analyze_exceptions]
```

Tests: idempotent accepted handoff; all views same IDs/preview; lifecycle/phase/progress/
health/confidence distinct; missing baseline prevents healthy/on-time precision; Pause,
Stop, Close and Rebaseline require Decision Case and read-back.

## 7. `EXE_WORK`

```yaml
menu2: { en: Work, pl: Praca, order: 2 }
pattern: register
primary_object: TypedWorkItemProjection
source_objects: [TASK, DECISION]
views: [table, task_kanban_when_task_only]
preview: TypeAwareTaskDecisionPreview
workbench: NativeTaskOrDecisionWorkspace
cta: New task if execution_owned_and_capable
default_sort: [blockingOverdue:desc, dueSla:asc]
presets: [all, tasks, decisions, blocked, overdue, due_soon, missing_owner,
  missing_dod_evidence, waiting_dependency, mine, by_team]
columns_default: [type, item, initiative_work_package, status, owner_decision_maker,
  due_sla, blocked_by, priority_criticality, evidence_dod, age, next_action, actions]
bulk: [common_safe_for_mixed, native_safe_for_homogeneous]
ai: [prioritize, draft_decision_brief]
```

Tests: native IDs/lifecycles/authority; exact blocked-by/blast radius; mixed bulk cannot
mutate lifecycle; missing decision role blocks rather than auto-assigns; My Work shows
same records; every write is confirmed and partial failure remains visible.

## 8. `EXE_RESOURCES`

```yaml
menu2: { en: Resources, pl: Zasoby, order: 3 }
pattern: register_to_workbench
primary_object: AllocationOrResourceConstraint
workbench: AllocationCapacityImpact
cta: New allocation scenario if contracts_proven
default_sort: [conflictOverload:desc, gap:desc]
presets: [all, overallocated, unassigned_work, skill_gaps, unconfirmed_assignments,
  availability_unknown, cost_risk, needs_decision, by_team, by_initiative]
columns_default: [person_team_role, period, committed_availability, allocated_demand,
  remaining_demand, load_range, skills_match, affected_work, cost_forecast,
  acceptance, conflict, freshness, next_action, actions]
bulk: [build_intervention, request_confirmation, assign_resolver]
ai: [suggest_balancing, compare_before_after]
```

Workbench: allocations register, capacity calendar, day/week/month horizon, skills,
Finance projection, blast radius and governed intervention composer. Tests: existence
gate for Availability/Assignment/Acceptance/Calendar/Skill/Remaining Estimate; otherwise
literal `PARTIAL/EVIDENCE_MISSING`; Finance retains ledger actuals; assignment owner
accepts; write/read-back updates every consumer.

## 9. `EXE_CONTROL`

```yaml
menu2: { en: Control, pl: Sterowanie, order: 4 }
pattern: register_to_workbench
primary_object: ManagementSignalOrInterventionCase
workbench: InterventionNarrativeComposerVerifier
cta: Compose intervention when signal_selected
default_sort: [priorityFunction:desc]
presets: [needs_action, critical, decisions, schedule, resources, cost, risk,
  dependencies, adoption, outcome_risk, verification_overdue, resolved]
columns_default: [severity, urgency, confidence, signal_problem, affected_initiative,
  source, owner, age_sla, blast_radius, proposed_intervention, approval_state,
  verification_due, outcome, actions]
bulk: [assign, propose_deduplicate, escalate]
ai: [detect_deduplicate, investigate, forecast, draft_intervention]
```

Workbench order is mandatory: What happened -> Why/evidence/counter-evidence -> Impact
-> bounded Options/do nothing -> Decision/authority -> canonical Action/read-back ->
Verification. Tests: dedup lineage; AI cannot material action; approval and idempotency;
post-write coherence; verification due and effectiveness result; resolved signal is not
hidden without history.

## 10. `EXE_REPORTS`

```yaml
menu2: { en: Reports, pl: Raporty, order: 5 }
pattern: register_to_workbench
primary_objects: [ReportDefinition, ReportRun]
views: [definitions_table, runs_table]
preview: DefinitionOrRunPreview
workbench: ReportRunDocumentWithSourceRail
cta: Run report
default_sort: [nextRun:asc, lastRun:desc]
presets: [all, weekly, monthly, on_demand, sponsor, needs_generation, needs_review,
  partial_stale, published, failed, recent_runs]
columns_default: [report, audience, cadence, scope, period_as_of, last_run, freshness,
  completeness_confidence, approval_publication, owner, required_action, next_run, actions]
bulk: [archive_if_capable, export_runs]
ai: [draft_report_run]
```

Workbench: compact register/run selector, Report Run document, source rail and action
rail Refresh draft/Validate/Freeze/Approve/Export/Share/Create follow-up. Tests: versioned
sources; partial/stale honest; drill-through; immutable freeze; approval before publish;
distribution evidence; follow-up creates canonical Task/Decision/Intervention, not copy.

## 11. Cross-surface test/evidence descriptor

### 11.1 `INITIATIVE_CARD`

```yaml
route: /initiatives/:initiativeId
pattern: n_mode_case_workspace
primary_object: RegisteredInitiative
header: [title, lifecycle, owner, sponsor, priority, project_program, target_window,
  save_state, freshness, data_quality]
next_action_strip: [action, reason, accountable_role, due_sla, blocker_deep_link]
rails:
  lifecycle: [12_states, gates_separate, disposition_separate]
  navigation: [card_groups, applicability, completion, quality, freshness, review,
    search, unresolved_count]
main: one_selected_business_card
context: [teresa_proposal, source_evidence, external_findings, change_impact,
  open_tasks_decisions, comments, audit]
sticky_actions: [save_draft, request_input, create_task, create_decision, create_risk,
  submit_gate, return, decide_if_authorized]
```

Catalog binding must expose exactly the 26 business cards from
`11_INITIATIVE_CARD_SYSTEM.md`; utilities such as tags/reminders/watchers/linked items do
not become peer business cards. Template controls requiredness/order/applicability, not
schema existence.

Tests: one card at a time; state dimensions independent; exact field/card deep links;
local draft/save/conflict; material change uses impact preview; AI remains proposal;
Task/Decision/KPI/Finance links open canonical IDs; no dashboard wall.

### 11.2 External contribution envelope

```yaml
type: InitiativeExternalContribution
required: [initiativeId, originFunction, originObjectId, originVersion, contributionType,
  targetCardKey, severity, freshness, ownerId, evidenceRefs, affectedFields, nextAction]
contribution_types: [scenario_membership, portfolio_finding, portfolio_decision_condition,
  planned_window, dependency_constraint, schedule_condition, capacity_assessment,
  capacity_constraint, tentative_commitment]
behavior: relation_or_proposal_never_narrative_copy
```

Mappings:

- `INI_PORTFOLIO` -> Strategic Fit, Outcomes/Benefits, Options, Financial cards,
  Feasibility/Completeness, Gates/Approvals.
- `INI_PLAN` -> Timeline, Milestones, Dependencies, Resources/Capacity, Gates/Approvals.
- `INI_CAPACITY` -> Resources/Capacity, People/Team, Roles/RACI,
  Feasibility/Completeness, Gates/Approvals.

Acceptance: selecting a source row/graphic previews contribution; Open Initiative uses
`initiativeId + cardKey + findingId`; Back restores source context; accept/dismiss/waive
is audited and refreshes both projections.

### 11.3 `GATE_READINESS_APPROVAL`

```yaml
primary_object: GateEvaluation
required_fields: [transition, policyVersion, preparer, deciderAuthority, dueSla,
  findings, evidenceSnapshot, changedSincePriorDecision, waivers, conditions, capabilities]
finding_schema: [findingId, severity, objectType, objectId, cardKey, ruleId, message,
  evidenceRefs, ownerId, remediationActions, freshness, confidence]
severity: [BLOCKER, WARNING, INFO]
commands: [open_finding, request_input, create_remediation_task,
  create_remediation_decision, request_waiver, submit, return, approve, reject,
  condition, defer]
```

Tests: no percentage-only readiness; blocker fail-closed; warning needs owner/waiver;
finding focuses exact card; approval freezes evidence/policy; AI cannot decide; material
change marks approval stale and routes to impact/reapproval; atomic lifecycle read-back.

### 11.4 `MATERIAL_CHANGE_IMPACT`

```yaml
trigger_fields: [scope, selected_option, owner, target_window, budget_envelope,
  kpi_target, critical_dependency, approved_baseline]
preview_regions: [field_diff, affected_scenarios, affected_work_decisions_milestones_risks,
  resource_access_impact, finance_results_refs, execution_handoff_baseline,
  tolerance_and_approver, reversibility, follow_up_proposals]
commands: [return_to_edit, request_input, create_decision, submit_for_approval, cancel]
publish: atomic_versioned_audited_readback
```

Tests: no silent publish; old version/evidence remains; required reapproval cannot be
bypassed; failure has no partial truth; external tables/Card/Execution/My Work converge.

### 11.5 Task/Decision/My Work descriptor

```yaml
one_object_rule: same_id_and_lifecycle_in_card_my_work_execution
task_create_minimum: [why, expected_outcome, acceptance_evidence_rule, assignee_owner,
  due_or_no_date_reason, context_relations, impact_preview]
decision_create_minimum: [question, options, do_nothing_if_meaningful, authority,
  due_sla, evidence_snapshot, no_decision_consequence, affected_set]
projection_lag: saved_synchronization_pending_with_correlation_id
my_work_snooze: presentation_only
```

Tests: idempotent relation key prevents duplicate creation; completion updates evidence
readiness not Decision result; resolved Decision re-evaluates blockers; conditional
Decision materializes canonical follow-up; My Work command uses source capability and
read-back; handoff preserves Task/Decision IDs.

Every surface must produce:

| Area | Evidence |
| --- | --- |
| Shell | Menu 2 order; Menu 3 default, selection and open-document modes. |
| Registry | Default columns/sort/filter/group, Settings2, resize persistence. |
| Actions | Kebab zones, capability-disabled reason, confirmation, no dead handler. |
| Preview | Six blocks, loading/partial/error, keyboard close and focus return. |
| Workbench | Explicit entry/back, compact context register, no concurrent preview. |
| Truth | Canonical vs AI proposal vs draft scenario vs stale/conflict captures. |
| States | All relevant shared states with real source behavior. |
| Responsive | 1440x900, 1280x720, 1024 fallback, 125%, light/dark. |
| Accessibility | Full keyboard cycle, visible focus, semantics, graphic alternative. |
| Persistence | Action -> backend result -> read-back -> route reopen, same ID/version. |

Verdicts remain `ACCEPTED`, `ACCEPTED_WITH_CORRECTION`, `NEEDS_STANDARD`, `REJECTED`,
`NOT_EVIDENCED` or `OUT_OF_SCOPE`. Code, generated screenshots, green unit tests or
self-attestation alone cannot establish acceptance.

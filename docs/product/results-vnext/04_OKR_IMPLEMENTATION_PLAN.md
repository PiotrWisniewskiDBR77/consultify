# Consultify Results vNext — OKR Implementation Plan

**Document type:** implementation plan and acceptance contract  
**Status:** approved for implementation planning, subject to package gates  
**Date:** 2026-08-09  
**Scope:** new OKR Management System inside Results vNext  
**Primary product input:** `03_CONSULTIFY_OKR_MANAGEMENT_SYSTEM.md` v1.0  
**UI authority:** `docs/ui-standards/TRIADA_KANON.md` and `src/components/standard/`  
**Runtime baseline:** current `ResultsWorkspaceV2`, `StrategicLayerPanel`, `okrStrategic.ts`, `resultsStrategic.routes.ts`, and `okrService.ts`

---

## 1. Outcome

Build a standalone organizational ambition, alignment, conversation, and learning system whose operating loop is:

> Declare → Align → Commit → Check in → Discuss → Support → Adapt → Score → Reflect → Learn → Start next cycle.

The system must be useful as an OKR product in its own right. It must not become an Initiative section, KPI dashboard clone, project plan, task list, or quarterly percentage form.

The first-level Results / OKR surface is a registry of **materialized OKR Sets**. One set represents one owner and one organizational scope in one cycle:

```text
OKR Set = Cycle + scope type/scope ID + accountable owner
```

An OKR Set contains Objectives; each Objective contains two or more Key Results under the initial policy, without a technical hard maximum.

---

## 2. Binding product decisions

1. **Independent domain.** OKR has no required structural parent or inheritance from KPI, ROI, Initiative, project, or task.
2. **Materialized top-level aggregate.** `OKRSet` is a persisted aggregate, not a computed alias for `OKRCycle` and not a single Objective.
3. **Organizational and individual perspectives.** Company, business-unit, team, and individual sets use the same domain contract with authorization-aware views.
4. **No legacy migration at launch.** Existing OKR tables and UI remain a read-only archive. New writes go only to the vNext schema. No automatic conversion or reconciliation is implied.
5. **Parallel delivery.** Domain/data, API/events, MyWork/Decisions, Teresa, and list/detail UI advance as coordinated workstreams behind independent acceptance gates.
6. **Teresa from day one.** Teresa participates in drafting, quality review, check-ins, manager briefs, and reflection from the first vertical slice. She advises; she does not invent values, approve, or silently mutate records.
7. **Domain-specific visibility.** Default is `OPEN_ORGANIZATION`. A governed Program policy or per-record override may narrow it. OKR visibility is not inherited from KPI, ROI, Initiative, or project permissions. Visibility and edit authority are distinct.
8. **Alignment means “contributes to”.** Alignment is optional and does not mechanically cascade wording or progress.
9. **Progress, confidence, status, and attention are separate.** No single percentage or RAG value substitutes for the four concepts.
10. **MyWork carries obligations, not duplicate state.** Actions performed in MyWork update the same OKR aggregate.

---

## 3. Critical review of the current implementation

### 3.1 What can be reused

- authenticated Results route and module shell;
- standard list composition: `StandardModuleBar`; `StandardTable` delegating table mechanics to `FilterableTable`; `StandardPreview`; `TableWithPreviewLayout` for selection/preview/keyboard/history/mobile; shared `GridView` and row actions;
- organizational identities, teams, management hierarchy, MyWork, Decisions, notifications, and conversation infrastructure where their real contracts pass integration review;
- generic event/outbox/idempotency infrastructure if confirmed current;
- the current mathematical tests as historical examples, not as the target policy.

### 3.2 What cannot become the vNext foundation

- `ResultsWorkspaceV2` maps cycles directly into “OKR Sets”; a cycle is calendar/governance, not a person/team commitment;
- current objectives can exist without a set and without a cycle;
- `projectId=all` reflects legacy routing rather than an organizational OKR boundary;
- current `parent_id` cascade automatically affects roll-up; vNext alignment is an explicit relation and has no default score effect;
- current score supports essentially one increase geometry and fixed 0.7/0.4 status thresholds;
- current confidence `green|amber|red` conflates forecast confidence with health presentation;
- committed/aspirational is attached to KR in legacy code rather than the Objective/commitment contract;
- check-ins lack blocker, support request, previous value, cadence occurrence, and evidence context;
- capability checks are described as shadow/log-only; this is not a security control;
- request-time lazy DDL is not an acceptable vNext migration strategy;
- no Program, population rules, visibility policy, review workflow, baseline version, reflection, or material-change audit exists end to end.

### 3.3 Legacy boundary

Legacy OKR becomes `LEGACY_READ_ONLY_ARCHIVE`:

- no new legacy writes after vNext write activation;
- archive entry is visibly labelled and separated from active vNext views;
- legacy data never appears as vNext adoption, alignment, check-in, or completion metrics;
- links to legacy records remain stable where technically possible;
- an optional future migration requires a separate mapping specification, dry run, reconciliation ledger, owner approval, and rollback plan;
- deleting legacy tables is a non-goal.

---

## 4. Domain model

### 4.1 Aggregate hierarchy

```text
OKRProgram
└── OKRCycle
    └── OKRSet
        ├── Objective
        │   ├── KeyResult
        │   │   └── OKRCheckIn
        │   ├── ObjectiveAlignment
        │   ├── Comment / recognition / support request
        │   └── OKRReflection
        ├── OKRReview
        └── OKRAuditEvent
```

`OKRProgram`, `OKRCycle`, and `OKRSet` are separate aggregates with explicit lifecycle rules. Objective and KR commands are transactionally scoped through their Set.

### 4.2 OKR Program

Required fields:

```yaml
OKRProgram:
  id: uuid
  organization_id: uuid
  name: string
  status: draft | active | suspended | retired
  cycle_model: quarterly | trimester | half_year | annual | custom
  annual_direction_enabled: boolean
  objective_min_recommended: integer | null
  objective_max_recommended: integer | null
  kr_min_required: integer
  kr_max_recommended: integer | null
  checkin_frequency: weekly | biweekly | monthly | custom
  approval_required: boolean
  scoring_model: zero_to_one | percentage | categories | custom
  objective_rollup_model: equal_average | weighted_average | manual | none
  confidence_enabled: boolean
  confidence_model: high_medium_low | numeric | custom
  objective_confidence_model: lowest_kr | owner_selected | custom
  visibility_default: visibility enum
  committed_vs_aspirational_enabled: boolean
  manager_review_required: boolean
  self_review_required: boolean
  reflection_required_for_close: boolean
  recognition_enabled: boolean
  active_policy_version_id: uuid
```

Program publication is versioned and audited. Policy changes do not silently reinterpret historical cycles.

### 4.3 Cycle

```yaml
OKRCycle:
  id: uuid
  organization_id: uuid
  program_id: uuid
  name: string
  start_date: date
  end_date: date
  draft_open_at: datetime
  submission_due_at: datetime
  approval_due_at: datetime | null
  active_start_at: datetime
  midcycle_review_at: datetime | null
  final_update_due_at: datetime
  review_open_at: datetime
  reflection_due_at: datetime
  manager_review_due_at: datetime | null
  close_at: datetime
  status: planned | drafting | active | review | closed | cancelled
  policy_version_id: uuid
```

Cycle state transition schedules obligations. It never substitutes for an OKR Set.

### 4.4 Materialized OKR Set

```yaml
OKRSet:
  id: uuid
  organization_id: uuid
  program_id: uuid
  cycle_id: uuid
  scope_type: company | business_unit | team | individual
  scope_id: uuid
  owner_user_id: uuid
  reviewer_user_id: uuid | null
  title: string
  status: not_required | required | draft | submitted | changes_requested | approved | active | review | closed | cancelled
  visibility_policy_id: uuid
  current_version: integer
  approved_version: integer | null
  overall_progress: decimal | null
  overall_confidence: high | medium | low | numeric | null
  attention_state: none | watch | action_required | escalated
  last_checkin_at: datetime | null
  next_checkin_due_at: datetime | null
  created_at: datetime
  updated_at: datetime
```

Uniqueness default:

```text
(organization_id, program_id, cycle_id, scope_type, scope_id, owner_user_id)
```

Policy may permit multiple named sets for one scope only through an explicit program option; MVP keeps one set per tuple.

### 4.5 Objective

```yaml
Objective:
  id: uuid
  okr_set_id: uuid
  owner_user_id: uuid
  title: string
  description: text | null
  rationale: text | null
  ambition_type: committed | aspirational | standard
  status: draft | submitted | approved | active | at_risk | completed | cancelled | closed
  progress: decimal | null
  confidence: high | medium | low | numeric | null
  sort_order: integer
  version: integer
  approved_at: datetime | null
```

The Advisor recommends 1–3 Objectives. It warns above policy recommendations but does not impose an arbitrary technical maximum.

### 4.6 Key Result

```yaml
KeyResult:
  id: uuid
  objective_id: uuid
  owner_user_id: uuid
  title: string
  description: text | null
  measurement_type: numeric | percentage | currency | binary | milestone | custom
  unit: string | null
  currency: string | null
  baseline_value: decimal | null
  target_value: decimal | null
  start_value: decimal | null
  current_value: decimal | null
  direction: increase | decrease | reach | maintain_range | binary
  range_min: decimal | null
  range_max: decimal | null
  progress: decimal | null
  confidence: high | medium | low | numeric | null
  status: not_started | on_track | at_risk | off_track | achieved | not_achieved | cancelled
  source_type: manual | import | connector | mcp | calculated
  source_reference: string | null
  weight: decimal | null
  version: integer
```

MVP supports numeric, percentage, currency, and binary. Milestone/custom may exist in schema but must be hidden unless fully implemented. The initial Program policy requires at least two KRs before submission; draft may temporarily contain fewer.

### 4.7 Check-in

```yaml
OKRCheckIn:
  id: uuid
  organization_id: uuid
  okr_set_id: uuid
  objective_id: uuid
  key_result_id: uuid
  cadence_occurrence_id: uuid
  period_date: date
  previous_value: decimal | null
  new_value: decimal | null
  calculated_progress: decimal | null
  owner_declared_status: status | null
  system_suggested_status: status | null
  confidence: high | medium | low | numeric | null
  note: text
  blocker: text | null
  support_requested: text | null
  evidence_references: json
  submitted_by: uuid
  submitted_at: datetime
```

One check-in occurrence is idempotent per KR and cadence window. Corrections create a new revision/event; they do not overwrite history.

### 4.8 Review, reflection, and history

- `OKRReview`: reviewer, outcome, comments at Set/Objective/KR level, submitted version, decision time.
- `OKRApprovedSnapshot`: immutable reconstruction of approved Set version.
- `OKRReflection`: final score, what worked, what did not, why, learning, next-cycle change, disposition.
- `OKRMaterialChange`: before/after, reason, requester, reviewer, recommit outcome.
- `OKRAuditEvent`: append-only event envelope with actor, aggregate, policy version, reason, correlation, before/after hashes, and visibility classification.

---

## 5. Lifecycle and state machines

### 5.1 Program

```text
Draft → Active → Suspended → Active
                  └────────→ Retired
```

Only an active Program may open a new Cycle.

### 5.2 Cycle

```text
Planned → Drafting → Active → Review → Closed
    └──────────────→ Cancelled
```

Transitions are explicit commands, not UI-derived date guesses. A scheduler may propose/execute due transitions under policy with an auditable service actor.

### 5.3 OKR Set

```text
Required → Draft → Submitted → Approved → Active → Review → Closed
                      ↘ Changes requested ↗          ├→ Carry forward draft
                                                     ├→ Rewrite draft
                                                     └→ Cancelled
```

Approval freezes a baseline snapshot. Material edits to an active Set create a revision request and do not rewrite the approved snapshot.

### 5.4 Progress, confidence, status, attention

- **Progress:** backward-looking numerical attainment according to KR geometry.
- **Confidence:** owner assessment of likelihood of future success.
- **Status:** declared or policy-suggested domain state.
- **Attention:** operational need for intervention.

Examples:

- progress 45%, expected 40%, confidence low → attention required despite acceptable progress;
- progress 30%, expected 50%, confidence high → at risk, but manager may validate recovery route;
- missing check-in → stale/attention, never synthetic 0% progress.

No universal fixed 70/40 thresholds. The policy version defines status suggestions, trajectory, clamping, overachievement, and roll-up.

Progress geometries:

```text
increase: (current - baseline) / (target - baseline)
decrease: (baseline - current) / (baseline - target)
binary: 0 or 100%
percentage direct: configured direct value or baseline-to-target
maintain range: policy-defined in-range evaluation
```

Degenerate/missing inputs yield `not_calculable`, not fabricated zero.

Objective progress uses Program policy. Confidence is never blindly averaged. Every calculated value stores calculation policy/version and reason.

---

## 6. Alignment

`ObjectiveAlignment` is a first-class relation:

```yaml
ObjectiveAlignment:
  id: uuid
  source_objective_id: uuid
  target_objective_id: uuid
  relation: contributes_to
  rationale: text | null
  created_by: uuid
  status: proposed | accepted | rejected | removed
```

Rules:

- optional, authorization-aware, and cross-functional;
- no forced tree purity and no wording clone;
- no automatic progress inheritance or target synchronization;
- cycle and organization compatibility validated;
- graph cycles rejected;
- hidden/restricted Objectives do not leak through nodes, edge counts, search, analytics, or Teresa;
- unaligned is diagnostic context, not automatic failure.

MVP may show parent/contribution relations as a list/tree. Interactive organization graph is V2.

---

## 7. Governance, permissions, and visibility

### 7.1 Roles

- OKR Program Admin
- Executive Sponsor
- Organization OKR Coach
- Manager / Reviewer
- OKR Set Owner
- Objective Owner
- KR Owner
- Contributor
- Viewer
- Auditor (read-only)

RBAC is combined with organization, scope, ownership, management chain, cycle state, visibility, and temporary delegation.

### 7.2 Permission families

- program/cycle configure, publish, open, close;
- set create, edit draft, submit, review, approve, request changes, activate, cancel, close;
- Objective/KR create and edit within allowed state;
- check in and correct with history;
- comment, recognize, request support/decision;
- revise active goal and approve material revision;
- score, reflect, manager-review, carry forward;
- view metadata/content/evidence/audit;
- change visibility and restricted ACL.

### 7.3 Maker-checker

- author cannot approve their own Set when approval is required;
- Program author cannot publish high-impact visibility or compensation policy alone;
- owner submits check-ins; manager responds rather than overwriting owner evidence;
- material active changes require reason and reviewer recommit;
- system/AI actors cannot approve, publish policy, or provide human confidence.

### 7.4 Visibility

Modes:

- `OPEN_ORGANIZATION`
- `SCOPE`
- `MANAGEMENT`
- `PRIVATE`
- `RESTRICTED_ACL`

Rules:

- visibility permission and edit permission are separate;
- per-record restriction may narrow, never silently broaden, Program default;
- evidence may be more restricted than its OKR;
- unauthorized records are absent, not redacted with identifying metadata;
- all aggregations are computed after authorization filtering;
- break-glass requires explicit role, reason, expiry, alert, and event;
- exports, search index, notifications, AI context, and audit viewers enforce the same policy.

Security GO requires server-side enforcement and negative-path runtime evidence. Shadow-only capability logging is NO-GO.

---

## 8. Information architecture: list → preview → tool

### 8.1 Results / OKR list

The top-level registry uses only shared standard components.

Menu 2:

- KPI / ROI / OKR domain navigation;
- search;
- Table / Grid views initially; add other modes only when real;
- contextual `New OKR Set` CTA for authorized users.

Menu 3:

- filters with counts: All, My, Team, Company, Draft, Active, Attention, Review, Closed;
- selection switches to domain-safe bulk actions;
- Teresa contextual action on the right;
- open items become dynamic tabs according to TRIADA.

Recommended columns:

- OKR Set title / owner and scope subtitle;
- cycle;
- scope;
- status;
- Objectives count;
- progress;
- confidence;
- check-in freshness;
- attention;
- reviewer/next obligation where useful;
- kebab.

Bulk actions must not include blanket approve, visibility change, or destructive status transitions unless capability and homogenous state are proven.

### 8.2 Preview

Preview follows the six canonical zones and shows:

- title, owner/scope, cycle, status, progress, confidence, visibility;
- Objective/KR counts and latest check-in summary;
- attention reason and next obligation;
- alignment and permitted relations;
- Teresa fact-grounded suggestions;
- actions such as Open, Submit, Review, Check in, Request support, depending on state/capability.

Preview is not the full editor.

### 8.3 Full OKR tool

Workspace modes:

1. Overview
2. Objectives & Key Results
3. Check-ins
4. Alignment
5. Conversations & Support
6. Review & Reflection
7. History

Program Settings and Cycle Management have their own governed admin routes/tools and may be launched from Results settings; they are not tabs belonging to a selected Set. Team Health, Attention Queue, Company OKRs and authorized analytics are named organizational views over Set truth, not content of one Set tool. Personal perspective starts with My OKRs and the next obligation.

No dashboard, wizard, or editor is appended below the top-level registry.

---

## 9. API contract

Use organization-scoped `/api/vnext/results/okr` routes. Do not preserve `projectId=all` in the new contract. Every route below inherits this root.

### Program and cycles

```text
GET    /api/vnext/results/okr/programs
POST   /api/vnext/results/okr/programs
GET    /api/vnext/results/okr/programs/:programId
PATCH  /api/vnext/results/okr/programs/:programId/draft
POST   /api/vnext/results/okr/programs/:programId/publish

GET    /api/vnext/results/okr/cycles
POST   /api/vnext/results/okr/cycles
GET    /api/vnext/results/okr/cycles/:cycleId
POST   /api/vnext/results/okr/cycles/:cycleId/open-drafting
POST   /api/vnext/results/okr/cycles/:cycleId/activate
POST   /api/vnext/results/okr/cycles/:cycleId/open-review
POST   /api/vnext/results/okr/cycles/:cycleId/close
```

### Sets and lifecycle

```text
GET    /api/vnext/results/okr/sets?perspective=&cycle=&scope=&status=&attention=
POST   /api/vnext/results/okr/sets
GET    /api/vnext/results/okr/sets/:setId
PATCH  /api/vnext/results/okr/sets/:setId/draft
POST   /api/vnext/results/okr/sets/:setId/submit
POST   /api/vnext/results/okr/sets/:setId/request-changes
POST   /api/vnext/results/okr/sets/:setId/approve
POST   /api/vnext/results/okr/sets/:setId/activate
POST   /api/vnext/results/okr/sets/:setId/request-revision
POST   /api/vnext/results/okr/sets/:setId/cancel
POST   /api/vnext/results/okr/sets/:setId/close
POST   /api/vnext/results/okr/sets/:setId/carry-forward
```

### Objectives, KRs, check-ins, alignment, reflection

```text
POST   /api/vnext/results/okr/sets/:setId/objectives
PATCH  /api/vnext/results/okr/objectives/:objectiveId
DELETE /api/vnext/results/okr/objectives/:objectiveId
POST   /api/vnext/results/okr/objectives/:objectiveId/key-results
PATCH  /api/vnext/results/okr/key-results/:keyResultId
DELETE /api/vnext/results/okr/key-results/:keyResultId
GET    /api/vnext/results/okr/key-results/:keyResultId/check-ins
POST   /api/vnext/results/okr/key-results/:keyResultId/check-ins
POST   /api/vnext/results/okr/objectives/:objectiveId/alignments
DELETE /api/vnext/results/okr/alignments/:alignmentId
POST   /api/vnext/results/okr/sets/:setId/final-score
POST   /api/vnext/results/okr/objectives/:objectiveId/reflection
GET    /api/vnext/results/okr/sets/:setId/history
```

### Manager and Teresa read models

```text
GET    /api/vnext/results/okr/my
GET    /api/vnext/results/okr/team-health
GET    /api/vnext/results/okr/attention
GET    /api/vnext/results/okr/company
GET    /api/vnext/results/okr/analytics
POST   /api/vnext/results/okr/advisor/draft
POST   /api/vnext/results/okr/advisor/quality-review
POST   /api/vnext/results/okr/advisor/check-in
POST   /api/vnext/results/okr/advisor/manager-brief
POST   /api/vnext/results/okr/advisor/reflection
```

Commands require idempotency keys and expected aggregate version. Responses include effective permissions, policy version, aggregate version, and next allowed actions. API schemas are shared/validated; no untyped envelope guessing.

---

## 10. Schema and persistence

Create additive vNext migrations for:

- `okr_vnext_programs`
- `okr_vnext_program_policy_versions`
- `okr_vnext_population_rules`
- `okr_vnext_visibility_policies`
- `okr_vnext_cycles`
- `okr_vnext_sets`
- `okr_vnext_set_versions`
- `okr_vnext_objectives`
- `okr_vnext_key_results`
- `okr_vnext_checkin_occurrences`
- `okr_vnext_checkins`
- `okr_vnext_alignments`
- `okr_vnext_reviews`
- `okr_vnext_approved_snapshots`
- `okr_vnext_reflections`
- `okr_vnext_support_requests`
- `okr_vnext_events`
- `okr_vnext_outbox`

Constraints:

- organization ID on every security boundary table;
- foreign keys and scoped uniqueness;
- optimistic version column on mutable aggregates;
- immutable snapshots/events enforced by repository/service permissions and database constraints where practical;
- no request-time DDL;
- no foreign key to KPI, ROI, Initiative, project, or task;
- optional external references use typed reference records, not structural ownership;
- timestamps in UTC, policy/currency/units explicit;
- indexes for organization + cycle + scope + owner + status + attention and due obligations.

Legacy tables are not renamed or mutated by vNext migrations.

---

## 11. Events and read models

Minimum event envelope:

```yaml
id: uuid
organization_id: uuid
aggregate_type: program | cycle | set | objective | key_result | checkin | reflection
aggregate_id: uuid
event_type: string
actor_user_id: uuid | null
actor_type: user | service | teresa
occurred_at: datetime
command_id: uuid
correlation_id: uuid
causation_id: uuid | null
policy_version_id: uuid
aggregate_version: integer
reason: text | null
before_hash: string | null
after_hash: string
visibility_classification: string
payload: json
```

Required events include Program/Cycle changes, Set required/created/submitted/approved/activated, changes requested, Objective/KR changes, material revision, check-in, confidence/status change, blocker/support/decision request, alignment, visibility/owner change, score/reflection, carry-forward, and close.

Transactional outbox publishes events to MyWork, Decisions, notifications, analytics, and Teresa read models. Consumers are idempotent. Projection lag is observable; command readback uses aggregate truth.

---

## 12. Teresa from the first slice

Teresa capabilities:

- guided Objective drafting and outcome reframing;
- measurable KR suggestions and baseline questions;
- quality review: outcome/activity, measurability, duplication, focus, gaming risk;
- alignment suggestions from authorized OKR context;
- check-in assistance and inconsistency prompts;
- manager exception brief;
- reflection and next-cycle draft synthesis.

Safety contract:

- facts, inference, and recommendation are visibly separated;
- each factual statement cites authorized aggregate/event/evidence references;
- Teresa never invents current value, progress, confidence, blocker, causality, or owner intent;
- no autonomous submit, approval, policy change, visibility change, scoring, or carry-forward;
- suggestions are proposed patches requiring explicit user acceptance;
- restricted data is filtered before retrieval and generation;
- prompts, sources, model/version, accepted/rejected suggestion, and resulting command are auditable;
- streaming UI uses `role="log"`, `aria-live="polite"`, and canonical focus behavior.

The first vertical slice must demonstrate “activity Objective → Teresa suggestion → user accepts/rejects → draft saved”, with provenance and no silent mutation.

---

## 13. MyWork, Decisions, and communication

### MyWork

Generated obligation types:

- draft OKR Set;
- submit for review;
- review/request changes/approve;
- respond to changes;
- check in;
- explain low confidence;
- respond to support request;
- mid-cycle review;
- final score;
- reflection;
- manager review;
- prepare next cycle.

Every item has `reference_type`, `reference_id`, obligation type, cadence occurrence, policy version, source event, due date, and deterministic deduplication key. Completing it invokes a domain command; it does not create a parallel OKR copy.

### Decisions

`Request Decision` is available from a blocker/support context. The Decision contains Objective/KR context, requested decision, impact of delay, desired date, visibility, and correlation ID. Resolution is written back to the OKR timeline as an event. A Decision does not become a structural parent of the OKR.

### Communication and recognition

Notifications distinguish information, positive recognition, attention, action required, support request, and decision required. Recognition is professional and policy-governed; no points, badges, or leaderboard by default.

---

## 14. Parallel work packages

### WP0 — Product contract and architecture gate

- approve terminology, aggregate boundaries, lifecycle, policies, visibility, and acceptance matrix;
- ADRs for independent domain, materialized Set, legacy archive, alignment, events, and Teresa authority;
- threat model and permission matrix.

Exit: no disputed P0 decision or ambiguous Set identity.

### WP1 — Schema, domain engine, and policies

- additive migrations;
- aggregates, repositories, state machines;
- progress geometries and policy versioning;
- snapshots, events, outbox, idempotency, optimistic concurrency;
- legacy archive read boundary.

Exit: domain/unit/property/DB tests pass; no HTTP/UI dependency.

### WP2 — API and authorization

- typed commands/queries;
- RBAC + scope/management/visibility enforcement;
- effective capability and next-action responses;
- list/read projections;
- negative authorization and metadata-leak tests.

Exit: two-user and restricted-outsider realDB proof.

### WP3 — MyWork, Decisions, scheduler

- cycle/cadence occurrences;
- idempotent obligations;
- review, support, decision, reminder/escalation workflows;
- write-through and readback.

Exit: domain ↔ MyWork/Decision cold-reopen round trip.

### WP4 — Teresa

- authorized retrieval contract;
- drafting and quality advisor first;
- check-in and manager brief next;
- reflection assistant;
- provenance, acceptance, and audit.

Exit: no invented fact/value and no unauthorized context in adversarial evals.

WP4 is a hard dependency of the first accepted product slice: WP6 may be tested as a human-only domain capability, but cannot receive product GO until Teresa drafting/quality propose → accept/reject → authorized save passes provenance and permission checks.

### WP5 — Top-level list and preview

- T38 OKR Set registry with Menu 1/2/3;
- headers visible for loading/empty/error;
- table/grid, search/filter/counts, selection-safe bulk;
- kebab, app context menu, StandardPreview;
- individual/team/company perspectives.

Exit: TRIADA checklist 43/43 or explicit N/A, dark/light, keyboard, current-SHA screenshots.

### WP6 — Full OKR tool

- Set overview;
- Objective/KR authoring;
- check-in timeline;
- alignment;
- conversations/support;
- review/reflection/history;
- manager attention and program/cycle surfaces.

Exit: complete human lifecycle without DB/manual repair.

### WP7 — Integration and rollout

- projection observability;
- archive routing;
- feature flags default OFF;
- performance/accessibility/security/backup checks;
- staged pilot and one-screen-at-a-time visual acceptance.

Exit: approved evidence pack and explicit promotion decision.

Dependencies form a DAG, not a waterfall: WP1, WP3 design, WP4 retrieval/evals, and WP5 static contract can proceed in parallel after WP0; real integration gates remain sequential.

---

## 15. Test strategy and required evidence

### 15.1 Automated tests

- domain state transition tables;
- progress property tests for increase/decrease/direct/binary, missing and degenerate inputs;
- confidence/status/attention independence;
- objective roll-up per policy;
- alignment cycle and authorization guards;
- visibility matrix and aggregation non-leak;
- maker-checker and self-approval denial;
- immutable approved snapshot and event history;
- optimistic concurrency and idempotent retries;
- outbox replay and projection rebuild;
- scheduler occurrence and obligation deduplication;
- MyWork/Decision write-through;
- Teresa provenance, fact/inference labels, prompt injection and restricted-data leakage;
- legacy archive read-only denial;
- API schema/contract and error semantics;
- accessibility behavior and focus.

### 15.2 Runtime and realDB proof

At the exact candidate SHA:

1. configure and publish Program;
2. open Cycle;
3. create individual, team and business-unit Sets and open an authorized company view;
4. draft Objective and at least two KRs;
5. use Teresa suggestion, accept one and reject one;
6. submit as owner;
7. fail self-approval; approve as manager;
8. verify approved snapshot;
9. receive and complete MyWork check-in;
10. demonstrate progress and confidence diverging;
11. request support and create/resolve Decision;
12. perform material revision with visible history;
13. score, reflect, close, and carry forward;
14. cold reopen after restart and verify identical state;
15. verify restricted outsider cannot infer record or aggregates;
16. verify archive records remain readable but immutable;
17. record the same Set IDs and aggregate versions across personal/team/business-unit/company projections, proving they are views rather than copies;
18. rebuild projections from events and compare checksums/counts.

### 15.3 Visual evidence

- list full/empty/loading/error;
- preview;
- kebab;
- application context menu;
- Menu 3 filters, selected bulk, and open tabs;
- individual/team/business-unit/company perspectives;
- full tool modes and Teresa streaming;
- dark/light at required widths;
- keyboard and screen-reader tree;
- exact SHA, route, fixture/data provenance, timestamp, and reviewer.

Piotr is not the first visual tester. Team render and clean screenshot review precede owner acceptance. Feature flag remains default OFF until accepted.

---

## 16. Acceptance matrix

| Capability | Code/contract | Automated | Runtime | realDB/readback | Security/evidence | Acceptance |
|---|---|---|---|---|---|---|
| Program policy/version | Required | unit + DB | Admin flow | publish/reopen | maker-checker/audit | NO-GO until all |
| Cycle calendar | Required | state/scheduler | open/activate/review/close | obligations survive restart | policy version | NO-GO until all |
| Materialized OKR Set | Required | uniqueness/lifecycle | list→preview→tool | create/reopen | scope/owner visibility | NO-GO until all |
| Objective + 2 KRs | Required | validation/progress | authoring | approved snapshot | edit/approve separation | NO-GO until all |
| Check-in | Required | cadence/idempotency | tool + MyWork | same KR readback | author/evidence audit | NO-GO until all |
| Progress/confidence separation | Required | property/scenario | divergent display | persisted history | reasons/policy | NO-GO until all |
| Alignment | Required MVP basic | graph/auth | authorized view | relation reopen | no metadata leak | NO-GO until all |
| Review/approval | Required | transitions | owner/manager | snapshot reopen | self-approval denied | NO-GO until all |
| Support/Decision | Required | integration | request/resolve | timeline readback | visibility preserved | NO-GO until all |
| Reflection/carry-forward | Required | disposition | review UI | next-cycle draft | lineage/history | NO-GO until all |
| Teresa drafting/quality | Required from slice 1 | evals | accept/reject | accepted patch only | provenance/no leakage | NO-GO until all |
| Manager attention | Required | trigger tests | queue/brief | check-in-driven | authorized facts | NO-GO until all |
| Legacy archive | Required boundary | write denial | archive label | unchanged checksum | separate analytics | NO-GO until all |
| TRIADA list surface | Required | component tests | visual/a11y | real rows | current-SHA pack | NO-GO until all |

`READY_FOR_CODEX_REVIEW`, green unit tests, generated screenshots, build success, or implementation volume are candidate evidence only. They are never alone sufficient for GO.

---

## 17. Definition of Done

OKR vNext is done only when:

- the approved product decisions and ADRs exist;
- schema is additive, migrated, constrained, and observable;
- all write paths use vNext and legacy is read-only;
- Program, Cycle, Set, Objective, KR, check-in, review, reflection, and audit work end to end;
- individual, manager/team, and company perspectives are authorization-correct;
- MyWork and Decisions update the same domain objects;
- Teresa is grounded, permission-filtered, auditable, and non-authoritative;
- all critical automated suites pass at the candidate SHA;
- full realDB lifecycle and cold reopen pass;
- negative visibility, maker-checker, concurrency, retry, and metadata-leak tests pass;
- projection rebuild reconciles with aggregate truth;
- TRIADA visual checklist passes with clean dark/light evidence;
- no unresolved P0 security, data-integrity, lifecycle, or accessibility defect remains;
- rollback/flag-off and operational runbook are rehearsed;
- owner accepts the visual surface and product flow before default enablement.

---

## 18. Risks and mitigations

| Risk | Consequence | Mitigation |
|---|---|---|
| Treating Cycle as Set | broken ownership and manager views | persisted Set and uniqueness contract |
| Reusing legacy cascade | forced hierarchy and misleading roll-up | separate alignment relation, no score inheritance |
| Big-bang implementation | wide but shallow administration UI | gold vertical slice plus gated parallel work |
| Shadow authorization | unauthorized writes/visibility | enforce server-side before security GO |
| Aggregate data leakage | sensitive strategy disclosure | authorization before projection/aggregation/AI |
| Check-in fatigue | quarterly bureaucracy in weekly form | short MyWork flow, automatic prefill, exception focus |
| Red goal punishment | sandbagging and hidden risk | separate OKR from performance rating; confidence culture |
| AI invention | false management narrative | source references, proposed patches, no autonomous writes |
| Policy drift | history reinterpreted | versioned policy stored with snapshots/events |
| Duplicate obligations | noisy MyWork and conflicting state | cadence occurrence + deterministic idempotency key |
| Silent goal rewriting | lost accountability | approved snapshot + material revision workflow |
| Legacy contamination | false adoption/history | separate archive namespace and metrics |
| Cross-domain coupling | OKR becomes KPI/PMO child | no structural foreign keys; typed optional context only |

---

## 19. Non-goals

- migrating or deleting legacy OKR data in this delivery;
- required Objective/KR links to Initiative, KPI, ROI, task, or project;
- automatic KR progress from task completion;
- automatic KPI-to-KR synchronization in MVP;
- compensation or hidden employee performance score;
- rigid mandatory cascade;
- organization-wide leaderboard, badges, or points;
- predictive risk model;
- advanced MCP/connector ingestion;
- sophisticated alignment graph in MVP;
- autonomous Teresa approval, scoring, visibility, policy, or data changes;
- dashboards embedded inside the top-level OKR registry;
- bespoke Results tables, previews, menus, or UI tokens.

---

## 20. Open evidence and founder decisions

The following remain `EVIDENCE_NEEDED` before WP0 closes:

1. Canonical organization/team/manager hierarchy API and its realDB completeness.
2. Implementation evidence for restricted-goal metadata behavior and completeness of the organization/team/manager hierarchy. The product default `OPEN_ORGANIZATION` is already decided; this item does not reopen it.
3. Whether reflection is required to close or strongly recommended with explicit waiver.
4. Whether two KRs is a hard submission rule for every Program or only the initial default policy.
5. Whether numeric confidence is allowed in MVP or only High/Medium/Low.
6. Whether company-level Set owner is a person sponsor or a role/service account; recommendation: accountable human sponsor.
7. Whether multiple Sets per owner/scope/cycle are ever allowed; recommendation: no in MVP.
8. Which current MyWork, Decisions, events/outbox, and visibility components are safe to reuse after runtime and realDB audit.
9. Exact archive entry point and retention policy.
10. Pilot population and first Cycle dates.

No unresolved answer may be silently inferred when it changes security, accountability, scoring culture, or data lineage.

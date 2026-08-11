---
doc_id: initiatives-execution-process-governance-gates
truth_type: target_product_contract
status: draft_for_owner_review
owner: product-owner
business_owner: piotr
version: 1.0
last_reviewed: 2026-08-09
runtime_status: not_implemented
parent_canon: ../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md
---

# Initiatives + Execution — process, governance and gates

## 1. Authority and scope

This document makes the process and approval portions of the [function canon](../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md) implementable. It defines the end-to-end state machine, role accountability, governance profiles, gate outcomes, service levels, returns, exceptions and cross-module read-backs.

It does not authorize migration, deployment or automatic AI writes. Current runtime enums remain AS-IS until an approved migration maps them to this business model. The older detailed sources remain supporting rationale: [lifecycle](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/INITIATIVE_END_TO_END_LIFECYCLE.md), [approval profiles](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/INITIATIVE_APPROVAL_GOVERNANCE_PROFILES.md), [Initiatives review](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/09_INITIATIVES_REVIEW.md), [Execution review](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/08_EXECUTION_REVIEW.md) and [Teresa system](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/TERESA_INITIATIVE_TO_EXECUTION_AI_SYSTEM.md).

## 2. Non-negotiable process invariants

1. One `lineageId` connects source proposal, registered Initiative, Execution Case and benefit supervision.
2. `initiativeId` is created exactly once at `REGISTER`; merge and extend never create a competing Initiative.
3. The Initiative card owns lifecycle and gates for one Initiative. Menu 2 functions only project or operate on canonical records.
4. `lifecycle_status`, `gate_state`, `gate_readiness`, `disposition`, `execution_state`, `execution_health`, `effectiveness_result` and `save_state` are independent.
5. A gate decision uses an immutable source/evidence snapshot. Later edits do not rewrite its historical basis.
6. `APPROVED_BACKLOG` is permission to retain and prioritize an Initiative, not permission to start.
7. `SCHEDULED` requires a capacity commitment, approved window, roles, tolerances and an Execution handoff package.
8. `DELIVERED` means accepted scope; it never means benefit achieved.
9. Every cross-module write is idempotent and returns `accepted`, `accepted_with_explicit_gaps` or `rejected_with_blockers`. No response is failure/pending, not success.
10. Finance owns financial actuals and investment models; Results owns KPI and benefit actuals; Tasks, Decisions, Assignments and Reports each retain one canonical identity.
11. Unknown, partial, stale and conflicting data do not default to zero, green or ready.
12. Teresa may observe, challenge, recommend and draft. Material approval and irreversible action always remain human.

## 3. Independent state dimensions

| Dimension | Allowed values | Owner | Rule |
| --- | --- | --- | --- |
| `lifecycle_status` | the 12 statuses in section 7 | Initiatives, with domain read-back | Only a successful gate/handoff changes it. |
| `gate_state` | `NOT_REQUESTED`, `PREPARING`, `PENDING_DECISION`, `APPROVED`, `RETURNED`, `SUPERSEDED` | canonical Decision/Gate runtime | A returned gate does not silently rewind lifecycle. |
| `gate_readiness` | `NOT_EVALUATED`, `NOT_READY`, `CONDITIONALLY_READY`, `READY`, `BLOCKED` | readiness service plus named reviewers | A score cannot hide a blocker. |
| `disposition` | `ACTIVE`, `DEFERRED`, `REJECTED`, `MERGED`, `STOPPED`, `CANCELLED` | authorized Decision | Non-active dispositions require section 10 evidence. |
| `execution_state` | `NOT_STARTED`, `HANDOFF_PENDING`, `ACTIVE`, `PAUSED`, `CLOSING`, `ENDED` | Execution | `BLOCKED` is a signal/reason, not the main lifecycle. |
| `execution_health` | `NOT_APPLICABLE`, `UNKNOWN`, `ON_TRACK`, `AT_RISK`, `CRITICAL` | Execution forecast | Must include reasons, as-of and source coverage. |
| `effectiveness_result` | `NOT_MEASURED`, `CONFIRMED`, `PARTIAL`, `NOT_ACHIEVED` | Results/Benefit Owner | Set only through Effectiveness Review. |
| `save_state` | `SAVED`, `SAVING`, `SAVE_FAILED`, `CONFLICT` | persistence layer | UI success requires backend read-back. |

## 4. Roles and decision rights

| Role | Accountable for | May decide | Must not decide alone |
| --- | --- | --- | --- |
| Proposal Owner | source draft quality and clarification | submit/withdraw own draft | registration, portfolio approval |
| Source Validator / Project Leader | duplicate check, registration quality, project and visibility | register, merge, extend, return, defer, dismiss | strategic Go/No-Go outside delegated authority |
| Initiative Owner | complete management case and gate preparation | submit gates; approve non-material working drafts | own strategic Go/No-Go |
| Sponsor | business mandate, priority, value and tolerances | Go/No-Go, conditional approval, exceptions within authority | domain actuals owned by Finance/Results |
| Portfolio Owner / Board | trade-offs across Initiatives | include, defer, reject, merge, return, conditional portfolio decisions | capacity confirmation without resource authority |
| PMO / Transformation Office | process quality, readiness, scenarios, governance audit | completeness confirmation; delegated decisions only | replace accountable Sponsor/Owner |
| Project Leader | execution readiness, schedule and team formation | schedule/start inside approved envelope | exceed Sponsor tolerances |
| Execution Manager | accept handoff, baseline, delivery management and acceptance | accept/reject handoff, bounded execution actions, delivery acceptance | change material scope/budget/risk without authority |
| Resource/Functional Manager | availability, assignment and skill supply | confirm/reject assignments and capacity commitments | portfolio priority |
| Task Owner | task delivery and evidence | task state inside policy | waive DoD or gate conditions |
| Decision Owner/Approver | decision result, rationale and follow-up | actions declared by the Decision Case | self-approve where separation is required |
| Finance Owner | investment case, cost/actual and reconciliation | financial truth/review | Initiative or delivery approval by implication |
| KPI/Benefit Owner | KPI contract, benefit measurement and effectiveness | effectiveness recommendation/review within policy | manufacture actuals or close delivery |
| Risk/Technical/Change Owner | named domain truth and residual conditions | domain review within authority | global Go/No-Go unless also authorized |
| Teresa | evidence synthesis, challenge, options, drafts and monitoring | no material business decision | approval, budget, baseline, owner, material risk, closure |

## 5. RACI by end-to-end step

Legend: A accountable, R responsible, C consulted, I informed.

| Step | Proposal Owner | Project Leader | Initiative Owner | Sponsor/Board | PMO | Execution Manager | Resource Manager | Finance/KPI/domain owners |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Draft and submit proposal | A/R | C | I | I | C | I | I | C |
| Source validation/register | C | A/R | I | I | C | I | I | C |
| Definition | C | C | A/R | C | C | I | C | C |
| Analysis/readiness | I | C | A/R | C | R | C | C | R/A for own truth |
| Portfolio decision | I | C | R | A | R | C | C | C |
| Plan scenario | I | A/R | C | C | R | C | C | C |
| Capacity commitment | I | R | C | C | C | C | A/R | C |
| Schedule/start decision | I | A/R | C | A for exception | C | C | C | C |
| Execution handoff | I | R | C | I | C | A/R receiver | C | C |
| Execution control | I | C | I | C/I | R | A/R | R | C |
| Delivery acceptance | I | C | I | I | C | A/R | C | C |
| Benefits tracking/review | I | I | C | C | C | C | I | A/R KPI/Benefit |
| Closure/archive | I | I | C | A or delegated governance | R | C | I | R Benefit |

## 5.1 Operating relationship: external functions, card and approval

The four Initiatives functions and the Initiative Card do not form five competing workflows.

```text
Inicjatywy registry
  -> open one Initiative Card
  -> prepare/publish governed card versions
  -> request a gate using an immutable card/source snapshot
  -> human Decision
  -> lifecycle/disposition update
  -> project the same Initiative into Portfel, Plan or Obciążenie
  -> external scenario produces a proposal/Decision input
  -> return to the Initiative Card for the authorized gate and audit snapshot
```

Rules:

1. `Inicjatywy` is the registry and entry to one Initiative Card. It does not maintain a second case file.
2. `Portfel`, `Plan` and `Obciążenie` own versioned cross-Initiative scenarios. They may produce membership, rank, window, constraint and commitment proposals, but they do not directly publish a lifecycle transition.
3. The Initiative Card stores relations to the published scenario/version and renders the Initiative-specific projection. It never copies the whole scenario.
4. A gate request is issued from the card's `Gates & Approvals` capability, using required card versions plus external scenario/source versions.
5. The Decision service owns authority, evidence snapshot, outcome, conditions and follow-up. After successful Decision read-back, Initiatives changes lifecycle/disposition atomically.
6. Returning from a gate sends exact findings to named cards/external scenario records. It does not create a new top-level workflow or delete the previous snapshot.

## 5.2 Decision basis by gate

`Required card` below means applicable, current, published and without unresolved blocker. `Conditional` means the gate policy may accept an explicit condition/waiver; it does not mean missing evidence is silently treated as complete.

| Decision | Preparer | Decision authority | Required Initiative Card basis | Required external basis | Permitted result |
| --- | --- | --- | --- | --- | --- |
| Definition | Initiative Owner | Lite: Project Leader; Standard: Project Leader after PMO/readiness review; Complex: named governance reviewer/PMO completeness authority per policy | Summary/Scope; Strategic Fit; Success Criteria; Outcomes & Benefits; Options including do-nothing; Stakeholders; People/Team and Roles/RACI at the level required by profile; Source/History | source envelope, duplicate/lineage result | approve Definition; return; defer; merge; stop |
| Portfolio Go/No-Go | Initiative Owner with PMO/Portfolio Owner | Lite/Standard: Sponsor; Complex: Steering/Portfolio Board, Sponsor recommends | current Definition snapshot; Options; Outcomes & Benefits; KPI contract/measurement plan; Financial Analysis and Financial Impact where applicable; Feasibility & Completeness; Dependencies; Risk & RAID; Change & Adoption; all required domain reviews | published Portfolio Scenario/version, scoring/ranking method version, included/conditional/deferred set, coverage and confidence | approve to backlog; conditional approve; return; defer; reject; merge |
| Schedule & Capacity | Project Leader | inside approved envelope: Project Leader; outside/UNKNOWN envelope: Sponsor or Board per profile | Milestones; Timeline; Resources & Capacity; People/Team; Roles & RACI; Dependencies; Risk & RAID; Gates & Approvals; unresolved approval conditions; KPI/benefit owner reference | published Plan Scenario/version; Capacity Assessment/version; confirmed/conditional commitments; funding envelope reference | schedule; conditional; return; hold; resequence; reduce scope; escalate |
| Execution handoff acceptance | Project Leader sends; Execution Manager reviews | Execution Manager | approved problem/outcome/scope; selected and rejected Options/rationale; Success Criteria; Milestones; Timeline/baseline window; People/Team/RACI; Resources & Capacity; Dependencies; RAID; Change/Adoption; Communication; Capabilities/Training where applicable; KPI/Finance refs; Gates/conditions | approved Schedule Decision, Handoff Package version and idempotency identity | accept; accept with explicit gaps; reject with blockers |
| Material change/reapproval | object owner prepares impact; Execution Manager coordinates during delivery | authority resolved from affected approval/tolerance; `UNKNOWN` authority escalates, never self-approves | changed card version(s); prior approval snapshot; Gates & Approvals impact; affected Scope, Option, Owner, Timeline, Resources, Finance, KPI, Dependency, Risk or other cards | affected Portfolio/Plan/Capacity/Execution baseline versions and deterministic impact preview | approve change; conditional; return; reject; stop/rebaseline where authorized |
| Delivery acceptance | Execution Manager | acceptance authority defined in governance profile; if `UNKNOWN`, Sponsor/governance decision required | Success Criteria; Milestones; Tasks evidence; Decisions/follow-up; Risk & RAID residuals; Change & Adoption; Communication/Training completion where applicable; Attachments/Materials acceptance evidence; Timeline/change history | Execution baseline/current/actual/forecast reconciliation; Finance actual reference; operational handover and Benefits Handoff draft | accept; accept with residuals; return; stop |
| Effectiveness review | Benefit/KPI Owner | Sponsor or delegated effectiveness authority; Complex may require Board | Outcomes & Benefits; KPI; Financial Impact/Finance reconciliation; Success Criteria/delivery evidence; Change & Adoption/adoption observations; Risk/assumptions; Comments/Activity/History and lessons | accepted Results observations, measurement window, attribution/confidence and open corrective actions | confirmed; partial; not achieved; return for measurement |
| Closure | Initiative/Benefit Owner | Sponsor or delegated governance; Complex per policy/quorum | Effectiveness Review snapshot; all mandatory follow-up ownership; Decisions/conditions; History/lessons; retention classification | Finance/Results reconciliation state and Execution closure read-back | close; return; create corrective; cancel closure |

### 5.2.1 Configurable authority resolution

The authority examples in the table are baseline-profile defaults, not hard-coded job-title rules. At runtime each gate resolves authority, separation-of-duties, delegation, quorum and allowed outcomes from the effective versioned governance profile. This supports both a small organization with one leader and a team, and a large organization with PMO, Sponsors, boards and domain approvers.

If Definition, Delivery Acceptance or Effectiveness authority is not configured or cannot be resolved to a capable actor, the gate fails closed and Admin receives a configuration finding. The product does not silently substitute Sponsor, PMO or the preparer.

## 5.3 Card state versus gate readiness

Card attributes from [Initiative Card System](./11_INITIATIVE_CARD_SYSTEM.md) are inputs to readiness, not lifecycle states:

- `completion=COMPLETE` means required fields are populated; it does not mean evidence is sufficient or approved;
- `quality=BLOCKER` prevents gate request/approval unless the gate policy exposes a named waiver and the authorized actor accepts it;
- `freshness=STALE|SOURCE_UNAVAILABLE` blocks any rule that requires current evidence;
- `review=ACCEPTED` is domain/card review, not the gate Decision;
- `applicability=NOT_APPLICABLE` requires reason and a waiver when policy marks the card required;
- dirty, saving, failed or conflicting card versions cannot be included in a gate snapshot.

Readiness returns finding-level evidence (`cardKey`, `ruleId`, severity, owner and remediation), never only a percentage.

## 6. Governance profiles

Profiles change evidence depth, reviewers, decision authority and cadence; they never remove lineage, options including do-nothing, immutable snapshots, human approval, handoff read-back or effectiveness review. Product baselines may be cloned and modified by an organization; configured profiles still compile to the same policy schema.

### 6.1 Lite

Use when all are true: low financial exposure, reversible change, one team/unit, no regulated/privacy/safety materiality, no critical shared constraint and outcome can be tested quickly.

Required roles: Proposal Owner, Project Leader, Initiative Owner, Sponsor; one person may hold Project Leader and Initiative Owner, but Sponsor remains separate for Go/No-Go.

Required decisions:

1. Project Leader: source validation/register.
2. Sponsor: Go/No-Go to `APPROVED_BACKLOG`.
3. Project Leader: schedule/start within Sponsor envelope; exceptions escalate to Sponsor.
4. Execution Manager: handoff acceptance and delivery acceptance.
5. Benefit Owner: effectiveness result; Sponsor or delegated governance closes.

Minimum evidence: source/provenance, problem, outcome, scope, owner, do-nothing plus one alternative, rough value/cost, KPI measurement plan, key risk/dependency, capacity confirmation and closure criteria.

### 6.2 Standard

Default when Lite criteria are not all satisfied and Complex triggers are absent.

Adds: PMO readiness review; named Finance, KPI/Benefit, Risk/Technical/Change reviewers as applicable; documented stakeholder review; scenario comparison; explicit schedule tolerances; monthly portfolio review and weekly execution control.

Decision rights: Sponsor Go/No-Go; Project Leader schedules inside envelope; Sponsor approves tolerance breach; domain owners approve their truth, not the overall Initiative.

### 6.3 Complex

Triggered by any material condition: regulated/compliance/security/privacy/safety; cross-business or external impact; high or irreversible capital exposure; Steering authority; critical resource conflict; material operating-model change; multiple rollout waves; strategic policy change; separation-of-duties conflict; manual Sponsor/PMO escalation.

Adds: independent PMO gate completeness; Steering Board Go/No-Go and material exceptions; quorum/conflict-of-interest/delegation rules; signed domain reviews; formal sensitivity and scenario analysis; staged funding; change/adoption plan; rollout gates; formal benefits governance.

### 6.4 Profile selection and escalation

1. Organization defines its default profile, initially one of the product baselines or an organization clone.
2. Project may override that default with another configured profile.
3. Teresa recommends the effective profile for an Initiative from evidence; an authorized human confirms it.
4. An Initiative may be escalated to a stricter profile; detected stricter triggers are displayed with reasons.
5. Downgrade requires an authorized Decision Case proving the trigger is absent or mitigated. It never occurs automatically and never removes earlier evidence/audit.

**ASSUMPTION A-01:** Product UI labels will use `Lite`, `Standard`, `Complex`; older `SIMPLE`, `STEERING_CONTROLLED`, `REGULATED` are mapped during migration.

Organization Admin configures monetary, headcount, privacy and cross-unit escalation thresholds. Until configured, product baseline thresholds and the safer detected profile apply; Teresa recommends but an authorized human confirms. The system may automatically escalate to a stricter review requirement, but never downgrade governance automatically.

## 7. Twelve lifecycle statuses — exact entry and exit contracts

### 7.1 `REGISTERED_DRAFT`

Entry: successful `REGISTER` read-back; stable `initiativeId`/`lineageId`; source/version/provenance; project and visibility classification; Initiative Owner; active governance profile.

Allowed work: definition, evidence requests, merge/extend suggested changes.

Exit to `DEFINED`: problem separated from solution; target outcome and beneficiary; in/out scope; success criteria or measurement plan; do-nothing and at least one alternative; Sponsor/Owner; key assumptions/unknowns; Definition Decision approved.

Failure/return: missing identity, source or visibility rolls back the transaction; incomplete content remains `REGISTERED_DRAFT` with `NOT_READY`, not an invented later status.

### 7.2 `DEFINED`

Entry: approved Definition snapshot based on section 5.2; current published versions of required Definition cards; no unresolved blocker on problem/outcome/scope/options/success/owner; source lineage remains valid.

Exit to `ANALYZING`: applicable analysis profile generated; domain owners/tasks assigned; evidence plan and freshness requirements set; analysis formally started.

Return: Definition Gate may return to preparation without deleting the approved historical version; a material reframe supersedes the prior Definition snapshot.

### 7.3 `ANALYZING`

Entry: required analysis cards/tasks and accountable owners exist.

Exit to `READY_FOR_DECISION`: applicable evidence, counter-evidence, options, feasibility, Finance/KPI refs, capacity estimate, dependencies, risks/change and stakeholders complete; blockers resolved or explicit exception prepared; PMO/readiness reviewer confirms snapshot.

Failure: domain source unavailable => `NOT_READY` or `BLOCKED`; stale sources require refresh or explicit exception with expiry.

### 7.4 `READY_FOR_DECISION`

Entry: immutable Decision Brief with recommendation, options/do-nothing, evidence/counter-evidence, assumptions, unknowns, confidence, impact, conditions and named authority; it references exact published card versions and external source versions listed for Portfolio Go/No-Go in section 5.2.

Exit to `APPROVED_BACKLOG`: authorized Portfolio/Go-No-Go Decision is `APPROVE` or `CONDITIONAL_APPROVE`; conditions create canonical follow-up objects.

Other outcomes: `RETURN` keeps lifecycle and sets gate `RETURNED`; `DEFER`, `REJECT`, `MERGE` set disposition; expired/stale snapshot returns to `PREPARING` and is superseded.

### 7.5 `APPROVED_BACKLOG`

Entry: approved Portfolio Decision, mandate and envelope, Sponsor, priority/rank rationale, conditions and Benefit Owner; Decision links the published Portfolio Scenario/version and the exact Initiative Card snapshot.

Exit to `SCHEDULED`: Plan Scenario/window; project and Execution Manager; role/skill demand; confirmed critical capacity; funding/budget envelope; dependencies; tolerances; baseline assumptions; handoff package; approved Schedule Decision.

Failure: a date alone never qualifies. Capacity `UNKNOWN`, missing Execution Manager or unresolved critical dependency blocks exit.

### 7.6 `SCHEDULED`

Entry: approved schedule/capacity snapshot linking the exact Plan Scenario, Capacity Assessment and card versions from section 5.2; tentative items converted to confirmed or explicitly conditional commitments; Handoff Package version fixed.

Exit to `IN_EXECUTION`: Execution validates and responds `accepted` or `accepted_with_explicit_gaps`; creates/links one Execution Case; returns `executionCaseId`, state and deep link; all approved gaps have owners/dates.

Failure/recovery: timeout/read-back missing => remain `SCHEDULED`, `execution_state=HANDOFF_PENDING`, safe idempotent retry. `rejected_with_blockers` remains `SCHEDULED` with gate returned; no duplicate case.

### 7.7 `IN_EXECUTION`

Entry: accepted Execution Case, approved Execution Brief/baseline, active accountable roles, work/resource/reporting cadence; accepted Handoff read-back references the exact Handoff Package and records every explicit gap as a canonical owned item.

Exit to `DELIVERED`: agreed scope delivered or explicitly waived; deliverables accepted with evidence; milestones/changes reconciled; open risks/issues accepted or transferred; actual time/cost references; operational handover; Benefit Owner/KPI measurement activated; Delivery Acceptance Decision.

Alternative: Stop Decision sets `STOPPED`, impact and replacement/restart policy. Health never changes lifecycle by itself.

### 7.8 `DELIVERED`

Entry: Delivery Acceptance snapshot based on section 5.2 and operational handover; residuals are owned and due; `effectiveness_result=NOT_MEASURED` unless an authorized earlier measurement exists.

Exit to `BENEFITS_TRACKING`: Results accepts Benefits Handoff; KPI owner, formula, source, baseline, target, unit, cadence and measurement window confirmed; returns Results case/deep link.

Failure: Results rejection keeps `DELIVERED` and creates explicit blockers; delivery is not reopened unless a Delivery/Change Decision requires it.

### 7.9 `BENEFITS_TRACKING`

Entry: accepted Results/KPI supervision and active measurement schedule.

Exit to `EFFECTIVENESS_REVIEWED`: measurement window reached or authorized early review; actuals/reconciliation available or explicitly unavailable; Benefit Owner completes Effectiveness Decision with `CONFIRMED`, `PARTIAL` or `NOT_ACHIEVED`.

Failure: missing actuals are `NOT_MEASURED`/blocked, never zero benefit. Deviation may create corrective Task/Decision/Risk or new Proposal Draft.

### 7.10 `EFFECTIVENESS_REVIEWED`

Entry: immutable effectiveness result based on accepted Results observations and the cards/sources in section 5.2, including evidence, attribution/confidence, Finance reconciliation, variance explanation and follow-up recommendation.

Exit to `CLOSED`: all follow-up obligations assigned; lessons learned reviewed; closure authority approves. `PARTIAL`/`NOT_ACHIEVED` may still close if residual action is explicitly owned.

### 7.11 `CLOSED`

Entry: Closure Decision, reconciled lineage, retention classification and no unowned mandatory follow-up.

Exit to `ARCHIVED`: retention/archive policy trigger and no legal/governance hold preventing archive.

Reopen: requires a new Decision; never overwrites closure. It either creates a new Initiative version/proposal or explicitly reactivates under policy.

### 7.12 `ARCHIVED`

Entry: archive event and immutable read-only record with preserved links/audit.

Exit: none through normal workflow. Legal/admin restore is a separately audited exceptional operation.

## 8. Gates, outcomes and default SLAs

| Gate | Request owner | Decision authority | Allowed outcomes | Default decision SLA Lite / Standard / Complex | Return SLA |
| --- | --- | --- | --- | --- | --- |
| Source Validation | Proposal Owner | Project Leader/Validator | `REGISTER`, `MERGE`, `EXTEND`, `RETURN`, `DEFER`, `DISMISS` | 2 / 3 / 5 business days | 5 business days or explicit due date |
| Definition | Initiative Owner | Project Leader or named reviewer | `APPROVE`, `RETURN`, `DEFER`, `MERGE`, `STOP` | 2 / 3 / 5 | 5 / 10 / agreed plan |
| Analysis Readiness | Initiative Owner | PMO/readiness reviewer | `READY`, `CONDITIONALLY_READY`, `RETURN`, `BLOCK` | 2 / 3 / 5 | condition-specific |
| Portfolio Go/No-Go | Initiative Owner/PMO | Sponsor/Portfolio Board | `APPROVE`, `CONDITIONAL_APPROVE`, `RETURN`, `DEFER`, `REJECT`, `MERGE` | 3 / 5 / 10 | next portfolio cycle or explicit date |
| Schedule & Capacity | Project Leader | Project Leader in envelope; Sponsor/Board for exception | `SCHEDULE`, `CONDITIONAL`, `RETURN`, `HOLD`, `RESEQUENCE`, `REDUCE_SCOPE`, `ESCALATE` | 2 / 5 / 10 | explicit plan/capacity due date |
| Execution Acceptance | Project Leader | Execution Manager | `ACCEPT`, `ACCEPT_WITH_GAPS`, `REJECT_WITH_BLOCKERS` | 1 / 2 / 3 | 2 / 3 / 5 |
| Material Change/Rebaseline | Execution Manager | authority by tolerance | `APPROVE`, `CONDITIONAL`, `RETURN`, `REJECT`, `STOP` | 1 / 3 / 5; critical expedited | explicit condition date |
| Delivery Acceptance | Execution Manager | acceptance authority | `ACCEPT`, `ACCEPT_WITH_RESIDUALS`, `RETURN`, `STOP` | 2 / 3 / 5 | 3 / 5 / agreed remediation |
| Benefits Handoff | Execution Manager | Benefit/KPI Owner | `ACCEPT`, `ACCEPT_WITH_GAPS`, `REJECT_WITH_BLOCKERS` | 2 / 3 / 5 | 3 / 5 / 10 |
| Effectiveness Review | Benefit Owner | Sponsor/governance authority | `CONFIRMED`, `PARTIAL`, `NOT_ACHIEVED`, `RETURN_FOR_MEASUREMENT` | 5 / 10 / 15 after measurement window | next measurement date |
| Closure | Initiative/Benefit Owner | Sponsor/delegated governance | `CLOSE`, `RETURN`, `CREATE_CORRECTIVE`, `CANCEL_CLOSURE` | 3 / 5 / 10 | explicit action plan |

SLA clock starts only when `gate_state=PENDING_DECISION` and readiness prerequisites are valid. It pauses for an acknowledged request for evidence and resumes on resubmission. Due reminders default to 50%, 80% and 100% of SLA. At breach, delegate if policy permits; otherwise escalate to the next named authority and notify preparer/PMO. No auto-approval exists.

**ASSUMPTION A-02:** The SLA values above are product defaults, not contractual commitments; Admin may configure them without changing semantics.

**OPEN DECISION OD-02:** Owner must approve these numerical defaults before status changes from `draft_for_owner_review` to `canonical`.

## 9. Return and resubmission contract

Every `RETURN` records: target sections/objects, reason code, human rationale, evidence needed, accountable resolver, due date, whether current snapshot remains valid, and consequences of non-response.

Return never deletes work or maps to `REJECTED`. Resubmission creates a new snapshot/version and links the returned decision. If scope/value/risk changes materially, all affected domain approvals become stale and readiness recomputes. Non-response at return due date escalates; it does not auto-reject unless an explicit policy Decision exists.

## 10. Exceptional dispositions

`DEFERRED`, `REJECTED`, `MERGED`, `STOPPED`, `CANCELLED` require: Decision Case; actor/authority; reason; evidence snapshot; impact on Portfolio/Plan/Capacity/Finance/Results; conditions; notifications; and archive/review policy.

- `DEFERRED`: mandatory `reviewTrigger` (date, event or metric), owner and expiry behavior.
- `REJECTED`: gate/version-specific rationale; new evidence creates a new proposal/version, not hidden resurrection.
- `MERGED`: target Initiative, field-level lineage and source links; source becomes read-only disposition.
- `STOPPED`: execution impact, sunk/remaining cost, people/contract consequences, benefit implications and restart/replacement rule.
- `CANCELLED`: administrative withdrawal before a substantive business decision, for example withdrawal by proposer or invalid/duplicate setup. It never substitutes for business rejection or stopping approved work.

Legacy `CANCELLED` remains migration-ambiguous and must not be inferred without evidence, even though target semantics are now fixed.

## 11. Cross-module handoffs

| Handoff | Required payload | Consumer validation | Success read-back | Failure/recovery |
| --- | --- | --- | --- | --- |
| Source → Initiatives | source ID/version, provenance, problem, outcome, scope, evidence, owner/visibility proposal | permissions, duplicate, source freshness | initiative ID/lineage or merge target | return/dismiss/defer; idempotent register retry |
| Initiative → Finance | analysis request, assumptions, scenario/version | scope/permissions/model availability | Finance model/version/ref and reconciliation state | explicit unavailable/stale; no local copied value |
| Initiative → Results | KPI hypothesis/contract request | owner, formula/source feasibility | KPI contract refs | missing measurement plan blocks relevant gate |
| Portfel → Plan | portfolio scenario/version, included set, conditions | scenario published/current | Plan Scenario ID/version | stale scenario rejected; clone new draft |
| Plan ↔ Obciążenie | same scenario identity, periods, demand/supply units and assumptions | unit/time compatibility and coverage | constraint/commitment results on same version | conflicts return as diff; never second roadmap |
| Initiatives → Execution | section 7.6 handoff package | completeness, permissions, project, roles, idempotency | executionCaseId/state/deep link | pending/rejected; retry same idempotency key |
| Execution → Tasks/Decisions | canonical source link, work package, authority, due/DoD | permissions/state/idempotency | work item ID/status/deep link | no shadow item; retry/read-back |
| Execution → Resources | demand, period, role/skill, remaining estimate | availability/assignment capability | assignment/constraint ID and acceptance | unknown supply remains unknown; conflict signal |
| Execution → Finance | commitments/actual refs/forecast request | ledger ownership and period/unit | cost/variance/reconciliation projection | unavailable/stale is explicit |
| Execution → Results | delivery/benefits package, KPI refs, owner/window | measurement readiness | Results case/status/deep link | remain DELIVERED with blockers |
| Execution → Reports | report scope/as-of/source versions | completeness/permissions | immutable Report Run | partial/stale draft, never false publish |

## 12. Audit and recovery requirements

Every gate/handoff stores actor and acting-on-behalf-of, authority, organization/project, source versions, before/after, prompt/model/policy for AI contribution, idempotency key, timestamp, disposition, reason, conditions, notification proof and read-back.

Recovery rules:

- retry reuses the same idempotency key until terminal read-back;
- partial multi-object writes roll back atomically or expose a repair case with exact completed/failed objects;
- stale version returns conflict and diff; it never last-write-wins a material decision;
- permission loss preserves audit but hides protected content;
- degraded dependencies expose next safe action and do not fabricate completion.

## 13. Remaining assumptions and open decisions

- **ASSUMPTION A-03:** `EFFECTIVENESS_REVIEWED` is one lifecycle status; its result is stored only in `effectiveness_result`.
- **ASSUMPTION A-04:** `ACCEPT_WITH_GAPS` is allowed only when every gap has owner, due date, severity and a policy allowing continuation.
- Exact authority, delegation, quorum, self-approval, separation-of-duties, SLA and materiality are Admin-configurable by governance profile. Product ships versioned `Lite`, `Standard`, `Complex` baselines that can be cloned; organization default may be overridden by project and an Initiative may be escalated. Every Decision stores the effective policy version.
- **OPEN DECISION OD-05:** Define materiality tolerances for scope, time, cost, value and residual risk. Until configured, the system escalates rather than self-approves.
- **OPEN DECISION OD-06:** Confirm archive retention and exceptional restore authority.
- Definition, Delivery Acceptance and Effectiveness authorities are resolved from the effective governance profile, not hard-coded roles. Missing or invalid authority configuration remains fail-closed.

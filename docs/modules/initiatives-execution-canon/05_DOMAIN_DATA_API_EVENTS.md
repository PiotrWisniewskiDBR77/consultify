# 05. Domain, data, API and events

Status: **design contract backed by repository evidence; not runtime acceptance**
Scope: Initiatives + Execution, including the hand-off to Results and Finance
Rule: an item marked `UNKNOWN`, `BLOCKED` or `EVIDENCE_MISSING` must not be silently defaulted during implementation.

## 1. Authority and bounded contexts

The product information architecture is defined by the sibling canon documents in this directory. Existing code is evidence and a reuse source, not authority over the future IA.

| Context | Owns | Must not become owner of |
|---|---|---|
| Initiatives | why/what, proposal lineage, business case, governance gates, priority, scope, dependencies, intended outcomes, commitment decision | task execution, financial actuals, outcome actuals |
| Execution | delivery plan, work, decisions, delivery resources, forecast, blockers, progress, interventions | original business justification, canonical benefit actual, finance ledger |
| Results | KPI observations, benefit/outcome actuals, attribution and outcome review | delivery task state |
| Finance | financial assumptions/models and financial actuals | initiative lifecycle |
| My Work | role-personal projection of actions, tasks and decisions | an independent copy of lifecycle state |

The boundary is a golden thread, not record duplication:

`source/candidate -> initiative -> commitment/handoff -> execution -> outcome observation`.

## 2. Entities, identity and ownership

### 2.1 Canonical entities

| Entity | Identity | Tenant/owner | Essential relations | Current evidence |
|---|---|---|---|---|
| `InitiativeCandidate` | candidate ID; must remain distinct from Initiative ID | `organization_id`; creator/source | source artifact; accepted Initiative, if any | candidate routes and `CandidatesTable`; exact DB constraints `UNKNOWN` |
| `Initiative` | stable initiative `id` across the whole golden thread | `organization_id`; business owner, execution owner, sponsor, creator | candidate/source, dependencies, gates, handoff, execution projection, intended outcomes | `server/src/routes/pmo/initiatives.routes.ts`, `InitiativeController.ts` |
| `InitiativeDependency` | independent ID or composite key `UNKNOWN` | same tenant as both initiatives | predecessor, successor, type, lag/constraint | dependency routes exist; cycle/tenant constraints `EVIDENCE_MISSING` |
| `GovernanceGate/Decision` | gate/decision ID | organization; accountable role | initiative, requested action, decision, evidence, actor, timestamp | gate roles/checks and decision checks exist |
| `StageHandoff` | handoff ID | organization; from/to accountable roles | initiative, from stage, to stage, payload/evidence | `initiative_handoffs` and `initiative.handoff` writes are present |
| `ExecutionPlan` | preferably the Initiative ID as aggregate reference; separate plan ID only if required | organization; execution owner | initiative, milestones, tasks, capacity, risks, forecasts | projections exist; canonical cardinality `UNKNOWN` |
| `Task` | task ID | organization; assignee/accountable owner | initiative/project, milestone, dependency | queried by Execution; schema authority `UNKNOWN` |
| `ExecutionDecision` | decision ID | organization; decision owner | initiative/project, options, due date, outcome | pending decisions can block DONE |
| `Milestone` | milestone ID | organization; owner | initiative/project, date, completion | PMO routes exist |
| `ResourceAssignment/StaffingPlan` | assignment/plan ID | organization; resource owner | initiative, person/role, period, allocation, capacity | capacity, resource and staffing routes exist |
| `BudgetItem/Forecast` | budget item ID | organization; Finance authority for actuals | initiative, period, baseline, forecast, actual reference | budget routes exist; accounting integration `UNKNOWN` |
| `RAIDItem` | RAID ID | organization; item owner | initiative/project, type, severity, due date, resolution | RAID/governance routes mounted |
| `KPI/OutcomeDefinition` | KPI ID | organization; Results owner for observations | initiative, baseline, target, direction, period | rollout KPI API exists |
| `KPIObservation/BenefitActual` | observation ID | organization; Results/Finance authority by measure | KPI/benefit, observed value, period, source | persistence/readback contract `UNKNOWN` |
| `ReportDefinition` | report definition ID | organization | audience, cadence, sections, query definition | report-builder definitions exist |
| `AuditEvent` | immutable event/audit ID | organization; actor | aggregate, action, before/after or payload, timestamp, correlation | best-effort audit writes exist; durable outbox `EVIDENCE_MISSING` |

### 2.2 Identity invariants

1. Every tenant-owned read and write MUST be scoped by `organization_id` derived from authenticated context, never trusted from a body parameter.
2. Candidate acceptance MUST create or link exactly one Initiative. Retry semantics and uniqueness key are `EVIDENCE_MISSING` and therefore block automatic bulk migration.
3. Handoff to Execution MUST preserve the Initiative ID as the business correlation ID. A delivery/project ID may coexist but must not replace it.
4. Results and Finance observations MUST reference the Initiative ID and their own authoritative record IDs; values must not be copied as untraceable numbers.
5. Legacy `name` and canonical `title` coexist in runtime. Target write model uses `title`; compatibility reads may expose `name` until consumers are migrated.
6. `source_type` + `source_id` preserve provenance. Allowed source types and uniqueness rules are `UNKNOWN`.

## 3. Fields, enums and relations

### 3.1 Initiative write model

Required target fields:

- identity/tenant: `id`, `organizationId`, `createdAt`, `updatedAt`, `createdBy`;
- definition: `title`, `summary/problem`, `scopeIn`, `scopeOut`, `sourceType`, `sourceId`;
- accountability: `businessOwnerId`, `executionOwnerId`, `sponsorId`;
- decision: priority, strategic alignment, intended outcomes, business case reference;
- planning: target dates, sizing/estimate with unit and confidence, dependencies;
- lifecycle: the compatibility runtime status plus the target dimensions in section 4;
- evidence: gate evidence, audit/version metadata.

Fields currently present but whose semantics/cardinality remain `UNKNOWN`: axis/area, type, category, readiness score, fit score, ROI, confidence, health override, charter completeness.

### 3.2 Execution write model

Required target fields:

- `initiativeId` correlation, optional `executionPlanId`;
- accountable delivery owner and team/resource assignments;
- planned start/end, forecast start/end, actual start/end;
- milestones, tasks and decisions;
- estimate/baseline, forecast and actual for time, people/capacity and money;
- risks, blockers, issues and changes;
- progress observations with observation time and source;
- report/read-model metadata, not report-owned copies of domain state.

`progress = 0`, `actual = 0` and `missing` are different states. Missing estimates, baselines or observations MUST remain null/unknown and carry a data-quality reason.

### 3.3 Relations and integrity

- Dependencies are tenant-local directed edges. Self-edge, duplicate-edge and cycle behavior are `EVIDENCE_MISSING`.
- A business owner and execution owner are roles, not interchangeable labels. Role reassignment must be audited.
- A gate decision references the exact lifecycle transition it authorizes.
- Tasks, decisions, milestones, RAID and assignments belong to Execution but remain queryable by Initiative ID.
- KPI definitions originate from intended outcomes; observations belong to Results.
- Money actuals are references to Finance-authoritative data. Any local snapshot requires `sourceSystem`, `sourceRecordId`, `observedAt` and currency.

## 4. Lifecycle state machines

### 4.1 Confirmed compatibility machine (13 runtime statuses)

Repository authority for the current machine is `server/src/constants/initiativeStatuses.ts`; the database CHECK is normalized in `server/migrations/20260624_initiative_status_normalize.sql`.

| From | Allowed target(s) |
|---|---|
| `DRAFT` | `PENDING_REVIEW`, `CANCELLED` |
| `PENDING_REVIEW` | `REVIEW`, `DRAFT`, `CANCELLED` |
| `REVIEW` | `PROMOTED`, `DRAFT`, `CANCELLED` |
| `PROMOTED` | `PLANNING`, `CANCELLED` |
| `PLANNING` | `APPROVED`, `CANCELLED` |
| `APPROVED` | `SCHEDULED`, `CANCELLED` |
| `SCHEDULED` | `EXECUTING`, `CANCELLED` |
| `EXECUTING` | `BLOCKED`, `DONE`, `CANCELLED` |
| `BLOCKED` | `EXECUTING`, `CANCELLED` |
| `DONE` | `TRACKING` |
| `TRACKING` | `ARCHIVED` |
| `CANCELLED` | `ARCHIVED` |
| `ARCHIVED` | terminal |

The lowercase five-value enum in `server/src/types/index.ts` is deprecated compatibility material and MUST NOT be selected as canon. `initiativeLifecycleCanon.ts` is an adapter/projection, not a second state-machine authority.

### 4.2 Target dimensions and 13-status compatibility mapping

The target separates orthogonal facts. During migration retain `runtimeStatus` losslessly and derive dimensions. Do not infer candidate state: a candidate is a separate entity, not a DRAFT initiative.

| Runtime status | Definition/governance | Commitment | Delivery | Outcome | Disposition | Health/readiness |
|---|---|---|---|---|---|---|
| `DRAFT` | authoring | uncommitted | not started | not started | active | separately derived |
| `PENDING_REVIEW` | submitted | uncommitted | not started | not started | active | separately derived |
| `REVIEW` | in review | uncommitted | not started | not started | active | separately derived |
| `PROMOTED` | accepted for planning | candidate for commitment | not started | not started | active | separately derived |
| `PLANNING` | planning | proposed | not started | not started | active | separately derived |
| `APPROVED` | approved | committed | not started | not started | active | separately derived |
| `SCHEDULED` | approved | scheduled | not started | not started | active | separately derived |
| `EXECUTING` | approved | committed | executing | not started | active | separately derived |
| `BLOCKED` | approved | committed | executing | not started | active | blocked overlay = true |
| `DONE` | approved | fulfilled | delivered | awaiting tracking | active | separately derived |
| `TRACKING` | approved | fulfilled | delivered | tracking | active | separately derived |
| `CANCELLED` | last known | released/stopped | stopped | stopped | cancelled | separately derived |
| `ARCHIVED` | last known | closed | closed | closed/last known | archived | separately derived |

Target enum names are design labels, not claims that DB columns already exist. Exact persisted enum names and whether `BLOCKED` becomes only an overlay require an Architecture Decision Record: `BLOCKED`. Until that decision, writes continue through the confirmed compatibility machine.

### 4.3 Gates and role actions

The current status controller performs tenant lookup, normalization, transition validation, role gates, readiness/AI checks, a required reason for BLOCKED and pending-decision checks before DONE. Gate details are distributed across `InitiativeController.ts` and constants. The complete role-by-transition matrix is `EVIDENCE_MISSING` as one authoritative machine-readable contract.

Known risk: cancellation may bypass a gate because its gate mapping is null. This is `BLOCKED` for target acceptance until policy and tests prove who may cancel at each stage.

Execution does not get an independent duplicate Initiative lifecycle. It exposes delivery phase/progress/health plus the projected Initiative commitment/lifecycle. A separate execution-plan state machine is `UNKNOWN` and must not be invented from UI labels such as “Executing”.

## 5. API contract inventory

This section distinguishes confirmed route families from target requirements. It does not declare unverified endpoints.

### 5.1 Confirmed command/query families

| Capability | Confirmed route family/evidence | Contract gaps |
|---|---|---|
| Initiative list/detail/update/status | `/api/initiatives`, `/:id`, `/:id/status` in `server/src/routes/pmo/initiatives.routes.ts` | ETag/version/precondition `EVIDENCE_MISSING` |
| Portfolio rollups/dependencies/health | portfolio, rollup, dependency routes; portfolio-health service/routes | formula version and freshness `EVIDENCE_MISSING` |
| Readiness/history/gates | readiness, status history, gate checks/roles routes | one published schema `EVIDENCE_MISSING` |
| Capacity/resources/staffing | capacity, capacity timeline, resources, staffing-plan routes | unit/time-bucket canon `UNKNOWN` |
| Milestones/baselines/budget/RAID | PMO initiative route families | Finance/Execution ownership boundary not consistently enforced |
| Candidate list/scan/accept/dismiss | `/api/initiatives/candidates`, `/scan`, `/:id/accept`, `/:id/dismiss` | accept idempotency and duplicate detection `EVIDENCE_MISSING` |
| Execution summary/blockers/health/gate check | `/api/execution/stats`, `/escalations`, `/calendar`, `/:projectId/summary`, `/blockers`, `/health`, `/gate-check` | Initiative ID vs project ID compatibility `UNKNOWN` |
| Rollout KPI/risk/change/closure | `/api/rollout/kpis`, `risks`, `changes`, `closures`; KPI history | aggregate ownership and concurrency contract `EVIDENCE_MISSING` |
| Execution reports | `/api/report-builder/definitions?kind=EXECUTION_PACK` and report-builder routes | snapshot/reproducibility contract `EVIDENCE_MISSING` |

### 5.2 Required command semantics

Every mutating operation must specify:

1. authenticated tenant and actor;
2. aggregate ID and expected version/precondition;
3. command ID/idempotency key;
4. validation and authorization result;
5. atomic write plus audit/event persistence;
6. read-after-write representation or stable location/version;
7. typed error code, not only message text.

Current evidence confirms tenant-scoped status lookup and typed HTTP outcomes in parts of the controller, but universal versioning/idempotency is `EVIDENCE_MISSING`. Therefore clients must not retry non-idempotent commands automatically until each command is classified.

### 5.3 Query/readback rules

- A successful command is not accepted until the authoritative query returns the new state for the same tenant.
- Lists and previews are projections of the same versioned record; they must not maintain independent business state.
- Queries return data-quality metadata: `asOf`, `source`, `completeness`, and `staleness` for derived metrics.
- Pagination, filtering and sorting semantics must be server-compatible for large portfolios. Cursor versus offset is `UNKNOWN`.
- Cross-context composites must expose partial-source failure rather than replace missing values with zero.

### 5.4 Error taxonomy

Confirmed/current patterns include `400` invalid/unknown transition, `401` unauthenticated, `403` forbidden, `404` tenant-scoped not found, and `422` gate/readiness/AI blocking. Target contract adds stable machine-readable error codes and field/gate details while retaining appropriate HTTP status.

Concurrency conflict status, duplicate command behavior and partial composite errors are `EVIDENCE_MISSING`; do not claim `409` support until implemented and tested. Best-effort audit/event failure currently may not fail the command; this prevents an “auditable command” acceptance claim.

## 6. Domain events and audit

### 6.1 Required event envelope

`eventId`, `eventType`, `schemaVersion`, `occurredAt`, `organizationId`, `actorId`, `aggregateType`, `aggregateId`, `aggregateVersion`, `correlationId`, `causationId`, `commandId`, and a minimal non-secret payload.

### 6.2 Event catalogue

| Event | Trigger | Confirmed today? |
|---|---|---|
| `initiative.created` | Initiative persisted | yes, best-effort audit emission |
| `initiative.status.changed` | validated lifecycle transition | status history/audit evidence exists; durable domain event `EVIDENCE_MISSING` |
| `initiative.gate.requested/decided` | governance action | notifications/gate actions exist; durable event `EVIDENCE_MISSING` |
| `initiative.handoff` | stage/ownership handoff | yes, best-effort handoff/audit path |
| `initiative.owner.changed` | accountable role reassignment | `EVIDENCE_MISSING` |
| `initiative.dependency.changed` | dependency mutation | `EVIDENCE_MISSING` |
| `execution.plan.changed` | baseline/forecast changes | `EVIDENCE_MISSING` |
| `execution.progress.observed` | progress observation | `EVIDENCE_MISSING` |
| `execution.blocker.opened/resolved` | blocker lifecycle | `EVIDENCE_MISSING` |
| `execution.decision.requested/decided` | delivery decision | `EVIDENCE_MISSING` |
| `outcome.observed` | Results records KPI/benefit actual | `EVIDENCE_MISSING` |

There is no sufficient evidence of a transactional outbox, ordered delivery, consumer deduplication, replay policy or schema registry. These are `EVIDENCE_MISSING`. Best-effort fire-and-forget events cannot be used as the only integration mechanism.

### 6.3 Audit, tenant and security requirements

- Audit is append-only and tenant-scoped; record actor, impersonation/service identity, command, aggregate/version and before/after delta or references.
- Authorization is enforced on commands and queries, including nested resources and exports.
- A tenant-scoped `404` should not reveal another tenant's record existence.
- Reports/exports inherit row-level tenant and field-level authorization.
- Sensitive business-case, people and financial fields require classification and redaction rules: `UNKNOWN`.
- Retention, legal hold, audit export, erasure exceptions and encryption-key ownership are `UNKNOWN`.
- AI readiness/gate checks must store model/policy version and evidence. Current fail-open behavior on some AI-check errors is `BLOCKED` for hard-governance use.

## 7. Derived metrics and data quality

### 7.1 Formula contract

Every derived metric carries `formulaId`, `formulaVersion`, numerator/denominator inputs, observation window, `asOf`, source records and completeness.

Confirmed Execution health currently uses approximately:

`healthScore = round((averageProgress + decisionHealth + taskHealth + riskHealth) / 4)`

in `server/src/controllers/ExecutionController.ts`. This is current runtime evidence, not automatically the target business formula. Optional EVM-based scoring and frontend fallbacks create competing calculations. Target authority must be server-side/versioned; client fallback is degraded display only and cannot be acceptance evidence.

Required formula definitions:

- schedule variance and on-time rate: baseline versus forecast/actual, with explicit date population;
- workload/capacity: allocated capacity divided by available capacity for the same person/role and period;
- budget variance: forecast or actual minus approved baseline, with currency and period;
- progress: weighted completed scope divided by weighted committed scope; weight source required;
- outcome attainment: direction-aware `(actual - baseline) / (target - baseline)`, capped only by an explicit policy;
- portfolio coverage: represented strategic scope divided by required scope, with MECE dimension/version;
- conversion: count reaching declared terminal stage divided by eligible cohort, never total historical records without cohort rules.

Exact production formulas for coverage, readiness, conversion, EVM and health thresholds are `UNKNOWN` until approved by product/data owners.

### 7.2 Data-quality states

Use at least: `COMPLETE`, `PARTIAL`, `STALE`, `MISSING`, `INVALID`, `NOT_APPLICABLE`, `SOURCE_UNAVAILABLE`. Keep `UNKNOWN` distinct from zero. Metrics with missing denominators return null plus a reason, never `0%`.

Acceptance requires reconciliation across Initiative list, preview/workspace, Execution projection, reports, Results and Finance for the same IDs and `asOf`. Current screenshots and green component tests are not such evidence.

## 8. Open decisions

1. `BLOCKED`: approve the target dimensional enum names and whether persisted `BLOCKED` becomes a delivery/health overlay.
2. `BLOCKED`: define cancellation authorization and reversal policy.
3. `UNKNOWN`: decide one-to-one versus one-to-many Initiative-to-ExecutionPlan cardinality.
4. `EVIDENCE_MISSING`: prove candidate acceptance and handoff idempotency with DB constraints and retry tests.
5. `EVIDENCE_MISSING`: select transactional outbox/event delivery guarantees.
6. `UNKNOWN`: publish data classification, retention and report/export policy.
7. `UNKNOWN`: approve formula owners, versions, thresholds and source-of-truth systems.

## 9. Gap audit after card and integration canon (documents 11/12)

This audit maps the 26 target business cards to live implementation evidence. `PRESENT` means that code or a route/table exists; it does **not** mean accepted behavior. A row is accepted only after the tests and realDB evidence in document 06 pass.

Legend: `A` active/mounted, `D` duplicate/competing path, `P` partial, `M` missing target capability, `U` unused/orphan/uncertain mount, `UNKNOWN` insufficient evidence.

### 9.1 Twenty-six card capability matrix

| Target card | Active component/projection | Route/service/DB evidence | Gap verdict |
|---|---|---|---|
| Summary / Scope | `OverviewSection`, `ProblemDefinitionSection`, `ScopeSection`; also N-mode combined definitions | Initiative detail/update; fields on Initiative | `A+D+P`: three registry keys and combined board mapping compete; versioned card draft/publish and impact review `M` |
| Strategic Fit | fragments in Overview/Target State and portfolio scoring | axis/goals/portfolio projections exist | `M`: no first-class card, governed goal contribution/conflict relation `UNKNOWN` |
| Success Criteria | `TargetStateSection`; milestone acceptance fragments | Initiative fields/milestones | `P`: target state is not a canonical criterion aggregate; evidence method/evaluation point `M` |
| Outcomes & Benefits | KPI/benefit fragments in `KpisSection`, Benefits/Results modules | initiative KPI and benefits/Results routes/tables exist | `D+P`: actual ownership spans Initiatives/Rollout/Results; governed hypothesis-to-observation link `UNKNOWN` |
| KPI | `KpisSection` and inline KPI UI in `InitiativeDocumentView` | initiative KPI CRUD; Results catalog API; multiple KPI migrations | `A+D+P`: two render paths and multiple truth models; formula/version/source reconciliation `M` |
| Options | decision UI can hold options; no card | Decision routes/tables | `M`: option set/do-nothing/recommendation is not a first-class Initiative card/read model |
| Financial Analysis | `FinancialAnalysisSection` | budget/Finance-related APIs and template config | `A+P`: current section exists but registry contract itself flags semantic conflict; versioned Finance case reference/readback `UNKNOWN` |
| Financial Impact | `FinancialImpactSection` | Finance/budget projections | `A+P`: narrative/component present; Finance-authoritative source and sensitivity lineage not proven |
| People / Team | `TeamSection` and `InitiativeTeamSection` | projects/members/access routes and tables | `D+P`: two components and mixed Initiative/Project ownership; accepted assignment/vacancy lifecycle `M` |
| Roles & RACI | `RaciEscalationSection`; gate-role UI also edits roles | gate-role API/table; project roles | `D+P`: governance and delivery roles overlap; exactly-one-accountable constraint `EVIDENCE_MISSING` |
| Stakeholders | `StakeholdersSection` | Initiative stakeholder CRUD | `A+P`: presence confirmed; stance/evidence/relationship-owner schema and tenant tests `UNKNOWN` |
| Resources & Capacity | `ResourcesSection`, portfolio Resources analysis, Execution capacity projections | Initiative resources, staffing/capacity routes | `D+P`: assignment, demand and capacity are stitched from multiple models; period/unit/confidence canon `M` |
| Dependencies | `DependenciesSection`, roadmap/timeline projections | task dependency API plus Initiative dependency tables/routes and V8 cross-initiative dependencies | `D+P`: three edge models; typed cross-Initiative edge, cycle detection and atomic impact checks `M` |
| Risk & RAID | `RaidSection` plus inline RAID UI and Execution risk/rollout views | Initiative RAID/governance routes and tables | `D+P`: duplicate render/read paths and risk stores; residual-risk Decision linkage `UNKNOWN` |
| Feasibility & Completeness | `GateReadinessSection`, portfolio Completeness analysis | readiness/AI/gate routes; feature/event tables | `A+D+P`: multiple formulas/checkers; no single policy-versioned finding schema; AI fail-open is `BLOCKED` |
| Technical Specification | attachment/linked-item fragments only | artifact/link graph and generic Decisions/Risks | `M`: no governed requirements/NFR/interface/security/ADR card or typed relation contract |
| Milestones | combined `TasksMilestonesSection`; timeline views | milestone PMO routes/tables | `A+P`: target needs a separate card over canonical milestones; acceptance evidence and handoff ownership `UNKNOWN` |
| Timeline | `TimelineSection` and large `TimelinePlanner`; roadmap/calendar/Gantt alternatives | baseline, timeline/capacity routes | `D+P`: several planners/projections; scenario versus approved baseline and OCC `M` |
| Tasks | combined `TasksMilestonesSection`; detail opens from hub | `/api/tasks` has competing route implementations; Task DB/dependencies/escalations | `A+D+P`: one visible route file is a stub while richer Task handling exists elsewhere; mounted authority and normalized lifecycle `UNKNOWN` |
| Decisions | `DecisionsSection`, gate workflow table, My Work decision components | rich `/api/decisions`, My Work decision routes, several decision tables/migrations | `A+D+P`: duplicate projections/route families and lifecycles; publish/verify chain and OCC/idempotency `M` |
| Gates & Approvals | `GateReadinessSection`, `InitiativeGatesWorkflowTable` | readiness, AI-check, gate-role, status transition/history | `A+D+P`: status controller enforces some gates; UI also directly updates multiple records; atomic policy-versioned approval `M` |
| Change & Adoption | no first-class Initiative card; Execution change/people-change fragments | change log/sentiment/capability route families | `U+M`: capabilities exist outside canonical card; behavior/outcome relation and mounted ownership `UNKNOWN` |
| Communication & Engagement | stakeholder/comments/material fragments | stakeholder-communication route families exist elsewhere | `U+M`: no first-class card or approved message/publication workflow in Initiative workspace |
| Capabilities & Training | `CompetencyRequirementsSection`, `SkillsGapSection` | capability/skills services exist; section DB seed parity is explicitly disputed | `A+D+P`: two technical sections represent one business card; source-of-truth and seed coverage `UNKNOWN` |
| Attachments & Materials | `AttachmentsSection`; `LinkedItemsSection` alias; artifact backlinks | artifacts, link graph, linked-items CRUD | `A+D+P`: two section keys and broad client search/stitch; provenance/version/access/publication contract `M` |
| Comments, Activity & History | `CommentsSection`, `HistorySection`; watchers/reminders/tags utilities | comments/history/status-history/watchers routes/tables | `A+D+P`: activity is split across comment/history/audit/status stores; immutable correlation and full audit completeness `EVIDENCE_MISSING` |

### 9.2 Registry and template authority conflict

There are at least four competing representations of card composition:

1. `SECTION_REGISTRY` contains 29 runtime keys; `watchers` incorrectly reuses `OverviewSection` as a placeholder.
2. `DEFAULT_VISIBLE_SECTIONS` enables 24 keys and disables optional/legacy keys.
3. `initiativeCardContract.ts` describes 27 canonical technical cards, aliases `initiativeTeam -> team` and `linkedItems -> attachments`, while also documenting unresolved DB/board reconciliation.
4. `InitiativeDocumentView` N-mode uses a separate curated ID namespace (`initiative-definition`, `target-state-scope`, `risk-raid`, `kpi`, etc.) and a mapping to registry keys.
5. Database `initiative_section_types` plus `initiative_templates.visible_sections/section_order/required_fields` can override the frontend fallback.

Documents 11/12 supersede these as the **business capability catalog**. The target requires one versioned `cardKey` registry mapping each of the 26 business cards to one or more adapters. Templates may set order/applicability/requiredness but MUST NOT redefine card identity or schema. Choosing DB registry versus frontend registry as runtime authority remains `BLOCKED`; silent fallback between them is unacceptable.

### 9.3 Aggregate and storage gaps exposed by the cards

| Concern | Current technical evidence | Required resolution |
|---|---|---|
| Card persistence | many cards edit Initiative columns or related aggregates directly; no universal card-version store | define which cards are projections versus versioned Initiative-owned documents; never serialize all 26 into an opaque blob |
| Material change | direct PUT/POST calls from sections, including multi-record save in Gate readiness | command/transaction boundary with change set, expected version, impact result and atomic publish; `M` |
| Task authority | core `tasks` tables and multiple routes, including a minimal stub route | identify mounted canonical controller/service and retire shadow/stub routes; authority `UNKNOWN` |
| Decision authority | unified and legacy Decision tables/routes plus gate-specific Decision usage | one aggregate/lifecycle and compatibility projection; authority partially known, full precedence `UNKNOWN` |
| Dependency authority | task, Initiative and V8 cross-Initiative edges | one typed relation service or explicit bounded edge types; no client merging as truth |
| Team/resource authority | project membership, consultant access, Initiative resources, staffing/capacity | separate access, accountability, assignment and capacity; current conflation is `BLOCKED` for backfill |
| Audit/history | Initiative history, status history, comments, handoff rows, audit service | immutable correlated audit projection with coverage statement; current completeness `EVIDENCE_MISSING` |

## 10. Cross-surface relation contract audit

| Relation | Active read/write evidence | Duplicate or missing behavior | Verdict |
|---|---|---|---|
| Initiative -> Inicjatywy list/preview/workspace | `InitiativesHub` and `InitiativeDocumentView` active | local list copies and multiple fetch fallbacks | `PRESENT_NOT_ACCEPTED`; version/readback parity `M` |
| Initiative -> Portfel | portfolio analysis/health/services active | portfolio metrics and status bucket adapters compete | `PRESENT_NOT_ACCEPTED`; formula/source version `M` |
| Initiative -> Plan | timeline, baselines, milestones and roadmap active | multiple planners and project/Initiative IDs | `PRESENT_NOT_ACCEPTED`; baseline authority `UNKNOWN` |
| Initiative -> Obciążenie | resources/capacity/staffing endpoints and views | demand, allocation and capacity models stitched client-side | `PRESENT_NOT_ACCEPTED`; period/unit identity `M` |
| Initiative -> Task | `initiativeId` queries and create from card | route/service authority and transfer-at-handoff semantics unresolved | `PRESENT_NOT_ACCEPTED` |
| Initiative -> Decision | related-object query and Decision creation | gate, generic and My Work projections duplicate lifecycle semantics | `PRESENT_NOT_ACCEPTED` |
| Task/Decision -> My Work | My Work task/decision routes and UI exist | unified actionable queue, correlation/readback and projection-only write proof `M` | `PRESENT_NOT_ACCEPTED` |
| Initiative -> Execution | Execution opens `InitiativeDocumentView`; handoff/status projection exists | same document view is reused, but accepted Handoff Pack/cardinality/readback are absent | `PRESENT_NOT_ACCEPTED`; target handoff `M` |
| Execution -> Results/Finance | KPI/benefit/report/budget projections exist | ownership and snapshot provenance inconsistent | `PRESENT_NOT_ACCEPTED` |

Opening `InitiativeDocumentView` inside Execution is navigation reuse, not proof that ownership transferred, an Execution plan exists or operational writes read back to the Initiative.

## 11. Concurrency, idempotency and outbox findings

- `InitiativeDocumentView` sections issue numerous independent PUT/POST/DELETE operations without a universal `expectedVersion` or `clientRequestId`; material multi-record changes can partially succeed. Target card publish is therefore `M` and current atomicity is `EVIDENCE_MISSING`.
- Candidate scan has service-level idempotency claims, but acceptance-to-Initiative duplicate prevention remains `EVIDENCE_MISSING`.
- `stageHandoffService` writes `initiative_handoffs` and audit best-effort/non-fatally. That is not the atomic accepted Handoff Pack required by document 12. Retry uniqueness and Execution readback are `EVIDENCE_MISSING`.
- A `notification_outbox` service/table and realDB tests exist for notifications. It marks some failed delivery terminal and is not evidence of a general domain-event transactional outbox for Initiative/Task/Decision commands.
- No confirmed aggregate version/precondition spans Initiative cards, Tasks, Decisions, gates and relations. A conflict UI/state exists in the target contract but runtime support is `EVIDENCE_MISSING`.
- Direct UI retry after network timeout can duplicate Task/Decision/relation creation unless the specific endpoint has a proven unique request key. Default classification: non-idempotent/`UNKNOWN`.

## 12. API evidence correction

The target queries and commands enumerated in document 12 section 9.3/9.4 are **proposed contracts**, not confirmed routes. In particular, `/initiatives/:id/workspace`, `/cards/:cardKey`, `/work`, target impact preview, unified `/my-work`, card draft/publish, request-input and accepted handoff commands remain `MISSING` unless a later implementation packet proves exact mounts, schemas, tenant enforcement, DB mutation and readback.

# 06. Runtime migration, reuse and tests

Status: **migration and acceptance contract; no authorization to mutate runtime**
Precondition: product IA and domain contracts in the sibling canon documents are approved. Existing code may accelerate delivery but must not dictate the design.

## 1. Current runtime baseline

- `/initiatives` mounts `InitiativesHub` and currently exposes portfolio plus analysis/observability/candidates/portfolio-health/goals-oriented surfaces.
- `/execution` mounts `ExecutionHub` and currently exposes five tabs: Dashboard, Summary, Rollout, Reporting and Management.
- PMO initiative routes, candidate routes, Execution routes, Rollout routes, report builder, benefits and RAID/governance are mounted server capabilities.
- Initiatives and Execution both query Initiative data and keep local projections; refresh/version stores are mainly invalidation signals, not one authoritative read model.
- Existing screenshots show populated and empty states but do not prove correct persistence, tenant isolation, event delivery or real database readback.

Exact deployed SHA, environment, database migration level and feature-flag matrix for this baseline are `EVIDENCE_MISSING`.

## 2. Reuse disposition

Disposition meanings:

- **CONNECT**: retain behavior and connect to the new contract after tests.
- **MOVE**: retain capability but place it under the target owning surface/context.
- **REWORK**: useful implementation shell with misleading semantics/data ownership.
- **RETIRE**: remove after consumers and compatibility window close.
- **INVESTIGATE**: presence is known; mounted behavior or backend contract is not proven.

### 2.1 Shared UI/layout contracts

| Artifact | Disposition | Why / condition |
|---|---|---|
| `src/components/standard/StandardTable.tsx` | CONNECT | reusable table mechanics; validate server sorting/filtering, bulk and accessibility |
| `src/components/standard/StandardPreview.tsx` and PreviewPane family | CONNECT | reusable preview structure; business fields/actions must come from the new contract |
| `src/components/shared/TableWithPreviewLayout.tsx` | CONNECT | supports table-preview-workspace pattern; geometry/responsive acceptance required |
| Module bars, filter chips, selection and row-actions primitives | CONNECT | interaction infrastructure only; do not copy obsolete IA labels |
| parallel client-local copies of Initiative lists/read models | RETIRE | replace with one query/cache contract and invalidation policy |

### 2.2 Initiatives

| Artifact/capability | Disposition | Target use / warning |
|---|---|---|
| `src/components/Initiatives/InitiativesHub.tsx` | REWORK | route shell and integration points reusable; current tab IA is not target authority |
| portfolio table/card lifecycle and Initiative preview/document view | CONNECT | main list -> preview -> full workspace; preserve stable ID and actions |
| `CandidatesTable.tsx` + candidate API hook/routes | CONNECT | source/candidate triage; acceptance idempotency remains `EVIDENCE_MISSING` |
| portfolio analysis/observability tables | MOVE/REWORK | projections into target scope, dependency, capacity and portfolio insight functions |
| `PortfolioHealthTable.tsx` and portfolio analysis service | REWORK | useful read model; formula/version and misleading zero/missing states must be fixed |
| timeline/Gantt/calendar implementations | CONNECT selectively | dependencies/order/roadmap; choose one canonical projection and retire duplicates |
| dependency, capacity, staffing, milestone, baseline and RAID PMO services | CONNECT after contract tests | backend capability exists; ownership, units and tenant tests required |
| Goals inside Initiatives | MOVE | intended outcome definition may be linked here; outcome actual/tracking belongs to Results |
| `InitiativeDrawer` and parallel legacy full views | RETIRE | duplicate detail/workspace behavior after consumer migration |
| legacy five-value lowercase Initiative status types | RETIRE | compatibility adapter only; never new write model |

### 2.3 Execution

| Artifact/capability | Disposition | Target use / warning |
|---|---|---|
| `src/components/Execution/ExecutionHub.tsx` | REWORK | route/data shell reusable; current five-tab IA does not define target surfaces |
| execution portfolio/table and detail | CONNECT | committed initiatives projection, preview and delivery workspace |
| task, decision, milestone and blocker capabilities | CONNECT | must share Initiative correlation and authoritative readback |
| `ExecutionManagementView.tsx` / `ExecutionManagementTable.tsx` | REWORK | lane/read-model mechanics useful; current aggregate counts need traceable drilldown |
| Dashboard manager cockpit | MOVE/REWORK | distribute actionable signals into target overview/management surfaces; remove ornamental metrics |
| Summary | RETIRE as separate IA | retain only verified risk/what-if/read-model components in their owning surfaces |
| Rollout KPI/risk/change/closure components and APIs | MOVE | execution plan/change/risk functions; KPI actuals cross to Results ownership |
| Reporting and report builder | CONNECT | execution outcome/progress reports; require reproducible `asOf` and source lineage |
| People/change/capacity components | CONNECT or INVESTIGATE | useful for people/time resources; mount/API/tenant evidence varies |
| budget/financial panels | MOVE/REWORK | show Finance-authoritative projection; do not create a second financial truth |
| orphan corrective-action/KPI dashboards with mismatched endpoints | RETIRE or INVESTIGATE | do not wire until endpoint and ownership contracts are proven |

## 3. Target runtime architecture

1. One Initiative command model and one tenant-scoped versioned query/cache contract.
2. Candidate remains a separate aggregate until an accepted registration command returns the Initiative ID.
3. Execution consumes a projection keyed by Initiative ID plus delivery-owned records; it does not fork lifecycle state.
4. Table, preview and full workspace use the same query version. Preview is not a second form/store.
5. Cross-context panels query Results/Finance projections with provenance and partial-failure metadata.
6. Writes go through commands; list/detail caches invalidate from confirmed readback or durable events.
7. Status compatibility is an anti-corruption layer: preserve raw 13-state value while deriving target dimensions. No dual independent lifecycle writes.

Feature-flag names and currently deployed flag values are `UNKNOWN`. A migration flag plan must be explicit per tenant/cohort and default safely to the compatibility path.

## 4. Migration plan

### Phase 0 — freeze evidence and ownership

- Record branch, exact SHA, dirty-file ownership, environment, DB schema/migration version, route mounts and flags.
- Snapshot representative tenant counts by status and relation, including null/invalid data.
- Approve sibling IA/domain docs and assign owners for formulas, security and data migration.
- No data write or UI cutover while any baseline item is `EVIDENCE_MISSING`.

### Phase 1 — contract and anti-corruption layer

- Publish schemas for IDs, status dimensions, commands, queries, errors and events.
- Add a pure, exhaustively tested 13-status -> target-dimensions projection while retaining raw status.
- Normalize legacy reads (`STEP3`, `STEP4`, `PILOT`, `FULL`, `COMPLETED`, lowercase values) only through the compatibility adapter.
- Reject new unknown status writes; quarantine rather than silently map migrated unknowns to DRAFT.

### Phase 2 — authoritative read model

- Establish one tenant-scoped Initiative query/cache used by list, preview, workspace and Execution projection.
- Add version, `asOf`, completeness and source metadata.
- Run shadow queries against old and new read models; reconcile by stable ID and field, not only counts.
- Do not introduce dual-write lifecycle state.

### Phase 3 — data profiling and backfill

- Profile all 13 statuses plus legacy/invalid values, missing owners, duplicate source lineage, orphan relations and cross-tenant references.
- Backfill target dimensions deterministically from the approved table in document 05; retain raw value and migration provenance.
- Backfill Initiative correlation into execution records where deterministic. Ambiguous matches become `BLOCKED`, never guessed.
- Reconcile estimates/baselines/actuals; preserve missing versus zero.
- Backfill in bounded, restartable batches with dry-run report, checkpoint and per-row error ledger.

Backfill volume, production duration, locking behavior and rollback storage are `UNKNOWN` until a realDB rehearsal.

### Phase 4 — target surfaces behind controlled flags

- Connect target Initiatives surfaces to the authoritative read model and commands.
- Connect target Execution surfaces to the Initiative projection and delivery-owned APIs.
- Implement table -> preview -> workspace continuity and deep links.
- Move Results- and Finance-owned functions without duplicating actuals.
- Compare old/new for selected tenants in shadow/canary mode.

### Phase 5 — command cutover

- Enable version/precondition and idempotency per command only after DB/integration proof.
- Switch lifecycle writes to the target command facade; compatibility controller remains adapter during the window.
- Verify audit/event/readback for every command before expanding cohort.
- Freeze legacy writers; instrument and fail visibly if any remain.

### Phase 6 — retire and simplify

- Remove old tabs, duplicate stores, drawers/full views, deprecated status enum and orphan panels only after route-consumer telemetry and rollback window close.
- Retain explicit read compatibility for historical raw statuses as required by retention policy.
- Update route/document registries and delete feature flags only after full acceptance.

## 5. Compatibility and rollback

### Compatibility

- Read old, write canonical: legacy values are mapped at the boundary and raw value retained.
- API responses may temporarily include `runtimeStatus` plus target dimensions; removal date/version is `UNKNOWN`.
- Existing deep links redirect by stable ID to the new workspace.
- Reports produced during the window record schema/formula version and `asOf`.
- No compatibility adapter may convert Candidate into Initiative without the acceptance command.

### Rollback triggers

- cross-tenant visibility or authorization regression;
- non-reconciling record/relationship counts or field values;
- command success without authoritative readback/audit;
- status transition or gate-policy divergence;
- event duplication/loss affecting consumers;
- material metric/formula divergence;
- error, latency or accessibility regression above approved threshold (`UNKNOWN`).

### Rollback mechanism

1. Stop cohort expansion and disable target write flag.
2. Keep new writes through the canonical command path if backward-compatible; otherwise pause writes rather than dual-write.
3. Restore old read surface using the preserved raw status and compatibility projection.
4. Replay only from a proven durable command/event ledger. Such durability is currently `EVIDENCE_MISSING`; without it, automatic replay is `BLOCKED`.
5. Reconcile affected IDs and audit events before reopening.

Destructive down-migrations are prohibited as the primary rollback. Exact RPO/RTO and rollback approver are `UNKNOWN`.

## 6. Test pyramid

| Layer | Required coverage | Acceptance evidence |
|---|---|---|
| Pure unit | all 13 mappings; every allowed/forbidden transition; legacy mapping; formulas, null/zero/stale; permission matrix | deterministic tests with boundary/property cases |
| Component | every target table/preview/workspace; loading/empty/partial/error; keyboard/screen-reader; bulk and row actions | mounted tests, not source-anchor assertions only |
| API contract | request/response schemas, typed errors, pagination/filter/sort, version/precondition, idempotent retry | consumer/provider contract suite |
| Service + DB integration | tenant scoping, FK/unique/check constraints, transition transaction, status history, audit/outbox, command readback | real PostgreSQL, migrations applied |
| Cross-context integration | Initiative -> Execution -> Results/Finance projections; partial source failures | stable ID and provenance reconciliation |
| E2E runtime | golden flows below in target IA, deep links, refresh/session restart | browser evidence against real backend/DB |
| Non-functional | authorization abuse, tenant isolation, concurrency, performance, accessibility, responsive and theme | trace/report with approved thresholds |
| Deployment | exact SHA, migrations, flags, observability, rollback rehearsal | environment manifest plus evidence links |

Mocks are useful below integration level but cannot prove persistence, tenant isolation or mounted runtime behavior. Source-anchor tests prove wiring text only and are not UI acceptance.

## 7. Golden flows

### GF-1 Candidate registration

Discover/scan -> triage candidate -> accept -> receive stable Initiative ID -> refresh -> Initiative appears once with source lineage -> retry same command does not duplicate.

Idempotent retry evidence: `EVIDENCE_MISSING`.

### GF-2 Governance lifecycle

Create/edit Initiative -> submit -> role reviews -> gate evidence -> approved transition -> refresh/list/preview/workspace agree -> status history and audit identify actor and version. Negative cases cover wrong role, missing evidence, invalid transition and other tenant.

### GF-3 Planning, scope and dependency

Define in/out scope -> add dependency/order -> size workload -> allocate capacity -> schedule -> roadmap and capacity projections reconcile. Negative cases cover cycles, missing units, over-allocation and cross-tenant dependency. Cycle constraint evidence: `EVIDENCE_MISSING`.

### GF-4 Handoff to Execution

Approved/scheduled Initiative -> validated handoff -> Execution projection opens with same Initiative ID and owners -> tasks/milestones/forecast persist -> duplicate handoff does not fork an execution aggregate.

Cardinality and handoff idempotency: `UNKNOWN` / `EVIDENCE_MISSING`.

### GF-5 Delivery intervention

Update task/progress -> create decision/risk/blocker -> health projection changes with traceable inputs -> resolve/replan -> timeline, capacity and management queue reconcile after refresh and session restart.

### GF-6 Delivery to outcome

Complete delivery -> DONE gate rejects pending decisions -> enter TRACKING -> Results observes KPI/benefit -> Finance provides money actual -> reports show authoritative sources, `asOf`, formula version and missing data honestly.

### GF-7 Reporting reproducibility

Generate an Execution report -> reopen by ID -> same snapshot/version reproduces sections and sources -> later data is distinguishable from the snapshot -> unauthorized tenant cannot access or export it.

### GF-8 Concurrency and retry

Two actors edit the same aggregate -> stale command is rejected with a machine-readable conflict -> safe retry uses the command ID -> exactly one state change, audit entry and downstream event. Current version/idempotency support: `EVIDENCE_MISSING`.

## 8. realDB and runtime evidence packet

A release candidate is not accepted until the packet contains:

1. exact commit SHA, build/deploy ID, environment, tenant IDs (redacted), DB engine/schema/migration versions and flag values;
2. migration dry-run and applied logs plus before/after status/relation reconciliation;
3. real PostgreSQL evidence for every golden flow, including command response and independent readback after refresh/relogin;
4. negative tenant-isolation and authorization proof for parent and nested resources, reports and exports;
5. audit/event evidence correlated by command/aggregate ID; durable delivery proof remains `EVIDENCE_MISSING` today;
6. screenshots/video or trace for target table, preview and workspace in populated, empty, partial and error states;
7. desktop/responsive, light/dark, keyboard, focus and screen-reader checks to agreed standard;
8. performance/error telemetry with portfolio-scale data; scale and thresholds are `UNKNOWN`;
9. rollback rehearsal with reconciled affected IDs and measured RPO/RTO;
10. named product, architecture, security/data and QA acceptance, with unresolved states preserved literally.

Green unit/component tests, mocks, generated screenshots, a deployed URL or self-attestation alone do not establish runtime/realDB acceptance.

## 9. Implementation blockers and unknowns

- `BLOCKED`: target IA and dimensional state ADR must be approved before UI/data cutover.
- `BLOCKED`: cancellation authorization and AI gate fail-open policy are not acceptable for hard governance.
- `EVIDENCE_MISSING`: durable outbox, event deduplication/replay and command idempotency.
- `EVIDENCE_MISSING`: concurrency/version contract across all mutations.
- `UNKNOWN`: Initiative-to-ExecutionPlan cardinality and project-ID compatibility.
- `UNKNOWN`: authoritative metric formulas, thresholds, units and owners.
- `UNKNOWN`: data volume, data defects, backfill duration, performance SLO, RPO/RTO and flag matrix.
- `EVIDENCE_MISSING`: exact-SHA staged runtime and realDB evidence for the proposed target surfaces.

## 10. Canonical workspace convergence: `InitiativeDocumentView` versus `InitiativeFullView`

| Path | Mount/consumer evidence | Technical disposition | Exit criterion |
|---|---|---|---|
| `InitiativeDocumentView` | active in Initiatives, Execution, Assessment, Discovery and Benefits | **CONNECT/REWORK as the only target workspace shell** | 26-card registry adapter, common versioned query, capabilities, save/conflict/readback and acceptance packet |
| `InitiativeFullView` | deprecated in file/index comments but still lazy-mounted by `MyWorkHub` | **RETIRE after migration** | My Work deep link opens the canonical document view; feature parity and tests; zero import/runtime telemetry |
| compact/preview panels | active entry points | **CONNECT as projections only** | same version/capabilities as workspace and deterministic deep link |

`InitiativeDocumentView` is not accepted merely because it is mounted widely. It is a very large component with parallel registry/N-mode render paths, broad client-side fan-out, fallback APIs and direct mutations. Migration should first extract a workspace query/command adapter and card registry; a visual rewrite before that would preserve the inconsistency.

Required sequence:

1. enumerate every consumer and deep-link contract for both full views;
2. introduce one canonical `open Initiative(id, cardKey?)` navigation contract;
3. make My Work use `InitiativeDocumentView` behind a controlled flag;
4. compare permission, action, loading/error and relation parity;
5. remove the last direct import of `InitiativeFullView` only after runtime telemetry and rollback window.

## 11. Card-by-card implementation work packages

The 26 business cards are grouped by technical treatment, not by desired visual order.

### 11.1 Connect and normalize existing implementations

- Summary/Scope, Financial Analysis, Financial Impact, Stakeholders, Risk/RAID, Timeline, Tasks, Decisions, Gates, KPI, Attachments and Comments/History have active components and some server/storage support.
- Work: map technical registry keys to target `cardKey`; remove duplicate inline/N-mode writes; declare truth owner; add version/capability/freshness envelope; add independent command readback.
- Acceptance: one populated, empty, partial, stale, forbidden and conflict scenario per card against realDB.

### 11.2 Merge/split without duplicating records

- merge `Overview + ProblemDefinition + Scope` presentation into target Summary/Scope while retaining explicit governed fields;
- split `TasksMilestonesSection` into Task and Milestone cards over the same canonical records;
- merge `TeamSection + InitiativeTeamSection` into People/Team while separating access membership from accountable assignment;
- merge `CompetencyRequirements + SkillsGap` into Capabilities/Training with explicit external truth owner;
- merge `Attachments + LinkedItems` presentation while retaining typed relations and artifact identity;
- unify comments, Initiative history, status history and audit as one timeline projection without merging/deleting source records.

Every merge/split needs ID-preserving projection tests. UI consolidation is not permission to backfill by title or copy objects.

### 11.3 Build missing first-class cards

Strategic Fit, Success Criteria, Outcomes/Benefits, Options, Technical Specification, Change/Adoption and Communication/Engagement are not first-class governed cards today. Reuse linked goal, milestone, KPI, Decision, artifact, stakeholder, change and capability services only after the target ownership contract is implemented. Do not create opaque JSON card payloads to simulate completeness.

### 11.4 Reconcile registry/templates

1. create a single versioned 26-card business registry;
2. map each card to adapters for existing component keys and storage owners;
3. reconcile DB `initiative_section_types`, template visibility/order and frontend registry/N-mode IDs;
4. seed only after a migration dry run shows existing template impact;
5. preserve unknown keys in quarantine with audit, never drop them silently;
6. make template change return an impact preview and require explicit publish.

Registry authority and unknown-key policy are currently `BLOCKED` pending an ADR.

## 12. Integration closure packages

| Package | Scope | Current gap | Required proof |
|---|---|---|---|
| `REL-PORTFOLIO` | Initiative -> Inicjatywy/Portfel | duplicated caches, metrics and status projections | stable-ID/version reconciliation; formula/source version; drill-through |
| `REL-PLAN` | Initiative -> milestones/timeline/baseline/dependencies | multiple planners and dependency stores | approved baseline command, cycle/impact checks, reload parity |
| `REL-WORKLOAD` | Initiative -> demand/assignment/capacity | project access, resource rows and capacity conflated | person/role/period/unit identity; allocation transaction; overload recompute |
| `REL-TASK` | Initiative/Execution -> Task | route authority and lifecycle normalization unresolved | one Task ID/service; create/retry/OCC; My Work and Execution readback |
| `REL-DECISION` | Initiative/Task/Gate/Execution -> Decision | competing routes/tables/projections | one Decision ID/lifecycle; evidence snapshot; publish/follow-up idempotency |
| `REL-MYWORK` | Task/Decision/request -> user queue | no proven unified projection/correlation | projection-only commands, lag state, snooze isolation, deep links |
| `REL-HANDOFF` | Initiative -> Execution | best-effort handoff row, no accepted pack transaction | snapshot/version, conditional acceptance, unique retry key, same IDs, readback |
| `REL-OUTCOME` | Execution -> Results/Finance | duplicate KPI/budget/benefit truth | authoritative references, `asOf`, currency/formula version, reconciliation |

Each package remains `NOT_ACCEPTED` until route mount, service behavior, DB constraints, tenant isolation and runtime readback are all evidenced. Route presence alone closes none of them.

## 13. Additional tests required by documents 11/12

### 13.1 Registry/template contract tests

- exactly 26 stable business `cardKey` values; aliases resolve once and never render duplicate records;
- every technical registry key, DB section type and N-mode ID maps to a card, utility or explicit quarantined legacy key;
- all six template profiles change applicability/order/requirements without schema mutation or content deletion;
- unknown DB/component key produces visible `UNKNOWN`/unsupported state, not silent omission;
- template change preview lists newly required cards, preserved data, waivers and gate impact.

### 13.2 Capability and gate tests

- server capability matrix for view/edit/request/decide/assign/publish per card and lifecycle;
- missing capability response is fail-closed read-only in workspace, preview, My Work and Execution;
- gate evaluates policy version, card states, Task/Decision/Risk findings, evidence freshness and waiver authority;
- a direct client call cannot bypass the same gate enforced by UI;
- cancellation and AI-check error paths are negative tests, not ignored branches.

### 13.3 Concurrency/idempotency tests

- stale card update returns current version and preserves both drafts for reconciliation;
- network-timeout retry of Task, Decision, relation and handoff creates exactly one record;
- Decision publication materializes follow-up objects once per `(decisionId, version, purpose)`;
- material change across Initiative plus relations is atomic or produces no published change;
- outbox/audit event is in the same transaction as accepted mutation and consumer replay is deduplicated;
- notification outbox tests do not count as domain-outbox proof.

### 13.4 Cross-projection golden thread

For one seeded tenant and one isolation tenant, execute:

`Initiative card finding -> Task -> My Work -> Decision -> gate -> accepted handoff -> Execution -> progress/blocker -> delivered -> KPI/Finance observation -> report`.

At every arrow record canonical ID, organization, aggregate version, correlation ID, command response, independent query response after reload, and audit/event evidence. Then prove the isolation tenant receives tenant-scoped `404/403` and no count/metadata leak.

### 13.5 Legacy retirement tests

- all former `InitiativeFullView` entry points deep-link to the canonical card and preserve back navigation;
- no active route imports the retired view, deprecated five-state type or stub Task router;
- no unknown template/section data is lost during migration or rollback;
- old reports and audit history remain readable with their original schema/formula version.

## 14. Revised migration gates

Add these hard gates to phases 0–6:

| Gate | Required result |
|---|---|
| `G-REGISTRY` | one approved 26-card registry and total mapping of runtime/DB/template keys |
| `G-AUTHORITY` | mounted canonical Task, Decision, dependency, resource and card services identified; duplicate/stub paths fenced |
| `G-OCC` | expected-version behavior proven for every material aggregate |
| `G-IDEMPOTENCY` | unique request keys and retry tests for create/link/publish/handoff |
| `G-OUTBOX` | domain outbox atomicity/replay/dedup proven; notification-only outbox is insufficient |
| `G-HANDOFF` | accepted Handoff Pack transaction and Execution readback with stable IDs |
| `G-26-RUNTIME` | all 26 cards pass capability, data-state, realDB reload and accessibility checks |
| `G-RETIRE` | zero active consumers/telemetry for legacy view, duplicate registries and shadow stores |

Current status of all eight gates: `EVIDENCE_MISSING`; `G-REGISTRY`, `G-AUTHORITY`, `G-OCC`, `G-IDEMPOTENCY`, `G-OUTBOX` and `G-HANDOFF` are release `BLOCKED` until proven.

---
doc_id: initiatives-execution-implementation-sequence-dod
truth_type: delivery_contract
status: canonical
owner: engineering-product
version: 1.0
last_reviewed: 2026-08-09
---

# Implementation sequence and Definition of Done

## 1. Delivery principle

Build by end-to-end business flow, not by empty tabs or isolated frontend panels. Every slice includes:

`schema/contract -> query -> UI -> command -> authorization -> audit -> read-back -> degraded states -> tests -> runtime evidence`.

A slice without a real command/read-back path may be delivered only as explicitly labelled read-only functionality.

## 2. Required pre-code gate

Before coding:

1. establish baseline SHA and dirty-worktree ownership;
2. inventory target files and allocate ownership;
3. resolve schema/authority open decisions in file 09;
4. freeze business-to-runtime status mapping and migration policy;
5. confirm canonical Initiative identity across Initiatives and Execution;
6. confirm Task, Decision, Finance, Results and resource sources of truth;
7. confirm feature-flag and rollback strategy;
8. define realDB tenant/test fixtures without relying on demo fallbacks.

## 3. Vertical implementation slices

### Execution order and dependency rule

The order below is binding unless a documented dependency review proves that a later slice is isolated and read-only. Implementation starts with one `Lite` Initiative and expands the same runtime objects to `Standard` and `Complex`; it does not build nine empty Menu 2 shells in parallel.

Each slice starts only after:

- exact file allowlist and owner are recorded;
- current route/component/schema reuse disposition is confirmed from file 06;
- contract tests are written against the target command/query, including failure and retry;
- feature flag and rollback behavior are named;
- realDB fixture and acceptance actor roles are available.

Each slice ends with a review packet: exact SHA, migrations, API evidence, UI evidence, audit/outbox/read-back, negative permissions, responsive/a11y and remaining literal gaps.

### Slice 0 — shared foundation

- business lifecycle projection and compatibility mapping;
- gate/readiness/disposition/health/effectiveness types;
- capability-driven command contract;
- shared table/preview/workbench descriptors;
- source/as-of/confidence primitives;
- audit, idempotency and read-back envelope;
- explicit degraded-state contract.

Exit: one representative Initiative can be read with all independent state dimensions and no old/new vocabulary mixing.

Implementation package inside Slice 0:

1. freeze one canonical 26-card registry and adapters from all legacy registries/templates;
2. implement organization -> project -> Initiative governance-profile resolution and effective-policy snapshot;
3. establish one workspace route based on `InitiativeDocumentView` and migration adapter for remaining `InitiativeFullView` consumers;
4. establish optimistic concurrency, client request ID, idempotency and durable domain outbox;
5. publish capability and degraded-state envelopes before enabling any material write.

### Slice 1 — Source to Registered Initiative

- source envelope;
- Proposal validation decision;
- idempotent Register/Merge/Extend/Return/Defer/Dismiss;
- Inicjatywy registry + preview + Initiative workspace entry;
- immutable lineage and duplicate protection.

Exit: golden flow A in file 08 passes on realDB.

### Slice 2 — Definition, analysis and decision readiness

- Initiative card sections;
- required analysis profile;
- Tasks/Decisions for missing evidence;
- readiness evaluation;
- Decision Snapshot and Request Decision;
- approve/return/defer/reject/merge with authority.

Exit: `READY_FOR_DECISION` cannot be reached without governed evidence and read-back.

Delivery is incremental but cumulative: first the shell and core Definition cards, then remaining applicable cards by catalog group. A card is not counted as delivered because a component renders; it must pass source ownership, capability, save/conflict, relation, gate-finding, realDB reload and accessibility acceptance.

### Slice 3 — Portfolio decision

- Portfolio Scenario identity/version;
- scenario membership and comparison;
- coverage/overlap/double-count signals;
- score decomposition, rank and override rationale;
- Portfolio Decision -> Approved Backlog.

Exit: scenario diff and immutable decision can be reconstructed from persisted sources.

### Slice 4 — Plan and Capacity loop

- Plan Scenario and Planned Initiative Window;
- dependencies and tentative windows;
- Capacity Scenario with known/estimated/unknown/unconfirmed;
- low/base/high ranges and same-window demand/supply;
- correction loop and Schedule Decision;
- no direct baseline write from drag.

Exit: `SCHEDULED` requires approved capacity/schedule evidence and retains prior scenario versions.

### Slice 5 — Execution handoff and Realizacje

- idempotent Handoff Pack;
- accept/accept-with-gaps/reject;
- same identity/read-back;
- Realizacje registry, preview and Execution Case;
- baseline/current/actual/forecast separation.

Exit: retry creates no duplicate Execution Case and both modules show coherent truth.

### Slice 6 — Praca

- canonical Task and Decision projections;
- type-aware queue, preview and workspace;
- safe actions, SLA, blocked-by and evidence/DoD;
- My Work projection without copies;
- parent Execution read-back.

Exit: task completion and decision follow-up propagate to all projections after confirmed write.

### Slice 7 — Zasoby

- availability, assignment, acceptance, remaining estimate and time-window units;
- constraint register and capacity calendar;
- people/time/cost projection;
- simulation, impact preview and governed allocation write;
- privacy and aggregation.

Exit: full function remains disabled/partial until its minimum data model and evidence are real.

### Slice 8 — Sterowanie

- signal normalization/deduplication;
- Intervention Case;
- source, root-cause hypothesis, options and impact;
- governed canonical actions;
- read-back and verification/effectiveness.

Exit: every critical signal has an accountable action, conscious dismissal/acceptance or explicit unknown.

### Slice 9 — Raporty

- Report Definition and persisted Report Run;
- source binding/version/freshness/completeness/confidence;
- draft, validation, freeze, approval, export/share/distribution;
- drill-through and follow-up creation.

Exit: a published run is immutable and reproducible; refreshed data creates a new run/version.

### Slice 10 — Delivery and effectiveness closure

- Delivery Acceptance;
- Results/Benefits handoff;
- effectiveness outcome read-back;
- closure decision and archive policy;
- lessons learned and historical views.

Exit: Delivered is visibly distinct from benefit achieved, and closure is auditable.

## 4. Definition of Done per function

Every function is Done only if:

- the correct Menu 2 entry is mounted and no superseded entry competes with it;
- the primary registry uses the shared table canon;
- preview and workspace navigation preserve context;
- fields, columns, filters, actions and states match descriptor 04;
- commands are backend-authorized and server-enforced;
- optimistic UI never outruns backend truth;
- idempotency, audit and read-back work;
- empty/loading/error/partial/stale/unknown/conflict/permission states are tested;
- tenant and project isolation are tested;
- keyboard, focus, contrast and accessible labels pass;
- AI output is labelled as proposal with source/assumptions/confidence;
- no shadow source of truth was introduced;
- unit, contract, integration, component and E2E tests pass;
- realDB runtime evidence exists for a Lite, Standard and Complex case where applicable;
- acceptance evidence is tied to exact SHA/environment/tenant.

## 5. Release gates

1. `DOC_READY` — package complete; blocking decisions resolved.
2. `CONTRACT_READY` — schema/API/events and compatibility approved.
3. `SLICE_READY` — owner, allowlist, baseline and test fixtures confirmed.
4. `CODE_COMPLETE` — implementation and local tests, not acceptance.
5. `INTEGRATION_VERIFIED` — shared runtime and realDB read-back.
6. `UX_VERIFIED` — desktop/responsive/a11y and degraded states.
7. `OWNER_ACCEPTED` — business golden flows accepted.
8. `RELEASE_READY` — exact deployed SHA, migrations, observability and rollback proven.

No lower gate implies a higher one.

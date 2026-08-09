# Case Workspace — Legacy Migration and Delivery Plan

> Status: `FROZEN TARGET CONTRACT`
> Date: 2026-08-09
> Owner: Product + Engineering
> Depends on: documents 04–06 in this package

## 1. Migration doctrine and owner decisions

The migration is incremental. There is no big-bang rewrite and no permanent
second Consultify.

Frozen owner decisions:

- the current heavy builder remains only a temporary compatibility shell and
  component donor; a new lightweight Expert View is built over the canonical
  graph rather than renaming the legacy product surface;
- new execution converges on Case-bound V8 Run/NodeRun;
- historical AgentPlans remain readable and auditable;
- every authorized user may create private Play drafts; shared publication
  requires an authorized publisher or review, while Case-specific plans remain
  available independently;
- My Work receives the canonical Case/Run surface before Chat is migrated;
- legacy runtime removal happens only after parity and evidence, not on a date
  or because a replacement UI exists.

## 2. Current-to-target mapping

| Current object/path | Target role | Migration action |
| --- | --- | --- |
| `AgentHubShell` | Case/process hub | KEEP/EXTEND |
| `AgentPlanCanvas` | Simple Graph View | ADAPT |
| `AgentWorkshopPalette` | capability palette | KEEP UI, replace data source |
| `ai_agent_plans` | legacy definition/run record | FREEZE/ADAPT |
| `ai_agent_plan_steps` | legacy linear nodes/status | MAP/PROJECT |
| `wait_until` | `TIMER_WAIT` | MIGRATE |
| `requires_approval` | approval node/policy | MIGRATE |
| legacy scheduler | compatibility dispatch | DEPRECATE after waits parity |
| `ai_actions` | legacy proposal source | ADAPT to canonical decisions |
| `ai_run_ledger` | Action Center compatibility projection | PROJECT from V8 |
| `teresa_proposals` | legacy Teresa handoff source | ADAPT, then historical read |
| `v8_execution_runs` | canonical Run foundation | EXTEND |
| `v8_action_proposals` | canonical proposal foundation | EXTEND |
| `v8_run_state_transitions` | runtime audit foundation | EXTEND with events/NodeRuns |
| `v8_chat_execution_handoffs` | conversation bridge | EXTEND with Case |
| `v8_chat_action_proposals` | chat rendering projection | KEEP as projection |
| My Work Process Flow React components | Expert Graph View primitives | EXTRACT/ADAPT |

## 3. Compatibility boundaries

### 3.1 Legacy read adapter

Historical AgentPlans are exposed as a synthetic linear graph and history read
model. Unknown tools, missing project scope or invalid inputs remain explicit;
backfill never guesses.

### 3.2 Legacy execute adapter

Only validated linear plans may execute through the adapter:

1. create/reuse the Case;
2. freeze an imported `CasePlanVersion` and digest;
3. create one authoritative V8 Run and NodeRuns;
4. map nodes through `LegacyToolAdapter`;
5. project V8 state back to legacy screens;
6. store `executionEngine = V8_LEGACY_ADAPTER`.

No new branching, wait, proposal or capability feature is added to the legacy
executor. Unsupported plans remain legacy-read-only or require an explicit
migration review.

### 3.3 Proposal adapters

Legacy `ai_actions` and `teresa_proposals` receive namespaced adapter identities
until new proposals are born directly in the canonical proposal service. All UI
decisions go through one version-bound decision API. Mirroring is replaced by
transactional outbox projections and reconciliation.

## 4. Safe delivery increments

### Increment 0 — Baseline and canonical decisions

Scope:

- inventory tables, routes, write paths and active executions;
- establish authoritative owners;
- freeze glossary, state machines and ADRs;
- record exact baseline SHA/worktree/schema.

DoD:

- every object is classified `KEEP | EXTEND | ADAPT | DEPRECATE | CREATE`;
- every mutation has one target owner;
- unresolved collisions are `EVIDENCE_MISSING`, not assumed.

Evidence:

- Git state and exact SHA;
- real schema/migration inventory;
- route/service/write-path matrix;
- active run count and migration eligibility report;
- accepted ADR/decision register.

### Increment 1 — Case Core and My Work shell

Scope:

- light Case and Case Workspace;
- informational/direct/durable routing;
- durable Teresa request creates Case;
- no execution replacement yet.

DoD/evidence:

- informational question: zero Case/Run rows;
- direct module operation: canonical object, zero Case;
- durable Teresa request: exactly one Case under replay;
- restart/readback of the same Case;
- My Work deep link and tenant/project negative tests.

### Increment 2 — PlanVersion and dual graph views

Scope:

- canonical graph/version/digest;
- Simple and Expert views;
- legacy linear import/export;
- publish validation and optimistic concurrency.

DoD/evidence:

- both views expose identical semantic graph IDs/digest;
- Expert branch survives Simple without flattening;
- stale edit returns `409`;
- published version is immutable;
- layout-only update preserves semantic digest;
- classic five-step and DRD round-trip parity reports.

### Increment 3 — Capability Registry and shared commands

Scope:

- registry and Internal/Legacy adapters;
- first production capabilities for the fast Finance/KPI Golden Case;
- direct UI and Teresa use the same command handler.

DoD/evidence:

- active palette entries have adapter, schema, policy and health;
- human/agent traces converge on one handler;
- identical validation and authorization;
- idempotent replay yields one module object;
- canonical realDB readback and artifact reference.

### Increment 4 — V8 Run/NodeRun linear runtime

Scope:

- extend V8 Run with Case and plan version;
- NodeRuns, attempts, leases and checkpoints;
- AgentPlan adapter for eligible linear plans.

DoD/evidence:

- exactly one authoritative Run;
- one NodeRun per execution node;
- worker kill/restart resumes correctly;
- duplicate dispatch has one effect;
- retry/attempt history is durable;
- legacy UI, V8 API and DB statuses agree;
- no unsupported plan is silently converted.

### Increment 5 — Durable waits and My Work tasks

Scope:

- timer, human and external waits;
- indexed scheduler, event inbox and My Work task projection;
- expiry, escalation and timeout edges.

DoD/evidence:

- simulated multi-day timer survives process restart;
- two schedulers claim once;
- human task persists across logout/restart;
- callback before/after dispatch completion produces one satisfaction;
- replayed/wrong-tenant event does not resume;
- timeout follows the declared edge;
- timers do not masquerade as approvals.

### Increment 6 — Canonical proposals in My Work

Scope:

- version/digest-bound proposals and decisions;
- one `WorkProposalCard` and server-sourced store;
- partial approval and request changes;
- policy-based separation of approval and execute.

DoD/evidence:

- approval records exact payload/version/actor/policy;
- stale or mutated payload returns `409` and zero effect;
- reject/expiry are durable;
- double approval/execute yields one action;
- loss of membership blocks execution;
- My Work reload shows authoritative state.

### Increment 7 — Chat integration and conversational confirmation

Scope:

- atomic conversation-to-durable-work command;
- Case/plan/progress/proposal/result cards;
- exact conversational Case confirmation and A0/A1 decisions through the same
  policy-aware command handler; A2 requires an explicit control or already
  published plan policy, and A3/A4 remain explicit-control;
- remove local confirmation as approval authority.

DoD/evidence:

- durable request creates one Case/Run despite request replay;
- explicit controls and allowed conversational confirmation create the same
  decision envelope, while channel policy prevents conversational A3/A4;
- two pending proposals plus `yes` asks for clarification;
- historical transcript reload resolves current server state;
- Chat and My Work show the same proposal/Run identifiers;
- no optimistic message is mistaken for execution truth.

### Increment 8 — Branching, parallelism, subflows and replan

DoD/evidence:

- exclusive gateway selects exactly one branch;
- parallel join satisfies declared `ALL | ANY | N_OF_M` semantics;
- retry/error/timeout/compensation edges are deterministic;
- replan creates a new version/diff and preserves completed history;
- an existing Run remains bound to its original version;
- subflow tenancy, binding and recursion limits fail closed.

### Increment 9 — Artifacts, evidence, deliverables and outcomes

Scope:

- late binding and pinned evidence;
- shared facts model;
- deliverable generation, validation and acceptance;
- outcomes and sustainability.

DoD/evidence:

- one module artifact plus one Case link, never a copy;
- source revision/digest remains reproducible after later edits;
- Word and PowerPoint derive from one accepted facts digest;
- parser, native-open and visual render evidence passes;
- manifest contains checksums, lineage, provenance and rights;
- Case cannot close before required deliverable acceptance;
- sustainability remains `PARTIAL` until a real second measurement.

### Increment 10 — Golden Cases and production candidate

Required flows:

- Golden B: direct Finance without Case -> late binding -> Teresa KPI and
  recommendation -> approval -> deliverable -> closeout;
- Golden A: mandate -> Interview -> Assessment/DRD -> Finance/KPI ->
  Recommendation -> Decision -> Initiative -> Execution -> Results -> Benefits
  -> Sustainability -> DOCX/PPTX.

DoD/evidence:

- one exact deployed SHA and one canonical database;
- fresh migration replay plus idempotent rerun;
- API, browser, realDB, restart/replay and artifact evidence match the SHA;
- cross-tenant/project and revoked-membership suites pass;
- operator trace reconstructs the full causal chain;
- every gate is literally `PASS`, `PARTIAL`, `BLOCKED`, `FAILED`, `EVIDENCE_MISSING` or `N/A_WITH_CODEX_APPROVAL`. The N/A state is valid only for literal canon out-of-scope or an immutable exact Codex approval reference.

## 5. Legacy executor retirement gate

The legacy executor may be disabled only when:

- all production legacy tools have capability mappings or explicit exclusions;
- scheduling, approvals, retries, waits, cancel and readback have parity;
- all active legacy runs are completed, cancelled or deliberately drained;
- historical reads remain available;
- Action Center/My Work projections reconcile automatically;
- security, tenancy, restart and idempotency suites pass;
- runtime evidence exists on the exact release candidate;
- rollback/feature-flag plan is tested.

Removal is not authorized by a new UI, green unit tests, generated files or a
candidate handoff alone.

## 6. Test strategy

- domain unit tests: state machines, graph, gateways, policy and waits;
- schema/contract tests: commands, events, capabilities and adapters;
- real database tests: tenant isolation, concurrency, outbox and idempotency;
- integration tests: Chat/Case/Run/module readback and projection recovery;
- UI tests: Simple/Expert parity, stale states, accessibility and deep links;
- resilience tests: worker/process death, duplicate callbacks and reauth;
- security tests: cross-tenant, forged IDs, revoked mandate and data leakage;
- artifact tests: parser, checksum, native edit, rendering and facts parity;
- Golden Case E2E tests on real production-shaped data.

Mocks prove local contracts only. They do not prove runtime, realDB, module
ownership, persisted readback, deployment or artifact quality.

## 7. Required implementation documentation

Before code for an increment starts, its packet must contain:

- accepted scope and non-goals;
- owner/allowlist and dependency map;
- schema and migration design;
- command/API/event contracts;
- state transitions and failure taxonomy;
- security/tenancy cases;
- rollout/feature flag/rollback plan;
- tests and exact acceptance evidence;
- canonical SHA and environment fields;
- explicit unknowns and blockers.

Recommended package map:

```text
docs/product/case-workspace/
  04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md
  05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md
  06_SECURITY_EVENTS_OBSERVABILITY.md
  07_LEGACY_MIGRATION_AND_DELIVERY_PLAN.md
  contracts/
    case.schema.json
    canonical-graph.schema.json
    capability.schema.json
    command-envelope.schema.json
    event-envelope.schema.json
    approval-decision.schema.json
    artifact-ref.schema.json
    wait-subscription.schema.json
  acceptance/
    INCREMENT_ACCEPTANCE_MATRIX.csv
    CAPABILITY_REGISTRY_COVERAGE.csv
    LEGACY_PARITY_LEDGER.csv
    SECURITY_NEGATIVE_TEST_MATRIX.csv
    GOLDEN_CASE_EVIDENCE_LEDGER.csv
```

These additional contract/ledger files are prescribed, not created by this
documentation write scope.

## 8. Terminal convergence gate

Convergence is complete only when durable Teresa work always has a Case, direct
module work remains independent, My Work is canonical, Chat has no separate
runtime, Simple and Expert share one graph, V8 is the sole Run/NodeRun truth,
approvals are version-bound, waits survive days and restarts, module artifacts
are linked rather than copied, and the legacy executor is only historical.

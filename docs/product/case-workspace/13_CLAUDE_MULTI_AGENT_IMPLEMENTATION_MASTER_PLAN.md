# Case Workspace — Claude multi-agent implementation master plan

> Status: EXECUTION HANDOFF / NOT STARTED
> Date: 2026-08-09
> Architecture, integration and acceptance owner: Codex
> Product decision owner: Piotr Wisniewski
> Executor: Claude coordinator plus bounded workers
> Authority: case-workspace 00–12 plus document 14 acceptance contract
> Scope: verified baseline through one candidate ready for independent Codex review

## 1. Mission and terminal boundary

Implement the approved Case Workspace incrementally over existing Consultify
modules and the V8 runtime. Preserve two equal modes: direct module work without
Teresa or Case, and durable Teresa-led work with exactly one Case after explicit
confirmation.

The implementation converges on one canonical Case, published CasePlanVersion,
V8 Run, NodeRun, event, proposal/decision and artifact-reference truth. My Work
receives the canonical surface before Chat.

Claude's only positive terminal statement is:

    READY_FOR_CODEX_REVIEW — CANDIDATE ONLY

It means reviewable candidate, not accepted, complete, merged, deployed,
released or FINAL ACCEPTANCE PASS. Codex retains architecture, integration,
release and acceptance ownership.

## 2. Non-negotiable invariants

1. Informational Chat creates zero Cases and Runs.
2. Direct module work remains valid without caseId.
3. Durable Teresa work creates/reuses exactly one Case only after confirmation
   of an exact, versioned work-order digest.
4. Native modules own artifacts and mutations. Case stores typed links and
   pinned revisions/digests, never copied business truth.
5. Simple, Expert and List edit one semantic graph.
6. Published plan versions are immutable. Every Run binds one published
   CasePlanVersion and semantic digest.
7. Runtime state belongs to V8 Run, NodeRun, attempt and wait, not graph nodes.
8. Human UI and Teresa call the same owning application commands.
9. Approval binds proposal ID/version/digest, target version, actor, policy and
   authority. Approval and execution are separate facts.
10. Conversational confirmation is limited to exact Chat-to-Case and A0/A1.
    A2 execution requires an explicit control or an already published plan
    policy. A3/A4 and formal/material actions require explicit controls and
    configured assurance.
11. Human, timer, event and callback waits survive browser, worker and process
    restart. Timer state is not approval state.
12. Domain facts use transactional outbox; callbacks use authenticated,
    idempotent inbox handling.
13. Tenant, project, ACL, membership, delegation and execute-as authority are
    revalidated on execution and after waits.
14. PARTIAL, UNKNOWN, BLOCKED and EVIDENCE_MISSING remain literal.
15. Chat and My Work never create parallel plan, proposal, approval or runtime
    truth.
16. The heavy builder is only a compatibility shell/component donor.

A conflicting implementation is migration evidence, not authority. Stop and
escalate rather than create another table, store, adapter or lifecycle.

## 3. Authority and mandatory reading

Conflict order:

1. 11_OWNER_DECISION_REGISTER.md;
2. 12_CASE_WORKSPACE_MODULE_SSOT.md, 00_CASE_WORKSPACE_CANON.md and documents 01–10;
3. docs/product/AGENT_EXECUTION_V8_SSOT.md and referenced V8 contracts, for Run/runtime truth;
4. owning module SSOT for every touched capability/artifact, for its native domain truth;
5. docs/ui-standards/CANON.md, TRIADA and SPEC-A standards, for UI truth;
6. documents 13–14 only for sequencing, execution control and acceptance evidence;
7. docs/program/CLAUDE_DELEGATION_OPERATING_RULE_2026-08-07.md;
8. implementation as-is.

Each worker reads the applicable packet and cites exact sections. Missing
ownership, schema or policy remains EVIDENCE_MISSING and returns to Codex.

## 4. Baseline, worktree and Git safety

### 4.0 M0 — scoped multi-agent authorization

Repository `CLAUDE.md` currently says `zero sub-agentów`. This master plan does
not silently override that instruction. Before a multi-agent execution starts,
Piotr as Product Owner must provide a durable, program-scoped launch
authorization containing this meaning:

> For the Case Workspace program defined by document 13, authorize one Claude
> coordinator to use bounded sub-agents only through the ownership, isolated
> worktree, allowlist, fan-out/fan-in and evidence rules in this plan. This is a
> scoped exception to `zero sub-agentów`, not a general repository rule change.

Codex may scope and administer that owner authorization but cannot originate
the override. Alternatively, an owner-approved amendment to `CLAUDE.md` may
provide the same scoped permission. The authorization must also state whether Claude may create branches/worktrees
and small local commits. It never implicitly authorizes push, merge to demo,
deploy, production access or database mutation outside an approved disposable
environment.

Without this exact scoped authorization, Claude executes the same dependency
waves sequentially as one agent. It must not spawn workers and must not label
the run multi-agent.

Execution has only two valid launch modes:

- `RECON_ONLY` — W0 read-only inventory and packet planning, then stop. It
  creates no branch, commit, integration candidate or realDB mutation and may
  not emit `READY_FOR_CODEX_REVIEW`.
- `FULL_EXECUTION` — branch/worktree creation, packet commits, integration
  commits and one exact disposable test database are all explicitly authorized.
  Only this mode may continue W1–W8 and attempt an immutable candidate.

Any mixed or unresolved authority combination fails closed to `RECON_ONLY` and
stops after W0.

### 4.1 Preflight

Before edits the coordinator records:

    pwd
    git rev-parse --show-toplevel
    git branch --show-current
    git rev-parse HEAD
    git status --short --branch
    git worktree list --porcelain
    git diff --name-status
    git diff --cached --name-status

Also record repository instructions, package-manager/runtime versions,
database/schema identity, environment, current feature flags and active
legacy/V8 executions.

### 4.2 Dirty-tree rules

- Existing edits/untracked files belong to the user or another worker.
- Never reset, clean, checkout, restore, stash, amend or overwrite them.
- Never use git add -A or repository-wide formatting.
- A modified allowlisted file owned elsewhere is a collision: stop the packet.
- Separate HEAD, pre-existing dirty state and packet diff in evidence.
- A dirty or mixed-owner worktree is not a candidate.

### 4.3 Branch/worktree convention

Preferred integration branch, only after separate authorization and from the
current fetched `origin/demo` required by repository rules:

    claude/case-workspace-v1-20260809

Preferred isolated worker branch:

    claude/case-w<N>-<packet-id>

Each starts from the same coordinator-recorded `origin/demo` baseline SHA. One packet owns one
branch/worktree and explicit allowlist. Workers never edit the integration
worktree directly.

This handoff does not authorize commit, push, merge, deploy, shared/demo/
production DB mutation or production access. If branch/worktree creation is not
authorized, do read-only reconnaissance and patch planning only. If commits are
not authorized, report base SHA and diff manifest, but do not claim an immutable
candidate or READY_FOR_CODEX_REVIEW.

## 5. Ownership matrix

| Area | Canonical owner | Allowed target | Forbidden fork |
| --- | --- | --- | --- |
| Case | Case domain/application service | aggregate, commands, queries | Chat/My Work Case |
| Plan/graph | Case planning service | drafts, versions, digest, view state | per-view graphs |
| Runtime | V8 | Run, NodeRun, attempts, leases | AgentPlan runtime |
| Waits | V8 wait service | human/timer/event/callback | browser timers |
| Capabilities | Registry + native module | typed adapters/health | palette-only catalog |
| Proposals | V8 proposal/decision service | version-bound decisions | component stores |
| Events | domain outbox/inbox/history | append-only facts | UI audit truth |
| Artifacts | native module | links/readback | Case-owned copies |
| My Work | projection/workspace host | views and commands | client runtime |
| Chat | conversational entry/projection | promotion and cards | low-level orchestration |
| Plays | ProcessDefinition/Version | draft/review/publish | direct Play Run |
| Security | shared policy + domains | effective-scope checks | route-only filtering |
| Observability | runtime/domain instrumentation | correlation/metrics | logs as proof |

Shared routers, barrels, schema indexes, generated clients and migration
registries are integration-owner files.

## 6. Multi-agent topology and collision control

Roles:

- C0 coordinator/integration owner: baseline, packet registry, dependency gates,
  collision audit, integration order and candidate evidence.
- D1 domain/schema: Case, planning, persistence and migrations.
- R1 runtime: V8 Run/NodeRun, waits, events and recovery.
- C1 capabilities: registry and native/legacy adapters.
- U1 My Work: workspace projections and canonical API binding.
- G1 governance: proposals, approvals, policy and security tests.
- H1 Chat: promotion/cards only after My Work gate.
- A1 artifacts/value: evidence, deliverables, outcomes and Plays.
- Q1 Claude-internal adversarial QA: skeptical testing/evidence in an isolated
  context; no product edits, scope decisions, N/A approvals or acceptance
  decisions. Every finding returns through a remediation packet.

C0 maintains PACKET_REGISTRY. Every row resolves: packet ID, objective, worker,
base SHA, allowlist, forbidden files, authoritative documents/context, allowed
tools, dependencies, expected output schema, token/cost/time budget, timeout,
retry ceiling, completion criteria, stop/block conditions, commit authority,
status and evidence path. No unresolved row launches a worker. One file has one
write owner per wave. One allocator orders migrations. Producers land before consumers. Cross-
packet changes are requested, never opportunistic. Before each wave/integration
C0 compares git diff --name-only baseline...packet with all allowlists. Scope
drift is rejected.

## 7. Dependency map

    W0 baseline/inventory
      -> W1 Case core
      -> W2 Plan/graph + Capability Registry + owner-approved prototype gate
      -> W3 V8 runtime + My Work shell
      -> W4 waits/events + proposals/governance
      -> W5 complete My Work + legacy adapters
      -> W6 Chat integration
      -> W7 advanced graph + artifacts/value/Plays
      -> W8 migration rehearsal + Golden Cases + candidate freeze
      -> independent Codex review

Parallel packets require frozen producer contracts and disjoint allowlists.
Files existing is not a gate; current evidence on one integrated checkpoint is.

## 8. Wave packets

### W0-C0 — verified baseline and inventory

Read-only first. Locate Case, AgentPlan, V8 Run/proposal/chat handoff, My Work,
module write paths, tables, migrations, stores, routes, tests and flags.
Classify KEEP, EXTEND, ADAPT, DEPRECATE or CREATE. Count active/ineligible
legacy executions.

Gate:

- exact branch/SHA/worktree/schema and dirty ownership recorded;
- route-service-table and mutation-owner maps complete;
- duplicate truths and migration eligibility named;
- packet allowlists have no overlap;
- unknowns remain EVIDENCE_MISSING.
- SPEC-L/SPEC-A classification and Menu 1/2/3 mapping are verified;
- the Zlecenia capabilities, preview and row-action descriptors are reviewed;
- canonical routes, legacy redirects and focus-return map are frozen;
- desktop/mobile prototypes for index, Prosty Plan, Realizacja/attention and
  Rezultaty receive preliminary Piotr approval before UI implementation.

Evidence: command transcript, Git state, schema metadata, route/store/table
matrix, active-run report, scripts and flags.

Worker packet:

    Read case-workspace 00-12 and the delegation rule. Work read-only. Establish
    exact Git/worktree/schema baseline. Inventory current Case, AgentPlan, V8,
    proposals/chat, My Work and module write paths. Classify target action and
    identify duplicate truth. Return exact paths/symbols/routes/tables/tests,
    migration risk and collision-free allowlists. Do not edit, commit, push,
    deploy or mutate a database.

### W1-D1 — canonical Case and additive persistence

Implement document 04 Case fields/lifecycle: profile, governance tier/history,
closure contract, acceptance criteria, tenant/project, participants, autonomy,
optimistic version, immutable closure and successor lineage. Add idempotent
commands and tenant-scoped queries. Do not add reopen. C0 alone mounts shared
routes and migration registries.

Gate:

- fresh migration replay and existing-data preservation;
- lifecycle/concurrency contract tests;
- tenant/project/object-ID negatives;
- informational/direct flows produce zero Cases;
- durable command replay produces one Case;
- closure/successor realDB readback.

Worker packet:

    Implement only canonical Case and additive persistence from docs 04-06 in
    the allowlist. Preserve direct work without caseId. Include concurrency,
    idempotency, tenancy, immutable closure and successors. Do not edit shared
    registries; request integration changes. Add contract/integration/negative
    tests. Commit only if the resolved packet authority says YES; never
    push/deploy or mutate a non-disposable database.

### W2-D1 — PlanVersion and one graph

Implement draft/review/publish/supersede/withdraw, stable IDs, deterministic
semantic digest, validation, optimistic concurrency, immutable publication and
separate view-state. Add lossless legacy linear fixtures, not legacy execution.

### W2-C1 — Capability Registry

Implement versioned registry, lifecycle/health, typed command envelope,
provider-neutral binding snapshot, InternalCommandAdapter and bounded
LegacyToolAdapter. First Finance/KPI capabilities must use verified native
commands/readbacks; never native-table writes or UI driving.

### W2-U1 — three graph projections

After API fixtures freeze and W2-V0 passes, adapt Simple, Expert and List. All
semantic edits use one model/API. Complex Expert constructs survive Simple/List.

### W2-V0 — visual-direction prototype gate

Before any production UI packet edits a Case Workspace screen, create a
non-production prototype covering Zlecenia list/preview and the three Case
phases. Validate it against TRIADA, SPEC-A where applicable and the lightweight
doctrine, then obtain Piotr's explicit preliminary visual-direction approval.
Record immutable `OWNER_PROTOTYPE_APPROVAL_REF`, prototype revision/checksum and
approved scope in PACKET_REGISTRY and the visual ledger. Missing approval blocks
U1/UI packets as `EVIDENCE_MISSING`; backend/domain packets may continue.

W2 gate:

- published mutation fails; stale draft returns 409;
- layout preserves semantic digest;
- all views expose same IDs/digest; Expert branch is preserved;
- five-step and DRD fixtures round-trip with no guessed defaults;
- every active capability has owner/version/schema/adapter/policy/health;
- HUMAN and AGENT traces reach the same native command/readback;
- unhealthy/deprecated/unresolved capabilities block publish.

Graph worker packet:

    Implement CasePlanVersion and one canonical graph from docs 04-05. Separate
    semantic digest from view state; enforce expectedVersion and publication
    immutability. Add lossless legacy fixtures. No view-specific stores, runtime
    state on definitions or Play-to-Run execution. Return exact tests/API
    evidence. Commit only if the resolved packet authority says YES; never
    push/deploy.

Capability worker packet:

    Implement Registry and shared adapter boundary from doc 05. Audit owning
    Finance/KPI commands first. Human and Teresa converge on one handler and
    readback. No direct module writes, UI driving, graph secrets or palette-only
    truth. Prove idempotency/auth parity/realDB readback. Commit only if the
    resolved packet authority says YES; never push/deploy.

### W3-R1 — V8 Run/NodeRun

Extend V8; do not replace it. Bind new Run to Case, published plan version and
digest. Add NodeRuns, attempts, leases, checkpoints, idempotency and projections.
Eligible AgentPlan first materializes a CasePlanVersion, then runs under
V8_LEGACY_ADAPTER.

### W3-U1 — My Work shell

Mount Plan | Realizacja | Rezultaty using server projections/deep links.
Implement lightweight responsive shell, error/loading/empty states, keyboard
semantics and 44 pt targets. The Zlecenia list uses `StandardModuleBar`,
`StandardTable` and `StandardPreview` under TRIADA; no bespoke list shell. No
client runtime/approval truth. No Chat yet.

W3 gate:

- one Case/Run under replay and one NodeRun per executable node;
- duplicate dispatch yields one native effect;
- kills before/after commit resume or reconcile;
- cancellation stops new claims without false rollback;
- API, DB, events and My Work agree on IDs/states;
- mobile/List journey is semantically complete;
- unsupported legacy plans remain explicit.

Runtime worker packet:

    Extend only V8. Bind Run to CasePlanVersion/digest and add durable NodeRuns,
    attempts, leases, checkpoints and idempotent native commands. Do not create
    AgentPlan runtime or graph runtime fields. Add crash/replay/concurrency and
    realDB tests. Commit only if the resolved packet authority says YES; never
    push/deploy.

UI worker packet:

    Build My Work Case Workspace over frozen server contracts. Reuse approved
    primitives, not legacy persistence. Read TRIADA_KANON and run the required
    consultify-triada workflow. Zlecenia must compose StandardModuleBar,
    StandardTable and StandardPreview. Implement three phases/views, responsive
    and accessibility states, and canonical links. Client state is cache only.
    Do not touch Chat. Add browser contract tests. Commit only if the resolved
    packet authority says YES; never push/deploy.

### W4-R1 — waits, inbox/outbox and recovery

Implement HUMAN, TIMER, DOMAIN_EVENT and EXTERNAL_CALLBACK waits; registration
before dispatch; indexed atomic claims; signed callback inbox; dedupe; timeout
edges; outbox reconciliation; leases and late-event audit. Reauthorize resume.

### W4-G1 — proposals, approvals and policy

Consolidate V8/legacy sources behind one version/digest-bound API/projection.
Implement approve, reject, request changes, defer, expiry, allowed revoke and
separately authorized execution. Enforce A0-A4, autonomy ceiling, self-approval
rules, step-up/dual control and membership revocation.

W4 gate:

- multi-day timer/human wait survives restart/logout;
- two schedulers/workers claim/satisfy once;
- early/replayed/wrong-tenant/late callbacks are safe;
- outbox failure reconciles automatically;
- stale/mutated/expired proposal has zero effect;
- replayed decision/execute has one effect;
- revoked membership blocks execution;
- logs/events contain no secrets/restricted payloads;
- My Work reload shows authoritative state.

Wait worker packet:

    Implement first-class waits and transactional event delivery from docs 04/06
    in V8. Cover restart, dedupe, leases, timeout, outbox/inbox and reauth.
    Never encode timer as approval or use memory-only state. Add concurrency,
    restart, replay and wrong-tenant realDB tests. Commit only if the resolved
    packet authority says YES; never push/deploy.

Governance worker packet:

    Implement one proposal/decision service from docs 04/06/08. Bind exact
    version/digest/target/policy; separate approval/execution; adapt legacy
    inputs without mirrored truth. Enforce A0-A4, autonomy, expiry, assurance,
    dual control and revoked membership. Commit only if the resolved packet
    authority says YES; never push/deploy.

### W5 — complete My Work and legacy compatibility

U1 completes plan editing, progress, waits, proposals, timeline/history,
artifact chips, diagnostics/results, reconnect/readback and accessibility.
C1 exposes historical AgentPlans as synthetic linear graphs/history and projects
eligible V8 execution back to legacy screens. No new legacy executor features.

Gate:

- historical plans remain readable/auditable;
- eligible five-step plan executes once through V8;
- unsupported plans are not silently converted;
- reload/reconnect converges with API/DB;
- timeline reconstructs correlation chain;
- owner artifacts reopen through canonical deep links;
- keyboard/responsive/no-horizontal-scroll checks pass.

### W6-H1 — Chat integration

Implement POST /api/chat/durable-work as one atomic application command.
Classification creates only an ephemeral, versioned work-order. Server verifies
actor, version, digest, durable confirmation receipt and idempotency before
creating/reusing Case and allowed initial plan/Run. Chat cards are projections
and call the same commands as My Work. A local message or optimistic card is
never approval truth.

Gate:

- factual/exploratory Chat creates zero durable rows;
- confirmed request replay creates exactly one Case and zero or one Run
  according to validated `LIGHT` one-click eligibility;
- confirmed `STANDARD` or `TRANSFORMATION` work has zero Runs until exact plan
  publication and explicit Start;
- ambiguous yes or two proposals requires clarification;
- button and allowed conversation create same decision envelope;
- A3/A4 conversational approval fails;
- transcript reload and My Work share identifiers/states;
- Chat performs no client sequence of persistence writes;
- stale digest/wrong actor/false promotion has zero side effects.

Worker packet:

    Integrate Chat only with authoritative Case Workspace APIs. Build atomic
    promotion with exact version/digest/actor/receipt/idempotency and server-
    backed cards. Informational Chat creates no Case; ambiguous yes clarifies;
    A3/A4 use explicit controls. No Chat planner/runtime/approval stores or
    client low-level orchestration. Add API/reload/browser E2E. Commit only if
    the resolved packet authority says YES; never push/deploy.

### W7 — advanced runtime, artifacts/value and Plays

R1 implements deterministic gateways, parallel join ALL/ANY/N_OF_M, error/
timeout/compensation edges, bounded subflows and immutable replan/diff.

A1 implements late-bound artifact links, pinned evidence, provenance/rights,
deliverable acceptance, closure/outcomes and Monitoring Case lineage. Native
DOCX/PPTX/XLS derive from one accepted facts digest and remain owner-module
artifacts. Every artifact UI follows SPEC-A, `ArtifactRightPanel` and the
required `consultify-artefakty` workflow; no local artifact shell is invented.

C1 implements private Play drafts, validation/test, governed publication,
immutable versions and instantiation into CasePlanVersion. Run never binds Play.

Gate:

- branch/join/retry semantics deterministic;
- replan preserves history/version binding;
- subflow tenant/recursion/binding limits fail closed;
- one native artifact plus Case link, no copy;
- pinned revision remains reproducible;
- unknown provenance/rights blocks required promotion;
- deliverables open/render and share facts digest;
- closure does not overstate outcome/sustainability;
- private Plays stay private and published instances cannot mutate source.

### W7-Q1 — mandatory Claude-internal adversarial visual and accessibility QA

Q1 renders and skeptically reviews the real integrated surfaces in a context
isolated from the implementing workers before Piotr sees them. This is internal
adversarial QA, not independent acceptance; only Codex performs independent
candidate review. Required matrix:

- viewports `320, 375, 430, 768, 1024, 1440, 1920`;
- dark and light themes;
- 200% zoom and no loss of function;
- keyboard-only complete journeys and visible focus;
- VoiceOver and NVDA critical journeys;
- automated accessibility scan with zero critical/serious findings;
- reduced motion;
- focus return after drawer/modal/deep link;
- controlled fixtures plus runtime/readback for empty, loading, slow, stale,
  offline, permission denied, concurrency conflict, rate limit, provider error,
  lost connection, governance blocked, partial, expired approval, unavailable
  source and restart states;
- TRIADA and SPEC-A scripts/checklists required by `CLAUDE.md`.
- a Cartesian manifest covers every required state x viewport x theme x input
  mode x autonomy tuple with runtime ID and evidence;
- after one uncoached five-second view of the frozen initial-viewport fixture,
  at least four of five representative internal non-authors identify outcome,
  state, attention and next action correctly; tester roles, fixture/version,
  answers, timings, errors and observer are retained.

Piotr is never the first tester of the implemented visual surface. Screens
remain behind default-OFF flags until clean screenshots and the complete matrix
are adversarially reviewed by Claude-internal Q1.
Missing VoiceOver/NVDA, script or viewport evidence is `EVIDENCE_MISSING` and
blocks candidate freeze.

## 9. Wave 8 migration, flags and rollback

### Migration sequence

1. Add canonical tables/fields/indexes/constraints/outbox/inbox.
2. Keep legacy reads while enabling comparison projections.
3. Route a named internal cohort behind server flags.
4. Enable V8 adapter for eligible new linear execution.
5. Enable canonical My Work proposals.
6. Enable Chat only after My Work/proposal gates.
7. Backfill historical read links in resumable idempotent batches.
8. Reconcile counts, digests, states and in-flight eligibility.
9. Freeze legacy creation only after parity; retain history reads.
10. Remove legacy execution only in a separately approved packet.

Never guess project, tool, evidence, approval or completion. Quarantine unmapped
rows with reason and recovery route.

### Feature flags

Server-authoritative, tenant/cohort-scoped, audited and kill-switch capable:

- case_workspace_core_read
- case_workspace_create
- case_graph_editor
- case_v8_execution
- case_durable_waits
- case_canonical_proposals
- case_chat_promotion
- case_legacy_adapter
- case_advanced_graph
- case_deliverables_outcomes

New mutation flags default off. UI visibility is not permission. Record flag
snapshot in every Run/operator trace and ledger.

### Rollback

Disable the smallest mutation flag and stop/drain new claims. Do not reverse
additive schema after data exists. Preserve all Case/Run/event/approval/artifact
audit. Reconcile external effects before retry/fallback. Legacy fallback is
allowed only where it cannot create a second authority/effect. Record reason,
IDs, flag versions, operator, reconciliation and forward-fix condition.

### Stop conditions

Stop the packet/rollout for tenant leakage, unauthorized/duplicate effect,
migration loss or unexplained mismatch, second truth, secret leakage, stale
approval execution, A3/A4 conversational approval, unowned module mutation,
unreconciled worker recovery, dirty/mixed-owner candidate, scope overlap,
SHA/schema/environment mismatch or three failed repetitions of one approach.
Report BLOCKED, owner, evidence and exact unblock condition.

## 10. Tests and exact acceptance evidence

Run all required layers on one checkpoint; Wave 8 uses one immutable candidate.

- Static/unit: native lint, typecheck, format check, state machines, graph
  digest/validation, policy, git diff --check and generated drift.
- Contract/integration: APIs including 409, HUMAN/AGENT parity, module readback,
  legacy shields, event schemas and projection reconciliation.
- Security: swapped tenant/project/resource IDs, revoked membership/connection,
  changed approved payload, replay, prompt escalation, restricted routing,
  expired signature/capability/approval and cross-tenant links/subflows.
- Resilience: worker/scheduler races; kill before/during/after command commit and
  before outbox publish; restart active Runs/waits/approval; reconnect streams;
  cancel with external effect and late callback.
- RealDB: named disposable PostgreSQL from fresh migrations plus approved
  snapshot rehearsal. Read back versions, idempotency, binding, attempts, waits,
  outbox/inbox, decisions, links and ordered events. Mocks do not qualify.
- Browser: informational Chat/no Case; direct Finance or Assessment/no Case;
  LIGHT Case in My Work through wait/approval/result; late binding/deep link;
  stale permission/proposal; refresh/mobile/List; later Chat same IDs.
- Artifacts: native open, parser, visual render, checksum, manifest, source
  digest and owner-module reopen.
- Golden Cases A–F from document 10: focused Finance/KPI, enterprise
  transformation, standalone promotion, no-action Decision, failure/restart and
  private-to-shared Play.

Browser evidence records route, fixture identity, visible state, API/domain IDs,
correlation ID and realDB readback. Screenshot, build, generated-file count or
self-attestation alone is insufficient.

### 10.1 Mandatory worker return schema

Every worker returns exactly this typed structure to C0:

```text
PACKET_HANDOFF
PACKET_ID: <id>
STATUS: PASS | PARTIAL | BLOCKED | FAILED | EVIDENCE_MISSING
BASE_SHA: <full SHA>
HEAD_SHA: <full SHA or UNCOMMITTED>
BRANCH_WORKTREE: <identity>
ALLOWLIST_COMPLIANCE: PASS | <exact drift>
CHANGED_FILES:
- <path and purpose>
DIFF_OR_COMMITS:
- <commit SHA or diff reference>
COMMANDS_AND_RESULTS:
- <exact command, exit code, result>
RUNTIME_REALDB_BROWSER_EVIDENCE:
- <IDs, correlation, query/journey/reference or NOT_APPLICABLE>
OUTPUTS_FOR_CONSUMERS:
- <contract/schema/fixture plus exact downstream packet>
RISKS_AND_LIMITATIONS:
- <literal item, owner, impact>
UNKNOWN_OR_EVIDENCE_MISSING:
- <literal item and evidence needed>
BLOCKERS:
- <proof, exhausted safe alternatives, exact unblock>
NEXT_DEPENDENCY:
- <packet/gate and required input>
```

A narrative summary may accompany this structure but cannot replace it. C0
rejects a handoff missing any field, even when worker tests are green.

For every Golden Case step, `RUNTIME_REALDB_BROWSER_EVIDENCE` must map:

`golden_case_step_id -> capability/version -> owning command -> canonical object ID -> Run/NodeRun -> realDB readback -> browser evidence -> approval/evidence references`.

A final artifact or screenshot cannot substitute for any missing step mapping.

## 11. Integration protocol

For every packet C0:

1. verifies base SHA and allowlist;
2. inspects full diff and pre-existing ownership;
3. rejects drift/unrelated formatting;
4. separately reruns packet tests and git diff --check;
5. validates against producer contracts;
6. integrates only in dependency order and only if commit authorization exists;
7. runs integration tests/current failure shields;
8. updates ledger with exact SHA/schema/environment;
9. opens the next gate only on current evidence.

A shared-file change is a separate C0 packet. Do not merge all outputs first and
debug collisions afterward.

## 12. Evidence ledger

One append-only row per named gate. Existing rows are immutable; remediation or
correction appends a successor row and never edits history:

| Field | Required |
| --- | --- |
| Ledger row ID | immutable unique ID |
| Supersedes row ID | predecessor or `NONE` |
| Recorded at | timezone-qualified timestamp |
| Recorded by | actor identity and role |
| Gate ID | wave/packet/criterion |
| Requirement | exact canon clause |
| Status | PASS/N/A_WITH_CODEX_APPROVAL/PARTIAL/BLOCKED/FAILED/EVIDENCE_MISSING |
| Base and checkpoint SHA | full immutable SHAs |
| Branch/worktree | exact identity |
| Environment/schema | name, version and checksum |
| Fixture identity | tenant/project/user/role |
| Command/test | reproducible invocation and exit/result |
| Runtime IDs | Case/plan/Run/NodeRun/proposal/artifact/correlation |
| RealDB evidence | query/output reference and row IDs/counts |
| Browser evidence | journey/route/media/log reference |
| Artifact evidence | checksum/manifest/source revision |
| Owner/time | executor, reviewer, timezone timestamp |
| Limitations | literal remaining scope and owner |

A green aggregate count cannot replace named gates. Evidence from another SHA,
database, deployment or digest is stale.

## 13. Candidate freeze and exact-SHA rule

C0 must:

1. record clean integration worktree and branch;
2. record full git rev-parse HEAD as CANDIDATE_SHA;
3. record base..candidate commit/file manifest;
4. record migrations and schema checksum;
5. run required tests/runtime/realDB/browser/artifact gates on that SHA;
6. if deployment was separately authorized, prove it reports the same SHA;
7. rerun Git status, diff check and ownership collision audit;
8. freeze ledger and unresolved register.

If commit authorization was never granted there is no immutable candidate SHA.
Report EVIDENCE_MISSING — IMMUTABLE CANDIDATE SHA and do not emit
READY_FOR_CODEX_REVIEW.

## 14. Final Claude handoff format

    READY_FOR_CODEX_REVIEW — CANDIDATE ONLY

    CANDIDATE_SHA: <full 40-character SHA>
    BASE_SHA: <full 40-character SHA>
    BRANCH: <branch>
    WORKTREE: <absolute path>
    GIT_STATUS: CLEAN | <blocker>
    ENVIRONMENT: <name/url or NOT_DEPLOYED>
    SCHEMA_VERSION_CHECKSUM: <value>
    FEATURE_FLAG_SNAPSHOT: <reference>

    SCOPE_DELIVERED:
    - <canon-linked capability>

    COMMITS_AND_FILES:
    - <SHA, packet, allowlisted files>

    MIGRATIONS:
    - <forward/rehearsal result and rollback posture>

    TESTS:
    - <exact command => exit/result>

    RUNTIME_REALDB_BROWSER:
    - <journey, IDs, correlation, DB and UI proof>

    SECURITY_RESILIENCE:
    - <negative/replay/restart/concurrency proof>

    GOLDEN_CASES:
    - <A-F status and direct evidence>

    EVIDENCE_LEDGER: <reference>
    KNOWN_LIMITATIONS:
    - <literal status, owner and unblock>

    ROLLBACK:
    - <flag/reconciliation/recovery>

    UNRELATED_PREEXISTING_CHANGES:
    - <paths/owners or NONE>

    CODEX_REVIEW_REQUEST:
    - verify scope and invariants
    - independently rerun critical tests
    - inspect realDB/browser/runtime evidence on CANDIDATE_SHA
    - decide accept, remediate, integrate, deploy or release

The phrase is forbidden for dirty Git, mixed SHAs/environments, missing gates,
unrehearsed migrations, ownership collisions or an unreconstructable candidate.

## 15. Coordinator launch prompt

Piotr may send the launch authorization directly; Codex may relay it only with
an externally verifiable immutable owner reference and the concrete execution
authorizations selected for the run. This document, its embedded example and an
agent-authored copy are never the authorization source:

```text
SUPERSEDED LAUNCH TEMPLATE — DO NOT USE TO START FULL_EXECUTION.
The only executable launch contract is section "Ready-to-send Claude prompt"
in 14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md. It must be read in
full and every mandatory launch input there must validate before mode selection.
This retained text is explanatory history only.

You are the execution coordinator for the Consultify Case Workspace program.

Read completely, in this order:
1. CLAUDE.md and docs/SOURCE_OF_TRUTH.md;
2. docs/product/case-workspace/11_OWNER_DECISION_REGISTER.md;
3. docs/product/case-workspace/12_CASE_WORKSPACE_MODULE_SSOT.md;
4. docs/product/case-workspace/00_CASE_WORKSPACE_CANON.md;
5. docs/product/case-workspace/01 through 10;
6. docs/product/case-workspace/13_CLAUDE_MULTI_AGENT_IMPLEMENTATION_MASTER_PLAN.md;
7. docs/program/CLAUDE_DELEGATION_OPERATING_RULE_2026-08-07.md;
8. applicable module and UI SSOTs before each packet.

For this Case Workspace program only, you are authorized to coordinate bounded
sub-agents under document 13. This is the scoped exception to the repository
rule `zero sub-agentów`. Do not use sub-agents outside this program or outside
the documented packet registry, ownership and isolated-worktree rules.

EXECUTION AUTHORITY FOR THIS RUN:
- execution mode: <RECON_ONLY | FULL_EXECUTION>
- OWNER_MULTI_AGENT_AUTHORIZATION_REF: <external immutable Piotr message/thread/reference; never this document>
- OWNER_PROTOTYPE_APPROVAL_REF: <external immutable Piotr visual-direction approval or NOT_YET_GRANTED>
- create isolated branches/worktrees from current fetched origin/demo: <YES/NO>
- create small local commits per accepted packet: <YES/NO>
- integrate packet commits on the isolated integration branch: <YES/NO>
- push: NO unless separately authorized later
- deploy: NO unless separately authorized later
- production access or mutation: NO
- disposable local/test database: <YES/NO and exact target>

Verify OWNER_MULTI_AGENT_AUTHORIZATION_REF before spawning any worker. Missing,
unverifiable or non-owner authorization means RECON_ONLY and zero sub-agents.
FULL_EXECUTION is valid only when branch/worktree, packet commits, integration
commits and the exact disposable database are all YES. Otherwise stop after W0.
`OWNER_PROTOTYPE_APPROVAL_REF` may remain `NOT_YET_GRANTED` while backend work
continues, but every UI implementation packet remains blocked until W2-V0 records
the external approval.

Begin with W0 read-only. Record exact origin/demo SHA, all existing dirty state,
worktrees, schema and active runs. Do not touch the user's current dirty
worktree. Create PACKET_REGISTRY, ownership/collision map, dependency graph and
evidence ledger before any worker edit.

In FULL_EXECUTION, execute W0-W8 in dependency order. In RECON_ONLY, execute W0
and stop with the inventory and proposed packet registry. Parallelize only packets with frozen producer
contracts and disjoint file allowlists. Every worker uses the packet contract
and returns a typed handoff. Reject scope drift and self-attested completion.
After every wave, C0 separately verifies its gate before opening downstream
work; this remains internal verification, not independent Codex acceptance.

Do not create a second Case, graph, proposal, approval, Chat or runtime truth.
Direct modules remain usable without Case. New runtime converges on Case-bound
V8 Run/NodeRun. Preserve literal PARTIAL, UNKNOWN, BLOCKED and EVIDENCE_MISSING.

Stop and report the exact blocker if a required action exceeds the authority
above, if ownership collides, if origin/demo changes underneath the program, or
after three failed attempts of the same approach.

Your only positive terminal phrase is:
READY_FOR_CODEX_REVIEW — CANDIDATE ONLY

Use it only with a clean immutable candidate SHA and the complete handoff from
section 14. It is not acceptance, deployment or release approval.
```

Placeholders must be resolved before launch. An unresolved placeholder means
RECON_ONLY. No parameter combination other than the two modes above is valid.

## 16. Program definition of done

The program is a candidate for Codex review only when the agreed scope uses one
domain/runtime truth; all three entry boundaries pass; My Work is authoritative
before Chat; migration is additive/replayable/reconciled; security, approval,
idempotency, restart and tenancy fail safely; browser flows use mounted services
and realDB; artifacts are reproducible and lineage-complete; every required gate
has evidence on one exact SHA; Git and ownership audits are clean; uncertainty
remains literal; and no commit, push, merge, deployment or release occurred
without separate authorization.

Only Codex may review this candidate against document 10 and decide the next
state. Product-owner acceptance and deployment/release remain separate.

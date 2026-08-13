# Case Workspace — complete epics, DoD, acceptance and Claude full-execution prompt

> Status: `EXECUTION AND ACCEPTANCE CONTRACT / NOT STARTED`
> Date: 2026-08-09
> Product decision owner: Piotr Wisniewski
> Architecture, integration and final acceptance owner: Codex
> Executor: Claude coordinator with bounded workers under document 13
> Scope: complete functional, visual and customer-experience implementation

## 1. Purpose

This document closes the implementation handoff. It defines what Claude must
build, how it must prove functional and visual completeness, and when it may
return one candidate to Codex for independent review.

Claude is expected to execute the complete program in one coordinated run. One
run may contain many waves, agents, retries and remediation loops. “One large
shot” does not mean one branch, one prompt, one unreviewed merge or one giant
commit. It means Claude owns execution continuity from W0 through W8 and does
not hand an unfinished collection of worker outputs to Codex as a final result.

Claude may request owner input only for a genuine product, reputational, cost,
permission or irreversible decision not resolved in the canon. Engineering
difficulty, red tests, integration work and ordinary ambiguity are not owner
questions; Claude must resolve or remediate them within the approved scope.

## 2. Authority

Read and apply in this order:

1. repository `CLAUDE.md` and `docs/SOURCE_OF_TRUTH.md`;
2. `11_OWNER_DECISION_REGISTER.md`;
3. `12_CASE_WORKSPACE_MODULE_SSOT.md`;
4. `00_CASE_WORKSPACE_CANON.md` and documents `01–10`;
5. Agent Execution V8 for execution-runtime truth and each owning-module SSOT
   for its native commands, artifacts, permissions and readback;
6. `docs/ui-standards/TRIADA_KANON.md`,
   `docs/ui-standards/MY_WORK_TABLE_SURFACE_CONTRACT_V1.md`,
   `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` and shared component
   code named by `CLAUDE.md`;
7. `13_CLAUDE_MULTI_AGENT_IMPLEMENTATION_MASTER_PLAN.md` and this document for
   sequencing, delegation and evidence gates only;
8. implementation AS-IS.

Owner decisions and module canon override an older proposal. Code AS-IS is
migration evidence, not authority to fork the approved model. Documents 13–14
never override V8 runtime truth or an owning module's native-domain contract.

## 3. Terminal rule

Claude may return only:

`READY_FOR_CODEX_REVIEW — CANDIDATE ONLY`

and only after every required epic and DoD criterion below is `PASS` or an exact
Codex-approved `N/A_WITH_CODEX_APPROVAL` on one clean immutable candidate SHA.
Worker completion, green local tests, a build, generated screenshots, a
deployment or Claude's own review are not sufficient.

If any required criterion remains open, Claude continues the implementation or
remediation loop. If continuation is impossible within authority, the final
state is `BLOCKED` or `EVIDENCE_MISSING`, never a softened success statement.

Only Codex may perform independent acceptance and use the terminal phrase
`FINAL ACCEPTANCE PASS` under document 10.

## 4. Epic map

### EPIC E0 — verified baseline and convergence map

Outcome: one current picture of Git, worktrees, schema, routes, services,
tables, active runs, flags, collisions and authoritative owners.

Includes W0, the `KEEP | EXTEND | ADAPT | DEPRECATE | CREATE` inventory,
dependency graph, packet registry and evidence ledgers.

### EPIC E1 — Case Core and product boundary

Outcome: one canonical Case supporting `LIGHT | STANDARD | TRANSFORMATION |
MONITORING` and independent governance `LIGHTWEIGHT | STANDARD | CONTROLLED`.

Must prove:

- direct modules work without Case or Teresa;
- informational Chat creates zero Cases/Runs;
- confirmed durable Teresa work creates exactly one Case under replay;
- eligible LIGHT can use `Zatwierdź i rozpocznij`;
- STANDARD/TRANSFORMATION create zero Runs until plan publication and Start;
- closure is immutable and continuation creates successor lineage.

### EPIC E2 — contract, plan versions and canonical graph

Outcome: progressive planning with immutable published `CasePlanVersion` and
one graph projected through Simple, Expert and List.

Must include stable IDs, deterministic semantic digest, separate view state,
review/publish/withdraw/supersede, diff/replan, optimistic concurrency,
validation, branching contracts and lossless legacy import.

### EPIC E3 — Capability Registry and native module commands

Outcome: server-owned capability truth for internal, MCP, API, connector and
agent adapters.

Every active capability has owner, version, schemas, policy, effect class,
connection, health, idempotency, readback and tests. Human UI and Teresa call
the same owning command. No adapter writes another module's tables or drives UI.

### EPIC E4 — V8 Run, NodeRun and recovery

Outcome: one authoritative execution runtime bound to exact Case and plan
version.

Includes NodeRuns, attempts, leases, checkpoints, idempotency, pause, cancel,
retry, compensation, restart/resume, deterministic state projection and the
bounded AgentPlan compatibility adapter.

### EPIC E5 — durable waits and events

Outcome: human, timer, domain-event and external-callback work survives minutes,
days, browser logout and backend restart.

Includes indexed timer claims, human tasks, event subscriptions, callback
authentication/dedupe, timeout/error edges, transactional outbox/inbox,
reconciliation, escalation and late-event audit.

### EPIC E6 — proposals, autonomy and approvals

Outcome: one exact-version proposal and decision truth shared by My Work and
Chat.

Includes the three user policies, server-enforced A0–A4 ceilings, explicit A2,
material A3/A4 controls, reject/request changes/defer/expiry/revoke where legal,
step-up/dual control, no self-approval and authorization revalidation.

### EPIC E7 — lightweight My Work Case Workspace

Outcome: production-quality `Zlecenia` and `Plan | Realizacja | Rezultaty` as
the first canonical user surface.

Includes list/preview, attention, plan editor, contextual drawers and palette,
live execution, waits, proposals, timeline, results, diagnostics, native deep
links, required states and responsive/accessibility behavior.

The Zlecenia list uses `StandardModuleBar`, `StandardTable` and
`StandardPreview`; no bespoke table shell is allowed.

Before production UI implementation, E7 requires W2-V0: a non-production
prototype, TRIADA/SPEC-A review as applicable and an external immutable
preliminary visual-direction approval from Piotr. The real integrated UI is then
rendered and internally reviewed before Piotr performs final visual acceptance.

### EPIC E8 — Chat integration

Outcome: Teresa converts an exact confirmed work-order digest into the same Case
and Workspace without a second plan, approval store or runtime.

Includes ephemeral proposal, exact confirmation receipt, replay safety,
ambiguity handling, status/result cards, deep links and shared command/read
models. Chat messages are never material approval truth.

### EPIC E9 — advanced execution graph

Outcome: deterministic conditions, branches, parallel joins, retries, timeouts,
compensation, bounded subflows and versioned replan.

The Expert surface remains lightweight and contextual. It does not resurrect
the current heavy builder as the target product.

### EPIC E10 — artifacts, evidence and deliverables

Outcome: Case links native artifacts and pinned revisions without copying their
truth.

Includes evidence/provenance/rights, Findings, Recommendations, Decisions,
Initiatives, Finance/KPI, deliverable acceptance, facts digest and native
DOCX/PPTX/XLS readback. Artifact UI follows SPEC-A and `ArtifactRightPanel`.

### EPIC E11 — history, closure, value and Monitoring

Outcome: append-only business/audit/value history with honest closure types.

Delivery, Decision, Implementation, actual value and sustainability remain
separate. Long-horizon value measurement may move to a linked Monitoring Case.

### EPIC E12 — reusable Plays

Outcome: every authorized user may create private Play drafts; shared
publication requires an authorized publisher or review; published versions are
immutable and instantiate through a CasePlanVersion.

### EPIC E13 — migration and legacy retirement readiness

Outcome: additive, idempotent and reconcilable transition without history loss
or two execution truths.

Includes historical read adapter, eligible V8 execution adapter, quarantined
unmapped records, feature flags, cohort rollout, kill switches, rollback and
literal terminal conditions for legacy executor retirement.

### EPIC E14 — acceptance, observability and operational readiness

Outcome: one candidate that can be independently reconstructed and tested.

Includes correlation chain, operator diagnostics, metrics, evidence ledgers,
security/resilience suite, Golden Cases A–F, visual/CX matrix and exact-SHA
handoff.

## 5. Complete program Definition of Done

All criteria are required unless the frozen canon literally marks the item out
of scope or Codex grants an exact requirement-level exception before candidate
freeze. Claude/C0/Q1 may propose N/A but cannot approve it. The only accepted
form is `N/A_WITH_CODEX_APPROVAL` with requirement ID, canon clause or Codex
approval reference, scope, reason, reviewer identity and timestamp.

### DoD-A — scope and truth

- [ ] All E0–E14 epics are mapped to commits, tests and evidence.
- [ ] One Case, graph, Run/NodeRun, proposal/approval and event truth exists.
- [ ] Direct module work remains operational without Case/Teresa.
- [ ] Chat and My Work are projections/clients, not competing runtimes.
- [ ] Owning modules retain artifact identity and mutation authority.
- [ ] No current heavy builder is presented as completed Expert UX.
- [ ] No required item is hidden as `later`, `soon` or undocumented follow-up.
- [ ] Every N/A row is literal canon out-of-scope or has exact Codex approval;
      Claude-internal reviewers approved no scope reduction.

### DoD-B — domain and persistence

- [ ] Case profiles and governance tiers are separate and persisted.
- [ ] Contracted closure, acceptance criteria, autonomy and tier history persist.
- [ ] Plan publication is immutable; replan produces versioned diff.
- [ ] Every Run binds exact CasePlanVersion and graph digest.
- [ ] NodeRun attempts, waits, approvals, events and artifact links read back.
- [ ] Idempotency prevents duplicate Case, Run, decision and module effects.
- [ ] Fresh migration and rerun are safe; existing-data rehearsal is reconciled.
- [ ] Restart preserves all active/waiting/blocked state.

### DoD-C — orchestration and integrations

- [ ] Capability Registry is server-driven and versioned.
- [ ] Internal/MCP/API/connector/agent providers use typed adapters.
- [ ] Secrets never enter graph JSON, ordinary logs or client state.
- [ ] Human and Teresa reach identical owning command validation/readback.
- [ ] Timer, human and callback waits survive long durations and races.
- [ ] Branch, join, timeout, error and compensation semantics are deterministic.
- [ ] Retry/replay cannot repeat an already committed external effect.

### DoD-D — governance and security

- [ ] `ASK_EACH_ACTION`, `ASK_MATERIAL_ACTIONS` and
      `EXECUTE_APPROVED_PLAN` are visible and enforced.
- [ ] Organization maximum autonomy is enforced server-side.
- [ ] A2 requires explicit control or an already published plan policy.
- [ ] A3/A4 and material actions use exact explicit approval and assurance.
- [ ] Tenant/project/membership/object ACL/delegation are checked and rechecked.
- [ ] Swapped IDs, revoked membership and forged/replayed callbacks fail closed.
- [ ] Approval binds exact proposal/version/digest/target/role/policy/expiry.
- [ ] Challenger rules are proportional and proven on material flows.

### DoD-E — functional UX and customer journeys

- [ ] In five seconds a user can identify outcome, state, attention and next action.
- [ ] A LIGHT task has no project theatre or mandatory technical graph.
- [ ] Simple, Expert and List preserve the same semantic graph and selection.
- [ ] Contextual `+`, palette, drawer and details work without permanent walls.
- [ ] Plan, execution and results deep links restore phase, selection and focus.
- [ ] Human/external waits never look like infinite AI computation.
- [ ] Errors explain impact and offer a safe recovery action.
- [ ] Polish copy uses `Zlecenie` and names Teresa/system/human responsibility.
- [ ] `PARTIAL`, `UNKNOWN`, `BLOCKED`, `WAITING` and `EVIDENCE_MISSING` remain literal.
- [ ] Native results open in owning modules and return to Case context.
- [ ] The Polish dictionary from document 12 is used; copy snapshots,
      pseudo-locale and 200% zoom truncation checks pass.
- [ ] At least five representative internal non-authors receive an uncoached
      five-second view of one frozen initial-viewport fixture; at least four of
      five correctly identify outcome, current state, required attention and
      next action. Tester role, fixture/version, questions, answers, timing,
      errors and observer are recorded. Missing qualified testers or evidence is
      `EVIDENCE_MISSING`; owner review is not a substitute.

### DoD-F — list and workspace visual canon

- [ ] Zlecenia composes `StandardModuleBar`, `StandardTable` and
      `StandardPreview` from `src/components/standard/*`.
- [ ] TRIADA checklist is completed 100%, item by item, with evidence or valid N/A.
- [ ] Menu 1/2/3, table, settings, kebab, preview and actions follow canon.
- [ ] Hairlines, density, spacing, typography and icon sizes use shared tokens.
- [ ] Crimson is used only for permitted critical/destructive semantics.
- [ ] Active state is neutral and focus is blue `--c-focus`.
- [ ] No bespoke local table, preview, color system or AI decoration exists.
- [ ] Dark and light modes both pass visual review.
- [ ] W2-V0 prototype revision and external Piotr preliminary approval are
      recorded before the first production UI implementation commit.
- [ ] Zlecenia is SPEC-L and its reviewed capabilities, preview and row-action
      descriptors govern desktop and mobile behavior.
- [ ] Full Case uses the existing SPEC-A Archetype C — Record, class L artifact shell (not a dashboard or ModuleHub); phases occupy
      Menu 3 and the shared `ArtifactRightPanel` is contextual.
- [ ] Canonical routes, redirects, deep-link return and focus restoration pass.

### DoD-G — artifact visual canon

- [ ] Applicable object screens follow SPEC-A shell and archetype.
- [ ] `ArtifactRightPanel`, shared menus, tokens and native editor are reused.
- [ ] Deliverables are readable, editable and visually correct after cold reopen.
- [ ] DOCX/PPTX/XLS open natively and share the accepted facts digest.
- [ ] Required artifact checklist and render evidence pass before owner review.

### DoD-H — responsive and accessibility

- [ ] Viewports 320, 375, 430, 768, 1024, 1440 and 1920 pass.
- [ ] 200% zoom retains content and every required action.
- [ ] Keyboard-only journeys have no focus trap or unreachable action.
- [ ] Esc closes the most local layer and focus returns correctly.
- [ ] Canvas has List/text equivalent and drag has non-drag alternatives.
- [ ] VoiceOver and NVDA critical paths pass.
- [ ] Automated a11y has zero critical/serious findings.
- [ ] Reduced motion is respected; live Teresa regions use polite semantics.
- [ ] Touch targets meet 44 x 44 pt where required.

NVDA evidence requires the named Windows 11 + current stable NVDA environment
recorded in the launch inputs and evidence ledger. VoiceOver on macOS is not a
substitute. If that environment is unavailable, NVDA may be
`N/A_WITH_CODEX_APPROVAL` only after Codex records the exact approval reference,
reason, reviewer identity
and follow-up gate before `FULL_EXECUTION`; Claude/Q1 cannot self-waive it.

### DoD-I — performance and reliability

- [ ] No main journey depends on an unbounded spinner or live socket memory.
- [ ] SPEC-L remains operable with 1,000 Cases, Plan with 250 nodes/500 edges,
      and timeline with 10,000 events using pagination or virtualization.
- [ ] On recorded standard test hardware, warm p95 route-to-interactive is
      <= 2.5 s, p95 local interaction response <= 100 ms and p95 server-backed
      mutation feedback <= 1 s under a recorded throttled-network profile.
- [ ] A 30-minute active Run has no unbounded DOM/event growth and no more than
      20% browser-heap growth after GC from the post-load baseline.
- [ ] API lists are paginated/cursor-based and tenant-filtered.
- [ ] Projection lag, stuck leases, waits, retries and capability health are observable.
- [ ] Reconnect/cold reopen converges to authoritative server state.
- [ ] Failure injection proves recovery without duplicate effects.

Before W1, freeze the performance environment and fixture in the ledger. The
minimum comparable runner profile is 4 dedicated vCPU, 16 GB RAM, SSD storage,
current supported macOS/Linux, current LTS Node and current stable Chromium.
The network profile is versioned as `CW-NET-1`: 1.6 Mbps downstream, 750 Kbps
upstream and 150 ms added RTT. Record exact CPU,
RAM, OS, Node/browser/PostgreSQL versions, database size, concurrency, warm/cold
state and network-throttling profile. The volume and latency thresholds above are
tested without changing that fixture after candidate freeze. Raw percentile and
heap outputs are retained. A weaker runner may be used without relaxing the
budgets. A stronger/different or undocumented environment requires an exact
pre-run Codex approval reference; otherwise it is `EVIDENCE_MISSING`, not PASS.

### DoD-J — migration, flags and rollback

- [ ] All new mutation flags default OFF and are server-authoritative.
- [ ] Internal cohort and comparison projections pass before broader enablement.
- [ ] Rollback disables the smallest flag and preserves audit/effects.
- [ ] No additive schema is destructively rolled back after data exists.
- [ ] Unmapped legacy records remain quarantined with reason and recovery path.
- [ ] Legacy execution retirement prerequisites are all current and evidenced.

### DoD-K — documentation and operability

- [ ] API/schema/event contracts match implementation and generated clients.
- [ ] Migrations, flags, runbooks, rollback and operator diagnostics are documented.
- [ ] Feature-to-test-to-evidence coverage contains no unexplained gap.
- [ ] Known limitations are literal, owned and do not contradict a PASS claim.
- [ ] Exact commands reproduce tests and evidence from a clean checkpoint.

### DoD-L — candidate integrity

- [ ] Candidate has one full SHA based on the recorded `origin/demo` baseline.
- [ ] Integration worktree is clean and collision audit passes.
- [ ] Schema checksum, flags, environment and fixture identities are frozen.
- [ ] All required evidence refers to that same SHA/environment/schema.
- [ ] Golden Cases A–F pass without mocks substituting named runtime layers.
- [ ] Claude's final handoff matches documents 13 and 14 exactly.

## 6. Required coverage ledgers

Claude creates and maintains these append-only artifacts on the integration
branch:

```text
docs/product/case-workspace/acceptance/
  EPIC_DOD_COVERAGE.csv
  FUNCTIONAL_REQUIREMENT_COVERAGE.csv
  API_EVENT_SCHEMA_COVERAGE.csv
  SECURITY_RESILIENCE_MATRIX.csv
  VISUAL_TRIADA_SPEC_A_LEDGER.csv
  RESPONSIVE_ACCESSIBILITY_LEDGER.csv
  CUSTOMER_JOURNEY_LEDGER.csv
  LEGACY_MIGRATION_PARITY.csv
  GOLDEN_CASE_EVIDENCE_LEDGER.csv
  FINAL_CANDIDATE_MANIFEST.md
  CARTESIAN_UX_COVERAGE.csv
```

Every requirement receives an immutable ledger row ID, source file and line,
authority level, applicability reason, implementation path/symbol, test,
evidence reference, candidate SHA, actor, timezone timestamp and literal status.
Corrections append a new row with `supersedes_row_id`; prior rows are never
edited. Aggregate percentages do not replace individual rows. Missing rows are
`EVIDENCE_MISSING`.

Before W1, C0 must extract every normative requirement, invariant, state,
command, API, event, node/edge type, user action, visual rule, error/recovery
state and Golden Case assertion from documents 00–14 and every applicable
normative authority referenced by them into these ledgers: `CLAUDE.md`,
`SOURCE_OF_TRUTH`, Agent Execution V8 and applicable delegated contracts, every
touched owning-module SSOT, TRIADA, My Work table contract, SPEC-A and required
repository skills/scripts. The extraction itself is reviewed for completeness
by C0 and Claude-internal adversarial Q1, then remains subject to independent
Codex review. A feature absent from the ledger is not outside scope; it is an
acceptance defect. Final coverage requires one row for every supported
capability and every user-visible action, including negative and unavailable-
state behavior.

`CARTESIAN_UX_COVERAGE.csv` is machine-checked across state, journey, viewport,
theme, input mode, autonomy and permission. Every required tuple has a stable
ID, fixture, runtime ID, expected copy, test and evidence reference. A canonical
`N/A` requires exact `N/A_WITH_CODEX_APPROVAL`; aggregate screenshots or
percentages do not fill gaps.

The functional ledger distinguishes at least:

- `IMPLEMENTED_AND_PROVEN`;
- `IMPLEMENTED_EVIDENCE_MISSING`;
- `PARTIAL`;
- `BLOCKED`;
- `NOT_IMPLEMENTED`;
- `N/A_WITH_CODEX_APPROVAL`.

Only `IMPLEMENTED_AND_PROVEN` and `N/A_WITH_CODEX_APPROVAL` may pass the
candidate gate. Literal canon out-of-scope uses the same N/A state with the exact
canon line; every other N/A includes an immutable Codex approval reference.
Claude/C0/Q1 cannot approve N/A.

## 7. Test strategy and exit gates

### T0 — static and source integrity

- worker-local checks: file-scoped lint/esbuild or targeted tests as required by
  `CLAUDE.md`; these never prove candidate integration;
- candidate-level mandatory commands from the clean integrated SHA:
  `npm run lint`, `npm run type-check`, `npm run build`,
  `npm --prefix server run typecheck`, `npm --prefix server run build`,
  `npm run check:ui`, `npm run check:ssot` and applicable generated-contract
  drift checks;
- any pre-existing failure must be reproduced on the recorded baseline SHA,
  isolated from candidate regressions and retained as a literal owned exception;
  it cannot be silently excluded by calling the gate scoped;
- `git diff --check` and generated-contract drift;
- route/handler/store ownership search;
- forbidden duplicate truth and direct-table-write shields;
- TRIADA/SPEC-A repository scripts.

### T1 — domain and contract tests

- Case, closure, governance, PlanVersion and graph state machines;
- capability, command, API and event schemas;
- proposal/approval version/digest behavior;
- artifact link/pinned-revision semantics;
- Play publication and instantiation.

### T2 — database integration

- fresh PostgreSQL migrations and idempotent rerun;
- approved existing-snapshot rehearsal;
- concurrency, uniqueness, optimistic version and tenant constraints;
- outbox transaction, inbox dedupe, indexed wait claims and leases;
- exact readback before and after process restart.

### T3 — service/runtime integration

- Chat→Case→Plan→Run;
- direct module flow without Case;
- HUMAN and AGENT command parity;
- pause/cancel/retry/replan;
- wait and callback races;
- approval expiry/revocation;
- native artifact readback and deep links.

### T4 — security and adversarial tests

- swapped tenant/project/user/artifact IDs;
- revoked membership and connection;
- stale approval, changed digest and replay;
- forged/late/wrong-correlation callback;
- restricted data, secret leakage and unauthorized capability;
- malicious graph/input and budget/loop/resource exhaustion.

### T5 — browser functional journeys

Run the canonical journeys with mounted services and realDB:

1. direct Interview/Assessment/Finance without Case;
2. informational Teresa chat with zero durable rows;
3. LIGHT `Zatwierdź i rozpocznij` through result;
4. STANDARD confirmation with zero Run before publish/start;
5. edit/validate/publish across Simple, Expert and List;
6. human wait, external wait, reminder, timeout and resume;
7. approval/reject/changes/defer/expiry;
8. restart and idempotent recovery;
9. result deep link and cold return;
10. Monitoring Case split;
11. private Play to governed shared version;
12. Chat and My Work showing identical identifiers/state.

### T6 — visual, responsive and CX acceptance

Before the first production UI edit, pass W2-V0 and record the prototype
revision/checksum plus external immutable preliminary Piotr approval. This is
distinct from final owner visual acceptance of the real rendered screen.

For every primary state and journey:

- capture clean dark/light screenshots at the required viewports;
- compare against TRIADA, SPEC-A, approved Case Workspace doctrine and existing
  neighboring application surfaces;
- inspect density, borders, spacing, typography, hierarchy, focus, status and
  contextual disclosure manually;
- run keyboard, VoiceOver/NVDA, zoom and reduced-motion checks;
- verify empty/loading/slow/stale/offline/error/permission/conflict/rate-limit/
  disconnected/blocked/partial/expired/unavailable/restart fixtures;
- verify user comprehension: outcome, state, attention and next action;
- execute the non-author five-second protocol from DoD-E and retain roles,
  timings, answers and errors;
- generate and machine-check `CARTESIAN_UX_COVERAGE.csv`;
- remediate every P0/P1 visual or CX finding and rerun the entire affected matrix.

Piotr is never the first tester of the implemented visual surface.
Claude-internal adversarial Q1 must render, inspect and remediate the real screen
before owner review. This is internal QA, not independent acceptance. A
screenshot proves appearance, not persistence or functionality; it must be
paired with runtime readback.

Before UI implementation begins, Piotr must give preliminary approval to the W0
desktop/mobile prototypes named in document 13. This validates visual direction
only and does not replace runtime or final acceptance.

### T7 — Golden Cases and deliverables

Run Golden Cases A–F from document 10. Render and open required documents,
presentations and spreadsheets. Verify facts digest, formulas, checksums,
manifest, source revision, provenance/rights, native editability and lineage.
For every Golden Case step, the ledger maps:

`step ID -> capability/version -> owning command -> canonical object ID -> Run/NodeRun -> realDB readback -> browser evidence -> approval/evidence refs`.

Missing step mapping is `EVIDENCE_MISSING`; a final deliverable cannot stand in
for intermediate execution proof.

### T8 — candidate replay

On the frozen candidate SHA:

- start from clean checkout/worktree;
- run migrations on a fresh disposable DB;
- execute critical automated suites;
- run restart/replay and security negatives;
- rerun critical browser and visual journeys;
- verify schema/flag/environment/SHA identity;
- confirm all ledgers contain only `PASS` or
  `N/A_WITH_CODEX_APPROVAL` for terminally eligible rows.

Any code or migration change after T8 invalidates candidate evidence and starts
a new candidate cycle.

## 8. Customer-experience acceptance questions

For each journey Claude-internal adversarial Q1 records evidence-backed answers:

1. Can a new user understand why Zlecenie exists without being forced to use it?
2. Can they complete direct work without Teresa or Case?
3. Can they see exactly what Teresa will do before confirming?
4. Does a small task feel lighter than the current heavy builder?
5. Is advanced power discoverable without dominating the screen?
6. Is waiting clearly distinguished from running, risk and blocker?
7. Can the user always identify who or what has the next move?
8. Are material approvals understandable, exact and reversible where promised?
9. Are results native, inspectable and connected to evidence?
10. Does return from a module preserve Case context?
11. Do errors preserve trust by explaining impact and recovery?
12. Are Polish labels, Teresa's voice and system responsibility consistent?
13. Does the experience remain coherent on mobile, keyboard and screen reader?
14. Does the UI look like Consultify's accepted application, only lighter?

A vague “looks good” is not PASS. Each answer points to a journey, screenshot,
runtime ID and ledger row.

The five-second criterion uses the frozen protocol in DoD-E. It may not be
replaced by Q1 opinion, owner review or an implementation-author walkthrough.

## 9. Claude internal completion loop

For every wave and again for the integrated candidate:

1. implement the packet;
2. run worker-local checks;
3. return typed `PACKET_HANDOFF`;
4. C0 audits scope and integrates in dependency order;
5. run producer/consumer and regression tests;
6. Q1 performs Claude-internal adversarial functional and visual QA; this is not
   independent Codex acceptance;
7. convert every finding into a bounded remediation packet;
8. rerun the affected gate and downstream consumers;
9. update coverage and evidence ledgers;
10. proceed only when the current wave has no required open state.

Claude does not wait for Codex to discover ordinary integration, functional,
visual or CX defects. Codex receives only the final candidate or a genuine
terminal blocker.

## 10. Final handoff to Codex

The handoff uses section 14 of document 13 and additionally includes:

- epic E0–E14 status table;
- DoD-A through DoD-L status and evidence;
- all coverage ledgers;
- exact visual matrix and screenshot index;
- TRIADA and SPEC-A completed checklists;
- accessibility results and assistive-technology evidence;
- customer-journey findings and remediation history;
- Golden Cases A–F;
- feature-flag and rollback rehearsal;
- complete base-to-candidate manifest;
- literal remaining limitations.

`READY_FOR_CODEX_REVIEW — CANDIDATE ONLY` is forbidden if any required ledger
row is neither PASS nor exact `N/A_WITH_CODEX_APPROVAL`, Git is dirty, evidence
spans different SHAs/environments, the external owner authorization reference is
absent, or the candidate cannot be rebuilt.

## 11. Ready-to-send Claude prompt

The block below is a template, not owner authorization. It may be launched only
when Piotr sends it with a separate externally verifiable immutable owner
message/thread/decision reference. Document 14, its Git blob, an agent-authored
copy or the template text cannot serve as that reference.

```text
OWNER_MULTI_AGENT_AUTHORIZATION_REF:
<external immutable Piotr message/thread/decision ID, timestamp and sender
identity proving bounded sub-agent authorization for this exact program; never
document 14>

OWNER_PROTOTYPE_APPROVAL_REF:
<external immutable preliminary Piotr visual-direction approval or
NOT_YET_GRANTED>

The text of this template is not evidence of owner authorization. Verify the
external reference before spawning any worker. Missing, unverifiable or
non-owner provenance forces RECON_ONLY with zero sub-agents.

REQUIRED RUNTIME AND MIGRATION INPUTS:
- CURRENT_RUNTIME_READONLY_SOURCE: <exact environment/database or API target>
- CURRENT_RUNTIME_READONLY_AUTHORIZATION_REF: <owner/admin permission reference>
- EXISTING_DATA_SNAPSHOT: <approved sanitized snapshot path/URI>
- EXISTING_DATA_SNAPSHOT_AS_OF: <timestamp>
- EXISTING_DATA_SNAPSHOT_CHECKSUM: <checksum>
- DISPOSABLE_TEST_DATABASE: <exact local/test PostgreSQL target>
- NVDA_ENVIRONMENT: <named Windows 11 runner/device + NVDA version + access>
  OR NVDA_NA_APPROVAL_REF: <exact immutable Codex N/A approval, canon reason and follow-up gate>

The current-runtime source is read-only. The snapshot must have approved
provenance and contain the schema/data classes needed to rehearse legacy
AgentPlan/V8 migration. A missing or mismatched input stops after W0 with
EVIDENCE_MISSING; it may not be replaced by invented fixtures.

AUTHORIZED:
- read the full repository and required documentation;
- fetch and establish the current origin/demo baseline;
- create isolated branches/worktrees from that exact baseline;
- use bounded sub-agents through PACKET_REGISTRY and disjoint allowlists;
- create small local packet commits;
- integrate accepted packet commits on one isolated integration branch;
- create and use an exact disposable local/test PostgreSQL database;
- read only the exact current-runtime source named above;
- use only the approved sanitized snapshot named above for migration rehearsal;
- run required local services, browser automation, renderers and test tools;
- iterate through remediation until the complete candidate passes.

NOT AUTHORIZED WITHOUT A SEPARATE OWNER INSTRUCTION:
- push;
- merge to origin/demo or any shared branch;
- deploy;
- mutate demo, shared or production databases;
- contact external people or perform real external side effects;
- weaken acceptance criteria, owner decisions, security or visual canons.

YOUR TASK

Implement the entire Case Workspace from verified baseline to one clean,
immutable candidate ready for independent Codex review. Treat this as one
continuous end-to-end delivery, executed internally through waves W0-W8 and
bounded worker packets. Do not stop after foundations, a UI shell, selected
epics or green unit tests. Do not return worker handoffs to Codex as completion.

MANDATORY READING — COMPLETE, IN ORDER

1. CLAUDE.md and docs/SOURCE_OF_TRUTH.md;
2. docs/product/case-workspace/11_OWNER_DECISION_REGISTER.md;
3. docs/product/case-workspace/12_CASE_WORKSPACE_MODULE_SSOT.md;
4. docs/product/case-workspace/00_CASE_WORKSPACE_CANON.md and 01-10;
5. docs/product/case-workspace/13_CLAUDE_MULTI_AGENT_IMPLEMENTATION_MASTER_PLAN.md;
6. docs/product/case-workspace/14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md;
7. docs/product/AGENT_EXECUTION_V8_SSOT.md and referenced contracts;
8. every owning-module SSOT before touching its capability/artifact;
9. docs/ui-standards/TRIADA_KANON.md;
10. docs/ui-standards/MY_WORK_TABLE_SURFACE_CONTRACT_V1.md;
11. Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md;
12. docs/program/CLAUDE_DELEGATION_OPERATING_RULE_2026-08-07.md.

Use mandatory Consultify skills and repository scripts named by CLAUDE.md.
If a required skill or gate is unavailable, report EVIDENCE_MISSING; do not
claim compliance from memory.

START

Begin with W0 read-only. Do not touch the user's current dirty worktree. Record
the exact fetched origin/demo SHA, all worktrees and dirty ownership, schema,
environment, flags and active AgentPlan/V8 executions. Create the packet
registry, dependency graph, collision map and all acceptance ledgers before
worker edits.

Before W1, verify the external owner authorization, current-runtime read-only
permission, snapshot timestamp/checksum/provenance, disposable DB and named NVDA
environment or prior Codex N/A approval. Any missing input forces RECON_ONLY and
an exact EVIDENCE_MISSING report.

EXECUTION

Run W0-W8 in dependency order. Parallelize only frozen, independent packets
with disjoint file ownership. One coordinator owns shared files, migrations,
integration order and candidate evidence. Every worker uses the packet contract
and typed PACKET_HANDOFF. Reject scope drift and duplicate truth.

Build every epic E0-E14 and satisfy every DoD-A through DoD-L criterion in
document 14. Preserve all frozen decisions: one Case; direct modules without
Case; exact Chat confirmation; proportional governance; three autonomy
policies; explicit A2; material A3/A4 controls; one graph; Case-bound V8;
durable waits; native artifacts; append-only history; honest value states.

FUNCTIONAL ACCEPTANCE

First extract every normative rule and user-visible action from documents 00-14
and all applicable normative sources in the authority chain into the required
coverage ledgers, with source file/line, authority and applicability; omissions
are acceptance defects.
Maintain requirement-to-code-to-test-to-evidence ledgers. Test static/domain,
API, event, database, runtime, security, concurrency, restart, replay, native
artifacts and Golden Cases A-F. Mounted services and real PostgreSQL readback
are mandatory where named. Mocks cannot replace runtime or realDB evidence.

VISUAL AND CUSTOMER-EXPERIENCE ACCEPTANCE

The result must be functionally and visually consistent with Consultify while
establishing the approved lighter Case Workspace standard. Zlecenia must use
StandardModuleBar, StandardTable and StandardPreview and pass the entire TRIADA
checklist. Artifact surfaces must pass SPEC-A and reuse ArtifactRightPanel.

Before production UI implementation, obtain the external preliminary Piotr
approval for the W2-V0 prototype and record `OWNER_PROTOTYPE_APPROVAL_REF`.
Then have Claude-internal adversarial Q1 render and inspect the real integrated
UI before Piotr sees it.
Cover dark/light; 320, 375, 430, 768, 1024, 1440 and 1920; 200% zoom; keyboard;
VoiceOver/NVDA; reduced motion; focus restoration; required empty/loading/
stale/error/blocked/partial states. Pair screenshots with runtime and realDB
readback. Remediate every P0/P1 visual or CX finding and rerun affected gates.
Piotr is never the first visual tester.

COMPLETION BEHAVIOR

Continue through integration and remediation until the entire agreed program
has one clean candidate SHA and all required ledgers are PASS or exact
N/A_WITH_CODEX_APPROVAL. Ask Piotr only
for a genuinely unresolved product, cost, permission, reputational or
irreversible decision. Do not ask him to resolve engineering work already
covered by the canon.

Do not push, merge, deploy or mutate shared/demo/production environments. Do
not use FINAL ACCEPTANCE PASS. Your only positive terminal statement is:

READY_FOR_CODEX_REVIEW — CANDIDATE ONLY

Use it only with the complete handoff required by documents 13 and 14: exact
base/candidate SHA, clean worktree, commits/files, schema checksum, flags,
tests, runtime/API/realDB/browser/artifact/security/resilience evidence, all
ledgers, Golden Cases, visual/CX matrix, rollback and literal limitations.

If any required criterion is neither PASS nor exact N/A_WITH_CODEX_APPROVAL,
continue remediation or return the exact BLOCKED/EVIDENCE_MISSING state with
proof and the smallest required owner decision. Partial delivery is not final
delivery.
```

## 12. Acceptance status

Documentation contract: `READY FOR OWNER USE`.

Implementation, runtime and final acceptance: `NOT STARTED`.

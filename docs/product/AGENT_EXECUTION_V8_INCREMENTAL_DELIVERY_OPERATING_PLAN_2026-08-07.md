# Agent Execution v8 — Incremental Delivery Operating Plan

> Status: `PROPOSED FOR PRODUCT REVIEW`
> Date: 2026-08-07
> Owner: Product + Engineering
> Working doctrine: short vertical proofs, visible checkpoints, no long silent build phase
> Inputs:
> - `AGENT_EXECUTION_V8_PRODUCT_CHARTER_DOD_AND_EPICS.md`
> - `AGENT_EXECUTION_V8_HARVEY_BENCHMARK_AND_CHARTER_REVIEW_2026-08-07.md`
> - `AGENT_EXECUTION_V8_SSOT.md`

## 1. Strategic decision

Consultify will not reproduce Harvey as a legal-document agent.

Consultify Agent will be a governed transformation executor capable of carrying one business intent through its full lifecycle:

`signal or idea -> understanding -> analysis -> decision -> initiative -> execution -> measurement -> benefits -> sustainability -> transformation learning`

The Agent must support many valid sources of work:

- ideas and idea lists;
- assessments;
- consulting tools and tool sessions;
- audits;
- interviews and surveys;
- notes and meetings;
- financial analyses and business cases;
- KPI and operational signals;
- risks, incidents and compliance findings;
- client requests and management decisions;
- existing initiatives, tasks and reports.

It must also support many output representations of the same governed truth:

- decision brief;
- initiative;
- roadmap and execution plan;
- task and milestone set;
- report;
- presentation;
- spreadsheet or operational table;
- management summary;
- client-facing material;
- implementation status and benefits-realization review;
- reusable organizational knowledge and process template.

The canonical value is not any one file. The canonical value is preserved lineage from source through action to measured outcome.

## 2. Delivery principle

We will not build the whole architecture first and demonstrate value later.

We will repeatedly walk real tasks through the product. Each iteration adds only the smallest missing contract or code required to move the selected task one verified step forward.

Canonical loop:

`choose one task -> observe current behavior -> freeze one missing contract -> implement the smallest vertical slice -> verify canonical readback -> show result -> decide next slice`

Every loop must end with a user-visible checkpoint. No loop may silently expand into another epic.

## 3. Documentation package that must exist

### DOC-01 — Product Charter and whole-module DoD

**Purpose:** Define mission, scope, autonomy, actors, non-goals, system DoD and product epics.

**State:** Existing, proposed for review.

**Next action:** Incorporate approved Harvey benchmark amendments, including intake contracts, professional review, protected reruns, dependency freshness and shared spaces.

### DOC-02 — Transformation Lifecycle Canon

**Purpose:** Define the end-to-end consulting transformation lifecycle owned by Agent.

Must define:

- stages from source signal to sustained outcome;
- valid entry and exit points;
- required artifacts and owners per stage;
- business and governance gates;
- how multiple source types converge into ideas, decisions and initiatives;
- how execution and financial realization return evidence to the transformation record;
- closure, sustainability and learning semantics;
- rules for returning to an earlier stage.

This becomes the primary business map above technical execution states.

### DOC-03 — Source-to-Outcome and Artifact Lineage Matrix

**Purpose:** Map every source family to possible transformations, canonical artifacts and output variants.

Required columns:

- source type and module;
- source state and minimum quality;
- possible Agent intents;
- intermediate artifacts;
- allowed proposals and mutations;
- required approver;
- target artifacts/modules;
- output formats/views;
- evidence and lineage rules;
- measurable outcome and closure evidence.

### DOC-04 — Golden Flow Library

**Purpose:** Describe acceptance-grade real tasks that drive incremental implementation.

Each golden flow must contain:

- actor and business outcome;
- starting module, route and source state;
- required context and permissions;
- numbered user/Agent interactions;
- proposals and approval points;
- canonical mutations;
- failure, partial, blocked and resume paths;
- final artifacts and alternative output variants;
- exact DoD and evidence plan.

Initial library:

1. idea -> decision-ready initiative;
2. assessment/tool/audit findings -> prioritized transformation backlog;
3. financial analysis -> business case -> decision -> approved initiative;
4. initiative -> execution plan -> tasks -> monitoring -> benefits realization;
5. multiple initiatives -> transformation roadmap and steering materials;
6. KPI deterioration -> diagnosis -> corrective initiative -> measured follow-up;
7. high-volume evidence review -> verified findings -> advisory output.

### DOC-05 — Agent Capability and Tool Registry

**Purpose:** Establish honest executable capability truth.

For every capability:

- canonical action type;
- owning module and service;
- read or mutation class;
- input/output schema;
- permission and tenant rules;
- risk and approval class;
- idempotency and retry behavior;
- preview support;
- canonical readback method;
- rollback or compensation;
- test and runtime evidence state;
- status: `REAL`, `PARTIAL`, `PROPOSAL_ONLY`, `NOT_CONNECTED`, `NOT_IMPLEMENTED`.

### DOC-06 — Run, Plan, Proposal, Approval and Review Contract

**Purpose:** Freeze the common runtime language before converging existing engines.

Must include:

- execution and business lifecycle states;
- typed intake contract;
- plan and step graph;
- proposal, preview and affected-artifact contract;
- item-level review versus formal approval;
- partial approval and expiry;
- dependency invalidation and stale states;
- protected human edits and verified-result preservation;
- execution result, validation result and audit event;
- cancel, retry, resume and compensation semantics.

### DOC-07 — Agent Definition and Process Template Contract

**Purpose:** Define reusable Agent/process products.

Must include:

- definition lifecycle: draft, test, review, publish, supersede, deprecate;
- owner and organizational scope;
- input and output contracts;
- blocks, conditions, branches and references;
- tools and autonomy level;
- embedded templates, golden examples and default context;
- retrieval policy;
- evaluation pack;
- version binding for every run;
- sharing and publication permissions.

### DOC-08 — UX and Information Architecture Contract

**Purpose:** Define where users start, monitor, review and reuse Agent work.

Must cover:

- Teresa contextual intake;
- My Work Agent hub;
- process workshop;
- run progress and checkpoint view;
- proposal and approval view;
- professional review workbench;
- outputs and lineage view;
- templates/library;
- notifications and recovery;
- shared consulting spaces;
- light/dark, responsive, accessibility and PL/EN states.

### DOC-09 — Evaluation and Acceptance MDK

**Purpose:** Establish evidence required to claim each capability works.

Separate truth registers:

- contract;
- implementation;
- unit/integration tests;
- real runtime and queue;
- real database persistence/readback;
- permissions and tenant isolation;
- information architecture;
- UI and visual evidence;
- task-family quality evaluation;
- canonical SHA and branch lineage.

### DOC-10 — Increment Ledger and Decision Log

**Purpose:** Keep development visible and bounded.

Each increment records:

- increment ID and golden-flow step;
- exact outcome promised;
- files and systems in scope;
- assumptions and product decisions;
- before evidence;
- implemented delta;
- tests and runtime evidence;
- remaining gap;
- review decision: accept, revise or stop;
- next proposed increment.

This ledger is updated after every increment, not at the end of an epic.

## 4. Working cadence

### 4.1 One increment

An increment should normally contain one user-observable transition, for example:

- attach one source artifact to a run;
- generate and persist one typed proposal;
- approve one proposal;
- create one Initiative through its owning service;
- read the Initiative back and show lineage;
- mark one downstream output stale after source change.

An increment must not contain an entire platform epic.

### 4.2 Required checkpoint sequence

For every increment:

1. **Current truth** — inspect current SHA, worktree, route, service, schema, tests and runtime.
2. **Micro-contract** — write the exact input, state transition, output and DoD.
3. **Product checkpoint** — show the proposed behavior when it changes UX, governance or domain meaning.
4. **Small implementation** — change the minimum necessary code.
5. **Narrow verification** — unit/contract/integration tests for the delta.
6. **Runtime proof** — real service, database and artifact readback when the increment mutates state.
7. **Visible proof** — screenshot or recorded state for UI changes.
8. **Checkpoint report** — outcome, evidence, limitations and next choice.
9. **Stop** — do not automatically start the next increment without a clear continuation decision.

### 4.3 Communication rule

No long silent coding phase.

During active work:

- communicate after discovery;
- communicate before a material product/architecture decision;
- communicate after the first executable proof;
- communicate immediately when blocked or when scope wants to expand;
- finish each increment with a self-contained acceptance checkpoint.

### 4.4 Size limit

Default increment limit:

- one golden-flow transition;
- one primary runtime contract;
- one owning adapter/module;
- one acceptance proof pack;
- no unrelated cleanup;
- no second epic hidden inside refactoring.

If the increment cannot be described in one short paragraph, it must be split.

## 5. First implementation journey

### Selected journey

`Idea -> evidence-backed proposal -> Initiative draft -> human review -> canonical Initiative creation -> lineage readback`

Why first:

- it expresses Consultify's differentiator better than document generation;
- Ideas and Initiatives already exist as product concepts;
- it proves movement between modules;
- it requires evidence, proposal, approval, mutation and lineage;
- it is bounded enough to implement step by step;
- later assessment, tool, audit and finance sources can enter the same convergence path.

### Journey increments

#### INC-A001 — Bind an Idea as Agent run source

Outcome:

- user starts from an Idea or references it in Teresa;
- run stores organization, project, idea and source-version context;
- UI shows the source binding;
- no mutation occurs.

#### INC-A002 — Produce an Initiative Candidate proposal

Outcome:

- Agent converts Idea plus permitted evidence into a typed candidate;
- missing information, assumptions and unsupported claims are explicit;
- proposal is persisted and previewable;
- no Initiative exists yet.

#### INC-A003 — Review and refine candidate fields

Outcome:

- user edits or regenerates individual fields;
- verified manual fields are protected;
- source changes mark dependent fields stale;
- review state remains distinct from approval.

#### INC-A004 — Approve selected Initiative creation

Outcome:

- authorized user approves the exact proposal version;
- rejected or deferred fields remain visible;
- approval record captures actor, scope, version and timestamp;
- approval does not yet claim execution.

#### INC-A005 — Execute through Initiative adapter

Outcome:

- orchestrator calls the Initiative owning service;
- tenant, permission and workflow validations run server-side;
- operation is idempotent;
- canonical Initiative is created once.

#### INC-A006 — Validate readback and lineage

Outcome:

- created Initiative is read from canonical storage;
- Idea, evidence, proposal, approval, run and Initiative references are linked;
- Agent reports actual applied and unapplied changes;
- UI can navigate from source to result and back.

#### INC-A007 — Add alternative output variants

Outcome:

- the same governed candidate can produce a decision brief, one-page summary or presentation outline;
- variants share canonical facts and lineage;
- variants do not fork business truth.

### First-journey acceptance gate

The journey is accepted only when:

- all increments work on one current canonical candidate;
- real PostgreSQL persistence and readback are proven;
- unauthorized and cross-tenant access are rejected;
- retry does not duplicate the Initiative;
- source change invalidates affected candidate fields;
- user-visible states distinguish draft, reviewed, approved, executed and verified;
- visual evidence covers the complete flow;
- no manual database write is required.

## 6. Subsequent journeys

After the first journey is accepted, reuse the same spine in this order:

1. `Assessment/Tool/Audit -> Idea or Initiative Candidate`;
2. `Financial Analysis -> Business Case -> Decision -> Initiative`;
3. `Initiative -> Tasks/Milestones/Risks/KPIs`;
4. `Execution -> Results -> Benefits Realization`;
5. `Benefits -> Sustainability Review -> Transformation Learning`;
6. `Portfolio of initiatives -> Roadmap -> Report/Deck/Table variants`;
7. `Recurring monitoring -> Exception -> Corrective proposal`;
8. `High-volume sources -> Review Workbench -> Verified synthesis`.

Each journey adds adapters and capabilities only when demanded by its next real transition.

## 7. Documentation and coding order

### Phase 0 — Product freeze

Create or finalize:

1. DOC-01 Charter amendments;
2. DOC-02 Transformation Lifecycle Canon;
3. DOC-03 Source-to-Outcome Matrix;
4. DOC-04 Golden Flow 1 in full detail.

No execution-spine refactor before these four are reviewed.

### Phase 1 — First micro-contract

Create the relevant slice of:

1. DOC-05 capability registry;
2. DOC-06 runtime contract;
3. DOC-09 acceptance MDK;
4. DOC-10 increment record for INC-A001.

Then implement INC-A001 only.

### Phase 2 — Walk the journey

For INC-A002 through INC-A007:

- extend documentation only for the next transition;
- implement the next smallest slice;
- verify and stop at the checkpoint;
- update ledgers immediately.

### Phase 3 — Generalize only after proof

After the first complete journey:

- identify duplicated local behavior;
- extract the stable shared contract;
- converge competing runtimes;
- do not generalize speculative capabilities that the journey did not exercise.

## 8. Rules preventing week-long invisible development

1. No task named “build Agent backend” or “finish orchestrator.”
2. Every task names one user transition and one observable result.
3. Discovery and implementation are separate checkpoints.
4. Architecture changes require a written micro-contract before code.
5. Each mutation increment requires canonical database readback.
6. Passing tests without runtime proof cannot close a mutation increment.
7. UI existence without working data cannot close a user-flow increment.
8. Refactoring is allowed only when necessary for the current transition.
9. New findings enter the backlog; they do not silently enlarge the active increment.
10. At every checkpoint Product can redirect, revise or stop the sequence.

## 9. Immediate next actions

1. Review and accept this operating plan.
2. Incorporate Harvey amendments into DOC-01.
3. Write DOC-02 Transformation Lifecycle Canon.
4. Build DOC-03 Source-to-Outcome Matrix.
5. Specify Golden Flow 1 and INC-A001 acceptance packet.
6. Inspect current Idea and Initiative runtime against INC-A001 only.
7. Return with the first implementation micro-contract before changing code.

## 10. Plan acceptance criteria

This operating plan is accepted when Product confirms:

- the transformation lifecycle is the Agent's primary business spine;
- `Idea -> Initiative` is the first implementation journey;
- the short-increment checkpoint model is mandatory;
- the listed ten documents are sufficient as the initial documentation system;
- implementation must stop after each increment for visible acceptance;
- generalization and runtime convergence happen only after the first vertical proof.

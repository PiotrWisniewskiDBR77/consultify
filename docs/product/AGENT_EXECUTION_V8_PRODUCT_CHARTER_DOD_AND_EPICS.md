# Agent Execution v8 — Product Charter, Definition of Done and Epics

> Status: `PROPOSED FOR PRODUCT REVIEW`

> Evidence-status note: this is the normative product target, not the current
> delivery register. Current status is maintained in
> `AGENT_EXECUTION_V8_EPIC_DOD_DELIVERY_MATRIX_2026-08-07.md`.
> Date: 2026-08-07
> Owner: Product + Engineering
> Scope: complete Consultify execution-agent product, not one implementation wave
> Parent SSOT: `docs/product/AGENT_EXECUTION_V8_SSOT.md`

## 0. Purpose and authority

This document freezes the product intent before further implementation work. It defines:

- why the Agent module exists;
- what complete user outcome it owns;
- what it may and may not do;
- the system-level Definition of Done;
- the product epics required to deliver the whole capability;
- representative end-to-end task epics proving that the design works for real consulting work.

This document is normative for product scope and acceptance. It does not replace detailed runtime schemas, security policies or module SSOTs. Where documents differ:

1. this charter owns the complete product outcome and whole-module DoD;
2. `AGENT_EXECUTION_V8_SSOT.md` owns execution lifecycle and domain semantics;
3. cross-cutting V8 architecture owns workspace, knowledge, tools, background work, governance and trust;
4. module SSOTs and owning services own legal artifact mutations and workflow transitions.

Implementation activity, file count, UI presence or isolated green tests do not satisfy this charter without end-to-end evidence.

## 1. Product definition

### 1.1 One-sentence definition

Agent is Consultify's governed digital consulting executor: it converts a user's business goal into a bounded, reviewable and auditable body of work across the Consultify environment, while keeping the human accountable for material decisions.

### 1.2 Product mission

Enable a consultant, manager or client to express an outcome in natural language and have Consultify:

1. understand the goal and active organizational context;
2. identify missing information, constraints and decision rights;
3. create a transparent execution plan;
4. gather and evaluate evidence;
5. prepare typed changes and new artifacts across modules;
6. obtain the required human approvals;
7. execute approved work through owning module services;
8. monitor completion and exceptions;
9. leave durable results, provenance and audit history;
10. recommend the next responsible action.

### 1.3 User promise

The user should be able to say:

> I described the business outcome once. The Agent understood the context, showed me a credible plan, did the permitted work across Consultify, stopped where my decision was required, and left results I can inspect, edit, trust and reuse.

### 1.4 Business value

Agent should reduce:

- time between insight and governed execution;
- manual copying between notes, tools, reports, initiatives, tasks and decisions;
- loss of context between modules and people;
- untraceable AI output;
- coordination overhead in multi-step consulting work;
- forgotten follow-ups and stalled approvals.

Agent should increase:

- consultant leverage and consistency;
- quality and repeatability of methods;
- visibility of assumptions, evidence and risk;
- reuse of organizational knowledge;
- throughput of reviewable deliverables;
- accountability for decisions and execution.

## 2. Actors and accountability

### 2.1 Primary actors

- **Consultant** — frames work, supplies expertise, reviews and edits proposals.
- **Project Manager / PMO** — owns coordination, sequencing, resources and delivery control.
- **Sponsor / decision owner** — approves material business decisions and governance transitions.
- **Client contributor** — provides information and reviews permitted outputs.
- **Administrator / operator** — configures policies, models, tools, budgets and support controls.
- **Lead Execution Agent** — owns run planning, orchestration, synthesis and user communication.
- **Specialist agents** — perform bounded research, analysis, review or artifact preparation delegated by the lead.
- **Teresa as project lead** — turns the approved plan into a reviewable Project Team proposal, asks for every missing human identity or authority, coordinates approved human and specialist-agent work, and never invents membership or approves its own mandate.

### 2.2 Accountability rule

AI may recommend, prepare, validate and execute approved operations. AI must never impersonate the accountable human, approve a business gate, conceal uncertainty or claim a mutation that did not occur.

## 3. Scope of the complete module

### 3.1 In scope

- start from canonical Teresa chat and contextual module entry points;
- single-step and multi-step work;
- editable plans and reusable process templates;
- project-, workspace-, artifact- and selection-aware context;
- governed retrieval from user, project and organization knowledge;
- read, analysis, proposal and approved mutation tools;
- creation, update, linking, transformation and workflow-transition proposals;
- explicit previews, approvals, partial approvals and rejection;
- foreground, background, scheduled, paused and resumable runs;
- bounded multi-agent delegation;
- cross-module work through typed adapters;
- status, progress, notifications, exceptions and recovery;
- cost, token, time and tool budgets;
- provenance, confidence, validation, evidence and audit;
- user-visible history of plans, runs, outputs and decisions;
- operator diagnostics and supportability;
- Polish and English product behavior, accessibility and responsive layouts.

### 3.2 Out of scope

- unrestricted autonomous control of the application;
- hidden UI clicking as the canonical mutation mechanism;
- autonomous approval of investment, legal, people or governance decisions;
- bypassing module permissions, tenant boundaries or workflow gates;
- treating prose as proof that an operation completed;
- one giant prompt or transcript replay as the execution architecture;
- unconstrained agent swarms;
- an independent truth store competing with canonical Consultify artifacts;
- replacement of the consultant's professional judgement or accountability.

## 4. Operating doctrine

### 4.1 Canonical lifecycle

`understand -> clarify -> plan -> gather -> propose -> preview -> approve -> apply -> validate -> audit -> follow up`

Not every run requires every stage, but stages may not be silently conflated. In particular:

- proposed does not mean approved;
- approved does not mean executed;
- executed does not mean validated;
- generated text does not mean a canonical artifact exists;
- partial success does not mean complete.

### 4.2 Autonomy model

Autonomy is bounded by risk, policy and user intent:

- **A0 — advise:** answer and recommend only;
- **A1 — prepare:** research, analyze and create draft proposals;
- **A2 — execute safe work:** perform explicitly policy-allowed, reversible actions;
- **A3 — execute approved work:** apply material mutations after human approval;
- **A4 — monitor:** continue scheduled or event-driven work within an approved mandate.

Every run must expose its current autonomy level and escalation reason.

### 4.3 Artifact-native rule

Each material output must become or update a typed Consultify artifact with:

- stable identity;
- organization and project scope;
- owner and lifecycle state;
- source and evidence references;
- version or change history;
- originating run and proposal references.

### 4.4 Context continuity rule

A run must preserve and revalidate:

- organization and tenant;
- user identity, role and delegated authority;
- project and workspace;
- active artifact and selected objects;
- language, locale and user preferences;
- knowledge scopes and privacy mode;
- approved mandate, budget and tool scope.

### 4.5 Human control rule

The user can always:

- inspect the plan and current state;
- edit or narrow scope before execution;
- approve all, approve selected proposals, reject or request revision;
- pause or cancel permitted work;
- see what cannot be cancelled and why;
- recover or retry from a durable checkpoint;
- inspect outputs, sources, costs, errors and actors.

## 5. Whole-module Definition of Done

The Agent module is complete only when every gate below is satisfied on the same canonical release candidate.

### DoD-01 — Product and information architecture

- one product meaning of Agent is visible throughout Consultify;
- Teresa is the universal conversational intake surface;
- My Work contains the canonical operational surface for processes and runs;
- templates, active runs, approvals, history and outputs have understandable locations;
- audit agents, virtual workers and execution agents are not presented as interchangeable concepts;
- empty, loading, blocked, permission-denied, offline, partial and failed states are designed.

### DoD-02 — One durable execution truth

- every governed task has one durable run identifier;
- goal, context, plan, steps, proposals, approvals, executions and results are linked;
- lifecycle transitions are persisted and validated by a state machine;
- retries and resumes do not duplicate committed mutations;
- no production execution path creates an untracked competing run truth.

### DoD-03 — Planning and process design

- Agent can produce an editable plan from a natural-language outcome;
- plans expose assumptions, dependencies, risks, required inputs and approval checkpoints;
- users can add, remove, reorder and configure steps before launch;
- plan validation blocks impossible, unauthorized or circular execution graphs;
- reusable templates can be versioned, governed and instantiated without changing the source template;
- the plan clearly identifies read-only, additive, sensitive and destructive steps.

### DoD-04 — Knowledge and evidence

- retrieval is policy-filtered before ranking;
- user, project and organization scopes cannot leak into one another;
- sources used by steps and outputs are attributable;
- unsupported claims, stale sources and contradictory evidence are surfaced;
- working memory is bounded, checkpointed and resumable;
- the run can distinguish known facts, user assertions, assumptions and model inference.

### DoD-05 — Proposals, previews and approvals

- every material mutation is represented by a typed proposal;
- preview shows target, before/after, affected relations, risk and downstream impact;
- approve, partial approve, reject, revise and expire have durable semantics;
- approval records actor, authority, scope, timestamp and exact payload/version;
- changes after approval invalidate or rebaseline approval where required;
- business and governance gates always require an authorized human.

### DoD-06 — Cross-module execution

- one run can safely operate across at least five production modules;
- all canonical mutations use typed adapters and owning services;
- adapters enforce tenant, permission, validation and workflow rules;
- execution returns normalized success, partial-success, blocked and failed results;
- created and updated artifacts are readable back from canonical storage;
- rollback or compensating-action policy is defined for every mutation family.

### DoD-07 — Background, scheduled and resumable work

- runs survive browser closure, refresh, worker restart and process restart;
- schedules use explicit timezone and next-run semantics;
- pause, wait, approval and external dependency states are durable;
- resume revalidates context, permissions, inputs, target versions and approval validity;
- cancellation and timeout behavior are deterministic;
- users receive actionable progress and completion notifications.

### DoD-08 — Multi-agent work management

- the lead selects single-agent or multi-agent execution by explicit policy;
- delegation uses typed tasks, bounded context, budgets and tool permissions;
- dependencies, fan-out, merge, retry and cancellation are observable;
- specialist outputs include evidence and confidence;
- contradictions are resolved or escalated, not silently averaged;
- one lead synthesizes proposals and one approval surface remains canonical;
- tenant isolation is proven across all branches.

### DoD-09 — Safety, permissions and governance

- least-privilege tool access is enforced server-side;
- role and project membership are rechecked at execution time;
- destructive, sensitive, external and high-cost actions receive appropriate escalation;
- prompt injection and untrusted retrieved content cannot expand tool authority;
- secrets and restricted data are not placed in prompts, logs or user-visible traces;
- rate, cost, token, time and concurrency limits are enforced;
- security events and policy denials are auditable.

### DoD-10 — Trust, quality and validation

- the user can distinguish generated, proposed, approved, executed and verified states;
- output confidence and limitations are visible where relevant;
- deterministic calculations are verified outside free-form model narration;
- artifact validation runs after mutation;
- claims about completion are backed by canonical readback;
- quality evaluation covers correctness, completeness, evidence, policy compliance and usefulness;
- critical use cases have adversarial and regression evals.

### DoD-11 — UX, accessibility and language

- plan, progress, approval and result views work in light and dark themes;
- responsive desktop and supported mobile layouts are usable;
- keyboard navigation, focus, labels and screen-reader semantics meet the product accessibility standard;
- Polish and English labels are complete and use consulting language rather than technical tool names;
- long-running progress is understandable without reading logs;
- errors explain the failed layer and offer a safe next action.

### DoD-12 — Operations and supportability

- operators can inspect run state, checkpoints, proposals, tool calls, budgets and failures;
- correlation IDs link UI, API, queue, worker, adapter and audit events;
- health, latency, queue depth, failure rate, cost and approval-wait metrics exist;
- stuck-run detection and safe recovery procedures are documented and tested;
- retention, export, deletion and privacy rules are enforced;
- no support workflow requires editing production data manually.

### DoD-13 — Evidence and release acceptance

- contract tests prove schemas and state transitions;
- unit and integration tests prove policy, planner, adapters and idempotency;
- real PostgreSQL tests prove persistence, isolation and readback;
- real worker/queue tests prove background execution and recovery;
- real model tests prove structured planning and proposal generation with safety guards;
- end-to-end tests prove at least the five scenario epics below;
- visual evidence covers key states, both themes and required viewports;
- evidence is mapped to route, state, user role, organization, viewport and exact SHA;
- candidate is rebased on the current canonical branch and all gates rerun before acceptance.

### DoD-14 — Measurable product outcome

- users can complete the supported golden flows without manual cross-module copying;
- time-to-reviewable-output and time-to-approved-execution are measured;
- approval abandonment, failed runs, retries and human corrections are measured;
- no critical tenant, permission, duplicate-mutation or false-completion defect remains open;
- the product demonstrates material value over chat-only assistance in controlled evaluation.

## 6. Platform epics

### EPIC-A01 — Canonical Agent experience

**Goal:** Give users one understandable entry, workspace and history for all Agent work.

**Done when:** Teresa intake, My Work process/run management, templates, approvals, outputs and audit views use one vocabulary and one run identity.

The Transformation Case is also the canonical operational home of the approved Project Team: people, registered agents, roles, RACI/authority, autonomy, budgets, work/branch status, sources, costs, conflicts and pending decisions. Technical diagnostics remain in Admin/Operator views.

### EPIC-A02 — Execution run and state ledger

**Goal:** Establish one durable lifecycle for the entire body of work.

**Done when:** goal, context, plan, steps, checkpoints, transitions and final status survive restarts and are queryable without reconstructing truth from logs.

### EPIC-A03 — Intent, planning and process workshop

**Goal:** Turn an outcome into a bounded, editable and executable plan.

**Done when:** Agent can clarify ambiguity, generate steps, expose assumptions/dependencies, validate the graph and let the user edit it before launch.

Planning includes a versioned Teresa-led team blueprint. `UNKNOWN` sponsor, owners, participants, authority and agent limits remain explicit clarification keys; they are never inferred from names or conversational tone.

### EPIC-A04 — Knowledge, context and working memory

**Goal:** Ground each run in the correct tenant, project, artifact and evidence context.

**Done when:** policy-first retrieval, context snapshots, bounded working memory, source attribution and resume-time revalidation work end-to-end.

### EPIC-A05 — Proposal, preview and approval spine

**Goal:** Make all material AI actions understandable and governable before execution.

**Done when:** typed proposals, risk classification, before/after previews, partial approval, rejection, revision, expiry and approval invalidation share one contract.

### EPIC-A06 — Tool and adapter execution platform

**Goal:** Execute approved operations through safe module-owned capabilities.

**Done when:** a shared orchestrator dispatches idempotent actions to adapters, normalizes results and proves canonical storage readback.

Tenant/project A06 activation for a Project Team is permitted only after the exact team composition, RACI, authority, autonomy and budget limits have an approved A05 receipt.

### EPIC-A07 — Background, schedules, triggers and recovery

**Goal:** Support serious work that continues beyond one interactive request.

**Done when:** queues, schedules, waits, triggers, checkpoints, retry, resume, cancellation, timeout and notifications are durable and observable.

### EPIC-A08 — Multi-agent work manager

**Goal:** Decompose complex work into bounded specialist branches without losing control.

**Done when:** task graphs, delegation contracts, branch budgets, evidence returns, synthesis, contradiction handling and centralized approval are production-ready.

### EPIC-A09 — Governance, security and budget control

**Goal:** Ensure autonomy never exceeds the user's authority or approved mandate.

**Done when:** server-side permission, tool, risk, privacy, tenant, cost and injection protections are enforced across every execution path.

### EPIC-A10 — Trust, evaluation and validation

**Goal:** Make Agent outputs and completion claims verifiable.

**Done when:** provenance, confidence, deterministic validation, artifact readback, scenario evals and adversarial tests cover supported capabilities.

### EPIC-A11 — Operator console and observability

**Goal:** Make every run supportable in production.

**Done when:** operators can diagnose and safely recover runs using correlated state, metrics and audit records without direct data surgery.

### EPIC-A12 — Template and capability governance

**Goal:** Let organizations safely reuse consulting processes and agent configurations.

**Done when:** templates, tools, roles, models, prompts and policies are versioned, scoped, reviewable, publishable and deprecatable.

## 7. End-to-end task epics

These are not demos. Each epic is an acceptance-grade vertical slice spanning intake, knowledge, planning, proposals, approvals, execution, validation and audit.

### EPIC-U01 — From discovery evidence to governed initiative

**User outcome:** A consultant asks Agent to turn interviews, notes and tool outputs into a decision-ready initiative.

**Golden flow:**

1. Teresa binds the active client and project context.
2. Agent gathers permitted interview answers, notes, assessments and tool outputs.
3. Agent identifies evidence gaps and asks targeted clarification.
4. Agent prepares an initiative brief: problem, objective, scope, options, benefits, risks, owners and evidence.
5. Agent proposes creation of the initiative, linked tasks and required decision.
6. User reviews sources and edits the proposal.
7. Authorized user approves selected creations.
8. Agent creates artifacts through owning services and reads them back.
9. Run reports created links, rejected items, remaining gaps and next gate.

**Acceptance outcome:** No manual copying is required; every claim links to evidence; no governance transition is approved by AI.

### EPIC-U02 — From analysis to executive report and presentation

**User outcome:** A project manager asks Agent to produce an executive report and steering deck from current project truth.

**Golden flow:**

1. Agent scopes audience, reporting period and decision question.
2. It gathers approved KPIs, initiative status, RAID, decisions and source artifacts.
3. Specialist branches analyze performance, risks and inconsistencies.
4. Agent proposes report structure, narrative and deck storyline.
5. Preview exposes numbers, citations, missing data and slide/report deltas.
6. User approves the report and selected slides.
7. Agent creates or updates canonical report and presentation artifacts.
8. Deterministic checks validate figures across source, report and deck.
9. Agent records versions, provenance and unresolved issues.

**Acceptance outcome:** Report and deck remain numerically consistent, source-backed and editable; generated files alone are not treated as success without artifact readback.

### EPIC-U03 — Initiative planning and execution mobilization

**User outcome:** A sponsor asks Agent to turn an approved initiative into an executable delivery plan.

**Golden flow:**

1. Agent reads the approved initiative, constraints, owners and decision history.
2. Teresa proposes a versioned Project Team of verified humans and registered specialist agents together with workstreams, milestones, tasks, dependencies, resources, KPIs and risks.
3. She asks explicit clarification questions for every `UNKNOWN` sponsor, owner, participant, RACI authority, autonomy limit, budget or baseline.
4. User adjusts sequence and approves the exact composition, roles, RACI/authority, agent autonomy and budget limits.
5. Agent proposes task creation, calendar milestones, RAID entries and reporting cadence.
6. Authorized users approve material changes.
7. Agent creates the approved objects and links them to the initiative.
8. Agent monitors overdue inputs and blocked dependencies under an approved mandate.
9. Changes requiring a new governance decision return to review.

**Acceptance outcome:** The initiative becomes executable through an approved human+agent Project Team without fabricated membership or bypassing planning, authority, budget or investment gates, and all downstream work retains Case/Run/project lineage to the approved initiative.

### EPIC-U04 — Operational performance diagnosis and corrective action

**User outcome:** An operations consultant asks Agent to diagnose a deteriorating KPI and prepare corrective actions.

**Golden flow:**

1. Agent binds the KPI, time range, affected process and comparison baseline.
2. It retrieves table data, KPI history, process documentation, incidents and prior actions.
3. Specialist branches perform trend, root-cause and risk analysis.
4. Agent distinguishes evidence, correlation, hypothesis and missing measurement.
5. It proposes a diagnosis artifact, experiments, tasks and monitoring changes.
6. User approves safe experiments and task creation, rejecting unsupported actions.
7. Agent creates approved work and schedules follow-up measurement.
8. On the scheduled checkpoint it compares results with baseline.
9. Agent recommends continue, revise, escalate or close; a human decides.

**Acceptance outcome:** Agent does not fabricate causality, calculations are independently verified, and corrective actions remain linked to evidence and measured outcomes.

### EPIC-U05 — Decision preparation and governed approval

**User outcome:** A decision owner asks Agent to prepare a decision pack from conflicting evidence and stakeholder inputs.

**Golden flow:**

1. Agent frames the decision, owner, deadline, options and decision criteria.
2. It gathers permitted evidence and stakeholder positions.
3. Specialist branches assess finance, risk, delivery and organizational impact.
4. Contradictions and missing evidence are explicitly surfaced.
5. Agent proposes options, trade-offs, recommendation and conditions.
6. User reviews and edits the decision pack.
7. Agent may create the draft Decision artifact but cannot approve it.
8. Authorized decision owner records approve, reject, defer or request-more-evidence.
9. Agent executes only the downstream actions covered by the recorded decision.

**Acceptance outcome:** The decision remains human-owned, its evidence and rationale are durable, and downstream execution cannot precede the required decision.

### EPIC-U06 — Recurring project governance and exception management

**User outcome:** PMO asks Agent to run a recurring weekly governance cycle for a portfolio or project.

**Golden flow:**

1. PMO defines scope, schedule, thresholds, recipients, tool permissions and budget.
2. Agent snapshots the approved recurring mandate.
3. On schedule it gathers current initiative, task, KPI, risk, budget and decision data.
4. It detects exceptions, stale inputs and cross-artifact inconsistencies.
5. Agent prepares a status report and proposals for reminders, tasks or escalations.
6. Policy-allowed notifications may run automatically; material changes wait for approval.
7. Failures and missing systems create explicit blocked states, not silent zeros.
8. Each cycle has its own run linked to the recurring definition.
9. PMO can pause, change or revoke the mandate for future cycles.

**Acceptance outcome:** Recurring work is durable, timezone-correct, auditable and bounded; the Agent never expands its mandate from one cycle to the next.

## 8. Epic dependency order

Recommended sequencing:

1. `A01 + A02 + A03` — one experience, run truth and planning contract;
2. `A04 + A05 + A09` — grounded context, approvals and safety;
3. `A06` — first real module adapters and canonical readback;
4. `U01` — first cross-module vertical proof;
5. `A07 + A10 + A11` — durable operation, trust and supportability;
6. `U02 + U03 + U05` — reports, mobilization and decisions;
7. `A08` — multi-agent expansion after single-lead execution is trustworthy;
8. `U04 + U06` — analytical follow-up and recurring autonomous work;
9. `A12` — organization-scale template and capability governance hardening.

This order does not authorize implementation. Each implementation package still requires a bounded contract, clean lineage, exact acceptance evidence and product review.

## 9. Product success measures

Minimum product metrics:

- percentage of runs reaching a reviewable proposal;
- percentage completed without manual cross-module copying;
- median time from goal to first reviewable plan;
- median approval waiting time;
- successful, partial, blocked, failed and cancelled run rates;
- retry and duplicate-mutation rates;
- percentage of material outputs with valid source lineage;
- human correction rate by artifact and action type;
- cost and latency per completed business outcome;
- tenant/security incidents and permission-denial correctness;
- user-rated usefulness, trust and control;
- measurable time saved against the equivalent non-Agent workflow.

Success is not measured by message count, tool calls, generated files or number of specialist agents.

## 10. Decisions required before implementation freeze

The following require explicit Product decision:

1. Confirm that the external benchmark meant by “Halway” is Harvey, or identify the intended product.
2. Confirm the initial five production modules for adapter acceptance.
3. Confirm which A2 safe actions may execute without per-action approval.
4. Confirm whether `completed_with_errors` can ever represent business completion or must remain partial.
5. Confirm the first production golden flow: recommended `U01 — discovery evidence to governed initiative`.
6. Confirm retention and visibility rules for user-, project- and organization-scoped run history.
7. Confirm which recurring notifications may be policy-auto-executable.

## 11. Charter acceptance gate

This charter becomes `ACCEPTED` only when Product confirms:

- mission and user promise;
- complete scope and explicit non-goals;
- autonomy and human-accountability model;
- all fourteen system-level DoD gates;
- platform epic map;
- at least five end-to-end task epics;
- initial vertical slice and adapter scope;
- unresolved decisions in section 10.

Until then, implementation may be audited and explored, but architectural convergence should not be declared complete.

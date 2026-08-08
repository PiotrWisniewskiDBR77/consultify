# Agent Transformation Lifecycle Canon v1

> Status: `PROPOSED FOR OWNER REVIEW`

> Evidence-status note: this remains the normative lifecycle contract. Current
> implementation status is governed by the delivery matrix and
> `epics/evidence/T01_FINAL_DOD_AUDIT_2026-08-07.md`.
> Date: 2026-08-07
> Owner: Product + Engineering
> Scope: business lifecycle orchestrated by Teresa and Agent across Consultify
> Runtime parent: `AGENT_EXECUTION_V8_SSOT.md`

## 1. Canonical purpose

Agent exists to carry a business transformation from an initial mandate or signal to verified and sustained value. It does not merely generate a plan or a document.

Canonical business lifecycle:

`mandate -> discovery -> diagnosis -> opportunity system -> decision -> initiative portfolio -> mobilization -> execution -> measurement -> benefits -> sustainability -> transformation learning`

The lifecycle is business truth. The execution-run state machine is technical truth. One transformation may contain many runs, but every run must identify which transformation stage and outcome it serves.

## 2. Canonical transformation objects

### 2.1 Transformation Case

One durable envelope for the complete transformation. It contains references rather than copies of canonical module objects.

Required identity:

- `transformationCaseId`;
- organization, project and client scope;
- transformation mandate and sponsor;
- lead consultant and accountable owners;
- expected outcomes and horizon;
- source and evidence registry;
- stage and stage history;
- linked Agent runs;
- idea, interview, assessment, decision, initiative, execution, finance, KPI and output references;
- approval and exception history;
- benefits and sustainability state;
- final closure and lessons learned.

### 2.2 Transformation Plan

A versioned, human-reviewable plan created by Agent and approved before material execution. It defines:

- selected methodology or hybrid method;
- stages and dependency graph;
- inputs, owners and deliverables;
- tools, modules and knowledge sources;
- human activities such as interviews and workshops;
- proposals and expected mutations;
- approval checkpoints;
- time, cost and capacity assumptions;
- success measures;
- error, pause, retry and rebaseline paths.

### 2.3 Management Case

Versioned decision context for one material idea or initiative:

- problem/opportunity;
- evidence for and against;
- options including `do nothing`;
- assumptions and unknowns;
- feasibility, risk and change impact;
- financial case;
- KPI contract;
- human reviews and decisions;
- execution baseline and actual outcomes.

### 2.4 Lineage graph

All transformations use one graph linking:

`source -> finding -> insight -> idea -> option -> decision -> initiative -> execution object -> KPI/financial actual -> output -> lesson`

No output may become an independent business truth detached from this graph.

## 3. Stage model

### T0 — Mandate and contracting

**Purpose:** Establish why the transformation exists and what authority Agent has.

Inputs:

- Teresa request;
- active organization/project context;
- sponsor or request owner;
- initial problem, ambition or outcome.

Agent responsibilities:

- frame goal, scope, horizon, stakeholders and exclusions;
- identify confidentiality, budget and autonomy constraints;
- propose success definition and required decisions;
- create Transformation Case and draft Transformation Plan.

Gate T0:

- mandate owner confirms scope;
- material assumptions are visible;
- Agent tool, data and mutation authority is bounded;
- no diagnosis or write activity begins outside the approved mandate.

### T1 — Discovery and evidence intake

**Purpose:** Establish current knowledge and design information gathering.

Sources may include:

- existing Ideas and notes;
- assessments and consulting-tool outputs;
- audits and findings;
- documents, reports and Vault sources;
- organization/project knowledge;
- previous initiatives, decisions and results;
- financial and KPI data.

Agent responsibilities:

- build source inventory and provenance;
- classify fact, opinion, assumption and inference;
- identify contradictions and evidence gaps;
- design interviews, surveys, workshops or document reviews;
- assign owners for missing evidence.

Gate T1:

- evidence scope is approved;
- restricted sources remain restricted;
- missing critical evidence is blocked or explicitly waived;
- discovery completeness is sufficient for diagnosis.

### T2 — Interviews and stakeholder understanding

**Purpose:** Gather structured human knowledge and validate problem framing.

Agent responsibilities:

- prepare interview goals, participant map and question sets;
- create assignments and sessions through Interview services;
- support answer collection without fabricating respondent statements;
- produce draft findings and insights with citations;
- expose contradictions and request participant/client readback;
- preserve respondent privacy and verification status.

Gate T2:

- required interviews are completed or explicitly waived;
- material insights are human-confirmed;
- quotes and conclusions retain source lineage;
- unresolved contradictions remain visible.

### T3 — DRD and complementary diagnosis

**Purpose:** Produce an evidence-backed view of current state, maturity gaps and target ambition.

Agent responsibilities:

- instantiate DRD under the canonical methodology version;
- bind existing evidence and interview inputs;
- coordinate missing assessments;
- propose achieved/target levels but never self-approve scores;
- run deterministic scoring and normalization;
- prepare eight-dimension reporting view from the canonical measurement layer;
- generate findings, gaps, hypotheses and candidate improvement directions.

Gate T3:

- DRD structure and methodology version are recorded;
- every accepted score has evidence and human acceptance;
- calculations come from deterministic services;
- gaps distinguish observed state, interpretation and recommendation;
- diagnosis is approved for opportunity design.

### T4 — Opportunity system and idea portfolio

**Purpose:** Convert evidence and gaps into a broad, structured solution space before selecting initiatives.

Agent responsibilities:

- create and consolidate Ideas from DRD, interviews, tools, audits, finance and KPI signals;
- preserve many-to-many source lineage;
- detect duplicates, dependencies, conflicts and complementary ideas;
- generate alternatives and `do nothing` where appropriate;
- place ideas into mind map, whiteboard, process flow or table views without forking truth;
- prepare prioritization criteria and evidence confidence.

Gate T4:

- the opportunity set is broad enough to avoid solution anchoring;
- duplicates are merged or linked;
- every promoted candidate has an owner, source, expected outcome and evidence;
- rejected/deferred ideas retain rationale.

### T5 — Options, finance, KPI and decision preparation

**Purpose:** Determine which transformation choices deserve investment.

Agent responsibilities:

- prepare Management Cases for material options;
- compare value, cost, risk, reversibility, feasibility and time to value;
- build Finance models through canonical Finance services;
- define KPI baselines, targets, formulas, cadence and owners;
- perform deterministic ROI/NPV/scenario calculations;
- challenge assumptions and prepare sensitivity analysis;
- create Decision Briefs with evidence for and against.

Gate T5:

- financial mechanics and KPI formulas are independently validated;
- source data and assumptions are attributable;
- decision owner sees alternatives and uncertainty;
- AI does not approve investment or business gates.

### T6 — Initiative portfolio and governance decisions

**Purpose:** Register selected changes as governed Initiatives.

Agent responsibilities:

- produce typed Initiative Candidate proposals;
- check duplicates and portfolio overlap;
- propose scope, owner, sponsor, outcomes, dependencies, risks and change impact;
- link Finance and KPI contracts;
- submit exact proposal versions to authorized reviewers;
- register only approved Initiatives through owning services.

Gate T6:

- Source Validation, Definition and Portfolio Decision semantics are satisfied;
- each Initiative has one lineage to its sources and decisions;
- approval is durable and version-bound;
- rejected, merged and deferred candidates remain auditable.

### T7 — Mobilization and execution baseline

**Purpose:** Turn approved Initiatives into executable work with accountable resources.

Agent responsibilities:

- prepare Execution blueprint, workstreams, milestones and Tasks;
- establish RAID, decision cadence, owners and dependencies;
- validate capacity, budget and schedule feasibility;
- create approved execution objects through owning services;
- preserve approved scope, financial anchors and KPI contract in handoff snapshot.

Gate T7:

- schedule/capacity commitment is human-approved;
- every critical deliverable has owner and DoD;
- baseline and tolerances are immutable by version;
- start authorization is distinct from Initiative approval.

### T8 — Execution management and controlled intervention

**Purpose:** Deliver transformation outputs while preserving governance and traceability.

Agent responsibilities:

- monitor milestones, blockers, risks, decisions, budget and dependencies;
- prepare status summaries and exception proposals;
- execute policy-allowed reminders or approved corrective actions;
- request decisions for scope, baseline, budget or KPI changes;
- maintain actual versus baseline and intervention effectiveness;
- never conceal failed, skipped or blocked work.

Gate T8:

- deliverables have acceptance evidence;
- open risks and exceptions are explicit;
- operational handover is prepared;
- delivery is not misreported as benefit achievement.

### T9 — Results, finance actuals and benefits realization

**Purpose:** Verify whether delivered changes produced the expected business result.

Agent responsibilities:

- read KPI actuals and Finance actuals from canonical storage;
- compare baseline, target, forecast and actual;
- distinguish delivery variance from benefit variance;
- propose corrective Tasks, Decisions or Initiatives;
- prepare effectiveness review with evidence and confidence.

Gate T9:

- Benefit Owner verifies measurement window and data quality;
- effectiveness is classified `confirmed`, `partial` or `not_achieved`;
- ROI/NPV claims use verified actuals;
- missing data is never represented as zero.

### T10 — Sustainability and transformation learning

**Purpose:** Confirm the result persists and convert verified experience into reusable organizational capability.

Agent responsibilities:

- schedule sustainability review after the initial effect window;
- inspect adoption, process control, ownership, competencies and KPI stability;
- identify regression or unintended effects;
- prepare closure Decision and lessons learned;
- propose, but never automatically publish, reusable knowledge or template improvements.

Gate T10:

- accountable owner accepts closure or corrective continuation;
- sustained outcome has evidence across the agreed period;
- lessons distinguish transferable knowledge from client-specific data;
- transformation closes with complete lineage and retention policy.

## 4. Canonical entry points

A transformation may start from:

- a free-form Teresa mandate;
- Idea;
- Interview finding or insight;
- DRD/Assessment gap;
- consulting-tool output;
- Audit finding;
- Finance scenario or deviation;
- KPI deviation;
- Decision;
- existing Initiative requiring redesign;
- recurring governance trigger.

Entry at a later stage does not erase earlier obligations. Agent must reuse existing valid artifacts or explicitly create/waive missing prerequisites.

## 5. Output variants

One transformation truth may render as:

- live Transformation Case;
- management dashboard;
- Initiative portfolio/table;
- roadmap;
- Decision Brief;
- financial workbook;
- KPI scorecard;
- Word report;
- PowerPoint steering or client deck;
- executive one-pager;
- recurring progress update.

Every variant must expose source transformation, generation run, artifact version and freshness. Editing narrative in one variant must not silently change canonical business objects.

## 6. Cross-stage invariants

1. One organization and tenant context per Transformation Case.
2. One durable lineage graph across all stages.
3. AI proposes; authorized humans decide material gates.
4. Teresa may lead project coordination only through a versioned, human-approved Project Team blueprint; human membership and specialist-agent identity must be canonically verified, while missing identity or authority remains `UNKNOWN`.
5. Every mutation uses an owning service and canonical readback.
6. Every number comes from a deterministic source or is labeled an estimate.
7. Source, assumption, inference and human decision remain distinguishable.
8. Approved or verified human work is protected during rerun.
9. Changed upstream inputs mark dependent objects and outputs stale.
10. `delivered` never means `benefit achieved`.
11. `benefit achieved` never means `sustained` before the sustainability window.
12. Partial, failed, blocked, waived and skipped work remains visible.
13. Word/PPT output is not completion without underlying artifact and business-state readback.

## 7. Lifecycle-level Definition of Done

The lifecycle is implemented only when one Transformation Case proves all of the following on one canonical SHA:

- Teresa creates a reviewable Transformation Plan from a user mandate;
- Teresa proposes a versioned Project Team, asks for missing sponsor/owner/participant facts, and receives human approval for exact people, agents, RACI/authority, autonomy and budgets before A06 activation;
- Agent executes the approved stages across the required production modules;
- interviews contain real assignments, answers and reviewed insights;
- DRD contains deterministic scores with evidence and acceptance;
- Idea portfolio is persisted and source-linked;
- Initiatives are created and governed through canonical services;
- execution plans, Tasks, risks, milestones and decisions are durable;
- Finance model and KPI card are persisted, calculated and read back;
- benefits and sustainability states are distinct and evidenced;
- Word and PowerPoint outputs are generated from the same canonical facts;
- approvals, failures, costs, actors, sources and mutations are auditable;
- permissions, tenant isolation, retry/idempotency and resume are proven;
- final evidence pack maps every claim to route, state, artifact, viewport and SHA.

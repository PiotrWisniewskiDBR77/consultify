# EPIC-AGENT-T01 — Teresa-to-Transformation End-to-End

> Status: `PROPOSED FOR OWNER REVIEW`
> Priority: `P0 NORTH STAR`
> Owner: Product + Engineering
> Entry: Teresa canonical chat
> Completion: verified sustained transformation plus Word and PowerPoint outputs
> Lifecycle: `AGENT_TRANSFORMATION_LIFECYCLE_CANON_V1.md`

## 1. Epic goal

From one user request in Teresa:

> Hej, przygotuj plan transformacji dla tej organizacji.

Teresa and Agent must create, present, obtain approval for and execute a complete governed transformation process. The process must gather evidence, create an idea system, conduct interviews, run DRD, prepare and govern Initiatives, mobilize and manage execution, create Finance and KPI artifacts, verify results and produce final Word and PowerPoint deliverables from the same canonical transformation truth.

The epic is not complete when Agent draws a plan. It is complete when the approved plan has been executed and its results are persisted, read back, validated and presented with full lineage.

## 2. User outcome

The user can truthfully say:

> I gave Teresa the desired transformation outcome. She designed the complete process, showed assumptions and approvals, and Agent carried the work through Consultify. I can inspect every source, interview, DRD result, idea, decision, Initiative, execution item, financial calculation and KPI. The final Word report and PowerPoint deck agree with those records and show what was delivered, what result was achieved and what remains open.

## 3. Primary actors

- Transformation Sponsor — owns mandate and material decisions;
- Lead Consultant — owns professional quality and client engagement;
- Client Participants — contribute interview and evidence inputs;
- Initiative Owners — own defined change outcomes;
- Execution Manager — owns delivery baseline and execution;
- Finance Reviewer — validates assumptions and financial mechanics;
- KPI/Benefit Owner — validates measurement and realized value;
- Teresa — conversational intake, explanation and checkpoint surface;
- Lead Execution Agent — plan and run orchestrator;
- Specialist agents — bounded research, interview, DRD, finance, KPI, review and output preparation roles.

## 4. Starting conditions

Required:

- authenticated user;
- organization context;
- project/client workspace or explicit creation proposal;
- permission to create a draft Transformation Case;
- canonical Teresa conversation;
- at least a mandate, organization and desired outcome.

Optional:

- existing documents and Vault sources;
- existing assessments, ideas, audits, initiatives, reports or financial data;
- selected artifact/module context;
- client participants and project team;
- target date and budget.

Missing optional input must not be invented. Agent marks assumptions and proposes collection tasks.

## 5. Target user flow

### Flow 1 — Teresa receives the mandate

User:

> Hej, przygotuj plan transformacji dla tej organizacji. Chcemy poprawić efektywność operacyjną, cyfryzację procesów i zdolność wykorzystania AI.

Teresa must:

1. bind organization, project and active context;
2. restate the desired business outcome;
3. identify sponsor, horizon, major constraints and available sources;
4. distinguish confirmed facts from assumptions;
5. ask only questions that materially affect process, safety or outcome;
6. create a durable draft Transformation Case;
7. start an Execution Agent Run linked to the conversation and case.

Visible result:

- mandate summary;
- assumptions and missing inputs;
- autonomy, data and tool scope;
- link to Transformation Case;
- status `draft_intake`.

### Flow 2 — Agent paints the complete Transformation Plan

Agent selects or adapts the transformation methodology and prepares the whole process before execution.

The plan must contain:

1. contracting and success definition;
2. source/document intake;
3. initial idea inventory;
4. stakeholder interviews;
5. DRD assessment;
6. synthesis of gaps and opportunities;
7. idea consolidation and prioritization;
8. Finance and KPI preparation;
9. Initiative Candidate generation;
10. portfolio and governance decisions;
11. execution mobilization;
12. monitoring and exception management;
13. delivery acceptance;
14. benefits and sustainability review;
15. Word report and PowerPoint generation.

For every step user sees:

- business purpose;
- inputs and sources;
- human owner;
- Agent role and permitted tools;
- module and target artifacts;
- dependencies;
- outputs;
- approval requirement;
- expected effort/cost;
- failure and recovery path.

User may edit, reorder, add, remove or condition steps. Changes appear as a structural diff. Approval binds exact plan version.

### Flow 3 — Source inventory and initial Ideas

Agent reads permitted existing sources and creates an initial opportunity inventory.

It must:

- import or link existing Ideas;
- propose new Ideas from source evidence;
- keep each Idea in draft/proposal state until reviewed;
- capture problem/opportunity, expected outcome, evidence, confidence and owner;
- identify duplicates and relationships;
- create alternative visualizations—list, mind map, whiteboard, process map—over the same canonical Idea records.

The user reviews and verifies the initial idea space before diagnosis deepens it.

### Flow 4 — Interview design and execution

Agent prepares a stakeholder map and Interview Plan.

It must:

- propose participants based on role and transformation scope;
- create interview assignments only after approval;
- generate goal-specific questions using approved templates;
- support scheduling/distribution through connected channels when authorized;
- collect real responses or explicitly mark missing responses;
- transcribe where permitted;
- extract findings and insights with source citations;
- request respondent/client readback for material conclusions;
- preserve privacy and access restrictions.

Completion requires actual reviewed interview artifacts, not generated example answers.

### Flow 5 — DRD preparation and assessment

Agent instantiates the canonical DRD methodology version.

It must:

- use the canonical seven-axis, 39-area measurement structure;
- render the canonical eight reporting dimensions;
- bind interview and documentary evidence to assessment areas;
- propose achieved and target levels with evidence;
- assign missing questions/evidence to responsible humans;
- require human acceptance for scored areas;
- compute scores deterministically;
- generate gap analysis and transformation directions;
- record methodology, scoring and evidence versions.

No model-generated number may replace the scoring engine.

### Flow 6 — Synthesis and enriched Idea portfolio

Agent combines:

- original Ideas;
- Interview findings and insights;
- DRD gaps;
- consulting-tool outputs;
- audit findings;
- financial and KPI signals;
- organization knowledge.

It must:

- generate missing improvement Ideas;
- maintain many-to-many lineage;
- cluster by transformation theme;
- expose supporting and contradicting evidence;
- merge duplicates without deleting source history;
- prepare dependencies and sequencing;
- propose shortlist and defer/reject reasons;
- keep `do nothing` and pilot options where material.

### Flow 7 — Finance model and KPI contract

Before material Initiative approval, Agent prepares financial and measurement truth.

Finance must include where applicable:

- investment and operating costs;
- benefits by category and timing;
- cash-flow assumptions;
- ROI, NPV, payback and scenario/sensitivity analysis;
- confidence and source lineage;
- deterministic calculation validation;
- Finance Reviewer approval.

KPI card must include:

- business outcome and metric;
- baseline and baseline date;
- target, horizon and tolerance;
- unit, formula and aggregation;
- data source and refresh cadence;
- accountable owner;
- leading/lagging classification;
- missing-data and quality policy;
- benefit linkage.

Finance and KPI objects are canonical persisted artifacts, not text embedded only in a report.

### Flow 8 — Initiative Candidate generation and governance

Agent creates typed Initiative Candidate proposals from the reviewed opportunity portfolio.

Each candidate contains:

- source Ideas/findings/gaps;
- problem and desired outcome;
- scope in/out;
- selected option and rejected alternatives;
- owner and sponsor;
- deliverables and success criteria;
- Finance and KPI references;
- risks, dependencies and change impact;
- priority and portfolio interactions;
- confidence, unknowns and evidence.

Agent checks duplicates and portfolio conflicts. Authorized humans review exact versions and decide register, merge, return, defer, reject or dismiss. Only approved candidates become canonical Initiatives.

### Flow 9 — Initiative portfolio and transformation roadmap

Agent constructs a coherent transformation portfolio:

- waves and dependencies;
- strategic themes;
- quick wins, foundations and long-horizon changes;
- capacity and budget scenarios;
- risks and critical path;
- expected benefit timing;
- decision and approval calendar.

The roadmap is a view over canonical Initiatives and dependencies, not an independent list.

### Flow 10 — Mobilization and execution objects

For each scheduled Initiative, Agent proposes:

- Execution Case;
- workstreams;
- milestones;
- Tasks and subtasks;
- owners and RACI;
- RAID entries;
- required Decisions;
- capacity and schedule baseline;
- reporting cadence;
- delivery and closure criteria.

After approval it creates these through owning services. Readback proves the objects exist and links them to their Initiative, plan step and transformation.

### Flow 11 — Execution management

Agent monitors approved execution scope and prepares interventions.

It must:

- track Tasks, milestones, dependencies, decisions, risks, budget and capacity;
- identify blocked or stale work;
- produce progress summaries from canonical states;
- propose reminders, reassignment, replan or escalation;
- require approval for material baseline or governance changes;
- persist partial failures and skipped work;
- survive browser/worker restart and resume from checkpoint;
- avoid duplicate mutations during retry.

### Flow 12 — Delivery, benefits and sustainability

Agent separates three outcomes:

1. `delivered` — outputs accepted;
2. `benefit_effective` — KPI/financial result achieved in the measurement window;
3. `sustained` — result persists and is operationally owned.

It prepares:

- delivery acceptance proposal;
- benefits handoff;
- KPI and Finance actual comparison;
- effectiveness review;
- corrective proposals if partial/not achieved;
- later sustainability review;
- closure Decision and lessons learned.

### Flow 13 — Final Word report

Agent creates a canonical report artifact and Word rendition containing:

- executive summary;
- mandate, scope and methodology;
- source/evidence inventory;
- interview synthesis;
- DRD results and eight-dimension visuals;
- idea/opportunity portfolio;
- selected Initiatives and roadmap;
- financial case and sensitivity;
- KPI scorecard;
- execution status and delivered outputs;
- realized benefits and sustainability status;
- risks, exceptions and open decisions;
- source citations and appendices.

The Word file must be editable, render correctly and retain a link to canonical report/version/run.

### Flow 14 — Final PowerPoint presentation

Agent creates a steering/client deck from the same approved facts:

- transformation story and case for change;
- current-state and DRD visuals;
- target state and themes;
- prioritized Initiatives and roadmap;
- finance and KPI summary;
- progress, outcomes and risks;
- decisions/asks;
- next steps.

The deck must not contain numbers or claims that diverge from the report, Finance, KPI or Initiative records. It must be editable and visually verified.

### Flow 15 — Final Teresa readout

Teresa presents:

- what was planned;
- what was executed;
- what was approved/rejected/waived;
- what artifacts were created or updated;
- what failed or remains blocked;
- what was delivered;
- what benefit was measured;
- whether sustainability was confirmed;
- links to Transformation Case, Word report, PowerPoint and audit timeline;
- recommended next responsible actions.

## 6. Cross-module artifact contract

| Stage | Canonical module | Required artifact/result |
|---|---|---|
| Mandate | Chat / Agent | Conversation, Transformation Case, Agent Run |
| Plan | Agent | Versioned Transformation Plan |
| Opportunity intake | Ideas | Source-linked Ideas and relations |
| Human evidence | Interview | Plan, assignments, sessions, answers, findings, reviewed insights |
| Diagnosis | Assessment | DRD session, evidence, accepted scores, gaps, DRD report state |
| Decision preparation | Ideas / Initiatives / Decisions | Management Cases and Decision Briefs |
| Investment | Finance | Persisted model, scenarios, assumptions and validated calculations |
| Measurement | Results/KPI | KPI cards, baselines, targets and actuals |
| Change portfolio | Initiatives | Candidates, registered Initiatives, dependencies, gates |
| Delivery | Execution / My Work | Execution Cases, Tasks, milestones, RAID and Decisions |
| Outcome | Results / Finance | Benefit and effectiveness reviews |
| Communication | Reports / Word / Presentations | Canonical report, DOCX and PPTX |
| Learning | Knowledge / Agent templates | Approved lessons and proposed template revision |

## 7. Whole-epic Definition of Done

All conditions are mandatory on one canonical candidate.

### DOD-T01-01 — Teresa and planning

- exact request starts one durable Transformation Case and run;
- Teresa shows one complete, editable and versioned plan;
- user-approved plan version is immutable for execution;
- plan covers all flows 1–15 and their failure paths.

### DOD-T01-02 — Real source and human work

- at least one real source document/artifact is bound;
- real Interview assignments and responses exist;
- insights are reviewed and source-cited;
- missing participation is represented as missing, never synthesized.

### DOD-T01-03 — DRD truth

- canonical methodology version is used;
- scoring is deterministic and evidence-backed;
- accepted scores have human actor/time;
- DRD gap and report data read back from canonical storage.

### DOD-T01-04 — Ideas and decisions

- Agent creates or links a non-trivial Idea portfolio;
- every promoted Idea retains source lineage;
- duplicates, alternatives and rejected/deferred rationale are durable;
- material decisions are human-owned and versioned.

### DOD-T01-05 — Initiatives and execution

- approved Initiative Candidates create canonical Initiatives once;
- portfolio dependencies and roadmap are persisted;
- at least one Initiative reaches a real Execution Case;
- Tasks, milestone, RAID and Decision objects are created and read back;
- retry is idempotent and resume works after interruption.

### DOD-T01-06 — Finance and KPI

- persisted Finance model contains at least baseline, investment, benefits and scenario;
- deterministic ROI/NPV/payback mechanics pass independent verification;
- KPI card contains formula, owner, baseline, target, cadence and source;
- missing data cannot silently become zero;
- actual/result readback is linked to Initiative and Transformation Case.

### DOD-T01-07 — Outcome and sustainability

- delivery, effectiveness and sustainability are separate states;
- effectiveness review uses canonical actuals;
- partial/not-achieved state can create corrective proposal;
- closure is a human Decision;
- lessons learned preserve privacy and provenance.

### DOD-T01-08 — Word and PowerPoint

- canonical report is persisted before file generation;
- DOCX and PPTX are produced from the same approved snapshot;
- both artifacts are editable and visually rendered/inspected;
- cross-artifact number and claim checks pass;
- files and previews read back through production artifact routes;
- report/deck disclose freshness and unresolved exceptions.

### DOD-T01-09 — Governance and safety

- every material mutation has proposal, preview and approval or explicit policy basis;
- business gates cannot be AI-approved;
- server-side role and tenant checks cover every adapter;
- cross-tenant access and prompt/tool escalation tests pass;
- destructive/external actions are bounded and auditable.

### DOD-T01-10 — Runtime and evidence

- real PostgreSQL persistence is proven for every mandatory artifact family;
- real queue/worker execution and restart recovery are proven;
- real model structured planning/proposal path is tested;
- every execution result has canonical readback;
- audit timeline links actors, sources, plan, proposals, approvals, tool calls and outputs;
- full visual pack covers start, plan, review, approval, progress, partial/error, final report and deck in light/dark;
- all evidence maps to organization, role, route, state, artifact IDs, viewport and exact SHA;
- candidate is current with canonical branch and all required gates rerun.

## 8. Failure and recovery acceptance

The epic must prove:

- missing source/evidence;
- participant non-response;
- DRD score awaiting approval;
- Finance validation failure;
- Initiative proposal rejection;
- permission denial;
- worker interruption and resume;
- partial adapter failure;
- source change causing stale downstream proposal/output;
- retry without duplicate artifacts;
- Word/PPT generation failure after canonical report persistence;
- explicit recovery and truthful final summary for each case.

## 9. Quality evaluation pack

Expert review must score:

- transformation-method completeness;
- evidence discipline;
- interview quality;
- DRD methodological correctness;
- breadth and quality of opportunity system;
- Initiative coherence and executability;
- financial correctness;
- KPI measurability;
- execution-governance quality;
- Word report usefulness and integrity;
- PowerPoint narrative and visual quality;
- consistency across artifacts;
- user control and trust.

No aggregate score can override a critical failure in tenant isolation, financial mechanics, gate ownership, source honesty or false completion.

## 10. Implementation increments

The epic is delivered through separately accepted increments:

1. `T01-I01` Teresa mandate -> Transformation Case and full plan proposal;
2. `T01-I02` plan review/version/approval;
3. `T01-I03` source inventory -> initial Ideas;
4. `T01-I04` Interview plan -> real reviewed insights;
5. `T01-I05` DRD -> accepted scores and gaps;
6. `T01-I06` synthesis -> reviewed opportunity portfolio;
7. `T01-I07` Finance model and KPI cards;
8. `T01-I08` Initiative Candidates -> governed Initiative portfolio;
9. `T01-I09` Initiative -> Execution objects;
10. `T01-I10` execution monitoring, delivery and exception handling;
11. `T01-I11` benefits and sustainability review;
12. `T01-I12` canonical report -> DOCX and PPTX;
13. `T01-I13` full golden-flow rerun and acceptance pack.

Each increment stops at a visible acceptance checkpoint. Passing one increment does not imply whole-epic completion.

## 11. Epic closure evidence

Closure requires a single final index containing:

- canonical SHA and ancestry;
- environment and feature flags;
- Transformation Case and Run IDs;
- artifact lineage export;
- proposal/approval/audit export;
- module-by-module realDB readback;
- test matrix and results;
- failure/recovery results;
- visual manifest;
- generated DOCX and PPTX plus rendered previews;
- independent finance/KPI validation;
- unresolved finding register with zero open critical blockers;
- Product owner acceptance decision.

# 11. Initiative Card — complete business workspace contract

Status: **target implementation canon; current runtime is partial**
Scope: one registered Initiative from `REGISTERED_DRAFT` through `ARCHIVED`
Rule: the lifecycle of one Initiative is performed inside this workspace. Menu 2 surfaces compare, sequence and balance many Initiatives; they do not duplicate the card workflow.

## 1. Job of the card

The Initiative Card is the governed case file used to answer, in order:

1. What problem or opportunity are we addressing?
2. What outcome and boundaries define a good Initiative?
3. Which option is justified by evidence?
4. Is it strategically, financially, technically and organizationally feasible?
5. Who may decide, what is still missing and what blocks the next gate?
6. When can the organization realistically undertake it?
7. Has Execution accepted the handoff, delivered it and returned evidence?
8. Were the intended outcomes achieved and may the case be closed?

The card is not a document editor and not a dashboard wall. It is a workbench over canonical Initiative, Task, Decision, Risk, Finance, Results, Resource and Execution records.

## 2. Workspace anatomy

### 2.1 Persistent shell

| Region | Required content and behavior |
|---|---|
| Header | title, lifecycle, owner, sponsor, priority, project/program, target window, save state, freshness and data-quality state |
| Next-action strip | one primary next action, reason, accountable role, due/SLA, blockers and link to the exact deficient card |
| Lifecycle rail | all 12 business states; completed/current/future; gates and exceptional disposition shown separately |
| Navigation rail | card groups with `complete / warning / blocker / stale / not applicable`; search and unresolved count |
| Main canvas | selected business card; view/edit/draft/review modes; evidence and linked records |
| Context rail | Teresa recommendation, source/evidence, change impact, open Tasks/Decisions, comments and audit; collapsible |
| Sticky action bar | save draft, request input, create Task/Decision/Risk, submit to gate, return, approve/reject/defer where authorized |

The header never uses green for missing data. `healthy`, `zero`, `unknown`, `stale`, `estimated` and `insufficient control data` are distinct states.

### 2.2 Interaction rules

- One card is selected at a time; do not render 26 expanded panels in one scroll.
- Overview shows the case narrative and next action; it does not replicate every field.
- Edit is local to a card and produces a draft. Material changes require impact review before publication.
- Every material value shows owner, source, version/freshness and confidence where estimated.
- A Task, Decision, KPI, Finance case or artifact opens its canonical record; the card stores a relation and contextual projection only.
- Failed, stale or partial loads remain visible and retryable. Cached data is labelled.
- AI output is visually and semantically a proposal until a human with capability accepts it.

## 3. Business card groups and catalog

The 26 business cards are a closed, stable capability catalog. Templates and individual Initiatives may include, omit or reorder only these catalog cards. Omission sets applicability/visibility and never deletes stored content, relations or history. Organizations may add custom fields and auxiliary sections, but they do not become new peer business-card types.

### A. Definition and value

| Card | Business purpose | Minimum governed output | Truth owner | Principal actions |
|---|---|---|---|---|
| Summary / Scope | define the problem, change and boundaries | problem, scope in/out, assumptions, intended outcome | Initiative | edit, compare version, request clarification, raise scope Decision |
| Strategic Fit | prove contribution to strategy | linked goals, contribution, conflict and exception rationale | Strategy/Results link; Initiative rationale | link goal, challenge alignment, request sponsor confirmation |
| Success Criteria | make completion testable | criteria with owner, evidence method and evaluation point | Initiative; evidence from Execution | add criterion, link milestone, request acceptance |
| Outcomes & Benefits | define business change beyond delivery | benefit hypotheses, beneficiary, owner and timing | Results/Finance for actuals | link outcome, appoint benefit owner, flag double count |
| KPI | contract measurement | KPI reference, formula, unit, baseline, target, cadence, thresholds | Results | link/create governed KPI proposal, request baseline, view observations |
| Options | preserve real choice | alternatives, do-nothing, trade-offs and recommendation | Initiative; selection by Decision | add/compare option, ask expert, create selection Decision |
| Financial Analysis | anchor economics in Finance | versioned Investment Case reference and reconciliation state | Finance | request/update case, compare versions, mark evidence stale |
| Financial Impact | explain economic consequences | P&L/cash/cost/value narrative and sensitivities | Finance source; Initiative narrative | review impact, create assumption Risk, open Finance case |

### B. Organization and feasibility

| Card | Business purpose | Minimum governed output | Truth owner | Principal actions |
|---|---|---|---|---|
| People / Team | establish accountable delivery organization | sponsor, owner, manager, team and vacancies | Project/Resource system | propose assignment, accept/decline, request resource |
| Roles & RACI | remove accountability ambiguity | exactly one Accountable for every critical object | Initiative governance | edit RACI, resolve duplicate/missing A, notify roles |
| Stakeholders | manage influence and adoption | groups, influence, stance, needs and relationship owner | Initiative change context | add evidence, segment, create engagement Task/Risk |
| Resources & Capacity | test ability to perform | demand/supply by period, skill, allocation and confidence | Resource/Capacity context | estimate demand, simulate, request commitment, create capacity Decision |
| Dependencies | protect sequence across work | typed edge, owner, needed-by, health and response | shared dependency record | link, impact-check, acknowledge, resolve/escalate |
| Risk & RAID | govern uncertainty and issues | risk/assumption/issue/dependency with trigger, owner and response | canonical RAID | add/deduplicate, score, create response Task, accept residual Risk via Decision |
| Feasibility & Completeness | synthesize readiness honestly | findings, blockers, warnings, confidence and exact remediation | derived read model | run check, inspect evidence, create remediation Task/Decision, request waiver |
| Technical Specification | establish technical feasibility where applicable | requirements, NFRs, interfaces, security/data review and ADR links | technical systems/ADR | request review, link ADR, raise technical Decision/Risk |

### C. Plan and governance

| Card | Business purpose | Minimum governed output | Truth owner | Principal actions |
|---|---|---|---|---|
| Milestones | create value/control checkpoints | milestone, owner, date, acceptance evidence and dependencies | Initiative before handoff; Execution after acceptance | add, link criteria/tasks, request acceptance |
| Timeline | choose a realistic window and baseline | scenario, assumptions, critical path, confidence and approved window | Plan/Schedule governance | simulate, compare, request schedule Decision; never direct baseline drag-write |
| Tasks | organize concrete work | canonical Task relations and rollups | Initiatives pre-handoff; Execution during delivery | create/link/decompose/assign/block/escalate/open in My Work |
| Decisions | obtain auditable resolution | Decision case, decider, options, due, evidence snapshot, result and follow-up | Decision service | request, supply evidence, remind, escalate, decide, publish follow-up |
| Gates & Approvals | authorize lifecycle transitions | policy version, required evidence, exceptions and gate Decision | governance/Decision | inspect readiness, submit, return, approve/reject/defer/conditional approve |

### D. Adoption, evidence and learning

| Card | Business purpose | Minimum governed output | Truth owner | Principal actions |
|---|---|---|---|---|
| Change & Adoption | make changed behavior achievable | impacted groups, desired behaviors, barriers, interventions and adoption measures | Initiative plan; Results observations | assess impact, create intervention, link adoption KPI |
| Communication & Engagement | coordinate purposeful communication | audience, purpose, message, channel, timing, owner and approval | change plan/material service | draft, request approval, create publication Task |
| Capabilities & Training | close capability gaps | role-skill gaps, build/buy/borrow choice, learning plan and measure | Competency/learning context | assess, choose response, create training Tasks/resource request |
| Attachments & Materials | preserve versioned evidence | artifact relation, provenance, version, access and publication state | Materials/artifact service | attach/link, replace version, request access, publish through approval |
| Comments, Activity & History | support collaboration and immutable accountability | thread, mention, before/after event, actor, time and correlation | audit/comment services | comment, mention, resolve thread, turn into Task/Decision; never rewrite history |

## 4. Card state contract

Every card exposes these independent attributes:

```text
applicability: REQUIRED | OPTIONAL | NOT_APPLICABLE
completion: EMPTY | IN_PROGRESS | COMPLETE
quality: UNKNOWN | SUFFICIENT | WARNING | BLOCKER
freshness: CURRENT | STALE | SOURCE_UNAVAILABLE
review: NOT_REQUESTED | REQUESTED | CHANGES_REQUESTED | ACCEPTED
save: CLEAN | DIRTY | SAVING | SAVED | SAVE_FAILED | CONFLICT
```

`COMPLETE` never means approved. A complete card can contain a blocker. `NOT_APPLICABLE` requires a reason and, for a required-by-policy card, an authorized waiver.

## 5. Lifecycle profiles

The workspace progressively changes its dominant questions; it does not hide historical evidence.

| Lifecycle range | Dominant cards | Primary action | Hard stop examples |
|---|---|---|---|
| `REGISTERED_DRAFT` | Summary, Strategic Fit, Stakeholders, History | define and appoint owner | no owner; missing source lineage |
| `DEFINED` | Scope, Success, Outcomes, Options, Team | submit for analysis | ambiguous problem/scope; no measurable success |
| `ANALYZING` | Finance, Capacity, Dependencies, RAID, Technical, Adoption | resolve findings | no viable option; unowned critical risk; missing capacity estimate |
| `READY_FOR_DECISION` | Options, Decision, Gates, Feasibility | submit/decide | missing decider/evidence; stale Finance/Results input |
| `APPROVED_BACKLOG` | Milestones, Timeline, Resources, Dependencies | build schedule scenario | approval conditions unresolved |
| `SCHEDULED` | Timeline, Capacity, Handoff, Gates | request Execution acceptance | unapproved baseline; overload; broken dependency |
| `IN_EXECUTION` | Tasks, Decisions, RAID, Milestones, Change | manage exceptions via Execution | no read-back; unresolved critical blocker |
| `DELIVERED`–`EFFECTIVENESS_REVIEWED` | Success, Outcomes, KPI, Benefits, Lessons | verify acceptance/effect | no delivery evidence; no outcome owner/measurement |
| `CLOSED`–`ARCHIVED` | History, Decisions, evidence, Lessons | close/archive | open mandatory follow-up; retention failure |

## 6. Templates and applicability

Supported starting profiles: quick improvement, investment, technology, organizational change, regulatory/remediation and complex transformation. A template defines included/omitted cards, requiredness, required fields, reviewers, policy version and default order. It must select exclusively from the canonical 26-card catalog and must not create a separate schema.

Adding or removing a catalog card and changing template both produce an impact preview: newly required/omitted cards, preserved data, unresolved work, open waivers and gate consequences. A required card cannot be removed without the configured waiver/decision. No operation silently deletes content.

## 7. Permissions and collaboration

- Capabilities come from the server for the Initiative, card and action; UI roles are not authority.
- Missing capability response is fail-closed read-only, with an explicit degraded-state explanation.
- Assignment creates a pending acceptance for the assignee where policy requires it.
- `request input` creates an accountable request with due date and relation to an exact field/card; it is not merely a mention.
- Teresa may extract, structure, challenge, compare, draft and monitor. She cannot approve a gate, accept residual risk, confirm capacity, publish communication, baseline a schedule or make a Decision.

## 8. Material-change and impact mechanics

Changes to scope, selected option, owner, target window, budget envelope, KPI target, critical dependency or approved baseline create a versioned change proposal. Before publication the system shows:

- changed fields and old/new values;
- affected Tasks, Decisions, milestones, risks, capacity periods, Finance/Results references and Execution handoff;
- tolerance evaluation and required approver;
- reversible/non-reversible character;
- proposed follow-up actions.

Approval publishes atomically or fails without partial truth. Old versions and decision evidence remain accessible.

## 9. How external functions govern the card

The Initiative Card owns the case and lifecycle; external functions own collective decisions that cannot be made from one card alone. Their result always returns to the card as a versioned relation, finding, condition or approved snapshot.

| External function | Reads from the card | Performs outside the card | Writes/read-backs to the card | May change lifecycle? |
|---|---|---|---|---|
| Inicjatywy register | identity, status, gate, readiness, owner and next action | search/filter/triage many registered Initiatives | selection context only; edits happen after opening the card | no, except explicit card command |
| Portfel | strategic fit, value, cost envelope, risk, readiness, confidence, overlap, rough demand | compare the combined set, coverage, alternatives, rank and trade-offs | scenario membership, rank rationale, conditions and immutable Portfolio Decision | yes: authorized approval may produce `APPROVED_BACKLOG` |
| Plan | approved scope, milestones, dependencies, duration/demand ranges, constraints | create and compare sequence/window scenarios across Initiatives | selected scenario/window, assumptions, conflicts, tolerance and Schedule Decision reference | only with capacity commitment and approved Schedule Decision |
| Obciążenie | role/skill demand, candidate team, estimate/confidence and target window | compare time-phased demand with supply and simulate responses | capacity findings, proposed assignments, commitment/decline and impact | no alone; its commitment is mandatory evidence for scheduling |
| Realizacje | approved scope, baseline, success criteria, open work/decisions/RAID and handoff pack | manage all accepted Execution Cases | acceptance/read-back, execution phase/health/progress and deep link | accepted handoff enables `IN_EXECUTION` |
| Praca | Task/Decision relations and context | operate cross-Execution work queue | same canonical object states and rollups | no direct Initiative transition; may change readiness |
| Zasoby | delivery demand, assignments, estimates and forecasts | allocate and rebalance operational people/cost capacity | assignment/forecast conflicts and approved interventions | no direct transition; may trigger change/rebaseline Decision |
| Sterowanie | baselines, tolerances, blockers, decisions, resource and outcome signals | prioritize exceptions and govern intervention | intervention, decision, verification and read-back | only through a separately authorized change/stop/closure Decision |
| Raporty | exact source versions and snapshots | produce audience/period-specific Report Runs | report relation and source-linked follow-up | never directly |
| My Work | assignee/decider/reviewer/input requests | personalize the user's actionable queue | same canonical command/read-back | never by projection alone |

### 9.1 No hidden external mutation

Selecting, ranking, dragging, simulating or editing in an external function creates a draft scenario or proposal. The Initiative Card shows a `proposed external change` inbox with source function, scenario version, author, reason, impact and required authority. Only an authorized publish/decision command updates governed card truth.

### 9.2 Approval spine inside the card

Every approval is initiated and audited from the card even when its evidence was created externally:

1. active lifecycle and governance profile select the next gate;
2. gate policy selects required cards, fields, domain reviews, Tasks/Decisions and freshness limits;
3. readiness produces exact findings and remediation actions;
4. Initiative Owner resolves blockers or requests an authorized waiver;
5. `Submit` freezes card versions plus external Portfolio/Plan/Capacity/Finance/Results snapshots;
6. the Decision Case names authority, options, recommendation, counterargument, conditions and consequences of no decision;
7. decider may approve, conditionally approve, return, defer or use other outcomes allowed for that gate;
8. publication atomically records result, lifecycle/disposition change and follow-up objects;
9. card, source function, My Work and downstream module confirm read-back;
10. any later material change marks affected approval stale and starts a bounded reapproval path.

The UI never exposes a generic `Approve Initiative` button. It exposes the exact gate action, for example `Approve definition`, `Approve for backlog`, `Approve schedule`, `Accept handoff`, `Accept delivery`, `Confirm effectiveness` or `Close Initiative`.

### 9.3 Approval package by gate

| Gate | Card evidence minimum | External evidence | Authority/output |
|---|---|---|---|
| Definition | Summary/Scope, Success, Outcomes, Options, owner, source and key assumptions | source-validation result | named reviewer approves definition snapshot |
| Analysis readiness | applicable Finance, KPI, Capacity, Dependencies, RAID, Technical, Change and evidence cards | domain-owner reviews and freshness | PMO/readiness reviewer confirms decision-ready case |
| Portfolio Go/No-Go | decision-ready case, recommendation, conditions and confidence | Portfolio scenario, alternatives, coverage and trade-off evidence | Sponsor/Board publishes Approved Backlog or other disposition |
| Schedule & Capacity | milestones, selected window, dependencies, roles, tolerances and handoff draft | Plan scenario plus Resource Manager commitments | Project Leader inside envelope or Sponsor/Board exception publishes Scheduled |
| Execution acceptance | frozen Handoff Pack, open work/decisions/risks and baseline | Execution readiness validation | Execution Manager accepts/returns; accepted read-back enables start |
| Delivery acceptance | success criteria, deliverables, waivers, open residuals and handover | Execution evidence and Finance actual references | Execution Manager/acceptance authority confirms Delivered |
| Effectiveness | intended outcomes/KPI/benefits contract and attribution assumptions | Results observations and Finance reconciliation | Benefit Owner/governance records result |
| Closure/archive | lessons, follow-up, decisions, retention and unresolved obligations | Results/Finance/Execution final read-backs | closure authority closes; retention authority archives |

## 10. Current runtime mapping — migration evidence, not target IA

`InitiativeDocumentView` and the section registry currently mount useful implementations for Overview, Problem Definition, Target State, Scope, Tasks/Milestones, Decisions, RAID, Gates, Finance, KPI, competencies, skills gap, team, RACI, timeline, resources, stakeholders, dependencies, attachments, linked items, comments, history, tags, reminders and watchers.

Disposition:

- reuse section business logic and canonical API adapters where ownership matches;
- merge duplicated conceptual cards such as Overview/Summary and Team/Initiative Team;
- split combined Tasks/Milestones into two business cards sharing canonical objects;
- treat Control, Tags, Reminders, Watchers and Linked Items as workspace utilities/context, not peer business cards;
- add missing first-class cards: Strategic Fit, Success Criteria, Outcomes/Benefits, Options, Change/Adoption, Communication and Technical Specification;
- retire `InitiativeFullView` after every consumer uses one canonical workspace and parity is proven.

## 11. Acceptance requirements

The card is not complete until tests prove:

1. lifecycle-aware profile and next action for all 12 states;
2. authorized and unauthorized behavior per material command;
3. deep links to one canonical Task/Decision/KPI/Finance record;
4. dirty/save/conflict/offline/stale/partial states without data loss;
5. material-change impact preview, approval, audit and read-back;
6. Task/Decision propagation to My Work and Execution without duplicate records;
7. gate cannot pass on missing, stale or unaccepted mandatory evidence;
8. AI proposal remains a proposal until accepted and is provenance-labelled;
9. realDB reload preserves relations, versions, decisions and history;
10. keyboard navigation, focus restoration, screen-reader names, contrast and responsive progressive disclosure.

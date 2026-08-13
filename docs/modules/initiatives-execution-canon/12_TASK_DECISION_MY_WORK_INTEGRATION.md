# 12. Initiative ↔ Task ↔ Decision ↔ My Work ↔ Execution contract

Status: **target integration canon; current route families are partial evidence**

## 1. One-object rule

The same Task or Decision may appear in the Initiative Card, My Work, Execution, calendar, notifications, reports and Manager. It remains one tenant-scoped record with one ID and one lifecycle.

| Context | What it owns | What it projects |
|---|---|---|
| Initiative | why/what, definition work, pre-commitment governance, relation context | linked Tasks/Decisions and their rollups |
| Task service | Task content, assignment, workflow, evidence, dependencies and escalation | Initiative/Execution context |
| Decision service | Decision case, authority, evidence snapshot, chain, result and follow-up | blocked objects and context |
| My Work | personalized queue/read model and user preferences | canonical Tasks, Decisions and accountable requests |
| Execution | delivery plan and operational control | Initiative intent plus canonical Tasks/Decisions |

My Work MUST NOT update a private copy. A command issued there targets the canonical aggregate and reads back into all projections.

## 2. Canonical Task contract

Required fields:

- identity/tenant/version: `id`, `organizationId`, `version`, timestamps;
- context: `initiativeId`, optional `executionId`, `workstreamId`, `milestoneId`, `parentTaskId`, source relation;
- meaning: title, why it exists, expected outcome, acceptance evidence/rule;
- accountability: assignee, accountable owner, creator, watchers;
- control: status, priority, due window, estimate with unit/confidence, actual where available;
- flow: dependencies, blocking Decision/Risk, escalation state;
- provenance/audit: human/AI proposal, actor, correlation and history.

Maximum structured depth: `Initiative -> Workstream/Phase -> Task -> Subtask`. Deeper detail is a checklist or related sibling Task.

### 2.1 Task lifecycle

The exact persisted enum must be normalized by an ADR; until then the UI uses a canonical projection:

`PROPOSED -> READY -> IN_PROGRESS -> BLOCKED -> IN_PROGRESS -> SUBMITTED_FOR_ACCEPTANCE -> DONE`

Exceptional outcomes: `CANCELLED`, `NOT_NEEDED`, `ARCHIVED`. `DONE` requires the acceptance rule/evidence when configured. `BLOCKED` requires blocker type and link/reason; it is not merely a red label.

### 2.2 Task commands

Create/link, accept AI proposal, edit, assign/reassign/unassign, start, block/unblock, submit evidence, accept/reject completion, decompose, link dependency/milestone, move with impact preview, escalate, cancel/archive. Every mutation requires capability, expected version/idempotency key, audit and read-back.

## 3. Canonical Decision contract

Required fields:

- identity/tenant/version and Decision type;
- Initiative/Execution/Task/Gate relations and affected-object set;
- question, context, options including do-nothing where meaningful, recommendation and counterargument;
- requested decider, actual decider, authority source and optional chain (`sequential`, `parallel`, `delegated`);
- due/SLA, urgency, consequences of no decision and blocked-work/blast-radius projection;
- versioned evidence snapshot with sources/freshness/confidence;
- result, rationale, conditions, effective date and follow-up state;
- escalation, reminders and immutable history.

### 3.1 Decision lifecycle

`DRAFT -> PROPOSED -> EVIDENCE_PENDING | READY -> IN_REVIEW -> DECIDED -> PUBLISHED -> VERIFIED -> CLOSED`

Decision outcomes are separate: `APPROVED`, `REJECTED`, `CONDITIONAL`, `DEFERRED`, `NO_DECISION`. Exceptional states: `ESCALATED`, `EXPIRED`, `CANCELLED`. Publishing is separate from deciding because conditions and follow-up must be materialized safely.

### 3.2 Decision commands

Draft/request, request input, attach evidence, delegate, configure chain, remind, escalate, approve/reject/condition/defer, publish, generate follow-up Tasks/milestones/risks, verify implementation and close.

AI prepares the case and challenges it; only a capable human decides. Self-approval and committee rules are policy-controlled and auditable.

## 4. Task–Decision mechanics

| Trigger | Required behavior |
|---|---|
| Task cannot proceed without a choice | link/create Decision; Task becomes blocked with exact Decision and blast radius |
| Decision is published | idempotently materialize conditions/follow-up as canonical Tasks, milestones, risks or schedule proposal |
| Blocking Decision is resolved | re-evaluate, do not blindly unblock; conditions may keep Task blocked |
| Task prepares Decision evidence | completion updates evidence readiness, not Decision outcome |
| Decision due/SLA breached | remind/escalate per policy and surface all affected work |
| Task moved across Initiative/Execution | preview dependency, workload, gate, access and reporting impact; preserve lineage |
| Decision cancelled/deleted | soft cancellation with reason; linked work retains historical reference and requires replacement/waiver if still blocked |

Creation from a card uses a relation key such as `(sourceType, sourceId, purpose, clientRequestId)` to prevent retries from creating duplicates.

## 5. My Work projection

My Work answers: “What must I do, decide, review or acknowledge next?” It combines:

- assigned Tasks;
- Decisions where the user is decider, contributor or evidence owner;
- card input/review requests;
- assignment acceptance requests;
- mentions only when actionable;
- escalations and overdue follow-up.

Every row includes object type, action required, Initiative/Execution context, reason, due/SLA, severity, confidence/freshness and deep link. Snooze changes personal presentation only; it cannot change due date, ownership, blocker or canonical status.

Commands from My Work use the same capabilities and endpoints as the source workspace. Success is acknowledged only after canonical write and projection read-back. On projection lag the UI shows `saved; synchronization pending` with correlation ID rather than duplicating locally.

## 6. Ownership transfer at Execution handoff

Before handoff, definition/remediation Tasks may be owned in Initiatives. At accepted handoff:

1. a versioned Handoff Pack snapshots scope, selected option, success criteria, assumptions, approved baseline, open Tasks/Decisions/RAID, outcomes and source versions;
2. Execution Manager reviews readiness and accepts, conditionally accepts or returns it;
3. accepted delivery Tasks become operationally controlled by Execution without changing IDs;
4. definition/governance Decisions remain Decision records; delivery Decisions gain Execution context;
5. My Work projections continue uninterrupted;
6. Initiative shows read-only operational rollups and deep links; it does not maintain shadow status;
7. closure hands outcome measurement to Results and money actuals to Finance.

Retrying handoff is idempotent. Initiative cannot become `IN_EXECUTION` until Execution returns accepted read-back.

## 7. Gate integration

Each lifecycle transition has a policy-versioned gate definition containing required cards/fields, required Decision types, unresolved Task/Risk rules, evidence freshness limits, roles and waiver rules.

Gate evaluation returns findings, never just a score:

```text
findingId, severity, objectType, objectId, cardKey, ruleId,
message, evidenceRefs, ownerId, remediationActions, freshness, confidence
```

- blocker findings prevent submission/approval;
- warning findings require owner or accepted waiver;
- remediation creates linked canonical Tasks/Decisions, never anonymous checklist text;
- approval records the exact evidence snapshot and policy version;
- later material change marks affected approval stale and triggers re-approval according to tolerance.

## 8. Notifications and escalation

Events become notifications only when an identified role can act. Each notification contains what happened, why it matters, action, owner, due, source and deep link.

Escalation policies are versioned by object/action. They define SLA, reminder cadence, escalation role, quiet hours and terminal response. The system must deduplicate repeated signals and preserve acknowledgement. Public shaming, activity scoring and fabricated urgency are prohibited.

## 9. API contract and current evidence

### 9.1 Required target envelope

Queries return `data`, `version`, `freshness`, `sourceStatus`, `capabilities`, and correlation metadata. Commands accept `clientRequestId`, `expectedVersion`, reason where material, and return canonical object plus projection/read-back status. Conflicts return the current version and a safe reconciliation path.

### 9.2 Confirmed current route families to adapt

| Capability | Current evidence | Target action |
|---|---|---|
| Initiative workspace metadata | `/api/initiatives/:id`, section types/templates, gate readiness, history, watchers | unify schemas and add version/capability/freshness envelope |
| Task CRUD and work control | `/api/tasks`, assign/reassign/unassign, block/unblock, move, dependencies, milestones, comments, escalations, workflow config | retain canonical service; normalize lifecycle and idempotency/concurrency |
| Decision governance | `/api/decisions`, required-fields, decide, workflow, created-tasks, remind, escalate, generate-section | retain service; normalize Decision lifecycle/chain/evidence/publish semantics |
| Initiative relations | Initiative Task query, related-object Decision query, RAID, resources, budget, KPI, stakeholders, linked items | replace client stitching with typed aggregate/read-model queries |
| My Work | `/api/my-work/tasks`, `/api/my-work/decisions`, queue/snooze/preferences | enforce projection-only writes and correlation/read-back |
| Gate AI/check | `/api/initiatives/:id/gate-readiness-check`, `gate-ai-check` and V8 planning route | one policy-versioned finding schema; fail closed |

Current route existence is not acceptance. Duplicate decision route families, client-side fallback stitching, absent preconditions and uncertain transaction/outbox behavior remain migration work.

### 9.3 Target query set

- `GET /initiatives/:id/workspace` — shell, lifecycle, card summaries, next action, capabilities and freshness;
- `GET /initiatives/:id/cards/:cardKey` — card data, relations, findings, source state;
- `GET /initiatives/:id/work` — canonical Task/Decision/request rollup with filters;
- `GET /initiatives/:id/gates/:transition/readiness` — policy-versioned findings;
- `GET /initiatives/:id/impact?changeSet=...` — deterministic preview;
- `GET /my-work` — unified actionable projection;
- canonical Task and Decision detail queries remain separate.

### 9.4 Target commands

- update card draft / publish card version;
- request input/review and resolve request;
- create/link/unlink Task, Decision, Risk, KPI, Finance case or artifact;
- submit/return/approve/reject/defer lifecycle transition;
- propose/approve material change;
- create/accept/retry handoff;
- archive with retention check.

No generic `save everything` command may partially persist multiple truth owners.

## 10. Event and read-back contract

Material commands write aggregate state and durable outbox event in one transaction. Minimum event families:

`initiative.card.versioned`, `initiative.lifecycle.transitioned`, `initiative.gate.submitted`, `initiative.gate.decided`, `initiative.handoff.accepted`, `task.created/assigned/blocked/completed`, `decision.requested/decided/published/verified`, `relation.created/removed`, `source.stale`, `projection.updated`.

Consumers are idempotent. Event carries organization, aggregate ID/version, actor, correlation/causation IDs, source, occurred-at and safe payload. Sensitive evidence follows access policy and is not copied into broad notifications.

## 11. Golden acceptance flows

1. Card finding -> remediation Task -> My Work -> completion evidence -> card readiness recomputed -> gate unblocked.
2. Task blocked by Decision -> Decision case/chain -> escalation -> conditional approval -> follow-up Tasks -> verified implementation -> Task re-evaluated.
3. Scope change after approval -> impact preview -> reapproval Decision -> versioned card/baseline -> Execution and My Work read-back.
4. Scheduled Initiative -> idempotent handoff -> Execution conditional acceptance -> conditions in My Work -> final acceptance -> `IN_EXECUTION` projection.
5. Unauthorized user can read allowed projections but cannot edit/decide/assign; server and UI agree.
6. Stale Finance/KPI source prevents an unjustified green/readiness claim and leads to the exact refresh action.
7. Command retry, network timeout and projection lag create one object and one auditable event; no duplicate Task/Decision.
8. Deleted/cancelled Decision never reappears as active, while historical links and rationale remain auditable.

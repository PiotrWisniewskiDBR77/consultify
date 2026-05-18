# Agentic Chat + Agent Runtime Requirements — Consultify (full)

> **Status:** source research input, captured 2026-04-18. Do not edit in place.
> **Scope:** answers the Agentic Chat + Agent Runtime deep research prompt
> (Prompt 2 of the first research batch) in **full** form. Supersedes the
> truncated `DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_2026-04-18.md` document.
>
> **ID reconciliation required at plan-action time:**
> - The prior truncated file captured `R-AGENT-1…20` from an incomplete source.
>   This document captures `R-AGENT-1…29` from the full source.
> - At plan-action time, **this document is authoritative** for all `R-AGENT-*`
>   IDs. The earlier `R-AGENT-1..20` should be **closed / merged** into the
>   corresponding detailed IDs here.
> - Mapping is listed in the "ID reconciliation" table below.
>
> Complements the Reasoning, Feedback/Learning, ROI Lifecycle, Enterprise
> Integrations, Deep Research/Reporting, Artifact Runtime, and (pending)
> Onboarding research documents dated 2026-04-18.
>
> **Next step:** this document will be turned into the canonical Agent Runtime
> implementation plan (tickets + flags + tests + CI invariants) in a follow-up
> pass.

---

## Executive framing

**Agentic chat cannot be allowed to mutate enterprise systems through ad-hoc tool writes that are only implicitly described in conversation.**

The market already shows two partly separate patterns:

1. **Chat-native agent loop** — OpenAI's Responses stack + ChatGPT agent (typed tool calls, background execution, stateful conversations, computer use, user interruption); Anthropic (structured tool use, computer-use harnesses); Vercel AI SDK (loop control, tool-call streaming, resumable streams, built-in approval hooks); LangChain LangGraph (interrupts, checkpoints, replay, time travel).
2. **Durable workflow runtime** — Temporal, AWS Step Functions, Apache Airflow, GitHub Actions (event histories, retries, scheduling, cancellation, concurrency control, artefact persistence, auditable run history).

**None of them gives Consultify a single enterprise-native contract** that spans conversational intent, blast-radius classification, approval evidence, optimistic concurrency, cross-module mutation, and durable resume/replay in one canonical envelope.

### Why Consultify's requirement is materially different

A consumer agent can rely on a single user's consent, transient browser state, and lightweight personal risk. Consultify instead needs:

- enterprise ACL enforcement
- SOX-defensible and audit-friendly write evidence
- approval gates tied to **business severity**
- long-running runs that can survive hours or days
- cross-module mutations that can touch scenarios, decks, tasks, delivery plans, connectors, and client-facing outputs in one run

NIST's control families explicitly separate access control from audit/accountability. PCAOB guidance for ICFR is fundamentally about obtaining reliable evidence of who changed what, under which control framework, and with what review path. **A conversational system that only "logs messages" is insufficient for enterprise consulting execution.**

### Benchmark readout (design decomposition, not feature comparison)

| Benchmark | What to borrow |
| --- | --- |
| **OpenAI Agent / Operator** | Typed tool loops, streaming, interrupts, background responses, conversation state |
| **Anthropic Computer Use / Projects** | Structured tool use loop, project routines, human oversight patterns |
| **Cursor Agent** | Background agents, isolated environments, sandbox-escape approval, review artefacts |
| **Zapier Agents** | Human-in-the-Loop pauses, activity views, enterprise analytics |
| **Microsoft Copilot Studio** | Multistage + AI approvals, run history, cancel/resubmit, Purview audit |
| **Atlassian Rovo Agents** | Admin connector controls, skills confirmation, debug response |
| **Temporal / Step Functions / Airflow** | Event histories, retries, scheduling, replay, redrive |
| **GitHub Actions** | Artefacts, concurrency groups, run logs, reruns |
| **Vercel AI SDK** | Loop control, streaming custom data, resumable streams, approval hooks |
| **LangGraph** | Interrupts, checkpoints, replay, time travel, branching |

### The three hard contracts Consultify needs

1. **ActionEnvelopeV1** — every agent output that could lead to execution must be normalised into one envelope (read preview / write proposal / schedule proposal / swarm proposal). The envelope is the **only thing** UI, approval engine, executor, ledger, and audit plane are allowed to trust.
2. **Severity S0–S4** — approval attaches to **blast radius**, not to whichever tool happened to be called. CFO approval of scenario mutation, Partner approval of client-facing deck publish, CISO approval of connector-scope escalation are different classes of risk even if routed through the same tool adapter.
3. **Run Ledger** — any work that can outlive a single request-response cycle must be durably represented as a run with state transitions, idempotency keys, checkpoints, artefacts, approvals, interrupts, replay, and resumability. **Longevity without a ledger is operational debt.**

---

## ExecutionProposalV1 — full schema

`ExecutionProposalV1` is the canonical discriminated union. `ActionEnvelopeV1` is an alias so the rest of the runtime can speak about one unified contract.

This schema is intentionally stricter than current market defaults: severity, versions, approval metadata, diff previews, reversibility, budgets, navigation intent, and telemetry tags are **first-class fields**, not optional afterthoughts.

```ts
/** Canonical top-level alias used across UI, approvals, execution, and audit. */
export type ActionEnvelopeV1 = ExecutionProposalV1;

/** Unified proposal contract for all execution-capable agent outputs. */
export type ExecutionProposalV1 =
  | ReadPreviewV1
  | DirectExecutionProposalV1
  | ScheduledProposalV1
  | SwarmProposalV1;

/** Discriminator for all envelope variants. */
export type MessageTypeV1 =
  | 'read_preview'
  | 'execution_proposal'
  | 'scheduled_proposal'
  | 'swarm_proposal';

/** Severity ladder used by approval policy, audit retention, and UI treatment. */
export type SeverityV1 =
  | 'S0_READ_ONLY'
  | 'S1_PERSONAL_WRITE'
  | 'S2_REVERSIBLE_WRITE'
  | 'S3_IRREVERSIBLE_WRITE_OR_MULTI_USER'
  | 'S4_IRREVERSIBLE_FINANCIAL_OR_LEGAL';

/** Supported operation verbs inside a proposal. */
export type OpTypeV1 =
  | 'create'
  | 'update'
  | 'delete'
  | 'move'
  | 'link'
  | 'unlink'
  | 'approve'
  | 'reject'
  | 'rollback'
  | 'notify'
  | 'schedule'
  | 'cancel';

/** Approval mode derived from severity, policy, and actor role. */
export type ApprovalModeV1 =
  | 'auto'
  | 'one_click'
  | 'explicit'
  | 'dual_control'
  | 'org_admin_only';

/** Decision recorded when a reviewer or policy engine resolves approval. */
export type ApprovalDecisionV1 =
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled'
  | 'deferred';

/** Supported scheduling expressions. */
export type ScheduleKindV1 = 'cron' | 'interval';

/** Overlap semantics for schedules. */
export type OverlapPolicyV1 = 'allow' | 'skip' | 'queue' | 'cancel_previous';

/** Budget handling semantics for schedules and long runs. */
export type BudgetPolicyModeV1 = 'hard_cap' | 'soft_cap' | 'warn_only';

/** Routing target for post-action UI navigation. */
export interface NavigationIntentV1 {
  /** Canonical application route, e.g. "/engagements/:id/scenarios/:scenarioId". */
  route: string;
  /** Route params resolved by the client router. */
  params: Record<string, string | number | boolean | null>;
  /** Optional query-string parameters. */
  query: Record<string, string | number | boolean | null>;
  /** UI slot that should open the target. */
  openMode: 'inline' | 'side_panel' | 'full_page' | 'approval_tray';
  /** Specific object or element to focus after navigation. */
  focus: NavigationFocusV1 | null;
  /** Where the user should be returned after review or completion. */
  returnRoute: string | null;
}

/** Optional focus hint to land the user on an exact field, tab, or block. */
export interface NavigationFocusV1 {
  /** Focus target type, e.g. "field", "slide", "table_row", "comment". */
  type: string;
  /** Stable identifier inside the target page/view. */
  targetKey: string;
  /** Optional human-readable label shown in UI. */
  label: string | null;
}

/** Budget contract preserved under the current required field name. */
export interface BudgetBudgetV1 {
  /** Maximum planned token consumption for the proposal or run. */
  maxTokens: number | null;
  /** Maximum planned tool invocations. */
  maxToolCalls: number | null;
  /** Maximum runtime before the executor must pause, fail, or seek approval. */
  maxDurationMs: number | null;
  /** Maximum spend in minor currency units, e.g. pence/cents. */
  maxCostMinor: number | null;
  /** ISO-4217 currency code for maxCostMinor. */
  currency: string | null;
  /** Policy to apply when estimates or actuals cross the budget. */
  budgetPolicy: BudgetPolicyModeV1;
  /** Current estimate at proposal time. */
  estimatedCostMinor: number | null;
  /** Optional cost centre or engagement code used for attribution. */
  costCenter: string | null;
}

/** Optimistic concurrency assertion for a record the run expects to mutate. */
export interface ExpectedVersionV1 {
  /** Owning module for the asserted object. */
  targetModule: string;
  /** Object type, e.g. "scenario", "deck", "task", "connector". */
  targetType: string;
  /** Stable identifier of the asserted object. */
  targetId: string;
  /** Version, etag, hash, or monotonically increasing revision. */
  expectedVersion: string;
  /** Behaviour if the assertion fails. */
  onMismatch: 'block' | 'rebase_preview' | 'request_refresh';
}

/** Per-field diff atom for UI display and machine verification. */
export interface FieldDiffV1 {
  /** Field path using dot notation, e.g. "slides.4.title". */
  fieldPath: string;
  /** Previous value before execution. */
  beforeValue: unknown;
  /** Proposed value after execution. */
  afterValue: unknown;
  /** Readable explanation shown to approvers. */
  humanSummary: string;
  /** Machine-readable change type. */
  changeType: 'add' | 'remove' | 'replace' | 'move';
  /** Whether the field is considered sensitive. */
  isSensitive: boolean;
}

/** Embedded diff preview required for any mutating operation. */
export interface DiffPreviewV1 {
  /** Human-readable summary shown in cards, trays, or modals. */
  humanReadableSummary: string;
  /** Full pre-state snapshot or the relevant extracted portion. */
  beforeSnapshot: unknown;
  /** Full post-state snapshot or the relevant extracted portion. */
  afterSnapshot: unknown;
  /** Per-field change list for UI rendering and selective approval. */
  fieldDiffs: FieldDiffV1[];
  /** Machine-readable patch, e.g. JSON Patch or domain patch. */
  machineReadablePatch: MachineReadablePatchV1[];
  /** Stable checksum of the diff for audit integrity. */
  diffChecksum: string;
}

/** Low-level machine patch operation for verification and replay. */
export interface MachineReadablePatchV1 {
  /** Patch verb applied to the target state. */
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  /** JSON pointer or equivalent path. */
  path: string;
  /** Optional source path for move/copy. */
  from: string | null;
  /** Value written by the patch operation. */
  value: unknown;
}

/** Approval policy attached to every envelope before execution begins. */
export interface ApprovalPolicyV1 {
  /** Effective approval mode for this proposal. */
  mode: ApprovalModeV1;
  /** Versioned policy document or ruleset identifier. */
  policyVersion: string;
  /** Roles allowed to approve, in order of precedence. */
  approverRoles: string[];
  /** Optional named users explicitly requested by the proposal. */
  approverUserIds: string[];
  /** Minimum approver count required to pass the gate. */
  minApproverCount: number;
  /** Time after which unresolved approval expires. */
  expiresAt: string | null;
  /** Whether the proposer may also approve. */
  allowSelfApproval: boolean;
}

/** Recorded approval evidence used for audit, replay, and incident handling. */
export interface ApprovalEnvelopeV1 {
  /** Final or current decision. */
  decision: ApprovalDecisionV1;
  /** Resolved timestamp in ISO-8601 format. */
  decidedAt: string | null;
  /** Reviewer user IDs that acted on the proposal. */
  decidedByUserIds: string[];
  /** Policy version in force when the decision was taken. */
  policyVersion: string;
  /** Free-text reason or reviewer note. */
  reason: string | null;
  /** Immutable approval record identifier. */
  approvalRecordId: string;
}

/** Reversibility metadata required for all mutating operations. */
export interface ReversibilityV1 {
  /** Whether the business effect is fully reversible without manual repair. */
  isFullyReversible: boolean;
  /** Max time within which automated rollback is supported. */
  rollbackWindowSeconds: number | null;
  /** Domain explanation of why reversal is or is not safe. */
  rationale: string;
}

/** Compensating action to be used when rollback or partial failure occurs. */
export interface CompensatingActionV1 {
  /** Verb of the compensating action. */
  opType: OpTypeV1;
  /** Human-readable summary for operators and approvers. */
  summary: string;
  /** Tool or executor capability required to perform the compensation. */
  executorKey: string;
  /** Payload required to execute the compensation. */
  payload: Record<string, unknown>;
}

/** One executable operation inside the proposal. */
export interface OperationV1 {
  /** Stable operation identifier unique within the envelope. */
  opId: string;
  /** Operation verb. */
  opType: OpTypeV1;
  /** Module that owns the target object. */
  targetModule: string;
  /** Domain object type. */
  targetType: string;
  /** Object identifier or synthetic bundle identifier. */
  targetId: string;
  /** Human-readable summary of the operation. */
  summary: string;
  /** Rationale for why this operation is included. */
  rationale: string;
  /** Deterministic idempotency key used by QueueExecutor and replay. */
  idempotencyKey: string;
  /** Upstream operation dependencies inside the same proposal. */
  dependsOnOpIds: string[];
  /** Required version for this specific target, if applicable. */
  expectedVersion: string | null;
  /** Diff preview; mandatory for any operation that changes state. */
  diffPreview: DiffPreviewV1 | null;
  /** Navigation target after successful application. */
  navigationIntent: NavigationIntentV1 | null;
  /** Reversibility classification. */
  reversibility: ReversibilityV1;
  /** Optional compensating action if rollback is not identical to inverse write. */
  compensatingAction: CompensatingActionV1 | null;
  /** Approval evidence captured at op level when policy gates per step. */
  approvalEnvelope: ApprovalEnvelopeV1 | null;
  /** Arbitrary domain payload passed to the module-specific executor. */
  payload: Record<string, unknown>;
}

/** Payload for a read-only preview. */
export interface ReadPreviewPayloadV1 {
  /** Domain query or selection used to prepare the preview. */
  query: Record<string, unknown>;
  /** Data snapshot returned to the user for inspection. */
  previewData: unknown;
  /** Optional source references or artefact IDs. */
  sourceRefs: string[];
  /** Consistency model for the preview. */
  consistency: 'best_effort' | 'snapshot' | 'transactional';
}

/** Schedule contract for recurring or delayed execution. */
export interface ScheduleDefinitionV1 {
  /** Stable schedule identifier. */
  scheduleId: string;
  /** Type of schedule expression. */
  kind: ScheduleKindV1;
  /** Cron expression when kind == "cron". */
  cronExpression: string | null;
  /** Interval in seconds when kind == "interval". */
  intervalSeconds: number | null;
  /** Optional not-before timestamp. */
  startsAt: string | null;
  /** Optional end timestamp. */
  endsAt: string | null;
  /** Time zone used for schedule interpretation. */
  timeZone: string;
  /** What to do if a previous run is still active when the next trigger fires. */
  overlapPolicy: OverlapPolicyV1;
  /** How schedule-level budget should behave over time. */
  budgetPolicy: BudgetPolicyModeV1;
  /** Whether the schedule is enabled immediately. */
  isEnabled: boolean;
}

/** Child work unit inside a swarm proposal. */
export interface SwarmChildPlanV1 {
  /** Stable child identifier. */
  childId: string;
  /** Goal assigned to the child worker. */
  objective: string;
  /** Tool or module scope allowed for the child. */
  toolScope: string[];
  /** Maximum duration for the child. */
  maxDurationMs: number | null;
  /** Child output schema key expected by fan-in. */
  outputSchemaRef: string | null;
}

/** Fan-out/fan-in contract for parallel execution. */
export interface SwarmPlanV1 {
  /** Child plans to run in parallel. */
  children: SwarmChildPlanV1[];
  /** How partial failures should be handled. */
  partialFailurePolicy: 'block' | 'return_partial' | 'compensate_failed_branch';
  /** Aggregation method used at fan-in. */
  aggregateMode: 'merge' | 'rank' | 'vote' | 'reduce';
  /** Schema for the aggregate output. */
  aggregateOutputSchemaRef: string | null;
}

/** Base fields required for every proposal variant. */
export interface EnvelopeBaseV1 {
  /** Discriminator used by clients, approval engine, and executor. */
  messageType: MessageTypeV1;
  /** Stable proposal identifier. */
  proposalId: string;
  /** Chat or execution session identifier. */
  sessionId: string;
  /** Tenant identifier for ACL, billing, and routing. */
  tenantId: string;
  /** End-user identifier that initiated the request. */
  userId: string;
  /** Primary module impacted by the proposal. */
  targetModule: string;
  /** Primary target type impacted by the proposal. */
  targetType: string;
  /** Primary target identifier; use a synthetic stable ID for bundle-level proposals. */
  targetId: string;
  /** Severity used for approval, UI, and audit handling. */
  severity: SeverityV1;
  /** Short business summary shown in chat and approval UI. */
  summary: string;
  /** Why the proposal is being made. */
  rationale: string;
  /** Ordered operation list; read previews must provide an empty array. */
  ops: OperationV1[];
  /** Optimistic concurrency assertions across all touched records. */
  expectedVersions: ExpectedVersionV1[];
  /** Recommended post-action navigation. */
  navigationIntent: NavigationIntentV1 | null;
  /** Effective approval policy after policy resolution. */
  approvalPolicy: ApprovalPolicyV1;
  /** Cost, token, and duration constraints. */
  budgetBudget: BudgetBudgetV1;
  /** Tags used to stamp telemetry, traces, and cost reports. */
  telemetryTags: Record<string, string | number | boolean>;
  /** Optional approval evidence once a policy gate is resolved. */
  approvalEnvelope: ApprovalEnvelopeV1 | null;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Optional run identifier if the proposal has already been admitted into the ledger. */
  runId: string | null;
}

/** Read-only preview shown before any write or schedule is proposed. */
export interface ReadPreviewV1 extends EnvelopeBaseV1 {
  messageType: 'read_preview';
  ops: [];
  readPreview: ReadPreviewPayloadV1;
}

/** Immediate execution proposal for a single bundle of work. */
export interface DirectExecutionProposalV1 extends EnvelopeBaseV1 {
  messageType: 'execution_proposal';
  readPreview: ReadPreviewPayloadV1 | null;
}

/** Proposal that would create or modify a durable schedule. */
export interface ScheduledProposalV1 extends EnvelopeBaseV1 {
  messageType: 'scheduled_proposal';
  schedule: ScheduleDefinitionV1;
  readPreview: ReadPreviewPayloadV1 | null;
}

/** Proposal that fans out to multiple parallel child workers and fans in results. */
export interface SwarmProposalV1 extends EnvelopeBaseV1 {
  messageType: 'swarm_proposal';
  swarm: SwarmPlanV1;
  readPreview: ReadPreviewPayloadV1 | null;
}
```

---

## Severity ladder — S0 through S4

Severity is a **business-control contract**, not a UX nicety. Reviewed systems show approvals, confirmations, cancellations, retries, audit logs, and run histories — the missing piece is a unified blast-radius ladder that maps those controls to consulting work.

### S0_READ_ONLY

- **Definition and blast radius:** pure retrieval, analysis, navigation, summarisation, preview generation with no persistent mutation. No shared state changes, no external notifications, no schedule creation.
- **Examples:** preview client profitability scenario without saving; read deck draft and mark candidate slide edits only in chat; inspect connector permissions; summarise last week's PMO risks; open CFO review page without mutating it.
- **Default approval policy:** `auto`.
- **Undo / compensation:** not applicable; retries are safe.
- **Audit retention:** 30 days.
- **Mandatory telemetry fields:** `runId`, `proposalId`, `tenantId`, `userId`, `targetModule`, `targetType`, `targetId`, `toolSet`, `durationMs`, `tokensIn`, `tokensOut`, `sourceCount`.
- **UI treatment:** inline card in chat or side panel.

### S1_PERSONAL_WRITE

- **Definition and blast radius:** writes that affect only the initiating user's workspace or private draft state, with no shared or client-visible consequence.
- **Examples:** save Piotr's private hypothesis note for a steering meeting; create personal TODO list for engagement lead; save private research collection; update initiator's watchlist; store a personal red-team prompt set.
- **Default approval policy:** `one_click`.
- **Undo / compensation:** direct automatic rollback required.
- **Audit retention:** 1 year.
- **Mandatory telemetry fields:** S0 fields + `diffChecksum`, `expectedVersionMode`, `reversible`, `idempotencyKey`.
- **UI treatment:** inline confirmation card or lightweight approval tray.

### S2_REVERSIBLE_WRITE

- **Definition and blast radius:** shared-state mutation that is reversible within a defined rollback window and does not trigger irreversible external action.
- **Examples:** mutate a scenario assumption set that the CFO will later review; update a workplan milestone; draft but not publish a client-facing deck; re-link a task bundle to a workstream; create a scheduled weekly research brief with overlap `skip`.
- **Default approval policy:** `explicit` for first execution; policy may downgrade to `one_click` for trusted low-risk paths.
- **Undo / compensation:** rollback or compensating action **mandatory and tested**.
- **Audit retention:** 3 years.
- **Mandatory telemetry fields:** S1 fields + `approvalMode`, `approvalPolicyVersion`, `approvalRecordId`, `beforeVersion`, `afterVersion`, `artifactIds`, `costCenter`, `engagementId`.
- **UI treatment:** modal approval with diff preview; batch actions routed through approval tray.

### S3_IRREVERSIBLE_WRITE_OR_MULTI_USER

- **Definition and blast radius:** irreversible mutation, publication, or any change affecting multiple users, a live engagement artefact, or a downstream workflow that cannot be cleanly rewound.
- **Examples:** publish a Partner-reviewed client deck to shared engagement workspace; send stakeholder notifications from approved scenario; delete a shared scenario branch; approve staffing change reassigning team work; enable schedule that auto-distributes board-pack summaries to multiple recipients.
- **Default approval policy:** `dual_control`.
- **Undo / compensation:** **compensating action mandatory**; plain rollback insufficient.
- **Audit retention:** 7 years.
- **Mandatory telemetry fields:** S2 fields + `approverUserIds`, `reviewerComments`, `distributionList`, `affectedUserCount`, `publishedArtifactHash`, `clientVisibility`, `notificationChannel`.
- **UI treatment:** blocking approval modal + approval tray entry; **no silent auto-run**.

### S4_IRREVERSIBLE_FINANCIAL_OR_LEGAL

- **Definition and blast radius:** actions with financial, legal, security, compliance, or regulatory consequence, or changes that expand authority itself.
- **Examples:** CFO approval of material scenario mutation used for board or banking output; Partner approval of final client-facing deck publish to formal delivery channel; CISO approval of connector scope escalation for a new data source; approval to write into finance-controlled systems; approval to destroy or redact governed evidence.
- **Default approval policy:** `org_admin_only` or `dual_control` with named control owners, depending on policy pack.
- **Undo / compensation:** **compensating action and incident path mandatory**; legal-hold semantics supported.
- **Audit retention:** 7 years minimum, with legal-hold override.
- **Mandatory telemetry fields:** S3 fields + `controlOwnerIds`, `legalEntityId`, `policyExceptionId`, `connectorScopeDelta`, `regulatedDataClass`, `externalReferenceId`, `approvalChainId`.
- **UI treatment:** blocking modal + dedicated approval tray + optional off-channel notification (email or enterprise messaging).

### Severity summary matrix

| Severity | Default approval | Undo | Retention | UI |
| --- | --- | --- | --- | --- |
| S0 | `auto` | N/A | 30d | inline / side panel |
| S1 | `one_click` | direct automatic | 1y | inline confirm / tray |
| S2 | `explicit` (→ `one_click` allowed) | rollback or compensation, tested | 3y | modal + diff + tray |
| S3 | `dual_control` | compensating action mandatory | 7y | blocking modal + tray |
| S4 | `org_admin_only` / `dual_control` named owners | compensation + incident + legal-hold | 7y+ (legal-hold override) | blocking modal + tray + off-channel notification |

---

## Run Ledger architecture

Consultify separates the **proposal plane** from the **run plane**.

- **Proposal plane** produces `ActionEnvelopeV1`.
- **Run plane** admits approved work into durable `RunLedger`, executes through `QueueExecutor`, persists snapshots in `CheckpointStore`, stores large outputs in `ArtifactStore`, manages recurrence through `ScheduleRegistry`, centralises traces in `TraceCollector`, pushes user updates through `NotificationBroker`.

### Components

| Component | Responsibility | Storage boundary | Consistency guarantee |
| --- | --- | --- | --- |
| **RunLedger** | Source of truth for run identity, state transitions, approval barriers, retry counters, interrupts, final disposition | Relational store OR append-only event log + current-state projection | Strong consistency for per-run state transitions. A run cannot move from `blocked_for_approval` to `running` twice. |
| **QueueExecutor** | Pulls runnable steps from ledger, executes tools or domain handlers, writes completion/failure outcomes with idempotency keys | Stateless workers with access to ledger + checkpoint store | At-least-once delivery with **effectively-once business effect**, enforced by `idempotencyKey` + version assertions |
| **CheckpointStore** | Snapshots step inputs, normalised outputs, model summaries, branch state, replay cursors | Immutable checkpoint records keyed by `runId` + `checkpointOrdinal` | Write-once ordered snapshots |
| **ArtifactStore** | Stores heavy objects: generated decks, screenshots, JSONL transcripts, logs, CSVs, preview renders, diff bundles | Object store | Content-addressed immutability with checksums; eventual consistency acceptable because ledger references artefact hashes, not mutable blobs |
| **ScheduleRegistry** | Stores `ScheduleDefinitionV1`, enable/disable state, overlap policy, last trigger, next trigger | Transactional schedule table + clock-worker | Strong consistency on create / pause / resume / update / delete to avoid duplicate triggers |
| **TraceCollector** | Receives spans from orchestration, tools, approvals, notifications, connector calls | Distributed tracing backend | Eventual ingest acceptable; span IDs immutable and joinable by `runId` |
| **NotificationBroker** | Fans events out to inline chat cards, dock items, bell notifications, email | Message broker + delivery log | At-least-once with dedup by notification key |

### Queue, retry, resume, cancel semantics

| State | Meaning |
| --- | --- |
| `queued` | Admitted but not yet executing |
| `running` | At least one step is live |
| `waiting_on_external` | Worker idle pending callback or tool result |
| `blocked_for_approval` | No execution may continue until approval resolved |
| `retry_scheduled` | Next attempt already persisted |
| `paused` | User intentionally suspended the run |
| `cancelling` | No new work may start; in-flight being drained |
| `cancelled` / `failed` / `compensated` / `completed` | **Terminal** states |

**Idempotency keys required at both op level and external side-effect level.** A repeated dequeue may re-run a function call but may not create a second deck publication or a duplicate client notification.

Retries are a feature **only when side effects are bounded and deduplicated**.

### Schedule contract runtime semantics

| Overlap | Semantics | Safe for |
| --- | --- | --- |
| `allow` | Concurrent executions allowed | Idempotent S0–S1 only |
| `skip` | Skip if previous still running | Default for recurring research briefs |
| `queue` | FIFO one-at-a-time | Every instance must run; exclusion required |
| `cancel_previous` | Kill previous before starting new | Superseding discovery work; **not** legal/financial flows |

### Swarm contract

Explicit, not magical:
- Swarm run fans out **only after parent envelope is approved**.
- Each child: constrained tool scope, child budget, child checkpoint stream, typed output target.
- Fan-in declares whether partial failure blocks completion, returns partial result, or triggers branch-level compensation.
- Aggregate results include child statuses, artefacts, citations, deterministic merge method.

### Long research session phase machine

```
intake → plan → source_acquisition → synthesis → draft_assembly → review_ready → human_review → publish_or_handoff → (terminal)
```

Every phase change emits telemetry:
- `agent.run_started`
- `agent.phase_changed`
- `agent.checkpoint_persisted`
- `agent.approval_requested`
- `agent.approval_resolved`
- `agent.swarm_child_started`
- `agent.swarm_child_completed`
- `agent.notification_sent`
- `agent.permission_violation`
- `agent.cost_recorded`

### Progress reporting — four surfaces

| Surface | Purpose |
| --- | --- |
| **Inline card** | Immediate conversational trust |
| **Dock** | Long-running active work |
| **Bell** | Approvals, failures, completions |
| **Email** | Asynchronous closure, compliance-sensitive escalations |

### User interrupts — nine verbs

1. `pause`
2. `cancel`
3. `skip`
4. `reduce_scope`
5. `escalate`
6. `request_review`
7. `revoke_access`
8. `retry_with_different_params`
9. `abort_entire_run`

### Operator observability

- live logs
- historical logs
- anomaly detection
- cost attribution
- permission violations
- **bounded rationale explainability** (business reasoning without raw chain-of-thought leakage)

---

## Requirements register

| ID | Prio | Requirement | Acceptance test | Risk if missed |
| --- | --- | --- | --- | --- |
| **R-AGENT-1** | **P0** | The platform shall define `AgentDefinitionV1` with explicit tool scope, output schema, approval policy, SLA, and allowed target modules | Create an agent without `toolScope` or `outputSchemaRef`; build must fail schema validation | Unbounded agents and inconsistent outputs |
| **R-AGENT-2** | **P0** | All execution-capable agent outputs shall conform to `ActionEnvelopeV1` | Feed a read preview, write proposal, schedule proposal, and swarm proposal into one executor entrypoint; all must validate | Ad-hoc tool payload sprawl |
| **R-AGENT-3** | **P0** | `ExecutionProposalV1` shall be a discriminated union by `messageType` | A client switches on `messageType` and renders all four variants without runtime casts | UI and executor divergence |
| **R-AGENT-4** | **P0** | Any mutating op shall carry `DiffPreviewV1` | Submit an update op without `diffPreview`; policy engine must reject with `POLICY_BLOCK` | Blind approvals and poor trust |
| **R-AGENT-5** | **P0** | All writes shall enforce optimistic concurrency through `expectedVersions` | Mutate a scenario after another user changes it; executor must stop with `STALE_STATE` | Silent overwrite of newer work |
| **R-AGENT-6** | **P0** | Navigation after execution shall use a typed contract of route + params + focus | Approving a deck draft moves the user directly to the slide and comment block specified in `navigationIntent` | Disorienting UX and broken review flow |
| **R-AGENT-7** | **P0** | Every envelope shall be classified into S0–S4 before execution | Submit a client-facing publish without severity; executor must refuse admission | No blast-radius gating |
| **R-AGENT-8** | **P0** | Approval mode shall derive from severity and policy, not from the tool adapter | The same `publishDeck` tool invoked in S2 and S4 yields different approval requirements | Control bypass by tool choice |
| **R-AGENT-9** | **P0** | Approval evidence shall be recorded in `ApprovalEnvelopeV1` with approver identity, timestamp, decision, and policy version | Approve an S3 publish; audit view shows who approved, when, under which rules | Non-defensible audit trail |
| **R-AGENT-10** | **P0** | The runtime shall expose exactly these named error codes: `PERMISSION_DENIED`, `STALE_STATE`, `RATE_LIMITED`, `BUDGET_EXCEEDED`, `TOOL_FAILURE`, `POLICY_BLOCK`, `COMPENSATION_FAILED` | Inject each failure mode and assert the surfaced code and retry classification | Opaque failures and brittle clients |
| **R-AGENT-11** | **P0** | All admitted work shall be persisted in a durable `RunLedger` | Drop the client connection mid-run; the run remains queryable and resumable | Long work disappears with the chat tab |
| **R-AGENT-12** | **P0** | Queue execution shall require idempotency at op and side-effect level | Replay the same dequeued op twice; only one external publish occurs | Duplicate writes, emails, or deck pushes |
| **R-AGENT-13** | **P0** | A `CheckpointStore` shall persist resumable state after every phase boundary and approval barrier | Restart workers during synthesis; run resumes from the last checkpoint rather than from intake | Expensive restarts and user frustration |
| **R-AGENT-14** | **P1** | An immutable `ArtifactStore` shall retain generated outputs, previews, screenshots, logs, and supporting evidence with checksums | Download the reviewed deck artefact and verify checksum against run record | No verifiable output history |
| **R-AGENT-15** | **P0** | A `ScheduleRegistry` shall manage create, pause, resume, update, and delete for recurring work | Pause a weekly deep-research schedule; no new run is triggered until resume | Ghost schedules and duplicate automation |
| **R-AGENT-16** | **P0** | `ScheduleDefinitionV1` shall support cron, interval, `overlapPolicy`, and `budgetPolicy` | Register one cron and one interval schedule; both validate and execute correctly | Unsafe or underspecified recurrence |
| **R-AGENT-17** | **P0** | The executor shall support four modes: atomic bundle, sequential compensating sequence, approval barrier sequence, fan-out/fan-in | Run one example of each mode in integration tests | Runtime cannot express real work safely |
| **R-AGENT-18** | **P0** | Multi-step transactions shall define compensating actions for non-identical rollback | Fail after slide publish but before notification; runtime executes the declared compensation path | Partial completion with no recovery plan |
| **R-AGENT-19** | **P1** | A `TraceCollector` shall emit distributed traces per run and per op | Join spans from planner, tool executor, approval engine, and connector under one `runId` | Root-cause analysis becomes guesswork |
| **R-AGENT-20** | **P1** | A `NotificationBroker` shall support inline card, dock, bell, and email delivery surfaces | Trigger an S3 approval request and confirm it appears on all configured surfaces | Users miss approvals or failures |
| **R-AGENT-21** | **P0** | Swarm execution shall declare fan-out scope, fan-in aggregation, and partial-failure policy | One child fails during multi-source research; aggregate result obeys declared policy | Parallelism becomes non-deterministic |
| **R-AGENT-22** | **P1** | Long research runs shall implement the phase machine `intake → plan → source_acquisition → synthesis → draft_assembly → review_ready → human_review → publish_or_handoff` | A research run's history shows only valid phase transitions | No shared language for progress or recovery |
| **R-AGENT-23** | **P1** | Progress shall be continuously surfaced on four surfaces with telemetry-backed percentages or state labels | Users can track an active run from chat, dock, bell, and email without opening logs | "Working…" becomes meaningless |
| **R-AGENT-24** | **P0** | The runtime shall support the nine interrupt verbs: `pause`, `cancel`, `skip`, `reduce_scope`, `escalate`, `request_review`, `revoke_access`, `retry_with_different_params`, `abort_entire_run` | Each interrupt produces a deterministic state transition and audit record | Humans cannot safely steer long work |
| **R-AGENT-25** | **P1** | Operator tooling shall support live logs, historical logs, anomaly flags, and run search by user, tenant, module, and error code | Support can find all failed S2 scenario runs for one engagement in under 30 seconds | Slow incident response |
| **R-AGENT-26** | **P1** | The platform shall define `AgentIncidentV1` to record severity, run context, failing op, evidence links, human summary, machine context, resolution state | Force a compensation failure; an incident record is automatically created and linked | Failures vanish into raw logs |
| **R-AGENT-27** | **P0** | Cost attribution shall be recorded per run and broken out by tenant, user, engagement, model/tool family, cost centre | Finance exports daily run costs grouped by tenant and engagement without log scraping | No budget control or ROI proof |
| **R-AGENT-28** | **P0** | Permission-violation telemetry shall emit `agent.permission_violation` with actor, target, module, connector scope, enforcement outcome | Attempt connector scope escalation without approval; alert event generated and searchable | Security violations become invisible |
| **R-AGENT-29** | **P0** | Bounded-rationale explainability shall expose concise business reasoning and decision factors without leaking chain-of-thought or raw tool internals | User sees *"publish blocked because deck hash changed after approval"* rather than raw hidden reasoning traces | Either unsafe leakage or unusable opacity |

---

## Requirements inventory (flat list)

| ID | Priority | One-liner |
| --- | --- | --- |
| R-AGENT-1 | P0 | `AgentDefinitionV1` with tool scope + output schema + approval policy + SLA |
| R-AGENT-2 | P0 | All execution-capable outputs conform to `ActionEnvelopeV1` |
| R-AGENT-3 | P0 | `ExecutionProposalV1` discriminated union by `messageType` |
| R-AGENT-4 | P0 | Mutating ops require `DiffPreviewV1` |
| R-AGENT-5 | P0 | Writes enforce optimistic concurrency via `expectedVersions` |
| R-AGENT-6 | P0 | Typed navigation contract: route + params + focus |
| R-AGENT-7 | P0 | Every envelope classified S0–S4 before execution |
| R-AGENT-8 | P0 | Approval mode from severity + policy, not tool adapter |
| R-AGENT-9 | P0 | Approval evidence in `ApprovalEnvelopeV1` (who/when/decision/policy version) |
| R-AGENT-10 | P0 | 7 named error codes exactly |
| R-AGENT-11 | P0 | Durable `RunLedger` for all admitted work |
| R-AGENT-12 | P0 | Idempotency at op + side-effect level |
| R-AGENT-13 | P0 | `CheckpointStore` after every phase boundary + approval barrier |
| R-AGENT-14 | P1 | Immutable `ArtifactStore` with checksums |
| R-AGENT-15 | P0 | `ScheduleRegistry` CRUD for recurring work |
| R-AGENT-16 | P0 | `ScheduleDefinitionV1` cron + interval + overlap + budget |
| R-AGENT-17 | P0 | 4 executor modes: atomic / compensating sequence / approval barrier / fan-out |
| R-AGENT-18 | P0 | Compensating actions for non-identical rollback |
| R-AGENT-19 | P1 | `TraceCollector` distributed traces per run + per op |
| R-AGENT-20 | P1 | `NotificationBroker` on 4 surfaces |
| R-AGENT-21 | P0 | Swarm fan-out + fan-in + partial-failure policy declared |
| R-AGENT-22 | P1 | Long research phase machine (8 phases) |
| R-AGENT-23 | P1 | Progress on 4 surfaces with telemetry |
| R-AGENT-24 | P0 | 9 interrupt verbs |
| R-AGENT-25 | P1 | Operator tooling: live / historical / anomaly / search |
| R-AGENT-26 | P1 | `AgentIncidentV1` record |
| R-AGENT-27 | P0 | Cost attribution per run + tenant + user + engagement + model + cost centre |
| R-AGENT-28 | P0 | Permission-violation telemetry |
| R-AGENT-29 | P0 | Bounded-rationale explainability |

**Totals:** 29 requirements — 19 × P0, 10 × P1, 0 × P2.

---

## Anti-patterns to forbid

1. **Direct tool writes from chat text.** No connector or module may infer authorisation solely from a conversational message.
2. **Tool-specific approval logic.** Approval attached to the tool instead of severity will be bypassed the moment a new tool is introduced.
3. **Writes without diff previews.** If approvers cannot see before/after delta, the approval is not meaningful.
4. **No version assertions.** "Last write wins" is unacceptable for shared consulting artefacts.
5. **Ephemeral long runs.** Any run that can outlive a socket must live in the ledger.
6. **Retrying non-idempotent steps blindly.** Replays must never duplicate publishes, notifications, or external submissions.
7. **Parallel branches without fan-in policy.** Swarms must declare how partial failure behaves.
8. **Schedules stored as prompts only.** A schedule is an operational object, not an instruction string in chat history.
9. **Audit logs stored only in mutable domain tables.** Run evidence and business state must be separable.
10. **Approvals with no policy version.** If the rules that allowed a decision are not versioned, the evidence is weak.
11. **Raw chain-of-thought exposure as explainability.** Operators need bounded rationale, not hidden reasoning leakage.
12. **Connector scope escalation without dedicated control owner.** CISO-sensitive authority changes must never be buried inside routine execution.

---

## Benchmark matrix

Six most relevant user-facing benchmarks. Temporal / Step Functions / GitHub Actions / Airflow / Vercel AI SDK / LangGraph are implementation archetypes to borrow from underneath this layer.

| Vendor | Envelope format | Severity model | Approval gates | Long-run durability | Interrupt primitives | Cost attribution |
| --- | --- | --- | --- | --- | --- | --- |
| **OpenAI Agent / Operator** | Typed response items, tools, conversations, background responses | No published S0–S4 ladder; approvals + sandboxing product-specific | Permission before consequential actions; browser take-over; cancel background runs | Strong for API responses and conversations; not a full enterprise run ledger by itself | Stop, take over browser, cancel background response, resume conversation | Strong at org/project/user aggregation via Usage/Costs APIs; not a semantic run-cost model out of the box |
| **Anthropic Computer Use / Projects** | Structured `tool_use`/`tool_result` loop + project context + routines | No public severity ladder in reviewed docs | App-defined for client tools; routines + human oversight patterns exist, but policy mostly left to integrator | Good for scheduled routines and app-managed loops; durable control plane must be built by customer | Pause via app-level tool loop, schedule runs, user-managed review | Pricing well documented including tool-use pricing; per-run enterprise attribution is integrator concern |
| **Cursor Agent** | Agent chats, plans, cloud agents, transcripts, PR artefacts | Sandbox/approval controls rather than public business severity ladder | Approval when leaving sandbox; session-level file edit approvals; take-over/follow-up | Strong for coding: remote/cloud agents, transcripts, artefacts, isolated VMs | View status, send follow-up, take over, multi-agent parallelism | Team analytics + analytics API; tailored to developer productivity rather than enterprise blast radius |
| **Zapier Agents** | Natural-language agent instructions + HITL + activity statuses | No unified severity ladder | Approval steps in agents or Zaps; HITL pauses the workflow | Good for business automation status/history; weaker on replayable checkpoint semantics | Needs action, approve, reject, stop, cancel | Native activity-based usage + enterprise analytics |
| **Atlassian Rovo Agents** | Prompt + agent tools/skills + debug response + automations | No published severity ladder; enterprise governance via RBAC + admin controls | Skills usually require confirmation; MCP + external tools respect user permissions + admin controls | Good run/debug visibility inside Atlassian ecosystem; not a general replay runtime | Confirmation, automation triggers, admin revocation of external tool access | Rovo credits + platform usage provide usable attribution; not full per-run business semantics |
| **Microsoft Copilot Studio** | Agent flows with triggers, actions, approvals, analytics, Purview audit | No general S0–S4 ladder, but explicit multistage + AI approvals exist | **Strongest business approval model of the six:** multistage approvals, AI approvals, cancelable approvals | Strong business-flow durability with run history, cancel/resubmit, analytics, audit logs | Cancel runs, resubmit runs, wait-for-approval patterns | Strong Copilot Credits consumption analytics + billing visibility |

### Practical conclusion

**No benchmark combines typed execution envelopes, business-severity classes, durable replay, optimistic concurrency, and compensating multi-module transactions in one enterprise consulting runtime.**

- OpenAI: closest on typed agent primitives
- Copilot Studio: closest on business approvals
- Cursor: closest on modern agent operator ergonomics
- Rovo + Zapier: admin-facing governance patterns
- Temporal / Step Functions / LangGraph: clearest models for underlying durability layer

**Consultify needs a composite design, not a product clone.**

---

## 14-day MVP roadmap

**Pilot flow:** core runtime + **one S2 end-to-end** — *"CFO-reviewed scenario mutation with reversible publish-to-draft"*.

Hard enough to validate the architecture but reversible enough to avoid S3/S4 complexity in the first increment.

| Day | Deliverable | Exit criterion |
| --- | --- | --- |
| **1** | Freeze `ActionEnvelopeV1`, `ExecutionProposalV1`, `DiffPreviewV1`, `ApprovalPolicyV1` | JSON schema + TS types compile; sample payloads validate |
| **2** | Severity classifier + policy resolver | Same proposal deterministically maps to S0–S4 and approval mode |
| **3** | `RunLedger` tables + run-state machine | Runs survive process restart; support terminal/non-terminal transitions |
| **4** | `QueueExecutor` with idempotency keys | Duplicate dequeues do not duplicate side effects |
| **5** | `CheckpointStore` + checkpoint events | A paused or crashed run resumes from last persisted phase |
| **6** | `DiffPreview` renderer + approval tray UI | S2 proposal shows human-readable + field-level diff before approval |
| **7** | Optimistic concurrency via `expectedVersions` | Stale write path throws `STALE_STATE` + returns refresh preview |
| **8** | S2 scenario mutation executor + compensating rollback | Executor can apply and reverse a scenario assumption change |
| **9** | `NotificationBroker` → inline card, dock, bell, email | Users receive approval + completion on all four surfaces |
| **10** | Operator logs + trace IDs + cost recording | One run traced across planner, executor, approval, connector calls |
| **11** | `ScheduleRegistry` + `scheduled_proposal` support | Paused + resumed weekly research schedule behaves correctly |
| **12** | Swarm scaffolding + child-run aggregation | Parallel child runs produce one aggregate result with branch status |
| **13** | Incident capture + permission-violation telemetry | Failed compensation or blocked connector access opens `AgentIncidentV1` |
| **14** | S2 end-to-end acceptance suite + freeze pilot contract | Demo: user proposes a scenario mutation, reviewer approves, run executes, rollback works, logs and costs queryable |

### S2 pilot flow walkthrough

1. Consultant asks the agent to adjust a forecast scenario.
2. Agent returns `read_preview` followed by `execution_proposal` carrying:
   - reversible `update` op
   - full `DiffPreviewV1`
   - `expectedVersions`
   - `navigationIntent` back to scenario view
   - `budgetBudget`
   - telemetry tags (tenant, engagement, cost centre)
3. CFO receives approval tray card, inspects diff, approves.
4. `RunLedger` admits the run.
5. If a competing user changed the scenario since proposal was produced → executor halts with `STALE_STATE`.
6. If the write succeeds but downstream draft artefact fails → declared compensating action rolls scenario back.
7. If compensation itself fails → incident opens.

That single path proves essential runtime contracts **without taking on final client publication or legal/financial S4 formality**.

---

## ID reconciliation with the prior truncated doc

The prior `DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_2026-04-18.md` was **truncated at both ends** and captured a partial `R-AGENT-1…20`. This document is the **full source**; it captures `R-AGENT-1…29` directly from the complete research output.

**At plan-action time:**
- **Close** all `R-AGENT-1…20` rows from the truncated doc as "superseded by full version".
- Use `R-AGENT-1…29` from **this doc** as the canonical ticket seeds.
- No per-row mapping is required because the truncated file's IDs were a partial subset of the same numbering; the full list is a superset including all previously listed items plus `R-AGENT-21..29`.

To be explicit, the IDs unique to this document (not in the truncated doc) are:
- `R-AGENT-21` — swarm fan-out/fan-in/partial-failure policy
- `R-AGENT-22` — long research phase machine
- `R-AGENT-23` — progress on 4 surfaces
- `R-AGENT-24` — 9 interrupt verbs
- `R-AGENT-25` — operator tooling (live / historical / anomaly / search)
- `R-AGENT-26` — `AgentIncidentV1`
- `R-AGENT-27` — cost attribution per run / tenant / user / engagement / model / cost centre
- `R-AGENT-28` — permission-violation telemetry
- `R-AGENT-29` — bounded-rationale explainability

The truncated doc should be archived and not referenced by the plan.

---

## Cross-document linkage

- **Reasoning (`DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md`):**
  - Bounded-rationale explainability (R-AGENT-29) is the agent-surface form of Reasoning self-check output (R-REASON-10) — business reasoning only, no raw chain-of-thought.
  - Every `ActionEnvelopeV1.rationale` field carries the trust bundle summary from R-REASON-15/16.
  - Checkpointing (R-AGENT-13) separates reasoning output from execution authority — prevents "reasoning says so" from becoming a write primitive.
  - Error codes (R-AGENT-10) line up with Reasoning's `insufficient_evidence` path (R-REASON-12): `POLICY_BLOCK` when evidence missing, not `TOOL_FAILURE`.

- **Feedback / Learning (`DEEP_RESEARCH_FEEDBACK_SELF_LEARNING_2026-04-18.md`):**
  - `RunLedger` (R-AGENT-11) + `AgentIncidentV1` (R-AGENT-26) are the durable substrate the learning loop mines for patterns (R-LEARN-7).
  - Approval outcomes (R-AGENT-9) are first-class feedback signals (R-LEARN-2 explicit correction + R-LEARN-3 comparative choice).
  - Diff-review signals (R-AGENT-4 `DiffPreviewV1`) feed supervised improvement — replayable checkpoints (R-AGENT-13) enable offline eval (R-LEARN-9).
  - SAR export (R-LEARN-6) reads from immutable `ArtifactStore` (R-AGENT-14) and `RunLedger` audit trail.

- **Artifact Runtime (`DEEP_RESEARCH_ARTIFACT_RUNTIME_DETAILED_2026-04-18.md`):**
  - `MutationProposal` (R-ARTIFACT-7) is the **artifact-specialisation of** `ExecutionProposalV1` (this doc). They are not two systems.
  - `DiffPreviewV1` (R-AGENT-4) renders via `PreviewPayload` (R-ARTIFACT-9).
  - Approval-barrier execution mode (R-AGENT-17) invokes R-ARTIFACT-21 role-based approval policy engine.
  - `ArtifactStore` (R-AGENT-14) persists published artefact hashes (R-ARTIFACT-24).
  - Compensating publish/remove actions (R-AGENT-18) cover the "approved deck published but notifications failed" case — rolls back via R-ARTIFACT-13 single-txn undo.
  - Navigation contract (R-AGENT-6) routes post-approval landings into specific artifact surfaces (slide + block + comment).

- **Enterprise Integrations (`DEEP_RESEARCH_ENTERPRISE_INTEGRATIONS_DETAILED_2026-04-18.md`):**
  - `AgentDefinitionV1.toolScope` (R-AGENT-1) is populated from connector catalogue + trust modes (R-CONNECT-2).
  - Permission-violation telemetry (R-AGENT-28) enforces connector ACL contract (R-CONNECT-7).
  - CISO-governed scope escalation (R-AGENT-29 explainability + S4 severity ladder) uses the connector scope audit (R-CONNECT-11) and admin justification workflow (R-CONNECT-3).
  - Kill switch (R-CONNECT-12) must `cancel` active runs touching that connector — `runs.state = cancelling → cancelled` with reason `connector_revoked`.
  - Rate-limit headroom (R-CONNECT-13) feeds `BudgetBudgetV1.maxToolCalls` budgeting.

- **ROI (`DEEP_RESEARCH_ROI_LIFECYCLE_DETAILED_2026-04-18.md`):**
  - Cost attribution per run (R-AGENT-27) by tenant / user / engagement / model / cost centre is the **substrate** for ROI cost-ledger (R-OUTCOME-8).
  - Run outcomes distinguish draft generation from approved business value — only `completed` runs with `S3`/`S4` approval contribute to `hard_value` ledger; `S0`–`S2` draft work is operational cost.
  - `RunLedger` severity + approval records (R-AGENT-9) provide SOX-defensible evidence (R-OUTCOME-3 / R-OUTCOME-12) for measurement provenance.

- **Deep Research (`DEEP_RESEARCH_DEEP_RESEARCH_REPORTING_2026-04-18.md`):**
  - `research_session` (R-RESEARCH-1) is a concrete long-running instance of `RunLedger` (R-AGENT-11) — same entity family.
  - Checkpoint-based resumability (R-RESEARCH-16) implements `CheckpointStore` (R-AGENT-13).
  - Parallel subreports (R-RESEARCH-23) use swarm fan-out/fan-in (R-AGENT-21).
  - Four-surface progress (R-AGENT-23) is the UI surface of research dock (R-RESEARCH-15).
  - Review gate for high-stakes reports (R-RESEARCH-20) uses approval-barrier execution mode (R-AGENT-17) + policy engine (R-ARTIFACT-21).
  - 9 interrupt verbs (R-AGENT-24) are the exhaustive set; deep research maps to: `pause`, `resume` (via `retry_with_different_params`), `cancel`, `reduce_scope`, `request_review`.

- **Onboarding (pending detailed):**
  - Severity-aware defaults + policy templates + sample S2 flows + approval-role bootstrap (this doc) must be surfaced during onboarding.
  - Operator dashboards (R-AGENT-25) explain run state without exposing hidden reasoning — critical for CISO onboarding trust moment.
  - First-run MVP flow can use the S2 scenario mutation as the CFO aha-moment.

---

## What this document is NOT

- Not a ticket backlog (next pass converts `R-AGENT-*` into tickets, flags, tests, CI invariants).
- Not a runtime-implementation spec — library/storage choices (Temporal vs in-house vs hybrid, Postgres vs event log, object store vendor) are implementation decisions; contracts stay.
- Not a UX spec — approval tray, dock, bell, inline card wireframes live in dedicated UX docs.
- Not a replacement for the existing dev plans — it is the **substrate** execution-capable agents become envelopes over.

## Next step

Turn this document into the canonical Agent Runtime implementation plan alongside Reasoning / Feedback / ROI / Connectors / Artifact / Deep Research / Onboarding:

1. **Archive** the truncated `DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_2026-04-18.md` (do not delete — mark as `(SUPERSEDED — see _FULL)` in header only).
2. Assign each `R-AGENT-*` from this doc a ticket ID and block (likely a dedicated `agent_runtime` block in `ChatV9Block` union or a `ChatV10Block`).
3. Register feature flags per requirement:
   - `ff.agent_definition_v1`, `ff.agent_action_envelope_v1`, `ff.agent_execution_proposal_union`, `ff.agent_diff_preview_mandatory`, `ff.agent_optimistic_concurrency`, `ff.agent_typed_navigation`, `ff.agent_severity_classifier`, `ff.agent_approval_by_severity`, `ff.agent_approval_evidence`, `ff.agent_named_error_codes`
   - `ff.agent_run_ledger`, `ff.agent_idempotency`, `ff.agent_checkpoint_store`, `ff.agent_artifact_store`, `ff.agent_schedule_registry`, `ff.agent_schedule_definition`, `ff.agent_executor_modes`, `ff.agent_compensating_actions`
   - `ff.agent_trace_collector`, `ff.agent_notification_broker`
   - `ff.agent_swarm_contract`, `ff.agent_research_phase_machine`, `ff.agent_progress_four_surfaces`, `ff.agent_interrupt_verbs`, `ff.agent_operator_tooling`, `ff.agent_incident_v1`, `ff.agent_cost_attribution`, `ff.agent_permission_violation_telemetry`, `ff.agent_bounded_rationale`
4. Draft `AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` with per-ticket acceptance + test strategy; split by sub-surface (Envelope / Severity / Ledger / Executor / Schedule / Swarm / Progress / Interrupts / Observability).
5. Extend `CHAT_V9_TELEMETRY_CONTRACT` with `agent.*` event families:
   - `agent.proposal_created`, `agent.proposal_classified`, `agent.proposal_admitted`, `agent.proposal_rejected`
   - `agent.run_started`, `agent.run_completed`, `agent.run_failed`, `agent.run_compensated`, `agent.run_cancelled`, `agent.run_paused`, `agent.run_resumed`
   - `agent.phase_changed`, `agent.checkpoint_persisted`
   - `agent.approval_requested`, `agent.approval_resolved`
   - `agent.swarm_child_started`, `agent.swarm_child_completed`, `agent.swarm_aggregated`
   - `agent.notification_sent`
   - `agent.permission_violation`
   - `agent.cost_recorded`
   - `agent.stale_state_detected`, `agent.idempotency_dedup`, `agent.compensation_failed`
   - `agent.schedule_triggered`, `agent.schedule_skipped`, `agent.schedule_paused`
   - `agent.interrupt_requested`
6. Add CI invariants in `chatV9FeatureFlags.test.ts`:
   - every `R-AGENT-*` → flag in registry
   - every `agent.*` event → section in telemetry contract
   - every `MessageTypeV1` value (`read_preview`, `execution_proposal`, `scheduled_proposal`, `swarm_proposal`) is exhaustively handled in router code
   - every `SeverityV1` value (`S0_READ_ONLY`, `S1_PERSONAL_WRITE`, `S2_REVERSIBLE_WRITE`, `S3_IRREVERSIBLE_WRITE_OR_MULTI_USER`, `S4_IRREVERSIBLE_FINANCIAL_OR_LEGAL`) matches the documented ladder
   - every `ApprovalModeV1` value (`auto`, `one_click`, `explicit`, `dual_control`, `org_admin_only`) matches the taxonomy
   - every run state (`queued`, `running`, `waiting_on_external`, `blocked_for_approval`, `retry_scheduled`, `paused`, `cancelling`, `cancelled`, `failed`, `compensated`, `completed`) is exhaustively handled in state-machine code
   - every interrupt verb (9 total) is callable through one API route
   - every error code (7 total) is defined as a typed constant and used nowhere as a free string
   - mutating ops without `DiffPreviewV1` fail schema validation (enforced at runtime + type-check)
   - every schedule has `overlapPolicy` + `budgetPolicy` explicitly set (no defaults in the registry)

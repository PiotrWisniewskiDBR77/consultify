# Case Workspace — Domain Runtime and State Machines

> Status: `FROZEN TARGET CONTRACT`
> Date: 2026-08-09
> Owner: Product + Engineering
> Runtime parent: `docs/product/AGENT_EXECUTION_V8_SSOT.md`
> Business lifecycle parent: `docs/product/AGENT_TRANSFORMATION_LIFECYCLE_CANON_V1.md`

## 1. Authority and product decisions

This document owns the target Case, plan and runtime semantics. Module SSOTs and
owning services remain authoritative for module artifacts and legal mutations.

Frozen owner decisions:

1. Informational Teresa answers do not create a Case.
2. Direct module work is first-class and does not require a Case.
3. Every durable work commission accepted by Teresa creates exactly one Case.
4. Teresa may prepare an ephemeral work-order proposal, but creates the
   canonical Case only after the user explicitly confirms the exact summary by
   button or unambiguous language. Silence and continued conversation are not
   confirmation.
5. `Case` is the domain term and `Zlecenie` is the Polish product category.
   The goal may be the visible instance title, but `Praca` is not an alternate
   object category and no copy variant creates a second lightweight entity.
6. Approval and execution are policy-separated: low-risk internal work may
   execute on approval, while material, external or destructive work retains a
   separate execute step.
7. My Work is the canonical operational surface. Chat is intake, explanation
   and decision surface, not a competing runtime.

Durable work includes any request that creates or changes a canonical object,
continues after the current response, needs a plan, approval, retry, resume,
monitoring, owner, deadline, budget, deliverable or My Work visibility.

## 2. Authoritative owner boundaries

| Concern | Authoritative owner | Must not own |
| --- | --- | --- |
| Conversation and turn history | Chat | Case state, execution truth |
| Goal, scope, plan lineage, outcomes | Case service | Module object internals |
| Reusable process definition | Process Definition service | Run state |
| Execution and recovery | V8 Run orchestrator | Module validation rules |
| Proposal and approval | Proposal/Decision service | Artifact mutation |
| Interview, Finance, KPI, Initiative, Documents, etc. | Owning module service | Cross-module orchestration |
| Human work presentation | My Work projection | Authoritative NodeRun state |
| Teresa | Intent, planning and orchestration | Direct table writes or business approval |

Human UI, Teresa and automation must invoke the same application commands.
Actor type affects policy and audit, not the domain object produced.

## 3. Aggregate model

### 3.1 Case

```text
Case {
  caseId, organizationId, projectId?,
  profile: LIGHT | STANDARD | TRANSFORMATION | MONITORING,
  governanceTier: LIGHTWEIGHT | STANDARD | CONTROLLED,
  title, goal, scope,
  status, ownerUserId, sponsorUserId?,
  contractedClosureType, acceptanceCriteriaRef,
  governanceTierHistory[],
  createdByActor, autonomyPolicyRef, budgetPolicyRef?,
  currentPlanVersionId?, version,
  createdAt, updatedAt, completedAt?
}
```

One Case may contain many Runs. One Run belongs to exactly one Case. A Case
stores typed references to module artifacts, never copied module truth.

### 3.2 ProcessDefinition and ProcessVersion

`ProcessDefinition` is the reusable Play identity. `ProcessVersion` is an
immutable published graph/configuration. Publication records author, reviewer,
semantic graph digest, capability versions, policy and required bindings.

Publishing policy:

- every authorized user may create and test a private reusable Play draft;
- a Case-specific draft plan is available independently of Play publication;
- project, team or organization publication requires an authorized process
  owner, administrator or reviewer.

### 3.3 CasePlanVersion

```text
CasePlanVersion {
  casePlanVersionId, caseId, sourceProcessVersionId?,
  version, semanticGraph, graphDigest,
  status: DRAFT | PROPOSED | PUBLISHED | SUPERSEDED,
  changeReason?, createdBy, createdAt
}
```

Starting a Run freezes the exact `CasePlanVersion`. Replanning creates a new
version with an explicit diff and reason; it never mutates a running version.

### 3.4 Run and NodeRun

```text
Run {
  runId, organizationId, projectId?, caseId,
  casePlanVersionId, graphDigest,
  status, initiatedBy, correlationId,
  version, createdAt, startedAt?, completedAt?
}

NodeRun {
  nodeRunId, runId, nodeId, nodeVersionRef,
  status, attempt,
  inputSnapshotRef, outputSnapshotRef?,
  waitId?, proposalId?,
  idempotencyKey,
  leaseOwner?, leaseExpiresAt?, heartbeatAt?,
  startedAt?, completedAt?, errorCode?, errorDetailRef?
}
```

Definition nodes never carry mutable execution state. A retry creates an
auditable attempt. Idempotency identity is stable for the intended business
effect, not generated afresh on transport retry.

### 3.5 WaitSubscription

```text
WaitSubscription {
  waitId, organizationId, projectId?, caseId, runId, nodeRunId,
  waitType: HUMAN | TIMER | DOMAIN_EVENT | EXTERNAL_CALLBACK,
  status: ACTIVE | SATISFIED | EXPIRED | CANCELLED,
  correlationKey, expectedEventType?, predicateRef?,
  dueAt?, timeoutAt?, resumeTokenHash?,
  createdAt, satisfiedAt?, satisfiedByEventId?
}
```

Timer waits use indexed columns, leases and atomic claiming. They do not reuse
approval state and do not write `approved_by=system:scheduler`. External waits
register before dispatch so an early callback cannot be lost. Provider events
are deduplicated before satisfying a wait.

### 3.6 ActionProposal and ApprovalDecision

```text
ActionProposal {
  proposalId, organizationId, projectId?, caseId, runId, nodeRunId,
  proposalVersion, payloadDigest, targetExpectedVersion?,
  policySnapshotRef, effectClass, previewRef,
  status, expiresAt?, createdAt
}

ApprovalDecision {
  decisionId, proposalId, proposalVersion, payloadDigest,
  decision: APPROVE | REJECT | REQUEST_CHANGES | DEFER,
  decidedBy, decidedAt,
  source: BUTTON | CONVERSATIONAL | POLICY,
  authenticationAssurance, approvalChannelPolicy,
  conversationId?, sourceMessageId?, sourceMessageDigest?,
  policyVersion, membershipSnapshotRef?, reason?
}
```

Changing payload, target version or plan version invalidates approval.
Conversational confirmation is permitted only for exact Chat-to-Case
confirmation and A0/A1 work. A2 execution requires an explicit control or an
already published plan policy. A3/A4,
formal Decision, Initiative, budget, shared publication, external action and
closure require an explicit approval control plus step-up or dual control where
policy requires it. Ambiguity always produces clarification.

### 3.7 Artifacts, evidence and deliverables

```text
CaseArtifactLink {
  linkId, caseId, artifactType, artifactId, artifactRevision?,
  relation: INPUT | OUTPUT | EVIDENCE | DECISION_BASIS |
            DELIVERABLE | OUTCOME_MEASUREMENT,
  linkedBy, linkedAt
}

EvidenceRecord {
  evidenceId, caseId, sourceType, sourceId, sourceRevision,
  contentDigest, relation, provenanceStatus, rightsStatus,
  classification, capturedAt, capturedBy
}
```

Late binding creates a link, not a copy or ownership transfer. Unlinking never
deletes the artifact. Historical decisions retain an immutable revision/digest.
`UNKNOWN` rights or provenance stays unknown and blocks promotion where policy
requires proof.

## 4. State machines

### 4.1 Case

```text
DRAFT -> ACTIVE <-> BLOCKED
DRAFT | ACTIVE | BLOCKED -> CLOSED | FAILED | CANCELLED
```

`CLOSED` records one immutable `CaseClosureRecord` with the contracted closure
type: `DELIVERY_COMPLETED | DECISION_COMPLETED | IMPLEMENTATION_COMPLETED |
OUTCOME_VALIDATED | COMPLETED_PARTIAL`. A closed Case is not rewritten or
reopened; continued work creates a new Run under an explicit successor phase,
a successor Case or a linked Monitoring Case while preserving the original
closure record. Run completion alone does not close a Case.

### 4.2 ProcessVersion

```text
DRAFT -> IN_REVIEW -> PUBLISHED -> DEPRECATED -> ARCHIVED
IN_REVIEW -> DRAFT
```

Published content is immutable. Deprecation prevents new Runs unless an explicit
policy exception exists and never deletes historical evidence.

### 4.3 CasePlanVersion

```text
DRAFT -> IN_REVIEW -> PUBLISHED -> SUPERSEDED | WITHDRAWN
IN_REVIEW -> DRAFT       [changes requested]
```

UX mapping is `Szkic | Do przeglądu | Opublikowany | Wycofany`. Rejection is a
review decision and returns the version to Draft or withdraws it; it is not a
competing lifecycle state.

### 4.4 Run

```text
CREATED -> VALIDATING -> QUEUED -> RUNNING
RUNNING <-> PAUSED
RUNNING -> WAITING | BLOCKED | RETRY_SCHEDULED -> RUNNING
RUNNING -> COMPLETED | COMPLETED_WITH_WARNINGS | FAILED | CANCELLED
RUNNING | CANCELLED -> COMPENSATING -> COMPENSATED | FAILED
```

Technical completion is separate from `outcomeStatus`:
`PENDING_REVIEW | ACCEPTED | REJECTED | PARTIALLY_ACCEPTED | NOT_APPLICABLE`.

### 4.5 NodeRun

```text
PENDING -> READY -> CLAIMED -> RUNNING -> SUCCEEDED
PENDING | READY -> SKIPPED
RUNNING -> WAITING_HUMAN | WAITING_TIMER | WAITING_EVENT -> READY
RUNNING -> FAILED_RETRYABLE -> RETRY_SCHEDULED -> READY
RUNNING -> FAILED_TERMINAL
PENDING | READY | WAITING_* | FAILED_RETRYABLE -> CANCELLED
```

Independent branches may continue only when graph policy says so. Global
continue-on-error is not the default. A cancelled Run stops new claims but does
not pretend that committed external effects were rolled back.

Every completed or skipped node also has a result acceptance projection:
`ACCEPTED | PARTIAL | REJECTED | NOT_APPLICABLE`. `SKIPPED` maps to
`NOT_APPLICABLE` only when the published graph condition authorizes it. UI
`Częściowo zakończone` derives from explicit `PARTIAL`, never from warnings
or node counts.

Normative runtime-to-UI mapping:

| Runtime truth | User-facing projection |
| --- | --- |
| `RUNNING`, active NodeRun | `W toku` |
| `WAITING_HUMAN` assigned to viewer | `Czeka na Ciebie` |
| `WAITING_HUMAN` assigned elsewhere | `Czeka na zespół` |
| `WAITING_TIMER` or `WAITING_EVENT` within plan | `Czeka na system` |
| local blocker with remaining useful work | `Wymaga uwagi` |
| critical-path blocker | `Zablokowane` |
| terminal result acceptance `PARTIAL` | `Częściowo zakończone` |
| Case closure record accepted | `Zakończone` |
| `CANCELLED` | `Anulowane` |

`COMPLETED_WITH_WARNINGS` remains a technical Run state and never implies
partial business acceptance by itself.

### 4.6 Proposal

```text
DRAFT -> PENDING_REVIEW -> APPROVED -> EXECUTING -> EXECUTED -> AUDITED
PENDING_REVIEW -> REJECTED | REQUESTED_CHANGES
PENDING_REVIEW -> PENDING_REVIEW [approvalState=EXPIRED; new decision required]
APPROVED -> REVOKED              [before execution where policy permits]
EXECUTING -> FAILED -> APPROVED  [controlled idempotent retry]
```

Approved is never silently equivalent to executed. Policy may chain the two
commands only for an allowed low-risk class and still records both transitions.

## 5. Durable command set

- Case: `CreateCase`, `ClarifyCaseGoal`, `ChangeCaseScope`, `AssignCaseOwner`,
  `RaiseGovernanceTier`, `CompleteCase`, `CancelCase`, `CreateSuccessorCase`.
- Plan: `CreateCasePlanDraft`, `ApplyGraphPatch`, `ProposeCasePlan`,
  `PublishCasePlanVersion`, `RequestReplan`.
- Run: `CreateRun`, `StartRun`, `PauseRun`, `ResumeRun`, `CancelRun`,
  `RetryNode`, `CompensateAction`.
- Wait: `RegisterWait`, `ProvideHumanInput`, `SatisfyWait`, `ExpireWait`.
- Proposal: `CreateActionProposal`, `RecordApprovalDecision`,
  `ExecuteApprovedProposal`.
- Evidence: `LinkArtifactToCase`, `PinArtifactRevisionAsEvidence`,
  `UnlinkArtifactFromCase`, `RegisterDeliverable`, `AcceptDeliverable`.

Every command carries actor, tenant, correlation/causation, idempotency key and
expected aggregate version where mutation races are possible.

## 6. Runtime invariants

1. No durable Teresa command executes without a Case.
2. A direct module command may omit Case and later be linked.
3. One execution has one authoritative V8 Run.
4. A Run always points to one immutable plan version and graph digest.
5. Workers act through capability adapters and owning module commands.
6. A lease never grants permission; authorization is revalidated at execution.
7. Retry does not create a second business effect.
8. Waits survive browser, process and worker restart.
9. Approval binds exact version, digest and authorized human.
10. Artifact links do not change module ownership.

## 7. Acceptance evidence

The contract is accepted only with evidence from one exact candidate SHA:

- informational Teresa question creates zero Cases/Runs;
- direct Finance or Assessment work creates its canonical object and zero Case;
- durable Teresa request creates exactly one Case and one canonical Run under
  request replay;
- restart between NodeRuns resumes from persisted state;
- duplicate dispatch/callback/approval produces one business effect;
- stale plan/proposal/target version returns `409` and causes no mutation;
- timer and human waits survive a simulated multi-day interval;
- late binding shows one module object and one Case link, never a copy;
- UI, API and real database readback expose the same state and identifiers;
- cross-tenant and revoked-membership tests fail closed;
- audit reconstructs conversation -> Case -> plan -> Run -> NodeRun -> command
  -> proposal/decision -> artifact -> deliverable.

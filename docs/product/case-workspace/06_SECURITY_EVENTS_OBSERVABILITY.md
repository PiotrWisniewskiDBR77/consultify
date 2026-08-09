# Case Workspace — Security, Events and Observability

> Status: `FROZEN TARGET CONTRACT`
> Date: 2026-08-09
> Owner: Product + Engineering + Security
> Depends on: `04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md`,
> `05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md`

## 1. Security posture

AI operates within governance, never above it. Effective permission is the
intersection of:

`tenant + current user + delegated authority + project membership + object ACL
+ capability policy + connection scope + data policy + approval mandate`.

No graph, Case membership, chat context, approval or service identity may expand
the human's legal authority.

## 2. Authorization order

Every command and resumed NodeRun revalidates:

1. authentication and active identity;
2. organization/tenant isolation;
3. project membership;
4. object ACL and current target version;
5. agent delegation and execute-as identity;
6. capability allowlist and version;
7. data classification, privacy and residency;
8. effect/risk class;
9. budget, rate, time and volume limits;
10. approval and current approver mandate;
11. owning module domain validation.

Authorization is checked again after long waits. An approval records the policy
and membership snapshot used for audit, but execution still checks current
authority. Revocation after approval blocks execution.

## 3. Tenancy and data boundaries

- Every aggregate, outbox/inbox event, wait, artifact link and projection row
  carries `organizationId`; project-scoped rows also carry `projectId`.
- Queries use tenant filters in the authoritative service, not only in routes.
- User-supplied IDs are never sufficient authorization.
- Case linking validates ACL on both Case and artifact.
- Cross-tenant/project artifact, subflow, source, connection and callback
  references fail closed without disclosing existence.
- A Case holds references, not copied confidential content.
- Private/restricted Chat and memory modes propagate into context snapshots and
  retention policy.

## 4. Identity, delegation and connections

`ActorContext` distinguishes HUMAN, AGENT and SYSTEM and records the human on
whose behalf Teresa acts. Delegation defines allowed capability versions, scope,
autonomy level, budget, duration and approvers.

`executeAs` is explicit per binding:

- initiating user;
- governed agent service identity;
- named organization/project connection.

Definitions store credential references only. Workers receive short-lived,
minimal-scope handles. Connection bindings record granted scopes, owner,
environment, account/tenant label, health and reauthorization state.

Remote MCP is an external provider: allowlisted tools, trust profile, schema
validation, egress policy, timeout, rate limit, audit and kill switch are
mandatory.

## 5. Approval security

Material, external, destructive, governance-changing, restricted-data and
low-confidence actions require an authorized human unless an explicit bounded
pre-approval policy permits the exact safe class.

Approval is bound to:

- Case, Run, NodeRun and proposal;
- proposal version and payload digest;
- target expected version;
- destination/recipients and permission impact;
- policy version and effect class;
- approver identity, role and decision time;
- expiry and any delegation.

Conversational confirmation is an input only for exact Chat-to-Case
confirmation and A0/A1. A2 execution requires an explicit control or an already
published plan policy. The resolver must find one
visible current proposal and validate its digest. A3/A4 and formal/material
actions require an explicit control and the configured authentication
assurance; a chat message alone is never material approval truth.

## 6. Event architecture

Domain changes and outbox records commit atomically. Consumers build projections
idempotently. External callbacks enter a durable inbox, are authenticated,
deduplicated and tenant/correlation validated before affecting waits.

```text
DomainEvent {
  eventId, eventType, schemaVersion,
  organizationId, projectId?,
  aggregateType, aggregateId, aggregateVersion,
  caseId?, runId?, nodeRunId?, attemptId?,
  actor, correlationId, causationId,
  occurredAt, redactedSummary, payloadRef?
}
```

Events carry facts, not commands. Full documents, prompts, credentials and
sensitive payloads are referenced rather than copied to the bus.

## 7. Canonical event families

### Case and plan

- `case.created|activated|blocked|closed|failed|cancelled|successor_created`;
- `case.goal_changed|scope_changed`;
- `case.plan.proposed|published|superseded`;
- `process.definition.created|submitted|published|deprecated`.

### Runtime

- `run.created|validating|queued|started|paused|resumed`;
- `run.replanned|completed|failed|cancelled`;
- `node.ready|claimed|started|completed|failed|retry_scheduled|skipped`;
- `wait.registered|satisfied|expired|cancelled`.

### Governance

- `proposal.created|review_requested|approved|rejected|expired|executed`;
- `approval.requested|approved|rejected|changes_requested|delegated|expired`;
- `policy.denied|budget_warning|budget_exhausted`.

### Artifacts and outcomes

- `artifact.created|revision_created|linked_to_case|unlinked_from_case`;
- `evidence.pinned|provenance_changed`;
- `deliverable.generated|validated|submitted|accepted|rejected`;
- `outcome.measurement_recorded|accepted|sustainability_verified`.

Module owners publish their own canonical facts. The orchestrator listens; it
does not infer completion from local UI state.

## 8. Delivery, ordering and recovery

- Event consumers deduplicate by `eventId`.
- Aggregate events carry a monotonic aggregate version or sequence.
- Projection lag is visible; stale projections never become write authority.
- Failed outbox/inbox delivery has retry, dead-letter and reconciliation.
- Wait satisfaction is atomic and unique; duplicate or late events are audited
  but do not reactivate completed/cancelled Runs.
- Worker claims use leases/heartbeats. Expired leases are reclaimed only after
  idempotency or reconciliation checks.
- External effects without provider idempotency require readback reconciliation
  before retry.

## 9. Evidence, provenance and retention

Evidence distinguishes fact, user assertion, assumption, inference and human
decision. Each accepted business claim references an exact source revision or
digest. Unknown provenance/rights remains unknown.

Retention is policy-driven by organization, project and sensitivity:

- published definitions and audit survive ordinary definition deletion;
- run payloads may expire earlier than audit metadata;
- legal hold blocks purge;
- purge is dependency-aware and auditable;
- telemetry is aggregated/redacted and never becomes cross-client training data
  without an explicit separate policy.

## 10. Observability model

Correlation chain:

```text
conversationTurnId -> caseId -> casePlanVersionId -> runId -> nodeRunId
-> attemptId -> commandId -> proposalId/decisionId -> artifactId -> eventId
-> deliverableId
```

Technical metrics:

- queue and outbox/inbox lag;
- worker utilization, leases and stuck nodes;
- node duration, error class, retry and timeout;
- wait age and scheduler drift;
- connector/MCP latency, errors, reauth and rate limits;
- model latency, tokens and cost;
- projection lag and stream disconnects;
- artifact storage and validation failures.

Product metrics:

- informational vs durable intent routing;
- Case creation and false-promotion/cancel rate;
- clarification-to-Case and Case-to-first-Run time;
- plan review and publish conversion;
- approval wait and human interventions;
- Run completion, rerun and corrected output rate;
- deliverable validation and acceptance.

Business metrics:

- accepted Decision/Initiative/Task handoffs;
- execution progress and blocked duration;
- KPI/Finance expected-versus-actual;
- benefit and sustainability acceptance.

## 11. Operator trace and run report

For each Run the operator can resolve:

- deployed SHA and environment;
- plan version and graph digest;
- capability, adapter, model and policy versions;
- sanitized input/output references and checksums;
- worker lease and attempt history;
- command idempotency result;
- proposal/approval payload digest;
- actor, permission and delegation decisions;
- emitted/consumed event sequence;
- canonical artifact readbacks;
- cost, timing, errors and recovery actions.

The user-facing final report contains intended outcome, source manifest,
completed/skipped/failed/compensated paths, approvals, outputs, downstream
readbacks, unresolved assumptions, time/cost/human effort and outcome acceptance.

## 12. Required negative and resilience tests

- substitute organization/project/resource ID in every mutation family;
- remove project membership while waiting for approval;
- approve one payload and attempt to execute a changed payload;
- replay verbal/button approval and external webhook;
- run two workers/schedulers against one ready item;
- kill worker during capability execution and after domain commit before outbox
  publication;
- send malicious source content requesting tool escalation or exfiltration;
- route restricted output to lower sensitivity;
- use expired webhook signature, revoked connection or deprecated capability;
- cancel during an external action and deliver a late callback;
- retry a provider without native idempotency;
- attempt cross-tenant subflow, knowledge or artifact link.

## 13. Acceptance evidence

Security/events/observability pass only when one exact candidate SHA provides:

- automated cross-tenant/project and revoked-membership negative suites;
- realDB rows proving organization/project filters and one idempotent effect;
- signed callback verification and replay rejection;
- concurrent worker/scheduler test with one NodeRun claim;
- restart tests covering active Run, approval, timer and external wait;
- outbox failure injection followed by automatic projection reconciliation;
- stale approval/target version `409` and zero side effects;
- redaction inspection proving no secrets/full restricted payloads in logs/events;
- operator trace reconstructing the complete correlation chain;
- metrics/alerts for queue, waits, stuck leases, failures, cost and projection lag;
- artifact/evidence manifest with checksums, revisions, provenance and rights state;
- explicit `PASS`, `PARTIAL`, `BLOCKED`, `FAILED`, `EVIDENCE_MISSING` or `N/A_WITH_CODEX_APPROVAL` per gate. The N/A state is valid only for literal canon out-of-scope or an immutable exact Codex approval reference.

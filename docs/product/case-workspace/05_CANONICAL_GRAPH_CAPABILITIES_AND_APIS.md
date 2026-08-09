# Case Workspace — Canonical Graph, Capabilities and APIs

> Status: `FROZEN TARGET CONTRACT`
> Date: 2026-08-09
> Owner: Product + Engineering
> Depends on: `04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md`

## 1. Canonical graph doctrine

There is one semantic graph and three first-class projections. Simple, Expert
and List never persist competing process models.

- Simple View is the guided vertical workflow evolved from `AgentPlanCanvas`.
- Expert View is a React Flow graph evolved from My Work Process Flow primitives.
- List View is the mobile, keyboard and accessibility-equivalent semantic editor.
- View layout, viewport and collapsed state are presentation data.
- Semantic node, edge, binding or policy changes create a graph version change.
- A graph construct that Simple View cannot edit is preserved and shown as an
  advanced segment with a deep link to Expert View; it is never flattened.

## 2. Graph schema

```text
CanonicalGraph {
  schemaVersion,
  graphId,
  entryNodeIds[], terminalNodeIds[],
  nodes: GraphNode[], edges: GraphEdge[],
  variables[], inputSchemaRef?, outputSchemaRef?,
  limits, metadata
}

GraphNode {
  nodeId, stableKey, type, title, description?, phaseId?,
  capabilityBinding?, inputBindings[], outputBindings[],
  executionPolicy, approvalPolicy?, retryPolicy?, timeoutPolicy?,
  waitPolicy?, artifactBindings[], tags[], metadata
}

GraphEdge {
  edgeId, sourceNodeId, targetNodeId,
  type: SEQUENCE | CONDITIONAL | ERROR | TIMEOUT | COMPENSATION,
  conditionExpression?, conditionSchemaVersion?, priority?, label?
}
```

Supported node types:

- `START`, `END`;
- `CAPABILITY`;
- `HUMAN_TASK`, `APPROVAL`;
- `TIMER_WAIT`, `EVENT_WAIT`;
- `DECISION_GATEWAY`, `PARALLEL_SPLIT`, `PARALLEL_JOIN`;
- `SUBFLOW`, `ANNOTATION`.

MCP, HTTP API, connector and internal service are provider bindings, not separate
workflow semantics.

## 3. Typed data bindings

```text
InputBinding {
  targetPath,
  sourceType: CASE_FIELD | NODE_OUTPUT | ARTIFACT_REF |
              CONSTANT | SECRET_REF,
  sourceNodeId?, sourcePath?, value?, transformationRef?, required
}
```

Publish validation verifies upstream reachability, schema compatibility,
required inputs, transformations, ACL scope and secret references. Large or
sensitive values are stored as encrypted references with classification,
checksum and redacted preview. Secrets never enter graph JSON, prompts, events
or ordinary logs.

## 4. Capability Registry

```text
CapabilityDefinition {
  capabilityId, version, ownerModule,
  providerType: INTERNAL | MCP | HTTP_API | CONNECTOR | AGENT,
  operation,
  inputSchemaRef, outputSchemaRef,
  operationClass: READ | COMPUTE | PROPOSE | MUTATE | PUBLISH | NOTIFY,
  effectClass: SAFE_ADDITIVE | SAFE_UPDATE | SENSITIVE_UPDATE |
               DESTRUCTIVE | GOVERNANCE_TRANSITION,
  requiredRoles[], dataClassification, residency?,
  idempotencyStrategy, reversibility,
  approvalRecommendation,
  eventsEmitted[], rateLimit?, costPolicy?, timeoutDefaults,
  health, lifecycle: ACTIVE | DEPRECATED | UNAVAILABLE,
  testFixtureRef, createdAt
}
```

Palette content is generated from this registry. A capability is active only
when its version, adapter, schema, policy and health are present. `UNAVAILABLE`
may be shown as roadmap content but cannot be inserted into a publishable graph.

Provider-neutral graph bindings resolve to a concrete connection at publish or
Run validation. The resolved snapshot includes connection ID, account/tenant
label, scopes, environment, execute-as identity and policy version.

## 5. Adapter and module ownership contract

Adapters:

- `InternalCommandAdapter`;
- `McpCapabilityAdapter`;
- `HttpApiCapabilityAdapter`;
- `ConnectorCapabilityAdapter`;
- `AgentCapabilityAdapter`;
- transitional `LegacyToolAdapter`.

All adapters accept the same execution envelope, validate typed input, enforce
idempotency and return a normalized result with canonical artifact references.
They do not write another module's tables or drive its UI.

Every module capability defines:

- domain owner and owning command/query;
- required role and effective scope;
- expected target version;
- side effects and reversibility;
- readback query;
- emitted events;
- error taxonomy;
- test fixture and health check.

## 6. Command envelope

```text
CommandEnvelope<T> {
  commandId, commandType, schemaVersion,
  organizationId, projectId?,
  actor: {
    type: HUMAN | AGENT | SYSTEM,
    actorId, onBehalfOfUserId?, delegationRef?
  },
  caseId?, runId?, nodeRunId?, proposalId?,
  idempotencyKey, expectedVersion?,
  correlationId, causationId,
  payload: T
}
```

Direct UI and Teresa use the same application command. Absence of `caseId` is
legal for direct module work, but durable Teresa commands fail validation until
`CreateDurableWorkFromConversation` has created or reused a Case.

## 7. API boundaries

### 7.1 Case

- `POST /api/cases`
- `GET /api/cases/:caseId`
- `PATCH /api/cases/:caseId`
- `POST /api/cases/:caseId/governance-tier`
- `POST /api/cases/:caseId/cancel`
- `POST /api/cases/:caseId/successors`

### 7.2 Plan and graph

- `POST /api/cases/:caseId/plans`
- `GET /api/cases/:caseId/plans/:planVersionId`
- `PATCH /api/cases/:caseId/plans/:planVersionId`
- `POST /api/cases/:caseId/plans/:planVersionId/validate`
- `POST /api/cases/:caseId/plans/:planVersionId/propose`
- `POST /api/cases/:caseId/plans/:planVersionId/publish`
- `GET /api/cases/:caseId/plans/:planVersionId/graph`
- `GET /api/cases/:caseId/plans/:planVersionId/diff?against=...`
- `GET|PUT /api/plan-versions/:planVersionId/view-state?view=simple|expert|list`

Draft mutations require `expectedVersion`. Published versions reject mutation.
Layout-only changes use a separate view-state endpoint and do not alter the
semantic graph digest.

### 7.3 Runtime

- `POST /api/cases/:caseId/runs`
- `GET /api/runs/:runId`
- `GET /api/runs/:runId/node-runs`
- `POST /api/runs/:runId/pause`
- `POST /api/runs/:runId/resume`
- `POST /api/runs/:runId/cancel`
- `POST /api/runs/:runId/replan`
- `POST /api/node-runs/:nodeRunId/retry`
- `POST /api/node-runs/:nodeRunId/input`
- `GET /api/runs/:runId/events?after=:cursor`
- `GET /api/runs/:runId/waits`
- `GET /api/runs/:runId/proposals`

### 7.4 Proposals and approvals

- `GET /api/work/proposals/:proposalId`
- `POST /api/work/proposals/:proposalId/decisions`
- `POST /api/work/proposals/:proposalId/execute`
- `GET /api/my-work/approvals`

Decision requests carry `proposalVersion`, `payloadDigest` and idempotency key.
The server returns authoritative readback and correlation ID. A stale decision
returns `409 STALE_PROPOSAL` with no side effect.

### 7.5 Capability Registry and Plays

- `GET /api/capabilities?availability=&ownerModule=&cursor=`
- `GET /api/capabilities/:capabilityId/versions/:version`
- `GET /api/capabilities/:capabilityId/health`
- `POST /api/process-definitions`
- `GET /api/process-definitions?scope=private|team|organization&cursor=`
- `POST /api/process-definitions/:definitionId/versions`
- `POST /api/process-definitions/:definitionId/versions/:versionId/review`
- `POST /api/process-definitions/:definitionId/versions/:versionId/publish`

All list endpoints are tenant-scoped, paginated and return authoritative
availability or lifecycle state. Shared publish requires the reviewed role.

### 7.6 My Work projections

- `GET /api/my-work/cases`
- `GET /api/my-work/items`
- `GET /api/my-work/runs/:runId/timeline`
- `GET /api/my-work/runs/:runId/history`

These are projections. Mutations are commands to the owning Case, Run, proposal
or module service.

### 7.7 Artifacts and evidence

- `POST /api/cases/:caseId/artifacts`
- `DELETE /api/cases/:caseId/artifacts/:linkId`
- `POST /api/cases/:caseId/evidence/pin`
- `GET /api/cases/:caseId/artifacts`
- `POST /api/cases/:caseId/deliverables`
- `POST /api/cases/:caseId/deliverables/:id/accept`

### 7.8 Chat promotion

```text
POST /api/chat/durable-work
{
  conversationId, sourceMessageId, goal, projectId?,
  contextSnapshotRef, workOrderVersion, workOrderDigest,
  confirmationDecisionId?, confirmedByMessageId?, idempotencyKey
}
```

Classification prepares a versioned proposal only. This atomic application
operation verifies the exact digest, actor, current work-order version and a
durable confirmation receipt before it creates or reuses a Case. It then
creates the initial plan/Run as allowed and returns deep links. Chat must not
orchestrate several low-level writes client-side.

## 8. Graph validation and execution rules

Publish blocks on:

- unreachable nodes, absent terminal path or uncontrolled cycle;
- incompatible edge/data schemas;
- missing or unhealthy capability/binding;
- missing error, timeout or approval coverage for material effects;
- unauthorized organization/project/resource scope;
- unresolved secret/connection;
- unsafe retry or absent idempotency/compensation policy;
- exceeded action, time, cost, loop or payload limits;
- deprecated block version without an explicit exception;
- missing output owner/readback contract.

Gateway semantics are deterministic. Parallel join explicitly states
`ALL | ANY | N_OF_M`. A condition is evaluated against a versioned expression
schema and cannot access data outside the effective ACL.

## 9. UI reuse map

| Existing asset | Target action |
| --- | --- |
| `AgentHubShell` | KEEP as process/Case hub shell |
| `AgentPlanCanvas` | ADAPT into Simple Graph View |
| `AgentWorkshopPalette` | KEEP UI, replace catalog with Capability Registry |
| My Work `IdeaProcessFlowTool` primitives | ADAPT into Expert Graph View |
| Process Flow validation/undo/layout | EXTEND for execution semantics |
| Timeline and Run History components | ADAPT to Run/NodeRun events |
| `ArtifactRightPanel` and PreviewPane | KEEP for palette/properties/artifacts |

Do not reuse Idea Workspace graph persistence as Case runtime truth. Extract UI
primitives and bind them to ProcessVersion APIs.

## 10. Acceptance evidence

- a legacy five-step AgentPlan round-trips to START + five nodes + END without
  loss of tool inputs or approval settings;
- Simple, Expert and List expose identical semantic node/edge IDs and graph digest;
- List supports the same semantic edits and validation without drag-and-drop;
- an Expert branch survives Simple View without flattening or data loss;
- a stale graph save returns `409`; a published graph cannot be modified;
- layout-only updates preserve semantic digest;
- every active palette entry resolves to an executable registry version;
- unknown/deprecated/unhealthy capabilities block publish with exact reason;
- human and Teresa calls reach the same module command and validation;
- direct and orchestrated operations create the same canonical artifact type;
- every mutation has successful canonical readback;
- MCP/API callback replay produces one NodeRun transition and one effect;
- artifact chips deep-link to the canonical owner object and exact revision;
- API contract, schema and negative authorization tests pass on one SHA.

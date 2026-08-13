# Case Workspace — Event Taxonomy (wiring input for the command→outbox phase)

> Status: `IMPLEMENTATION INPUT — exact, one row per command`
> Date: 2026-08-10
> Derives from: `06_SECURITY_EVENTS_OBSERVABILITY.md` §6 (DomainEvent
> envelope), §7 (canonical event families), §8 (delivery/ordering/recovery)
> Primitive: `server/src/services/caseWorkspace/eventOutboxService.ts`,
> `server/migrations/20260810_case_workspace_event_outbox.sql`

## 0. What this file is

The previous phase built the outbox primitive and wired it into **nothing**.
This table is the complete, unambiguous work list for the phase that adds
`publishEvent(client, …)` to the 57 mutating commands of the 11 caseWorkspace
services. One row = one command = one `event_type`. If a command is not in
this table, it emits nothing.

**Non-negotiable call shape.** Every mutating command already runs inside
`withPgTransaction()` / `withRawPgTransaction()`. The `publishEvent` call goes
**inside that same callback, on that same `client`**, after the aggregate
write and before the callback returns:

```ts
return withPgTransaction(async (client) => {
  const updated = await client.query(`UPDATE case_core SET … RETURNING *`, […]);
  await publishEvent(client, {
    eventType: 'case.activated',
    organizationId: updated.rows[0].organization_id,
    aggregateType: 'CASE',
    aggregateId: updated.rows[0].case_id,
    aggregateVersion: updated.rows[0].version,   // the POST-mutation version
    caseId: updated.rows[0].case_id,
    actorUserId: actor.actorUserId,
    redactedSummary: { from: previousStatus, to: 'ACTIVE' },
  });
  return mapRow(updated.rows[0]);
});
```

Opening a second connection for the event — or publishing after the
transaction returns — reintroduces exactly the dual-write hole the outbox
exists to close (§12 "kill worker … after domain commit before outbox
publication"). There is no fallback path and none may be added.

## 1. Envelope field sourcing (applies to every row below)

| Field | Where it comes from | Notes |
| --- | --- | --- |
| `eventId` | omit → `cwevt-<uuid>` minted | Pass a **deterministic** id derived from the command's idempotency key wherever the command is retryable — that is what makes the `ON CONFLICT DO NOTHING` dedup real rather than decorative. |
| `eventType` | this table, literal string | Never invent one at a call site. |
| `schemaVersion` | omit → `1` | Bump only when a `redactedSummary` shape changes incompatibly. |
| `organizationId` | the row the command just wrote / the `callerOrganizationId` argument | NOT NULL (§3). See §4 for the three org-less tables. |
| `projectId` | the aggregate's `project_id` when it has one | NULL for org-scoped facts. |
| `aggregateType` / `aggregateId` | this table | `aggregateId` is always the aggregate's own PK value. |
| `aggregateVersion` | the **post-mutation** `version` column | NULL where the table has no `version` column — see §3. Never a re-read; take it from the `RETURNING` row. |
| `caseId` / `runId` / `nodeRunId` / `attemptId` | denormalized from the written row where the column exists | §10 correlation chain. Fill every one you have. |
| `actorUserId` | the command's actor | `system:<worker>` for scheduler/worker emitters (e.g. `expireWait`). |
| `correlationId` | omit → `RequestStore.getCorrelationId()`, else minted | Pass explicitly only in workers that carry their own chain id. |
| `causationId` | the `eventId` of the event that caused this one | New concept — see §5. Fill it wherever one command emits several events, or one command is triggered by another's event. |
| `occurredAt` | omit → `now()` | Pass only for backfill/replay of true historical time. |
| `redactedSummary` | facts only, small | Auto-run through `PiiRedactor`; >8 KiB is rejected. Documents, prompts, model output, credentials → `payloadRef`. |
| `payloadRef` | pointer to the full payload | Artifact id / revision digest / blob key. |

## 2. The taxonomy

`Status` column: **AS SPECIFIED** = exactly the coordinator's mapping;
**CORRECTED** = deviation from the coordinator's mapping, justified in §5;
**NEW** = event the coordinator's list did not cover, added in §5.

### caseCoreService — aggregate `CASE` (`case_core`, PK `case_id`, has `version`)

| Function | event_type | aggregate_type | Status | Note |
| --- | --- | --- | --- | --- |
| `createCase` | `case.created` | `CASE` | AS SPECIFIED | `aggregateVersion` = 1. Summary: caseProfile, governanceTier, contractedClosureType. |
| `transitionStatus` | `case.activated` \| `case.blocked` \| `case.closed` \| `case.failed` \| `case.cancelled` | `CASE` | AS SPECIFIED (minus `successor_created`) | Chosen by the **target** status, one event per call. `ALLOWED_STATUS_TRANSITIONS` (caseCoreService.ts:167) can never target `DRAFT`, so there is no `case.drafted`. `case.successor_created` is unreachable here — see §5.1. Summary: `{from, to, reason}`. |
| `updateGovernanceTier` | `case.governance_tier_changed` | `CASE` | AS SPECIFIED | Summary: `{from, to, rationale}`. Do **not** copy `governance_tier_history`. |
| `updateAutonomyPolicy` | `case.autonomy_policy_changed` | `CASE` | AS SPECIFIED | Summary: from/to autonomy level + policy ref. |
| `updateClosureAxisStatus` | `case.closure_axis_updated` | `CASE` | AS SPECIFIED | Summary: `{axis, from, to}`. One event per call, even though four axes exist. |
| `recordClosure` | `case.closure_recorded` | `CASE` | **CORRECTED** (coordinator said `case.closed`) | §5.2 — this command records `closure_type`; it does **not** set `case_status='CLOSED'`. |
| `cancelCase` | *(no event of its own)* | — | **CORRECTED** (coordinator said `case.cancelled`) | §5.3 — it is a thin wrapper that calls `transitionStatus(…, 'CANCELLED')`, which already emits `case.cancelled`. Emitting here too would double-count every cancellation. |

### casePlanVersionService — aggregate `CASE_PLAN_VERSION` (`case_plan_versions`, PK `case_plan_version_id`, has `version`)

| Function | event_type | aggregate_type | Status | Note |
| --- | --- | --- | --- | --- |
| `createPlanDraft` | `case.plan.draft_created` | `CASE_PLAN_VERSION` | AS SPECIFIED | Set `caseId`. Summary: graph node/edge counts + `graph_digest`, never the graph. |
| `updatePlanDraft` | `case.plan.draft_updated` | `CASE_PLAN_VERSION` | AS SPECIFIED | Summary: new `graph_digest` + what changed; the graph itself goes in `payloadRef`. |
| `proposePlanVersion` | `case.plan.proposed` | `CASE_PLAN_VERSION` | AS SPECIFIED | §7 family `case.plan.proposed`. Summary: validation blocker count. |
| `requestChangesOnPlanVersion` | `case.plan.changes_requested` | `CASE_PLAN_VERSION` | AS SPECIFIED | Summary: reviewer + reason. |
| `publishPlanVersion` | `case.plan.published` | `CASE_PLAN_VERSION` | AS SPECIFIED | If publishing supersedes a previous version, emit `case.plan.superseded` (§7) for the superseded id in the **same** transaction with `causationId` = this event's id. |
| `withdrawPlanVersion` | `case.plan.withdrawn` | `CASE_PLAN_VERSION` | AS SPECIFIED | — |
| `putViewState` | `case.plan.view_state_updated` | `CASE_PLAN_VERSION` | AS SPECIFIED | Writes `case_plan_view_state` (PK `case_plan_version_id`+`view_type`); the aggregate is still the plan version. `aggregateVersion` = null (that table has no version column). Low-value/high-volume — see §5.8. |

### playService — aggregates `PROCESS_DEFINITION` / `PROCESS_VERSION`

`process_definitions` PK `process_definition_id`, has `organization_id` and `version`.
`process_versions` PK `process_version_id`, has `version` (lock counter) **and** `version_number` (semantic) — `aggregateVersion` takes `version`, `version_number` belongs in the summary.

| Function | event_type | aggregate_type | Status | Note |
| --- | --- | --- | --- | --- |
| `createProcessDefinition` | `process.definition.created` | `PROCESS_DEFINITION` | AS SPECIFIED | §7 family. |
| `shareProcessDefinition` | `process.definition.shared` | `PROCESS_DEFINITION` | AS SPECIFIED | Summary: scope of the share. Not in §7's literal list; consistent extension of the family. |
| `createProcessVersionDraft` | `process.version.draft_created` | `PROCESS_VERSION` | AS SPECIFIED | Set the parent `process_definition_id` in the summary. |
| `updateProcessVersionDraft` | `process.version.draft_updated` | `PROCESS_VERSION` | AS SPECIFIED | — |
| `proposeProcessVersion` | `process.definition.submitted` | `PROCESS_VERSION` | AS SPECIFIED, with a flag | §5.4 — the `event_type` says `definition` while the aggregate is a **version**. Kept because §7 lists `process.definition.…|submitted` verbatim; flagged for the owner. |
| `reviewProcessVersion` | `process.version.reviewed` | `PROCESS_VERSION` | AS SPECIFIED | Summary: decision + reviewer. |
| `publishProcessVersion` | `process.definition.published` | `PROCESS_VERSION` | AS SPECIFIED, with a flag | Same naming asymmetry as `proposeProcessVersion` (§5.4). |
| `deprecateProcessVersion` | `process.definition.deprecated` | `PROCESS_VERSION` | AS SPECIFIED, with a flag | Same asymmetry (§5.4). |
| `archiveProcessVersion` | `process.version.archived` | `PROCESS_VERSION` | AS SPECIFIED | — |
| `instantiateProcessVersion` | `process.version.instantiated` | `PROCESS_VERSION` | AS SPECIFIED | Set `caseId` of the instantiated Case. This is the play→Case join point; put the new `case_plan_version_id` in the summary. |

### proposalApprovalService — aggregate `ACTION_PROPOSAL` (`case_workspace_action_proposals`, PK `action_proposal_id`, has `organization_id`, `project_id`, `case_id`, `run_id`, `version`)

| Function | event_type | aggregate_type | Status | Note |
| --- | --- | --- | --- | --- |
| `createActionProposal` | `proposal.created` | `ACTION_PROPOSAL` | AS SPECIFIED | Summary: effect class, capability ref, **payload digest** — never the payload (§5 approval binding). |
| `submitActionProposalForReview` | `proposal.review_requested` | `ACTION_PROPOSAL` | AS SPECIFIED | Consider also `approval.requested` (§7) — see §5.7. |
| `recordApprovalDecision` | `approval.approved` \| `approval.rejected` \| `approval.changes_requested` \| `approval.deferred` | `ACTION_PROPOSAL` | **NEW value added** | Chosen by `ApprovalDecisionType` = `APPROVE`/`REJECT`/`REQUEST_CHANGES`/**`DEFER`**. The coordinator's list omitted `DEFER`, which is a real, reachable enum value (proposalApprovalService.ts:210) — §5.5. Summary: decision, `approvalChannelPolicy`, `authenticationAssurance`, payload digest, policy version. Aggregate stays the proposal (the decision row has its own `decision_id`; put it in the summary). |
| `transitionProposalToExecuting` | `proposal.executing` | `ACTION_PROPOSAL` | AS SPECIFIED | Set `runId`/`nodeRunId`/`attemptId` where known. |
| `transitionProposalToExecuted` | `proposal.executed` | `ACTION_PROPOSAL` | AS SPECIFIED | §7 family `proposal.…|executed`. |
| `transitionProposalToFailed` | `proposal.failed` | `ACTION_PROPOSAL` | AS SPECIFIED | Summary: error class only, never the provider response body. |
| `retryProposalFromFailed` | `proposal.retry_requested` | `ACTION_PROPOSAL` | AS SPECIFIED | `causationId` = the `proposal.failed` event being retried. |
| `markProposalAudited` | `proposal.audited` | `ACTION_PROPOSAL` | AS SPECIFIED | — |
| `revokeApprovedProposal` | `proposal.revoked` | `ACTION_PROPOSAL` | AS SPECIFIED | §5 "revocation after approval blocks execution" — consumers must treat this as a hard stop. |

### waitSubscriptionService — aggregate `WAIT` (`case_workspace_waits`, PK `wait_id`, has `organization_id`, `project_id`, `case_id`, `run_id`, `version`)

| Function | event_type | aggregate_type | Status | Note |
| --- | --- | --- | --- | --- |
| `createWait` | `wait.registered` | `WAIT` | AS SPECIFIED | §7 family. Summary: `wait_type` (HUMAN/TIMER/DOMAIN_EVENT/EXTERNAL_CALLBACK) + due time. |
| `claimTimerWait` | `wait.claimed` | `WAIT` | AS SPECIFIED | `actorUserId` is a `system:<worker>` token. High volume — see §5.8. |
| `renewTimerWaitClaimLease` | `wait.claim_lease_renewed` | `WAIT` | AS SPECIFIED | Heartbeat; highest-volume event in this table (§5.8). |
| `resolveWait` | `wait.satisfied` | `WAIT` | AS SPECIFIED | §8: "Wait satisfaction is atomic and unique" — the outbox row is what proves it, so this call must be inside the same transaction as the status flip. |
| `provideHumanInput` | `wait.human_input_provided` | `WAIT` | AS SPECIFIED | Summary must NOT contain the human's free text — `payloadRef` it. |
| `expireWait` | `wait.expired` | `WAIT` | AS SPECIFIED | Scheduler actor. |
| `cancelWait` | `wait.cancelled` | `WAIT` | AS SPECIFIED | — |

### artifactLinkService — aggregate `ARTIFACT_LINK` (`case_workspace_artifact_links`, PK `link_id`, has `organization_id`, `project_id`, `case_id`, `version`)

| Function | event_type | aggregate_type | Status | Note |
| --- | --- | --- | --- | --- |
| `linkArtifactToCase` | `artifact.linked_to_case` | `ARTIFACT_LINK` | AS SPECIFIED | §7 family. Summary: artifact id + revision, never artifact content. |
| `pinArtifactRevision` | `evidence.pinned` | `ARTIFACT_LINK` | AS SPECIFIED | §7 `evidence.pinned`. Summary: pinned revision + digest (§9 provenance). |
| `markLinkStale` | `artifact_link.marked_stale` | `ARTIFACT_LINK` | AS SPECIFIED | Not in §7's literal list; nearest canon concept is CW-01-026-INV9 "changed upstream evidence marks downstream work stale". |
| `markLinkArtifactUnavailable` | `artifact_link.marked_unavailable` | `ARTIFACT_LINK` | AS SPECIFIED | CW-03-017: unavailable ≠ removed from lineage. |
| `unlinkArtifactFromCase` | `artifact.unlinked_from_case` | `ARTIFACT_LINK` | AS SPECIFIED | §7 family. |

### executionGraphService — aggregate `NODE_RUN`

Both tables are keyed by `node_run_id` (PK) and carry `organization_id`, `project_id`, `case_id`, `run_id`; neither has a `version` column → `aggregateVersion` = null.

| Function | event_type | aggregate_type | Status | Note |
| --- | --- | --- | --- | --- |
| `recordGatewayEvaluation` | `node.gateway_evaluated` | `NODE_RUN` | AS SPECIFIED | Set `runId` + `nodeRunId`. Summary: branch taken + rule id, not the evaluated data. |
| `recordNodeResultAcceptance` | `node.result_accepted` | `NODE_RUN` | AS SPECIFIED | Summary: acceptance decision + validation outcome; the result itself is a `payloadRef`. |

### capabilityRegistryService — aggregate `CAPABILITY` (`case_workspace_capabilities`, PK `capability_registry_id`, has `version`)

**This registry is platform-global: it has NO `organization_id` column** (see the service header, open question #1). The outbox requires one (§3), so take it from the command's existing `callerOrganizationId` argument — `registerCapability(…, callerOrganizationId)` and `markCapabilityHealth(…, callerOrganizationId)` both already have it. Record in the summary that the aggregate itself is global.

| Function | event_type | aggregate_type | Status | Note |
| --- | --- | --- | --- | --- |
| `registerCapability` | `capability.registered` | `CAPABILITY` | AS SPECIFIED | `organizationId` = `callerOrganizationId` (see above). |
| `markCapabilityHealth` | `capability.health_changed` | `CAPABILITY` | AS SPECIFIED | Summary: `{from, to, detail}`. §10 connector health metric feeds off this. |
| `recordIdempotencyKeyCheck` | **NO EVENT** | — | AS SPECIFIED | **Explicit justification (do not silently skip):** this writes a `(capability_registry_id, idempotency_key)` bookkeeping row for a *different* command — the capability invocation, whose own proposal/execution events (`proposal.executing`/`proposal.executed`/`proposal.failed`) are the business facts. §6: "Events carry facts, not commands"; a duplicate-suppression check is neither a domain change nor a fact a projection can act on, and emitting it would make every retried command indistinguishable from a real second action. Its audit value is already covered: the row itself is durable, and §11's operator trace resolves "command idempotency result" by reading that table directly. **Revisit only if** a consumer needs "an external effect was suppressed as duplicate" as a first-class signal — then the correct event is on the *invocation* aggregate, not this one. |

### runBindingService — aggregate `RUN` (`case_workspace_run_bindings`, PK `run_id`, has `organization_id`, `case_id`; no `version`)

| Function | event_type | aggregate_type | Status | Note |
| --- | --- | --- | --- | --- |
| `bindRunToPlanVersion` | `run.bound_to_plan_version` | `RUN` | AS SPECIFIED | `aggregateId` = `run_id`, `aggregateVersion` = null. Summary: `case_plan_version_id` + `graph_digest` (CW-00-020-INV6: the Run is bound to an exact plan version and digest). |

### caseHistoryService — aggregates `CASE` / `VALUE_MEASUREMENT`

| Function | event_type | aggregate_type | Status | Note |
| --- | --- | --- | --- | --- |
| `appendCaseHistoryEvent` | **dynamic — the caller's `input.eventType`** | `CASE` | AS SPECIFIED, with a rule | The history log's `event_type` is an open TEXT column with its own catalog (`HISTORY_EVENT_TYPES`), which is **not** this taxonomy's namespace. Rule: emit the caller-supplied type **verbatim**, do not translate it, and put `{ historyEventId, sourceTable, sourceId }` in the summary. Beware double-emission — §5.6. |
| `recordValueMeasurement` | `outcome.measurement_recorded` | `VALUE_MEASUREMENT` | AS SPECIFIED | §7 family `outcome.measurement_recorded`. `aggregateId` = `measurement_id`, `caseId` set, `aggregateVersion` = null. This command already appends a history row in its own transaction — the event joins that same transaction, and (per §5.6) the history append inside it must **not** also emit. |

### migrationReadinessService — aggregates `FEATURE_FLAG_DEFINITION` / `FEATURE_FLAG` / `LEGACY_RECORD`

| Function | event_type | aggregate_type | Status | Note |
| --- | --- | --- | --- | --- |
| `registerFlagDefinition` | `flag.definition_registered` | `FEATURE_FLAG_DEFINITION` | AS SPECIFIED | `case_workspace_feature_flag_definitions` PK is `flag_key` and has **no** `organization_id` → `aggregateId` = `flag_key`, `organizationId` = the `callerOrganizationId` argument, `aggregateVersion` = null. |
| `setOrgFlagState` | `flag.org_state_changed` | `FEATURE_FLAG` | AS SPECIFIED | `case_workspace_feature_flags` PK `flag_id`, has `organization_id`. Summary: `{flagKey, from, to, scope}`. |
| `rollbackFlag` | `flag.rolled_back` | `FEATURE_FLAG` | AS SPECIFIED | §7 has no flag family; this is a delivery-plan concern (doc 07). Consumers of the rollout dashboard read exactly these two. |
| `recordQuarantinedLegacyRecord` | `legacy.record_quarantined` | `LEGACY_RECORD` | AS SPECIFIED | `aggregateId` = `quarantine_id`, `organizationId` from `input.organizationId`. Summary: `{sourceSystem, sourceTable, sourceId, quarantineReasonCode}` — reason code only, never the quarantined payload. |

**Row count: 57 commands.** 55 emit exactly one event (some choosing between
enumerated types), `recordIdempotencyKeyCheck` deliberately emits none, and
`cancelCase` deliberately emits none because its delegate already does.

## 3. `aggregateVersion` per aggregate (do not guess at the call site)

| aggregate_type | Source column | Present? |
| --- | --- | --- |
| `CASE` | `case_core.version` | yes |
| `CASE_PLAN_VERSION` | `case_plan_versions.version` | yes (null for `putViewState`, which writes `case_plan_view_state`) |
| `PROCESS_DEFINITION` | `process_definitions.version` | yes |
| `PROCESS_VERSION` | `process_versions.version` | yes (`version_number` is the semantic version → summary) |
| `ACTION_PROPOSAL` | `case_workspace_action_proposals.version` | yes |
| `WAIT` | `case_workspace_waits.version` | yes |
| `ARTIFACT_LINK` | `case_workspace_artifact_links.version` | yes |
| `CAPABILITY` | `case_workspace_capabilities.version` | yes |
| `RUN` | — | **no** → null |
| `NODE_RUN` | — | **no** → null |
| `VALUE_MEASUREMENT` | — | **no** → null |
| `FEATURE_FLAG_DEFINITION` / `FEATURE_FLAG` / `LEGACY_RECORD` | — | **no** → null |

Always the **post-mutation** value, read from the `RETURNING` row of the write
itself — never a second `SELECT` (that would be a different value under
concurrency and would break §8's monotonicity).

## 4. Tenancy for the three org-less aggregates

`case_workspace_capabilities`, `case_workspace_capability_idempotency_keys`
and `case_workspace_feature_flag_definitions` carry no `organization_id`, by
their own packets' design. `organization_id` on the outbox is NOT NULL (§3),
so those events take the **caller's** organization (`callerOrganizationId`,
already a parameter of every affected command) and note in the summary that
the aggregate is platform-global. Do not invent a sentinel org id, and do not
make the outbox column nullable.

## 5. Deviations from the coordinator's mapping, and open flags

**5.1 `case.successor_created` — dropped as unreachable.** The coordinator
mapped it onto `transitionStatus`. `CaseStatus` is
`DRAFT|ACTIVE|BLOCKED|CLOSED|FAILED|CANCELLED` (caseCoreService.ts:51) and no
successor/Monitoring-Case concept exists in the code — CW-P07's own header
records the Monitoring-Case split (CW-00-017, OD-06) as *not built*. Keep
`case.successor_created` reserved in §7's family list; the command that emits
it does not exist yet.

**5.2 `recordClosure` → `case.closure_recorded`, not `case.closed`.**
`recordClosure` writes `closure_type` and does **not** set
`case_status='CLOSED'`; `transitionStatus` does, and it *refuses* to close a
Case whose `closure_type` is unset (`case_closure_not_recorded`,
caseCoreService.ts:425). Two different facts, in a mandatory order. Giving
both `case.closed` would make "how many Cases closed" double-count and would
make the closed-projection fire while the Case is still ACTIVE.

**5.3 `cancelCase` emits nothing.** It is literally
`return transitionStatus(caseId, 'CANCELLED', actor, reason)`
(caseCoreService.ts:648). Emitting `case.cancelled` here *and* in
`transitionStatus` means every cancellation through this route produces two
events with different ids — §8 dedup by `eventId` will not collapse them.
Put the cancellation `reason` into `transitionStatus`'s summary instead.

**5.4 `process.definition.submitted|published|deprecated` on a
`PROCESS_VERSION` aggregate — kept, flagged.** §7 lists these three under
`process.definition.*` verbatim, but the commands act on a *version* row. The
literal canon wins for now; the asymmetry means a consumer subscribing to
`process.definition.*` receives events whose `aggregateId` is a
`process_version_id`. **Owner decision needed**: either rename to
`process.version.*` (breaks §7's literal text) or keep and document. Do not
resolve this at a call site.

**5.5 `approval.deferred` — added.** `ApprovalDecisionType` includes `DEFER`
(proposalApprovalService.ts:210) and the coordinator's three-way map has no
branch for it, which would have made a real decision silently unobservable.
`approval.deferred` is not in §7's literal list either; it is the minimal
consistent extension of the `approval.*` family.

**5.6 Double-emission risk: `caseHistoryService` is now a second event
source.** `recordValueMeasurement` already appends a history row in the same
transaction, and `appendCaseHistoryEvent` is itself mapped to an event. If the
wiring phase makes `appendCaseHistoryEvent` emit unconditionally, then
`recordValueMeasurement` produces **two** outbox rows
(`outcome.measurement_recorded` + the history event). Rule for the wiring
phase: the outbox emission for the history log belongs to the **public**
`appendCaseHistoryEvent` entry point only, never to the internal
`insertHistoryEvent` helper that other commands reuse. Note that
`caseHistoryService` is currently called by no other caseWorkspace service,
so this is a trap for the future, not a bug today.

**5.7 `approval.requested` vs `proposal.review_requested`.** §7 lists both
families. This taxonomy emits only `proposal.review_requested` from
`submitActionProposalForReview`. If the approvals inbox projection needs an
`approval.*` stream of its own, emit `approval.requested` from the same
transaction with `causationId` = the proposal event's id — do **not** rename
the existing one.

**5.8 Volume warning — three commands are hot paths.**
`renewTimerWaitClaimLease` (lease heartbeat), `claimTimerWait` and
`putViewState` (UI pan/zoom persistence) can each fire far more often than any
business fact. They are kept in the taxonomy because §10 explicitly wants
"worker utilization, leases and stuck nodes" observable, but the wiring phase
should expect the outbox growth to be dominated by these three and should
raise it with the owner if `putViewState` turns out to be per-interaction
rather than per-save.

## 6. Wiring checklist (per command)

1. `publishEvent` is called **inside** the existing transaction callback, on
   the callback's own `client`. No new connection, no post-commit publish.
2. `organizationId`, `aggregateType`, `aggregateId` come from the row the
   command just wrote (`RETURNING`), not from unvalidated input.
3. `aggregateVersion` is the post-mutation version, or null per §3.
4. Every correlation field the aggregate has (`caseId`, `runId`, `nodeRunId`,
   `attemptId`) is filled.
5. `redactedSummary` holds facts and ids only. Anything document-, prompt-,
   credential- or free-text-shaped goes behind `payloadRef`.
6. The command's existing realDB test gains one assertion: after a successful
   call, exactly one `case_workspace_event_outbox` row exists with the
   expected `event_type`/`aggregate_id`; and after a forced failure, **zero**.

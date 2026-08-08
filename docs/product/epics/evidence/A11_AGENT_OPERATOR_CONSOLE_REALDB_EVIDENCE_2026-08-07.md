# A11 Agent operator console and safe recovery — realDB evidence

> Date: 2026-08-08
> Candidate: dirty local `codex/agent-t01-i01`
> Database: isolated PostgreSQL `consultify_agent_a11_proof_20260807`

The operator surface correlates canonical execution state, transitions, proposals, multi-agent graphs/branches, tool-governance decisions, quality evaluations and prior recovery actions under one execution-run correlation ID.

```json
{
  "proof": "A11_REALDB_GREEN",
  "correlatedRunSnapshot": true,
  "actionableAlerts": 4,
  "metricsReadback": true,
  "expiredLeaseRecovered": true,
  "recoveryAuditBeforeAfter": true,
  "tenantIsolation": true
}
```

Verified assertions:

- diagnostics detected an expired branch lease, retryable failed branch, blocked graph and expired approval review;
- the snapshot exposed pending approvals, running/failed branch counts, allowed/denied tool counts, latest quality status and recovery count;
- an ordinary consultant received 403; operator identity and tenant come only from authenticated V8 context;
- expired-lease recovery uses an atomic status/lease/time predicate and refuses a non-expired target;
- recovery moved the branch to `pending`, removed the stale lease and removed the expired-lease alert;
- PostgreSQL preserved actor, reason, action, target and before/after snapshots;
- foreign-tenant snapshot returned `null`;
- Agent Hub exposes the console only to ADMIN/OWNER/SUPERADMIN roles;
- UI loads metrics/alerts and can invoke only the `safeAction` returned by diagnostics, with a mandatory reason;
- focused service, route and component evidence is green: 7/7; full TypeScript check is green.

## Atomic and idempotent branch recovery

The two safe branch actions, `retry_failed_branch` and `recover_expired_lease`, now run inside one pinned PostgreSQL transaction. The transaction acquires a same-key advisory lock, checks the tenant/run/idempotency receipt, locks the tenant/run/task row `FOR UPDATE`, applies one guarded mutation and inserts the before/after receipt before commit. The route requires `Idempotency-Key`; the typed client and operator UI preserve one key across the request's transport retries.

Fresh PostgreSQL result:

```json
{"proof":"A11_REALDB_GREEN","atomicIdempotentBranchRecovery":true,"concurrentSameKey":2,"recoveryReceipts":2,"payloadConflictFailClosed":true,"retryFailedBranchExactlyOnce":true,"receiptFailureRolledBackMutation":true,"nonExpiredAndMaxAttemptFailClosed":true,"foreignTenantAndRunFailClosed":true,"recoveryAuditBeforeAfter":true,"tenantIsolation":true}
```

Two concurrent calls with the same key produced one branch mutation and returned the same recovery ID; replay did not add a receipt. Reusing the key with a different target/action/reason failed with a payload conflict and performed no mutation. A PostgreSQL trigger deliberately failed the receipt insert after the guarded task update; transaction rollback left the task in its original failed state. Non-expired lease, exhausted retry limit, foreign tenant and foreign run all failed closed. The final two receipts correspond to the two distinct successful actions and preserve actor, reason and before/after state. Focused service/route/UI tests: `7/7` PASS. Full repository TypeScript check: PASS with an 8 GB Node heap.

## Cooperative graph cancellation and projection outbox

`cancel_graph` now uses the same idempotent receipt boundary plus a durable canonical-projection outbox. One pinned transaction writes the recovery receipt, moves the graph to `cancellation_requested`, cancels pending/failed tasks, moves running tasks only to `cancellation_requested` and inserts the projection event. It never marks active work as stopped merely because the database request was accepted.

```json
{"proof":"A11_REALDB_GREEN","cooperativeGraphCancellation":true,"cancelConcurrencyExactlyOnce":true,"outboxFailureRolledBackAllWrites":true,"restartOutboxProjectionExactlyOnce":true,"runningTaskCancelledOnlyAfterWorkerAck":true,"wrongWorkerAckDenied":true,"focusedTests":"7/7","fullTypeScript":"PASS"}
```

Two concurrent requests with one idempotency key returned the same recovery ID and produced exactly one receipt and one outbox event. A trigger-forced outbox insert failure rolled back the receipt, graph transition and task transitions together. The outbox worker claimed and applied the canonical projection; a restart replay found no pending work and created no duplicate projection/alias. A running task remained `cancellation_requested` until the worker holding its durable lease acknowledged cancellation. An acknowledgement from a different worker failed closed. The graph became `cancelled` only after the last active cancellation acknowledgement. Focused service/route/UI tests remained `7/7` PASS and the full TypeScript check passed.

## Atomic stale-review expiry

The operator snapshot now advertises `expire_stale_review` only for an execution run whose canonical state is `waiting_for_review` and whose `expires_at` is at or before the supplied current time. The route requires `Idempotency-Key`. One pinned PostgreSQL transaction takes the same-key advisory lock, performs receipt replay/conflict validation, locks the tenant-scoped run `FOR UPDATE`, applies the guarded `waiting_for_review -> expired` mutation with `resolved_at`, writes the state transition and writes the actor/reason/before/after recovery receipt before commit. This playbook never approves or rejects a proposal.

Fresh isolated PostgreSQL database: `consultify_agent_a11_expiry_proof_20260808`.

```json
{"proof":"A11_REALDB_GREEN","atomicStaleReviewExpiry":true,"staleReviewConcurrencyExactlyOnce":true,"staleReviewReplayNoDuplicates":true,"staleReviewPayloadConflictFailClosed":true,"staleReviewReceiptAndTransitionRollback":true,"futureWrongStateTenantRunFailClosed":true,"pendingProposalUnchanged":true,"focusedTests":"10/10","fullTypeScript":"PASS"}
```

Two concurrent requests with the same key returned one recovery ID and produced exactly one run mutation, one `waiting_for_review -> expired` transition and one receipt. Replay produced no duplicate. Reusing the key with a different reason failed with a payload conflict and no side effect. Trigger-forced receipt failure and trigger-forced transition failure each rolled back the run mutation. A future deadline, wrong run state, foreign tenant and foreign run failed closed. The associated proposal remained exactly `pending_review`; no approval or rejection field was changed. Focused service, route and UI tests passed `10/10`; the full repository TypeScript check passed.

A11 remains `PARTIAL`. Atomic branch recovery, cooperative graph cancellation and stale-review expiry are locally GREEN, but production health/latency/queue/cost time series, retention/export/privacy operations and same-SHA deployed recovery evidence remain required.

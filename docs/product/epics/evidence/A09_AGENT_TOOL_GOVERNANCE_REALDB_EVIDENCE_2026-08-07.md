# A09 Agent tool-execution governance — realDB evidence

> Date: 2026-08-07
> Candidate: local `codex/agent-t01-i01`
> Database: isolated PostgreSQL `consultify_agent_a09_proof_20260807`

The Wave8 tool route now crosses the central V8 catalog and consumer-policy boundary before `executeToolCall`. Agent-definition scope and approval failures enter the same durable denial log instead of returning an unaudited 403.

```json
{
  "proof": "A09_REALDB_GREEN",
  "centralCatalogFailClosed": true,
  "projectMembership": true,
  "invocationLimit": true,
  "promptInjectionDenied": true,
  "tenantIsolation": true,
  "denialAuditReadback": true,
  "rawSensitiveInputNotStored": true,
  "wave8ExecutionBridgeDenied": true,
  "events": 6
}
```

Verified assertions:

- an unregistered or non-ratified capability fails closed;
- a project-scoped invocation requires an authenticated membership joined to a project in the same organization;
- the most restrictive organization/project consumer policy remains authoritative;
- the second allowed invocation in a run was denied at the configured per-run ceiling;
- normalized nested input was checked for instruction, secret-exfiltration and approval-bypass patterns;
- a crafted Wave8 `search_web` invocation was denied by the central preflight before reaching the tool executor;
- foreign-tenant catalog lookup returned no capability;
- all allowed and denied decisions persisted organization, user, agent, tool, project, run, policy and reason;
- raw tool input was not copied into the governance ledger; only its canonical SHA-256 digest was stored;
- the original focused governance suite was green: 31/31.

## 2026-08-08 bounded resource-governance increment

An additional isolated, fresh PostgreSQL proof validates the atomic resource reservation ledger used by the Wave8 execution bridge. Admission, callback execution and settlement/release are separated explicitly, while admission itself is serialized in one pinned transaction. Cost without a provider receipt is recorded only as estimated/reserved; provider actual usage remains literal `UNKNOWN`.

```json
{
  "proof": "A09_RESOURCE_GOVERNANCE_REALDB_GREEN",
  "concurrencyAttempts": 20,
  "maxConcurrentExecutions": 2,
  "concurrencyCallbacks": 2,
  "concurrencySettled": 2,
  "concurrencyDenied": 18,
  "estimatedRunBudgetUsd": 1.0,
  "parallelEstimatedRequestsUsd": [0.6, 0.6],
  "budgetCallbacks": 1,
  "budgetAllowed": 1,
  "idempotentReplayCallbacks": 1,
  "idempotentReservationRows": 1,
  "expiredLeaseRecoveredAfterProcessRestart": true,
  "tenantFailClosed": true,
  "providerActualUsage": "UNKNOWN"
}
```

Verified assertions:

- 20 concurrent attempts against a ceiling of two produced exactly two callbacks, two settled reservations and 18 durable denials;
- a `1.00 USD` estimated per-run ceiling with two parallel `0.60 USD` reservations produced exactly one allowed callback;
- an idempotent retry produced one callback and one durable reservation row; an in-progress replay did not execute a duplicate callback;
- a separate worker process created a short lease, exited, and a subsequent process expired the stale reservation and admitted recovery without ghost concurrency;
- tenant/project scope and idempotency scope mismatches fail closed;
- every settled row retained `actual_cost_usd = NULL` and `actual_usage_source = 'UNKNOWN'` because no provider receipt was supplied;
- focused A09 governance tests are green: 12/12;
- the earlier filtered TypeScript check reported zero errors for `agentResourceGovernanceService`, `wave8AgentRuntimeService` and `wave8-agents.routes`; the later independent full-tree command `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check -- --pretty false` completed with exit code `0` on the current shared tree.

## 2026-08-08 cross-path Wave8 + Planner + A06 increment

The same atomic reservation service is now used by Wave8, canonical Agent Planner dispatch/tool execution and the central A06 adapter dispatcher. Wave8 resolves its local run alias to the canonical run before reservation. Planner reserves before route/scheduler enqueue and before each canonical tool callback; wait-step resume and queue enqueue share one governed callback. A06 reserves before invocation-ledger creation and adapter execution, then settles or releases after canonical readback.

```json
{
  "proof": "A09_CROSS_PATH_RESOURCE_REALDB_GREEN",
  "paths": ["wave8", "planner", "a06"],
  "canonicalRun": "canonical-cross",
  "concurrentAttempts": 12,
  "maxConcurrent": 2,
  "totalCallbacks": 2,
  "durableDenied": 10,
  "budgetUsd": 0.8,
  "estimatesUsd": [0.4, 0.4, 0.4],
  "budgetCallbacks": 2,
  "aggregateAcrossPaths": true,
  "providerActualUsage": "UNKNOWN"
}
```

Cross-path assertions:

- 12 concurrent Wave8/Planner/A06 attempts sharing one canonical run and a ceiling of two produced exactly two callbacks and ten durable denials;
- a shared `0.80 USD` estimated budget with three cross-path `0.40 USD` requests produced exactly two callbacks;
- resource denial occurs before Planner queue enqueue, wait-step resume, Planner tool execution, A06 invocation creation and adapter execution, yielding zero denied-path side effects;
- stable path-specific idempotency keys reuse the common ledger rather than introducing Planner or A06 budget stores;
- focused and route regression suites are green: 56/56;
- the fresh A06 PostgreSQL regression remained green for six owning adapters/readbacks, central denial with `adapterExecuted=false`, replay/readback drift handling and stale-running recovery;
- provider actual usage remains literal `UNKNOWN`;
- the filtered check reported zero errors in the changed A09, Wave8, Planner, scheduler, route and A06 files; the later independent full-tree command `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check -- --pretty false` completed with exit code `0` on the current shared tree.

## 2026-08-08 canonical WorkGraph bridge

Canonical WorkGraph branch launch now takes a concurrency-only reservation before `launchWave8Agent`. The reservation uses the graph's canonical run and Transformation Case project plus a stable graph/task/attempt key. Its estimated cost is exactly zero: A08 remains the sole owner of branch token/cost accounting, while nested Wave8 tool calls continue to use A09 normally.

```json
{
  "proof": "A09_WORK_GRAPH_RESOURCE_REALDB_GREEN",
  "simultaneousWave8AndGraphMax1Callbacks": 1,
  "deniedGraphLaunchCallbacks": 0,
  "graphEstimatedCostUsd": 0,
  "a08RemainsCostOwner": true,
  "stableDeniedReplayRows": 1,
  "retryAttemptCallbacks": 1,
  "restartLeaseRecovered": true,
  "tenantProjectFailClosed": true,
  "providerActualUsage": "UNKNOWN"
}
```

WorkGraph assertions:

- focused WorkGraph/resource tests are green: 23/23;
- simultaneous Wave8 and WorkGraph admission under `maxConcurrent=1` produced exactly one callback;
- denied WorkGraph admission produced zero graph launch callbacks and a truthful failed branch receipt;
- every WorkGraph reservation used `estimatedCostUsd=0`, so the A08 branch usage ledger was not charged twice;
- a same-attempt denial replay reused one durable row, while retry attempt two executed exactly one callback;
- a separate-process stale lease was recovered and foreign tenant/project scope failed closed;
- provider actual usage remains literal `UNKNOWN`;
- the filtered WorkGraph/A09 check reported zero errors; the later independent full-tree command `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check -- --pretty false` completed with exit code `0` on the current shared tree.

## 2026-08-08 released reservation reclaim

An isolated PostgreSQL regression proves that a failed A06 invocation may atomically reclaim its released A09 reservation for the same exact invocation, idempotency key and input digest. This is a retry of the existing row, not a second reservation or a second estimated-cost charge.

```json
{
  "proof": "A09_RELEASED_RECLAIM_REALDB_GREEN",
  "concurrentRetryExactlyOne": true,
  "oneReservationRow": true,
  "estimatedCostChargedOnce": 0.6,
  "differentPayloadBlocked": true,
  "settledNotReclaimed": true
}
```

The reclaim-focused A09/A06 suite is green `18/18`. Full-tree TypeScript completed with exit code `0`. Reclaim remains bounded to a genuinely failed owning A06 invocation; denied, settled and payload-drift cases remain fail-closed.

## 2026-08-08 truly legacy noncanonical isolation

The remaining production entrypoints — `playbookExecutor`, `actionExecutionAdapter`, `asyncJobService`/`asyncJobProcessor` and `aiPlaybookExecutor` — do not expose a trustworthy canonical run/project identity and therefore do not fabricate one or create a second A09 budget owner. They are explicitly classified as `legacy_noncanonical` with structured telemetry. Explicit canonical identity, including nested payload identity, is rejected before enqueue or execution; legacy-shaped run identifiers are checked against the canonical identity store within the tenant boundary.

```json
{
  "proof": "A09_LEGACY_NONCANONICAL_ISOLATION_REALDB_GREEN",
  "legacyClassified": true,
  "canonicalIdentityBlocked": true,
  "nestedExplicitIdentityBlocked": true,
  "tenantScoped": true
}
```

The isolation-focused suite is green `6/6`, operational identity-store errors fail closed, and the native PostgreSQL readback is green. The previously listed truly legacy noncanonical gap is therefore locally closed.

## 2026-08-08 adversarial closure

The focused adversarial suite is green `23/23`. It covers nested arrays and objects, alternate casing and separator/alias variants for canonical identity smuggling; same-key cost drift; same-tenant project drift; foreign-tenant non-replay; and fail-closed canonical identity-store operational errors.

Fresh native PostgreSQL proofs on an isolated database produced:

- four-path Wave8 + Planner + WorkGraph + A06 concurrency: `12` attempts at `maxConcurrent=2`, exactly `2` callbacks and `10` durable denials;
- shared estimated budget: `0.80 USD` with three `0.40 USD` attempts, exactly `2` callbacks;
- released reclaim race: exactly one reclaim, one reservation row, estimated cost `0.60 USD` charged once, different digest blocked and settled reservation not reclaimed;
- stale lease/process restart: `20` attempts at `maxConcurrent=2`, exactly `2` callbacks, `2` settlements and `18` durable denials; expired lease recovery and tenant fail-closed both true;
- legacy isolation readback: canonical identity, nested identity and alternate-case aliases blocked, while lookup remained tenant-scoped.

The isolated proof database was removed after successful readback. The broader local adversarial-coverage gap is closed.

A09 remains **PARTIAL** only for provider-reported actual usage and same-SHA deployed HTTP/worker/browser evidence.

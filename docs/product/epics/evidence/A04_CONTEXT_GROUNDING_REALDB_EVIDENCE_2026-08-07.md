# A04 — context grounding and resume revalidation evidence

Date: 2026-08-08
Scope: local candidate; not final epic acceptance

## Delivered

- Scope and source policy are evaluated before relevance sorting; a high-ranking forbidden source cannot enter working memory.
- Every admitted memory binding retains its source reference and content digest.
- Working memory is bounded by an explicit character budget without silently truncating source content.
- Resume revalidation compares tenant, project scope and snapshot drift and persists an allow/block decision.
- Detected drift fails closed with `blocked_drift` and requires a new context snapshot.

## PostgreSQL proof

Database: `consultify_agent_a04_proof_20260807`
Script: `server/src/scripts/a04ContextGroundingRealDbProof.ts`

```json
{
  "proof": "A04_REALDB_GREEN",
  "policyBeforeRanking": true,
  "attribution": true,
  "boundedMemory": true,
  "resumeDriftBlocked": true,
  "tenantScoped": true,
  "durableDecisions": 2
}
```

Unit suite after atomic-resume integration: 5/5 PASS. Combined A04/A06/final-output/UI accessibility regression: 15/15 PASS. TypeScript: PASS.

## Atomic resume increment

The context service accepts a pinned PostgreSQL transaction client. Snapshot read, policy/drift decision, decision audit and bounded-memory bindings use that same client. The Transformation Case service locks the Case and revalidates context fail closed inside the same transaction before each of five material execution/resume transitions: execution start, execution result acceptance, delivery handoff, benefits review and sustainability review. Tenant and project scope are read from the locked Case rather than trusted from caller input.

## Worker-claim increment

Canonical context is now revalidated before execution crosses each of three local worker boundaries:

- Wave8 due schedule: after the exclusive lease claim and before the execution callback; denial persists `blocked_context` and remains resumable;
- Agent Planner scheduled dispatch and wait-step resume: before enqueue/resume; denial persists recoverable `paused` state;
- transformation Work Graph branch claim: before any branch becomes `running`; denial persists recoverable `blocked` state.

Fresh PostgreSQL database: `consultify_agent_a04_worker_20260808`
Proof scripts: `server/src/scripts/a04WorkerClaimContextRealDbProof.ts` and independent-process `a04WorkerClaimRestartWorker.ts`

```json
{
  "proof": "A04_WORKER_CLAIM_REALDB_GREEN",
  "cleanExactlyOnce": true,
  "driftZeroCallbacks": true,
  "scopeZeroCallbacks": true,
  "tenantFailClosed": true,
  "durableBlockedReadback": true,
  "plannerRecoverablePaused": true,
  "workGraphRecoverableBlocked": true,
  "restartNoDuplicateExecution": true,
  "concurrentNoDuplicateExecution": true,
  "durableDecisions": [
    { "decision": "allowed", "count": 1 },
    { "decision": "blocked_drift", "count": 3 },
    { "decision": "blocked_scope", "count": 1 }
  ]
}
```

Two concurrent Wave8 workers produced exactly one clean callback. Drift and scope mismatch produced zero callbacks. A separately spawned process replayed the blocked schedule and produced zero callbacks and zero processed runs. Canonical ownership is resolved server-side; a foreign tenant cannot produce a cross-tenant decision write. Focused worker/context/planner/work-graph suites: `36/36` PASS. A01/A02 RealDB regression and full TypeScript check: PASS.

## Production retrieval adapter increment

The five atomic Transformation Case execution/resume gates now resolve their pinned Case and context snapshot, retrieve only bounded selected Knowledge/Vault documents through the production `ContextRetrievalService`, preserve native source locator and retrieval relevance, then pass those candidates through the existing policy-first ranking and bounded-memory binding. The Agent workflow requires an exact project and current `project_members` membership. Missing project, inaccessible/foreign-project source, non-ready source and retrieval failure fail closed before the Case transition. Lineage uses a deterministic identifier, and working-memory bindings retain their existing canonical-run idempotency.

Worker claims remain intentionally freshness-only: Wave8 schedule, Agent Planner and Work Graph still revalidate canonical ownership, snapshot, tenant, project scope and drift before callbacks, but they do not independently retrieve grounding candidates at claim time.

Native isolated PostgreSQL proof: `server/src/scripts/a04ProductionRetrievalRealDbProof.ts`, exit `0`.

```json
{
  "proof": "A04_PRODUCTION_RETRIEVAL_REALDB_GREEN",
  "allowedProjectMember": true,
  "foreignProjectExcluded": true,
  "nativeAttribution": true,
  "boundedMemory": true,
  "retrievalFailureBlocked": true,
  "retryBindings": 1,
  "retryLineage": 1
}
```

PostgreSQL-safe soft-delete semantics are covered (`deleted_at IS NULL`, never timestamp-to-empty-string comparison). Focused production-retrieval/context suites: `14/14` PASS. Full TypeScript check: PASS.

## Remaining acceptance boundary

A04 remains `PARTIAL`: local production retrieval for the five Case gates and freshness-only worker enforcement are GREEN; same-SHA deployed browser/worker evidence remains required.

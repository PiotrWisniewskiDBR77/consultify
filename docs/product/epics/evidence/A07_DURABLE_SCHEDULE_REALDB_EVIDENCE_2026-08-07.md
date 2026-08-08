# A07 durable schedule worker — realDB evidence

> Date: 2026-08-07
> Candidate: local `codex/agent-t01-i01`
> Database: isolated PostgreSQL `consultify_agent_a07_proof_20260807`

## Scope proven

The proof ran the production `wave8AgentRuntimeService` against PostgreSQL through the same `DbPromise` boundary used by the application. It reset only the isolated proof database schema.

```bash
DATABASE_URL=postgresql://localhost/consultify_agent_a07_proof_20260807 \
DB_TYPE=postgres npx tsx server/src/scripts/a07ScheduleRealDbProof.ts
```

```json
{
  "proof": "A07_REALDB_GREEN",
  "overlappingExecutions": 1,
  "recoveredAfterExpiredLease": 1,
  "tenantIsolation": true,
  "pauseResumeCancel": true,
  "hardTimeout": true,
  "boundedRetry": true,
  "externalDependencyResume": true,
  "actionableNotificationReadback": true,
  "approvedMandateSnapshot": true,
  "schedules": 5
}
```

Verified assertions:

- two concurrent workers executed one due schedule exactly once;
- an expired lease was recovered by a new worker;
- an organization-scoped sweep returned no foreign-tenant schedules;
- timezone and attempt count survived canonical readback;
- both one-time definitions ended in durable `completed` state.
- pause excluded a due definition from the worker sweep;
- resume restored eligibility, while cancellation permanently prevented execution;
- each control transition incremented the recurring mandate version.
- registration persisted an immutable version-1 mandate snapshot with approver, approval policy/decision, owner, goal, project, cadence, timezone, timeout and retry limit;
- a one-second deadline aborted the cooperative executor with `AbortSignal`, persisted the timeout and scheduled exponential backoff;
- the second failed attempt reached the configured terminal limit, after which an explicit owner resume created a fresh attempt cycle;
- an unavailable external dependency entered `blocked_external`, preserved the reason, emitted an actionable in-app notification with a schedule deep-link and resumed only after an explicit owner action;
- notification payload, retry timestamp, attempt counts, terminal states and cleared block state were read back from PostgreSQL.

## Defects found and fixed

The first proof exposed a PostgreSQL nullable-parameter typing error and fallback DDL that could report false schema success. The query now emits the tenant predicate conditionally, while critical schema writes use `fallback: false` and propagate failure.

## 2026-08-08 forward migration P0 closure

The historical `20260425_wave8_agent_runtime.sql` migration was restored byte-for-byte to repository HEAD. Its SHA-256 is exactly `31af5fccd9f37a77dd4e8de5211c55f12426d16c0a5cd16651522fc8aee4689e`, preventing an applied-migration checksum conflict. All Agent runtime additions moved to a new forward-only, idempotent migration.

```json
{
  "proof": "A07_WAVE8_FORWARD_MIGRATION_REALDB_GREEN",
  "historicalChecksumPreserved": true,
  "existingSchemaForwardTwice": true,
  "freshChain": true,
  "expectedColumns": 16,
  "exactDefaults": true,
  "indexes": 2,
  "decisionConstraints": 1,
  "existingRowsPreserved": 1
}
```

The native PostgreSQL proof upgraded a historical schema containing an existing schedule, applied the forward migration twice without duplicate constraints, and preserved the row with its backfilled defaults. A separate fresh historical-to-forward chain produced all 16 schedule columns, the durable scheduler/default contract, both expected indexes, the governance table and exactly one decision constraint.

## Remaining acceptance gaps

A07 remains partial for the product-policy decision governing recurring notifications and for a same-SHA deployed migrate-before-worker cycle with worker restart and browser notification interaction. Durable timeout, bounded retry, external-dependency resume, actionable in-app delivery/readback, mandate snapshot, pause/resume/cancel, timezone/DST and forward migration safety now have deterministic PostgreSQL evidence.

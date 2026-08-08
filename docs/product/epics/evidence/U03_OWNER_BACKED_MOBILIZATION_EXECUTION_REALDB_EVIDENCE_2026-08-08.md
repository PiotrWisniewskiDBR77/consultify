# U03 owner-backed mobilization and execution — realDB evidence

> Date: 2026-08-08
> Candidate: local `codex/agent-t01-i01`
> Database: isolated native PostgreSQL, removed after readback

## Canonical contract

The approved Mobilization proposal is the governed source for execution ownership. Common A05 approves the exact proposal payload before any business write. The central A06 `transformation.mobilization.materialize` adapter then materializes one idempotent aggregate containing:

- explicit RAID items (`risk`, `assumption`, `issue`, `dependency`) with title, description, probability, impact, owner, due date and response;
- local-only calendar projections for `task_due` and `initiative_milestone`, with Consultify as source and `edit_authority=local_only`;
- a read-only monitoring definition with Settings-ready cadence, timezone, first run and owner fields;
- one durable aggregate receipt and canonical owner readback.

RAID dependency items are risk-governance records. They do not replace or mutate WBS task dependencies. Calendar projection creates no external event and sends no invitation.

## Native PostgreSQL proof

```json
{
  "proof": "U03_OWNER_BACKED_EXECUTION_REALDB_GREEN",
  "raidItems": 2,
  "wbsDependenciesUntouched": true,
  "localCalendarProjections": 2,
  "externalInvites": 0,
  "aggregateReceipts": 1,
  "concurrentMaterializationExactlyOne": true,
  "payloadDriftBlocked": true,
  "tenantAuthorityBlocked": true,
  "monitoringConcurrentExactlyOne": true,
  "restartLeaseRecovered": true,
  "snapshots": 2,
  "timezone": "Europe/Warsaw",
  "cadence": "weekly"
}
```

The monitoring worker uses a durable lease and `FOR UPDATE SKIP LOCKED`. Concurrent workers produced exactly one snapshot; an expired lease was recovered after restart. Every snapshot is a read-only count projection and advances the configured cadence without changing Initiative, task, milestone or RAID owner state.

Focused A05/A06/T01 regression suites are green `25/25`; full TypeScript completed with exit code `0`.

## Superseded lifecycle caveat

The former local Schedule Lock / Initiative-transition gap is closed by [U03 Initiative lifecycle and clean closure evidence](./U03_INITIATIVE_LIFECYCLE_CLOSURE_REALDB_EVIDENCE_2026-08-08.md): the clean T01 run uses one canonical baseline, three governed owner transitions and zero raw status updates. U03 remains `PARTIAL` only for same-SHA authenticated browser and deployed-runtime evidence.

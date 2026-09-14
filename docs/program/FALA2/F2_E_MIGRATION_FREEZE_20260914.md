# F2-E — migration freeze (variant B)

**VERDICT: PASS / STOP AFTER MIGRATION.** The additive snapshot/resume schema is written and proven twice on an empty PostgreSQL database and twice on the 2026-09-13 staging schema clone; E2 application code has not started.

## Identity

- Branch: `codex/enterprise-trust-pack-20260913`
- Rebased line: `origin/integracja/20260911` at `90059a10547437b618f3bcc25ed09613ccdda33f`
- Migration: `server/migrations/20262200_enterprise_export_snapshot_resume.sql`
- Migration SHA-256: `a5ec40700dee5aceed651a0f5b4a040d428354e3fc9b4378f58261a24f8aca66`
- Container: `cx-f2e-pg`, local port `6456`, restart policy `unless-stopped`
- No staging/demo/Railway database URL was used.

## Exact forward SQL

The complete executable SQL is the single migration file named above. It creates only:

1. `organization_export_snapshots` — tenant-bound snapshot identity, pinned `as_of`, `(organization_id, idempotency_key)` deduplication, SHA-256-only resume/lease credentials, lease expiry, monotonically increasing fence, durable checkpoint, terminal artifact metadata and lifecycle timestamps.
2. `organization_export_snapshot_parts` — tenant/snapshot-bound ordered durable `BYTEA` parts. The database verifies both byte length and SHA-256 against the exact bytes.
3. Three indexes, two mutation guard functions and two triggers. Snapshot identity including `as_of` is immutable; stored parts are append-only.

The migration contains no `INSERT`, `UPDATE`, backfill, `ALTER TYPE`, or `DROP`. It does not start an export.

## Migration evidence

Commands used the strict repository migrator with `NODE_ENV=test` solely to authorize the local loopback database target.

| Target | First pass | Second pass | Resulting F2-E shape |
|---|---:|---:|---:|
| Fresh empty PostgreSQL 18 database `f2e_empty_final` | 915 migrations, PASS | 0 pending, PASS | 1,811 public tables; 39 F2-E columns |
| CTO staging schema clone from `staging-schema-20260913.sql`, database `f2e_schema_final` | F2-E migration 1/1, PASS | 0 pending, PASS | 1,950 non-system tables; 39 F2-E columns |

Both targets record exactly one ledger entry for `20262200_enterprise_export_snapshot_resume.sql`.

## Contract behavior proof on real PostgreSQL

One local transaction sequence proved:

- replaying the same `(organization_id, idempotency_key)` returned the original snapshot UUID;
- the first lease claim advanced fence `0 → 1`;
- checkpoint write with fence `1` succeeded, while a stale fence `0` changed zero rows;
- an attempted `as_of` mutation was rejected;
- an attempted stored-part mutation was rejected;
- a raw resume token failed the SHA-256 shape constraint;
- the stored part digest equaled `encode(digest(payload, 'sha256'), 'hex')`.

Final readback: snapshot `00000000-0000-4000-8000-000000000001`, `as_of=2026-09-14T00:00:00Z`, `fence=1`, `checkpoint_part_ordinal=0`, one durable part, digest verification `true`.

## Railway pre-deploy gate

`railway.json` SHA-256 on this branch and on the rebased line is identical:
`ee471e1e2b73ece9cc7c7965d01941ae7a98769cd9f21dc2d6ef997e374ceca4`.
The command remains `node dist/scripts/release-migration-gate.js`.

## Rollback SQL (review only; not executed)

Run only before any snapshot row is created. If either new table contains data, stop and preserve it.

```sql
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM organization_export_snapshots LIMIT 1)
     OR EXISTS (SELECT 1 FROM organization_export_snapshot_parts LIMIT 1) THEN
    RAISE EXCEPTION 'F2-E rollback refused: durable snapshot data exists';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_organization_export_snapshot_parts_immutable
  ON organization_export_snapshot_parts;
DROP TRIGGER IF EXISTS trg_organization_export_snapshot_identity_immutable
  ON organization_export_snapshots;
DROP FUNCTION IF EXISTS reject_organization_export_snapshot_part_mutation();
DROP FUNCTION IF EXISTS reject_organization_export_snapshot_identity_mutation();
DROP TABLE IF EXISTS organization_export_snapshot_parts;
DROP TABLE IF EXISTS organization_export_snapshots;
DELETE FROM schema_migrations
WHERE filename = '20262200_enterprise_export_snapshot_resume.sql';

COMMIT;
```

## Stop boundary

Migration work is frozen here. No E2 route, worker, UI, scheduling, or export materialization implementation is included.

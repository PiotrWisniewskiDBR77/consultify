# DATA-DR-001 PostgreSQL restore runbook

This runbook covers internal-beta recovery only. It does not authorize restoring into production.
The default objectives are RPO at most 15 minutes and RTO at most 60 minutes.

## Canonical application backup

The Scheduler is the sole lifecycle authority. It registers one `*/15` UTC job and calls the shared
`BackupCron.runBackupTick` coordinator. Manual backups use the same coordinator and durable
`backup_run_receipts` slot/fence contract. A receipt contains a key identifier, never key material.
The source watermark is the migration-owned monotonic owner-graph clock advanced by statement triggers
on `organizations`, `users`, and `organization_members`; backup rows and that clock are read from one
pinned `REPEATABLE READ READ ONLY` snapshot.

The canonical writer is full-only; `incremental` is rejected until a real incremental lineage exists.
Its format is `consultify-logical-backup-v2`: an AES-256-GCM envelope containing
the versioned manifest and Tier A owner rows (`organizations`, `users`) plus the required Tier B
`organization_members` relationship. Users are selected through membership, not a caller-supplied
organization field. The application reader also accepts the historical application envelope
`consultify-encrypted-json-v1` with manifest `consultify-json-v1`. Every unknown or mismatched format
is rejected before opening the target transaction.

`consultify-pg-backup-v1`, produced by `server/scripts/backup-artifact-crypto.ts`, is a legacy
operator artifact. It remains readable by that CLI, but it is not interchangeable with the canonical
application format and must not be passed to `BackupService.restoreBackup`.

## Legacy operator artifact

1. Capture the latest source write timestamp before `pg_dump`.
2. Produce a PostgreSQL logical dump with `--no-owner --no-privileges` and gzip it.
3. Encrypt it with `server/scripts/backup-artifact-crypto.ts encrypt` using a 32-byte key supplied
   through `BACKUP_ENCRYPTION_KEY_HEX`. Never store the key beside the artifact or in evidence.
4. Store both the encrypted artifact and manifest. The manifest contains independent SHA-256
   values for plaintext and ciphertext, AES-256-GCM IV/authentication tag, creation timestamp and
   source write timestamp.

## Isolated canonical restore drill

1. Create a new PostgreSQL instance with no connection to production traffic.
2. Require a PostgreSQL 16 source and target. Verify both live `current_database()` identities rather
   than trusting URL text. The target name must be explicitly disposable and its Tier A owner tables
   must be pristine.
3. Call the supervised `BackupService.restoreBackup` path. Checksum, authentication, format, tenant,
   target identity or collision failure must terminate the single transaction with zero target rows.
4. Compare exact Tier A/Tier B counts and stable hashes before commit, then cold-open the destination
   in a new connection and repeat exact marker/count/hash assertions.
5. Calculate RPO as `backupCompletedAt - sourceWatermark` from the durable completed receipt. Calculate
   RTO as `restoreCompletedAt - restoreStartedAt`. RPO must be at most 15 minutes and RTO at most 60.
6. Delete the isolated instance and plaintext temporary dump. Preserve only redacted evidence and
   encrypted artifacts according to retention policy.

Before qualification, run strict fresh migrations independently on source and target, repeat with
zero applications, and dry-run with zero applications. Reader compatibility is one-way and explicit:
the current reader must restore the historical application v1 artifact contract fixed at
`5e752a41cc604ae5fc8d929d7c6392d65bc41da8`. The current v2 writer is **not** promised readable by
that previous application SHA; downgrade is approved-out unless a separate release contract adds it.
Production restore requires a separately approved incident, exact target, owner authorization,
verified backup selection and a fresh safety backup. Applied migrations are never rolled back destructively.

## Executable disposable qualification

The operator must choose two new names under the enforced namespaces; never reuse a shared database.

```bash
export DATA_DR_SOURCE_DB="consultify_adm_backup_source_<run>"
export DATA_DR_TARGET_DB="consultify_adm_backup_restore_<run>"
case "$DATA_DR_SOURCE_DB:$DATA_DR_TARGET_DB" in
  consultify_adm_backup_source_*:consultify_adm_backup_restore_*) ;;
  *) echo "unsafe DATA-DR database names" >&2; exit 64 ;;
esac
test "$DATA_DR_SOURCE_DB" != "$DATA_DR_TARGET_DB"

createdb -h 127.0.0.1 -p 55483 "$DATA_DR_SOURCE_DB"
createdb -h 127.0.0.1 -p 55483 "$DATA_DR_TARGET_DB"
for DATA_DR_DB in "$DATA_DR_SOURCE_DB" "$DATA_DR_TARGET_DB"; do
  export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55483/$DATA_DR_DB"
  DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts
  DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts   # repeat: applied=0
  DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts --dry-run # pending=0
done

# The strict migration baseline installs exactly one technical `system` owner graph.
# A disposable restore target must be pristine, so verify that no other owner rows exist,
# then remove only that exact bootstrap graph in one guarded transaction.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF (SELECT array_agg(id ORDER BY id) FROM organizations)<>ARRAY['system'] OR
     (SELECT array_agg(id ORDER BY id) FROM users)<>ARRAY['system'] OR
     (SELECT count(*) FROM organization_members WHERE organization_id='system' AND user_id='system')<>1 OR
     (SELECT count(*) FROM organization_members)<>1 THEN
    RAISE EXCEPTION 'restore target owner graph is not the exact disposable bootstrap';
  END IF;
END $$;
BEGIN;
SET LOCAL session_replication_role=replica;
DELETE FROM organization_members WHERE organization_id='system' AND user_id='system';
DELETE FROM users WHERE id='system' AND organization_id='system';
DELETE FROM organizations WHERE id='system';
COMMIT;
SQL
```

After the supervised test has disconnected every client, prove no owned residue/locks, then remove only
the two literal guarded names and verify catalog absence:

```bash
psql -h 127.0.0.1 -p 55483 -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT datname FROM pg_database WHERE datname IN ('$DATA_DR_SOURCE_DB','$DATA_DR_TARGET_DB')"
dropdb -h 127.0.0.1 -p 55483 "$DATA_DR_TARGET_DB"
dropdb -h 127.0.0.1 -p 55483 "$DATA_DR_SOURCE_DB"
psql -h 127.0.0.1 -p 55483 -d postgres -Atqc \
  "SELECT count(*) FROM pg_database WHERE datname IN ('$DATA_DR_SOURCE_DB','$DATA_DR_TARGET_DB')" # must print 0
```

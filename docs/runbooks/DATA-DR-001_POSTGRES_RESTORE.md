# DATA-DR-001 PostgreSQL restore runbook

This runbook covers internal-beta recovery only. It does not authorize restoring into production.
The default objectives are RPO at most 15 minutes and RTO at most 60 minutes.

## Backup artifact

1. Capture the latest source write timestamp before `pg_dump`.
2. Produce a PostgreSQL logical dump with `--no-owner --no-privileges` and gzip it.
3. Encrypt it with `server/scripts/backup-artifact-crypto.ts encrypt` using a 32-byte key supplied
   through `BACKUP_ENCRYPTION_KEY_HEX`. Never store the key beside the artifact or in evidence.
4. Store both the encrypted artifact and manifest. The manifest contains independent SHA-256
   values for plaintext and ciphertext, AES-256-GCM IV/authentication tag, creation timestamp and
   source write timestamp.

## Isolated restore drill

1. Create a new PostgreSQL instance with no connection to production traffic.
2. Run `backup-artifact-crypto.ts decrypt`. Checksum or authentication failure must terminate before
   any restored bytes are written.
3. Restore with `psql -v ON_ERROR_STOP=1`; any SQL error invalidates the drill.
4. Compare source and destination schema objects, row counts, tenant-scoped counts and a stable hash
   of owner records. Cold-open the destination in a new connection.
5. Calculate RPO as `manifest.createdAt - manifest.sourceLastWriteAt` and RTO as
   `restoreCompletedAt - manifest.createdAt`. Both must satisfy the objectives above.
6. Delete the isolated instance and plaintext temporary dump. Preserve only redacted evidence and
   encrypted artifacts according to retention policy.

Production restore requires a separately approved incident, exact target, owner authorization,
verified backup selection and a fresh safety backup. Applied migrations are never rolled back
destructively; additive schema must remain readable by the previous verified application SHA.

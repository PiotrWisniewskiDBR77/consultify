-- 20260805: FIN-005 statement upload idempotency — reservation/result state
-- machine (Codex round-3 review). Additive only.
--
-- ROOT CAUSE this fixes: `recordIdempotentUpload()` (finance-statements.routes.ts)
-- wrote the completion marker via `dbRun()` -> the GLOBAL connection pool
-- (`Database.js`'s `dbProxy`), NOT the pinned client that
-- `withStatementUploadIdempotencyLock` holds its `pg_advisory_xact_lock` on.
-- The marker write was never actually inside "the transaction" the lock
-- implied — it was ALWAYS a separate, best-effort, auto-committing statement.
-- So a failure of just that one INSERT (any reason) left the business writes
-- (Statement + Pack, which commit independently per-statement via the same
-- global pool) durably committed, a 201 already sent to the client, and NO
-- durable marker — a same-key retry then found nothing and redid the whole
-- upload, creating a duplicate Statement/Pack.
--
-- FIX MODEL (see finance-statements.routes.ts's upload handler for the full
-- write-up): keep `pg_advisory_xact_lock` as the outer per-(org,key)
-- serialization layer (unchanged, already correct) and add a durable
-- reservation/result state machine ON the idempotency row itself:
--   1. RESERVE: `INSERT ... status='in_progress' ... ON CONFLICT DO NOTHING`
--      up front, durably committed via its own connection BEFORE any
--      upload/parse/persist work starts.
--   2. FINALIZE (success): `UPDATE ... SET status='completed', completed_at=now()
--      WHERE id=$1 AND status='in_progress'` — only a 201 is returned to the
--      client if this UPDATE actually affects a row.
--   3. FAIL (thrown error, or a controlled non-2xx outcome from the upload
--      work): `UPDATE ... SET status='failed' WHERE id=$1 AND status='in_progress'`
--      — best-effort, but a real attempt, logged loudly on its own failure.
--   4. RECLAIM: a later request for the same (org, key) finds a 'failed' row,
--      or an 'in_progress' row older than a staleness cutoff (a crashed
--      attempt that never reached step 2 or 3), and atomically reclaims it
--      via `UPDATE ... WHERE id=$1 AND (status='failed' OR (status='in_progress'
--      AND created_at < cutoff)) RETURNING *` — becoming the new owner of the
--      SAME row (never a second row for the same org+key).
--
-- `status` DEFAULT 'completed': every row that could exist before this
-- migration ran was, by construction of the pre-existing code, written ONLY
-- on a genuinely successful upload (the old `recordIdempotentUpload` was
-- only ever called with `statusCode < 400`) — so backfilling pre-existing
-- rows to 'completed' is semantically correct with no backfill script and no
-- data to inspect.
--
-- `completed_at`: set only by the FINALIZE step; NULL for 'in_progress' and
-- 'failed' rows (including reclaimed-then-abandoned ones).

ALTER TABLE financial_statement_upload_idempotency
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

ALTER TABLE financial_statement_upload_idempotency
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Guard the state machine's vocabulary at the DB level too — belt and
-- suspenders alongside the application-level switch over these three values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_fsui_status_values'
  ) THEN
    ALTER TABLE financial_statement_upload_idempotency
      ADD CONSTRAINT chk_fsui_status_values
      CHECK (status IN ('in_progress', 'completed', 'failed'));
  END IF;
END $$;

-- Speeds up the RECLAIM lookup (`WHERE organization_id = ? AND
-- idempotency_key = ? AND status = ? AND created_at < ?`) — the existing
-- `idx_fsui_org_key` unique index already covers the equality lookup; this
-- adds `status` for the branch that filters on it directly.
CREATE INDEX IF NOT EXISTS idx_fsui_org_key_status
  ON financial_statement_upload_idempotency (organization_id, idempotency_key, status);

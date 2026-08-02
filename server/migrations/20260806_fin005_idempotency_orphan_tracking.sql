-- 20260806: FIN-005 statement upload idempotency — orphan-tracking on reclaim
-- Additive only.
--
-- ROOT CAUSE this fixes (confirmed live): `reserveIdempotentUpload`'s reclaim
-- branch (`UPDATE ... WHERE status='failed' OR (status='in_progress' AND
-- created_at < cutoff) RETURNING *`) resets `statement_id = NULL`
-- unconditionally when reclaiming a row for a new attempt. But
-- `failIdempotentUpload` never recorded the `statementId` that an ABANDONED
-- attempt had actually persisted via `performUpload()` (business writes
-- commit independently, via the global connection pool — see
-- `withStatementUploadIdempotencyLock`'s doc comment). Forcing
-- `finalizeIdempotentUpload` to fail twice in a row for the same key (the
-- `chk_test_force_finalize_failure` fault-injection technique already used by
-- the round-3 acceptance tests) creates 3 real, fully independent
-- `financial_statements` / `financial_statement_packs` rows, but only the
-- 3rd is ever referenced by the marker row — the first two are permanently
-- invisible orphans: no marker, no lineage, unrepairable.
--
-- FIX: `orphaned_statement_ids` accumulates every Statement id a reclaim ever
-- displaced from `statement_id`, so nothing is silently lost even though the
-- marker row can only ever point at ONE (the winning) Statement at a time.
-- See `reserveIdempotentUpload`'s reclaim UPDATE for the atomic
-- append-then-null that populates this column, and `failIdempotentUpload`'s
-- new `statementId` parameter for how a failed attempt's Statement id gets
-- onto the row in the first place (reusing the `statement_id` column with a
-- 'failed'-row-scoped meaning — see that function's doc comment for why this
-- is safe).

ALTER TABLE financial_statement_upload_idempotency
  ADD COLUMN IF NOT EXISTS orphaned_statement_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

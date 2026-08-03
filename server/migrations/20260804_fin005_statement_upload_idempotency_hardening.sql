-- 20260804: FIN-005 statement upload idempotency hardening (Codex review
-- Blockers 2 + 3). Additive only.
--
-- Blocker 3 (content binding): the Idempotency-Key header alone used to be
-- the whole dedupe key — nothing tied it to WHAT was actually uploaded, so a
-- reused key with a DIFFERENT file would silently replay the first upload's
-- result. `request_hash` stores a SHA-256 of the uploaded file's bytes (the
-- only client-supplied upload parameter this route has — see
-- finance-statements.routes.ts's upload handler, which reads no other
-- client-supplied field). A replay is only served when the key AND the hash
-- both match; a key match with a hash mismatch is now a hard 409
-- IDEMPOTENCY_KEY_REUSED. Only the hash is stored, never the file bytes.
--
-- Blocker 2 (real serialization) needs no schema change — it is enforced by
-- `pg_advisory_xact_lock` in the route/service layer (see
-- withStatementUploadIdempotencyLock in finance-statements.routes.ts, the
-- same pattern already accepted for FIN-03/04's
-- withFinancialModelIdempotencyLock in financialModelingService.ts).

ALTER TABLE financial_statement_upload_idempotency
  ADD COLUMN IF NOT EXISTS request_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_fsui_org_key_hash
  ON financial_statement_upload_idempotency (organization_id, idempotency_key, request_hash);

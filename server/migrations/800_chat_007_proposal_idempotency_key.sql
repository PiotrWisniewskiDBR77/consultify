-- CHAT-07 fix (Codex delta review, area 2): create-time idempotency for
-- Chat/Canvas -> owner proposal creation.
--
-- Additive only: nullable column, no existing row/column touched. Existing
-- callers that never send a key are unaffected (the partial unique index
-- below only applies WHERE client_idempotency_key IS NOT NULL, so NULLs
-- never collide with each other under Postgres unique-index semantics).
--
-- The unique index (not a prior SELECT) is what actually makes two
-- concurrent identical create-proposal calls safe: `INSERT ... ON CONFLICT
-- (organization_id, draft_id, client_idempotency_key) DO NOTHING RETURNING
-- *` lets exactly one of two racing inserts win; the loser re-SELECTs the
-- winner's row instead of racing a separate check-then-insert.
ALTER TABLE work_canvas_proposals
  ADD COLUMN IF NOT EXISTS client_idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_canvas_proposals_idem
  ON work_canvas_proposals (organization_id, draft_id, client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;

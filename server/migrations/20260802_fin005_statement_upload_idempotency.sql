-- 20260802: FIN-005 statement upload idempotency
-- Additive only. Lets POST /api/finance-statements/upload dedupe a client
-- retry (same org + Idempotency-Key header) instead of creating a second
-- financial_statements row (and, via syncStatementToPack's findExistingPack
-- exclusion rule, a second financial_statement_packs row) for the same file.
-- No FK to financial_statements — a failed/rolled-back upload must never be
-- blocked by this table, so it is intentionally soft-linked by id only.

CREATE TABLE IF NOT EXISTS financial_statement_upload_idempotency (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  statement_id TEXT,
  status_code INTEGER NOT NULL DEFAULT 201,
  response_json TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fsui_org_key
  ON financial_statement_upload_idempotency (organization_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_fsui_statement
  ON financial_statement_upload_idempotency (statement_id);

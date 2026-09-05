-- Day 314 — GET /api/billing/webhook-events and /webhook-events/stats returned 500
-- ("column \"organization_id\" does not exist") for every logged-in user on any
-- database built from migrations.
--
-- Cause: the table was created by 150_billing_phase2.sql (and re-created verbatim
-- by 20261120_fresh_db_schema_gap_closure.sql) WITHOUT the tenant column, while
-- BillingWebhookService has always inserted and filtered on
-- organization_id / attempt_count / updated_at. The read path could therefore
-- never work, and the write path could never persist tenancy.
--
-- Additive only: no data is moved, no column is dropped, safe to re-run.
ALTER TABLE IF EXISTS billing_webhook_events
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

ALTER TABLE IF EXISTS billing_webhook_events
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0;

ALTER TABLE IF EXISTS billing_webhook_events
  ADD COLUMN IF NOT EXISTS updated_at TEXT;

ALTER TABLE IF EXISTS billing_webhook_events
  ADD COLUMN IF NOT EXISTS last_attempt_at TEXT;

-- Tenant-scoped read path (WHERE organization_id = ? ORDER BY created_at DESC).
CREATE INDEX IF NOT EXISTS idx_billing_webhooks_org_created
  ON billing_webhook_events(organization_id, created_at DESC);

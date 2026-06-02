-- 707_webhook_buffer.sql
-- Webhook payload buffer for push-based connectors

CREATE TABLE IF NOT EXISTS tp_webhook_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES tp_connectors(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_buffer_connector
  ON tp_webhook_buffer(connector_id, processed_at);

CREATE INDEX IF NOT EXISTS idx_webhook_buffer_unprocessed
  ON tp_webhook_buffer(connector_id)
  WHERE processed_at IS NULL;

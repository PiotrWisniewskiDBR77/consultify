-- 709_outbound_webhooks.sql
-- Outbound webhooks (Airtable-style): subscribe to base mutations, receive pings, list payloads with cursor

CREATE TABLE IF NOT EXISTS tp_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES tp_bases(id) ON DELETE CASCADE,
  notification_url TEXT NOT NULL,
  specification JSONB NOT NULL DEFAULT '{"options": {"filters": {}}}',
  cursor_number INTEGER NOT NULL DEFAULT 0,
  hmac_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_webhooks_base ON tp_webhooks(base_id, is_active);

CREATE TABLE IF NOT EXISTS tp_webhook_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES tp_webhooks(id) ON DELETE CASCADE,
  cursor_number INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  base_transaction_number BIGINT NOT NULL DEFAULT 0,
  action_metadata JSONB NOT NULL,
  payload_format TEXT NOT NULL DEFAULT 'v2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_webhook_payloads_cursor ON tp_webhook_payloads(webhook_id, cursor_number);

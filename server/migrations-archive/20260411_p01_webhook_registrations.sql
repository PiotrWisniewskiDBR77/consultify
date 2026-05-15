-- P01 Integration: Webhook registration & delivery tracking
-- Supports Generic Webhooks adapter (§2.3.1 P0)

CREATE TABLE IF NOT EXISTS v8_webhook_registrations (
  registration_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  integration_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound'
    CHECK (direction IN ('inbound', 'outbound')),
  secret_key TEXT,
  event_types TEXT NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_delivery_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v8_webhook_deliveries (
  delivery_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  registration_id TEXT NOT NULL REFERENCES v8_webhook_registrations(registration_id),
  organization_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
  http_status INTEGER,
  response_body TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_v8_webhook_reg_org
  ON v8_webhook_registrations (organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_webhook_reg_integration
  ON v8_webhook_registrations (integration_id);
CREATE INDEX IF NOT EXISTS idx_v8_webhook_del_reg
  ON v8_webhook_deliveries (registration_id);
CREATE INDEX IF NOT EXISTS idx_v8_webhook_del_status
  ON v8_webhook_deliveries (status) WHERE status != 'delivered';

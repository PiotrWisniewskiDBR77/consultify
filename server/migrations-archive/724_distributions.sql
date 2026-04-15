CREATE TABLE IF NOT EXISTS tp_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_id UUID NOT NULL REFERENCES tp_bases(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('view', 'table', 'chart', 'interface')),
  source_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'slack', 'teams', 'webhook')),
  channel_config JSONB NOT NULL DEFAULT '{}',
  schedule TEXT,
  format TEXT DEFAULT 'xlsx' CHECK (format IN ('csv', 'xlsx', 'pdf', 'png', 'json')),
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  send_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tp_distributions_base ON tp_distributions(base_id);
CREATE INDEX IF NOT EXISTS idx_tp_distributions_active ON tp_distributions(is_active) WHERE is_active = true;

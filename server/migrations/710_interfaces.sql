CREATE TABLE IF NOT EXISTS tp_interfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES tp_bases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  layout JSONB NOT NULL DEFAULT '{"blocks": []}',
  published BOOLEAN NOT NULL DEFAULT false,
  share_token TEXT UNIQUE,
  allowed_roles TEXT[] DEFAULT ARRAY['editor', 'viewer'],
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tp_interfaces_base ON tp_interfaces(base_id);
CREATE INDEX idx_tp_interfaces_share ON tp_interfaces(share_token) WHERE share_token IS NOT NULL;

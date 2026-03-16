CREATE TABLE IF NOT EXISTS tp_base_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  thumbnail_url TEXT,
  schema_snapshot JSONB NOT NULL,
  is_featured BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tp_templates_category ON tp_base_templates(category);
CREATE INDEX idx_tp_templates_featured ON tp_base_templates(is_featured) WHERE is_featured = true;

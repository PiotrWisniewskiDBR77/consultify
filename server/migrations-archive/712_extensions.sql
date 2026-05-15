-- Extensions system for Table Platform
-- Provides an iframe-based extension marketplace with scoped permissions

CREATE TABLE IF NOT EXISTS tp_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  author TEXT,
  icon_url TEXT,
  source_url TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['records:read'],
  status TEXT NOT NULL DEFAULT 'draft',
  category TEXT DEFAULT 'utility',
  install_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tp_extension_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_id UUID NOT NULL REFERENCES tp_extensions(id) ON DELETE CASCADE,
  base_id UUID NOT NULL REFERENCES tp_bases(id) ON DELETE CASCADE,
  installed_by UUID,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(extension_id, base_id)
);

CREATE INDEX IF NOT EXISTS idx_tp_extension_installs_base ON tp_extension_installs(base_id);
CREATE INDEX IF NOT EXISTS idx_tp_extensions_status_category ON tp_extensions(status, category);

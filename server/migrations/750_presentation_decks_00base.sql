-- Strict runtime-order producer for the presentation deck aggregate.
-- Historical producers use excluded 5xx or later dated prefixes, while the
-- 751 contract migration consumes the table first on an empty database.
CREATE TABLE IF NOT EXISTS presentation_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  deck_type TEXT NOT NULL,
  audience TEXT DEFAULT 'executive',
  goal TEXT DEFAULT 'inform',
  language_default TEXT DEFAULT 'en',
  confidentiality_default TEXT DEFAULT 'internal',
  theme TEXT DEFAULT 'corporate' CHECK (theme IN ('corporate', 'minimal', 'modern')),
  outline_json TEXT NOT NULL,
  max_slides INTEGER DEFAULT 25,
  min_slides INTEGER DEFAULT 5,
  must_have_intents TEXT,
  recommended_visuals TEXT,
  is_system BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  cloned_from TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pt_org ON presentation_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_pt_type ON presentation_templates(deck_type);
CREATE INDEX IF NOT EXISTS idx_pt_system ON presentation_templates(is_system);

CREATE TABLE IF NOT EXISTS presentation_decks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  template_id TEXT,
  deck_type TEXT,
  audience TEXT,
  goal TEXT,
  language TEXT DEFAULT 'en',
  confidentiality TEXT DEFAULT 'internal',
  theme TEXT DEFAULT 'corporate',
  brand_kit_id TEXT,
  source_artifacts TEXT,
  outline_json TEXT,
  unified_json TEXT,
  slide_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready', 'exported', 'failed')),
  export_path TEXT,
  export_format TEXT,
  exported_at TIMESTAMP,
  share_token TEXT,
  share_expires_at TIMESTAMP,
  validation_warnings TEXT,
  generated_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pd_org ON presentation_decks(organization_id);
CREATE INDEX IF NOT EXISTS idx_pd_project ON presentation_decks(project_id);
CREATE INDEX IF NOT EXISTS idx_pd_template ON presentation_decks(template_id);
CREATE INDEX IF NOT EXISTS idx_pd_status ON presentation_decks(status);
CREATE INDEX IF NOT EXISTS idx_pd_share ON presentation_decks(share_token);

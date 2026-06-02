-- Add deck_json column to presentation_decks for DeckBuilder autosave, HTML export, quality gates
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

ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS deck_json TEXT;
ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS presentation_mode TEXT DEFAULT 'briefing';

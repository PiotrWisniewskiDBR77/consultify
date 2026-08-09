-- Artifact Studio runtime compatibility.
--
-- These tables were present in the historical baseline, but were not part of
-- the active migration stream used by fresh PostgreSQL environments. Keep the
-- migration additive and compatible with canonical and legacy audit columns.

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_id TEXT,
  actor_user_id TEXT,
  actor_type TEXT NOT NULL DEFAULT 'USER',
  org_id TEXT,
  action TEXT,
  action_type TEXT,
  resource_type TEXT,
  resource_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip TEXT,
  user_agent TEXT
);

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS ts TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_type TEXT DEFAULT 'USER';
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS org_id TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS resource_id TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS before_json TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS after_json TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS metadata_json TEXT DEFAULT '{}';
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_events_org ON audit_events(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts ON audit_events(ts);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource
  ON audit_events(resource_type, resource_id);

CREATE TABLE IF NOT EXISTS presentation_cards (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL,
  card_index INTEGER NOT NULL,
  intent TEXT NOT NULL DEFAULT 'content',
  blocks_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(deck_id, card_index)
);

CREATE INDEX IF NOT EXISTS idx_presentation_cards_deck
  ON presentation_cards(deck_id, card_index);

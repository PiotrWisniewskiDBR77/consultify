-- Migration 610: Organization Style Profiles (Learning System)
-- Tracks presentation preferences per organization, auto-improves defaults over time.

CREATE TABLE IF NOT EXISTS organization_style_profiles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL,
  
  -- Aggregated preferences (updated after each deck interaction)
  preferred_mode TEXT DEFAULT 'show',               -- most frequently used PresentationMode
  preferred_register TEXT DEFAULT 'professional',   -- most used CommunicationRegister
  preferred_image_style TEXT DEFAULT 'corporate_photography',
  preferred_color_set TEXT DEFAULT 'midnight_navy',
  preferred_content_depth TEXT DEFAULT 'balanced',
  
  -- Layout preferences (JSON array of {layout_id, use_count})
  layout_usage_stats TEXT DEFAULT '[]',
  
  -- Intent preferences (JSON: which intents users add/remove most)
  intent_adjustment_stats TEXT DEFAULT '{}',
  
  -- Block preferences (which block types are most edited/deleted/added)
  block_interaction_stats TEXT DEFAULT '{}',
  
  -- Average deck metrics
  avg_cards_per_deck REAL DEFAULT 0,
  avg_blocks_per_card REAL DEFAULT 0,
  
  -- Tracking
  total_decks_generated INTEGER DEFAULT 0,
  total_user_edits INTEGER DEFAULT 0,
  
  -- Font and brand override defaults
  default_heading_font TEXT,
  default_body_font TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_style_profiles_org 
  ON organization_style_profiles(organization_id);

-- Deck interaction log for the learning system
CREATE TABLE IF NOT EXISTS deck_interaction_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  interaction_type TEXT NOT NULL,  -- 'card_added', 'card_removed', 'block_edited', 'layout_changed', 'intent_changed', 'setting_changed'
  entity_type TEXT,                -- 'card', 'block', 'setting'
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deck_interactions_org 
  ON deck_interaction_log(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_deck_interactions_deck 
  ON deck_interaction_log(deck_id);

-- Context pack snapshots
CREATE TABLE IF NOT EXISTS context_pack_snapshots (
  deck_id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  pack_data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

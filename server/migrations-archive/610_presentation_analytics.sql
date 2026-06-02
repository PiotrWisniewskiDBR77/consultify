-- Migration 610: Presentation share analytics
-- G3: Track page views, per-card engagement, viewer stats

CREATE TABLE IF NOT EXISTS presentation_analytics (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL,
  viewer_token TEXT NOT NULL DEFAULT 'anonymous',
  event_type TEXT NOT NULL DEFAULT 'page_view',
  card_index INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pa_deck ON presentation_analytics(deck_id);
CREATE INDEX IF NOT EXISTS idx_pa_viewer ON presentation_analytics(viewer_token);
CREATE INDEX IF NOT EXISTS idx_pa_created ON presentation_analytics(created_at);

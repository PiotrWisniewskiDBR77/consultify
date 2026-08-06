-- P20 Contract Compliance: optimistic concurrency (§2.3 version field, §2.11 conflict 409)
-- and server-side version history (§2.6 continuation depth)

ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Server-side version history for revert capability (P20 §2.6)
CREATE TABLE IF NOT EXISTS presentation_deck_versions (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  deck_json_snapshot TEXT NOT NULL,
  slide_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deck_id) REFERENCES presentation_decks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pdv_deck_version ON presentation_deck_versions(deck_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_pdv_deck_created ON presentation_deck_versions(deck_id, created_at DESC);

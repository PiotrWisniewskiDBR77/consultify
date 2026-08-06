-- Sprint 2 (J2): presentation runtime telemetry events

CREATE TABLE IF NOT EXISTS presentation_runtime_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  deck_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  status TEXT,
  scope TEXT,
  metadata_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_presentation_runtime_events_org_time
  ON presentation_runtime_events (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_presentation_runtime_events_deck
  ON presentation_runtime_events (deck_id, created_at DESC);

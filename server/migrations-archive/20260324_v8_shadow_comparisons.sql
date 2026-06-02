-- V8 Shadow Mode — comparison results storage
-- CP-08: Shadow Mode Infrastructure

CREATE TABLE IF NOT EXISTS v8_shadow_comparisons (
  comparison_id           TEXT PRIMARY KEY,
  organization_id         TEXT NOT NULL,
  endpoint                TEXT NOT NULL,
  method                  TEXT NOT NULL,
  legacy_status_code      INTEGER NOT NULL,
  v8_status_code          INTEGER NOT NULL,
  legacy_response_time_ms INTEGER NOT NULL,
  v8_response_time_ms     INTEGER NOT NULL,
  responses_match         INTEGER NOT NULL DEFAULT 0,
  diff_summary            TEXT,
  legacy_response_body    TEXT,
  v8_response_body        TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_shadow_org ON v8_shadow_comparisons(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_shadow_org_time ON v8_shadow_comparisons(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_v8_shadow_mismatches ON v8_shadow_comparisons(organization_id, responses_match) WHERE responses_match = 0;

-- Sprint 9: per-org saved filter presets for the Governance Watchlist UI.
--
-- Storage-only: the watchlist GET endpoint never auto-applies a preset; the
-- client decides which preset is active. We keep the schema minimal but
-- forward-compatible (filters_json carries onlyBlocked / limit today plus
-- minSeverity and confidentiality dimensions for future UI surfaces).

CREATE TABLE IF NOT EXISTS presentation_watchlist_presets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  filters_json TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pres_watchlist_presets_org
  ON presentation_watchlist_presets(organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pres_watchlist_presets_org_name
  ON presentation_watchlist_presets(organization_id, name);

-- At most one default preset per org. Partial unique index so non-default
-- rows are not constrained.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pres_watchlist_presets_default
  ON presentation_watchlist_presets(organization_id) WHERE is_default = TRUE;

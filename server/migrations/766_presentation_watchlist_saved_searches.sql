-- Sprint 12: per-org saved free-text searches for the Governance Watchlist UI.
--
-- Analog to Sprint 10 presets (`presentation_watchlist_presets`) but tuned for
-- ad-hoc deck-title queries combined with verdict / confidentiality filters.
-- Storage-only: the watchlist GET endpoint never auto-applies a saved search;
-- the client decides which one is active. We keep the schema minimal and
-- forward-compatible (filters JSONB carries verdicts[], confidentiality[],
-- minSeverityScore, limit) so future filter dimensions can be added without
-- another migration.

CREATE TABLE IF NOT EXISTS presentation_watchlist_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  query_text TEXT NOT NULL DEFAULT '',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_saved_searches_org
  ON presentation_watchlist_saved_searches(organization_id);

-- Partial unique index so non-default rows are not constrained — at most one
-- default saved search per org.
CREATE INDEX IF NOT EXISTS idx_watchlist_saved_searches_default
  ON presentation_watchlist_saved_searches(organization_id, is_default)
  WHERE is_default = true;

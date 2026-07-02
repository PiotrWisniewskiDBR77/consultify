-- M14/F6 (6.6): Champions / change-agent network (Kotter "guiding coalition").
-- Per-initiative network of change agents that drive adoption.
-- Org-scoped. Coalition coverage informs governance (no-champion = gap).

CREATE TABLE IF NOT EXISTS change_champions (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id   TEXT,
  user_id         TEXT,
  role            TEXT NOT NULL DEFAULT 'champion',
  influence       TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_change_champions_org
  ON change_champions(organization_id);

CREATE INDEX IF NOT EXISTS idx_change_champions_initiative
  ON change_champions(initiative_id);

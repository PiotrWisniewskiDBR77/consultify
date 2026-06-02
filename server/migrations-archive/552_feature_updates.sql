-- Bundle 21 (T069) — Feature updates (What's new) feed + seen tracking

CREATE TABLE IF NOT EXISTS feature_updates (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  tags TEXT DEFAULT '[]', -- JSON array of strings (modules)
  importance TEXT DEFAULT 'normal', -- low|normal|high
  status TEXT DEFAULT 'draft', -- draft|published|archived
  action_payload TEXT DEFAULT '{}', -- JSON (e.g. {kind:'view', view:'PORTFOLIO_ROADMAP', label:'Try it now'})
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_feature_updates_org_status_published
  ON feature_updates(organization_id, status, published_at);

CREATE TABLE IF NOT EXISTS feature_update_reads (
  id TEXT PRIMARY KEY,
  update_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(update_id, user_id),
  FOREIGN KEY (update_id) REFERENCES feature_updates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feature_update_reads_user
  ON feature_update_reads(user_id, read_at);

CREATE TABLE IF NOT EXISTS feature_update_events (
  id TEXT PRIMARY KEY,
  update_id TEXT NOT NULL,
  user_id TEXT,
  organization_id TEXT,
  event_type TEXT NOT NULL, -- update_published|update_opened|update_clicked|marked_read
  event_data TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (update_id) REFERENCES feature_updates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feature_update_events_update
  ON feature_update_events(update_id, created_at);


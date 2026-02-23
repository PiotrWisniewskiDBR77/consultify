-- T011 (V2) — My Work — Notebook (backend persistence)

CREATE TABLE IF NOT EXISTS notebook_pages (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private', -- private | project
  title TEXT NOT NULL,
  content_json TEXT NOT NULL DEFAULT '{}',
  content_text TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notebook_pages_owner ON notebook_pages(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_pages_org ON notebook_pages(organization_id);
CREATE INDEX IF NOT EXISTS idx_notebook_pages_project ON notebook_pages(project_id);
CREATE INDEX IF NOT EXISTS idx_notebook_pages_updated_at ON notebook_pages(updated_at);
CREATE INDEX IF NOT EXISTS idx_notebook_pages_title ON notebook_pages(title);


-- T011+ Notebook upgrade: status workflow, pinning, conversion tracking

ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS converted_to_json TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_notebook_pages_status ON notebook_pages(status);
CREATE INDEX IF NOT EXISTS idx_notebook_pages_pinned ON notebook_pages(pinned);

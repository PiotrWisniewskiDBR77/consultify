-- T011+ Living Notebook — maturity lifecycle, auto-summary, page icon

ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS maturity TEXT NOT NULL DEFAULT 'seed';
ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT NULL;
ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_notebook_pages_maturity ON notebook_pages(maturity);

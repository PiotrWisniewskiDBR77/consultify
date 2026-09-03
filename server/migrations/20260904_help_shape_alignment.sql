-- Day 289: align the migrated help schema with the live route contract.
ALTER TABLE help_articles ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE help_articles ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE help_articles ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE help_articles
SET category_id = COALESCE(category_id, category),
    body = COALESCE(body, content),
    status = COALESCE(status, CASE WHEN is_published THEN 'published' ELSE 'draft' END);

ALTER TABLE help_articles ALTER COLUMN status SET DEFAULT 'published';

ALTER TABLE help_events ADD COLUMN IF NOT EXISTS article_id TEXT;
ALTER TABLE help_events ADD COLUMN IF NOT EXISTS metadata TEXT;

CREATE INDEX IF NOT EXISTS idx_help_articles_category_id ON help_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_help_articles_status ON help_articles(status);

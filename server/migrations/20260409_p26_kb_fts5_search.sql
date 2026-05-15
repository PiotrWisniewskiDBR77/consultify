-- 745: FTS5 full-text search index for KB articles
-- Enables fast, tolerant search with ranking (P26 §2.3.2)

-- Create FTS5 virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS kb_articles_fts USING fts5(
  article_id UNINDEXED,
  language UNINDEXED,
  title,
  summary,
  content,
  tokenize='porter unicode61 remove_diacritics 2'
);

-- Populate from existing translations
INSERT OR IGNORE INTO kb_articles_fts (article_id, language, title, summary, content)
SELECT t.article_id, t.language,
       COALESCE(t.title, ''),
       COALESCE(t.summary, ''),
       COALESCE(t.content, '')
FROM kb_article_translations t
JOIN kb_articles a ON t.article_id = a.id
WHERE a.status = 'published';

-- NOTE: FTS index should be refreshed when articles are created/updated/deleted.
-- For MVP, run a periodic reindex or rebuild on deploy.
-- Future: add triggers on kb_article_translations INSERT/UPDATE/DELETE.

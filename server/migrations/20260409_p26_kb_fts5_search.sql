-- P26: PostgreSQL full-text search index for published KB translations.
-- The expression matches the native runtime query and remains idempotent.

CREATE INDEX IF NOT EXISTS idx_kb_article_translations_fts
  ON kb_article_translations
  USING GIN (
    to_tsvector('simple',
      coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, ''))
  );

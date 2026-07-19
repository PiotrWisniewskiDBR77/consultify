-- RED-I W6: Knowledge Base full-text search on Postgres.
--
-- Problem: KnowledgeBaseService.searchArticlesFTS() probed the SQLite-only
-- `kb_articles_fts` virtual table via `SELECT name FROM sqlite_master ...`.
-- On Postgres adaptQuery rewrites sqlite_master -> information_schema.tables,
-- which has no `name` column -> silent 42703 -> FTS reported unavailable -> KB
-- search permanently degraded to LIKE (never full-text) on every PG deployment.
--
-- Fix (code): route search to native to_tsvector('simple', ...) /
-- plainto_tsquery('simple', ...) over kb_article_translations.
--
-- This migration (additive, idempotent) adds the GIN index backing that query.
-- The index expression MUST match the query expression in searchArticlesFTS
-- verbatim, otherwise the planner cannot use it.

CREATE INDEX IF NOT EXISTS idx_kb_article_translations_fts
  ON kb_article_translations
  USING GIN (
    to_tsvector('simple',
      coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, ''))
  );

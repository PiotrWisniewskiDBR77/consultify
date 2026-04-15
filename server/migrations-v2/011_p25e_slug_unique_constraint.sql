-- Ported from: 20260409_p25e_slug_unique_constraint.sql
-- P25-E: Add UNIQUE index on kb_articles.slug
-- Prevents duplicate slugs which would break deep-linking and AI citations.
-- SQLite does not support ADD CONSTRAINT, so we create a unique index instead.

CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_articles_slug_unique ON kb_articles (slug);

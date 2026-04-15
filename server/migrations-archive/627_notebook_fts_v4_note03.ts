/**
 * V4-NOTE-03: Full-text search
 * - Postgres: tsvector + GIN index
 * - SQLite: no-op (keeps LIKE-based search)
 */

import type { IDatabase } from '../src/database/IDatabase.js';

export async function up(db: IDatabase): Promise<void> {
  const isPg = process.env.DB_TYPE === 'postgres';
  if (!isPg) return;

  await db.run(`
    ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(content_text, '')), 'B')
    ) STORED
  `);
  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_notebook_pages_search ON notebook_pages USING GIN(search_vector)
  `);
}

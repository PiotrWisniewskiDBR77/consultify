/**
 * M04 Living Notebook — Agent 5: version history (snapshot / diff / restore).
 *
 * Creates `notebook_page_versions`: an append-only snapshot table. Each row is
 * an immutable copy of a notebook page's content at save time. Restore writes a
 * page back from a chosen version (handled in the route, not here).
 *
 * Idempotent: safe to re-run. Works on Postgres and SQLite.
 */

import type { IDatabase } from '../src/database/IDatabase.js';

export async function up(db: IDatabase): Promise<void> {
  const isPg = process.env.DB_TYPE === 'postgres';
  const timestampType = isPg ? 'TIMESTAMPTZ' : 'TIMESTAMP';

  await db.run(`
    CREATE TABLE IF NOT EXISTS notebook_page_versions (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      organization_id TEXT,
      title TEXT,
      content_json TEXT NOT NULL DEFAULT '{}',
      content_text TEXT,
      created_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    )
  `);

  // Hot path: "list versions of a page, newest first".
  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_notebook_page_versions_page
      ON notebook_page_versions(page_id, created_at)
  `);
  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_notebook_page_versions_org
      ON notebook_page_versions(organization_id)
  `);
}

export async function down(db: IDatabase): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS notebook_page_versions`);
}

export default { up, down };

/**
 * M04 Living Notebook — Cover image on a notebook page (Agent 4 / Editor PRO).
 *
 * Adds a single nullable column `cover_url` to `notebook_pages`. The column
 * stores either a remote URL or a data: URL produced by the inline cover
 * picker (NoteCoverPicker.tsx). Empty/NULL = no cover (bare header, as today).
 *
 * Idempotent: guarded with `ADD COLUMN IF NOT EXISTS` where the dialect
 * supports it, and a defensive catch for engines that throw on a duplicate
 * column instead of being a no-op (older SQLite). Safe to re-run.
 *
 * Applied by the CTO/orchestrator alongside the other `.ts` migrations
 * (same `export async function up(db)` contract as 627_notebook_fts_v4_note03.ts
 * and 20260620_1000_notebook_topics.ts).
 */

import type { IDatabase } from '../src/database/IDatabase.js';

export async function up(db: IDatabase): Promise<void> {
  try {
    // Postgres + modern SQLite both accept IF NOT EXISTS here.
    await db.run(`ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS cover_url TEXT`);
  } catch (err) {
    // Older SQLite builds do not support IF NOT EXISTS on ADD COLUMN and will
    // throw `duplicate column name` if the column already exists. Treat the
    // duplicate-column case as success; re-raise anything else.
    const msg = String((err as Error)?.message || err).toLowerCase();
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      return;
    }
    try {
      // Last-resort attempt without the guard (fresh table that lacked the column).
      await db.run(`ALTER TABLE notebook_pages ADD COLUMN cover_url TEXT`);
    } catch (err2) {
      const msg2 = String((err2 as Error)?.message || err2).toLowerCase();
      if (msg2.includes('duplicate column') || msg2.includes('already exists')) {
        return;
      }
      throw err2;
    }
  }
}

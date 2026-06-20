/**
 * M04 Living Notebook — FTS REPAIR (idempotent guard for `notebook_pages.search_vector`).
 *
 * WHY: On staging `GET /api/notebook/search` and `POST /api/notebook/rag-context`
 * returned 500 `column np.search_vector does not exist`. Root cause: the FTS column
 * was only ever added by `627_notebook_fts_v4_note03.ts`, a `.ts` migration that the
 * SQL-only Table-Platform runner (DatabaseInitializer, regex `^(7\d{2}|\d{8})_.*\.sql$`)
 * never executes — so the column was never provisioned outside dev seeds.
 *
 * WHAT: This is a *repair guard*, NOT a duplicate of 627. It:
 *   1. Ensures the `search_vector tsvector` column exists (ADD COLUMN IF NOT EXISTS).
 *   2. Ensures the GIN index exists.
 *   3. Backfills the vector for existing rows (and installs a trigger to keep it
 *      fresh) — but ONLY when the column is a plain column. If 627 already created
 *      it as a GENERATED ALWAYS column, Postgres maintains it automatically and the
 *      manual UPDATE/trigger are skipped (a generated column rejects direct writes).
 *
 * Idempotent + cross-restart safe. Postgres-only (SQLite keeps LIKE-based search and
 * the route layer degrades gracefully — see notebook.routes.ts `hasColumn` guards).
 *
 * APPLICATION NOTE (flag for CTO): like 627 and 20260620_1000, this is a `.ts`
 * migration and is **NOT** picked up by the automatic SQL migration runner. It must
 * be applied manually / by the orchestrator (`up(db)`), or renamed to a `.sql` sibling
 * matching `\d{8}_...\.sql`. Until applied, the route layer no longer 500s — it
 * degrades (degraded:true) — but real FTS results require this column to exist.
 */

import type { IDatabase } from '../src/database/IDatabase.js';

export async function up(db: IDatabase): Promise<void> {
  const isPg = process.env.DB_TYPE === 'postgres';
  // SQLite path uses LIKE-based search (no tsvector); nothing to provision.
  if (!isPg) return;

  // 1) Column guard. Plain (non-generated) tsvector so we can both backfill it AND
  //    co-exist with 627 (which may have already made it GENERATED — see step 3).
  await db.run(`
    ALTER TABLE notebook_pages
      ADD COLUMN IF NOT EXISTS search_vector tsvector
  `);

  // 2) GIN index guard (matches 627's index name so the two never collide).
  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_notebook_pages_search
      ON notebook_pages USING GIN(search_vector)
  `);

  // 3) Detect whether the column is GENERATED (created by 627). Generated columns are
  //    maintained by Postgres and REJECT direct UPDATEs, so we must NOT backfill or
  //    attach a trigger in that case — doing so would throw 42P10 / "cannot insert".
  let isGenerated = false;
  try {
    const row = await db.get<{ is_generated?: string; gen?: string }>(
      `SELECT is_generated AS gen
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notebook_pages'
          AND column_name = 'search_vector'
        LIMIT 1`
    );
    const flag = String((row as any)?.gen ?? '').toUpperCase();
    isGenerated = flag === 'ALWAYS';
  } catch {
    // information_schema unavailable → assume plain column (safe: backfill is idempotent).
    isGenerated = false;
  }

  if (isGenerated) {
    // 627 owns it as GENERATED ALWAYS — Postgres keeps it in sync. Nothing else to do.
    return;
  }

  // 4) Plain column: install a trigger so the vector stays fresh on write, then backfill.
  //    `simple` config matches the search/RAG query side (plainto_tsquery('simple', …)).
  await db.run(`
    CREATE OR REPLACE FUNCTION notebook_pages_search_vector_update()
    RETURNS trigger AS $$
    BEGIN
      NEW.search_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.content_text, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.tags_json, '')), 'C');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  await db.run(`DROP TRIGGER IF EXISTS trg_notebook_pages_search_vector ON notebook_pages`);
  await db.run(`
    CREATE TRIGGER trg_notebook_pages_search_vector
      BEFORE INSERT OR UPDATE OF title, content_text, tags_json
      ON notebook_pages
      FOR EACH ROW
      EXECUTE FUNCTION notebook_pages_search_vector_update()
  `);

  // 5) Backfill existing rows whose vector is still NULL (idempotent — only touches gaps).
  await db.run(`
    UPDATE notebook_pages
       SET search_vector =
             setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
             setweight(to_tsvector('simple', coalesce(content_text, '')), 'B') ||
             setweight(to_tsvector('simple', coalesce(tags_json, '')), 'C')
     WHERE search_vector IS NULL
  `);
}

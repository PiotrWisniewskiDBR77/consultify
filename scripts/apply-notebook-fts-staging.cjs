/**
 * Apply the notebook FTS repair (search_vector) to STAGING only.
 *
 * Mirrors server/migrations/20260620_2000_notebook_fts_repair.ts (a .ts migration
 * the SQL-only runner never executes). Idempotent; safe to re-run.
 *
 * HARD SAFETY: aborts unless DATABASE_URL host is the staging proxy (trolley).
 * Never runs against prod (centerbeam).
 *
 * Usage: node scripts/apply-notebook-fts-staging.cjs
 */
require('dotenv').config({ path: '.env.staging.local' });
const { Client } = require('pg');

const url = process.env.DATABASE_URL || '';
const host = (url.match(/@([^:/]+)/) || [])[1] || '(unknown)';

// --- HARD GUARD: staging only ---
if (host.includes('centerbeam') || !host.includes('trolley')) {
  console.error(`ABORT: refusing to run — DATABASE_URL host is [${host}], expected staging (trolley).`);
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  console.log(`Connected to staging host [${host}].`);

  const step = async (label, sql) => {
    await client.query(sql);
    console.log(`✓ ${label}`);
  };

  // 1) column guard (plain tsvector — coexists with a GENERATED column from 627)
  await step('ADD COLUMN search_vector', `
    ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS search_vector tsvector
  `);

  // 2) GIN index guard
  await step('CREATE GIN index', `
    CREATE INDEX IF NOT EXISTS idx_notebook_pages_search
      ON notebook_pages USING GIN(search_vector)
  `);

  // 3) detect GENERATED (627) — generated columns reject direct writes
  const gen = await client.query(`
    SELECT is_generated AS gen FROM information_schema.columns
     WHERE table_schema='public' AND table_name='notebook_pages' AND column_name='search_vector' LIMIT 1
  `);
  const isGenerated = String(gen.rows[0]?.gen || '').toUpperCase() === 'ALWAYS';
  console.log(`  search_vector is_generated=${gen.rows[0]?.gen || '(none)'} → ${isGenerated ? 'GENERATED (managed by PG)' : 'plain column'}`);

  if (!isGenerated) {
    // 4) trigger keeps the vector fresh on write
    await step('CREATE FUNCTION search_vector_update', `
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
    await step('DROP+CREATE trigger', `
      DROP TRIGGER IF EXISTS trg_notebook_pages_search_vector ON notebook_pages;
      CREATE TRIGGER trg_notebook_pages_search_vector
        BEFORE INSERT OR UPDATE OF title, content_text, tags_json
        ON notebook_pages FOR EACH ROW
        EXECUTE FUNCTION notebook_pages_search_vector_update()
    `);
    // 5) backfill NULL rows (idempotent)
    const res = await client.query(`
      UPDATE notebook_pages
         SET search_vector =
               setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
               setweight(to_tsvector('simple', coalesce(content_text, '')), 'B') ||
               setweight(to_tsvector('simple', coalesce(tags_json, '')), 'C')
       WHERE search_vector IS NULL
    `);
    console.log(`✓ backfilled ${res.rowCount} rows`);
  }

  // verify
  const check = await client.query(`
    SELECT count(*)::int AS total, count(search_vector)::int AS with_vec FROM notebook_pages
  `);
  console.log(`VERIFY: notebook_pages total=${check.rows[0].total}, with search_vector=${check.rows[0].with_vec}`);

  await client.end();
  console.log('DONE — FTS repair applied to staging.');
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});

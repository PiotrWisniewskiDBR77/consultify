#!/usr/bin/env node
/**
 * Apply Link Graph v3 (link_graph_edges) schema to the STAGING database (trolley).
 *
 * Why: dev backend runs with DB_MANAGED_SCHEMA=off, so schema is NOT auto-created.
 * Task↔Decision persistence (M03 "Moja Praca") relies on link_graph_edges. This
 * script applies server/migrations/20260303_link_graph_v3.sql idempotently
 * (CREATE TABLE/INDEX IF NOT EXISTS) and then verifies the result.
 *
 * Reads DATABASE_URL from .env.staging.local. NEVER touches prod (centerbeam/.env.local).
 *
 * Usage:
 *   node server/scripts/apply_link_graph_staging.cjs          # apply + verify
 *   node server/scripts/apply_link_graph_staging.cjs --verify # verify only
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvStaging() {
  const envPath = path.resolve(__dirname, '../../.env.staging.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  const line = raw.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL not found in .env.staging.local');
  let url = line.slice('DATABASE_URL='.length).trim();
  // Strip optional surrounding quotes
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1);
  }
  return url;
}

async function main() {
  const verifyOnly = process.argv.includes('--verify');
  const connectionString = loadEnvStaging();
  const host = (() => {
    try {
      return new URL(connectionString).host;
    } catch {
      return '(unparseable)';
    }
  })();

  // Hard guard: refuse to run against prod (centerbeam).
  if (host.includes('centerbeam')) {
    throw new Error(`Refusing to run against prod host: ${host}`);
  }
  console.log(`[link-graph] Target host: ${host} (staging)`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    if (!verifyOnly) {
      const sqlPath = path.resolve(__dirname, '../migrations/20260303_link_graph_v3.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(`[link-graph] Applying ${path.basename(sqlPath)} ...`);
      await client.query(sql);
      console.log('[link-graph] Applied (idempotent).');
    }

    const exists = await client.query(
      `SELECT to_regclass('public.link_graph_edges') AS tbl`
    );
    console.log('[link-graph] to_regclass:', exists.rows[0].tbl);

    const cols = await client.query(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_name = 'link_graph_edges'
        ORDER BY ordinal_position`
    );
    console.log('[link-graph] columns:');
    cols.rows.forEach((r) => console.log(`   - ${r.column_name} (${r.data_type})`));

    const idx = await client.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'link_graph_edges' ORDER BY indexname`
    );
    console.log('[link-graph] indexes:', idx.rows.map((r) => r.indexname).join(', '));

    const cnt = await client.query(`SELECT COUNT(*)::int AS n FROM link_graph_edges`);
    console.log('[link-graph] existing row count:', cnt.rows[0].n);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[link-graph] FAILED:', e.message);
  process.exit(1);
});

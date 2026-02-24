#!/usr/bin/env tsx
/**
 * Find a user in DB by email/name fragment.
 *
 * Usage:
 *   ENV_FILE=.env.staging.local DOTENV_OVERRIDE=1 DB_MANAGED_SCHEMA=off \
 *   npx tsx server/scripts/find-user-in-staging.ts "piotr"
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

type Row = Record<string, any>;

function loadEnv() {
  const extra = String(process.env.ENV_FILE || '').trim();
  if (extra) {
    const p = path.resolve(process.cwd(), extra);
    if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
  }
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });
}

async function main() {
  const q = (process.argv[2] || '').trim();
  if (!q) {
    console.error('Provide a search fragment, e.g. "piotr" or "dbr77.com".');
    process.exit(2);
  }

  loadEnv();
  process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA || 'off';

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  const like = `%${q.toLowerCase()}%`;
  const rows = (await db.all(
    `SELECT u.id, u.email, u.role, u.organization_id, u.first_name, u.last_name, o.name AS org_name
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     WHERE lower(u.email) LIKE ?
        OR lower(COALESCE(u.first_name,'')) LIKE ?
        OR lower(COALESCE(u.last_name,'')) LIKE ?
     ORDER BY u.created_at DESC
     LIMIT 50`,
    [like, like, like]
  )) as Row[];

  console.log(`Matches for "${q}" (limit 50):`);
  for (const r of rows) {
    console.log(
      `- ${r.id} | ${r.role} | ${r.email} | org=${r.organization_id} (${r.org_name || '-'}) | ${r.first_name || ''} ${r.last_name || ''}`.trim()
    );
  }
  if (!rows.length) console.log('(no matches)');
}

main().catch((e) => {
  console.error('❌ find-user failed:', e?.message || e);
  process.exit(1);
});


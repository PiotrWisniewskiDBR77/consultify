/**
 * Consultify Acceptance Harness — FULL local schema loader.
 *
 * The app's own migration autorun (server/src/services/tablePlatform/migrationRunner.ts)
 * only applies files matching /^(7\d{2}|\d{8})_/ — so 000-6xx and 9xx migrations never
 * run automatically and the schema is INCOMPLETE. This loader applies EVERY
 * server/migrations/*.sql (plus init-pgvector.sql) in numeric/lexical order,
 * idempotently, catching per-file errors. Two passes so ordering-dependent files
 * (ALTER before CREATE) still land on the retry.
 *
 * Writes ONLY to the LOCAL Postgres given by DATABASE_URL. Never demo/prod.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'server/migrations');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || !/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
  console.error(
    `[schema] REFUSING to run: DATABASE_URL must point at a LOCAL host. Got: ${DATABASE_URL || '(unset)'}`
  );
  process.exit(2);
}

/** Sort key: leading digit run (dashes stripped) as a number; non-numeric prefixes last. */
function sortKey(name) {
  const m = name.match(/^(\d[\d-]*)/);
  if (!m) return [Number.MAX_SAFE_INTEGER, name];
  const num = Number.parseInt(m[1].replace(/-/g, ''), 10);
  return [Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER, name];
}

function discover() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && f !== 'init-pgvector.sql')
    .sort((a, b) => {
      const [ka, sa] = sortKey(a);
      const [kb, sb] = sortKey(b);
      if (ka !== kb) return ka - kb;
      return sa.localeCompare(sb);
    });
}

async function applyFile(client, file) {
  const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
  if (!sql.trim()) return { file, ok: true, skipped: 'empty' };
  try {
    await client.query(sql);
    return { file, ok: true };
  } catch (err) {
    // Reset connection state: a failed statement inside a migration's BEGIN/COMMIT
    // leaves the session in an aborted-transaction state that poisons every later file.
    await client.query('ROLLBACK').catch(() => {});
    return { file, ok: false, error: String(err.message || err).split('\n')[0] };
  }
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query('CREATE SCHEMA IF NOT EXISTS v8');

  // Extensions first (best-effort).
  try {
    await client.query(readFileSync(path.join(MIGRATIONS_DIR, 'init-pgvector.sql'), 'utf-8'));
  } catch (e) {
    console.warn('[schema] init-pgvector warn:', String(e.message || e).split('\n')[0]);
  }

  const files = discover();
  console.log(`[schema] Applying ${files.length} migration files (2 passes)...`);

  let failed = [];
  // Pass 1
  for (const f of files) {
    const r = await applyFile(client, f);
    if (!r.ok) failed.push(f);
  }
  console.log(`[schema] Pass 1: ${files.length - failed.length} ok, ${failed.length} failed`);

  // Pass 2 — retry failures (resolves ALTER-before-CREATE ordering).
  const stillFailed = [];
  for (const f of failed) {
    const r = await applyFile(client, f);
    if (!r.ok) stillFailed.push({ file: f, error: r.error });
  }
  console.log(
    `[schema] Pass 2: ${failed.length - stillFailed.length} recovered, ${stillFailed.length} still failing`
  );
  if (stillFailed.length) {
    console.log('[schema] Persistently failing files (usually non-critical: legacy/dupes):');
    for (const { file, error } of stillFailed.slice(0, 40)) {
      console.log(`   - ${file}: ${error}`);
    }
    if (stillFailed.length > 40) console.log(`   ... and ${stillFailed.length - 40} more`);
  }

  // Verify required tables.
  const required = [
    'organizations',
    'users',
    'notebook_pages',
    'notebooks',
    'tp_tables',
    'ai_agent_plans',
    'ai_agent_plan_steps',
    'assessments',
    'interview_insights',
    'artifact_evidence',
    'presentation_ai_operations',
    'ai_grounding_logs',
    'organization_members',
    'revoked_tokens',
    'user_sessions',
  ];
  console.log('[schema] Required-table verification (to_regclass):');
  let missing = [];
  for (const t of required) {
    const { rows } = await client.query('SELECT to_regclass($1) AS reg', [`public.${t}`]);
    const present = rows[0].reg !== null;
    if (!present) missing.push(t);
    console.log(`   ${present ? 'OK  ' : 'MISS'} ${t}`);
  }
  await client.end();

  console.log(
    `[schema] DONE. missing=${missing.length ? missing.join(',') : 'none'}`
  );
  // artifact_evidence is a phantom (never defined in codebase) — don't fail on it alone.
  const criticalMissing = missing.filter((t) => t !== 'artifact_evidence');
  if (criticalMissing.length) {
    console.error(`[schema] CRITICAL missing: ${criticalMissing.join(',')}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[schema] FATAL', e);
  process.exit(1);
});

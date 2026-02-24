#!/usr/bin/env tsx
/**
 * Postgres migration runner (deterministic, no SQLite translation)
 *
 * Why:
 * - `server/scripts/migrate.ts` is SQLite-first and rewrites SQL (Postgres→SQLite).
 * - For a real Postgres deployment we need to execute Postgres migrations as-authored.
 *
 * Usage (repo root):
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." tsx server/scripts/migrate.postgres.ts
 *
 * Options:
 *   --dir <path>           default server/migrations
 *   --dry-run              print pending migrations, no writes
 *   --safe                 on error: record as skipped and continue
 *   --only <a,b,c>         only these filenames
 *   --from <filename>      start from this filename (inclusive)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import dotenv from 'dotenv';
import { Pool } from 'pg';

type Args = {
  dir?: string;
  'dry-run'?: boolean;
  safe?: boolean;
  only?: string;
  from?: string;
};

type Migration = {
  version: string;
  filename: string;
  filepath: string;
  checksum: string;
};

function parseArgs(argv: string[]): Args {
  const args: Record<string, any> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'dry-run' || key === 'safe') {
      args[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args as Args;
}

function splitCsv(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function calculateChecksum(filepath: string): string {
  const content = fs.readFileSync(filepath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getAllMigrations(dir: string): Migration[] {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.js') || f.endsWith('.ts'))
    .sort();

  return files.map((filename) => {
    const filepath = path.join(dir, filename);
    const version = filename.split('_')[0] || filename;
    return { version, filename, filepath, checksum: calculateChecksum(filepath) };
  });
}

function isSqliteOnlyMigration(m: Migration): boolean {
  const f = m.filename.toLowerCase();
  // Legacy initdb snapshots were generated from older SQLite-first schemas and can conflict with
  // the canonical Postgres baseline migrations (e.g. duplicate tables with missing columns).
  // For Postgres-only deployments we rely on `000_z_core_baseline.sql` + subsequent migrations.
  if (f.startsWith('000_initdb_')) return true;
  // explicit sqlite-only naming
  if (f.includes('_sqlite')) return true;
  // helper/repair files explicitly targeting sqlite
  if (f.includes('repair_sqlite')) return true;
  // any file that explicitly mentions sqlite but isn't postgres-specific
  if (f.includes('sqlite') && !f.includes('postgres')) return true;
  // legacy double extension files are sqlite-first exports (skip for Postgres-only runner)
  if (f.endsWith('.sql.sql')) return true;
  return false;
}

async function ensureSchemaMigrationsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT NOT NULL,
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      checksum TEXT NOT NULL,
      execution_time_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'success'
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_schema_migrations_status ON schema_migrations(status);`
  );
}

async function getApplied(pool: Pool): Promise<Map<string, { status: string }>> {
  const res = await pool.query(`SELECT filename, status FROM schema_migrations ORDER BY filename`);
  const map = new Map<string, { status: string }>();
  for (const r of res.rows || [])
    map.set(String(r.filename), { status: String(r.status || 'success') });
  return map;
}

async function recordResult(
  pool: Pool,
  m: Migration,
  status: 'success' | 'failed' | 'skipped',
  executionTimeMs: number,
  checksumOverride?: string
) {
  const checksum = checksumOverride ?? m.checksum;
  await pool.query(
    `INSERT INTO schema_migrations (version, filename, checksum, execution_time_ms, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (filename) DO UPDATE
     SET version = EXCLUDED.version,
         checksum = EXCLUDED.checksum,
         execution_time_ms = EXCLUDED.execution_time_ms,
         status = EXCLUDED.status,
         applied_at = CURRENT_TIMESTAMP`,
    [m.version, m.filename, checksum, executionTimeMs, status]
  );
}

async function applySql(pool: Pool, m: Migration) {
  let sql = fs.readFileSync(m.filepath, 'utf-8');

  // ------------------------------
  // Minimal SQLite → Postgres shims
  // ------------------------------
  // Legacy migrations may still contain SQLite idioms (e.g. `INSERT OR IGNORE`, `DATETIME`).
  // We keep this deterministic and intentionally narrow to avoid rewriting arbitrary SQL.

  // `INSERT OR IGNORE INTO ...;` → `INSERT INTO ... ON CONFLICT DO NOTHING;`
  sql = sql.replace(
    /\bINSERT\s+OR\s+IGNORE\s+INTO\b([\s\S]*?);/gi,
    (_m, rest) => `INSERT INTO${rest}\nON CONFLICT DO NOTHING;`
  );

  // SQLite-ish column types used in baselines; Postgres is fine with TIMESTAMP/TIMESTAMPTZ.
  sql = sql.replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ');

  // SQLite-style boolean defaults (0/1) → Postgres boolean literals
  sql = sql.replace(/\bBOOLEAN\s+DEFAULT\s+0\b/gi, 'BOOLEAN DEFAULT FALSE');
  sql = sql.replace(/\bBOOLEAN\s+DEFAULT\s+1\b/gi, 'BOOLEAN DEFAULT TRUE');
  // Sometimes booleans are declared as INTEGER with default 0/1; keep as-is (app treats them as flags).

  // Make legacy column adds idempotent on Postgres
  sql = sql.replace(
    /\bALTER\s+TABLE\s+([a-zA-Z0-9_".]+)\s+ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\b)/gi,
    'ALTER TABLE $1 ADD COLUMN IF NOT EXISTS '
  );

  // Make legacy index creation resilient (some indexes reference columns introduced later).
  // This is safe for local/dev bootstrap; production should keep migrations ordered correctly.
  if (m.filename.includes('005_ai_explainability')) {
    sql = sql.replace(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_ai_audit_logs_confidence\s+ON\s+ai_audit_logs\s*\(\s*confidence_level\s*\)\s*;/gi,
      '/* skipped: idx_ai_audit_logs_confidence (requires confidence_level column) */'
    );
    sql = sql.replace(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_ai_audit_logs_ai_role\s+ON\s+ai_audit_logs\s*\(\s*ai_role\s*\)\s*;/gi,
      '/* skipped: idx_ai_audit_logs_ai_role (requires ai_role column) */'
    );
  }

  // Most Postgres migrations are safe to run as a single multi-statement query.
  await pool.query(sql);
}

async function applyJs(pool: Pool, m: Migration) {
  const mod = await import(pathToFileUrl(m.filepath));
  if (typeof mod.up !== 'function') {
    throw new Error(`JS migration ${m.filename} has no exported up() function`);
  }
  // Run JS migrations through the app DB adapter to preserve compatibility shims
  // (e.g., PRAGMA mapping, sqlite-style helpers).
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  process.env.DB_TYPE = 'postgres';
  const db = await getDatabaseAsync();
  await mod.up(db);
}

function pathToFileUrl(p: string) {
  return pathToFileURL(p).href;
}

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const args = parseArgs(process.argv.slice(2));
  const migrationsDir = path.resolve(process.cwd(), args.dir || 'server/migrations');
  const dryRun = args['dry-run'] === true;
  const safe = args.safe === true;
  const only = new Set(splitCsv(args.only));
  const from = args.from ? String(args.from) : null;

  process.env.DB_TYPE = 'postgres';
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await ensureSchemaMigrationsTable(pool);
    const applied = await getApplied(pool);

    const all = getAllMigrations(migrationsDir)
      .filter((m) => !isSqliteOnlyMigration(m))
      .filter((m) => (only.size ? only.has(m.filename) : true));

    const filtered = from ? all.filter((m) => m.filename >= from) : all;

    const pending = filtered.filter((m) => {
      const a = applied.get(m.filename);
      return !a || a.status !== 'success';
    });

    if (dryRun) {
      // eslint-disable-next-line no-console
      console.log(`Pending migrations: ${pending.length}`);
      for (const m of pending) {
        try {
          // eslint-disable-next-line no-console
          console.log(`- ${m.filename}`);
        } catch (e: any) {
          // When piped to tools like `head`, stdout can close early → EPIPE.
          // Treat that as a normal termination condition.
          if (String(e?.code || '').toUpperCase() === 'EPIPE') return;
          throw e;
        }
      }
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Applying migrations: ${pending.length}`);

    for (const m of pending) {
      const started = Date.now();
      try {
        // eslint-disable-next-line no-console
        console.log(`→ ${m.filename}`);

        if (m.filename.endsWith('.sql')) {
          await applySql(pool, m);
        } else {
          await applyJs(pool, m);
        }

        await recordResult(pool, m, 'success', Date.now() - started);
      } catch (e: any) {
        const msg = e?.message || String(e);
        // eslint-disable-next-line no-console
        console.error(`✗ ${m.filename}: ${msg}`);

        if (safe) {
          await recordResult(pool, m, 'skipped', Date.now() - started, `skipped:${m.checksum}`);
          continue;
        }

        await recordResult(pool, m, 'failed', Date.now() - started);
        throw e;
      }
    }

    // eslint-disable-next-line no-console
    console.log('✅ Postgres migrations complete');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ Postgres migrate failed:', e?.message || e);
  process.exit(1);
});

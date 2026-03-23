#!/usr/bin/env npx tsx
/**
 * V8 Migration Runner & Schema Verification
 * CP-01: Applies all V8 SQL migrations to the `v8` Postgres schema.
 *
 * Usage (from server/):
 *   npx tsx scripts/v8-migrate.ts --dry-run
 *   npx tsx scripts/v8-migrate.ts --apply
 *   npx tsx scripts/v8-migrate.ts --verify
 *   npx tsx scripts/v8-migrate.ts --rollback
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
const MIGRATION_FILE_PATTERN = /^2026\d{4}_v8_.*\.sql$/;
const SCHEMA_NAME = 'v8';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

type Mode = 'dry-run' | 'apply' | 'verify' | 'rollback';

function parseMode(): Mode {
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) return 'dry-run';
  if (args.includes('--apply')) return 'apply';
  if (args.includes('--verify')) return 'verify';
  if (args.includes('--rollback')) return 'rollback';

  console.error(
    'Usage: npx tsx scripts/v8-migrate.ts <--dry-run | --apply | --verify | --rollback>'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Migration file discovery
// ---------------------------------------------------------------------------

function discoverMigrationFiles(): string[] {
  const allFiles = fs.readdirSync(MIGRATIONS_DIR);
  const v8Files = allFiles
    .filter((f) => MIGRATION_FILE_PATTERN.test(f))
    .sort();

  if (v8Files.length === 0) {
    console.error(`No V8 migration files found in ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  return v8Files;
}

// ---------------------------------------------------------------------------
// SQLite → Postgres SQL transformation
// ---------------------------------------------------------------------------

interface TransformResult {
  sql: string;
  transformations: string[];
}

function transformSqliteToPostgres(rawSql: string, filename: string): TransformResult {
  const transformations: string[] = [];
  let sql = rawSql;

  // 1. datetime('now') → CURRENT_TIMESTAMP (with or without surrounding parens in DEFAULT)
  const datetimeNowCount = (sql.match(/\(datetime\('now'\)\)/g) || []).length +
    (sql.match(/datetime\('now'\)/g) || []).length -
    (sql.match(/\(datetime\('now'\)\)/g) || []).length;

  // Replace (datetime('now')) first (the parenthesized form in DEFAULT clauses)
  const parenCount = (sql.match(/\(datetime\('now'\)\)/g) || []).length;
  if (parenCount > 0) {
    sql = sql.replace(/\(datetime\('now'\)\)/g, 'CURRENT_TIMESTAMP');
    transformations.push(`(datetime('now')) → CURRENT_TIMESTAMP: ${parenCount}`);
  }

  // Replace bare datetime('now') if any remain
  const bareCount = (sql.match(/datetime\('now'\)/g) || []).length;
  if (bareCount > 0) {
    sql = sql.replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP');
    transformations.push(`datetime('now') → CURRENT_TIMESTAMP: ${bareCount}`);
  }

  // 2. ALTER TABLE ... ADD COLUMN x → ADD COLUMN IF NOT EXISTS x (Postgres 9.6+)
  //    This makes ALTER TABLE idempotent on re-runs.
  const alterAddCount = (sql.match(/ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/gi) || []).length;
  if (alterAddCount > 0) {
    sql = sql.replace(
      /ALTER\s+TABLE\s+(\S+)\s+ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/gi,
      'ALTER TABLE $1 ADD COLUMN IF NOT EXISTS '
    );
    transformations.push(`ADD COLUMN → ADD COLUMN IF NOT EXISTS: ${alterAddCount}`);
  }

  return { sql, transformations };
}

// ---------------------------------------------------------------------------
// DB connection
// ---------------------------------------------------------------------------

async function createClient(): Promise<pg.Client> {
  const resolved = resolveReachableDatabaseUrl();

  if (resolved.source === 'none' || !resolved.databaseUrl) {
    console.error(
      'No database URL available. Set DATABASE_URL or DATABASE_PUBLIC_URL.'
    );
    process.exit(1);
  }

  if (resolved.reason) {
    console.log(`[db] ${resolved.reason}`);
  }
  console.log(`[db] Connecting via ${resolved.source}...`);

  const client = new pg.Client({ connectionString: resolved.databaseUrl });
  await client.connect();
  return client;
}

// ---------------------------------------------------------------------------
// Mode: dry-run
// ---------------------------------------------------------------------------

async function dryRun(files: string[]): Promise<void> {
  console.log(`\n=== DRY RUN — ${files.length} migrations ===\n`);

  let totalTransformations = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const { sql, transformations } = transformSqliteToPostgres(raw, file);

    console.log(`--- [${i + 1}/${files.length}] ${file} ---`);
    if (transformations.length > 0) {
      console.log(`  Transformations: ${transformations.join('; ')}`);
      totalTransformations += transformations.length;
    }
    console.log(sql);
    console.log('');
  }

  console.log(`\n=== Summary ===`);
  console.log(`Files: ${files.length}`);
  console.log(`Transformation rules applied: ${totalTransformations}`);
}

// ---------------------------------------------------------------------------
// Mode: apply
// ---------------------------------------------------------------------------

interface MigrationResult {
  file: string;
  status: 'applied' | 'skipped' | 'failed';
  durationMs: number;
  error?: string;
  transformations: string[];
}

async function apply(files: string[]): Promise<void> {
  const client = await createClient();
  const results: MigrationResult[] = [];

  try {
    console.log(`\n=== APPLY — ${files.length} migrations to schema "${SCHEMA_NAME}" ===\n`);

    await client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME}`);
    console.log(`[schema] Ensured schema "${SCHEMA_NAME}" exists.`);

    await client.query(`SET search_path TO ${SCHEMA_NAME}, public`);
    console.log(`[schema] search_path set to "${SCHEMA_NAME}, public".\n`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const start = performance.now();

      try {
        const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
        const { sql, transformations } = transformSqliteToPostgres(raw, file);

        await client.query(sql);
        const durationMs = Math.round(performance.now() - start);

        results.push({ file, status: 'applied', durationMs, transformations });
        const txInfo = transformations.length > 0 ? ` [${transformations.join('; ')}]` : '';
        console.log(`  [${i + 1}/${files.length}] ✓ ${file} (${durationMs}ms)${txInfo}`);
      } catch (err: unknown) {
        const durationMs = Math.round(performance.now() - start);
        const message = err instanceof Error ? err.message : String(err);
        results.push({ file, status: 'failed', durationMs, error: message, transformations: [] });
        console.error(`  [${i + 1}/${files.length}] ✗ ${file} (${durationMs}ms) — ${message}`);
      }
    }

    printApplySummary(results);
  } finally {
    await client.end();
  }
}

function printApplySummary(results: MigrationResult[]): void {
  const succeeded = results.filter((r) => r.status === 'applied').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  const totalTransformations = results.reduce(
    (acc, r) => acc + r.transformations.length,
    0
  );

  console.log(`\n=== Migration Summary ===`);
  console.log(`  Total attempted : ${results.length}`);
  console.log(`  Succeeded       : ${succeeded}`);
  console.log(`  Failed          : ${failed}`);
  console.log(`  Skipped         : ${skipped}`);
  console.log(`  Transformations : ${totalTransformations}`);

  if (failed > 0) {
    console.log(`\n  Failed migrations:`);
    for (const r of results.filter((r) => r.status === 'failed')) {
      console.log(`    - ${r.file}: ${r.error}`);
    }
  }

  console.log('');
}

// ---------------------------------------------------------------------------
// Mode: verify
// ---------------------------------------------------------------------------

async function verify(files: string[]): Promise<void> {
  const client = await createClient();

  try {
    console.log(`\n=== VERIFY — checking schema "${SCHEMA_NAME}" ===\n`);

    // Collect all expected table names from CREATE TABLE statements across all files
    const expectedTables = new Set<string>();
    const expectedIndexes = new Set<string>();

    for (const file of files) {
      const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

      const tableMatches = raw.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi);
      for (const m of tableMatches) {
        const tableName = m[1].toLowerCase();
        // Skip temp tables used in migration patterns (e.g. __w18 suffix)
        if (!tableName.includes('__')) {
          expectedTables.add(tableName);
        }
      }

      const indexMatches = raw.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi);
      for (const m of indexMatches) {
        expectedIndexes.add(m[1].toLowerCase());
      }
    }

    // Also pick up final table names from RENAME TO patterns
    for (const file of files) {
      const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const renameMatches = raw.matchAll(/RENAME\s+TO\s+(\w+)/gi);
      for (const m of renameMatches) {
        expectedTables.add(m[1].toLowerCase());
      }
    }

    // Query actual tables in the v8 schema
    const tablesResult = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [SCHEMA_NAME]
    );
    const actualTables = new Set(tablesResult.rows.map((r: { table_name: string }) => r.table_name));

    // Query actual indexes
    const indexesResult = await client.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = $1 ORDER BY indexname`,
      [SCHEMA_NAME]
    );
    const actualIndexes = new Set(indexesResult.rows.map((r: { indexname: string }) => r.indexname));

    // Report tables
    console.log(`  Expected tables : ${expectedTables.size}`);
    console.log(`  Actual tables   : ${actualTables.size}`);

    const missingTables = [...expectedTables].filter((t) => !actualTables.has(t));
    const extraTables = [...actualTables].filter((t) => !expectedTables.has(t));

    if (missingTables.length > 0) {
      console.log(`\n  MISSING tables (${missingTables.length}):`);
      for (const t of missingTables) console.log(`    - ${t}`);
    }
    if (extraTables.length > 0) {
      console.log(`\n  Extra tables in schema (${extraTables.length}):`);
      for (const t of extraTables) console.log(`    + ${t}`);
    }

    // Report indexes
    console.log(`\n  Expected indexes: ${expectedIndexes.size}`);
    console.log(`  Actual indexes  : ${actualIndexes.size}`);

    const missingIndexes = [...expectedIndexes].filter((idx) => !actualIndexes.has(idx));
    if (missingIndexes.length > 0) {
      console.log(`\n  MISSING indexes (${missingIndexes.length}):`);
      for (const idx of missingIndexes) console.log(`    - ${idx}`);
    }

    // Verdict
    const ok = missingTables.length === 0;
    console.log(`\n  Verification: ${ok ? 'PASS ✓' : 'FAIL ✗ — missing tables detected'}`);

    if (!ok) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Mode: rollback
// ---------------------------------------------------------------------------

async function rollback(files: string[]): Promise<void> {
  // Safety: require explicit env var confirmation
  if (process.env.V8_ROLLBACK_CONFIRM !== 'YES_DROP_ALL_V8_TABLES') {
    console.error(
      '\n⚠️  Rollback will DROP ALL v8_* tables in the v8 schema.\n' +
        '  To confirm, set V8_ROLLBACK_CONFIRM=YES_DROP_ALL_V8_TABLES\n\n' +
        '  Example:\n' +
        '    V8_ROLLBACK_CONFIRM=YES_DROP_ALL_V8_TABLES npx tsx scripts/v8-migrate.ts --rollback\n'
    );
    process.exit(1);
  }

  const client = await createClient();

  try {
    console.log(`\n=== ROLLBACK — dropping all tables in schema "${SCHEMA_NAME}" ===\n`);

    const tablesResult = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [SCHEMA_NAME]
    );
    const tables: string[] = tablesResult.rows.map((r: { table_name: string }) => r.table_name);

    if (tables.length === 0) {
      console.log('  No tables found in v8 schema. Nothing to drop.');
      return;
    }

    console.log(`  Tables to drop: ${tables.length}`);
    for (const t of tables) console.log(`    - ${SCHEMA_NAME}.${t}`);

    // DROP CASCADE to handle FK dependencies
    const qualifiedNames = tables.map((t) => `${SCHEMA_NAME}."${t}"`).join(', ');
    await client.query(`DROP TABLE IF EXISTS ${qualifiedNames} CASCADE`);

    console.log(`\n  Dropped ${tables.length} tables.`);
    console.log(`  Schema "${SCHEMA_NAME}" retained (empty).`);
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const mode = parseMode();
  const files = discoverMigrationFiles();

  console.log(`[v8-migrate] Mode: ${mode}`);
  console.log(`[v8-migrate] Discovered ${files.length} migration files.\n`);

  switch (mode) {
    case 'dry-run':
      await dryRun(files);
      break;
    case 'apply':
      await apply(files);
      break;
    case 'verify':
      await verify(files);
      break;
    case 'rollback':
      await rollback(files);
      break;
  }
}

main().catch((err) => {
  console.error('[v8-migrate] Fatal error:', err);
  process.exit(1);
});

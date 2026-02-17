#!/usr/bin/env tsx
/**
 * One-click migration: SQLite -> NEW Postgres database (same Postgres instance)
 *
 * Creates a new DB (leaves old as backup), then:
 * - schema sync (SQLite -> PG tables)
 * - ETL import with safety flags
 * - optional retries from latest report until stable
 * - inventory snapshots + compare for critical tables
 *
 * Usage:
 *   SQLITE_PATH=./data/dev/consultinity.db DB_TYPE=postgres DATABASE_URL="postgresql://..." \
 *     tsx server/scripts/migrate-sqlite-to-new-postgres-db.ts
 *
 * Options:
 *   --new-db <name>            override generated DB name
 *   --retries <n>              default 2 (re-run only failed/skipped tables)
 *   --batch-size <n>           default 500
 *   --skip-embeddings <true|false> default true
 */

import { spawn } from 'child_process';
import path from 'path';

import dotenv from 'dotenv';
import { Client } from 'pg';

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith('--')) continue;
    const key = a.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      i++;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '_' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function runCmd(
  cmd: string,
  cmdArgs: string[],
  env: NodeJS.ProcessEnv
): Promise<{ code: number; stdout: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      env,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let out = '';
    child.stdout.on('data', (d) => {
      const s = String(d);
      out += s;
      process.stdout.write(s);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout: out }));
  });
}

function extractLastReportPath(stdout: string): string | null {
  const lines = stdout.split('\n').map((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/Report:\s+(.+transfer-report-sqlite-to-pg-[^\\s]+\.json)/i);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractInventoryPath(stdout: string): string | null {
  const lines = stdout.split('\n').map((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/-\s+(.+inventory-(?:sqlite|postgres)-[^\\s]+\.json)$/i);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const args = parseArgs(process.argv.slice(2));
  const sqlitePath =
    args['sqlite-path'] ||
    process.env.SQLITE_PATH ||
    path.resolve(process.cwd(), 'data/dev/consultinity.db');
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL is required');

  const retries = Math.max(0, parseInt(args.retries || '2', 10) || 2);
  const batchSize = Math.max(1, parseInt(args['batch-size'] || '500', 10) || 500);
  const skipEmbeddings = (args['skip-embeddings'] || 'true').toLowerCase() !== 'false';

  const newDbName = args['new-db'] || `consultinity_migrated_${nowStamp()}`.toLowerCase();
  console.log(`[migrate-new-db] New DB name: ${newDbName}`);

  // Create new database on the same instance (leave old DB untouched)
  const u = new URL(baseUrl);
  const adminUrl = new URL(baseUrl);
  // connect to default 'postgres' db for CREATE DATABASE if possible
  adminUrl.pathname = '/postgres';

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    // CREATE DATABASE cannot run in a transaction
    console.log('[migrate-new-db] Creating database (or reusing if exists)...');
    await admin.query(`CREATE DATABASE "${newDbName}"`).catch((e: any) => {
      const msg = e?.message || String(e);
      if (msg.toLowerCase().includes('already exists')) return;
      throw e;
    });
  } finally {
    await admin.end();
  }

  const newUrl = new URL(baseUrl);
  newUrl.pathname = `/${newDbName}`;

  const envBase: NodeJS.ProcessEnv = {
    ...process.env,
    DB_TYPE: 'postgres',
    SQLITE_PATH: sqlitePath,
    DATABASE_URL: newUrl.toString(),
  };
  // 1) Build core Postgres schema FIRST (so backend initDb/indexes expectations are satisfied).
  console.log('[migrate-new-db] Applying core Postgres schema (000_initdb_core_tables.sql)...');
  const coreRes = await runCmd(
    'npx',
    ['tsx', 'server/scripts/migrate.postgres.ts', '--only', '000_initdb_core_tables.sql'],
    envBase
  );
  if (coreRes.code !== 0) throw new Error('core postgres schema migration failed');

  // 2) Schema sync (create-only) for remaining SQLite tables.
  console.log('[migrate-new-db] Starting schema sync (SQLite -> PG, missing tables only)...');
  const schemaRes = await runCmd(
    'npx',
    ['tsx', 'server/scripts/schema-sync-sqlite-to-postgres.ts', '--mode', 'create'],
    envBase
  );
  if (schemaRes.code !== 0) throw new Error('schema-sync failed');

  console.log('[migrate-new-db] Starting full ETL...');
  // 3) Full ETL
  const etlArgs = [
    'tsx',
    'server/scripts/transfer-sqlite-to-postgres.ts',
    '--batch-size',
    String(batchSize),
    '--skip-embeddings',
    String(skipEmbeddings),
    '--report-limit',
    '20',
    '--disable-triggers',
    'true',
    '--relax-not-null',
    'true',
    '--fill-missing-not-null',
    'true',
    '--drop-check-constraints',
    'true',
  ];

  const etl1 = await runCmd('npx', etlArgs, envBase);
  if (etl1.code !== 0) throw new Error('ETL failed');
  let lastReport = extractLastReportPath(etl1.stdout);
  if (lastReport) console.log(`[migrate-new-db] ETL report: ${lastReport}`);

  // 3) Retry loop
  for (let i = 0; i < retries && lastReport; i++) {
    console.log(`[migrate-new-db] Retry pass ${i + 1}/${retries} from report...`);
    const retry = await runCmd('npx', [...etlArgs, '--only-from-report', lastReport], envBase);
    if (retry.code !== 0) throw new Error('ETL retry failed');
    lastReport = extractLastReportPath(retry.stdout) || lastReport;
    if (lastReport) console.log(`[migrate-new-db] Retry report: ${lastReport}`);
  }

  console.log('[migrate-new-db] Generating inventories (sqlite + postgres)...');
  // 4) Inventory snapshots
  const invSqlite = await runCmd(
    'npx',
    ['tsx', 'server/scripts/db-inventory.ts', '--mode', 'sqlite', '--counts', 'exact'],
    {
      ...process.env,
      SQLITE_PATH: sqlitePath,
    }
  );
  if (invSqlite.code !== 0) throw new Error('sqlite inventory failed');
  const sqliteInvPath = extractInventoryPath(invSqlite.stdout);

  const invPg = await runCmd(
    'npx',
    ['tsx', 'server/scripts/db-inventory.ts', '--mode', 'postgres', '--counts', 'exact'],
    envBase
  );
  if (invPg.code !== 0) throw new Error('postgres inventory failed');
  const pgInvPath = extractInventoryPath(invPg.stdout);

  // 5) Compare critical tables
  if (sqliteInvPath && pgInvPath) {
    console.log('[migrate-new-db] Comparing critical table row-counts...');
    await runCmd(
      'npx',
      [
        'tsx',
        'server/scripts/compare-inventories.ts',
        '--sqlite',
        sqliteInvPath,
        '--postgres',
        pgInvPath,
        '--only',
        [
          'organizations',
          'users',
          'projects',
          'tasks',
          'sessions',
          'notifications',
          'assessments',
          'assessment_reports',
          'assessment_report_sections',
          'initiatives',
          'decisions',
          'raid_items',
        ].join(','),
      ],
      envBase
    );
  }

  // Print only safe info (no credentials)
  // eslint-disable-next-line no-console
  console.log(`✅ New database created and populated: ${newDbName}`);
  // eslint-disable-next-line no-console
  console.log(`ℹ️ Switch your app DATABASE_URL to use database name: ${newDbName}`);
  // eslint-disable-next-line no-console
  console.log(`ℹ️ Old database remains untouched as backup (previous DATABASE_URL).`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ migrate-sqlite-to-new-postgres-db failed:', e?.message || e);
  process.exit(1);
});

#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
/**
 * Purge incomplete assessments (SQLite).
 *
 * Deletes all records from `assessments` where completion_percent < 100
 * and also deletes related rows in any table that contains `assessment_id`.
 *
 * Safety:
 * - refuses to run on non-dev DB unless FORCE_PURGE=true
 * - creates a JSON backup under `_backup/` before deleting
 * - dry-run by default; pass `--apply` to actually delete
 *
 * Usage:
 *   cd server && DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/purge-incomplete-assessments.ts
 *   cd server && DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/purge-incomplete-assessments.ts --apply
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDatabase } from '../src/database/Database.js';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import crypto from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

type Db = any;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

const log = {
  info: (msg: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.dim}  → ${msg}${colors.reset}`),
};

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply') || argv.includes('--yes');
  const limitArg = (() => {
    const idx = argv.findIndex((a) => a === '--limit');
    if (idx >= 0 && argv[idx + 1]) return Number(argv[idx + 1]);
    return undefined;
  })();
  return { apply, limit: Number.isFinite(limitArg) ? limitArg : undefined };
}

async function run(db: Db, sql: string, params: any[] = []) {
  return new Promise<{ lastID?: number; changes?: number }>((resolve, reject) => {
    db.run(sql, params, function (err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: (this as any)?.lastID, changes: (this as any)?.changes });
    });
  });
}

async function all<T = any>(db: Db, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function getOne<T = any>(db: Db, sql: string, params: any[] = []): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: T) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

async function exec(db: Db, sql: string) {
  return new Promise<void>((resolve, reject) => {
    db.exec(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function requireSafeSqlitePath(): string {
  const dbType = process.env.DB_TYPE || 'sqlite';
  const sqlitePath = process.env.SQLITE_PATH;

  if (dbType !== 'sqlite') {
    throw new Error(`This script targets SQLite only. Current DB_TYPE=${dbType}`);
  }
  if (!sqlitePath) {
    throw new Error('SQLITE_PATH is required. Example: SQLITE_PATH=../data/dev/consultinity.db');
  }

  const resolved = path.resolve(process.cwd(), sqlitePath);
  const looksLikeDev = resolved.includes(`${path.sep}data${path.sep}dev${path.sep}consultinity.db`);
  if (!looksLikeDev && process.env.FORCE_PURGE !== 'true') {
    throw new Error(
      `Refusing to purge non-dev DB: ${resolved}\n` +
        `Set FORCE_PURGE=true only if you really want to purge this file.`
    );
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`SQLite file does not exist: ${resolved}`);
  }
  return resolved;
}

function stableHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
}

async function listTables(db: Db): Promise<string[]> {
  const rows = await all<{ name: string }>(
    db,
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );
  return (rows || []).map((r) => r.name).filter(Boolean);
}

async function tableHasColumn(db: Db, table: string, col: string): Promise<boolean> {
  try {
    const info = await all<{ name: string }>(db, `PRAGMA table_info(${table})`);
    return (info || []).some((r) => r.name === col);
  } catch {
    return false;
  }
}

async function backupAndPurge(db: Db, opts: { apply: boolean; limit?: number }) {
  const sqlitePath = requireSafeSqlitePath();
  await exec(db, `PRAGMA foreign_keys = ON;`);

  const limitSql = opts.limit && opts.limit > 0 ? ` LIMIT ${Number(opts.limit)}` : '';
  const targets = await all<any>(
    db,
    `SELECT id, organization_id, assessment_type, name, status, COALESCE(completion_percent, 0) AS completion_percent, updated_at
     FROM assessments
     WHERE COALESCE(completion_percent, 0) < 100
     ORDER BY updated_at DESC${limitSql}`
  );

  if (!targets.length) {
    log.success('No incomplete assessments found (completion_percent < 100).');
    return;
  }

  const ids = targets.map((t) => String(t.id));
  const preview = targets
    .slice(0, 30)
    .map((t) => `- ${t.assessment_type || '?'} | ${t.status || '?'} | ${t.completion_percent}% | ${t.name} (${t.id})`);

  log.info(`Found ${targets.length} incomplete assessment(s) to purge (completion_percent < 100).`);
  preview.forEach((l) => console.log(l));
  if (targets.length > preview.length) {
    log.step(`... and ${targets.length - preview.length} more`);
  }

  // Find all tables containing assessment_id
  const tables = await listTables(db);
  const tablesWithAssessmentId: string[] = [];
  for (const t of tables) {
    if (t === 'assessments') continue;
    // eslint-disable-next-line no-await-in-loop
    const has = await tableHasColumn(db, t, 'assessment_id');
    if (has) tablesWithAssessmentId.push(t);
  }

  // Backup payload
  const backup: any = {
    kind: 'purge-incomplete-assessments-backup',
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    hostname: os.hostname(),
    sqlitePath: sqlitePath,
    criteria: { completionPercentLt: 100, limit: opts.limit ?? null },
    targets,
    related: {} as Record<string, any[]>,
  };

  const placeholders = ids.map(() => '?').join(', ');
  log.step(`Backing up related rows from ${tablesWithAssessmentId.length} table(s) + assessments.`);

  // Always include the primary rows from assessments.
  backup.related.assessments = await all<any>(
    db,
    `SELECT * FROM assessments WHERE id IN (${placeholders})`,
    ids
  );

  for (const t of tablesWithAssessmentId) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await all<any>(
      db,
      `SELECT * FROM ${t} WHERE assessment_id IN (${placeholders})`,
      ids
    ).catch(() => []);
    if (rows && rows.length) backup.related[t] = rows;
  }

  const repoRoot = path.resolve(process.cwd(), '..');
  const backupDir = path.join(repoRoot, '_backup');
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `purge-incomplete-assessments_${stamp}_${stableHash(sqlitePath)}.json`;
  const fullPath = path.join(backupDir, filename);
  fs.writeFileSync(fullPath, JSON.stringify(backup, null, 2), 'utf-8');
  log.success(`Backup written: ${fullPath}`);

  if (!opts.apply) {
    log.warn('Dry-run: no rows were deleted. Re-run with --apply to perform the purge.');
    return;
  }

  log.warn('Applying purge (this will delete rows).');

  // Transactional delete (best-effort)
  await exec(db, 'BEGIN;');
  try {
    // Delete from related tables first (if FK cascade is off or missing)
    let totalRelatedDeletes = 0;
    for (const t of tablesWithAssessmentId) {
      // eslint-disable-next-line no-await-in-loop
      const res = await run(db, `DELETE FROM ${t} WHERE assessment_id IN (${placeholders})`, ids).catch(
        () => ({ changes: 0 })
      );
      totalRelatedDeletes += Number(res?.changes || 0);
    }

    const resMain = await run(db, `DELETE FROM assessments WHERE id IN (${placeholders})`, ids);
    const mainDeletes = Number(resMain?.changes || 0);

    await exec(db, 'COMMIT;');
    log.success(
      `Purge complete. Deleted ${mainDeletes} assessment(s) and ${totalRelatedDeletes} related row(s).`
    );
  } catch (e: any) {
    await exec(db, 'ROLLBACK;').catch(() => undefined);
    throw e;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sqlitePath = requireSafeSqlitePath();
  log.info(`SQLite: ${sqlitePath}`);
  log.info(`Mode: ${args.apply ? 'APPLY (deleting)' : 'DRY-RUN (no deletes)'}`);

  // Ensure env is respected by database factory even if caller didn't set cwd correctly.
  process.env.DB_TYPE = process.env.DB_TYPE || 'sqlite';
  process.env.SQLITE_PATH = process.env.SQLITE_PATH || sqlitePath;

  // Ensure sqlite3 native module exists (helps fail early with a clearer message).
  try {
    require('sqlite3');
  } catch {
    // ignore (Database factory will throw if missing)
  }

  const db = await createDatabase();
  try {
    await backupAndPurge(db, args);
  } finally {
    try {
      await new Promise<void>((resolve) => db.close(() => resolve()));
    } catch {
      // ignore
    }
  }
}

main().catch((e) => {
  log.error(String(e?.message || e));
  process.exit(1);
});


import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

const __filename_esm = fileURLToPath(import.meta.url);
const __dirname_esm = path.dirname(__filename_esm);

const MIGRATION_TABLE = 'tp_migration_history';

async function ensureMigrationTable(): Promise<void> {
  const db = getDatabase();
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum TEXT
    )
  `);
}

function getMigrationsDir(): string {
  // Resolve relative to compiled output: dist/src/services/tablePlatform/ → dist/../migrations
  // Also handle running from source: src/services/tablePlatform/ → ../../migrations
  const candidates = [
    path.resolve(__dirname_esm, '../../../../migrations'),
    path.resolve(__dirname_esm, '../../../migrations'),
    path.resolve(process.cwd(), 'server/migrations'),
    path.resolve(process.cwd(), 'migrations'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => /^7\d{2}_.*\.sql$/.test(f));
      if (files.length > 0) return dir;
    }
  }

  throw new Error(
    `[TP Migrations] Could not find migrations directory. Searched: ${candidates.join(', ')}`
  );
}

function discoverMigrationFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => /^7\d{2}_.*\.sql$/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.split('_')[0], 10);
      const numB = parseInt(b.split('_')[0], 10);
      return numA - numB;
    });
}

function fileChecksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export interface MigrationResult {
  applied: number;
  skipped: number;
  failed: string | null;
  total: number;
}

export async function runMigrations(): Promise<MigrationResult> {
  const db = getDatabase();

  await ensureMigrationTable();

  let migrationsDir: string;
  try {
    migrationsDir = getMigrationsDir();
  } catch (err: any) {
    logger.error(`[TP Migrations] ${err.message}`);
    return { applied: 0, skipped: 0, failed: err.message, total: 0 };
  }

  const files = discoverMigrationFiles(migrationsDir);
  if (files.length === 0) {
    logger.info('[TP Migrations] No migration files found');
    return { applied: 0, skipped: 0, failed: null, total: 0 };
  }

  logger.info(`[TP Migrations] Found ${files.length} migration files in ${migrationsDir}`);

  const appliedResult = await db.query<{ filename: string }>(
    `SELECT filename FROM ${MIGRATION_TABLE}`
  );
  const appliedSet = new Set(appliedResult.rows.map((r) => r.filename));

  let applied = 0;
  let skipped = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      skipped++;
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    const checksum = fileChecksum(sql);

    logger.info(`[TP Migrations] Applying migration ${file}...`);

    try {
      await db.query(sql);
      await db.query(`INSERT INTO ${MIGRATION_TABLE} (filename, checksum) VALUES ($1, $2)`, [
        file,
        checksum,
      ]);
      applied++;
      logger.info(`[TP Migrations] Applied ${file}`);
    } catch (err: any) {
      logger.error(`[TP Migrations] FAILED on ${file}: ${err.message}`);
      return { applied, skipped, failed: file, total: files.length };
    }
  }

  logger.info(
    `[TP Migrations] Complete: ${applied} applied, ${skipped} already up to date (${files.length} total)`
  );
  return { applied, skipped, failed: null, total: files.length };
}

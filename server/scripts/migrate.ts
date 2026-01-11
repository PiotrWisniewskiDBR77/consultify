#!/usr/bin/env tsx
/**
 * Database Migration Runner
 * Tracks and executes database migrations in order
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDatabase } from '../src/database/Database.js';
import logger from '../src/utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

interface Migration {
  version: string;
  filename: string;
  filepath: string;
  checksum: string;
}

interface AppliedMigration {
  version: string;
  filename: string;
  applied_at: string;
  checksum: string;
  status: string;
}

/**
 * Calculate checksum for migration file
 */
function calculateChecksum(filepath: string): string {
  const content = fs.readFileSync(filepath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get all migration files from directory
 */
function getAllMigrations(): Migration[] {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.js'))
    .sort(); // Alphabetical order ensures version order

  return files.map((filename) => {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const version = filename.split('_')[0]; // Extract version number

    return {
      version,
      filename,
      filepath,
      checksum: calculateChecksum(filepath),
    };
  });
}

/**
 * Get applied migrations from database
 */
async function getAppliedMigrations(): Promise<AppliedMigration[]> {
  const db = await getDatabase();

  try {
    const result = await db.query(
      'SELECT version, filename, applied_at, checksum, status FROM schema_migrations ORDER BY version'
    );
    return result.rows as AppliedMigration[];
  } catch (error) {
    // Table doesn't exist yet
    logger.warn('[Migrate] schema_migrations table does not exist yet');
    return [];
  }
}

/**
 * Apply a single migration
 */
async function applyMigration(migration: Migration): Promise<boolean> {
  const db = await getDatabase();
  const startTime = Date.now();

  logger.info(`[Migrate] Applying migration: ${migration.filename}`);

  try {
    const content = fs.readFileSync(migration.filepath, 'utf-8');

    if (migration.filename.endsWith('.sql')) {
      // Execute SQL migration
      const statements = content
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        await db.run(statement);
      }
    } else if (migration.filename.endsWith('.js')) {
      // Execute JS migration
      const migrationModule = await import(migration.filepath);
      if (typeof migrationModule.up === 'function') {
        await migrationModule.up(db);
      }
    }

    const executionTime = Date.now() - startTime;

    // Record successful migration
    await db.run(
      `INSERT INTO schema_migrations (version, filename, checksum, execution_time_ms, status)
             VALUES (?, ?, ?, ?, 'success')`,
      [migration.version, migration.filename, migration.checksum, executionTime]
    );

    logger.info(`[Migrate] ✅ Applied ${migration.filename} in ${executionTime}ms`);
    return true;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error(`[Migrate] ❌ Failed to apply ${migration.filename}:`, error);

    // Record failed migration
    try {
      await db.run(
        `INSERT INTO schema_migrations (version, filename, checksum, execution_time_ms, status)
                 VALUES (?, ?, ?, ?, 'failed')`,
        [migration.version, migration.filename, migration.checksum, executionTime]
      );
    } catch (recordError) {
      logger.error('[Migrate] Failed to record migration failure:', recordError);
    }

    return false;
  }
}

/**
 * Backfill existing migrations (mark as applied without executing)
 */
async function backfillMigrations(migrations: Migration[]): Promise<void> {
  const db = await getDatabase();

  logger.info(`[Migrate] Backfilling ${migrations.length} existing migrations...`);

  for (const migration of migrations) {
    try {
      await db.run(
        `INSERT OR IGNORE INTO schema_migrations (version, filename, checksum, status)
                 VALUES (?, ?, ?, 'success')`,
        [migration.version, migration.filename, migration.checksum]
      );
      logger.info(`[Migrate] Backfilled: ${migration.filename}`);
    } catch (error) {
      logger.error(`[Migrate] Failed to backfill ${migration.filename}:`, error);
    }
  }

  logger.info('[Migrate] ✅ Backfill complete');
}

/**
 * Main migration runner
 */
async function runMigrations(options: { backfill?: boolean } = {}): Promise<void> {
  logger.info('[Migrate] Starting migration process...');

  const allMigrations = getAllMigrations();
  const appliedMigrations = await getAppliedMigrations();

  logger.info(`[Migrate] Found ${allMigrations.length} migration files`);
  logger.info(`[Migrate] ${appliedMigrations.length} migrations already applied`);

  if (options.backfill) {
    await backfillMigrations(allMigrations);
    return;
  }

  const appliedVersions = new Set(appliedMigrations.map((m) => m.version));
  const pendingMigrations = allMigrations.filter((m) => !appliedVersions.has(m.version));

  if (pendingMigrations.length === 0) {
    logger.info('[Migrate] ✅ No pending migrations');
    return;
  }

  logger.info(`[Migrate] Found ${pendingMigrations.length} pending migrations`);

  for (const migration of pendingMigrations) {
    const success = await applyMigration(migration);
    if (!success) {
      logger.error('[Migrate] ❌ Migration failed, stopping...');
      process.exit(1);
    }
  }

  logger.info('[Migrate] ✅ All migrations applied successfully');
}

/**
 * CLI interface
 */
const args = process.argv.slice(2);
const command = args[0];

if (command === 'backfill') {
  runMigrations({ backfill: true })
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('[Migrate] Fatal error:', error);
      process.exit(1);
    });
} else {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('[Migrate] Fatal error:', error);
      process.exit(1);
    });
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import {
  RUNTIME_MIGRATION_ALLOWLIST as RUNTIME_MIGRATION_ALLOWLIST_FILES,
  classifyMigrationChecksum,
  fileChecksum,
  isRuntimeMigrationFile,
} from './migrationIdentity.js';

// Backwards-compatible test/diagnostic surface retained for packets that
// imported discovery helpers from migrationRunner before migrationIdentity
// became the single source of truth. Runtime ownership still lives in
// migrationIdentity; this Set is a read-only snapshot for membership checks.
export const RUNTIME_MIGRATION_ALLOWLIST = new Set(RUNTIME_MIGRATION_ALLOWLIST_FILES);
export { isRuntimeMigrationFile };

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

/**
 * Resolves the migrations directory.
 *
 * `explicitDir` exists ONLY so real-DB tests can point the runner at a unique
 * temp directory instead of writing fixture migrations into the canonical
 * server/migrations (which would race a concurrently running backend). It is
 * a function argument, never read from the environment, a request, or any
 * other runtime data — production startup calls runMigrations() with no
 * arguments and therefore always resolves the canonical directory below.
 */
function getMigrationsDir(explicitDir?: string): string {
  if (explicitDir) {
    if (!fs.existsSync(explicitDir)) {
      throw new Error(`[TP Migrations] Injected migrations directory not found: ${explicitDir}`);
    }
    return explicitDir;
  }

  const candidates = [
    path.resolve(__dirname_esm, '../../../../migrations'),
    path.resolve(__dirname_esm, '../../../migrations'),
    path.resolve(process.cwd(), 'server/migrations'),
    path.resolve(process.cwd(), 'migrations'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => isRuntimeMigrationFile(f));
      if (files.length > 0) return dir;
    }
  }

  throw new Error(
    `[TP Migrations] Could not find migrations directory. Searched: ${candidates.join(', ')}`
  );
}

/** Test-only seam; see getMigrationsDir. Never populated from runtime data.
 * A parity test asserts that TP_MIGRATIONS_DIR (an earlier, rejected design)
 * is not honoured by the no-argument production path. */
export interface RunMigrationsOptions {
  migrationsDir?: string;
}

export function compareMigrationFilenames(a: string, b: string): number {
  const prefixA = a.split('_')[0];
  const prefixB = b.split('_')[0];
  if (prefixA.length !== prefixB.length) return prefixA.length - prefixB.length;
  const prefixCmp = prefixA.localeCompare(prefixB);
  if (prefixCmp !== 0) return prefixCmp;
  return a.localeCompare(b);
}

export function discoverMigrationFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => isRuntimeMigrationFile(f))
    .sort(compareMigrationFilenames);
}

export interface MigrationResult {
  applied: number;
  /** Genuinely already-applied migrations. NEVER incremented for failures. */
  skipped: number;
  /** Error message when the run stopped, else null. */
  failed: string | null;
  /** Filename the run stopped on, else null. */
  failedFile: string | null;
  total: number;
  /** Applied migrations whose on-disk content no longer matches history. */
  checksumMismatches: string[];
  /** Exact, immutable historical checksum pairs accepted without rewriting DB history. */
  acceptedHistoricalChecksumVariants: string[];
}

/**
 * Applies one migration ATOMICALLY: the DDL and its history row commit
 * together or not at all.
 *
 * Uses a dedicated pooled client, because `db.query()` takes a NEW connection
 * per call — issuing BEGIN/COMMIT through it would spread the transaction
 * across different connections and guarantee nothing. No migration in this
 * repo uses CREATE INDEX CONCURRENTLY (verified), so all of them are legal
 * inside a transaction block.
 *
 * Throws on failure, after rolling back. It deliberately does NOT write a
 * history row on failure — that was the defect that let a broken migration be
 * recorded as applied and never retried.
 */
/** Minimal shape this function needs from a pooled Postgres client. */
type AtomicMigrationClient = {
  query: (t: string, p?: unknown[]) => Promise<unknown>;
  release: () => void;
};

async function applyMigrationAtomically(
  file: string,
  sql: string,
  checksum: string
): Promise<void> {
  const insertHistory = `INSERT INTO ${MIGRATION_TABLE} (filename, checksum) VALUES ($1, $2)`;

  // M01-PRUN fix: was `as unknown as typeof client`. TS resolves a `typeof x`
  // type query against the CONTROL-FLOW-NARROWED type of `x` at that source
  // position, not its declared type — and at this line `client`'s narrowed
  // type was still exactly `null` (its initializer, nothing had narrowed it
  // away yet). The cast therefore silently coerced the real client down to
  // `null`, and every `if (client)` block below type-checked its body against
  // `never`. A named type avoids the flow-sensitive `typeof` query entirely;
  // behavior (a plain `as unknown as T` cast) is unchanged.
  let client: AtomicMigrationClient | null = null;
  try {
    const { acquirePgClient } = await import('../../database/PostgresDatabase.js');
    client = (await acquirePgClient()) as unknown as AtomicMigrationClient;
  } catch {
    client = null; // non-Postgres backend (e.g. SQLite in local dev)
  }

  if (client) {
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(insertHistory, [file, checksum]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    return;
  }

  // Single-connection fallback (SQLite honours BEGIN/COMMIT on its one handle).
  const db = getDatabase();
  try {
    await db.query('BEGIN');
    await db.query(sql);
    await db.query(insertHistory, [file, checksum]);
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

export async function runMigrations(options?: RunMigrationsOptions): Promise<MigrationResult> {
  const db = getDatabase();
  const empty = (over: Partial<MigrationResult>): MigrationResult => ({
    applied: 0,
    skipped: 0,
    failed: null,
    failedFile: null,
    total: 0,
    checksumMismatches: [],
    acceptedHistoricalChecksumVariants: [],
    ...over,
  });

  await ensureMigrationTable();

  let migrationsDir: string;
  try {
    migrationsDir = getMigrationsDir(options?.migrationsDir);
  } catch (err: any) {
    logger.error(`[TP Migrations] ${err.message}`);
    return empty({ failed: err.message });
  }

  const files = discoverMigrationFiles(migrationsDir);
  if (files.length === 0) {
    logger.info('[TP Migrations] No migration files found');
    return empty({});
  }

  logger.info(`[TP Migrations] Found ${files.length} migration files in ${migrationsDir}`);

  const appliedResult = await db.query<{ filename: string; checksum: string | null }>(
    `SELECT filename, checksum FROM ${MIGRATION_TABLE}`
  );
  const appliedChecksums = new Map(appliedResult.rows.map((r) => [r.filename, r.checksum]));

  // ── Checksum verification (fail-closed) ─────────────────────────────────
  // An applied migration whose file changed underneath us means the schema in
  // this database no longer matches the code that claims to describe it. That
  // is not something to continue past. Rows with a NULL checksum predate
  // checksum recording and are reported as unverifiable, not treated as drift.
  const checksumMismatches: string[] = [];
  const acceptedHistoricalChecksumVariants: string[] = [];
  let legacyUnverified = 0;
  for (const file of files) {
    if (!appliedChecksums.has(file)) continue;
    const stored = appliedChecksums.get(file);
    const verdict = classifyMigrationChecksum(
      file,
      stored,
      fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    );
    if (verdict === 'unverifiable') legacyUnverified++;
    else if (verdict === 'accepted_historical_variant') {
      acceptedHistoricalChecksumVariants.push(file);
    } else if (verdict === 'drift') checksumMismatches.push(file);
  }

  if (checksumMismatches.length > 0) {
    const msg =
      `Checksum mismatch for already-applied migration(s): ${checksumMismatches.join(', ')}. ` +
      `The database no longer matches these files. Refusing to run (fail-closed).`;
    logger.error(`[TP Migrations] ${msg}`);
    return empty({
      failed: msg,
      total: files.length,
      checksumMismatches,
      acceptedHistoricalChecksumVariants,
    });
  }

  if (legacyUnverified > 0) {
    logger.warn(
      `[TP Migrations] ${legacyUnverified} applied migration(s) have no recorded checksum and could not be verified`
    );
  }

  if (acceptedHistoricalChecksumVariants.length > 0) {
    logger.warn(
      `[TP Migrations] ${acceptedHistoricalChecksumVariants.length} applied migration(s) match exact approved historical checksum variants; history was not rewritten`
    );
  }

  let applied = 0;
  let skipped = 0;

  for (const file of files) {
    if (appliedChecksums.has(file)) {
      skipped++;
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const checksum = fileChecksum(sql);

    logger.info(`[TP Migrations] Applying migration ${file}...`);

    try {
      await applyMigrationAtomically(file, sql, checksum);
      applied++;
      logger.info(`[TP Migrations] Applied ${file}`);
    } catch (err: any) {
      // STOP. Do not record history, do not call this "skipped", do not
      // report success. A later run must rediscover and retry this file.
      const msg = String(err?.message || err);
      logger.error(
        `[TP Migrations] FAILED on ${file}: ${msg}. Rolled back; not recorded as applied. Stopping.`
      );
      return {
        applied,
        skipped,
        failed: msg,
        failedFile: file,
        total: files.length,
        checksumMismatches: [],
        acceptedHistoricalChecksumVariants,
      };
    }
  }

  logger.info(
    `[TP Migrations] Complete: ${applied} applied, ${skipped} already up to date (${files.length} total)`
  );
  return {
    applied,
    skipped,
    failed: null,
    failedFile: null,
    total: files.length,
    checksumMismatches: [],
    acceptedHistoricalChecksumVariants,
  };
}

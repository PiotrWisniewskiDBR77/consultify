import fs from 'fs';
import crypto from 'crypto';
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

type MigrationLedgerDb = {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

export class MigrationLedgerReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationLedgerReconciliationError';
  }
}

/**
 * Reconciles the legacy Table Platform ledger from the canonical strict SQL
 * ledger without executing migration SQL a second time.
 *
 * A canonical `success` row is accepted only when its checksum is the exact
 * current 64-character SHA-256 of the same filename. Any malformed or stale
 * success row fails closed before TP DDL can run. The TP write is followed by
 * exact readback so a concurrent conflicting insert cannot be mistaken for a
 * successful reconciliation.
 */
export async function reconcileTablePlatformLedgerFromCanonical(
  db: MigrationLedgerDb,
  files: string[],
  migrationsDir: string
): Promise<number> {
  const canonicalLedger = await db.query<{ present: boolean }>(
    `SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present`
  );
  if (!canonicalLedger.rows[0]?.present) return 0;

  const canonicalRows = await db.query<{
    filename: string;
    checksum: string | null;
    status: string;
  }>(`SELECT filename, checksum, status FROM schema_migrations`);
  const candidateSet = new Set(files);
  const successful = new Map<string, string | null>();
  for (const row of canonicalRows.rows) {
    if (!candidateSet.has(row.filename) || row.status !== 'success') continue;
    if (successful.has(row.filename)) {
      throw new MigrationLedgerReconciliationError(
        `Canonical migration ledger contains duplicate success identity '${row.filename}'`
      );
    }
    successful.set(row.filename, row.checksum);
  }

  const tpRows = await db.query<{ filename: string; checksum: string | null }>(
    `SELECT filename, checksum FROM ${MIGRATION_TABLE}`
  );
  const tpApplied = new Set(tpRows.rows.map((row) => row.filename));
  let reconciled = 0;

  for (const file of files) {
    // An existing TP identity is already reconciled and is validated by the
    // normal TP checksum path below. Canonical full-SHA validation is scoped
    // to rows we would copy, so this bridge does not retroactively impose a
    // new policy on established legacy ledgers.
    if (tpApplied.has(file)) continue;

    const canonicalChecksum = successful.get(file);
    if (canonicalChecksum === undefined) continue;

    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const fullChecksum = crypto.createHash('sha256').update(content).digest('hex');
    if (!/^[0-9a-f]{64}$/.test(canonicalChecksum || '') || canonicalChecksum !== fullChecksum) {
      throw new MigrationLedgerReconciliationError(
        `Canonical success checksum mismatch for '${file}': expected exact current SHA-256 ${fullChecksum}, ` +
          `received ${JSON.stringify(canonicalChecksum)}. Refusing TP ledger reconciliation and DDL replay.`
      );
    }
    const shortChecksum = fileChecksum(content);
    await db.query(
      `INSERT INTO ${MIGRATION_TABLE} (filename, checksum) VALUES ($1, $2) ON CONFLICT (filename) DO NOTHING`,
      [file, shortChecksum]
    );
    const readback = await db.query<{ checksum: string | null }>(
      `SELECT checksum FROM ${MIGRATION_TABLE} WHERE filename = $1`,
      [file]
    );
    if (readback.rows.length !== 1 || readback.rows[0]?.checksum !== shortChecksum) {
      throw new MigrationLedgerReconciliationError(
        `TP ledger readback mismatch for '${file}' after canonical reconciliation`
      );
    }
    tpApplied.add(file);
    reconciled++;
  }

  return reconciled;
}

// Explicit intra-day ordering for same-date-prefix migrations whose plain
// filename order inverts a real producer/consumer dependency.
//
// Bug this exists to fix: on a genuinely fresh database, this runtime
// runner failed with `relation "case_core" does not exist` while applying
// `20260809_case_workspace_artifact_links.sql`. Root cause: all eleven
// `20260809_case_workspace_*.sql` files share the identical date prefix, so
// the fallback tiebreak below (raw filename compare) put them in ASCII
// order — 'a' (artifact_links) before 'c' (case_core, the sole producer of
// the `case_core` table `artifact_links` FKs into). This was invisible on
// any database where `case_core` already existed from an earlier run,
// which is why it went undetected until a from-scratch replay caught it.
//
// This table is a deliberately narrow override, not a general dependency
// resolver: it only reorders files it explicitly names, and only relative
// to each other (the length/locale prefix comparison above still governs
// everything else, including ordering against files with a DIFFERENT date
// prefix). It changes DISCOVERY ORDER only — it never edits SQL content, so
// it has no effect on any database where these files are already recorded
// in `tp_migration_history` (already-applied files are skipped by filename
// lookup before ordering is ever consulted; see the skip check in
// `runMigrations()` below). It is therefore safe for already-migrated
// databases (demo, prod, the shared local `case_workspace_test`) by
// construction, not merely by argument — verified directly, see this
// packet's regression evidence.
//
// Mirrors the SAME dependency order already reviewed and shipped in the
// separate manual runner's `DATED_SAME_DAY_ORDER` map
// (`server/scripts/migrate.postgres.ts`), which fixed this identical root
// cause for that runner earlier (see that file's own comment + git history,
// and `server/scripts/case-workspace-realdb-harness/EVIDENCE.md`). That fix
// never propagated to THIS runner — the one that actually gates
// `/api/ready` at server startup — which is the defect this map closes.
// Keep the two maps in sync if a new same-day case_workspace file is added;
// they are intentionally not shared code, since the two runners have
// independent discovery/sort machinery and duplicating eleven lines is
// lower risk than coupling a `server/scripts/*` CLI tool to runtime service
// code.
const SAME_PREFIX_ORDER: Record<string, number> = {
  '20260809_case_workspace_case_core.sql': 0, // sole producer of `case_core` — every other file here FKs into it, directly or transitively
  '20260809_case_workspace_capability_registry.sql': 1, // no case_workspace FK dependency; kept early
  '20260809_case_workspace_case_plan_version.sql': 2, // FKs case_core
  '20260809_case_workspace_run_binding.sql': 3, // FKs case_core, case_plan_versions, v8_execution_runs (unaffected, far-earlier-dated table)
  '20260809_case_workspace_proposals_approvals.sql': 4, // FKs case_core, run_binding, case_plan_versions, capability_registry
  '20260809_case_workspace_wait_subscription.sql': 5, // FKs case_core, run_binding, proposals_approvals
  '20260809_case_workspace_history_value.sql': 6, // FKs case_core
  '20260809_case_workspace_plays.sql': 7, // no FK into case_core/case_plan_versions by design (Plays are pre-Case)
  '20260809_case_workspace_artifact_links.sql': 8, // FKs case_core — the file that originally exposed this bug (sorted alphabetically before case_core.sql)
  '20260809_case_workspace_execution_graph.sql': 9, // FKs case_core, run_binding
  '20260809_case_workspace_migration_readiness.sql': 10, // no FK into any other case_workspace table
};

export function compareMigrationFilenames(a: string, b: string): number {
  const prefixA = a.split('_')[0];
  const prefixB = b.split('_')[0];
  if (prefixA.length !== prefixB.length) return prefixA.length - prefixB.length;
  const prefixCmp = prefixA.localeCompare(prefixB);
  if (prefixCmp !== 0) return prefixCmp;
  // Filename ordering is part of the schema contract. localeCompare() places
  // punctuation such as the terminal `.sql` and an additional `_suffix`
  // differently across ICU locales (and can run an extension before its base
  // producer). Raw code-point order is deterministic on every runtime and
  // naturally places `name.sql` before `name_extension.sql`.
  if (a === b) return 0;

  // Same-prefix dependency override: only applies when BOTH filenames are
  // explicitly listed above, so it can never silently reorder a file it
  // does not know about (an unlisted same-prefix file keeps the plain
  // filename tiebreak below).
  const orderA = SAME_PREFIX_ORDER[a];
  const orderB = SAME_PREFIX_ORDER[b];
  if (orderA !== undefined && orderB !== undefined) return orderA - orderB;

  return a < b ? -1 : 1;
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

  await reconcileTablePlatformLedgerFromCanonical(db, files, migrationsDir);
  const reconciledResult = await db.query<{ filename: string; checksum: string | null }>(
    `SELECT filename, checksum FROM ${MIGRATION_TABLE}`
  );
  appliedChecksums.clear();
  for (const row of reconciledResult.rows) appliedChecksums.set(row.filename, row.checksum);

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

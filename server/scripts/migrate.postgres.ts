/**
 * Postgres migration runner (deterministic, no SQLite translation)
 *
 * NOTE ON THE MISSING SHEBANG:
 * This file used to start with `#!/usr/bin/env tsx`. It was decorative — the
 * file is mode 100644 (never executable) and every caller invokes it as
 * `tsx server/scripts/migrate.postgres.ts` or `node dist/scripts/migrate.postgres.js`.
 * The shebang DID, however, make the module unimportable under vitest: Vite's
 * SSR transform prepends its own import ahead of line 1, and rollup then fails
 * with "Parse failure: Expected ident". That forced tests to hand-copy this
 * file's checksum/ledger logic instead of importing it — a copy that tests
 * itself and keeps passing after the real code changes. Removed so the trust
 * surface below can be asserted against directly.
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
import '../src/config/loadEnv.js';

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { Pool, type PoolClient } from 'pg';

import {
  assertNoPrivateRailwayDbHostOutsideRailway,
  resolveReachableDatabaseUrl,
} from '../src/config/databaseTargetResolver.js';

import type { IDatabase, QueryResult, RunResult } from '../src/database/IDatabase.js';

import {
  classifySqlChainChecksum,
  type ChecksumVerdict,
} from '../src/services/releaseGate/sqlChainChecksumPolicy.js';

type Args = {
  dir?: string;
  'dry-run'?: boolean;
  safe?: boolean;
  only?: string;
  from?: string;
};

import {
  type Migration,
  NUMBERED_RE,
  DATED_RE,
  LATE_PHASE_MANIFEST,
  LATE_PHASE_SET,
  PROMOTED_LEGACY_PRODUCERS,
  PROMOTED_LEGACY_SET,
  EARLY_VERSION_OVERRIDES,
  SAME_DATE_ORDER_OVERRIDES,
  UNORDERED_PHASE_MANIFEST,
  UNORDERED_PHASE_SET,
  ORDER_INDEPENDENT_MANIFEST,
  LEGACY_NON_SCHEMA_MANIFEST,
  INTRADAY_SUFFIX_MANIFEST,
  phaseAndKeyFor,
  compareMigrationOrder,
  sortMigrationsDeterministically,
  validateOverrideMapsAreDisjoint,
  UnclassifiedMigrationFilenameError,
  DuplicateSortKeyError,
  OverrideMapCollisionError,
} from './migrationOrdering.js';

// Re-export the pure ordering surface. This file is the entrypoint callers
// know about, and `tests/integration/migration-ordering-parity.realdb.test.ts`
// imports `compareMigrationOrder` from HERE to prove the runner's real order
// rather than a copy of it.
export {
  type Migration,
  NUMBERED_RE,
  DATED_RE,
  LATE_PHASE_MANIFEST,
  LATE_PHASE_SET,
  PROMOTED_LEGACY_PRODUCERS,
  PROMOTED_LEGACY_SET,
  EARLY_VERSION_OVERRIDES,
  SAME_DATE_ORDER_OVERRIDES,
  UNORDERED_PHASE_MANIFEST,
  UNORDERED_PHASE_SET,
  ORDER_INDEPENDENT_MANIFEST,
  LEGACY_NON_SCHEMA_MANIFEST,
  INTRADAY_SUFFIX_MANIFEST,
  phaseAndKeyFor,
  compareMigrationOrder,
  sortMigrationsDeterministically,
  validateOverrideMapsAreDisjoint,
  UnclassifiedMigrationFilenameError,
  DuplicateSortKeyError,
  OverrideMapCollisionError,
};

/** Anything both a `Pool` and a checked-out `PoolClient` satisfy. */
type Queryable = Pool | PoolClient;


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

// `server/migrations/` holds three subdirectories (ops/, never-ran/,
// rollback/) that are deliberately NOT part of the forward chain. Their
// exclusion used to be an ACCIDENT: `readdirSync` is non-recursive and a
// directory name never ends in .sql/.js/.ts, so they vanished silently — and
// so would any future subdirectory, or a migration dropped in by mistake.
// Make the exclusion an explicit, closed decision.
export const KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS = new Set(['ops', 'never-ran', 'rollback']);
export const RUNNABLE_MIGRATION_EXTENSIONS = ['.sql', '.js', '.ts'] as const;

export class UnexpectedMigrationsEntryError extends Error {
  constructor(
    public readonly entryName: string,
    public readonly kind: string
  ) {
    super(
      `UNEXPECTED ENTRY in the migrations directory: '${entryName}' (${kind}). Known excluded ` +
        `subdirectories are exactly {${[...KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS].join(', ')}}. Refusing ` +
        `to silently ignore it — add it to the allowlist if the exclusion is intentional.`
    );
    this.name = 'UnexpectedMigrationsEntryError';
  }
}

function getAllMigrations(dir: string): Migration[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS.has(entry.name)) {
        throw new UnexpectedMigrationsEntryError(entry.name, 'directory');
      }
      continue;
    }
    if (!entry.isFile()) {
      throw new UnexpectedMigrationsEntryError(entry.name, 'not a regular file');
    }
    if (RUNNABLE_MIGRATION_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      files.push(entry.name);
    }
  }
  files.sort();

  return files.map((filename) => {
    const filepath = path.join(dir, filename);
    const version = filename.split('_')[0] || filename;
    return { version, filename, filepath, checksum: calculateChecksum(filepath) };
  });
}

// ---------------------------------------------------------------------------
// Deterministic execution-order contract
// ---------------------------------------------------------------------------
// Plain filename sort (the historical behavior) breaks down once two naming
// schemes coexist in `server/migrations/`:
//
//   NUMBERED  000_..., 500_...938_...  — the older, canonical Postgres-native
//             producers (baseline + incremental schema, zero-padded 3-digit
//             version prefixes).
//   DATED     20260101_..., 2026-06-08_... — newer incremental migrations
//             (YYYYMMDD or YYYY-MM-DD prefixes), added chronologically after
//             the numbered series was mostly frozen, that ALTER/backfill
//             tables the numbered migrations create.
//
// Lexicographic string sort puts almost all DATED files BEFORE almost all
// NUMBERED files >= 300, because the character '2' (start of "2026...")
// sorts before '3'-'9' (start of "300_".."938_"). Concretely: on a fresh DB,
// the raw filename sort runs all ~269 dated migrations first, then all
// ~221 numbered 500-938 migrations — even though dated migrations like
// `20260719_baseline_gap.sql` reference tables (`initiative_budget_items`,
// `report_builder_templates`, `interview_library_templates`, ...) that only
// the numbered 500-938 migrations create. That is the actual dependency
// bug: consumers were scheduled before producers, purely as an artifact of
// ASCII string comparison, not any real dependency analysis.
//
// Fix: classify each migration into an explicit phase and sort within each
// phase by a phase-appropriate key (numeric version, or calendar date) —
// NOT a full manual topological sort of ~700+ files, and NOT raw filename
// sort where that breaks the dependency graph.
//
//   Phase 0 — NUMBERED  sorted by numeric version (000 baseline first, then
//                        500..938 as historical producers), filename as tie
//                        breaker for duplicate version numbers (e.g. the two
//                        100_owner_role*.sql files).
//   Phase 1 — DATED      sorted by calendar date (YYYY, MM, DD), filename as
//                        tie breaker for same-day migrations.
//   Phase 2 — LATE       explicit, documented manifest (LATE_PHASE_MANIFEST
//                        below) of hotfix/backfill/guard migrations that
//                        must run after BOTH phase 0 and phase 1, because
//                        they consume objects created by dated migrations
//                        themselves (date-order alone does not place them
//                        correctly). Discovered empirically in ETAP 1 of
//                        STRICT_SCHEMA_REPAIR_REPORT.md by iterating strict
//                        runs against a fresh container.
//   Phase 3 — OTHER      anything matching neither pattern (e.g.
//                        `init-pgvector.sql`) — order-independent, runs
//                        last, sorted by filename.


function isSqliteOnlyMigration(m: Migration): boolean {
  const f = m.filename.toLowerCase();
  const versionNum = Number.parseInt(m.version, 10);

  // iCloud/duplicate artifacts (e.g. "515_xxx 2.sql")
  if (/\s+\d+\.sql$/.test(f)) return true;

  // Seed/demo data files should not be part of schema migration flow.
  if (
    f.includes('seed') ||
    f.includes('mock') ||
    f.includes('demo') ||
    f.startsWith('add_') ||
    f === 'assessment-module.sql' ||
    f === 'fix_conversations_table.sql'
  ) {
    return true;
  }

  // Canonical flow for Postgres uses the core baseline + modern incremental migrations.
  // Older pre-baseline fragments (<500) are often SQLite-first and conflict with baseline.
  if (Number.isFinite(versionNum) && versionNum > 0 && versionNum < 500) {
    if (!f.startsWith('000_z_core_baseline')) return true;
  }

  // Legacy initdb snapshots were generated from older SQLite-first schemas and can conflict with
  // the canonical Postgres baseline migrations (e.g. duplicate tables with missing columns).
  // For Postgres-only deployments we rely on `000_z_core_baseline.sql` + subsequent migrations.
  if (f.startsWith('000_initdb_')) return true;
  // explicit sqlite-only naming
  if (f.includes('_sqlite')) return true;
  // SQLite FTS virtual tables are not valid Postgres migrations.
  if (f.includes('fts5')) return true;
  // helper/repair files explicitly targeting sqlite
  if (f.includes('repair_sqlite')) return true;
  // any file that explicitly mentions sqlite but isn't postgres-specific
  if (f.includes('sqlite') && !f.includes('postgres')) return true;
  // legacy double extension files are sqlite-first exports (skip for Postgres-only runner)
  if (f.endsWith('.sql.sql')) return true;
  return false;
}

async function ensureSchemaMigrationsTable(db: Queryable) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT NOT NULL,
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      checksum TEXT NOT NULL,
      execution_time_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'success'
    );
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_schema_migrations_status ON schema_migrations(status);`
  );
}

export type AppliedMigrationRow = {
  filename: string;
  status: string;
  checksum: string | null;
};

async function getApplied(db: Queryable): Promise<Map<string, AppliedMigrationRow>> {
  // `checksum` is read, not just written. Without it the ledger's checksum
  // column was write-only and post-hoc edits to an already-applied migration
  // file were structurally undetectable.
  const res = await db.query(
    `SELECT filename, status, checksum FROM schema_migrations ORDER BY filename`
  );
  const map = new Map<string, AppliedMigrationRow>();
  for (const r of res.rows || []) {
    map.set(String(r.filename), {
      filename: String(r.filename),
      status: String(r.status || 'success'),
      checksum: r.checksum === null || r.checksum === undefined ? null : String(r.checksum),
    });
  }
  return map;
}

async function recordResult(
  db: Queryable,
  m: Migration,
  status: 'success' | 'failed' | 'skipped',
  executionTimeMs: number,
  checksumOverride?: string
) {
  const checksum = checksumOverride ?? m.checksum;
  await db.query(
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

// ---------------------------------------------------------------------------
// Ledger trust, preflight, concurrency
// ---------------------------------------------------------------------------
export const CHECKSUM_HEX_RE = /^[0-9a-f]{64}$/;
export const SKIPPED_CHECKSUM_RE = /^skipped:[0-9a-f]{64}$/;
export const KNOWN_LEDGER_STATUSES = new Set(['success', 'failed', 'skipped']);

export class HistoricalMutationError extends Error {
  constructor(
    public readonly filename: string,
    public readonly storedChecksum: string,
    public readonly currentChecksum: string,
    public readonly verdict: ChecksumVerdict = 'DRIFT'
  ) {
    super(
      `HISTORICAL MUTATION: '${filename}' is recorded 'success' with checksum ${storedChecksum}, but ` +
        `its bytes on disk now hash to ${currentChecksum}. An already-applied migration was edited ` +
        `after the fact, so the ledger no longer describes the schema that is actually live. Refusing ` +
        `to apply anything until this is resolved.`
    );
    this.name = 'HistoricalMutationError';
  }
}

export class MalformedLedgerEntryError extends Error {
  constructor(
    public readonly filename: string,
    public readonly reason: string
  ) {
    super(
      `UNTRUSTED LEDGER ROW for '${filename}': ${reason}. This runner refuses to treat a row it did ` +
        `not write as proof that a migration was applied. Refusing to run.`
    );
    this.name = 'MalformedLedgerEntryError';
  }
}

export class DuplicateMigrationIdentityError extends Error {
  constructor(public readonly filename: string) {
    super(
      `DUPLICATE MIGRATION IDENTITY: '${filename}' appears more than once in this run's migration set. ` +
        `schema_migrations.filename is the identity key and cannot record two distinct applications of ` +
        `the same name.`
    );
    this.name = 'DuplicateMigrationIdentityError';
  }
}

export class MigrationLockHeldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationLockHeldError';
  }
}

/** Pure. Throws on the first repeated filename. */
export function assertNoDuplicateMigrationIdentity(migrations: Migration[]): void {
  const seen = new Set<string>();
  for (const m of migrations) {
    if (seen.has(m.filename)) throw new DuplicateMigrationIdentityError(m.filename);
    seen.add(m.filename);
  }
}

/**
 * A stored checksum is TRUSTED only when its shape is one this runner itself
 * writes, for a status this runner itself writes. An untrusted row is never
 * compared against disk — comparing an unrecognized shape would turn a
 * provenance problem into a misleading pass/fail.
 *
 * Scope: rows are validated for the migrations THIS run would consider, not
 * for the whole table. A ledger row can only cause harm here by making the
 * runner skip a migration it should have applied, and only rows for candidate
 * migrations can do that. Validating unrelated rows would also break the
 * legitimate narrow `--dir` / `--only` invocations, whose ledger necessarily
 * contains filenames absent from the directory being run.
 */
export function assertLedgerRowIsTrusted(row: AppliedMigrationRow): void {
  if (!KNOWN_LEDGER_STATUSES.has(row.status)) {
    throw new MalformedLedgerEntryError(
      row.filename,
      `status '${row.status}' is not one this runner writes (success/failed/skipped)`
    );
  }
  if (row.status === 'skipped') {
    if (row.checksum === null || !SKIPPED_CHECKSUM_RE.test(row.checksum)) {
      throw new MalformedLedgerEntryError(
        row.filename,
        `status 'skipped' but checksum ${JSON.stringify(row.checksum)} is not the ` +
          `'skipped:<sha256>' form this runner writes under --safe`
      );
    }
    return;
  }
  if (row.checksum === null || !CHECKSUM_HEX_RE.test(row.checksum)) {
    throw new MalformedLedgerEntryError(
      row.filename,
      `status '${row.status}' but checksum ${JSON.stringify(row.checksum)} is not a 64-character ` +
        `lowercase hex sha256 digest`
    );
  }
}

/**
 * Everything that must fail BEFORE the first mutation: classification-map
 * sanity, duplicate identity, untrusted ledger rows, and historical mutation
 * of an already-applied migration.
 */
export function runFilesystemPreflight(candidates: Migration[]): void {
  validateOverrideMapsAreDisjoint();
  assertNoDuplicateMigrationIdentity(candidates);

  // Classify EVERY candidate up front. Relying on the sort to surface an
  // unclassified filename is not enough: Array.prototype.sort never invokes
  // the comparator for a single-element array, so a lone bad filename would
  // sail through. This also proves the (phase, key) space is collision-free
  // for this run, independent of how many comparisons sort happens to make.
  const keyOwner = new Map<string, string>();
  for (const m of candidates) {
    const { phase, key } = phaseAndKeyFor(m);
    const id = `${phase}|${key}`;
    const owner = keyOwner.get(id);
    if (owner !== undefined && owner !== m.filename) {
      throw new DuplicateSortKeyError(owner, m.filename, phase, key);
    }
    keyOwner.set(id, m.filename);
  }
}

/**
 * Ledger-side half of preflight. Runs after the ledger is read and BEFORE the
 * first migration is applied.
 */
export function runLedgerPreflight(
  candidates: Migration[],
  applied: Map<string, AppliedMigrationRow>
): void {
  for (const m of candidates) {
    const row = applied.get(m.filename);
    if (!row) continue;
    assertLedgerRowIsTrusted(row);
    if (row.status !== 'success') continue;
    // `row.checksum` is non-null here: assertLedgerRowIsTrusted enforced the
    // 64-char hex shape for 'success'.
    // Delegate to the release gate's OWN checksum policy rather than a raw
    // inequality. `server/src/services/releaseGate/sqlChainChecksumPolicy.ts`
    // records 32 (stored, current) pairs that a 2026-08-13 forensic pass
    // approved as deliberate historical variants, plus one schema-attested
    // legacy pair. Those environments are exactly the ones this runner is
    // pointed at by `release-migration-gate.ts` — the Railway
    // `preDeployCommand`. A bare `stored !== current` check here would refuse
    // to migrate demo/prod for drift the gate governing this runner already
    // accepts, so the two must read from ONE source of truth.
    const verdict = classifySqlChainChecksum(m.filename, row.checksum, m.checksum);
    if (verdict === 'DRIFT') {
      throw new HistoricalMutationError(m.filename, row.checksum as string, m.checksum, verdict);
    }
  }
}

/** Composed preflight: filesystem-only checks, then ledger-side checks. */
export function runPreflightChecks(
  candidates: Migration[],
  applied: Map<string, AppliedMigrationRow>
): void {
  runFilesystemPreflight(candidates);
  runLedgerPreflight(candidates, applied);
}

/**
 * Reads the ledger WITHOUT creating it. `--dry-run` must not mutate a fresh
 * database, and `ensureSchemaMigrationsTable()` is itself a mutation
 * (CREATE TABLE + CREATE INDEX), so a dry run against a virgin database must
 * treat a missing ledger as "nothing applied yet" rather than create one.
 */
async function readLedgerIfPresent(db: Queryable): Promise<Map<string, AppliedMigrationRow>> {
  const present = await db.query(`SELECT to_regclass('schema_migrations') AS t`);
  if (!present.rows[0]?.t) return new Map<string, AppliedMigrationRow>();
  return getApplied(db);
}

// Errors that mean "this migration's objects are already there" rather than
// "this migration is broken". Only these are eligible to be recorded
// 'skipped' under --safe. Anything else — including an error carrying no
// SQLSTATE at all — is a genuine failure, so the classification fails closed.
export const BENIGN_ALREADY_APPLIED_PG_CODES = new Set([
  '42P07', // duplicate_table
  '42P06', // duplicate_schema
  '42P04', // duplicate_database
  '42710', // duplicate_object (incl. constraints, indexes, types)
  '42701', // duplicate_column
  '42723', // duplicate_function
]);

export function isBenignAlreadyAppliedError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && BENIGN_ALREADY_APPLIED_PG_CODES.has(code);
}

export const MIGRATION_ADVISORY_LOCK_KEY = 'consultify:migrate.postgres:schema_migrations';

async function acquireMigrationLock(client: PoolClient): Promise<void> {
  const res = await client.query(`SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS locked`, [
    MIGRATION_ADVISORY_LOCK_KEY,
  ]);
  if (res.rows[0]?.locked !== true) {
    throw new MigrationLockHeldError(
      `Another migrate.postgres.ts run already holds the migration advisory lock on this database ` +
        `(key '${MIGRATION_ADVISORY_LOCK_KEY}'). Two concurrent runners can each compute the same ` +
        `pending set and double-apply. Fails fast rather than blocking, because this runner is a ` +
        `one-shot CLI/CI step and a blocked run is indistinguishable from a hung one.`
    );
  }
}

async function releaseMigrationLock(client: PoolClient): Promise<void> {
  await client
    .query(`SELECT pg_advisory_unlock(hashtext($1)::bigint)`, [MIGRATION_ADVISORY_LOCK_KEY])
    .catch(() => {});
}

async function applySql(db: Queryable, m: Migration) {
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

  // SQLite `lower(hex(randomblob(16)))` → Postgres `gen_random_uuid()::text`
  sql = sql.replace(/\(lower\(hex\(randomblob\(\d+\)\)\)\)/gi, 'gen_random_uuid()::text');

  // SQLite `datetime('now')` → Postgres `CURRENT_TIMESTAMP`
  sql = sql.replace(/\(datetime\('now'\)\)/gi, 'CURRENT_TIMESTAMP');

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
  await db.query(sql);
}

export class UnsupportedMigrationDatabaseCallError extends Error {
  constructor(
    public readonly filename: string,
    public readonly method: string
  ) {
    super(
      `MIGRATION USED AN UNSUPPORTED DATABASE CALL: '${filename}' called ${method}. The migration ` +
        `database handed to up() is pinned to the single transactional client running this migration, ` +
        `and deliberately implements only the promise-style surface. Anything else could reach a ` +
        `different connection and escape the transaction, so it fails loudly instead.`
    );
    this.name = 'UnsupportedMigrationDatabaseCallError';
  }
}

/**
 * The `IDatabase` handed to a `.ts`/`.js` migration's `up(db)`, pinned to the
 * SAME `PoolClient` (and therefore the same open transaction) that runs the
 * migration and writes its ledger row.
 *
 * Why this exists: `applyJs` previously resolved its own handle via
 * `getDatabaseAsync()`. That handle is a DIFFERENT connection, so a JS/TS
 * migration's DDL committed independently of the ledger write and could not be
 * rolled back with it — and under `NODE_ENV=test` (which the localhost guard
 * forces on for any local run) `getDatabaseAsync()` returns a MOCK unless
 * RUN_DB_TESTS=1, so the four canonical dated `.ts` migrations could report
 * success having written nothing at all.
 *
 * Only the promise-style methods are implemented. The sqlite-style callback
 * overloads, and `close()`, throw: `close()` in particular must never be
 * honoured here, because the client belongs to the runner, not the migration.
 */
class TransactionalMigrationDatabase {
  constructor(
    private readonly client: PoolClient,
    private readonly filename: string
  ) {}

  private unsupported(method: string): never {
    throw new UnsupportedMigrationDatabaseCallError(this.filename, method);
  }

  private assertNoCallback(params: unknown, callback: unknown, method: string): void {
    if (typeof params === 'function' || typeof callback === 'function') {
      this.unsupported(`${method}(..., callback)`);
    }
  }

  async run(sql: string, params?: unknown[], callback?: unknown): Promise<RunResult> {
    this.assertNoCallback(params, callback, 'run');
    const res = await this.client.query(sql, params as unknown[] | undefined);
    return { changes: res.rowCount ?? 0 };
  }

  async get<T = unknown>(sql: string, params?: unknown[], callback?: unknown): Promise<T | null> {
    this.assertNoCallback(params, callback, 'get');
    const res = await this.client.query(sql, params as unknown[] | undefined);
    return ((res.rows?.[0] as T | undefined) ?? null) as T | null;
  }

  async all<T = unknown>(sql: string, params?: unknown[], callback?: unknown): Promise<T[]> {
    this.assertNoCallback(params, callback, 'all');
    const res = await this.client.query(sql, params as unknown[] | undefined);
    return (res.rows ?? []) as T[];
  }

  async query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    const res = await this.client.query(text, params);
    return { rows: (res.rows ?? []) as T[], rowCount: res.rowCount ?? 0 };
  }

  async exec(sql: string, callback?: unknown): Promise<void> {
    this.assertNoCallback(undefined, callback, 'exec');
    await this.client.query(sql);
  }

  close(): never {
    // The client is the runner's, and the transaction is still open.
    return this.unsupported('close()');
  }
}

/**
 * Builds the pinned migration database. Exported so the contract can be
 * asserted directly rather than inferred from a migration's side effects.
 */
export function createTransactionalMigrationDatabase(
  client: PoolClient,
  filename: string
): IDatabase {
  const target = new TransactionalMigrationDatabase(client, filename);
  // Any member this adapter does not implement (sqlite-style `serialize`,
  // `prepare`, `each`, ...) must fail with the named error rather than a bare
  // "is not a function" TypeError — and must never fall through to something
  // that could reach another connection.
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop in obj || typeof prop === 'symbol') {
        return Reflect.get(obj, prop, receiver);
      }
      return () => {
        throw new UnsupportedMigrationDatabaseCallError(filename, String(prop));
      };
    },
  }) as unknown as IDatabase;
}

/**
 * True only when the function's own source declares `()` — an EMPTY parameter
 * list. `fn.length` alone is wrong here: a default (`up(db = null)`) or rest
 * (`up(...args)`) parameter also reports length 0, and rejecting those would
 * refuse a migration that does accept the database.
 */
export function declaresEmptyParameterList(fn: (...args: unknown[]) => unknown): boolean {
  const params = /\(([^)]*)\)/.exec(Function.prototype.toString.call(fn));
  return params !== null && params[1].trim() === '';
}

async function applyJs(client: PoolClient, m: Migration) {
  const mod = await import(pathToFileUrl(m.filepath));
  if (typeof mod.up !== 'function') {
    throw new Error(`JS migration ${m.filename} has no exported up() function`);
  }
  if (declaresEmptyParameterList(mod.up)) {
    throw new Error(
      `JS migration ${m.filename} exports up() taking no database argument. The runner supplies a ` +
        `transaction-pinned IDatabase; a zero-argument up() would have to find its own connection and ` +
        `would escape the migration's transaction.`
    );
  }
  await mod.up(createTransactionalMigrationDatabase(client, m.filename));
}

function pathToFileUrl(p: string) {
  return pathToFileURL(p).href;
}

type MigrationOutcome = 'success' | 'benign-skipped' | 'genuine-failure';

/**
 * One migration = one transaction on ONE client, so the DDL and the ledger
 * row commit or roll back together. Previously the migration ran via
 * `pool.query()` and the ledger write was a second `pool.query()` that could
 * land on a different pooled connection: a crash between them left the schema
 * mutated with no ledger record.
 *
 * On failure the transaction is rolled back FIRST (which clears the client's
 * aborted state), and only then is the failed/skipped bookkeeping row written
 * as a fresh statement — never inside the transaction that just aborted.
 */
async function applyOneMigration(
  client: PoolClient,
  m: Migration,
  safe: boolean
): Promise<MigrationOutcome> {
  const started = Date.now();
  // eslint-disable-next-line no-console
  console.log(`→ ${m.filename}`);

  try {
    await client.query('BEGIN');
    if (m.filename.endsWith('.sql')) {
      await applySql(client, m);
    } else {
      await applyJs(client, m);
    }
    await recordResult(client, m, 'success', Date.now() - started);
    await client.query('COMMIT');
    return 'success';
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    const msg = e?.message || String(e);
    // eslint-disable-next-line no-console
    console.error(`✗ ${m.filename}: ${msg}`);

    if (safe) {
      // --safe tolerates "already applied" errors, and ONLY those. A genuine
      // failure is recorded 'failed' (never 'skipped', which reads as "not
      // needed") and makes the whole run exit non-zero.
      if (isBenignAlreadyAppliedError(e)) {
        await recordResult(client, m, 'skipped', Date.now() - started, `skipped:${m.checksum}`);
        return 'benign-skipped';
      }
      await recordResult(client, m, 'failed', Date.now() - started);
      return 'genuine-failure';
    }

    await recordResult(client, m, 'failed', Date.now() - started);
    throw e;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const migrationsDir = path.resolve(process.cwd(), args.dir || 'server/migrations');
  const dryRun = args['dry-run'] === true;
  const safe = args.safe === true;
  const only = new Set(splitCsv(args.only));
  const from = args.from ? String(args.from) : null;

  process.env.DB_TYPE = 'postgres';
  assertNoPrivateRailwayDbHostOutsideRailway(process.env);
  const resolvedDb = resolveReachableDatabaseUrl({
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  const databaseUrl = resolvedDb.databaseUrl;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (resolvedDb.reason) {
    // eslint-disable-next-line no-console
    console.warn(`[migrate.postgres] ${resolvedDb.reason}`);
  }

  // ---------------------------------------------------------------------
  // Phase 1 — FILESYSTEM. Discovery, classification, ordering and checksums
  // all happen before a connection is even opened, so a malformed directory
  // or an unclassifiable filename fails with nothing touched at all.
  // ---------------------------------------------------------------------
  const candidates = getAllMigrations(migrationsDir)
    .filter((m) => (only.size ? only.has(m.filename) : true))
    // NOTE: allow explicit `--only` to run even legacy (<500) migrations.
    // PROMOTED_LEGACY_PRODUCERS overrides the blanket <500 exclusion for
    // specific, verified-safe producer files (see comment above).
    .filter((m) =>
      only.size ? true : PROMOTED_LEGACY_SET.has(m.filename) || !isSqliteOnlyMigration(m)
    );

  runFilesystemPreflight(candidates);

  const all = sortMigrationsDeterministically(candidates);

  // ---------------------------------------------------------------------
  // Phase 2 — DATABASE. Lock first, so the ledger this run reads cannot be
  // changed by a competing runner between the read and the apply, and so the
  // ledger's own creation is serialized too.
  // ---------------------------------------------------------------------
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  let lockHeld = false;

  try {
    let applied: Map<string, AppliedMigrationRow>;

    if (dryRun) {
      // A dry run mutates NOTHING: no lock, no CREATE TABLE, no index.
      applied = await readLedgerIfPresent(client);
    } else {
      await acquireMigrationLock(client);
      lockHeld = true;
      await ensureSchemaMigrationsTable(client);
      applied = await getApplied(client);
    }

    // Fail closed BEFORE the first migration is applied.
    runLedgerPreflight(candidates, applied);

    // `--from` resumes at a specific file's position in the DETERMINISTIC
    // execution order (not raw filename string comparison, which would no
    // longer match actual execution order once phases are involved).
    const fromIndex = from ? all.findIndex((m) => m.filename === from) : -1;
    const filtered = from ? (fromIndex >= 0 ? all.slice(fromIndex) : all) : all;

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
          // When piped to tools like `head`, stdout can close early -> EPIPE.
          // Treat that as a normal termination condition.
          if (String(e?.code || '').toUpperCase() === 'EPIPE') return;
          throw e;
        }
      }
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Applying migrations: ${pending.length}`);

    const genuineFailures: string[] = [];
    for (const m of pending) {
      const outcome = await applyOneMigration(client, m, safe);
      if (outcome === 'genuine-failure') genuineFailures.push(m.filename);
    }

    if (genuineFailures.length > 0) {
      throw new Error(
        `${genuineFailures.length} migration(s) genuinely failed under --safe: ` +
          `${genuineFailures.join(', ')}. --safe tolerates already-applied errors only; these are ` +
          `recorded 'failed', not 'skipped', and the run is not reported as complete.`
      );
    }

    // eslint-disable-next-line no-console
    console.log('✅ Postgres migrations complete');
  } finally {
    if (lockHeld) await releaseMigrationLock(client);
    client.release();
    await pool.end();
  }
}

/**
 * True only when this module IS the process entrypoint. Without this guard,
 * merely importing the file ran `main()` — so no test could bind to the
 * runner's real exported functions without it trying to open a database
 * connection and calling process.exit().
 */
export function isDirectCliInvocation(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isDirectCliInvocation()) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('❌ Postgres migrate failed:', e?.message || e);
    process.exit(1);
  });
}

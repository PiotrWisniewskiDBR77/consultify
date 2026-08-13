/**
 * Database readiness sequence (schema init → migrations → seeding → ready).
 *
 * Extracted from the inline closure in server/src/index.ts because that
 * closure was untestable by construction, which is how the old behaviour
 * survived: migrations ran in a detached `setTimeout(…, 5000)` AFTER
 * `dbReady = true`, so the app published itself with a possibly incomplete
 * schema and a migration failure was reduced to a log line.
 *
 * This module makes the ORDER and the FAILURE POLICY explicit and testable.
 * It never calls `process.exit` itself — it returns `shouldExitProcess` and
 * lets the caller own that, so tests can assert the production policy without
 * killing the test runner.
 */
import type { MigrationResult } from '../services/tablePlatform/migrationRunner.js';

import {
  isSqlChainAcceptable,
  type SqlChainEvaluation,
  type SqlChainState,
} from '../services/releaseGate/sqlChainEvaluator.js';

export type TpMigrationState = 'pending' | 'ok' | 'failed' | 'disabled_by_operator';

export interface TpMigrationStatus {
  state: TpMigrationState;
  detail: string | null;
}

/**
 * SQL-chain summary carried on the readiness receipt.
 *
 * Readiness previously validated ONLY the Table Platform ledger (tp_migration_history) and never
 * looked at schema_migrations at all — so /api/ready could report "ok" while the SQL chain had
 * failed rows, skipped rows, pending migrations or unexplained checksum drift. Evaluated ONCE at
 * startup via the shared evaluator and stored here; endpoints serve this receipt rather than
 * re-running the evaluation per request.
 */
export interface SqlMigrationStatus {
  state: SqlChainState;
  failed: number;
  skipped: number;
  pending: number;
  unexplainedDrift: number;
  approvedVariants: number;
  attestedLegacyVariants: number;
  detail: string;
}

export interface ReadinessOutcome {
  /** Whether `dbReady` may be flipped to true. */
  ready: boolean;
  /** Precise operator-facing reason when not ready, else null. */
  error: string | null;
  migrations: TpMigrationStatus;
  /** SQL-chain (schema_migrations) state — required for readiness, not merely reported. */
  sqlMigrations: SqlMigrationStatus;
  /** True only when template seeding actually ran. */
  seeded: boolean;
  /** Production must fail the deployment; dev/test stays up but not ready. */
  shouldExitProcess: boolean;
}

export interface ReadinessDeps {
  /** Schema init/verification (DatabaseInitializer.initializeDatabase). */
  initializeSchema: () => Promise<{ success: boolean; message?: string }>;
  /** The real migration runner. Called with NO arguments in production. */
  runMigrations: () => Promise<MigrationResult>;
  seedTemplates: () => Promise<void>;
  isProduction: boolean;
  /** DISABLE_TP_MIGRATIONS=true — a deliberate, visible operator override. */
  migrationsDisabled: boolean;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  /** Optional critical-alert sink; failures here never mask the outcome. */
  alert?: (title: string, message: string) => Promise<void>;
  /**
   * Evaluate the SQL chain (schema_migrations). Injected so tests can drive every state without
   * a database. Production supplies the shared evaluator.
   */
  evaluateSqlChain?: () => Promise<SqlChainEvaluation>;
}

export async function establishDatabaseReadiness(
  deps: ReadinessDeps
): Promise<ReadinessOutcome> {
  const unevaluatedSql: SqlMigrationStatus = {
    state: 'error',
    failed: 0,
    skipped: 0,
    pending: 0,
    unexplainedDrift: 0,
    approvedVariants: 0,
    attestedLegacyVariants: 0,
    detail: 'SQL chain not evaluated (readiness aborted earlier)',
  };
  const notReady = (
    error: string,
    migrations: TpMigrationStatus,
    sqlMigrations: SqlMigrationStatus = unevaluatedSql
  ): ReadinessOutcome => ({
    ready: false,
    error,
    migrations,
    sqlMigrations,
    seeded: false,
    shouldExitProcess: deps.isProduction,
  });

  // ── 1. Schema ───────────────────────────────────────────────────────────
  const initResult = await deps.initializeSchema();
  if (!initResult.success) {
    const detail = initResult.message || 'Database initialization failed';
    deps.logger.error(`[Readiness] Schema initialization failed: ${detail}`);
    return notReady(detail, { state: 'pending', detail: null });
  }
  deps.logger.info(`[Readiness] Schema initialized: ${initResult.message ?? 'ok'}`);

  // ── 2. Migrations (gate readiness; never deferred) ──────────────────────
  if (deps.migrationsDisabled) {
    // An operator may choose to skip migrations, but that choice must NOT
    // open the app for traffic: the schema is unverified, so readiness stays
    // false, nothing is seeded, and every business route keeps returning 503.
    // Turning this into `ready: true` would be exactly the bypass the whole
    // gate exists to prevent — an app serving traffic on an unmigrated schema.
    const detail = 'DISABLE_TP_MIGRATIONS=true — migrations skipped; schema unverified';
    deps.logger.error(
      `[Readiness] ${detail}. Refusing readiness: /api/ready and /api/health/migrations report 503 ` +
        'and no business route is served. Unset DISABLE_TP_MIGRATIONS to start normally.'
    );
    return notReady(detail, { state: 'disabled_by_operator', detail });
  }

  let migResult: MigrationResult;
  try {
    migResult = await deps.runMigrations();
  } catch (err: any) {
    const detail = `Migration runner threw: ${String(err?.message || err)}`;
    deps.logger.error(`[Readiness] ${detail}`);
    if (deps.alert) await deps.alert('Table Platform migration failed', detail).catch(() => {});
    return notReady(detail, { state: 'failed', detail });
  }

  if (migResult.failed) {
    const detail = `Table Platform migration failed on ${migResult.failedFile ?? 'unknown file'}: ${migResult.failed}`;
    deps.logger.error(
      `[Readiness] ${detail}. Rolled back and NOT recorded as applied, so a restart retries it. ` +
        'Refusing readiness; template seeding skipped.'
    );
    if (deps.alert) await deps.alert('Table Platform migration failed', detail).catch(() => {});
    return notReady(detail, { state: 'failed', detail });
  }

  if (migResult.checksumMismatches.length > 0) {
    // runMigrations is fail-closed here and applied nothing, but be explicit.
    const detail = `Migration checksum drift: ${migResult.checksumMismatches.join(', ')}`;
    deps.logger.error(`[Readiness] ${detail}`);
    if (deps.alert) await deps.alert('Migration checksum drift', detail).catch(() => {});
    return notReady(detail, { state: 'failed', detail });
  }

  const migrations: TpMigrationStatus = {
    state: 'ok',
    detail: `${migResult.applied} applied, ${migResult.skipped} already up to date`,
  };
  deps.logger.info(`[Readiness] Table Platform migrations: ${migrations.detail}`);

  // ── 2b. SQL chain (schema_migrations) — the other ledger ────────────────
  // Readiness previously validated only the Table Platform ledger, so the app could report
  // "ready" while the SQL chain carried failed rows, skipped rows, pending migrations or
  // unexplained checksum drift. Evaluated ONCE here via the shared evaluator (the same one the
  // release gate uses) and stored on the receipt; endpoints serve the receipt, never re-evaluate.
  let sqlMigrations: SqlMigrationStatus = unevaluatedSql;
  if (deps.evaluateSqlChain) {
    let evaluation: SqlChainEvaluation;
    try {
      evaluation = await deps.evaluateSqlChain();
    } catch (err: any) {
      const detail = `SQL chain evaluation threw: ${String(err?.message || err)}`;
      deps.logger.error(`[Readiness] ${detail}`);
      return notReady(detail, migrations, { ...unevaluatedSql, detail });
    }
    sqlMigrations = {
      state: evaluation.state,
      failed: evaluation.failed.length,
      skipped: evaluation.skipped.length,
      pending: evaluation.pending.length,
      unexplainedDrift: evaluation.unexplainedDrift.length,
      approvedVariants: evaluation.approvedVariants.length,
      attestedLegacyVariants: evaluation.attestedLegacyVariants.length,
      detail: evaluation.detail,
    };
    if (!isSqlChainAcceptable(evaluation)) {
      const detail = `SQL migration chain not acceptable (${evaluation.state}): ${evaluation.detail}`;
      deps.logger.error(`[Readiness] ${detail}. Refusing readiness.`);
      if (deps.alert) await deps.alert('SQL migration chain not acceptable', detail).catch(() => {});
      return notReady(detail, migrations, sqlMigrations);
    }
    deps.logger.info(`[Readiness] SQL chain: ${evaluation.detail}`);
  } else {
    // No evaluator supplied is itself an incomplete proof — fail closed rather than assume ok.
    const detail = 'SQL chain evaluator not configured — cannot prove the chain state';
    deps.logger.error(`[Readiness] ${detail}. Refusing readiness.`);
    return notReady(detail, migrations, { ...unevaluatedSql, detail });
  }

  // ── 3. Seeding — only after migrations succeeded ────────────────────────
  let seeded = false;
  try {
    await deps.seedTemplates();
    seeded = true;
  } catch (seedErr: any) {
    // Seeding is best-effort and does not gate readiness.
    deps.logger.warn(`[Readiness] Template seeding skipped: ${String(seedErr?.message || seedErr)}`);
  }

  return { ready: true, error: null, migrations, sqlMigrations, seeded, shouldExitProcess: false };
}

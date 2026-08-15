/**
 * pgTransaction.ts — genuinely atomic Postgres transactions on a single
 * pinned client.
 *
 * WHY THIS EXISTS (BLOKER 1, Meeting Core wave 2)
 * ------------------------------------------------
 * `DbPromise.transaction()` (server/src/utils/DbPromise.ts:429-452) does
 * NOT guarantee atomicity: every `run()` call goes through `pool.query()`,
 * which checks out a (possibly different) client from the pool per call —
 * BEGIN/COMMIT/statements can land on different physical connections.
 * There is no `pool.connect()` anywhere in server/src/database or
 * server/src/utils. `DbPromise` also defaults `fallback: true`, which
 * SWALLOWS errors and resolves with an empty/failed-but-not-thrown result —
 * exactly the failure mode this module refuses to have.
 *
 * This module pins ONE client (`pool.connect()`) for the lifetime of the
 * transaction, issues BEGIN/COMMIT/ROLLBACK on that same client, and always
 * releases it in `finally`. Errors are NEVER swallowed: a failure inside the
 * callback (or in COMMIT itself) triggers a ROLLBACK attempt and then
 * RE-THROWS the original error unchanged. A ROLLBACK failure is logged but
 * never replaces or hides the original error.
 *
 * POOL SOURCING
 * --------------
 * The production pool in server/src/database/PostgresDatabase.ts is built by
 * a private, unexported `getPool()` — this feature's write area does not
 * include that file, so it cannot be reused directly. Two ways to get a pool
 * here:
 *   (a) pass one explicitly via the `pool` argument — this is how tests
 *       inject the scratch-PG pool (tests/meeting-core/pg/scratchPg.ts);
 *   (b) omit it and let this module lazily build its OWN pool from the same
 *       `DatabaseConfig.ts` config PostgresDatabase.ts uses (production
 *       default). This is a second, independent `pg.Pool` instance talking
 *       to the same physical database — not the same connections as the
 *       app's main pool, but that's safe: multiple pools against one
 *       Postgres database is a normal, supported pattern, and a COMMIT on
 *       this pool is immediately visible to any other pool/connection.
 *
 * The (b) path uses a *dynamic* `import()` inside the lazy getter, never a
 * static top-level import of `DatabaseConfig.js`. `DatabaseConfig.ts`
 * validates environment variables at import time and can call
 * `process.exit(1)` on misconfiguration — that must never fire just because
 * some other module happened to import `pgTransaction.ts` (in particular:
 * the isolated `tests/meeting-core/domain/**` scratch-PG test suite, which
 * always supplies its own pool and must never touch this lazy path).
 */

import { Pool } from 'pg';
import type { PoolClient } from 'pg';

let lazyDefaultPool: Pool | null = null;
let lazyDefaultPoolPromise: Promise<Pool> | null = null;

async function buildDefaultPool(): Promise<Pool> {
  // Dynamic on purpose — see module docstring. DatabaseConfig.ts is the same
  // config source PostgresDatabase.ts's private getPool() reads
  // (`databaseConfig.postgres`), so the production pool built here has
  // identical connection settings to the app's main pool.
  const { default: databaseConfig } = await import('../config/DatabaseConfig.js');
  const pool = new Pool(databaseConfig.postgres as ConstructorParameters<typeof Pool>[0]);
  pool.on('error', (err: Error) => {
    // Mirror PostgresDatabase.ts's own pool.on('error', ...) handler: a
    // pool-level error on an idle client must never crash the process.
    // eslint-disable-next-line no-console
    console.error('[pgTransaction] Unexpected error on idle client:', err.message);
  });
  return pool;
}

async function getDefaultPool(): Promise<Pool> {
  if (lazyDefaultPool) return lazyDefaultPool;
  if (!lazyDefaultPoolPromise) {
    lazyDefaultPoolPromise = buildDefaultPool().then((pool) => {
      lazyDefaultPool = pool;
      return pool;
    });
  }
  return lazyDefaultPoolPromise;
}

/**
 * Runs `fn` inside BEGIN/COMMIT on a single pinned client.
 *
 * - Success: COMMIT, client released, `fn`'s return value resolved.
 * - Failure (fn throws, or COMMIT itself throws): ROLLBACK is attempted on
 *   the SAME client, then the ORIGINAL error is re-thrown. A rollback
 *   failure is logged to stderr but never swallows or replaces the real
 *   error — callers always see the true failure reason.
 * - The client is released in `finally` regardless of outcome.
 *
 * @param fn   receives the pinned `PoolClient` — every statement inside must
 *             be issued on THIS client (not on `pool` or any other client)
 *             to stay inside the transaction.
 * @param pool inject the scratch-PG pool in tests. Omit in production code
 *             to use the lazily-built default pool.
 */
export async function withPgTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  pool?: Pool
): Promise<T> {
  const resolvedPool = pool ?? (await getDefaultPool());
  const client = await resolvedPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      const detail = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
      // eslint-disable-next-line no-console
      console.error(
        `[pgTransaction] ROLLBACK itself failed (original error still thrown): ${detail}`
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Resolves the pool to use for a single non-transactional statement (plain
 * reads, or writes that don't need multi-statement atomicity). Same pool
 * resolution rules as `withPgTransaction`.
 */
export async function resolvePgPool(pool?: Pool): Promise<Pool> {
  return pool ?? getDefaultPool();
}

/**
 * Test-only escape hatch: disposes of the lazily-built default pool so a
 * test process can exit cleanly. No-op if the default pool was never built
 * (true for tests/meeting-core/domain/**, which always inject their own
 * scratch-PG pool and never touch the default-pool path).
 */
export async function __closeDefaultPoolForTests(): Promise<void> {
  if (lazyDefaultPool) {
    const p = lazyDefaultPool;
    lazyDefaultPool = null;
    lazyDefaultPoolPromise = null;
    await p.end();
  }
}

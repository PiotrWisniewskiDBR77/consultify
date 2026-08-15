/**
 * A REAL PostgreSQL transaction, on ONE pinned connection.
 *
 * ★ WHY THIS MODULE EXISTS
 * ------------------------
 * `DbPromise.transaction([...])` is NOT a transaction on PostgreSQL. It issues
 * BEGIN, each statement, and COMMIT as SEPARATE `run()` calls, and
 * `PostgresDatabase.executeWithLogging` sends every one of them through
 * `pool.query()` — which checks out an ARBITRARY idle client from the pool. So
 * the BEGIN may run on client A, the first upsert on client B, and the COMMIT on
 * client C: each statement autocommits where it lands and the trailing ROLLBACK
 * rolls back nothing. There is no `pool.connect()` anywhere in the adapter
 * (verified by reading `PostgresDatabase.ts`), so there is no way to pin a
 * client through it. On SQLite (one connection) the same code IS transactional,
 * which is exactly how this defect stays invisible in tests.
 *
 * This module gives a caller the missing primitive: check out ONE client, run
 * BEGIN / work / COMMIT on THAT client, and ROLLBACK on THAT SAME client when
 * anything throws.
 *
 * ★ WHY IT OWNS A SEPARATE POOL
 * -----------------------------
 * The adapter keeps its `pg.Pool` in a module-private variable and exports no
 * accessor. Reaching into it would mean changing shared infrastructure that many
 * other callers depend on. So this module builds its own SMALL pool (max 2) from
 * the SAME `DatabaseConfig` the adapter uses — same host, same credentials, same
 * database — and reuses it across calls. It is a second pool, not a second
 * source of truth. When the adapter grows a real pinned-transaction API this
 * module should be deleted in favour of it.
 *
 * ★ HONEST UNAVAILABILITY
 * -----------------------
 * Where no PostgreSQL is configured (the SQLite test seam, a mocked
 * `DbPromise`), `withPinnedPgTransaction` returns `{ available: false, reason }`
 * instead of pretending. A caller that falls back MUST report that it fell back;
 * claiming a guarantee that was not provided is worse than not having it.
 *
 * ★ THREE STATES, BECAUSE A FAILED `COMMIT` IS NOT A ROLLBACK
 * -----------------------------------------------------------
 * An earlier cut of this module treated ANY error out of `client.query('COMMIT')`
 * as `committed: false`. That is a GUESS dressed as a fact. `COMMIT` is the one
 * statement whose failure is genuinely ambiguous: the client learns the outcome
 * only from the server's reply, so if the connection dies while the reply is in
 * flight — or, as PostgreSQL's own `SyncRepWaitForLSN` does on termination,
 * commits locally and then sets `whereToSendOutput = DestNone` so no reply is
 * ever sent — the transaction IS committed and the client will never know it.
 * Telling an operator "rolled back, nothing changed" about a database that
 * changed is the worst possible failure of this module.
 *
 * So the outcome is a THREE-state value:
 *
 *   `rolled_back`    — there is EVIDENCE the transaction did not take effect:
 *                      the work threw and ROLLBACK was issued; BEGIN itself
 *                      failed; the connection was already known-dead before the
 *                      COMMIT was dispatched (so it cannot have reached the
 *                      server); or the SERVER ITSELF answered the COMMIT with an
 *                      ordinary ERROR response, which only ever means it aborted.
 *   `committed`      — the server acknowledged the COMMIT.
 *   `indeterminate`  — the COMMIT was dispatched and no answer came back. The
 *                      database may or may not carry the writes. The caller MUST
 *                      reconcile (re-read on a FRESH connection) rather than
 *                      report either outcome.
 */
import { createHash } from 'node:crypto';

import type { Client, ClientConfig, Pool, PoolClient, PoolConfig } from 'pg';

import logger from './Logger.js';

export interface PinnedPgQueryResult<T> {
  rows: T[];
  rowCount: number;
}

/** The pinned connection, exposed as the narrowest surface that does the job. */
export interface PinnedPgClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<PinnedPgQueryResult<T>>;
}

/**
 * How a pinned transaction ENDED.
 *
 * `indeterminate` is a real, reachable state — not a defensive placeholder. It
 * is the only honest answer when the COMMIT was sent and no reply came back.
 */
export type PinnedTxState = 'committed' | 'rolled_back' | 'indeterminate';

export type PinnedPgTransactionOutcome<T> =
  /** BEGIN ... COMMIT completed on one pinned client, acknowledged by the server. */
  | { available: true; state: 'committed'; value: T }
  /** There is EVIDENCE the transaction did not take effect. Nothing was written. */
  | { available: true; state: 'rolled_back'; error: string }
  /**
   * The COMMIT was dispatched and the outcome is UNKNOWN. The caller must
   * reconcile against the database on a fresh connection before it says
   * anything at all about what the database now contains.
   */
  | { available: true; state: 'indeterminate'; error: string }
  /** No PostgreSQL pool could be built — the caller must fall back AND say so. */
  | { available: false; reason: string };

let pinnedPool: Pool | null = null;

/**
 * Why a pinned PostgreSQL transaction cannot be used right now, or `null` when
 * it can. Deliberately reads `process.env` DIRECTLY rather than importing
 * `DatabaseConfig`: `getDatabaseType()` calls `process.exit(1)` when no database
 * is configured, and this predicate must be safe to ask in a unit test that has
 * mocked the database away entirely.
 */
export function pinnedPgUnavailableReason(): string | null {
  const declaredType = String(process.env.DB_TYPE || '')
    .trim()
    .toLowerCase();
  if (declaredType && declaredType !== 'postgres' && declaredType !== 'postgresql') {
    return `DB_TYPE=${declaredType} — not a PostgreSQL target`;
  }
  const hasTarget = Boolean(
    process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || process.env.DB_HOST
  );
  if (!hasTarget) {
    return 'no PostgreSQL connection is configured (DATABASE_URL / DB_HOST unset)';
  }
  return null;
}

interface PgModule {
  Pool?: new (config?: PoolConfig) => Pool;
  Client?: new (config?: ClientConfig) => Client;
  default?: {
    Pool: new (config?: PoolConfig) => Pool;
    Client: new (config?: ClientConfig) => Client;
  };
}

/**
 * The SAME connection settings the adapter uses.
 *
 * Asked for late rather than at import time, so this module does not force
 * `DatabaseConfig` to load (and possibly `process.exit(1)`) merely by being
 * imported.
 *
 * ★ IT IS NOT RE-READ PER CALL, and no caller may assume it is:
 * `getDatabaseConfig()` MEMOISES its result in a module-private variable and
 * exports no reset, so the FIRST call in the process fixes the target for the
 * whole process. Measured 2026-08-01, while trying to point a reconciliation at
 * a dead port from a test: `process.env.DATABASE_URL` had already been consumed
 * and the connection went to the original host regardless.
 */
async function resolvePgConnectionConfig(): Promise<PoolConfig> {
  const configModule = await import('../config/DatabaseConfig.js');
  return configModule.getDatabaseConfig().postgres as PoolConfig;
}

async function getPinnedPool(): Promise<Pool> {
  if (pinnedPool) return pinnedPool;

  const pgModule = (await import('pg')) as unknown as PgModule;
  const PoolCtor = pgModule.Pool || pgModule.default?.Pool;
  if (!PoolCtor) throw new Error('pg.Pool constructor is not available');

  const base = await resolvePgConnectionConfig();

  pinnedPool = new PoolCtor({
    ...base,
    // One transaction at a time is the whole point; a second slot only exists so
    // a caller that nests reads does not deadlock against itself.
    max: 2,
    idleTimeoutMillis: 10_000,
    // A script or a test must be able to exit without an explicit pool teardown.
    allowExitOnIdle: true,
  } as PoolConfig);

  pinnedPool.on('error', (error: Error) => {
    logger.error(`[pinnedPgTransaction] idle client error: ${error.message}`);
  });
  // Mirror the adapter's own connect hook so a pinned statement resolves the
  // same identifiers as the same statement run through `DbPromise`.
  pinnedPool.on('connect', (client: PoolClient) => {
    client.query('SET search_path TO public, v8').catch(() => {
      /* schema `v8` is absent on some targets; the adapter tolerates this too */
    });
  });

  return pinnedPool;
}

/** Close the pool this module owns. For scripts and test teardown. */
export async function closePinnedPgPool(): Promise<void> {
  const current = pinnedPool;
  pinnedPool = null;
  if (!current) return;
  try {
    await current.end();
  } catch (error) {
    logger.warn(`[pinnedPgTransaction] pool close failed: ${(error as Error)?.message}`);
  }
}

/**
 * Translate SQLite-style `?` placeholders into `$1, $2, ...`.
 *
 * Narrow on purpose: it does NOT parse string literals, so it must only be used
 * on SQL this codebase authored and whose only `?` are bind placeholders. The
 * general-purpose parser lives in `PostgresDatabase.replacePositionalPlaceholders`;
 * duplicating it here would be a second thing to keep in sync.
 */
export function toNumberedPlaceholders(sql: string): string {
  if (/\$\d+/.test(sql)) return sql;
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/**
 * A stable, collision-resistant `bigint` key for `pg_advisory_xact_lock`.
 * Returned as a decimal STRING so no precision is lost through JS numbers.
 */
export function advisoryLockKey(seed: string): string {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 16);
  return BigInt.asIntN(64, BigInt(`0x${digest}`)).toString();
}

/**
 * SQLSTATEs that, delivered in answer to a `COMMIT`, can ONLY mean the server
 * aborted the transaction. This is an ALLOW-LIST, and it is deliberately tiny.
 *
 * ★ WHY AN ALLOW-LIST AND NOT AN EXCLUSION LIST.
 * The previous cut accepted any parsed SQLSTATE except classes `08` and `57P0`.
 * That is backwards: it makes every SQLSTATE that has never been thought about
 * default to "rolled back, nothing changed" — the single worst thing this module
 * can say. Measured on that version: `{severity:'PANIC', code:'XX000'}` and
 * `{severity:'FATAL', code:'53200'}` both came back `rolled_back`. The first one
 * is `PANIC: cannot abort transaction %u, it was already committed`, which the
 * server raises PRECISELY BECAUSE the commit stands — the exclusion list turned
 * proof of a commit into a report of a rollback. Under an allow-list an
 * unforeseen code costs one reconciliation read instead of a false statement
 * about a changed database.
 *
 *   - class `23` — integrity constraint violation. A DEFERRED constraint is
 *     checked at COMMIT; when it fires the server aborts the transaction and
 *     says so. This is the ordinary, expected member.
 *   - `40001` serialization_failure — SERIALIZABLE/REPEATABLE READ conflicts are
 *     detected at commit time and the transaction is aborted by definition.
 *   - `40P01` deadlock_detected — the deadlock detector's whole action is to
 *     abort one of the transactions; the one that is told is the one aborted.
 *   - `55P03` lock_not_available — `NOWAIT`/`lock_timeout` refuses the statement
 *     and the enclosing transaction is aborted; it cannot leave a commit behind.
 *
 * Everything else at COMMIT — including FATAL/PANIC, class `08`, `57P0x`
 * shutdowns, `53200` out-of-memory, `XX000` internal error — is `indeterminate`.
 *
 * ★ `severity` IS NOT CONSULTED. `pg-protocol` parses field `S` of the
 * `ErrorResponse`, which the server LOCALIZES: under `lc_messages='pl_PL'` it is
 * `BŁĄD`, not `ERROR`. Any test on that string is a test of the server's locale.
 * SQLSTATE (field `C`) is never translated, so it is the only stable signal —
 * and membership in this list already implies the error came from a server,
 * because no Node socket error carries one of these codes.
 */
const COMMIT_ABORT_SQLSTATES = new Set(['40001', '40P01', '55P03']);

/**
 * Did the SERVER ITSELF abort at `COMMIT`?
 *
 * ★ THIS IS THE ONLY INDEPENDENT EVIDENCE THAT A FAILED `COMMIT` ROLLED BACK.
 * Returns the SQLSTATE when the answer can only mean "aborted", and `null` for
 * everything else — which routes to `indeterminate` and a reconciliation read.
 */
function serverRejectionCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  // SQLSTATE is exactly five characters of [0-9A-Z]. A Node socket code
  // (`ECONNRESET`, `EPIPE`) fails this shape and is not in the set either.
  if (typeof code !== 'string' || !/^[0-9A-Z]{5}$/.test(code)) return null;
  if (code.startsWith('23')) return code;
  if (COMMIT_ABORT_SQLSTATES.has(code)) return code;
  return null;
}

/**
 * Run `fn` inside `BEGIN ... COMMIT` on ONE checked-out client.
 *
 * - Anything `fn` throws -> `ROLLBACK` on the SAME client, `state: 'rolled_back'`.
 * - A COMMIT the SERVER rejected -> `rolled_back` (see `serverRejectionCode`).
 * - A COMMIT that got no answer -> `indeterminate`. NEVER `rolled_back`.
 * - The client is released in a `finally`, so a thrown ROLLBACK cannot leak it.
 * - Never throws: the caller gets a discriminated union and decides.
 */
export async function withPinnedPgTransaction<T>(
  fn: (client: PinnedPgClient) => Promise<T>
): Promise<PinnedPgTransactionOutcome<T>> {
  const unavailable = pinnedPgUnavailableReason();
  if (unavailable) return { available: false, reason: unavailable };

  let pool: Pool;
  try {
    pool = await getPinnedPool();
  } catch (error) {
    return {
      available: false,
      reason: `pool unavailable: ${(error as Error)?.message || 'unknown error'}`,
    };
  }

  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (error) {
    return {
      available: false,
      reason: `connect failed: ${(error as Error)?.message || 'unknown error'}`,
    };
  }

  // ★ A CHECKED-OUT CLIENT HAS NO ERROR LISTENER OF ITS OWN.
  //
  // `pg.Pool` attaches its `idleListener` only while a client sits IDLE and
  // removes it on checkout — so if the connection dies mid-transaction (the
  // server restarts, an operator runs `pg_terminate_backend`, the network
  // drops), the client emits `'error'` with nothing listening and Node turns
  // that into an UNCAUGHT EXCEPTION that takes the process down. Measured, not
  // theorised: the real-PostgreSQL rollback test that kills its own backend
  // before COMMIT produced exactly this, and the transaction result itself was
  // perfectly correct. Losing the process is a far louder failure than the
  // failed transaction it accompanies.
  //
  // So the seam listens for the duration of the checkout, remembers the error,
  // and hands it to `release()` — which is how `pg` is told to DESTROY the
  // client instead of returning a corpse to the pool.
  //
  // ★ It is also the EVIDENCE that separates `rolled_back` from `indeterminate`:
  // a connection error observed BEFORE the COMMIT was dispatched proves the
  // COMMIT never reached the server, so the server discarded the open
  // transaction. Hence the mutable holder rather than a plain `let` — the value
  // is read back at the COMMIT, not just at release.
  const conn: { error: Error | null; discard: Error | null } = { error: null, discard: null };
  const onClientError = (error: Error): void => {
    conn.error = error;
    logger.error(
      `[pinnedPgTransaction] pinned client connection error: ${error?.message || 'unknown error'}` +
        ' — the transaction cannot commit and the client will be destroyed'
    );
  };
  client.on('error', onClientError);

  const pinned: PinnedPgClient = {
    async query<R = unknown>(sql: string, params: unknown[] = []) {
      const result = await client.query(toNumberedPlaceholders(sql), params as unknown[]);
      return { rows: (result.rows || []) as R[], rowCount: result.rowCount ?? 0 };
    },
  };

  try {
    await client.query('BEGIN');
    let value: T;
    try {
      value = await fn(pinned);
    } catch (error) {
      // ★ ROLLBACK on the SAME client — that is the whole guarantee. A rollback
      // sent through the pool would land on some other connection and undo
      // nothing at all.
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // ★ THE LOG LINE BELOW HAS TO BE TRUE. It says the connection is
        //   discarded, and the ONLY thing that makes it true is handing
        //   `release()` a destroy argument. Measured on the previous cut: a
        //   ROLLBACK failing with a non-connection error left `conn.error` and
        //   `conn.discard` both null, so `release(undefined)` returned a LIVE
        //   client — with an OPEN transaction — to the pool. The next
        //   `withPinnedPgTransaction` then ran its BEGIN inside that transaction
        //   and its COMMIT could commit writes this call already reported
        //   `rolled_back`. Recording the failure here is what closes that.
        conn.discard =
          rollbackError instanceof Error
            ? rollbackError
            : new Error(String((rollbackError as { message?: unknown })?.message ?? rollbackError));
        logger.error(
          `[pinnedPgTransaction] ROLLBACK failed: ${(rollbackError as Error)?.message}` +
            ' — the connection is discarded, so the transaction still aborts'
        );
      }
      return {
        available: true,
        state: 'rolled_back',
        error: (error as Error)?.message || 'unknown transaction error',
      };
    }

    // ★ SNAPSHOT THE EVIDENCE BEFORE DISPATCHING THE COMMIT. Read afterwards it
    // would be worthless: the very failure we are classifying sets it.
    const deadBeforeCommit = conn.error;
    try {
      await client.query('COMMIT');
    } catch (error) {
      const message = (error as Error)?.message || 'unknown error';

      if (deadBeforeCommit) {
        // The connection was already broken when we tried to send. Nothing left
        // the process, so the server never saw a COMMIT and discarded the open
        // transaction when the backend went away.
        return {
          available: true,
          state: 'rolled_back',
          error:
            `COMMIT was never sent: the connection had already failed ` +
            `(${deadBeforeCommit.message}); the server discards an open transaction ` +
            `whose backend is gone. Reported failure: ${message}`,
        };
      }

      const sqlState = serverRejectionCode(error);
      if (sqlState) {
        return {
          available: true,
          state: 'rolled_back',
          error: `COMMIT rejected by the server (SQLSTATE ${sqlState}): ${message}`,
        };
      }

      // ★ NO ANSWER CAME BACK. Do NOT send a ROLLBACK "just in case" and do NOT
      // call this a rollback: if the server committed and only the
      // acknowledgement was lost, both would be lies about a changed database.
      conn.discard = error instanceof Error ? error : new Error(message);
      return {
        available: true,
        state: 'indeterminate',
        error:
          `COMMIT outcome UNKNOWN — the statement was sent and no answer came back: ${message}. ` +
          `The transaction may or may not have committed; re-read the affected rows on a ` +
          `fresh connection before asserting anything about them.`,
      };
    }

    return { available: true, state: 'committed', value };
  } catch (error) {
    // BEGIN itself failed: nothing was started, nothing to roll back.
    return {
      available: true,
      state: 'rolled_back',
      error: `BEGIN failed: ${(error as Error)?.message || 'unknown error'}`,
    };
  } finally {
    client.removeListener('error', onClientError);
    // ★ A truthy argument tells `pg` to DESTROY this client rather than return
    // it to the pool. It is passed whenever ANYTHING left this connection in a
    // state the next caller must not inherit:
    //   - `conn.error`   — the connection itself died;
    //   - `conn.discard` — the COMMIT vanished into it, OR the ROLLBACK did not
    //                      succeed, which means a transaction may still be OPEN
    //                      on this socket.
    // `undefined` — an ordinary return to the pool — is reserved for the paths
    // that ended the transaction cleanly (COMMIT acknowledged, or ROLLBACK
    // acknowledged). Getting this wrong is not a leak, it is a correctness bug:
    // a live client with an open transaction lets the NEXT caller's COMMIT
    // commit writes this call already reported as rolled back.
    const destroy = conn.error ?? conn.discard;
    client.release(destroy ?? undefined);
  }
}

export type FreshPgConnectionOutcome<T> =
  | { available: false; reason: string }
  | { available: true; ok: true; value: T }
  | { available: true; ok: false; error: string };

/**
 * Run `fn` on a BRAND-NEW connection — not a pooled one, not the pinned one.
 *
 * ★ WHY NOT THE POOL. This exists for exactly one job: finding out what the
 * database really contains after a COMMIT whose outcome is unknown. The pool
 * that carried the ambiguous transaction is the least trustworthy place to ask
 * — it may hand back a client whose socket is half-dead, or one still parked
 * behind the same broken TCP path. A fresh `Client`, connected now, answers the
 * question the reconciliation is actually asking.
 *
 * Read-only by convention: it opens no transaction of its own, so unless `fn`
 * issues its own BEGIN (which it may — a reconciliation that must hold a lock
 * across two statements has to) every statement autocommits. Never throws.
 *
 * ★ EVERY WAIT IS BOUNDED, ON BOTH SIDES.
 * The caller is a recovery path reached because a connection stopped answering,
 * so "the socket is black-holed" is the EXPECTED input, not a remote one. With
 * only `connectionTimeoutMillis` set, a connect that succeeds and then goes
 * silent makes `client.query` — and the `client.end()` in the `finally` — wait
 * forever, and this function honours "never throws" by never returning at all.
 * A reconciliation that hangs is worse than one that fails: the operator gets no
 * verdict AND no error. So:
 *   - `query_timeout`   — a CLIENT-side timer, the only thing that fires when
 *                         packets simply stop arriving;
 *   - `statement_timeout` — the SERVER-side cap, so a query that did arrive
 *                         cannot keep running after we stopped waiting for it;
 *   - `idle_in_transaction_session_timeout` — `fn` may open a transaction, and
 *                         an abandoned one would hold locks against everyone.
 */
const FRESH_CONNECTION_TIMEOUT_MS = 15_000;

export async function withFreshPgConnection<T>(
  fn: (client: PinnedPgClient) => Promise<T>
): Promise<FreshPgConnectionOutcome<T>> {
  const unavailable = pinnedPgUnavailableReason();
  if (unavailable) return { available: false, reason: unavailable };

  let ClientCtor: new (config?: ClientConfig) => Client;
  let base: PoolConfig;
  try {
    const pgModule = (await import('pg')) as unknown as PgModule;
    const ctor = pgModule.Client || pgModule.default?.Client;
    if (!ctor) throw new Error('pg.Client constructor is not available');
    ClientCtor = ctor;
    base = await resolvePgConnectionConfig();
  } catch (error) {
    return {
      available: false,
      reason: `fresh connection unavailable: ${(error as Error)?.message || 'unknown error'}`,
    };
  }

  const client = new ClientCtor({
    ...(base as ClientConfig),
    connectionTimeoutMillis: 10_000,
    // Client-side: fires even when nothing at all comes back off the socket.
    query_timeout: FRESH_CONNECTION_TIMEOUT_MS,
    // Server-side, sent in the startup packet so it is in force for the FIRST
    // statement rather than for everything after a `SET` that could itself hang.
    statement_timeout: FRESH_CONNECTION_TIMEOUT_MS,
    idle_in_transaction_session_timeout: FRESH_CONNECTION_TIMEOUT_MS,
  } as ClientConfig);
  // Same reason as the pinned client: an unhandled `'error'` on a `pg` client is
  // an uncaught exception that takes the process down.
  client.on('error', (error: Error) => {
    logger.error(`[pinnedPgTransaction] fresh connection error: ${error?.message}`);
  });

  try {
    await client.connect();
  } catch (error) {
    return {
      available: false,
      reason: `fresh connect failed: ${(error as Error)?.message || 'unknown error'}`,
    };
  }

  try {
    try {
      await client.query('SET search_path TO public, v8');
    } catch {
      /* schema `v8` is absent on some targets; the adapter tolerates this too */
    }
    const pinned: PinnedPgClient = {
      async query<R = unknown>(sql: string, params: unknown[] = []) {
        const result = await client.query(toNumberedPlaceholders(sql), params as unknown[]);
        return { rows: (result.rows || []) as R[], rowCount: result.rowCount ?? 0 };
      },
    };
    const value = await fn(pinned);
    return { available: true, ok: true, value };
  } catch (error) {
    return {
      available: true,
      ok: false,
      error: (error as Error)?.message || 'unknown error',
    };
  } finally {
    await endFreshClientBounded(client);
  }
}

/**
 * Close a fresh client WITHOUT the possibility of waiting forever.
 *
 * `client.end()` resolves when the peer closes the socket. Against a black-holed
 * connection — the exact condition that sent us down this path — that is a TCP
 * timeout away, i.e. minutes, and it happens inside a `finally` that the caller
 * is already awaiting. So the orderly close gets a bounded window and the socket
 * is then torn down locally either way.
 */
async function endFreshClientBounded(client: Client): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      client.end(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 5_000);
        timer.unref?.();
      }),
    ]);
  } catch {
    /* a connection that already died needs no orderly close */
  } finally {
    if (timer) clearTimeout(timer);
  }
  // Idempotent: on the ordinary path the stream is already destroyed.
  try {
    (
      client as unknown as { connection?: { stream?: { destroy?: () => void } } }
    ).connection?.stream?.destroy?.();
  } catch {
    /* nothing left to tear down */
  }
}

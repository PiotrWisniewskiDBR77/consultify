/**
 * FIN-005 — a NARROW pinned-connection transaction adapter for the Atelier
 * Finance promotion phase.
 *
 * ===========================================================================
 * WHY THIS MODULE EXISTS
 * ===========================================================================
 * The demo seed promotes five rows to READY (three statements, the analysis,
 * the pack). Either all five are promoted or none is; a fixture holding two
 * READY statements and one pending is a lie the Finance UI will happily show.
 *
 * `DbPromise` cannot express that. `DbPromise.transaction()` accepts only a
 * fixed list of pre-built SQL strings and never yields a connection handle, and
 * every `DbPromise.run()` goes through `pool.query()`, which picks an arbitrary
 * idle connection per call — so `BEGIN`, the writes and `COMMIT` are not even
 * guaranteed to reach the same backend. The seed's previous answer was
 * "verify everything, then issue the five UPDATEs, and compensate on error",
 * which is sound defence-in-depth but is not atomicity: a process killed
 * between two UPDATEs leaves the fixture half-promoted (repaired only by the
 * next run's self-heal).
 *
 * This adapter is the real primitive. It is deliberately NOT a general
 * transaction utility and NOT an extension of `DbPromise`.
 *
 * ===========================================================================
 * WHAT `runPinnedPromotionTransaction` GUARANTEES
 * ===========================================================================
 *   1. One `pg` `PoolClient`, checked out for the whole call. `BEGIN`, every
 *      lock, every read the callbacks issue, every write, the final read-back
 *      and `COMMIT`/`ROLLBACK` all run on THAT client.
 *   2. Before anything else it takes `SELECT id … WHERE id = ANY($1) FOR UPDATE`
 *      row locks on exactly the ids named in `lock`, in the given order. A
 *      concurrent writer touching those rows blocks until this transaction
 *      ends.
 *   3. `plan(read)` then runs INSIDE the transaction, over the LOCKED rows —
 *      so the verdict that decides "may these rows be promoted" is computed on
 *      the same snapshot the writes will apply to, not on rows somebody may
 *      have changed in between.
 *   4. Every write returned by `plan` is applied on the same client. Then
 *      `verify(read)` re-reads the rows on that client. Only if it agrees does
 *      `COMMIT` run.
 *   5. ANY error, refusal from `plan`, or refusal from `verify` ⇒ `ROLLBACK` on
 *      the same client. No write survives. Postgres itself is the enforcement:
 *      even if this process dies before the `ROLLBACK` is sent, the backend
 *      aborts the uncommitted transaction when the connection drops.
 *   6. The client is released exactly once, in a `finally`, whatever happens.
 *   7. Bounded time. `statement_timeout` and
 *      `idle_in_transaction_session_timeout` are set on the pinned session, and
 *      the checkout itself is raced against `connectTimeoutMs`. A hung backend
 *      or an exhausted pool ends the call with an error instead of hanging.
 *
 * ===========================================================================
 * WHAT IT DOES **NOT** GUARANTEE
 * ===========================================================================
 *   - It does NOT lock anything the caller did not name. In particular the
 *     Atelier caller locks the pack, the three statements and the analysis, but
 *     NOT `financial_statement_values`; a concurrent value edit is caught by
 *     the read-back verdict, not by a lock.
 *   - It does NOT retry. A serialization failure, a deadlock victim or a
 *     terminated backend surfaces as `status: 'rolled-back'`; re-running the
 *     seed is the retry.
 *   - It does NOT make the phase-1 writes transactional. Only the promotion is
 *     pinned; the fixture rows themselves are written before this runs.
 *   - It is NOT available everywhere — see the availability probe below. When
 *     it is not, the caller must fall back to its own compensating path. This
 *     module never silently pretends to have run.
 *   - A `COMMIT` that is issued but whose result never reaches this process
 *     (connection reset in the COMMIT round-trip) is reported as
 *     `'rolled-back'` while the database may in fact have committed. That is
 *     the classic in-doubt outcome, and it is safe here in one direction only:
 *     we may under-report success, never over-report it. The caller's next run
 *     converges (all five promoted = healthy fixture, left alone).
 *
 * ===========================================================================
 * AVAILABILITY — how "this is not a real pg connection" is detected
 * ===========================================================================
 * Tests mock the whole `DbPromise` module with an in-memory fake. If this
 * adapter grabbed a real pool in that situation, the caller's phase-1 rows
 * would live in the fake store while the promotion ran against a real database:
 * split brain, and far worse than no transaction at all.
 *
 * So availability is decided by asking THE SAME MODULE THE CALLER WRITES
 * THROUGH. `probePinnedTransactionSupport()` sends a Postgres-only expression
 * (`current_database()` / `pg_backend_pid()`) through `DbPromise.all`. Only a
 * genuine pg driver answers it with one row; the in-memory fake and the mock
 * database return nothing (or throw), and any non-pg driver cannot answer at
 * all. Only after that probe succeeds is a client checked out — so a mocked
 * test never opens a pool. The pinned client is then asked for
 * `current_database()` too and refuses to proceed if the names disagree.
 *
 * `unavailable` is logged at `error` level in production (a production seed run
 * SHOULD have a real connection; silently degrading is the failure mode this
 * whole packet exists to remove) and at `info`/`warn` elsewhere.
 */

import type { PoolClient } from 'pg';

import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

/** Row shape returned by every read inside the pinned transaction. */
export type PinnedRow = Record<string, unknown>;

/**
 * Run a query on the pinned connection. Accepts either `?` placeholders (they
 * are translated exactly like `DbPromise` does) or native `$n`.
 */
export type PinnedReader = (sql: string, params?: unknown[]) => Promise<PinnedRow[]>;

/** One promotion UPDATE, already built by the caller. */
export interface PinnedWrite {
  /** Stable label the caller uses to interpret `applied` (e.g. a row id). */
  label: string;
  sql: string;
  params: unknown[];
}

export type PinnedPlan = { ok: false; reason: string } | { ok: true; writes: PinnedWrite[] };

export interface PinnedLockRequest {
  table: string;
  /** Primary keys to lock. Every one of them must exist or the call refuses. */
  ids: string[];
}

export interface PinnedPromotionRequest {
  /** Rows to `SELECT … FOR UPDATE` before the plan runs. */
  lock: PinnedLockRequest[];
  /** Computes the verdict and the writes, over the LOCKED rows. */
  plan: (read: PinnedReader) => Promise<PinnedPlan>;
  /** Final read-back on the same client, after the writes, before COMMIT. */
  verify: (read: PinnedReader) => Promise<{ ok: boolean; reason?: string }>;
  /** Per-statement timeout on the pinned session. Default 15s. */
  statementTimeoutMs?: number;
  /** Ceiling on the pool checkout itself. Default 10s. */
  connectTimeoutMs?: number;
}

export type PinnedPromotionOutcome =
  /** No pinned connection could be used; the caller MUST use its own path. */
  | { mode: 'unavailable'; reason: string }
  | {
      mode: 'pinned';
      status: 'committed';
      /** Labels of the writes that were applied and committed. */
      applied: string[];
      backendPid: number | null;
    }
  | {
      mode: 'pinned';
      status: 'rolled-back';
      reason: string;
      /** Labels applied inside the transaction — all of them undone by ROLLBACK. */
      applied: string[];
      /** False when the ROLLBACK statement itself could not be sent. */
      rollbackIssued: boolean;
      backendPid: number | null;
    };

const DEFAULT_STATEMENT_TIMEOUT_MS = Number(process.env.DB_QUERY_TIMEOUT) || 15_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

/** Sentinel aliases chosen so no application table can collide with them. */
const PROBE_SQL =
  'SELECT current_database() AS pinned_probe_db, pg_backend_pid() AS pinned_probe_pid';

export interface PinnedSupportProbe {
  supported: boolean;
  reason: string;
  database: string | null;
}

/**
 * Ask the caller's own database module whether it is really talking to
 * PostgreSQL. See the AVAILABILITY note above for why the probe must go
 * through `DbPromise` and not through the pool.
 */
export async function probePinnedTransactionSupport(): Promise<PinnedSupportProbe> {
  try {
    const rows = await DbPromise.all<PinnedRow>(PROBE_SQL, [], {
      fallback: false,
      timeout: DEFAULT_CONNECT_TIMEOUT_MS,
    });
    if (!Array.isArray(rows) || rows.length !== 1) {
      return {
        supported: false,
        reason: `probe returned ${Array.isArray(rows) ? rows.length : 'a non-array'} row(s); the active database driver is not PostgreSQL (mocked or in-memory)`,
        database: null,
      };
    }
    const database = String(rows[0].pinned_probe_db ?? '').trim();
    if (!database) {
      return {
        supported: false,
        reason: 'probe answered without current_database(); the active database driver is not PostgreSQL',
        database: null,
      };
    }
    return { supported: true, reason: `PostgreSQL database "${database}"`, database };
  } catch (error) {
    return {
      supported: false,
      reason: `probe failed: ${(error as Error).message}`,
      database: null,
    };
  }
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Loud in production, quiet elsewhere — but never silent. */
function reportUnavailable(reason: string): { mode: 'unavailable'; reason: string } {
  const message = `[atelier-finance-seed] pinned promotion transaction UNAVAILABLE — ${reason}; falling back to verify-then-promote with compensating rollback`;
  if (isProduction()) {
    logger.error(message);
  } else {
    logger.info(message);
  }
  return { mode: 'unavailable', reason };
}

/**
 * Race a promise against a timeout without leaking the loser. When the timeout
 * wins we still attach a handler to the checkout so a client that arrives late
 * is released instead of being held by nobody.
 */
async function connectWithDeadline(
  connect: () => Promise<PoolClient>,
  timeoutMs: number
): Promise<PoolClient> {
  const checkout = connect();
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`pool checkout did not complete within ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([checkout, deadline]);
  } catch (error) {
    // The checkout may still settle later; make sure it cannot strand a client.
    void checkout.then(
      (client) => {
        try {
          client.release();
        } catch {
          /* already gone */
        }
      },
      () => {
        /* checkout failed too — nothing to release */
      }
    );
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The adapter. See the module docblock for the contract.
 *
 * Never throws for a database-level problem: every failure is reported as an
 * outcome, because the caller has to distinguish "no transaction available"
 * from "transaction ran and rolled back" and log accordingly.
 */
export async function runPinnedPromotionTransaction(
  request: PinnedPromotionRequest
): Promise<PinnedPromotionOutcome> {
  const probe = await probePinnedTransactionSupport();
  if (!probe.supported) return reportUnavailable(probe.reason);

  const statementTimeoutMs = request.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS;
  const connectTimeoutMs = request.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;

  let client: PoolClient;
  try {
    // Imported lazily so that a mocked/in-memory run never even loads the pool
    // module's connection machinery.
    const { getPoolClientForPinnedTransaction } = await import(
      '../../database/PostgresDatabase.js'
    );
    client = await connectWithDeadline(
      () => getPoolClientForPinnedTransaction(),
      connectTimeoutMs
    );
  } catch (error) {
    // A real Postgres that will not give us a connection is NOT a quiet
    // "unsupported environment" — say so at error level regardless of NODE_ENV.
    const reason = `could not check out a pinned connection: ${(error as Error).message}`;
    logger.error(
      `[atelier-finance-seed] pinned promotion transaction UNAVAILABLE — ${reason}; falling back to verify-then-promote with compensating rollback`
    );
    return { mode: 'unavailable', reason };
  }

  // A backend that is terminated under us (`pg_terminate_backend`, a killed
  // container, a proxy dropping the socket) rejects the in-flight query AND
  // emits `error` on the client. Without a listener node turns that second,
  // purely informational event into an UNCAUGHT EXCEPTION that takes the
  // process down — the seed would die of the very fault it is designed to
  // survive. Observed on a real Postgres, not theorised.
  const onClientError = (error: Error): void => {
    logger.warn('[atelier-finance-seed] the pinned connection errored out', {
      error: error.message,
    });
  };
  client.on('error', onClientError);

  let released = false;
  const releaseOnce = (error?: Error): void => {
    if (released) return;
    released = true;
    // Only detach when the client is going back to the pool healthy; on the
    // error path `release(error)` destroys it, and a late socket event must
    // still find a listener.
    if (!error) client.removeListener('error', onClientError);
    try {
      client.release(error);
    } catch (releaseError) {
      logger.warn('[atelier-finance-seed] releasing the pinned client failed', {
        error: (releaseError as Error).message,
      });
    }
  };

  const applied: string[] = [];
  let backendPid: number | null = null;
  let began = false;

  const read: PinnedReader = async (sql, params = []) => {
    const result = await client.query(toPositional(sql), params as unknown[]);
    return (result.rows ?? []) as PinnedRow[];
  };

  const rollback = async (): Promise<boolean> => {
    if (!began) return true;
    try {
      await client.query('ROLLBACK');
      return true;
    } catch (error) {
      // The backend is gone or the socket is dead. Postgres aborts an
      // uncommitted transaction when the connection drops, so the fixture is
      // still safe — but the client must be destroyed rather than returned to
      // the pool mid-transaction.
      logger.warn(
        '[atelier-finance-seed] ROLLBACK on the pinned connection failed; the server aborts the transaction on disconnect',
        { error: (error as Error).message }
      );
      releaseOnce(error as Error);
      return false;
    }
  };

  const rolledBack = async (reason: string): Promise<PinnedPromotionOutcome> => {
    const rollbackIssued = await rollback();
    logger.warn(
      `[atelier-finance-seed] pinned promotion transaction ROLLED BACK — ${reason}`,
      { applied, rollbackIssued, backendPid }
    );
    return { mode: 'pinned', status: 'rolled-back', reason, applied, rollbackIssued, backendPid };
  };

  try {
    await client.query('BEGIN');
    began = true;

    // Bounded time, enforced by the server rather than by hope.
    await client.query(`SET LOCAL statement_timeout = ${Number(statementTimeoutMs)}`);
    await client.query(
      `SET LOCAL idle_in_transaction_session_timeout = ${Number(statementTimeoutMs)}`
    );

    // Same-connection identity check: the pinned client must be on the very
    // database the caller's own module reported. A mismatch means the writes
    // and the read-backs would not see each other.
    const identity = await read(PROBE_SQL);
    const pinnedDb = String(identity[0]?.pinned_probe_db ?? '').trim();
    backendPid = Number(identity[0]?.pinned_probe_pid ?? 0) || null;
    if (!pinnedDb || (probe.database && pinnedDb !== probe.database)) {
      await rollback();
      return reportUnavailable(
        `pinned connection is on database "${pinnedDb || 'unknown'}" but the service layer reports "${probe.database}"`
      );
    }

    // ---- lock ------------------------------------------------------------
    for (const target of request.lock) {
      if (target.ids.length === 0) continue;
      const locked = await read(
        `SELECT id FROM ${assertIdentifier(target.table)} WHERE id = ANY($1::text[]) FOR UPDATE`,
        [target.ids]
      );
      if (locked.length !== target.ids.length) {
        const found = new Set(locked.map((row) => String(row.id ?? '')));
        const absent = target.ids.filter((id) => !found.has(id));
        return await rolledBack(
          `could not lock ${absent.length} row(s) in ${target.table} (absent: ${absent.join(', ')})`
        );
      }
    }

    // ---- plan, over the locked rows --------------------------------------
    const plan = await request.plan(read);
    if (!plan.ok) return await rolledBack(plan.reason);

    // ---- write -----------------------------------------------------------
    for (const write of plan.writes) {
      await client.query(toPositional(write.sql), write.params);
      applied.push(write.label);
    }

    // ---- final read-back, same client, before COMMIT ---------------------
    const verdict = await request.verify(read);
    if (!verdict.ok) {
      return await rolledBack(
        `post-write read-back refused the promotion: ${verdict.reason ?? 'no reason given'}`
      );
    }

    await client.query('COMMIT');
    began = false;
    logger.info(
      `[atelier-finance-seed] pinned promotion transaction COMMITTED — ${applied.length} promotion(s) on one connection`,
      { applied, backendPid, database: pinnedDb }
    );
    return { mode: 'pinned', status: 'committed', applied, backendPid };
  } catch (error) {
    return await rolledBack((error as Error).message);
  } finally {
    releaseOnce();
  }
}

/**
 * `?` → `$n`, reusing the database layer's own scanner so the pinned path and
 * the `DbPromise` path translate identically. SQL that already uses `$n` is
 * returned untouched.
 */
function toPositional(sql: string): string {
  if (/\$\d+/.test(sql)) return sql;
  if (!sql.includes('?')) return sql;
  return replacePlaceholders(sql);
}

let cachedReplacer: ((sql: string) => string) | null = null;
function replacePlaceholders(sql: string): string {
  if (!cachedReplacer) {
    // Local, dependency-free copy of the scanner in
    // `PostgresDatabase.replacePositionalPlaceholders`: a `?` is a bind
    // placeholder only outside string literals, quoted identifiers and
    // comments. Copied rather than imported so this module keeps working when
    // the database module has not been loaded (mocked runs never reach here,
    // but a static import would still pull the pool machinery in).
    cachedReplacer = (input: string): string => {
      let out = '';
      let index = 1;
      let inSingle = false;
      let inDouble = false;
      let inLineComment = false;
      let inBlockComment = false;
      for (let i = 0; i < input.length; i++) {
        const char = input[i];
        const next = input[i + 1];
        if (inLineComment) {
          out += char;
          if (char === '\n') inLineComment = false;
          continue;
        }
        if (inBlockComment) {
          out += char;
          if (char === '*' && next === '/') {
            out += next;
            i++;
            inBlockComment = false;
          }
          continue;
        }
        if (inSingle) {
          out += char;
          if (char === "'") inSingle = false;
          continue;
        }
        if (inDouble) {
          out += char;
          if (char === '"') inDouble = false;
          continue;
        }
        if (char === '-' && next === '-') {
          out += char;
          inLineComment = true;
          continue;
        }
        if (char === '/' && next === '*') {
          out += char;
          inBlockComment = true;
          continue;
        }
        if (char === "'") {
          out += char;
          inSingle = true;
          continue;
        }
        if (char === '"') {
          out += char;
          inDouble = true;
          continue;
        }
        if (char === '?') {
          out += `$${index++}`;
          continue;
        }
        out += char;
      }
      return out;
    };
  }
  return cachedReplacer(sql);
}

/** Table names are interpolated into the lock SQL, so they must be literal. */
function assertIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`refusing to lock a non-identifier table name: ${name}`);
  }
  return name;
}

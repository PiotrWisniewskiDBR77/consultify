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
 *
 * ===========================================================================
 * FAIL-CLOSED — the two ways "no pinned transaction" can end (FIN-005 P1-1)
 * ===========================================================================
 * An earlier build conflated them and that WAS the defect: any probe or
 * checkout failure returned `unavailable`, and the caller then promoted through
 * a NON-ATOMIC compensating path and could still report `complete`. On a real
 * database that is precisely the class of fault this module exists to remove.
 *
 * They are now distinct outcomes, and only ONE of them lets a caller degrade:
 *
 *   `mode: 'unavailable'` — a NON-PostgreSQL seam was POSITIVELY IDENTIFIED
 *       (see `identifyNonPostgresSeam`). This is the mocked/in-memory test
 *       world, where no pinned connection can exist even in principle. The
 *       caller may use its own compensating path here and nowhere else.
 *
 *   `mode: 'refused'` — everything else. A real (or merely unproven-to-be-fake)
 *       database where the pinned transaction could not be established: the
 *       probe failed, the pool checkout timed out, the pool was exhausted, the
 *       connection failed, or the pinned client turned out to be on a different
 *       database. ZERO promotion UPDATEs have been issued in every one of those
 *       branches — the probe and the checkout both precede `BEGIN`, and the
 *       identity check precedes the locks and the writes. The caller MUST end
 *       the seed as `incomplete`. Railway `demo` can therefore never degrade to
 *       non-atomic promotion: nothing there identifies a seam.
 *
 * AMBIGUITY FAILS CLOSED. `identifyNonPostgresSeam` only ever answers "yes" to
 * a POSITIVE, named signal; the absence of a signal is never read as "this must
 * be a mock". In particular `NODE_ENV` is NOT evidence about the database and
 * is never consulted for this decision (it selects the LOG LEVEL, nothing
 * more) — a production process with `NODE_ENV` unset still fails closed.
 *
 * AND NO ENV VAR IS EVIDENCE EITHER (FIN-005 P1-1b, the falsified claim).
 * An earlier build accepted the bare string `MOCK_DB === 'true'` as a seam,
 * on the stated grounds that "`Database.ts` treats this as its primary mock
 * switch". That is true only inside `createDatabase()`, which `DbPromise` never
 * calls; `DbPromise` resolves through `getDatabaseInstance()`, and THAT only
 * honours `MOCK_DB` when `NODE_ENV === 'test'` and `RUN_DB_TESTS !== '1'`. So
 *
 *     DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=true DATABASE_URL=…
 *
 * produced `seam recognised` while every write went to a REAL PostgreSQL, which
 * re-opened the non-atomic path on exactly the databases this module exists to
 * protect. A stray `MOCK_DB=true` in a Railway service variable was enough, and
 * `NODE_ENV=production` did not protect. The signal is GONE. The seam is now
 * decided by WHAT THE DATABASE IS — see `decidePinnedTransactionSeam`: the live
 * probe runs FIRST, and any claim of a mock (an `isMock` instance, a non-postgres
 * driver setting) is DOWNGRADED to a refusal the moment a real PostgreSQL answers
 * the module the caller writes through.
 *
 * ===========================================================================
 * NO FALLBACK PROMOTION ON POSTGRESQL (FIN-005 P1-2)
 * ===========================================================================
 * `DbPromise.run`'s timeout settles the JS promise; it does NOT cancel the
 * query in the driver. On a compensating path that is lethal: the UPDATE runs
 * long, the promise rejects, the compensation demotes the rows, and the
 * ORIGINAL UPDATE then lands — part of the fixture is READY again, after the
 * operation reported failure. (Worse, the demote is guarded by
 * `IS DISTINCT FROM`, so while the promotion is still in flight the row still
 * reads as phase-1 and the demote matches ZERO rows and "succeeds".)
 *
 * A JS timeout is not a transaction boundary. So there is no promotion fallback
 * on PostgreSQL at all: every PostgreSQL promotion goes through the pinned
 * transaction, and a pinned transaction that cannot be established refuses.
 * The one and only place this module builds `{ mode: 'unavailable' }` is
 * `reportUnavailable`, which is called from exactly one site — the recognised
 * seam branch at the top of `runPinnedPromotionTransaction`. That is what a
 * reviewer should grep for.
 *
 * ===========================================================================
 * COMMIT INDETERMINATE (FIN-005 P1-3)
 * ===========================================================================
 * A `COMMIT` whose result never reaches this process (connection reset in the
 * COMMIT round-trip) may or may not have committed. Reporting it as
 * `rolled-back` is a claim with no evidence behind it. So on a COMMIT error the
 * adapter opens a FRESH connection — the pinned one is unusable — and asks the
 * caller's `reconcile` callback to read the promoted records back and classify:
 *
 *   all five match the INTENDED
 *   POST-STATE, exactly, and the
 *   fixture is coherent              -> the commit really landed (`committed`,
 *                                       `commitAck: 'lost-then-confirmed'`)
 *   all five match the PRE-STATE
 *   SNAPSHOT taken under the row
 *   locks, exactly                   -> it did not (`rolled-back`, with the
 *                                       reconciliation as the evidence)
 *   anything mixed, anything else,
 *   or the read itself failing       -> `commit-indeterminate`,
 *                                       `operatorAction: 'NEEDS_OPERATOR'`
 *
 * `commit-indeterminate` is never `complete` for the caller.
 *
 * ===========================================================================
 * AVAILABILITY — how "this is not a real pg connection" is detected
 * ===========================================================================
 * Tests mock the whole `DbPromise` module with an in-memory fake. If this
 * adapter grabbed a real pool in that situation, the caller's phase-1 rows
 * would live in the fake store while the promotion ran against a real database:
 * split brain, and far worse than no transaction at all.
 *
 * `decidePinnedTransactionSeam()` composes two mechanisms, and the ORDER is the
 * whole point — the live database outranks every declaration about it:
 *
 *   1. `identifyNonPostgresSeam()` — positive identification of the seam itself.
 *      Exactly ONE of its signals may decide alone (`decidesAlone`): a
 *      WHOLESALE-DOUBLED `DbPromise`. That is a structural fact about the loaded
 *      module graph — `get`, `all` AND `run` replaced by spy functions — which
 *      no environment variable can produce and which no probe can see past,
 *      because the probe would have to travel through the very module that has
 *      been replaced. The other signals (an instance declaring `isMock`, a
 *      configured driver that is not postgres) are CLAIMS, and claims lose.
 *   2. `probePinnedTransactionSupport()` — asks THE SAME MODULE THE CALLER
 *      WRITES THROUGH a Postgres-only expression (`current_database()` /
 *      `pg_backend_pid()`) through `DbPromise.all`. Only a genuine pg driver
 *      answers with one row.
 *
 *      IF IT ANSWERS, THIS IS PostgreSQL. `unavailable` is then impossible: a
 *      claimed seam is downgraded, the pinned transaction is attempted, and if
 *      it cannot be established the outcome is `refused`. No `isMock` flag, no
 *      `DB_TYPE`, no env var of any kind can talk the module off that path.
 *      IF IT DOES NOT ANSWER, a recognised claim explains why (`unavailable`);
 *      an unexplained failure is a REFUSAL, not a degradation.
 *
 *      The pinned client is then asked for `current_database()` too and refuses
 *      if the names disagree.
 *
 * `unavailable` is logged at `error` level in production (a production seed run
 * SHOULD have a real connection; silently degrading is the failure mode this
 * whole packet exists to remove) and at `info`/`warn` elsewhere. `refused` is
 * logged at `error` level ALWAYS.
 *
 * ===========================================================================
 * DECISIVE READS COME FROM THE PRIMARY (FIN-005 P1-A)
 * ===========================================================================
 * `DbPromise.get` and `DbPromise.all` route to `getReadPool()`, which is the
 * READ REPLICA pool whenever `DB_READ_URL` / `DATABASE_READ_URL` is set. A
 * physical standby shares `system_identifier`, the database NAME and the
 * database OID with its primary — the connection-identity guard in
 * `fin005-seed-atelier-finance.ts` deliberately allows exactly that, because a
 * legitimate replica is indistinguishable from its primary on those fields.
 *
 * What a replica does NOT share is the WAL position. It lags. So a
 * post-write verification that reads the replica can see the PRE-write rows and
 * conclude the write failed — and the seed's answer to "the write failed" is to
 * COMPENSATE: demote the fixture, or heal it, or report `incomplete`. Every one
 * of those is a destructive decision taken on evidence that was simply late.
 *
 * `openDecisiveReadSession()` is the answer. It hands out a reader bound to a
 * client checked out from the EXACTLY-AUTHORISED WRITE POOL
 * (`getPoolClientForPinnedTransaction` → `PostgresDatabase.getPool()`, the same
 * pool `DbPromise.run` writes through and the same pool the pinned transaction
 * promotes on). It is not a wrapper around `DbPromise`; the read pool is not
 * reachable from it at all.
 *
 * Two further guarantees, both cheap and both load-bearing:
 *
 *   - `pg_is_in_recovery()` MUST be false. This is the one field a physical
 *     standby cannot fake, and it is what makes "this is the primary" a proof
 *     rather than a naming convention. A write pool pointed at a standby is a
 *     refusal, not a degradation.
 *   - No session state is set on the borrowed client. `statement_timeout` is
 *     already a POOL-level connection parameter (`DatabaseConfig.getPostgresConfig`
 *     sets `statement_timeout` from `DB_STATEMENT_TIMEOUT`), so the bound is
 *     inherited rather than issued — a plain `SET` here would ride a pooled
 *     connection into whatever the application does next, exactly the hazard
 *     `reconcileLostCommitAck` documents.
 *
 * The session holds ONE client and issues each read in autocommit. It
 * deliberately does NOT open a transaction: the seed writes phase 1 through
 * `DbPromise.run` on OTHER connections, and a long-lived transaction here would
 * pin a snapshot from before those writes and then fail to see them — a
 * self-inflicted version of the very staleness this exists to remove.
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

/**
 * The caller's verdict after a LOST COMMIT ACK, computed on a FRESH connection.
 *
 * `committed`     — every promoted record matches the INTENDED POST-STATE.
 * `not-committed` — every promoted record matches the PRE-TRANSACTION SNAPSHOT.
 * `indeterminate` — anything else at all, or the read did not succeed.
 *
 * TWO EXACT STATES, NOT A FLAG (FIN-005 P1-3b). A verdict of the shape "no row
 * looks ready, therefore nothing committed" is not a reading of the pre-state —
 * it cannot tell a rollback from a concurrent actor having moved a row to some
 * third state, and on a fixture that was ALREADY promoted before this run it
 * gets the `committed` direction wrong too. So the caller is expected to
 * SNAPSHOT the locked rows inside `plan(read)` (they are under `FOR UPDATE`
 * there, so the snapshot is the exact state the writes would apply to) and
 * classify by exact match against that snapshot or against the state its own
 * writes intended. Anything that matches neither is `indeterminate`.
 */
export interface PinnedReconciliation {
  verdict: 'committed' | 'not-committed' | 'indeterminate';
  /** Human-readable evidence; goes verbatim into the outcome and the log. */
  detail: string;
}

export interface PinnedPromotionRequest {
  /** Rows to `SELECT … FOR UPDATE` before the plan runs. */
  lock: PinnedLockRequest[];
  /**
   * Computes the verdict and the writes, over the LOCKED rows.
   *
   * This is also the ONLY place a caller can take a trustworthy pre-transaction
   * snapshot: the rows are held under `FOR UPDATE` for the whole call, so what
   * is read here is exactly what the writes will apply to. A caller whose
   * `reconcile` classifies against a pre-state must capture it from THIS
   * callback — see `PinnedReconciliation`.
   */
  plan: (read: PinnedReader) => Promise<PinnedPlan>;
  /** Final read-back on the same client, after the writes, before COMMIT. */
  verify: (read: PinnedReader) => Promise<{ ok: boolean; reason?: string }>;
  /**
   * Read the promoted records on a FRESH connection and classify a lost COMMIT
   * ACK. REQUIRED, not optional: a caller that forgets it would leave the
   * adapter with nothing to reason from and force `NEEDS_OPERATOR` on every
   * in-doubt COMMIT.
   */
  reconcile: (read: PinnedReader) => Promise<PinnedReconciliation>;
  /** Per-statement timeout on the pinned session. Default 15s. */
  statementTimeoutMs?: number;
  /**
   * Ceiling on JS pauses BETWEEN statements inside the transaction. Its own
   * budget on purpose — see the note at the call site. Default 60s, and never
   * allowed below `statementTimeoutMs`.
   */
  idleInTransactionTimeoutMs?: number;
  /** Ceiling on the pool checkout itself. Default 10s. */
  connectTimeoutMs?: number;
  /**
   * The database name the caller's DECISIVE READS are bound to — i.e. the name
   * reported by `openDecisiveReadSession()`'s client, which comes from the
   * exactly-authorised WRITE pool.
   *
   * WHY THIS PARAMETER EXISTS (FIN-005 P1-A). The identity check below used to
   * compare the pinned client against `probePinnedTransactionSupport()`, and
   * that probe goes through `DbPromise.all` — the READ pool. On a deployment
   * with a read replica that means the pinned transaction was being validated
   * against a DIFFERENT SERVER, and the guard's own stated purpose ("the writes
   * and the read-backs would not see each other") was being evaluated against
   * the one connection the writes and read-backs must never use.
   *
   * When supplied, the pinned client is compared against THIS — the primary.
   * When absent, the read-pool probe is used as before, which is correct for the
   * single-pool deployments and the direct-adapter tests that pass nothing.
   */
  expectPrimaryDatabase?: string | null;
}

export type PinnedPromotionOutcome =
  /**
   * A non-PostgreSQL seam was POSITIVELY IDENTIFIED. The ONLY outcome that
   * permits a caller to promote through its own non-atomic path.
   */
  | { mode: 'unavailable'; reason: string; seam: string }
  /**
   * A real (or unproven) database where the pinned transaction could not be
   * established. ZERO promotion UPDATEs were issued. The caller MUST fail.
   */
  | { mode: 'refused'; reason: string; evidence: string }
  | {
      mode: 'pinned';
      status: 'committed';
      /** Labels of the writes that were applied and committed. */
      applied: string[];
      backendPid: number | null;
      /**
       * `acknowledged` — the server answered the COMMIT.
       * `lost-then-confirmed` — the answer was lost and reconciliation on a
       * fresh connection PROVED the commit landed.
       */
      commitAck: 'acknowledged' | 'lost-then-confirmed';
      reconciliation?: PinnedReconciliation;
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
      /** Present when "rolled back" was PROVED by post-COMMIT reconciliation. */
      reconciliation?: PinnedReconciliation;
    }
  | {
      /**
       * The COMMIT result was lost and reconciliation could not classify the
       * outcome. NOT rolled back, NOT complete — a human has to look.
       */
      mode: 'pinned';
      status: 'commit-indeterminate';
      reason: string;
      applied: string[];
      backendPid: number | null;
      reconciliation: PinnedReconciliation;
      operatorAction: 'NEEDS_OPERATOR';
    };

const DEFAULT_STATEMENT_TIMEOUT_MS = Number(process.env.DB_QUERY_TIMEOUT) || 15_000;
/**
 * Deliberately NOT derived from `DB_QUERY_TIMEOUT`. See the call site: this
 * bounds the gaps between statements, not the statements themselves, so sharing
 * the per-query budget turns an ordinary JS pause into a killed backend.
 */
const DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS =
  Number(process.env.DB_IDLE_IN_TRANSACTION_TIMEOUT) || 60_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

/** Sentinel aliases chosen so no application table can collide with them. */
const PROBE_SQL =
  'SELECT current_database() AS pinned_probe_db, pg_backend_pid() AS pinned_probe_pid, ' +
  'pg_is_in_recovery() AS pinned_probe_in_recovery';

/**
 * Everything the DECISIVE READ SEAM has to know about the backend it borrowed.
 *
 * `inRecovery` is the discriminator that matters and the reason this SQL is not
 * simply `PROBE_SQL`: a physical standby answers `current_database()`,
 * `system_identifier` and the database OID identically to its primary, and
 * differs only in that it is replaying WAL. Everything else here is evidence
 * recorded into the promotion marker so a human can tell WHICH server a run
 * was on. `pg_control_system()` is superuser-only unless granted, so
 * `systemIdentifier` is best-effort and never gates anything on its own.
 */
const PRIMARY_IDENTITY_SQL =
  `SELECT current_database() AS primary_db, ` +
  `(SELECT oid::text FROM pg_database WHERE datname = current_database()) AS primary_db_oid, ` +
  `COALESCE(host(inet_server_addr()), '<unix-socket>') AS primary_addr, ` +
  `COALESCE(inet_server_port()::text, '<none>') AS primary_port, ` +
  `pg_backend_pid()::text AS primary_pid, ` +
  `pg_is_in_recovery() AS primary_in_recovery`;

const PRIMARY_SYSTEM_IDENTIFIER_SQL =
  'SELECT system_identifier::text AS primary_system_identifier FROM pg_control_system()';

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
        reason:
          'probe answered without current_database(); the active database driver is not PostgreSQL',
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

// ---------------------------------------------------------------------------
// Positive identification of a non-PostgreSQL seam (FIN-005 P1-1)
// ---------------------------------------------------------------------------

export interface NonPgSeamVerdict {
  /** True ONLY when one of the named signals below actually matched. */
  recognised: boolean;
  /** The signal that matched, or the evidence weighed when none did. */
  signal: string;
  /**
   * May this verdict decide the outcome WITHOUT a live probe?
   *
   * True for exactly one signal — a wholesale-doubled `DbPromise` — because the
   * probe travels through that very module and so cannot contradict it. Every
   * other signal is a CLAIM about the database and is overruled by a real
   * PostgreSQL answering. See `decidePinnedTransactionSeam`.
   */
  decidesAlone: boolean;
}

/**
 * The key `server/src/database/Database.ts` keeps its singleton under.
 *
 * READ DIRECTLY, ON PURPOSE. The obvious call — `getDatabaseInstance()` — is not
 * a question, it is a command: when nothing is installed yet it CREATES an
 * instance and writes it to `process` and `globalThis`. A read-only predicate
 * that installs the process-wide database singleton as a side effect is a bug
 * waiting for a caller, so this peeks at what is ALREADY there and never
 * conjures one. The literal is duplicated because `Database.ts` does not export
 * it; if it ever diverges this peek answers `null`, which is the FAIL-CLOSED
 * direction — no seam recognised, and the live probe decides.
 */
const DATABASE_SINGLETON_GLOBAL_KEY = '__CONSULTIFY_GLOBAL_DB_INSTANCE__';

/** The installed database singleton, or `null` when none has been installed. */
function peekInstalledDatabaseInstance(): { isMock?: unknown } | null {
  const holder =
    (process as unknown as Record<string, unknown>)[DATABASE_SINGLETON_GLOBAL_KEY] ??
    (globalThis as unknown as Record<string, unknown>)[DATABASE_SINGLETON_GLOBAL_KEY];
  if (!holder || typeof holder !== 'object') return null;
  if ((holder as { __CLOSED__?: unknown }).__CLOSED__) return null;
  return holder as { isMock?: unknown };
}

/**
 * Is a vitest/jest test double? `_isMockFunction` plus a `.mock` record is the
 * marker every spy library in this repo stamps on its doubles.
 */
function isTestDouble(value: unknown): boolean {
  if (typeof value !== 'function') return false;
  const fn = value as { _isMockFunction?: unknown; mock?: unknown };
  return fn._isMockFunction === true && typeof fn.mock === 'object' && fn.mock !== null;
}

/**
 * Decide — POSITIVELY — whether this process is wired to something that is not
 * PostgreSQL and therefore cannot host a pinned transaction even in principle.
 *
 * READ THIS BEFORE ADDING A SIGNAL. The answer gates the ONLY route to the
 * caller's non-atomic promotion path, so it must never be reachable by
 * inference, by absence of evidence, by `NODE_ENV`, or by ANY environment
 * variable. An env var states an INTENTION; the question here is a FACT about
 * the database, and the two came apart badly once already (see the P1-1b note in
 * the module docblock: `MOCK_DB=true` on a real PostgreSQL). `NODE_ENV` says
 * something about the process, nothing about the database: a staging box, a
 * `NODE_ENV`-less container and a developer's laptop pointed at the demo
 * database would all be misclassified by it. Neither is consulted here.
 *
 * WHAT SURVIVES, AND WHAT EACH ONE IS WORTH:
 *
 *   1. A WHOLESALE-DOUBLED `DbPromise` — `get`, `all` AND `run` are all spy
 *      functions. Structural, not declared: it requires a test runner to have
 *      replaced the module, and no env var can produce it. This is the only
 *      signal with `decidesAlone: true`, because the live probe travels through
 *      the replaced module and therefore cannot check it.
 *      A PARTIAL mock — a test that wraps `all` to inject a probe failure while
 *      leaving the real `run` in place, which is exactly what the fail-closed
 *      suite does — is deliberately NOT recognised: it still writes to the real
 *      database, so it must fail closed like any other real database.
 *   2. The INSTALLED database instance declares `isMock === true`. A claim, and
 *      a good one (it is the object `DbPromise` actually dispatches through) —
 *      but still overruled by a real PostgreSQL answering the probe.
 *   3. The configured driver is a non-empty type other than `postgres`. The
 *      weakest of the three (it is `DB_TYPE` in a hat) and likewise overruled.
 *
 * Signals 2 and 3 carry `decidesAlone: false`. On their own they never open the
 * non-atomic path: `decidePinnedTransactionSeam` asks the database first.
 */
export async function identifyNonPostgresSeam(): Promise<NonPgSeamVerdict> {
  const considered: string[] = [];

  // 1. The module the caller writes through has been wholesale replaced.
  if (isTestDouble(DbPromise.get) && isTestDouble(DbPromise.all) && isTestDouble(DbPromise.run)) {
    return {
      recognised: true,
      decidesAlone: true,
      signal:
        'the DbPromise module is a test double (get/all/run are all mock functions) — no statement this process issues can reach PostgreSQL',
    };
  }
  considered.push('DbPromise get/all/run are real functions, not test doubles');

  // NOT A SIGNAL — recorded so the log and the tests can SEE that it was weighed
  // and thrown away. `MOCK_DB` reaches `getDatabaseInstance()` only when
  // `NODE_ENV === 'test'` and `RUN_DB_TESTS !== '1'`; outside that window it is a
  // claim with nothing behind it, and it used to open the non-atomic path on a
  // real database. FIN-005 P1-1b.
  considered.push(
    `MOCK_DB=${process.env.MOCK_DB ?? '<unset>'} (IGNORED — an env var is a statement of intent, never evidence about the live database)`
  );

  // 2. The INSTALLED database instance declares itself a mock. Peeked, never
  //    created: see `peekInstalledDatabaseInstance`.
  const instance = peekInstalledDatabaseInstance();
  if (instance && instance.isMock === true) {
    return {
      recognised: true,
      decidesAlone: false,
      signal: 'the installed database instance declares isMock=true',
    };
  }
  considered.push(
    instance
      ? 'the installed database instance does not declare isMock'
      : 'no database instance is installed yet (asking for one would create it, so it was not asked)'
  );

  // 3. A configured driver that is not postgres cannot host a pg transaction.
  try {
    const { databaseConfig } = await import('../../config/DatabaseConfig.js');
    const type = String((databaseConfig as { type?: unknown } | null)?.type ?? '');
    if (type && type !== 'postgres') {
      return {
        recognised: true,
        decidesAlone: false,
        signal: `the configured database driver is "${type}", not postgres`,
      };
    }
    considered.push(`the configured database driver is "${type || '<unknown>'}"`);
  } catch (error) {
    considered.push(
      `the database configuration could not be inspected (${(error as Error).message})`
    );
  }

  return { recognised: false, decidesAlone: false, signal: considered.join('; ') };
}

/**
 * What the seam question is FOR: which of the three doors this call goes through.
 *
 *   `postgres` — a real PostgreSQL answered the module the caller writes
 *                through. The pinned transaction is attempted. `unavailable` is
 *                unreachable from here, whatever any flag claims.
 *   `seam`     — no PostgreSQL answered AND a positively identified seam
 *                explains it (or `DbPromise` itself is a wholesale double, in
 *                which case nothing could have answered). `unavailable`.
 *   `refuse`   — no PostgreSQL answered and nothing explains it. Fail closed.
 *
 * THE PROBE RUNS BEFORE ANY CLAIM IS BELIEVED. That single ordering is what
 * makes the predicate un-foolable by an environment variable: `MOCK_DB`,
 * `DB_TYPE`, `NODE_ENV` and an `isMock` flag are all upstream of the database,
 * and the database gets the first word. No pool is opened on any of these paths
 * — the probe goes through `DbPromise`, exactly like the caller's own writes.
 */
export type PinnedSeamDecision =
  | { outcome: 'postgres'; probe: PinnedSupportProbe; seam: NonPgSeamVerdict }
  | { outcome: 'seam'; probe: PinnedSupportProbe | null; seam: NonPgSeamVerdict }
  | { outcome: 'refuse'; probe: PinnedSupportProbe; seam: NonPgSeamVerdict };

export async function decidePinnedTransactionSeam(): Promise<PinnedSeamDecision> {
  const seam = await identifyNonPostgresSeam();

  // The one signal the probe cannot check, because the probe goes through the
  // module that has been replaced. Nothing is asked of the database here — a
  // doubled `DbPromise` would only answer whatever the double felt like.
  if (seam.recognised && seam.decidesAlone) return { outcome: 'seam', probe: null, seam };

  const probe = await probePinnedTransactionSupport();

  // A REAL PostgreSQL ANSWERED. Every claim of a mock is downgraded here — this
  // is the belt-and-braces the P1-1b defect needed. From this point the only
  // outcomes are a pinned transaction or a refusal.
  if (probe.supported) return { outcome: 'postgres', probe, seam };

  // Nothing answered. Is there a positively identified reason?
  if (seam.recognised) return { outcome: 'seam', probe, seam };

  return { outcome: 'refuse', probe, seam };
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Is a SECOND pool configured for reads?
 *
 * Asked of `DatabaseConfig`, which is the object `PostgresDatabase.getReadPool()`
 * actually consults, rather than of the environment: the question is "does
 * `getReadPool()` return something other than `getPool()`", and only the config
 * can answer it. `getReadPool()` falls back to the primary pool when
 * `readReplica` is undefined, which is exactly the case where a divergent probe
 * database is impossible and therefore a refusal.
 */
async function isReadReplicaConfigured(): Promise<{ configured: boolean; detail: string }> {
  try {
    const { databaseConfig } = await import('../../config/DatabaseConfig.js');
    const replica = (
      databaseConfig as { readReplica?: { host?: string; database?: string } } | null
    )?.readReplica;
    if (!replica) return { configured: false, detail: 'databaseConfig.readReplica is undefined' };
    return {
      configured: true,
      detail: `databaseConfig.readReplica -> ${replica.host ?? '<host?>'}/${replica.database ?? '<db?>'}`,
    };
  } catch (error) {
    // Cannot tell ⇒ treat as NOT configured, which is the FAIL-CLOSED direction:
    // an unexplained divergence becomes a refusal rather than a log line.
    return {
      configured: false,
      detail: `the database configuration could not be inspected (${(error as Error).message})`,
    };
  }
}

/**
 * THE ONLY PLACE THIS MODULE BUILDS `{ mode: 'unavailable' }`.
 *
 * Called from exactly one site — the recognised-seam branch at the top of
 * `runPinnedPromotionTransaction`. Everything else that goes wrong produces
 * `refuse(...)`. Grep for `mode: 'unavailable'` to confirm there is no second
 * door onto the caller's fallback.
 *
 * Loud in production, quiet elsewhere — but never silent. (`NODE_ENV` picks the
 * LEVEL here; it never decides whether the seam is real.)
 */
function reportUnavailable(seam: string): { mode: 'unavailable'; reason: string; seam: string } {
  const message = `[atelier-finance-seed] pinned promotion transaction UNAVAILABLE — recognised non-PostgreSQL seam: ${seam}; the caller may use its compensating path HERE ONLY`;
  if (isProduction()) {
    logger.error(message);
  } else {
    logger.info(message);
  }
  return { mode: 'unavailable', reason: seam, seam };
}

/**
 * Fail closed. A real (or unproven) database that cannot give us a pinned
 * transaction ends the promotion — it never degrades to a non-atomic path.
 * Every caller of this has issued ZERO promotion UPDATEs.
 */
function refuse(
  reason: string,
  evidence: string
): { mode: 'refused'; reason: string; evidence: string } {
  logger.error(
    `[atelier-finance-seed] pinned promotion transaction REFUSED — ${reason}; failing closed with ZERO promotion UPDATEs issued (no compensating fallback on PostgreSQL). Why this is not treated as a test seam: ${evidence}`
  );
  return { mode: 'refused', reason, evidence };
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
  // (1) Ask the DATABASE what it is — the live probe first, every declaration
  //     about it second. No pool is opened on any branch below: the probe goes
  //     through `DbPromise`, exactly like the caller's own writes.
  const decision = await decidePinnedTransactionSeam();
  const seam = decision.seam;
  if (decision.outcome === 'seam') return reportUnavailable(seam.signal);
  if (decision.outcome === 'refuse') {
    return refuse(
      `the availability probe failed on a database that is NOT a recognised test seam: ${decision.probe.reason}`,
      seam.signal
    );
  }

  // (2) A real PostgreSQL answered. From here on, EVERY failure is a refusal.
  const probe = decision.probe;

  const statementTimeoutMs = request.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS;
  // Its OWN budget, never a share of `statement_timeout`'s. They measure
  // different things: `statement_timeout` bounds ONE query on the server;
  // `idle_in_transaction_session_timeout` bounds the JS pauses BETWEEN queries —
  // the plan callback's arithmetic, a garbage-collection stall, an await on
  // something slow. Giving them one number means a transaction whose queries are
  // all fast still gets its backend killed because the process paused, and a
  // slow-but-legitimate run turns into a spurious `incomplete`.
  const idleInTransactionTimeoutMs = Math.max(
    request.idleInTransactionTimeoutMs ?? DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS,
    statementTimeoutMs
  );
  const connectTimeoutMs = request.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;

  let client: PoolClient;
  try {
    // Imported lazily so that a mocked/in-memory run never even loads the pool
    // module's connection machinery.
    client = await connectWithDeadline(() => checkOutPinnedClient(), connectTimeoutMs);
  } catch (error) {
    // Checkout timeout, pool exhaustion ("too many clients already", "timeout
    // exceeded when trying to connect"), a refused socket — all of them are a
    // real Postgres that will not give us a connection, and all of them fail
    // closed. Nothing has been written: this is still before `BEGIN`.
    return refuse(
      `could not check out a pinned connection: ${(error as Error).message}`,
      seam.signal
    );
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
    logger.warn(`[atelier-finance-seed] pinned promotion transaction ROLLED BACK — ${reason}`, {
      applied,
      rollbackIssued,
      backendPid,
    });
    return { mode: 'pinned', status: 'rolled-back', reason, applied, rollbackIssued, backendPid };
  };

  try {
    await client.query('BEGIN');
    began = true;

    // Bounded time, enforced by the server rather than by hope.
    await client.query(`SET LOCAL statement_timeout = ${Number(statementTimeoutMs)}`);
    await client.query(
      `SET LOCAL idle_in_transaction_session_timeout = ${Number(idleInTransactionTimeoutMs)}`
    );

    // Same-connection identity check: the pinned client must be on the very
    // database the caller's own module reported. A mismatch means the writes
    // and the read-backs would not see each other.
    const identity = await read(PROBE_SQL);
    const pinnedDb = String(identity[0]?.pinned_probe_db ?? '').trim();
    backendPid = Number(identity[0]?.pinned_probe_pid ?? 0) || null;
    const pinnedInRecovery = identity[0]?.pinned_probe_in_recovery === true;

    // FIN-005 P1-A. A standby replays WAL and refuses every write; a promotion
    // "committed" there is not a promotion. It also answers `current_database()`
    // and `system_identifier` exactly like its primary, so no name comparison
    // can see it. Still before the locks and before the first write.
    if (pinnedInRecovery) {
      await rollback();
      return refuse(
        `the pinned connection is on a STANDBY (pg_is_in_recovery() = true), not the primary; database "${pinnedDb || 'unknown'}"`,
        seam.signal
      );
    }

    // The comparison target: the PRIMARY the caller's decisive reads are bound
    // to when it supplied one, and only otherwise the read-pool probe. See
    // `expectPrimaryDatabase`.
    const expectedDb = (request.expectPrimaryDatabase ?? probe.database) || '';
    const expectedSource = request.expectPrimaryDatabase
      ? 'the decisive read session (write pool)'
      : 'the service layer (DbPromise → read pool)';
    if (!pinnedDb || (expectedDb && pinnedDb !== expectedDb)) {
      // Still before the locks and before the first write: zero promotion
      // UPDATEs. A database mismatch is a REFUSAL — promoting through the
      // caller's own path here is exactly the split brain this guards against.
      await rollback();
      return refuse(
        `pinned connection is on database "${pinnedDb || 'unknown'}" but ${expectedSource} reports "${expectedDb}"`,
        seam.signal
      );
    }

    // THE SEAM PROBE TRAVELLED THROUGH THE READ POOL, and the read pool may be a
    // different server. That divergence is now handled by CONFIGURATION, not by
    // a name comparison that cannot tell the two apart:
    //
    //   no read replica configured — `getReadPool()` RETURNS `getPool()`. The
    //       probe and the pinned client are then literally the same pool, so a
    //       divergence has no legitimate explanation at all and is a REFUSAL.
    //       (This is the case the fail-closed suite arms.)
    //   a read replica configured — the probe legitimately answers from another
    //       server. Its database name is RECORDED and logged at error level,
    //       and it decides NOTHING: after FIN-005 P1-A no verdict, no
    //       verification and no compensation in this packet reads the replica.
    if (probe.database && expectedDb && probe.database !== expectedDb) {
      const replica = await isReadReplicaConfigured();
      if (!replica.configured) {
        await rollback();
        return refuse(
          `pinned connection is on database "${pinnedDb}" but the service layer reports ` +
            `"${probe.database}", and NO read replica is configured — DbPromise's reads and the pinned ` +
            `client resolve to the SAME pool, so this divergence has no legitimate explanation`,
          seam.signal
        );
      }
      logger.error(
        `[atelier-finance-seed] the READ POOL is on database "${probe.database}" while the primary is ` +
          `"${expectedDb}". A read replica is configured (${replica.detail}), so this is reported rather ` +
          `than refused — and it decides nothing: every decisive read in this promotion is bound to the ` +
          `primary. Verify DB_READ_URL points at a replica OF THIS primary.`
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
    if (plan.ok === false) return await rolledBack(plan.reason);

    // ---- write -----------------------------------------------------------
    for (const write of plan.writes) {
      await client.query(toPositional(write.sql), write.params);
      applied.push(write.label);
    }

    // ---- final read-back, same client, before COMMIT ---------------------
    const verdict = await request.verify(read);
    if (verdict.ok === false) {
      return await rolledBack(
        `post-write read-back refused the promotion: ${verdict.reason ?? 'no reason given'}`
      );
    }

    try {
      await client.query('COMMIT');
    } catch (commitError) {
      // IN DOUBT. The COMMIT may have landed and the answer been lost, or the
      // transaction may have aborted. Claiming "rolled back" here would be an
      // assertion with no evidence — FIN-005 P1-3. The pinned connection is
      // unusable, so destroy it and reconcile on a FRESH one.
      began = false;
      releaseOnce(commitError as Error);
      return await reconcileLostCommitAck({
        request,
        commitError: commitError as Error,
        applied,
        backendPid,
        connectTimeoutMs,
        statementTimeoutMs,
        idleInTransactionTimeoutMs,
      });
    }
    began = false;
    logger.info(
      `[atelier-finance-seed] pinned promotion transaction COMMITTED — ${applied.length} promotion(s) on one connection`,
      { applied, backendPid, database: pinnedDb }
    );
    return {
      mode: 'pinned',
      status: 'committed',
      applied,
      backendPid,
      commitAck: 'acknowledged',
    };
  } catch (error) {
    return await rolledBack((error as Error).message);
  } finally {
    releaseOnce();
  }
}

// ---------------------------------------------------------------------------
// DECISIVE READS — bound to the primary, never to the read pool (FIN-005 P1-A)
// ---------------------------------------------------------------------------

/** What the primary told us about itself, recorded as evidence. */
export interface PrimaryIdentity {
  database: string;
  databaseOid: string;
  serverAddr: string;
  serverPort: string;
  backendPid: string;
  /** Always `false` on a session this module hands out — a `true` is a refusal. */
  inRecovery: boolean;
  /** Best-effort: `pg_control_system()` is superuser-only unless granted. */
  systemIdentifier: string | null;
}

export interface DecisiveReadSession {
  /**
   * `primary`      — a client from the exactly-authorised WRITE pool, proved
   *                  not to be in recovery. Every decisive read goes here.
   * `non-postgres` — a POSITIVELY IDENTIFIED non-PostgreSQL seam (the mocked
   *                  test world). There is no pool, no primary and no replica;
   *                  `DbPromise` is the only store there is.
   */
  seam: 'primary' | 'non-postgres';
  read: PinnedReader;
  /** Present only on `seam: 'primary'`. */
  identity: PrimaryIdentity | null;
  /** Human-readable proof, for the log, the report and the marker. */
  evidence: string;
  close(): Promise<void>;
}

export type DecisiveReadOutcome =
  | { ok: true; session: DecisiveReadSession }
  | { ok: false; reason: string; evidence: string };

/**
 * Open a reader whose statements are PROVED to reach the primary.
 *
 * The three doors are the same three `decidePinnedTransactionSeam()` names, and
 * for the same reasons:
 *
 *   `postgres` — check a client out of `PostgresDatabase.getPool()` (the write
 *                pool), prove `pg_is_in_recovery() = false`, and hand it back
 *                as the reader. `DbPromise.get` / `DbPromise.all` — and
 *                therefore `getReadPool()` — are not reachable from the
 *                returned session at all.
 *   `seam`     — a positively identified non-PostgreSQL seam. There is exactly
 *                one store, so `DbPromise.all` IS the primary. Reported as
 *                `seam: 'non-postgres'` so a caller can never mistake it for a
 *                proof about a real database.
 *   `refuse`   — no PostgreSQL answered and nothing explains it. FAIL CLOSED:
 *                the caller must not read, must not write and must not
 *                compensate.
 *
 * The caller MUST `close()` the session in a `finally`; the borrowed client is
 * returned to the pool there and nowhere else.
 */
export async function openDecisiveReadSession(options?: {
  connectTimeoutMs?: number;
}): Promise<DecisiveReadOutcome> {
  const decision = await decidePinnedTransactionSeam();

  if (decision.outcome === 'refuse') {
    const reason =
      `decisive reads could not be bound to the primary: the availability probe failed on a database ` +
      `that is NOT a recognised test seam (${decision.probe.reason})`;
    logger.error(`[atelier-finance-seed] ${reason}; failing closed with ZERO statements issued`);
    return { ok: false, reason, evidence: decision.seam.signal };
  }

  if (decision.outcome === 'seam') {
    const evidence = `recognised non-PostgreSQL seam: ${decision.seam.signal}`;
    return {
      ok: true,
      session: {
        seam: 'non-postgres',
        identity: null,
        evidence,
        read: (sql, params = []) =>
          DbPromise.all<PinnedRow>(sql, (params ?? []) as unknown[], { fallback: false }),
        close: async () => {
          /* nothing was borrowed */
        },
      },
    };
  }

  let client: PoolClient;
  try {
    client = await connectWithDeadline(
      () => checkOutPinnedClient(),
      options?.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS
    );
  } catch (error) {
    const reason = `decisive reads could not be bound to the primary: could not check out a client from the authorised write pool: ${(error as Error).message}`;
    logger.error(`[atelier-finance-seed] ${reason}; failing closed with ZERO statements issued`);
    return { ok: false, reason, evidence: decision.seam.signal };
  }

  // A backend terminated under us emits `error` on the client as well as
  // rejecting the query; without a listener node turns that into an uncaught
  // exception. Same reasoning as the pinned path.
  const onClientError = (error: Error): void => {
    logger.warn('[atelier-finance-seed] the decisive read connection errored out', {
      error: error.message,
    });
  };
  client.on('error', onClientError);

  let released = false;
  const releaseOnce = async (error?: Error): Promise<void> => {
    if (released) return;
    released = true;
    if (!error) client.removeListener('error', onClientError);
    try {
      client.release(error);
    } catch (releaseError) {
      logger.warn('[atelier-finance-seed] releasing the decisive read client failed', {
        error: (releaseError as Error).message,
      });
    }
  };

  let identity: PrimaryIdentity;
  try {
    const rows = (await client.query(PRIMARY_IDENTITY_SQL)).rows ?? [];
    const row = (rows[0] ?? {}) as Record<string, unknown>;
    const database = String(row.primary_db ?? '').trim();
    if (!database) {
      throw new Error('the connection answered without current_database(); it is not PostgreSQL');
    }
    let systemIdentifier: string | null = null;
    try {
      const sys = (await client.query(PRIMARY_SYSTEM_IDENTIFIER_SQL)).rows ?? [];
      const sysRow = sys[0] as Record<string, unknown> | undefined;
      systemIdentifier = String(sysRow?.primary_system_identifier ?? '').trim() || null;
    } catch {
      // Superuser-only unless granted. Recorded as unreadable; nothing gates on
      // it here — `pg_is_in_recovery()` is the proof that matters.
      systemIdentifier = null;
    }
    identity = {
      database,
      databaseOid: String(row.primary_db_oid ?? '').trim(),
      serverAddr: String(row.primary_addr ?? '').trim(),
      serverPort: String(row.primary_port ?? '').trim(),
      backendPid: String(row.primary_pid ?? '').trim(),
      inRecovery: row.primary_in_recovery === true,
      systemIdentifier,
    };
  } catch (error) {
    await releaseOnce(error as Error);
    const reason = `decisive reads could not be bound to the primary: the identity probe on the write pool failed (${(error as Error).message})`;
    logger.error(`[atelier-finance-seed] ${reason}; failing closed with ZERO statements issued`);
    return { ok: false, reason, evidence: decision.seam.signal };
  }

  if (identity.inRecovery) {
    await releaseOnce();
    const reason =
      `decisive reads could not be bound to the primary: the authorised WRITE pool is connected to a ` +
      `STANDBY (pg_is_in_recovery() = true) on database "${identity.database}". A standby lags its ` +
      `primary and refuses every write, so neither a verdict nor a compensation may be computed from it`;
    logger.error(`[atelier-finance-seed] ${reason}; failing closed with ZERO statements issued`);
    return { ok: false, reason, evidence: decision.seam.signal };
  }

  const evidence =
    `primary PROVED: write-pool connection to database "${identity.database}" (oid ${identity.databaseOid}) ` +
    `at ${identity.serverAddr}:${identity.serverPort}, backend pid ${identity.backendPid}, ` +
    `pg_is_in_recovery()=false, system_identifier ${identity.systemIdentifier ?? '<unreadable>'}`;
  logger.info(`[atelier-finance-seed] decisive reads bound to the PRIMARY — ${evidence}`);

  return {
    ok: true,
    session: {
      seam: 'primary',
      identity,
      evidence,
      read: async (sql, params = []) => {
        if (released) {
          throw new Error('the decisive read session has been closed');
        }
        const result = await client.query(toPositional(sql), (params ?? []) as unknown[]);
        return (result.rows ?? []) as PinnedRow[];
      },
      close: () => releaseOnce(),
    },
  };
}

/**
 * The CLI's gate (FIN-005 P1-A #4): may a hosted `--write` proceed?
 *
 * Opens a decisive read session, keeps its verdict and closes it again. A
 * `non-postgres` seam is NOT a proof about a hosted database and is reported as
 * unproven, so `--write` refuses on it exactly as it refuses on a standby.
 */
export async function proveDecisiveReadsGoToPrimary(): Promise<{
  proven: boolean;
  reason: string;
  identity: PrimaryIdentity | null;
}> {
  const outcome = await openDecisiveReadSession();
  if (outcome.ok === false) return { proven: false, reason: outcome.reason, identity: null };
  try {
    if (outcome.session.seam !== 'primary') {
      return {
        proven: false,
        reason:
          `UNPROVEN — the decisive reads resolved to a recognised non-PostgreSQL seam ` +
          `(${outcome.session.evidence}), which says nothing about a hosted database`,
        identity: null,
      };
    }
    return { proven: true, reason: outcome.session.evidence, identity: outcome.session.identity };
  } finally {
    await outcome.session.close();
  }
}

/** The single door onto the pool. Lazily imported so a mocked run never opens it. */
async function checkOutPinnedClient(): Promise<PoolClient> {
  const { getPoolClientForPinnedTransaction } = await import('../../database/PostgresDatabase.js');
  return getPoolClientForPinnedTransaction();
}

/**
 * A `COMMIT` whose result never arrived — resolve it with EVIDENCE, on a
 * connection that is not the (now unusable) pinned one.
 *
 * Never returns `committed` unless the caller's `reconcile` matched all five
 * promoted records against the state its own writes intended, and never returns
 * `rolled-back` unless it matched them against the pre-transaction snapshot it
 * took under the row locks. Everything else — mixed rows, a row a third party
 * moved somewhere neither state predicts, an unexpected shape, a fresh checkout
 * that fails, a `reconcile` that throws — is `commit-indeterminate` /
 * `NEEDS_OPERATOR`.
 */
async function reconcileLostCommitAck(params: {
  request: PinnedPromotionRequest;
  commitError: Error;
  applied: string[];
  backendPid: number | null;
  connectTimeoutMs: number;
  statementTimeoutMs: number;
  idleInTransactionTimeoutMs: number;
}): Promise<PinnedPromotionOutcome> {
  const { request, commitError, applied, backendPid } = params;
  const preface = `COMMIT did not return a result (${commitError.message}); the transaction may or may not have committed`;

  logger.error(
    `[atelier-finance-seed] pinned promotion transaction COMMIT IS IN DOUBT — ${preface}; reconciling on a fresh connection`,
    { applied, backendPid }
  );

  let reconciliation: PinnedReconciliation;
  let fresh: PoolClient | null = null;
  let freshInTransaction = false;
  try {
    const client = await connectWithDeadline(() => checkOutPinnedClient(), params.connectTimeoutMs);
    fresh = client;
    // BOUNDED, AND THE BOUNDS DO NOT ESCAPE. `SET` (no LOCAL) is SESSION state,
    // and `pg` does not reset session state when a client goes back to the pool
    // — a plain `SET statement_timeout` here would ride a healthy pooled
    // connection into whatever the application does next. So the reconciliation
    // runs inside its own transaction and uses `SET LOCAL`, exactly like the
    // pinned path. READ ONLY on top: this connection exists to LOOK at a
    // transaction whose fate is unknown, and the server, not a code review,
    // should be what stops it writing. The transaction also gives the five rows
    // one consistent snapshot instead of five independent ones.
    await client.query('BEGIN READ ONLY');
    freshInTransaction = true;
    await client.query(`SET LOCAL statement_timeout = ${Number(params.statementTimeoutMs)}`);
    await client.query(
      `SET LOCAL idle_in_transaction_session_timeout = ${Number(params.idleInTransactionTimeoutMs)}`
    );
    const read: PinnedReader = async (sql, sqlParams = []) => {
      const result = await client.query(toPositional(sql), sqlParams as unknown[]);
      return (result.rows ?? []) as PinnedRow[];
    };
    reconciliation = await request.reconcile(read);
    // Deliberately NOT committed here — the `finally` ends it with ROLLBACK.
    // The transaction is READ ONLY, so the two are identical in effect, and this
    // connection exists precisely because a COMMIT's answer went missing: adding
    // a second COMMIT whose answer could also go missing would put the
    // RECONCILIATION in doubt as well.
  } catch (error) {
    reconciliation = {
      verdict: 'indeterminate',
      detail: `the reconciliation read itself failed: ${(error as Error).message}`,
    };
  } finally {
    if (fresh) {
      let releaseError: Error | undefined;
      if (freshInTransaction) {
        // End the READ ONLY transaction so the `SET LOCAL`s die with it — this
        // is the normal exit as well as the error exit. If even the ROLLBACK
        // fails the connection is unusable: destroy it rather than return a
        // mid-transaction client to the pool.
        try {
          await fresh.query('ROLLBACK');
        } catch (error) {
          releaseError = error as Error;
        }
      }
      try {
        fresh.release(releaseError);
      } catch {
        /* already gone */
      }
    }
  }

  if (reconciliation.verdict === 'committed') {
    logger.warn(
      `[atelier-finance-seed] pinned promotion transaction COMMITTED after a LOST COMMIT ACK — ${reconciliation.detail}`,
      { applied, backendPid }
    );
    return {
      mode: 'pinned',
      status: 'committed',
      applied,
      backendPid,
      commitAck: 'lost-then-confirmed',
      reconciliation,
    };
  }

  if (reconciliation.verdict === 'not-committed') {
    logger.warn(
      `[atelier-finance-seed] pinned promotion transaction ROLLED BACK (proved by reconciliation after a lost COMMIT ack) — ${reconciliation.detail}`,
      { applied, backendPid }
    );
    return {
      mode: 'pinned',
      status: 'rolled-back',
      reason: `${preface}; reconciliation proved it did NOT: ${reconciliation.detail}`,
      applied,
      // The pinned connection is gone; no ROLLBACK statement was ever sent.
      // Postgres aborted the transaction when the connection dropped.
      rollbackIssued: false,
      backendPid,
      reconciliation,
    };
  }

  logger.error(
    `[atelier-finance-seed] pinned promotion transaction COMMIT INDETERMINATE — NEEDS_OPERATOR — ${reconciliation.detail}`,
    { applied, backendPid }
  );
  return {
    mode: 'pinned',
    status: 'commit-indeterminate',
    reason: `${preface}; reconciliation could not classify it: ${reconciliation.detail}`,
    applied,
    backendPid,
    reconciliation,
    operatorAction: 'NEEDS_OPERATOR',
  };
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

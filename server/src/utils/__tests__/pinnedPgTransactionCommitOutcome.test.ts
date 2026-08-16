/**
 * MAT-006B — what a FAILED `COMMIT` is allowed to mean, and what happens to the
 * client afterwards.
 *
 * ★ WHY THIS FILE MOCKS `pg` INSTEAD OF BOOTING POSTGRESQL
 * --------------------------------------------------------
 * The real-PostgreSQL suite next door produces the ambiguous COMMIT for real,
 * and it must: the question there is what the SERVER did. The two guarantees
 * measured HERE are different in kind — they are about how `withPinnedPgTransaction`
 * CLASSIFIES an answer it has already been given, and what it hands to
 * `client.release()`. Both live entirely on the client side of the wire:
 *
 *   - the classifier's input is an `ErrorResponse` already parsed into an object.
 *     Making a real server emit `PANIC XX000` or `FATAL 53200` on demand is
 *     unreliable at best and unreproducible at worst; constructing that object is
 *     exact, and it is the SAME object shape `pg-protocol` builds.
 *   - `release()` is a `pg` API call. No database can observe it; only the pool
 *     can, so the pool is the right instrument.
 *
 * Everything the server actually decides is measured in
 * `atelierPresentationDeckSeedPostgres.test.ts` against a real PostgreSQL 16.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface ReleaseCall {
  /** The first argument — a truthy value tells `pg` to DESTROY the client. */
  arg: unknown;
  /** How many arguments were passed: `release()` and `release(undefined)` differ. */
  argc: number;
}

interface FakeClientHandle {
  /** Fire the client's `'error'` event, the way a dying socket does. */
  emitError(error: Error): void;
}

type QueryHandler = (
  sql: string,
  client: FakeClientHandle
) => Promise<{ rows: unknown[]; rowCount: number }> | { rows: unknown[]; rowCount: number };

const pgCtl = vi.hoisted(() => ({
  handler: null as null | QueryHandler,
  queries: [] as string[],
  releases: [] as ReleaseCall[],
}));

// A `pg` that answers exactly what the test under way tells it to, and records
// what it was asked and how the client was given back.
vi.mock('pg', () => {
  class FakePoolClient {
    private listeners = new Map<string, Set<(error: Error) => void>>();

    on(event: string, fn: (error: Error) => void): this {
      const set = this.listeners.get(event) ?? new Set();
      set.add(fn);
      this.listeners.set(event, set);
      return this;
    }

    removeListener(event: string, fn: (error: Error) => void): this {
      this.listeners.get(event)?.delete(fn);
      return this;
    }

    emitError(error: Error): void {
      for (const fn of this.listeners.get('error') ?? []) fn(error);
    }

    async query(sql: string): Promise<{ rows: unknown[]; rowCount: number }> {
      pgCtl.queries.push(sql);
      if (!pgCtl.handler) return { rows: [], rowCount: 0 };
      return await pgCtl.handler(sql, this);
    }

    release(...args: unknown[]): void {
      pgCtl.releases.push({ arg: args[0], argc: args.length });
    }
  }

  class FakePool {
    on(): this {
      return this;
    }
    async connect(): Promise<FakePoolClient> {
      return new FakePoolClient();
    }
    async end(): Promise<void> {
      /* nothing to close */
    }
  }

  class FakeClient {}

  return { Pool: FakePool, Client: FakeClient, default: { Pool: FakePool, Client: FakeClient } };
});

// The module resolves its connection settings late; give it a fixed answer so
// this file never depends on the ambient environment or on `DatabaseConfig`'s
// `process.exit(1)` path.
vi.mock('../../config/DatabaseConfig.js', () => ({
  getDatabaseConfig: () => ({
    type: 'postgres',
    postgres: {
      host: '127.0.0.1',
      port: 5432,
      database: 'unused',
      user: 'unused',
      password: 'unused',
      ssl: false,
    },
  }),
}));

vi.mock('../Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { closePinnedPgPool, withPinnedPgTransaction } from '../pinnedPgTransaction.js';

/**
 * The shape `pg-protocol` produces from an `ErrorResponse`: a real `Error` with
 * the parsed fields hung off it. `severity` is the LOCALIZED field `S`; `code`
 * is the SQLSTATE, field `C`, which the server never translates.
 */
function pgError(message: string, code: string, severity = 'ERROR'): Error {
  return Object.assign(new Error(message), { severity, code, name: 'error' });
}

/** Run a transaction whose work succeeds and whose COMMIT fails with `error`. */
async function commitRejectedWith(error: unknown) {
  pgCtl.handler = (sql) => {
    if (sql === 'COMMIT') return Promise.reject(error);
    return { rows: [], rowCount: 1 };
  };
  return withPinnedPgTransaction(async (client) => {
    await client.query('UPDATE presentation_decks SET title = ? WHERE id = ?', ['t', 'd']);
    return 'work done';
  });
}

beforeEach(() => {
  process.env.DB_TYPE = 'postgres';
  process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:5432/unused';
  pgCtl.handler = null;
  pgCtl.queries.length = 0;
  pgCtl.releases.length = 0;
});

afterEach(async () => {
  await closePinnedPgPool();
});

// ---------------------------------------------------------------------------

describe('MAT-006B — a failed COMMIT is only `rolled_back` on an ALLOW-LISTED SQLSTATE', () => {
  // The whole allow-list, one case each. Each of these can ONLY be the server
  // saying it aborted: a deferred constraint checked at commit time, a
  // serialization conflict detected at commit time, the deadlock detector's own
  // victim, and a refused lock. None of them can leave a commit record behind.
  const ABORTED_AT_COMMIT: Array<[string, string]> = [
    ['23505', 'duplicate key value violates unique constraint (DEFERRED)'],
    ['23503', 'insert or update violates foreign key constraint (DEFERRED)'],
    ['23514', 'new row violates check constraint (DEFERRED)'],
    ['40001', 'could not serialize access due to read/write dependencies'],
    ['40P01', 'deadlock detected'],
    ['55P03', 'lock not available'],
  ];

  for (const [code, message] of ABORTED_AT_COMMIT) {
    it(`SQLSTATE ${code} at COMMIT is rolled_back — the server said it aborted`, async () => {
      const outcome = await commitRejectedWith(pgError(message, code));

      expect(outcome.available).toBe(true);
      if (outcome.available) {
        expect(outcome.state).toBe('rolled_back');
        if (outcome.state === 'rolled_back') {
          expect(outcome.error).toContain(`SQLSTATE ${code}`);
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // ★ F1 — THE MEASURED DEFECT. The previous cut accepted ANY parsed SQLSTATE
  // except classes `08` and `57P0`, so both of these came back `rolled_back`.
  // -------------------------------------------------------------------------

  it('★ a PANIC at COMMIT is INDETERMINATE — `cannot abort transaction, it was already committed` is XX000', async () => {
    // This is the exact error PostgreSQL raises BECAUSE the commit stands.
    // Classifying it as `rolled_back` would report "nothing changed" about a
    // database whose own panic message says the transaction committed.
    const outcome = await commitRejectedWith(
      pgError('cannot abort transaction 12345, it was already committed', 'XX000', 'PANIC')
    );

    expect(outcome.available).toBe(true);
    if (outcome.available) {
      expect(outcome.state).toBe('indeterminate');
      if (outcome.state === 'indeterminate') {
        expect(outcome.error).toMatch(/UNKNOWN/);
        expect(outcome.error).not.toMatch(/nothing was (changed|written)/i);
      }
    }
  });

  it('★ a FATAL at COMMIT is INDETERMINATE — an out-of-memory backend proves nothing about the commit record', async () => {
    const outcome = await commitRejectedWith(pgError('out of memory', '53200', 'FATAL'));

    expect(outcome.available).toBe(true);
    expect(outcome.available && outcome.state).toBe('indeterminate');
  });

  it('★ MUTATION GUARD — a 57P01 admin shutdown at COMMIT is INDETERMINATE, never rolled_back', async () => {
    // A backend can be terminated at an interrupt point a commit has ALREADY
    // passed, so a shutdown FATAL delivered around a COMMIT does not establish
    // which side of the commit record it fell on. Putting `57P0` back into the
    // classifier's accepted set (the old exclusion, deleted) turns this red.
    const outcome = await commitRejectedWith(
      pgError('terminating connection due to administrator command', '57P01', 'FATAL')
    );

    expect(outcome.available).toBe(true);
    expect(outcome.available && outcome.state).toBe('indeterminate');
  });

  it('a connection-class 08006 at COMMIT is INDETERMINATE — the connection is the thing in doubt', async () => {
    const outcome = await commitRejectedWith(pgError('connection failure', '08006', 'FATAL'));

    expect(outcome.available).toBe(true);
    expect(outcome.available && outcome.state).toBe('indeterminate');
  });

  it('a socket failure carrying no SQLSTATE at all is INDETERMINATE', async () => {
    const socketError = Object.assign(new Error('Connection terminated unexpectedly'), {
      code: 'ECONNRESET',
    });
    const outcome = await commitRejectedWith(socketError);

    expect(outcome.available).toBe(true);
    expect(outcome.available && outcome.state).toBe('indeterminate');
  });

  // -------------------------------------------------------------------------

  it('★ the verdict does not read `severity`, so a non-English lc_messages cannot change it', async () => {
    // `pg-protocol` parses field `S`, which the server LOCALIZES: under
    // `lc_messages='pl_PL'` an ordinary error says `BŁĄD`. Any classifier that
    // tested `severity === 'ERROR'` would call every abort on such a cluster
    // `indeterminate`, and every PANIC there `rolled_back` if it tested the
    // other way. SQLSTATE (field `C`) is never translated.
    const localizedAbort = await commitRejectedWith(
      pgError('naruszenie unikalnego ograniczenia', '23505', 'BŁĄD')
    );
    expect(localizedAbort.available && localizedAbort.state).toBe('rolled_back');

    const localizedPanic = await commitRejectedWith(
      pgError('nie można przerwać transakcji', 'XX000', 'PANIKA')
    );
    expect(localizedPanic.available && localizedPanic.state).toBe('indeterminate');

    // And an ErrorResponse whose `S` field never arrived at all is still
    // classified by its SQLSTATE.
    const noSeverity = await commitRejectedWith(
      Object.assign(new Error('deadlock detected'), { code: '40P01' })
    );
    expect(noSeverity.available && noSeverity.state).toBe('rolled_back');
  });

  it('a COMMIT the server accepted is `committed`, and the work value comes back', async () => {
    pgCtl.handler = () => ({ rows: [], rowCount: 1 });
    const outcome = await withPinnedPgTransaction(async () => 'the value');

    expect(outcome.available).toBe(true);
    if (outcome.available && outcome.state === 'committed') {
      expect(outcome.value).toBe('the value');
    } else {
      expect.unreachable('a clean COMMIT must be `committed`');
    }
    expect(pgCtl.queries).toEqual(['BEGIN', 'COMMIT']);
  });
});

// ---------------------------------------------------------------------------

describe('MAT-006B — a client is never returned to the pool with a transaction still open', () => {
  it('★ MUTATION GUARD — a ROLLBACK that FAILED destroys the client instead of pooling it', async () => {
    // Measured on the previous cut: `release()` was handed `undefined` here, so
    // `pg` put a LIVE client with an OPEN transaction back into the pool while
    // the log line said it had been discarded. The next caller's BEGIN would
    // nest inside that transaction and its COMMIT could commit writes THIS call
    // already reported `rolled_back`.
    //
    // `25P02` is deliberately NOT a connection error: the connection is fine,
    // which is exactly the case that used to pass `undefined`.
    pgCtl.handler = (sql) => {
      if (sql === 'ROLLBACK') {
        return Promise.reject(pgError('current transaction is aborted', '25P02'));
      }
      return { rows: [], rowCount: 1 };
    };

    const outcome = await withPinnedPgTransaction(async (client) => {
      await client.query('UPDATE presentation_decks SET title = ? WHERE id = ?', ['t', 'd']);
      throw new Error('the work failed');
    });

    expect(outcome.available && outcome.state).toBe('rolled_back');
    expect(pgCtl.queries).toEqual([
      'BEGIN',
      'UPDATE presentation_decks SET title = $1 WHERE id = $2',
      'ROLLBACK',
    ]);
    expect(pgCtl.releases).toHaveLength(1);
    // Both halves matter: `release()` with NO argument and `release(undefined)`
    // are the same instruction to `pg` — "this client is healthy, pool it".
    expect(pgCtl.releases[0].argc).toBe(1);
    expect(pgCtl.releases[0].arg).toBeInstanceOf(Error);
    expect((pgCtl.releases[0].arg as Error).message).toContain('current transaction is aborted');
  });

  it('a ROLLBACK that SUCCEEDED returns the client to the pool — the transaction is over', async () => {
    pgCtl.handler = () => ({ rows: [], rowCount: 1 });

    const outcome = await withPinnedPgTransaction(async () => {
      throw new Error('the work failed');
    });

    expect(outcome.available && outcome.state).toBe('rolled_back');
    expect(pgCtl.releases).toHaveLength(1);
    // Nothing is wrong with this connection, so destroying it would be waste.
    expect(pgCtl.releases[0].arg).toBeUndefined();
  });

  it('a COMMIT whose answer never came destroys the client', async () => {
    const outcome = await commitRejectedWith(
      Object.assign(new Error('Connection terminated unexpectedly'), { code: 'ECONNRESET' })
    );

    expect(outcome.available && outcome.state).toBe('indeterminate');
    expect(pgCtl.releases).toHaveLength(1);
    expect(pgCtl.releases[0].arg).toBeInstanceOf(Error);
  });

  it('a client that emitted `error` mid-transaction destroys the client', async () => {
    pgCtl.handler = (sql, client) => {
      if (sql.startsWith('UPDATE')) {
        client.emitError(new Error('Connection terminated unexpectedly'));
        return Promise.reject(new Error('Connection terminated unexpectedly'));
      }
      return { rows: [], rowCount: 1 };
    };

    const outcome = await withPinnedPgTransaction(async (client) => {
      await client.query('UPDATE presentation_decks SET title = ? WHERE id = ?', ['t', 'd']);
      return 'never reached';
    });

    expect(outcome.available && outcome.state).toBe('rolled_back');
    expect(pgCtl.releases).toHaveLength(1);
    expect(pgCtl.releases[0].arg).toBeInstanceOf(Error);
  });

  it('a COMMIT the server ABORTED leaves nothing open, so the client goes back to the pool', async () => {
    const outcome = await commitRejectedWith(pgError('deadlock detected', '40P01'));

    expect(outcome.available && outcome.state).toBe('rolled_back');
    expect(pgCtl.releases).toHaveLength(1);
    expect(pgCtl.releases[0].arg).toBeUndefined();
  });
});

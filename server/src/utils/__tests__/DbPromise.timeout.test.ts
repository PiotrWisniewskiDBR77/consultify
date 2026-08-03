/**
 * DbPromise — timeout settlement contract (FIN-005).
 *
 * `run()` used to arm a timeout that, with `{ fallback: false }`, did nothing
 * at all: no resolve, no reject. The promise stayed pending forever and the
 * caller hung waiting for a driver callback that was never coming (this is what
 * made the Atelier finance seed hang instead of failing). These tests pin the
 * settlement contract for all three wrappers:
 *
 *   - a timeout always settles the promise (resolve on fallback, reject otherwise),
 *   - a query settles EXACTLY once — a driver callback arriving after the timeout
 *     (or a driver calling back twice) must be completely inert, including its
 *     logging and `recordQueryPerformance` side effects,
 *   - the normal callback path clears the timer, so nothing leaks.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recordQueryPerformance = vi.fn();
const loggerWarn = vi.fn();
const loggerError = vi.fn();
const loggerInfo = vi.fn();

vi.mock('../queryHelpers.js', () => ({
  recordQueryPerformance: (...args: unknown[]) => recordQueryPerformance(...args),
}));

vi.mock('../Logger.js', () => {
  const logger = {
    warn: (...args: unknown[]) => loggerWarn(...args),
    error: (...args: unknown[]) => loggerError(...args),
    info: (...args: unknown[]) => loggerInfo(...args),
    debug: vi.fn(),
  };
  return { __esModule: true, default: logger, logger };
});

// The module captures `dbProxy` at import time for the string-first overloads.
// Route it to a mutable holder so tests can install their own fake driver.
const proxyTarget: { current: Record<string, unknown> } = { current: {} };
vi.mock('../../database/Database.js', () => {
  const proxy = new Proxy(
    {},
    {
      get: (_t, prop: string) => (proxyTarget.current as Record<string, unknown>)[prop],
    }
  );
  return { __esModule: true, default: proxy, getDatabase: () => proxy };
});

import { all, type Database, get, run } from '../DbPromise.js';

// ==========================================
// HELPERS
// ==========================================

type Settlement<T> = {
  status: 'pending' | 'fulfilled' | 'rejected';
  value?: T;
  reason?: unknown;
};

/**
 * Observe a promise without awaiting it. Awaiting a promise that never settles
 * would hang the test until vitest's global timeout; tracking + a synchronous
 * assertion turns "it hangs" into a fast, deterministic FAILURE instead.
 * Attaching handlers here also means a rejection is never "unhandled".
 */
function track<T>(promise: Promise<T>): Settlement<T> {
  const state: Settlement<T> = { status: 'pending' };
  promise.then(
    (value) => {
      state.status = 'fulfilled';
      state.value = value;
    },
    (reason) => {
      state.status = 'rejected';
      state.reason = reason;
    }
  );
  return state;
}

/** Drain the microtask queue (fake timers do not fake microtasks). */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

type RunCb = (this: { lastID?: number; changes: number }, err: Error | null) => void;

/** A driver whose callbacks are captured instead of invoked, so tests drive them. */
function makeDeferredDriver() {
  const captured: {
    all?: (err: Error | null, rows: unknown[]) => void;
    get?: (err: Error | null, row: unknown) => void;
    run?: RunCb;
  } = {};
  const db: Database = {
    all: (_sql, _params, cb) => {
      captured.all = cb;
    },
    get: (_sql, _params, cb) => {
      captured.get = cb;
    },
    run: (_sql, _params, cb) => {
      captured.run = cb as RunCb;
    },
    exec: (_sql, cb) => cb(null),
  };
  return { db, captured };
}

const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown): void => {
  unhandled.push(reason);
};

beforeEach(() => {
  vi.useFakeTimers();
  recordQueryPerformance.mockClear();
  loggerWarn.mockClear();
  loggerError.mockClear();
  loggerInfo.mockClear();
  unhandled.length = 0;
  process.on('unhandledRejection', onUnhandled);
});

afterEach(() => {
  process.off('unhandledRejection', onUnhandled);
  // 6 — no timer leaks on ANY path exercised by the test that just ran.
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

// ==========================================
// 1 + 2 — the timeout always settles
// ==========================================

describe('run() timeout settlement', () => {
  it('1 — rejects (bounded) when the callback never returns and fallback=false', async () => {
    const { db } = makeDeferredDriver();

    const state = track(run(db, 'UPDATE t SET a = ?', [1], { timeout: 50, fallback: false }));

    expect(state.status).toBe('pending');

    await vi.advanceTimersByTimeAsync(50);
    await flush();

    // Synchronous assertion: if the promise is still pending this FAILS now,
    // it does not hang.
    expect(state.status).toBe('rejected');
    expect((state.reason as Error).message).toBe('Database query timeout after 50ms');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('2 — resolves to the failure result when the callback never returns and fallback=true', async () => {
    const { db } = makeDeferredDriver();

    const state = track(run(db, 'UPDATE t SET a = ?', [1], { timeout: 50, fallback: true }));

    await vi.advanceTimersByTimeAsync(50);
    await flush();

    expect(state.status).toBe('fulfilled');
    expect(state.value).toEqual({ success: false, error: 'timeout' });
  });

  it('2b — fallback defaults to true, so an omitted option still resolves', async () => {
    const { db } = makeDeferredDriver();

    const state = track(run(db, 'UPDATE t SET a = ?', [1], { timeout: 50 }));

    await vi.advanceTimersByTimeAsync(50);
    await flush();

    expect(state.status).toBe('fulfilled');
    expect(state.value).toEqual({ success: false, error: 'timeout' });
  });

  it('2c — the timeout message matches all()/get()', async () => {
    const drivers = [makeDeferredDriver(), makeDeferredDriver(), makeDeferredDriver()];
    const states = [
      track(all(drivers[0].db, 'SELECT 1', [], { timeout: 40, fallback: false })),
      track(get(drivers[1].db, 'SELECT 1', [], { timeout: 40, fallback: false })),
      track(run(drivers[2].db, 'UPDATE t SET a = 1', [], { timeout: 40, fallback: false })),
    ];

    await vi.advanceTimersByTimeAsync(40);
    await flush();

    for (const state of states) {
      expect(state.status).toBe('rejected');
      expect((state.reason as Error).message).toBe('Database query timeout after 40ms');
    }
  });
});

// ==========================================
// 3 — late callback is inert
// ==========================================

describe('run() late callback', () => {
  it('3 — a callback arriving after the timeout does not settle again, log again or record again', async () => {
    const { db, captured } = makeDeferredDriver();

    const state = track(run(db, 'UPDATE t SET a = ?', [1], { timeout: 50, fallback: false }));

    await vi.advanceTimersByTimeAsync(50);
    await flush();

    expect(state.status).toBe('rejected');
    const firstReason = state.reason;
    expect(recordQueryPerformance).toHaveBeenCalledTimes(1);
    const warnCallsAfterTimeout = loggerWarn.mock.calls.length;

    // The real driver finally answers — successfully.
    expect(() => captured.run?.call({ lastID: 7, changes: 1 }, null)).not.toThrow();
    await flush();

    expect(state.status).toBe('rejected');
    expect(state.reason).toBe(firstReason);
    expect(recordQueryPerformance).toHaveBeenCalledTimes(1);
    expect(loggerWarn.mock.calls.length).toBe(warnCallsAfterTimeout);
    expect(unhandled).toEqual([]);
  });

  it('3b — a late ERROR callback after a fallback timeout does not overwrite the result', async () => {
    const { db, captured } = makeDeferredDriver();

    const state = track(run(db, 'UPDATE t SET a = ?', [1], { timeout: 50, fallback: true }));

    await vi.advanceTimersByTimeAsync(50);
    await flush();

    expect(state.value).toEqual({ success: false, error: 'timeout' });
    expect(recordQueryPerformance).toHaveBeenCalledTimes(1);

    expect(() => captured.run?.call({ changes: 0 }, new Error('connection reset'))).not.toThrow();
    await flush();

    expect(state.value).toEqual({ success: false, error: 'timeout' });
    expect(recordQueryPerformance).toHaveBeenCalledTimes(1);
    expect(unhandled).toEqual([]);
  });

  it('3c — a driver that calls back twice still settles once', async () => {
    const { db, captured } = makeDeferredDriver();

    const state = track(run(db, 'UPDATE t SET a = ?', [1], { timeout: 5000, fallback: false }));

    captured.run?.call({ lastID: 1, changes: 1 }, null);
    await flush();
    expect(state.status).toBe('fulfilled');
    expect(recordQueryPerformance).toHaveBeenCalledTimes(1);

    expect(() => captured.run?.call({ changes: 0 }, new Error('second callback'))).not.toThrow();
    await flush();

    expect(state.value).toEqual({ success: true, lastID: 1, changes: 1 });
    expect(recordQueryPerformance).toHaveBeenCalledTimes(1);
    expect(unhandled).toEqual([]);
  });

  it('3d — all() and get() are also inert on a late callback', async () => {
    const a = makeDeferredDriver();
    const g = makeDeferredDriver();

    const allState = track(all(a.db, 'SELECT 1', [], { timeout: 50, fallback: true }));
    const getState = track(get(g.db, 'SELECT 1', [], { timeout: 50, fallback: true }));

    await vi.advanceTimersByTimeAsync(50);
    await flush();

    expect(allState.value).toEqual([]);
    expect(getState.value).toBeNull();
    expect(recordQueryPerformance).toHaveBeenCalledTimes(2);

    expect(() => a.captured.all?.(null, [{ id: 1 }])).not.toThrow();
    expect(() => g.captured.get?.(new Error('too late'), null)).not.toThrow();
    await flush();

    expect(allState.value).toEqual([]);
    expect(getState.value).toBeNull();
    expect(recordQueryPerformance).toHaveBeenCalledTimes(2);
    expect(unhandled).toEqual([]);
  });
});

// ==========================================
// 4 + 5 — normal paths unchanged
// ==========================================

describe('run() normal paths', () => {
  it('4 — succeeds before the timeout and clears the timer', async () => {
    const { db, captured } = makeDeferredDriver();

    const state = track(run(db, 'INSERT INTO t VALUES (?)', [1], { timeout: 5000 }));
    expect(vi.getTimerCount()).toBe(1);

    captured.run?.call({ lastID: 42, changes: 1 }, null);
    await flush();

    expect(state.status).toBe('fulfilled');
    expect(state.value).toEqual({ success: true, lastID: 42, changes: 1 });
    // Timer cleared on the normal path — nothing left to fire.
    expect(vi.getTimerCount()).toBe(0);

    // Advancing well past the original timeout changes nothing.
    await vi.advanceTimersByTimeAsync(10_000);
    await flush();
    expect(recordQueryPerformance).toHaveBeenCalledTimes(1);
  });

  it('5 — a callback error with fallback=true resolves to the failure result', async () => {
    const { db, captured } = makeDeferredDriver();

    const state = track(
      run(db, 'INSERT INTO t VALUES (?)', [1], { timeout: 5000, fallback: true })
    );
    captured.run?.call({ changes: 0 }, new Error('UNIQUE constraint failed'));
    await flush();

    expect(state.status).toBe('fulfilled');
    expect(state.value).toEqual({ success: false, error: 'UNIQUE constraint failed' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('5b — a callback error with fallback=false rejects with the ORIGINAL error object', async () => {
    const { db, captured } = makeDeferredDriver();
    const driverError = new Error('UNIQUE constraint failed');

    const state = track(
      run(db, 'INSERT INTO t VALUES (?)', [1], { timeout: 5000, fallback: false })
    );
    captured.run?.call({ changes: 0 }, driverError);
    await flush();

    expect(state.status).toBe('rejected');
    // Not wrapped, not converted to a RunResult — same identity as today.
    expect(state.reason).toBe(driverError);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('5c — a synchronous driver throw keeps its current semantics for both fallback values', async () => {
    const boom = new Error('Database not initialized');
    const throwingDb: Database = {
      all: () => {
        throw boom;
      },
      get: () => {
        throw boom;
      },
      run: () => {
        throw boom;
      },
      exec: (_sql, cb) => cb(null),
    };

    const softState = track(run(throwingDb, 'INSERT INTO t VALUES (1)', [], { fallback: true }));
    const hardState = track(run(throwingDb, 'INSERT INTO t VALUES (1)', [], { fallback: false }));
    await flush();

    expect(softState.value).toEqual({ success: false, error: 'Database not initialized' });
    expect(hardState.status).toBe('rejected');
    expect(hardState.reason).toBe(boom);
    expect(vi.getTimerCount()).toBe(0);
  });
});

// ==========================================
// Consumer-facing consequence
// ==========================================

describe('module-level db (string overload)', () => {
  it('a timed-out write through the default proxy rejects instead of hanging', async () => {
    const { db, captured } = makeDeferredDriver();
    proxyTarget.current = db as unknown as Record<string, unknown>;

    const state = track(run('UPDATE t SET a = 1', [], { timeout: 50, fallback: false }));

    await vi.advanceTimersByTimeAsync(50);
    await flush();

    expect(state.status).toBe('rejected');
    expect((state.reason as Error).message).toBe('Database query timeout after 50ms');

    // The driver eventually answering must not disturb the settled promise.
    expect(() => captured.run?.call({ changes: 1 }, null)).not.toThrow();
    await flush();
    expect(state.status).toBe('rejected');
  });
});

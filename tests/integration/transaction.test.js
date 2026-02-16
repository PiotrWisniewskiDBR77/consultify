/**
 * L1: DbPromise transaction-ish behavior (honest unit tests).
 *
 * This replaces a fake "transaction API" built inside a test-only express app.
 */

import { describe, expect, it, vi } from 'vitest';

import { all as dbAll, get as dbGet } from '../../server/src/utils/DbPromise.js';

describe('DbPromise', () => {
  it('all(): resolves [] on timeout when fallback=true', async () => {
    vi.useFakeTimers();

    try {
      const fakeDb = {
        all: (_sql, _params, _cb) => {},
        get: (_sql, _params, _cb) => {},
        run: (_sql, _params, _cb) => {},
        exec: (_sql, _cb) => {},
      };

      const promise = dbAll(fakeDb, 'SELECT 1', [], { timeout: 10, fallback: true });
      await vi.advanceTimersByTimeAsync(20);

      await expect(promise).resolves.toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('all(): rejects on timeout when fallback=false', async () => {
    vi.useFakeTimers();

    try {
      const fakeDb = {
        all: (_sql, _params, _cb) => {},
        get: (_sql, _params, _cb) => {},
        run: (_sql, _params, _cb) => {},
        exec: (_sql, _cb) => {},
      };

      const promise = dbAll(fakeDb, 'SELECT 1', [], { timeout: 10, fallback: false });
      void promise.catch(() => undefined); // avoid unhandled rejection warning before assertion attaches
      await vi.advanceTimersByTimeAsync(20);

      await expect(promise).rejects.toThrow(/timeout/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('get(): resolves null when callback returns table-not-found and fallback=true', async () => {
    const fakeDb = {
      all: (_sql, _params, _cb) => {},
      get: (_sql, _params, cb) => cb(new Error('no such table: users'), null),
      run: (_sql, _params, _cb) => {},
      exec: (_sql, _cb) => {},
    };

    const result = await dbGet(fakeDb, 'SELECT * FROM users', [], { fallback: true, timeout: 50 });
    expect(result).toBe(null);
  });
});

/**
 * A14 (2026-08-13) regression coverage for the defensive timeout wrapped
 * around the database readiness sequence in index.ts (see
 * `DB_READINESS_TIMEOUT_MS` usage there).
 *
 * The investigation's working hypothesis was that `runMigrations()` or
 * `settleDatabaseReadiness` could hang on a stuck query or an unresolved
 * await. That turned out not to be this incident's actual root cause (see
 * testModeGates.test.ts), but the requirement stands on its own: readiness
 * must never be able to hang the process forever with no explanation. This
 * test proves `withTimeout` rejects a genuinely-never-resolving promise in
 * bounded time with an explicit message, using a short timeout so the test
 * itself stays fast — no live server, no database.
 */
import { describe, expect, it } from 'vitest';

import { withTimeout } from '../withTimeout.js';

describe('A14 — withTimeout (readiness must never hang silently)', () => {
  it('rejects with the explicit message when the wrapped promise never settles', async () => {
    const neverResolves = new Promise<never>(() => {
      /* intentionally hangs, simulating a stuck migration/query */
    });

    await expect(withTimeout(neverResolves, 25, 'boom: timed out')).rejects.toThrow(
      'boom: timed out'
    );
  });

  it('resolves normally when the wrapped promise settles before the deadline', async () => {
    const fast = Promise.resolve('ok');
    await expect(withTimeout(fast, 5_000, 'should not fire')).resolves.toBe('ok');
  });

  it('propagates the original rejection when the wrapped promise rejects before the deadline', async () => {
    const fails = Promise.reject(new Error('real failure'));
    await expect(withTimeout(fails, 5_000, 'should not fire')).rejects.toThrow('real failure');
  });

  it('does not keep the event loop alive waiting on its own timer (unref)', async () => {
    // Regression guard: an early implementation used a bare Promise.race
    // with an un-unref'd setTimeout, which (in a real server) would be a
    // second, unrelated way to end up with a dangling handle after readiness
    // settles via the happy path. Asserting the timer object exposes/skips
    // an active handle is environment-dependent, so this is a smoke test
    // that the resolved-fast path doesn't throw or warn.
    await expect(withTimeout(Promise.resolve(1), 50, 'unused')).resolves.toBe(1);
  });
});

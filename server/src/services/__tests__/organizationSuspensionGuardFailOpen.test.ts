/**
 * DEC-91 FIX-4 — a database failure must never become a CACHED "not suspended".
 *
 * ===========================================================================
 * THE BUG THIS PINS
 * ===========================================================================
 * `DbPromise.get` defaults to `fallback: true`, and on that path an error, a
 * timeout or a thrown exception all RESOLVE `null` rather than rejecting
 * (`server/src/utils/DbPromise.ts` — see the `if (fallback) resolve(null)`
 * branches). The guard's `catch` was therefore dead for every DbPromise-backed
 * caller. The failure arrived as "no row", was read as "not suspended", and was
 * written to the cache for a FULL TTL — refreshed by each subsequent failure.
 *
 * Concretely: while the database misbehaved, a SUSPENDED tenant got every front
 * door back for 30 seconds at a time. The module header claimed "caches
 * nothing", which was true of the design and false of the runtime.
 *
 * ===========================================================================
 * TWO INDEPENDENT DEFENCES, PINNED SEPARATELY
 * ===========================================================================
 *   1. call sites pass `{ fallback: false }`, so failures really reject;
 *   2. the guard caches a verdict only when a row was actually seen.
 *
 * They are tested apart on purpose: either one alone would let this suite pass
 * a naive reading, and either one can be re-broken independently by a later
 * edit. Defence 2 is the one that makes a forgotten (1) survivable.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __testing__,
  isOrganizationSuspended,
} from '../organizationSuspensionGuard.js';

describe('DEC-91 FIX-4 — database failures do not poison the suspension cache', () => {
  beforeEach(() => __testing__.reset());
  afterEach(() => __testing__.reset());

  describe('defence 2: a verdict is cached only when a row was seen', () => {
    it('does NOT cache "not suspended" when the lookup resolves a null row', async () => {
      // This is precisely what a `fallback: true` handle does on error. Even if
      // a future call site forgets `{ fallback: false }`, the wrong answer must
      // not stick for a TTL.
      const dbGet = vi
        .fn()
        .mockResolvedValueOnce(null) // "error", swallowed into a null row
        .mockResolvedValue({ status: 'suspended' }); // database recovers

      await expect(isOrganizationSuspended('org-a', dbGet)).resolves.toBe(false);
      expect(__testing__.cacheSize()).toBe(0);

      // The very next call sees the truth instead of a 30-second stale "false".
      await expect(isOrganizationSuspended('org-a', dbGet)).resolves.toBe(true);
      expect(dbGet).toHaveBeenCalledTimes(2);
    });

    it('does NOT cache when the row exists but carries no status', async () => {
      const dbGet = vi.fn().mockResolvedValue({});

      await expect(isOrganizationSuspended('org-b', dbGet)).resolves.toBe(false);
      expect(__testing__.cacheSize()).toBe(0);
    });

    it('DOES cache a real answer — the optimisation must survive the fix', async () => {
      const dbGet = vi.fn().mockResolvedValue({ status: 'active' });

      await isOrganizationSuspended('org-c', dbGet);
      await isOrganizationSuspended('org-c', dbGet);

      expect(dbGet).toHaveBeenCalledTimes(1);
      expect(__testing__.cacheSize()).toBe(1);
    });
  });

  describe('defence 1: a rejecting handle reaches the catch', () => {
    it('fails open for the request but caches nothing', async () => {
      const dbGet = vi
        .fn()
        .mockRejectedValueOnce(new Error('Database query timeout after 5000ms'))
        .mockResolvedValue({ status: 'suspended' });

      await expect(isOrganizationSuspended('org-d', dbGet)).resolves.toBe(false);
      expect(__testing__.cacheSize()).toBe(0);
      await expect(isOrganizationSuspended('org-d', dbGet)).resolves.toBe(true);
    });

    it('a sustained outage never accumulates a stale verdict', async () => {
      const dbGet = vi.fn().mockRejectedValue(new Error('connection reset'));

      for (let i = 0; i < 20; i++) {
        await expect(isOrganizationSuspended('org-e', dbGet)).resolves.toBe(false);
      }
      expect(__testing__.cacheSize()).toBe(0);
      // Every single call retried rather than being served a cached "false".
      expect(dbGet).toHaveBeenCalledTimes(20);
    });
  });

  describe('the suspended verdict itself still sticks', () => {
    it('a suspended tenant is answered from cache, not re-queried', async () => {
      const dbGet = vi.fn().mockResolvedValue({ status: 'suspended' });

      await expect(isOrganizationSuspended('org-f', dbGet)).resolves.toBe(true);
      await expect(isOrganizationSuspended('org-f', dbGet)).resolves.toBe(true);
      expect(dbGet).toHaveBeenCalledTimes(1);
    });
  });
});

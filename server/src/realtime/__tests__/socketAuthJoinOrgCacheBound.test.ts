/**
 * DEC-91 FIX-5 — a client cannot grow the suspension cache by spamming
 * `join:org` with ids it invented.
 *
 * ===========================================================================
 * THE BUG THIS PINS — INTRODUCED BY DEC-91 ITSELF
 * ===========================================================================
 * The first revision asked `isOrganizationSuspended` about the `join:org`
 * argument BEFORE checking membership. That argument is raw client input
 * (anything up to 128 characters passes the guard's id normalisation), and the
 * guard's cache is a `Map` with no ceiling whose entries expire only when read.
 * An authenticated socket could therefore loop over random ids and grow that
 * Map without bound — a memory-exhaustion vector opened by the very change
 * meant to harden the surface. An adversarial audit caught it.
 *
 * ===========================================================================
 * WHAT IS ASSERTED
 * ===========================================================================
 * The headline case is the audit's own bar: 5000 distinct `join:org` payloads
 * leave no lasting growth. The supporting cases pin WHY, so a future edit that
 * removes one layer fails here rather than silently restoring the vector:
 *   - the guard is not even consulted for a non-member id;
 *   - a legitimate member still gets the suspension check;
 *   - the guard's own ceiling holds if something upstream regresses.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({
  ORG_STATUS: { 'org-active': 'active', 'org-suspended': 'suspended' } as Record<string, string>,
  /** user-1 is a member of these, and nothing else. */
  MEMBER_OF: new Set(['org-active', 'org-suspended']),
  dbGet: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => H.dbGet(...args),
  run: vi.fn(async () => undefined),
  all: vi.fn(async () => []),
}));

vi.mock('../demoRealtimeGuard.js', () => ({
  evaluateRealtimeAccess: vi.fn(async () => ({ allowed: true })),
  trackRealtimeConnection: vi.fn(() => () => undefined),
  assertRealtimeEventAllowed: vi.fn(async () => true),
}));

const { validateJoinOrg } = await import('../socketAuth.js');
const { __testing__, isOrganizationSuspended } = await import(
  '../../services/organizationSuspensionGuard.js'
);

/** Counts how often the ORGANIZATIONS table was consulted. */
let orgStatusQueries = 0;

beforeEach(() => {
  vi.clearAllMocks();
  __testing__.reset();
  orgStatusQueries = 0;

  H.dbGet.mockImplementation(async (sql: string, params?: unknown[]) => {
    const text = String(sql);
    if (text.includes('FROM organizations')) {
      orgStatusQueries += 1;
      const status = H.ORG_STATUS[String((params || [])[0])];
      return status ? { status } : null;
    }
    if (text.includes('organization_members')) {
      const org = String((params || [])[0]);
      return H.MEMBER_OF.has(org) ? { user_id: 'user-1' } : null;
    }
    return null;
  });
});

afterEach(() => __testing__.reset());

/** A socket whose token binds it to nothing, so every join takes the DB probe. */
const socket = () => ({ data: { user: { id: 'user-1' } } }) as never;

describe('DEC-91 FIX-5 — join:org cannot grow the suspension cache', () => {
  it('5000 distinct join:org ids leave the cache empty', async () => {
    for (let i = 0; i < 5000; i++) {
      const refused = await validateJoinOrg(socket(), `org-fake-${i}`);
      expect(refused).toBe(false);
    }

    // Not "bounded" — actually zero: a non-member never reaches the guard.
    expect(__testing__.cacheSize()).toBe(0);
  });

  it('never even consults the suspension guard for an id the caller is not a member of', async () => {
    await validateJoinOrg(socket(), 'org-someone-elses');

    // This is the structural fix: membership is established first, so the guard
    // is only ever asked about tenants bound to this user.
    expect(orgStatusQueries).toBe(0);
  });

  it('still refuses a MEMBER joining a suspended tenant — the gate did not move away', async () => {
    await expect(validateJoinOrg(socket(), 'org-suspended')).resolves.toBe(false);
    expect(orgStatusQueries).toBeGreaterThan(0);
  });

  it('NEGATIVE CONTROL: a member joining an ACTIVE tenant still succeeds', async () => {
    await expect(validateJoinOrg(socket(), 'org-active')).resolves.toBe(true);
  });

  it('caches at most one entry per REAL tenant, however often it is joined', async () => {
    for (let i = 0; i < 200; i++) {
      await validateJoinOrg(socket(), 'org-active');
    }

    expect(__testing__.cacheSize()).toBe(1);
    expect(orgStatusQueries).toBe(1);
  });

  it("the guard's own ceiling holds even if a caller feeds it unverified ids", async () => {
    // Defence in depth: should something upstream ever regress the ordering,
    // the Map must still not grow without bound. Rows are present here, so the
    // "never cache an absent row" layer deliberately does NOT save us — this
    // isolates the ceiling itself.
    const alwaysActive = vi.fn(async () => ({ status: 'active' }));
    for (let i = 0; i < 12_000; i++) {
      await isOrganizationSuspended(`bogus-${i}`, alwaysActive as never);
    }

    expect(__testing__.cacheSize()).toBeLessThanOrEqual(10_000);
  });
});

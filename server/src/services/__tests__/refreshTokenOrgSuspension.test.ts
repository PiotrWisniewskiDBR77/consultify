/**
 * DEC-91 FIX-6 — a suspended tenant cannot mint or roll credentials.
 *
 * ===========================================================================
 * WHY THIS MATTERS EVEN THOUGH attachUser ALREADY REFUSES
 * ===========================================================================
 * The impact is genuinely bounded: an access token minted here would be refused
 * by `attachUser` on its first use. But refresh is a FRONT DOOR, and leaving it
 * open means a suspended tenant keeps rolling a fresh 7-day refresh family for
 * the moment it is reactivated — the session never actually ends, it just goes
 * quiet. DEC-91 says "logowanie i API odcięte"; a credential mint is part of
 * that, so it is closed rather than argued about.
 *
 * All three mint points in `RefreshTokenService` are covered: the rotation
 * path, the grace path (its unguarded twin), and `generateTokenPair` itself.
 *
 * The platform-operator carve-out is asserted too, and it is not decoration:
 * `generateTokenPair` also serves the superadmin's own token refresh, so a gate
 * without it would remove the very route used to reactivate a tenant.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({
  ORG_STATUS: { 'org-suspended': 'suspended', 'org-active': 'active' } as Record<string, string>,
  USER_ROLE: { 'user-1': 'ADMIN', 'super-1': 'SUPERADMIN' } as Record<string, string>,
}));

/** Callback-style IDatabase double: rejects on error, like the real handle. */
const makeDb = () => ({
  get: vi.fn((sql: string, params: unknown[], cb: Function) => {
    const text = String(sql);
    const first = String((params || [])[0] ?? '');
    if (text.includes('SELECT role FROM users')) {
      const role = H.USER_ROLE[first];
      return cb(null, role ? { role } : null);
    }
    if (text.includes('FROM organizations')) {
      const status = H.ORG_STATUS[first];
      return cb(null, status ? { status } : null);
    }
    return cb(null, null);
  }),
  run: vi.fn((_sql: string, _params: unknown[], cb: Function) => cb?.call({ changes: 1 }, null)),
  all: vi.fn((_sql: string, _params: unknown[], cb: Function) => cb(null, [])),
});

const RefreshTokenService = (await import('../RefreshTokenService.js')).default;
const { __testing__ } = await import('../organizationSuspensionGuard.js');

let db: ReturnType<typeof makeDb>;

beforeEach(() => {
  vi.clearAllMocks();
  __testing__.reset();
  db = makeDb();
  RefreshTokenService.setDependencies?.({ db: db as never });
  (RefreshTokenService as unknown as { db: unknown }).db = db;
});

afterEach(() => __testing__.reset());

const user = (organizationId: string, id = 'user-1', role = 'ADMIN') => ({
  id,
  email: `${id}@example.test`,
  role,
  organization_id: organizationId,
});

describe('DEC-91 FIX-6 — RefreshTokenService and organization suspension', () => {
  it('refuses to mint a token pair for a SUSPENDED tenant', async () => {
    await expect(
      RefreshTokenService.generateTokenPair(user('org-suspended') as never)
    ).rejects.toThrow('ORG_SUSPENDED');
  });

  it('NEGATIVE CONTROL: an ACTIVE tenant still gets a token pair', async () => {
    await expect(
      RefreshTokenService.generateTokenPair(user('org-active') as never)
    ).resolves.toBeTruthy();
  });

  it('a DB-VERIFIED platform superadmin can still refresh inside a suspended tenant', async () => {
    // Without this carve-out, suspending the org a superadmin happens to sit in
    // would take away the route used to reactivate it.
    await expect(
      RefreshTokenService.generateTokenPair(
        user('org-suspended', 'super-1', 'SUPERADMIN') as never
      )
    ).resolves.toBeTruthy();
  });

  it('FIX-2: a caller-supplied SUPERADMIN role does NOT buy the carve-out', async () => {
    // users.role for user-1 is ADMIN in the database; the role passed in is not
    // trusted. This is the same rule as everywhere else in DEC-91.
    await expect(
      RefreshTokenService.generateTokenPair(
        user('org-suspended', 'user-1', 'SUPERADMIN') as never
      )
    ).rejects.toThrow('ORG_SUSPENDED');
  });
});

/**
 * DEC-91 / TRI-MUST-12 — unit contract of the organization suspension guard.
 *
 * The guard is the single answer to "is this tenant suspended?" for both the
 * login path and `attachUser`. What matters here, and what each block below
 * pins:
 *
 *   1. only an explicit `'suspended'` row value blocks (no inference from a
 *      missing row, an unrelated status, or a failed lookup);
 *   2. the answer is memoised, so `attachUser` does not add a query per request;
 *   3. the memo EXPIRES — that TTL is the enforcement SLA for tokens already in
 *      the wild when the suspension landed;
 *   4. invalidation makes a reactivation take effect immediately;
 *   5. the exemption allowlist is exactly the three DEC-91 paths and nothing
 *      that merely looks like them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __testing__,
  buildOrgSuspendedResponseBody,
  getOrgSuspensionCacheTtlMs,
  invalidateOrganizationSuspensionCache,
  isOrganizationSuspended,
  isPathExemptFromOrgSuspension,
  ORG_SUSPENDED_CODE,
} from '../organizationSuspensionGuard.js';

const ORIGINAL_TTL_ENV = process.env.ORG_SUSPENSION_CACHE_TTL_MS;

/** dbGet double that answers the guard's single query from a status map. */
const makeDbGet = (statusByOrgId: Record<string, string | null>) =>
  vi.fn(async (_sql: string, params?: unknown[]) => {
    const id = String((params || [])[0]);
    if (!(id in statusByOrgId)) return undefined;
    const status = statusByOrgId[id];
    return status === null ? undefined : ({ status } as never);
  });

describe('organizationSuspensionGuard', () => {
  beforeEach(() => {
    __testing__.reset();
    delete process.env.ORG_SUSPENSION_CACHE_TTL_MS;
  });

  afterEach(() => {
    __testing__.reset();
    if (ORIGINAL_TTL_ENV === undefined) delete process.env.ORG_SUSPENSION_CACHE_TTL_MS;
    else process.env.ORG_SUSPENSION_CACHE_TTL_MS = ORIGINAL_TTL_ENV;
  });

  describe('status resolution', () => {
    it('blocks an organization whose status is suspended', async () => {
      const dbGet = makeDbGet({ 'org-a': 'suspended' });
      await expect(isOrganizationSuspended('org-a', dbGet)).resolves.toBe(true);
    });

    it('does not block an active organization', async () => {
      const dbGet = makeDbGet({ 'org-b': 'active' });
      await expect(isOrganizationSuspended('org-b', dbGet)).resolves.toBe(false);
    });

    it('tolerates casing and padding on the stored status', async () => {
      const dbGet = makeDbGet({ 'org-c': '  SUSPENDED ' });
      await expect(isOrganizationSuspended('org-c', dbGet)).resolves.toBe(true);
    });

    it.each(['pending', 'blocked', 'cancelled', 'trial'])(
      'does not treat %s as a suspension (those have their own handling)',
      async (status) => {
        const dbGet = makeDbGet({ 'org-d': status });
        await expect(isOrganizationSuspended('org-d', dbGet)).resolves.toBe(false);
      }
    );

    it('does not invent a suspension for a missing organization row', async () => {
      const dbGet = makeDbGet({});
      await expect(isOrganizationSuspended('org-missing', dbGet)).resolves.toBe(false);
    });

    it.each([undefined, null, '', '   ', 42, 'x'.repeat(129)])(
      'returns false for an unusable organization id (%p) without querying',
      async (badId) => {
        const dbGet = makeDbGet({});
        await expect(isOrganizationSuspended(badId, dbGet)).resolves.toBe(false);
        expect(dbGet).not.toHaveBeenCalled();
      }
    );

    it('fails OPEN and caches nothing when the lookup throws', async () => {
      // Deliberate: fail-closed here would turn a transient DB blip into a
      // platform-wide 403 storm. See the module header.
      const dbGet = vi
        .fn()
        .mockRejectedValueOnce(new Error('connection reset'))
        .mockResolvedValueOnce({ status: 'suspended' } as never);

      await expect(isOrganizationSuspended('org-e', dbGet)).resolves.toBe(false);
      // Nothing was cached, so the very next call retries and now sees the truth.
      await expect(isOrganizationSuspended('org-e', dbGet)).resolves.toBe(true);
      expect(dbGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache', () => {
    it('answers repeated questions from memory instead of the database', async () => {
      const dbGet = makeDbGet({ 'org-a': 'suspended' });
      await isOrganizationSuspended('org-a', dbGet);
      await isOrganizationSuspended('org-a', dbGet);
      await isOrganizationSuspended('org-a', dbGet);
      expect(dbGet).toHaveBeenCalledTimes(1);
    });

    it('caches per organization, not globally', async () => {
      const dbGet = makeDbGet({ 'org-a': 'suspended', 'org-b': 'active' });
      await expect(isOrganizationSuspended('org-a', dbGet)).resolves.toBe(true);
      await expect(isOrganizationSuspended('org-b', dbGet)).resolves.toBe(false);
      expect(dbGet).toHaveBeenCalledTimes(2);
    });

    it('re-reads after the TTL expires — this is the SLA for live tokens', async () => {
      let clock = 1_000_000;
      __testing__.setNow(() => clock);
      const dbGet = makeDbGet({ 'org-a': 'active' });

      await expect(isOrganizationSuspended('org-a', dbGet)).resolves.toBe(false);
      expect(dbGet).toHaveBeenCalledTimes(1);

      // Still inside the window: no second query, stale answer served.
      clock += getOrgSuspensionCacheTtlMs() - 1;
      await expect(isOrganizationSuspended('org-a', dbGet)).resolves.toBe(false);
      expect(dbGet).toHaveBeenCalledTimes(1);

      // The org gets suspended out-of-band (another process, no invalidation here).
      dbGet.mockImplementation(async () => ({ status: 'suspended' }) as never);

      // Past the window: re-read, and the suspension now bites.
      clock += 2;
      await expect(isOrganizationSuspended('org-a', dbGet)).resolves.toBe(true);
      expect(dbGet).toHaveBeenCalledTimes(2);
    });

    it('invalidation for one org forces a re-read and leaves other orgs cached', async () => {
      const dbGet = makeDbGet({ 'org-a': 'suspended', 'org-b': 'suspended' });
      await isOrganizationSuspended('org-a', dbGet);
      await isOrganizationSuspended('org-b', dbGet);
      expect(dbGet).toHaveBeenCalledTimes(2);

      // Operator reactivates org-a in this process.
      dbGet.mockImplementation(async (_sql: string, params?: unknown[]) =>
        String((params || [])[0]) === 'org-a'
          ? ({ status: 'active' } as never)
          : ({ status: 'suspended' } as never)
      );
      invalidateOrganizationSuspensionCache('org-a');

      await expect(isOrganizationSuspended('org-a', dbGet)).resolves.toBe(false);
      expect(dbGet).toHaveBeenCalledTimes(3);
      // org-b was never invalidated, so it is still answered from memory.
      await expect(isOrganizationSuspended('org-b', dbGet)).resolves.toBe(true);
      expect(dbGet).toHaveBeenCalledTimes(3);
    });

    it('invalidation with no id clears every organization', async () => {
      const dbGet = makeDbGet({ 'org-a': 'suspended', 'org-b': 'active' });
      await isOrganizationSuspended('org-a', dbGet);
      await isOrganizationSuspended('org-b', dbGet);
      expect(__testing__.cacheSize()).toBe(2);
      invalidateOrganizationSuspensionCache();
      expect(__testing__.cacheSize()).toBe(0);
    });
  });

  describe('TTL configuration', () => {
    it('defaults to 30s', () => {
      expect(getOrgSuspensionCacheTtlMs()).toBe(30_000);
    });

    it('honours ORG_SUSPENSION_CACHE_TTL_MS inside the sane band', () => {
      process.env.ORG_SUSPENSION_CACHE_TTL_MS = '60000';
      expect(getOrgSuspensionCacheTtlMs()).toBe(60_000);
    });

    it.each([
      ['0', 1_000],
      ['-5', 1_000],
      ['99999999', 300_000],
      ['not-a-number', 30_000],
    ])('clamps/ignores %s -> %d', (raw, expected) => {
      process.env.ORG_SUSPENSION_CACHE_TTL_MS = raw;
      expect(getOrgSuspensionCacheTtlMs()).toBe(expected);
    });
  });

  describe('exempt paths', () => {
    it.each([
      '/api/superadmin/tenants/org-a/reactivate',
      '/API/SuperAdmin/organizations/org-a',
      '/api/superadmin',
      '/api/auth/logout',
      '/api/auth/logout/',
      '/api/auth/logout?everywhere=1',
      '/api/health',
      '/api/health/data-context',
    ])('exempts %s', (path) => {
      expect(isPathExemptFromOrgSuspension(path)).toBe(true);
    });

    it.each([
      '/api/initiatives',
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/superadminx/tenants', // prefix must not match a longer segment
      '/api/healthcheck', // ditto
      '/api/admin/health-panel',
      '/api/superadmin/../initiatives', // traversal is refused outright
      'api/superadmin/tenants', // not absolute
      '',
      undefined,
    ])('does NOT exempt %p', (path) => {
      expect(isPathExemptFromOrgSuspension(path)).toBe(false);
    });
  });

  describe('refusal body', () => {
    it('carries a machine-readable code and an i18n key, not just a sentence', () => {
      const body = buildOrgSuspendedResponseBody();
      expect(body.code).toBe(ORG_SUSPENDED_CODE);
      expect(body.code).toBe('ORG_SUSPENDED');
      expect(body.messageKey).toBe('errors.organizationSuspended');
      expect(typeof body.error).toBe('string');
      expect(body.error.length).toBeGreaterThan(0);
    });
  });
});

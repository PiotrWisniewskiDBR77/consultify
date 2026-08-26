/**
 * DEC-91 / TRI-MUST-12 — organization suspension is enforced on EVERY
 * authenticated request, not only at login.
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS
 * ===========================================================================
 * Day-15 acceptance (DEC-85) found that suspending a tenant wrote
 * `organizations.status = 'suspended'` and emitted an audit event — and then
 * nothing read that column. Login worked, and every already-issued token kept
 * working for as long as it was valid. Blocking only at login would have left
 * that second hole open, so the enforcement point that matters is
 * `attachUser`, exercised here through the real exported `verifyToken`.
 *
 * ===========================================================================
 * WHAT MAKES THESE ASSERTIONS FALSIFIABLE
 * ===========================================================================
 * Every case drives the REAL middleware; only its injected dependencies (jwt,
 * dbGet, config) are doubles, and `dbGet` answers from a per-test tenant table
 * so the org status is genuinely read through the code path under test. Delete
 * the guard call in `attachUser` and the four "refuses" cases below fail with
 * `next()` having been called; widen the exemption list and the negative
 * controls (`/api/initiatives` for the same suspended tenant) fail.
 *
 * The active-tenant and superadmin cases are the negative controls: they prove
 * the refusal is caused by the suspension and not by the harness.
 */

import type { NextFunction, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __testing__ } from '../../services/organizationSuspensionGuard.js';
import {
  type AuthRequest,
  __private__,
  setDependencies,
  verifyToken,
} from '../auth.middleware.js';

/** Tenants the fake database knows about, keyed by id. */
const ORG_STATUS: Record<string, string> = {
  'org-suspended': 'suspended',
  'org-active': 'active',
};

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  E2E_MODE: process.env.E2E_MODE,
  ENABLE_TEST_AUTH_BYPASS: process.env.ENABLE_TEST_AUTH_BYPASS,
  MOCK_DB: process.env.MOCK_DB,
};

const mockJwt = { verify: vi.fn(), decode: vi.fn() };
const mockPermissionService = { can: vi.fn().mockReturnValue(true) };

/**
 * dbGet double. Routes on the SQL text so the middleware's own queries
 * (revocation, membership rescue, org status) each get a coherent answer.
 */
/** users.role in the DATABASE — the only thing that can grant the exemption. */
const DB_USER_ROLE: Record<string, string> = {
  'user-of-org-suspended': 'ADMIN',
  'user-of-org-active': 'ADMIN',
  'platform-superadmin': 'SUPERADMIN',
  'forged-membership-superadmin': 'ADMIN',
};

const mockDbGet = vi.fn(async (sql: string, params?: unknown[]) => {
  const text = String(sql).replace(/\s+/g, ' ');
  const first = String((params || [])[0] ?? '');

  if (text.includes('revoked_tokens')) return undefined;
  if (text.includes('SELECT role FROM users')) {
    const role = DB_USER_ROLE[first];
    return role ? ({ role } as never) : undefined;
  }
  if (text.includes('FROM organizations')) {
    const status = ORG_STATUS[first];
    return status ? ({ status } as never) : undefined;
  }
  if (text.includes('organization_members')) {
    // Every test user is an ACTIVE member of the org in its token, so the
    // "any ACTIVE membership" rescue in attachUser is a no-op here and the
    // effective tenant is exactly the one the test asked for.
    const orgId = text.includes('organization_id = ?') && params?.[1] ? String(params[1]) : first;
    return { organization_id: orgId, role: 'ADMIN', status: 'ACTIVE' } as never;
  }
  return undefined;
});

interface Captured {
  status: number | null;
  body: unknown;
  nextCalled: boolean;
}

/** Drive the real verifyToken for one request and report what it decided. */
const runRequest = async (options: {
  organizationId: string;
  url: string;
  role?: string;
  isSuperAdmin?: boolean;
  userId?: string;
}): Promise<Captured> => {
  const claims = {
    id: options.userId ?? `user-of-${options.organizationId}`,
    email: 'member@example.com',
    name: 'Member',
    role: options.role ?? 'ADMIN',
    organizationId: options.organizationId,
    isSuperAdmin: options.isSuperAdmin ?? false,
    // No `jti`: revocation lookup is not what this suite is about.
  };
  mockJwt.verify.mockImplementation((_token: string, _secret: string, ...rest: unknown[]) => {
    const callback = rest[rest.length - 1] as (e: unknown, d: unknown) => void;
    callback(null, claims);
  });

  const captured: Captured = { status: null, body: null, nextCalled: false };

  const req = {
    headers: { authorization: 'Bearer aaa.bbb.ccc' },
    body: {},
    query: {},
    cookies: {},
    method: 'GET',
    url: options.url,
    originalUrl: options.url,
    path: options.url,
  } as unknown as AuthRequest;

  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
    setHeader() {
      return this;
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    captured.nextCalled = true;
  };

  await verifyToken(req, res, next);
  return captured;
};

describe('DEC-91 organization suspension enforcement in auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGet.mockClear();
    __testing__.reset();
    __private__.resetRevocationCachesForTests?.();
    __private__.resetMembershipCacheForTests?.();

    setDependencies({
      jwt: mockJwt as never,
      config: { JWT_SECRET: 'test-secret' },
      PermissionService: mockPermissionService as never,
      dbGet: mockDbGet as never,
    });

    process.env.NODE_ENV = 'test';
    process.env.E2E_MODE = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    process.env.MOCK_DB = 'false';
  });

  afterEach(() => {
    __testing__.reset();
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('refuses an API request from a member of a SUSPENDED organization', async () => {
    const result = await runRequest({
      organizationId: 'org-suspended',
      url: '/api/initiatives',
    });

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ code: 'ORG_SUSPENDED' });
    expect(result.nextCalled).toBe(false);
  });

  it('carries an i18n key alongside the code, so the client is not stuck with a hardcoded sentence', async () => {
    const result = await runRequest({
      organizationId: 'org-suspended',
      url: '/api/initiatives',
    });

    expect(result.body).toMatchObject({
      code: 'ORG_SUSPENDED',
      messageKey: 'errors.organizationSuspended',
    });
  });

  it('NEGATIVE CONTROL: the same request for an ACTIVE organization passes', async () => {
    const result = await runRequest({
      organizationId: 'org-active',
      url: '/api/initiatives',
    });

    expect(result.status).toBeNull();
    expect(result.nextCalled).toBe(true);
  });

  it('refuses writes as well as reads for a suspended tenant', async () => {
    const result = await runRequest({
      organizationId: 'org-suspended',
      url: '/api/initiatives/init-1/tasks',
    });

    expect(result.status).toBe(403);
    expect(result.nextCalled).toBe(false);
  });

  describe('exemptions — exactly the three DEC-91 carve-outs', () => {
    it('lets a suspended tenant reach /api/auth/logout so the client can drop its token', async () => {
      const result = await runRequest({
        organizationId: 'org-suspended',
        url: '/api/auth/logout',
      });

      expect(result.status).toBeNull();
      expect(result.nextCalled).toBe(true);
    });

    it('lets health probes through for a suspended tenant', async () => {
      const result = await runRequest({
        organizationId: 'org-suspended',
        url: '/api/health/data-context',
      });

      expect(result.status).toBeNull();
      expect(result.nextCalled).toBe(true);
    });

    it('lets the superadmin surface through so the tenant can be reactivated', async () => {
      // Matched on originalUrl: verifyToken is mounted INSIDE the superadmin
      // router, where req.path would only be "/tenants/org-suspended/reactivate".
      const result = await runRequest({
        organizationId: 'org-suspended',
        url: '/api/superadmin/tenants/org-suspended/reactivate',
      });

      expect(result.status).toBeNull();
      expect(result.nextCalled).toBe(true);
    });

    it('a DB-VERIFIED platform superadmin seated in a suspended tenant is not locked out', async () => {
      const result = await runRequest({
        organizationId: 'org-suspended',
        url: '/api/initiatives',
        role: 'SUPERADMIN',
        isSuperAdmin: true,
        userId: 'platform-superadmin',
      });

      expect(result.status).toBeNull();
      expect(result.nextCalled).toBe(true);
    });

    it('FIX-2: a membership role forged to SUPERADMIN buys NO exemption', async () => {
      // `req.userRole` can be populated from organization_members.role. That
      // column's CHECK constraint is a data-hygiene invariant, not a security
      // boundary — on a drifted database it used to hand a tenant admin a full
      // exemption from their own tenant's suspension. users.role in the
      // DATABASE says ADMIN, so the exemption is refused.
      const result = await runRequest({
        organizationId: 'org-suspended',
        url: '/api/initiatives',
        role: 'SUPERADMIN',
        isSuperAdmin: false,
        userId: 'forged-membership-superadmin',
      });

      expect(result.status).toBe(403);
      expect(result.body).toMatchObject({ code: 'ORG_SUSPENDED' });
      expect(result.nextCalled).toBe(false);
    });

    it('FIX-2: even a signed isSuperAdmin claim needs the DB to agree', async () => {
      // The claim alone is no longer sufficient: users.role must confirm it.
      const result = await runRequest({
        organizationId: 'org-suspended',
        url: '/api/initiatives',
        role: 'SUPERADMIN',
        isSuperAdmin: true,
        userId: 'forged-membership-superadmin',
      });

      expect(result.status).toBe(403);
      expect(result.nextCalled).toBe(false);
    });

    it('NEGATIVE CONTROL: a path that merely LOOKS like an exempt one is still refused', async () => {
      for (const url of ['/api/healthcheck', '/api/superadminx/tenants', '/api/auth/refresh']) {
        __testing__.reset();
        const result = await runRequest({ organizationId: 'org-suspended', url });
        expect(result.status, `expected 403 for ${url}`).toBe(403);
        expect(result.nextCalled, `expected refusal for ${url}`).toBe(false);
      }
    });
  });

  it('does not add a database round trip per request (the answer is cached)', async () => {
    await runRequest({ organizationId: 'org-active', url: '/api/initiatives' });
    const afterFirst = mockDbGet.mock.calls.filter((call) =>
      String(call[0]).includes('FROM organizations')
    ).length;

    await runRequest({ organizationId: 'org-active', url: '/api/initiatives' });
    await runRequest({ organizationId: 'org-active', url: '/api/results' });
    const afterThird = mockDbGet.mock.calls.filter((call) =>
      String(call[0]).includes('FROM organizations')
    ).length;

    expect(afterFirst).toBe(1);
    expect(afterThird).toBe(1);
  });

  it('an already-issued token stops working once the cache is invalidated by a suspension', async () => {
    // Session established while the tenant was healthy.
    ORG_STATUS['org-later-suspended'] = 'active';
    const before = await runRequest({
      organizationId: 'org-later-suspended',
      url: '/api/initiatives',
    });
    expect(before.nextCalled).toBe(true);

    // Operator suspends the tenant in this process: the status writer
    // invalidates the memoised answer (superadmin.routes.ts / SuperAdminController).
    ORG_STATUS['org-later-suspended'] = 'suspended';
    __testing__.reset();

    const after = await runRequest({
      organizationId: 'org-later-suspended',
      url: '/api/initiatives',
    });
    expect(after.status).toBe(403);
    expect(after.body).toMatchObject({ code: 'ORG_SUSPENDED' });
    expect(after.nextCalled).toBe(false);

    delete ORG_STATUS['org-later-suspended'];
  });
});

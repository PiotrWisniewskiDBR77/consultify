/**
 * M24 audit follow-up (07-14) — cross-org IDOR coverage gap.
 *
 * admin-cross-org-idor.test.ts (15 tests) covers ONLY admin-data.routes +
 * ai-settings.routes. It does NOT cover the newer org-scoped surfaces:
 *   - server/src/routes/adminP32.routes.ts       (/iam/policy, /iam/assignments,
 *                                                   /risk/summary, /collaboration,
 *                                                   /identity/scim*)
 *   - server/src/routes/admin/health-panel.routes.ts
 *
 * This file closes that gap, following the exact mocking/setup pattern of
 * admin-cross-org-idor.test.ts (no real database — all DB calls are stubbed).
 *
 * Story A — adminP32 routes share ONE choke-point guard: getAdminActor()
 *   (server/src/routes/adminP32.routes.ts lines 280-345) derives orgId from
 *   `req.query.orgId || req.user.organizationId` and 403s
 *   ('ADMIN_BOUNDARY_VIOLATION') whenever that orgId does not match the
 *   caller's own organizationId (unless super_admin). Every route below calls
 *   getAdminActor() first, so a single parametrized suite proves the guard is
 *   wired on each of them (regression net against a future route that forgets
 *   to call getAdminActor before touching data).
 *
 * Story B — health-panel routes take NO attacker-controlled org selector at
 *   all (organizationId always comes from req.user, never from query/params/
 *   body — see getContext() in health-panel.routes.ts lines 37-42). There is
 *   structurally no cross-org vector to IDOR here; we assert that spoofing an
 *   orgId in the query/body is silently ignored and the caller's own org is
 *   always used.
 *
 * Story C — FINDING. readScimSummary() / deleteScimGroupMapping() in
 *   adminP32.routes.ts query `scim_group_mappings` WITHOUT an
 *   organization_id filter, even though the real Postgres table (migration
 *   656_v4_scim_enhanced.sql) HAS an organization_id column and a
 *   UNIQUE(organization_id, external_group_id) constraint. Two real bugs:
 *     C1) GET /identity/scim leaks EVERY organization's SCIM group mappings
 *         to any org admin with security:read (cross-tenant data read).
 *     C2) DELETE /identity/scim/group-mappings/:id deletes by id only — an
 *         org-A admin who learns/guesses another org's mapping id can delete
 *         it (cross-tenant mutation / IDOR write).
 *   These are marked it.fails with FINDING comments per the task brief — NOT
 *   fixed here. Routes are otherwise unaffected (scim_tokens and
 *   scim_conflict_log ARE correctly filtered by organization_id).
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const dbQueryMock = vi.hoisted(() => vi.fn());
const dbGetMock = vi.hoisted(() => vi.fn());
const dbAllMock = vi.hoisted(() => vi.fn());
const dbRunMock = vi.hoisted(() => vi.fn());

// ── Module mocks (mirrors admin-cross-org-idor.test.ts) ────────────────────────

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({ query: (...args: unknown[]) => dbQueryMock(...args) }),
  default: { query: (...args: unknown[]) => dbQueryMock(...args) },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAllMock(...args),
  get: (...args: unknown[]) => dbGetMock(...args),
  run: (...args: unknown[]) => dbRunMock(...args),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  createLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  validateParams: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  validateQuery: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/adminAuditService.js', () => ({
  default: { logAction: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../server/src/utils/pgFlags.js', () => ({
  flagOn: vi.fn().mockReturnValue(false),
  parseMaybeJson: vi.fn((v: unknown) => v),
}));

vi.mock('../../../server/src/utils/ErrorHandler.js', () => ({
  AppError: class AppError extends Error {
    constructor(
      message: string,
      public statusCode = 500
    ) {
      super(message);
    }
  },
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    next();
  },
  requireRole: (..._roles: string[]) => (req: any, res: any, next: () => void) => {
    const role = req.user?.role ?? '';
    const allowed = ['super_admin', 'admin', 'owner', 'administrator'];
    if (!allowed.includes(role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  },
}));

vi.mock('../../../server/src/middleware/requestAccess.js', () => ({
  isRequestSuperAdmin: (req: any) => req.user?.isSuperAdmin === true,
  getRequestAccessRole: (req: any) => {
    if (req.user?.isSuperAdmin) return 'superadmin';
    const role = String(req.user?.role ?? '').toLowerCase();
    if (role === 'owner') return 'owner';
    if (role === 'admin' || role === 'administrator') return 'admin';
    return 'member';
  },
  getSettingsActorRole: (req: any) => {
    const role = String(req.user?.role ?? '').toLowerCase();
    if (role === 'owner') return 'owner';
    if (role === 'admin' || role === 'administrator') return 'admin';
    return 'member';
  },
}));

// Stub verifyAdmin (used by health-panel.routes.ts) — pass through so we can
// exercise the route logic itself; requireRole-style behavior is not what's
// under test here (getContext()'s org-selection is).
vi.mock('../../../server/src/middleware/admin.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    const role = String(req.user?.role ?? '').toLowerCase();
    const allowed = ['super_admin', 'admin', 'owner', 'administrator'];
    if (!allowed.includes(role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  },
}));

// ── Constants ────────────────────────────────────────────────────────────────

const ORG_A = 'org-alpha';
const ORG_B = 'org-beta';
const ADMIN_A_USER = { id: 'user-admin-a', organizationId: ORG_A, role: 'admin' };

// ════════════════════════════════════════════════════════════════════════════
// Story A — every adminP32 route rejects a spoofed ?orgId= belonging to org-B
// Guard: getAdminActor() — adminP32.routes.ts lines 291-308
// ════════════════════════════════════════════════════════════════════════════

describe('M24 follow-up Story A — cross-org IDOR on adminP32 routes (getAdminActor choke point)', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();

    // getAdminActor's membership lookup (organization_members) — caller is a
    // real ADMIN of ORG_A. Every dbGet call in this suite resolves the same
    // way; individual tests override dbAll/dbRun as needed.
    dbGetMock.mockResolvedValue({ role: 'ADMIN' });
    dbAllMock.mockResolvedValue([]);
    dbRunMock.mockResolvedValue({ success: true });

    const adminP32Router = (await import('../../../server/src/routes/adminP32.routes.js'))
      .default;

    app = express();
    app.use(express.json());
    app.use((req: any, _res: unknown, next: () => void) => {
      req.user = ADMIN_A_USER;
      req.userRole = 'admin';
      next();
    });
    app.use('/api/adminp32', adminP32Router);
  });

  const crossOrgCases: Array<{
    name: string;
    method: 'get' | 'post' | 'put' | 'delete';
    path: string;
    body?: Record<string, unknown>;
  }> = [
    { name: 'GET /iam/policy', method: 'get', path: '/iam/policy' },
    {
      name: 'PUT /iam/policy',
      method: 'put',
      path: '/iam/policy',
      body: { accessReviewsEnabled: true },
    },
    { name: 'GET /iam/assignments', method: 'get', path: '/iam/assignments' },
    {
      name: 'POST /iam/assignments',
      method: 'post',
      path: '/iam/assignments',
      body: { userId: 'victim-user', roleId: 'role-1', roleName: 'Delegated' },
    },
    {
      name: 'DELETE /iam/assignments/:id',
      method: 'delete',
      path: '/iam/assignments/assignment-1',
    },
    { name: 'GET /risk/summary', method: 'get', path: '/risk/summary' },
    { name: 'GET /collaboration', method: 'get', path: '/collaboration' },
    {
      name: 'PUT /collaboration',
      method: 'put',
      path: '/collaboration',
      body: { guestAccessEnabled: false },
    },
    { name: 'GET /identity/scim', method: 'get', path: '/identity/scim' },
    {
      name: 'POST /identity/scim/tokens',
      method: 'post',
      path: '/identity/scim/tokens',
      body: { name: 'attacker token' },
    },
    {
      name: 'DELETE /identity/scim/tokens/:id',
      method: 'delete',
      path: '/identity/scim/tokens/token-1',
    },
    {
      name: 'POST /identity/scim/group-mappings',
      method: 'post',
      path: '/identity/scim/group-mappings',
      body: { externalGroupName: 'attacker-group', externalGroupId: 'g-1' },
    },
    {
      name: 'DELETE /identity/scim/group-mappings/:id',
      method: 'delete',
      path: '/identity/scim/group-mappings/mapping-1',
    },
  ];

  for (const { name, method, path, body } of crossOrgCases) {
    it(`${name}?orgId=org-beta returns 403 ADMIN_BOUNDARY_VIOLATION for caller in org-alpha`, async () => {
      const req = request(app)[method](`/api/adminp32${path}?orgId=${ORG_B}`);
      const res = body ? await req.send(body) : await req;

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ADMIN_BOUNDARY_VIOLATION');
      expect(res.body.error).toMatch(/cross-organization/i);
    });
  }

  it('super_admin bypasses the org boundary (GET /iam/policy for org-beta, by design)', async () => {
    vi.resetModules();
    vi.resetAllMocks();
    dbGetMock.mockResolvedValue({ role: 'OWNER' });
    dbAllMock.mockResolvedValue([]);
    dbRunMock.mockResolvedValue({ success: true });

    const adminP32Router = (await import('../../../server/src/routes/adminP32.routes.js'))
      .default;
    const superApp = express();
    superApp.use(express.json());
    superApp.use((req: any, _res: unknown, next: () => void) => {
      req.user = { id: 'user-super', organizationId: ORG_A, role: 'super_admin', isSuperAdmin: true };
      req.userRole = 'super_admin';
      next();
    });
    superApp.use('/api/adminp32', adminP32Router);

    const res = await request(superApp).get(`/api/adminp32/iam/policy?orgId=${ORG_B}`);
    expect(res.status).not.toBe(403);
  });

  it('GET /iam/policy?orgId=org-alpha (own org) passes the boundary guard for caller in org-alpha', async () => {
    const res = await request(app).get(`/api/adminp32/iam/policy?orgId=${ORG_A}`);
    expect(res.status).not.toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Story B — health-panel routes: no attacker-controlled org selector exists,
// caller's own organizationId is always used regardless of spoofed input.
// ════════════════════════════════════════════════════════════════════════════

describe('M24 follow-up Story B — health-panel routes ignore spoofed org selectors', () => {
  let app: express.Express;
  let getCachedResultsSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();

    getCachedResultsSpy = vi.fn().mockResolvedValue([]);

    vi.doMock('../../../server/src/services/health/healthProbeService.js', () => ({
      cacheProbeResult: vi.fn().mockResolvedValue(undefined),
      getCachedResults: (...args: unknown[]) => getCachedResultsSpy(...args),
      getProbeById: vi.fn().mockReturnValue(null),
      HEALTH_PROBES: [],
      isHealthPanelAllowedEnv: vi.fn().mockReturnValue(false),
      runAllProbes: vi.fn().mockResolvedValue([]),
      runProbe: vi.fn().mockResolvedValue({}),
      summarizeResults: vi.fn().mockReturnValue({ total: 0 }),
    }));

    const healthPanelRouter = (
      await import('../../../server/src/routes/admin/health-panel.routes.js')
    ).default;

    app = express();
    app.use(express.json());
    app.use((req: any, _res: unknown, next: () => void) => {
      req.user = ADMIN_A_USER;
      next();
    });
    app.use('/api/admin/health-panel', healthPanelRouter);
  });

  it('GET /probes ignores a spoofed ?organizationId=org-beta query param — uses caller org-alpha', async () => {
    const res = await request(app).get(`/api/admin/health-panel/probes?organizationId=${ORG_B}`);

    expect(res.status).toBe(200);
    expect(getCachedResultsSpy).toHaveBeenCalledWith(ORG_A);
    expect(getCachedResultsSpy).not.toHaveBeenCalledWith(ORG_B);
  });

  it('GET /summary ignores a spoofed body.organizationId=org-beta — uses caller org-alpha', async () => {
    const res = await request(app)
      .get('/api/admin/health-panel/summary')
      .send({ organizationId: ORG_B });

    expect(res.status).toBe(200);
    expect(getCachedResultsSpy).toHaveBeenCalledWith(ORG_A);
    expect(getCachedResultsSpy).not.toHaveBeenCalledWith(ORG_B);
  });

  it('non-admin caller is rejected by verifyAdmin before any org context is built', async () => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.doMock('../../../server/src/services/health/healthProbeService.js', () => ({
      cacheProbeResult: vi.fn().mockResolvedValue(undefined),
      getCachedResults: vi.fn().mockResolvedValue([]),
      getProbeById: vi.fn().mockReturnValue(null),
      HEALTH_PROBES: [],
      isHealthPanelAllowedEnv: vi.fn().mockReturnValue(false),
      runAllProbes: vi.fn().mockResolvedValue([]),
      runProbe: vi.fn().mockResolvedValue({}),
      summarizeResults: vi.fn().mockReturnValue({ total: 0 }),
    }));
    const healthPanelRouter = (
      await import('../../../server/src/routes/admin/health-panel.routes.js')
    ).default;

    const memberApp = express();
    memberApp.use(express.json());
    memberApp.use((req: any, _res: unknown, next: () => void) => {
      req.user = { id: 'user-member', organizationId: ORG_A, role: 'member' };
      next();
    });
    memberApp.use('/api/admin/health-panel', healthPanelRouter);

    const res = await request(memberApp).get('/api/admin/health-panel/probes');
    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Story C — FINDING: scim_group_mappings is never filtered by organization_id
// in adminP32.routes.ts, despite the real Postgres table carrying that
// column (migration 656_v4_scim_enhanced.sql). Marked it.fails — DO NOT FIX
// here; this is a security finding for Piotr's decision.
// ════════════════════════════════════════════════════════════════════════════

describe('M24 follow-up Story C — FINDING: scim_group_mappings cross-org leak/IDOR', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();

    dbGetMock.mockResolvedValue({ role: 'ADMIN' });
    dbRunMock.mockResolvedValue({ success: true });

    const adminP32Router = (await import('../../../server/src/routes/adminP32.routes.js'))
      .default;

    app = express();
    app.use(express.json());
    app.use((req: any, _res: unknown, next: () => void) => {
      req.user = ADMIN_A_USER;
      req.userRole = 'admin';
      next();
    });
    app.use('/api/adminp32', adminP32Router);
  });

  it.fails(
    'FINDING C1: GET /identity/scim leaks org-beta group mappings to an org-alpha admin ' +
      '(readScimSummary() queries scim_group_mappings with no WHERE organization_id — ' +
      'adminP32.routes.ts ~line 1469-1474)',
    async () => {
      // Simulate the REAL (unfiltered) DB behaviour: the group-mappings query
      // returns rows from every organization, because the application-level
      // SQL has no WHERE organization_id clause (unlike the scim_tokens and
      // scim_conflict_log queries in the same function, which DO filter).
      dbAllMock.mockImplementation((query: string) => {
        if (typeof query === 'string' && query.includes('scim_group_mappings')) {
          return Promise.resolve([
            {
              id: 'mapping-org-b-secret',
              external_group_name: 'org-beta-finance-team',
              internal_role: 'admin',
              is_active: 1,
              member_count: 4,
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const res = await request(app).get('/api/adminp32/identity/scim');

      expect(res.status).toBe(200);
      const mappingNames = (res.body?.summary?.groupMappings ?? []).map(
        (m: any) => m.external_group_name
      );
      // A correctly org-scoped endpoint must NEVER surface org-beta's mapping
      // to an org-alpha caller. This assertion is expected to FAIL today.
      expect(mappingNames).not.toContain('org-beta-finance-team');
    }
  );

  it.fails(
    'FINDING C2: DELETE /identity/scim/group-mappings/:id deletes by id only — no ' +
      'organization_id ownership check (deleteScimGroupMapping() — adminP32.routes.ts ~line 1535-1536), ' +
      'so an org-alpha admin can delete another org’s SCIM group mapping by id',
    async () => {
      const res = await request(app).delete(
        '/api/adminp32/identity/scim/group-mappings/mapping-org-b-secret'
      );

      expect(res.status).toBe(200);
      // The real code calls: DELETE FROM scim_group_mappings WHERE id = ?
      // with no organization_id predicate. A correctly scoped delete would
      // include the actor's orgId as a bind parameter. This assertion is
      // expected to FAIL today, proving the delete is unscoped.
      expect(dbRunMock).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        expect.arrayContaining([ORG_A])
      );
    }
  );
});

/**
 * ACL test for /templates/:templateId/approve and /deprecate (Block A · EPIC-T6).
 *
 * `tp_base_templates` is a system-owned catalog: there is intentionally no
 * `organization_id` column on it. Lifecycle promotion / deprecation must
 * therefore be locked to super-admins; a non-super-admin from any tenant
 * must receive 403 even on their own tenant's resources.
 *
 * This test isolates the route module by mocking auth, services, the DB, and
 * the rate limiter, then drives the route handler chain directly. It mirrors
 * the audit harness used by `table-platform.schema-proposals-acl-audit.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApprove = vi.fn();
const mockDeprecate = vi.fn();
const mockList = vi.fn();

vi.mock('../../services/tablePlatform/TemplateLifecycleService.js', () => ({
  default: {
    approveTemplate: (...args: unknown[]) => mockApprove(...args),
    deprecateTemplate: (...args: unknown[]) => mockDeprecate(...args),
    listTemplates: (...args: unknown[]) => mockList(...args),
  },
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
  requireSuperAdmin: (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  },
}));

vi.mock('../../config/FeatureFlags.js', () => ({
  featureFlags: { ENABLE_TABLE_PLATFORM_RECORDS_API: true },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({
    query: vi.fn(async () => ({ rows: [] })),
  }),
}));

// rate-limit middleware: noop in tests
vi.mock('express-rate-limit', () => ({
  default: () => (_req: any, _res: any, next: any) => next(),
  ipKeyGenerator: () => 'ip',
}));

vi.mock('../../middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_a: unknown) => (_req: any, _res: any, next: any) => next(),
}));

// Heavy imported services that are not exercised here.
vi.mock('../../services/tablePlatform/PermissionsService.js', () => ({
  default: {
    canAccessBase: () => Promise.resolve(true),
    requireBaseAccess: (_req: any, _res: any, next: any) => next(),
    requireTableAccess: (_req: any, _res: any, next: any) => next(),
    requireFieldAccess: (_req: any, _res: any, next: any) => next(),
    requireRecordAccess: (_req: any, _res: any, next: any) => next(),
    requireViewAccess: (_req: any, _res: any, next: any) => next(),
    requireRoles: () => (_req: any, _res: any, next: any) => next(),
    SCHEMA_ROLES: [],
    DATA_ROLES: [],
    VIEW_ROLES: [],
    INTERFACE_ROLES: [],
    ALL_ROLES: [],
    requireGovernedModelAccess: (_req: any, _res: any, next: any) => next(),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockRes(): any {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

function createMockReq(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'POST',
    params: {},
    body: {},
    query: {},
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  };
}

async function importRouter(): Promise<any> {
  const mod = await import('../table-platform.routes.js');
  return mod.default;
}

function findRoute(router: any, method: string, path: string): any {
  return router.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method.toLowerCase()]
  );
}

async function runFullChain(layer: any, req: any, res: any): Promise<void> {
  const handlers = layer.route.stack;
  for (const handler of handlers) {
    let nextCalled = false;
    let nextErr: unknown = null;
    await new Promise<void>((resolve) => {
      const result = handler.handle(req, res, (err?: unknown) => {
        nextCalled = true;
        nextErr = err;
        resolve();
      });
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).then(
          () => {
            if (!nextCalled) resolve();
          },
          () => resolve()
        );
      } else if (!nextCalled) {
        setImmediate(() => resolve());
      }
    });
    if (nextErr) throw nextErr;
    if (!nextCalled) return;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Template Lifecycle ACL — non-super-admin must be 403', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApprove.mockResolvedValue({ id: 'tpl-1', status: 'approved' });
    mockDeprecate.mockResolvedValue({ id: 'tpl-1', status: 'deprecated' });
    mockList.mockResolvedValue([]);
  });

  function adminReq(overrides: Record<string, unknown> = {}) {
    return createMockReq({
      userId: 'admin-1',
      organizationId: 'org-A',
      user: { id: 'admin-1', isSuperAdmin: true },
      ...overrides,
    });
  }

  function nonAdminReq(overrides: Record<string, unknown> = {}) {
    return createMockReq({
      userId: 'user-A',
      organizationId: 'org-A',
      user: { id: 'user-A', isSuperAdmin: false },
      ...overrides,
    });
  }

  it('POST /templates/:templateId/approve — non-super-admin actor returns 403', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/templates/:templateId/approve');
    expect(layer).toBeDefined();

    const req = nonAdminReq({ params: { templateId: 'tpl-1' } });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(403);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it('POST /templates/:templateId/approve — super-admin actor proceeds (200)', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/templates/:templateId/approve');

    const req = adminReq({ params: { templateId: 'tpl-1' }, body: { note: 'reviewed' } });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(200);
    expect(mockApprove).toHaveBeenCalledWith('tpl-1', {
      actorUserId: 'admin-1',
      note: 'reviewed',
    });
  });

  it('POST /templates/:templateId/approve — unauthenticated returns 401', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/templates/:templateId/approve');

    // No user attached: requireSuperAdmin must short-circuit at 401.
    const req = createMockReq({ params: { templateId: 'tpl-1' } });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(401);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it('POST /templates/:templateId/deprecate — non-super-admin actor returns 403', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/templates/:templateId/deprecate');
    expect(layer).toBeDefined();

    const req = nonAdminReq({
      params: { templateId: 'tpl-1' },
      userId: 'user-B',
      organizationId: 'org-B',
      user: { id: 'user-B', isSuperAdmin: false },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(403);
    expect(mockDeprecate).not.toHaveBeenCalled();
  });

  it('POST /templates/:templateId/deprecate — super-admin actor proceeds (200)', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/templates/:templateId/deprecate');

    const req = adminReq({ params: { templateId: 'tpl-1' } });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(200);
    expect(mockDeprecate).toHaveBeenCalled();
  });

  it('GET /templates/lifecycle — non-super-admin can read (no super-admin guard on listing)', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'get', '/templates/lifecycle');
    expect(layer).toBeDefined();

    const req = nonAdminReq({ method: 'GET', query: { status: 'approved' } });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(200);
    expect(mockList).toHaveBeenCalledWith({ status: 'approved', category: undefined });
  });

  it('GET /templates/lifecycle rejects invalid status with 400', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'get', '/templates/lifecycle');

    const req = adminReq({ method: 'GET', query: { status: 'banana' } });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('approve maps INVALID_LIFECYCLE_TRANSITION to 409', async () => {
    mockApprove.mockRejectedValueOnce(
      Object.assign(new Error("from 'deprecated' to 'approved'"), {
        code: 'INVALID_LIFECYCLE_TRANSITION',
      })
    );
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/templates/:templateId/approve');

    const req = adminReq({ params: { templateId: 'tpl-1' } });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(409);
  });

  it('approve maps TEMPLATE_NOT_FOUND to 404', async () => {
    mockApprove.mockRejectedValueOnce(
      Object.assign(new Error('Template not found'), { code: 'TEMPLATE_NOT_FOUND' })
    );
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/templates/:templateId/approve');

    const req = adminReq({ params: { templateId: 'tpl-1' } });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(404);
  });
});

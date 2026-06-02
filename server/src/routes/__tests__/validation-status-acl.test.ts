/**
 * ACL + dispatch tests for the validation-status routes
 * (Block B · EPIC-T9 · Sprint 3).
 *
 * Surface under test:
 *   POST /records/:recordId/validation-status
 *   GET  /records/:recordId/validation-status/transitions
 *
 * The route handler imports `ValidationStatusService` dynamically inside the
 * request handler; the vi.mock below provides the same default export shape.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// First-time load of `table-platform.routes.ts` (~5K lines, transitively
// importing dozens of services) routinely runs ~6–9s on a cold worker. The
// global testTimeout (10s) leaves no headroom, so we bump it for this file.
vi.setConfig({ testTimeout: 25_000 });

const mockSetStatus = vi.fn();
const mockGetStatus = vi.fn();
const mockGetAllowed = vi.fn();

vi.mock('../../services/tablePlatform/ValidationStatusService.js', () => ({
  default: {
    setStatus: (...args: unknown[]) => mockSetStatus(...args),
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
    getAllowedTransitions: (...args: unknown[]) => mockGetAllowed(...args),
  },
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
  requireSuperAdmin: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!req.user.isSuperAdmin)
      return res.status(403).json({ error: 'Super admin access required' });
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
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [] })) }),
}));

vi.mock('express-rate-limit', () => ({
  default: () => (_req: any, _res: any, next: any) => next(),
  ipKeyGenerator: () => 'ip',
}));

vi.mock('../../middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_a: unknown) => (_req: any, _res: any, next: any) => next(),
}));

// Permissions: requireRecordAccess returns 401 if no user, 403 if no org,
// otherwise allows. Cross-tenant filtering is the service's responsibility.
vi.mock('../../services/tablePlatform/PermissionsService.js', () => ({
  default: {
    canAccessBase: () => Promise.resolve(true),
    requireBaseAccess: (_req: any, _res: any, next: any) => next(),
    requireTableAccess: (_req: any, _res: any, next: any) => next(),
    requireFieldAccess: (_req: any, _res: any, next: any) => next(),
    requireRecordAccess: (req: any, res: any, next: any) => {
      if (!req.user || !req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (!req.organizationId) {
        return res.status(403).json({ error: 'Organization context required' });
      }
      return next();
    },
    requireViewAccess: (_req: any, _res: any, next: any) => next(),
    requireRoles: () => (_req: any, _res: any, next: any) => next(),
    SCHEMA_ROLES: [],
    DATA_ROLES: [],
    VIEW_ROLES: [],
    INTERFACE_ROLES: [],
    ALL_ROLES: [],
  },
}));

// ── Test harness ────────────────────────────────────────────────────────────

function createMockRes(): any {
  const res: any = { statusCode: 200 };
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

const RECORD_ID = 'rec-1';
const POST_PATH = '/records/:recordId/validation-status';
const GET_PATH = '/records/:recordId/validation-status/transitions';

function tenantReq(overrides: Record<string, unknown> = {}) {
  return createMockReq({
    userId: 'user-A',
    organizationId: 'org-A',
    user: { id: 'user-A', isSuperAdmin: false },
    ...overrides,
  });
}

describe('Validation Status routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetStatus.mockResolvedValue({
      recordId: RECORD_ID,
      previous: 'unverified',
      next: 'verified',
      changed: true,
    });
    mockGetStatus.mockResolvedValue('unverified');
    mockGetAllowed.mockReturnValue(['verified', 'flagged']);
  });

  it('POST happy path 200, dispatches actor + isSuperAdmin + note', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', POST_PATH);
    expect(layer).toBeDefined();

    const req = tenantReq({
      params: { recordId: RECORD_ID },
      body: { status: 'verified', note: 'eyeballed' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(200);
    expect(mockSetStatus).toHaveBeenCalledWith(RECORD_ID, 'verified', {
      actorUserId: 'user-A',
      isSuperAdmin: false,
      note: 'eyeballed',
    });
  });

  it('POST forwards isSuperAdmin=true when user.isSuperAdmin', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', POST_PATH);

    const req = tenantReq({
      params: { recordId: RECORD_ID },
      body: { status: 'unverified' },
      user: { id: 'admin-1', isSuperAdmin: true },
      userId: 'admin-1',
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(mockSetStatus).toHaveBeenCalledWith(
      RECORD_ID,
      'unverified',
      expect.objectContaining({ isSuperAdmin: true })
    );
  });

  it('POST 400 on missing recordId', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', POST_PATH);

    // Express normally would not match, but the inline guard still defends.
    const req = tenantReq({ params: {}, body: { status: 'verified' } });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(400);
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it('POST 400 on invalid status', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', POST_PATH);

    const req = tenantReq({
      params: { recordId: RECORD_ID },
      body: { status: 'bogus' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(400);
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it('POST 401 when unauthenticated (requireRecordAccess gate)', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', POST_PATH);

    const req = createMockReq({
      params: { recordId: RECORD_ID },
      body: { status: 'verified' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(401);
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it('POST 403 when missing organization context', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', POST_PATH);

    const req = tenantReq({
      params: { recordId: RECORD_ID },
      body: { status: 'verified' },
      organizationId: undefined,
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(403);
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it('POST maps RECORD_NOT_FOUND to 404', async () => {
    mockSetStatus.mockRejectedValueOnce(
      Object.assign(new Error('Record not found'), { code: 'RECORD_NOT_FOUND' })
    );
    const router = await importRouter();
    const layer = findRoute(router, 'post', POST_PATH);

    const req = tenantReq({
      params: { recordId: RECORD_ID },
      body: { status: 'verified' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(404);
  });

  it('POST maps INVALID_VALIDATION_TRANSITION to 409', async () => {
    mockSetStatus.mockRejectedValueOnce(
      Object.assign(new Error("Invalid transition from 'unverified' to 'verified'"), {
        code: 'INVALID_VALIDATION_TRANSITION',
      })
    );
    const router = await importRouter();
    const layer = findRoute(router, 'post', POST_PATH);

    const req = tenantReq({
      params: { recordId: RECORD_ID },
      body: { status: 'verified' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(409);
  });

  it('POST maps TRANSITION_REQUIRES_SUPER_ADMIN to 403', async () => {
    mockSetStatus.mockRejectedValueOnce(
      Object.assign(new Error('requires super-admin'), {
        code: 'TRANSITION_REQUIRES_SUPER_ADMIN',
      })
    );
    const router = await importRouter();
    const layer = findRoute(router, 'post', POST_PATH);

    const req = tenantReq({
      params: { recordId: RECORD_ID },
      body: { status: 'unverified' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(403);
  });

  it('GET transitions happy path 200', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'get', GET_PATH);
    expect(layer).toBeDefined();

    const req = tenantReq({
      method: 'GET',
      params: { recordId: RECORD_ID },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(200);
    expect(mockGetStatus).toHaveBeenCalledWith(RECORD_ID);
    expect(mockGetAllowed).toHaveBeenCalledWith('unverified');
  });

  it('GET transitions 404 when record not found', async () => {
    mockGetStatus.mockResolvedValueOnce(null);
    const router = await importRouter();
    const layer = findRoute(router, 'get', GET_PATH);

    const req = tenantReq({ method: 'GET', params: { recordId: RECORD_ID } });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(404);
  });
});

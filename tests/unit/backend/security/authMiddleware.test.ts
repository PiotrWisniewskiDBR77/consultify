/**
 * L1 Unit Tests: auth.middleware.ts
 * Full branch coverage for authentication middleware, role mapping, permission checks.
 *
 * NOTE: We use vi.importActual to bypass the global mock in tests/setup.ts
 * which replaces verifyToken with a unit-test bypass.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the REAL module, bypassing the global mock
const {
  isAuthenticated,
  requireRole,
  requireSuperAdmin,
  requireOrganization,
  requirePermission,
  setDependencies,
  __private__,
  verifyToken,
} = await vi.importActual<typeof import('../../../../server/src/middleware/auth.middleware')>(
  '../../../../server/src/middleware/auth.middleware'
);

// ── Helpers ──
function mockReq(overrides: Record<string, any> = {}) {
  return {
    headers: {},
    body: {},
    query: {},
    cookies: {},
    path: '/api/test',
    ...overrides,
  } as any;
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  return res;
}

// ═══════════════════════════════════════════════
// isAuthenticated
// ═══════════════════════════════════════════════
describe('isAuthenticated (L1)', () => {
  it('calls next if req.user exists', () => {
    const req = mockReq({ user: { id: '1', role: 'admin' } });
    const res = mockRes();
    const next = vi.fn();
    isAuthenticated(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 if req.user is missing', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    isAuthenticated(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 if req.user is undefined', () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const next = vi.fn();
    isAuthenticated(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 if req.user is null', () => {
    const req = mockReq({ user: null });
    const res = mockRes();
    const next = vi.fn();
    isAuthenticated(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ═══════════════════════════════════════════════
// requireRole
// ═══════════════════════════════════════════════
describe('requireRole (L1)', () => {
  it('calls next for matching role', () => {
    const middleware = requireRole('administrator', 'owner');
    const req = mockReq({ user: { id: '1', role: 'administrator' } });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for non-matching role', () => {
    const middleware = requireRole('owner');
    const req = mockReq({ user: { id: '1', role: 'guest' } });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 if no user', () => {
    const middleware = requireRole('admin');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts multiple roles', () => {
    const middleware = requireRole('guest', 'team_member', 'administrator');
    const req = mockReq({ user: { id: '1', role: 'team_member' } });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects when role not in list', () => {
    const middleware = requireRole('owner', 'administrator');
    const req = mockReq({ user: { id: '1', role: 'team_member' } });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ═══════════════════════════════════════════════
// requireSuperAdmin
// ═══════════════════════════════════════════════
describe('requireSuperAdmin (L1)', () => {
  it('calls next for super admin', () => {
    const req = mockReq({ user: { id: '1', isSuperAdmin: true } });
    const res = mockRes();
    const next = vi.fn();
    requireSuperAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for non-super admin', () => {
    const req = mockReq({ user: { id: '1', isSuperAdmin: false } });
    const res = mockRes();
    const next = vi.fn();
    requireSuperAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Super admin access required' });
  });

  it('returns 401 if no user', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    requireSuperAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 when isSuperAdmin is undefined', () => {
    const req = mockReq({ user: { id: '1' } });
    const res = mockRes();
    const next = vi.fn();
    requireSuperAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ═══════════════════════════════════════════════
// requireOrganization
// ═══════════════════════════════════════════════
describe('requireOrganization (L1)', () => {
  it('calls next when organizationId present', () => {
    const req = mockReq({ organizationId: 'org-1' });
    const res = mockRes();
    const next = vi.fn();
    requireOrganization(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when organizationId missing', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    requireOrganization(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Organization context required' });
  });

  it('returns 403 for empty string organizationId', () => {
    const req = mockReq({ organizationId: '' });
    const res = mockRes();
    const next = vi.fn();
    requireOrganization(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 403 for null organizationId', () => {
    const req = mockReq({ organizationId: null });
    const res = mockRes();
    const next = vi.fn();
    requireOrganization(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ═══════════════════════════════════════════════
// requirePermission
// ═══════════════════════════════════════════════
describe('requirePermission (L1)', () => {
  it('calls next when user has permission', () => {
    const middleware = requirePermission('project:create');
    const req = mockReq({
      user: { id: '1', role: 'admin' },
      can: vi.fn().mockReturnValue(true),
    });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.can).toHaveBeenCalledWith('project:create');
  });

  it('returns 403 when user lacks permission', () => {
    const middleware = requirePermission('admin:delete');
    const req = mockReq({
      user: { id: '1', role: 'guest' },
      can: vi.fn().mockReturnValue(false),
    });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Permission denied',
      required: 'admin:delete',
    });
  });

  it('returns 401 if no user', () => {
    const middleware = requirePermission('any');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 if can function is missing', () => {
    const middleware = requirePermission('any');
    const req = mockReq({ user: { id: '1', role: 'admin' } });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 403 if can returns undefined (falsy)', () => {
    const middleware = requirePermission('any');
    const req = mockReq({
      user: { id: '1', role: 'admin' },
      can: vi.fn().mockReturnValue(undefined),
    });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ═══════════════════════════════════════════════
// setDependencies
// ═══════════════════════════════════════════════
describe('setDependencies (L1)', () => {
  it('does not throw when called with partial deps', () => {
    expect(() => setDependencies({ config: { JWT_SECRET: 'test' } })).not.toThrow();
  });

  it('does not throw when called with empty object', () => {
    expect(() => setDependencies({})).not.toThrow();
  });
});

// ═══════════════════════════════════════════════
// __private__ helpers (targeting coverage gaps)
// ═══════════════════════════════════════════════
describe('__private__ helpers (L1)', () => {
  it('lazy-loads default dependencies via getDeps()', async () => {
    __private__.resetDepsForTests();
    const deps = await __private__.getDeps();
    expect(deps).toBeTruthy();
    expect(deps.jwt).toBeTruthy();
    expect(deps.config).toBeTruthy();
    expect(deps.PermissionService).toBeTruthy();
    expect(typeof deps.dbGet).toBe('function');
  });

  it('covers role mapping edge cases', () => {
    expect(__private__.mapRole('super_admin')).toBe('superadmin');
    expect(__private__.mapRole('member')).toBe('team_member');
    expect(__private__.mapRole('weird_role')).toBe('team_member');
  });

  it('covers permission-role normalization edge cases', () => {
    expect(__private__.normalizePermissionRole(undefined)).toBe('VIEWER');
    expect(__private__.normalizePermissionRole('owner')).toBe('OWNER');
    expect(__private__.normalizePermissionRole('administrator')).toBe('ADMIN');
    expect(__private__.normalizePermissionRole('client')).toBe('VIEWER');
    expect(__private__.normalizePermissionRole('custom_role')).toBe('CUSTOM_ROLE');
  });
});

// ═══════════════════════════════════════════════
// verifyToken — integration-style unit tests
// ═══════════════════════════════════════════════
describe('verifyToken (L1)', () => {
  const jwtSecret = 'test-secret-key-for-unit-tests';
  let jwt: typeof import('jsonwebtoken');

  beforeEach(async () => {
    jwt = await import('jsonwebtoken');
    setDependencies({
      jwt: jwt.default || jwt,
      config: { JWT_SECRET: jwtSecret },
      PermissionService: { can: () => true },
      dbGet: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('returns 401 when no token provided (non-test env)', async () => {
    const origEnv = process.env.NODE_ENV;
    const origBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_TEST_AUTH_BYPASS;
    try {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      await verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origBypass !== undefined) process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
    }
  });

  it('authenticates valid Bearer token', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'user-1', email: 'test@test.com', role: 'admin' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-1');
  });

  it('authenticates token from cookie', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'cookie-user', email: 'c@test.com', role: 'admin' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    // Cookie extraction works when no Authorization header is present
    const req = mockReq({ cookies: { access_token: token } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('cookie-user');
  });

  it('returns 401 for expired token', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'user-exp', email: 'exp@test.com' },
      jwtSecret,
      { expiresIn: '-1s' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
  });

  it('returns 401 for invalid token', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer invalid.token.here' } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('extracts token from body', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'body-user', email: 'b@test.com', role: 'admin' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ body: { token } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('body-user');
  });

  it('extracts token from query', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'query-user', email: 'q@test.com', role: 'admin' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ query: { token } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('query-user');
  });

  it('rejects revoked token (by jti)', async () => {
    setDependencies({
      jwt: jwt.default || jwt,
      config: { JWT_SECRET: jwtSecret },
      PermissionService: { can: () => true },
      dbGet: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('SELECT jti FROM revoked_tokens WHERE jti')) {
          return { jti: params[0] };
        }
        return undefined;
      }),
    });
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'revoked-user', email: 'r@test.com', jti: 'revoked-jti-123' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token has been revoked' });
  });

  it('maps role correctly (admin → administrator)', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'role-user', email: 'role@test.com', role: 'admin' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(req.user?.role).toBe('administrator');
  });

  it('maps role correctly (superadmin → owner)', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'sa-user', email: 'sa@test.com', role: 'superadmin' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(req.user?.role).toBe('owner');
  });

  it('maps role correctly (user → team_member)', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'u-user', email: 'u@test.com', role: 'user' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(req.user?.role).toBe('team_member');
  });

  it('maps role correctly (client → guest)', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'c-user', email: 'c@test.com', role: 'client' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(req.user?.role).toBe('guest');
  });

  it('maps role correctly (manager → project_manager)', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'm-user', email: 'm@test.com', role: 'manager' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(req.user?.role).toBe('project_manager');
  });

  it('defaults to team_member when no role', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'norole-user', email: 'nr@test.com' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(req.user?.role).toBe('team_member');
  });

  it('attaches organizationId from token', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'org-user', email: 'o@test.com', organizationId: 'org-123' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(req.organizationId).toBe('org-123');
  });

  it('attaches isSuperAdmin from token', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'sa-user', email: 'sa@test.com', isSuperAdmin: true },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(req.user?.isSuperAdmin).toBe(true);
  });

  it('attaches can() helper', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'perm-user', email: 'p@test.com', role: 'admin' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(typeof req.can).toBe('function');
    expect(req.can('anything')).toBe(true);
  });

  it('handles token without jti (legacy)', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'legacy-user', email: 'l@test.com' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('legacy-user');
  });

  it('handles Authorization header without Bearer prefix', async () => {
    const token = (jwt.default || (jwt as any)).sign(
      { id: 'nobearer-user', email: 'nb@test.com' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: token } });
    const res = mockRes();
    const next = vi.fn();
    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('nobearer-user');
  });

  it('keeps an authenticated internal user in the token organization on the demo host', async () => {
    const dbGet = vi.fn().mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM organization_members')) {
        return { status: 'ACTIVE', role: 'OWNER', organization_id: params[1] };
      }
      return undefined;
    });
    setDependencies({
      jwt: jwt.default || jwt,
      config: { JWT_SECRET: jwtSecret },
      PermissionService: { can: () => true },
      dbGet,
    });
    const token = (jwt.default || (jwt as any)).sign(
      {
        id: 'internal-owner',
        email: 'owner@example.com',
        role: 'OWNER',
        organizationId: 'canonical-org-uuid',
      },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({
      headers: { authorization: `Bearer ${token}` },
      get: (name: string) => (name.toLowerCase() === 'x-demo-mode' ? 'true' : undefined),
    });
    const res = mockRes();
    const next = vi.fn();

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.organizationId).toBe('canonical-org-uuid');
  });

  it('rejects token issued before a revoke-all marker', async () => {
    const iatSec = Math.floor(Date.now() / 1000) - 10; // issued 10s ago
    const tokenIssuedAt = iatSec * 1000;
    const revokeTime = tokenIssuedAt + 1000; // revoke-all happened 1s after issuance
    setDependencies({
      jwt: jwt.default || jwt,
      config: { JWT_SECRET: jwtSecret },
      PermissionService: { can: () => true },
      dbGet: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT jti FROM revoked_tokens WHERE jti = ?')) return undefined;
        if (sql.includes("reason = 'revoke-all'")) return { jti: `revoke-all-${revokeTime}` };
        return undefined;
      }),
    });

    const token = (jwt.default || (jwt as any)).sign(
      { id: 'revall-user', email: 'ra@test.com', jti: 'jti-1', iat: iatSec },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();

    await verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'All sessions have been revoked. Please log in again.' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows token issued after a revoke-all marker', async () => {
    const revokeTime = Date.now() - 10_000; // revoke-all happened 10s ago
    const iatSec = Math.floor(Date.now() / 1000) - 5; // issued 5s ago (after revokeTime)
    setDependencies({
      jwt: jwt.default || jwt,
      config: { JWT_SECRET: jwtSecret },
      PermissionService: { can: () => true },
      dbGet: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT jti FROM revoked_tokens WHERE jti = ?')) return undefined;
        if (sql.includes("reason = 'revoke-all'")) return { jti: `revoke-all-${revokeTime}` };
        return undefined;
      }),
    });

    const token = (jwt.default || (jwt as any)).sign(
      { id: 'revall-user2', email: 'ra2@test.com', jti: 'jti-2', iat: iatSec },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();

    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('revall-user2');
  });

  it('continues when DB revocation checks error', async () => {
    setDependencies({
      jwt: jwt.default || jwt,
      config: { JWT_SECRET: jwtSecret },
      PermissionService: { can: () => true },
      dbGet: vi.fn().mockRejectedValue(new Error('db down')),
    });

    const token = (jwt.default || (jwt as any)).sign(
      { id: 'dberr-user', email: 'd@test.com', jti: 'jti-3' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();

    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('dberr-user');
  });

  it('bypasses signature verification in E2E_MODE for explicit e2e token (seed succeeds)', async () => {
    const origE2E = process.env.E2E_MODE;
    process.env.E2E_MODE = 'true';
    try {
      vi.resetModules();
      vi.doMock('../../../../server/src/utils/DbPromise.js', () => ({
        run: vi.fn().mockResolvedValue({ success: true, changes: 1 }),
        get: vi.fn(),
        all: vi.fn(),
        exec: vi.fn(),
      }));

      const mod = await import('../../../../server/src/middleware/auth.middleware.ts');
      mod.setDependencies({
        jwt: {
          decode: () => ({
            e2e: true,
            id: 'e2e-user',
            email: 'e2e@local.test',
            role: 'admin',
            organizationId: 'e2e-org',
            name: 'E2E User',
          }),
        } as any,
        config: { JWT_SECRET: jwtSecret },
        PermissionService: { can: () => true },
        dbGet: vi.fn().mockResolvedValue(undefined),
      });

      const req = mockReq({ headers: { authorization: 'Bearer e2e-token' } });
      const res = mockRes();
      const next = vi.fn();
      await mod.verifyToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.userId).toBe('e2e-user');
    } finally {
      if (origE2E !== undefined) process.env.E2E_MODE = origE2E;
      else delete process.env.E2E_MODE;
    }
  });

  it('bypasses in E2E_MODE even when seed fails (continues)', async () => {
    const origE2E = process.env.E2E_MODE;
    process.env.E2E_MODE = 'true';
    try {
      vi.resetModules();
      vi.doMock('../../../../server/src/utils/DbPromise.js', () => ({
        run: vi.fn().mockRejectedValue(new Error('seed-fail')),
        get: vi.fn(),
        all: vi.fn(),
        exec: vi.fn(),
      }));

      const mod = await import('../../../../server/src/middleware/auth.middleware.ts');
      mod.setDependencies({
        jwt: {
          decode: () => ({ e2e: true, id: 'e2e-user2', role: 'admin' }),
        } as any,
        config: { JWT_SECRET: jwtSecret },
        PermissionService: { can: () => true },
        dbGet: vi.fn().mockResolvedValue(undefined),
      });

      const req = mockReq({ headers: { authorization: 'Bearer e2e-token' } });
      const res = mockRes();
      const next = vi.fn();
      await mod.verifyToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.userId).toBe('e2e-user2');
    } finally {
      if (origE2E !== undefined) process.env.E2E_MODE = origE2E;
      else delete process.env.E2E_MODE;
    }
  });
});

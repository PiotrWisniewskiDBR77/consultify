/**
 * L3 Integration Tests: Authentication Cookie Flow
 * Tests the complete auth flow: login → cookie set → authenticated request → refresh → logout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setAuthCookies,
  clearAuthCookies,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../../server/src/utils/cookieAuth';
// Import the REAL module, bypassing the global mock in tests/setup.ts
const { setDependencies, verifyToken, isAuthenticated, requireRole, requireOrganization } =
  await vi.importActual<typeof import('../../server/src/middleware/auth.middleware')>(
    '../../server/src/middleware/auth.middleware'
  );

const JWT_SECRET = 'integration-test-secret-key-2026';

// ── Helpers ──
function createMockReq(overrides: Record<string, any> = {}) {
  return {
    headers: {},
    body: {},
    query: {},
    cookies: {},
    path: '/api/test',
    ...overrides,
  } as any;
}

function createMockRes() {
  const cookies: Record<string, { value: string; options: any }> = {};
  const cleared: Record<string, any> = {};
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn((n: string, v: string, o: any) => {
      cookies[n] = { value: v, options: o };
    }),
    clearCookie: vi.fn((n: string, o: any) => {
      cleared[n] = o;
    }),
    _cookies: cookies,
    _cleared: cleared,
  } as any;
}

describe('Auth Cookie Flow Integration (L3)', () => {
  beforeEach(() => {
    setDependencies({
      jwt,
      config: { JWT_SECRET },
      PermissionService: { can: () => true },
      dbGet: vi.fn().mockResolvedValue(undefined),
    });
  });

  // ── Full Login → Authenticated Request Flow ──
  describe('Login → Cookie → Authenticated Request', () => {
    it('complete flow: set cookies → extract from cookie → verify', async () => {
      // Step 1: Simulate login — server sets cookies
      const res = createMockRes();
      const accessToken = jwt.sign(
        { id: 'user-1', email: 'test@example.com', role: 'admin', organizationId: 'org-1' },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      const refreshToken = jwt.sign({ id: 'user-1', type: 'refresh' }, JWT_SECRET, {
        expiresIn: '7d',
      });
      setAuthCookies(res, accessToken, refreshToken);

      // Verify cookies were set
      expect(res._cookies[ACCESS_TOKEN_COOKIE]).toBeDefined();
      expect(res._cookies[REFRESH_TOKEN_COOKIE]).toBeDefined();
      expect(res._cookies[ACCESS_TOKEN_COOKIE].options.httpOnly).toBe(true);

      // Step 2: Simulate authenticated request with cookie
      const req = createMockReq({
        cookies: { access_token: accessToken },
      });
      const authRes = createMockRes();
      const next = vi.fn();
      await verifyToken(req, authRes, next);

      // Step 3: Verify user was attached
      expect(next).toHaveBeenCalled();
      expect(req.userId).toBe('user-1');
      expect(req.user?.email).toBe('test@example.com');
      expect(req.user?.role).toBe('administrator'); // admin → administrator mapping
      expect(req.organizationId).toBe('org-1');
    });

    it('rejects request after cookies are cleared (logout)', async () => {
      // Set cookies
      const res = createMockRes();
      const token = jwt.sign({ id: 'u1', email: 'u@test.com' }, JWT_SECRET, { expiresIn: '15m' });
      setAuthCookies(res, token, 'refresh');

      // Clear cookies (logout)
      clearAuthCookies(res);
      expect(res.clearCookie).toHaveBeenCalledTimes(2);

      // Try to authenticate with no cookies
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      delete process.env.ENABLE_TEST_AUTH_BYPASS;
      try {
        const req = createMockReq({ cookies: {} });
        const authRes = createMockRes();
        const next = vi.fn();
        await verifyToken(req, authRes, next);
        expect(authRes.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  // ── Cookie vs Header Priority ──
  describe('Token extraction priority', () => {
    it('Bearer header takes priority over cookie', async () => {
      const headerToken = jwt.sign({ id: 'header-user', email: 'h@test.com' }, JWT_SECRET, {
        expiresIn: '15m',
      });
      const cookieToken = jwt.sign({ id: 'cookie-user', email: 'c@test.com' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const req = createMockReq({
        headers: { authorization: `Bearer ${headerToken}` },
        cookies: { access_token: cookieToken },
      });
      const res = createMockRes();
      const next = vi.fn();
      await verifyToken(req, res, next);

      // Header token should win
      expect(req.userId).toBe('header-user');
    });

    it('cookie is used when no Authorization header', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        const cookieToken = jwt.sign({ id: 'cookie-only', email: 'co@test.com' }, JWT_SECRET, {
          expiresIn: '15m',
        });

        const req = createMockReq({
          cookies: { access_token: cookieToken },
        });
        const res = createMockRes();
        const next = vi.fn();
        await verifyToken(req, res, next);

        expect(req.userId).toBe('cookie-only');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  // ── Role-based Access Control Flow ──
  describe('RBAC flow', () => {
    it('admin can access admin-only route', async () => {
      const token = jwt.sign(
        { id: 'admin-1', email: 'admin@test.com', role: 'admin', organizationId: 'org-1' },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Step 1: Authenticate
      const req = createMockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = createMockRes();
      const next1 = vi.fn();
      await verifyToken(req, res, next1);
      expect(next1).toHaveBeenCalled();

      // Step 2: Check role
      const roleMiddleware = requireRole('administrator', 'owner');
      const next2 = vi.fn();
      roleMiddleware(req, res, next2);
      expect(next2).toHaveBeenCalled();
    });

    it('guest cannot access admin-only route', async () => {
      const token = jwt.sign(
        { id: 'guest-1', email: 'guest@test.com', role: 'guest', organizationId: 'org-1' },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      const req = createMockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = createMockRes();
      const next1 = vi.fn();
      await verifyToken(req, res, next1);

      const roleMiddleware = requireRole('administrator', 'owner');
      const next2 = vi.fn();
      roleMiddleware(req, res, next2);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next2).not.toHaveBeenCalled();
    });

    it('organization context is required for org-scoped routes', async () => {
      const tokenWithOrg = jwt.sign(
        { id: 'u1', email: 'u@test.com', organizationId: 'org-1' },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      const tokenWithoutOrg = jwt.sign({ id: 'u2', email: 'u2@test.com' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      // With org
      const req1 = createMockReq({ headers: { authorization: `Bearer ${tokenWithOrg}` } });
      const res1 = createMockRes();
      const next1 = vi.fn();
      await verifyToken(req1, res1, next1);
      const next1b = vi.fn();
      requireOrganization(req1, res1, next1b);
      expect(next1b).toHaveBeenCalled();

      // Without org
      const req2 = createMockReq({ headers: { authorization: `Bearer ${tokenWithoutOrg}` } });
      const res2 = createMockRes();
      const next2 = vi.fn();
      await verifyToken(req2, res2, next2);
      const next2b = vi.fn();
      requireOrganization(req2, res2, next2b);
      expect(res2.status).toHaveBeenCalledWith(403);
    });
  });

  // ── Token Revocation Flow ──
  describe('Token revocation', () => {
    it('revoked token is rejected', async () => {
      setDependencies({
        jwt,
        config: { JWT_SECRET },
        PermissionService: { can: () => true },
        dbGet: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('WHERE jti =')) return { jti: 'revoked-jti' };
          return undefined;
        }),
      });

      const token = jwt.sign({ id: 'u1', email: 'u@test.com', jti: 'revoked-jti' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const req = createMockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = createMockRes();
      const next = vi.fn();
      await verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token has been revoked' });
    });

    it('non-revoked token passes', async () => {
      setDependencies({
        jwt,
        config: { JWT_SECRET },
        PermissionService: { can: () => true },
        dbGet: vi.fn().mockResolvedValue(undefined),
      });

      const token = jwt.sign({ id: 'u1', email: 'u@test.com', jti: 'valid-jti' }, JWT_SECRET, {
        expiresIn: '15m',
      });

      const req = createMockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = createMockRes();
      const next = vi.fn();
      await verifyToken(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});

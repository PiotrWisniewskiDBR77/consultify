import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextFunction, Response } from 'express';
import {
  verifyToken,
  isAuthenticated,
  optionalAuth,
  requireRole,
  requireSuperAdmin,
  requireOrganization,
  requirePermission,
  setDependencies,
  AuthRequest,
} from '../../../../server/src/middleware/auth.middleware.ts';

describe('AuthMiddleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  const origMockDb = process.env.MOCK_DB;

  const mockJwt = {
    verify: vi.fn(),
    decode: vi.fn(),
  };

  const mockConfig = {
    JWT_SECRET: 'test-secret',
  };

  const mockPermissionService = {
    can: vi.fn(),
  };

  const mockDbGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      headers: {},
      body: {},
      query: {},
      cookies: {},
      path: '/test',
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();

    // Inject mocks
    setDependencies({
      jwt: mockJwt as any,
      config: mockConfig,
      PermissionService: mockPermissionService,
      dbGet: mockDbGet,
    });

    // Default ENV for tests
    process.env.NODE_ENV = 'test';
    process.env.E2E_MODE = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    // Ensure the global auth middleware mock (tests/setup.ts) delegates to real verifyToken
    // so this suite can assert 401 behavior for missing tokens.
    process.env.MOCK_DB = 'false';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (origMockDb === undefined) delete process.env.MOCK_DB;
    else process.env.MOCK_DB = origMockDb;
  });

  describe('verifyToken', () => {
    it('should return 401 if no token is provided', async () => {
      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should extract token from Bearer header', async () => {
      mockReq.headers!['authorization'] = 'Bearer valid-token';
      mockJwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { id: 'user-123', role: 'ADMIN' });
      });
      mockDbGet.mockResolvedValue(null); // No revocation

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'valid-token',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.id).toBe('user-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should treat non-Bearer authorization header as token', async () => {
      mockReq.headers!['authorization'] = 'raw-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-raw' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith('raw-token', 'test-secret', expect.any(Function));
      expect(mockReq.user?.id).toBe('user-raw');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract token from body.token when header/cookie missing', async () => {
      mockReq.body = { token: 'body-token' } as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-body' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'body-token',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-body');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract token from query.token when header/cookie/body missing', async () => {
      mockReq.query = { token: 'query-token' } as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-query' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'query-token',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-query');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should prefer header token over cookie/body/query', async () => {
      mockReq.headers!['authorization'] = 'Bearer header-token';
      mockReq.cookies!['access_token'] = 'cookie-token';
      mockReq.body = { token: 'body-token' } as any;
      mockReq.query = { token: 'query-token' } as any;

      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-header' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'header-token',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-header');
    });

    it('should prefer access_token cookie over token cookie', async () => {
      mockReq.cookies!['access_token'] = 'access-cookie-token';
      mockReq.cookies!['token'] = 'fallback-cookie-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-cookie' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'access-cookie-token',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-cookie');
    });

    it('should fall back to token cookie when access_token is missing', async () => {
      mockReq.cookies!['token'] = 'fallback-cookie-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-token-cookie' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'fallback-cookie-token',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-token-cookie');
    });

    it('should extract token from cookie if header is missing', async () => {
      mockReq.cookies!['access_token'] = 'cookie-token';
      mockJwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { id: 'user-123' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'cookie-token',
        'test-secret',
        expect.any(Function)
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not overwrite existing req.user in test bypass mode', async () => {
      process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
      mockReq.user = { id: 'already', role: 'administrator' } as any;

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe('already');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should map role "guest" and normalize permission role to VIEWER', async () => {
      mockReq.headers!['authorization'] = 'Bearer guest-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'guest-1', role: 'guest' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.role).toBe('guest');
      mockReq.can?.('some_capability');
      expect(mockPermissionService.can).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'VIEWER' }),
        'some_capability',
        expect.any(Object)
      );
    });

    it('should skip revocation DB check when decoded token has no jti', async () => {
      mockReq.headers!['authorization'] = 'Bearer no-jti-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-no-jti' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockDbGet).not.toHaveBeenCalled();
      expect(mockReq.user?.id).toBe('user-no-jti');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing JWT_SECRET config by failing unauthorized', async () => {
      mockReq.headers!['authorization'] = 'Bearer cfg-missing';
      setDependencies({
        jwt: mockJwt as any,
        config: {},
        PermissionService: mockPermissionService,
        dbGet: mockDbGet,
      });
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(new Error('bad secret'), null);
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 401 if token is expired', async () => {
      mockReq.headers!['authorization'] = 'Bearer expired-token';
      const expireError = new Error('Token expired');
      expireError.name = 'TokenExpiredError';

      mockJwt.verify.mockImplementation((token, secret, callback) => {
        callback(expireError, null);
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
    });

    it('should handle token revocation check', async () => {
      mockReq.headers!['authorization'] = 'Bearer revoked-token';
      mockJwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { id: 'user-123', jti: 'jti-456' });
      });
      mockDbGet.mockResolvedValue({ jti: 'jti-456' }); // Token is in revoked list

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token has been revoked' });
    });

    it('should allow bypass if ENABLE_TEST_AUTH_BYPASS is true', async () => {
      process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.id).toBe('test-user-id');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('isAuthenticated', () => {
    it('should call next if user is attached', () => {
      mockReq.user = { id: 'user-1' } as any;
      isAuthenticated(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 if user is not attached', () => {
      isAuthenticated(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('optionalAuth', () => {
    it('should attach user if valid token exists', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt-token';
      mockJwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { id: 'user-789' });
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe('user-789');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without user if no token exists', async () => {
      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without user if token is invalid', async () => {
      mockReq.headers!['authorization'] = 'Bearer bad-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(new Error('invalid'), null);
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should allow access if user has required role', () => {
      mockReq.user = { role: 'administrator' } as any;
      const middleware = requireRole('administrator');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access if role differs', () => {
      mockReq.user = { role: 'team_member' } as any;
      const middleware = requireRole('administrator');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireSuperAdmin', () => {
    it('should allow if user is superadmin', () => {
      mockReq.user = { isSuperAdmin: true } as any;
      requireSuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny if user is not superadmin', () => {
      mockReq.user = { isSuperAdmin: false } as any;
      requireSuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireOrganization', () => {
    it('should allow if organizationId is present', () => {
      mockReq.organizationId = 'org-1';
      requireOrganization(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny if organizationId is missing', () => {
      requireOrganization(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requirePermission', () => {
    it('should allow if user has permission', () => {
      mockReq.user = { id: 'u1' } as any;
      mockReq.can = vi.fn().mockReturnValue(true);

      const middleware = requirePermission('edit_project');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.can).toHaveBeenCalledWith('edit_project');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny if user lacks permission', () => {
      mockReq.user = { id: 'u1' } as any;
      mockReq.can = vi.fn().mockReturnValue(false);

      const middleware = requirePermission('delete_org');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Permission denied' })
      );
    });
  });
});

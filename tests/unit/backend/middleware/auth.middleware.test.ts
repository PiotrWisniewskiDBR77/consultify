import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextFunction, Response } from 'express';
import logger from '../../../../server/src/utils/Logger.js';
import {
  verifyToken,
  isAuthenticated,
  optionalAuth,
  requireRole,
  requireSuperAdmin,
  requireOrganization,
  validateOrgMembership,
  requirePermission,
  setDependencies,
  __private__,
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
    mockJwt.verify.mockReset();
    mockJwt.decode.mockReset();
    mockPermissionService.can.mockReset();
    mockDbGet.mockReset();
    __private__.resetRevocationCachesForTests();
    __private__.resetMembershipCacheForTests();

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

    it('does not crash when req.path accessor throws during verifyToken debug logging', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';
        Object.defineProperty(mockReq, 'path', {
          configurable: true,
          enumerable: true,
          get() {
            throw new Error('path getter failed');
          },
        });

        await expect(
          verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext)
        ).resolves.toBeUndefined();
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
        expect(mockNext).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
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

    it('passes jwt clockTolerance option when verify supports options arity', async () => {
      mockReq.headers!['authorization'] = 'Bearer valid-token-with-options';
      const verifyWithOptions = vi.fn(
        (_token: string, _secret: string, options: unknown, callback: any) => {
          expect(options).toEqual(
            expect.objectContaining({
              algorithms: ['HS256'],
              clockTolerance: 0,
            })
          );
          callback(null, { id: 'user-with-options', role: 'ADMIN' });
        }
      );
      Object.defineProperty(verifyWithOptions, 'length', { value: 4 });
      const optionsAwareJwt = {
        verify: verifyWithOptions,
        decode: mockJwt.decode,
      };
      setDependencies({
        jwt: optionsAwareJwt as any,
        config: mockConfig,
        PermissionService: mockPermissionService,
        dbGet: mockDbGet,
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user?.id).toBe('user-with-options');
      setDependencies({
        jwt: mockJwt as any,
        config: mockConfig,
        PermissionService: mockPermissionService,
        dbGet: mockDbGet,
      });
    });

    it('should trim bearer token and support case-insensitive bearer prefix', async () => {
      mockReq.headers!['authorization'] = '  bearer   spaced-token   ';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-spaced' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'spaced-token',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-spaced');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should parse bearer token when separator contains tabs and mixed whitespace', async () => {
      mockReq.headers!['authorization'] = 'Bearer\t \tmixed-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-mixed' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'mixed-token',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-mixed');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use first non-empty Authorization value when header is an array', async () => {
      mockReq.headers!['authorization'] = ['', 'Bearer array-token'] as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-array-header' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'array-token',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-array-header');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip bare Bearer entry in Authorization array when later entry has valid token', async () => {
      mockReq.headers!['authorization'] = ['Bearer', 'Bearer array-fallback-token'] as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-array-fallback-header' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'array-fallback-token',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-array-fallback-header');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should treat bare Bearer header without token as missing token', async () => {
      mockReq.headers!['authorization'] = 'Bearer';

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should treat Bearer with only trailing whitespace as missing token', async () => {
      mockReq.headers!['authorization'] = 'Bearer   ';
      mockReq.cookies = { access_token: 'cookie-should-not-be-used' } as any;

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should route demo requests to the interactive session tenant', async () => {
      mockReq.headers!['authorization'] = 'Bearer valid-token';
      mockReq.headers!['x-demo-mode'] = 'true';
      mockReq.headers!['x-demo-session-org'] = 'demo-org-session-user123';
      mockReq.get = vi.fn(
        (header: string) => mockReq.headers?.[header.toLowerCase()] || null
      ) as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-123', role: 'ADMIN', organizationId: 'real-org-id' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.organizationId).toBe('demo-org-session-user123');
      expect(mockReq.user?.organizationId).toBe('demo-org-session-user123');
      expect(mockReq.user?.isDemo).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should treat non-boolean decoded isDemo claim as false when demo header is absent', async () => {
      mockReq.headers!['authorization'] = 'Bearer non-boolean-demo-claim';
      mockReq.get = vi.fn(() => null) as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-demo-claim', role: 'ADMIN', isDemo: 'false' as any });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.isDemo).toBe(false);
      expect(mockNext).toHaveBeenCalled();
    });

    it('does not treat whitespace-only impersonator claim as active impersonation', async () => {
      mockReq.headers!['authorization'] = 'Bearer whitespace-impersonator';
      mockReq.method = 'POST' as any;
      mockReq.path = '/api/projects/create' as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, {
          id: 'user-imp-clean',
          role: 'ADMIN',
          impersonatorId: '   ',
          impersonationSessionId: '   ',
        });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.impersonatorId).toBeUndefined();
      expect(mockReq.user?.impersonationSessionId).toBeUndefined();
      expect(mockRes.status).not.toHaveBeenCalledWith(403);
      expect(mockNext).toHaveBeenCalled();
    });

    it('enforces impersonation read-only even when req.path accessor throws', async () => {
      mockReq.headers!['authorization'] = 'Bearer impersonation-path-throw';
      mockReq.method = 'POST' as any;
      Object.defineProperty(mockReq, 'path', {
        configurable: true,
        enumerable: true,
        get() {
          throw new Error('path getter failed');
        },
      });
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, {
          id: 'user-impersonating',
          role: 'ADMIN',
          impersonatorId: 'superadmin-1',
        });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'IMPERSONATION_READ_ONLY' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('continues auth flow when header accessor throws in verifyToken path', async () => {
      mockReq.headers!['authorization'] = 'Bearer header-throw';
      mockReq.get = vi.fn(() => {
        throw new Error('header read failed');
      }) as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-header-throw', role: 'ADMIN' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe('user-header-throw');
      expect(mockRes.status).not.toHaveBeenCalledWith(401);
      expect(mockNext).toHaveBeenCalled();
    });

    it('normalizes invalid name/email claims without crashing verifyToken flow', async () => {
      mockReq.headers!['authorization'] = 'Bearer invalid-name-email';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, {
          id: 'user-invalid-name-email',
          role: 'ADMIN',
          name: { broken: true } as any,
          email: ['bad@email.test'] as any,
        });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe('user-invalid-name-email');
      expect(mockReq.user?.name).toBe('User');
      expect(mockReq.user?.email).toBe('');
      expect(mockNext).toHaveBeenCalled();
    });

    it('returns 401 when decoded id exceeds max user-id length', async () => {
      mockReq.headers!['authorization'] = 'Bearer oversized-user-id';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'u'.repeat(257), role: 'ADMIN' });
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('ignores oversized organizationId claim and keeps auth flow stable', async () => {
      mockReq.headers!['authorization'] = 'Bearer oversized-org-claim';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, {
          id: 'user-org-oversized',
          role: 'ADMIN',
          organizationId: 'o'.repeat(129),
        });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).not.toHaveBeenCalledWith(401);
      expect(mockReq.organizationId).toBeUndefined();
      expect(mockReq.user?.organizationId).toBe('');
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

    it('extractToken should fall back to cookie when authorization accessor throws', () => {
      const reqWithThrowingAuthorization: any = {
        cookies: { access_token: 'cookie-after-header-throw' },
        body: {},
        query: {},
      };
      Object.defineProperty(reqWithThrowingAuthorization, 'headers', {
        configurable: true,
        enumerable: true,
        get() {
          throw new Error('headers getter failed');
        },
      });

      const token = __private__.extractToken(reqWithThrowingAuthorization as AuthRequest);
      expect(token).toBe('cookie-after-header-throw');
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

    it('should continue token extraction from body when cookies accessor throws', async () => {
      mockReq.headers = {} as any;
      Object.defineProperty(mockReq, 'cookies', {
        configurable: true,
        enumerable: true,
        get() {
          throw new Error('cookies getter failed');
        },
      });
      mockReq.body = { token: 'body-after-cookie-throw' } as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-body-after-cookie-throw' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'body-after-cookie-throw',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-body-after-cookie-throw');
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

    it('should continue token extraction from query when body accessor throws', async () => {
      mockReq.headers = {} as any;
      mockReq.cookies = {} as any;
      Object.defineProperty(mockReq, 'body', {
        configurable: true,
        enumerable: true,
        get() {
          throw new Error('body getter failed');
        },
      });
      mockReq.query = { token: 'query-after-body-throw' } as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-query-after-body-throw' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'query-after-body-throw',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-query-after-body-throw');
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

    it('should ignore empty cookie token and fall back to body token', async () => {
      mockReq.cookies!['access_token'] = '';
      mockReq.body = { token: 'body-token' } as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-body-fallback' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'body-token',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-body-fallback');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should ignore whitespace cookie token and fall back to body token', async () => {
      mockReq.cookies!['access_token'] = '   ';
      mockReq.body = { token: 'body-token-trimmed' } as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-body-trimmed' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'body-token-trimmed',
        'test-secret',
        expect.any(Function)
      );
      expect(mockReq.user?.id).toBe('user-body-trimmed');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should ignore oversized cookie token and treat request as missing token', async () => {
      mockReq.cookies!['access_token'] = 'x'.repeat(9000);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should ignore cookie token with control characters and treat request as missing token', async () => {
      mockReq.cookies!['access_token'] = 'cookie-\u0000-token';

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should ignore oversized body token and treat request as missing token', async () => {
      mockReq.body = { token: 'x'.repeat(9000) } as any;

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should ignore body token with control characters and treat request as missing token', async () => {
      mockReq.body = { token: 'body-\u0000-token' } as any;

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should ignore oversized query token and treat request as missing token', async () => {
      mockReq.query = { token: 'x'.repeat(9000) } as any;

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should ignore query token with control characters and treat request as missing token', async () => {
      mockReq.query = { token: 'query-\u0000-token' } as any;

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not accept non-string query.token values', async () => {
      mockReq.query = { token: ['x'] } as any;

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
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

    it('should read legacy organization_id claim into req.organizationId', async () => {
      mockReq.headers!['authorization'] = 'Bearer legacy-org-claim';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-legacy', organization_id: 'org-legacy', role: 'admin' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.organizationId).toBe('org-legacy');
      expect(mockReq.user?.organizationId).toBe('org-legacy');
      expect(mockNext).toHaveBeenCalled();
    });

    it('normalizes organizationId claim and drops whitespace-only values', async () => {
      mockReq.headers!['authorization'] = 'Bearer whitespace-org-id';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-org-whitespace', organizationId: '   ', role: 'ADMIN' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.organizationId).toBeUndefined();
      expect(mockReq.user?.organizationId).toBe('');
      expect(mockNext).toHaveBeenCalled();
    });

    it('ignores oversized x-org-context header for org override membership lookup', async () => {
      mockReq.headers!['authorization'] = 'Bearer oversized-org-context-header';
      mockReq.headers!['x-org-context'] = 'o'.repeat(200);
      mockReq.get = vi.fn(
        (header: string) => mockReq.headers?.[header.toLowerCase()] || null
      ) as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-ctx-oversized', role: 'ADMIN', organizationId: 'token-org' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.organizationId).toBe('token-org');
      expect(mockReq.user?.organizationId).toBe('token-org');
      expect(mockNext).toHaveBeenCalled();
      expect(mockDbGet).not.toHaveBeenCalledWith(expect.any(String), [
        'user-ctx-oversized',
        'o'.repeat(200),
      ]);
    });

    it('should reject verified payloads with missing id', async () => {
      mockReq.headers!['authorization'] = 'Bearer missing-id';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { role: 'admin', organizationId: 'org-1' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject verified payloads when id getter throws', async () => {
      mockReq.headers!['authorization'] = 'Bearer throwing-id-getter';
      const payloadWithThrowingId: Record<string, unknown> = { role: 'admin' };
      Object.defineProperty(payloadWithThrowingId, 'id', {
        enumerable: true,
        get: () => {
          throw new Error('id getter failed');
        },
      });
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, payloadWithThrowingId);
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('accepts frozen decoded payload by normalizing id on a cloned object', async () => {
      mockReq.headers!['authorization'] = 'Bearer frozen-decoded';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(
          null,
          Object.freeze({ id: '  frozen-user  ', role: 'ADMIN', organizationId: 'org-frozen' })
        );
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe('frozen-user');
      expect(mockReq.organizationId).toBe('org-frozen');
      expect(mockNext).toHaveBeenCalled();
    });

    it.each([
      { raw: 'admin', expected: 'administrator' },
      { raw: 'super_admin', expected: 'owner' },
      { raw: 'client', expected: 'guest' },
      { raw: 'manager', expected: 'project_manager' },
    ])('maps legacy role "$raw" to "$expected"', async ({ raw, expected }) => {
      mockReq.headers!['authorization'] = `Bearer role-${raw}`;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: `u-${raw}`, role: raw });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.role).toBe(expected);
      expect(mockNext).toHaveBeenCalled();
    });

    it.each([
      { decodedRole: 'administrator', expectedPermissionRole: 'ADMIN' },
      { decodedRole: 'superadmin', expectedPermissionRole: 'SUPERADMIN' },
      { decodedRole: 'member', expectedPermissionRole: 'TEAM_MEMBER' },
      { decodedRole: 'user', expectedPermissionRole: 'TEAM_MEMBER' },
      { decodedRole: 'guest', expectedPermissionRole: 'VIEWER' },
    ])(
      'normalizes permission role for req.can: $decodedRole -> $expectedPermissionRole',
      async ({ decodedRole, expectedPermissionRole }) => {
        mockReq.headers!['authorization'] = `Bearer perm-${decodedRole}`;
        mockJwt.verify.mockImplementation((_token, _secret, callback) => {
          callback(null, { id: `u-${decodedRole}`, role: decodedRole });
        });
        mockDbGet.mockResolvedValue(null);

        await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

        mockReq.can?.('cap');
        expect(mockPermissionService.can).toHaveBeenCalledWith(
          expect.objectContaining({ role: expectedPermissionRole }),
          'cap',
          expect.any(Object)
        );
      }
    );

    it('req.can denies oversized capability before PermissionService.can invocation', async () => {
      mockReq.headers!['authorization'] = 'Bearer perm-oversized';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'u-oversized', role: 'admin' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      vi.clearAllMocks();
      expect(mockReq.can?.(`e${'x'.repeat(200)}`)).toBe(false);
      expect(mockPermissionService.can).not.toHaveBeenCalled();
    });

    it('req.can denies control-char capability before PermissionService.can invocation', async () => {
      mockReq.headers!['authorization'] = 'Bearer perm-control-char';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'u-control-char', role: 'admin' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      vi.clearAllMocks();
      expect(mockReq.can?.('edit\u0000project')).toBe(false);
      expect(mockPermissionService.can).not.toHaveBeenCalled();
    });

    it('should not overwrite existing req.user in test bypass mode', async () => {
      process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
      mockReq.user = { id: 'already', role: 'administrator' } as any;

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe('already');
      expect(mockNext).toHaveBeenCalled();
    });

    it('test bypass continues when req.user accessor throws and still attaches default test user', async () => {
      process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
      Object.defineProperty(mockReq, 'user', {
        configurable: true,
        get() {
          throw new Error('user getter failed');
        },
        set(value) {
          Object.defineProperty(this, 'user', {
            configurable: true,
            enumerable: true,
            writable: true,
            value,
          });
        },
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe('test-user-id');
      expect(mockReq.organizationId).toBe('test-org-id');
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalledWith(401);
    });

    it('test bypass fails closed when req.user assignment throws', async () => {
      process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
      Object.defineProperty(mockReq, 'user', {
        configurable: true,
        get() {
          return undefined;
        },
        set() {
          throw new Error('user setter failed');
        },
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('E2E_MODE is disabled in production (does not bypass verification)', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origE2E = process.env.E2E_MODE;
      try {
        process.env.NODE_ENV = 'production';
        process.env.E2E_MODE = 'true';

        vi.resetModules();
        const prodJwt = {
          verify: vi.fn((_t: any, _s: any, cb: any) => cb(new Error('bad'), null)),
          decode: vi.fn().mockReturnValue({ e2e: true, id: 'e2e-user' }),
        };

        const mod =
          await import('../../../../server/src/middleware/auth.middleware.ts?prod_e2e_no_bypass=1');
        mod.setDependencies({
          jwt: prodJwt as any,
          config: mockConfig,
          PermissionService: mockPermissionService,
          dbGet: mockDbGet,
        });

        const req: any = { ...mockReq, headers: { authorization: 'Bearer prod' } };
        const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
        const next = vi.fn();

        await mod.verifyToken(req, res, next);

        expect(prodJwt.decode).not.toHaveBeenCalled(); // E2E bypass never executes
        expect(prodJwt.verify).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = origNodeEnv;
        if (origE2E === undefined) delete process.env.E2E_MODE;
        else process.env.E2E_MODE = origE2E;
      }
    });

    it('production mode ignores query token fallback when authorization and cookies are missing', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        vi.resetModules();
        const mod =
          await import('../../../../server/src/middleware/auth.middleware.ts?prod_query_token_disabled=1');
        mod.setDependencies({
          jwt: mockJwt as any,
          config: mockConfig,
          PermissionService: mockPermissionService,
          dbGet: mockDbGet,
        });

        const req: any = {
          headers: {},
          cookies: {},
          body: {},
          query: { token: 'query-token' },
          path: '/test',
        };
        const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
        const next = vi.fn();

        await mod.verifyToken(req, res, next);

        expect(mockJwt.verify).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
        expect(next).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = origNodeEnv;
      }
    });

    it('production mode ignores body token fallback when authorization and cookies are missing', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        vi.resetModules();
        const mod =
          await import('../../../../server/src/middleware/auth.middleware.ts?prod_body_token_disabled=1');
        mod.setDependencies({
          jwt: mockJwt as any,
          config: mockConfig,
          PermissionService: mockPermissionService,
          dbGet: mockDbGet,
        });

        const req: any = {
          headers: {},
          cookies: {},
          body: { token: 'body-token' },
          query: {},
          path: '/test',
        };
        const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
        const next = vi.fn();

        await mod.verifyToken(req, res, next);

        expect(mockJwt.verify).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
        expect(next).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = origNodeEnv;
      }
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

    it('treats non-boolean isSuperAdmin claim as false', async () => {
      mockReq.headers!['authorization'] = 'Bearer superadmin-string';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, {
          id: 'user-superadmin-string',
          role: 'ADMIN',
          isSuperAdmin: 'true' as any,
        });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.isSuperAdmin).toBe(false);
      expect(mockNext).toHaveBeenCalled();
    });

    it('uses raw role value when role is unknown and normalizes permission role', async () => {
      mockReq.headers!['authorization'] = 'Bearer custom-role';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'custom-1', role: 'custom_role' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.role).toBe('custom_role');
      mockReq.can?.('cap');
      expect(mockPermissionService.can).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'CUSTOM_ROLE' }),
        'cap',
        expect.any(Object)
      );
    });

    it('normalizes permission role VIEWER when decoded role is VIEWER', async () => {
      mockReq.headers!['authorization'] = 'Bearer viewer-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'viewer-1', role: 'VIEWER' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      mockReq.can?.('cap');
      expect(mockPermissionService.can).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'VIEWER' }),
        'cap',
        expect.any(Object)
      );
    });

    it('defaults role to team_member when role is missing', async () => {
      mockReq.headers!['authorization'] = 'Bearer no-role';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-no-role' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.role).toBe('team_member');
    });

    it('fails closed to team_member when decoded role claim is non-string', async () => {
      mockReq.headers!['authorization'] = 'Bearer role-object';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-role-object', role: { admin: true } as any });
      });
      mockDbGet.mockResolvedValue(null);
      mockPermissionService.can.mockReturnValue(false);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.role).toBe('team_member');
      expect(mockReq.can).toBeTypeOf('function');
      expect(mockReq.can?.('any_capability')).toBe(false);
      expect(mockPermissionService.can).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'TEAM_MEMBER' }),
        'any_capability',
        expect.any(Object)
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('normalizes permission role PROJECT_MANAGER when decoded role is PROJECT_MANAGER', async () => {
      mockReq.headers!['authorization'] = 'Bearer pm-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'pm-1', role: 'PROJECT_MANAGER' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      mockReq.can?.('cap');
      expect(mockPermissionService.can).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'PROJECT_MANAGER' }),
        'cap',
        expect.any(Object)
      );
    });

    it('uses decoded userRole when decoded role is whitespace for permission normalization', async () => {
      mockReq.headers!['authorization'] = 'Bearer whitespace-role-userRole';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-role-fallback', role: '   ', userRole: 'ADMIN' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      mockReq.can?.('cap');
      expect(mockPermissionService.can).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'ADMIN' }),
        'cap',
        expect.any(Object)
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip revocation DB check when decoded token has no jti', async () => {
      mockReq.headers!['authorization'] = 'Bearer no-jti-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-no-jti' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      // The middleware may issue org-membership fallback queries but must NOT issue
      // a revocation-specific query (revoked_tokens table) when jti is absent.
      const revocationCalls = mockDbGet.mock.calls.filter((args) =>
        String(args[0]).includes('revoked_tokens')
      );
      expect(revocationCalls).toHaveLength(0);
      expect(mockReq.user?.id).toBe('user-no-jti');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip revocation DB check when decoded token jti is whitespace-only', async () => {
      mockReq.headers!['authorization'] = 'Bearer whitespace-jti-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-whitespace-jti', jti: '   ' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      // The middleware may issue org-membership fallback queries but must NOT issue
      // a revocation-specific query (revoked_tokens table) when jti is blank/whitespace.
      const revocationCalls = mockDbGet.mock.calls.filter((args) =>
        String(args[0]).includes('revoked_tokens')
      );
      expect(revocationCalls).toHaveLength(0);
      expect(mockReq.user?.id).toBe('user-whitespace-jti');
      expect(mockNext).toHaveBeenCalled();
    });

    it('rejects tokens with oversized jti before revocation DB lookup', async () => {
      const longJti = 'j'.repeat(257);
      mockReq.headers!['authorization'] = 'Bearer oversized-jti';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-oversized-jti', jti: longJti, iat: 1 });
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockDbGet).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('rejects jti with control characters before revocation DB lookup', async () => {
      mockReq.headers!['authorization'] = 'Bearer jti-control';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-jti-bad', jti: 'ok\u0000jti', iat: 1 });
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockDbGet).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('rejects jti with disallowed unicode before revocation DB lookup', async () => {
      mockReq.headers!['authorization'] = 'Bearer jti-unicode';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-jti-unicode', jti: 'bad\u2028jti', iat: 1 });
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockDbGet).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('attaches user when jti present but no revoke-all marker exists', async () => {
      mockReq.headers!['authorization'] = 'Bearer ok-jti';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-123', jti: 'jti-ok', iat: 100 });
      });
      mockDbGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe('user-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('handles revoke-all marker with missing timestamp and decoded iat missing (fail open)', async () => {
      mockReq.headers!['authorization'] = 'Bearer revokeall-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-1', jti: 'token-jti' });
      });

      mockDbGet
        .mockResolvedValueOnce(null) // token not revoked
        .mockResolvedValueOnce({ jti: 'revoke-all-' }); // split().pop() === '' -> fallback '0'

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).not.toHaveBeenCalledWith(401);
      expect(mockNext).toHaveBeenCalled();
    });

    it('handles revoke-all marker with non-numeric timestamp as fail-open', async () => {
      mockReq.headers!['authorization'] = 'Bearer revokeall-nonnumeric';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-nonnumeric', jti: 'token-nonnumeric', iat: 100 });
      });

      mockDbGet
        .mockResolvedValueOnce(null) // token not revoked
        .mockResolvedValueOnce({ jti: 'revoke-all-abc' }); // non-numeric suffix

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).not.toHaveBeenCalledWith(401);
      expect(mockReq.user?.id).toBe('user-nonnumeric');
      expect(mockNext).toHaveBeenCalled();
    });

    it('rejects token when revoke-all exists and decoded iat is non-numeric', async () => {
      mockReq.headers!['authorization'] = 'Bearer revokeall-invalid-iat';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-invalid-iat', jti: 'tok-invalid-iat', iat: 'abc' as any });
      });

      mockDbGet
        .mockResolvedValueOnce(null) // token not revoked
        .mockResolvedValueOnce({ jti: 'revoke-all-200000' }); // valid revoke-all timestamp

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'All sessions have been revoked. Please log in again.',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
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

    it('should reject verification when JWT_SECRET is whitespace-only', async () => {
      mockReq.headers!['authorization'] = 'Bearer cfg-whitespace';
      setDependencies({
        jwt: mockJwt as any,
        config: { JWT_SECRET: '   ' },
        PermissionService: mockPermissionService,
        dbGet: mockDbGet,
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject verification when JWT_SECRET is oversized', async () => {
      mockReq.headers!['authorization'] = 'Bearer cfg-oversized';
      setDependencies({
        jwt: mockJwt as any,
        config: { JWT_SECRET: 's'.repeat(4097) },
        PermissionService: mockPermissionService,
        dbGet: mockDbGet,
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
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

    it('should reject oversized token before jwt.verify', async () => {
      mockReq.headers!['authorization'] = `Bearer ${'a'.repeat(8193)}`;

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject oversized raw authorization header before parsing', async () => {
      mockReq.headers!['authorization'] = 'x'.repeat(8257);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject control-character token before jwt.verify', async () => {
      mockReq.headers!['authorization'] = 'Bearer abc\u0000def';

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token with disallowed unicode separator characters before jwt.verify', async () => {
      mockReq.headers!['authorization'] = 'Bearer abc\u2028def';

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token with non-compact JWT shape before jwt.verify', async () => {
      mockReq.headers!['authorization'] = 'Bearer abc.def';

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token with empty JWT segment before jwt.verify', async () => {
      mockReq.headers!['authorization'] = 'Bearer aaa..bbb';

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject verified payload when it is null', async () => {
      mockReq.headers!['authorization'] = 'Bearer a.b.c';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, null as any);
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject verified payload when it is an array', async () => {
      mockReq.headers!['authorization'] = 'Bearer a.b.c';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, ['bad'] as any);
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
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

    it('forces SUPERADMIN role for configured emails', async () => {
      const origForce = process.env.FORCE_SUPERADMIN_EMAILS;
      process.env.FORCE_SUPERADMIN_EMAILS = 'vip@example.com';

      try {
        vi.resetModules();
        const mod =
          await import('../../../../server/src/middleware/auth.middleware.ts?force_superadmin=1');
        mod.setDependencies({
          jwt: mockJwt as any,
          config: mockConfig,
          PermissionService: mockPermissionService,
          dbGet: mockDbGet,
        });

        const req: any = {
          headers: { authorization: 'Bearer vip-token' },
          body: {},
          query: {},
          cookies: {},
          path: '/test',
        };
        const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
        const next = vi.fn();

        mockJwt.verify.mockImplementation((_token, _secret, callback) => {
          callback(null, { id: 'user-1', email: 'VIP@EXAMPLE.COM', role: 'ADMIN' });
        });
        mockDbGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

        await mod.verifyToken(req, res, next);

        expect(req.userRole).toBe('SUPERADMIN');
        expect(req.user?.isSuperAdmin).toBe(true);
        req.can?.('manage_everything');
        expect(mockPermissionService.can).toHaveBeenCalledWith(
          expect.objectContaining({ role: 'SUPERADMIN' }),
          'manage_everything',
          expect.any(Object)
        );
        expect(next).toHaveBeenCalled();
      } finally {
        if (origForce === undefined) delete process.env.FORCE_SUPERADMIN_EMAILS;
        else process.env.FORCE_SUPERADMIN_EMAILS = origForce;
      }
    });

    it('forces SUPERADMIN for configured emails even when decoded payload is frozen', async () => {
      const origForce = process.env.FORCE_SUPERADMIN_EMAILS;
      process.env.FORCE_SUPERADMIN_EMAILS = 'vip-frozen@example.com';

      try {
        vi.resetModules();
        const mod =
          await import('../../../../server/src/middleware/auth.middleware.ts?force_superadmin_frozen=1');
        mod.setDependencies({
          jwt: mockJwt as any,
          config: mockConfig,
          PermissionService: mockPermissionService,
          dbGet: mockDbGet,
        });

        const req: any = {
          headers: { authorization: 'Bearer vip-frozen-token' },
          body: {},
          query: {},
          cookies: {},
          path: '/test',
        };
        const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
        const next = vi.fn();

        mockJwt.verify.mockImplementation((_token, _secret, callback) => {
          callback(
            null,
            Object.freeze({ id: 'user-frozen', email: 'VIP-FROZEN@EXAMPLE.COM', role: 'ADMIN' })
          );
        });
        mockDbGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

        await mod.verifyToken(req, res, next);

        expect(req.userRole).toBe('SUPERADMIN');
        expect(req.user?.isSuperAdmin).toBe(true);
        expect(next).toHaveBeenCalled();
      } finally {
        if (origForce === undefined) delete process.env.FORCE_SUPERADMIN_EMAILS;
        else process.env.FORCE_SUPERADMIN_EMAILS = origForce;
      }
    });

    it('E2E_MODE: accepts decoded token with e2e claim without signature verification', async () => {
      const origE2E = process.env.E2E_MODE;
      try {
        process.env.E2E_MODE = 'true';

        vi.resetModules();
        const e2eJwt = {
          verify: vi.fn(),
          decode: vi.fn().mockReturnValue({
            e2e: true,
            id: 'e2e-user-1',
            organizationId: 'e2e-org-1',
            role: 'ADMIN',
            email: 'e2e@local.test',
            name: 'E2E User',
          }),
        };

        // Prevent runtime DB writes in the E2E seed block.
        const mockRun = vi.fn().mockResolvedValue(undefined);
        vi.doMock('../../../../server/src/utils/DbPromise.js', async () => {
          const actual: any = await vi.importActual('../../../../server/src/utils/DbPromise.js');
          return { ...actual, run: mockRun };
        });

        const mod =
          await import('../../../../server/src/middleware/auth.middleware.ts?e2e_mode_bypass=1');
        mod.setDependencies({
          jwt: e2eJwt as any,
          config: mockConfig,
          PermissionService: mockPermissionService,
          dbGet: mockDbGet,
        });

        const req: any = {
          headers: { authorization: 'Bearer any-e2e-token' },
          body: {},
          query: {},
          cookies: {},
          path: '/test',
        };
        const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
        const next = vi.fn();

        await mod.verifyToken(req, res, next);

        expect(e2eJwt.verify).not.toHaveBeenCalled();
        expect(e2eJwt.decode).toHaveBeenCalled();
        expect(mockRun).toHaveBeenCalled(); // best-effort seed
        expect(req.user?.id).toBe('e2e-user-1');
        expect(req.organizationId).toBe('e2e-org-1');
        expect(next).toHaveBeenCalled();
      } finally {
        if (origE2E === undefined) delete process.env.E2E_MODE;
        else process.env.E2E_MODE = origE2E;
        vi.doUnmock('../../../../server/src/utils/DbPromise.js');
      }
    });

    it('E2E_MODE: normalizes whitespace org id and role before bypass attach', async () => {
      const origE2E = process.env.E2E_MODE;
      try {
        process.env.E2E_MODE = 'true';

        vi.resetModules();
        const e2eJwt = {
          verify: vi.fn(),
          decode: vi.fn().mockReturnValue({
            e2e: true,
            id: 'e2e-user-2',
            organizationId: '   ',
            role: '  admin  ',
            email: 'e2e2@local.test',
          }),
        };

        const mockRun = vi.fn().mockResolvedValue(undefined);
        vi.doMock('../../../../server/src/utils/DbPromise.js', async () => {
          const actual: any = await vi.importActual('../../../../server/src/utils/DbPromise.js');
          return { ...actual, run: mockRun };
        });

        const mod =
          await import('../../../../server/src/middleware/auth.middleware.ts?e2e_mode_bypass_normalize=1');
        mod.setDependencies({
          jwt: e2eJwt as any,
          config: mockConfig,
          PermissionService: mockPermissionService,
          dbGet: mockDbGet,
        });

        const req: any = {
          headers: { authorization: 'Bearer any-e2e-token-2' },
          body: {},
          query: {},
          cookies: {},
          path: '/test',
        };
        const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
        const next = vi.fn();

        await mod.verifyToken(req, res, next);

        expect(e2eJwt.verify).not.toHaveBeenCalled();
        expect(req.organizationId).toBe('e2e-org-id');
        expect(req.user?.organizationId).toBe('e2e-org-id');
        expect(req.user?.role).toBe('administrator');
        expect(next).toHaveBeenCalled();
      } finally {
        if (origE2E === undefined) delete process.env.E2E_MODE;
        else process.env.E2E_MODE = origE2E;
        vi.doUnmock('../../../../server/src/utils/DbPromise.js');
      }
    });

    it('E2E_MODE: accepts frozen decoded payload by cloning before normalization', async () => {
      const origE2E = process.env.E2E_MODE;
      try {
        process.env.E2E_MODE = 'true';

        vi.resetModules();
        const e2eJwt = {
          verify: vi.fn(),
          decode: vi.fn().mockReturnValue(
            Object.freeze({
              e2e: true,
              id: '  e2e-user-frozen  ',
              organizationId: 'org-frozen-e2e',
              role: 'ADMIN',
              email: 'e2e-frozen@local.test',
            })
          ),
        };

        const mockRun = vi.fn().mockResolvedValue(undefined);
        vi.doMock('../../../../server/src/utils/DbPromise.js', async () => {
          const actual: any = await vi.importActual('../../../../server/src/utils/DbPromise.js');
          return { ...actual, run: mockRun };
        });

        const mod =
          await import('../../../../server/src/middleware/auth.middleware.ts?e2e_mode_bypass_frozen_payload=1');
        mod.setDependencies({
          jwt: e2eJwt as any,
          config: mockConfig,
          PermissionService: mockPermissionService,
          dbGet: mockDbGet,
        });

        const req: any = {
          headers: { authorization: 'Bearer any-e2e-token-frozen' },
          body: {},
          query: {},
          cookies: {},
          path: '/test',
        };
        const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
        const next = vi.fn();

        await mod.verifyToken(req, res, next);

        expect(e2eJwt.verify).not.toHaveBeenCalled();
        expect(req.user?.id).toBe('e2e-user-frozen');
        expect(req.organizationId).toBe('org-frozen-e2e');
        expect(next).toHaveBeenCalled();
      } finally {
        if (origE2E === undefined) delete process.env.E2E_MODE;
        else process.env.E2E_MODE = origE2E;
        vi.doUnmock('../../../../server/src/utils/DbPromise.js');
      }
    });

    it('E2E_MODE: falls through to verification when decoded token lacks e2e claim', async () => {
      const origE2E = process.env.E2E_MODE;
      try {
        process.env.E2E_MODE = 'true';
        mockReq.headers!['authorization'] = 'Bearer no-e2e-claim';

        mockJwt.decode.mockReturnValue({ id: 'not-e2e' });
        mockJwt.verify.mockImplementation((_token, _secret, callback) => {
          callback(null, { id: 'verified-user' });
        });
        mockDbGet.mockResolvedValue(null);

        await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

        expect(mockJwt.decode).toHaveBeenCalled();
        expect(mockJwt.verify).toHaveBeenCalled();
        expect(mockReq.user?.id).toBe('verified-user');
      } finally {
        if (origE2E === undefined) delete process.env.E2E_MODE;
        else process.env.E2E_MODE = origE2E;
      }
    });

    it('E2E_MODE: falls through to verification when decoded e2e token id is whitespace-only', async () => {
      const origE2E = process.env.E2E_MODE;
      try {
        process.env.E2E_MODE = 'true';
        mockReq.headers!['authorization'] = 'Bearer invalid-e2e-id';

        mockJwt.decode.mockReturnValue({ e2e: true, id: '   ' });
        mockJwt.verify.mockImplementation((_token, _secret, callback) => {
          callback(null, { id: 'verified-after-e2e-fallback' });
        });
        mockDbGet.mockResolvedValue(null);

        await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

        expect(mockJwt.decode).toHaveBeenCalled();
        expect(mockJwt.verify).toHaveBeenCalled();
        expect(mockReq.user?.id).toBe('verified-after-e2e-fallback');
      } finally {
        if (origE2E === undefined) delete process.env.E2E_MODE;
        else process.env.E2E_MODE = origE2E;
      }
    });

    it('E2E_MODE: falls through to verification when decoded e2e id getter throws', async () => {
      const origE2E = process.env.E2E_MODE;
      try {
        process.env.E2E_MODE = 'true';
        mockReq.headers!['authorization'] = 'Bearer e2e-throwing-id';

        const decodedWithThrowingId: Record<string, unknown> = { e2e: true };
        Object.defineProperty(decodedWithThrowingId, 'id', {
          enumerable: true,
          get: () => {
            throw new Error('id getter failed');
          },
        });
        mockJwt.decode.mockReturnValue(decodedWithThrowingId);
        mockJwt.verify.mockImplementation((_token, _secret, callback) => {
          callback(null, { id: 'verified-after-throwing-e2e-id' });
        });
        mockDbGet.mockResolvedValue(null);

        await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

        expect(mockJwt.decode).toHaveBeenCalled();
        expect(mockJwt.verify).toHaveBeenCalled();
        expect(mockReq.user?.id).toBe('verified-after-throwing-e2e-id');
      } finally {
        if (origE2E === undefined) delete process.env.E2E_MODE;
        else process.env.E2E_MODE = origE2E;
      }
    });

    it('should reject token issued before revoke-all marker (jti-based)', async () => {
      mockReq.headers!['authorization'] = 'Bearer revoke-all-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        // iat in seconds -> tokenIssuedAt = 100_000ms
        callback(null, { id: 'user-revoke-before', jti: 'tok-1', iat: 100 });
      });
      mockDbGet.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT jti FROM revoked_tokens WHERE jti = ?')) return null;
        if (sql.includes("reason = 'revoke-all'")) return { jti: 'revoke-all-200000' };
        return null;
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('revoked') })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow token issued after revoke-all marker', async () => {
      mockReq.headers!['authorization'] = 'Bearer revoke-all-ok';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        // iat in seconds -> tokenIssuedAt = 300_000ms
        callback(null, { id: 'user-revoke-after', jti: 'tok-2', iat: 300 });
      });
      mockDbGet.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT jti FROM revoked_tokens WHERE jti = ?')) return null;
        if (sql.includes("reason = 'revoke-all'")) return { jti: 'revoke-all-200000' };
        return null;
      });

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe('user-revoke-after');
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues when revocation DB lookup fails (does not block user)', async () => {
      mockReq.headers!['authorization'] = 'Bearer db-fail';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-123', jti: 'tok-3' });
      });
      mockDbGet.mockRejectedValueOnce(new Error('db down'));

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe('user-123');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('isAuthenticated', () => {
    it('should call next if user is attached', () => {
      mockReq.user = { id: 'user-1' } as any;
      isAuthenticated(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next when req.userId exists even if req.user is missing', () => {
      mockReq.userId = 'user-from-top-level';
      delete mockReq.user;

      isAuthenticated(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalledWith(401);
    });

    it('should return 401 if attached user id is whitespace-only', () => {
      mockReq.user = { id: '   ' } as any;
      isAuthenticated(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not attached', () => {
      isAuthenticated(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 when user id accessor throws', () => {
      const user: any = {};
      Object.defineProperty(user, 'id', {
        enumerable: true,
        get() {
          throw new Error('id getter failed');
        },
      });
      mockReq.user = user;

      isAuthenticated(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
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

    it('should continue without verification for oversized token', async () => {
      mockReq.headers!['authorization'] = `Bearer ${'a'.repeat(8193)}`;

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without verification for oversized raw authorization header', async () => {
      mockReq.headers!['authorization'] = 'x'.repeat(8257);

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without verification for control-character token in optionalAuth', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt\u0000token';

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without verification for disallowed unicode token in optionalAuth', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt\u2029token';

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without verification for non-compact JWT token shape in optionalAuth', async () => {
      mockReq.headers!['authorization'] = 'Bearer abc.def';

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without user when optionalAuth verified payload is null', async () => {
      mockReq.headers!['authorization'] = 'Bearer a.b.c';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, null as any);
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without user when JWT_SECRET is missing', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt';
      setDependencies({
        jwt: mockJwt as any,
        config: {},
        PermissionService: mockPermissionService,
        dbGet: mockDbGet,
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without user when optionalAuth JWT_SECRET is whitespace-only', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt-ws-secret';
      setDependencies({
        jwt: mockJwt as any,
        config: { JWT_SECRET: '   ' },
        PermissionService: mockPermissionService,
        dbGet: mockDbGet,
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without user when optionalAuth JWT_SECRET is oversized', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt-oversized-secret';
      setDependencies({
        jwt: mockJwt as any,
        config: { JWT_SECRET: 's'.repeat(4097) },
        PermissionService: mockPermissionService,
        dbGet: mockDbGet,
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without user when jwt.verify throws synchronously', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt-sync-throw';
      mockJwt.verify.mockImplementation(() => {
        throw new Error('sync verify failure');
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without user when decoded payload id is missing', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt-missing-id';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { role: 'ADMIN' });
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without user when decoded payload id exceeds max user-id length', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt-oversized-id';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'u'.repeat(257), role: 'ADMIN' });
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('normalizes decoded payload id before attaching optional auth user', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt-trim-id';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: '  user-optional  ', role: 'ADMIN' });
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.userId).toBe('user-optional');
      expect(mockReq.user?.id).toBe('user-optional');
      expect(mockNext).toHaveBeenCalled();
    });

    it('accepts frozen decoded payload in optionalAuth by cloning before normalization', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt-frozen-id';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, Object.freeze({ id: '  user-optional-frozen  ', role: 'ADMIN' }));
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.userId).toBe('user-optional-frozen');
      expect(mockReq.user?.id).toBe('user-optional-frozen');
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without user when decoded payload id getter throws', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt-id-getter-throws';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        const payload: any = {};
        Object.defineProperty(payload, 'id', {
          enumerable: true,
          get() {
            throw new Error('id accessor failed');
          },
        });
        callback(null, payload);
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('continues without user when optional auth hydration fails', async () => {
      mockReq.headers!['authorization'] = 'Bearer opt-broken';
      Object.defineProperty(mockReq, 'user', {
        configurable: true,
        set() {
          throw new Error('user assignment failed');
        },
      });
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-optional' });
      });

      await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should return 401 when user is missing', () => {
      const middleware = requireRole('administrator');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

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

    it('should allow access when required role contains surrounding whitespace', () => {
      mockReq.user = { role: 'administrator' } as any;
      const middleware = requireRole('  administrator  ');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow access when role match differs only by casing', () => {
      mockReq.user = { role: 'administrator' } as any;
      const middleware = requireRole('ADMINISTRATOR');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail closed when attached roles are non-string values', () => {
      mockReq.user = { role: { admin: true } as any } as any;
      mockReq.userRole = { admin: true } as any;
      const middleware = requireRole('administrator');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should fail closed when required role list normalizes to empty', () => {
      mockReq.user = { role: 'administrator' } as any;
      const middleware = requireRole('   ');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not grant superadmin role when isSuperAdmin is truthy but not boolean true', () => {
      mockReq.user = { role: 'team_member', isSuperAdmin: 'true' as any } as any;
      const middleware = requireRole('superadmin');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should fail closed when user role accessor throws', () => {
      const user: any = {};
      Object.defineProperty(user, 'role', {
        enumerable: true,
        get() {
          throw new Error('role getter failed');
        },
      });
      mockReq.user = user;
      const middleware = requireRole('administrator');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should fail closed when isSuperAdmin accessor throws in role check', () => {
      const user: any = { role: 'administrator' };
      Object.defineProperty(user, 'isSuperAdmin', {
        enumerable: true,
        get() {
          throw new Error('superadmin getter failed');
        },
      });
      mockReq.user = user;
      const middleware = requireRole('administrator');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireSuperAdmin', () => {
    it('should return 401 when user is missing', () => {
      requireSuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

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

    it('should deny if isSuperAdmin is truthy but not boolean true', () => {
      mockReq.user = { isSuperAdmin: 'true' as any } as any;
      requireSuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny if isSuperAdmin accessor throws', () => {
      const user: any = {};
      Object.defineProperty(user, 'isSuperAdmin', {
        enumerable: true,
        get() {
          throw new Error('superadmin getter failed');
        },
      });
      mockReq.user = user;

      requireSuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Super admin access required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireOrganization', () => {
    it('should allow if organizationId is present', () => {
      mockReq.organizationId = 'org-1';
      requireOrganization(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should normalize organizationId before passing control', () => {
      mockReq.organizationId = '  org-1  ';
      requireOrganization(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockReq.organizationId).toBe('org-1');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny if organizationId is missing', () => {
      requireOrganization(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should deny if organizationId is whitespace-only', () => {
      mockReq.organizationId = '   ';
      requireOrganization(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny if organizationId accessor throws', () => {
      Object.defineProperty(mockReq, 'organizationId', {
        configurable: true,
        enumerable: true,
        get() {
          throw new Error('organizationId getter failed');
        },
      });

      requireOrganization(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Organization context required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny if organizationId setter throws while normalizing', () => {
      const reqWithThrowingSetter: Partial<AuthRequest> = {
        ...mockReq,
        organizationId: '  org-1  ',
      };
      Object.defineProperty(reqWithThrowingSetter, 'organizationId', {
        configurable: true,
        enumerable: true,
        get() {
          return '  org-1  ';
        },
        set() {
          throw new Error('organizationId setter failed');
        },
      });

      requireOrganization(reqWithThrowingSetter as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Organization context required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requirePermission', () => {
    it('should return 401 when user is missing', () => {
      const middleware = requirePermission('edit_project');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny when req.can is missing (no permission helper attached)', () => {
      mockReq.user = { id: 'u1' } as any;
      delete (mockReq as any).can;

      const middleware = requirePermission('edit_project');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Permission denied', required: 'edit_project' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny when required capability is empty after normalization', () => {
      mockReq.user = { id: 'u1' } as any;
      mockReq.can = vi.fn().mockReturnValue(true);

      const middleware = requirePermission('   ');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Permission denied', required: '' })
      );
      expect(mockReq.can).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

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

    it('should deny if req.can returns truthy non-boolean value', () => {
      mockReq.user = { id: 'u1' } as any;
      mockReq.can = vi.fn().mockReturnValue('yes' as any);

      const middleware = requirePermission('edit_project');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Permission denied', required: 'edit_project' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny safely when req.can throws', () => {
      mockReq.user = { id: 'u1' } as any;
      mockReq.can = vi.fn(() => {
        throw new Error('permission evaluator crashed');
      });

      const middleware = requirePermission('edit_project');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Permission denied', required: 'edit_project' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny without calling req.can when capability exceeds max length', () => {
      mockReq.user = { id: 'u1' } as any;
      mockReq.can = vi.fn().mockReturnValue(true);

      const middleware = requirePermission(`e${'x'.repeat(200)}`);
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Permission denied', code: 'INVALID_CAPABILITY' })
      );
      expect(mockReq.can).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny without calling req.can when capability contains control chars', () => {
      mockReq.user = { id: 'u1' } as any;
      mockReq.can = vi.fn().mockReturnValue(true);

      const middleware = requirePermission('edit\u0000project');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Permission denied', code: 'INVALID_CAPABILITY' })
      );
      expect(mockReq.can).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateOrgMembership helpers', () => {
    it('normalizes membership status case-insensitively', () => {
      expect(__private__.normalizeMembershipStatus('ACTIVE')).toBe('ACTIVE');
      expect(__private__.normalizeMembershipStatus('active')).toBe('ACTIVE');
      expect(__private__.normalizeMembershipStatus(' Active ')).toBe('ACTIVE');
      expect(__private__.normalizeMembershipStatus(undefined)).toBe('');
    });

    it('builds deterministic collision-safe membership cache keys', () => {
      const keyA = __private__.buildMembershipCacheKey('u:1', 'org:2');
      const keyB = __private__.buildMembershipCacheKey('u', '1:org:2');
      const keyC = __private__.buildMembershipCacheKey('u:1', 'org:2');

      expect(keyA).toBe(keyC);
      expect(keyA).not.toBe(keyB);
    });

    it('normalizes context identifiers for membership checks', () => {
      expect(__private__.normalizeContextIdentifier(' user-1 ')).toBe('user-1');
      expect(__private__.normalizeContextIdentifier('   ')).toBe('');
      expect(__private__.normalizeContextIdentifier(undefined)).toBe('');
    });

    it('builds portable session activity update SQL using CURRENT_TIMESTAMP', () => {
      expect(__private__.buildSessionActivityUpdateSql('last_activity_at')).toContain(
        'CURRENT_TIMESTAMP'
      );
      expect(__private__.buildSessionActivityUpdateSql('last_active_at')).toContain(
        'CURRENT_TIMESTAMP'
      );
      expect(__private__.buildSessionActivityUpdateSql('last_activity_at')).not.toContain('NOW()');
      expect(__private__.buildSessionActivityUpdateSql('last_active_at')).not.toContain('NOW()');
    });

    it('builds portable revoke-all lookup SQL using CURRENT_TIMESTAMP', () => {
      const sql = __private__.buildRevokeAllLookupSql();
      expect(sql).toContain('CURRENT_TIMESTAMP');
      expect(sql).not.toContain('NOW()');
      expect(sql).toContain("reason = 'revoke-all'");
    });

    it('extracts issued-at seconds safely from payload', () => {
      expect(__private__.extractIssuedAtSeconds({ id: 'u1', iat: 123 })).toBe(123);
      expect(__private__.extractIssuedAtSeconds({ id: 'u1', iat: Number.NaN as any })).toBe(0);
      expect(__private__.extractIssuedAtSeconds({ id: 'u1', iat: '123' as any })).toBe(0);

      const payloadWithThrowingIat: any = { id: 'u1' };
      Object.defineProperty(payloadWithThrowingIat, 'iat', {
        enumerable: true,
        get() {
          throw new Error('iat getter failed');
        },
      });
      expect(__private__.extractIssuedAtSeconds(payloadWithThrowingIat)).toBe(0);
    });

    it('parses revoke-all timestamp only from numeric marker suffix', () => {
      expect(__private__.parseRevokeAllTimestamp('revoke-all-200000')).toBe(200000);
      expect(__private__.parseRevokeAllTimestamp('revoke-all-abc')).toBeNull();
      expect(__private__.parseRevokeAllTimestamp('revoke-all-')).toBeNull();
      expect(__private__.parseRevokeAllTimestamp('   ')).toBeNull();
      expect(__private__.parseRevokeAllTimestamp(undefined)).toBeNull();
    });

    it('reads optional string claim safely from payload', () => {
      const payload: Record<string, unknown> = {
        email: '  user@example.com  ',
      };
      expect(__private__.readOptionalStringClaim(payload, 'email')).toBe('user@example.com');
      expect(__private__.readOptionalStringClaim(payload, 'missing')).toBeUndefined();

      const payloadWithThrowingGetter: any = {};
      Object.defineProperty(payloadWithThrowingGetter, 'email', {
        enumerable: true,
        get() {
          throw new Error('email getter failed');
        },
      });
      expect(
        __private__.readOptionalStringClaim(payloadWithThrowingGetter, 'email')
      ).toBeUndefined();
    });

    it('reads strict boolean true claim safely from payload', () => {
      expect(__private__.readBooleanTrueClaim({ isSuperAdmin: true } as any, 'isSuperAdmin')).toBe(
        true
      );
      expect(
        __private__.readBooleanTrueClaim({ isSuperAdmin: 'true' } as any, 'isSuperAdmin')
      ).toBe(false);
      expect(__private__.readBooleanTrueClaim(undefined as any, 'isSuperAdmin')).toBe(false);

      const payloadWithThrowingGetter: any = {};
      Object.defineProperty(payloadWithThrowingGetter, 'isSuperAdmin', {
        enumerable: true,
        get() {
          throw new Error('isSuperAdmin getter failed');
        },
      });
      expect(__private__.readBooleanTrueClaim(payloadWithThrowingGetter, 'isSuperAdmin')).toBe(
        false
      );
    });

    it('does not bypass membership validation for truthy non-boolean superadmin flag', async () => {
      mockReq.user = { id: 'user-1', isSuperAdmin: 'true' as any } as any;
      mockReq.userId = 'user-1';
      mockReq.organizationId = 'org-1';
      mockDbGet.mockResolvedValue(undefined);

      await validateOrgMembership(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('FROM organization_members'), [
        'user-1',
        'org-1',
      ]);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ORG_MEMBERSHIP_REVOKED' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('does not bypass membership validation when isSuperAdmin accessor throws', async () => {
      const user: any = { id: 'user-1' };
      Object.defineProperty(user, 'isSuperAdmin', {
        enumerable: true,
        get() {
          throw new Error('superadmin getter failed');
        },
      });
      mockReq.user = user;
      mockReq.userId = 'user-1';
      mockReq.organizationId = 'org-1';
      mockDbGet.mockResolvedValue(undefined);

      await validateOrgMembership(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('FROM organization_members'), [
        'user-1',
        'org-1',
      ]);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ORG_MEMBERSHIP_REVOKED' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('refuses when membership context accessor throws', async () => {
      mockReq.user = { id: 'user-1', isSuperAdmin: false } as any;
      mockReq.userId = 'user-1';
      Object.defineProperty(mockReq, 'organizationId', {
        configurable: true,
        enumerable: true,
        get() {
          throw new Error('organizationId getter failed');
        },
      });

      await validateOrgMembership(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockDbGet).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ORG_CONTEXT_REQUIRED' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('refuses when req.organizationId getter throws during normalization', async () => {
      mockReq.user = { id: 'user-1', organizationId: 'org-fallback', isSuperAdmin: false } as any;
      mockReq.userId = 'user-1';
      Object.defineProperty(mockReq, 'organizationId', {
        configurable: true,
        enumerable: true,
        get() {
          throw new Error('organizationId getter failed');
        },
      });
      mockDbGet.mockResolvedValue({ status: 'ACTIVE' });

      await validateOrgMembership(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockDbGet).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ORG_CONTEXT_REQUIRED' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('logs and refuses when membership DB lookup fails', async () => {
      mockReq.user = { id: 'user-1', isSuperAdmin: false } as any;
      mockReq.userId = 'user-1';
      mockReq.organizationId = 'org-lookup';
      mockDbGet.mockRejectedValueOnce(new Error('db unavailable'));
      const warnSpy = vi.spyOn(logger, 'warn');

      await validateOrgMembership(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE' })
      );
      expect(warnSpy).toHaveBeenCalledWith(
        '[AuthMiddleware] org membership check failed; refusing request',
        expect.objectContaining({
          code: 'ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE',
          path: '/test',
          reason: 'db unavailable',
        })
      );
    });

    it('falls back to req.user.id when req.userId accessor throws', async () => {
      const user: any = { id: 'user-fallback', isSuperAdmin: false };
      mockReq.user = user;
      Object.defineProperty(mockReq, 'userId', {
        configurable: true,
        enumerable: true,
        get() {
          throw new Error('userId getter failed');
        },
      });
      mockReq.organizationId = 'org-1';
      mockDbGet.mockResolvedValue({ status: 'ACTIVE' });

      await validateOrgMembership(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('FROM organization_members'), [
        'user-fallback',
        'org-1',
      ]);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('refuses when assigning normalized organizationId throws', async () => {
      const reqWithThrowingSetter: Partial<AuthRequest> = {
        ...mockReq,
        user: { id: 'user-1', isSuperAdmin: false } as any,
        userId: 'user-1',
      };
      let currentOrgId = 'org-1';
      Object.defineProperty(reqWithThrowingSetter, 'organizationId', {
        configurable: true,
        enumerable: true,
        get() {
          return currentOrgId;
        },
        set() {
          throw new Error('organizationId setter failed');
        },
      });

      await validateOrgMembership(
        reqWithThrowingSetter as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockDbGet).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ORG_CONTEXT_REQUIRED' })
      );
      expect(mockNext).not.toHaveBeenCalled();
      currentOrgId = 'org-1'; // keep getter backing value explicit for readability
    });
  });

  describe('getDeps', () => {
    it('uses module export when jsonwebtoken lacks default', async () => {
      vi.resetModules();
      vi.doMock('jsonwebtoken', () => ({ default: undefined, verify: vi.fn(), decode: vi.fn() }));
      vi.doMock('../../../../server/src/config/Config.js', () => ({ config: { JWT_SECRET: 'x' } }));
      vi.doMock('../../../../server/src/services/permissionService.js', () => ({
        default: { can: vi.fn() },
      }));

      const mod =
        await import('../../../../server/src/middleware/auth.middleware.ts?get_deps_no_default=1');
      const deps = await mod.__private__.getDeps();

      expect(deps.jwt.verify).toBeTypeOf('function');
      expect(deps.config.JWT_SECRET).toBe('x');
      expect(deps.PermissionService.can).toBeTypeOf('function');

      vi.doUnmock('jsonwebtoken');
      vi.doUnmock('../../../../server/src/config/Config.js');
      vi.doUnmock('../../../../server/src/services/permissionService.js');
    });

    it('uses default export when config module exposes default', async () => {
      vi.resetModules();
      vi.doMock('jsonwebtoken', () => ({ default: { verify: vi.fn(), decode: vi.fn() } }));
      vi.doMock('../../../../server/src/config/Config.js', () => ({
        config: undefined,
        default: { JWT_SECRET: 'y' },
      }));
      vi.doMock('../../../../server/src/services/permissionService.js', () => ({
        default: { can: vi.fn() },
      }));

      const mod =
        await import('../../../../server/src/middleware/auth.middleware.ts?get_deps_default_config=1');
      const deps = await mod.__private__.getDeps();

      expect(deps.config.JWT_SECRET).toBe('y');
      expect(deps.PermissionService.can).toBeTypeOf('function');

      vi.doUnmock('jsonwebtoken');
      vi.doUnmock('../../../../server/src/config/Config.js');
      vi.doUnmock('../../../../server/src/services/permissionService.js');
    });
  });
});

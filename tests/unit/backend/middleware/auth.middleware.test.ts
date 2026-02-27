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

    it('should ignore empty cookie token and fall back to body token', async () => {
      mockReq.cookies!['access_token'] = '';
      mockReq.body = { token: 'body-token' } as any;
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-body-fallback' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith('body-token', 'test-secret', expect.any(Function));
      expect(mockReq.user?.id).toBe('user-body-fallback');
      expect(mockNext).toHaveBeenCalled();
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

    it('should not overwrite existing req.user in test bypass mode', async () => {
      process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
      mockReq.user = { id: 'already', role: 'administrator' } as any;

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe('already');
      expect(mockNext).toHaveBeenCalled();
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

        const mod = await import(
          '../../../../server/src/middleware/auth.middleware.ts?prod_e2e_no_bypass=1'
        );
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

    it('defaults role to team_member when role is missing', async () => {
      mockReq.headers!['authorization'] = 'Bearer no-role';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        callback(null, { id: 'user-no-role' });
      });
      mockDbGet.mockResolvedValue(null);

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.role).toBe('team_member');
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

    it('forces SUPERADMIN role for configured emails', async () => {
      const origForce = process.env.FORCE_SUPERADMIN_EMAILS;
      process.env.FORCE_SUPERADMIN_EMAILS = 'vip@example.com';

      try {
        vi.resetModules();
        const mod = await import(
          '../../../../server/src/middleware/auth.middleware.ts?force_superadmin=1'
        );
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

        const mod = await import(
          '../../../../server/src/middleware/auth.middleware.ts?e2e_mode_bypass=1'
        );
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

    it('should reject token issued before revoke-all marker (jti-based)', async () => {
      mockReq.headers!['authorization'] = 'Bearer revoke-all-token';
      mockJwt.verify.mockImplementation((_token, _secret, callback) => {
        // iat in seconds -> tokenIssuedAt = 100_000ms
        callback(null, { id: 'user-123', jti: 'tok-1', iat: 100 });
      });
      mockDbGet
        .mockResolvedValueOnce(null) // token not revoked
        .mockResolvedValueOnce({ jti: 'revoke-all-200000' }); // revokeTime=200_000ms

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
        callback(null, { id: 'user-123', jti: 'tok-2', iat: 300 });
      });
      mockDbGet
        .mockResolvedValueOnce(null) // token not revoked
        .mockResolvedValueOnce({ jti: 'revoke-all-200000' }); // revokeTime=200_000ms

      await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user?.id).toBe('user-123');
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

  describe('getDeps', () => {
    it('uses module export when jsonwebtoken lacks default', async () => {
      vi.resetModules();
      vi.doMock('jsonwebtoken', () => ({ default: undefined, verify: vi.fn(), decode: vi.fn() }));
      vi.doMock('../../../../server/src/config/Config.js', () => ({ config: { JWT_SECRET: 'x' } }));
      vi.doMock('../../../../server/src/services/permissionService.js', () => ({
        default: { can: vi.fn() },
      }));

      const mod = await import(
        '../../../../server/src/middleware/auth.middleware.ts?get_deps_no_default=1'
      );
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

      const mod = await import(
        '../../../../server/src/middleware/auth.middleware.ts?get_deps_default_config=1'
      );
      const deps = await mod.__private__.getDeps();

      expect(deps.config.JWT_SECRET).toBe('y');
      expect(deps.PermissionService.can).toBeTypeOf('function');

      vi.doUnmock('jsonwebtoken');
      vi.doUnmock('../../../../server/src/config/Config.js');
      vi.doUnmock('../../../../server/src/services/permissionService.js');
    });
  });
});

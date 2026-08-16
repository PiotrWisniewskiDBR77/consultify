import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, setDependencies } from '../../../../server/src/controllers/AuthController.js';
import type { Request, Response } from 'express';

// Mock dependencies
const mockDb = {
  get: vi.fn(),
  run: vi.fn(),
};

const mockBcrypt = {
  compareSync: vi.fn(),
};

const mockActivityService = {
  log: vi.fn(),
};

const mockMFAService = {
  getMFAStatus: vi.fn(),
  isDeviceTrusted: vi.fn(),
  verifyTOTP: vi.fn(),
  trustDevice: vi.fn(),
};

const mockRefreshTokenService = {
  generateTokenPair: vi.fn(),
};

const mockRedisStore = vi.fn().mockImplementation(() => ({
  resetKey: vi.fn().mockResolvedValue(undefined),
}));

const returnActiveMembership = (sql: string, cb: (error: Error | null, row: unknown) => void) => {
  if (!sql.includes('FROM organization_members')) return false;
  cb(null, { role: 'USER' });
  return true;
};

describe('AuthController (Genuine)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonFn: any;
  let statusFn: any;
  let sendFn: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup request/response
    mockReq = {
      body: {},
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('TestAgent'),
    };

    jsonFn = vi.fn().mockReturnThis();
    statusFn = vi.fn().mockReturnThis();
    sendFn = vi.fn().mockReturnThis();

    mockRes = {
      status: statusFn,
      json: jsonFn,
      send: sendFn,
    };

    // Inject mocks using the controller's helper
    await setDependencies({
      db: mockDb as any,
      bcrypt: mockBcrypt,
      ActivityService: mockActivityService,
      MFAService: mockMFAService as any,
      RefreshTokenService: mockRefreshTokenService as any,
      RedisStore: mockRedisStore as any,
    });
  });

  describe('login', () => {
    it('should return 401 if user not found', async () => {
      mockReq.body = { email: 'nonexistent@example.com', password: 'password' };

      // Mock DB to return null for user query
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (returnActiveMembership(sql, cb)) return;
        if (sql.includes('FROM users')) cb(null, null);
      });

      await login(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(jsonFn).toHaveBeenCalledWith({ error: 'Invalid email or password' });
    });

    it('should return 401 if password does not match', async () => {
      mockReq.body = { email: 'test@example.com', password: 'wrong' };

      // Mock DB to return user
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (returnActiveMembership(sql, cb)) return;
        if (sql.includes('FROM users')) {
          cb(null, {
            id: 'u1',
            email: 'test@example.com',
            password: 'hashed',
            organization_id: 'o1',
          });
        }
      });

      // Mock bcrypt to fail
      mockBcrypt.compareSync.mockReturnValue(false);

      await login(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(jsonFn).toHaveBeenCalledWith({ error: 'Invalid email or password' });
    });

    it('should return 404 if organization not found', async () => {
      mockReq.body = { email: 'test@example.com', password: 'correct' };

      mockDb.get.mockImplementation((sql, params, cb) => {
        if (returnActiveMembership(sql, cb)) return;
        if (sql.includes('FROM users')) {
          cb(null, {
            id: 'u1',
            email: 'test@example.com',
            password: 'hashed',
            organization_id: 'o1',
          });
        } else if (sql.includes('FROM organizations')) {
          cb(null, null); // Org not found
        }
      });

      mockBcrypt.compareSync.mockReturnValue(true);

      await login(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(jsonFn).toHaveBeenCalledWith({ error: 'Organization not found' });
    });

    it('should return 403 if organization is blocked (and user not SUPERADMIN)', async () => {
      mockReq.body = { email: 'test@example.com', password: 'correct' };

      mockDb.get.mockImplementation((sql, params, cb) => {
        if (returnActiveMembership(sql, cb)) return;
        if (sql.includes('FROM users')) {
          cb(null, { id: 'u1', role: 'USER', password: 'hashed', organization_id: 'o1' });
        } else if (sql.includes('FROM organizations')) {
          cb(null, { id: 'o1', status: 'blocked' });
        }
      });

      mockBcrypt.compareSync.mockReturnValue(true);

      await login(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('blocked') })
      );
    });

    it('should login successfully and return tokens', async () => {
      mockReq.body = { email: 'valid@example.com', password: 'correct' };

      mockDb.get.mockImplementation((sql, params, cb) => {
        if (returnActiveMembership(sql, cb)) return;
        if (sql.includes('FROM users')) {
          cb(null, {
            id: 'u1',
            role: 'USER',
            password: 'hashed',
            organization_id: 'o1',
            first_name: 'John',
            last_name: 'Doe',
            status: 'active',
            email: 'valid@example.com',
          });
        } else if (sql.includes('FROM organizations')) {
          cb(null, { id: 'o1', status: 'active', plan: 'pro', name: 'Acme' });
        }
      });

      mockBcrypt.compareSync.mockReturnValue(true);
      mockMFAService.getMFAStatus.mockResolvedValue({ enabled: false });
      mockRefreshTokenService.generateTokenPair.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: 3600,
      });

      // Mock DB run for updating last login
      mockDb.run.mockImplementation((sql, params, cb) => cb(null));

      await login(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(sendFn).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'at',
          refreshToken: 'rt',
          user: expect.objectContaining({ email: 'valid@example.com' }),
        })
      );

      // Verify activity log
      expect(mockActivityService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'login',
          userId: 'u1',
        })
      );
    });

    it('should force admin@dbr77.com to SUPERADMIN (and persist role) on login', async () => {
      process.env.FORCE_SUPERADMIN_EMAILS = 'admin@dbr77.com';
      mockReq.body = { email: 'admin@dbr77.com', password: 'correct' };

      mockDb.get.mockImplementation((sql, params, cb) => {
        if (returnActiveMembership(sql, cb)) return;
        if (sql.includes('FROM users')) {
          cb(null, {
            id: 'admin-1',
            role: 'ADMIN',
            password: 'hashed',
            organization_id: 'o1',
            first_name: 'Super',
            last_name: 'Admin',
            status: 'active',
            email: 'admin@dbr77.com',
          });
        } else if (sql.includes('FROM organizations')) {
          cb(null, { id: 'o1', status: 'active', plan: 'enterprise', name: 'DBR77' });
        }
      });

      mockBcrypt.compareSync.mockReturnValue(true);
      mockMFAService.getMFAStatus.mockResolvedValue({ enabled: false });
      mockRefreshTokenService.generateTokenPair.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: 3600,
      });

      // Mock DB run for updating role + last_login
      mockDb.run.mockImplementation((sql, params, cb) => cb(null));

      await login(mockReq as Request, mockRes as Response);

      // Role persistence attempt
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET role'),
        ['SUPERADMIN', 'admin-1'],
        expect.any(Function)
      );

      // Token generation should receive SUPERADMIN role
      expect(mockRefreshTokenService.generateTokenPair).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'admin-1',
          email: 'admin@dbr77.com',
          role: 'SUPERADMIN',
          organization_id: 'o1',
        }),
        expect.any(Object)
      );

      // Response user should be SUPERADMIN
      expect(sendFn).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ email: 'admin@dbr77.com', role: 'SUPERADMIN' }),
          token: 'at',
          refreshToken: 'rt',
        })
      );

      delete process.env.FORCE_SUPERADMIN_EMAILS;
    });

    it('should require MFA if enabled and device not trusted', async () => {
      mockReq.body = { email: 'mfa@example.com', password: 'correct' };

      mockDb.get.mockImplementation((sql, params, cb) => {
        if (returnActiveMembership(sql, cb)) return;
        if (sql.includes('FROM users')) {
          cb(null, { id: 'u1', role: 'USER', password: 'hashed', organization_id: 'o1' });
        } else if (sql.includes('FROM organizations')) {
          cb(null, { id: 'o1', status: 'active' });
        }
      });

      mockBcrypt.compareSync.mockReturnValue(true);
      mockMFAService.getMFAStatus.mockResolvedValue({ enabled: true });
      mockMFAService.isDeviceTrusted.mockResolvedValue(false);

      await login(mockReq as Request, mockRes as Response);

      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          mfaRequired: true,
          message: 'Please enter your 2FA code',
        })
      );
    });
  });
});

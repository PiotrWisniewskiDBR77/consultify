/**
 * AuthController L2 Component Tests
 * Tests for authentication logic, token generation, and session management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as AuthController from '../../../server/src/controllers/AuthController';

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

const mockMfaService = {
  getMFAStatus: vi.fn().mockResolvedValue({ enabled: false }),
  isDeviceTrusted: vi.fn(),
  verifyTOTP: vi.fn(),
  trustDevice: vi.fn(),
};

const mockRefreshTokenService = {
  generateTokenPair: vi.fn().mockResolvedValue({
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    expiresIn: 3600,
  }),
};

const mockRedisStore = vi.fn().mockImplementation(() => ({
  resetKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../server/src/utils/cookieAuth.js', () => ({
  setAuthCookies: vi.fn(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AuthController', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Inject dependencies
    await AuthController.setDependencies({
      db: mockDb as any,
      bcrypt: mockBcrypt as any,
      ActivityService: mockActivityService as any,
      MFAService: mockMfaService as any,
      RefreshTokenService: mockRefreshTokenService as any,
      RedisStore: mockRedisStore as any,
    });

    mockReq = {
      body: {},
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-user-agent'),
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      mockReq.body = { email: 'test@example.com', password: 'password123' };

      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('organization_members')) {
          cb(null, { role: 'USER' });
        } else if (sql.includes('users')) {
          cb(null, {
            id: 'user-123',
            email: 'test@example.com',
            password: 'hashed-password',
            organization_id: 'org-123',
            role: 'USER',
            status: 'active',
          });
        } else if (sql.includes('organizations')) {
          cb(null, { id: 'org-123', name: 'Test Org', status: 'active', plan: 'enterprise' });
        }
      });

      mockBcrypt.compareSync.mockReturnValue(true);
      mockDb.run.mockImplementation((sql, params, cb) => cb && cb(null));

      await AuthController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'access-token-123',
          user: expect.objectContaining({
            email: 'test@example.com',
          }),
        })
      );
      expect(mockActivityService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'login',
        })
      );
    });

    it('should return 401 for invalid password', async () => {
      mockReq.body = { email: 'test@example.com', password: 'wrong-password' };

      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('users')) {
          cb(null, { id: 'user-123', password: 'hashed-password' });
        }
      });

      mockBcrypt.compareSync.mockReturnValue(false);

      await AuthController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid email or password' });
    });

    it('should return 401 if user not found', async () => {
      mockReq.body = { email: 'nonexistent@example.com', password: 'password' };

      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('users')) {
          cb(null, null);
        }
      });

      await AuthController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid email or password' });
    });
  });
});

/**
 * User State Guard Middleware Test
 *
 * Tests for user state guard middleware (blocking inactive/suspended users).
 *
 * @module tests/unit/backend/middleware/userStateGuard.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create user state guard middleware
const createUserStateGuard = (options = {}) => {
  const {
    allowPendingVerification = false,
    allowedStatuses = ['active'],
    excludePaths = ['/api/auth/logout', '/api/auth/verify-email'],
  } = options;

  return (req, res, next) => {
    // Skip auth-related paths
    if (excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // If no user attached, skip (auth middleware should handle this)
    if (!req.user) {
      return next();
    }

    const userStatus = req.user.status || 'active';

    // Check if user status is allowed
    if (allowedStatuses.includes(userStatus)) {
      return next();
    }

    // Special case for pending verification
    if (userStatus === 'pending' && allowPendingVerification) {
      return next();
    }

    // Blocked user
    if (userStatus === 'blocked') {
      return res.status(403).json({
        error: 'Account blocked',
        code: 'ACCOUNT_BLOCKED',
        message: 'Your account has been blocked. Please contact support.',
      });
    }

    // Suspended user
    if (userStatus === 'suspended') {
      return res.status(403).json({
        error: 'Account suspended',
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account is temporarily suspended.',
        suspendedUntil: req.user.suspendedUntil,
      });
    }

    // Pending verification
    if (userStatus === 'pending') {
      return res.status(403).json({
        error: 'Email verification required',
        code: 'VERIFICATION_REQUIRED',
        message: 'Please verify your email address to continue.',
      });
    }

    // Default deny for unknown statuses
    return res.status(403).json({
      error: 'Access denied',
      code: 'INVALID_STATUS',
      message: 'Your account status does not allow this operation.',
    });
  };
};

describe('User State Guard Middleware', () => {
  let middleware;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    middleware = createUserStateGuard();

    mockReq = {
      path: '/api/projects',
      user: { id: 'user-1', status: 'active' },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('Active Users', () => {
    it('should allow active users to proceed', () => {
      mockReq.user.status = 'active';

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next without error for active user', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Blocked Users', () => {
    it('should reject blocked users with 403', () => {
      mockReq.user.status = 'blocked';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ACCOUNT_BLOCKED',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Suspended Users', () => {
    it('should reject suspended users with 403', () => {
      mockReq.user.status = 'suspended';
      mockReq.user.suspendedUntil = '2026-02-01';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ACCOUNT_SUSPENDED',
          suspendedUntil: '2026-02-01',
        })
      );
    });
  });

  describe('Pending Verification', () => {
    it('should reject unverified users by default', () => {
      mockReq.user.status = 'pending';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VERIFICATION_REQUIRED',
        })
      );
    });

    it('should allow unverified users when configured', () => {
      const permissiveMiddleware = createUserStateGuard({
        allowPendingVerification: true,
      });

      mockReq.user.status = 'pending';

      permissiveMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Excluded Paths', () => {
    it('should skip check for logout path', () => {
      mockReq.path = '/api/auth/logout';
      mockReq.user.status = 'blocked';

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip check for verify-email path', () => {
      mockReq.path = '/api/auth/verify-email';
      mockReq.user.status = 'pending';

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('No User Attached', () => {
    it('should skip check when no user is attached', () => {
      delete mockReq.user;

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom allowed statuses', () => {
      const customMiddleware = createUserStateGuard({
        allowedStatuses: ['active', 'premium'],
      });

      mockReq.user.status = 'premium';

      customMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

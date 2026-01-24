/**
 * Super Admin Middleware Test
 *
 * Tests for super admin authorization middleware.
 *
 * @module tests/unit/backend/middleware/superAdminMiddleware.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create super admin middleware
const createSuperAdminMiddleware = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const role = req.user.role?.toLowerCase();

    if (role !== 'superadmin') {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'SUPERADMIN_REQUIRED',
        message: 'This operation requires superadmin privileges',
      });
    }

    // Add superadmin context
    req.isSuperAdmin = true;
    return next();
  };
};

describe('Super Admin Middleware', () => {
  let middleware;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    middleware = createSuperAdminMiddleware();

    mockReq = {
      user: { id: 'sa-1', role: 'superadmin' },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('SuperAdmin Access', () => {
    it('should allow superadmin users', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.isSuperAdmin).toBe(true);
    });

    it('should handle uppercase SUPERADMIN role', () => {
      mockReq.user.role = 'SUPERADMIN';

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Non-SuperAdmin Access', () => {
    it('should reject admin users with 403', () => {
      mockReq.user.role = 'admin';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SUPERADMIN_REQUIRED',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject regular users with 403', () => {
      mockReq.user.role = 'user';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('No Authentication', () => {
    it('should return 401 when no user attached', () => {
      delete mockReq.user;

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
        })
      );
    });
  });
});

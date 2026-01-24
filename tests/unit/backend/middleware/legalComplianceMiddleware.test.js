/**
 * Legal Compliance Middleware Test
 *
 * Tests for legal compliance middleware (TOS, Privacy Policy acceptance).
 *
 * @module tests/unit/backend/middleware/legalComplianceMiddleware.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create legal compliance middleware
const createLegalComplianceMiddleware = (options = {}) => {
  const {
    requiredDocuments = ['TOS', 'PRIVACY'],
    excludePaths = ['/api/legal', '/api/auth/logout'],
    bypassForAdmins = false,
  } = options;

  // Mock legal acceptance store
  const acceptanceStore = new Map();

  return {
    middleware: (req, res, next) => {
      // Skip excluded paths
      if (excludePaths.some((path) => req.path.startsWith(path))) {
        return next();
      }

      if (!req.user) {
        return next();
      }

      // Bypass for admins if configured
      if (bypassForAdmins && req.user.role === 'admin') {
        return next();
      }

      const userAcceptances = acceptanceStore.get(req.user.id) || [];
      const pendingDocuments = requiredDocuments.filter((doc) => !userAcceptances.includes(doc));

      if (pendingDocuments.length > 0) {
        return res.status(451).json({
          error: 'Legal acceptance required',
          code: 'LEGAL_ACCEPTANCE_REQUIRED',
          pendingDocuments,
          redirectUrl: '/legal/accept',
        });
      }

      return next();
    },

    acceptDocument: (userId, docType) => {
      const current = acceptanceStore.get(userId) || [];
      if (!current.includes(docType)) {
        current.push(docType);
      }
      acceptanceStore.set(userId, current);
    },

    getAcceptances: (userId) => {
      return acceptanceStore.get(userId) || [];
    },

    clearAcceptances: () => {
      acceptanceStore.clear();
    },
  };
};

describe('Legal Compliance Middleware', () => {
  let legalService;
  let middleware;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    legalService = createLegalComplianceMiddleware();
    middleware = legalService.middleware;
    legalService.clearAcceptances();

    mockReq = {
      path: '/api/projects',
      user: { id: 'user-1', role: 'user' },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('Unaccepted Documents', () => {
    it('should block user who has not accepted TOS', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(451);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'LEGAL_ACCEPTANCE_REQUIRED',
          pendingDocuments: expect.arrayContaining(['TOS', 'PRIVACY']),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block user with partial acceptance', () => {
      legalService.acceptDocument('user-1', 'TOS');

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(451);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingDocuments: ['PRIVACY'],
        })
      );
    });
  });

  describe('Accepted Documents', () => {
    it('should allow user who accepted all documents', () => {
      legalService.acceptDocument('user-1', 'TOS');
      legalService.acceptDocument('user-1', 'PRIVACY');

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Excluded Paths', () => {
    it('should skip check for legal endpoints', () => {
      mockReq.path = '/api/legal/accept';

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip check for logout', () => {
      mockReq.path = '/api/auth/logout';

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('No User', () => {
    it('should skip check when no user attached', () => {
      delete mockReq.user;

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Admin Bypass', () => {
    it('should bypass for admin when configured', () => {
      const bypassService = createLegalComplianceMiddleware({
        bypassForAdmins: true,
      });

      mockReq.user.role = 'admin';

      bypassService.middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

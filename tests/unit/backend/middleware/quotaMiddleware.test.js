/**
 * Quota Middleware Test
 *
 * Tests for general quota enforcement middleware.
 *
 * @module tests/unit/backend/middleware/quotaMiddleware.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create quota middleware
const createQuotaMiddleware = (resourceType, quotaConfig = {}) => {
  const {
    free: freeLimit = 100,
    pro: proLimit = 1000,
    enterprise: enterpriseLimit = Infinity,
  } = quotaConfig;

  const planLimits = { free: freeLimit, pro: proLimit, enterprise: enterpriseLimit };
  const usageStore = new Map();

  return {
    middleware: (req, res, next) => {
      if (!req.user || !req.user.organizationId) {
        return next();
      }

      const orgId = req.user.organizationId;
      const plan = req.organization?.plan || 'free';
      const limit = planLimits[plan] || planLimits.free;
      const currentUsage = usageStore.get(orgId) || 0;

      if (currentUsage >= limit) {
        return res.status(429).json({
          error: `${resourceType} quota exceeded`,
          code: 'QUOTA_EXCEEDED',
          resource: resourceType,
          currentUsage,
          limit,
          plan,
          resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      req.quotaRemaining = limit - currentUsage;
      return next();
    },

    incrementUsage: (orgId, amount = 1) => {
      const current = usageStore.get(orgId) || 0;
      usageStore.set(orgId, current + amount);
    },

    setUsage: (orgId, amount) => {
      usageStore.set(orgId, amount);
    },

    getUsage: (orgId) => usageStore.get(orgId) || 0,

    reset: () => usageStore.clear(),
  };
};

describe('Quota Middleware', () => {
  let quotaService;
  let middleware;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    quotaService = createQuotaMiddleware('api_calls', {
      free: 100,
      pro: 1000,
      enterprise: Infinity,
    });
    middleware = quotaService.middleware;
    quotaService.reset();

    mockReq = {
      user: { id: 'user-1', organizationId: 'org-1' },
      organization: { plan: 'free' },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('Within Quota', () => {
    it('should allow requests within quota', () => {
      quotaService.setUsage('org-1', 50);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.quotaRemaining).toBe(50);
    });

    it('should set correct remaining quota', () => {
      quotaService.setUsage('org-1', 90);

      middleware(mockReq, mockRes, mockNext);

      expect(mockReq.quotaRemaining).toBe(10);
    });
  });

  describe('Quota Exceeded', () => {
    it('should block when quota exceeded', () => {
      quotaService.setUsage('org-1', 100);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'QUOTA_EXCEEDED',
          resource: 'api_calls',
          currentUsage: 100,
          limit: 100,
        })
      );
    });
  });

  describe('Different Plans', () => {
    it('should use pro limits for pro plan', () => {
      mockReq.organization.plan = 'pro';
      quotaService.setUsage('org-1', 500);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.quotaRemaining).toBe(500);
    });

    it('should allow unlimited for enterprise', () => {
      mockReq.organization.plan = 'enterprise';
      quotaService.setUsage('org-1', 100000);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('No User', () => {
    it('should skip when no user attached', () => {
      delete mockReq.user;

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

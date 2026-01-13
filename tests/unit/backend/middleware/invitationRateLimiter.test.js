/**
 * Invitation Rate Limiter Middleware Test
 *
 * Tests for invitation-specific rate limiting middleware.
 *
 * @module tests/unit/backend/middleware/invitationRateLimiter.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create invitation rate limiter
const createInvitationRateLimiter = (options = {}) => {
  const {
    maxInvitationsPerHour = 20,
    maxInvitationsPerDay = 50,
    windowMs = 60 * 60 * 1000, // 1 hour
  } = options;

  const invitationCounts = new Map();

  return {
    middleware: (req, res, next) => {
      // Only apply to invitation endpoints
      if (!req.path.includes('/invitations') && !req.path.includes('/invite')) {
        return next();
      }

      // Only apply to POST (sending invitations)
      if (req.method !== 'POST') {
        return next();
      }

      const userId = req.user?.id;
      if (!userId) {
        return next();
      }

      const now = Date.now();
      const userKey = `${userId}:hourly`;
      const dailyKey = `${userId}:daily`;

      // Get or create user's hourly count
      const hourlyData = invitationCounts.get(userKey) || { count: 0, resetAt: now + windowMs };
      const dailyData = invitationCounts.get(dailyKey) || {
        count: 0,
        resetAt: now + 24 * 60 * 60 * 1000,
      };

      // Reset if window expired
      if (now > hourlyData.resetAt) {
        hourlyData.count = 0;
        hourlyData.resetAt = now + windowMs;
      }

      if (now > dailyData.resetAt) {
        dailyData.count = 0;
        dailyData.resetAt = now + 24 * 60 * 60 * 1000;
      }

      // Check hourly limit
      if (hourlyData.count >= maxInvitationsPerHour) {
        return res.status(429).json({
          error: 'Too many invitations',
          code: 'INVITATION_RATE_LIMIT_HOURLY',
          limit: maxInvitationsPerHour,
          retryAfter: Math.ceil((hourlyData.resetAt - now) / 1000),
          message: 'You have reached the hourly invitation limit',
        });
      }

      // Check daily limit
      if (dailyData.count >= maxInvitationsPerDay) {
        return res.status(429).json({
          error: 'Too many invitations',
          code: 'INVITATION_RATE_LIMIT_DAILY',
          limit: maxInvitationsPerDay,
          retryAfter: Math.ceil((dailyData.resetAt - now) / 1000),
          message: 'You have reached the daily invitation limit',
        });
      }

      // Add pending invitation tracking
      req.trackInvitation = () => {
        hourlyData.count++;
        dailyData.count++;
        invitationCounts.set(userKey, hourlyData);
        invitationCounts.set(dailyKey, dailyData);
      };

      return next();
    },

    // Helper for testing
    setCount: (userId, hourly, daily) => {
      invitationCounts.set(`${userId}:hourly`, {
        count: hourly,
        resetAt: Date.now() + 60 * 60 * 1000,
      });
      invitationCounts.set(`${userId}:daily`, {
        count: daily,
        resetAt: Date.now() + 24 * 60 * 60 * 1000,
      });
    },

    reset: () => invitationCounts.clear(),
  };
};

describe('Invitation Rate Limiter Middleware', () => {
  let limiterService;
  let middleware;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    limiterService = createInvitationRateLimiter({
      maxInvitationsPerHour: 20,
      maxInvitationsPerDay: 50,
    });
    middleware = limiterService.middleware;
    limiterService.reset();

    mockReq = {
      path: '/api/invitations',
      method: 'POST',
      user: { id: 'user-1' },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('Within Limits', () => {
    it('should allow invitation within limits', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.trackInvitation).toBeDefined();
    });

    it('should skip non-invitation paths', () => {
      mockReq.path = '/api/projects';
      limiterService.setCount('user-1', 100, 100);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip GET requests', () => {
      mockReq.method = 'GET';
      limiterService.setCount('user-1', 100, 100);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Hourly Limit', () => {
    it('should block when hourly limit exceeded', () => {
      limiterService.setCount('user-1', 20, 0);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVITATION_RATE_LIMIT_HOURLY',
          limit: 20,
        })
      );
    });
  });

  describe('Daily Limit', () => {
    it('should block when daily limit exceeded', () => {
      limiterService.setCount('user-1', 10, 50);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVITATION_RATE_LIMIT_DAILY',
          limit: 50,
        })
      );
    });
  });

  describe('Tracking', () => {
    it('should provide trackInvitation function', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(typeof mockReq.trackInvitation).toBe('function');
    });
  });
});

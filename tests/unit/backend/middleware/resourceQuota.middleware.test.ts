import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../../../server/src/middleware/auth.middleware';
import {
  checkMemoryQuota,
  checkCPUQuota,
  checkBudgetQuota,
} from '../../../../server/src/middleware/resourceQuota.middleware.js';
import * as queryHelpers from '../../../../server/src/utils/queryHelpers';

// Mock dependencies
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../../../server/src/utils/queryHelpers.js');

describe('Resource Quota Middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonSpy = vi.fn();
    statusSpy = vi.fn(() => ({ json: jsonSpy }));

    mockReq = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        organizationId: 'org-123',
      },
    };

    mockRes = {
      status: statusSpy,
      json: jsonSpy,
    } as Partial<Response>;

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkMemoryQuota', () => {
    it('should pass when no organization ID present', async () => {
      mockReq.user = undefined;

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'No organization found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when no subscription plan found', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue(null);

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should pass when subscription plan has no memory limit', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: undefined });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should pass when memory usage is within quota', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({
          id: 'plan-123',
          memory_limit_mb: 1000,
          cpu_quota_percent: 50,
          max_concurrent_ai_jobs: 10,
        })
        .mockResolvedValueOnce({
          memory_usage_mb_current: 500,
          cpu_usage_percent_avg: 25,
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should block when memory quota exceeded', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({
          id: 'plan-123',
          memory_limit_mb: 1000,
        })
        .mockResolvedValueOnce({
          memory_usage_mb_current: 1500,
          cpu_usage_percent_avg: 25,
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Memory quota exceeded',
        details: {
          current: 1500,
          limit: 1000,
          message: expect.stringContaining('exceeded its memory quota'),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block when exactly at memory limit', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 1000 })
        .mockResolvedValueOnce({
          memory_usage_mb_current: 1001,
          cpu_usage_percent_avg: 25,
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return error when organization not found in database', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 1000 })
        .mockResolvedValueOnce(null);

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Organization data not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass through on database error', async () => {
      vi.mocked(queryHelpers.queryOne).mockRejectedValue(new Error('DB Error'));

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });
  });

  describe('checkCPUQuota', () => {
    it('should pass when no organization ID present', async () => {
      mockReq.user = { id: 'user-123', email: 'test@test.com', role: 'USER' };

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when no subscription plan found', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue(null);

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should pass when subscription plan has no CPU limit', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: undefined });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should pass when CPU usage is within quota', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: 75 })
        .mockResolvedValueOnce({ cpu_usage_percent_avg: 50 });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should block when CPU quota exceeded', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: 50 })
        .mockResolvedValueOnce({ cpu_usage_percent_avg: 75 });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'CPU quota exceeded',
        details: {
          current: 75,
          limit: 50,
          message: expect.stringContaining('exceeded its CPU quota'),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return error when organization not found', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: 50 })
        .mockResolvedValueOnce(null);

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Organization data not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass through on database error', async () => {
      vi.mocked(queryHelpers.queryOne).mockRejectedValue(new Error('DB Error'));

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });
  });

  describe('checkBudgetQuota', () => {
    it('should pass when no organization ID present', async () => {
      mockReq.user = undefined;

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return error when organization not found', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue(null);

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Organization not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when no budget set', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: null,
        budget_spent_current_period: 100,
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should pass when budget not exceeded', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: 5000,
        budget_spent_current_period: 2500,
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should block when budget exceeded', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 1500,
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Monthly budget exceeded',
        details: {
          spent: 1500,
          limit: 1000,
          message: expect.stringContaining('exceeded its monthly budget'),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass through on database error', async () => {
      vi.mocked(queryHelpers.queryOne).mockRejectedValue(new Error('DB Error'));

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle memory quota at exact boundary (1 MB over)', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 1024 })
        .mockResolvedValueOnce({
          memory_usage_mb_current: 1025,
          cpu_usage_percent_avg: 10,
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle CPU quota at exact boundary (1% over)', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: 80 })
        .mockResolvedValueOnce({ cpu_usage_percent_avg: 81 });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle budget quota at exact boundary ($0.01 over)', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: 1000.0,
        budget_spent_current_period: 1000.01,
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle zero memory usage', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 1000 })
        .mockResolvedValueOnce({
          memory_usage_mb_current: 0,
          cpu_usage_percent_avg: 0,
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should handle zero budget spent', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 0,
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should check quota for correct organization', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);

      queryOneSpy
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 1000 })
        .mockResolvedValueOnce({
          memory_usage_mb_current: 500,
          cpu_usage_percent_avg: 25,
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      // Verify the first query used correct org ID
      expect(queryOneSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['org-123'])
      );
    });

    it('should isolate budget checks per organization', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);

      queryOneSpy.mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 500,
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(queryOneSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['org-123'])
      );
    });
  });

  describe('Error Response Format', () => {
    it('should return detailed error for memory quota exceeded', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 512 })
        .mockResolvedValueOnce({
          memory_usage_mb_current: 1024,
          cpu_usage_percent_avg: 50,
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Memory quota exceeded',
        details: {
          current: 1024,
          limit: 512,
          message: expect.any(String),
        },
      });
    });

    it('should use status code 429 (Too Many Requests) for quota exceeded', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: 50 })
        .mockResolvedValueOnce({ cpu_usage_percent_avg: 90 });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
    });
  });
});

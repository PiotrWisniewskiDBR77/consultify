import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../../../server/src/middleware/auth.middleware';
import {
  checkMemoryQuota,
  checkCPUQuota,
  checkBudgetQuota,
} from '../../../../server/src/middleware/resourceQuota.middleware.js';
import * as queryHelpers from '../../../../server/src/utils/queryHelpers';
import logger from '../../../../server/src/utils/Logger.js';

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
      setHeader: vi.fn(),
    } as Partial<Response>;

    mockNext = vi.fn();
  });

  afterEach(() => {
    // The suite is intentionally randomized. Clear call history and queued
    // mockResolvedValueOnce implementations so quota branches cannot inherit
    // another case's missing-plan or missing-limit response.
    vi.resetAllMocks();
  });

  describe('checkMemoryQuota', () => {
    it('should log async rejection from next() after successful memory check', async () => {
      mockNext = vi.fn(() => Promise.reject(new Error('next async boom'))) as unknown as NextFunction;
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 1000 })
        .mockResolvedValueOnce({
          memory_usage_mb_current: 500,
          cpu_usage_percent_avg: 25,
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      await vi.waitFor(() =>
        expect(logger.warn).toHaveBeenCalledWith(
          '[ResourceQuota] next() rejected',
          expect.objectContaining({ phase: 'memory-pass', error: expect.any(Error) })
        )
      );
    });

    it('should swallow synchronous throws from next() after successful memory check', async () => {
      mockNext = vi.fn(() => {
        throw new Error('next sync boom');
      }) as unknown as NextFunction;
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 1000 })
        .mockResolvedValueOnce({
          memory_usage_mb_current: 500,
          cpu_usage_percent_avg: 25,
        });

      await expect(
        checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext)
      ).resolves.toBeUndefined();

      expect(mockNext).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        '[ResourceQuota] next() threw',
        expect.objectContaining({ phase: 'memory-pass', error: expect.any(Error) })
      );
    });

    it('should log and continue when memory response writer throws', async () => {
      statusSpy.mockImplementationOnce(() => {
        throw new Error('status boom');
      });
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 1000 })
        .mockResolvedValueOnce({
          memory_usage_mb_current: 1500,
          cpu_usage_percent_avg: 25,
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        '[ResourceQuota] Response write failed',
        expect.objectContaining({ kind: 'memory', statusCode: 429, error: expect.any(Error) })
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next and avoid writes when headers were already sent', async () => {
      mockRes.headersSent = true;

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should call next and avoid writes when response is already writableEnded', async () => {
      (mockRes as any).headersSent = false;
      (mockRes as any).writableEnded = true;

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should call next and avoid writes when response is already finished', async () => {
      (mockRes as any).headersSent = false;
      (mockRes as any).writableEnded = false;
      (mockRes as any).finished = true;

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should call next and avoid writes when response is already destroyed', async () => {
      (mockRes as any).headersSent = false;
      (mockRes as any).writableEnded = false;
      (mockRes as any).finished = false;
      (mockRes as any).destroyed = true;

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should pass when no organization ID present', async () => {
      mockReq.user = undefined;

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'No organization found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject oversized organization id before querying memory quota data', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        organizationId: 'o'.repeat(129),
      } as any;

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Invalid organization context' });
      expect(queryOneSpy).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when user organizationId accessor throws but legacy organization_id exists', async () => {
      const user: Record<string, unknown> = { organization_id: 'org-legacy' };
      Object.defineProperty(user, 'organizationId', {
        configurable: true,
        get: () => {
          throw new Error('organizationId getter failed');
        },
      });
      mockReq.user = user as any;

      vi.mocked(queryHelpers.queryOne).mockResolvedValue(null);

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should pass when no subscription plan found', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue(null);

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should pass when subscription plan id is whitespace-only', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);
      queryOneSpy.mockResolvedValueOnce({ subscription_plan_id: '   \t' });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(queryOneSpy).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should pass when subscription plan id is object and skip secondary plan lookup', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);
      queryOneSpy.mockResolvedValueOnce({ subscription_plan_id: { invalid: true } as any });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(queryOneSpy).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should reject oversized subscription plan id before memory plan lookup', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);
      queryOneSpy.mockResolvedValueOnce({ subscription_plan_id: 'p'.repeat(257) });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(queryOneSpy).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Invalid billing context' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should perform plan lookup when subscription plan id is finite number', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);
      queryOneSpy
        .mockResolvedValueOnce({ subscription_plan_id: 12345 })
        .mockResolvedValueOnce({ id: '12345', memory_limit_mb: 1000 })
        .mockResolvedValueOnce({ memory_usage_mb_current: 500, cpu_usage_percent_avg: 20 });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(queryOneSpy).toHaveBeenCalledTimes(3);
      expect(queryOneSpy).toHaveBeenNthCalledWith(
        2,
        'SELECT id, memory_limit_mb FROM subscription_plans WHERE id = ?',
        ['12345']
      );
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
          message: 'Memory quota exceeded for this organization',
        },
      });
      expect((mockRes as any).setHeader).toHaveBeenCalledWith('Retry-After', '60');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next and avoid writes when headers are sent after async usage read', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 1000 })
        .mockImplementationOnce(async () => {
          mockRes.headersSent = true;
          return { memory_usage_mb_current: 1500 };
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should not double-invoke next phase when response commits during no-plan branch', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);
      queryOneSpy.mockImplementationOnce(async () => {
        (mockRes as any).headersSent = true;
        return { subscription_plan_id: null };
      });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(queryOneSpy).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should stop before usage query when response commits after plan read', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);
      queryOneSpy
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockImplementationOnce(async () => {
          (mockRes as any).headersSent = true;
          return { id: 'plan-123', memory_limit_mb: 1000 };
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(queryOneSpy).toHaveBeenCalledTimes(2);
      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
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

    it('should return 500 when memory usage row is not a plain object', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 1000 })
        .mockResolvedValueOnce([] as any);

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Organization data not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when memory usage value is non-numeric', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 1000 })
        .mockResolvedValueOnce({ memory_usage_mb_current: 'bad-value' });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should enforce memory quota when DB returns numeric strings', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: '1000' })
        .mockResolvedValueOnce({
          memory_usage_mb_current: '1500',
          cpu_usage_percent_avg: '25',
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should enforce memory quota when DB returns bigint usage and limit', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: 1000n })
        .mockResolvedValueOnce({
          memory_usage_mb_current: 1500n,
          cpu_usage_percent_avg: 25,
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({ current: 1500, limit: 1000 }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when memory plan limit is negative (misconfigured)', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: -100 })
        .mockResolvedValueOnce({
          memory_usage_mb_current: 500,
          cpu_usage_percent_avg: 25,
        });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should pass through on database error', async () => {
      vi.mocked(queryHelpers.queryOne).mockRejectedValue(new Error('DB Error'));

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should log non-Error CPU failures with normalized message payload', async () => {
      vi.mocked(queryHelpers.queryOne).mockRejectedValue('cpu-db-failure');

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        '[ResourceQuota] CPU quota check failed',
        expect.objectContaining({ message: 'cpu-db-failure' })
      );
      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should call next on memory DB error when response is already committed', async () => {
      vi.mocked(queryHelpers.queryOne).mockImplementation(async () => {
        (mockRes as any).headersSent = true;
        throw new Error('DB Error');
      });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should call next on memory DB error when response is writableEnded', async () => {
      vi.mocked(queryHelpers.queryOne).mockImplementation(async () => {
        (mockRes as any).headersSent = false;
        (mockRes as any).writableEnded = true;
        throw new Error('DB Error');
      });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should treat unsafe bigint memory values as invalid and pass through', async () => {
      const unsafeBigInt = BigInt(Number.MAX_SAFE_INTEGER) + 2n;
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', memory_limit_mb: unsafeBigInt })
        .mockResolvedValueOnce({ memory_usage_mb_current: unsafeBigInt });

      await checkMemoryQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });
  });

  describe('checkCPUQuota', () => {
    it('should log async rejection from next() after successful CPU check', async () => {
      mockNext = vi.fn(() => Promise.reject(new Error('next cpu async boom'))) as unknown as NextFunction;
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: 75 })
        .mockResolvedValueOnce({ cpu_usage_percent_avg: 50 });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      await vi.waitFor(() =>
        expect(logger.warn).toHaveBeenCalledWith(
          '[ResourceQuota] next() rejected',
          expect.objectContaining({ phase: 'cpu-pass', error: expect.any(Error) })
        )
      );
    });

    it('should swallow synchronous throws from next() after successful CPU check', async () => {
      mockNext = vi.fn(() => {
        throw new Error('next cpu sync boom');
      }) as unknown as NextFunction;
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: 75 })
        .mockResolvedValueOnce({ cpu_usage_percent_avg: 50 });

      await expect(
        checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext)
      ).resolves.toBeUndefined();

      expect(mockNext).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        '[ResourceQuota] next() threw',
        expect.objectContaining({ phase: 'cpu-pass', error: expect.any(Error) })
      );
    });

    it('should call next and avoid writes when headers were already sent', async () => {
      mockRes.headersSent = true;

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should call next and avoid writes when response is already writableEnded', async () => {
      (mockRes as any).headersSent = false;
      (mockRes as any).writableEnded = true;

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should call next and avoid writes when response is already finished', async () => {
      (mockRes as any).headersSent = false;
      (mockRes as any).writableEnded = false;
      (mockRes as any).finished = true;

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should pass when no organization ID present', async () => {
      mockReq.user = { id: 'user-123', email: 'test@test.com', role: 'USER' };

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject oversized organization id before querying CPU quota data', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        organizationId: 'o'.repeat(129),
      } as any;

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Invalid organization context' });
      expect(queryOneSpy).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when no subscription plan found', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue(null);

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should pass when subscription plan id is whitespace-only for CPU check', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);
      queryOneSpy.mockResolvedValueOnce({ subscription_plan_id: '   ' });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(queryOneSpy).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should reject oversized subscription plan id before cpu plan lookup', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);
      queryOneSpy.mockResolvedValueOnce({ subscription_plan_id: 'p'.repeat(257) });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(queryOneSpy).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Invalid billing context' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when user organizationId accessor throws but legacy organization_id exists', async () => {
      const user: Record<string, unknown> = { organization_id: 'org-legacy-cpu' };
      Object.defineProperty(user, 'organizationId', {
        configurable: true,
        get: () => {
          throw new Error('organizationId getter failed');
        },
      });
      mockReq.user = user as any;

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
          message: 'CPU quota exceeded for this organization',
        },
      });
      expect((mockRes as any).setHeader).toHaveBeenCalledWith('Retry-After', '60');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should treat cpu_quota_percent=0 as configured and block when usage is above 0', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: 0 })
        .mockResolvedValueOnce({ cpu_usage_percent_avg: 1 });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'CPU quota exceeded',
          details: expect.objectContaining({ limit: 0, current: 1 }),
        })
      );
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

    it('should return 500 when CPU usage row is not a plain object', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: 50 })
        .mockResolvedValueOnce([] as any);

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Organization data not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when cpu usage value is non-numeric', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: 50 })
        .mockResolvedValueOnce({ cpu_usage_percent_avg: 'bad-value' });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should enforce CPU quota when DB returns numeric strings', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: '50' })
        .mockResolvedValueOnce({ cpu_usage_percent_avg: '75' });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should enforce CPU quota when DB returns bigint usage and limit', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: 50n })
        .mockResolvedValueOnce({ cpu_usage_percent_avg: 75n });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({ current: 75, limit: 50 }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when CPU plan limit is negative (misconfigured)', async () => {
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: -10 })
        .mockResolvedValueOnce({ cpu_usage_percent_avg: 75 });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should pass through on database error', async () => {
      vi.mocked(queryHelpers.queryOne).mockRejectedValue(new Error('DB Error'));

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should log non-Error budget failures with normalized message payload', async () => {
      vi.mocked(queryHelpers.queryOne).mockRejectedValue('budget-db-failure');

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        '[ResourceQuota] Budget quota check failed',
        expect.objectContaining({ message: 'budget-db-failure' })
      );
      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should call next on CPU DB error when response is already committed', async () => {
      vi.mocked(queryHelpers.queryOne).mockImplementation(async () => {
        (mockRes as any).headersSent = true;
        throw new Error('DB Error');
      });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should call next on CPU DB error when response is writableEnded', async () => {
      vi.mocked(queryHelpers.queryOne).mockImplementation(async () => {
        (mockRes as any).headersSent = false;
        (mockRes as any).writableEnded = true;
        throw new Error('DB Error');
      });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should treat unsafe bigint cpu values as invalid and pass through', async () => {
      const unsafeBigInt = BigInt(Number.MAX_SAFE_INTEGER) + 2n;
      vi.mocked(queryHelpers.queryOne)
        .mockResolvedValueOnce({ subscription_plan_id: 'plan-123' })
        .mockResolvedValueOnce({ id: 'plan-123', cpu_quota_percent: unsafeBigInt })
        .mockResolvedValueOnce({ cpu_usage_percent_avg: unsafeBigInt });

      await checkCPUQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });
  });

  describe('checkBudgetQuota', () => {
    it('should swallow synchronous throws from next() after successful budget check', async () => {
      mockNext = vi.fn(() => {
        throw new Error('next budget sync boom');
      }) as unknown as NextFunction;
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: 5000,
        budget_spent_current_period: 2500,
      });

      await expect(
        checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext)
      ).resolves.toBeUndefined();

      expect(mockNext).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        '[ResourceQuota] next() threw',
        expect.objectContaining({ phase: 'budget-pass', error: expect.any(Error) })
      );
    });

    it('should call next and avoid writes when headers were already sent', async () => {
      mockRes.headersSent = true;

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should call next and avoid writes when response is already writableEnded', async () => {
      (mockRes as any).headersSent = false;
      (mockRes as any).writableEnded = true;

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should call next and avoid writes when response is already finished', async () => {
      (mockRes as any).headersSent = false;
      (mockRes as any).writableEnded = false;
      (mockRes as any).finished = true;

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should pass when no organization ID present', async () => {
      mockReq.user = undefined;

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject oversized organization id before querying budget data', async () => {
      const queryOneSpy = vi.mocked(queryHelpers.queryOne);
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        organizationId: 'o'.repeat(129),
      } as any;

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Invalid organization context' });
      expect(queryOneSpy).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return error when organization not found', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue(null);

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Organization not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when budget row is not a plain object', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue([] as any);

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Organization not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass when user organizationId accessor throws but legacy organization_id exists', async () => {
      const user: Record<string, unknown> = { organization_id: 'org-legacy-budget' };
      Object.defineProperty(user, 'organizationId', {
        configurable: true,
        get: () => {
          throw new Error('organizationId getter failed');
        },
      });
      mockReq.user = user as any;

      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 100,
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
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

    it('should pass when monthly budget is non-numeric', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: 'invalid',
        budget_spent_current_period: 100,
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should block when budget values are numeric strings and spent exceeds limit', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: '1000',
        budget_spent_current_period: '1500',
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block when budget values are bigint and spent exceeds limit', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: 1000n,
        budget_spent_current_period: 1500n,
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({ spent: 1500, limit: 1000 }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
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

    it('should treat monthly_budget_usd=0 as configured and block when spent is above 0', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: 0,
        budget_spent_current_period: 1,
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Monthly budget exceeded',
          details: expect.objectContaining({ limit: 0, spent: 1 }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow when monthly_budget_usd=0 and spent is 0', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: 0,
        budget_spent_current_period: 0,
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
          message: 'Monthly budget quota exceeded for this organization',
        },
      });
      expect((mockRes as any).setHeader).toHaveBeenCalledWith('Retry-After', '60');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should include spent=0 when spent is null but budget data is invalid (defensive)', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({
        monthly_budget_usd: -1,
        budget_spent_current_period: null,
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(429);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: 'Monthly budget exceeded',
        details: {
          spent: 0,
          limit: -1,
          message: 'Monthly budget quota exceeded for this organization',
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

    it('should call next on budget DB error when response is already committed', async () => {
      vi.mocked(queryHelpers.queryOne).mockImplementation(async () => {
        (mockRes as any).headersSent = true;
        throw new Error('DB Error');
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should call next on budget DB error when response is writableEnded', async () => {
      vi.mocked(queryHelpers.queryOne).mockImplementation(async () => {
        (mockRes as any).headersSent = false;
        (mockRes as any).writableEnded = true;
        throw new Error('DB Error');
      });

      await checkBudgetQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).not.toHaveBeenCalled();
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

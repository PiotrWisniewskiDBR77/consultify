/**
 * PMO Validation Middleware Test
 *
 * Tests for PMO (Project Management Office) validation middleware.
 *
 * @module tests/unit/backend/middleware/pmoValidation.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create PMO validation middleware
const createPmoValidationMiddleware = () => {
  const validStatuses = ['draft', 'active', 'on_hold', 'completed', 'cancelled'];
  const validPriorities = ['low', 'medium', 'high', 'critical'];

  return (req, res, next) => {
    // Only validate PMO-related endpoints
    if (!req.path.includes('/projects') && !req.path.includes('/tasks')) {
      return next();
    }

    const { status, priority, startDate, endDate, budget } = req.body || {};

    // Validate status
    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid project status',
        code: 'INVALID_STATUS',
        validStatuses,
      });
    }

    // Validate priority
    if (priority !== undefined && !validPriorities.includes(priority)) {
      return res.status(400).json({
        error: 'Invalid priority',
        code: 'INVALID_PRIORITY',
        validPriorities,
      });
    }

    // Validate date range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format',
          code: 'INVALID_DATE',
        });
      }

      if (end < start) {
        return res.status(400).json({
          error: 'End date before start date',
          code: 'INVALID_DATE_RANGE',
        });
      }
    }

    // Validate budget
    if (budget !== undefined) {
      if (typeof budget !== 'number' || budget < 0) {
        return res.status(400).json({
          error: 'Invalid budget',
          code: 'INVALID_BUDGET',
        });
      }
    }

    return next();
  };
};

describe('PMO Validation Middleware', () => {
  let middleware;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    middleware = createPmoValidationMiddleware();

    mockReq = {
      path: '/api/projects',
      body: { status: 'active', priority: 'high' },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('Valid Data', () => {
    it('should allow valid project data', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip non-PMO paths', () => {
      mockReq.path = '/api/users';
      mockReq.body.status = 'invalid';

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Status Validation', () => {
    it('should reject invalid status', () => {
      mockReq.body.status = 'invalid_status';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_STATUS',
          validStatuses: expect.arrayContaining(['active', 'completed']),
        })
      );
    });
  });

  describe('Priority Validation', () => {
    it('should reject invalid priority', () => {
      mockReq.body.priority = 'urgent';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_PRIORITY' })
      );
    });
  });

  describe('Date Validation', () => {
    it('should reject end date before start date', () => {
      mockReq.body.startDate = '2026-02-01';
      mockReq.body.endDate = '2026-01-01';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_DATE_RANGE' })
      );
    });

    it('should allow valid date range', () => {
      mockReq.body.startDate = '2026-01-01';
      mockReq.body.endDate = '2026-12-31';

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Budget Validation', () => {
    it('should reject negative budget', () => {
      mockReq.body.budget = -1000;

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_BUDGET' })
      );
    });
  });
});

/**
 * Economics Validation Middleware Test
 *
 * Tests for financial/economics validation middleware.
 *
 * @module tests/unit/backend/middleware/economicsValidation.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create economics validation middleware
const createEconomicsValidationMiddleware = () => {
  return (req, res, next) => {
    // Only validate economics-related endpoints
    if (!req.path.includes('/economics') && !req.path.includes('/financials')) {
      return next();
    }

    const { amount, currency, period } = req.body || {};

    // Validate amount
    if (amount !== undefined) {
      if (typeof amount !== 'number' || isNaN(amount)) {
        return res.status(400).json({
          error: 'Invalid amount',
          code: 'INVALID_AMOUNT',
          message: 'Amount must be a valid number',
        });
      }

      if (amount < 0) {
        return res.status(400).json({
          error: 'Negative amount',
          code: 'NEGATIVE_AMOUNT',
          message: 'Amount cannot be negative',
        });
      }

      if (amount > 1000000000) {
        return res.status(400).json({
          error: 'Amount too large',
          code: 'AMOUNT_TOO_LARGE',
          message: 'Amount exceeds maximum allowed value',
        });
      }
    }

    // Validate currency
    if (currency !== undefined) {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'PLN'];
      if (!validCurrencies.includes(currency)) {
        return res.status(400).json({
          error: 'Invalid currency',
          code: 'INVALID_CURRENCY',
          validCurrencies,
        });
      }
    }

    // Validate period
    if (period !== undefined) {
      const validPeriods = ['monthly', 'quarterly', 'yearly'];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({
          error: 'Invalid period',
          code: 'INVALID_PERIOD',
          validPeriods,
        });
      }
    }

    return next();
  };
};

describe('Economics Validation Middleware', () => {
  let middleware;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    middleware = createEconomicsValidationMiddleware();

    mockReq = {
      path: '/api/economics/budgets',
      body: { amount: 1000, currency: 'USD', period: 'monthly' },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('Valid Data', () => {
    it('should allow valid economics data', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip non-economics paths', () => {
      mockReq.path = '/api/projects';
      mockReq.body.amount = -100; // Invalid but should be ignored

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Amount Validation', () => {
    it('should reject non-numeric amount', () => {
      mockReq.body.amount = 'abc';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_AMOUNT' })
      );
    });

    it('should reject negative amount', () => {
      mockReq.body.amount = -100;

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NEGATIVE_AMOUNT' })
      );
    });

    it('should reject excessive amount', () => {
      mockReq.body.amount = 10000000000;

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'AMOUNT_TOO_LARGE' })
      );
    });
  });

  describe('Currency Validation', () => {
    it('should reject invalid currency', () => {
      mockReq.body.currency = 'XYZ';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_CURRENCY',
          validCurrencies: expect.arrayContaining(['USD', 'EUR']),
        })
      );
    });
  });

  describe('Period Validation', () => {
    it('should reject invalid period', () => {
      mockReq.body.period = 'weekly';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_PERIOD' })
      );
    });
  });
});

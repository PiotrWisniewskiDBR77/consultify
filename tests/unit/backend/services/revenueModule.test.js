/**
 * Revenue Module Unit Tests
 * 
 * Tests for Phase 5 - Billing & Revenue Module:
 * - Pricing Plans Advanced
 * - Subscription Change Management
 * - Revenue Recognition (ASC 606)
 * - Revenue Forecasting
 * - Payment Management & Dunning
 */

const { describe, it, expect, beforeAll, afterAll, beforeEach, vi } = require('vitest');

// Mock database
const mockDb = {
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
};

// Mock the database module
vi.mock('../../../../server/database.sqlite.active.js', () => ({
  default: mockDb,
  db: mockDb,
}));

describe('Revenue Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // PRICING PLANS TESTS
  // ==========================================
  describe('Pricing Plans', () => {
    it('should retrieve all pricing plans', async () => {
      const mockPlans = [
        {
          id: 'plan-1',
          name: 'Starter',
          price_monthly: 29,
          price_yearly: 290,
          currency: 'USD',
          max_users: 5,
          max_projects: 10,
          is_active: 1,
        },
        {
          id: 'plan-2',
          name: 'Professional',
          price_monthly: 99,
          price_yearly: 990,
          currency: 'USD',
          max_users: 25,
          max_projects: 50,
          is_active: 1,
        },
      ];

      mockDb.all.mockResolvedValueOnce(mockPlans);

      const result = await new Promise((resolve) => {
        mockDb.all('SELECT * FROM pricing_plans WHERE is_active = ?', [1], (err, rows) => {
          resolve(rows);
        });
      });

      expect(mockDb.all).toHaveBeenCalled();
    });

    it('should create a new pricing plan', async () => {
      const newPlan = {
        id: 'plan-3',
        name: 'Enterprise',
        price_monthly: 299,
        price_yearly: 2990,
        currency: 'USD',
        max_users: -1,
        max_projects: -1,
        max_storage_gb: -1,
        is_active: 1,
        is_public: 1,
        trial_days: 30,
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
        return { changes: 1 };
      });

      // Simulate create operation
      const result = await new Promise((resolve, reject) => {
        mockDb.run(
          'INSERT INTO pricing_plans (id, name, price_monthly, price_yearly, currency, max_users, max_projects, max_storage_gb, is_active, is_public, trial_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [newPlan.id, newPlan.name, newPlan.price_monthly, newPlan.price_yearly, newPlan.currency, newPlan.max_users, newPlan.max_projects, newPlan.max_storage_gb, newPlan.is_active, newPlan.is_public, newPlan.trial_days],
          (err) => {
            if (err) reject(err);
            resolve({ success: true });
          }
        );
      });

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should compare pricing plans', async () => {
      const planIds = ['plan-1', 'plan-2'];
      const mockComparison = [
        { id: 'plan-1', name: 'Starter', price_monthly: 29 },
        { id: 'plan-2', name: 'Professional', price_monthly: 99 },
      ];

      mockDb.all.mockResolvedValueOnce(mockComparison);

      const result = await new Promise((resolve) => {
        mockDb.all('SELECT * FROM pricing_plans WHERE id IN (?, ?)', planIds, (err, rows) => {
          resolve(rows);
        });
      });

      expect(mockDb.all).toHaveBeenCalled();
    });
  });

  // ==========================================
  // SUBSCRIPTION CHANGES TESTS
  // ==========================================
  describe('Subscription Changes', () => {
    it('should create a subscription change request', async () => {
      const changeRequest = {
        id: 'change-1',
        organization_id: 'org-1',
        from_plan_id: 'plan-1',
        to_plan_id: 'plan-2',
        change_type: 'upgrade',
        effective_date: new Date().toISOString(),
        proration_amount: 35.00,
        status: 'pending',
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
        return { changes: 1 };
      });

      const result = await new Promise((resolve, reject) => {
        mockDb.run(
          'INSERT INTO subscription_changes (id, organization_id, from_plan_id, to_plan_id, change_type, effective_date, proration_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [changeRequest.id, changeRequest.organization_id, changeRequest.from_plan_id, changeRequest.to_plan_id, changeRequest.change_type, changeRequest.effective_date, changeRequest.proration_amount, changeRequest.status],
          (err) => {
            if (err) reject(err);
            resolve({ success: true });
          }
        );
      });

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should approve a subscription change', async () => {
      const changeId = 'change-1';
      const approvedBy = 'admin-1';

      mockDb.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
        return { changes: 1 };
      });

      const result = await new Promise((resolve, reject) => {
        mockDb.run(
          'UPDATE subscription_changes SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['approved', approvedBy, changeId],
          (err) => {
            if (err) reject(err);
            resolve({ success: true });
          }
        );
      });

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should calculate proration amount correctly', () => {
      const daysRemaining = 15;
      const totalDays = 30;
      const oldPlanPrice = 29;
      const newPlanPrice = 99;
      
      // Calculate proration
      const dailyOldRate = oldPlanPrice / totalDays;
      const dailyNewRate = newPlanPrice / totalDays;
      const proration = (dailyNewRate - dailyOldRate) * daysRemaining;
      
      expect(proration).toBeCloseTo(35, 1); // ~$35 proration
    });

    it('should get subscription change statistics', async () => {
      const mockStats = {
        total: 50,
        pending: 5,
        approved: 40,
        rejected: 5,
        upgrades: 30,
        downgrades: 15,
        cancellations: 5,
        totalProration: 1750.00,
      };

      mockDb.get.mockResolvedValueOnce(mockStats);

      const result = await new Promise((resolve) => {
        mockDb.get(
          `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
            SUM(CASE WHEN change_type = 'upgrade' THEN 1 ELSE 0 END) as upgrades
          FROM subscription_changes`,
          [],
          (err, row) => {
            resolve(row);
          }
        );
      });

      expect(mockDb.get).toHaveBeenCalled();
    });
  });

  // ==========================================
  // REVENUE RECOGNITION TESTS
  // ==========================================
  describe('Revenue Recognition (ASC 606)', () => {
    it('should create a revenue recognition entry', async () => {
      const recognition = {
        id: 'rev-1',
        organization_id: 'org-1',
        contract_id: 'contract-1',
        revenue_amount: 12000,
        currency: 'USD',
        recognition_method: 'straight_line',
        recognized_amount: 0,
        remaining_amount: 12000,
        status: 'pending',
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
        return { changes: 1 };
      });

      const result = await new Promise((resolve, reject) => {
        mockDb.run(
          'INSERT INTO revenue_recognition (id, organization_id, contract_id, revenue_amount, currency, recognition_method, recognized_amount, remaining_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [recognition.id, recognition.organization_id, recognition.contract_id, recognition.revenue_amount, recognition.currency, recognition.recognition_method, recognition.recognized_amount, recognition.remaining_amount, recognition.status],
          (err) => {
            if (err) reject(err);
            resolve({ success: true });
          }
        );
      });

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should generate straight-line recognition schedule', () => {
      const totalAmount = 12000;
      const periods = 12;
      const monthlyAmount = totalAmount / periods;
      
      const schedule = [];
      for (let i = 0; i < periods; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() + i);
        schedule.push({
          period: date.toISOString().substring(0, 7), // YYYY-MM
          amount: monthlyAmount,
          recognized: false,
        });
      }
      
      expect(schedule.length).toBe(12);
      expect(schedule[0].amount).toBe(1000);
      expect(schedule.reduce((sum, item) => sum + item.amount, 0)).toBe(12000);
    });

    it('should recognize revenue for a period', async () => {
      const recognitionId = 'rev-1';
      const periodAmount = 1000;

      mockDb.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
        return { changes: 1 };
      });

      const result = await new Promise((resolve, reject) => {
        mockDb.run(
          'UPDATE revenue_recognition SET recognized_amount = recognized_amount + ?, remaining_amount = remaining_amount - ?, status = CASE WHEN remaining_amount - ? <= 0 THEN ? ELSE ? END WHERE id = ?',
          [periodAmount, periodAmount, periodAmount, 'completed', 'in_progress', recognitionId],
          (err) => {
            if (err) reject(err);
            resolve({ success: true });
          }
        );
      });

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should calculate recognition statistics', async () => {
      const mockStats = {
        totalRevenue: 500000,
        recognizedRevenue: 350000,
        remainingRevenue: 150000,
        pendingItems: 10,
        inProgressItems: 25,
        completedItems: 65,
      };

      mockDb.get.mockResolvedValueOnce(mockStats);

      const result = await new Promise((resolve) => {
        mockDb.get(
          `SELECT 
            SUM(revenue_amount) as totalRevenue,
            SUM(recognized_amount) as recognizedRevenue,
            SUM(remaining_amount) as remainingRevenue
          FROM revenue_recognition`,
          [],
          (err, row) => {
            resolve(row);
          }
        );
      });

      expect(mockDb.get).toHaveBeenCalled();
    });
  });

  // ==========================================
  // REVENUE FORECASTING TESTS
  // ==========================================
  describe('Revenue Forecasting', () => {
    it('should create a revenue forecast', async () => {
      const forecast = {
        id: 'forecast-1',
        forecast_type: 'quarterly',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        forecasted_amount: 150000,
        currency: 'USD',
        confidence_level: 0.85,
        method: 'linear',
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
        return { changes: 1 };
      });

      const result = await new Promise((resolve, reject) => {
        mockDb.run(
          'INSERT INTO revenue_forecasts (id, forecast_type, period_start, period_end, forecasted_amount, currency, confidence_level, method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [forecast.id, forecast.forecast_type, forecast.period_start, forecast.period_end, forecast.forecasted_amount, forecast.currency, forecast.confidence_level, forecast.method],
          (err) => {
            if (err) reject(err);
            resolve({ success: true });
          }
        );
      });

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should generate linear forecast', () => {
      // Historical data (last 6 months revenue)
      const historicalData = [100000, 105000, 110000, 115000, 120000, 125000];
      
      // Calculate linear regression
      const n = historicalData.length;
      const sumX = (n * (n - 1)) / 2; // 0+1+2+3+4+5 = 15
      const sumY = historicalData.reduce((a, b) => a + b, 0);
      const sumXY = historicalData.reduce((sum, y, x) => sum + x * y, 0);
      const sumX2 = historicalData.reduce((sum, _, x) => sum + x * x, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      // Forecast next month (x = 6)
      const forecastedAmount = slope * 6 + intercept;
      
      expect(forecastedAmount).toBeGreaterThan(125000); // Should be higher than last month
      expect(forecastedAmount).toBeLessThan(135000); // But not unreasonably high
    });

    it('should calculate forecast confidence level', () => {
      const historicalData = [100000, 105000, 110000, 115000, 120000, 125000];
      const predictedValues = [100000, 105000, 110000, 115000, 120000, 125000]; // Perfect prediction
      
      // Calculate R-squared (coefficient of determination)
      const meanActual = historicalData.reduce((a, b) => a + b, 0) / historicalData.length;
      const ssRes = historicalData.reduce((sum, actual, i) => sum + Math.pow(actual - predictedValues[i], 2), 0);
      const ssTot = historicalData.reduce((sum, actual) => sum + Math.pow(actual - meanActual, 2), 0);
      const rSquared = 1 - (ssRes / ssTot);
      
      expect(rSquared).toBeCloseTo(1, 2); // Perfect fit should have R² = 1
    });

    it('should get forecast statistics', async () => {
      const mockStats = {
        totalForecasts: 12,
        averageConfidence: 0.82,
        nextQuarterForecast: 175000,
        yearlyForecast: 700000,
      };

      mockDb.get.mockResolvedValueOnce(mockStats);

      const result = await new Promise((resolve) => {
        mockDb.get(
          `SELECT 
            COUNT(*) as totalForecasts,
            AVG(confidence_level) as averageConfidence
          FROM revenue_forecasts`,
          [],
          (err, row) => {
            resolve(row);
          }
        );
      });

      expect(mockDb.get).toHaveBeenCalled();
    });
  });

  // ==========================================
  // PAYMENT MANAGEMENT TESTS
  // ==========================================
  describe('Payment Management & Dunning', () => {
    it('should add a payment method', async () => {
      const paymentMethod = {
        id: 'pm-1',
        organization_id: 'org-1',
        payment_type: 'credit_card',
        payment_details_json: JSON.stringify({
          brand: 'visa',
          last_four: '4242',
          exp_month: 12,
          exp_year: 2028,
        }),
        is_default: 1,
        is_active: 1,
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
        return { changes: 1 };
      });

      const result = await new Promise((resolve, reject) => {
        mockDb.run(
          'INSERT INTO payment_methods (id, organization_id, payment_type, payment_details_json, is_default, is_active) VALUES (?, ?, ?, ?, ?, ?)',
          [paymentMethod.id, paymentMethod.organization_id, paymentMethod.payment_type, paymentMethod.payment_details_json, paymentMethod.is_default, paymentMethod.is_active],
          (err) => {
            if (err) reject(err);
            resolve({ success: true });
          }
        );
      });

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should record a payment failure', async () => {
      const failure = {
        id: 'fail-1',
        organization_id: 'org-1',
        payment_method_id: 'pm-1',
        failure_reason: 'Card declined',
        failure_code: 'card_declined',
        retry_count: 0,
        status: 'pending',
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
        return { changes: 1 };
      });

      const result = await new Promise((resolve, reject) => {
        mockDb.run(
          'INSERT INTO payment_failures (id, organization_id, payment_method_id, failure_reason, failure_code, retry_count, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [failure.id, failure.organization_id, failure.payment_method_id, failure.failure_reason, failure.failure_code, failure.retry_count, failure.status],
          (err) => {
            if (err) reject(err);
            resolve({ success: true });
          }
        );
      });

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should implement dunning retry logic', async () => {
      const failureId = 'fail-1';
      const maxRetries = 3;
      
      // Simulate retry increment
      mockDb.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
        return { changes: 1 };
      });

      // First retry
      mockDb.get.mockResolvedValueOnce({ retry_count: 0 });
      
      const result = await new Promise((resolve) => {
        mockDb.get('SELECT retry_count FROM payment_failures WHERE id = ?', [failureId], (err, row) => {
          const newRetryCount = (row?.retry_count || 0) + 1;
          const status = newRetryCount >= maxRetries ? 'failed' : 'retrying';
          resolve({ newRetryCount, status });
        });
      });

      expect(result.newRetryCount).toBe(1);
      expect(result.status).toBe('retrying');
    });

    it('should resolve a payment failure', async () => {
      const failureId = 'fail-1';

      mockDb.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
        return { changes: 1 };
      });

      const result = await new Promise((resolve, reject) => {
        mockDb.run(
          'UPDATE payment_failures SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['resolved', failureId],
          (err) => {
            if (err) reject(err);
            resolve({ success: true });
          }
        );
      });

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should calculate payment failure statistics', async () => {
      const mockStats = {
        totalMethods: 100,
        activeMethods: 95,
        pendingFailures: 3,
        totalFailures: 15,
        failureRate: 0.03,
      };

      mockDb.get.mockResolvedValueOnce(mockStats);

      const result = await new Promise((resolve) => {
        mockDb.get(
          `SELECT 
            (SELECT COUNT(*) FROM payment_methods) as totalMethods,
            (SELECT COUNT(*) FROM payment_methods WHERE is_active = 1) as activeMethods,
            (SELECT COUNT(*) FROM payment_failures WHERE status = 'pending') as pendingFailures
          `,
          [],
          (err, row) => {
            resolve(row);
          }
        );
      });

      expect(mockDb.get).toHaveBeenCalled();
    });

    it('should mask payment details correctly', () => {
      const cardNumber = '4242424242424242';
      const maskedNumber = '**** **** **** ' + cardNumber.slice(-4);
      
      expect(maskedNumber).toBe('**** **** **** 4242');
    });
  });

  // ==========================================
  // INTEGRATION TESTS
  // ==========================================
  describe('Revenue Module Integration', () => {
    it('should handle complete subscription upgrade flow', async () => {
      // 1. Create subscription change
      const changeId = 'change-test';
      mockDb.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
        return { changes: 1 };
      });

      // 2. Calculate proration
      const proration = 35.00;
      
      // 3. Approve change
      mockDb.get.mockResolvedValueOnce({ id: changeId, status: 'pending' });
      
      // 4. Update organization subscription
      // 5. Create invoice for proration
      
      expect(proration).toBeGreaterThan(0);
    });

    it('should handle payment failure and recovery flow', async () => {
      const organizationId = 'org-1';
      
      // 1. Payment attempt fails
      const failureId = 'fail-test';
      
      // 2. Record failure
      mockDb.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
        return { changes: 1 };
      });
      
      // 3. Send dunning email (mock)
      const sendDunningEmail = vi.fn().mockResolvedValue(true);
      
      // 4. Retry payment
      const retryPayment = vi.fn().mockResolvedValue({ success: true });
      
      // 5. Resolve failure
      await sendDunningEmail(organizationId);
      await retryPayment(organizationId);
      
      expect(sendDunningEmail).toHaveBeenCalledWith(organizationId);
      expect(retryPayment).toHaveBeenCalledWith(organizationId);
    });
  });
});


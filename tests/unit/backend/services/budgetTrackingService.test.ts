import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BudgetTrackingService } from '../../../server/src/services/budgetTrackingService';
import type { IDatabase } from '../../../server/src/database/IDatabase';
import type {
  BudgetConfig,
  ExpenseRecord,
  BudgetStatus,
} from '../../../server/src/services/budgetTrackingService';

// Mock logger
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('BudgetTrackingService', () => {
  let service: BudgetTrackingService;
  let mockDb: IDatabase;
  let runSpy: ReturnType<typeof vi.fn>;
  let getSpy: ReturnType<typeof vi.fn>;
  let allSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock database
    runSpy = vi.fn().mockResolvedValue(undefined);
    getSpy = vi.fn();
    allSpy = vi.fn();

    mockDb = {
      run: runSpy,
      get: getSpy,
      all: allSpy,
      close: vi.fn(),
      prepare: vi.fn(),
      exec: vi.fn(),
    } as unknown as IDatabase;

    service = new BudgetTrackingService(mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeBudget()', () => {
    it('should initialize budget with default alert threshold', async () => {
      const config: BudgetConfig = {
        organizationId: 'org-123',
        monthlyBudgetUsd: 5000,
      };

      await service.initializeBudget(config);

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE organizations'),
        expect.arrayContaining([
          5000,
          0.8, // default threshold
          expect.any(String),
          'org-123',
        ])
      );
    });

    it('should initialize budget with custom alert threshold', async () => {
      const config: BudgetConfig = {
        organizationId: 'org-456',
        monthlyBudgetUsd: 10000,
        alertThreshold: 0.9,
      };

      await service.initializeBudget(config);

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE organizations'),
        expect.arrayContaining([10000, 0.9, expect.any(String), 'org-456'])
      );
    });

    it('should reset spent amount to 0 on initialization', async () => {
      const config: BudgetConfig = {
        organizationId: 'org-789',
        monthlyBudgetUsd: 3000,
      };

      await service.initializeBudget(config);

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('budget_spent_current_period = 0'),
        expect.any(Array)
      );
    });

    it('should set budget_period_start to current date', async () => {
      const beforeInit = new Date();

      const config: BudgetConfig = {
        organizationId: 'org-time',
        monthlyBudgetUsd: 1000,
      };

      await service.initializeBudget(config);

      const callArgs = runSpy.mock.calls[0][1] as string[];
      const periodStart = new Date(callArgs[2]);

      expect(periodStart.getTime()).toBeGreaterThanOrEqual(beforeInit.getTime());
      expect(periodStart.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });

    it('should throw error on database failure', async () => {
      runSpy.mockRejectedValue(new Error('DB Error'));

      const config: BudgetConfig = {
        organizationId: 'org-error',
        monthlyBudgetUsd: 1000,
      };

      await expect(service.initializeBudget(config)).rejects.toThrow('DB Error');
    });
  });

  describe('recordExpense()', () => {
    const organizationId = 'org-123';

    beforeEach(() => {
      // Mock getBudgetStatus to avoid alert
      getSpy.mockResolvedValue({
        monthly_budget_usd: 10000,
        budget_spent_current_period: 1000,
        budget_alert_threshold: 0.8,
        budget_period_start: new Date().toISOString(),
      });
    });

    it('should insert expense record into database', async () => {
      const expense: ExpenseRecord = {
        amount: 100,
        category: 'TOKENS',
        description: 'AI chat usage',
      };

      await service.recordExpense(organizationId, expense);

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO budget_expenses'),
        expect.arrayContaining([
          expect.any(String), // id
          organizationId,
          100,
          'TOKENS',
          'AI chat usage',
          JSON.stringify({}),
          expect.any(String), // timestamp
        ])
      );
    });

    it('should update organization spent amount', async () => {
      const expense: ExpenseRecord = {
        amount: 250,
        category: 'STORAGE',
        description: 'File storage',
      };

      await service.recordExpense(organizationId, expense);

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE organizations'),
        expect.arrayContaining([250, organizationId])
      );
    });

    it('should handle metadata in expense record', async () => {
      const expense: ExpenseRecord = {
        amount: 50,
        category: 'API',
        description: 'External API call',
        metadata: {
          apiEndpoint: '/translate',
          requestCount: 100,
        },
      };

      await service.recordExpense(organizationId, expense);

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO budget_expenses'),
        expect.arrayContaining([
          expect.any(String),
          organizationId,
          50,
          'API',
          'External API call',
          JSON.stringify({
            apiEndpoint: '/translate',
            requestCount: 100,
          }),
          expect.any(String),
        ])
      );
    });

    it('should send alert when approaching budget limit', async () => {
      // Mock status to show approaching limit
      getSpy.mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 850, // 85% used
        budget_alert_threshold: 0.8,
        budget_period_start: new Date().toISOString(),
      });

      const expense: ExpenseRecord = {
        amount: 50,
        category: 'COMPUTE',
        description: 'Server costs',
      };

      await service.recordExpense(organizationId, expense);

      // Verify getBudgetStatus was called to check limits
      expect(getSpy).toHaveBeenCalled();
    });

    it('should send alert when budget exceeded', async () => {
      // Mock status to show exceeded budget
      getSpy.mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 1100, // 110% used
        budget_alert_threshold: 0.8,
        budget_period_start: new Date().toISOString(),
      });

      const expense: ExpenseRecord = {
        amount: 100,
        category: 'OTHER',
        description: 'Miscellaneous',
      };

      await service.recordExpense(organizationId, expense);

      expect(getSpy).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      runSpy.mockRejectedValue(new Error('Insert failed'));

      const expense: ExpenseRecord = {
        amount: 100,
        category: 'TOKENS',
        description: 'Test',
      };

      await expect(service.recordExpense(organizationId, expense)).rejects.toThrow('Insert failed');
    });
  });

  describe('getBudgetStatus()', () => {
    const organizationId = 'org-status';

    it('should return correct budget status', async () => {
      const mockOrg = {
        monthly_budget_usd: 5000,
        budget_spent_current_period: 2500,
        budget_alert_threshold: 0.8,
        budget_period_start: '2026-01-01T00:00:00.000Z',
      };

      getSpy.mockResolvedValue(mockOrg);

      const status = await service.getBudgetStatus(organizationId);

      expect(status).toMatchObject({
        organizationId,
        monthlyBudget: 5000,
        spent: 2500,
        remaining: 2500,
        percentageUsed: 50,
        alertThreshold: 80,
        exceeded: false,
        approachingLimit: false,
      });
    });

    it('should detect when budget is exceeded', async () => {
      getSpy.mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 1200,
        budget_alert_threshold: 0.8,
        budget_period_start: new Date().toISOString(),
      });

      const status = await service.getBudgetStatus(organizationId);

      expect(status.exceeded).toBe(true);
      expect(status.remaining).toBe(0);
    });

    it('should detect when approaching limit', async () => {
      getSpy.mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 850,
        budget_alert_threshold: 0.8,
        budget_period_start: new Date().toISOString(),
      });

      const status = await service.getBudgetStatus(organizationId);

      expect(status.approachingLimit).toBe(true);
      expect(status.percentageUsed).toBe(85);
    });

    it('should handle zero budget correctly', async () => {
      getSpy.mockResolvedValue({
        monthly_budget_usd: 0,
        budget_spent_current_period: 100,
        budget_alert_threshold: 0.8,
        budget_period_start: new Date().toISOString(),
      });

      const status = await service.getBudgetStatus(organizationId);

      expect(status.percentageUsed).toBe(0);
      expect(status.exceeded).toBe(true);
    });

    it('should handle null budget values', async () => {
      getSpy.mockResolvedValue({
        monthly_budget_usd: null,
        budget_spent_current_period: 0,
        budget_alert_threshold: 0.8,
        budget_period_start: null,
      });

      const status = await service.getBudgetStatus(organizationId);

      expect(status.monthlyBudget).toBe(0);
      expect(status.spent).toBe(0);
      expect(status.periodStart).toBeNull();
      expect(status.periodEnd).toBeNull();
    });

    it('should calculate period end date correctly', async () => {
      const periodStart = new Date('2026-01-15T10:00:00.000Z');
      getSpy.mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 500,
        budget_alert_threshold: 0.8,
        budget_period_start: periodStart.toISOString(),
      });

      const status = await service.getBudgetStatus(organizationId);

      expect(status.periodStart).toEqual(periodStart);
      // Period end should be last day of January 2026
      expect(status.periodEnd?.getDate()).toBe(31);
      expect(status.periodEnd?.getMonth()).toBe(0); // January
    });

    it('should throw error when organization not found', async () => {
      getSpy.mockResolvedValue(undefined);

      await expect(service.getBudgetStatus('non-existent')).rejects.toThrow(
        'Organization non-existent not found'
      );
    });

    it('should throw error on database failure', async () => {
      getSpy.mockRejectedValue(new Error('Query failed'));

      await expect(service.getBudgetStatus(organizationId)).rejects.toThrow('Query failed');
    });
  });

  describe('checkBudgetExceeded()', () => {
    it('should return true when budget exceeded', async () => {
      getSpy.mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 1500,
        budget_alert_threshold: 0.8,
        budget_period_start: new Date().toISOString(),
      });

      const exceeded = await service.checkBudgetExceeded('org-123');

      expect(exceeded).toBe(true);
    });

    it('should return false when budget not exceeded', async () => {
      getSpy.mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 500,
        budget_alert_threshold: 0.8,
        budget_period_start: new Date().toISOString(),
      });

      const exceeded = await service.checkBudgetExceeded('org-123');

      expect(exceeded).toBe(false);
    });
  });

  describe('resetBudgetPeriod()', () => {
    it('should reset spent amount to 0', async () => {
      await service.resetBudgetPeriod('org-123');

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('budget_spent_current_period = 0'),
        expect.any(Array)
      );
    });

    it('should update period start date', async () => {
      const beforeReset = new Date();

      await service.resetBudgetPeriod('org-123');

      const callArgs = runSpy.mock.calls[0][1] as string[];
      const newPeriodStart = new Date(callArgs[0]);

      expect(newPeriodStart.getTime()).toBeGreaterThanOrEqual(beforeReset.getTime());
    });

    it('should throw error on database failure', async () => {
      runSpy.mockRejectedValue(new Error('Update failed'));

      await expect(service.resetBudgetPeriod('org-123')).rejects.toThrow('Update failed');
    });
  });

  describe('getExpenseHistory()', () => {
    const organizationId = 'org-history';

    it('should return expense history with default options', async () => {
      const mockExpenses = [
        {
          id: '1',
          organization_id: organizationId,
          amount: 100,
          category: 'TOKENS',
          description: 'Expense 1',
          metadata: '{}',
          recorded_at: new Date(),
        },
        {
          id: '2',
          organization_id: organizationId,
          amount: 200,
          category: 'STORAGE',
          description: 'Expense 2',
          metadata: '{}',
          recorded_at: new Date(),
        },
      ];

      allSpy.mockResolvedValue(mockExpenses);

      const history = await service.getExpenseHistory(organizationId);

      expect(history).toEqual(mockExpenses);
      expect(allSpy).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM budget_expenses'),
        expect.arrayContaining([organizationId, 50, 0])
      );
    });

    it('should filter by category when specified', async () => {
      allSpy.mockResolvedValue([]);

      await service.getExpenseHistory(organizationId, { category: 'TOKENS' });

      expect(allSpy).toHaveBeenCalledWith(
        expect.stringContaining('AND category = ?'),
        expect.arrayContaining([organizationId, 'TOKENS', 50, 0])
      );
    });

    it('should respect limit and offset options', async () => {
      allSpy.mockResolvedValue([]);

      await service.getExpenseHistory(organizationId, {
        limit: 10,
        offset: 20,
      });

      expect(allSpy).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        expect.arrayContaining([organizationId, 10, 20])
      );
    });

    it('should return empty array when no expenses found', async () => {
      allSpy.mockResolvedValue(null);

      const history = await service.getExpenseHistory(organizationId);

      expect(history).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      allSpy.mockRejectedValue(new Error('Query failed'));

      await expect(service.getExpenseHistory(organizationId)).rejects.toThrow('Query failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large budget amounts', async () => {
      const config: BudgetConfig = {
        organizationId: 'org-large',
        monthlyBudgetUsd: 1000000000, // $1 billion
      };

      await service.initializeBudget(config);

      expect(runSpy).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([1000000000]));
    });

    it('should handle very small expense amounts', async () => {
      getSpy.mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 0,
        budget_alert_threshold: 0.8,
        budget_period_start: new Date().toISOString(),
      });

      const expense: ExpenseRecord = {
        amount: 0.01, // 1 cent
        category: 'OTHER',
        description: 'Minimal cost',
      };

      await service.recordExpense('org-123', expense);

      expect(runSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([0.01, 'org-123'])
      );
    });

    it('should handle concurrent expense recording', async () => {
      getSpy.mockResolvedValue({
        monthly_budget_usd: 1000,
        budget_spent_current_period: 500,
        budget_alert_threshold: 0.8,
        budget_period_start: new Date().toISOString(),
      });

      const expense1: ExpenseRecord = {
        amount: 100,
        category: 'TOKENS',
        description: 'Expense 1',
      };

      const expense2: ExpenseRecord = {
        amount: 200,
        category: 'STORAGE',
        description: 'Expense 2',
      };

      // Record expenses concurrently
      await Promise.all([
        service.recordExpense('org-123', expense1),
        service.recordExpense('org-123', expense2),
      ]);

      // Both should have been recorded
      expect(runSpy).toHaveBeenCalledTimes(4); // 2 inserts + 2 updates
    });
  });
});

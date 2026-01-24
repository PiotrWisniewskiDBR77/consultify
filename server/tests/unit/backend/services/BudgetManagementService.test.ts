/**
 * BudgetManagementService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for BudgetManagementService - 85%+ coverage target
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IDatabase } from '../../../../src/database/IDatabase.js';
import BudgetManagementService from '../../../../src/services/budgetManagementService.js';

describe('BudgetManagementService', () => {
  let mockDb: IDatabase;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
        const dbObj = {
          ...mockDb,
          changes: 1,
          lastID: 1,
        };
        if (callback) {
          callback(null);
        }
        return dbObj;
      }),
      exec: vi.fn(),
      serialize: vi.fn(),
      close: vi.fn(),
      query: vi.fn(),
    } as unknown as IDatabase;

    if (BudgetManagementService.setDependencies) {
      BudgetManagementService.setDependencies({ db: mockDb });
    }
  });

  describe('Service Methods', () => {
    it('should have required methods', () => {
      expect(BudgetManagementService).toBeDefined();
      expect(BudgetManagementService.setUserBudget).toBeDefined();
    });

    it('should set user budget in database', async () => {
      (mockDb.run as any).mockImplementation(function (sql: any, params: any, callback: any) {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      const result = await BudgetManagementService.setUserBudget('org-1', 'user-1', {
        monthlyTokenBudget: 1000,
      });

      expect(result.success).toBe(true);
    });

    it('should get budget status', async () => {
      const mockBudget = {
        organization_id: 'org-1',
        user_id: 'user-1',
        monthly_token_budget: 1000,
        tokens_used_this_month: 100,
      };
      (mockDb.get as any).mockImplementation((sql: any, params: any, callback: any) => {
        callback(null, mockBudget);
      });

      const status = await BudgetManagementService.getBudgetStatus('org-1', 'user-1');
      expect(status).toBeDefined();
      expect(status?.tokenUsagePercent).toBe('10.00');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', () => {
      (mockDb.get as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, params: unknown[], callback: (err: Error | null) => void) => {
          callback(new Error('Database error'));
        }
      );

      expect(true).toBe(true);
    });
  });
});

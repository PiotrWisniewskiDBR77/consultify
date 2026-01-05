/**
 * Token Billing Service Tests
 * Tests token billing and usage tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import TokenBillingService from '../../../../server/src/services/tokenBillingService.ts';

// Mock database
const mockDb = vi.hoisted(() => ({
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../../../server/src/database/Database.ts', () => ({
  default: mockDb,
}));

vi.mock('../../../../server/src/utils/Logger.ts', () => ({
  default: mockLogger,
}));

describe('TokenBillingService', () => {
  let service: TokenBillingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TokenBillingService();
  });

  describe('recordUsage', () => {
    it('should record token usage for organization', async () => {
      const usage = {
        organizationId: 'org-123',
        userId: 'user-456',
        tokens: 150,
        operation: 'ai-chat',
        model: 'gpt-4',
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      const result = await service.recordUsage(usage);

      expect(result).toHaveProperty('id');
      expect(mockDb.run).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const usage = { organizationId: 'org-123', tokens: 100 };
      const dbError = new Error('Database connection failed');

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(dbError);
      });

      await expect(service.recordUsage(usage)).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getUsage', () => {
    it('should return usage statistics for organization', async () => {
      const orgId = 'org-123';
      const mockUsage = {
        totalTokens: 1000,
        monthlyUsage: 500,
        dailyUsage: 50,
      };

      mockDb.get.mockResolvedValue($2);

      const result = await service.getUsage(orgId);

      expect(result).toEqual(mockUsage);
      expect(mockDb.get).toHaveBeenCalled();
    });
  });

  describe('checkLimits', () => {
    it('should check if usage is within limits', async () => {
      const orgId = 'org-123';

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { monthlyLimit: 1000, currentUsage: 800 });
      });

      const result = await service.checkLimits(orgId);

      expect(result).toHaveProperty('withinLimit', true);
      expect(result).toHaveProperty('remainingTokens', 200);
    });

    it('should detect limit exceeded', async () => {
      const orgId = 'org-123';

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { monthlyLimit: 1000, currentUsage: 1200 });
      });

      const result = await service.checkLimits(orgId);

      expect(result).toHaveProperty('withinLimit', false);
      expect(result).toHaveProperty('exceededBy', 200);
    });
  });
});

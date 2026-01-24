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
  getDatabase: () => mockDb,
}));

vi.mock('../../../../server/src/utils/Logger.ts', () => ({
  default: mockLogger,
}));

// Mock DbPromise - must be hoisted
const mockDbPromise = vi.hoisted(() => ({
  get: vi.fn((db, sql, params) => Promise.resolve(null)),
  run: vi.fn((db, sql, params) => Promise.resolve({ lastID: 1, changes: 1 })),
  all: vi.fn((db, sql, params) => Promise.resolve([])),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  default: mockDbPromise,
  get: mockDbPromise.get,
  run: mockDbPromise.run,
  all: mockDbPromise.all,
}));

describe('TokenBillingService', () => {
  let service: typeof TokenBillingService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Service is exported as singleton instance
    service = TokenBillingService;

    // Set dependencies for testing
    if (service && typeof (service as any).setDependencies === 'function') {
      (service as any).setDependencies({
        db: mockDb as any,
        uuidv4: () => 'test-uuid-123',
        crypto: require('crypto'),
        sqliteAsync: {
          withTransaction: vi.fn((db, fn) => fn()),
          runAsync: vi.fn(() => Promise.resolve({ lastID: 1, changes: 1 })),
        } as any,
      });
    }
  });

  describe('getOrgBalance', () => {
    it('should return organization balance', async () => {
      const orgId = 'org-123';
      const mockBalance = {
        token_balance: 1000,
        billing_status: 'ACTIVE',
        organization_type: 'PAID',
      };

      mockDbPromise.get.mockResolvedValue(mockBalance);

      const result = await service.getOrgBalance(orgId);

      expect(result).toHaveProperty('balance', 1000);
      expect(result).toHaveProperty('billingStatus', 'ACTIVE');
    });

    it('should handle organization not found', async () => {
      const orgId = 'org-not-found';

      mockDbPromise.get.mockResolvedValue(null);

      await expect(service.getOrgBalance(orgId)).rejects.toThrow('Organization not found');
    });
  });

  describe('hasOrgSufficientBalance', () => {
    it('should check if organization has sufficient balance', async () => {
      const orgId = 'org-123';
      const estimatedTokens = 500;

      mockDbPromise.get.mockResolvedValue({
        token_balance: 1000,
        billing_status: 'ACTIVE',
        organization_type: 'PAID',
      });

      const result = await service.hasOrgSufficientBalance(orgId, estimatedTokens);

      expect(result).toHaveProperty('allowed', true);
      expect(result).toHaveProperty('balance', 1000);
    });

    it('should detect insufficient balance for trial', async () => {
      const orgId = 'org-trial';
      const estimatedTokens = 500;

      mockDbPromise.get.mockResolvedValue({
        token_balance: 100,
        billing_status: 'TRIAL',
        organization_type: 'TRIAL',
      });

      const result = await service.hasOrgSufficientBalance(orgId, estimatedTokens);

      expect(result).toHaveProperty('allowed', false);
      expect(result).toHaveProperty('reason');
    });
  });

  describe('getLedger', () => {
    it('should return ledger entries for organization', async () => {
      const orgId = 'org-123';
      const mockLedger = [
        { id: 'led-1', type: 'CREDIT', amount: 1000 },
        { id: 'led-2', type: 'DEBIT', amount: 500 },
      ];

      mockDbPromise.all.mockResolvedValue(mockLedger);

      const result = await service.getLedger(orgId);

      expect(result).toEqual(mockLedger);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

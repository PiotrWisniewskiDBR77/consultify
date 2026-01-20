/**
 * Token Billing Service Unit Tests
 * Tests 3-tier token billing: Platform, BYOK, Local tokens
 * 
 * Coverage Target: 95%+
 * Critical Path: Billing & Cost Control
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenBillingServiceClass } from '../../../server/src/services/tokenBillingService.js';
import { createMockDb, createMockUuid } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations } from '../../fixtures/testData.js';
import * as DbPromise from '../../../server/src/utils/DbPromise.js';
import * as sqliteAsync from '../../../server/src/database/sqliteAsyncAdapter.js';

// Mock dependencies
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  default: {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
  },
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../server/src/database/sqliteAsyncAdapter.js', () => ({
  default: {
    runAsync: vi.fn(),
    withTransaction: vi.fn((db, fn) => fn()),
  },
  runAsync: vi.fn(),
  withTransaction: vi.fn((db, fn) => fn()),
}));

describe('TokenBillingService', () => {
  let service: TokenBillingServiceClass;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockUuid: ReturnType<typeof createMockUuid>;
  let mockCrypto: typeof import('crypto');

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockUuid = createMockUuid('test-uuid');
    
    // Mock crypto - użyj prawdziwego crypto dla encryption/decryption
    mockCrypto = require('crypto') as typeof import('crypto');

    // Reset DbPromise mocks
    (DbPromise.get as any).mockReset();
    (DbPromise.all as any).mockReset();
    (DbPromise.run as any).mockReset();
    
    // Default mock implementations
    (DbPromise.run as any).mockResolvedValue({ lastID: 1, changes: 1 });
    (DbPromise.get as any).mockResolvedValue(null);
    (DbPromise.all as any).mockResolvedValue([]);

    service = new TokenBillingServiceClass({
      db: mockDb as any,
      uuidv4: mockUuid,
      crypto: mockCrypto,
      sqliteAsync: sqliteAsync as any,
    });
  });

  describe('Margin Management', () => {
    describe('getMargins()', () => {
      it('should return all margins', async () => {
        const mockMargins = [
          {
            source_type: 'platform',
            base_cost_per_1k: 0.01,
            margin_percent: 20,
            min_charge: 0.001,
            is_active: true,
          },
          {
            source_type: 'byok',
            base_cost_per_1k: 0.0,
            margin_percent: 10,
            min_charge: 0.0005,
            is_active: true,
          },
        ];
        (DbPromise.all as any).mockResolvedValueOnce(mockMargins);

        const result = await service.getMargins();

        expect(result).toEqual(mockMargins);
        expect(DbPromise.all).toHaveBeenCalledWith(
          mockDb,
          expect.stringContaining('SELECT * FROM billing_margins'),
          [],
          { fallback: false }
        );
      });

      it('should return empty array when no margins exist', async () => {
        (DbPromise.all as any).mockResolvedValueOnce([]);

        const result = await service.getMargins();

        expect(result).toEqual([]);
      });
    });

    describe('getMargin()', () => {
      it('should return margin for specific source type', async () => {
        const mockMargin = {
          source_type: 'platform',
          base_cost_per_1k: 0.01,
          margin_percent: 20,
          min_charge: 0.001,
          is_active: true,
        };
        (DbPromise.get as any).mockResolvedValueOnce(mockMargin);

        const result = await service.getMargin('platform');

        expect(result).toEqual(mockMargin);
        expect(DbPromise.get).toHaveBeenCalledWith(
          mockDb,
          expect.stringContaining('WHERE source_type = ?'),
          ['platform'],
          { fallback: false }
        );
      });

      it('should return null when margin does not exist', async () => {
        (DbPromise.get as any).mockResolvedValueOnce(null);

        const result = await service.getMargin('unknown');

        expect(result).toBeNull();
      });
    });

    describe('updateMargin()', () => {
      it('should update margin successfully', async () => {
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 1 });

        const result = await service.updateMargin('platform', {
          baseCostPer1k: 0.02,
          marginPercent: 25,
          minCharge: 0.002,
          isActive: true,
        });

        expect(result.changes).toBe(1);
        expect(DbPromise.run).toHaveBeenCalledWith(
          mockDb,
          expect.stringContaining('UPDATE billing_margins'),
          expect.arrayContaining(['platform']),
          { fallback: false }
        );
      });

      it('should update only provided fields', async () => {
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 1 });

        const result = await service.updateMargin('platform', {
          marginPercent: 30,
        });

        expect(result.changes).toBe(1);
      });
    });
  });

  describe('Token Packages', () => {
    describe('getPackages()', () => {
      it('should return active packages', async () => {
        const mockPackages = [
          {
            id: 'pkg-1',
            name: 'Starter',
            description: 'Starter package',
            tokens: 10000,
            price_usd: 10,
            bonus_percent: 0,
            is_popular: false,
            sort_order: 1,
            stripe_price_id: 'price_123',
          },
        ];
        (DbPromise.all as any).mockResolvedValueOnce(mockPackages);

        const result = await service.getPackages();

        expect(result).toEqual(mockPackages);
        expect(DbPromise.all).toHaveBeenCalledWith(
          mockDb,
          expect.stringContaining('WHERE is_active = 1'),
          [],
          { fallback: false }
        );
      });
    });

    describe('getPackage()', () => {
      it('should return package by id', async () => {
        const mockPackage = {
          id: 'pkg-1',
          name: 'Starter',
          tokens: 10000,
          price_usd: 10,
        };
        (DbPromise.get as any).mockResolvedValueOnce(mockPackage);

        const result = await service.getPackage('pkg-1');

        expect(result).toEqual(mockPackage);
      });
    });

    describe('upsertPackage()', () => {
      it('should create new package', async () => {
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 1 });

        const result = await service.upsertPackage({
          name: 'New Package',
          tokens: 5000,
          priceUsd: 5,
          bonusPercent: 10,
        });

        expect(result.id).toBeDefined();
        expect(DbPromise.run).toHaveBeenCalled();
      });

      it('should update existing package when id provided', async () => {
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 1 });

        const result = await service.upsertPackage({
          id: 'pkg-existing',
          name: 'Updated Package',
          tokens: 10000,
          priceUsd: 10,
        });

        expect(result.id).toBe('pkg-existing');
      });
    });
  });

  describe('User Balance', () => {
    describe('getBalance()', () => {
      it('should return user balance', async () => {
        const mockBalance = {
          user_id: testUsers.user.id,
          platform_tokens: 1000,
          platform_tokens_bonus: 100,
          byok_usage_tokens: 500,
          local_usage_tokens: 200,
        };
        (DbPromise.get as any).mockResolvedValueOnce(mockBalance);

        const result = await service.getBalance(testUsers.user.id);

        expect(result).toEqual(mockBalance);
      });

      it('should return zero balance when user does not exist', async () => {
        (DbPromise.get as any).mockResolvedValueOnce(null);

        const result = await service.getBalance(testUsers.user.id);

        expect(result).toEqual({
          user_id: testUsers.user.id,
          platform_tokens: 0,
          platform_tokens_bonus: 0,
          byok_usage_tokens: 0,
          local_usage_tokens: 0,
        });
      });
    });

    describe('hasSufficientBalance()', () => {
      it('should return true when balance is sufficient', async () => {
        (DbPromise.get as any).mockResolvedValueOnce({
          platform_tokens: 1000,
          platform_tokens_bonus: 100,
        });

        const result = await service.hasSufficientBalance(testUsers.user.id, 500);

        expect(result).toBe(true);
      });

      it('should return false when balance is insufficient', async () => {
        (DbPromise.get as any).mockResolvedValueOnce({
          platform_tokens: 100,
          platform_tokens_bonus: 50,
        });

        const result = await service.hasSufficientBalance(testUsers.user.id, 500);

        expect(result).toBe(false);
      });

      it('should include bonus tokens in calculation', async () => {
        (DbPromise.get as any).mockResolvedValueOnce({
          platform_tokens: 400,
          platform_tokens_bonus: 100,
        });

        const result = await service.hasSufficientBalance(testUsers.user.id, 500);

        expect(result).toBe(true); // 400 + 100 = 500
      });
    });

    describe('ensureBalance()', () => {
      it('should create balance if not exists', async () => {
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 1 });

        const result = await service.ensureBalance(testUsers.user.id);

        expect(result.userId).toBe(testUsers.user.id);
        expect(DbPromise.run).toHaveBeenCalledWith(
          mockDb,
          expect.stringContaining('INSERT OR IGNORE'),
          [testUsers.user.id],
          { fallback: false }
        );
      });
    });
  });

  describe('Token Operations', () => {
    describe('creditTokens()', () => {
      it('should credit tokens successfully', async () => {
        // Mock ensureBalance first (uses DbPromise.run)
        (DbPromise.run as any).mockResolvedValueOnce({ lastID: 1, changes: 1 });
        
        // Mock callback-style DB for creditTokens
        let callCount = 0;
        const runCallback = vi.fn((sql, params, callback) => {
          callCount++;
          if (typeof callback === 'function') {
            // First call: UPDATE user_token_balance
            // Second call: INSERT token_transactions
            // Third call: INSERT billing_invoices (if orgId present)
            process.nextTick(() => {
              callback.call({ changes: 1, lastID: callCount }, null);
            });
          }
          return mockDb;
        });
        mockDb.run = runCallback as any;
        
        const getCallback = vi.fn((sql, params, callback) => {
          if (typeof callback === 'function') {
            process.nextTick(() => callback(null, { price_usd: 10 }));
          }
          return mockDb;
        });
        mockDb.get = getCallback as any;
        
        mockDb.serialize = vi.fn((cb) => {
          if (cb) {
            // Execute callback synchronously to simulate serialize behavior
            cb();
          }
          return mockDb;
        }) as any;

        const result = await service.creditTokens(
          testUsers.user.id,
          1000,
          100,
          {
            packageId: 'pkg-1',
            stripePaymentId: 'pay_123',
            organizationId: testOrganizations.org1.id,
          }
        );

        expect(result.tokens).toBe(1000);
        expect(result.bonusTokens).toBe(100);
        expect(result.transactionId).toBeDefined();
        expect(result.transactionId).toContain('tx-');
      });

      it('should credit tokens without organization', async () => {
        // Mock ensureBalance
        (DbPromise.run as any).mockResolvedValueOnce({ lastID: 1, changes: 1 });
        
        let callCount = 0;
        const runCallback = vi.fn((sql, params, callback) => {
          callCount++;
          if (typeof callback === 'function') {
            process.nextTick(() => {
              callback.call({ changes: 1, lastID: callCount }, null);
            });
          }
          return mockDb;
        });
        mockDb.run = runCallback as any;
        mockDb.serialize = vi.fn((cb) => {
          if (cb) cb();
          return mockDb;
        }) as any;

        const result = await service.creditTokens(testUsers.user.id, 1000, 0);

        expect(result.tokens).toBe(1000);
        expect(result.bonusTokens).toBe(0);
        expect(result.transactionId).toBeDefined();
      });
    });

    describe('deductTokens()', () => {
      it('should deduct platform tokens successfully', async () => {
        // Mock ensureBalance
        (DbPromise.run as any).mockResolvedValueOnce({ lastID: 1, changes: 1 });
        
        const mockMargin = {
          source_type: 'platform',
          base_cost_per_1k: 0.01,
          margin_percent: 20,
          min_charge: 0.001,
          is_active: true,
        };
        (DbPromise.get as any).mockResolvedValueOnce(mockMargin);

        let callCount = 0;
        const runCallback = vi.fn((sql, params, callback) => {
          callCount++;
          if (typeof callback === 'function') {
            process.nextTick(() => {
              callback.call({ changes: 1, lastID: callCount }, null);
            });
          }
          return mockDb;
        });
        mockDb.run = runCallback as any;
        mockDb.serialize = vi.fn((cb) => {
          if (cb) cb();
          return mockDb;
        }) as any;

        const result = await service.deductTokens(
          testUsers.user.id,
          1000,
          'platform',
          {
            organizationId: testOrganizations.org1.id,
            llmProvider: 'openai',
            modelUsed: 'gpt-4',
            multiplier: 1.0,
          }
        );

        expect(result.tokens).toBeGreaterThan(0);
        expect(result.marginUsd).toBeGreaterThanOrEqual(0.001); // min_charge
        expect(result.transactionId).toBeDefined();
        expect(result.transactionId).toContain('tx-');
      });

      it('should apply multiplier correctly', async () => {
        // Mock ensureBalance
        (DbPromise.run as any).mockResolvedValueOnce({ lastID: 1, changes: 1 });
        
        const mockMargin = {
          source_type: 'platform',
          base_cost_per_1k: 0.01,
          margin_percent: 20,
          min_charge: 0.001,
          is_active: true,
        };
        (DbPromise.get as any).mockResolvedValueOnce(mockMargin);

        let callCount = 0;
        const runCallback = vi.fn((sql, params, callback) => {
          callCount++;
          if (typeof callback === 'function') {
            process.nextTick(() => {
              callback.call({ changes: 1, lastID: callCount }, null);
            });
          }
          return mockDb;
        });
        mockDb.run = runCallback as any;
        mockDb.serialize = vi.fn((cb) => {
          if (cb) cb();
          return mockDb;
        }) as any;

        const result = await service.deductTokens(
          testUsers.user.id,
          1000,
          'platform',
          { multiplier: 2.0 }
        );

        // Should bill 2000 tokens (1000 * 2.0)
        expect(result.tokens).toBe(2000);
      });

      it('should deduct BYOK usage tokens', async () => {
        // Mock ensureBalance
        (DbPromise.run as any).mockResolvedValueOnce({ lastID: 1, changes: 1 });
        
        const mockMargin = {
          source_type: 'byok',
          base_cost_per_1k: 0.0,
          margin_percent: 10,
          min_charge: 0.0005,
          is_active: true,
        };
        (DbPromise.get as any).mockResolvedValueOnce(mockMargin);

        let callCount = 0;
        const runCallback = vi.fn((sql, params, callback) => {
          callCount++;
          if (typeof callback === 'function') {
            process.nextTick(() => {
              callback.call({ changes: 1, lastID: callCount }, null);
            });
          }
          return mockDb;
        });
        mockDb.run = runCallback as any;
        mockDb.serialize = vi.fn((cb) => {
          if (cb) cb();
          return mockDb;
        }) as any;

        const result = await service.deductTokens(
          testUsers.user.id,
          1000,
          'byok',
          {}
        );

        expect(result.tokens).toBe(1000);
        expect(result.marginUsd).toBeGreaterThanOrEqual(0.0005);
      });

      it('should handle organization-level deduction', async () => {
        // Mock ensureBalance
        (DbPromise.run as any).mockResolvedValueOnce({ lastID: 1, changes: 1 });
        
        const mockMargin = {
          source_type: 'platform',
          base_cost_per_1k: 0.01,
          margin_percent: 20,
          min_charge: 0.001,
          is_active: true,
        };
        (DbPromise.get as any).mockResolvedValueOnce(mockMargin);

        let callCount = 0;
        const runCallback = vi.fn((sql, params, callback) => {
          callCount++;
          if (typeof callback === 'function') {
            process.nextTick(() => {
              callback.call({ changes: 1, lastID: callCount }, null);
            });
          }
          return mockDb;
        });
        mockDb.run = runCallback as any;
        mockDb.serialize = vi.fn((cb) => {
          if (cb) cb();
          return mockDb;
        }) as any;

        const result = await service.deductTokens(
          testUsers.user.id,
          1000,
          'platform',
          { organizationId: testOrganizations.org1.id }
        );

        expect(result.transactionId).toBeDefined();
        expect(result.tokens).toBeGreaterThan(0);
        expect(result.marginUsd).toBeGreaterThanOrEqual(0);
        // Should update organization token_balance
        expect(runCallback).toHaveBeenCalled();
      });
    });
  });

  describe('API Key Encryption', () => {
    describe('encryptApiKey()', () => {
      it('should encrypt API key', () => {
        const apiKey = 'sk-test-key-12345';
        const encrypted = service.encryptApiKey(apiKey);

        expect(encrypted).toBeDefined();
        expect(encrypted).toContain(':'); // IV:encrypted format
        expect(encrypted.length).toBeGreaterThan(apiKey.length);
      });

      it('should produce different encrypted values for same input (due to random IV)', () => {
        const apiKey = 'sk-test-key-12345';
        const encrypted1 = service.encryptApiKey(apiKey);
        const encrypted2 = service.encryptApiKey(apiKey);

        expect(encrypted1).not.toBe(encrypted2); // Different IVs
      });
    });

    describe('decryptApiKey()', () => {
      it('should decrypt API key', () => {
        const apiKey = 'sk-test-key-12345';
        const encrypted = service.encryptApiKey(apiKey);
        const decrypted = service.decryptApiKey(encrypted);

        expect(decrypted).toBe(apiKey);
      });

      it('should handle round-trip encryption/decryption', () => {
        const apiKey = 'sk-test-key-round-trip-12345';
        const encrypted = service.encryptApiKey(apiKey);
        const decrypted = service.decryptApiKey(encrypted);

        expect(decrypted).toBe(apiKey);
      });
    });
  });

  describe('Organization Balance', () => {
    describe('getOrgBalance()', () => {
      it('should return organization balance', async () => {
        const mockOrg = {
          token_balance: 5000,
          billing_status: 'ACTIVE',
          organization_type: 'ENTERPRISE',
        };
        (DbPromise.get as any).mockResolvedValueOnce(mockOrg);

        const result = await service.getOrgBalance(testOrganizations.org1.id);

        expect(result.balance).toBe(5000);
        expect(result.billingStatus).toBe('ACTIVE');
        expect(result.organizationType).toBe('ENTERPRISE');
        expect(DbPromise.get).toHaveBeenCalledWith(
          mockDb,
          expect.stringContaining('SELECT token_balance'),
          [testOrganizations.org1.id],
          { fallback: false }
        );
      });

      it('should throw error when organization not found', async () => {
        (DbPromise.get as any).mockResolvedValueOnce(null);

        await expect(service.getOrgBalance('non-existent')).rejects.toThrow(
          'Organization not found'
        );
      });
    });

    describe('hasOrgSufficientBalance()', () => {
      it('should return allowed: true when balance is sufficient', async () => {
        (DbPromise.get as any).mockResolvedValueOnce({
          token_balance: 5000,
          billing_status: 'ACTIVE',
          organization_type: 'ENTERPRISE',
        });

        const result = await service.hasOrgSufficientBalance(
          testOrganizations.org1.id,
          1000
        );

        expect(result.allowed).toBe(true);
        expect(result.balance).toBe(5000);
        expect(result.paygoTriggered).toBeUndefined();
      });

      it('should return allowed: false for trial org with insufficient balance', async () => {
        (DbPromise.get as any).mockResolvedValueOnce({
          token_balance: 100,
          billing_status: 'TRIAL',
          organization_type: 'TRIAL',
        });

        const result = await service.hasOrgSufficientBalance(
          testOrganizations.org1.id,
          1000
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Trial token limit reached');
      });

      it('should trigger paygo for active org with insufficient balance', async () => {
        (DbPromise.get as any).mockResolvedValueOnce({
          token_balance: 100,
          billing_status: 'ACTIVE',
          organization_type: 'ENTERPRISE',
        });

        const result = await service.hasOrgSufficientBalance(
          testOrganizations.org1.id,
          1000
        );

        expect(result.allowed).toBe(true);
        expect(result.balance).toBe(100);
        expect(result.paygoTriggered).toBe(true);
      });

      it('should handle database errors gracefully', async () => {
        (DbPromise.get as any).mockRejectedValueOnce(new Error('DB Error'));

        const result = await service.hasOrgSufficientBalance(
          testOrganizations.org1.id,
          1000
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Balance check failed');
      });
    });
  });

  describe('Ledger Operations', () => {
    describe('getLedger()', () => {
      it('should return ledger entries', async () => {
        const mockLedger = [
          {
            id: 'led-1',
            created_at: '2024-01-01T00:00:00Z',
            actor_user_id: testUsers.user.id,
            type: 'DEBIT',
            amount: -1000,
            reason: 'AI Call',
          },
        ];
        (DbPromise.all as any).mockResolvedValueOnce(mockLedger);

        const result = await service.getLedger(testOrganizations.org1.id, {
          limit: 50,
          offset: 0,
        });

        expect(result).toEqual(mockLedger);
      });
    });

    describe('getLedgerSummary()', () => {
      it('should return ledger summary', async () => {
        const mockSummary = {
          total_credits: 5000,
          total_debits: 2000,
          transaction_count: 10,
        };
        (DbPromise.get as any).mockResolvedValueOnce(mockSummary);

        const result = await service.getLedgerSummary(testOrganizations.org1.id);

        expect(result.totalCredits).toBe(5000);
        expect(result.totalDebits).toBe(2000);
        expect(result.computedBalance).toBe(3000); // 5000 - 2000
        expect(result.transactionCount).toBe(10);
        expect(DbPromise.get).toHaveBeenCalledWith(
          mockDb,
          expect.stringContaining('SELECT'),
          [testOrganizations.org1.id],
          { fallback: false }
        );
      });

      it('should handle null values', async () => {
        (DbPromise.get as any).mockResolvedValueOnce(null);

        const result = await service.getLedgerSummary(testOrganizations.org1.id);

        expect(result.totalCredits).toBe(0);
        expect(result.totalDebits).toBe(0);
        expect(result.computedBalance).toBe(0);
        expect(result.transactionCount).toBe(0);
      });
    });

    describe('creditOrganization()', () => {
      it('should credit organization tokens', async () => {
        (sqliteAsync.runAsync as any)
          .mockResolvedValueOnce({ changes: 1 }) // Update org balance
          .mockResolvedValueOnce({ changes: 1 }); // Insert ledger entry

        const result = await service.creditOrganization(
          testOrganizations.org1.id,
          1000,
          {
            userId: testUsers.user.id,
            reason: 'Test credit',
            refType: 'GRANT',
            refId: 'ref-123',
          }
        );

        expect(result.ledgerId).toBeDefined();
        expect(result.tokens).toBe(1000);
        expect(result.orgId).toBe(testOrganizations.org1.id);
      });

      it('should throw error when organization not found', async () => {
        (sqliteAsync.runAsync as any).mockResolvedValueOnce({ changes: 0 });

        await expect(
          service.creditOrganization('non-existent', 1000)
        ).rejects.toThrow('Organization not found');
      });
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate balances by organization', async () => {
      const org1Balance = {
        token_balance: 5000,
        billing_status: 'ACTIVE',
        organization_type: 'ENTERPRISE',
      };
      const org2Balance = {
        token_balance: 1000,
        billing_status: 'ACTIVE',
        organization_type: 'ENTERPRISE',
      };

      (DbPromise.get as any)
        .mockResolvedValueOnce(org1Balance)
        .mockResolvedValueOnce(org2Balance);

      const result1 = await service.getOrgBalance(testOrganizations.org1.id);
      const result2 = await service.getOrgBalance(testOrganizations.org2.id);

      expect(result1.balance).toBe(5000);
      expect(result2.balance).toBe(1000);
      expect(result1.balance).not.toBe(result2.balance);
      
      // Verify queries were called with correct organization IDs
      expect(DbPromise.get).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        [testOrganizations.org1.id],
        { fallback: false }
      );
      expect(DbPromise.get).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        [testOrganizations.org2.id],
        { fallback: false }
      );
    });

    it('should isolate user balances', async () => {
      const user1Balance = {
        user_id: testUsers.user.id,
        platform_tokens: 1000,
        platform_tokens_bonus: 100,
        byok_usage_tokens: 0,
        local_usage_tokens: 0,
      };
      const user2Balance = {
        user_id: testUsers.org2Admin.id,
        platform_tokens: 500,
        platform_tokens_bonus: 50,
        byok_usage_tokens: 0,
        local_usage_tokens: 0,
      };

      (DbPromise.get as any)
        .mockResolvedValueOnce(user1Balance)
        .mockResolvedValueOnce(user2Balance);

      const result1 = await service.getBalance(testUsers.user.id);
      const result2 = await service.getBalance(testUsers.org2Admin.id);

      expect(result1.platform_tokens).toBe(1000);
      expect(result2.platform_tokens).toBe(500);
      expect(result1.platform_tokens).not.toBe(result2.platform_tokens);
    });
  });
});

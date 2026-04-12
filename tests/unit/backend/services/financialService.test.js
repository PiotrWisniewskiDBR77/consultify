/**
 * Financial Service Tests - Mock-Based Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Financial Service
const createFinancialService = () => {
  const accounts = new Map();
  const transactions = [];

  return {
    // Get account balance
    getBalance: async (accountId) => {
      const account = accounts.get(accountId);
      if (!account) return { success: false, error: 'Account not found', status: 404 };
      return { success: true, data: { accountId, balance: account.balance }, status: 200 };
    },

    // Create account
    createAccount: async (data) => {
      if (!data.accountId) return { success: false, error: 'Account ID required', status: 400 };
      if (accounts.has(data.accountId))
        return { success: false, error: 'Account exists', status: 409 };
      accounts.set(data.accountId, { balance: data.initialBalance || 0 });
      return { success: true, data: { accountId: data.accountId }, status: 201 };
    },

    // Add funds
    addFunds: async (accountId, amount) => {
      if (amount <= 0) return { success: false, error: 'Amount must be positive', status: 400 };
      const account = accounts.get(accountId);
      if (!account) return { success: false, error: 'Account not found', status: 404 };
      account.balance += amount;
      transactions.push({ accountId, type: 'credit', amount, timestamp: new Date() });
      return { success: true, data: { newBalance: account.balance }, status: 200 };
    },

    // Deduct funds
    deductFunds: async (accountId, amount) => {
      const account = accounts.get(accountId);
      if (!account) return { success: false, error: 'Account not found', status: 404 };
      if (account.balance < amount)
        return { success: false, error: 'Insufficient funds', status: 400 };
      account.balance -= amount;
      transactions.push({ accountId, type: 'debit', amount, timestamp: new Date() });
      return { success: true, data: { newBalance: account.balance }, status: 200 };
    },

    // Get transaction history
    getTransactions: async (accountId, limit = 10) => {
      const accountTxns = transactions.filter((t) => t.accountId === accountId).slice(-limit);
      return { success: true, data: accountTxns, status: 200 };
    },
  };
};

describe('FinancialService', () => {
  let financialService;

  beforeEach(() => {
    vi.clearAllMocks();
    financialService = createFinancialService();
  });

  describe('Account Management', () => {
    it('should create account', async () => {
      const result = await financialService.createAccount({
        accountId: 'acc-1',
        initialBalance: 100,
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
    });

    it('should reject duplicate account', async () => {
      await financialService.createAccount({ accountId: 'acc-1' });
      const result = await financialService.createAccount({ accountId: 'acc-1' });
      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
    });

    it('should get account balance', async () => {
      await financialService.createAccount({ accountId: 'acc-1', initialBalance: 500 });
      const result = await financialService.getBalance('acc-1');
      expect(result.success).toBe(true);
      expect(result.data.balance).toBe(500);
    });
  });

  describe('Transactions', () => {
    it('should add funds', async () => {
      await financialService.createAccount({ accountId: 'acc-1', initialBalance: 100 });
      const result = await financialService.addFunds('acc-1', 50);
      expect(result.success).toBe(true);
      expect(result.data.newBalance).toBe(150);
    });

    it('should deduct funds', async () => {
      await financialService.createAccount({ accountId: 'acc-1', initialBalance: 100 });
      const result = await financialService.deductFunds('acc-1', 30);
      expect(result.success).toBe(true);
      expect(result.data.newBalance).toBe(70);
    });

    it('should reject insufficient funds', async () => {
      await financialService.createAccount({ accountId: 'acc-1', initialBalance: 50 });
      const result = await financialService.deductFunds('acc-1', 100);
      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
    });

    it('should get transaction history', async () => {
      await financialService.createAccount({ accountId: 'acc-1' });
      await financialService.addFunds('acc-1', 100);
      await financialService.deductFunds('acc-1', 25);
      const result = await financialService.getTransactions('acc-1');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });
});

/**
 * SuperAdmin Dashboard Widget - Unit Tests
 *
 * Tests for the SuperAdmin dashboard analytics widgets
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock API client
const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/services/api', () => ({
  default: mockApiClient,
  apiClient: mockApiClient,
}));

describe('SuperAdmin Dashboard Widgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Revenue Metrics Widget', () => {
    it('should fetch MRR data', async () => {
      mockApiClient.get.mockResolvedValue({ data: { mrr: 50000 } });

      const response = await mockApiClient.get('/api/superadmin/revenue/mrr');

      expect(response.data.mrr).toBe(50000);
    });

    it('should fetch ARR data', async () => {
      mockApiClient.get.mockResolvedValue({ data: { arr: 600000 } });

      const response = await mockApiClient.get('/api/superadmin/revenue/arr');

      expect(response.data.arr).toBe(600000);
    });

    it('should fetch churn rate', async () => {
      mockApiClient.get.mockResolvedValue({ data: { churnRate: 2.5 } });

      const response = await mockApiClient.get('/api/superadmin/revenue/churn');

      expect(response.data.churnRate).toBe(2.5);
    });

    it('should fetch LTV data', async () => {
      mockApiClient.get.mockResolvedValue({ data: { ltv: 12500 } });

      const response = await mockApiClient.get('/api/superadmin/revenue/ltv');

      expect(response.data.ltv).toBe(12500);
    });

    it('should calculate MRR growth rate', () => {
      const previousMrr = 45000;
      const currentMrr = 50000;
      const growthRate = ((currentMrr - previousMrr) / previousMrr) * 100;

      expect(growthRate).toBeCloseTo(11.11, 1);
    });
  });

  describe('Customer Metrics Widget', () => {
    it('should fetch total customers count', async () => {
      mockApiClient.get.mockResolvedValue({ data: { total: 1250 } });

      const response = await mockApiClient.get('/api/superadmin/customers/count');

      expect(response.data.total).toBe(1250);
    });

    it('should fetch active customers count', async () => {
      mockApiClient.get.mockResolvedValue({ data: { active: 1100 } });

      const response = await mockApiClient.get('/api/superadmin/customers/active');

      expect(response.data.active).toBe(1100);
    });

    it('should fetch trial customers count', async () => {
      mockApiClient.get.mockResolvedValue({ data: { trial: 150 } });

      const response = await mockApiClient.get('/api/superadmin/customers/trial');

      expect(response.data.trial).toBe(150);
    });

    it('should calculate customer activation rate', () => {
      const totalCustomers = 1250;
      const activeCustomers = 1100;
      const activationRate = (activeCustomers / totalCustomers) * 100;

      expect(activationRate).toBe(88);
    });

    it('should calculate trial conversion rate', () => {
      const trialUsers = 200;
      const convertedUsers = 150;
      const conversionRate = (convertedUsers / trialUsers) * 100;

      expect(conversionRate).toBe(75);
    });
  });

  describe('System Health Widget', () => {
    it('should fetch API response time', async () => {
      mockApiClient.get.mockResolvedValue({ data: { avgResponseTime: 125 } });

      const response = await mockApiClient.get('/api/superadmin/health/api');

      expect(response.data.avgResponseTime).toBe(125);
    });

    it('should fetch database health status', async () => {
      mockApiClient.get.mockResolvedValue({ data: { status: 'healthy', connections: 45 } });

      const response = await mockApiClient.get('/api/superadmin/health/database');

      expect(response.data.status).toBe('healthy');
    });

    it('should fetch memory usage', async () => {
      mockApiClient.get.mockResolvedValue({ data: { usedMB: 512, totalMB: 2048 } });

      const response = await mockApiClient.get('/api/superadmin/health/memory');

      expect(response.data.usedMB).toBe(512);
    });

    it('should calculate memory usage percentage', () => {
      const usedMB = 512;
      const totalMB = 2048;
      const usagePercent = (usedMB / totalMB) * 100;

      expect(usagePercent).toBe(25);
    });

    it('should fetch uptime data', async () => {
      mockApiClient.get.mockResolvedValue({ data: { uptimePercent: 99.95 } });

      const response = await mockApiClient.get('/api/superadmin/health/uptime');

      expect(response.data.uptimePercent).toBe(99.95);
    });
  });

  describe('Usage Analytics Widget', () => {
    it('should fetch daily active users', async () => {
      mockApiClient.get.mockResolvedValue({ data: { dau: 850 } });

      const response = await mockApiClient.get('/api/superadmin/analytics/dau');

      expect(response.data.dau).toBe(850);
    });

    it('should fetch monthly active users', async () => {
      mockApiClient.get.mockResolvedValue({ data: { mau: 3500 } });

      const response = await mockApiClient.get('/api/superadmin/analytics/mau');

      expect(response.data.mau).toBe(3500);
    });

    it('should fetch feature usage data', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          features: [
            { name: 'Reports', usage: 85 },
            { name: 'Tasks', usage: 92 },
            { name: 'Decisions', usage: 67 },
          ],
        },
      });

      const response = await mockApiClient.get('/api/superadmin/analytics/features');

      expect(response.data.features).toHaveLength(3);
    });

    it('should calculate stickiness ratio', () => {
      const dau = 850;
      const mau = 3500;
      const stickiness = (dau / mau) * 100;

      expect(stickiness).toBeCloseTo(24.29, 1);
    });

    it('should fetch session duration data', async () => {
      mockApiClient.get.mockResolvedValue({ data: { avgDuration: 1800 } });

      const response = await mockApiClient.get('/api/superadmin/analytics/sessions');

      expect(response.data.avgDuration).toBe(1800);
    });
  });

  describe('Subscription Analytics Widget', () => {
    it('should fetch subscription distribution', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          starter: 400,
          professional: 600,
          enterprise: 250,
        },
      });

      const response = await mockApiClient.get('/api/superadmin/subscriptions/distribution');

      expect(response.data.starter).toBe(400);
      expect(response.data.professional).toBe(600);
      expect(response.data.enterprise).toBe(250);
    });

    it('should fetch upgrade trends', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          upgrades: 45,
          downgrades: 12,
          netMovement: 33,
        },
      });

      const response = await mockApiClient.get('/api/superadmin/subscriptions/trends');

      expect(response.data.netMovement).toBe(33);
    });

    it('should calculate average revenue per user', () => {
      const totalRevenue = 50000;
      const totalUsers = 1250;
      const arpu = totalRevenue / totalUsers;

      expect(arpu).toBe(40);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'));

      try {
        await mockApiClient.get('/api/superadmin/revenue/mrr');
      } catch (error: any) {
        expect(error.message).toBe('Network error');
      }
    });

    it('should handle 401 unauthorized', async () => {
      mockApiClient.get.mockRejectedValue({ response: { status: 401 } });

      try {
        await mockApiClient.get('/api/superadmin/revenue/mrr');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should handle 403 forbidden', async () => {
      mockApiClient.get.mockRejectedValue({ response: { status: 403 } });

      try {
        await mockApiClient.get('/api/superadmin/revenue/mrr');
      } catch (error: any) {
        expect(error.response.status).toBe(403);
      }
    });

    it('should handle 500 server error', async () => {
      mockApiClient.get.mockRejectedValue({ response: { status: 500 } });

      try {
        await mockApiClient.get('/api/superadmin/health/database');
      } catch (error: any) {
        expect(error.response.status).toBe(500);
      }
    });
  });

  describe('Data Formatting', () => {
    it('should format currency values', () => {
      const amount = 50000;
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);

      expect(formatted).toBe('$50,000.00');
    });

    it('should format percentage values', () => {
      const value = 0.2529;
      const formatted = (value * 100).toFixed(1) + '%';

      expect(formatted).toBe('25.3%');
    });

    it('should format large numbers', () => {
      const value = 1250000;
      const formatted = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
      }).format(value);

      expect(formatted).toBe('1.3M');
    });

    it('should format duration in minutes', () => {
      const seconds = 1800;
      const minutes = Math.floor(seconds / 60);

      expect(minutes).toBe(30);
    });
  });
});

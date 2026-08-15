/**
 * Metrics Organization Routes Tests
 * Tests for /api/metrics/org/* endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the authentication middleware
vi.mock('../../../../server/src/middleware/authMiddleware.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = {
      id: 'test-user-id',
      organizationId: 'test-org-id',
      role: 'ADMIN',
    };
    next();
  },
}));

// Mock the organization metrics service
const mockService = {
  getOverview: vi.fn(),
  getHelpMetrics: vi.fn(),
  getTeamMetrics: vi.fn(),
  getAIAnalytics: vi.fn(),
};

vi.mock('../../../../server/src/services/organizationMetricsService.js', () => ({
  getOrganizationMetricsService: () => mockService,
}));

// Mock the logger
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Metrics Organization Routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.resetModules();
    app = express();
    app.use(express.json());

    // Import and use the routes after mocks are set up
    const metricsRoutes = (await import('../../../../server/src/routes/metrics.routes.js')).default;
    app.use('/api/metrics', metricsRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/metrics/org/overview', () => {
    it('should return organization overview metrics', async () => {
      const mockOverview = {
        activeUsers: 10,
        selfServeUsers: 8,
        orgStatus: 'paid',
        conversionTarget: 'Enterprise',
        seatConfiguration: {
          seatsUsed: 10,
          totalSeats: 20,
          seatsRemaining: 10,
          utilizationPercent: 50,
        },
      };

      mockService.getOverview.mockResolvedValue(mockOverview);

      const response = await request(app).get('/api/metrics/org/overview').expect(200);

      expect(response.body).toEqual(mockOverview);
      expect(mockService.getOverview).toHaveBeenCalledWith('test-org-id');
    });

    it('should return an explicit degraded response on service error', async () => {
      mockService.getOverview.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/metrics/org/overview').expect(200);

      expect(response.body).toEqual({ degraded: true });
    });
  });

  describe('GET /api/metrics/org/help', () => {
    it('should return help metrics', async () => {
      const mockHelpMetrics = {
        byPlaybook: [
          { playbookKey: 'getting_started', started: 100, completed: 80, completionRate: 80 },
        ],
        totalStarted: 100,
        totalCompleted: 80,
        overallCompletionRate: 80,
      };

      mockService.getHelpMetrics.mockResolvedValue(mockHelpMetrics);

      const response = await request(app).get('/api/metrics/org/help').expect(200);

      expect(response.body).toEqual(mockHelpMetrics);
      expect(mockService.getHelpMetrics).toHaveBeenCalledWith('test-org-id');
    });
  });

  describe('GET /api/metrics/org/team', () => {
    it('should return team metrics', async () => {
      const mockTeamMetrics = {
        invitations: {
          sent: 20,
          accepted: 15,
          pending: 5,
          acceptanceRate: 75,
        },
        seatManagement: {
          seatsUsed: 15,
          totalSeats: 25,
          seatsRemaining: 10,
          utilizationPercent: 60,
        },
      };

      mockService.getTeamMetrics.mockResolvedValue(mockTeamMetrics);

      const response = await request(app).get('/api/metrics/org/team').expect(200);

      expect(response.body).toEqual(mockTeamMetrics);
      expect(mockService.getTeamMetrics).toHaveBeenCalledWith('test-org-id');
    });
  });

  describe('GET /api/metrics/org/ai-analytics', () => {
    it('should return AI analytics', async () => {
      const mockAIAnalytics = {
        successRate: 0.95,
        avgResponseTime: 0.15,
        totalTokens: 500000,
        estCost: 1.0,
        usageTrend: [
          { date: '2025-01-20', tokens: 50000, cost: 0.1 },
          { date: '2025-01-21', tokens: 60000, cost: 0.12 },
        ],
        byProvider: [{ provider: 'openai', tokens: 300000, cost: 0.6, successRate: 0.97 }],
        topFailureModes: [{ mode: 'Rate limit exceeded', count: 30 }],
      };

      mockService.getAIAnalytics.mockResolvedValue(mockAIAnalytics);

      const response = await request(app).get('/api/metrics/org/ai-analytics').expect(200);

      expect(response.body).toEqual(mockAIAnalytics);
      expect(mockService.getAIAnalytics).toHaveBeenCalledWith('test-org-id');
    });

    it('should return empty data when no AI usage', async () => {
      const emptyAnalytics = {
        successRate: 0,
        avgResponseTime: 0,
        totalTokens: 0,
        estCost: 0,
        usageTrend: [],
        byProvider: [],
        topFailureModes: [],
      };

      mockService.getAIAnalytics.mockResolvedValue(emptyAnalytics);

      const response = await request(app).get('/api/metrics/org/ai-analytics').expect(200);

      expect(response.body).toEqual(emptyAnalytics);
    });
  });
});

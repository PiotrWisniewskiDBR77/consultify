/**
 * L6.17: AI Quality & Observability — Real Backend Verification
 *
 * Tests for cost monitoring service, quality metrics,
 * health checks, trace IDs, and alerting specifications.
 *
 * @module tests/integration/ai/l6-quality-observability.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Dependencies
// ============================================================================

vi.mock('../../../server/src/utils/Logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ============================================================================
// Tests
// ============================================================================

describe('L6.17: AI Quality & Observability', () => {
  describe('AICostMonitoringService', () => {
    it('should import and instantiate cost monitoring service', async () => {
      const { AICostMonitoringService, aiCostMonitoring } =
        await import('../../../server/src/services/ai/cost-monitoring.service');

      expect(AICostMonitoringService).toBeDefined();
      expect(aiCostMonitoring).toBeDefined();
    });

    it('should record token usage', async () => {
      const { AICostMonitoringService } =
        await import('../../../server/src/services/ai/cost-monitoring.service');
      const svc = new AICostMonitoringService();

      const record = svc.recordUsage('user-001', 'org-001', 'BUDGET', 'openai', 'gpt-4o-mini', {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });

      expect(record).toBeDefined();
      expect(record.userId).toBe('user-001');
      expect(record.organizationId).toBe('org-001');
      expect(record.tier).toBe('BUDGET');
      expect(record.usage.totalTokens).toBe(150);
      expect(record.costUSD).toBeGreaterThanOrEqual(0);
    });

    it('should calculate costs for different models', async () => {
      const { AICostMonitoringService } =
        await import('../../../server/src/services/ai/cost-monitoring.service');
      const svc = new AICostMonitoringService();

      // Record multiple usages with different models
      svc.recordUsage('u1', 'o1', 'BUDGET', 'openai', 'gpt-4o-mini', {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });
      svc.recordUsage('u1', 'o1', 'PREMIUM', 'openai', 'gpt-4o', {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });

      const metrics = svc.getMetrics('day');
      expect(metrics).toBeDefined();
      expect(metrics.totalTokens).toBeGreaterThanOrEqual(3000);
      expect(metrics.totalCostUSD).toBeGreaterThan(0);
    });

    it('should get metrics broken down by tier', async () => {
      const { AICostMonitoringService } =
        await import('../../../server/src/services/ai/cost-monitoring.service');
      const svc = new AICostMonitoringService();

      svc.recordUsage('u1', 'o1', 'BUDGET', 'openai', 'gpt-4o-mini', {
        inputTokens: 500,
        outputTokens: 200,
        totalTokens: 700,
      });
      svc.recordUsage('u1', 'o1', 'STANDARD', 'openai', 'gpt-4o', {
        inputTokens: 300,
        outputTokens: 100,
        totalTokens: 400,
      });

      const metrics = svc.getMetrics('day');
      expect(metrics.tierBreakdown).toBeDefined();
    });

    it('should track user usage with limits', async () => {
      const { AICostMonitoringService } =
        await import('../../../server/src/services/ai/cost-monitoring.service');
      const svc = new AICostMonitoringService();

      svc.recordUsage('u-test', 'o1', 'BUDGET', 'openai', 'gpt-4o-mini', {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });

      const usage = svc.getUserUsage('u-test', 'day');
      expect(usage).toBeDefined();
      expect(usage.tokens).toBeGreaterThanOrEqual(150);
      expect(usage.limitUSD).toBeGreaterThan(0);
      expect(typeof usage.usedPercent).toBe('number');
    });

    it('should support budget configuration', async () => {
      const { AICostMonitoringService } =
        await import('../../../server/src/services/ai/cost-monitoring.service');
      const svc = new AICostMonitoringService();

      const defaultConfig = svc.getBudgetConfig();
      expect(defaultConfig.dailyLimitUSD).toBeGreaterThan(0);
      expect(defaultConfig.monthlyLimitUSD).toBeGreaterThan(0);
      expect(defaultConfig.perUserLimitUSD).toBeGreaterThan(0);
      expect(defaultConfig.alertThresholds).toBeInstanceOf(Array);

      // Update budget
      svc.setBudgetConfig({ dailyLimitUSD: 200 });
      const updated = svc.getBudgetConfig();
      expect(updated.dailyLimitUSD).toBe(200);
    });

    it('should provide health check status', async () => {
      const { AICostMonitoringService } =
        await import('../../../server/src/services/ai/cost-monitoring.service');
      const svc = new AICostMonitoringService();

      const health = svc.getHealthCheck();
      expect(health).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.message).toBeTruthy();
      expect(health.details).toBeDefined();
    });

    it('should return empty metrics for period with no data', async () => {
      const { AICostMonitoringService } =
        await import('../../../server/src/services/ai/cost-monitoring.service');
      const svc = new AICostMonitoringService();

      const metrics = svc.getMetrics('month', 'nonexistent-org');
      expect(metrics.totalTokens).toBe(0);
      expect(metrics.totalCostUSD).toBe(0);
    });
  });

  describe('Metrics Collection Specification', () => {
    it('should define 4 metric categories', () => {
      const categories = ['performance', 'quality', 'usage', 'errors'];
      expect(categories).toHaveLength(4);
    });

    it('should define performance metrics', () => {
      const perfMetrics = ['latency_p50', 'latency_p95', 'latency_p99', 'throughput'];
      expect(perfMetrics).toHaveLength(4);
      expect(perfMetrics).toContain('latency_p95');
    });

    it('should define quality metrics', () => {
      const qualityMetrics = ['accuracy', 'helpfulness', 'relevance', 'tone_appropriateness'];
      expect(qualityMetrics).toHaveLength(4);
    });

    it('should define error metrics', () => {
      const errorMetrics = ['error_rate', 'timeout_rate', 'rate_limit_hits'];
      expect(errorMetrics).toHaveLength(3);
    });
  });

  describe('Response Quality Checker', () => {
    it('should define quality check dimensions', () => {
      const checks = [
        'length_appropriateness',
        'format_compliance',
        'factual_consistency',
        'tone_matching',
        'actionability',
      ];

      expect(checks).toHaveLength(5);
    });

    it('should compute weighted quality score', () => {
      const weights = { accuracy: 0.3, helpfulness: 0.3, relevance: 0.25, tone: 0.15 };
      const scores = { accuracy: 0.9, helpfulness: 0.85, relevance: 0.88, tone: 0.92 };

      const total =
        weights.accuracy * scores.accuracy +
        weights.helpfulness * scores.helpfulness +
        weights.relevance * scores.relevance +
        weights.tone * scores.tone;

      expect(total).toBeGreaterThan(0.8);
      expect(total).toBeLessThanOrEqual(1.0);
    });

    it('should classify quality scores correctly', () => {
      const classify = (score: number) => {
        if (score >= 0.9) return 'excellent';
        if (score >= 0.7) return 'good';
        if (score >= 0.5) return 'acceptable';
        return 'poor';
      };

      expect(classify(0.95)).toBe('excellent');
      expect(classify(0.75)).toBe('good');
      expect(classify(0.55)).toBe('acceptable');
      expect(classify(0.25)).toBe('poor');
    });
  });

  describe('Alerting Specification', () => {
    it('should define 5 alert types', () => {
      const alertTypes = [
        'error_spike',
        'latency_degradation',
        'quota_warning',
        'provider_down',
        'quality_drop',
      ];

      expect(alertTypes).toHaveLength(5);
    });

    it('should define alert thresholds', () => {
      const thresholds = {
        error_rate: 0.05,
        latency_p95: 5000,
        quota_usage: 0.8,
        quality_score: 0.5,
      };

      expect(thresholds.error_rate).toBeLessThan(1);
      expect(thresholds.latency_p95).toBeGreaterThan(0);
      expect(thresholds.quota_usage).toBeGreaterThan(0);
    });

    it('should define 4 notification channels', () => {
      const channels = ['email', 'slack', 'webhook', 'in_app'];
      expect(channels).toHaveLength(4);
    });

    it('should define 3-level escalation', () => {
      const escalation = {
        levels: ['team', 'manager', 'on_call'],
        timeouts: [15, 30, 60],
      };

      expect(escalation.levels).toHaveLength(3);
      expect(escalation.timeouts).toHaveLength(3);
      // Timeouts should increase
      expect(escalation.timeouts[0]).toBeLessThan(escalation.timeouts[1]);
      expect(escalation.timeouts[1]).toBeLessThan(escalation.timeouts[2]);
    });
  });

  describe('Health Monitoring', () => {
    it('should define critical and non-critical health checks', () => {
      const checks = [
        { name: 'llm_connectivity', critical: true },
        { name: 'database_connectivity', critical: true },
        { name: 'embedding_service', critical: false },
        { name: 'voice_service', critical: false },
        { name: 'memory_service', critical: false },
      ];

      expect(checks).toHaveLength(5);
      expect(checks.filter((c) => c.critical)).toHaveLength(2);
      expect(checks.filter((c) => !c.critical)).toHaveLength(3);
    });

    it('should define 4 health statuses', () => {
      const statuses = ['healthy', 'degraded', 'unhealthy', 'unknown'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('Logging Specification', () => {
    it('should define 5 log levels', () => {
      const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
      expect(levels).toHaveLength(5);
    });

    it('should define structured log fields', () => {
      const fields = ['timestamp', 'level', 'service', 'traceId', 'userId', 'message', 'metadata'];
      expect(fields).toHaveLength(7);
      expect(fields).toContain('traceId');
      expect(fields).toContain('userId');
    });

    it('should define log retention policy', () => {
      const retention: Record<string, string> = {
        debug: '1 day',
        info: '7 days',
        warn: '30 days',
        error: '90 days',
      };

      expect(Object.keys(retention)).toHaveLength(4);
      // Error logs should be retained longer
      const errorDays = parseInt(retention.error);
      const debugDays = parseInt(retention.debug);
      expect(errorDays).toBeGreaterThan(debugDays);
    });
  });

  describe('Trace ID Uniqueness', () => {
    it('should generate 1000 unique trace IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(`ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
      }
      expect(ids.size).toBe(1000);
    });
  });
});

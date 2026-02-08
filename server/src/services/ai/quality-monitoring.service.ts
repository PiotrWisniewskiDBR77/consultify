/**
 * AI Quality Monitoring Service (L6.9)
 *
 * Monitors AI response quality metrics including:
 * - Response time tracking (p50, p95, p99)
 * - Error rate calculation
 * - Retry rate monitoring
 * - Response length statistics
 *
 * @module server/src/services/ai/quality-monitoring.service.ts
 * @version 1.0.0
 */

import logger from '../../utils/Logger.js';

// ============================================================================
// Types
// ============================================================================

export interface QualityMetrics {
  timestamp: string;
  period: 'hour' | 'day' | 'week';
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
  errorRate: number;
  retryRate: number;
  successRate: number;
  responseLength: {
    avg: number;
    min: number;
    max: number;
  };
  totalRequests: number;
  healthStatus: 'healthy' | 'degraded' | 'critical';
}

export interface RequestMetric {
  id: string;
  startTime: number;
  endTime?: number;
  tier: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
  success: boolean;
  retried: boolean;
  responseLength?: number;
  errorMessage?: string;
}

interface MetricWindow {
  requests: RequestMetric[];
  startTime: number;
}

// ============================================================================
// Quality Monitoring Service
// ============================================================================

class AIQualityMonitoringService {
  private metricWindow: MetricWindow;
  private readonly WINDOW_SIZE_MS = 60 * 60 * 1000; // 1 hour
  private readonly MAX_REQUESTS = 10000; // Max requests to keep in memory

  // Quality thresholds
  private readonly THRESHOLDS = {
    responseTimeP95: 5000, // 5 seconds for standard tier
    responseTimeP95Reasoning: 30000, // 30 seconds for reasoning tier
    errorRate: 0.01, // 1%
    retryRate: 0.05, // 5%
  };

  constructor() {
    this.metricWindow = {
      requests: [],
      startTime: Date.now(),
    };
  }

  /**
   * Record start of an AI request
   */
  startRequest(id: string, tier: RequestMetric['tier']): void {
    const metric: RequestMetric = {
      id,
      startTime: Date.now(),
      tier,
      success: false,
      retried: false,
    };

    this.metricWindow.requests.push(metric);
    this.pruneOldMetrics();
  }

  /**
   * Record completion of an AI request
   */
  endRequest(
    id: string,
    success: boolean,
    options?: {
      retried?: boolean;
      responseLength?: number;
      errorMessage?: string;
    }
  ): void {
    const metric = this.metricWindow.requests.find((m) => m.id === id);
    if (metric) {
      metric.endTime = Date.now();
      metric.success = success;
      metric.retried = options?.retried ?? false;
      metric.responseLength = options?.responseLength;
      metric.errorMessage = options?.errorMessage;
    }
  }

  /**
   * Get current quality metrics
   */
  getMetrics(period: QualityMetrics['period'] = 'hour'): QualityMetrics {
    const cutoff = this.getCutoffTime(period);
    const recentRequests = this.metricWindow.requests.filter(
      (r) => r.startTime >= cutoff && r.endTime
    );

    if (recentRequests.length === 0) {
      return this.getEmptyMetrics(period);
    }

    // Calculate response times
    const responseTimes = recentRequests
      .filter((r) => r.endTime)
      .map((r) => r.endTime! - r.startTime)
      .sort((a, b) => a - b);

    const responseTimeStats = {
      p50: this.percentile(responseTimes, 50),
      p95: this.percentile(responseTimes, 95),
      p99: this.percentile(responseTimes, 99),
      avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
    };

    // Calculate rates
    const totalRequests = recentRequests.length;
    const errorCount = recentRequests.filter((r) => !r.success).length;
    const retryCount = recentRequests.filter((r) => r.retried).length;
    const successCount = recentRequests.filter((r) => r.success).length;

    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;
    const retryRate = totalRequests > 0 ? retryCount / totalRequests : 0;
    const successRate = totalRequests > 0 ? successCount / totalRequests : 1;

    // Calculate response length stats
    const responseLengths = recentRequests
      .filter((r) => r.responseLength !== undefined)
      .map((r) => r.responseLength!);

    const responseLengthStats = {
      avg:
        responseLengths.length > 0
          ? responseLengths.reduce((a, b) => a + b, 0) / responseLengths.length
          : 0,
      min: responseLengths.length > 0 ? Math.min(...responseLengths) : 0,
      max: responseLengths.length > 0 ? Math.max(...responseLengths) : 0,
    };

    // Determine health status
    const healthStatus = this.calculateHealthStatus(responseTimeStats.p95, errorRate, retryRate);

    return {
      timestamp: new Date().toISOString(),
      period,
      responseTime: responseTimeStats,
      errorRate,
      retryRate,
      successRate,
      responseLength: responseLengthStats,
      totalRequests,
      healthStatus,
    };
  }

  /**
   * Check if quality is within acceptable thresholds
   */
  isHealthy(): boolean {
    const metrics = this.getMetrics('hour');
    return metrics.healthStatus === 'healthy';
  }

  /**
   * Get quality alerts
   */
  getAlerts(): string[] {
    const alerts: string[] = [];
    const metrics = this.getMetrics('hour');

    if (metrics.errorRate > this.THRESHOLDS.errorRate) {
      alerts.push(
        `Error rate (${(metrics.errorRate * 100).toFixed(2)}%) exceeds threshold (${this.THRESHOLDS.errorRate * 100}%)`
      );
    }

    if (metrics.retryRate > this.THRESHOLDS.retryRate) {
      alerts.push(
        `Retry rate (${(metrics.retryRate * 100).toFixed(2)}%) exceeds threshold (${this.THRESHOLDS.retryRate * 100}%)`
      );
    }

    if (metrics.responseTime.p95 > this.THRESHOLDS.responseTimeP95) {
      alerts.push(
        `P95 response time (${metrics.responseTime.p95}ms) exceeds threshold (${this.THRESHOLDS.responseTimeP95}ms)`
      );
    }

    return alerts;
  }

  /**
   * Get health check result for L6 integration
   */
  getHealthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
    details: Record<string, unknown>;
  } {
    const metrics = this.getMetrics('hour');
    const alerts = this.getAlerts();

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (metrics.healthStatus === 'healthy') {
      status = 'healthy';
    } else if (metrics.healthStatus === 'degraded') {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      message:
        status === 'healthy'
          ? 'AI quality metrics are within acceptable thresholds'
          : `Quality issues detected: ${alerts.join('; ')}`,
      details: {
        p95ResponseTime: metrics.responseTime.p95,
        errorRate: metrics.errorRate,
        retryRate: metrics.retryRate,
        totalRequests: metrics.totalRequests,
        alerts,
      },
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private getCutoffTime(period: QualityMetrics['period']): number {
    const now = Date.now();
    switch (period) {
      case 'hour':
        return now - 60 * 60 * 1000;
      case 'day':
        return now - 24 * 60 * 60 * 1000;
      case 'week':
        return now - 7 * 24 * 60 * 60 * 1000;
      default:
        return now - 60 * 60 * 1000;
    }
  }

  private calculateHealthStatus(
    p95ResponseTime: number,
    errorRate: number,
    retryRate: number
  ): 'healthy' | 'degraded' | 'critical' {
    const isCritical =
      errorRate > this.THRESHOLDS.errorRate * 5 ||
      p95ResponseTime > this.THRESHOLDS.responseTimeP95 * 3;

    const isDegraded =
      errorRate > this.THRESHOLDS.errorRate ||
      retryRate > this.THRESHOLDS.retryRate ||
      p95ResponseTime > this.THRESHOLDS.responseTimeP95;

    if (isCritical) return 'critical';
    if (isDegraded) return 'degraded';
    return 'healthy';
  }

  private pruneOldMetrics(): void {
    const cutoff = Date.now() - this.WINDOW_SIZE_MS;
    this.metricWindow.requests = this.metricWindow.requests.filter((r) => r.startTime >= cutoff);

    // Also limit by count
    if (this.metricWindow.requests.length > this.MAX_REQUESTS) {
      this.metricWindow.requests = this.metricWindow.requests.slice(-this.MAX_REQUESTS);
    }
  }

  private getEmptyMetrics(period: QualityMetrics['period']): QualityMetrics {
    return {
      timestamp: new Date().toISOString(),
      period,
      responseTime: { p50: 0, p95: 0, p99: 0, avg: 0 },
      errorRate: 0,
      retryRate: 0,
      successRate: 1,
      responseLength: { avg: 0, min: 0, max: 0 },
      totalRequests: 0,
      healthStatus: 'healthy',
    };
  }
}

// Export singleton instance
export const aiQualityMonitoring = new AIQualityMonitoringService();

// Export class for testing
export { AIQualityMonitoringService };

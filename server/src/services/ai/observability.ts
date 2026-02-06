/**
 * AI Observability Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Centralized metrics: request count, latency P50/P95/P99, error rate,
 * per-model/provider breakdown, streaming stability, SLO tracking, alerts.
 */
import logger from '../../utils/Logger.js';

export interface AIRequestMetric {
  timestamp: number;
  provider: string;
  model: string;
  tier: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
  errorType?: string;
  streaming: boolean;
}

export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
}

export interface SLOStatus {
  availability: { target: number; actual: number; met: boolean };
  latencyP95: { targetMs: number; actualMs: number; met: boolean };
  errorRate: { target: number; actual: number; met: boolean };
}

const SLO = { availability: 0.995, latencyP95Ms: 5000, errorRate: 0.02 };

class AIObservabilityService {
  private metrics: AIRequestMetric[] = [];
  private alerts: Array<{
    rule: string;
    severity: string;
    message: string;
    timestamp: string;
  }> = [];
  private pruneTimer = setInterval(() => {
    const cutoff = Date.now() - 86400_000;
    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoff);
  }, 300_000);

  record(m: AIRequestMetric) {
    this.metrics.push(m);
    if (this.metrics.length > 50000) this.metrics = this.metrics.slice(-50000);
    if (this.metrics.length % 50 === 0) this.evalAlerts();
  }

  recordSuccess(
    provider: string,
    model: string,
    tier: string,
    latencyMs: number,
    inputTokens: number,
    outputTokens: number,
    streaming = false
  ) {
    this.record({
      timestamp: Date.now(),
      provider,
      model,
      tier,
      latencyMs,
      inputTokens,
      outputTokens,
      success: true,
      streaming,
    });
  }

  recordError(provider: string, model: string, tier: string, latencyMs: number, errorType: string) {
    this.record({
      timestamp: Date.now(),
      provider,
      model,
      tier,
      latencyMs,
      inputTokens: 0,
      outputTokens: 0,
      success: false,
      errorType,
      streaming: false,
    });
  }

  getReport(windowMin = 60) {
    const cutoff = Date.now() - windowMin * 60_000;
    const recent = this.metrics.filter((m) => m.timestamp >= cutoff);
    const total = recent.length;
    const errors = recent.filter((m) => !m.success).length;
    const lats = recent
      .filter((m) => m.success)
      .map((m) => m.latencyMs)
      .sort((a, b) => a - b);

    const pct = (p: number) => {
      if (!lats.length) return 0;
      return lats[Math.min(Math.ceil((p / 100) * lats.length) - 1, lats.length - 1)];
    };

    const latency: LatencyPercentiles = {
      p50: pct(50),
      p95: pct(95),
      p99: pct(99),
      avg: lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0,
    };
    const errRate = total > 0 ? errors / total : 0;
    const avail = total > 0 ? 1 - errRate : 1;
    const sloStatus: SLOStatus = {
      availability: {
        target: SLO.availability,
        actual: Math.round(avail * 10000) / 10000,
        met: avail >= SLO.availability,
      },
      latencyP95: {
        targetMs: SLO.latencyP95Ms,
        actualMs: latency.p95,
        met: latency.p95 <= SLO.latencyP95Ms,
      },
      errorRate: {
        target: SLO.errorRate,
        actual: Math.round(errRate * 10000) / 10000,
        met: errRate <= SLO.errorRate,
      },
    };

    const tokens = {
      input: recent.reduce((s, m) => s + m.inputTokens, 0),
      output: recent.reduce((s, m) => s + m.outputTokens, 0),
      total: recent.reduce((s, m) => s + m.inputTokens + m.outputTokens, 0),
    };

    return {
      period: `${windowMin}m`,
      timestamp: new Date().toISOString(),
      requestCount: total,
      errorCount: errors,
      errorRate: Math.round(errRate * 10000) / 10000,
      latency,
      tokenUsage: tokens,
      sloStatus,
    };
  }

  getAlerts(limit = 50) {
    return this.alerts.slice(-limit);
  }

  getHealthCheck() {
    const r = this.getReport(15);
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (!r.sloStatus.availability.met) {
      status = 'unhealthy';
      issues.push('Availability below SLO');
    }
    if (!r.sloStatus.latencyP95.met) {
      if (status !== 'unhealthy') status = 'degraded';
      issues.push('P95 latency above SLO');
    }
    if (!r.sloStatus.errorRate.met) {
      status = 'unhealthy';
      issues.push('Error rate above SLO');
    }

    return {
      status,
      message: issues.length ? issues.join('; ') : 'All SLOs met',
      details: {
        requestCount: r.requestCount,
        errorRate: r.errorRate,
        latencyP95: r.latency.p95,
        sloStatus: r.sloStatus,
      },
    };
  }

  private evalAlerts() {
    const r = this.getReport(15);
    const fire = (name: string, sev: string, msg: string) => {
      const wasFiredRecently = this.alerts.find(
        (a) => a.rule === name && Date.now() - new Date(a.timestamp).getTime() < 300_000
      );
      if (wasFiredRecently) return;

      this.alerts.push({
        rule: name,
        severity: sev,
        message: msg,
        timestamp: new Date().toISOString(),
      });
      logger.warn(`[AIObservability] ALERT [${sev}] ${msg}`);
    };
    if (r.errorRate > 0.05 && r.requestCount >= 10) {
      fire('high_error_rate', 'critical', 'AI error rate >5%');
    }
    if (r.latency.p95 > 10000 && r.requestCount >= 5) {
      fire('high_latency', 'warning', 'P95 latency >10s');
    }
    if (this.alerts.length > 500) this.alerts = this.alerts.slice(-500);
  }

  destroy() {
    clearInterval(this.pruneTimer);
  }
}

export const aiObservability = new AIObservabilityService();
export default aiObservability;
export { AIObservabilityService };

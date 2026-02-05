/**
 * AI Health Monitor
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Minimal self-healing health monitor used by:
 * - `server/src/index.ts` (start + alerts)
 * - `GET /api/ai/health` and `POST /api/ai/health/diagnose`
 *
 * Note: The previous lazy-loader wrapper accidentally exported a Promise and caused
 * `healthMonitor.getStatus is not a function` 500s. This implementation is synchronous
 * (except diagnostics) and safe for dev/prod.
 */

import logger from '../../utils/Logger.js';

export type AIProviderHealth = {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  lastCheck?: string;
  error?: string;
};

export type AIHealthCheckSnapshot = {
  overall: 'healthy' | 'degraded' | 'error';
  timestamp: string;
  checks: Array<{
    name: string;
    status: 'healthy' | 'unhealthy';
    error?: string;
  }>;
};

export type AIHealthMonitorStatus = {
  isRunning: boolean;
  lastCheck: AIHealthCheckSnapshot | null;
  consecutiveFailures: number;
  providers: Record<string, AIProviderHealth>;
};

type Alert = { message: string; checks?: string[] };
type AlertHandler = (alert: Alert) => void;

class AIHealthMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private status: AIHealthMonitorStatus = {
    isRunning: false,
    lastCheck: null,
    consecutiveFailures: 0,
    providers: {},
  };
  private alertHandlers: AlertHandler[] = [];

  start(intervalMs = 60000): void {
    if (this.intervalId) return;
    this.status.isRunning = true;

    // Run immediately, then periodically
    void this.runDiagnostics().catch((err) =>
      logger.warn('[AIHealthMonitor] Initial diagnostics failed', { error: err?.message || err })
    );
    this.intervalId = setInterval(() => {
      void this.runDiagnostics().catch((err) =>
        logger.warn('[AIHealthMonitor] Diagnostics failed', { error: err?.message || err })
      );
    }, Math.max(5000, intervalMs));
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.status.isRunning = false;
  }

  onAlert(handler: AlertHandler): void {
    this.alertHandlers.push(handler);
  }

  getStatus(): AIHealthMonitorStatus {
    return this.status;
  }

  async runDiagnostics(): Promise<AIHealthMonitorStatus> {
    const now = new Date().toISOString();

    const checks: AIHealthCheckSnapshot['checks'] = [];
    const providers: Record<string, AIProviderHealth> = {};

    const providerDefs: Array<{
      key: string;
      ok: boolean;
      missingError: string;
    }> = [
      {
        key: 'openai',
        ok: !!process.env.OPENAI_API_KEY,
        missingError: 'OPENAI_API_KEY is not set',
      },
      {
        key: 'gemini',
        ok: !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_AI_API_KEY,
        missingError: 'GEMINI_API_KEY / GOOGLE_AI_API_KEY is not set',
      },
      {
        key: 'anthropic',
        ok: !!process.env.ANTHROPIC_API_KEY,
        missingError: 'ANTHROPIC_API_KEY is not set',
      },
      {
        key: 'mistral',
        ok: !!process.env.MISTRAL_API_KEY,
        missingError: 'MISTRAL_API_KEY is not set',
      },
    ];

    for (const p of providerDefs) {
      if (p.ok) {
        providers[p.key] = { status: 'healthy', lastCheck: now };
        checks.push({ name: `provider:${p.key}`, status: 'healthy' });
      } else {
        providers[p.key] = { status: 'unhealthy', lastCheck: now, error: p.missingError };
        checks.push({ name: `provider:${p.key}`, status: 'unhealthy', error: p.missingError });
      }
    }

    const healthyCount = Object.values(providers).filter((p) => p.status === 'healthy').length;
    const totalCount = Object.keys(providers).length;

    const overall: AIHealthCheckSnapshot['overall'] =
      healthyCount === 0 ? 'error' : healthyCount === totalCount ? 'healthy' : 'degraded';

    const snapshot: AIHealthCheckSnapshot = { overall, timestamp: now, checks };
    this.status.lastCheck = snapshot;
    this.status.providers = providers;

    if (overall === 'error') {
      this.status.consecutiveFailures += 1;
    } else {
      this.status.consecutiveFailures = 0;
    }

    // Alert after 3 consecutive failures (avoid noisy one-offs in dev)
    if (this.status.consecutiveFailures >= 3) {
      const failedChecks = checks.filter((c) => c.status === 'unhealthy').map((c) => c.name);
      const alert: Alert = {
        message: 'AI health monitor detected persistent failures',
        checks: failedChecks,
      };
      for (const handler of this.alertHandlers) {
        try {
          handler(alert);
        } catch {
          // ignore
        }
      }
    }

    return this.status;
  }
}

const healthMonitor = new AIHealthMonitor();
export default healthMonitor;

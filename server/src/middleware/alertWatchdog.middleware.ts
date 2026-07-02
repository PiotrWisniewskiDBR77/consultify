/**
 * Alert Watchdog Middleware (T107)
 *
 * Monitors API health in real-time:
 * - 5xx spike detection (sliding 5-min window)
 * - Latency tracking (p95)
 * - Alert dedup with 30-min cooldown
 * - Fail-open: errors in watchdog never block requests
 */

import type { NextFunction, Request, Response } from 'express';

import logger from '../utils/Logger.js';

type SystemAlertNotifier = { sendSystemAlert: (opts: { title: string; message: string; severity: string; source: string; throttleKey: string; throttleMs: number }) => Promise<void> };
let _systemAlertNotifier: SystemAlertNotifier | null = null;
async function getSystemAlertNotifier(): Promise<SystemAlertNotifier | null> {
  if (_systemAlertNotifier) return _systemAlertNotifier;
  try {
    const mod = await import('../services/systemAlertNotifier.js');
    _systemAlertNotifier = mod as unknown as SystemAlertNotifier;
    return _systemAlertNotifier;
  } catch {
    return null;
  }
}

interface WatchdogConfig {
  windowMs: number;
  fiveXxThreshold: number;
  latencyThresholdMs: number;
  cooldownMs: number;
}

const DEFAULT_CONFIG: WatchdogConfig = {
  windowMs: 5 * 60 * 1000,
  fiveXxThreshold: 10,
  latencyThresholdMs: 2000,
  cooldownMs: 30 * 60 * 1000,
};

interface RequestRecord {
  timestamp: number;
  statusCode: number;
  durationMs: number;
  route?: string;
}

/** Cap route strings so an adversarial URL cannot bloat memory. */
const MAX_ROUTE_LEN = 120;

function safeRoute(req: Request): string | undefined {
  try {
    const raw = String((req as any).route?.path || req.path || req.originalUrl || '').split('?')[0];
    if (!raw) return undefined;
    return raw.length > MAX_ROUTE_LEN ? `${raw.slice(0, MAX_ROUTE_LEN)}…` : raw;
  } catch {
    return undefined;
  }
}

const records: RequestRecord[] = [];
const lastAlerts: Map<string, number> = new Map();
let totalRequests = 0;
let totalFiveXx = 0;
let scheduledThresholdCheck = false;

const RES_END_PATCHED = Symbol.for('consultify.alertWatchdog.endPatched');
const RES_COMPLETED = Symbol.for('consultify.alertWatchdog.completed');
const MAX_PRUNE_PER_INVOCATION = 1000;
const MAX_RECORDS_HARD_CAP = 50_000;
const MAX_STRINGIFIED_ALERT_PAYLOAD = 8_192;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (typeof raw !== 'string' || raw.trim().length === 0) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const RUNTIME_CONFIG = {
  windowMs: readPositiveIntEnv('ALERT_WATCHDOG_WINDOW_MS', DEFAULT_CONFIG.windowMs),
  maxRecords: Math.min(
    readPositiveIntEnv('ALERT_WATCHDOG_MAX_RECORDS', MAX_RECORDS_HARD_CAP),
    MAX_RECORDS_HARD_CAP
  ),
  checkEveryN: readPositiveIntEnv('ALERT_WATCHDOG_CHECK_EVERY_N', 10),
};

function nowMs(): number {
  try {
    const now = Date.now();
    return Number.isFinite(now) ? now : 0;
  } catch {
    return 0;
  }
}

function nowMonotonicMs(): number {
  try {
    return Number(performance.now());
  } catch {
    return Number.NaN;
  }
}

function normalizeStatusCode(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (!Number.isInteger(value)) return 0;
  if (value < 100 || value > 599) return 0;
  return value;
}

function safeToErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function escapeHtml(value: unknown): string {
  if (value == null) return '';
  const asString = String(value);
  return asString
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function pruneOld(config: WatchdogConfig): void {
  const cutoff = nowMs() - config.windowMs;
  let removed = 0;
  while (
    records.length > 0 &&
    records[0].timestamp < cutoff &&
    removed < MAX_PRUNE_PER_INVOCATION
  ) {
    records.shift();
    removed += 1;
  }
}

function shouldAlert(type: string, config: WatchdogConfig): boolean {
  const last = lastAlerts.get(type);
  if (typeof last === 'number' && nowMs() - last < config.cooldownMs) return false;
  lastAlerts.set(type, nowMs());
  return true;
}

function checkThresholds(config: WatchdogConfig): void {
  pruneOld(config);
  if (records.length === 0) return;

  try {
    const fiveXxRecords = records.filter((r) => r.statusCode >= 500 && r.statusCode <= 599);
    const fiveXxInWindow = fiveXxRecords.length;
    if (fiveXxInWindow >= config.fiveXxThreshold && shouldAlert('5xx_spike', config)) {
      // Cheap context enrichment: top offending routes in the window so the
      // #alerts message is actionable rather than a bare count.
      const routeCounts = new Map<string, number>();
      for (const r of fiveXxRecords) {
        const key = r.route || 'unknown';
        routeCounts.set(key, (routeCounts.get(key) || 0) + 1);
      }
      const topRoutes = [...routeCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([r, c]) => `${r} (${c})`)
        .join(', ');
      logger.error(
        `[AlertWatchdog] 5xx SPIKE: ${fiveXxInWindow} errors in ${config.windowMs / 1000}s window`
      );
      void notifyAlert(
        'api_5xx_spike_detected',
        `5xx spike: ${fiveXxInWindow} errors in ${config.windowMs / 60000}min` +
          (topRoutes ? ` — top routes: ${topRoutes}` : '')
      );
    }
  } catch {
    // continue with latency branch
  }

  try {
    const durations = records.map((r) => r.durationMs).sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    const p95 = durations[p95Index] || 0;
    if (p95 > config.latencyThresholdMs && shouldAlert('high_latency', config)) {
      logger.warn(
        `[AlertWatchdog] HIGH LATENCY: p95=${p95.toFixed(0)}ms (threshold: ${config.latencyThresholdMs}ms)`
      );
      void notifyAlert('api_latency_spike', `p95 latency: ${p95.toFixed(0)}ms`);
    }
  } catch {
    // fail-open
  }
}

async function notifyAlert(type: string, message: string): Promise<void> {
  try {
    const emailService = await import('../services/emailService.js').then((m) => m.default || m);
    const alertEmail = process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL || '';
    if (alertEmail && emailService?.sendEmail) {
      const safeType = escapeHtml(type);
      const safeMessage = escapeHtml(message).slice(0, MAX_STRINGIFIED_ALERT_PAYLOAD);
      await emailService.sendEmail(
        alertEmail,
        `[Consultify Alert] ${safeType}`,
        `<p>${safeMessage}</p><p>Time: ${new Date().toISOString()}</p>`
      );
    }
  } catch {
    // fail-open: never block requests for alerting failures
  }

  try {
    const notifier = await getSystemAlertNotifier();
    if (notifier?.sendSystemAlert) {
      await notifier.sendSystemAlert({
        title: type,
        message,
        severity: 'WARNING',
        source: 'AlertWatchdog',
        throttleKey: `watchdog_${type}`,
        throttleMs: 30 * 60 * 1000,
      });
    }
  } catch {
    // fail-open
  }
}

export function getWatchdogStats(): {
  totalRequests: number;
  totalFiveXx: number;
  windowRequests: number;
  windowFiveXx: number;
  p95Ms: number;
} {
  try {
    const now = nowMs();
    const windowRecords = records.filter((r) => now - r.timestamp < RUNTIME_CONFIG.windowMs);
    const durations = windowRecords.map((r) => r.durationMs).sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    return {
      totalRequests,
      totalFiveXx,
      windowRequests: windowRecords.length,
      windowFiveXx: windowRecords.filter((r) => r.statusCode >= 500 && r.statusCode <= 599).length,
      p95Ms: durations[p95Index] || 0,
    };
  } catch {
    return {
      totalRequests: 0,
      totalFiveXx: 0,
      windowRequests: 0,
      windowFiveXx: 0,
      p95Ms: 0,
    };
  }
}

const alertWatchdog = (req: Request, res: Response, next: NextFunction): void => {
  if ((res as any)[RES_END_PATCHED]) {
    next();
    return;
  }

  const startWall = nowMs();
  const startMonotonic = nowMonotonicMs();
  const route = safeRoute(req);

  const originalEndFn = (() => {
    try {
      return res.end;
    } catch {
      return null;
    }
  })();
  if (typeof originalEndFn !== 'function') {
    next();
    return;
  }

  let boundOriginalEnd: ((...args: any[]) => any) | null = null;
  try {
    boundOriginalEnd = originalEndFn.bind(res) as (...args: any[]) => any;
  } catch {
    next();
    return;
  }

  try {
    Object.defineProperty(res, RES_END_PATCHED, {
      value: true,
      enumerable: false,
      configurable: true,
    });
  } catch {
    next();
    return;
  }

  (res as any).end = function (...args: any[]) {
    try {
      if (!(res as any)[RES_COMPLETED]) {
        Object.defineProperty(res, RES_COMPLETED, {
          value: true,
          enumerable: false,
          configurable: true,
        });

        const endMonotonic = nowMonotonicMs();
        const durationFromMonotonic =
          Number.isFinite(startMonotonic) && Number.isFinite(endMonotonic)
            ? Math.max(0, endMonotonic - startMonotonic)
            : Number.NaN;
        const durationFromWall = Math.max(0, nowMs() - startWall);
        const durationMs = Number.isFinite(durationFromMonotonic)
          ? durationFromMonotonic
          : durationFromWall;

        const statusCode = normalizeStatusCode(
          (() => {
            try {
              return res.statusCode;
            } catch {
              return 0;
            }
          })()
        );

        totalRequests += 1;
        if (statusCode >= 500 && statusCode <= 599) totalFiveXx += 1;

        records.push({ timestamp: nowMs(), statusCode, durationMs, route });
        while (records.length > RUNTIME_CONFIG.maxRecords) {
          records.shift();
        }

        pruneOld({ ...DEFAULT_CONFIG, windowMs: RUNTIME_CONFIG.windowMs });
        if (records.length % RUNTIME_CONFIG.checkEveryN === 0 && !scheduledThresholdCheck) {
          scheduledThresholdCheck = true;
          setImmediate(() => {
            scheduledThresholdCheck = false;
            try {
              checkThresholds({ ...DEFAULT_CONFIG, windowMs: RUNTIME_CONFIG.windowMs });
            } catch {
              // fail-open
            }
          });
        }
      }
    } catch {
      // fail-open
    }

    return boundOriginalEnd ? boundOriginalEnd(...args) : undefined;
  } as typeof res.end;

  next();
};

export const __private__ = {
  escapeHtml,
  getRecordCount: () => records.length,
};

export default alertWatchdog;

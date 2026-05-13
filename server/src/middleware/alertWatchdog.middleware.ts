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

interface WatchdogConfig {
  windowMs: number;
  fiveXxThreshold: number;
  latencyThresholdMs: number;
  cooldownMs: number;
  checkEveryN: number;
}

const DEFAULT_CONFIG: WatchdogConfig = {
  windowMs: 5 * 60 * 1000,
  fiveXxThreshold: 10,
  latencyThresholdMs: 2000,
  cooldownMs: 30 * 60 * 1000,
  checkEveryN: 10,
};
const HARD_CAP_WINDOW_RECORDS = 50_000;
const PRUNE_MAX_SHIFTS_PER_CALL = 10_000;
const WATCHDOG_PATCHED = Symbol.for('consultify.alertWatchdog.patched');
const WATCHDOG_COMPLETED = Symbol.for('consultify.alertWatchdog.completed');

const parsePositiveIntEnv = (
  name: string,
  fallback: number,
  min: number,
  max: number
): number => {
  const raw = process.env[name] ?? '';
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const EFFECTIVE_CONFIG: WatchdogConfig = {
  windowMs: parsePositiveIntEnv(
    'ALERT_WATCHDOG_WINDOW_MS',
    DEFAULT_CONFIG.windowMs,
    1_000,
    24 * 60 * 60 * 1000
  ),
  fiveXxThreshold: parsePositiveIntEnv(
    'ALERT_WATCHDOG_FIVE_XX_THRESHOLD',
    DEFAULT_CONFIG.fiveXxThreshold,
    1,
    10_000
  ),
  latencyThresholdMs: parsePositiveIntEnv(
    'ALERT_WATCHDOG_LATENCY_MS',
    DEFAULT_CONFIG.latencyThresholdMs,
    1,
    24 * 60 * 60 * 1000
  ),
  cooldownMs: parsePositiveIntEnv(
    'ALERT_WATCHDOG_COOLDOWN_MS',
    DEFAULT_CONFIG.cooldownMs,
    1_000,
    24 * 60 * 60 * 1000
  ),
  checkEveryN: parsePositiveIntEnv(
    'ALERT_WATCHDOG_CHECK_EVERY_N',
    DEFAULT_CONFIG.checkEveryN,
    1,
    1_000
  ),
};
const MAX_WINDOW_RECORDS = Math.max(
  1,
  Math.min(
    HARD_CAP_WINDOW_RECORDS,
    Number.parseInt(process.env.ALERT_WATCHDOG_MAX_RECORDS ?? '', 10) || 50_000
  )
);

interface RequestRecord {
  timestamp: number;
  statusCode: number;
  durationMs: number;
}

const records: RequestRecord[] = [];
const lastAlerts: Map<string, number> = new Map();
let totalRequests = 0;
let totalFiveXx = 0;

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};
const sanitizeDurationMs = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.min(numeric, 86_400_000);
};

const sanitizeStatusCode = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const integer = Math.trunc(numeric);
  if (integer < 100 || integer > 599) return 0;
  return integer;
};

function pruneOld(config: WatchdogConfig): void {
  const cutoff = Date.now() - config.windowMs;
  let shifts = 0;
  while (records.length > 0 && records[0].timestamp < cutoff && shifts < PRUNE_MAX_SHIFTS_PER_CALL) {
    records.shift();
    shifts += 1;
  }
}

function shouldAlert(type: string, config: WatchdogConfig): boolean {
  const last = lastAlerts.get(type);
  if (last && Date.now() - last < config.cooldownMs) return false;
  lastAlerts.set(type, Date.now());
  return true;
}

function checkThresholds(config: WatchdogConfig): void {
  pruneOld(config);
  if (records.length === 0) return;

  const fiveXxInWindow = records.filter((r) => r.statusCode >= 500).length;
  if (fiveXxInWindow >= config.fiveXxThreshold && shouldAlert('5xx_spike', config)) {
    safeRead(() => {
      logger.error(
        `[AlertWatchdog] 5xx SPIKE: ${fiveXxInWindow} errors in ${config.windowMs / 1000}s window`
      );
      void notifyAlert(
        'api_5xx_spike_detected',
        `5xx spike: ${fiveXxInWindow} errors in ${config.windowMs / 60000}min`
      );
      return true;
    }, false);
  }

  const durations = records.map((r) => r.durationMs).sort((a, b) => a - b);
  const p95Index = Math.floor(durations.length * 0.95);
  const p95 = durations[p95Index] || 0;
  if (p95 > config.latencyThresholdMs && shouldAlert('high_latency', config)) {
    safeRead(() => {
      logger.warn(
        `[AlertWatchdog] HIGH LATENCY: p95=${p95.toFixed(0)}ms (threshold: ${config.latencyThresholdMs}ms)`
      );
      void notifyAlert('api_latency_spike', `p95 latency: ${p95.toFixed(0)}ms`);
      return true;
    }, false);
  }
}

async function notifyAlert(type: string, message: string): Promise<void> {
  try {
    const emailService = await import('../services/emailService.js').then((m) => m.default || m);
    const alertEmail = process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL || '';
    if (alertEmail && emailService?.sendEmail) {
      await emailService.sendEmail(
        alertEmail,
        `[Consultivity Alert] ${escapeHtml(type)}`,
        `<p>${escapeHtml(message)}</p><p>Time: ${escapeHtml(new Date().toISOString())}</p>`
      );
    }
  } catch {
    // fail-open: never block requests for alerting failures
  }
}
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const emptyWatchdogStats = () => ({
  totalRequests: 0,
  totalFiveXx: 0,
  windowRequests: 0,
  windowFiveXx: 0,
  p95Ms: 0,
});

export function getWatchdogStats(): {
  totalRequests: number;
  totalFiveXx: number;
  windowRequests: number;
  windowFiveXx: number;
  p95Ms: number;
} {
  try {
    const now = Date.now();
    const windowRecords = records.filter((r) => now - r.timestamp < EFFECTIVE_CONFIG.windowMs);
    const durations = windowRecords.map((r) => r.durationMs).sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    return {
      totalRequests,
      totalFiveXx,
      windowRequests: windowRecords.length,
      windowFiveXx: windowRecords.filter((r) => r.statusCode >= 500).length,
      p95Ms: durations[p95Index] || 0,
    };
  } catch {
    return emptyWatchdogStats();
  }
}

const alertWatchdog = (req: Request, res: Response, next: NextFunction): void => {
  if (safeRead(() => Boolean((res as Response & { [WATCHDOG_PATCHED]?: boolean })[WATCHDOG_PATCHED]), false)) {
    next();
    return;
  }

  const markerApplied = safeRead(() => {
    Object.defineProperty(res, WATCHDOG_PATCHED, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return true;
  }, false);
  if (!markerApplied) {
    next();
    return;
  }

  const start = Date.now();
  totalRequests++;

  const originalEnd = safeRead(() => res.end.bind(res), null as unknown as (...args: any[]) => any);
  if (!originalEnd) {
    next();
    return;
  }
  let completedInWrapper = false;
  (res as any).end = function (...args: any[]) {
    let alreadyRecorded =
      completedInWrapper ||
      safeRead(
        () => (res as Response & { [WATCHDOG_COMPLETED]?: boolean })[WATCHDOG_COMPLETED],
        false
      );
    if (alreadyRecorded) {
      return originalEnd.apply(this, args as Parameters<typeof originalEnd>);
    }
    completedInWrapper = true;
    safeRead(() => {
      (res as Response & { [WATCHDOG_COMPLETED]?: boolean })[WATCHDOG_COMPLETED] = true;
      return true;
    }, false);
    alreadyRecorded = true;

    try {
      const duration = sanitizeDurationMs(Date.now() - start);
      const statusCode = sanitizeStatusCode(safeRead(() => res.statusCode, 200));

      if (statusCode >= 500) totalFiveXx++;

      records.push({ timestamp: Date.now(), statusCode, durationMs: duration });
      pruneOld(EFFECTIVE_CONFIG);
      while (records.length > MAX_WINDOW_RECORDS) {
        records.shift();
      }

      if (records.length % EFFECTIVE_CONFIG.checkEveryN === 0) {
        try {
          checkThresholds(EFFECTIVE_CONFIG);
        } catch {
          /* fail-open */
        }
      }
    } catch {
      // fail-open
    }

    return originalEnd.apply(this, args as Parameters<typeof originalEnd>);
  };

  next();
};

export default alertWatchdog;
export const __private__ = {
  escapeHtml,
  getRecordCount: (): number => records.length,
};

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
}

const records: RequestRecord[] = [];
const lastAlerts: Map<string, number> = new Map();
let totalRequests = 0;
let totalFiveXx = 0;

function pruneOld(config: WatchdogConfig): void {
  const cutoff = Date.now() - config.windowMs;
  while (records.length > 0 && records[0].timestamp < cutoff) {
    records.shift();
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
    logger.error(
      `[AlertWatchdog] 5xx SPIKE: ${fiveXxInWindow} errors in ${config.windowMs / 1000}s window`
    );
    notifyAlert(
      'api_5xx_spike_detected',
      `5xx spike: ${fiveXxInWindow} errors in ${config.windowMs / 60000}min`
    );
  }

  const durations = records.map((r) => r.durationMs).sort((a, b) => a - b);
  const p95Index = Math.floor(durations.length * 0.95);
  const p95 = durations[p95Index] || 0;
  if (p95 > config.latencyThresholdMs && shouldAlert('high_latency', config)) {
    logger.warn(
      `[AlertWatchdog] HIGH LATENCY: p95=${p95.toFixed(0)}ms (threshold: ${config.latencyThresholdMs}ms)`
    );
    notifyAlert('api_latency_spike', `p95 latency: ${p95.toFixed(0)}ms`);
  }
}

async function notifyAlert(type: string, message: string): Promise<void> {
  try {
    const emailService = await import('../services/emailService.js').then((m) => m.default || m);
    const alertEmail = process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL || '';
    if (alertEmail && emailService?.sendEmail) {
      await emailService.sendEmail(
        alertEmail,
        `[Consultivity Alert] ${type}`,
        `<p>${message}</p><p>Time: ${new Date().toISOString()}</p>`
      );
    }
  } catch {
    // fail-open: never block requests for alerting failures
  }
}

export function getWatchdogStats(): {
  totalRequests: number;
  totalFiveXx: number;
  windowRequests: number;
  windowFiveXx: number;
  p95Ms: number;
} {
  const now = Date.now();
  const windowRecords = records.filter((r) => now - r.timestamp < DEFAULT_CONFIG.windowMs);
  const durations = windowRecords.map((r) => r.durationMs).sort((a, b) => a - b);
  const p95Index = Math.floor(durations.length * 0.95);
  return {
    totalRequests,
    totalFiveXx,
    windowRequests: windowRecords.length,
    windowFiveXx: windowRecords.filter((r) => r.statusCode >= 500).length,
    p95Ms: durations[p95Index] || 0,
  };
}

const alertWatchdog = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  totalRequests++;

  const originalEnd = res.end.bind(res) as (...args: any[]) => any;
  (res as any).end = function (...args: any[]) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    if (statusCode >= 500) totalFiveXx++;

    records.push({ timestamp: Date.now(), statusCode, durationMs: duration });

    if (records.length % 10 === 0) {
      try {
        checkThresholds(DEFAULT_CONFIG);
      } catch {
        /* fail-open */
      }
    }

    return originalEnd(...args);
  };

  next();
};

export default alertWatchdog;

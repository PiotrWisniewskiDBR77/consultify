/**
 * Sync Scheduler — manages periodic connector sync runs with refresh policies.
 *
 * Refresh policies:
 *   - manual:    only on user trigger (not scheduled)
 *   - scheduled: cron expression (parsed to next-run time)
 *   - interval:  every N minutes (min 5)
 *   - on_change: triggered by webhook (not scheduled, handled by webhook endpoint)
 */

import { getDatabase } from '../../database/Database.js';
import { connectorRunner } from './connectorFramework.js';
import logger from '../../utils/Logger.js';

// ---------------------------------------------------------------------------
// Refresh Policy types
// ---------------------------------------------------------------------------

export type RefreshPolicy =
  | { type: 'manual' }
  | { type: 'scheduled'; cron: string }
  | { type: 'interval'; minutes: number }
  | { type: 'on_change'; webhookId?: string };

// ---------------------------------------------------------------------------
// Simple cron-like parser (minute hour dom month dow)
// ---------------------------------------------------------------------------

function parseCronNextRun(cron: string, after: Date = new Date()): Date | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return null;

  const [minPart, hourPart] = parts;
  const minute = minPart === '*' ? after.getMinutes() : parseInt(minPart, 10);
  const hour = hourPart === '*' ? after.getHours() : parseInt(hourPart, 10);

  if (isNaN(minute) || isNaN(hour)) return null;

  const next = new Date(after);
  next.setSeconds(0, 0);
  next.setMinutes(minute);
  next.setHours(hour);

  if (next <= after) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

// ---------------------------------------------------------------------------
// ScheduledEntry
// ---------------------------------------------------------------------------

interface ScheduledEntry {
  connectorId: string;
  policy: RefreshPolicy;
  intervalMinutes: number;
  nextRunAt: Date;
  timer: NodeJS.Timeout;
}

// ---------------------------------------------------------------------------
// SyncScheduler
// ---------------------------------------------------------------------------

const MIN_INTERVAL_MINUTES = 5;

export class SyncScheduler {
  private timers = new Map<string, ScheduledEntry>();
  private running = false;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const db = getDatabase();
      const result = await db.query<{
        id: string;
        schedule: { enabled: boolean; intervalMinutes?: number } | null;
        config: Record<string, unknown> | null;
      }>(
        `SELECT id, schedule, config FROM tp_connectors
         WHERE schedule IS NOT NULL
           AND (schedule->>'enabled')::text = 'true'`
      );

      for (const row of result.rows) {
        const connectorId = row.id as string;
        const schedule = row.schedule as { enabled: boolean; intervalMinutes?: number } | null;
        const config = row.config as Record<string, unknown> | null;
        const refreshPolicy = config?.refresh_policy as RefreshPolicy | undefined;

        if (refreshPolicy) {
          this.applyRefreshPolicy(connectorId, refreshPolicy);
        } else if (schedule?.intervalMinutes && schedule.intervalMinutes > 0) {
          this.scheduleConnector(connectorId, schedule.intervalMinutes);
        }
      }

      logger.info(`[SyncScheduler] started with ${this.timers.size} scheduled connector(s)`);
    } catch (e) {
      logger.error('[SyncScheduler] failed to start', { error: (e as Error).message });
    }
  }

  async stop(): Promise<void> {
    for (const [connectorId, entry] of this.timers) {
      clearInterval(entry.timer);
      logger.info(`[SyncScheduler] unscheduled connector ${connectorId}`);
    }
    this.timers.clear();
    this.running = false;
    logger.info('[SyncScheduler] stopped');
  }

  applyRefreshPolicy(connectorId: string, policy: RefreshPolicy): void {
    this.unscheduleConnector(connectorId);

    switch (policy.type) {
      case 'manual':
      case 'on_change':
        logger.info(`[SyncScheduler] connector ${connectorId} uses ${policy.type} policy — not scheduling`);
        return;

      case 'interval': {
        const minutes = Math.max(policy.minutes, MIN_INTERVAL_MINUTES);
        this.scheduleConnector(connectorId, minutes, policy);
        return;
      }

      case 'scheduled': {
        const nextRun = parseCronNextRun(policy.cron);
        if (!nextRun) {
          logger.warn(`[SyncScheduler] invalid cron expression for ${connectorId}: ${policy.cron}`);
          return;
        }
        const delayMs = nextRun.getTime() - Date.now();
        const intervalMs = 24 * 60 * 60 * 1000; // re-check daily

        const timer = setTimeout(() => {
          this.runConnector(connectorId);
          const recurring = setInterval(() => {
            const next = parseCronNextRun(policy.cron);
            if (next && Math.abs(next.getTime() - Date.now()) < 60_000) {
              this.runConnector(connectorId);
            }
          }, 60_000);
          if (recurring.unref) recurring.unref();

          const entry = this.timers.get(connectorId);
          if (entry) {
            entry.timer = recurring as unknown as NodeJS.Timeout;
          }
        }, Math.max(delayMs, 0));

        if (timer.unref) timer.unref();

        this.timers.set(connectorId, {
          connectorId,
          policy,
          intervalMinutes: Math.round(delayMs / 60_000),
          nextRunAt: nextRun,
          timer: timer as unknown as NodeJS.Timeout,
        });

        logger.info(`[SyncScheduler] scheduled connector ${connectorId} via cron "${policy.cron}", next run at ${nextRun.toISOString()}`);
        return;
      }
    }
  }

  scheduleConnector(connectorId: string, intervalMinutes: number, policy?: RefreshPolicy): void {
    this.unscheduleConnector(connectorId);

    if (intervalMinutes <= 0) {
      throw new Error('intervalMinutes must be positive');
    }

    const effectiveMinutes = Math.max(intervalMinutes, MIN_INTERVAL_MINUTES);
    const intervalMs = effectiveMinutes * 60 * 1000;
    const nextRunAt = new Date(Date.now() + intervalMs);

    const timer = setInterval(() => {
      this.runConnector(connectorId);
    }, intervalMs);

    if (timer.unref) {
      timer.unref();
    }

    this.timers.set(connectorId, {
      connectorId,
      policy: policy ?? { type: 'interval', minutes: effectiveMinutes },
      intervalMinutes: effectiveMinutes,
      nextRunAt,
      timer,
    });

    logger.info(`[SyncScheduler] scheduled connector ${connectorId} every ${effectiveMinutes}m`);
  }

  unscheduleConnector(connectorId: string): void {
    const entry = this.timers.get(connectorId);
    if (entry) {
      clearInterval(entry.timer);
      this.timers.delete(connectorId);
      logger.info(`[SyncScheduler] unscheduled connector ${connectorId}`);
    }
  }

  getScheduledConnectors(): Array<{
    connectorId: string;
    nextRunAt: Date;
    intervalMinutes: number;
    policyType: string;
  }> {
    const result: Array<{
      connectorId: string;
      nextRunAt: Date;
      intervalMinutes: number;
      policyType: string;
    }> = [];

    for (const entry of this.timers.values()) {
      result.push({
        connectorId: entry.connectorId,
        nextRunAt: entry.nextRunAt,
        intervalMinutes: entry.intervalMinutes,
        policyType: entry.policy.type,
      });
    }

    return result;
  }

  isScheduled(connectorId: string): boolean {
    return this.timers.has(connectorId);
  }

  private async runConnector(connectorId: string): Promise<void> {
    try {
      logger.info(`[SyncScheduler] running scheduled sync for connector ${connectorId}`);
      const result = await connectorRunner.run(connectorId);

      const entry = this.timers.get(connectorId);
      if (entry) {
        entry.nextRunAt = new Date(Date.now() + entry.intervalMinutes * 60 * 1000);
      }

      logger.info(`[SyncScheduler] sync completed for ${connectorId}`, {
        status: result.status,
        imported: result.recordsImported,
        fetched: result.recordsFetched,
      });
    } catch (e) {
      logger.error(`[SyncScheduler] sync failed for ${connectorId}`, {
        error: (e as Error).message,
      });
    }
  }
}

export const syncScheduler = new SyncScheduler();
export default syncScheduler;

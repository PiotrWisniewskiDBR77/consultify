/**
 * Scheduled Automation Executor
 * Polls for scheduled automations and runs them based on cron expressions with timezone support.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

// ─── Cron Validation & Description ───────────────────────────────

export interface CronValidationResult {
  valid: boolean;
  error?: string;
  description?: string;
}

function isValidCronField(expr: string, min: number, max: number): boolean {
  if (expr === '*') return true;
  if (expr.startsWith('*/')) {
    const step = parseInt(expr.slice(2), 10);
    return !isNaN(step) && step > 0 && step <= max;
  }
  const segments = expr.split(',');
  for (const seg of segments) {
    if (seg.includes('-')) {
      const [s, e] = seg.split('-').map(Number);
      if (isNaN(s) || isNaN(e) || s < min || e > max || s > e) return false;
    } else {
      const val = parseInt(seg, 10);
      if (isNaN(val) || val < min || val > max) return false;
    }
  }
  return true;
}

function describeCron(parts: string[]): string {
  const [min, hour, dom, mon, dow] = parts;
  const pieces: string[] = [];

  if (min === '0' && hour !== '*') {
    pieces.push(`At ${hour}:00`);
  } else if (min.startsWith('*/')) {
    pieces.push(`Every ${min.slice(2)} minutes`);
  } else if (min === '*') {
    pieces.push('Every minute');
  } else {
    pieces.push(`At minute ${min}`);
  }

  if (hour !== '*' && !(min === '0' && hour !== '*')) {
    pieces.push(`past hour ${hour}`);
  }

  if (dow !== '*') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (dow === '1-5') {
      pieces.push('on weekdays');
    } else if (dow === '0,6') {
      pieces.push('on weekends');
    } else {
      const dayLabels = dow.split(',').map((d) => {
        if (d.includes('-')) {
          const [s, e] = d.split('-').map(Number);
          return `${dayNames[s] ?? s}-${dayNames[e] ?? e}`;
        }
        return dayNames[parseInt(d, 10)] ?? d;
      });
      pieces.push(`on ${dayLabels.join(', ')}`);
    }
  }

  if (dom !== '*') pieces.push(`on day ${dom}`);
  if (mon !== '*') pieces.push(`in month ${mon}`);

  return pieces.join(' ');
}

export function validateCronExpression(cron: string): CronValidationResult {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { valid: false, error: 'Cron expression must have exactly 5 fields: minute hour dayOfMonth month dayOfWeek' };
  }

  const fieldNames = ['minute', 'hour', 'day of month', 'month', 'day of week'];
  const ranges: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];

  for (let i = 0; i < 5; i++) {
    if (!isValidCronField(parts[i], ranges[i][0], ranges[i][1])) {
      return { valid: false, error: `Invalid ${fieldNames[i]} field: ${parts[i]}` };
    }
  }

  return { valid: true, description: describeCron(parts) };
}

// ─── Cron Matching ───────────────────────────────────────────────

function matchesCronField(expr: string, value: number): boolean {
  if (expr === '*') return true;

  if (expr.startsWith('*/')) {
    const step = parseInt(expr.slice(2), 10);
    return value % step === 0;
  }

  if (expr.includes(',')) {
    const values = expr.split(',').flatMap((v) => {
      if (v.includes('-')) {
        const [s, e] = v.split('-').map(Number);
        const range: number[] = [];
        for (let i = s; i <= e; i++) range.push(i);
        return range;
      }
      return [parseInt(v, 10)];
    });
    return values.includes(value);
  }

  if (expr.includes('-')) {
    const [start, end] = expr.split('-').map(Number);
    return value >= start && value <= end;
  }

  return parseInt(expr, 10) === value;
}

// ─── Timezone helpers ────────────────────────────────────────────

function getDatePartsInTimezone(date: Date, timezone: string): { minute: number; hour: number; day: number; month: number; dow: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    minute: parseInt(get('minute'), 10),
    hour: parseInt(get('hour'), 10) % 24,
    day: parseInt(get('day'), 10),
    month: parseInt(get('month'), 10),
    dow: dowMap[get('weekday')] ?? 0,
  };
}

// ─── Scheduled Trigger Config ────────────────────────────────────

interface ScheduledTriggerConfig {
  cron: string;
  timezone: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

// ─── Executor ────────────────────────────────────────────────────

export class ScheduledAutomationExecutor {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  start(intervalMs = 60_000): void {
    if (this.intervalId) return;
    logger.info(`[ScheduledAutomations] Starting executor, checking every ${intervalMs / 1000}s`);

    this.tick().catch((err) => logger.error('[ScheduledAutomations] Error:', err));
    this.intervalId = setInterval(() => {
      this.tick().catch((err) => logger.error('[ScheduledAutomations] Error:', err));
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const now = new Date();
      const db = getDatabase();

      const result = await db.query(
        `SELECT a.*,
          COALESCE(json_agg(
            json_build_object('id', aa.id, 'actionOrder', aa.action_order, 'actionType', aa.action_type, 'actionConfig', aa.action_config)
            ORDER BY aa.action_order
          ) FILTER (WHERE aa.id IS NOT NULL), '[]') as actions
         FROM tp_automations a
         LEFT JOIN tp_automation_actions aa ON aa.automation_id = a.id
         WHERE a.enabled = true AND a.trigger_type = 'scheduled'
         GROUP BY a.id`
      );

      for (const auto of result.rows) {
        const config = auto.trigger_config as ScheduledTriggerConfig;
        if (!config.cron) continue;

        const nextRun = config.nextRunAt
          ? new Date(config.nextRunAt)
          : this.calculateNextRun(config.cron, config.timezone);

        if (nextRun <= now) {
          logger.info(`[ScheduledAutomations] Running automation ${auto.id} (${auto.name})`);

          try {
            await this.executeScheduledAutomation(auto);
          } catch (err: any) {
            logger.error(`[ScheduledAutomations] Failed to run ${auto.id}: ${err.message}`);
          }

          const newNextRun = this.calculateNextRun(config.cron, config.timezone);
          await db.query(
            `UPDATE tp_automations SET trigger_config = trigger_config || $2::jsonb, updated_at = NOW() WHERE id = $1`,
            [auto.id, JSON.stringify({ lastRunAt: now.toISOString(), nextRunAt: newNextRun.toISOString() })]
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async executeScheduledAutomation(automation: any): Promise<void> {
    const db = getDatabase();
    const runResult = await db.query(
      `INSERT INTO tp_automation_runs (automation_id, status) VALUES ($1, 'running') RETURNING id`,
      [automation.id]
    );
    const runId = runResult.rows[0].id;
    const startTime = Date.now();
    const actionResults: any[] = [];

    try {
      const actions: any[] = Array.isArray(automation.actions) ? automation.actions : [];
      for (const action of actions) {
        const result = await this.executeAction(action, automation);
        actionResults.push({ actionId: action.id, actionType: action.actionType, status: 'completed', result });
      }

      await db.query(
        `UPDATE tp_automation_runs SET status = 'completed', completed_at = NOW(), duration_ms = $2, action_results = $3 WHERE id = $1`,
        [runId, Date.now() - startTime, JSON.stringify(actionResults)]
      );

      const month = new Date().toISOString().slice(0, 7);
      await db.query(
        `INSERT INTO tp_automation_run_counts (organization_id, month, run_count)
         VALUES (
           (SELECT b.organization_id FROM tp_bases b JOIN tp_automations a ON a.base_id = b.id WHERE a.id = $1),
           $2, 1
         )
         ON CONFLICT (organization_id, month)
         DO UPDATE SET run_count = tp_automation_run_counts.run_count + 1`,
        [automation.id, month]
      );
    } catch (err: any) {
      await db.query(
        `UPDATE tp_automation_runs SET status = 'failed', completed_at = NOW(), duration_ms = $2, error = $3 WHERE id = $1`,
        [runId, Date.now() - startTime, err.message]
      );
    }
  }

  private async executeAction(action: any, automation: any): Promise<any> {
    const db = getDatabase();

    switch (action.actionType) {
      case 'update_record': {
        const { recordId, fieldUpdates } = action.actionConfig ?? {};
        if (recordId && fieldUpdates) {
          await db.query(
            'UPDATE tp_records SET data = data || $2::jsonb, updated_at = NOW() WHERE id = $1',
            [recordId, JSON.stringify(fieldUpdates)]
          );
          return { updated: true };
        }
        return { updated: false };
      }
      case 'create_record': {
        const { tableId, data } = action.actionConfig ?? {};
        const result = await db.query(
          'INSERT INTO tp_records (table_id, data) VALUES ($1, $2) RETURNING id',
          [tableId || automation.table_id, JSON.stringify(data || {})]
        );
        return { recordId: result.rows[0].id };
      }
      case 'send_webhook': {
        const { url, method, headers, bodyTemplate } = action.actionConfig ?? {};
        try {
          const resp = await fetch(url, {
            method: method || 'POST',
            headers: { 'Content-Type': 'application/json', ...(headers || {}) },
            body: JSON.stringify(bodyTemplate || { automation: automation.name, triggeredAt: new Date().toISOString() }),
            signal: AbortSignal.timeout(10_000),
          });
          return { status: resp.status, ok: resp.ok };
        } catch (err: any) {
          return { error: err.message };
        }
      }
      case 'send_email':
        return { sent: false, reason: 'Email service not configured' };
      default:
        return { error: `Unknown action type: ${action.actionType}` };
    }
  }

  /**
   * Calculate the next run time from a cron expression.
   * Uses Intl.DateTimeFormat for timezone-aware matching.
   * Forward-searches minute by minute for the next 48 hours.
   */
  calculateNextRun(cron: string, timezone?: string): Date {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${cron}`);
    }

    const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = parts;
    const now = new Date();
    const tz = timezone || 'UTC';

    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1);

    const maxIterations = 48 * 60;
    for (let i = 0; i < maxIterations; i++) {
      const p = getDatePartsInTimezone(candidate, tz);

      if (
        matchesCronField(minExpr, p.minute) &&
        matchesCronField(hourExpr, p.hour) &&
        matchesCronField(domExpr, p.day) &&
        matchesCronField(monExpr, p.month) &&
        matchesCronField(dowExpr, p.dow)
      ) {
        return candidate;
      }
      candidate.setMinutes(candidate.getMinutes() + 1);
    }

    return new Date(now.getTime() + 86_400_000);
  }

  /**
   * Get the automation record by ID (for API use).
   */
  async getAutomation(automationId: string): Promise<any> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT a.*,
        COALESCE(json_agg(
          json_build_object('id', aa.id, 'actionOrder', aa.action_order, 'actionType', aa.action_type, 'actionConfig', aa.action_config)
          ORDER BY aa.action_order
        ) FILTER (WHERE aa.id IS NOT NULL), '[]') as actions
       FROM tp_automations a
       LEFT JOIN tp_automation_actions aa ON aa.automation_id = a.id
       WHERE a.id = $1
       GROUP BY a.id`,
      [automationId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Manually trigger a scheduled automation (run-now).
   */
  async runNow(automationId: string): Promise<{ runId: string; status: string }> {
    const automation = await this.getAutomation(automationId);
    if (!automation) throw new Error('Automation not found');
    if (automation.trigger_type !== 'scheduled') throw new Error('Automation is not a scheduled type');

    await this.executeScheduledAutomation(automation);

    const db = getDatabase();
    const config = automation.trigger_config as ScheduledTriggerConfig;
    if (config.cron) {
      const newNextRun = this.calculateNextRun(config.cron, config.timezone);
      await db.query(
        `UPDATE tp_automations SET trigger_config = trigger_config || $2::jsonb, updated_at = NOW() WHERE id = $1`,
        [automationId, JSON.stringify({ lastRunAt: new Date().toISOString(), nextRunAt: newNextRun.toISOString() })]
      );
    }

    return { runId: automationId, status: 'completed' };
  }
}

export const scheduledAutomationExecutor = new ScheduledAutomationExecutor();

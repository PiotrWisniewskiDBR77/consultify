/**
 * Feedback SLA — response deadlines + proactive overdue escalation.
 *
 * The gap this closes: real user reports sat in NEW for weeks with zero admin
 * response and nobody was reminded. Now every ticket gets a `due_at` computed
 * from its severity at intake, and a periodic sweep escalates any OPEN ticket
 * that blew its deadline to Slack #alerts — once per ticket (marked via
 * `sla_escalated_at`) so it nudges without spamming.
 *
 * The window math is pure and exported for unit testing. All I/O is
 * best-effort / fail-soft: SLA must never block feedback intake.
 */

import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import { routeToSlack } from './slack/slackRouter.js';

const HOUR_MS = 60 * 60 * 1000;

/** Response-time budget per severity. Falls back to priority, then MEDIUM. */
export const SLA_WINDOW_MS: Record<string, number> = {
  CRITICAL: 4 * HOUR_MS,
  HIGH: 24 * HOUR_MS,
  MEDIUM: 72 * HOUR_MS,
  LOW: 168 * HOUR_MS,
};

/** Resolve the SLA window (ms) from severity, falling back to priority. */
export function slaWindowMs(severity?: string | null, priority?: string | null): number {
  const s = String(severity || '').toUpperCase();
  if (SLA_WINDOW_MS[s]) return SLA_WINDOW_MS[s];
  const p = String(priority || '').toUpperCase();
  if (p === 'CRITICAL' || p === 'URGENT') return SLA_WINDOW_MS.CRITICAL;
  if (p === 'HIGH') return SLA_WINDOW_MS.HIGH;
  if (p === 'LOW') return SLA_WINDOW_MS.LOW;
  return SLA_WINDOW_MS.MEDIUM;
}

/** ISO deadline = createdAt + SLA window. `createdAtMs` must be supplied (no Date.now default). */
export function computeSlaDueAtIso(
  severity: string | null | undefined,
  priority: string | null | undefined,
  createdAtMs: number
): string {
  return new Date(createdAtMs + slaWindowMs(severity, priority)).toISOString();
}

const OPEN_STATUSES = "('NEW','PENDING','IN_PROGRESS')";
const SWEEP_BATCH = 25;

interface OverdueRow {
  id: string;
  title: string | null;
  severity: string | null;
  status: string | null;
  due_at: string | null;
  source_env: string | null;
}

/**
 * Find OPEN tickets past their deadline that we haven't escalated yet, post one
 * batched Slack alert, and mark them escalated. Returns how many were escalated.
 */
export async function runFeedbackSlaSweepOnce(nowMs: number = Date.now()): Promise<number> {
  try {
    const cols = await getTableColumns('feedback_items');
    if (!cols.has('due_at') || !cols.has('sla_escalated_at')) return 0;

    const nowIso = new Date(nowMs).toISOString();
    const rows = await dbAll<OverdueRow>(
      `SELECT id, title, severity, status, due_at, source_env
         FROM feedback_items
        WHERE due_at IS NOT NULL
          AND due_at < ?
          AND UPPER(COALESCE(status, 'NEW')) IN ${OPEN_STATUSES}
          AND sla_escalated_at IS NULL
        ORDER BY due_at ASC
        LIMIT ${SWEEP_BATCH}`,
      [nowIso]
    );

    if (!rows || rows.length === 0) return 0;

    const appUrl =
      process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '') ||
      'http://localhost:5173';

    const lines = rows.map((r) => {
      const overdueH = r.due_at
        ? Math.max(1, Math.round((nowMs - new Date(r.due_at).getTime()) / HOUR_MS))
        : 0;
      const sev = (r.severity || 'MEDIUM').toUpperCase();
      const title = String(r.title || 'zgłoszenie').slice(0, 80);
      const link = `${appUrl}/superadmin/customers/feedback?feedbackId=${encodeURIComponent(r.id)}`;
      return `• <${link}|${title}> — ${sev}, po terminie o ~${overdueH}h (${(r.status || 'NEW').toUpperCase()})`;
    });

    await routeToSlack({
      channel: 'alerts',
      severity: 'WARNING',
      category: 'SLA',
      priorityLabel: `${rows.length} zaległych`,
      title: `${rows.length} ${rows.length === 1 ? 'zgłoszenie przekroczyło' : 'zgłoszeń przekroczyło'} termin odpowiedzi`,
      text: lines.join('\n'),
      dedupeKey: `sla-sweep:${nowIso.slice(0, 13)}`, // hour-bucketed, defensive
    });

    // Mark escalated so we nudge once per ticket.
    for (const r of rows) {
      await dbRun(`UPDATE feedback_items SET sla_escalated_at = ? WHERE id = ?`, [
        nowIso,
        r.id,
      ]).catch(() => undefined);
    }

    logger.info(`[feedbackSla] Escalated ${rows.length} overdue ticket(s) to Slack.`);
    return rows.length;
  } catch (err) {
    logger.warn('[feedbackSla] sweep failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

let slaTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the overdue-escalation sweep. Skipped under test. Runs every 15 min;
 * `FEEDBACK_SLA_SWEEP_ENABLED='false'` disables it (default: ON — this is a
 * safety/communication guarantee, so it is opt-OUT, unlike the digest).
 */
export function startFeedbackSlaSweepCron(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (String(process.env.FEEDBACK_SLA_SWEEP_ENABLED || 'true').toLowerCase() === 'false') {
    logger.info('[feedbackSla] FEEDBACK_SLA_SWEEP_ENABLED=false — sweep not started.');
    return;
  }
  if (slaTimer) return;

  const tickMs = 15 * 60 * 1000;
  const tick = () => {
    void runFeedbackSlaSweepOnce().catch(() => undefined);
  };
  // First run shortly after boot, then every 15 min.
  setTimeout(tick, 60 * 1000);
  slaTimer = setInterval(tick, tickMs);
  logger.info('[feedbackSla] Overdue-escalation sweep started (every 15 min).');
}

export default {
  slaWindowMs,
  computeSlaDueAtIso,
  runFeedbackSlaSweepOnce,
  startFeedbackSlaSweepCron,
  SLA_WINDOW_MS,
};

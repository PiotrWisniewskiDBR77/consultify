/**
 * feedbackDigest
 *
 * Daily Slack digest of the feedback triage queue. Highlights the three
 * things SuperAdmins actually act on in the morning:
 *
 *   1. New tickets from the last 24h (with env + severity + author)
 *   2. Tickets stuck in NEW > 48h (SLA breach candidates)
 *   3. Critical production bugs open right now (any status != RESOLVED/ARCHIVED)
 *
 * The digest is posted via the existing `slackService.sendSystemAlert`
 * pipeline so it reuses the established webhook + severity routing. If Slack
 * is not configured it becomes a no-op (the service logs and swallows).
 *
 * Bootstrapped from `server/index.ts` via `startFeedbackDigestCron()`. The
 * interval + time-of-day are controlled by env vars:
 *
 *   FEEDBACK_DIGEST_ENABLED   'true' to enable (default: off)
 *   FEEDBACK_DIGEST_HOUR_UTC  integer 0-23 (default: 6 = 08:00 Warsaw summer)
 *
 * We avoid a cron dependency; a lightweight poll every 15 min is enough for
 * a once-a-day message and keeps the process tree clean.
 */

import { all as dbAll } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import slackService from './slackService.js';

interface FeedbackSummaryRow {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  severity: string | null;
  source_env: string | null;
  feedback_type: string | null;
  priority: string | null;
  created_at: string | null;
  metadata_json: string | null;
  user_email: string | null;
}

interface DigestSections {
  newInLast24h: FeedbackSummaryRow[];
  stuckInNewOver48h: FeedbackSummaryRow[];
  openCriticalProd: FeedbackSummaryRow[];
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function normalizeSeverity(row: FeedbackSummaryRow): string {
  const s = String(row.severity || '').toUpperCase();
  return s || '—';
}

function shortId(id: string): string {
  return id.length >= 8 ? id.slice(0, 8) : id;
}

async function loadDigestSections(): Promise<DigestSections | null> {
  const cols = await getTableColumns('feedback_items');
  if (!cols.has('metadata_json')) return null;

  const since24h = isoHoursAgo(24);
  const since48h = isoHoursAgo(48);

  const newInLast24h = await dbAll<FeedbackSummaryRow>(
    `
      SELECT f.id, f.title, f.description, UPPER(COALESCE(NULLIF(f.status, ''), 'NEW')) AS status,
             f.severity, f.source_env, f.feedback_type, f.priority, f.created_at, f.metadata_json,
             u.email AS user_email
      FROM feedback_items f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE f.created_at >= ?
      ORDER BY f.created_at DESC
      LIMIT 20
    `,
    [since24h]
  );

  const stuckInNewOver48h = await dbAll<FeedbackSummaryRow>(
    `
      SELECT f.id, f.title, f.description, UPPER(COALESCE(NULLIF(f.status, ''), 'NEW')) AS status,
             f.severity, f.source_env, f.feedback_type, f.priority, f.created_at, f.metadata_json,
             u.email AS user_email
      FROM feedback_items f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE UPPER(COALESCE(NULLIF(f.status, ''), 'NEW')) = 'NEW'
        AND f.created_at <= ?
      ORDER BY f.created_at ASC
      LIMIT 20
    `,
    [since48h]
  );

  const openCriticalProd = await dbAll<FeedbackSummaryRow>(
    `
      SELECT f.id, f.title, f.description, UPPER(COALESCE(NULLIF(f.status, ''), 'NEW')) AS status,
             f.severity, f.source_env, f.feedback_type, f.priority, f.created_at, f.metadata_json,
             u.email AS user_email
      FROM feedback_items f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE UPPER(COALESCE(NULLIF(f.status, ''), 'NEW')) NOT IN ('RESOLVED', 'ARCHIVED')
        AND UPPER(COALESCE(NULLIF(f.severity, ''), '')) = 'CRITICAL'
        AND LOWER(COALESCE(f.source_env, '')) IN ('production', 'prod')
      ORDER BY f.created_at DESC
      LIMIT 20
    `,
    []
  );

  return {
    newInLast24h: newInLast24h || [],
    stuckInNewOver48h: stuckInNewOver48h || [],
    openCriticalProd: openCriticalProd || [],
  };
}

function formatRow(row: FeedbackSummaryRow): string {
  const title = row.title || (row.description || '').slice(0, 80) || '(no title)';
  const env = row.source_env ? ` [${row.source_env}]` : '';
  const sev = normalizeSeverity(row);
  const author = row.user_email ? ` — ${row.user_email}` : '';
  return `• \`${shortId(row.id)}\`${env} ${sev} ${title}${author}`;
}

function buildDigestMessage(sections: DigestSections): { title: string; body: string } | null {
  const { newInLast24h, stuckInNewOver48h, openCriticalProd } = sections;
  if (
    newInLast24h.length === 0 &&
    stuckInNewOver48h.length === 0 &&
    openCriticalProd.length === 0
  ) {
    return null;
  }

  const lines: string[] = [];
  lines.push('*Feedback triage digest* (last 24h)');
  lines.push('');
  lines.push(`• Nowe: *${newInLast24h.length}*`);
  lines.push(`• Utknięte w NEW > 48h: *${stuckInNewOver48h.length}*`);
  lines.push(`• Otwarte CRITICAL prod: *${openCriticalProd.length}*`);
  lines.push('');

  if (openCriticalProd.length > 0) {
    lines.push(':red_circle: *Critical prod*');
    openCriticalProd.slice(0, 10).forEach((row) => lines.push(formatRow(row)));
    lines.push('');
  }

  if (stuckInNewOver48h.length > 0) {
    lines.push(':hourglass_flowing_sand: *NEW > 48h*');
    stuckInNewOver48h.slice(0, 10).forEach((row) => lines.push(formatRow(row)));
    lines.push('');
  }

  if (newInLast24h.length > 0) {
    lines.push(':new: *Nowe (24h)*');
    newInLast24h.slice(0, 10).forEach((row) => lines.push(formatRow(row)));
  }

  const severity =
    openCriticalProd.length > 0 ? 'critical' : stuckInNewOver48h.length > 0 ? 'warning' : 'info';

  return {
    title: 'Feedback digest',
    body: lines.join('\n') + `\n\n(Severity routing: ${severity})`,
  };
}

/**
 * Build and send the digest. Safe to call manually (tests, smoke scripts).
 * Returns the number of rows referenced in the digest, or -1 if Slack is
 * disabled / no message to send.
 */
export async function runFeedbackDigestOnce(): Promise<number> {
  try {
    const sections = await loadDigestSections();
    if (!sections) {
      logger.warn('[feedbackDigest] feedback_items.metadata_json missing — skipping digest.');
      return -1;
    }
    const payload = buildDigestMessage(sections);
    if (!payload) {
      logger.info('[feedbackDigest] Nothing to report — skipping digest.');
      return 0;
    }
    const total =
      sections.newInLast24h.length +
      sections.stuckInNewOver48h.length +
      sections.openCriticalProd.length;
    const severity: 'CRITICAL' | 'WARNING' | 'INFO' = sections.openCriticalProd.length
      ? 'CRITICAL'
      : sections.stuckInNewOver48h.length
        ? 'WARNING'
        : 'INFO';
    await slackService.sendSystemAlert(payload.title, payload.body, severity);
    logger.info(`[feedbackDigest] Slack digest posted (rows referenced: ${total}).`);
    return total;
  } catch (err) {
    logger.warn(
      '[feedbackDigest] runFeedbackDigestOnce failed (non-fatal):',
      err instanceof Error ? err.message : err
    );
    return -1;
  }
}

let digestPollTimer: ReturnType<typeof setInterval> | null = null;
let lastDigestDayUtc: string | null = null;

/**
 * Idempotent bootstrap called from `server/index.ts`. Polls every 15 minutes
 * and sends the digest once per UTC day at (or after) the target hour. No-op
 * under NODE_ENV=test and when `FEEDBACK_DIGEST_ENABLED` is not `true`.
 */
export function startFeedbackDigestCron(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (digestPollTimer) return;
  if (String(process.env.FEEDBACK_DIGEST_ENABLED || '').toLowerCase() !== 'true') {
    logger.info('[feedbackDigest] FEEDBACK_DIGEST_ENABLED!=true — cron not started.');
    return;
  }
  const targetHour = Math.max(0, Math.min(23, Number(process.env.FEEDBACK_DIGEST_HOUR_UTC || 6)));
  const tickMs = 15 * 60 * 1000;

  const tick = () => {
    try {
      const now = new Date();
      const dayKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
      if (lastDigestDayUtc === dayKey) return;
      if (now.getUTCHours() < targetHour) return;
      lastDigestDayUtc = dayKey;
      void runFeedbackDigestOnce();
    } catch (err) {
      logger.warn('[feedbackDigest] cron tick failed:', err instanceof Error ? err.message : err);
    }
  };

  tick();
  digestPollTimer = setInterval(tick, tickMs);
  if (typeof digestPollTimer.unref === 'function') digestPollTimer.unref();
  logger.info(`[feedbackDigest] Cron started (target hour UTC=${targetHour}, poll every 15 min).`);
}

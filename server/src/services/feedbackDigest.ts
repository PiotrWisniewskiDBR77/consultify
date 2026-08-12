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
 * The digest is posted via the Slack Command Center router
 * (`routeToSlack({ channel: 'progress' })`) so it lands on #cf-progress with
 * the rest of the daily command report. If Slack is not configured the router
 * is a fail-soft no-op (logs and swallows).
 *
 * Slack Command Center (F3) extends the report beyond feedback triage with a
 * "Praca" section (tasks completed 24h, initiatives with a status change 24h)
 * and a "Użytkownicy" section (new signups 24h). Each work query is
 * independently fail-soft — a missing table simply drops its section.
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
import { buildSeedExclusion } from '../utils/superadminSeedFilter.js';
import { routeToSlack } from './slack/slackRouter.js';

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

interface NamedRow {
  id: string;
  label: string | null;
}

interface WorkSections {
  tasksCompleted24h: NamedRow[];
  initiativesChanged24h: NamedRow[];
  newUsers24h: NamedRow[];
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

/**
 * Command-center work sections (Slack Command Center, Filar 4 / F3). Every
 * query is independently fail-soft: a missing table / column returns [] rather
 * than aborting the whole digest.
 */
async function loadWorkSections(): Promise<WorkSections> {
  const since24h = isoHoursAgo(24);

  const tasksCompleted24h = await (async (): Promise<NamedRow[]> => {
    try {
      const cols = await getTableColumns('tasks');
      if (!cols.has('status') || !cols.has('updated_at')) return [];
      const rows = await dbAll<{ id: string; label: string | null }>(
        `
          SELECT id, title AS label
          FROM tasks
          WHERE LOWER(COALESCE(status, '')) IN ('done', 'completed')
            AND updated_at >= ?
          ORDER BY updated_at DESC
          LIMIT 20
        `,
        [since24h]
      );
      return rows || [];
    } catch (err) {
      logger.warn(
        '[feedbackDigest] tasksCompleted24h query failed (skipping section):',
        err instanceof Error ? err.message : err
      );
      return [];
    }
  })();

  const initiativesChanged24h = await (async (): Promise<NamedRow[]> => {
    // Prefer the audit trail (initiative_status_history) when present; fall back
    // to initiatives.updated_at.
    try {
      const histCols = await getTableColumns('initiative_status_history');
      if (histCols.has('initiative_id') && histCols.has('created_at')) {
        const rows = await dbAll<{ id: string; label: string | null }>(
          `
            SELECT i.id AS id,
                   COALESCE(i.name, i.id) AS label
            FROM initiative_status_history h
            JOIN initiatives i ON i.id = h.initiative_id
            WHERE h.created_at >= ?
            GROUP BY i.id, i.name
            ORDER BY MAX(h.created_at) DESC
            LIMIT 20
          `,
          [since24h]
        );
        if (rows && rows.length >= 0) return rows;
      }
    } catch (err) {
      logger.warn(
        '[feedbackDigest] initiative_status_history query failed, falling back to updated_at:',
        err instanceof Error ? err.message : err
      );
    }
    try {
      const cols = await getTableColumns('initiatives');
      if (!cols.has('updated_at')) return [];
      const rows = await dbAll<{ id: string; label: string | null }>(
        `
          SELECT id, COALESCE(name, id) AS label
          FROM initiatives
          WHERE updated_at >= ?
          ORDER BY updated_at DESC
          LIMIT 20
        `,
        [since24h]
      );
      return rows || [];
    } catch (err) {
      logger.warn(
        '[feedbackDigest] initiatives fallback query failed (skipping section):',
        err instanceof Error ? err.message : err
      );
      return [];
    }
  })();

  const newUsers24h = await (async (): Promise<NamedRow[]> => {
    try {
      const cols = await getTableColumns('users');
      if (!cols.has('created_at')) return [];
      // Exclude seed/e2e fixture accounts (e.g. e2e+...@local.test) — real
      // signups only. Without this, an automated test run's 20 throwaway
      // accounts showed up as "20 nowych użytkowników" in one digest.
      const seedExclusion = buildSeedExclusion({ emailCol: 'email' });
      const rows = await dbAll<{ id: string; label: string | null }>(
        `
          SELECT id, email AS label
          FROM users
          WHERE created_at >= ?
            ${seedExclusion.clause ? `AND ${seedExclusion.clause}` : ''}
          ORDER BY created_at DESC
          LIMIT 20
        `,
        [since24h, ...seedExclusion.params]
      );
      return rows || [];
    } catch (err) {
      logger.warn(
        '[feedbackDigest] newUsers24h query failed (skipping section):',
        err instanceof Error ? err.message : err
      );
      return [];
    }
  })();

  return { tasksCompleted24h, initiativesChanged24h, newUsers24h };
}

function formatNamedRow(row: NamedRow): string {
  const label = row.label || `\`${shortId(String(row.id))}\``;
  return `• ${label}`;
}

function formatRow(row: FeedbackSummaryRow): string {
  const title = row.title || (row.description || '').slice(0, 80) || '(no title)';
  const env = row.source_env ? ` [${row.source_env}]` : '';
  const sev = normalizeSeverity(row);
  const author = row.user_email ? ` — ${row.user_email}` : '';
  return `• \`${shortId(row.id)}\`${env} ${sev} ${title}${author}`;
}

function buildDigestMessage(
  sections: DigestSections,
  work: WorkSections
): { title: string; body: string } | null {
  const { newInLast24h, stuckInNewOver48h, openCriticalProd } = sections;
  const { tasksCompleted24h, initiativesChanged24h, newUsers24h } = work;

  const hasFeedback =
    newInLast24h.length > 0 || stuckInNewOver48h.length > 0 || openCriticalProd.length > 0;
  const hasWork =
    tasksCompleted24h.length > 0 || initiativesChanged24h.length > 0 || newUsers24h.length > 0;
  if (!hasFeedback && !hasWork) {
    return null;
  }

  const lines: string[] = [];
  lines.push(':clipboard: *Raport dowodzenia — dzienny* (ostatnie 24h)');
  lines.push('');

  // --- (a) Zgłoszenia ---
  lines.push('*Zgłoszenia*');
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
    lines.push('');
  }

  // --- (b) Praca ---
  lines.push('*Praca*');
  lines.push(`• Zadania ukończone (24h): *${tasksCompleted24h.length}*`);
  lines.push(`• Inicjatywy ze zmianą statusu (24h): *${initiativesChanged24h.length}*`);
  lines.push('');

  if (tasksCompleted24h.length > 0) {
    lines.push(':white_check_mark: *Zadania ukończone (24h)*');
    tasksCompleted24h.slice(0, 10).forEach((row) => lines.push(formatNamedRow(row)));
    lines.push('');
  }

  if (initiativesChanged24h.length > 0) {
    lines.push(':arrows_counterclockwise: *Inicjatywy — zmiana statusu (24h)*');
    initiativesChanged24h.slice(0, 10).forEach((row) => lines.push(formatNamedRow(row)));
    lines.push('');
  }

  // --- (c) Użytkownicy ---
  lines.push(`*Użytkownicy* — nowi (24h): *${newUsers24h.length}*`);
  if (newUsers24h.length > 0) {
    newUsers24h.slice(0, 10).forEach((row) => lines.push(formatNamedRow(row)));
  }

  return {
    title: 'Raport dowodzenia (dzienny)',
    body: lines.join('\n').replace(/\n+$/g, ''),
  };
}

/**
 * Build and send the digest. Safe to call manually (tests, smoke scripts).
 * Returns the number of rows referenced in the digest, or -1 if Slack is
 * disabled / no message to send.
 */
export async function runFeedbackDigestOnce(): Promise<number> {
  try {
    const sections = (await loadDigestSections()) || {
      newInLast24h: [],
      stuckInNewOver48h: [],
      openCriticalProd: [],
    };
    // Work sections are independently fail-soft (each table may be absent).
    const work = await loadWorkSections().catch((err) => {
      logger.warn(
        '[feedbackDigest] loadWorkSections failed (feedback-only digest):',
        err instanceof Error ? err.message : err
      );
      return {
        tasksCompleted24h: [],
        initiativesChanged24h: [],
        newUsers24h: [],
      } as WorkSections;
    });

    const payload = buildDigestMessage(sections, work);
    if (!payload) {
      logger.info('[feedbackDigest] Nothing to report — skipping digest.');
      return 0;
    }
    const total =
      sections.newInLast24h.length +
      sections.stuckInNewOver48h.length +
      sections.openCriticalProd.length +
      work.tasksCompleted24h.length +
      work.initiativesChanged24h.length +
      work.newUsers24h.length;
    const severity: 'CRITICAL' | 'WARNING' | 'INFO' = sections.openCriticalProd.length
      ? 'CRITICAL'
      : sections.stuckInNewOver48h.length
        ? 'WARNING'
        : 'INFO';
    const env = String(process.env.APP_ENV || process.env.NODE_ENV || 'development');
    const now = new Date();
    const dayKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
    // Slack Command Center: the daily command report goes to #cf-progress.
    // dedupeKey+dedupeWindowMs guard against the SAME day's digest re-firing
    // on every process restart (the router's dedupe is DB-backed, so this
    // survives restarts — unlike the in-memory `lastDigestDayUtc` guard below,
    // which is kept only as a fast local skip and is not, on its own, reliable
    // across restarts).
    await routeToSlack({
      channel: 'progress',
      severity,
      // Headline (watch/phone): `📋 Raport dzienny · <podsumowanie>`.
      category: 'Raport dzienny',
      title: payload.title,
      text: payload.body,
      dedupeKey: `digest:${env}:${dayKey}`,
      dedupeWindowMs: 20 * 60 * 60 * 1000, // 20h — one send per UTC day, next day still fires
    });
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

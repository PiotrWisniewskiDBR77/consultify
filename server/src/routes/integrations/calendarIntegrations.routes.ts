/**
 * CalendarIntegrations Routes
 * API endpoints for calendar integrations
 */

import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

function escapeIcsText(input: string): string {
  // RFC5545 text escaping + folding is simplified here (good enough for MVP).
  return String(input || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsDate(dt: Date): string {
  // Use UTC form (YYYYMMDDTHHMMSSZ)
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}` +
    `T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`
  );
}

async function tryLogIcsSyncAccess(input: {
  orgId: string;
  providerName: string;
  itemsProcessed: number;
}) {
  const orgId = input.orgId;
  const provider = String(input.providerName || '')
    .trim()
    .toLowerCase();
  if (!orgId || !provider) return;

  const logCols = await dbAll<{ name: string }>(
    'PRAGMA table_info(integration_sync_log)',
    []
  ).catch(() => []);
  if (!logCols?.length) return;
  const hasNewCols = (logCols || []).some((c) => String((c as any).name) === 'items_processed');

  const integration = await dbGet<{ id: string }>(
    `
    SELECT i.id
    FROM integrations i
    LEFT JOIN integration_providers p ON p.id = i.provider_id
    WHERE i.organization_id = ?
      AND p.name = ?
      AND (i.status IS NULL OR i.status IN ('active','connected'))
    ORDER BY COALESCE(i.connected_at, i.updated_at, i.last_sync_at) DESC
    LIMIT 1
  `,
    [orgId, provider]
  ).catch(() => null);

  const integrationId = integration?.id ? String(integration.id) : '';
  if (!integrationId) return;

  const nowIso = new Date().toISOString();
  const logId = `log-${uuidv4()}`;

  if (hasNewCols) {
    await dbRun(
      `INSERT INTO integration_sync_log (
        id, integration_id, sync_type, direction, trigger_type,
        status, items_processed, items_created, items_updated, items_failed,
        error_summary, error_details, started_at, completed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        integrationId,
        'incremental',
        'pull',
        'scheduled',
        'success',
        input.itemsProcessed,
        0,
        0,
        0,
        null,
        null,
        nowIso,
        nowIso,
        0,
      ]
    ).catch(() => null);
  } else {
    await dbRun(
      `INSERT INTO integration_sync_log (
        id, integration_id, sync_type, direction,
        status, items_synced, items_failed, error_details,
        started_at, completed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        integrationId,
        'incremental',
        'pull',
        'success',
        input.itemsProcessed,
        0,
        null,
        nowIso,
        nowIso,
        0,
      ]
    ).catch(() => null);
  }
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Minimal "connected" signal: presence of oauth integrations rows (future).
    const integrationsCols = await dbAll<{ name: string }>(
      'PRAGMA table_info(integrations)',
      []
    ).catch(() => []);
    const hasProviderId = (integrationsCols || []).some(
      (c) => String((c as any).name) === 'provider_id'
    );
    let connectedGoogle = false;
    let connectedOutlook = false;

    if (hasProviderId) {
      const rows = await dbAll<any[]>(
        `
        SELECT p.name as provider_name
        FROM integrations i
        LEFT JOIN integration_providers p ON p.id = i.provider_id
        WHERE i.organization_id = ? AND (i.status IS NULL OR i.status IN ('active','connected'))
      `,
        [orgId]
      );
      const set = new Set((rows || []).map((r: any) => String(r?.provider_name || '').trim()));
      connectedGoogle = set.has('google_calendar');
      connectedOutlook = set.has('outlook');
    }

    return res.json({
      providers: [
        { id: 'google', name: 'Google Calendar', connected: connectedGoogle },
        { id: 'outlook', name: 'Outlook', connected: connectedOutlook },
      ],
      // ICS feed works regardless of OAuth connection (subscribe URL in Google/Outlook).
      ics: { url: '/api/integrations/calendar/ics' },
    });
  })
);

router.get(
  '/ics',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const startedAt = Date.now();
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).send('Unauthorized');

    const tasks = await dbAll<
      Array<{
        id: string;
        title: string;
        description: string | null;
        due_date: string | null;
        status: string | null;
      }>
    >(
      `SELECT id, title, description, due_date, status
       FROM tasks
       WHERE organization_id = ? AND due_date IS NOT NULL
       ORDER BY due_date ASC
       LIMIT 500`,
      [orgId]
    );

    // Optional: initiative milestones (including gate milestones) as calendar events
    const milestoneCols = await dbAll<{ name: string }>(
      'PRAGMA table_info(initiative_milestones)',
      []
    ).catch(() => []);
    const hasMilestones = (milestoneCols || []).some(
      (c) => String((c as any).name || '') === 'target_date'
    );
    const milestones = hasMilestones
      ? await dbAll<
          Array<{
            id: string;
            initiative_id: string;
            name: string;
            description: string | null;
            target_date: string | null;
            status: string | null;
            is_gate: number | null;
          }>
        >(
          `SELECT id, initiative_id, name, description, target_date, status, is_gate
           FROM initiative_milestones
           WHERE organization_id = ? AND target_date IS NOT NULL
           ORDER BY target_date ASC
           LIMIT 500`,
          [orgId]
        )
      : [];

    const now = new Date();
    const lines: string[] = [];
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push('PRODID:-//Consultify//Integrations Calendar//EN');
    lines.push('CALSCALE:GREGORIAN');
    lines.push('METHOD:PUBLISH');

    for (const t of tasks || []) {
      const due = t.due_date ? new Date(String(t.due_date)) : null;
      if (!due || Number.isNaN(due.getTime())) continue;

      const uid = `consultify-task-${t.id}@consultify`;
      const dtStart = new Date(due.getTime());
      dtStart.setUTCHours(Math.max(0, dtStart.getUTCHours() - 1)); // 1h before due as a reminder block
      const dtEnd = due;

      const summary = escapeIcsText(`[Task] ${t.title}`);
      const desc = escapeIcsText(
        `${t.description ? `${t.description}\n\n` : ''}Status: ${t.status || 'todo'}\nConsultify Task ID: ${t.id}`
      );

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${formatIcsDate(now)}`);
      lines.push(`DTSTART:${formatIcsDate(dtStart)}`);
      lines.push(`DTEND:${formatIcsDate(dtEnd)}`);
      lines.push(`SUMMARY:${summary}`);
      lines.push(`DESCRIPTION:${desc}`);
      lines.push(`URL:${escapeIcsText(`/execution/tasks/${t.id}`)}`);
      lines.push('END:VEVENT');
    }

    for (const m of milestones || []) {
      const d = m.target_date ? new Date(String(m.target_date)) : null;
      if (!d || Number.isNaN(d.getTime())) continue;

      // All-day-ish event in UTC (we model as a 1h block to keep consistent UTC timestamps).
      const uid = `consultify-milestone-${m.id}@consultify`;
      const dtStart = new Date(d.getTime());
      const dtEnd = new Date(d.getTime() + 60 * 60 * 1000);

      const gateTag = m.is_gate || 0 ? ' [Gate]' : '';
      const summary = escapeIcsText(`[Milestone] ${m.name}${gateTag}`);
      const desc = escapeIcsText(
        `${m.description ? `${m.description}\n\n` : ''}Status: ${m.status || 'PENDING'}\nInitiative ID: ${m.initiative_id}`
      );

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${formatIcsDate(now)}`);
      lines.push(`DTSTART:${formatIcsDate(dtStart)}`);
      lines.push(`DTEND:${formatIcsDate(dtEnd)}`);
      lines.push(`SUMMARY:${summary}`);
      lines.push(`DESCRIPTION:${desc}`);
      lines.push(`URL:${escapeIcsText(`/initiatives/${m.initiative_id}`)}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    // Best-effort audit: write sync-log entries for connected calendar providers.
    const integrationsCols = await dbAll<{ name: string }>(
      'PRAGMA table_info(integrations)',
      []
    ).catch(() => []);
    const hasProviderId = (integrationsCols || []).some(
      (c) => String((c as any).name) === 'provider_id'
    );
    if (hasProviderId) {
      await tryLogIcsSyncAccess({
        orgId,
        providerName: 'google_calendar',
        itemsProcessed: (tasks?.length || 0) + (milestones?.length || 0),
      });
      await tryLogIcsSyncAccess({
        orgId,
        providerName: 'outlook',
        itemsProcessed: (tasks?.length || 0) + (milestones?.length || 0),
      });
    }

    // Always-on feed log (V3-M05)
    const feedCols = await dbAll<{ name: string }>(
      'PRAGMA table_info(calendar_feed_log)',
      []
    ).catch(() => []);
    if ((feedCols || []).length) {
      const id = `cfl-${uuidv4()}`;
      await dbRun(
        `INSERT INTO calendar_feed_log (id, organization_id, feed_type, items_tasks, items_milestones, status, duration_ms, created_at)
         VALUES (?, ?, 'ics', ?, ?, 'success', ?, datetime('now'))`,
        [
          id,
          orgId,
          (tasks || []).length,
          (milestones || []).length,
          Math.max(0, Date.now() - startedAt),
        ]
      ).catch(() => null);
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(lines.join('\r\n'));
  })
);

export default router;

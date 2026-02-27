/**
 * CalendarIntegrations Routes
 * API endpoints for calendar integrations
 */

import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';

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

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Minimal "connected" signal: presence of oauth integrations rows (future).
    const integrationsCols = await dbAll<{ name: string }>('PRAGMA table_info(integrations)', []).catch(() => []);
    const hasProviderId = (integrationsCols || []).some((c) => String((c as any).name) === 'provider_id');
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
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).send('Unauthorized');

    const tasks = await dbAll<
      Array<{ id: string; title: string; description: string | null; due_date: string | null; status: string | null }>
    >(
      `SELECT id, title, description, due_date, status
       FROM tasks
       WHERE organization_id = ? AND due_date IS NOT NULL
       ORDER BY due_date ASC
       LIMIT 500`,
      [orgId]
    );

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
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(lines.join('\r\n'));
  })
);

export default router;

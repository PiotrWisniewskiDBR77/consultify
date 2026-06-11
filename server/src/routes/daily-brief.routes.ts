/**
 * Daily Brief Routes
 * API endpoints for user daily briefing
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;

    // CRITICAL: org scoping (feedback #5d9b15f7 chat-scoping — Daily brief showed VTS
    // tasks when user was active in another org). tasks.organization_id is NOT NULL,
    // so every task has a home org; only return tasks for the user's current active org.
    const tasks = orgId
      ? await dbAll(
          `
    SELECT id, title, priority, due_date FROM tasks
    WHERE assignee_id = ?
      AND organization_id = ?
      AND status != 'completed'
      AND (due_date IS NULL OR due_date <= date('now', '+7 days'))
    ORDER BY priority DESC, due_date ASC LIMIT 10
  `,
          [userId, orgId]
        )
      : [];

    // Same org-scoping rule as tasks above (residual gap from #5d9b15f7):
    // notifications carry organization_id, so a brief rendered in org A must not
    // count/show unread notifications from org B. NULL = legacy/system rows.
    const notifications = orgId
      ? await dbAll(
          `
    SELECT id, title, type, created_at FROM notifications
    WHERE user_id = ? AND (organization_id = ? OR organization_id IS NULL) AND read = 0
    ORDER BY created_at DESC LIMIT 5
  `,
          [userId, orgId]
        )
      : await dbAll(
          `
    SELECT id, title, type, created_at FROM notifications
    WHERE user_id = ? AND read = 0 ORDER BY created_at DESC LIMIT 5
  `,
          [userId]
        );

    const meetings = await dbAll(
      `
    SELECT id, title, start_time, end_time FROM calendar_events
    WHERE user_id = ? AND date(start_time) = date('now') ORDER BY start_time ASC
  `,
      [userId]
    );

    const decisions = await dbAll(
      `
    SELECT id, title, status FROM decisions
    WHERE organization_id = ? AND status = 'pending' LIMIT 5
  `,
      [orgId]
    );

    // Build AI-generated text version of the brief
    const tasksList = (tasks || []) as Array<{ title: string; priority: string; due_date: string }>;
    const meetingsList = (meetings || []) as Array<{ title: string; start_time: string }>;
    const decisionsList = (decisions || []) as Array<{ title: string; status: string }>;
    const notifCount = (notifications || []).length;

    const uiLang = ((req.query.lang as string) || req.headers['accept-language'] || 'pl').split(
      '-'
    )[0];
    const isPl = uiLang === 'pl';

    // Generate a concise text brief (no LLM needed for basic version)
    const lines: string[] = [];
    const today = new Date().toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    lines.push(isPl ? `## Twój brief na ${today}` : `## Your brief for ${today}`);
    lines.push('');

    if (tasksList.length > 0) {
      lines.push(
        isPl ? `### 📋 Zadania (${tasksList.length})` : `### 📋 Tasks (${tasksList.length})`
      );
      for (const t of tasksList.slice(0, 5)) {
        const prio = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
        lines.push(
          `- ${prio} **${t.title}** — ${t.due_date || (isPl ? 'brak terminu' : 'no due date')}`
        );
      }
      if (tasksList.length > 5)
        lines.push(
          isPl ? `_...i ${tasksList.length - 5} więcej_` : `_...and ${tasksList.length - 5} more_`
        );
      lines.push('');
    }

    if (meetingsList.length > 0) {
      lines.push(
        isPl
          ? `### 📅 Spotkania dzisiaj (${meetingsList.length})`
          : `### 📅 Meetings today (${meetingsList.length})`
      );
      for (const m of meetingsList) {
        const time = m.start_time
          ? new Date(m.start_time).toLocaleTimeString(isPl ? 'pl-PL' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
        lines.push(`- ${time} ${m.title}`);
      }
      lines.push('');
    }

    if (decisionsList.length > 0) {
      lines.push(
        isPl
          ? `### ⚖️ Oczekujące decyzje (${decisionsList.length})`
          : `### ⚖️ Pending decisions (${decisionsList.length})`
      );
      for (const d of decisionsList) {
        lines.push(`- ${d.title}`);
      }
      lines.push('');
    }

    if (notifCount > 0) {
      lines.push(
        isPl
          ? `### 🔔 Nieprzeczytane powiadomienia: ${notifCount}`
          : `### 🔔 Unread notifications: ${notifCount}`
      );
      lines.push('');
    }

    if (tasksList.length === 0 && meetingsList.length === 0 && decisionsList.length === 0) {
      lines.push(
        isPl
          ? '_Brak pilnych zadań — dobry dzień na planowanie strategiczne!_'
          : '_No urgent items — great day for strategic planning!_'
      );
    }

    const textVersion = lines.join('\n');

    res.json({
      date: new Date().toISOString().split('T')[0],
      brief: { textVersion },
      tasks: tasks || [],
      notifications: notifications || [],
      meetings: meetings || [],
      pendingDecisions: decisions || [],
      summary: {
        tasksDue: (tasks || []).length,
        unreadNotifications: (notifications || []).length,
        meetingsToday: (meetings || []).length,
        pendingDecisions: (decisions || []).length,
      },
    });
  })
);

router.get(
  '/settings',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const settings = (await dbGet(`SELECT settings FROM daily_brief_settings WHERE user_id = ?`, [
      userId,
    ])) as { settings: string } | null;
    res.json(
      settings?.settings
        ? JSON.parse(settings.settings)
        : {
            enabled: true,
            sendTime: '08:00',
            includeCalendar: true,
            includeTasks: true,
            includeDecisions: true,
            email: false,
          }
    );
  })
);

router.put(
  '/settings',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const settingsJson = JSON.stringify(req.body);
    await dbRun(
      `
    INSERT INTO daily_brief_settings (user_id, settings, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET settings = ?, updated_at = datetime('now')
  `,
      [userId, settingsJson, settingsJson]
    );
    res.json({ success: true });
  })
);

export default router;

/**
 * Notifications Routes
 * API endpoints for notifications and escalations
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { EscalationService } from '../../services/escalationService.js';
import NotificationService from '../../services/notificationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import {
  UpdateNotificationChecklistSchema,
  UpdateNotificationWorksheetSchema,
} from '../../validators/notifications.validators.js';

function isMissingTableError(error: unknown): boolean {
  const message = (error as any)?.message;
  if (typeof message !== 'string') return false;
  return (
    message.includes('no such table') ||
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('Database not initialized')
  );
}

function resolveNotificationsCorrelationId(req: AuthRequest): string | null {
  return (req as any).correlationId || req.get('X-Correlation-ID') || null;
}

function buildNotificationsFailClosedError(
  req: AuthRequest,
  statusCode: number,
  code: string,
  message: string
) {
  return {
    status: statusCode >= 500 ? 'error' : 'fail',
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
    correlationId: resolveNotificationsCorrelationId(req),
  };
}

// Validate verifyToken is available at module load time
if (!verifyToken || typeof verifyToken !== 'function') {
  const error = new Error(
    `verifyToken middleware is not properly exported from auth.middleware.js. ` +
      `Type: ${typeof verifyToken}, Value: ${verifyToken}`
  );
  logger.error('[NotificationsRoutes] Critical error:', error);
  throw error;
}

// Apply rate limiting
const router = Router();

/**
 * GET /api/notifications
 * Get notifications for user
 */
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json(
          buildNotificationsFailClosedError(
            req,
            401,
            'NOTIFICATIONS_UNAUTHORIZED',
            'Authentication is required to access notifications.'
          )
        );
    }

    try {
      const { unreadOnly, limit, projectId } = req.query;
      const notifications = await service.getNotifications(userId, {
        unreadOnly: unreadOnly === 'true',
        limit: limit ? parseInt(limit as string) : 50,
        projectId: projectId as string | undefined,
      });
      return res.json(notifications);
    } catch (err: any) {
      logger.error('[NotificationsRoute] Error:', err);
      return res
        .status(500)
        .json(
          buildNotificationsFailClosedError(
            req,
            500,
            'NOTIFICATIONS_READ_FAILED',
            'Failed to load notifications.'
          )
        );
    }
  })
);

/**
 * POST /api/notifications/broadcast
 * Admin-only: broadcast an app/DBR77 message to users in the org (or selected userIds).
 *
 * Body:
 * {
 *   type: string,
 *   title: string,
 *   body?: string,
 *   message?: string,
 *   severity?: 'INFO'|'WARNING'|'CRITICAL',
 *   category?: string,
 *   actionUrl?: string,
 *   data?: object,
 *   userIds?: string[]
 * }
 */
router.post(
  '/broadcast',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;
    const orgId = (req as any).organizationId || req.user?.organizationId;
    const role = (req as any).userRole || req.user?.role;

    if (!userId || !orgId) {
      return res
        .status(401)
        .json(
          buildNotificationsFailClosedError(
            req,
            401,
            'NOTIFICATIONS_BROADCAST_UNAUTHORIZED',
            'Authentication is required to broadcast notifications.'
          )
        );
    }

    const isAdmin =
      role === 'ADMIN' ||
      role === 'SUPERADMIN' ||
      (req.can && typeof req.can === 'function' && req.can('edit_organization_settings'));
    if (!isAdmin) {
      return res
        .status(403)
        .json(
          buildNotificationsFailClosedError(
            req,
            403,
            'NOTIFICATIONS_BROADCAST_FORBIDDEN',
            'Admin role is required to broadcast notifications.'
          )
        );
    }

    const { type, title, body, message, severity, category, actionUrl, data, userIds } =
      req.body || {};

    if (!type || typeof type !== 'string') {
      return res
        .status(400)
        .json(
          buildNotificationsFailClosedError(
            req,
            400,
            'NOTIFICATIONS_BROADCAST_TYPE_REQUIRED',
            'Notification type is required.'
          )
        );
    }
    if (!title || typeof title !== 'string') {
      return res
        .status(400)
        .json(
          buildNotificationsFailClosedError(
            req,
            400,
            'NOTIFICATIONS_BROADCAST_TITLE_REQUIRED',
            'Notification title is required.'
          )
        );
    }
    try {
      const resolvedBody =
        typeof body === 'string' ? body : typeof message === 'string' ? message : '';

      let targets: { id: string }[] = [];
      try {
        targets =
          Array.isArray(userIds) && userIds.length > 0
            ? userIds.filter((x: any) => typeof x === 'string').map((id: string) => ({ id }))
            : await dbAll<{ id: string }>(
                `SELECT id FROM users WHERE organization_id = ? AND (status IS NULL OR status = 'active')`,
                [orgId],
                { fallback: false }
              );
      } catch (err: unknown) {
        if (isMissingTableError(err)) {
          return res
            .status(503)
            .json(
              buildNotificationsFailClosedError(
                req,
                503,
                'NOTIFICATIONS_SERVICE_NOT_CONFIGURED',
                'Notifications service is temporarily unavailable.'
              )
            );
        }
        throw err;
      }

      const results = await Promise.allSettled(
        (targets || []).map((u) =>
          service.send({
            userId: u.id,
            organizationId: orgId,
            type,
            title,
            body: resolvedBody || title,
            message: typeof message === 'string' ? message : resolvedBody,
            severity: severity as any,
            isActionable: false,
            actionUrl: typeof actionUrl === 'string' ? actionUrl : undefined,
            metadata: typeof category === 'string' ? { category } : undefined,
            data: typeof data === 'object' && data ? data : undefined,
          })
        )
      );

      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - ok;
      return res.json({ success: true, sent: ok, failed });
    } catch {
      return res
        .status(500)
        .json(
          buildNotificationsFailClosedError(
            req,
            500,
            'NOTIFICATIONS_BROADCAST_FAILED',
            'Failed to broadcast notifications.'
          )
        );
    }
  })
);

/**
 * GET /api/notifications/counts
 * Get notification counts for user
 */
router.get(
  '/counts',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const counts = await service.getCounts(userId);
      return res.json(counts);
    } catch (err: any) {
      // Enrichment badge — fail-soft: degrade to zeroed counts instead of 500.
      logger.warn('[Notifications] getCounts degraded', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res.json({ unread: 0, degraded: true });
    }
  })
);

/**
 * GET /api/notifications/preferences
 * Get notification preferences for current user (notification_preferences table)
 */
router.get(
  '/preferences',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const prefs = await service.getPreferences(userId);
      return res.json(prefs || {});
    } catch (err: any) {
      logger.error('[Notifications] getPreferences failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res.status(500).json({
        error: 'Failed to load notification preferences',
        code: 'NOTIFICATIONS_PREFERENCES_LOAD_FAILED',
      });
    }
  })
);

/**
 * PATCH /api/notifications/preferences
 * Update notification preferences for current user (notification_preferences table)
 */
router.patch(
  '/preferences',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const updates = req.body || {};
      await service.updatePreferences(userId, updates);
      const next = await service.getPreferences(userId);
      return res.json(next || {});
    } catch (err: any) {
      // Write — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] updatePreferences failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res.status(500).json({
        error: 'Failed to update notification preferences',
        code: 'NOTIFICATIONS_PREFERENCES_UPDATE_FAILED',
      });
    }
  })
);

/**
 * GET /api/notifications/unread-count
 */
router.get(
  '/unread-count',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized', count: 0 });

    try {
      const counts = await service.getCounts(userId);
      return res.json({ count: counts.unread || 0 });
    } catch (err: any) {
      // Enrichment badge — fail-soft: degrade to zero instead of 500.
      logger.warn('[Notifications] unread-count degraded', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res.json({ count: 0, degraded: true });
    }
  })
);

/**
 * PATCH /api/notifications/:id/read
 */
router.patch(
  '/:id/read',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      await service.markAsRead(req.params.id, userId);
      return res.json({ success: true });
    } catch (err: any) {
      // Write path — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] markAsRead failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res.status(500).json({
        error: 'Failed to mark notification as read',
        code: 'NOTIFICATIONS_MARK_READ_FAILED',
      });
    }
  })
);

/**
 * PATCH /api/notifications/:id/dismiss
 * Dismiss (hide) a notification without deleting
 */
router.patch(
  '/:id/dismiss',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      await service.dismiss(req.params.id, userId);
      return res.json({ success: true });
    } catch (err: any) {
      // Write — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] dismiss failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res
        .status(500)
        .json({ error: 'Failed to dismiss notification', code: 'NOTIFICATIONS_DISMISS_FAILED' });
    }
  })
);

/**
 * POST /api/notifications/mark-all-read
 */
router.post(
  '/mark-all-read',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const count = await service.markAllAsRead(userId);
      return res.json({ success: true, count });
    } catch (err: any) {
      // Write — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] markAllAsRead failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res.status(500).json({
        error: 'Failed to mark all notifications as read',
        code: 'NOTIFICATIONS_MARK_ALL_READ_FAILED',
      });
    }
  })
);

/**
 * GET /api/notifications/escalations/:projectId
 */
router.get(
  '/escalations/:projectId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = EscalationService;
    try {
      const { status } = req.query;
      const organizationId = req.organizationId || req.user?.organizationId || '';
      const escalations = await service.getEscalations(
        req.params.projectId,
        organizationId,
        status as string | undefined
      );
      return res.json(escalations);
    } catch (err: any) {
      // Enrichment read (project escalations panel) — degrade to safe default instead of 500.
      logger.warn('[Notifications] getEscalations degraded', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res.json([]);
    }
  })
);

/**
 * POST /api/notifications/escalations/:projectId/run
 */
router.post(
  '/escalations/:projectId/run',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = EscalationService;

    const role = (req as any).userRole || req.user?.role;
    const canEditProject =
      typeof (req as any).can === 'function'
        ? Boolean((req as any).can('edit_project_settings'))
        : false;
    const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
    if (!isAdmin && !canEditProject) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const organizationId = req.organizationId || req.user?.organizationId || '';
      const result = await service.runAutoEscalation(req.params.projectId, organizationId);
      return res.json(result);
    } catch (err: any) {
      // Write (triggers escalation actions) — never fail-soft.
      logger.error('[Notifications] runAutoEscalation failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res
        .status(500)
        .json({ error: 'Failed to run escalations', code: 'NOTIFICATIONS_ESCALATION_RUN_FAILED' });
    }
  })
);

/**
 * DELETE /api/notifications/:id
 */
router.delete(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      await service.delete(req.params.id, userId);
      return res.json({ success: true });
    } catch (err: any) {
      // Write — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] delete failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res
        .status(500)
        .json({ error: 'Failed to delete notification', code: 'NOTIFICATIONS_DELETE_FAILED' });
    }
  })
);

/**
 * GET /api/notifications/:id
 * Get a single notification by ID
 */
router.get(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const notification = await service.getById(req.params.id, userId);
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      return res.json(notification);
    } catch (err: any) {
      // Primary content read (the notification itself, not enrichment) — never fail-soft.
      logger.error('[Notifications] getById failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res
        .status(500)
        .json({ error: 'Failed to load notification', code: 'NOTIFICATIONS_GET_FAILED' });
    }
  })
);

/**
 * GET /api/notifications/:id/comments
 * Get comments for a notification
 */
router.get(
  '/:id/comments',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const comments = await service.getComments(req.params.id, userId);
      return res.json(comments);
    } catch (err: any) {
      // Enrichment read (side comment thread) — degrade to safe default instead of 500.
      logger.warn('[Notifications] getComments degraded', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res.json([]);
    }
  })
);

/**
 * POST /api/notifications/:id/comments
 * Add a comment to a notification
 */
router.post(
  '/:id/comments',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { content, priority } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'content is required' });
      }
      const comment = await service.addComment(req.params.id, userId, content, priority);
      return res.json(comment);
    } catch (err: any) {
      // Write — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] addComment failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res
        .status(500)
        .json({ error: 'Failed to add comment', code: 'NOTIFICATIONS_COMMENT_CREATE_FAILED' });
    }
  })
);

/**
 * DELETE /api/notifications/:id/comments/:commentId
 * Delete a notification comment
 */
router.delete(
  '/:id/comments/:commentId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      await service.deleteComment(req.params.commentId, userId);
      return res.json({ success: true });
    } catch (err: any) {
      // Write — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] deleteComment failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res
        .status(500)
        .json({ error: 'Failed to delete comment', code: 'NOTIFICATIONS_COMMENT_DELETE_FAILED' });
    }
  })
);

/**
 * GET /api/notifications/:id/activity-log
 * Get activity log entries for a notification
 */
router.get(
  '/:id/activity-log',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const log = await service.getActivityLog(req.params.id, userId);
      return res.json(log);
    } catch (err: any) {
      // Enrichment read (audit-trail side panel) — degrade to safe default instead of 500.
      logger.warn('[Notifications] getActivityLog degraded', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res.json([]);
    }
  })
);

/**
 * POST /api/notifications/:id/snooze
 * Snooze a notification until a given time
 */
router.post(
  '/:id/snooze',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { preset, until } = req.body;

      let snoozeUntil: string;

      if (until) {
        snoozeUntil = new Date(until).toISOString();
      } else if (preset) {
        const now = new Date();
        switch (preset) {
          case '1h':
            now.setHours(now.getHours() + 1);
            break;
          case '4h':
            now.setHours(now.getHours() + 4);
            break;
          case '1d':
            now.setDate(now.getDate() + 1);
            break;
          case '3d':
            now.setDate(now.getDate() + 3);
            break;
          case 'tomorrow':
            now.setDate(now.getDate() + 1);
            now.setHours(9, 0, 0, 0);
            break;
          case 'next_week':
            now.setDate(now.getDate() + (8 - now.getDay()));
            now.setHours(9, 0, 0, 0);
            break;
          default:
            now.setHours(now.getHours() + 1);
        }
        snoozeUntil = now.toISOString();
      } else {
        return res.status(400).json({ error: 'Either preset or until is required' });
      }

      await service.snoozeNotification(req.params.id, userId, snoozeUntil);
      return res.json({ success: true, snoozedUntil: snoozeUntil });
    } catch (err: any) {
      // Write — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] snoozeNotification failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res
        .status(500)
        .json({ error: 'Failed to snooze notification', code: 'NOTIFICATIONS_SNOOZE_FAILED' });
    }
  })
);

/**
 * PATCH /api/notifications/:id/checklist
 * Update the action checklist for a notification
 *
 * ★ 2026-07-23: było `Array.isArray` i nic więcej — element mógł być czymkolwiek,
 * a lista nie miała limitu. Teraz zod (kształt pozycji + cap 200 pozycji).
 * ★ 2026-07-23: 0 dotkniętych wierszy (cudze/nieistniejące id) = 404, nie
 * `{success:true}`. Wcześniej PATCH na cudze powiadomienie kończył się cichym
 * „zapisano" — użytkownik widział sukces, a nie zapisało się nic.
 */
router.patch(
  '/:id/checklist',
  verifyToken,
  validateBody(UpdateNotificationChecklistSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { checklist } = req.body;

      const updated = await service.updateChecklist(req.params.id, userId, checklist);
      if (!updated) {
        return res
          .status(404)
          .json({ error: 'Notification not found', code: 'NOTIFICATION_NOT_FOUND' });
      }
      return res.json({ success: true });
    } catch (err: any) {
      // Write — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] updateChecklist failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res.status(500).json({
        error: 'Failed to update checklist',
        code: 'NOTIFICATIONS_CHECKLIST_UPDATE_FAILED',
      });
    }
  })
);

/**
 * PATCH /api/notifications/:id/worksheet
 * Persist editable worksheet drafts from NotificationDetailView
 *
 * Body: { description?, whyImportant?, blocked?, expectedAction? }
 *
 * ★ 2026-07-23: trasa nie miała ŻADNEJ walidacji (tylko `String(...)`) ani limitu
 * długości, a autozapis w karcie leci co 1,2 s ⇒ kolumna `notifications.data`
 * mogła rosnąć bez ograniczeń. Teraz zod (`.strict()` + limit 20 000 znaków/pole).
 * ★ 2026-07-23: `(service as any)` USUNIĘTE — metoda `updateWorksheetDraft`
 * istnieje na serwisie; cast tylko maskował ewentualną literówkę.
 */
router.patch(
  '/:id/worksheet',
  verifyToken,
  validateBody(UpdateNotificationWorksheetSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      // Po walidacji zod pola są już `string | undefined` — bez `String(...)`.
      const { description, whyImportant, blocked, expectedAction } = req.body || {};
      const updated = await service.updateWorksheetDraft(req.params.id, userId, {
        ...(description !== undefined ? { description } : {}),
        ...(whyImportant !== undefined ? { whyImportant } : {}),
        ...(blocked !== undefined ? { blocked } : {}),
        ...(expectedAction !== undefined ? { expectedAction } : {}),
      });
      if (!updated) {
        return res
          .status(404)
          .json({ error: 'Notification not found', code: 'NOTIFICATION_NOT_FOUND' });
      }
      return res.json({ success: true });
    } catch (err: any) {
      // Write — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] updateWorksheetDraft failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res.status(500).json({
        error: 'Failed to save worksheet draft',
        code: 'NOTIFICATIONS_WORKSHEET_UPDATE_FAILED',
      });
    }
  })
);

/**
 * GET /api/notifications/:id/source-entity
 * Get the source entity (task/decision/initiative) linked to a notification
 */
router.get(
  '/:id/source-entity',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const entity = await service.getSourceEntity(req.params.id, userId);
      if (!entity) {
        return res.status(404).json({ error: 'Source entity not found' });
      }
      return res.json(entity);
    } catch (err: any) {
      // Primary content read (the linked entity itself, not enrichment) — never fail-soft.
      logger.error('[Notifications] getSourceEntity failed', {
        err,
        correlationId: resolveNotificationsCorrelationId(req),
      });
      return res.status(500).json({
        error: 'Failed to load source entity',
        code: 'NOTIFICATIONS_SOURCE_ENTITY_FAILED',
      });
    }
  })
);

export default router;

/**
 * Data Export Routes (GDPR DSR Compliance)
 * Implements user data export functionality for GDPR Data Subject Requests
 */
import { Request, Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
const isAuthenticated = verifyToken; // alias for compatibility
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
const db = {
  get: (sql: string, params: any[]) => dbGet(sql, params),
  all: (sql: string, params: any[]) => dbAll(sql, params),
  run: (sql: string, params: any[]) => dbRun(sql, params),
};

/**
 * POST /api/data-export/request
 * Create a new data export request
 */
router.post('/request', verifyToken, isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { format = 'json', includeAIData = true, includeActivityLogs = true } = req.body;

    // Create export request record
    const requestId = `dsr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    await db.run(
      `
      INSERT INTO gdpr_requests (id, user_id, request_type, status, requested_at, format, options)
      VALUES (?, ?, 'EXPORT', 'PENDING', datetime('now'), ?, ?)
    `,
      [requestId, userId, format, JSON.stringify({ includeAIData, includeActivityLogs })]
    );

    logger.info(`[DataExport] Export request created: ${requestId} for user ${userId}`);

    res.json({
      success: true,
      requestId,
      message: 'Data export request created. You will be notified when the export is ready.',
      estimatedTime: '24-48 hours',
    });
  } catch (error: any) {
    logger.error('[DataExport] Failed to create export request:', error);
    res.status(500).json({ error: 'Failed to create export request', message: error.message });
  }
});

/**
 * GET /api/data-export/status/:requestId
 * Get status of a data export request
 */
router.get(
  '/status/:requestId',
  verifyToken,
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { requestId } = req.params;

      const request = await db.get(
        `
      SELECT id, request_type, status, requested_at, completed_at, download_url, expires_at
      FROM gdpr_requests
      WHERE id = ? AND user_id = ?
    `,
        [requestId, userId]
      );

      if (!request) {
        return res.status(404).json({ error: 'Export request not found' });
      }

      res.json(request);
    } catch (error: any) {
      logger.error('[DataExport] Failed to get export status:', error);
      res.status(500).json({ error: 'Failed to get export status', message: error.message });
    }
  }
);

/**
 * GET /api/data-export/requests
 * Get all export requests for the current user
 */
router.get('/requests', verifyToken, isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const requests = await db.all(
      `
      SELECT id, request_type, status, requested_at, completed_at, download_url, expires_at
      FROM gdpr_requests
      WHERE user_id = ? AND request_type = 'EXPORT'
      ORDER BY requested_at DESC
      LIMIT 20
    `,
      [userId]
    );

    res.json(requests || []);
  } catch (error: any) {
    logger.error('[DataExport] Failed to get export requests:', error);
    res.status(500).json({ error: 'Failed to get export requests', message: error.message });
  }
});

/**
 * GET /api/data-export/download/:requestId
 * Download a completed data export
 */
router.get(
  '/download/:requestId',
  verifyToken,
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { requestId } = req.params;

      const request = (await db.get(
        `
      SELECT id, status, download_url, expires_at, format
      FROM gdpr_requests
      WHERE id = ? AND user_id = ? AND request_type = 'EXPORT'
    `,
        [requestId, userId]
      )) as {
        id: string;
        status: string;
        download_url: string;
        expires_at: string;
        format: string;
      } | null;

      if (!request) {
        return res.status(404).json({ error: 'Export request not found' });
      }

      if (request.status !== 'COMPLETED') {
        return res.status(400).json({ error: 'Export not yet ready', status: request.status });
      }

      if (request.expires_at && new Date(request.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Export has expired. Please create a new request.' });
      }

      // For now, generate export inline (in production, would fetch from storage)
      const exportData = await generateUserExport(userId, request.format || 'json');

      const filename = `user-data-export-${requestId}.${request.format || 'json'}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', request.format === 'json' ? 'application/json' : 'text/csv');

      res.send(exportData);
    } catch (error: any) {
      logger.error('[DataExport] Failed to download export:', error);
      res.status(500).json({ error: 'Failed to download export', message: error.message });
    }
  }
);

/**
 * POST /api/data-export/delete-request
 * Create a data deletion request (Right to be Forgotten)
 */
router.post(
  '/delete-request',
  verifyToken,
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { reason, confirmationEmail } = req.body;

      // Verify email matches
      const user = (await db.get('SELECT email FROM users WHERE id = ?', [userId])) as {
        email: string;
      } | null;
      if (!user || user.email !== confirmationEmail) {
        return res.status(400).json({ error: 'Email confirmation does not match' });
      }

      const requestId = `del-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Create deletion request with 30-day grace period
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 30);

      await db.run(
        `
      INSERT INTO gdpr_requests (id, user_id, request_type, status, requested_at, scheduled_date, options)
      VALUES (?, ?, 'DELETE', 'SCHEDULED', datetime('now'), ?, ?)
    `,
        [requestId, userId, scheduledDate.toISOString(), JSON.stringify({ reason })]
      );

      logger.info(`[DataExport] Deletion request created: ${requestId} for user ${userId}`);

      res.json({
        success: true,
        requestId,
        message:
          'Account deletion scheduled. Your account and data will be deleted after the grace period.',
        gracePeriodDays: 30,
        scheduledDate: scheduledDate.toISOString(),
      });
    } catch (error: any) {
      logger.error('[DataExport] Failed to create deletion request:', error);
      res.status(500).json({ error: 'Failed to create deletion request', message: error.message });
    }
  }
);

/**
 * DELETE /api/data-export/delete-request/:requestId
 * Cancel a pending deletion request
 */
router.delete(
  '/delete-request/:requestId',
  verifyToken,
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { requestId } = req.params;

      const result = await db.run(
        `
      UPDATE gdpr_requests
      SET status = 'CANCELLED'
      WHERE id = ? AND user_id = ? AND request_type = 'DELETE' AND status = 'SCHEDULED'
    `,
        [requestId, userId]
      );

      if ((result as any).changes === 0) {
        return res.status(404).json({ error: 'Deletion request not found or already processed' });
      }

      res.json({ success: true, message: 'Deletion request cancelled' });
    } catch (error: any) {
      logger.error('[DataExport] Failed to cancel deletion request:', error);
      res.status(500).json({ error: 'Failed to cancel deletion request', message: error.message });
    }
  }
);

/**
 * Helper function to generate user data export
 */
async function generateUserExport(userId: string, format: string): Promise<string> {
  const userData: any = {};

  // Collect user profile
  userData.profile = await db.get(
    `
    SELECT id, email, first_name, last_name, created_at, updated_at, role
    FROM users WHERE id = ?
  `,
    [userId]
  );

  // Collect user preferences
  userData.preferences = await db.get(
    `
    SELECT * FROM user_preferences WHERE user_id = ?
  `,
    [userId]
  );

  // Collect activity logs (last 1000)
  userData.activityLogs = await db.all(
    `
    SELECT action_type, resource_type, created_at
    FROM activity_logs WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 1000
  `,
    [userId]
  );

  // Collect AI conversations (metadata only, not full content)
  userData.aiConversations = await db.all(
    `
    SELECT id, title, created_at, updated_at, mode
    FROM ai_conversations WHERE user_id = ?
    ORDER BY created_at DESC
  `,
    [userId]
  );

  // Collect projects
  userData.projects = await db.all(
    `
    SELECT id, name, created_at, status
    FROM projects WHERE owner_id = ? OR id IN (
      SELECT project_id FROM project_members WHERE user_id = ?
    )
  `,
    [userId, userId]
  );

  userData.exportedAt = new Date().toISOString();
  userData.version = '1.0';

  if (format === 'json') {
    return JSON.stringify(userData, null, 2);
  } else {
    // Simple CSV conversion for profile data
    const lines = ['field,value'];
    if (userData.profile) {
      Object.entries(userData.profile).forEach(([key, value]) => {
        lines.push(`${key},"${String(value).replace(/"/g, '""')}"`);
      });
    }
    return lines.join('\n');
  }
}

export default router;

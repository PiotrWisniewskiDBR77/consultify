/**
 * Data Export Routes (GDPR DSR Compliance)
 * Implements user data export functionality for GDPR Data Subject Requests
 */
import { Request, Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
const isAuthenticated = verifyToken; // alias for compatibility
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import { requireNoLegalHold } from '../services/OrgPoliciesService.js';
import { requireActiveMembership } from '../services/legacyCutover/requireActiveMembership.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

async function checkLegalHoldForUser(
  db: { get: (sql: string, params: any[]) => Promise<any> },
  userId: string,
  operation: string
): Promise<void> {
  const user = (await db.get('SELECT organization_id FROM users WHERE id = ?', [userId])) as {
    organization_id: string;
  } | null;
  const orgId = user?.organization_id;
  if (orgId) await requireNoLegalHold(orgId, operation);
}

const router = Router();
// This legacy-mounted DSR surface remains reachable at `/api/user/*`.  Keep it
// fail-closed until the settings cutover retires its duplicate writers: a
// valid token alone must never be enough after membership revocation.
router.use(verifyToken, requireActiveMembership);
const db = {
  get: (sql: string, params: any[]) => dbGet(sql, params),
  all: (sql: string, params: any[]) => dbAll(sql, params),
  run: (sql: string, params: any[]) => dbRun(sql, params),
};

/**
 * POST /api/data-export/request
 * Create a new data export request
 */
router.post(
  '/request',
  verifyToken,
  isAuthenticated,
  requireAudit,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await checkLegalHoldForUser(db, userId, 'Data export request');
      const { format = 'json', includeAIData = true, includeActivityLogs = true } = req.body;

      // Create export request record
      const requestId = `dsr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // gdpr_requests.organization_id and .type are NOT NULL with no DB default
      // (Postgres rejects the row; SQLite let both slide). `type` is also the
      // column the superadmin Legal Panel (superadmin.routes.ts GET
      // /gdpr/requests) displays — leaving it null hid every export/deletion
      // request created through this router from that panel.
      const orgRow = (await db.get('SELECT organization_id FROM users WHERE id = ?', [userId])) as {
        organization_id: string;
      } | null;
      const organizationId = orgRow?.organization_id;
      if (!organizationId) {
        return res.status(404).json({ error: 'User organization not found' });
      }

      await db.run(
        `
      INSERT INTO gdpr_requests (id, organization_id, user_id, type, request_type, status, requested_at, format, options)
      VALUES (?, ?, ?, 'export', 'EXPORT', 'PENDING', datetime('now'), ?, ?)
    `,
        [
          requestId,
          organizationId,
          userId,
          format,
          JSON.stringify({ includeAIData, includeActivityLogs }),
        ]
      );

      logger.info(`[DataExport] Export request created: ${requestId} for user ${userId}`);
      await (req as any).emitAuditEvent?.({
        actorType: 'USER',
        action: 'create',
        resourceType: 'data_export_request',
        resourceId: requestId,
        after: { format, includeAIData, includeActivityLogs, status: 'PENDING' },
        metadata: { userId },
      });

      res.json({
        success: true,
        requestId,
        message: 'Data export request created. You will be notified when the export is ready.',
        estimatedTime: '24-48 hours',
      });
    } catch (error: any) {
      if (error?.code === 'LEGAL_HOLD') {
        return res.status(403).json({ error: error.message, code: 'LEGAL_HOLD' });
      }
      logger.error('[DataExport] Failed to create export request:', {
        err: error,
        correlationId: (req as any).correlationId,
      });
      res.status(500).json({
        error: 'Nie udało się utworzyć wniosku o eksport danych',
        code: 'DATA_EXPORT_CREATE_REQUEST_FAILED',
      });
    }
  }
);

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
      logger.error('[DataExport] Failed to get export status:', {
        err: error,
        correlationId: (req as any).correlationId,
      });
      res.status(500).json({
        error: 'Nie udało się pobrać statusu eksportu',
        code: 'DATA_EXPORT_STATUS_FAILED',
      });
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
    logger.error('[DataExport] Failed to get export requests:', {
      err: error,
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać wniosków o eksport',
      code: 'DATA_EXPORT_LIST_REQUESTS_FAILED',
    });
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
      await checkLegalHoldForUser(db, userId, 'Data export download');

      // For now, generate export inline (in production, would fetch from storage)
      const exportData = await generateUserExport(userId, request.format || 'json');

      const filename = `user-data-export-${requestId}.${request.format || 'json'}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', request.format === 'json' ? 'application/json' : 'text/csv');

      res.send(exportData);
    } catch (error: any) {
      if (error?.code === 'LEGAL_HOLD') {
        return res.status(403).json({ error: error.message, code: 'LEGAL_HOLD' });
      }
      logger.error('[DataExport] Failed to download export:', {
        err: error,
        correlationId: (req as any).correlationId,
      });
      res
        .status(500)
        .json({ error: 'Nie udało się pobrać eksportu', code: 'DATA_EXPORT_DOWNLOAD_FAILED' });
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
  requireAudit,
  async (_req: Request, res: Response) => {
    return res.status(410).json({
      success: false,
      code: 'SET_DELETE_APPROVED_OUT',
      error: 'Legacy deletion requests are retired. Use /api/settings/gdpr/deletion-request.',
      destructiveExecution: false,
    });
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
  requireAudit,
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

      await (req as any).emitAuditEvent?.({
        actorType: 'USER',
        action: 'cancel',
        resourceType: 'data_delete_request',
        resourceId: requestId,
        after: { status: 'CANCELLED' },
        metadata: { userId },
      });

      res.json({ success: true, message: 'Deletion request cancelled' });
    } catch (error: any) {
      logger.error('[DataExport] Failed to cancel deletion request:', {
        err: error,
        correlationId: (req as any).correlationId,
      });
      res.status(500).json({
        error: 'Nie udało się anulować wniosku o usunięcie danych',
        code: 'DATA_EXPORT_CANCEL_DELETION_FAILED',
      });
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

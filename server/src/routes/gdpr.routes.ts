/**
 * GDPR Routes
 * API endpoints for GDPR compliance features
 *
 * Full TypeScript migration from server/routes/gdpr.js
 *
 * Features:
 * - Consent management
 * - Data retention settings
 * - Data export requests
 * - Account deletion (right to be forgotten)
 */

import { type Request, type Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { flagOn } from '../utils/pgFlags.js';
import { verifyUserPassword } from '../utils/verifyUserPassword.js';
import { materializeUserDataExport } from '../services/gdprService.js';

// Apply rate limiting
const router = Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// ==========================================
// TYPES
// ==========================================

interface GDPRConsents {
  analytics: boolean;
  personalization: boolean;
  marketing: boolean;
  thirdPartySharing: boolean;
  aiTraining: boolean;
}

interface DataRetention {
  period: '30' | '90' | '180' | '365' | 'forever';
  autoDelete: boolean;
}

interface ExportRequest {
  id: string;
  status: 'pending' | 'processing' | 'ready' | 'expired';
  requestedAt: string;
  expiresAt?: string;
  scheduledFor?: string;
  downloadUrl?: string;
}

interface UserDataExport {
  exportDate: string;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    role: string;
    created_at: string;
    last_login_at: string | null;
  } | null;
  profile: unknown | null;
  preferences: unknown | null;
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    due_date: string | null;
    created_at: string;
  }>;
  assessments: unknown[];
  notifications: unknown[];
  securityEvents: Array<{
    type: string;
    title: string;
    description: string | null;
    ip_address: string | null;
    created_at: string;
  }>;
}

function resolveGdprCorrelationId(req: AuthRequest): string | null {
  const reqCorrelationId =
    (req as AuthRequest & { correlationId?: string }).correlationId || req.get('X-Correlation-ID');
  return typeof reqCorrelationId === 'string' && reqCorrelationId.trim().length > 0
    ? reqCorrelationId.trim()
    : null;
}

function buildGdprError(
  req: AuthRequest,
  statusCode: number,
  code: string,
  message: string
): {
  status: 'fail' | 'error';
  correlationId: string | null;
  error: { code: string; message: string; timestamp: string };
} {
  return {
    status: statusCode >= 500 ? 'error' : 'fail',
    correlationId: resolveGdprCorrelationId(req),
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
  };
}

// ==========================================
// DATABASE HELPERS
// ==========================================
// Using DbPromise utility - no local helpers needed

// ==========================================
// CONSENT MANAGEMENT
// ==========================================

/**
 * GET /api/gdpr/consents
 * Get user consent preferences
 */
router.get(
  '/consents',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const row = await dbGet<{
        analytics: number | boolean;
        personalization: number | boolean;
        marketing: number | boolean;
        thirdPartySharing: number | boolean;
        aiTraining: number | boolean;
      }>(
        `SELECT 
                analytics, personalization, marketing,
                third_party_sharing as "thirdPartySharing",
                ai_training as "aiTraining"
            FROM user_gdpr_consents
            WHERE user_id = ?`,
        [userId]
      );

      if (row) {
        return res.json({
          success: true,
          consents: {
            analytics: flagOn(row.analytics),
            personalization: flagOn(row.personalization),
            marketing: flagOn(row.marketing),
            thirdPartySharing: flagOn(row.thirdPartySharing),
            aiTraining: flagOn(row.aiTraining),
          },
        });
      } else {
        // Return defaults
        return res.json({
          success: true,
          consents: {
            analytics: true,
            personalization: true,
            marketing: false,
            thirdPartySharing: false,
            aiTraining: true,
          },
        });
      }
    } catch (err: any) {
      logger.error('[GDPR] Consents error:', err);
      return res.status(500).json({ error: 'Failed to get consents' });
    }
  })
);

/**
 * PUT /api/gdpr/consents
 * Update user consent preferences
 */
router.put(
  '/consents',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { consents } = req.body as { consents?: GDPRConsents };

      if (!consents) {
        return res
          .status(400)
          .json(
            buildGdprError(
              req,
              400,
              'GDPR_CONSENTS_PAYLOAD_REQUIRED',
              'Consents payload is required.'
            )
          );
      }

      await dbRun(
        `INSERT INTO user_gdpr_consents (
                user_id, analytics, personalization, marketing,
                third_party_sharing, ai_training, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET
                analytics = excluded.analytics,
                personalization = excluded.personalization,
                marketing = excluded.marketing,
                third_party_sharing = excluded.third_party_sharing,
                ai_training = excluded.ai_training,
                updated_at = datetime('now')`,
        [
          userId,
          consents.analytics ? 1 : 0,
          consents.personalization ? 1 : 0,
          consents.marketing ? 1 : 0,
          consents.thirdPartySharing ? 1 : 0,
          consents.aiTraining ? 1 : 0,
        ]
      );

      return res.json({ success: true, message: 'Consents updated' });
    } catch (err: any) {
      logger.error('[GDPR] Update consents error:', err);
      return res
        .status(500)
        .json(
          buildGdprError(req, 500, 'GDPR_CONSENTS_UPDATE_FAILED', 'Failed to update consents.')
        );
    }
  })
);

// ==========================================
// DATA RETENTION
// ==========================================

/**
 * GET /api/gdpr/retention
 * Get data retention settings
 */
router.get(
  '/retention',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const row = await dbGet<{ period: string; autoDelete: number | boolean }>(
        `SELECT retention_period as period, auto_delete as "autoDelete"
            FROM user_data_retention
            WHERE user_id = ?`,
        [userId]
      );

      if (row) {
        return res.json({
          success: true,
          retention: {
            period: row.period,
            autoDelete: !!row.autoDelete,
          },
        });
      } else {
        return res.json({
          success: true,
          retention: {
            period: '365',
            autoDelete: false,
          },
        });
      }
    } catch (err: any) {
      logger.error('[GDPR] Retention error:', err);
      return res.status(500).json({ error: 'Failed to get retention settings' });
    }
  })
);

/**
 * PUT /api/gdpr/retention
 * Update data retention settings
 */
router.put(
  '/retention',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { retention } = req.body as { retention?: DataRetention };

      if (!retention) {
        return res
          .status(400)
          .json(
            buildGdprError(
              req,
              400,
              'GDPR_RETENTION_PAYLOAD_REQUIRED',
              'Retention payload is required.'
            )
          );
      }

      const validPeriods = ['30', '90', '180', '365', 'forever'];
      if (!validPeriods.includes(retention.period)) {
        return res
          .status(400)
          .json(
            buildGdprError(
              req,
              400,
              'GDPR_RETENTION_PERIOD_INVALID',
              'Retention period is invalid.'
            )
          );
      }

      await dbRun(
        `INSERT INTO user_data_retention (
                user_id, retention_period, auto_delete, updated_at
            ) VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET
                retention_period = excluded.retention_period,
                auto_delete = excluded.auto_delete,
                updated_at = datetime('now')`,
        [userId, retention.period, retention.autoDelete ? 1 : 0]
      );

      return res.json({ success: true, message: 'Retention settings updated' });
    } catch (err: any) {
      logger.error('[GDPR] Update retention error:', err);
      return res
        .status(500)
        .json(
          buildGdprError(req, 500, 'GDPR_RETENTION_UPDATE_FAILED', 'Failed to update retention.')
        );
    }
  })
);

// ==========================================
// DATA EXPORT
// ==========================================

/**
 * GET /api/gdpr/export-status
 * Get current export request status
 */
router.get(
  '/export-status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const request = await dbGet<ExportRequest>(
        `SELECT id, status, requested_at as "requestedAt",
                    expires_at as "expiresAt", download_url as "downloadUrl"
            FROM data_export_requests
            WHERE user_id = ?
            ORDER BY requested_at DESC
            LIMIT 1`,
        [userId]
      );

      return res.json({
        success: true,
        request: request || null,
      });
    } catch (err: any) {
      logger.error('[GDPR] Export status error:', err);
      return res.status(500).json({ error: 'Failed to get export status' });
    }
  })
);

/**
 * POST /api/gdpr/export-request
 * Request data export
 */
router.post(
  '/export-request',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const organizationId = req.organizationId;
      if (!organizationId) {
        return res.status(403).json(
          buildGdprError(
            req,
            403,
            'GDPR_EXPORT_ORGANIZATION_REQUIRED',
            'Organization context is required.'
          )
        );
      }

      // Check for existing pending request
      const existing = await dbGet<{ id: string }>(
        `SELECT id FROM data_export_requests
            WHERE user_id = ? AND status IN ('pending', 'processing')`,
        [userId]
      );

      if (existing) {
        return res.status(400).json({
          ...buildGdprError(
            req,
            400,
            'GDPR_EXPORT_REQUEST_ALREADY_IN_PROGRESS',
            'An export request is already in progress.'
          ),
        });
      }

      const requestId = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // data_export_requests.export_type is NOT NULL with no DB default and a
      // CHECK restricting it to 'full' | 'partial' | 'gdpr' — this endpoint is
      // the GDPR data-subject-request export, so 'gdpr' is the correct value.
      await dbRun(
        `INSERT INTO data_export_requests (
                id, organization_id, user_id, export_type, status, requested_at, expires_at
            ) VALUES (?, ?, ?, 'gdpr', 'pending', datetime('now'), ?)`,
        [requestId, organizationId, userId, expiresAt.toISOString()]
      );

      // In a real implementation, this would queue a background job
      // For now, we'll simulate processing
      setTimeout(async () => {
        try {
          // Generate export data
          const _userData = await collectUserData(userId);

          // In production, this would be stored in cloud storage
          // For now, we mark as ready
          await dbRun(
            `UPDATE data_export_requests 
                    SET status = 'ready', 
                        download_url = ?
                    WHERE id = ?`,
            [`/api/gdpr/download-export/${requestId}`, requestId]
          );
        } catch (err: any) {
          logger.error('[GDPR] Export processing error:', err);
        }
      }, 2000);

      return res.json({
        success: true,
        request: {
          id: requestId,
          status: 'pending',
          requestedAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (err: any) {
      logger.error('[GDPR] Export request error:', err);
      return res
        .status(500)
        .json(buildGdprError(req, 500, 'GDPR_EXPORT_REQUEST_FAILED', 'Failed to request export.'));
    }
  })
);

/**
 * GET /api/gdpr/download-export/:requestId
 * Download export file
 */
router.get(
  '/download-export/:requestId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { requestId } = req.params;

      const request = await dbGet<{ expires_at: string; organization_id: string }>(
        `SELECT * FROM data_export_requests
            WHERE id = ? AND user_id = ? AND status = 'ready'`,
        [requestId, userId]
      );

      if (!request) {
        return res
          .status(404)
          .json(
            buildGdprError(
              req,
              404,
              'GDPR_EXPORT_NOT_READY',
              'Export was not found or is not ready.'
            )
          );
      }

      // Check expiration
      if (new Date(request.expires_at) < new Date()) {
        return res
          .status(410)
          .json(buildGdprError(req, 410, 'GDPR_EXPORT_EXPIRED', 'Export has expired.'));
      }

      // Generate fresh export data
      const userData = await collectUserData(userId);
      const artifact = await materializeUserDataExport({
        requestId,
        userId,
        organizationId: request.organization_id,
        payload: userData,
      });
      if (!artifact) {
        return res.status(404).json(
          buildGdprError(req, 404, 'GDPR_EXPORT_NOT_AUTHORIZED', 'Export was not found.')
        );
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Digest', `sha-256=${artifact.sha256}`);
      res.setHeader('X-Export-Receipt-SHA256', artifact.sha256);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=consultify-data-export-${new Date().toISOString().split('T')[0]}.json`
      );
      return res.send(artifact.body);
    } catch (err: any) {
      logger.error('[GDPR] Download export error:', err);
      return res
        .status(500)
        .json(
          buildGdprError(req, 500, 'GDPR_EXPORT_DOWNLOAD_FAILED', 'Failed to download export.')
        );
    }
  })
);

// ==========================================
// ACCOUNT DELETION
// ==========================================

/**
 * POST /api/gdpr/deletion-request
 * Request account deletion
 */
router.post(
  '/deletion-request',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { password } = (req.body || {}) as { password?: unknown };

      // Verify the user's password before scheduling an irreversible account
      // deletion. Keeps this route in lockstep with the settings deletion routes.
      const passwordCheck = await verifyUserPassword(userId, password);
      if (passwordCheck.ok === false) {
        return res.status(passwordCheck.status).json({ error: passwordCheck.error });
      }

      // Check for existing pending deletion
      const existing = await dbGet<{ id: string }>(
        `SELECT id FROM account_deletion_requests
            WHERE user_id = ? AND status IN ('pending', 'scheduled')`,
        [userId]
      );

      if (existing) {
        return res.status(400).json({
          error: 'A deletion request is already pending',
        });
      }

      const requestId = uuidv4();
      const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days grace period

      await dbRun(
        `INSERT INTO account_deletion_requests (
                id, user_id, status, requested_at, scheduled_for
            ) VALUES (?, ?, 'scheduled', datetime('now'), ?)`,
        [requestId, userId, scheduledFor.toISOString()]
      );

      return res.json({
        success: true,
        request: {
          id: requestId,
          status: 'scheduled',
          requestedAt: new Date().toISOString(),
          scheduledFor: scheduledFor.toISOString(),
        },
      });
    } catch (err: any) {
      logger.error('[GDPR] Deletion request error:', err);
      return res.status(500).json({ error: 'Failed to request deletion' });
    }
  })
);

/**
 * POST /api/gdpr/cancel-deletion
 * Cancel pending deletion request
 */
router.post(
  '/cancel-deletion',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { requestId } = req.body as { requestId?: string };

      if (!requestId) {
        return res.status(400).json({ error: 'Request ID required' });
      }

      const result = await dbRun(
        `UPDATE account_deletion_requests 
            SET status = 'cancelled'
            WHERE id = ? AND user_id = ? AND status = 'scheduled'`,
        [requestId, userId]
      );

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Deletion request not found' });
      }

      return res.json({ success: true, message: 'Deletion cancelled' });
    } catch (err: any) {
      logger.error('[GDPR] Cancel deletion error:', err);
      return res.status(500).json({ error: 'Failed to cancel deletion' });
    }
  })
);

/**
 * GET /api/gdpr/deletion-status
 * Get deletion request status
 */
router.get(
  '/deletion-status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const request = await dbGet<ExportRequest>(
        `SELECT id, status, requested_at as "requestedAt",
                    scheduled_for as "scheduledFor"
            FROM account_deletion_requests
            WHERE user_id = ?
            ORDER BY requested_at DESC
            LIMIT 1`,
        [userId]
      );

      return res.json({
        success: true,
        request: request || null,
      });
    } catch (err: any) {
      logger.error('[GDPR] Deletion status error:', err);
      return res.status(500).json({ error: 'Failed to get deletion status' });
    }
  })
);

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Collect all user data for export
 */
async function collectUserData(userId: string): Promise<UserDataExport> {
  const data: UserDataExport = {
    exportDate: new Date().toISOString(),
    user: null,
    profile: null,
    preferences: null,
    projects: [],
    tasks: [],
    assessments: [],
    notifications: [],
    securityEvents: [],
  };

  // Get user basic info
  data.user = await dbGet<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    role: string;
    created_at: string;
    last_login_at: string | null;
  }>(
    `SELECT id, email, first_name, last_name, phone, role, 
                created_at, last_login_at
        FROM users WHERE id = ?`,
    [userId]
  );

  // Get extended preferences
  const prefsRow = await dbGet<{ extended_preferences?: string }>(
    `SELECT extended_preferences FROM users WHERE id = ?`,
    [userId]
  );
  data.preferences = prefsRow?.extended_preferences
    ? JSON.parse(prefsRow.extended_preferences)
    : null;

  // Get projects
  data.projects = await dbAll<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, name, description, status, created_at, updated_at
        FROM projects WHERE owner_id = ? OR id IN (
            SELECT project_id FROM project_members WHERE user_id = ?
        )`,
    [userId, userId]
  );

  // Get tasks
  data.tasks = await dbAll<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    due_date: string | null;
    created_at: string;
  }>(
    `SELECT id, title, description, status, priority, due_date, created_at
        FROM tasks WHERE assignee_id = ? OR created_by = ?`,
    [userId, userId]
  );

  // Get security events
  data.securityEvents = await dbAll<{
    type: string;
    title: string;
    description: string | null;
    ip_address: string | null;
    created_at: string;
  }>(
    `SELECT type, title, description, ip_address, created_at
        FROM security_events WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 100`,
    [userId]
  );

  return data;
}

export default router;

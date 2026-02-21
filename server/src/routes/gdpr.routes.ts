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

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  collectUserData,
  createAccountDeletionRequest,
  createDataExportRequest,
  getLatestDataExportRequest,
  getLatestDeletionRequest,
} from '../services/gdprService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

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
                third_party_sharing as thirdPartySharing,
                ai_training as aiTraining
            FROM user_gdpr_consents
            WHERE user_id = ?`,
        [userId]
      );

      if (row) {
        return res.json({
          success: true,
          consents: {
            analytics: !!row.analytics,
            personalization: !!row.personalization,
            marketing: !!row.marketing,
            thirdPartySharing: !!row.thirdPartySharing,
            aiTraining: !!row.aiTraining,
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
        return res.status(400).json({ error: 'Consents data required' });
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
      return res.status(500).json({ error: 'Failed to update consents' });
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
        `SELECT retention_period as period, auto_delete as autoDelete
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
        return res.status(400).json({ error: 'Retention data required' });
      }

      const validPeriods = ['30', '90', '180', '365', 'forever'];
      if (!validPeriods.includes(retention.period)) {
        return res.status(400).json({ error: 'Invalid retention period' });
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
      return res.status(500).json({ error: 'Failed to update retention' });
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
      const request = await getLatestDataExportRequest(userId);

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
      const request = await createDataExportRequest({
        userId,
        organizationId: req.organizationId,
        format: (req.body as any)?.format,
        include: (req.body as any)?.include,
      });

      return res.json({ success: true, request });
    } catch (err: any) {
      logger.error('[GDPR] Export request error:', err);
      return res.status(500).json({ error: 'Failed to request export' });
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

      const request = await dbGet<any>(
        `SELECT * FROM data_export_requests WHERE id = ? AND user_id = ?`,
        [requestId, userId]
      );

      if (!request) {
        return res.status(404).json({ error: 'Export not found' });
      }

      // Check expiration
      const expiresAt = request.expires_at || request.file_expires_at || request.expiresAt;
      if (expiresAt && new Date(expiresAt) < new Date()) {
        return res.status(410).json({ error: 'Export has expired' });
      }

      // Generate fresh export data
      const userData = await collectUserData(userId);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=consultinity-data-export-${new Date().toISOString().split('T')[0]}.json`
      );
      return res.send(JSON.stringify(userData, null, 2));
    } catch (err: any) {
      logger.error('[GDPR] Download export error:', err);
      return res.status(500).json({ error: 'Failed to download export' });
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
      const request = await createAccountDeletionRequest({
        userId,
        reason: (req.body as any)?.reason,
      });

      return res.json({ success: true, request });
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
      const request = await getLatestDeletionRequest(userId);

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

export default router;

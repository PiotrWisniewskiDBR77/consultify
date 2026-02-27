/**
 * AI Drafts Routes
 * API endpoints for managing AI-generated drafts in the Draft-Review-Approve pattern
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

// Apply rate limiting
const router = Router();

const serviceFallback = (
  req: AuthRequest,
  res: Response,
  readPayload?: Record<string, unknown>
) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({
      success: true,
      status: 'not_configured',
      feature: 'ai-drafts',
      writable: false,
      ...(readPayload || {}),
    });
  }
  return res.status(501).json({
    success: false,
    error: 'Feature not configured in this deployment',
    code: 'FEATURE_NOT_CONFIGURED',
    feature: 'ai-drafts',
    writable: false,
  });
};

// Service interfaces
interface DraftServiceInterface {
  getPendingDrafts?: (
    userId: string,
    options: {
      organizationId: string;
      projectId?: string;
      draftType?: string;
      limit?: number;
    }
  ) => Promise<unknown[]>;
  getDraft?: (id: string) => Promise<unknown>;
  getDraftsForEntity?: (type: string, id: string) => Promise<unknown[]>;
  createDraft?: (data: {
    organizationId: string;
    projectId?: string;
    userId: string;
    draftType: string;
    targetEntityType?: string;
    targetEntityId?: string;
    targetField?: string;
    originalContent?: string;
    suggestedContent: string;
    confidence?: number;
    reasoning?: string;
    modelUsed?: string;
    tokensUsed?: number;
  }) => Promise<unknown>;
  approveDraft?: (
    id: string,
    options: {
      reviewedBy: string;
      notes?: string;
      modifications?: unknown;
    }
  ) => Promise<{ success: boolean; status?: string; reason?: string }>;
  rejectDraft?: (
    id: string,
    options: {
      reviewedBy: string;
      notes?: string;
    }
  ) => Promise<{ success: boolean; status?: string; reason?: string }>;
  getDraftStats?: (
    userId: string,
    organizationId: string
  ) => Promise<{
    total: number;
    approved?: number;
    modified?: number;
  }>;
  expireOldDrafts?: () => Promise<{ expired: number }>;
}

interface DraftTypes {
  [key: string]: unknown;
}

// Dynamic imports for services (may not be migrated yet)
let draftService: DraftServiceInterface | null = null;
let DRAFT_TYPES: DraftTypes | null = null;
let aiLogger: { error?: (category: string, message: string) => void } | null = null;

try {
  const draftModule = (await import('../../services/ai/draftService.js')) as any;
  const module = draftModule.default || draftModule;
  draftService = module.draftService || module;
  DRAFT_TYPES = module.DRAFT_TYPES || module;
} catch {
  logger.warn('[AI Drafts Routes] draftService not available');
}

try {
  const loggerModule = (await import('../../services/ai/logger.js')) as any;
  const module = loggerModule.default || loggerModule;
  aiLogger = module.aiLogger || module;
} catch {
  logger.warn('[AI Drafts Routes] aiLogger not available');
}

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/ai-drafts
 * Get pending drafts for the current user
 */
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!draftService?.getPendingDrafts) {
      return serviceFallback(req, res, { drafts: [], count: 0 });
    }

    try {
      const { projectId, draftType, limit } = req.query;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const drafts = await draftService.getPendingDrafts(userId, {
        organizationId,
        projectId: projectId as string | undefined,
        draftType: draftType as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      return res.json({
        success: true,
        drafts,
        count: Array.isArray(drafts) ? drafts.length : 0,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'DraftsAPI',
          `GET / error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to fetch drafts' });
    }
  })
);

/**
 * GET /api/ai-drafts/:id
 * Get a specific draft
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!draftService?.getDraft) {
      return serviceFallback(req, res, { draft: null });
    }

    try {
      const draft = (await draftService.getDraft(req.params.id)) as {
        user_id?: string;
        organization_id?: string;
      } | null;

      if (!draft) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      // Verify access
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;
      if (draft.user_id !== userId && draft.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json({ success: true, draft });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'DraftsAPI',
          `GET /:id error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to fetch draft' });
    }
  })
);

/**
 * GET /api/ai-drafts/entity/:type/:id
 * Get drafts for a specific entity (e.g., task, initiative)
 */
router.get(
  '/entity/:type/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!draftService?.getDraftsForEntity) {
      return serviceFallback(req, res, { drafts: [], count: 0 });
    }

    try {
      const drafts = await draftService.getDraftsForEntity(req.params.type, req.params.id);

      return res.json({
        success: true,
        drafts,
        count: Array.isArray(drafts) ? drafts.length : 0,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'DraftsAPI',
          `GET /entity error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to fetch entity drafts' });
    }
  })
);

/**
 * POST /api/ai-drafts
 * Create a new draft (typically called by AI services)
 */
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!draftService?.createDraft || !DRAFT_TYPES) {
      return serviceFallback(req, res);
    }

    try {
      const {
        draftType,
        targetEntityType,
        targetEntityId,
        targetField,
        originalContent,
        suggestedContent,
        confidence,
        reasoning,
        modelUsed,
        tokensUsed,
      } = req.body;

      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!draftType || !suggestedContent) {
        return res.status(400).json({
          error: 'Missing required fields: draftType, suggestedContent',
        });
      }

      if (!DRAFT_TYPES[draftType]) {
        return res.status(400).json({
          error: `Invalid draft type. Valid types: ${Object.keys(DRAFT_TYPES).join(', ')}`,
        });
      }

      const result = await draftService.createDraft({
        organizationId,
        projectId: req.body.projectId,
        userId,
        draftType,
        targetEntityType,
        targetEntityId,
        targetField,
        originalContent,
        suggestedContent,
        confidence,
        reasoning,
        modelUsed,
        tokensUsed,
      });

      return res.status(201).json({
        success: true,
        draft: result,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'DraftsAPI',
          `POST / error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to create draft' });
    }
  })
);

/**
 * PATCH /api/ai-drafts/:id/approve
 * Approve a draft (optionally with modifications)
 */
router.patch(
  '/:id/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!draftService?.approveDraft || !draftService?.getDraft) {
      return serviceFallback(req, res);
    }

    try {
      const { notes, modifications } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await draftService.approveDraft(req.params.id, {
        reviewedBy: userId,
        notes,
        modifications,
      });

      if (!result.success) {
        return res.status(404).json({ error: result.reason || 'Failed to approve draft' });
      }

      // Fetch the updated draft to return full details
      const draft = await draftService.getDraft(req.params.id);

      return res.json({
        success: true,
        status: result.status,
        draft,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'DraftsAPI',
          `PATCH /approve error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to approve draft' });
    }
  })
);

/**
 * PATCH /api/ai-drafts/:id/reject
 * Reject a draft
 */
router.patch(
  '/:id/reject',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!draftService?.rejectDraft) {
      return serviceFallback(req, res);
    }

    try {
      const { notes } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await draftService.rejectDraft(req.params.id, {
        reviewedBy: userId,
        notes,
      });

      if (!result.success) {
        return res.status(404).json({ error: result.reason || 'Failed to reject draft' });
      }

      return res.json({
        success: true,
        status: result.status,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'DraftsAPI',
          `PATCH /reject error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to reject draft' });
    }
  })
);

/**
 * GET /api/ai-drafts/user/stats
 * Get draft statistics for the current user
 */
router.get(
  '/user/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!draftService?.getDraftStats) {
      return serviceFallback(req, res, {
        stats: { total: 0, approved: 0, modified: 0, acceptanceRate: null },
      });
    }

    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const stats = await draftService.getDraftStats(userId, organizationId);

      return res.json({
        success: true,
        stats: {
          ...stats,
          acceptanceRate:
            stats.total > 0
              ? Math.round((((stats.approved || 0) + (stats.modified || 0)) / stats.total) * 100)
              : null,
        },
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'DraftsAPI',
          `GET /stats error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }
  })
);

/**
 * DELETE /api/ai-drafts/expired
 * Clean up expired drafts (admin only)
 */
router.delete(
  '/expired',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!draftService?.expireOldDrafts) {
      return serviceFallback(req, res);
    }

    try {
      // Check if user has admin role
      const userRole = (req.user?.role || '').toLowerCase();
      if (!['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(userRole)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await draftService.expireOldDrafts();

      return res.json({
        success: true,
        expiredCount: result.expired,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'DraftsAPI',
          `DELETE /expired error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to expire drafts' });
    }
  })
);

export default router;

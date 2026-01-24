// @ts-nocheck
/**
 * Knowledge Routes
 * API endpoints for knowledge management (candidates, strategies, documents)
 *
 * Fully migrated to TypeScript ES modules
 */

import { NextFunction, Response, Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

import { type AuthRequest, requireSuperAdmin, verifyToken } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import KnowledgeService from '../services/KnowledgeService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface IKnowledgeCandidate {
  id: string;
  content: string;
  reasoning: string;
  source: string;
  status: 'pending' | 'approved' | 'rejected' | 'implemented' | 'archived';
  origin_context?: string;
  related_axis?: string;
  category?: string;
  tags?: string[] | string;
  implementation_notes?: string;
  impact_score?: number;
  related_project_ids?: string[] | string;
  admin_comment?: string;
  created_at: string;
}

export interface IKnowledgeStrategy {
  id: string;
  title: string;
  description: string;
  created_by: string;
  success_metrics: string[] | string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  target_date?: string;
  progress_percentage: number;
  is_active: boolean | number;
  related_document_ids?: string[] | string;
  related_idea_ids?: string[] | string;
  created_at: string;
}

export interface IKnowledgeDocument {
  id: string;
  filename: string;
  filepath: string;
  organization_id: string;
  project_id?: string | null;
  file_size_bytes: number;
  status: 'pending' | 'indexing' | 'indexed' | 'error';
  category?: string;
  tags?: string[] | string;
  version?: number;
  parent_doc_id?: string;
  created_at: string;
  deleted_at?: string;
}

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

// Services
const StorageService: any = null;
const NotificationOutboxService: any = null;

// Services are currently not available - imports commented out
// Uncomment when services are ready:
// try {
//   const storageModule = (await import('../services/storageService.js')) as any;
//   StorageService = storageModule.default || storageModule;
// } catch {
//   logger.debug('[Knowledge] StorageService not available');
// }

// try {
//   const notificationModule = (await import('../services/notificationOutboxService.js')) as any;
//   NotificationOutboxService = notificationModule.default || notificationModule;
// } catch {
//   logger.debug('[Knowledge] NotificationOutboxService not available');
// }

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer to use a temporary staging directory
const upload = multer({
  dest: path.join(__dirname, '../../../uploads/temp'), // Staging area
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'text/markdown'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, and Markdown files are allowed'));
    }
  },
});

// Dynamic import for quota middleware (may not be migrated yet)
let enforceStorageQuota: any = null;
let recordStorageAfterUpload:
  | ((req: AuthRequest, size: number, type: string) => Promise<void>)
  | null = null;
let enforceProjectQuota: any = null;

try {
  const quotaModule = (await import('../middleware/quotaMiddleware.js')) as any;
  enforceStorageQuota = quotaModule.enforceStorageQuota;
  recordStorageAfterUpload = quotaModule.recordStorageAfterUpload;
} catch {
  logger.warn('[Knowledge] Quota middleware not available');
}

try {
  const projectQuotaModule = await import('../middleware/projectQuota.middleware.js');
  // enforceProjectQuota is a named export, not default
  enforceProjectQuota =
    projectQuotaModule.enforceProjectQuota || projectQuotaModule.default || projectQuotaModule;
} catch (error: any) {
  logger.warn(`[Knowledge] Project quota middleware not available: ${error.message}`);
}

/**
 * GET /api/knowledge/candidates
 * Get pending candidates (SuperAdmin only)
 */
router.get(
  '/candidates',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getCandidates) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const status = (req.query.status as string) || 'pending';
      const items = await KnowledgeService.getCandidates(status);
      return res.json(items);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * POST /api/knowledge/candidates
 * Submit a new candidate (Internal AI or User feedback)
 */
router.post(
  '/candidates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.addCandidate) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const { content, reasoning, source, relatedAxis, originContext } = req.body;
      const id = await KnowledgeService.addCandidate(
        content,
        reasoning,
        source,
        relatedAxis,
        originContext
      );
      return res.json({ id, message: 'Candidate submitted' });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * PUT /api/knowledge/candidates/:id/status
 * Review candidate (Approve/Reject)
 */
router.put(
  '/candidates/:id/status',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.updateCandidateStatus) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const { status, adminComment } = req.body;
      await KnowledgeService.updateCandidateStatus(req.params.id, status, adminComment);
      return res.json({ message: 'Status updated' });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * PUT /api/knowledge/candidates/:id
 * Update candidate (full update with category, tags, etc.)
 */
router.put(
  '/candidates/:id',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.updateCandidate) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const updates: Partial<IKnowledgeCandidate> = {};
      if (req.body.category !== undefined) updates.category = req.body.category;
      if (req.body.tags !== undefined) {
        updates.tags = Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags);
      }
      if (req.body.implementation_notes !== undefined)
        updates.implementation_notes = req.body.implementation_notes;
      if (req.body.impact_score !== undefined) updates.impact_score = req.body.impact_score;
      if (req.body.status !== undefined) updates.status = req.body.status;

      const changes = await KnowledgeService.updateCandidate(req.params.id, updates);
      return res.json({ message: 'Candidate updated', changes });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * POST /api/knowledge/candidates/:id/link-project
 * Link idea to project
 */
router.post(
  '/candidates/:id/link-project',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.linkIdeaToProject) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const { project_id, notes } = req.body;
      if (!project_id) {
        return res.status(400).json({ error: 'project_id is required' });
        return;
      }

      const changes = await KnowledgeService.linkIdeaToProject(
        req.params.id,
        project_id,
        notes || ''
      );
      return res.json({ message: 'Idea linked to project', changes });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * GET /api/knowledge/candidates/approved
 * Get approved ideas library
 */
router.get(
  '/candidates/approved',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getApprovedIdeas) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const filters: Record<string, string> = {};
      if (req.query.category) filters.category = req.query.category as string;

      const ideas = await KnowledgeService.getApprovedIdeas(filters);
      return res.json(ideas);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * GET /api/knowledge/candidates/by-category/:category
 * Get ideas by category
 */
router.get(
  '/candidates/by-category/:category',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getIdeasByCategory) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const ideas = await KnowledgeService.getIdeasByCategory(req.params.category);
      return res.json(ideas);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * GET /api/knowledge/candidates/by-project/:projectId
 * Get ideas by project
 */
router.get(
  '/candidates/by-project/:projectId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getIdeasByProject) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const ideas = await KnowledgeService.getIdeasByProject(req.params.projectId);
      return res.json(ideas);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * GET /api/knowledge/strategies
 * Get global strategies
 */
router.get(
  '/strategies',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getAllStrategies || !KnowledgeService?.getActiveStrategies) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      // Active strategies are public for all users (to influence AI)
      const all = req.query.all === 'true';
      const strategies = all
        ? await KnowledgeService.getAllStrategies()
        : await KnowledgeService.getActiveStrategies();
      return res.json(strategies);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * POST /api/knowledge/strategies
 * Create strategy (SuperAdmin only)
 */
router.post(
  '/strategies',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.addStrategy) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const { title, description, success_metrics, priority, target_date, progress_percentage } =
        req.body;
      const options = {
        success_metrics: success_metrics || [],
        priority: priority || 'medium',
        target_date: target_date || null,
        progress_percentage: progress_percentage || 0,
      };
      const id = await KnowledgeService.addStrategy(
        title,
        description,
        req.user?.email || 'admin',
        options
      );
      return res.json({ id, message: 'Strategy created' });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * PUT /api/knowledge/strategies/:id
 * Update strategy (SuperAdmin only)
 */
router.put(
  '/strategies/:id',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.updateStrategy) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const updates: Partial<IKnowledgeStrategy> = {};
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.success_metrics !== undefined) {
        updates.success_metrics = Array.isArray(req.body.success_metrics)
          ? req.body.success_metrics
          : JSON.parse(req.body.success_metrics);
      }
      if (req.body.priority !== undefined) updates.priority = req.body.priority;
      if (req.body.target_date !== undefined) updates.target_date = req.body.target_date;
      if (req.body.progress_percentage !== undefined)
        updates.progress_percentage = req.body.progress_percentage;
      if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;

      const changes = await KnowledgeService.updateStrategy(req.params.id, updates);
      return res.json({ message: 'Strategy updated', changes });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * POST /api/knowledge/strategies/:id/link-document
 * Link document to strategy (SuperAdmin only)
 */
router.post(
  '/strategies/:id/link-document',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.linkStrategyToDocument) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const { document_id } = req.body;
      if (!document_id) {
        return res.status(400).json({ error: 'document_id is required' });
        return;
      }

      const changes = await KnowledgeService.linkStrategyToDocument(req.params.id, document_id);
      return res.json({ message: 'Document linked to strategy', changes });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * POST /api/knowledge/strategies/:id/link-idea
 * Link idea to strategy (SuperAdmin only)
 */
router.post(
  '/strategies/:id/link-idea',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.linkStrategyToIdea) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const { idea_id } = req.body;
      if (!idea_id) {
        return res.status(400).json({ error: 'idea_id is required' });
        return;
      }

      const changes = await KnowledgeService.linkStrategyToIdea(req.params.id, idea_id);
      return res.json({ message: 'Idea linked to strategy', changes });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * DELETE /api/knowledge/strategies/:id/unlink-document/:docId
 * Unlink document from strategy (SuperAdmin only)
 */
router.delete(
  '/strategies/:id/unlink-document/:docId',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.unlinkStrategyFromDocument) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const changes = await KnowledgeService.unlinkStrategyFromDocument(
        req.params.id,
        req.params.docId
      );
      return res.json({ message: 'Document unlinked from strategy', changes });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * DELETE /api/knowledge/strategies/:id/unlink-idea/:ideaId
 * Unlink idea from strategy (SuperAdmin only)
 */
router.delete(
  '/strategies/:id/unlink-idea/:ideaId',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.unlinkStrategyFromIdea) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const changes = await KnowledgeService.unlinkStrategyFromIdea(
        req.params.id,
        req.params.ideaId
      );
      return res.json({ message: 'Idea unlinked from strategy', changes });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * PUT /api/knowledge/strategies/:id/progress
 * Update strategy progress (SuperAdmin only)
 */
router.put(
  '/strategies/:id/progress',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.updateStrategyProgress) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const { progress_percentage } = req.body;
      if (progress_percentage === undefined) {
        return res.status(400).json({ error: 'progress_percentage is required' });
        return;
      }

      const changes = await KnowledgeService.updateStrategyProgress(
        req.params.id,
        progress_percentage
      );
      return res.json({ message: 'Strategy progress updated', changes });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * GET /api/knowledge/strategies/:id/related
 * Get strategy with related items
 */
router.get(
  '/strategies/:id/related',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getStrategyWithRelated) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const strategy = await KnowledgeService.getStrategyWithRelated(req.params.id);
      if (!strategy) {
        return res.status(404).json({ error: 'Strategy not found' });
        return;
      }
      return res.json(strategy);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * PUT /api/knowledge/strategies/:id/toggle
 * Toggle strategy active status (SuperAdmin only)
 */
router.put(
  '/strategies/:id/toggle',
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.toggleStrategy) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const { isActive } = req.body;
      await KnowledgeService.toggleStrategy(req.params.id, isActive);
      return res.json({ message: 'Strategy toggled' });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * POST /api/knowledge/documents
 * Upload knowledge document
 */
router.post(
  '/documents',
  verifyToken,
  enforceStorageQuota || ((_req: AuthRequest, _res: Response, next: NextFunction) => next()),
  upload.single('file'),
  enforceProjectQuota || ((_req: AuthRequest, _res: Response, next: NextFunction) => next()),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    let tempPath: string | null = null;
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      if (
        !StorageService?.storeFile ||
        !KnowledgeService?.addDocument ||
        !KnowledgeService?.processDocument
      ) {
        return res.status(503).json({ error: 'Required services not available' });
        return;
      }

      const { originalname, size, path: multerPath, mimetype } = req.file;
      tempPath = multerPath;

      const orgId = req.user?.organizationId;
      // Force project_id = NULL for global knowledge docs (organization-level only)
      const projectId = null;

      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Move file to isolated storage (use null for projectId to enforce global scope)
      const finalPath = await StorageService.storeFile(
        tempPath,
        orgId,
        null,
        'knowledge',
        originalname
      );

      // Save metadata with category and tags
      const category = (req.body.category as string) || null;
      const tags = req.body.tags
        ? Array.isArray(req.body.tags)
          ? req.body.tags
          : JSON.parse(req.body.tags as string)
        : [];
      const docId = await KnowledgeService.addDocument(
        originalname,
        finalPath,
        orgId,
        projectId,
        size,
        category,
        tags
      );

      // Extract Text
      let text = '';
      try {
        if (mimetype === 'application/pdf') {
          const pdfParseMod = (await import('pdf-parse')) as any;
          const pdf = pdfParseMod.default || pdfParseMod;
          const dataBuffer = fs.readFileSync(finalPath);
          const pdfData = await pdf(dataBuffer);
          text = pdfData.text;
        } else {
          text = fs.readFileSync(finalPath, 'utf8');
        }
      } catch (pdfErr) {
        logger.error('PDF Parsing error', pdfErr);
        text = 'Error parsing PDF content';
      }

      // Process & Index (Async)
      const chunkCount = await KnowledgeService.processDocument(docId, text);

      // Record storage usage (Organization Level)
      if (recordStorageAfterUpload) {
        await recordStorageAfterUpload(req, size, 'document_upload');
      }

      return res.json({ message: 'Document uploaded and indexed', docId, chunkCount });
    } catch (err: any) {
      logger.error('Upload Error', err);
      // Cleanup temp file if it still exists
      if (tempPath && fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (e) {}
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

/**
 * GET /api/knowledge/documents
 * Get knowledge documents
 */
router.get(
  '/documents',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (
      !KnowledgeService?.getDocuments ||
      !KnowledgeService?.getDocumentsByCategory ||
      !KnowledgeService?.getDocumentsByStrategy
    ) {
      return res.status(503).json({ error: 'Knowledge service not available' });
    }

    try {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const role = req.user?.role || 'USER';
      const category = req.query.category as string | undefined;
      const strategyId = req.query.strategy_id as string | undefined;

      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      let docs: any[];
      if (strategyId) {
        docs = await KnowledgeService.getDocumentsByStrategy(strategyId);
      } else if (category) {
        docs = await KnowledgeService.getDocumentsByCategory(orgId, category);
      } else {
        docs = await KnowledgeService.getDocuments(orgId, userId, role);
      }

      // Parse JSON fields
      const parsed = docs.map((doc: any) => ({
        ...doc,
        tags: doc.tags ? (typeof doc.tags === 'string' ? JSON.parse(doc.tags) : doc.tags) : [],
      }));

      return res.json(parsed);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
    return;
  })
);

export default router;
